// fix: Removed erroneous import of ModuleType from './App' to resolve circular dependency and declaration merge errors.
export enum ModuleType {
  LoadData = "LoadData",
  Statistics = "Statistics", // New module type
  SelectData = "SelectData",
  DataFiltering = "DataFiltering",
  ColumnPlot = "ColumnPlot",
  OutlierDetector = "OutlierDetector",
  HypothesisTesting = "HypothesisTesting",
  NormalityChecker = "NormalityChecker",
  Correlation = "Correlation",
  HandleMissingValues = "HandleMissingValues",
  TransformData = "TransformData",
  EncodeCategorical = "EncodeCategorical",
  ScalingTransform = "ScalingTransform",
  TransitionData = "TransitionData",
  ResampleData = "ResampleData",
  SplitData = "SplitData",
  Join = "Join",
  Concat = "Concat",

  // Supervised Learning Models
  LinearRegression = "LinearRegression",
  LogisticRegression = "LogisticRegression",
  PoissonRegression = "PoissonRegression",
  NegativeBinomialRegression = "NegativeBinomialRegression",
  DecisionTree = "DecisionTree",
  RandomForest = "RandomForest",
  NeuralNetwork = "NeuralNetwork",
  SVM = "SVM",
  LDA = "LDA",
  NaiveBayes = "NaiveBayes",
  KNN = "KNN",

  // Model Operations
  TrainModel = "TrainModel",
  ScoreModel = "ScoreModel",
  EvaluateModel = "EvaluateModel",

  // Unsupervised Learning
  KMeans = "KMeans",
  PCA = "PCA",
  // 별칭: App.tsx/PropertiesPanel/ComponentRenderer/constants(DEFAULT_MODULES)가
  // PrincipalComponentAnalysis를 참조한다. 동일 값("PCA") 별칭 멤버로 정합성을 맞춰
  // 죽어있던 PCA 분기가 실제 PCA 모듈(type "PCA")과 매칭되도록 한다.
  PrincipalComponentAnalysis = "PCA",
  DBSCAN = "DBSCAN",
  HierarchicalClustering = "HierarchicalClustering",

  // Clustering Operations
  TrainClusteringModel = "TrainClusteringModel",
  ClusteringData = "ClusteringData",

  // Legacy/StatModels - Keeping for now
  StatModels = "StatModels",
  ResultModel = "ResultModel",
  PredictModel = "PredictModel",

  // Traditional Analysis - Statistical Models
  OLSModel = "OLSModel",
  LogisticModel = "LogisticModel",
  PoissonModel = "PoissonModel",
  QuasiPoissonModel = "QuasiPoissonModel",
  NegativeBinomialModel = "NegativeBinomialModel",
  DiversionChecker = "DiversionChecker",
  EvaluateStat = "EvaluateStat",
  VIFChecker = "VIFChecker",

  // Advanced Models - Mortality Models
  MortalityResult = "MortalityResult",
  LeeCarterModel = "LeeCarterModel",
  CBDModel = "CBDModel",
  APCModel = "APCModel",
  RHModel = "RHModel",
  PlatModel = "PlatModel",
  PSplineModel = "PSplineModel",

  // Frequency-Severity Simulation Models
  SimulateFreqSevTable = "SimulateFreqSevTable",
  CombineLossModel = "CombineLossModel",

  // Deprecating these
  LogisticTradition = "LogisticTradition",

  // JMDC Analysis (PRD v2.0 §17, J1~J7)
  JMDCCohortBuilder = "JMDCCohortBuilder",
  JMDCOutcomeLabeler = "JMDCOutcomeLabeler",
  JMDCIncidenceRate = "JMDCIncidenceRate",
  JMDCSurvivalCompare = "JMDCSurvivalCompare",
  JMDCCumulativeIncidence = "JMDCCumulativeIncidence",
  JMDCRiskStratification = "JMDCRiskStratification",
  JMDCKRJPMatcher = "JMDCKRJPMatcher",

  // Shape Types
  TextBox = "TextBox",
  GroupBox = "GroupBox",
}

export enum ModuleStatus {
  Pending = "Pending",
  Running = "Running",
  Success = "Success",
  Error = "Error",
}

export interface Port {
  name: string;
  type: "data" | "model" | "evaluation" | "handler";
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface DataPreview {
  type: "DataPreview"; // Differentiator
  columns: ColumnInfo[];
  totalRowCount: number;
  rows?: Record<string, any>[];
}

// Types for the new Statistics module output
export interface DescriptiveStats {
  [columnName: string]: {
    count: number;
    mean: number;
    std: number;
    min: number;
    "25%": number;
    "50%": number; // median
    "75%": number;
    max: number;
    variance: number;
    nulls: number;
    mode: number | string;
    skewness: number;
    kurtosis: number;
    nonNullCount: number; // Non-Null count (same as count, for info() compatibility)
    dtype: string; // Data type (e.g., 'int64', 'float64', 'object')
  };
}

export interface CorrelationMatrix {
  [column1: string]: {
    [column2: string]: number;
  };
}

export interface StatisticsOutput {
  type: "StatisticsOutput"; // Differentiator
  stats: DescriptiveStats;
  correlation: CorrelationMatrix;
  columns: ColumnInfo[]; // Keep original column info
}

export interface SplitDataOutput {
  type: "SplitDataOutput";
  train: DataPreview;
  test: DataPreview;
}

export interface JoinOutput {
  type: "JoinOutput";
  rows: any[];
  columns: Array<{ name: string; type: string }>;
}

export interface ConcatOutput {
  type: "ConcatOutput";
  rows: any[];
  columns: Array<{ name: string; type: string }>;
}

export interface TuningCandidateScore {
  params: Record<string, number>;
  score: number;
}

export interface TuningSummary {
  enabled: boolean;
  strategy?: "grid";
  bestParams?: Record<string, number>;
  bestScore?: number;
  scoringMetric?: string;
  candidates?: TuningCandidateScore[];
}

export interface TrainedModelOutput {
  type: "TrainedModelOutput";
  modelType: ModuleType;
  modelPurpose?: "classification" | "regression";
  coefficients: Record<string, number>;
  intercept: number;
  metrics: Record<string, number>;
  featureColumns: string[];
  labelColumn: string;
  tuningSummary?: TuningSummary;
  statsModelsResult?: StatsModelsResultOutput; // statsmodels 결과 (포아송/음이항 회귀용)
  trainingData?: Record<string, any>[]; // Decision Tree plot 생성을 위한 훈련 데이터
  modelParameters?: {
    // Decision Tree plot 생성을 위한 모델 파라미터
    criterion?: string;
    maxDepth?: number | null;
    minSamplesSplit?: number;
    minSamplesLeaf?: number;
    classWeight?: string | null;
  };
}

export type StatsModelFamily =
  | "OLS"
  | "Logistic"
  | "Poisson"
  | "NegativeBinomial"
  | "Gamma"
  | "Tweedie";

export interface ModelDefinitionOutput {
  type: "ModelDefinitionOutput";
  modelFamily: "statsmodels";
  modelType: StatsModelFamily;
  parameters: Record<string, any>;
}

export interface StatsModelsResultOutput {
  type: "StatsModelsResultOutput";
  modelType: StatsModelFamily;
  summary: {
    coefficients: Record<
      string,
      {
        coef: number;
        "std err": number;
        t?: number;
        z?: number;
        "P>|t|"?: number;
        "P>|z|"?: number;
        "[0.025": number;
        "0.975]": number;
      }
    >;
    metrics: Record<string, string | number>;
  };
  featureColumns: string[];
  labelColumn: string;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface ThresholdMetric {
  threshold: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface EvaluationOutput {
  type: "EvaluationOutput";
  modelType: "classification" | "regression";
  metrics: Record<string, number | string>;
  confusionMatrix?: ConfusionMatrix;
  threshold?: number;
  thresholdMetrics?: ThresholdMetric[]; // 여러 threshold에 대한 precision/recall
}

// --- New Unsupervised Learning Outputs ---
export interface KMeansOutput {
  type: "KMeansOutput";
  clusterAssignments: DataPreview; // Data with an added 'cluster' column
  centroids: Record<string, number>[];
  model: any; // To hold inertia_ or other model properties
}

export interface PCAOutput {
  type: "PCAOutput";
  transformedData: DataPreview;
  explainedVarianceRatio: number[];
}

// --- Clustering Model Outputs ---
export interface TrainedClusteringModelOutput {
  type: "TrainedClusteringModelOutput";
  modelType: ModuleType; // KMeans or PrincipalComponentAnalysis
  featureColumns: string[];
  model: any; // The trained clustering model
  // For K-Means
  centroids?: Record<string, number>[];
  inertia?: number;
  // For PCA
  components?: number[][];
  explainedVarianceRatio?: number[];
  mean?: number[];
}

export interface ClusteringDataOutput {
  type: "ClusteringDataOutput";
  clusteredData: DataPreview; // Data with cluster assignments or PCA transformed data
  modelType: ModuleType;
}

export interface MissingHandlerOutput {
  type: "MissingHandlerOutput";
  method: "remove_row" | "impute" | "knn";
  // For impute
  strategy?: "mean" | "median" | "mode";
  // For KNN
  n_neighbors?: number;
  metric?: string;
  // For all methods that are not row removal, we need the values computed from the training set
  imputation_values: Record<string, number | string>; // e.g. { 'Age': 29.5, 'Embarked': 'S' }
}

export interface EncoderOutput {
  type: "EncoderOutput";
  method: "label" | "one_hot" | "ordinal";
  mappings: Record<string, Record<string, number> | string[]>;
  columns_to_encode: string[];
  // one-hot params that are passed through
  drop?: "first" | "if_binary" | null;
  handle_unknown?: "error" | "ignore";
}

export interface NormalizerOutput {
  type: "NormalizerOutput";
  method: "MinMax" | "StandardScaler" | "RobustScaler";
  stats: Record<
    string,
    {
      min?: number;
      max?: number;
      mean?: number;
      stdDev?: number;
      median?: number;
      iqr?: number;
    }
  >;
}

export interface ColumnPlotOutput {
  type: "ColumnPlotOutput";
  plot_type: "single" | "double";
  column1: string;
  column2?: string;
  column1Type: "number" | "string";
  column2Type?: "number" | "string";
  availableCharts: string[];
  selectedChart?: string;
  imageBase64?: string; // 차트 이미지 (base64)
}

export interface OutlierResult {
  method: "IQR" | "ZScore" | "IsolationForest" | "Boxplot";
  outlierIndices: number[]; // 이상치로 탐지된 행 인덱스
  outlierCount: number;
  outlierPercentage: number;
  details?: Record<string, any>; // 방법별 상세 정보
}

export interface ColumnOutlierResult {
  column: string;
  results: OutlierResult[]; // 각 방법별 결과
  totalOutliers: number; // 모든 방법에서 탐지된 총 이상치 수 (중복 제거)
  outlierIndices: number[]; // 모든 방법에서 탐지된 이상치 인덱스 (중복 제거)
}

export interface OutlierDetectorOutput {
  type: "OutlierDetectorOutput";
  columns: string[]; // 분석된 열 목록
  columnResults: ColumnOutlierResult[]; // 각 열별 결과
  totalOutliers: number; // 모든 열에서 탐지된 총 이상치 수 (중복 제거)
  allOutlierIndices: number[]; // 모든 열에서 탐지된 이상치 인덱스 (중복 제거)
  cleanedData?: Record<string, any>[]; // 이상치 제거된 데이터 (선택적)
  originalData?: Record<string, any>[]; // 원본 데이터 (제거 작업을 위해 필요)
}

export type HypothesisTestType =
  | "t_test_one_sample"
  | "t_test_independent"
  | "t_test_paired"
  | "chi_square"
  | "anova"
  | "ks_test"
  | "shapiro_wilk"
  | "levene";

export interface HypothesisTestResult {
  testType: HypothesisTestType;
  testName: string;
  columns: string[]; // 사용된 열
  statistic?: number; // 검정 통계량
  pValue?: number; // p-value
  degreesOfFreedom?: number | number[]; // 자유도
  criticalValue?: number; // 임계값
  conclusion?: string; // 결론 (예: "Reject H0", "Fail to reject H0")
  interpretation?: string; // 해석
  details?: Record<string, any>; // 검정별 상세 정보
}

export interface HypothesisTestingOutput {
  type: "HypothesisTestingOutput";
  results: HypothesisTestResult[]; // 각 검정별 결과
}

export interface CorrelationMatrix {
  method: "pearson" | "spearman" | "kendall" | "cramers_v";
  matrix: Record<string, Record<string, number>>; // 상관계수 행렬
  columns: string[]; // 분석된 열 목록
}

export interface CorrelationOutput {
  type: "CorrelationOutput";
  columns: string[]; // 분석된 열 목록
  numericColumns: string[]; // 숫자형 열
  categoricalColumns: string[]; // 범주형 열
  correlationMatrices: CorrelationMatrix[]; // 각 방법별 상관계수 행렬
  heatmapImage?: string; // Heatmap 이미지 (base64)
  pairplotImage?: string; // Pairplot 이미지 (base64)
  summary?: Record<string, any>; // 요약 통계
}

export interface VIFCheckerOutput {
  type: "VIFCheckerOutput";
  results: Array<{
    column: string;
    vif: number;
  }>;
}

export type NormalityTestType =
  | "shapiro_wilk"
  | "kolmogorov_smirnov"
  | "anderson_darling"
  | "dagostino_k2";

export interface NormalityTestResult {
  testType: NormalityTestType;
  testName: string;
  statistic?: number;
  pValue?: number;
  criticalValue?: number;
  conclusion?: string; // "Reject H0" or "Fail to reject H0"
  interpretation?: string;
  details?: Record<string, any>;
}

export interface NormalityCheckerOutput {
  type: "NormalityCheckerOutput";
  column: string; // 분석된 열
  skewness: number;
  kurtosis: number;
  jarqueBera: {
    statistic: number;
    pValue: number;
    conclusion: string;
  };
  testResults: NormalityTestResult[]; // 선택된 검정 방법별 결과
  histogramImage?: string; // Histogram + Normal Curve Overlay (base64)
  qqPlotImage?: string; // QQ-Plot (base64)
  ecdfImage?: string; // ECDF vs Normal CDF (base64)
  boxplotImage?: string; // Boxplot (base64)
}

export interface MortalityModelOutput {
  type: "MortalityModelOutput";
  modelType: "LeeCarter" | "CBD" | "APC" | "RH" | "Plat" | "PSpline";
  a_x?: Record<string, number>; // 연령별 파라미터
  b_x?: Record<string, number>; // 연령별 파라미터
  k_t?: Record<string, number>; // 연도별 파라미터
  beta?: Record<string, number>; // CBD 모델용
  kappa_1?: Record<string, number>; // CBD 모델용
  kappa_2?: Record<string, number>; // CBD 모델용
  gamma_c?: Record<string, number>; // APC/RH 모델용
  b_x_1?: Record<string, number>; // RH 모델용
  b_x_2?: Record<string, number>; // RH 모델용
  k_t_1?: Record<string, number>; // RH 모델용
  k_t_2?: Record<string, number>; // RH 모델용
  mortality_matrix: Record<string, Record<string, number>>;
  predicted_mortality: Record<string, Record<string, number>>;
  mse: number;
  mae: number;
  ages: number[];
  years: number[];
  forecast_years?: number[];
  forecast_mortality?: Record<string, Record<string, number>>;
}

export interface MortalityResultOutput {
  type: "MortalityResultOutput";
  models: Array<{
    modelType: string;
    mse: number;
    mae: number;
    aic?: number;
    bic?: number;
  }>;
  comparison: {
    best_model: string;
    metrics_comparison: Record<string, Record<string, number>>;
  };
  visualizations: {
    mortality_curves?: string; // base64 이미지
    forecast_comparison?: string; // base64 이미지
    parameter_comparison?: string; // base64 이미지
  };
}

// =====================================================================
// JMDC Analysis Outputs (PRD v2.0 §17, J1~J7)
// =====================================================================

export interface JMDCCohortStep {
  step: string;
  remaining: number;
}

export interface JMDCCohortOutput {
  type: "JMDCCohortOutput";
  rows: Record<string, any>[];
  columns: ColumnInfo[];
  totalRowCount: number;
  funnel: JMDCCohortStep[];
  sexDistribution: Record<string, number>;
  ageBandDistribution: Record<string, number>;
  exclusionReasons: Record<string, number>;
  dataSource: "synthetic" | "supabase" | "csv";
  parameters: Record<string, any>;
}

// J2 출력은 labeled cohort dataframe — DataPreview처럼 다음 모듈에 전달.
// 별도 PreviewModal 대신 JMDCSurvivalPreviewModal과 공유.
export interface JMDCOutcomeOutput {
  type: "JMDCOutcomeOutput";
  rows: Record<string, any>[];
  columns: ColumnInfo[];
  totalRowCount: number;
  eventSummary: {
    total: number;
    events: number;
    censored: number;
    censorReasons: Record<string, number>;
  };
  outcomeBreakdown: Record<string, { events: number; rate: number }>;
}

export interface JMDCIncidenceStratumRow {
  stratum: string;
  N: number;
  person_years: number;
  events: number;
  crude_rate: number;
  crude_ci_lo: number;
  crude_ci_hi: number;
  std_rate?: number;
  std_ci_lo?: number;
  std_ci_hi?: number;
}

export interface JMDCIncidenceOutput {
  type: "JMDCIncidenceOutput";
  rateTable: JMDCIncidenceStratumRow[];
  cifGrid: Array<{ stratum: string; t_years: number; cif: number; ci_lo: number; ci_hi: number }>;
  rateUnit: string;
  standardPopulation: string;
  stratifyBy: string;
}

export interface JMDCSurvivalGroupStats {
  group: string;
  N: number;
  events: number;
  median_survival: number | null;
  cum_inc_1y: number | null;
  cum_inc_3y: number | null;
  cum_inc_5y: number | null;
}

export interface JMDCSurvivalOutput {
  type: "JMDCSurvivalOutput";
  mode: "km" | "cif";
  curves: Array<{ group: string; t_years: number[]; survival: number[]; ci_lo: number[]; ci_hi: number[] }>;
  groupStats: JMDCSurvivalGroupStats[];
  logrankP: number | null;
  stratifiedLogrankP: number | null;
  groupCol?: string;
  competingEventCols?: string[];
}

export interface JMDCCoxHrRow {
  variable: string;
  hr: number;
  hr_ci_lo: number;
  hr_ci_hi: number;
  p_value: number;
  ph_test_p?: number | null;
}

export interface JMDCCoxOutput {
  type: "JMDCCoxOutput";
  hrTable: JMDCCoxHrRow[];
  concordance?: number | null;
  logLikelihood?: number | null;
  exposureCol: string;
  covariates: string[];
  phWarnings: string[];
  schoenfeldImage?: string;
}

export interface JMDCMatcherSmdRow {
  variable: string;
  smd_before: number;
  smd_after: number;
}

export interface JMDCMatcherRateRow {
  outcome: string;
  jp_raw: number;
  jp_std: number;
  kr_raw: number;
  kr_std: number;
  ratio: number;
  ratio_ci_lo: number;
  ratio_ci_hi: number;
}

export interface JMDCMatcherSirRow {
  outcome: string;
  observed: number;
  expected: number;
  sir: number;
  sir_ci_lo: number;
  sir_ci_hi: number;
}

export interface JMDCMatcherOutput {
  type: "JMDCMatcherOutput";
  smdTable: JMDCMatcherSmdRow[];
  rateTable: JMDCMatcherRateRow[];
  sirTable: JMDCMatcherSirRow[];
  kmOverlay: Array<{ country: "JP" | "KR"; group: string; t_years: number[]; survival: number[] }>;
  mappingVersion: string;
  applied: {
    schema_alignment: boolean;
    vocab_mapping: boolean;
    standardization: "none" | "direct" | "indirect_sir";
    psm: boolean;
  };
}

// =====================================================================

export interface CanvasModule {
  id: string;
  name: string;
  type: ModuleType;
  position: { x: number; y: number };
  status: ModuleStatus;
  parameters: Record<string, any>;
  inputs: Port[];
  outputs: Port[];
  outputData?:
    | DataPreview
    | StatisticsOutput
    | SplitDataOutput
    | JoinOutput
    | ConcatOutput
    | TrainedModelOutput
    | ModelDefinitionOutput
    | StatsModelsResultOutput
    | EvaluationOutput
    | KMeansOutput
    | PCAOutput
    | TrainedClusteringModelOutput
    | ClusteringDataOutput
    | MissingHandlerOutput
    | EncoderOutput
    | NormalizerOutput
    | ColumnPlotOutput
    | OutlierDetectorOutput
    | HypothesisTestingOutput
    | NormalityCheckerOutput
    | CorrelationOutput
    | VIFCheckerOutput
    | MortalityModelOutput
    | MortalityResultOutput
    | JMDCCohortOutput
    | JMDCOutcomeOutput
    | JMDCIncidenceOutput
    | JMDCSurvivalOutput
    | JMDCCoxOutput
    | JMDCMatcherOutput;
  executionTime?: number; // milliseconds, set after successful run
  notes?: string; // user-written memo shown on the module card
  // Shape-specific properties
  shapeData?: {
    // For TextBox
    text?: string;
    // For GroupBox
    moduleIds?: string[]; // IDs of modules in this group
    bounds?: { x: number; y: number; width: number; height: number }; // Bounding box of the group
  };
}

export interface Connection {
  id: string;
  from: { moduleId: string; portName: string };
  to: { moduleId: string; portName: string };
}
