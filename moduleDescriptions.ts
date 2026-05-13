// Static descriptions shown by the 설명 popup on each module's properties panel.
// 키워드: 역할 (what it does), 입력 (what data it consumes), 결과 (what it produces).
// 신규 JMDC 모듈(J1~J7)은 상세하게, 기존 모듈은 핵심만 간결하게 작성.

import { ModuleType } from "./types";

export interface ModuleDescription {
  title: string;
  category?: string;
  role: string;
  input: string;
  output: string;
  parameters?: string;
  notes?: string;
}

export const MODULE_DESCRIPTIONS: Partial<
  Record<ModuleType, ModuleDescription>
> = {
  // ===== Data I/O =====
  [ModuleType.LoadData]: {
    title: "Load Data",
    category: "데이터 입출력",
    role: "CSV/Excel 파일을 업로드해 분석 파이프라인의 시작점으로 삼습니다. 파일은 브라우저에 업로드되어 Pyodide의 메모리에 DataFrame으로 로드됩니다.",
    input: "사용자가 선택한 로컬 .csv / .xlsx / .xls 파일. 헤더 행 1줄 + 데이터 행 N줄.",
    output: "전체 DataFrame. 후속 모듈(Statistics, SelectData, SplitData 등)에 그대로 연결합니다.",
    parameters: "fileContent: 파일 내용(브라우저가 자동 채움). source: 표시용 파일 경로.",
    notes: "파일 크기 20MB 이상이면 Pyodide 메모리 한계로 실행이 중단됩니다. 10MB 이상은 경고만 표시.",
  },
  [ModuleType.Statistics]: {
    title: "Statistics",
    category: "탐색적 분석",
    role: "수치형/범주형 컬럼별 기술통계(평균, 중앙값, 분산, 결측 비율), 상관행렬, 히트맵을 생성합니다.",
    input: "DataFrame 1개.",
    output: "기술통계표 + 상관계수 행렬 + 시각화. '결과 보기'로 모달에서 확인.",
  },
  [ModuleType.SelectData]: {
    title: "Select Data",
    category: "데이터 가공",
    role: "분석에 사용할 컬럼만 골라내고, 각 컬럼의 역할(피처/타깃/시간)이나 자료형(수치/범주)을 지정합니다.",
    input: "DataFrame 1개.",
    output: "선택된 컬럼만 남은 DataFrame + 컬럼 메타데이터.",
    parameters: "columnSelections: {컬럼명: {selected, type, role}}",
  },
  [ModuleType.DataFiltering]: {
    title: "Data Filtering",
    category: "데이터 가공",
    role: "조건식(>, <, ==, in, between 등)으로 행을 부분 추출합니다. AND/OR 결합 가능.",
    input: "DataFrame 1개.",
    output: "필터 조건을 통과한 행만 남은 DataFrame.",
  },
  [ModuleType.ColumnPlot]: {
    title: "Column Plot",
    category: "시각화",
    role: "단일 컬럼의 분포(히스토그램, KDE, 박스플롯)와 결측 패턴을 시각화합니다.",
    input: "DataFrame 1개 + 시각화할 컬럼명.",
    output: "PNG 이미지 + 컬럼 통계 요약.",
  },
  [ModuleType.OutlierDetector]: {
    title: "Outlier Detector",
    category: "데이터 품질",
    role: "IQR, Z-score, Isolation Forest 등으로 이상치를 탐지하고 표시/제거 옵션을 제공합니다.",
    input: "DataFrame 1개.",
    output: "이상치 플래그가 추가된 DataFrame + 이상치 통계 리포트.",
  },
  [ModuleType.HypothesisTesting]: {
    title: "Hypothesis Testing",
    category: "통계 검정",
    role: "t-검정, ANOVA, χ², Mann-Whitney 등 가설검정을 수행해 p-value와 효과크기를 산출합니다.",
    input: "DataFrame 1개 + 검정 대상 컬럼.",
    output: "검정 결과 테이블(statistic, p-value, 결론).",
  },
  [ModuleType.NormalityChecker]: {
    title: "Normality Checker",
    category: "데이터 품질",
    role: "Shapiro-Wilk, K-S, Anderson-Darling 검정 + Q-Q plot으로 정규성을 평가합니다.",
    input: "DataFrame 1개 + 평가 대상 컬럼.",
    output: "검정 결과 + Q-Q plot + 권장 변환(log, sqrt 등).",
  },
  [ModuleType.Correlation]: {
    title: "Correlation",
    category: "탐색적 분석",
    role: "Pearson/Spearman/Kendall 상관계수 행렬과 히트맵을 생성합니다.",
    input: "DataFrame 1개.",
    output: "상관행렬 + p-value + 히트맵.",
  },
  [ModuleType.HandleMissingValues]: {
    title: "Handle Missing Values",
    category: "데이터 전처리",
    role: "결측치를 평균/중앙값/최빈값으로 대체하거나, KNN/회귀 보간, 또는 행 삭제를 적용합니다.",
    input: "DataFrame 1개.",
    output: "결측 처리된 DataFrame + 처리 로그.",
  },
  [ModuleType.EncodeCategorical]: {
    title: "Encode Categorical",
    category: "데이터 전처리",
    role: "범주형 변수를 One-Hot, Label, Ordinal, Target Encoding 등으로 수치화합니다.",
    input: "DataFrame 1개.",
    output: "인코딩된 DataFrame + 인코더 매핑 정보(추론 시 재사용).",
  },
  [ModuleType.ScalingTransform]: {
    title: "Scaling Transform",
    category: "데이터 전처리",
    role: "수치형 변수를 MinMax / StandardScaler / RobustScaler로 변환합니다.",
    input: "DataFrame 1개.",
    output: "스케일링된 DataFrame + 스케일러 객체.",
    parameters: "method: MinMax(0~1) / StandardScaler(평균0,분산1) / RobustScaler(중앙값,IQR)",
  },
  [ModuleType.TransformData]: {
    title: "Transform Data",
    category: "데이터 전처리",
    role: "로그/제곱근/Box-Cox/Yeo-Johnson 등 분포 변환을 적용합니다.",
    input: "DataFrame 1개 + 변환할 컬럼.",
    output: "변환된 DataFrame.",
  },
  [ModuleType.SplitData]: {
    title: "Split Data",
    category: "데이터 가공",
    role: "데이터를 학습/검증/테스트로 분할합니다. 무작위, 층화, 시간기반 모드 지원.",
    input: "DataFrame 1개 + 타깃 컬럼(층화 시).",
    output: "X_train, X_test, y_train, y_test (또는 train/val/test 3분할).",
    parameters: "test_size, shuffle, stratify, random_state",
  },
  [ModuleType.Concat]: {
    title: "Concat",
    category: "데이터 가공",
    role: "동일 스키마 DataFrame 2개를 행(axis=0) 또는 열(axis=1) 방향으로 결합합니다.",
    input: "DataFrame 2개.",
    output: "결합된 DataFrame.",
  },
  [ModuleType.Join]: {
    title: "Join",
    category: "데이터 가공",
    role: "키 컬럼을 기준으로 두 DataFrame을 inner/left/right/outer 조인합니다.",
    input: "DataFrame 2개 + join key.",
    output: "조인된 DataFrame.",
  },
  [ModuleType.TransitionData]: {
    title: "Transition Data",
    category: "데이터 가공",
    role: "장형(long) ↔ 광형(wide) 변환(pivot/melt)을 수행합니다.",
    input: "DataFrame 1개.",
    output: "재구조화된 DataFrame.",
  },
  [ModuleType.ResampleData]: {
    title: "Resample Data",
    category: "데이터 가공",
    role: "시계열 데이터를 일/주/월 단위로 리샘플링하거나 클래스 불균형을 SMOTE/언더샘플링으로 보정합니다.",
    input: "DataFrame 1개.",
    output: "리샘플링된 DataFrame.",
  },

  // ===== Supervised Learning =====
  [ModuleType.LinearRegression]: {
    title: "Linear Regression",
    category: "지도학습 (회귀)",
    role: "연속형 타깃을 선형 결합으로 예측합니다. 해석성 우선 시 첫 베이스라인.",
    input: "X_train, y_train (SplitData 출력).",
    output: "학습된 모델 객체. EvaluateModel/PredictModel로 후속 연결.",
  },
  [ModuleType.LogisticRegression]: {
    title: "Logistic Regression",
    category: "지도학습 (분류)",
    role: "이진/다항 분류기. log-odds 해석 가능, 정규화(L1/L2) 지원.",
    input: "X_train, y_train.",
    output: "학습된 분류 모델.",
  },
  [ModuleType.PoissonRegression]: {
    title: "Poisson Regression",
    category: "지도학습 (카운트)",
    role: "건수 데이터(클레임 횟수, 사건 수) 예측. 평균=분산 가정.",
    input: "X_train, y_train(count) + exposure(option).",
    output: "학습된 GLM 모델.",
  },
  [ModuleType.NegativeBinomialRegression]: {
    title: "Negative Binomial Regression",
    category: "지도학습 (카운트)",
    role: "과대분산 카운트 데이터에 사용. Poisson보다 분산 모수가 자유로움.",
    input: "X_train, y_train(count).",
    output: "학습된 NB GLM 모델.",
  },
  [ModuleType.DecisionTree]: {
    title: "Decision Tree",
    category: "지도학습",
    role: "단일 의사결정 트리. 시각화/해석성 강점, 단일 트리는 과적합 경향.",
    input: "X_train, y_train.",
    output: "학습된 트리 모델 + 시각화.",
  },
  [ModuleType.RandomForest]: {
    title: "Random Forest",
    category: "지도학습 (앙상블)",
    role: "다수 트리의 평균/투표. 강건한 일반화 + feature importance.",
    input: "X_train, y_train.",
    output: "학습된 RF 모델 + 변수중요도.",
  },
  [ModuleType.NeuralNetwork]: {
    title: "Neural Network",
    category: "지도학습",
    role: "다층 퍼셉트론(MLP). 비선형/복잡 패턴 학습.",
    input: "X_train, y_train.",
    output: "학습된 NN 모델.",
  },
  [ModuleType.SVM]: {
    title: "Support Vector Machine",
    category: "지도학습",
    role: "마진 최대화 기반 분류/회귀. 커널로 비선형 확장.",
    input: "X_train, y_train.",
    output: "학습된 SVM 모델.",
  },
  [ModuleType.LDA]: {
    title: "Linear Discriminant Analysis",
    category: "지도학습 (분류)",
    role: "클래스별 공분산이 같다는 가정 하에 선형 결정경계 학습 + 차원축소.",
    input: "X_train, y_train.",
    output: "학습된 LDA 모델 + 변환 행렬.",
  },
  [ModuleType.NaiveBayes]: {
    title: "Naive Bayes",
    category: "지도학습 (분류)",
    role: "독립 가정 기반 베이즈 분류. 텍스트/희소 데이터에 강함.",
    input: "X_train, y_train.",
    output: "학습된 NB 모델.",
  },
  [ModuleType.KNN]: {
    title: "K-Nearest Neighbors",
    category: "지도학습",
    role: "가까운 K개 이웃의 다수결/평균으로 예측. 학습 없음, 추론 비용 높음.",
    input: "X_train, y_train + 거리 척도.",
    output: "학습 데이터를 보유한 KNN 모델.",
  },

  // ===== Model Operations =====
  [ModuleType.TrainModel]: {
    title: "Train Model",
    category: "모델 연산",
    role: "별도 학습 모듈 없이 모델+데이터를 받아 fit을 실행합니다.",
    input: "모델 객체 + X_train, y_train.",
    output: "학습된 모델.",
  },
  [ModuleType.ScoreModel]: {
    title: "Score Model",
    category: "모델 연산",
    role: "학습된 모델로 새 데이터의 예측값/확률을 계산합니다.",
    input: "학습된 모델 + X_test (또는 신규 데이터).",
    output: "예측 결과 DataFrame (예측치 + 확률).",
  },
  [ModuleType.EvaluateModel]: {
    title: "Evaluate Model",
    category: "모델 연산",
    role: "분류는 Accuracy/Precision/Recall/F1/AUC, 회귀는 MSE/RMSE/MAE/R² 등을 산출합니다.",
    input: "예측 결과 + 실제값(y_test).",
    output: "지표 표 + 혼동행렬 / 잔차 plot.",
  },

  // ===== Unsupervised =====
  [ModuleType.KMeans]: {
    title: "K-Means Clustering",
    category: "비지도학습",
    role: "K개 중심으로 데이터를 군집화. Elbow/Silhouette로 K 선택.",
    input: "DataFrame (수치형, 스케일링 권장).",
    output: "각 행의 cluster label + centroid.",
  },
  [ModuleType.PCA]: {
    title: "Principal Component Analysis",
    category: "비지도학습 (차원축소)",
    role: "분산 최대 방향으로 직교 변환. 시각화/잡음 제거/특성 추출에 활용.",
    input: "DataFrame (수치형).",
    output: "주성분 점수 + 설명분산 비율 + loading.",
  },
  [ModuleType.TrainClusteringModel]: {
    title: "Train Clustering Model",
    category: "비지도학습",
    role: "클러스터링 알고리즘을 학습 데이터에 맞춥니다.",
    input: "DataFrame + 알고리즘 선택.",
    output: "학습된 클러스터링 모델.",
  },
  [ModuleType.ClusteringData]: {
    title: "Clustering Data",
    category: "비지도학습",
    role: "학습된 클러스터링 모델로 데이터에 클러스터 레이블을 부여합니다.",
    input: "DataFrame + 학습된 클러스터링 모델.",
    output: "cluster 레이블이 추가된 DataFrame.",
  },

  // ===== Stat Models (Traditional) =====
  [ModuleType.StatModels]: {
    title: "Stat Models",
    category: "전통 통계 모델",
    role: "OLS/Logit/Poisson/NB/Gamma/Tweedie GLM을 statsmodels로 적합. 계수 신뢰구간/p-value 산출.",
    input: "X_train, y_train.",
    output: "적합된 모델 + 계수표.",
    parameters: "model: OLS / Logit / Poisson / NegativeBinomial / Gamma / Tweedie",
  },
  [ModuleType.OLSModel]: {
    title: "OLS Model",
    category: "전통 통계 모델",
    role: "최소제곱 선형회귀. 계수, t-stat, p-value, R² 산출.",
    input: "DataFrame + 종속·독립 변수 지정.",
    output: "statsmodels OLS 적합 결과.",
  },
  [ModuleType.LogisticModel]: {
    title: "Logistic Model",
    category: "전통 통계 모델",
    role: "이진 로지스틱 GLM. odds ratio, Wald p-value 산출.",
    input: "DataFrame + 이진 종속 변수.",
    output: "Logit 적합 결과.",
  },
  [ModuleType.PoissonModel]: {
    title: "Poisson Model",
    category: "전통 통계 모델",
    role: "Poisson GLM. 카운트 데이터 + offset(노출량) 지원.",
    input: "DataFrame + count 종속 변수 (+ offset).",
    output: "Poisson 적합 결과.",
  },
  [ModuleType.QuasiPoissonModel]: {
    title: "Quasi-Poisson Model",
    category: "전통 통계 모델",
    role: "과대분산 보정 Poisson. 분산이 평균의 상수배라고 가정.",
    input: "DataFrame + count 종속.",
    output: "QP 적합 결과.",
  },
  [ModuleType.NegativeBinomialModel]: {
    title: "Negative Binomial Model",
    category: "전통 통계 모델",
    role: "NB GLM. 과대분산 카운트에 적합 (α 자유 추정).",
    input: "DataFrame + count 종속.",
    output: "NB 적합 결과.",
  },
  [ModuleType.DiversionChecker]: {
    title: "Diversion Checker",
    category: "데이터 품질",
    role: "두 데이터셋의 분포 차이(KS, PSI, Wasserstein 등)를 비교해 drift를 진단합니다.",
    input: "DataFrame 2개 (예: train vs prod).",
    output: "컬럼별 drift 점수 + 위험 등급.",
  },
  [ModuleType.EvaluateStat]: {
    title: "Evaluate Stat",
    category: "모델 연산",
    role: "전통 통계 모델의 적합도(AIC, BIC, deviance, pseudo-R²) 및 잔차 진단을 수행합니다.",
    input: "적합된 statsmodels 결과.",
    output: "적합도 지표 + 잔차 plot.",
  },
  [ModuleType.VIFChecker]: {
    title: "VIF Checker",
    category: "데이터 품질",
    role: "Variance Inflation Factor로 다중공선성을 진단합니다. 통상 VIF>10이면 위험.",
    input: "DataFrame (수치형).",
    output: "변수별 VIF 표.",
  },

  // ===== Result / Predict =====
  [ModuleType.ResultModel]: {
    title: "Result Model",
    category: "출력",
    role: "최종 결과를 모아 표/그래프로 시각화하는 출력 컨테이너.",
    input: "모델/평가/데이터 등 다양한 업스트림.",
    output: "통합 결과 뷰.",
  },
  [ModuleType.PredictModel]: {
    title: "Predict Model",
    category: "모델 연산",
    role: "학습된 모델 + 신규 데이터로 예측 + 위험 카테고리 분류.",
    input: "학습된 모델 + 신규 X.",
    output: "예측값 + 위험 등급.",
  },

  // ===== Mortality =====
  [ModuleType.MortalityResult]: {
    title: "Mortality Result",
    category: "사망률 모델",
    role: "사망률 모델 적합 결과를 표·그래프로 종합합니다.",
    input: "사망률 모델 객체.",
    output: "예측 사망률 + life table.",
  },
  [ModuleType.LeeCarterModel]: {
    title: "Lee-Carter Model",
    category: "사망률 모델",
    role: "Lee-Carter 분해(age + period factor)로 로그 사망률을 모델링.",
    input: "연령×연도 사망률 행렬.",
    output: "ax, bx, kt 추정치 + 예측.",
  },
  [ModuleType.CBDModel]: {
    title: "CBD Model",
    category: "사망률 모델",
    role: "Cairns-Blake-Dowd 2-factor 모델. 고령층 사망률에 강점.",
    input: "logit 변환 사망률.",
    output: "두 시계열 요인 + 예측.",
  },
  [ModuleType.APCModel]: {
    title: "APC Model",
    category: "사망률 모델",
    role: "Age-Period-Cohort 모델. 코호트 효과 분리.",
    input: "연령×연도 사망률.",
    output: "APC 분해 + 예측.",
  },
  [ModuleType.RHModel]: {
    title: "RH Model",
    category: "사망률 모델",
    role: "Renshaw-Haberman: Lee-Carter + cohort term.",
    input: "연령×연도 사망률.",
    output: "RH 적합 + 예측.",
  },
  [ModuleType.PlatModel]: {
    title: "Plat Model",
    category: "사망률 모델",
    role: "Plat 모델: 다요인 사망률 모델.",
    input: "연령×연도 사망률.",
    output: "Plat 적합 + 예측.",
  },
  [ModuleType.PSplineModel]: {
    title: "P-Spline Model",
    category: "사망률 모델",
    role: "Penalized spline으로 사망률 곡면을 매끄럽게 적합.",
    input: "연령×연도 사망률.",
    output: "스무딩된 곡면 + 예측.",
  },

  // ===== Freq-Sev Simulation =====
  [ModuleType.SimulateFreqSevTable]: {
    title: "Simulate Freq-Sev Table",
    category: "손해 시뮬레이션",
    role: "빈도(Frequency) × 심도(Severity) 가정으로 손해 시뮬레이션 테이블 생성.",
    input: "빈도/심도 분포 파라미터.",
    output: "시뮬레이션된 손해 분포 테이블.",
  },
  [ModuleType.CombineLossModel]: {
    title: "Combine Loss Model",
    category: "손해 시뮬레이션",
    role: "여러 손해 모델을 결합해 종합 손해 분포를 산출.",
    input: "복수 손해 모델.",
    output: "통합 손해 분포 + VaR/TVaR.",
  },

  // ===== JMDC Analysis (PRD v2.0 §17, J1~J7) - 상세 =====
  [ModuleType.JMDCCohortBuilder]: {
    title: "[J1] JMDC Cohort Builder",
    category: "JMDC 분석",
    role:
      "분석 코호트를 정의하는 첫 단계 모듈입니다. Index Date 규칙(생일+나이/등록시점/고정일자)을 적용해 각 가입자의 분석 시점을 지정하고, washout 기간·연령창·기왕증 제외 조건으로 funnel을 거쳐 최종 분석 대상을 산출합니다.",
    input:
      "(A) 'synthetic' 모드: 모듈이 가상의 코호트를 자체 생성. (B) 'csv' 모드: 업스트림 LoadData로 받은 DataFrame. 필요 컬럼: member_id, sex_code, birth_date, first_obs_date, last_obs_date, bmi, has_diabetes, has_htn, charlson.",
    output:
      "코호트 DataFrame (member_id, index_date, age_at_index, sex_code, age_band, bmi, has_diabetes, has_htn, charlson, first_obs_date, last_obs_date) + funnel 추적 표 + 성별/연령대 분포 + claims_disease 페이로드(J2가 사용).",
    parameters:
      "data_source(synthetic/csv) · index_date_rule(birthday_age/enrollment_date/fixed_date) · index_age · washout_years · age_at_index_min/max · exclusion_diseases(ICD-10 prefix list) · disease_free_years",
    notes: "PRD v2.0 §17.2. 실행: utils/pyodideRunner.ts의 performJMDCCohort.",
  },
  [ModuleType.JMDCOutcomeLabeler]: {
    title: "[J2] JMDC Outcome Labeler",
    category: "JMDC 분석",
    role:
      "J1 코호트의 각 가입자에 대해 outcome(질병 발생, 사망 등) event 시점과 검열 시점을 산출합니다. 시간-사건 분석(KM, Cox)에 필요한 (time, event) 페어를 만듭니다.",
    input:
      "데이터 1: J1 코호트 (member_id, index_date, last_obs_date 필수). 데이터 2: claims_disease (member_id, icd10_code, onset_date, suspect_flag). multi_outcome_mode='long'이면 outcome×member 카르테시안, 'single'이면 가장 빠른 event 채택.",
    output:
      "코호트 행 + outcome_type, first_event_date, time_to_event_days, event_flag(0/1), censor_reason(event/lost_followup/admin_censor) + eventSummary + outcomeBreakdown(label별 event 수·발생률).",
    parameters:
      "outcome_diseases({label: [ICD10 prefix]}) · outcome_window_years · confirm_suspect_flag · multi_outcome_mode(single/long)",
    notes: "PRD v2.0 §17.2. 실행: performJMDCOutcomeLabeler.",
  },
  [ModuleType.JMDCIncidenceRate]: {
    title: "[J3] JMDC Incidence Rate",
    category: "JMDC 분석",
    role:
      "Person-years 분모 기반 조발생률과 직접/간접 연령표준화 발생률(ASR/SIR)을 산출합니다. Byar 근사로 95% 신뢰구간 포함.",
    input: "J2 출력(event_flag, time_to_event_days, 인구통계 컬럼).",
    output:
      "층화(전체/성별/연령대/성별×연령대)별 events·PY·crude rate·표준화 rate·95% CI 표 + 시각화용 누적 카운트.",
    parameters:
      "stratify_by(none/sex/age_band/sex_age) · standard_population(internal/WHO_2000/japan_2015/korea_2020) · rate_unit(1000_PY/10000_PY/100000_PY) · time_grid_years",
    notes: "PRD v2.0 §17.2. 실행: performJMDCIncidenceRate.",
  },
  [ModuleType.JMDCSurvivalCompare]: {
    title: "[J4] JMDC Survival Compare",
    category: "JMDC 분석",
    role:
      "Kaplan-Meier 생존곡선과 log-rank(또는 stratified log-rank) 검정으로 2개 이상 군의 생존 차이를 비교합니다.",
    input:
      "J2 출력(event_flag, time_to_event_days) + 군 구분 컬럼(예: 당뇨 vs 비당뇨, 성별, 위험계층).",
    output:
      "군별 KM 곡선 좌표 + 1/3/5y 시점 생존확률 + 중위 생존시간 + log-rank χ², p-value + Hazard Ratio(단순).",
    parameters:
      "group_col · time_horizons_years(예: [1,3,5]) · logrank_method(standard/stratified) · stratify_cols",
    notes:
      "lifelines 패키지 필요. Pyodide에서 첫 실행 시 자동 설치. PRD v2.0 §17.2.",
  },
  [ModuleType.JMDCCumulativeIncidence]: {
    title: "[J5] JMDC Cumulative Incidence",
    category: "JMDC 분석",
    role:
      "누적 발생 함수를 산출. 경쟁위험이 있을 때는 Aalen-Johansen 추정량, 단일 사건은 1-KM 사용.",
    input: "J2 출력(이벤트 컬럼 + 경쟁위험 컬럼).",
    output: "시간 grid별 CIF 곡선 + bootstrap 신뢰구간 + 군별 비교.",
    parameters:
      "event_col · competing_event_cols · group_col · time_grid_years · bootstrap_n",
    notes: "PRD v2.0 §17.2.",
  },
  [ModuleType.JMDCRiskStratification]: {
    title: "[J6] JMDC Risk Stratification (Cox PH)",
    category: "JMDC 분석",
    role:
      "Cox 비례위험모델로 공변량 보정 Hazard Ratio를 산출합니다. PH 가정(Schoenfeld 잔차) 검정 포함.",
    input:
      "J2 출력 + 노출(exposure) 컬럼 + 공변량 리스트(연령, 성별, BMI, charlson 등).",
    output:
      "HR 표(점추정·95% CI·p-value) + PH 위반 컬럼 표시 + 학습된 Cox 모델(다음 ScoreModel에서 재사용 가능).",
    parameters:
      "exposure_col · covariates · stratify_col · proportional_hazards_test · tie_method(efron/breslow)",
    notes: "lifelines.CoxPHFitter 사용. PRD v2.0 §17.2.",
  },
  [ModuleType.JMDCKRJPMatcher]: {
    title: "[J7] JMDC KR-JP Matcher",
    category: "JMDC 분석",
    role:
      "한·일 코호트 비교를 위한 4-Layer 매칭 프로토콜(L1 스키마 정렬 · L2 어휘 매핑 · L3 표준화 · L4 PSM)을 일괄 수행합니다.",
    input:
      "데이터 1: JP 코호트(J1+J2). 데이터 2: KR 코호트(동일 스키마). 필수 컬럼: 인구통계, outcome.",
    output:
      "매칭 전후 SMD 표 + 표준화 발생률 비교 + SIR(Byar) + KM overlay + PSM 매칭 페어 ID.",
    parameters:
      "apply_schema_alignment · apply_vocab_mapping · apply_standardization(none/direct/indirect_sir) · standard_population · apply_psm · psm_covariates · caliper · comparison_outcome",
    notes: "PRD v2.0 §18 (4-Layer L1~L4). 실행: performJMDCMatcher.",
  },
};
