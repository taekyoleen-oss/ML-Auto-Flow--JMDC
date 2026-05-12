-- ==============================================================
-- 별첨 E: ML 학습용 데이터 준비 SQL 예시
-- ==============================================================
-- 본 SQL은 ml-service의 데이터 로더에서 사용할 표준 패턴을 정리한 것입니다.
-- 실제 운영 시에는 SQLAlchemy ORM 또는 파라미터 바인딩을 통해 호출하세요.
-- ==============================================================

-- ----------------------------------------------------------------
-- 1. 코호트 정의: 50번째 생일 시점의 가입자
-- ----------------------------------------------------------------
-- 시나리오: 대장암 5년 발병 예측 모델용 코호트
-- Index Date: 50세 도달 시점
-- 워시아웃: 5년 이상 관측 가능자
-- 제외: 이미 대장암 진단 받은 자

INSERT INTO ml.cohort_index (cohort_id, member_id, dataset_id, index_date, age_at_index, sex_code)
WITH eligible AS (
  SELECT
    p.member_id,
    p.dataset_id,
    p.sex_code,
    -- 50번째 생일을 index_date로 설정
    (TO_DATE(p.birth_yyyymm || '01', 'YYYYMMDD') + INTERVAL '50 years')::DATE AS index_date,
    p.first_obs_date,
    p.last_obs_date
  FROM jmdc.his_population p
  WHERE p.dataset_id = :dataset_id
),
washout_ok AS (
  SELECT *
  FROM eligible
  WHERE first_obs_date <= index_date - INTERVAL '5 years'
    AND last_obs_date >= index_date  -- index date 시점에 관측 중이어야 함
),
no_prior_cancer AS (
  SELECT e.*
  FROM washout_ok e
  WHERE NOT EXISTS (
    SELECT 1
    FROM jmdc.his_claims_disease cd
    JOIN jmdc.his_claims c
      ON cd.claim_id = c.claim_id AND cd.dataset_id = c.dataset_id
    WHERE cd.member_id = e.member_id
      AND cd.dataset_id = e.dataset_id
      AND cd.icd10_code ~ '^C(0[0-9]|1[0-9]|2[0-6]|3[0-4])'  -- 광범위 암
      AND cd.suspect_flag = FALSE
      AND COALESCE(cd.onset_date, c.claim_date) < e.index_date
  )
)
SELECT
  :cohort_id AS cohort_id,
  member_id,
  dataset_id,
  index_date,
  50 AS age_at_index,
  sex_code
FROM no_prior_cancer;


-- ----------------------------------------------------------------
-- 2. Outcome 레이블 생성: 5년 내 대장암 진단
-- ----------------------------------------------------------------
-- event_flag = TRUE면 사건 발생, FALSE면 검열
-- time_to_event_days: 사건 또는 검열까지 일수

INSERT INTO ml.outcome_labels (cohort_id, member_id, outcome_type, event_flag, time_to_event_days)
WITH first_cancer AS (
  SELECT
    ci.cohort_id,
    ci.member_id,
    ci.index_date,
    MIN(COALESCE(cd.onset_date, c.claim_date)) AS first_dx_date
  FROM ml.cohort_index ci
  LEFT JOIN jmdc.his_claims_disease cd
    ON cd.member_id = ci.member_id
    AND cd.icd10_code ~ '^C1[89]|^C20'  -- 대장암 (C18, C19, C20)
    AND cd.suspect_flag = FALSE
  LEFT JOIN jmdc.his_claims c
    ON cd.claim_id = c.claim_id
  WHERE ci.cohort_id = :cohort_id
    AND COALESCE(cd.onset_date, c.claim_date) BETWEEN ci.index_date AND ci.index_date + INTERVAL '5 years'
  GROUP BY ci.cohort_id, ci.member_id, ci.index_date
),
labels AS (
  SELECT
    ci.cohort_id,
    ci.member_id,
    ci.index_date,
    p.last_obs_date,
    fc.first_dx_date,
    CASE
      WHEN fc.first_dx_date IS NOT NULL THEN TRUE
      ELSE FALSE
    END AS event_flag,
    CASE
      WHEN fc.first_dx_date IS NOT NULL
        THEN (fc.first_dx_date - ci.index_date)
      ELSE LEAST(
        (p.last_obs_date - ci.index_date),
        365 * 5  -- 5년 cap
      )
    END AS time_to_event_days
  FROM ml.cohort_index ci
  JOIN jmdc.his_population p ON p.member_id = ci.member_id
  LEFT JOIN first_cancer fc ON fc.member_id = ci.member_id
  WHERE ci.cohort_id = :cohort_id
)
SELECT
  cohort_id,
  member_id,
  'survival' AS outcome_type,
  event_flag,
  GREATEST(time_to_event_days, 1) AS time_to_event_days  -- 0일 방지
FROM labels;


-- ----------------------------------------------------------------
-- 3. 피처 매트릭스 생성 - Charlson Comorbidity Index
-- ----------------------------------------------------------------

INSERT INTO ml.feature_matrix (cohort_id, member_id, features)
WITH dx_window AS (
  -- 각 환자의 lookback 기간 내 진단 추출
  SELECT
    ci.cohort_id,
    ci.member_id,
    ci.index_date,
    cd.icd10_code
  FROM ml.cohort_index ci
  JOIN jmdc.his_claims_disease cd
    ON cd.member_id = ci.member_id
    AND cd.suspect_flag = FALSE
  JOIN jmdc.his_claims c
    ON cd.claim_id = c.claim_id
  WHERE ci.cohort_id = :cohort_id
    AND COALESCE(cd.onset_date, c.claim_date)
        BETWEEN ci.index_date - INTERVAL '1 year' AND ci.index_date
),
charlson AS (
  SELECT
    cohort_id,
    member_id,
    MAX(CASE WHEN icd10_code ~ '^I21|^I22|^I25\.2' THEN 1 ELSE 0 END) AS has_mi,
    MAX(CASE WHEN icd10_code ~ '^I50' THEN 1 ELSE 0 END) AS has_chf,
    MAX(CASE WHEN icd10_code ~ '^I7[01]|^I73\.[189]' THEN 1 ELSE 0 END) AS has_pvd,
    MAX(CASE WHEN icd10_code ~ '^I6[0-9]|^G4[56]' THEN 1 ELSE 0 END) AS has_cva,
    MAX(CASE WHEN icd10_code ~ '^F0[0-3]|^G30' THEN 1 ELSE 0 END) AS has_dementia,
    MAX(CASE WHEN icd10_code ~ '^J4[0-7]|^J6[0-7]' THEN 1 ELSE 0 END) AS has_copd,
    MAX(CASE WHEN icd10_code ~ '^E1[0-4]' THEN 1 ELSE 0 END) AS has_diabetes,
    MAX(CASE WHEN icd10_code ~ '^E1[0-4]\.[2-5]' THEN 1 ELSE 0 END) AS has_dm_complications,
    MAX(CASE WHEN icd10_code ~ '^N1[89]' THEN 1 ELSE 0 END) AS has_ckd,
    MAX(CASE WHEN icd10_code ~ '^C[0-7][0-9]' THEN 1 ELSE 0 END) AS has_cancer,
    MAX(CASE WHEN icd10_code ~ '^C7[7-9]|^C80' THEN 1 ELSE 0 END) AS has_metastasis,
    MAX(CASE WHEN icd10_code ~ '^B2[0-4]' THEN 1 ELSE 0 END) AS has_aids,
    -- Charlson 총점 계산
    SUM(DISTINCT CASE
      WHEN icd10_code ~ '^I21|^I22|^I25\.2' THEN 1
      WHEN icd10_code ~ '^I50' THEN 1
      WHEN icd10_code ~ '^I7[01]|^I73\.[189]' THEN 1
      WHEN icd10_code ~ '^I6[0-9]|^G4[56]' THEN 1
      WHEN icd10_code ~ '^F0[0-3]|^G30' THEN 1
      WHEN icd10_code ~ '^J4[0-7]|^J6[0-7]' THEN 1
      WHEN icd10_code ~ '^E1[0-4]' THEN 1
      WHEN icd10_code ~ '^E1[0-4]\.[2-5]' THEN 2
      WHEN icd10_code ~ '^N1[89]' THEN 2
      WHEN icd10_code ~ '^C[0-7][0-9]' THEN 2
      WHEN icd10_code ~ '^C7[7-9]|^C80' THEN 6
      WHEN icd10_code ~ '^B2[0-4]' THEN 6
      ELSE 0
    END) AS charlson_total
  FROM dx_window
  GROUP BY cohort_id, member_id
)
SELECT
  cohort_id,
  member_id,
  jsonb_build_object(
    'has_mi', has_mi,
    'has_chf', has_chf,
    'has_pvd', has_pvd,
    'has_cva', has_cva,
    'has_dementia', has_dementia,
    'has_copd', has_copd,
    'has_diabetes', has_diabetes,
    'has_dm_complications', has_dm_complications,
    'has_ckd', has_ckd,
    'has_cancer', has_cancer,
    'has_metastasis', has_metastasis,
    'has_aids', has_aids,
    'charlson_total', COALESCE(charlson_total, 0)
  ) AS features
FROM charlson
ON CONFLICT (cohort_id, member_id) DO UPDATE
SET features = ml.feature_matrix.features || EXCLUDED.features,
    computed_at = NOW();


-- ----------------------------------------------------------------
-- 4. 약제 사용 피처
-- ----------------------------------------------------------------

WITH drug_window AS (
  SELECT
    ci.cohort_id,
    ci.member_id,
    cd.atc_code
  FROM ml.cohort_index ci
  JOIN jmdc.his_claims_drugs cd
    ON cd.member_id = ci.member_id
    AND cd.prescription_date
        BETWEEN ci.index_date - INTERVAL '180 days' AND ci.index_date
  WHERE ci.cohort_id = :cohort_id
),
med_features AS (
  SELECT
    cohort_id,
    member_id,
    COUNT(DISTINCT SUBSTRING(atc_code, 1, 4)) AS n_unique_atc_lv3,
    COUNT(DISTINCT atc_code) AS n_unique_atc_lv5,
    (COUNT(DISTINCT atc_code) >= 5)::INT AS polypharmacy_flag,
    MAX((atc_code LIKE 'C09%')::INT) AS has_antihypertensive,
    MAX((atc_code LIKE 'A10B%')::INT) AS has_oad,
    MAX((atc_code LIKE 'A10A%')::INT) AS has_insulin,
    MAX((atc_code LIKE 'C10AA%')::INT) AS has_statin,
    MAX((atc_code = 'B01AC06')::INT) AS has_aspirin,
    MAX((atc_code LIKE 'B01AF%')::INT) AS has_doac,
    MAX((atc_code LIKE 'L01%')::INT) AS has_chemo,
    MAX((atc_code LIKE 'H02A%')::INT) AS has_steroid
  FROM drug_window
  GROUP BY cohort_id, member_id
)
INSERT INTO ml.feature_matrix (cohort_id, member_id, features)
SELECT
  cohort_id,
  member_id,
  jsonb_build_object(
    'n_unique_atc_lv3', n_unique_atc_lv3,
    'n_unique_atc_lv5', n_unique_atc_lv5,
    'polypharmacy_flag', polypharmacy_flag,
    'has_antihypertensive', has_antihypertensive,
    'has_oad', has_oad,
    'has_insulin', has_insulin,
    'has_statin', has_statin,
    'has_aspirin', has_aspirin,
    'has_doac', has_doac,
    'has_chemo', has_chemo,
    'has_steroid', has_steroid
  )
FROM med_features
ON CONFLICT (cohort_id, member_id) DO UPDATE
SET features = ml.feature_matrix.features || EXCLUDED.features,
    computed_at = NOW();


-- ----------------------------------------------------------------
-- 5. 학습용 최종 데이터셋 추출
-- ----------------------------------------------------------------
-- 이 쿼리 결과를 Python에서 pandas로 받아 X, y, time 변수로 분리

SELECT
  fm.member_id,
  fm.features,
  ci.age_at_index,
  ci.sex_code,
  ci.index_date,
  ol.event_flag,
  ol.time_to_event_days,
  -- Train/Val/Test 분할 (시간 기반)
  CASE
    WHEN ci.index_date < '2020-01-01' THEN 'train'
    WHEN ci.index_date < '2021-01-01' THEN 'val'
    ELSE 'test'
  END AS split
FROM ml.feature_matrix fm
JOIN ml.cohort_index ci
  ON fm.cohort_id = ci.cohort_id AND fm.member_id = ci.member_id
JOIN ml.outcome_labels ol
  ON ol.cohort_id = ci.cohort_id AND ol.member_id = ci.member_id
WHERE fm.cohort_id = :cohort_id
  AND ol.outcome_type = 'survival';


-- ----------------------------------------------------------------
-- 6. 모델 추론 결과 저장
-- ----------------------------------------------------------------

INSERT INTO ml.predictions (model_id, input_data, output_data, explanation, called_by, response_time_ms)
VALUES (
  :model_id,
  :input_features::JSONB,
  jsonb_build_object(
    'risk_score', :risk_score,
    'survival_at_1y', :surv_1y,
    'survival_at_5y', :surv_5y,
    'risk_category', :risk_category
  ),
  :shap_values::JSONB,
  :user_id,
  :response_ms
);


-- ----------------------------------------------------------------
-- 7. 모니터링: 일별 드리프트 계산
-- ----------------------------------------------------------------

WITH today_predictions AS (
  SELECT
    model_id,
    input_data,
    output_data
  FROM ml.predictions
  WHERE called_at::DATE = CURRENT_DATE - 1
    AND model_id = :model_id
),
feature_stats AS (
  SELECT
    AVG((input_data->>'age_at_index')::FLOAT) AS mean_age,
    AVG((input_data->>'charlson_total')::FLOAT) AS mean_charlson,
    AVG((output_data->>'risk_score')::FLOAT) AS mean_pred
  FROM today_predictions
)
INSERT INTO ml.monitoring (
  model_id, monitoring_date, prediction_count, avg_prediction, feature_drift_score
)
SELECT
  :model_id,
  CURRENT_DATE - 1,
  (SELECT COUNT(*) FROM today_predictions),
  fs.mean_pred,
  jsonb_build_object(
    'mean_age', fs.mean_age,
    'mean_charlson', fs.mean_charlson
  )
FROM feature_stats fs;


-- ==============================================================
-- 활용 팁
-- ==============================================================
-- 1. 모든 INSERT는 Idempotent하게 설계 (ON CONFLICT DO UPDATE)
-- 2. 대용량 처리 시 :cohort_id 별로 청크 처리 (1만 명 단위)
-- 3. SQL 자체 실행보다는 Python에서 pandas chunking이 더 효율적인 경우 많음
-- 4. 모든 ML 관련 쿼리는 EXPLAIN ANALYZE로 인덱스 활용 확인 권장
-- ==============================================================
