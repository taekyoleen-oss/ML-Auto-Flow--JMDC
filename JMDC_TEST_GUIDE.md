# JMDC 모듈 — 실제 데이터로 테스트하는 방법

본 문서는 PRD v2.0 §17의 JMDC 분석 모듈(J1~J7)이 정상 동작하는지를
`data/jmdc_synthetic/`의 합성 데이터를 사용해 **실제로 실행해 보는** 방법을
정리합니다. 각 방법은 독립적으로 검증 가능하며 같은 입력에 대해 같은 결과가
나와야 합니다 (seed=42 기준).

> **합성 데이터 위치**: `data/jmdc_synthetic/`
> - 7개 raw 테이블: `his_population.csv`, `his_claims.csv`, `his_claims_disease.csv`, `his_claims_drugs.csv`, `his_claims_medacts.csv`, `his_medical_institution.csv`, `his_health_checkup.csv`
> - 코호트-친화 CSV: `cohort_ready.csv` (J1 직접 입력용)
> - 재생성: `python scripts/generate_jmdc_synthetic.py`

---

## 사전 준비

### 데이터 생성 (한 번만)

```bash
cd "C:/00 App Project/ML_Auto_Flow-JMDC"
python scripts/generate_jmdc_synthetic.py
```

기대 출력:
- `his_population.csv` 1,000행
- `his_claims_disease.csv` ~93,000행
- 기타 5개 raw + `cohort_ready.csv`
- prevalence 검증: DM 9.9% / HTN 26.8% / Cancer 4.5%

### 앱 실행 (UI 테스트에만 필요)

```bash
pnpm install     # 최초 1회
pnpm run dev
```

브라우저: `http://127.0.0.1:3000/` (포트 충돌 시 콘솔이 다른 포트 안내).

---

## 방법 1 — Standalone Python 통합 테스트 (가장 빠른 검증)

캔버스에서 실행되는 Pyodide Python 코드(`utils/pyodideRunner.ts`의
`JMDC_COHORT_PY`, `JMDC_OUTCOME_PY`)를 정규식으로 추출해 standalone Python에서
그대로 실행합니다. **브라우저나 dev 서버 없이** 모듈 로직을 검증합니다.

```bash
python scripts/test_jmdc_modules_with_synthetic.py
```

### 기대 결과

```
loading C:\00 App Project\ML_Auto_Flow-JMDC\data\jmdc_synthetic/cohort_ready.csv ...
  1000 rows, columns: ['member_id', 'sex_code', 'birth_date', 'first_obs_date', 'last_obs_date', 'bmi', 'has_diabetes', 'has_htn', 'charlson']

>>> JMDCCohortBuilder (data_source='csv', rule=enrollment_date, age 30-80) ...
  funnel:
    Source loaded                       remaining=1000
    After washout (0y)                  remaining=1000
    Age window [30, 80]                 remaining=856
  sexDistribution:      {'1': 444, '2': 412}
  ageBandDistribution:  {'40-49': 254, '30-39': 243, '50-59': 210, '60-69': 130, '70+': 19}

>>> JMDCOutcomeLabeler (5y window, outcomes={cancer:[C18,C34,C50],mi:[I21]}) ...
  eventSummary: total=856 events=35 censored=821
  outcomeBreakdown: {mi: 13 events, cancer: 22 events}

[OK] both modules executed successfully on synthetic data.
```

### 장단점

| 장점 | 단점 |
|------|------|
| 가장 빠름 (< 5초) | UI 동작은 검증 못 함 |
| pip 의존성 거의 없음 (pandas/numpy만) | 결과 시각화 없음 |
| CI에 그대로 붙일 수 있음 | lifelines 필요한 J4~J6은 아직 미포함 |

테스트 스크립트 자체는 `scripts/test_jmdc_modules_with_synthetic.py`에서 자유롭게
파라미터를 바꿔 다른 코호트(예: `index_date_rule='birthday_age', index_age=50`)도
시연 가능합니다.

---

## 방법 2 — 캔버스 UI에서 LoadData → J1 → J2 (실사용 시나리오)

브라우저에서 사용자가 실제로 하는 작업 그대로 따라합니다.

### 단계

1. **LoadData #1 추가** — 좌측 툴박스에서 드래그 → 캔버스
   - `파일 선택` → `data/jmdc_synthetic/cohort_ready.csv`
   - ▶ Run → 1,000행 확인

2. **JMDC Cohort Builder (J1) 추가 + 연결**
   - LoadData #1 의 `data_out` → J1 의 `data_in` 으로 선 연결
   - 속성 패널 파라미터 변경:
     - `data_source` → **`csv`** ← 기본값 `synthetic` 그대로 두면 우리 CSV가 무시됨
     - `index_date_rule` → **`enrollment_date`**
     - `age_at_index_min` → **30**, `age_at_index_max` → **80**
     - `washout_years` → **0**
     - `exclusion_diseases` → **`[]`** (비워야 함; 기본값 `["C00-C97"]`이면 암 환자 모두 제외)
   - ▶ Run → funnel `1000 → 1000 → 856` 확인

3. **LoadData #2 추가** (별도 인스턴스)
   - `data/jmdc_synthetic/his_claims_disease.csv` 업로드 (~3.4MB)
   - ▶ Run → 93,264행 확인

4. **JMDC Outcome Labeler (J2) 추가 + 두 입력 연결**
   - **J1 → J2 `data_in`** (왼쪽 입력 포트, 코호트)
   - **LoadData #2 → J2 `data_in2`** (오른쪽 입력 포트, claims)
   - 파라미터:
     - `outcome_diseases` → `{"cancer": ["C18","C34","C50"]}`
     - `outcome_window_years` → **5**
   - ▶ Run → events ≈ 22 (cancer만 등록 시)

### 자주 막히는 포인트

| 증상 | 원인 | 해결 |
|------|------|------|
| J1 결과가 가상이 됨 | `data_source=synthetic` 그대로 | `csv` 로 변경 |
| funnel에서 0명 남음 | `exclusion_diseases=["C00-C97"]` | `[]` 로 비우기 |
| J2 "cohort 입력이 없습니다" | J1 → J2 `data_in` 미연결 | 선 다시 그리기 |
| J2 events=0 | claims가 J2 `data_in`(왼쪽)에 들어감 | LoadData #2는 J2 `data_in2`(오른쪽)로 |
| `birthday_age + index_age=50` 인데 events=0 | 50세 생일 이후 follow-up 없는 데이터 | `enrollment_date` 사용 |

---

## 방법 3 — J1의 내장 synthetic 모드 (CSV 없이 즉시 시연)

J1 모듈은 `data_source='synthetic'`이면 자체적으로 더미 코호트와 사건을 생성합니다.
**데이터 파일 업로드 없이** 모듈 동작만 빠르게 확인할 때 유용합니다.

### 캔버스

1. JMDC Cohort Builder 한 개만 캔버스에 배치
2. 속성 패널:
   - `data_source` → **`synthetic`** (기본)
   - `synthetic_n` → 10,000
   - `synthetic_seed` → 42
3. ▶ Run → 약 3,000~5,000명 코호트 산출
4. J2 추가 → J1만 연결(J2 `data_in`). claims는 J1이 자동으로 piggy-back
5. J2 ▶ Run → outcomes에서 colon_ca/ami/stroke event 산출

### 용도

- 발표/데모 시 데이터 파일 없이 즉시 시연
- 신규 모듈(J3~J7) 회귀 테스트의 fallback

### 한계

- 합성 데이터의 prevalence/연관성 패턴은 우리 `data/jmdc_synthetic/` 보다 단순함
- 한·일 비교(J7) 같은 모듈은 외부 CSV가 필요

---

## 방법 4 — pandas REPL 빠른 점검 (1분 컷)

데이터 파일 자체를 빠르게 검증하고 싶을 때.

```python
# 새 터미널에서
python
```

```python
import pandas as pd

ROOT = r"C:\00 App Project\ML_Auto_Flow-JMDC\data\jmdc_synthetic"

pop = pd.read_csv(f"{ROOT}/his_population.csv")
dx  = pd.read_csv(f"{ROOT}/his_claims_disease.csv")
chk = pd.read_csv(f"{ROOT}/his_health_checkup.csv")
coh = pd.read_csv(f"{ROOT}/cohort_ready.csv")

# 1) 행 수·컬럼 검증
print(pop.shape, dx.shape, chk.shape, coh.shape)
# (1000, 8) (93264, 6) (2001, 12) (1000, 9)

# 2) DM 환자에서 검진 HbA1c 분포
dm_ids = coh.loc[coh.has_diabetes == 1, "member_id"]
dm_chk = chk[chk.member_id.isin(dm_ids)]
print(dm_chk.hba1c_ngsp.describe())   # mean ≈ 7.6, range 6.3~12

# 3) Charlson 점수와 cancer ICD 코드 동시 보유 확인
cancer_ids = dx.loc[dx.icd10_code.str.startswith(tuple("C")), "member_id"].unique()
coh.loc[coh.member_id.isin(cancer_ids), "charlson"].describe()  # 대부분 2 이상

# 4) outcome 발생 가능한 환자 추출 (방법 1과 동일 결과)
coh.loc[coh.first_obs_date < "2020-01-01", "member_id"].nunique()
```

5분 안에 데이터가 의도대로 만들어졌는지 sanity check 가능합니다.

---

## 방법 5 — 단일 모듈 단위 테스트 (회귀 검증용)

`scripts/test_jmdc_modules_with_synthetic.py`를 템플릿으로 사용해 각 모듈의 입력
/파라미터/출력을 격리해 검증합니다.

### 예: J3 Incidence Rate 단독 테스트

```python
# scripts/test_j3_incidence.py 같은 형태로 작성
import json, re, pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ts = (ROOT / "utils/pyodideRunner.ts").read_text(encoding="utf-8")
code = re.search(r"const JMDC_INCIDENCE_PY = `(.*?)`\s*;", ts, re.DOTALL).group(1)

# (J1+J2 결과 JSON 또는 cohort+outcome CSV를 미리 준비)
labeled = pd.read_csv("path/to/labeled_cohort.csv").to_dict("records")
params = {
    "stratify_by": "sex_age",
    "standard_population": "japan_2015",
    "rate_unit": "100000_PY",
    "time_grid_years": [1, 3, 5],
}
globs = {"js_params": json.dumps(params), "js_input_rows": json.dumps(labeled)}
exec(code, globs)
result = json.loads(globs["_result_json"])
print(result["rateTable"][:5])
```

### 회귀 테스트 패턴

각 모듈마다:
1. **고정 입력** (seed=42 산출물)
2. **고정 파라미터**
3. **고정 기대값** (events count, AUC, HR 등)

CI에서 `pytest scripts/` 한 줄로 모든 JMDC 모듈 회귀 가능.

---

## 권장 테스트 순서

| 상황 | 추천 방법 |
|------|----------|
| 처음 환경 셋업 직후 | 방법 4 → 방법 1 |
| 개발 중 빠른 회귀 | 방법 1 |
| UI 변경 후 시연 | 방법 2 |
| 발표/데모 | 방법 3 |
| 모듈 단위 정확성 | 방법 5 |

---

## 결과 재현성 (seed=42 기준)

| 값 | 기대 |
|----|------|
| `his_population.csv` 행 수 | 1,000 |
| `his_claims_disease.csv` 행 수 | 93,264 |
| `cohort_ready.csv` `has_diabetes` 비율 | 0.099 |
| J1(`csv`, `enrollment_date`, age 30~80) 통과 | 856명 |
| J2(`cancer`+`mi`, 5y) events | 35 (cancer 22 + mi 13) |
| J3(`japan_2015` 표준화) crude rate | 데이터 발생률에 따라 변동 |

값이 ±5% 이상 벗어나면 seed가 바뀌었거나 데이터 생성 코드가 변경된 것이니
`python scripts/generate_jmdc_synthetic.py`를 재실행하세요.

---

## 참고

- 합성 데이터 스펙: `data/jmdc_synthetic/README.md`
- 모듈 코드 진실의 원천: `utils/pyodideRunner.ts` (`performJMDCCohort` 외)
- 모듈 설명 팝업: 캔버스에서 모듈 선택 → 속성 패널 상단 [ⓘ 설명] 버튼
- PRD §17/§18 원문: `ml_framework_appendix/00_JMDC_ML_Framework_PRD.md`
