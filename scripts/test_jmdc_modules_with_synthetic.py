"""
Integration test: run the EXACT Python code that the JMDC modules execute in
Pyodide (extracted from utils/pyodideRunner.ts) against our synthetic CSVs.

This mimics what the canvas does when the user wires:

    LoadData(cohort_ready.csv) ──► JMDCCohortBuilder(data_source='csv')
                                    │
                                    └─► JMDCOutcomeLabeler(claims=his_claims_disease.csv)

The embedded Python strings JMDC_COHORT_PY and JMDC_OUTCOME_PY are pulled
straight from utils/pyodideRunner.ts at runtime so this test cannot drift.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RUNNER_TS = ROOT / "utils" / "pyodideRunner.ts"
DATA_DIR = ROOT / "data" / "jmdc_synthetic"


def extract_embedded(ts_source: str, const_name: str) -> str:
    """Pull the backtick-delimited Python string for the given const."""
    pattern = re.compile(
        rf"const\s+{re.escape(const_name)}\s*=\s*`(?P<body>.*?)`\s*;",
        re.DOTALL,
    )
    m = pattern.search(ts_source)
    if not m:
        raise RuntimeError(f"Could not find {const_name} in {RUNNER_TS}")
    return m.group("body")


def run_cohort(input_rows: list[dict], params: dict) -> dict:
    code = extract_embedded(RUNNER_TS.read_text(encoding="utf-8"), "JMDC_COHORT_PY")
    globs = {
        "js_params": json.dumps(params),
        "js_input_rows": json.dumps(input_rows, default=str) if input_rows else None,
    }
    exec(code, globs)  # noqa: S102 — controlled string from the repo
    return json.loads(globs["_result_json"])


def run_outcome(cohort_rows: list[dict], claims_rows: list[dict], params: dict) -> dict:
    code = extract_embedded(RUNNER_TS.read_text(encoding="utf-8"), "JMDC_OUTCOME_PY")
    globs = {
        "js_params": json.dumps(params),
        "js_cohort_rows": json.dumps(cohort_rows, default=str),
        "js_claims_rows": json.dumps(claims_rows, default=str) if claims_rows else None,
    }
    exec(code, globs)  # noqa: S102
    return json.loads(globs["_result_json"])


def main() -> int:
    print(f"loading {DATA_DIR}/cohort_ready.csv ...")
    cohort_csv = pd.read_csv(DATA_DIR / "cohort_ready.csv")
    # Mimic what LoadData feeds downstream: list of records (dicts)
    input_rows = cohort_csv.to_dict(orient="records")
    print(f"  {len(input_rows)} rows, columns: {list(cohort_csv.columns)}")

    # --------- J1 Cohort Builder ---------
    # index_date_rule='enrollment_date' uses first_obs_date as Index Date so
    # there is ample post-index follow-up in the data for outcomes to occur.
    print("\n>>> JMDCCohortBuilder (data_source='csv', rule=enrollment_date, age 30-80) ...")
    cohort_params = {
        "data_source": "csv",
        "synthetic_n": 1000,
        "synthetic_seed": 42,
        "index_date_rule": "enrollment_date",
        "index_age": 50,
        "index_fixed_date": "2020-01-01",
        "age_at_index_min": 30,
        "age_at_index_max": 80,
        "washout_years": 0,
        "exclusion_diseases": [],
        "disease_free_years": 0,
    }
    cohort_result = run_cohort(input_rows, cohort_params)
    print("  funnel:")
    for step in cohort_result["funnel"]:
        print(f"    {step['step']:<35s} remaining={step['remaining']}")
    print(f"  sexDistribution:      {cohort_result['sexDistribution']}")
    print(f"  ageBandDistribution:  {cohort_result['ageBandDistribution']}")
    print(f"  exclusionReasons:     {cohort_result['exclusionReasons']}")
    print(f"  totalRowCount:        {cohort_result['totalRowCount']}")
    print(f"  preview row 0:        {cohort_result['rows'][0] if cohort_result['rows'] else 'none'}")
    assert cohort_result["totalRowCount"] > 0, "cohort came back empty"
    assert cohort_result["funnel"][0]["remaining"] == len(input_rows)

    # --------- J2 Outcome Labeler ---------
    print("\nloading data/jmdc_synthetic/his_claims_disease.csv ...")
    diseases = pd.read_csv(DATA_DIR / "his_claims_disease.csv")
    print(f"  {len(diseases)} disease rows")
    # J2 expects: member_id, icd10_code, onset_date, suspect_flag
    claims_rows = diseases[["member_id", "icd10_code", "onset_date", "suspect_flag"]].to_dict(
        orient="records"
    )

    cohort_rows = cohort_result["rows"]
    print("\n>>> JMDCOutcomeLabeler (5y window, outcomes={cancer:[C18,C34,C50],mi:[I21]}) ...")
    outcome_params = {
        "outcome_diseases": {
            "cancer": ["C18", "C34", "C50"],
            "mi": ["I21"],
        },
        "outcome_window_years": 5,
        "confirm_suspect_flag": True,
        "multi_outcome_mode": "single",
    }
    outcome_result = run_outcome(cohort_rows, claims_rows, outcome_params)
    summ = outcome_result["eventSummary"]
    print(f"  eventSummary: total={summ['total']} events={summ['events']} censored={summ['censored']}")
    print(f"  censorReasons: {summ['censorReasons']}")
    print(f"  outcomeBreakdown: {outcome_result['outcomeBreakdown']}")
    print(f"  totalRowCount: {outcome_result['totalRowCount']}")
    if outcome_result["rows"]:
        sample = outcome_result["rows"][0]
        keep = ["member_id", "index_date", "age_at_index", "outcome_type",
                "first_event_date", "time_to_event_days", "event_flag", "censor_reason"]
        print(f"  preview row 0: {{ {', '.join(f'{k}: {sample.get(k)}' for k in keep if k in sample)} }}")
    assert summ["total"] == cohort_result["totalRowCount"], "outcome rows != cohort rows"

    print("\n[OK] both modules executed successfully on synthetic data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
