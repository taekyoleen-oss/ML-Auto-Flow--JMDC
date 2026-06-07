import { ModuleType, CanvasModule, ModuleStatus } from "./types";
// fix: Changed import from ChartBarIcon to BarChartIcon to match the exported member and added ModuleStatus for enum usage.
import {
  DatabaseIcon,
  TableCellsIcon,
  ScaleIcon,
  BarChartIcon,
  ShareIcon,
  CogIcon,
  CheckBadgeIcon,
  CalculatorIcon,
  BellCurveIcon,
  ChartCurveIcon,
  PriceTagIcon,
  FilterIcon,
  DocumentTextIcon,
  UsersIcon,
  BeakerIcon,
  HashtagIcon,
  PresentationChartLineIcon,
  CircleStackIcon,
  ShieldCheckIcon,
  ChartPieIcon,
  FingerPrintIcon,
} from "./components/icons";

export const TOOLBOX_MODULES = [
  // Data Preprocess
  {
    type: ModuleType.LoadData,
    name: "Load Data",
    icon: DatabaseIcon,
    description: "Loads a dataset from a CSV file.",
  },
  {
    type: ModuleType.Join,
    name: "Data Joiner",
    icon: ShareIcon,
    description:
      "Joins two datasets using inner, outer, left, or right join based on key columns.",
  },
  {
    type: ModuleType.Concat,
    name: "Data Concatenator",
    icon: ShareIcon,
    description:
      "Concatenates two datasets vertically (rows) or horizontally (columns).",
  },
  {
    type: ModuleType.Statistics,
    name: "Statistics",
    icon: BarChartIcon,
    description: "Computes descriptive statistics for the dataset.",
  },
  {
    type: ModuleType.SelectData,
    name: "Select Data",
    icon: TableCellsIcon,
    description: "Selects or removes columns from the data.",
  },
  {
    type: ModuleType.DataFiltering,
    name: "Data Filtering",
    icon: FilterIcon,
    description: "Filters rows or columns based on specified conditions.",
  },
  {
    type: ModuleType.ColumnPlot,
    name: "Column Plot",
    icon: BarChartIcon,
    description: "Creates various plots for single or double columns.",
  },
  {
    type: ModuleType.OutlierDetector,
    name: "Outlier Detector",
    icon: ShieldCheckIcon,
    description:
      "Detects outliers using multiple methods (IQR, Z-score, Isolation Forest, Boxplot).",
  },
  {
    type: ModuleType.HypothesisTesting,
    name: "Hypothesis Testing",
    icon: CalculatorIcon,
    description:
      "Performs various hypothesis tests (t-test, chi-square, ANOVA, KS-test, Shapiro-Wilk, Levene).",
  },
  {
    type: ModuleType.NormalityChecker,
    name: "Normality Checker",
    icon: BellCurveIcon,
    description:
      "Checks normality of data using various statistical tests (Shapiro-Wilk, KS-test, Anderson-Darling, D'Agostino's K2).",
  },
  {
    type: ModuleType.Correlation,
    name: "Correlation",
    icon: BarChartIcon,
    description:
      "Analyzes correlations between variables (Pearson/Spearman/Kendall, Cramér's V, Heatmap, Pairplot).",
  },
  {
    type: ModuleType.VIFChecker,
    name: "VIF Checker",
    icon: CalculatorIcon,
    description:
      "Checks Variance Inflation Factor (VIF) to detect multicollinearity in features.",
  },
  {
    type: ModuleType.TransitionData,
    name: "Transition Data",
    icon: ScaleIcon,
    description: "Applies mathematical transformations to numeric columns.",
  },
  {
    type: ModuleType.ResampleData,
    name: "Resample Data",
    icon: ScaleIcon,
    description:
      "Resamples data to handle class imbalance (e.g., SMOTE, NearMiss).",
  },
  {
    type: ModuleType.HandleMissingValues,
    name: "Handle Missing Values",
    icon: FilterIcon,
    description: "Handles missing values by removing rows or imputing.",
  },
  {
    type: ModuleType.EncodeCategorical,
    name: "Encode Categorical",
    icon: ScaleIcon,
    description: "Encodes categorical string columns into numbers.",
  },
  {
    type: ModuleType.ScalingTransform,
    name: "Scaling Transform",
    icon: ScaleIcon,
    description: "Scales numeric features to a standard range.",
  },
  // Data Analysis
  {
    type: ModuleType.SplitData,
    name: "Split Data",
    icon: ShareIcon,
    description: "Splits data into training and testing sets.",
  },
  {
    type: ModuleType.TrainModel,
    name: "Train Model",
    icon: CogIcon,
    description: "Trains a machine learning model with data.",
  },
  {
    type: ModuleType.ScoreModel,
    name: "Score Model",
    icon: CalculatorIcon,
    description: "Generates predictions on data using a trained model.",
  },
  {
    type: ModuleType.EvaluateModel,
    name: "Evaluate Model",
    icon: CheckBadgeIcon,
    description: "Evaluates the performance of a model's predictions.",
  },

  // Supervised Learning
  {
    type: ModuleType.LinearRegression,
    name: "Linear Regression",
    icon: BarChartIcon,
    description: "A regression algorithm for predicting continuous values.",
  },
  {
    type: ModuleType.LogisticRegression,
    name: "Logistic Regression",
    icon: PresentationChartLineIcon,
    description: "A classification algorithm for predicting binary outcomes.",
  },
  {
    type: ModuleType.PoissonRegression,
    name: "Poisson Regression",
    icon: HashtagIcon,
    description:
      "A regression model for count data. (Deprecated: Use Poisson Model instead)",
  },
  {
    type: ModuleType.NegativeBinomialRegression,
    name: "Negative Binomial",
    icon: HashtagIcon,
    description:
      "A regression model for overdispersed count data. (Deprecated: Use Negative Binomial Model instead)",
  },
  {
    type: ModuleType.DecisionTree,
    name: "Decision Tree",
    icon: ShareIcon,
    description:
      "A model using a tree-like structure for classification or regression.",
  },
  {
    type: ModuleType.RandomForest,
    name: "Random Forest",
    icon: ShareIcon,
    description:
      "An ensemble of decision trees for classification or regression.",
  },
  {
    type: ModuleType.NeuralNetwork,
    name: "Neural Network",
    icon: ShareIcon,
    description: "A multi-layer perceptron for classification or regression.",
  },
  {
    type: ModuleType.SVM,
    name: "Support Vector Machine",
    icon: ShieldCheckIcon,
    description:
      "A model finding the optimal hyperplane for classification or regression.",
  },
  {
    type: ModuleType.LDA,
    name: "Linear Discriminant Analysis",
    icon: BeakerIcon,
    description: "A dimensionality reduction and classification technique.",
  },
  {
    type: ModuleType.NaiveBayes,
    name: "Naive Bayes",
    icon: BeakerIcon,
    description: "A probabilistic classifier based on Bayes' theorem.",
  },
  {
    type: ModuleType.KNN,
    name: "K-Nearest Neighbors",
    icon: CircleStackIcon,
    description:
      "An algorithm for classification or regression based on nearest neighbors.",
  },

  // Unsupervised Models
  {
    type: ModuleType.KMeans,
    name: "K-Means Clustering",
    icon: UsersIcon,
    description:
      "An unsupervised algorithm for partitioning data into K clusters.",
  },
  {
    type: ModuleType.PCA,
    name: "Principal Component Analysis",
    icon: ChartPieIcon,
    description: "A technique for dimensionality reduction.",
  },
  {
    type: ModuleType.DBSCAN,
    name: "DBSCAN Clustering",
    icon: UsersIcon,
    description:
      "A density-based clustering algorithm that finds clusters of arbitrary shape and marks outliers as noise.",
  },
  {
    type: ModuleType.HierarchicalClustering,
    name: "Hierarchical Clustering",
    icon: UsersIcon,
    description:
      "Agglomerative clustering that merges points bottom-up into a tree, cut into a chosen number of clusters.",
  },

  // Clustering Operations
  {
    type: ModuleType.TrainClusteringModel,
    name: "Train Clustering Model",
    icon: CogIcon,
    description: "Trains a clustering model (K-Means, PCA) with data.",
  },
  {
    type: ModuleType.ClusteringData,
    name: "Clustering Data",
    icon: CalculatorIcon,
    description:
      "Applies a trained clustering model to assign clusters or transform data.",
  },

  // Traditional Analysis - Statsmodels Models
  {
    type: ModuleType.OLSModel,
    name: "OLS Model",
    icon: BarChartIcon,
    description: "Ordinary Least Squares regression model.",
  },
  {
    type: ModuleType.LogisticModel,
    name: "Logistic Model",
    icon: PresentationChartLineIcon,
    description: "Logistic regression model for binary classification.",
  },
  {
    type: ModuleType.PoissonModel,
    name: "Poisson Model",
    icon: HashtagIcon,
    description: "Poisson regression model for count data.",
  },
  {
    type: ModuleType.QuasiPoissonModel,
    name: "Quasi-Poisson Model",
    icon: HashtagIcon,
    description: "Quasi-Poisson regression model for overdispersed count data.",
  },
  {
    type: ModuleType.NegativeBinomialModel,
    name: "Negative Binomial Model",
    icon: HashtagIcon,
    description:
      "Negative Binomial regression model for overdispersed count data.",
  },
  // Tradition Analysis - Advanced Models
  {
    type: ModuleType.StatModels,
    name: "Stat Models",
    icon: CogIcon,
    description: "Advanced statistical models (Gamma, Tweedie).",
  },
  {
    type: ModuleType.ResultModel,
    name: "Result Model",
    icon: CalculatorIcon,
    description: "Fits a statistical model and shows the summary.",
  },
  {
    type: ModuleType.PredictModel,
    name: "Predict Model",
    icon: CalculatorIcon,
    description: "Generates predictions using a fitted statistical model.",
  },
  {
    type: ModuleType.DiversionChecker,
    name: "Diversion Checker",
    icon: BeakerIcon,
    description:
      "Checks for overdispersion in count data and recommends appropriate regression models.",
  },
  {
    type: ModuleType.EvaluateStat,
    name: "Evaluate Stat",
    icon: CalculatorIcon,
    description:
      "Evaluates statistical model performance with various metrics.",
  },
  // Advanced Model - Mortality Models
  {
    type: ModuleType.MortalityResult,
    name: "Mortality Result",
    icon: PresentationChartLineIcon,
    description: "Compares and visualizes multiple mortality models.",
  },
  {
    type: ModuleType.LeeCarterModel,
    name: "Lee-Carter Model",
    icon: PresentationChartLineIcon,
    description: "Lee-Carter mortality forecasting model.",
  },
  {
    type: ModuleType.CBDModel,
    name: "CBD Model",
    icon: PresentationChartLineIcon,
    description: "Cairns-Blake-Dowd mortality forecasting model.",
  },
  {
    type: ModuleType.APCModel,
    name: "APC Model",
    icon: PresentationChartLineIcon,
    description: "Age-Period-Cohort mortality forecasting model.",
  },
  {
    type: ModuleType.RHModel,
    name: "RH Model",
    icon: PresentationChartLineIcon,
    description: "Renshaw-Haberman mortality forecasting model.",
  },
  {
    type: ModuleType.PlatModel,
    name: "Plat Model",
    icon: PresentationChartLineIcon,
    description: "Plat mortality forecasting model (Lee-Carter + CBD).",
  },
  {
    type: ModuleType.PSplineModel,
    name: "P-Spline Model",
    icon: PresentationChartLineIcon,
    description: "P-Spline mortality forecasting model.",
  },
  // Frequency-Severity Simulation Models
  {
    type: ModuleType.SimulateFreqSevTable,
    name: "Simulate Freq-Sev Table",
    icon: TableCellsIcon,
    description: "Simulates frequency-severity table with annual or claim-level aggregation.",
  },
  {
    type: ModuleType.CombineLossModel,
    name: "Combine Loss Model",
    icon: CalculatorIcon,
    description: "Combines two loss models and calculates VaR and other risk metrics.",
  },
  // JMDC Analysis (PRD v2.0 §17, J1~J7)
  {
    type: ModuleType.JMDCCohortBuilder,
    name: "JMDC Cohort Builder",
    icon: UsersIcon,
    description:
      "[J1] Defines an analysis cohort by Index Date with washout, age, exclusion, and disease-free conditions. Supports synthetic data generation for offline demos.",
  },
  {
    type: ModuleType.JMDCOutcomeLabeler,
    name: "JMDC Outcome Labeler",
    icon: ChartCurveIcon,
    description:
      "[J2] Computes first-event time and censoring per member for one or many outcomes (ICD-10 prefix dictionary).",
  },
  {
    type: ModuleType.JMDCIncidenceRate,
    name: "JMDC Incidence Rate",
    icon: CalculatorIcon,
    description:
      "[J3] Person-years based crude and age-standardised incidence rates with optional stratification.",
  },
  {
    type: ModuleType.JMDCSurvivalCompare,
    name: "JMDC Survival Compare (KM)",
    icon: ChartCurveIcon,
    description:
      "[J4] Kaplan-Meier survival curves with log-rank (and stratified log-rank) tests between groups.",
  },
  {
    type: ModuleType.JMDCCumulativeIncidence,
    name: "JMDC Cumulative Incidence",
    icon: ChartCurveIcon,
    description:
      "[J5] Cumulative incidence function with optional competing-risk handling (Aalen-Johansen).",
  },
  {
    type: ModuleType.JMDCRiskStratification,
    name: "JMDC Risk Stratification (Cox)",
    icon: CalculatorIcon,
    description:
      "[J6] Adjusted hazard ratios from Cox PH with proportional hazards assumption check (Schoenfeld).",
  },
  {
    type: ModuleType.JMDCKRJPMatcher,
    name: "JMDC KR-JP Matcher",
    icon: UsersIcon,
    description:
      "[J7] 4-Layer KR-JP cohort matching (schema alignment, vocab mapping, age/sex standardisation, PSM).",
  },
];

// fix: Replaced all instances of status: 'Pending' with status: ModuleStatus.Pending to conform to the ModuleStatus enum type.
export const DEFAULT_MODULES: Omit<CanvasModule, "id" | "position" | "name">[] =
  [
    {
      type: ModuleType.LoadData,
      status: ModuleStatus.Pending,
      parameters: { source: "your-data-source.csv" },
      inputs: [],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.Statistics,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [],
    },
    {
      type: ModuleType.SelectData,
      status: ModuleStatus.Pending,
      parameters: { columnSelections: {} },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.DataFiltering,
      status: ModuleStatus.Pending,
      parameters: {
        filter_type: "row", // "row" or "column"
        conditions: [], // Array<{column: string, operator: string, value: any}>
        logical_operator: "AND", // "AND" or "OR"
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.ColumnPlot,
      status: ModuleStatus.Pending,
      parameters: {
        plot_type: "single", // "single" or "double"
        column1: "",
        column2: "",
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [],
    },
    {
      type: ModuleType.OutlierDetector,
      status: ModuleStatus.Pending,
      parameters: {
        columns: [],
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [],
    },
    {
      type: ModuleType.HypothesisTesting,
      status: ModuleStatus.Pending,
      parameters: {
        tests: [],
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [],
    },
    {
      type: ModuleType.NormalityChecker,
      status: ModuleStatus.Pending,
      parameters: {
        column: "",
        tests: [
          "shapiro_wilk",
          "kolmogorov_smirnov",
          "anderson_darling",
          "dagostino_k2",
        ], // 기본값: 모두 선택
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [],
    },
    {
      type: ModuleType.Correlation,
      status: ModuleStatus.Pending,
      parameters: {
        columns: [],
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [],
    },
    {
      type: ModuleType.VIFChecker,
      status: ModuleStatus.Pending,
      parameters: {
        feature_columns: [],
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [],
    },
    {
      type: ModuleType.HandleMissingValues,
      status: ModuleStatus.Pending,
      parameters: {
        method: "remove_row", // 'remove_row', 'impute', 'knn'
        strategy: "mean", // for 'impute'
        n_neighbors: 5, // for 'knn'
        metric: "nan_euclidean", // for 'knn'
        columnSelections: {}, // 선택된 열 (기본값: 모든 열 선택)
      },
      inputs: [
        { name: "data_in", type: "data" },
        { name: "data_in2", type: "data" },
      ],
      outputs: [
        { name: "data_out", type: "data" },
        { name: "data_out2", type: "data" },
      ],
    },
    {
      type: ModuleType.EncodeCategorical,
      status: ModuleStatus.Pending,
      parameters: {
        method: "one_hot",
        columns: [],
        // one-hot params
        handle_unknown: "ignore",
        drop: "first",
        // ordinal params
        ordinal_mapping: "{}", // JSON string for easier UI
      },
      inputs: [
        { name: "data_in", type: "data" },
        { name: "data_in2", type: "data" },
      ],
      outputs: [
        { name: "data_out", type: "data" },
        { name: "data_out2", type: "data" },
      ],
    },
    {
      type: ModuleType.ScalingTransform,
      status: ModuleStatus.Pending,
      parameters: { method: "MinMax", columnSelections: {} },
      inputs: [
        { name: "data_in", type: "data" },
        { name: "data_in2", type: "data" },
      ],
      outputs: [
        { name: "data_out", type: "data" },
        { name: "data_out2", type: "data" },
      ],
    },
    {
      type: ModuleType.TransitionData,
      status: ModuleStatus.Pending,
      parameters: { transformations: {} },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.ResampleData,
      status: ModuleStatus.Pending,
      parameters: { method: "SMOTE", target_column: null },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.SplitData,
      status: ModuleStatus.Pending,
      parameters: {
        train_size: 0.75,
        random_state: 43,
        shuffle: "True",
        stratify: "False",
        stratify_column: null,
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [
        { name: "train_data_out", type: "data" },
        { name: "test_data_out", type: "data" },
      ],
    },
    {
      type: ModuleType.Join,
      status: ModuleStatus.Pending,
      parameters: {
        join_type: "inner",
        how: "inner",
        on: null,
        left_on: null,
        right_on: null,
        suffixes: ["_x", "_y"],
      },
      inputs: [
        { name: "data_in", type: "data" },
        { name: "data_in2", type: "data" },
      ],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.Concat,
      status: ModuleStatus.Pending,
      parameters: {
        axis: "vertical",
        ignore_index: false,
        sort: false,
      },
      inputs: [
        { name: "data_in", type: "data" },
        { name: "data_in2", type: "data" },
      ],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.LinearRegression,
      status: ModuleStatus.Pending,
      // Updated parameters for Linear Regression, Lasso, Ridge, ElasticNet
      parameters: {
        model_type: "LinearRegression",
        alpha: 1.0,
        l1_ratio: 0.5,
        fit_intercept: "True",
        tuning_enabled: "False",
        tuning_strategy: "GridSearch",
        alpha_candidates: "0.01,0.1,1,10",
        l1_ratio_candidates: "0.2,0.5,0.8",
        cv_folds: 5,
        scoring_metric: "neg_mean_squared_error",
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.LogisticRegression,
      status: ModuleStatus.Pending,
      parameters: {
        penalty: "l2",
        C: 1.0,
        solver: "lbfgs",
        max_iter: 100,
        tuning_enabled: "False",
        tuning_strategy: "GridSearch",
        c_candidates: "0.01,0.1,1,10,100",
        l1_ratio_candidates: "0.2,0.5,0.8",
        cv_folds: 5,
        scoring_metric: "accuracy",
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.SVM,
      status: ModuleStatus.Pending,
      parameters: {
        model_purpose: "classification",
        kernel: "rbf",
        C: 1.0,
        gamma: "scale",
        degree: 3,
        probability: "False",
        tuning_enabled: "False",
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.RandomForest,
      status: ModuleStatus.Pending,
      parameters: {
        model_purpose: "classification",
        n_estimators: 100,
        criterion: "gini",
        max_depth: null,
        max_features: null,
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.NeuralNetwork,
      status: ModuleStatus.Pending,
      parameters: {
        model_purpose: "classification",
        hidden_layer_sizes: "100",
        activation: "relu",
        max_iter: 200,
        random_state: 2022,
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.PoissonRegression,
      status: ModuleStatus.Pending,
      parameters: { distribution_type: "Poisson", max_iter: 100 },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.NegativeBinomialRegression,
      status: ModuleStatus.Pending,
      parameters: {
        distribution_type: "NegativeBinomial",
        max_iter: 100,
        disp: 1.0,
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.LinearDiscriminantAnalysis,
      status: ModuleStatus.Pending,
      parameters: { solver: "svd", shrinkage: null },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.NaiveBayes,
      status: ModuleStatus.Pending,
      parameters: {
        model_purpose: "classification",
        model_type: "GaussianNB",
        alpha: 1.0,
        fit_prior: "True",
        tuning_enabled: "False",
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.KNN,
      status: ModuleStatus.Pending,
      parameters: {
        model_purpose: "classification",
        n_neighbors: 3,
        weights: "uniform",
        algorithm: "auto",
        metric: "minkowski",
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.DecisionTree,
      status: ModuleStatus.Pending,
      parameters: {
        model_purpose: "classification",
        criterion: "gini",
        max_depth: null,
        min_samples_split: 2,
        min_samples_leaf: 1,
        class_weight: null,
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.KMeans,
      status: ModuleStatus.Pending,
      parameters: {
        n_clusters: 3,
        init: "k-means++",
        n_init: 10,
        max_iter: 300,
        random_state: 42,
      },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.PrincipalComponentAnalysis,
      status: ModuleStatus.Pending,
      parameters: { n_components: 2 },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.DBSCAN,
      status: ModuleStatus.Pending,
      parameters: { eps: 0.5, min_samples: 5 },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.HierarchicalClustering,
      status: ModuleStatus.Pending,
      parameters: { n_clusters: 3, linkage: "ward", metric: "euclidean" },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.TrainClusteringModel,
      status: ModuleStatus.Pending,
      parameters: { feature_columns: [] },
      inputs: [
        { name: "model_in", type: "model" },
        { name: "data_in", type: "data" },
      ],
      outputs: [{ name: "trained_model_out", type: "model" }],
    },
    {
      type: ModuleType.ClusteringData,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [
        { name: "model_in", type: "model" },
        { name: "data_in", type: "data" },
      ],
      outputs: [{ name: "clustered_data_out", type: "data" }],
    },
    {
      type: ModuleType.TrainModel,
      status: ModuleStatus.Pending,
      parameters: { feature_columns: [], label_column: null },
      inputs: [
        { name: "model_in", type: "model" },
        { name: "data_in", type: "data" },
      ],
      outputs: [{ name: "trained_model_out", type: "model" }],
    },
    {
      type: ModuleType.ScoreModel,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [
        { name: "model_in", type: "model" },
        { name: "data_in", type: "data" },
      ],
      outputs: [{ name: "scored_data_out", type: "data" }],
    },
    {
      type: ModuleType.EvaluateModel,
      status: ModuleStatus.Pending,
      parameters: {
        label_column: null,
        prediction_column: null,
        model_type: "regression",
        threshold: 0.5,
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "evaluation_out", type: "evaluation" }],
    },
    {
      type: ModuleType.OLSModel,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.LogisticModel,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.PoissonModel,
      status: ModuleStatus.Pending,
      parameters: { max_iter: 100 },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.QuasiPoissonModel,
      status: ModuleStatus.Pending,
      parameters: { max_iter: 100 },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.NegativeBinomialModel,
      status: ModuleStatus.Pending,
      parameters: { max_iter: 100, disp: 1.0 },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.StatModels,
      status: ModuleStatus.Pending,
      parameters: { model: "OLS" },
      inputs: [],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.ResultModel,
      status: ModuleStatus.Pending,
      parameters: { feature_columns: [], label_column: null },
      inputs: [
        { name: "model_in", type: "model" },
        { name: "data_in", type: "data" },
      ],
      outputs: [{ name: "result_out", type: "evaluation" }],
    },
    {
      type: ModuleType.PredictModel,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [
        { name: "model_in", type: "evaluation" },
        { name: "data_in", type: "data" },
      ],
      outputs: [{ name: "scored_data_out", type: "data" }],
    },
    {
      type: ModuleType.DiversionChecker,
      status: ModuleStatus.Pending,
      parameters: { feature_columns: [], label_column: null, max_iter: 100 },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "result_out", type: "evaluation" }],
    },
    {
      type: ModuleType.EvaluateStat,
      status: ModuleStatus.Pending,
      parameters: {
        label_column: null,
        prediction_column: null,
        model_type: null,
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "result_out", type: "evaluation" }],
    },
    {
      type: ModuleType.MortalityResult,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "",
        yearColumn: "",
        deathsColumn: "",
        exposureColumn: "",
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "result_out", type: "evaluation" }],
    },
    {
      type: ModuleType.LeeCarterModel,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "",
        yearColumn: "",
        deathsColumn: "",
        exposureColumn: "",
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.CBDModel,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "",
        yearColumn: "",
        deathsColumn: "",
        exposureColumn: "",
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.APCModel,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "",
        yearColumn: "",
        deathsColumn: "",
        exposureColumn: "",
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.RHModel,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "",
        yearColumn: "",
        deathsColumn: "",
        exposureColumn: "",
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.PlatModel,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "",
        yearColumn: "",
        deathsColumn: "",
        exposureColumn: "",
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.PSplineModel,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "",
        yearColumn: "",
        deathsColumn: "",
        exposureColumn: "",
        n_knots: 10,
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "model_out", type: "model" }],
    },
    {
      type: ModuleType.SimulateFreqSevTable,
      status: ModuleStatus.Pending,
      parameters: { outputFormat: "annual" }, // "annual" or "claim"
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [
        { name: "output_1", type: "data" }, // 연도별 집계 (DFA 사용)
        { name: "output_2", type: "data" }, // 사고별 집계 (XoL 사용)
      ],
    },
    {
      type: ModuleType.CombineLossModel,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [
        { name: "freq_serv_in", type: "data" }, // Frequency-Severity simulation input
        { name: "loss_in", type: "data" }, // Second loss model input
      ],
      outputs: [{ name: "combined_loss_out", type: "data" }],
    },
    // JMDC Analysis (PRD v2.0 §17, J1~J7)
    {
      type: ModuleType.JMDCCohortBuilder,
      status: ModuleStatus.Pending,
      parameters: {
        data_source: "synthetic", // synthetic | supabase | csv
        synthetic_n: 100000,
        synthetic_seed: 43,
        index_date_rule: "birthday_age", // birthday_age | enrollment_date | fixed_date
        index_age: 50,
        index_fixed_date: "2018-01-01",
        age_at_index_min: 30,
        age_at_index_max: 70,
        washout_years: 2,
        exclusion_diseases: ["C00-C97"],
        disease_free_years: 0,
      },
      inputs: [
        { name: "data_in", type: "data" }, // optional: member·claim·disease long format
      ],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.JMDCOutcomeLabeler,
      status: ModuleStatus.Pending,
      parameters: {
        // outcome dictionary keyed by label name → ICD-10 prefix list
        outcome_diseases: {
          colon_ca: ["C18", "C19", "C20"],
          stroke: ["I60", "I61", "I62", "I63", "I64"],
          ami: ["I21", "I22"],
          diabetes: ["E10", "E11", "E12", "E13", "E14"],
        },
        outcome_window_years: 5,
        confirm_suspect_flag: true,
        multi_outcome_mode: "single", // single | long
      },
      inputs: [
        { name: "data_in", type: "data" }, // cohort from J1
        { name: "data_in2", type: "data" }, // claims_disease long format (optional when synthetic)
      ],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.JMDCIncidenceRate,
      status: ModuleStatus.Pending,
      parameters: {
        stratify_by: "sex_age", // none | sex | age_band | sex_age
        standard_population: "japan_2015", // internal | WHO_2000 | japan_2015 | korea_2020
        rate_unit: "1000_PY", // 1000_PY | 10000_PY | 100000_PY
        time_grid_years: [1, 2, 3, 4, 5],
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.JMDCSurvivalCompare,
      status: ModuleStatus.Pending,
      parameters: {
        group_col: "has_diabetes",
        time_horizons_years: [1, 3, 5, 10],
        logrank_method: "standard", // standard | stratified
        stratify_cols: [],
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.JMDCCumulativeIncidence,
      status: ModuleStatus.Pending,
      parameters: {
        event_col: "event_flag",
        competing_event_cols: [],
        group_col: "",
        time_grid_years: [1, 2, 3, 4, 5, 7, 10],
        bootstrap_n: 0,
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.JMDCRiskStratification,
      status: ModuleStatus.Pending,
      parameters: {
        exposure_col: "has_diabetes",
        covariates: ["age_at_index", "sex_code", "bmi", "charlson"],
        stratify_col: "",
        proportional_hazards_test: true,
        tie_method: "efron", // efron | breslow
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [
        { name: "data_out", type: "data" },
        { name: "model_out", type: "model" },
      ],
    },
    {
      type: ModuleType.JMDCKRJPMatcher,
      status: ModuleStatus.Pending,
      parameters: {
        apply_schema_alignment: true,
        apply_vocab_mapping: true,
        apply_standardization: "direct", // none | direct | indirect_sir
        standard_population: "WHO_2000", // WHO_2000 | japan_2015 | korea_2020 | combined
        apply_psm: false,
        psm_covariates: ["age_at_index", "sex_code", "bmi", "charlson"],
        caliper: 0.2,
        comparison_outcome: "colon_ca",
      },
      inputs: [
        { name: "data_in", type: "data" }, // JP cohort (J1+J2)
        { name: "data_in2", type: "data" }, // KR cohort (same schema)
      ],
      outputs: [{ name: "data_out", type: "data" }],
    },
  ];

export const SAMPLE_MODELS = [
  {
    name: "Linear Regression",
    modules: [
      {
        type: ModuleType.LoadData,
        position: { x: 100, y: 100 },
        name: "Load Data",
      },
      {
        type: ModuleType.SelectData,
        position: { x: 100, y: 250 },
        name: "Select Data 1",
      },
      {
        type: ModuleType.SplitData,
        position: { x: 100, y: 400 },
        name: "Split Data",
      },
      {
        type: ModuleType.LinearRegression,
        position: { x: 100, y: 550 },
        name: "Linear Regression",
      },
      {
        type: ModuleType.Statistics,
        position: { x: 400, y: 100 },
        name: "Statistics 1",
      },
      {
        type: ModuleType.TrainModel,
        position: { x: 350, y: 550 },
        name: "Train Model",
      },
      {
        type: ModuleType.ScoreModel,
        position: { x: 600, y: 550 },
        name: "Score Model",
      },
      {
        type: ModuleType.EvaluateModel,
        position: { x: 850, y: 550 },
        name: "Evaluate Model",
      },
    ],
    connections: [
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 1,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 4,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 1,
        fromPort: "data_out",
        toModuleIndex: 2,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 2,
        fromPort: "train_data_out",
        toModuleIndex: 5,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 2,
        fromPort: "test_data_out",
        toModuleIndex: 6,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 3,
        fromPort: "model_out",
        toModuleIndex: 5,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 5,
        fromPort: "trained_model_out",
        toModuleIndex: 6,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 6,
        fromPort: "scored_data_out",
        toModuleIndex: 7,
        toPort: "data_in",
      },
    ],
  },
  {
    name: "Logistic Regression",
    modules: [
      {
        type: ModuleType.LoadData,
        position: { x: 100, y: 100 },
        name: "Load Data",
      },
      {
        type: ModuleType.Statistics,
        position: { x: 400, y: 100 },
        name: "Statistics 1",
      },
      {
        type: ModuleType.SelectData,
        position: { x: 100, y: 250 },
        name: "Select Data 1",
      },
      {
        type: ModuleType.SplitData,
        position: { x: 100, y: 400 },
        name: "Split Data",
      },
      {
        type: ModuleType.LogisticRegression,
        position: { x: 100, y: 550 },
        name: "Logistic Regression",
      },
      {
        type: ModuleType.TrainModel,
        position: { x: 400, y: 550 },
        name: "Train Model",
      },
      {
        type: ModuleType.ScoreModel,
        position: { x: 700, y: 550 },
        name: "Score Model",
      },
      {
        type: ModuleType.EvaluateModel,
        position: { x: 1000, y: 550 },
        name: "Evaluate Model",
      },
    ],
    connections: [
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 2,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 1,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 2,
        fromPort: "data_out",
        toModuleIndex: 3,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 3,
        fromPort: "train_data_out",
        toModuleIndex: 5,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 3,
        fromPort: "test_data_out",
        toModuleIndex: 6,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 4,
        fromPort: "model_out",
        toModuleIndex: 5,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 5,
        fromPort: "trained_model_out",
        toModuleIndex: 6,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 6,
        fromPort: "scored_data_out",
        toModuleIndex: 7,
        toPort: "data_in",
      },
    ],
  },
  {
    name: "Decision Tree",
    modules: [
      {
        type: ModuleType.LoadData,
        position: { x: 100, y: 100 },
        name: "Load Data",
      },
      {
        type: ModuleType.SelectData,
        position: { x: 100, y: 250 },
        name: "Select Data 1",
      },
      {
        type: ModuleType.SplitData,
        position: { x: 100, y: 400 },
        name: "Split Data",
      },
      {
        type: ModuleType.Statistics,
        position: { x: 400, y: 100 },
        name: "Statistics 1",
      },
      {
        type: ModuleType.DecisionTree,
        position: { x: 100, y: 550 },
        name: "Decision Tree 1",
      },
      {
        type: ModuleType.TrainModel,
        position: { x: 350, y: 550 },
        name: "Train Model",
      },
      {
        type: ModuleType.ScoreModel,
        position: { x: 600, y: 550 },
        name: "Score Model",
      },
      {
        type: ModuleType.EvaluateModel,
        position: { x: 850, y: 550 },
        name: "Evaluate Model",
      },
    ],
    connections: [
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 1,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 3,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 1,
        fromPort: "data_out",
        toModuleIndex: 2,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 2,
        fromPort: "train_data_out",
        toModuleIndex: 5,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 2,
        fromPort: "test_data_out",
        toModuleIndex: 6,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 4,
        fromPort: "model_out",
        toModuleIndex: 5,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 5,
        fromPort: "trained_model_out",
        toModuleIndex: 6,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 6,
        fromPort: "scored_data_out",
        toModuleIndex: 7,
        toPort: "data_in",
      },
    ],
  },
  {
    name: "Neural Network",
    modules: [
      {
        type: ModuleType.LoadData,
        position: { x: 100, y: 100 },
        name: "Load Data",
      },
      {
        type: ModuleType.SelectData,
        position: { x: 100, y: 250 },
        name: "Select Data 1",
      },
      {
        type: ModuleType.SplitData,
        position: { x: 100, y: 400 },
        name: "Split Data",
      },
      {
        type: ModuleType.Statistics,
        position: { x: 400, y: 100 },
        name: "Statistics 1",
      },
      {
        type: ModuleType.NeuralNetwork,
        position: { x: 100, y: 550 },
        name: "Neural Network 1",
      },
      {
        type: ModuleType.TrainModel,
        position: { x: 350, y: 550 },
        name: "Train Model",
      },
      {
        type: ModuleType.ScoreModel,
        position: { x: 600, y: 550 },
        name: "Score Model",
      },
      {
        type: ModuleType.EvaluateModel,
        position: { x: 850, y: 550 },
        name: "Evaluate Model",
      },
    ],
    connections: [
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 1,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 0,
        fromPort: "data_out",
        toModuleIndex: 3,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 1,
        fromPort: "data_out",
        toModuleIndex: 2,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 2,
        fromPort: "train_data_out",
        toModuleIndex: 5,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 2,
        fromPort: "test_data_out",
        toModuleIndex: 6,
        toPort: "data_in",
      },
      {
        fromModuleIndex: 4,
        fromPort: "model_out",
        toModuleIndex: 5,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 5,
        fromPort: "trained_model_out",
        toModuleIndex: 6,
        toPort: "model_in",
      },
      {
        fromModuleIndex: 6,
        fromPort: "scored_data_out",
        toModuleIndex: 7,
        toPort: "data_in",
      },
    ],
  },
];
