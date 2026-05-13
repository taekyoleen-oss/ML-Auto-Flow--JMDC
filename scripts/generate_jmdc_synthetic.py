"""
Generate a synthetic JMDC-shaped raw dataset (7 tables) for demo/regression tests.

References:
  ml_framework_appendix/appendix_E_data_preparation.sql   — column truth
  ml_framework_appendix/appendix_A_charlson_icd10.csv     — Charlson ICD-10
  ml_framework_appendix/appendix_B_atc_categories.csv     — ATC categories
  ml_framework_appendix/appendix_C_feature_dictionary.csv — feature lookbacks/defaults

Approach: patient-profile first. Each member gets latent comorbidity / smoking /
BMI flags, then claims, diagnoses, drugs, medical-acts, and checkup rows are
derived from that profile so the dataset is internally consistent (DM patients
have A10A/A10B and elevated HbA1c, HTN patients have C09 and elevated SBP, etc.).

Run from repo root:
    python scripts/generate_jmdc_synthetic.py
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SEED = 42
N_MEMBERS = 1_000
N_HOUSEHOLDS = 400
N_INSTITUTIONS = 500
DATASET_ID = 1

OBS_WINDOW_START = date(2017, 1, 1)
OBS_WINDOW_END = date(2023, 12, 31)

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "jmdc_synthetic"
OUT_DIR.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(SEED)


# ---------------------------------------------------------------------------
# Reference vocabularies (from appendices A, B)
# ---------------------------------------------------------------------------

# Representative ICD-10 codes from Charlson list (appendix A) + common general codes
ICD10_BY_CONDITION = {
    "mi":              ["I21", "I22", "I25.2"],
    "chf":             ["I50", "I50.0", "I50.9"],
    "pvd":             ["I70", "I71", "I73.1"],
    "cva":             ["I63", "I64", "I65", "G45"],
    "dementia":        ["F03", "G30"],
    "copd":            ["J44", "J45"],
    "rheumatic":       ["M05", "M06"],
    "pud":             ["K25", "K26", "K27"],
    "liver_mild":      ["K70", "K74"],
    "dm_no_compl":     ["E11.9", "E10.9", "E14.9"],
    "dm_with_compl":   ["E11.2", "E11.5", "E10.5"],
    "hemiplegia":      ["G81", "G82"],
    "ckd":             ["N18", "N18.5", "N19"],
    "cancer":          ["C18", "C19", "C20", "C34", "C50", "C61", "C16"],
    "liver_severe":    ["K72.1", "K76.6"],
    "metastasis":      ["C78", "C79"],
    "aids":            ["B20", "B24"],
    # Non-Charlson but extremely common, included for realism
    "htn":             ["I10"],
    "hld":             ["E78.0", "E78.5"],
    "general":         ["J06", "K29", "M54", "R51", "L20", "H10", "N39", "K59"],
}

# ATC subset from appendix B (level-3 or level-5 codes we will sample)
ATC_BY_CLASS = {
    "insulin":          ["A10A"],
    "oad":              ["A10B"],
    "antihypertensive": ["C09", "C08", "C07", "C03"],
    "statin":           ["C10AA"],
    "aspirin":          ["B01AC06"],
    "doac":             ["B01AF"],
    "chemo":            ["L01", "L01XC"],
    "steroid":          ["H02A"],
    "antibiotic":       ["J01"],
    "ppi":              ["A02B"],
    "asthma":           ["R03", "R03AK"],
    "antihistamine":    ["R06"],
    "opioid":           ["N02A"],
    "psychotropic":     ["N05A", "N05B", "N06A"],
    "nsaid":            ["M01A"],
}

# Medical-act codes — synthetic but stable. category: 50=surgery, 60=lab, 70=imaging
MEDACT_CODES = {
    50: [f"SR{i:03d}" for i in range(1, 11)],
    60: [f"LB{i:03d}" for i in range(1, 21)],
    70: [f"IM{i:03d}" for i in range(1, 11)],
}

# Prefecture codes 01..47 with rough population weights (Tokyo=13 heaviest)
PREFECTURES = [f"{i:02d}" for i in range(1, 48)]
PREF_WEIGHTS = np.ones(47)
PREF_WEIGHTS[12] = 8.0   # 13 Tokyo
PREF_WEIGHTS[26] = 5.0   # 27 Osaka
PREF_WEIGHTS[13] = 4.0   # 14 Kanagawa
PREF_WEIGHTS[22] = 3.5   # 23 Aichi
PREF_WEIGHTS[39] = 3.0   # 40 Fukuoka
PREF_WEIGHTS = PREF_WEIGHTS / PREF_WEIGHTS.sum()

# Comorbidity prevalence (appendix C feature dictionary guidance)
PREVALENCE = {
    "dm":         0.10,
    "htn":        0.25,
    "hld":        0.22,
    "chf":        0.03,
    "ckd":        0.04,
    "cancer":     0.05,
    "copd":       0.06,
    "cva":        0.03,
    "mi":         0.02,
    "dementia":   0.02,
    "rheumatic":  0.02,
    "liver_mild": 0.04,
    "metastasis": 0.01,
    "aids":       0.002,
}


def _to_pyd(d: np.datetime64) -> date:
    return pd.Timestamp(d).date()


def _date_range_days(start: date, end: date) -> int:
    return (end - start).days


# ---------------------------------------------------------------------------
# 1) his_population — also produces a hidden patient-profile frame
# ---------------------------------------------------------------------------

def build_population() -> tuple[pd.DataFrame, pd.DataFrame]:
    member_ids = [f"M{i:06d}" for i in range(1, N_MEMBERS + 1)]

    # Age 20..85 (median ~50). Beta(2,3)*65 + 20 -> right-skewed mid 40s..60s
    ages = (rng.beta(2.2, 2.5, N_MEMBERS) * 65 + 20).astype(int)
    sex_codes = rng.choice([1, 2], N_MEMBERS, p=[0.49, 0.51])

    # birth_yyyymm = today minus age years +- random month
    today = date(2024, 1, 1)
    birth_years = today.year - ages
    birth_months = rng.integers(1, 13, N_MEMBERS)
    birth_yyyymm = [f"{y}{m:02d}" for y, m in zip(birth_years, birth_months)]

    # Household assignment: H001..HNHH. Heads first, then dependents share households.
    household_ids = [f"H{rng.integers(1, N_HOUSEHOLDS + 1):03d}" for _ in range(N_MEMBERS)]
    # Relation: 1=head 60%, 2=spouse 25%, 3=child 15%
    relation_codes = rng.choice([1, 2, 3], N_MEMBERS, p=[0.60, 0.25, 0.15])

    # Observation window: first_obs in [2017-01-01, 2020-06-30], duration 3..7y, capped 2023-12-31
    first_obs_offset_days = rng.integers(
        0, _date_range_days(OBS_WINDOW_START, date(2020, 6, 30)), N_MEMBERS
    )
    first_obs = [OBS_WINDOW_START + timedelta(days=int(d)) for d in first_obs_offset_days]
    duration_days = rng.integers(365 * 3, 365 * 7, N_MEMBERS)
    last_obs = [min(f + timedelta(days=int(d)), OBS_WINDOW_END) for f, d in zip(first_obs, duration_days)]

    population = pd.DataFrame(
        {
            "member_id": member_ids,
            "dataset_id": DATASET_ID,
            "sex_code": sex_codes,
            "birth_yyyymm": birth_yyyymm,
            "relation_code": relation_codes,
            "first_obs_date": first_obs,
            "last_obs_date": last_obs,
            "household_id": household_ids,
        }
    )

    # Latent comorbidity profile — age-modulated prevalence (older => more disease).
    # Risk multiplier centered at 1.0 around age 50, range ~0.4..2.5.
    age_factor = np.clip((ages - 15) / 35.0, 0.4, 2.5)
    profile = {"member_id": member_ids, "age": ages, "sex_code": sex_codes}
    for cond, base_p in PREVALENCE.items():
        p = np.clip(base_p * age_factor, 0, 0.95)
        profile[f"has_{cond}"] = (rng.random(N_MEMBERS) < p).astype(int)

    # DM with complications is a subset of DM
    has_dm = np.asarray(profile["has_dm"])
    profile["has_dm_compl"] = ((rng.random(N_MEMBERS) < 0.35) & (has_dm == 1)).astype(int)

    # Smoking and BMI category
    # smoke: 0=never 60%, 1=current 25%, 2=former 15% (males biased to 1)
    male = sex_codes == 1
    smoke = np.where(
        male,
        rng.choice([0, 1, 2], N_MEMBERS, p=[0.45, 0.35, 0.20]),
        rng.choice([0, 1, 2], N_MEMBERS, p=[0.75, 0.15, 0.10]),
    )
    profile["smoke_status"] = smoke
    profile["bmi"] = np.clip(rng.normal(23, 3.5, N_MEMBERS), 15, 45)

    profile_df = pd.DataFrame(profile)
    return population, profile_df


# ---------------------------------------------------------------------------
# 2) his_medical_institution — each member visits 1..5 favorite institutions
# ---------------------------------------------------------------------------

def build_institutions(population: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    rows = []
    member_to_insts: dict[str, list[str]] = {}
    for _, p in population.iterrows():
        n_inst = int(rng.integers(1, 6))
        insts = [f"I{rng.integers(1, N_INSTITUTIONS + 1):04d}" for _ in range(n_inst)]
        insts = list(dict.fromkeys(insts))  # dedupe but preserve order
        member_to_insts[p.member_id] = insts
        pref = rng.choice(PREFECTURES, p=PREF_WEIGHTS)
        first_visit_offset = rng.integers(
            0, max(1, (p.last_obs_date - p.first_obs_date).days)
        )
        visit_date = p.first_obs_date + timedelta(days=int(first_visit_offset))
        for inst in insts:
            rows.append(
                {
                    "institution_id": inst,
                    "member_id": p.member_id,
                    "visit_date": visit_date,
                    "prefecture_code": pref,
                }
            )
    return pd.DataFrame(rows), member_to_insts


# ---------------------------------------------------------------------------
# 3) his_claims — per-member yearly visit rate scaled by comorbidity load
# ---------------------------------------------------------------------------

def _claims_per_year(profile_row: pd.Series) -> float:
    base = 6.0
    bumps = (
        6 * profile_row.has_dm
        + 3 * profile_row.has_htn
        + 12 * profile_row.has_cancer
        + 8 * profile_row.has_chf
        + 6 * profile_row.has_ckd
        + 4 * profile_row.has_copd
        + 3 * profile_row.has_mi
        + 3 * profile_row.has_cva
    )
    return float(base + bumps)


def build_claims(
    population: pd.DataFrame,
    profile: pd.DataFrame,
    member_to_insts: dict[str, list[str]],
) -> pd.DataFrame:
    rows = []
    claim_seq = 1
    pop_idx = population.set_index("member_id")
    prof_idx = profile.set_index("member_id")
    for mid in population.member_id:
        p = pop_idx.loc[mid]
        prf = prof_idx.loc[mid]
        years = max(1.0, (p.last_obs_date - p.first_obs_date).days / 365.25)
        lam = _claims_per_year(prf) * years
        n_claims = int(rng.poisson(lam))
        if n_claims == 0:
            continue
        offsets = rng.integers(0, max(1, (p.last_obs_date - p.first_obs_date).days), n_claims)
        insts = member_to_insts[mid]
        types = rng.choice([11, 12, 13], n_claims, p=[0.85, 0.08, 0.07])
        for off, ct in zip(offsets, types):
            claim_date = p.first_obs_date + timedelta(days=int(off))
            if ct == 11:
                care_days = 1
                total_points = int(np.clip(rng.lognormal(6.0, 0.6), 100, 5000))
            else:
                care_days = int(np.clip(rng.lognormal(1.8, 0.7), 2, 60))
                total_points = int(care_days * rng.integers(4000, 10000))
            rows.append(
                {
                    "claim_id": f"C{claim_seq:08d}",
                    "member_id": mid,
                    "dataset_id": DATASET_ID,
                    "claim_date": claim_date,
                    "claim_type": int(ct),
                    "care_days": care_days,
                    "total_points": total_points,
                    "institution_id": str(rng.choice(insts)),
                }
            )
            claim_seq += 1
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 4) his_claims_disease — driven by patient profile
# ---------------------------------------------------------------------------

def _disease_pool_for_member(prf: pd.Series) -> list[str]:
    """Build the ICD-10 sampling pool for a member, weighted by their conditions."""
    pool: list[str] = []
    if prf.has_dm:
        pool += ICD10_BY_CONDITION["dm_no_compl"] * 6
    if prf.has_dm_compl:
        pool += ICD10_BY_CONDITION["dm_with_compl"] * 4
    if prf.has_htn:
        pool += ICD10_BY_CONDITION["htn"] * 8
    if prf.has_hld:
        pool += ICD10_BY_CONDITION["hld"] * 5
    if prf.has_chf:
        pool += ICD10_BY_CONDITION["chf"] * 5
    if prf.has_mi:
        pool += ICD10_BY_CONDITION["mi"] * 3
    if prf.has_cva:
        pool += ICD10_BY_CONDITION["cva"] * 3
    if prf.has_ckd:
        pool += ICD10_BY_CONDITION["ckd"] * 4
    if prf.has_cancer:
        pool += ICD10_BY_CONDITION["cancer"] * 6
    if prf.has_metastasis:
        pool += ICD10_BY_CONDITION["metastasis"] * 3
    if prf.has_copd:
        pool += ICD10_BY_CONDITION["copd"] * 4
    if prf.has_dementia:
        pool += ICD10_BY_CONDITION["dementia"] * 3
    if prf.has_liver_mild:
        pool += ICD10_BY_CONDITION["liver_mild"] * 2
    if prf.has_rheumatic:
        pool += ICD10_BY_CONDITION["rheumatic"] * 2
    if prf.has_aids:
        pool += ICD10_BY_CONDITION["aids"] * 4
    # Everyone gets some general codes
    pool += ICD10_BY_CONDITION["general"] * 8
    return pool


def build_diseases(claims: pd.DataFrame, profile: pd.DataFrame) -> pd.DataFrame:
    prof_idx = profile.set_index("member_id")
    pools = {mid: _disease_pool_for_member(prof_idx.loc[mid]) for mid in profile.member_id}
    rows = []
    for c in claims.itertuples(index=False):
        n_dx = int(np.clip(rng.poisson(1.4) + 1, 1, 5))
        pool = pools[c.member_id]
        codes = rng.choice(pool, size=n_dx, replace=True)
        for code in codes:
            suspect = int(rng.random() < 0.10)
            # onset_date typically = claim_date; sometimes earlier
            onset = c.claim_date - timedelta(days=int(rng.integers(0, 90)))
            rows.append(
                {
                    "claim_id": c.claim_id,
                    "member_id": c.member_id,
                    "dataset_id": DATASET_ID,
                    "icd10_code": str(code),
                    "onset_date": onset,
                    "suspect_flag": suspect,
                }
            )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 5) his_claims_drugs — outpatient claims drive prescriptions
# ---------------------------------------------------------------------------

def _drug_pool_for_member(prf: pd.Series) -> list[str]:
    pool: list[str] = []
    if prf.has_dm:
        pool += ATC_BY_CLASS["oad"] * 6
        if prf.has_dm_compl or rng.random() < 0.3:
            pool += ATC_BY_CLASS["insulin"] * 3
    if prf.has_htn or prf.has_chf or prf.has_ckd:
        pool += ATC_BY_CLASS["antihypertensive"] * 6
    if prf.has_hld:
        pool += ATC_BY_CLASS["statin"] * 5
    if prf.has_mi or prf.has_cva:
        pool += ATC_BY_CLASS["aspirin"] * 3
        pool += ATC_BY_CLASS["doac"] * 2
    if prf.has_cancer:
        pool += ATC_BY_CLASS["chemo"] * 4
        if rng.random() < 0.5:
            pool += ATC_BY_CLASS["opioid"] * 2
    if prf.has_rheumatic:
        pool += ATC_BY_CLASS["steroid"] * 3
    if prf.has_copd:
        pool += ATC_BY_CLASS["asthma"] * 4
    pool += ATC_BY_CLASS["ppi"] * 2
    pool += ATC_BY_CLASS["antibiotic"] * 1
    pool += ATC_BY_CLASS["antihistamine"] * 1
    pool += ATC_BY_CLASS["nsaid"] * 2
    if rng.random() < 0.05:
        pool += ATC_BY_CLASS["psychotropic"] * 2
    return pool


def build_drugs(claims: pd.DataFrame, profile: pd.DataFrame) -> pd.DataFrame:
    prof_idx = profile.set_index("member_id")
    pools = {mid: _drug_pool_for_member(prof_idx.loc[mid]) for mid in profile.member_id}
    rows = []
    for c in claims.itertuples(index=False):
        # 60% of outpatient + 40% of inpatient claims carry prescriptions
        prob = 0.60 if c.claim_type == 11 else 0.40
        if rng.random() > prob:
            continue
        pool = pools[c.member_id]
        if not pool:
            continue
        n_rx = int(np.clip(rng.poisson(1.3) + 1, 1, 4))
        codes = rng.choice(pool, size=n_rx, replace=True)
        for code in codes:
            days = int(rng.choice([14, 30, 60, 90], p=[0.15, 0.55, 0.20, 0.10]))
            rows.append(
                {
                    "claim_id": c.claim_id,
                    "member_id": c.member_id,
                    "atc_code": str(code),
                    "prescription_date": c.claim_date,
                    "days_supply": days,
                }
            )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 6) his_claims_medacts — ~50% of claims include 1..3 acts
# ---------------------------------------------------------------------------

def build_medacts(claims: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for c in claims.itertuples(index=False):
        if rng.random() > 0.50:
            continue
        n_acts = int(np.clip(rng.poisson(0.8) + 1, 1, 3))
        for _ in range(n_acts):
            cat = int(rng.choice([50, 60, 70], p=[0.02, 0.70, 0.28]))
            code = str(rng.choice(MEDACT_CODES[cat]))
            rows.append(
                {
                    "claim_id": c.claim_id,
                    "member_id": c.member_id,
                    "act_code": code,
                    "act_category": cat,
                    "act_date": c.claim_date,
                }
            )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 7) his_health_checkup — annual checkup in subset of members
# ---------------------------------------------------------------------------

def build_checkups(population: pd.DataFrame, profile: pd.DataFrame) -> pd.DataFrame:
    rows = []
    pop_idx = population.set_index("member_id")
    for prf in profile.itertuples(index=False):
        p = pop_idx.loc[prf.member_id]
        n_visits = int(rng.poisson(2.0))
        if n_visits == 0:
            continue
        years_span = max(1, (p.last_obs_date - p.first_obs_date).days // 365)
        n_visits = min(n_visits, years_span + 1)
        chosen_years = rng.choice(range(years_span + 1), size=n_visits, replace=False)
        sex = p.sex_code
        height = float(np.clip(rng.normal(170 if sex == 1 else 158, 6.5), 140, 195))
        bmi_base = float(prf.bmi)
        for yi in chosen_years:
            day_off = int(rng.integers(0, 364))
            checkup_date = p.first_obs_date + timedelta(days=int(yi) * 365 + day_off)
            if checkup_date > p.last_obs_date:
                checkup_date = p.last_obs_date
            bmi = bmi_base + rng.normal(0, 0.4)
            weight = bmi * ((height / 100) ** 2)
            # Blood pressure
            if prf.has_htn:
                sbp = float(np.clip(rng.normal(155, 12), 130, 200))
                dbp = float(np.clip(rng.normal(95, 8), 75, 120))
            else:
                sbp = float(np.clip(rng.normal(120, 10), 90, 170))
                dbp = float(np.clip(rng.normal(78, 8), 55, 105))
            # Lipids
            if prf.has_hld:
                ldl = float(np.clip(rng.normal(165, 20), 130, 250))
                tg = float(np.clip(rng.normal(220, 60), 100, 700))
                hdl = float(np.clip(rng.normal(42, 8), 25, 80))
            else:
                ldl = float(np.clip(rng.normal(118, 22), 60, 200))
                tg = float(np.clip(rng.normal(135, 50), 40, 400))
                hdl = float(np.clip(rng.normal(55, 12), 30, 100))
            # Glycemic
            if prf.has_dm:
                hba1c = float(np.clip(rng.normal(7.6, 0.9), 6.3, 12.0))
                fbg = float(np.clip(rng.normal(165, 35), 110, 320))
            else:
                hba1c = float(np.clip(rng.normal(5.5, 0.35), 4.5, 6.4))
                fbg = float(np.clip(rng.normal(95, 10), 70, 125))
            rows.append(
                {
                    "member_id": prf.member_id,
                    "checkup_date": checkup_date,
                    "height_cm": round(height, 1),
                    "weight_kg": round(weight, 1),
                    "sbp_mmhg": round(sbp, 1),
                    "dbp_mmhg": round(dbp, 1),
                    "ldl_mgdl": round(ldl, 1),
                    "hdl_mgdl": round(hdl, 1),
                    "tg_mgdl": round(tg, 1),
                    "hba1c_ngsp": round(hba1c, 2),
                    "fbg_mgdl": round(fbg, 1),
                    "smoke_status": int(prf.smoke_status),
                }
            )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"[seed={SEED}] generating {N_MEMBERS} members -> {OUT_DIR}")

    population, profile = build_population()
    print(f"  his_population: {len(population)} rows")

    institutions, member_to_insts = build_institutions(population)
    print(f"  his_medical_institution: {len(institutions)} rows")

    claims = build_claims(population, profile, member_to_insts)
    print(f"  his_claims: {len(claims)} rows")

    diseases = build_diseases(claims, profile)
    print(f"  his_claims_disease: {len(diseases)} rows")

    drugs = build_drugs(claims, profile)
    print(f"  his_claims_drugs: {len(drugs)} rows")

    medacts = build_medacts(claims)
    print(f"  his_claims_medacts: {len(medacts)} rows")

    checkups = build_checkups(population, profile)
    print(f"  his_health_checkup: {len(checkups)} rows")

    population.to_csv(OUT_DIR / "his_population.csv", index=False)
    institutions.to_csv(OUT_DIR / "his_medical_institution.csv", index=False)
    claims.to_csv(OUT_DIR / "his_claims.csv", index=False)
    diseases.to_csv(OUT_DIR / "his_claims_disease.csv", index=False)
    drugs.to_csv(OUT_DIR / "his_claims_drugs.csv", index=False)
    medacts.to_csv(OUT_DIR / "his_claims_medacts.csv", index=False)
    checkups.to_csv(OUT_DIR / "his_health_checkup.csv", index=False)

    # Cohort-ready CSV — flat shape that JMDCCohortBuilder accepts as `data_source='csv'`.
    # Adds derived columns: birth_date, bmi, has_diabetes, has_htn, charlson.
    birth_date = pd.to_datetime(population["birth_yyyymm"] + "15", format="%Y%m%d")
    charlson_score = (
        profile.has_mi + profile.has_chf + profile.has_cva
        + profile.has_dementia + profile.has_copd + profile.has_rheumatic
        + profile.has_dm + profile.has_dm_compl * 2
        + profile.has_ckd * 2 + profile.has_cancer * 2
        + profile.has_metastasis * 6 + profile.has_aids * 6
        + profile.has_liver_mild
    )
    cohort_ready = pd.DataFrame(
        {
            "member_id": population.member_id,
            "sex_code": population.sex_code.astype(str),
            "birth_date": birth_date.dt.strftime("%Y-%m-%d"),
            "first_obs_date": pd.to_datetime(population.first_obs_date).dt.strftime("%Y-%m-%d"),
            "last_obs_date": pd.to_datetime(population.last_obs_date).dt.strftime("%Y-%m-%d"),
            "bmi": profile.bmi.round(1),
            "has_diabetes": profile.has_dm,
            "has_htn": profile.has_htn,
            "charlson": charlson_score.astype(int),
        }
    )
    cohort_ready.to_csv(OUT_DIR / "cohort_ready.csv", index=False)

    # ---------------- Validation summary ----------------
    print("\n=== validation ===")
    print(f"sex distribution: {population.sex_code.value_counts(normalize=True).round(3).to_dict()}")
    ages = 2024 - population.birth_yyyymm.str[:4].astype(int)
    print(
        f"age   min={ages.min()} median={int(ages.median())} max={ages.max()}"
    )
    print(f"top-5 prefectures: {institutions.prefecture_code.value_counts().head(5).to_dict()}")
    print(f"claim_type mix:   {claims.claim_type.value_counts(normalize=True).round(3).to_dict()}")

    dm_members = profile.loc[profile.has_dm == 1, "member_id"].tolist()
    dm_drug = drugs[drugs.member_id.isin(dm_members) & drugs.atc_code.str.startswith(("A10A", "A10B"))]
    if dm_members:
        coverage = dm_drug.member_id.nunique() / len(dm_members)
        print(f"DM patients with A10A/A10B prescription: {coverage:.1%} of {len(dm_members)} ({'OK' if coverage > 0.7 else 'LOW'})")

    htn_members = profile.loc[profile.has_htn == 1, "member_id"].tolist()
    htn_drug = drugs[drugs.member_id.isin(htn_members) & drugs.atc_code.isin(["C09", "C08", "C07", "C03"])]
    if htn_members:
        coverage = htn_drug.member_id.nunique() / len(htn_members)
        print(f"HTN patients with C09/C08/C07/C03:       {coverage:.1%} of {len(htn_members)} ({'OK' if coverage > 0.7 else 'LOW'})")

    print("\nprevalence (latent profile vs target):")
    for cond, target in PREVALENCE.items():
        observed = profile[f"has_{cond}"].mean()
        print(f"  {cond:12s} observed={observed:.3f}  target~{target:.3f}")

    print(f"\nfiles written to: {OUT_DIR}")


if __name__ == "__main__":
    main()
