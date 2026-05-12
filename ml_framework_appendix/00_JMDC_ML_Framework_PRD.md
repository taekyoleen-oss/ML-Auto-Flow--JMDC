# JMDC 데이터 기반 보험 ML 분석 프레임워크 PRD

> **문서 종류**: 제품 요구사항 정의서 (Product Requirements Document)
> **버전**: 2.0
> **작성일**: 2026년 (v2.0 갱신)
> **대상 프로젝트**: 기존 머신러닝 통계분석 앱에 **JMDC 보험 ML 모델 모듈** 추가
> **확장 대상**: React + Pyodide 모듈 파이프라인 앱 (ML Auto Flow) + Next.js/Supabase + Python ML 백엔드

### 변경 이력

| 버전 | 일자 | 주요 변경 |
|------|------|----------|
| 1.0 | 2025 | 최초 작성. M1~M5 ML 모델, 학습·서빙 인프라, 한·일 비교 외부 검증 정의 |
| **2.0** | **2026** | **§17 JMDC 발생률·위험비교 분석 모듈 신설(J1~J7), §18 한·일 매칭 프로토콜 신설(4-Layer L1~L4). §2.1에 M0 기술통계 카테고리 추가. §14 마일스톤에 Phase 0 선행 단계 추가(24주→28주). §16 별첨 H/I/J 항목 추가. ML 모델 학습 이전 단계의 역학·기술통계 분석을 본 앱의 모듈 시스템 위에서 수행할 수 있도록 확장.** |

---

## 목차

1. [개요와 비즈니스 목표](#1-개요와-비즈니스-목표)
2. [모델 포트폴리오 (종합 프레임워크)](#2-모델-포트폴리오-종합-프레임워크)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [데이터 파이프라인](#4-데이터-파이프라인)
5. [Feature Engineering 모듈](#5-feature-engineering-모듈)
6. [모델별 상세 명세](#6-모델별-상세-명세)
7. [모델 평가·검증 프레임워크](#7-모델평가검증-프레임워크)
8. [UI/UX 와이어프레임](#8-uiux-와이어프레임)
9. [데이터 모델 (DB 확장)](#9-데이터-모델-db-확장)
10. [API 설계](#10-api-설계)
11. [보험 적용 시나리오](#11-보험-적용-시나리오)
12. [한·일 비교 ML 모듈](#12-한일-비교-ml-모듈)
13. [규제·윤리 준수](#13-규제윤리-준수)
14. [마일스톤](#14-마일스톤)
15. [Claude Code 구현 프롬프트](#15-claude-code-구현-프롬프트)
16. [별첨 자료](#16-별첨-자료)
17. [JMDC 발생률·위험비교 분석 모듈 (v2.0 신규)](#17-jmdc-발생률위험비교-분석-모듈-v20-신규)
18. [한·일 매칭 프로토콜 (v2.0 신규)](#18-한일-매칭-프로토콜-v20-신규)

---

## 1. 개요와 비즈니스 목표

### 1.1 배경
JMDC(Japan Medical Data Center)는 일본 건강보험조합 약 980만 명 가입자의 청구·진단·약제·검진 데이터를 보유한 일본 최대 규모의 보험 클레임 데이터베이스입니다. 본 모듈은 이 데이터를 활용하여 보험상품 개발과 의료비 예측에 필요한 **종합 머신러닝 프레임워크**를 분석 앱에 추가합니다.

### 1.2 비즈니스 목표
1. **신상품 개발**: 특정 위험군의 의료비·발병률을 예측하여 보장 범위와 한도 설계
2. **요율 산정**: 인수 시 개인별 위험도 점수화로 차등 요율 적용 가능성 검토
3. **언더라이팅 최적화**: 입력 가능한 정보로 보험사고 발생 확률 사전 예측
4. **포트폴리오 리스크**: 가입자 집단의 미래 손해율 예측

### 1.3 성공 지표
| 지표 | 목표 |
|------|------|
| 5년 의료비 예측 RMSE | < 70% (의료비 변동성 고려한 합리적 수준) |
| 주요 질병 발병 예측 AUC | ≥ 0.75 |
| 모델 학습 시간 (100만 명) | < 30분 |
| 추론 응답 시간 | < 200ms (단일 환자 기준) |
| 한·일 모델 일관성 (외부검증) | ROC AUC 차이 < 0.05 |

---

## 2. 모델 포트폴리오 (종합 프레임워크)

본 프레임워크는 **5개 모델 카테고리**를 단일 앱에서 모두 학습·평가·서빙 가능하도록 구성합니다.

### 2.1 모델 카테고리

| ID | 카테고리 | 대표 모델 | 비즈니스 활용 |
|----|----------|-----------|---------------|
| **M0** | **JMDC 기술통계·발생률 분석 (v2.0)** | KM, log-rank, Cox PH, CIF, SIR, PSM (모듈 J1~J7, §17 참조) | 모델 학습 이전 단계의 역학 분석·코호트 정의·한·일 매칭 |
| M1 | **질병 발병 예측** | Survival Forest, Cox PH | 신상품 보장 설계 |
| M2 | **의료비 예측** | LightGBM Regressor, Quantile Regression | 보험요율 산출 |
| M3 | **위험도 점수화** | Logistic Regression, XGBoost | 언더라이팅 |
| M4 | **재발/재입원 예측** | Recurrent Survival, LSTM | 갱신형 상품 |
| M5 | **사망률 예측** | Gompertz, Survival NN | 종신/연금 상품 |

> **M0와 M1~M5의 관계**: M0는 ML 모델 학습 이전 단계에서 코호트를 정의하고 발생률·위험비를 기술통계적으로 산출하는 역학 분석 도구이다. M1~M5의 입력 코호트와 outcome 레이블을 산출하는 데에도 재사용된다. 본 앱(ML Auto Flow)의 모듈 파이프라인 위에서 직접 실행되는 도구이며 §17에서 7개 모듈(J1~J7)을 상세 명세한다.

### 2.2 모델별 입력·출력

```
[M1: 질병 발병 예측]
  입력: 인구통계 + 검진결과 + 기왕증 + 약제사용
  출력: 향후 N년 내 특정 질병(암/심질환/뇌혈관 등) 발병 확률 + 시점

[M2: 의료비 예측]
  입력: 인구통계 + 기왕증 + 검진결과 + 작년 의료이용
  출력: 향후 1/3/5년 연간 의료비 (point estimate + 90%/95% 분위)

[M3: 위험도 점수화]
  입력: 신청서 작성 가능 항목 (자가 보고 가능 변수만)
  출력: 0-100 위험도 점수 + 위험 카테고리

[M4: 재발/재입원 예측]
  입력: 진단 시점 + 1차 치료 정보 + 후속 추적 데이터
  출력: 90/180/365일 내 재입원·재발 확률

[M5: 사망률 예측]
  입력: 인구통계 + 종합 건강 프로파일
  출력: 연간 사망 위험률 (생명표 보정)
```

### 2.3 모델 선택 의사결정 트리

```
사용자 선택: 무엇을 예측하고 싶은가?
├─ 미래 시점의 특정 사건 발생 → M1 (Survival Analysis)
├─ 연속형 미래 값 (비용/금액) → M2 (Regression/Quantile)
├─ 분류 (가입 가능/불가) → M3 (Classification)
├─ 시간에 따른 반복 사건 → M4 (Recurrent Events)
└─ 장기 생존/사망 → M5 (Mortality)
```

---

## 3. 시스템 아키텍처

### 3.1 전체 구조

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                           │
│  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐    │
│  │  Model Studio    │  │  Training Monitor  │  │  Inference UI    │    │
│  │  /ml/studio      │  │  /ml/training      │  │  /ml/predict     │    │
│  └──────────────────┘  └────────────────────┘  └──────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              Server Actions / Route Handlers                   │    │
│  │   /api/ml/datasets  /api/ml/train  /api/ml/predict             │    │
│  └────────────────────────────────────────────────────────────────┘    │
└────────────────┬────────────────────────────────┬──────────────────────┘
                 │                                │
                 ▼                                ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│         Supabase (DB)            │  │   Python ML Service              │
│                                  │  │   (FastAPI on Docker)            │
│  - jmdc/* 원천 테이블             │  │                                  │
│  - ml_datasets (피처+레이블)      │  │  ┌────────────────────────────┐  │
│  - ml_experiments                │◄─┼──┤  Feature Engineering       │  │
│  - ml_models (메타 + S3 경로)     │  │  │  - lib/features/cohort     │  │
│  - ml_predictions                │  │  │  - lib/features/temporal   │  │
│                                  │  │  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │  │                                  │
│  │  Storage                   │  │  │  ┌────────────────────────────┐  │
│  │  - feature_views/          │  │  │  │  Model Training            │  │
│  │  - models/                 │  │  │  │  - lib/models/survival     │  │
│  │  - shap_outputs/           │  │  │  │  - lib/models/regression   │  │
│  └────────────────────────────┘  │  │  │  - lib/models/classifier   │  │
└──────────────────────────────────┘  │  └────────────────────────────┘  │
                                      │                                  │
                                      │  ┌────────────────────────────┐  │
                                      │  │  Inference Service         │  │
                                      │  │  - Online (FastAPI)        │  │
                                      │  │  - Batch (Celery worker)   │  │
                                      │  └────────────────────────────┘  │
                                      │                                  │
                                      │  ┌────────────────────────────┐  │
                                      │  │  Explainability            │  │
                                      │  │  - SHAP                    │  │
                                      │  │  - Permutation Importance  │  │
                                      │  └────────────────────────────┘  │
                                      └──────────────────────────────────┘
                                                       │
                                                       ▼
                                      ┌──────────────────────────────────┐
                                      │   MLflow Tracking Server         │
                                      │   - Experiment tracking          │
                                      │   - Model registry               │
                                      │   - Artifact storage             │
                                      └──────────────────────────────────┘
```

### 3.2 기술 선택 근거

| 영역 | 선택 | 근거 |
|------|------|------|
| 프론트엔드 | Next.js 14 (기존) | 기존 스택 일관성 |
| ML 백엔드 | Python (FastAPI) | scikit-learn/lifelines/XGBoost 풍부 |
| 모델 추적 | MLflow | 오픈소스, 실험 재현성 |
| 피처 저장 | Supabase Postgres | 기존 DB 활용, 별도 Feast 불필요 |
| 작업 큐 | Celery + Redis | 장시간 학습 작업 |
| 컨테이너 | Docker Compose | 로컬 개발, 추후 K8s 확장 |

### 3.3 모듈 구성

```
ml-service/
├── api/
│   ├── main.py                       # FastAPI 엔트리
│   ├── routers/
│   │   ├── datasets.py               # 피처셋 생성 API
│   │   ├── training.py               # 모델 학습 API
│   │   ├── inference.py              # 추론 API
│   │   └── explain.py                # SHAP 등 설명
│   └── schemas/                       # Pydantic 모델
├── lib/
│   ├── features/
│   │   ├── cohort_builder.py          # 코호트 정의 → SQL
│   │   ├── demographic.py             # 인구통계 피처
│   │   ├── comorbidity.py             # 동반질환 (Charlson/Elixhauser)
│   │   ├── medication.py              # 약제 사용 패턴
│   │   ├── utilization.py             # 의료이용 강도
│   │   ├── checkup.py                 # 건강검진 피처
│   │   └── temporal.py                # 시계열 피처 (slope, trend)
│   ├── models/
│   │   ├── base.py                    # BaseModel 추상클래스
│   │   ├── survival_forest.py         # M1 (Random Survival Forest)
│   │   ├── cox_ph.py                  # M1 (Cox Proportional Hazard)
│   │   ├── lgbm_regressor.py          # M2
│   │   ├── quantile_regression.py     # M2 (uncertainty)
│   │   ├── xgb_classifier.py          # M3
│   │   ├── recurrent_survival.py      # M4
│   │   └── mortality_gompertz.py      # M5
│   ├── evaluation/
│   │   ├── metrics.py                 # C-index, IBS, RMSE 등
│   │   ├── calibration.py             # Calibration plot
│   │   └── fairness.py                # 공정성 평가
│   ├── explain/
│   │   ├── shap_engine.py
│   │   └── feature_importance.py
│   └── data/
│       ├── jmdc_loader.py             # Supabase에서 데이터 로드
│       └── omop_loader.py             # OMOP CDM 형식 로드 (한국)
├── workers/
│   ├── training_worker.py             # Celery 학습 워커
│   └── inference_worker.py            # 배치 추론
├── tests/
│   ├── test_features.py
│   ├── test_models.py
│   └── test_evaluation.py
├── docker-compose.yml
├── Dockerfile
└── pyproject.toml
```

### 3.4 Frontend 통합 (Next.js)

```
app/
├── (ml)/
│   ├── ml/
│   │   ├── page.tsx                   # ML 모듈 대시보드
│   │   ├── studio/
│   │   │   └── page.tsx               # 실험 생성·관리
│   │   ├── datasets/
│   │   │   ├── page.tsx               # 피처셋 목록
│   │   │   └── [id]/page.tsx          # 피처셋 상세·미리보기
│   │   ├── experiments/
│   │   │   ├── page.tsx               # 실험 목록
│   │   │   └── [id]/page.tsx          # 실험 결과·SHAP
│   │   ├── models/
│   │   │   ├── page.tsx               # 모델 레지스트리
│   │   │   └── [id]/page.tsx          # 모델 상세
│   │   ├── predict/
│   │   │   └── page.tsx               # 추론 UI
│   │   └── monitoring/
│   │       └── page.tsx               # 프로덕션 모니터링
│   │
└── api/
    └── ml/
        ├── datasets/route.ts          # ML 서비스 프록시
        ├── train/route.ts
        ├── predict/route.ts
        └── explain/route.ts
```

---

## 4. 데이터 파이프라인

### 4.1 ETL 흐름

```
[JMDC 원천 CSV]
       ↓
[1. Raw Layer]    jmdc.* 테이블 (8개)
       ↓
[2. Cohort Layer] ml_cohorts (사용자 정의 분석 단위)
       ↓
[3. Feature Layer] ml_features (코호트별 피처 매트릭스)
       ↓
[4. Training Set] ml_datasets (train/val/test split)
       ↓
[5. Model]         학습된 모델 (S3/Storage)
       ↓
[6. Predictions]   ml_predictions (배치/실시간)
```

### 4.2 코호트 정의 (Index Date 중심)

ML 모델의 핵심은 **Index Date** 설정입니다:
- Index Date 이전 = 입력 피처 (lookback window)
- Index Date 이후 = 예측 대상 (outcome window)

```
                  ↓ Index Date
─────────────────●──────────────────
       Lookback       Outcome
       (피처 추출)     (레이블 정의)

예시: 50세 시점에서 향후 5년 내 대장암 발병 예측
- Index Date: member의 50번째 생일
- Lookback: Index Date 이전 5년간 모든 청구·검진
- Outcome: Index Date ~ +5년 사이 C18-C20 신규 진단 여부
```

### 4.3 Train/Val/Test 분할 전략

**시간 기반 분할** (권장):
- Train: 2015-2019 데이터로 학습
- Validation: 2020 데이터로 하이퍼파라미터 튜닝
- Test: 2021-2022 데이터로 최종 평가
- → 모델이 실제 운영 환경에서의 시간적 일반화 능력 검증

**Person 기반 분할** (보조):
- 동일인이 train/test에 겹치지 않도록 member_id 기준 분할
- 80%/10%/10%

### 4.4 Class Imbalance 처리

| 시나리오 | 발병률 | 처리 방법 |
|----------|--------|-----------|
| 대장암 5년 발병 | ~1% | SMOTE-NC, Class Weight, Focal Loss |
| 입원 사건 | ~10% | Class Weight |
| 의료비 분위 | (회귀) | Quantile Loss, Tweedie Distribution |
| 사망 (40-65세) | ~0.5% | Cox PH (시간 가중), Class Weight |

---

## 5. Feature Engineering 모듈

### 5.1 피처 카테고리

| 카테고리 | 변수 예시 | 개수 (기본) |
|----------|----------|-------------|
| **인구통계** | 연령, 성별, 가구구성 | ~5 |
| **동반질환** | Charlson, Elixhauser 항목별 | ~30 |
| **약제 사용** | ATC 1단계별 사용 일수, polypharmacy | ~20 |
| **의료이용 강도** | 외래 횟수, 입원 일수, 응급실 방문 | ~15 |
| **검진 결과** | LDL, HbA1c, BMI, 혈압 (현재값+추세) | ~20 |
| **시계열 패턴** | 의료비 slope, 검사값 변동성 | ~10 |
| **시술 이력** | 주요 수술 시술 코드 사용 여부 | ~10 |
| **합계** | | **~110** |

### 5.2 핵심 피처 상세

#### 5.2.1 Charlson Comorbidity Index (CCI)
```python
CHARLSON_CONDITIONS = {
    'myocardial_infarction': {'icd10': ['I21', 'I22', 'I25.2'], 'weight': 1},
    'congestive_heart_failure': {'icd10': ['I50'], 'weight': 1},
    'peripheral_vascular_disease': {'icd10': ['I71', 'I73.1'], 'weight': 1},
    'cerebrovascular_disease': {'icd10': ['I60-I69'], 'weight': 1},
    'dementia': {'icd10': ['F00-F03'], 'weight': 1},
    'chronic_pulmonary_disease': {'icd10': ['J40-J47'], 'weight': 1},
    'mild_liver_disease': {'icd10': ['K70', 'K73'], 'weight': 1},
    'diabetes': {'icd10': ['E10-E14'], 'weight': 1},
    'diabetes_complications': {'icd10': ['E10.2-E10.5'], 'weight': 2},
    'renal_disease': {'icd10': ['N18', 'N19'], 'weight': 2},
    'any_malignancy': {'icd10': ['C00-C26', 'C30-C34'], 'weight': 2},
    'severe_liver_disease': {'icd10': ['K72.1', 'K76.6'], 'weight': 3},
    'metastatic_solid_tumor': {'icd10': ['C77-C80'], 'weight': 6},
    'aids_hiv': {'icd10': ['B20-B24'], 'weight': 6},
}

def compute_cci(member_id, index_date, lookback_days=365):
    """Charlson Comorbidity Index 계산"""
    diagnoses = get_diagnoses_in_window(member_id, index_date, lookback_days)
    score = 0
    for cond, info in CHARLSON_CONDITIONS.items():
        if matches_any_icd(diagnoses, info['icd10']):
            score += info['weight']
    return score
```

#### 5.2.2 시계열 피처 (Slope·Trend)
```python
def temporal_features(member_id, index_date, metric='ldl_mgdl', lookback_years=5):
    """검진값의 시간적 변화 패턴"""
    values = get_checkup_metric(member_id, metric, lookback_years)
    if len(values) < 2:
        return {'slope': None, 'mean': None, 'std': None, 'last': None}

    # 선형 회귀 slope
    years_from_index = [(d - index_date).days / 365.25 for d, v in values]
    slope = np.polyfit(years_from_index, [v for _, v in values], 1)[0]

    return {
        f'{metric}_slope': slope,
        f'{metric}_mean': np.mean([v for _, v in values]),
        f'{metric}_std': np.std([v for _, v in values]),
        f'{metric}_last': values[-1][1],
        f'{metric}_max': max(v for _, v in values),
    }
```

#### 5.2.3 Polypharmacy & Medication Burden
```python
def medication_features(member_id, index_date, lookback_days=180):
    """약제 사용 패턴"""
    drugs = get_drug_exposures(member_id, index_date, lookback_days)
    return {
        'n_unique_atc_lv3': drugs.atc_code.str[:4].nunique(),
        'n_unique_atc_lv5': drugs.atc_code.nunique(),
        'polypharmacy_flag': int(drugs.atc_code.nunique() >= 5),
        'days_supply_total': drugs.days_supply.sum(),
        'has_antihypertensive': int((drugs.atc_code.str.startswith('C09')).any()),
        'has_oad': int((drugs.atc_code.str.startswith('A10B')).any()),
        'has_insulin': int((drugs.atc_code.str.startswith('A10A')).any()),
        'has_statin': int((drugs.atc_code.str.startswith('C10AA')).any()),
        # ... (10여 개 약제군별 플래그)
    }
```

### 5.3 Feature View 패턴

피처 계산은 **Materialized View** 또는 정기 ETL로 사전 계산하여 학습·추론 시 즉시 조회:

```sql
CREATE MATERIALIZED VIEW ml.feature_view_charlson AS
SELECT
  fv.member_id,
  fv.index_date,
  -- Charlson 항목별 플래그 + 총점
  MAX(CASE WHEN cd.icd10_code LIKE 'I21%' THEN 1 ELSE 0 END) AS has_mi,
  MAX(CASE WHEN cd.icd10_code LIKE 'I50%' THEN 1 ELSE 0 END) AS has_chf,
  -- ... (전체 항목)
  SUM(CASE
    WHEN cd.icd10_code LIKE 'I21%' THEN 1
    WHEN cd.icd10_code LIKE 'C77%' THEN 6
    -- ...
    ELSE 0
  END) AS charlson_score
FROM ml.cohort_index fv
LEFT JOIN jmdc.his_claims_disease cd
  ON cd.member_id = fv.member_id
  AND cd.onset_date BETWEEN fv.index_date - INTERVAL '365 days' AND fv.index_date
  AND cd.suspect_flag = FALSE
GROUP BY fv.member_id, fv.index_date;
```

---

## 6. 모델별 상세 명세

### 6.1 M1: 질병 발병 예측 (Survival Analysis)

#### 6.1.1 알고리즘
- **Random Survival Forest** (scikit-survival)
- **DeepSurv** (PyTorch) - 비교용

#### 6.1.2 Python 구현 (예시)

```python
# lib/models/survival_forest.py
from sksurv.ensemble import RandomSurvivalForest
from sksurv.util import Surv
import numpy as np

class JMDCSurvivalModel:
    def __init__(self, n_estimators=200, min_samples_leaf=20, max_features='sqrt'):
        self.model = RandomSurvivalForest(
            n_estimators=n_estimators,
            min_samples_leaf=min_samples_leaf,
            max_features=max_features,
            n_jobs=-1,
            random_state=42,
        )

    def fit(self, X, time, event):
        """
        X: pd.DataFrame (n_samples, n_features)
        time: array (n_samples,) - 사건까지 시간 또는 검열 시간
        event: array (n_samples,) - 1=사건 발생, 0=검열
        """
        y = Surv.from_arrays(event=event.astype(bool), time=time)
        self.model.fit(X, y)
        return self

    def predict_survival_function(self, X, time_points=None):
        """각 환자에 대한 시간별 생존 확률"""
        if time_points is None:
            time_points = [365, 730, 1095, 1460, 1825]  # 1-5년 일자
        survs = self.model.predict_survival_function(X)
        return np.array([[s(t) for t in time_points] for s in survs])

    def predict_risk_score(self, X):
        """위험도 점수 (높을수록 위험)"""
        return self.model.predict(X)
```

#### 6.1.3 평가 지표
- **Concordance Index (C-index)**: 0.65 이상 목표
- **Integrated Brier Score (IBS)**: 시간 통합 정확도
- **Time-dependent AUC**: 1년/3년/5년 시점별

### 6.2 M2: 의료비 예측 (Regression)

#### 6.2.1 알고리즘 후보
- **LightGBM Regressor** (Tweedie distribution - 의료비처럼 0이 많고 right-skewed)
- **Quantile Regression Forest** (불확실성 정량화)

#### 6.2.2 구현

```python
# lib/models/lgbm_regressor.py
import lightgbm as lgb

class JMDCCostModel:
    def __init__(self, objective='tweedie', tweedie_variance_power=1.5):
        self.params = {
            'objective': objective,
            'tweedie_variance_power': tweedie_variance_power,
            'metric': 'rmse',
            'learning_rate': 0.05,
            'num_leaves': 63,
            'min_data_in_leaf': 50,
            'feature_fraction': 0.8,
            'bagging_fraction': 0.8,
            'bagging_freq': 5,
            'lambda_l2': 0.1,
        }

    def fit(self, X_train, y_train, X_val, y_val, num_boost_round=2000, early_stopping=100):
        train_set = lgb.Dataset(X_train, y_train)
        val_set = lgb.Dataset(X_val, y_val, reference=train_set)

        self.model = lgb.train(
            self.params,
            train_set,
            num_boost_round=num_boost_round,
            valid_sets=[val_set],
            callbacks=[lgb.early_stopping(early_stopping), lgb.log_evaluation(100)],
        )
        return self

    def predict(self, X):
        return self.model.predict(X, num_iteration=self.model.best_iteration)
```

#### 6.2.3 Quantile Regression (불확실성)

```python
# 각 분위(quantile)별로 별도 모델 학습
quantile_models = {}
for q in [0.1, 0.5, 0.9]:
    model = lgb.LGBMRegressor(objective='quantile', alpha=q, ...)
    model.fit(X_train, y_train)
    quantile_models[q] = model

# 추론 시
predictions = {
    q: model.predict(X_test) for q, model in quantile_models.items()
}
# → 환자 A의 5년 의료비: 중앙값 320만원, 90%는 850만원, 99%는 2400만원
```

### 6.3 M3: 위험도 점수화 (Classification)

#### 6.3.1 비즈니스 제약
- **신청서로 받을 수 있는 정보만** 사용 (실제 청구 데이터는 인수 시점에 없음)
- 사용 가능: 나이, 성별, 키, 몸무게, 자가보고 기왕증, 검진결과
- 사용 불가: 실제 청구·약제 사용 데이터

#### 6.3.2 단계적 모델 (Tiered Model)

```
Tier 1 (Express UW): 나이 + 성별 + 흡연만 → 빠른 분류
Tier 2 (Standard UW): + 검진결과(BMI, 혈압, LDL)
Tier 3 (Detailed UW): + 자가보고 기왕증 + 가족력
```

각 Tier별로 별도 모델 학습 후, 사용자가 입력 가능한 정보 수준에 맞춰 최적 모델 자동 선택.

#### 6.3.3 구현

```python
# lib/models/xgb_classifier.py
import xgboost as xgb

class TieredUnderwritingModel:
    def __init__(self):
        self.models = {}
        self.feature_sets = {
            'tier1': ['age', 'sex', 'smoking'],
            'tier2': ['age', 'sex', 'smoking', 'bmi', 'sbp_mmhg', 'dbp_mmhg', 'ldl_mgdl'],
            'tier3': [...],  # 30+ features
        }

    def fit_all_tiers(self, X, y):
        for tier, feats in self.feature_sets.items():
            self.models[tier] = xgb.XGBClassifier(
                objective='binary:logistic',
                n_estimators=500,
                max_depth=6,
                learning_rate=0.05,
                eval_metric='auc',
            ).fit(X[feats], y)

    def predict_risk(self, applicant_data: dict):
        """입력 가능한 정보에 맞춰 자동 Tier 선택"""
        for tier in ['tier3', 'tier2', 'tier1']:
            feats = self.feature_sets[tier]
            if all(f in applicant_data and applicant_data[f] is not None for f in feats):
                X = pd.DataFrame([applicant_data])[feats]
                return {
                    'tier_used': tier,
                    'risk_score': self.models[tier].predict_proba(X)[0, 1] * 100,
                }
        raise ValueError("최소 Tier 1 정보가 부족합니다.")
```

### 6.4 M4: 재발/재입원 예측 (Recurrent Events)

- **알고리즘**: Andersen-Gill model (recurrent Cox PH)
- **응용**: 갱신형 보험상품의 재발 위험 평가

```python
from lifelines import CoxPHFitter

# 재발 이벤트를 long-format으로 준비
# columns: member_id, start, stop, event, [features...]
cph = CoxPHFitter()
cph.fit(df, duration_col='stop', event_col='event',
        cluster_col='member_id', robust=True)
```

### 6.5 M5: 사망률 예측 (Gompertz + ML)

- **베이스라인**: Gompertz 사망률 함수 (생명표 기반)
- **보정**: ML 모델로 risk score 산출 → Gompertz 파라미터 보정

```
μ(x) = α × exp(β × x) × exp(ML_risk_adjustment)

여기서 α, β는 일본 표준 생명표에서 추정, ML_risk_adjustment는 본 모델 출력
```

---

## 7. 모델 평가·검증 프레임워크

### 7.1 평가 지표

| 모델 카테고리 | 1차 지표 | 2차 지표 | 임상적 검증 |
|---------------|----------|----------|------------|
| M1 Survival | C-index | IBS, time-AUC | Calibration |
| M2 Regression | RMSE | MAE, R² | Bias by decile |
| M3 Classification | ROC AUC | PR AUC, F1 | Sensitivity at fixed FPR |
| M4 Recurrent | C-index | MAE per event | Event coverage |
| M5 Mortality | C-index | RMSE vs 생명표 | Age-stratified |

### 7.2 공정성 평가 (Fairness)

**규제 대비 필수**:
- 성별·연령군·소득군별 모델 성능 격차 측정
- Demographic Parity, Equal Opportunity 등 지표 산출
- 격차가 임계값 초과 시 경고

```python
# lib/evaluation/fairness.py
def evaluate_group_fairness(y_true, y_pred, sensitive_attr):
    """그룹별 ROC AUC 비교"""
    results = {}
    for group in sensitive_attr.unique():
        mask = sensitive_attr == group
        results[group] = roc_auc_score(y_true[mask], y_pred[mask])

    max_disparity = max(results.values()) - min(results.values())
    return {
        'group_aucs': results,
        'max_disparity': max_disparity,
        'fair': max_disparity < 0.05,
    }
```

### 7.3 캘리브레이션

예측 확률이 실제 발생률과 일치하는지 검증:

```python
from sklearn.calibration import calibration_curve

prob_true, prob_pred = calibration_curve(y_test, y_pred_proba, n_bins=10)
# 이상적: 대각선 (y=x)
# 보정 필요 시: Isotonic Regression 또는 Platt Scaling 적용
```

### 7.4 외부 검증

- 학습 데이터와 다른 연도 데이터로 검증
- 가능 시 다른 국가(HIRA K-OMOP) 데이터로 외부 검증

---

## 8. UI/UX 와이어프레임

### 8.1 Model Studio (`/ml/studio`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Model Studio                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [+ 새 실험 만들기]                              검색: [_________]       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 실험명              모델 유형      상태       성능       작업       │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ 대장암 5년 예측 v3  Survival      ✓ 완료     C=0.74   [상세][복제] │  │
│  │ 의료비 1년 예측 v2  Regression    ⏳ 학습중               [중단]   │  │
│  │ 위험도 점수 v5      Classification ✓ 완료    AUC=0.78  [상세]      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.2 새 실험 생성 마법사

```
Step 1: 비즈니스 질문 선택
  ⦿ 미래 시점의 특정 질병 발병 (Survival)
  ○ 미래 의료비 추정 (Regression)
  ○ 가입 시 위험도 점수 (Classification)
  ○ 재발/재입원 위험 (Recurrent)
  ○ 사망률 (Mortality)

Step 2: 코호트 정의
  - 데이터셋: [JMDC HIS 2019-2023 ▼]
  - Index Date: [50번째 생일 ▼]
  - Lookback: [5년 ▼]
  - 제외 조건: ☑ 이미 해당 질병 있는 자 제외

Step 3: 예측 대상
  - Outcome: [대장암 (C18-C20) 첫 진단 ▼]
  - Outcome Window: [5년 ▼]

Step 4: 피처 선택
  ☑ 인구통계 (5개)
  ☑ Charlson 동반질환 (30개)
  ☑ 약제 사용 (20개)
  ☑ 의료이용 강도 (15개)
  ☑ 검진 결과 (20개)
  ☐ 시계열 추세 (10개)

Step 5: 모델 설정
  알고리즘: [Random Survival Forest ▼]
  하이퍼파라미터 튜닝: ⦿ AutoML ○ 수동
  교차검증: [5-fold ▼]

[← 이전]                                                       [학습 시작 →]
```

### 8.3 실험 결과 화면

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 대장암 5년 예측 v3                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌─ 성능 요약 ──────────────┐  ┌─ 모델 정보 ──────────────────┐          │
│  │ C-index    0.74          │  │ 알고리즘  Random Survival F. │          │
│  │ IBS        0.18          │  │ 학습 시간 23분               │          │
│  │ 1년 AUC    0.78          │  │ 학습 표본 482,000명          │          │
│  │ 5년 AUC    0.72          │  │ 학습 일자 2025-XX-XX         │          │
│  └──────────────────────────┘  └──────────────────────────────┘          │
│                                                                          │
│  ┌─ 시간별 ROC AUC ─────────────────────────────────────────────────┐    │
│  │                                                                   │    │
│  │    [Recharts: 시간(년) vs AUC, 95% CI band]                       │    │
│  │                                                                   │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─ 피처 중요도 (SHAP) ──────────────────────────────────────────────┐    │
│  │ 1. age_at_index               ████████████████ 0.31              │    │
│  │ 2. charlson_score             ██████████ 0.21                    │    │
│  │ 3. has_polyp_history          ████████ 0.17                      │    │
│  │ 4. cea_max                    ██████ 0.12                        │    │
│  │ 5. ldl_slope                  █████ 0.09                         │    │
│  │ [전체 보기]                                                       │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─ 캘리브레이션 ──────┐  ┌─ 공정성 평가 ──────────────────┐              │
│  │  [캘리브레이션 차트] │  │  성별 AUC 격차      0.02 ✓     │              │
│  │  Brier=0.18         │  │  연령군 AUC 격차    0.04 ✓     │              │
│  └─────────────────────┘  └────────────────────────────────┘              │
│                                                                          │
│  [모델 저장] [프로덕션 배포] [SHAP 보고서 다운로드] [예측 API 호출]       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.4 추론 UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│  단일 환자 예측                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  사용 모델: [대장암 5년 예측 v3 ▼]                                       │
│                                                                          │
│  환자 정보 입력 (또는 CSV 업로드)                                        │
│  ┌─────────────────────┬──────────────────────────────────────────────┐  │
│  │ 나이                 │ [52]                                          │  │
│  │ 성별                 │ ⦿남 ○여                                      │  │
│  │ BMI                  │ [26.4]                                        │  │
│  │ Charlson Score       │ [2]                                           │  │
│  │ LDL (최근)          │ [148]                                          │  │
│  │ ... (전체 110 항목)  │                                               │  │
│  └─────────────────────┴──────────────────────────────────────────────┘  │
│                                                                          │
│  [예측 실행]                                                             │
│                                                                          │
│  ┌─ 예측 결과 ──────────────────────────────────────────────────────┐    │
│  │                                                                   │    │
│  │  5년 내 대장암 발병 확률:  6.8%                                   │    │
│  │  Risk Score:                72 / 100  (Higher Risk)               │    │
│  │  90% 신뢰구간:             4.2% ~ 9.5%                            │    │
│  │                                                                   │    │
│  │  ┌─ 시간별 누적 발병 곡선 ─────────────────────────┐              │    │
│  │  │  [Recharts]                                      │              │    │
│  │  └──────────────────────────────────────────────────┘              │    │
│  │                                                                   │    │
│  │  ┌─ 이 예측에 기여한 주요 요인 (SHAP) ──────────────┐              │    │
│  │  │ + 나이 52세              +0.15                  │              │    │
│  │  │ + Charlson 2점           +0.08                  │              │    │
│  │  │ + LDL 148 (높음)         +0.05                  │              │    │
│  │  │ - 흡연 없음              -0.04                  │              │    │
│  │  │ - 정기검진 수검          -0.03                  │              │    │
│  │  └──────────────────────────────────────────────────┘              │    │
│  │                                                                   │    │
│  │  [PDF 보고서 다운로드]  [API 응답 복사]                           │    │
│  └───────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 9. 데이터 모델 (DB 확장)

### 9.1 ML 메타 스키마

```sql
CREATE SCHEMA IF NOT EXISTS ml;

-- 코호트 인덱스 (Index Date 설정된 분석 단위)
CREATE TABLE ml.cohort_index (
  cohort_id           UUID NOT NULL,
  member_id           VARCHAR(16) NOT NULL,
  dataset_id          UUID NOT NULL,
  index_date          DATE NOT NULL,
  age_at_index        SMALLINT,
  sex_code            CHAR(1),
  PRIMARY KEY (cohort_id, member_id)
);

-- 피처 매트릭스 (계산된 피처값 저장)
CREATE TABLE ml.feature_matrix (
  cohort_id           UUID NOT NULL,
  member_id           VARCHAR(16) NOT NULL,
  features            JSONB NOT NULL,        -- {'age': 52, 'charlson': 2, ...}
  computed_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cohort_id, member_id)
);

-- 레이블 (Outcome 변수)
CREATE TABLE ml.outcome_labels (
  cohort_id           UUID NOT NULL,
  member_id           VARCHAR(16) NOT NULL,
  outcome_type        TEXT NOT NULL,         -- 'binary', 'survival', 'continuous'
  event_flag          BOOLEAN,
  time_to_event_days  INTEGER,
  continuous_value    NUMERIC,
  PRIMARY KEY (cohort_id, member_id, outcome_type)
);

-- 실험 (학습 시도)
CREATE TABLE ml.experiments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID REFERENCES auth.users(id),
  name                TEXT NOT NULL,
  model_type          TEXT NOT NULL,         -- 'survival', 'regression', 'classification', 'recurrent', 'mortality'
  cohort_id           UUID NOT NULL,
  algorithm           TEXT NOT NULL,         -- 'rsf', 'cox', 'lgbm', 'xgb', etc.
  hyperparameters     JSONB,
  feature_set         JSONB,
  train_val_test_split JSONB,
  status              TEXT DEFAULT 'queued', -- queued, running, completed, failed
  metrics             JSONB,                 -- {'c_index': 0.74, 'ibs': 0.18, ...}
  mlflow_run_id       TEXT,
  artifact_path       TEXT,                  -- S3/Storage 모델 경로
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  error_message       TEXT
);

-- 모델 레지스트리 (프로덕션 배포 가능 모델)
CREATE TABLE ml.models (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       UUID REFERENCES ml.experiments(id),
  name                TEXT NOT NULL,
  version             TEXT NOT NULL,         -- 'v1.0.0' 등 semver
  model_type          TEXT NOT NULL,
  status              TEXT DEFAULT 'staging',-- staging, production, archived
  metrics             JSONB NOT NULL,
  feature_schema      JSONB NOT NULL,        -- 입력 피처 정의
  output_schema       JSONB NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  promoted_at         TIMESTAMPTZ,
  UNIQUE(name, version)
);

-- 예측 기록 (추론 호출 로그)
CREATE TABLE ml.predictions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id            UUID REFERENCES ml.models(id),
  input_data          JSONB NOT NULL,
  output_data         JSONB NOT NULL,
  explanation         JSONB,                 -- SHAP 등
  called_by           UUID REFERENCES auth.users(id),
  called_at           TIMESTAMPTZ DEFAULT NOW(),
  response_time_ms    INTEGER
);

-- 모니터링 (Drift, 성능 추적)
CREATE TABLE ml.monitoring (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id            UUID REFERENCES ml.models(id),
  monitoring_date     DATE NOT NULL,
  prediction_count    INTEGER,
  avg_prediction      NUMERIC,
  feature_drift_score JSONB,                 -- 피처별 PSI 점수
  prediction_drift    NUMERIC,
  alert_flag          BOOLEAN DEFAULT FALSE,
  UNIQUE(model_id, monitoring_date)
);
```

### 9.2 인덱스

```sql
CREATE INDEX idx_feat_cohort ON ml.feature_matrix(cohort_id);
CREATE INDEX idx_outcome_cohort ON ml.outcome_labels(cohort_id);
CREATE INDEX idx_exp_status ON ml.experiments(status, started_at);
CREATE INDEX idx_pred_model_date ON ml.predictions(model_id, called_at);
```

---

## 10. API 설계

### 10.1 ML Service (FastAPI)

```python
# api/routers/training.py
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(prefix="/ml/train")

class TrainingRequest(BaseModel):
    experiment_name: str
    model_type: str  # survival/regression/classification/recurrent/mortality
    cohort_id: str
    algorithm: str
    hyperparameters: dict
    feature_set: list[str]

class TrainingResponse(BaseModel):
    experiment_id: str
    status: str

@router.post("/start", response_model=TrainingResponse)
async def start_training(req: TrainingRequest, bg: BackgroundTasks):
    # 1. ml.experiments에 row 생성 (status=queued)
    exp_id = create_experiment(req)

    # 2. Celery 워커에 학습 작업 큐잉
    bg.add_task(run_training_worker, exp_id, req.dict())

    return TrainingResponse(experiment_id=exp_id, status="queued")

@router.get("/status/{experiment_id}")
async def get_status(experiment_id: str):
    return get_experiment_status(experiment_id)

@router.get("/results/{experiment_id}")
async def get_results(experiment_id: str):
    return get_experiment_results(experiment_id)
```

```python
# api/routers/inference.py
@router.post("/predict")
async def predict(req: PredictionRequest):
    model = load_model(req.model_id)

    # 입력 검증
    X = validate_input(req.features, model.feature_schema)

    # 예측 + SHAP
    pred = model.predict(X)
    shap_values = compute_shap(model, X)

    # 로그
    save_prediction_log(req.model_id, req.features, pred, shap_values)

    return {
        'prediction': pred.tolist(),
        'shap_values': shap_values.tolist(),
        'model_version': model.version,
    }

@router.post("/predict/batch")
async def predict_batch(req: BatchPredictionRequest):
    """대량 추론 (CSV/Parquet 입력)"""
    job_id = enqueue_batch_inference(req)
    return {'job_id': job_id}
```

### 10.2 Next.js Route Handlers (프록시)

```typescript
// app/api/ml/train/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const session = await getServerSession();

  // 권한 확인
  if (!session?.user?.role || !['analyst', 'admin'].includes(session.user.role)) {
    return new Response('Forbidden', { status: 403 });
  }

  // ML Service로 프록시
  const mlRes = await fetch(`${process.env.ML_SERVICE_URL}/ml/train/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ML_SERVICE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return Response.json(await mlRes.json());
}
```

---

## 11. 보험 적용 시나리오

### 11.1 시나리오 1: 신상품 보장 설계

```
Q: 50대 일본인 남성 대상 5년 만기 암보장 신상품 설계

1. M1 모델 사용:
   - 50세 시점 코호트 추출 (대장암 prevalent 제외)
   - 5년 내 대장암·위암·간암·폐암·유방암 발병률 예측
   - 모집단 평균 + 분포 산출

2. M2 모델 결합:
   - 각 암 진단 시 5년 누적 의료비 분포 예측
   - 중앙값·90% 분위값 산출

3. 보장 설계:
   - 진단보험금 = 의료비 중앙값의 1.2배
   - 보험료 = 발병 확률 × 보장금 × (1 + 사업비율) ÷ 5년
```

### 11.2 시나리오 2: 인수 시 위험도 차등 요율

```
Q: 신규 가입 신청자의 위험 등급 자동 분류

1. M3 모델 사용:
   - 입력: 나이, 성별, BMI, 혈압, LDL, 흡연 여부 등
   - 출력: 0-100 위험 점수 + 분위 등급

2. 분위별 요율:
   - 1-20점 (저위험): 표준 요율 × 0.95
   - 21-50점 (보통): 표준 요율
   - 51-80점 (고위험): 표준 요율 × 1.15
   - 81-100점 (초고위험): 거절 또는 표준 요율 × 1.50

3. 규제 준수:
   - 차등 요율 적용 시 보험감독 규정 확인 필수
   - 거절 사유는 환자에게 통지 (설명가능한 SHAP 출력 활용)
```

### 11.3 시나리오 3: 갱신형 상품의 재발 위험

```
Q: 대장암 진단 후 5년 무사고 가입자의 갱신 보장

1. M4 모델 사용 (Recurrent Cox):
   - 최초 진단 + 1차 치료 정보 기반
   - 재발/재입원 위험 시간별 산출

2. 의사결정:
   - 무사고 5년 후 재발 위험 < 10% 시 갱신 가능
   - 위험 10-20% 시 추가 보험료
   - 위험 > 20% 시 갱신 거절
```

### 11.4 시나리오 4: 포트폴리오 손해율 예측

```
Q: 자사 보험 가입자 100만 명의 향후 1년 손해율 예측

1. M2 모델 일괄 추론 (배치):
   - 모든 가입자의 1년 의료비 예측
   - 보장 한도 적용 후 청구 예상금 산출

2. 집계:
   - 총 청구 예상금 / 수입 보험료 = 손해율 예측치
   - 95% 신뢰구간 산출 (Quantile model)

3. 재보험·준비금 산출:
   - 예측 손해율 > 임계값 시 재보험 가입 검토
   - 책임준비금 IBNR 추정 보조 지표로 활용
```

---

## 12. 한·일 비교 ML 모듈

### 12.1 외부 검증 (External Validation)

JMDC로 학습한 모델을 한국 HIRA K-OMOP에 적용하여 성능 평가:

```python
# 1. JMDC 모델 로드
model_jp = load_model('대장암_5년_예측_v3')

# 2. 한국 데이터를 동일 피처 스키마로 변환
X_kr = transform_omop_to_features(
    omop_dataset='hira_komop',
    feature_schema=model_jp.feature_schema,
    vocabulary_mapping='jp_to_kr_v1',  # YJ→ATC→EDI 변환
)

# 3. 외부 검증
y_kr_true = get_outcome_kr(...)
y_kr_pred = model_jp.predict(X_kr)

# 4. 성능 비교
jp_metric = c_index(y_jp_true, y_jp_pred)
kr_metric = c_index(y_kr_true, y_kr_pred)

print(f"일본 내부 검증: C={jp_metric:.3f}")
print(f"한국 외부 검증: C={kr_metric:.3f}")
print(f"성능 격차: {abs(jp_metric - kr_metric):.3f}")
```

### 12.2 Transfer Learning

- 일본에서 학습된 모델을 한국 데이터로 fine-tune
- 양국 모두 적용 가능한 hybrid model 학습

```python
# Fine-tuning with Korean data
model_kr = clone_model(model_jp)
model_kr.partial_fit(X_kr_train, y_kr_train, epochs=10)

# 양국 통합 모델
model_unified = train_unified_model(
    X_train=concat([X_jp, X_kr]),
    y_train=concat([y_jp, y_kr]),
    country_feature=['JP'] * len(X_jp) + ['KR'] * len(X_kr),
)
```

### 12.3 모델 공정성 (Cross-Country Fairness)

- 동일 모델의 한·일 환자 그룹별 성능 격차 측정
- 격차 발생 시 원인 분석 (인구 분포, 의료 시스템 차이)

---

## 13. 규제·윤리 준수

### 13.1 한국·일본 보험 규제 고려사항

| 영역 | 한국 | 일본 |
|------|------|------|
| 차등 요율 | 보험업법, 감독규정 | 보험업법, 일본보험심의회 가이드 |
| 유전정보 | GINA 미적용, 별도 규정 검토 | GINA 일본판 검토 |
| 알고리즘 설명 | 자율규제 (KDPA 가이드) | METI AI 거버넌스 |
| 데이터 가명화 | 개인정보보호법 | 차세대 의료기반법 |

### 13.2 ML 모델 거버넌스

1. **모델 카드 (Model Card)** 자동 생성:
   - 학습 데이터 출처, 크기, 기간
   - 평가 지표 (전체 + 그룹별)
   - 알려진 한계
   - 권장 사용 범위

2. **인간 검토 (Human-in-the-loop)**:
   - 자동 거절 결정 시 보험계리사 검토 의무화
   - 고위험 분류 시 상위 결재

3. **로그·감사 추적**:
   - 모든 예측 호출 ml.predictions에 저장
   - 정기 감사 보고서 생성

### 13.3 데이터 보안

- 환자 식별 정보는 hash 처리 후 학습
- 모델 추론 결과는 24시간 후 자동 익명화
- ML 서비스 endpoint는 VPC 내부망에서만 접근

---

## 14. 마일스톤

| Phase | 기간 | 주요 산출물 |
|-------|------|-------------|
| **Phase 0: JMDC 기술통계 모듈 (v2.0 신규, 선행)** | 4주 | M0 카테고리 모듈 J1~J7 (§17), Synthetic JMDC data generator, PreviewModal 5종, 별첨 H/I/J 매핑 CSV 초안 |
| **Phase 1: Foundation** | 4주 | ml 스키마, Feature Engineering 모듈, FastAPI 골격 |
| **Phase 2: M1+M2** | 6주 | Survival + Regression 모델, MLflow 연동 |
| **Phase 3: M3+UI** | 4주 | Classification 모델, Frontend Model Studio |
| **Phase 4: M4+M5** | 4주 | Recurrent + Mortality 모델 |
| **Phase 5: Production** | 4주 | 모니터링, 모델 레지스트리, 한·일 비교 |
| **Phase 6: Polish** | 2주 | 보고서, 문서화, 규제 검토 |
| **합계** | **28주 (~7개월)** | Phase 0 추가로 v1.0 대비 4주 증가 |

---

## 15. Claude Code 구현 프롬프트

> 각 프롬프트는 독립 실행 가능. 순서대로 진행.

### 프롬프트 1: Python ML Service 골격

```
기존 Next.js + Supabase 프로젝트 옆에 새로운 Python ML 서비스를 구축한다.

1. ml-service/ 디렉토리 생성, 다음 구조:
   - pyproject.toml (uv 또는 poetry)
   - api/main.py (FastAPI)
   - lib/ (features/models/evaluation/explain/data)
   - workers/ (Celery)
   - tests/
   - Dockerfile, docker-compose.yml

2. 의존성:
   - fastapi, uvicorn, pydantic
   - scikit-learn, scikit-survival, lifelines
   - lightgbm, xgboost
   - shap, mlflow
   - celery, redis
   - supabase-py, sqlalchemy, psycopg2-binary
   - pandas, numpy, scipy

3. docker-compose.yml: ml-service, redis, mlflow-server 3개 컨테이너

4. lib/data/jmdc_loader.py: Supabase에서 코호트별 피처 데이터 로드

5. .env.example 작성 (SUPABASE_URL, SUPABASE_SERVICE_KEY, MLFLOW_URI 등)

6. tests/test_data_loader.py 작성

PRD 3절을 참조.
```

### 프롬프트 2: Feature Engineering 모듈

```
ml-service/lib/features/ 안에 다음 모듈 구현:

1. cohort_builder.py: Index Date 기반 코호트 생성
   - 입력: dataset_id, age_at_index, washout_months, exclusion_criteria
   - 출력: ml.cohort_index 테이블에 row 적재

2. demographic.py: 나이, 성별, 가구 구성 등 기본 피처
3. comorbidity.py: Charlson Comorbidity Index (PRD 5.2.1 참조)
4. medication.py: 약제 사용 패턴 (PRD 5.2.3)
5. utilization.py: 의료이용 강도 (외래 횟수, 입원 일수)
6. checkup.py: 검진 결과 (현재값 + 추세)
7. temporal.py: 시계열 피처 (PRD 5.2.2)

모든 피처 함수는 동일한 시그니처:
  def compute_<name>(member_ids: list[str], index_dates: list[date]) -> pd.DataFrame

전체 피처 매트릭스를 만드는 메인 함수:
  def build_feature_matrix(cohort_id: str, feature_set: list[str]) -> pd.DataFrame

결과는 ml.feature_matrix 테이블에 JSONB로 저장.

테스트: tests/test_features.py에 100명 샘플 데이터로 검증.
```

### 프롬프트 3: M1 Survival Model 구현

```
ml-service/lib/models/ 에 다음 구현:

1. base.py: BaseModel 추상 클래스
   - fit(X, y), predict(X), save(path), load(path)
   - log_to_mlflow() 메서드

2. survival_forest.py: Random Survival Forest (scikit-survival)
   - PRD 6.1.2 코드 참조
   - C-index, IBS, time-AUC 평가

3. cox_ph.py: lifelines CoxPHFitter
   - 비교 baseline

4. api/routers/training.py: 학습 시작 API
5. workers/training_worker.py: Celery task로 학습 실행
6. evaluation/metrics.py: C-index 등 평가 함수

테스트: PRD 샘플 데이터로 대장암 5년 예측 학습 → C-index > 0.6 확인.
MLflow에 실험 기록.
```

### 프롬프트 4: M2 Regression Model

```
ml-service/lib/models/lgbm_regressor.py 구현 (PRD 6.2.2 참조).

추가 작업:
1. Tweedie objective + Quantile Regression 지원
2. evaluation/metrics.py에 RMSE, MAE, R², MAPE 추가
3. evaluation/calibration.py에 Bias by decile 추가

테스트: 의료비 예측 RMSE 베이스라인 산출.
```

### 프롬프트 5: M3 Classification + 단계적 모델

```
PRD 6.3 단계적 인수 모델 구현.

1. lib/models/xgb_classifier.py: TieredUnderwritingModel 클래스
2. Tier별 모델 학습 + 자동 선택 로직
3. 신청자 정보 입력 → 위험점수 + 사용된 Tier 반환
4. lib/evaluation/fairness.py: 그룹별 AUC 격차 측정

API:
- POST /ml/predict/underwriting → 위험점수 + tier + SHAP
```

### 프롬프트 6: SHAP 설명 모듈

```
lib/explain/shap_engine.py 구현:

1. 각 모델 유형별 SHAP 계산:
   - Tree 기반: TreeExplainer
   - Survival: 변형된 SHAP
   - Classification: TreeExplainer/LinearExplainer

2. 단일 환자 SHAP + 글로벌 피처 중요도

3. API: POST /ml/explain/{prediction_id}

4. SHAP value를 ml.predictions.explanation에 저장
```

### 프롬프트 7: Next.js Frontend - Model Studio

```
Next.js 프로젝트에 ML 모듈 페이지 추가:

1. app/(ml)/ml/studio/page.tsx: 실험 목록 (PRD 8.1)
2. app/(ml)/ml/studio/new/page.tsx: 5단계 마법사 (PRD 8.2)
3. app/(ml)/ml/experiments/[id]/page.tsx: 결과 화면 (PRD 8.3)
4. app/api/ml/*/route.ts: ML 서비스 프록시

Recharts로:
- 시간별 ROC AUC 곡선
- SHAP 피처 중요도 막대
- 캘리브레이션 차트

shadcn/ui로 마법사 UI 구성. Realtime subscription으로 학습 진행 상태 polling.
```

### 프롬프트 8: Inference UI + 추론 API

```
1. app/(ml)/ml/predict/page.tsx: 단일 환자 입력 폼 (PRD 8.4)
2. CSV 일괄 업로드 지원
3. 결과: 예측값 + 시간별 곡선 + SHAP

API:
- POST /api/ml/predict (단일)
- POST /api/ml/predict/batch (배치, job_id 반환)

추론 결과 PDF 보고서 생성 (jsPDF 또는 서버사이드 puppeteer).
```

### 프롬프트 9: 모니터링 + 모델 레지스트리

```
프로덕션 모델의 성능 추적:

1. workers/monitoring_worker.py: 일별 Celery beat
   - 어제 발생한 예측들의 input/output 분포 계산
   - 학습 시 분포와 PSI (Population Stability Index) 계산
   - drift 발생 시 ml.monitoring에 alert_flag=true

2. app/(ml)/ml/monitoring/page.tsx: 대시보드
   - 모델별 일별 예측 건수
   - PSI 추세
   - alert 알림

3. app/(ml)/ml/models/page.tsx: 모델 레지스트리
   - staging → production 승격
   - 버전 롤백
   - A/B 테스트 트래픽 분배
```

### 프롬프트 10: 한·일 비교 + 외부 검증

```
1. lib/data/omop_loader.py: HIRA K-OMOP에서 동일 피처 스키마로 로드
2. lib/vocabulary/jp_kr_mapping.py: YJ↔ATC↔EDI 변환 헬퍼
3. PRD 12.1 외부 검증 API 구현:
   - POST /ml/validate/external
   - 입력: model_id + external_dataset_id
   - 출력: 양국 성능 비교 보고서

4. Frontend: app/(ml)/ml/experiments/[id]/external-validation/page.tsx
```

---

## 16. 별첨 자료

본 PRD와 함께 제공되는 별첨:

| 별첨 | 파일 | 상태 |
|------|------|------|
| **A. Charlson CCI 매핑표** | `appendix_A_charlson_icd10.csv` | 작성 완료 |
| **B. 약제 ATC 카테고리 매핑** | `appendix_B_atc_categories.csv` | 작성 완료 |
| **C. 피처 사전 (모든 피처 정의)** | `appendix_C_feature_dictionary.csv` | 작성 완료 |
| **D. 모델 카드 템플릿** | `appendix_D_model_card_template.md` | 작성 완료 |
| **E. 데이터 준비 SQL 예시** | `appendix_E_data_preparation.sql` | 작성 완료 |
| **F. 평가 지표 정의** | `appendix_F_evaluation_metrics.md` | 작성 완료 |
| **G. 의료비 예측 베이스라인 노트북** | `appendix_G_cost_prediction_baseline.ipynb` | 작성 완료 |
| **H. 약제 일·한 매핑 (YJ↔ATC↔EDI)** | `appendix_H_drug_jp_kr_mapping.csv` | **v2.0 신규 — Phase 0 산출물** |
| **I. 검사항목 일·한 매핑 (JLAC10↔LOINC↔EDI)** | `appendix_I_lab_jlac10_edi.csv` | **v2.0 신규 — Phase 0 산출물** |
| **J. 진료행위·시술 일·한 매핑** | `appendix_J_procedure_jp_kr.csv` | **v2.0 신규 — Phase 0 산출물** |

---

## 17. JMDC 발생률·위험비교 분석 모듈 (v2.0 신규)

> **목적**: ML 모델 학습(M1~M5) 이전 단계에서 JMDC 데이터에 대한 **역학·기술통계 분석**을 본 앱(ML Auto Flow)의 모듈 파이프라인 위에서 수행한다. 코호트 정의, 발생률 산출, 군간 위험 비교, 누적 발생, 보정 HR, 한·일 매칭을 7개 모듈(J1~J7)로 제공한다.

### 17.1 카테고리 개요

본 카테고리는 React + Pyodide 기반인 ML Auto Flow의 기존 모듈 시스템(`ModuleType` enum, `TOOLBOX_MODULES`, `codeSnippets.ts`, `*PreviewModal.tsx`)을 그대로 따른다. 사용자는 캔버스에서 J1~J7을 드래그·연결하여 별도 백엔드 없이 브라우저 내 Python으로 분석을 실행할 수 있다.

| 모듈 ID | 이름 | 입력 포트 | 출력 포트 | 핵심 라이브러리 |
|---------|------|----------|----------|----------------|
| J1 | JMDC Cohort Builder | data_in (member·claim·disease) | data (cohort) | pandas |
| J2 | JMDC Outcome Labeler | data_in (cohort), data_in (disease) | data (labeled cohort) | pandas |
| J3 | JMDC Incidence Rate | data_in (labeled cohort) | data (rate table), curve | pandas, numpy, scipy |
| J4 | JMDC Survival Compare (KM) | data_in (labeled cohort) | curve, data (logrank) | lifelines |
| J5 | JMDC Cumulative Incidence | data_in (labeled cohort) | curve, data (CIF table) | lifelines |
| J6 | JMDC Risk Stratification (Cox) | data_in (labeled cohort) | data (HR table), model | lifelines |
| J7 | JMDC KR-JP Matcher | data_in (JP cohort), data_in (KR cohort) | data (matched), curve (SIR) | pandas, scipy |

**포트·변수 규칙(본 앱 표준 준수)**: 첫 번째 데이터 입력은 `dataframe`, 두 번째는 `dataframe2`, 모델 입력은 `trained_model`. 모듈 출력 변수는 `data_{moduleId[:8]}` / `model_{moduleId[:8]}` 패턴.

### 17.2 모듈별 상세 명세

각 모듈은 다음 6개 항목으로 명세한다: (a) 목적과 비즈니스 질문, (b) 입력 스키마, (c) 파라미터, (d) 출력 스키마, (e) Python 알고리즘 스케치, (f) PreviewModal 시각화.

#### J1. JMDC Cohort Builder

- **(a) 목적**: Index Date 기준 분석 코호트를 정의. 워시아웃·연령·제외 조건·"N년 무사고" 조건 적용.
- **(b) 입력 스키마**: `member_id, sex_code, birth_date, first_obs_date, last_obs_date` (+ 청구·진단 이력 long format).
- **(c) 파라미터**:
  - `index_date_rule`: `birthday_age` (예: 50번째 생일) / `enrollment_date` / `fixed_date`
  - `age_at_index_min`, `age_at_index_max`
  - `washout_years`: Index Date 이전 최소 관측 연수
  - `exclusion_diseases`: ICD-10 prefix 리스트 (예: `["C00-C97"]`)
  - `disease_free_years`: Index Date 이전 N년간 특정 질환 무사고 조건 (분석 3 대응)
  - `data_source`: `synthetic | supabase | csv`
- **(d) 출력 스키마**: `member_id, index_date, age_at_index, sex_code, age_band, included_flag, exclusion_reason`.
- **(e) Python 스케치**:
  ```python
  df = dataframe.copy()
  df["index_date"] = compute_index_date(df, rule=PARAMS["index_date_rule"])
  df = df[df["first_obs_date"] <= df["index_date"] - relativedelta(years=PARAMS["washout_years"])]
  df = df[df["last_obs_date"] >= df["index_date"]]
  df["age_at_index"] = ((df["index_date"] - df["birth_date"]).dt.days / 365.25).astype(int)
  df = df.query("@PARAMS['age_at_index_min'] <= age_at_index <= @PARAMS['age_at_index_max']")
  df = exclude_by_icd(df, claim_disease_df, PARAMS["exclusion_diseases"],
                      window_years=PARAMS["disease_free_years"])
  df["age_band"] = pd.cut(df["age_at_index"], bins=[0,29,39,49,59,69,200],
                          labels=["<30","30-39","40-49","50-59","60-69","70+"])
  out = df[["member_id","index_date","age_at_index","sex_code","age_band"]]
  ```
- **(f) PreviewModal (`JMDCCohortPreviewModal`)**: 코호트 적용 단계별 잔존 N (funnel chart), 성별·연령군 분포 막대, 제외 사유별 표.

#### J2. JMDC Outcome Labeler

- **(a) 목적**: 코호트별 outcome event(질병 첫 진단)의 발생 시점·검열 시점을 산출. Survival/Incidence 모듈의 필수 선행 단계.
- **(b) 입력**: `dataframe` = J1 코호트 / `dataframe2` = `member_id, icd10_code, onset_date, suspect_flag` (claims_disease).
- **(c) 파라미터**:
  - `outcome_diseases`: 사전 정의 라이브러리 dict (예: `{"colon_ca": ["C18","C19","C20"], "stroke": ["I60","I61","I62","I63","I64"], "ami": ["I21","I22"], "diabetes": ["E10","E11","E12","E13","E14"]}`)
  - `outcome_window_years`: 5 / 10 등
  - `confirm_suspect_flag`: suspect 진단 제외 여부 (기본 True)
  - `multi_outcome_mode`: `single | long` (분석 2의 다중 outcome 대응)
- **(d) 출력 스키마**: cohort 컬럼 + `outcome_type, first_event_date, time_to_event_days, event_flag, censor_reason` (`event` / `death` / `lost_followup` / `admin_censor`).
- **(e) Python 스케치**:
  ```python
  outcomes = []
  for label, prefixes in PARAMS["outcome_diseases"].items():
      mask = dataframe2["icd10_code"].str[:3].isin(prefixes)
      if PARAMS["confirm_suspect_flag"]:
          mask &= ~dataframe2["suspect_flag"].fillna(False)
      first_evt = (dataframe2[mask]
                   .groupby("member_id")["onset_date"].min().rename(f"{label}_date"))
      outcomes.append(first_evt)
  evt = pd.concat(outcomes, axis=1).reset_index()
  merged = dataframe.merge(evt, on="member_id", how="left")
  end_of_window = merged["index_date"] + pd.Timedelta(days=365*PARAMS["outcome_window_years"])
  merged["first_event_date"] = merged.filter(like="_date").min(axis=1)
  merged["event_flag"] = merged["first_event_date"].notna() & (merged["first_event_date"] <= end_of_window)
  merged["time_to_event_days"] = (merged["first_event_date"].fillna(end_of_window)
                                  - merged["index_date"]).dt.days.clip(lower=0)
  ```
- **(f) PreviewModal (`JMDCSurvivalPreviewModal`과 공유)**: 사건/검열 비율 도넛, censor 사유 막대, outcome별 발생 누계.

#### J3. JMDC Incidence Rate

- **(a) 목적**: person-years 분모 기반 조발생률·연령표준화발생률 산출. **분석 3 대응**.
- **(b) 입력**: J2 출력.
- **(c) 파라미터**:
  - `stratify_by`: `none | sex | age_band | sex_age`
  - `age_bands`: 기본 `[<30, 30-39, 40-49, 50-59, 60-69, 70+]`
  - `standard_population`: `internal | WHO_2000 | japan_2015 | korea_2020`
  - `rate_unit`: per `1000_PY` / `10000_PY` / `100000_PY`
  - `time_grid_years`: 누적 발생 곡선 시점 (예: `[1,2,3,4,5]`)
- **(d) 출력 스키마**:
  - 테이블: `stratum, N, person_years, events, crude_rate, crude_ci_lo, crude_ci_hi, std_rate, std_ci_lo, std_ci_hi`
  - curve: `t_years × stratum → cumulative_incidence` (KM 1-S(t) 등가)
- **(e) Python 스케치**:
  ```python
  df = dataframe.copy()
  df["py"] = df["time_to_event_days"] / 365.25
  groups = df.groupby(stratum_cols)
  agg = groups.agg(N=("member_id","nunique"),
                   events=("event_flag","sum"),
                   person_years=("py","sum")).reset_index()
  agg["crude_rate"] = agg["events"] / agg["person_years"] * RATE_UNIT
  agg[["crude_ci_lo","crude_ci_hi"]] = poisson_ci(agg["events"], agg["person_years"]) * RATE_UNIT
  if PARAMS["standard_population"] != "internal":
      weights = load_standard_pop(PARAMS["standard_population"])
      agg = direct_standardize(agg, weights)
  cif = cumulative_incidence_grid(df, stratum_cols, PARAMS["time_grid_years"])
  ```
- **(f) PreviewModal (`JMDCIncidencePreviewModal`)**: stratum별 발생률 막대(에러바), 경과년도별 누적 발생 라인(성·연령 컬러 코딩).

#### J4. JMDC Survival Compare (KM)

- **(a) 목적**: 2개 이상 군의 경과년도별 사건 회피 확률 비교. **분석 1 대응**.
- **(b) 입력**: J2 출력 + group 컬럼 (예: `has_diabetes`). group 컬럼은 J1 단계 또는 별도 `DataFiltering`/`EncodeCategorical` 모듈로 사전 생성.
- **(c) 파라미터**:
  - `group_col`: 비교 군 컬럼명
  - `time_horizons_years`: HR 산출 시점 (예: `[1, 3, 5, 10]`)
  - `logrank_method`: `standard | stratified`
  - `stratify_cols`: stratified log-rank의 stratification 변수 (예: `["sex_code","age_band"]`)
- **(d) 출력**:
  - curve: KM 곡선 + 95% CI 음영 (group별)
  - 테이블: `group, N, events, median_survival, cum_inc_1y, cum_inc_3y, cum_inc_5y, logrank_p, stratified_logrank_p`
- **(e) Python**:
  ```python
  from lifelines import KaplanMeierFitter
  from lifelines.statistics import multivariate_logrank_test, logrank_test
  kmfs = {}
  for g, sub in dataframe.groupby(PARAMS["group_col"]):
      kmf = KaplanMeierFitter().fit(sub["time_to_event_days"]/365.25,
                                     sub["event_flag"], label=str(g))
      kmfs[g] = kmf
  lr = multivariate_logrank_test(dataframe["time_to_event_days"],
                                  dataframe[PARAMS["group_col"]],
                                  dataframe["event_flag"])
  ```
- **(f) PreviewModal (`JMDCSurvivalPreviewModal`)**: KM 곡선(범례·CI 음영) + 우측 group별 통계 표 + log-rank p-value 배너.

#### J5. JMDC Cumulative Incidence

- **(a) 목적**: 경쟁위험(competing risk) 고려 누적 발생 함수. **분석 2 대응**.
- **(b) 입력**: J2 출력 (사망·탈퇴 등 경쟁사건 컬럼 권장).
- **(c) 파라미터**:
  - `event_col`: 주 사건 컬럼 (기본 `event_flag`)
  - `competing_event_cols`: 경쟁 사건 컬럼들 (예: `["death_flag"]`)
  - `time_grid_years`: 출력 시점 grid (예: `[1,2,3,4,5,7,10]`)
  - `bootstrap_n`: CI 산출 시 부트스트랩 횟수 (기본 0=Aalen-Johansen 해석적 CI 사용)
- **(d) 출력**: curve (시점별 CIF + CI band), 테이블 (시점별 CIF·CI), 경쟁사건이 있을 때는 cause-specific 누적도 함께.
- **(e) Python**: `lifelines.AalenJohansenFitter` (경쟁위험) 또는 1-KM (단일 사건).
- **(f) PreviewModal**: 누적 발생 stacked area (main vs competing). J4와 동일한 modal 컴포넌트로 mode 토글.

#### J6. JMDC Risk Stratification (Cox)

- **(a) 목적**: 공변량 보정 위험비(HR) 산출. **분석 1 심화** — 연령·성·BMI 보정 후 당뇨 효과의 HR과 95% CI.
- **(b) 입력**: J2 출력 + 공변량 컬럼 (Charlson, BMI, 검진 등 — 별첨 C 피처 사전 참조).
- **(c) 파라미터**:
  - `exposure_col`: 주요 노출 변수 (예: `has_diabetes`)
  - `covariates`: 보정 변수 리스트
  - `stratify_col`: 층화 변수 (Cox stratified 모델)
  - `proportional_hazards_test`: True/False (Schoenfeld residuals)
  - `tie_method`: `efron | breslow`
- **(d) 출력**: HR 테이블 (`variable, hr, hr_ci_lo, hr_ci_hi, p_value, ph_test_p`), Schoenfeld 잔차 차트 데이터, model 핸들(다음 ScoreModel 모듈에서 재사용 가능).
- **(e) Python**:
  ```python
  from lifelines import CoxPHFitter
  cph = CoxPHFitter()
  cph.fit(dataframe, duration_col="time_to_event_days", event_col="event_flag",
          strata=PARAMS.get("stratify_col"),
          formula=" + ".join([PARAMS["exposure_col"]] + PARAMS["covariates"]))
  hr_table = cph.summary[["exp(coef)","exp(coef) lower 95%","exp(coef) upper 95%","p"]]
  if PARAMS["proportional_hazards_test"]:
      ph_results = cph.check_assumptions(dataframe, p_value_threshold=0.05)
  trained_model_out = cph
  ```
- **(f) PreviewModal (`JMDCCoxPreviewModal`)**: forest plot (HR + 95% CI) + PH 가정 위반 경고 배너 + Schoenfeld 잔차 thumbnail.

#### J7. JMDC KR-JP Matcher

§18에서 4-Layer 방법론과 함께 상세 명세.

### 17.3 사용 시나리오 (요청된 3개 분석 매핑)

```text
[분석 1: 당뇨/비당뇨 경과년도별 위험 비교]
LoadData → J1 Cohort (washout=2y, age 40-70)
        → J2 Outcome (대장암 C18-20 / AMI I21-22 / 뇌졸중 I60-64 multi_outcome)
        → DataFiltering (has_diabetes 컬럼 생성·분리)
        → J4 KM Compare  (group_col=has_diabetes, stratified by sex_age)
        → J6 Cox          (exposure=has_diabetes, covariates=[age, sex, bmi, charlson])

[분석 2: 보험가입 대상자 경과년도별 암·뇌졸중·AMI 발생확률]
LoadData → J1 Cohort (insurance_applicant_filter=True)
        → J2 Outcome (multi_outcome=각 질병별 별도 row 생성)
        → J5 Cumulative Incidence (competing_event_cols=["death_flag"],
                                   time_grid_years=[1,3,5,10])

[분석 3: 5년 무사고자 성별·연령별 경과년도별 발생률]
LoadData → J1 Cohort (disease_free_years=5,
                     exclusion_diseases=["C00-C97","I21","I63"])
        → J2 Outcome (target disease)
        → J3 Incidence Rate (stratify_by="sex_age",
                             standard_population="japan_2015",
                             time_grid_years=[1,2,3,4,5])
```

### 17.4 본 앱(ML Auto Flow) 통합 포인트

> 실제 코드 작성은 Phase 0 산출물. 본 절은 통합 계약(integration contract)을 정의한다.

1. **`types.ts`**: `ModuleType` enum에 7개 항목 추가:
   `JMDCCohortBuilder, JMDCOutcomeLabeler, JMDCIncidenceRate, JMDCSurvivalCompare, JMDCCumulativeIncidence, JMDCRiskStratification, JMDCKRJPMatcher`.
2. **`constants.ts`** `TOOLBOX_MODULES`: `// JMDC Analysis` 섹션 주석 + 7개 모듈 항목 등록. 아이콘은 `ChartCurveIcon`(curve 출력 계열), `UsersIcon`(cohort/matcher), `CalculatorIcon`(Cox/Incidence) 재사용 권장. 필요 시 `HeartPulseIcon` 신규 추가.
3. **`codeSnippets.ts`**: 7개 Python 템플릿 등록. 모듈 간 변수 규칙(`dataframe`, `dataframe2`, `trained_model`, `curve`) 준수. matplotlib PNG는 base64로 stdout 캡처되어 PreviewModal로 전달.
4. **`components/`**: 신규 PreviewModal 컴포넌트 5종 — `JMDCCohortPreviewModal.tsx`(J1), `JMDCIncidencePreviewModal.tsx`(J3), `JMDCSurvivalPreviewModal.tsx`(J4·J5 공유), `JMDCCoxPreviewModal.tsx`(J6), `JMDCMatcherPreviewModal.tsx`(J7). 모든 컴포넌트는 `module.outputData` null 체크 필수.
5. **`utils/pyodideRunner.ts`**: lifelines 패키지 가용성 사전 확인. Pyodide 공식 패키지에 미포함 시 `micropip.install("lifelines")` 일회성 호출을 추가해야 함. **단, 본 파일은 핵심 원칙상 매우 신중히 수정** — 별도 PR로 분리하고 회귀 테스트 필수.
6. **`utils/generatePipelineCode.ts`**: J2 모듈의 `dataframe2` 포트 처리는 기존 Join/Concat 패턴 그대로 재사용 (별도 수정 없음).

### 17.5 데이터 입력 부재 대응 (Synthetic mode)

JMDC 원천 데이터 적재 이전 단계에서도 모듈 J1~J6의 end-to-end 시연이 가능하도록 합성 데이터 생성기를 정의한다. Phase 0에서 `lib/data/synthetic_jmdc.py` (또는 본 앱이 모듈 시스템이므로 신규 모듈 `JMDCSyntheticGenerator`)로 구현.

**합성 데이터 사양**:

| 항목 | 사양 |
|------|------|
| 가상 가입자 수 | 100,000명 |
| 성별 비율 | M:F = 52:48 |
| 연령 분포 | 정규분포 μ=48, σ=14, 절단 [20, 80] |
| 당뇨 prevalence | 12% (50대 18%, 30대 4%) |
| 고혈압 prevalence | 28% |
| 5년 대장암 발병률 (비당뇨 기준) | 1.2% |
| 5년 대장암 발병률 (당뇨군) | 1.7% (HR ≈ 1.4) |
| 5년 AMI 발병률 (비당뇨) | 0.9% / (당뇨) 1.8% |
| 5년 뇌졸중 발병률 (비당뇨) | 1.4% / (당뇨) 2.5% |
| 사망 (5년) | 1.5% (40-65세 기준) |
| 관측 탈퇴 (5년 lost-to-followup) | 8% |
| 관측 시작일 분포 | 2015-01-01 ~ 2020-12-31 균등 |

`PropertiesPanel`에 `data_source: "synthetic" | "supabase" | "csv"` 토글을 노출하고, `synthetic` 선택 시 위 사양으로 즉시 생성.

### 17.6 Pyodide 환경 제약 및 회피책

- **lifelines**: Pyodide 0.24+ 표준 빌드에 포함됨. 미포함 시 `micropip.install("lifelines")`.
- **대용량 데이터**: 브라우저 메모리 한계로 100만 명 코호트는 권장하지 않음. 30만 명 이하에서 J1~J6 검증. 그 이상은 ml-service(§3 PRD v1.0)로 위임.
- **수치적 안정성**: KM의 0 event stratum 회피, Cox의 separation 경고 처리 — PreviewModal에서 가시화.

---

## 18. 한·일 매칭 프로토콜 (v2.0 신규)

> **목적**: PRD §12의 ML 모델 단위 외부 검증을 **발생률·코호트 단위에서 선행 매칭**하는 방법을 4개 레이어로 정의한다. J7(KR-JP Matcher) 모듈이 본 절을 구현한다.

### 18.1 4-Layer 매칭 프레임워크

| 레이어 | 다루는 격차 | 산출물 |
|--------|------------|--------|
| **L1. 스키마 정렬** | 데이터 모델 차이 (JMDC ↔ HIRA K-OMOP) | 공통 OMOP CDM 컬럼 매핑표 |
| **L2. 어휘 매핑** | 코드 체계 차이 (약제·검사·시술) | 별첨 H/I/J 매핑 CSV |
| **L3. 인구 표준화** | 연령·성 분포 차이 | 직접/간접 표준화, SIR |
| **L4. 분석 매칭** | 코호트 특성 격차 | 성향점수 매칭(PSM), IPTW |

J7 모듈은 위 4단계 중 사용자가 단계별 활성화 가능(체크박스 파라미터): `apply_schema_alignment / apply_vocab_mapping / apply_standardization / apply_psm`.

### 18.2 L1: 스키마 정렬 (OMOP CDM v5.4 기준)

| OMOP 테이블 | JMDC 원천 | HIRA K-OMOP 원천 | 비고 |
|------------|----------|------------------|------|
| `person` | `his_population` | T20 (자격) | sex_code 표준화 (1/2→M/F) |
| `visit_occurrence` | `his_claims` | T30 (명세서) | claim_type → visit_concept_id |
| `condition_occurrence` | `his_claims_disease` | T40_diag | ICD-10 공통 — 매핑 단순 |
| `drug_exposure` | `his_claims_drugs` | T60_drug | YJ↔ATC↔EDI 변환 (별첨 H) |
| `measurement` | `his_health_checkup` | 건강검진 데이터 | JLAC10↔EDI 변환 (별첨 I) |
| `procedure_occurrence` | `his_claims_medacts` | T40_procedure | 별첨 J |
| `observation_period` | first/last_obs_date | 가입·자격 기간 | 양국 일관 |
| `death` | (별도 추정) | 사망신고 연동 | JMDC는 사망 직접 관측 약함 |

### 18.3 L2: 어휘 매핑 (별첨 H/I/J)

기존 별첨 A(ICD-10), B(ATC) 외에 신규 별첨 H, I, J 추가:

- **별첨 H** `appendix_H_drug_jp_kr_mapping.csv`: YJ↔ATC↔EDI 매핑.
  - 컬럼: `yj_code, yj_name_jp, atc_code, atc_name, edi_code, edi_name_kr, mapping_confidence (high/medium/low), mapping_source, notes`
- **별첨 I** `appendix_I_lab_jlac10_edi.csv`: 검사항목 매핑.
  - 컬럼: `jlac10_code, jlac10_name_jp, loinc_code, loinc_name, edi_code, edi_name_kr, unit_jp, unit_kr, unit_conversion_factor, mapping_confidence`
- **별첨 J** `appendix_J_procedure_jp_kr.csv`: 진료행위·시술 매핑.
  - 컬럼: `jp_procedure_code, jp_procedure_name, icd9cm_proc, icd10pcs, edi_code, edi_name_kr, mapping_confidence`

**매핑 신뢰도 운용 규칙**:
- `high`: 1:1 매핑, 동일 성분·동일 적응증 → 본 분석에 사용
- `medium`: 1:N 매핑 또는 성분 군 단위 → 본 분석에 사용하되 민감도 분석 병행
- `low`: 잠정 매핑 → 민감도 분석 전용, 본 결과에서 제외

### 18.4 L3: 인구 표준화

**직접 표준화 (Direct Standardization)**:
- 공통 표준인구(WHO World Standard 2000 또는 양국 합동 표준)에 양국 stratum별 발생률을 가중.
- 산출물: `age_sex_adjusted_rate_per_1000PY` + 95% CI.

**간접 표준화 (SIR, Standardized Incidence Ratio)**:
- 일본 발생률을 기준으로 한국 코호트의 expected 사건수 산출.
- `SIR = observed_KR / expected_KR_using_JP_rates`
- 95% CI는 Byar's approximation.

**Python 스케치** (J7 모듈에 구현):

```python
def direct_standardize(strata_df, weights):
    """strata_df: ['stratum','events','person_years'] / weights: dict[stratum->w]"""
    strata_df["rate"] = strata_df["events"] / strata_df["person_years"]
    strata_df["w"] = strata_df["stratum"].map(weights)
    strata_df["w"] /= strata_df["w"].sum()
    return (strata_df["rate"] * strata_df["w"]).sum()

def sir_byar(observed, expected):
    ratio = observed / expected
    o = observed
    lo = (o * (1 - 1/(9*o) - 1.96/(3*np.sqrt(o)))**3) / expected
    hi = ((o+1) * (1 - 1/(9*(o+1)) + 1.96/(3*np.sqrt(o+1)))**3) / expected
    return ratio, lo, hi
```

### 18.5 L4: 분석 매칭

- **성향점수 매칭 (PSM)**: 양국 가입자 풀에서 연령·성·BMI·기왕증 공변량 기반 1:1 또는 1:k nearest-neighbor 매칭. 매칭 후 |SMD| < 0.1을 균형 기준.
- **IPTW (Inverse Probability of Treatment Weighting)**: 매칭 대신 가중치 부여. 더 큰 표본 유지 가능, 극단 가중치 trimming 권장.
- **SMD (Standardized Mean Difference)**: 매칭 전·후 balance check. |SMD| ≥ 0.1인 변수는 재매칭·추가 보정 검토.

```python
# PSM 의사코드
from sklearn.linear_model import LogisticRegression
ps_model = LogisticRegression().fit(X_covariates, country_label)
ps = ps_model.predict_proba(X_covariates)[:, 1]
# 1:1 nearest-neighbor (caliper 0.2*std(logit(ps)))
matched_pairs = nearest_match(ps_jp=ps[country=="JP"], ps_kr=ps[country=="KR"],
                              caliper=0.2*np.std(logit(ps)))
```

### 18.6 J7 모듈 명세

- **입력**: `dataframe` = JP 코호트 (J1·J2 산출) / `dataframe2` = KR 코호트 (동일 스키마).
- **파라미터**:
  - `apply_schema_alignment` (bool)
  - `apply_vocab_mapping` (bool, 별첨 H/I/J 사용)
  - `apply_standardization`: `none | direct | indirect_sir`
  - `standard_population`: `WHO_2000 | japan_2015 | korea_2020 | combined`
  - `apply_psm` (bool), `psm_covariates`, `caliper`
  - `comparison_outcome`: 분석 대상 outcome
- **출력**:
  - 테이블 1: 매칭 전·후 SMD (변수 × pre/post)
  - 테이블 2: 표준화 발생률 비교 (JP raw / JP std / KR raw / KR std / ratio + 95% CI)
  - 테이블 3: SIR + 95% CI (질병별)
  - curve: 양국 KM 곡선 오버레이, SIR forest plot
- **PreviewModal (`JMDCMatcherPreviewModal`)**: 4-panel — (1) SMD before/after 막대, (2) KM 오버레이, (3) SIR forest, (4) 표준화 비율 표.

### 18.7 한·일 매칭 운용 거버넌스

- 매핑 CSV(별첨 H/I/J)는 **버전 관리**되며 변경 시 J7 출력에 매핑 버전 메타데이터 기록.
- `mapping_confidence=low` 항목은 J7에서 자동으로 민감도 분석에만 사용.
- 일·한 비교 결과는 **별첨 D 모델 카드 템플릿**에 country pair 섹션을 추가하여 보고.
- PRD §13.1 (규제) 준수 — 한·일 양국 개인정보 가명화 기준 모두 충족하는 데이터만 비교에 사용.

---

**문서 끝 (v2.0)**

본 PRD는 ML Auto Flow 앱에 머신러닝 기반 보험 분석 모듈을 추가하기 위한 종합 청사진입니다.
v2.0에서는 ML 모델(M1~M5) 학습 이전 단계의 역학·기술통계 분석을 위한 **M0 카테고리 (J1~J7, §17)** 와 발생률·코호트 단위의 **한·일 매칭 4-Layer 프로토콜 (§18)** 을 추가하여 총 28주(Phase 0~6) 일정으로 확장합니다. 각 모델 카테고리(M0, M1~M5)는 독립적으로 구현 가능합니다.
