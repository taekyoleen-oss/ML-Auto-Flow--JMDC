import React, { useState, useCallback, useRef } from "react";
import { TOOLBOX_MODULES } from "../constants";
import { ModuleType } from "../types";
import {
  LinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  RectangleStackIcon,
  FontSizeIncreaseIcon,
  FontSizeDecreaseIcon,
} from "./icons";

interface ToolboxProps {
  onModuleDoubleClick: (type: ModuleType) => void;
  onFontSizeChange: (increase: boolean) => void;
}

const preprocessTypes = [
  ModuleType.LoadData,
  ModuleType.Join,
  ModuleType.Concat,
  ModuleType.SelectData,
  ModuleType.DataFiltering,
  ModuleType.ResampleData,
];

const transformerTypes = [
  ModuleType.HandleMissingValues,
  ModuleType.EncodeCategorical,
  ModuleType.ScalingTransform,
  ModuleType.TransitionData,
];

const statLabTypes = [
  ModuleType.Statistics,
  ModuleType.NormalityChecker,
  ModuleType.ColumnPlot,
  ModuleType.OutlierDetector,
  ModuleType.HypothesisTesting,
  ModuleType.Correlation,
  ModuleType.VIFChecker,
];

const analysisOpTypes = [
  ModuleType.SplitData,
  ModuleType.TrainModel,
  ModuleType.SweepParameters,
  ModuleType.ScoreModel,
  ModuleType.EvaluateModel,
  ModuleType.TrainClusteringModel,
  ModuleType.ClusteringData,
  ModuleType.Recommender,
];

const supervisedLearningTypes = [
  ModuleType.LinearRegression,
  ModuleType.LogisticRegression,
  ModuleType.DecisionTree,
  ModuleType.RandomForest,
  ModuleType.GradientBoosting,
  ModuleType.KNN,
  ModuleType.NeuralNetwork,
  ModuleType.SVM,
  ModuleType.LDA,
  ModuleType.NaiveBayes,
];

// 제외할 모듈 타입들 (Traditional Analysis와 중복)
const excludedFromSupervisedLearning = [
  ModuleType.OLSModel,
  ModuleType.LogisticModel,
  ModuleType.PoissonModel,
  ModuleType.QuasiPoissonModel,
  ModuleType.NegativeBinomialModel,
  ModuleType.DiversionChecker,
  ModuleType.EvaluateStat,
];

const unsupervisedModelTypes = [ModuleType.KMeans, ModuleType.PCA];

// Tradition Analysis - Operations (5개)
const traditionAnalysisOpTypes = [
  ModuleType.DiversionChecker,
  ModuleType.StatModels,
  ModuleType.ResultModel,
  ModuleType.PredictModel,
  ModuleType.EvaluateStat,
];

// Tradition Analysis - Statistical Model (5개)
const traditionAnalysisModelTypes = [
  ModuleType.OLSModel,
  ModuleType.LogisticModel,
  ModuleType.PoissonModel,
  ModuleType.QuasiPoissonModel,
  ModuleType.NegativeBinomialModel,
];

// Advanced Model - Mortality Models
const mortalityModelTypes = [
  ModuleType.MortalityResult,
  ModuleType.LeeCarterModel,
  ModuleType.CBDModel,
  ModuleType.APCModel,
  ModuleType.RHModel,
  ModuleType.PlatModel,
  ModuleType.PSplineModel,
];

// JMDC Analysis (PRD v2.0 §17, J1~J7)
const jmdcAnalysisTypes = [
  ModuleType.JMDCCohortBuilder,
  ModuleType.JMDCOutcomeLabeler,
  ModuleType.JMDCIncidenceRate,
  ModuleType.JMDCSurvivalCompare,
  ModuleType.JMDCCumulativeIncidence,
  ModuleType.JMDCRiskStratification,
  ModuleType.JMDCKRJPMatcher,
];

const categorizedModules = [
  {
    name: "JMDC Analysis",
    modules: TOOLBOX_MODULES.filter((m) => jmdcAnalysisTypes.includes(m.type)),
  },
  {
    name: "Data Preprocess",
    subCategories: [
      {
        name: "Transformer",
        modules: TOOLBOX_MODULES.filter((m) =>
          transformerTypes.includes(m.type)
        ),
      },
    ],
    modules: TOOLBOX_MODULES.filter((m) => preprocessTypes.includes(m.type)),
  },
  {
    name: "Stat Lab",
    modules: TOOLBOX_MODULES.filter((m) => statLabTypes.includes(m.type)),
  },
  {
    name: "Data Analysis",
    subCategories: [
      {
        name: "Operations",
        modules: TOOLBOX_MODULES.filter((m) =>
          analysisOpTypes.includes(m.type)
        ),
      },
      {
        name: "Supervised Learning",
        modules: TOOLBOX_MODULES.filter(
          (m) =>
            supervisedLearningTypes.includes(m.type) &&
            !excludedFromSupervisedLearning.includes(m.type)
        ),
      },
      {
        name: "Unsupervised Learning",
        modules: TOOLBOX_MODULES.filter((m) =>
          unsupervisedModelTypes.includes(m.type)
        ),
      },
    ],
  },
  {
    name: "Tradition Analysis",
    subCategories: [
      {
        name: "Operations",
        modules: TOOLBOX_MODULES.filter((m) =>
          traditionAnalysisOpTypes.includes(m.type)
        ),
      },
      {
        name: "Statistical Model",
        modules: TOOLBOX_MODULES.filter((m) =>
          traditionAnalysisModelTypes.includes(m.type)
        ),
      },
    ],
  },
  {
    name: "Advanced Model",
    subCategories: [
      {
        name: "Mortality Model",
        modules: TOOLBOX_MODULES.filter((m) =>
          mortalityModelTypes.includes(m.type)
        ),
      },
    ],
  },
];

const ToolboxItem: React.FC<{
  type: ModuleType;
  name: string;
  icon: React.FC<any>;
  description: string;
  onDoubleClick: (type: ModuleType) => void;
  onTouchEnd: (type: ModuleType, e: React.TouchEvent) => void;
}> = ({ type, name, icon: Icon, description, onDoubleClick, onTouchEnd }) => {
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    type: ModuleType
  ) => {
    // Ensure type is a valid string
    const typeString = String(type);
    if (!typeString || typeString.trim() === "") {
      console.error("Invalid module type for drag:", type);
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/reactflow", typeString);
    e.dataTransfer.effectAllowed = "copy"; // Changed from 'move' to 'copy' for better UX when creating new items
  };

  return (
    <div
      onDragStart={(e) => handleDragStart(e, type)}
      onDoubleClick={() => onDoubleClick(type)}
      onTouchEnd={(e) => onTouchEnd(type, e)}
      draggable
      title={description}
      className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-semibold transition-colors whitespace-nowrap w-full text-left cursor-grab"
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span>{name}</span>
    </div>
  );
};

export const Toolbox: React.FC<ToolboxProps> = ({
  onModuleDoubleClick,
  onFontSizeChange,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    "Data Preprocess": true,
    "Stat Lab": true,
    "Data Analysis": true,
    "Tradition Analysis": true,
    "Data Analysis-Operations": true,
    "Data Analysis-Supervised Learning": true,
    "Data Analysis-Unsupervised Learning": true,
    "Tradition Analysis-Operations": true,
    "Tradition Analysis-Statistical Model": true,
    "Advanced Model": true,
    "Advanced Model-Mortality Model": true,
    "JMDC Analysis": true,
  });

  const [searchQuery, setSearchQuery] = useState("");

  const [lastTapInfo, setLastTapInfo] = useState<{
    type: ModuleType;
    time: number;
  } | null>(null);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  const handleTouchEnd = useCallback(
    (type: ModuleType, e: React.TouchEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300; // ms

      if (
        lastTapInfo &&
        lastTapInfo.type === type &&
        now - lastTapInfo.time < DOUBLE_TAP_DELAY
      ) {
        // Double tap detected for this module type
        e.preventDefault(); // Prevent default touch behavior (e.g., zoom)
        onModuleDoubleClick(type);
        setLastTapInfo(null); // Reset
      } else {
        setLastTapInfo({ type, time: now });
      }
    },
    [lastTapInfo, onModuleDoubleClick]
  );

  const SHAPE_MODULES = [
    {
      type: ModuleType.TextBox,
      name: "텍스트 상자",
      icon: DocumentTextIcon,
      description: "텍스트를 입력할 수 있는 상자를 추가합니다.",
    },
    {
      type: ModuleType.GroupBox,
      name: "그룹 상자",
      icon: RectangleStackIcon,
      description: "선택된 모듈들을 그룹으로 묶는 상자를 추가합니다.",
    },
  ];

  return (
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 flex flex-col h-full">
      <div className="p-3 pb-2 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Modules</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="검색..."
          className="w-full px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1 p-2 overflow-y-auto panel-scrollbar min-h-0">
        <div className="flex flex-col gap-2">
          {/* 도형 메뉴 */}
          <div className="mb-0 -mt-1">
            <div className="flex gap-1 px-2 items-center">
              {SHAPE_MODULES.map(({ type, name, icon: Icon, description }) => {
                // TextBox는 드래그 앤 드롭, GroupBox는 클릭으로 처리
                if (type === ModuleType.GroupBox) {
                  return (
                    <div
                      key={type}
                      onClick={() => onModuleDoubleClick(type)}
                      title={name}
                      className="relative group flex items-center justify-center w-6 h-6 rounded cursor-pointer bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 dark:bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                        {name}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  );
                }
                // TextBox는 기존대로 드래그 앤 드롭
                return (
                  <div
                    key={type}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDoubleClick={() => onModuleDoubleClick(type)}
                    onTouchEnd={(e) => handleTouchEnd(type, e)}
                    draggable
                    title={name}
                    className="relative group flex items-center justify-center w-6 h-6 rounded cursor-grab bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {name}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                );
              })}
              {/* 글자 크기 조절 버튼 */}
              <div className="flex gap-1 ml-auto">
                <button
                  onClick={() => onFontSizeChange(true)}
                  className="p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                  title="글자 크게"
                >
                  <FontSizeIncreaseIcon className="h-4 w-4 text-gray-300" />
                </button>
                <button
                  onClick={() => onFontSizeChange(false)}
                  className="p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                  title="글자 작게"
                >
                  <FontSizeDecreaseIcon className="h-4 w-4 text-gray-300" />
                </button>
              </div>
            </div>
          </div>
          {searchQuery.trim() ? (
            (() => {
              const q = searchQuery.trim().toLowerCase();
              const results = TOOLBOX_MODULES.filter((m) =>
                m.name.toLowerCase().includes(q)
              );
              return results.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {results.map(({ type, name, icon, description }) => (
                    <ToolboxItem
                      key={type}
                      type={type}
                      name={name}
                      icon={icon}
                      description={description}
                      onDoubleClick={onModuleDoubleClick}
                      onTouchEnd={handleTouchEnd}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">검색 결과 없음</p>
              );
            })()
          ) : categorizedModules.map((category) => (
            <div key={category.name}>
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center justify-between p-2 rounded-lg text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span>{category.name}</span>
                {expandedCategories[category.name] ? (
                  <ChevronUpIcon className="w-5 h-5" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5" />
                )}
              </button>
              {expandedCategories[category.name] && (
                <div className="pl-2 pt-2 flex flex-col gap-2">
                  {category.modules?.map(
                    ({ type, name, icon, description }) => (
                      <ToolboxItem
                        key={type}
                        type={type}
                        name={name}
                        icon={icon}
                        description={description}
                        onDoubleClick={onModuleDoubleClick}
                        onTouchEnd={handleTouchEnd}
                      />
                    )
                  )}
                  {category.subCategories?.map((subCategory) => {
                    const subCategoryKey = `${category.name}-${subCategory.name}`;
                    return (
                      <div key={subCategoryKey} className="pl-2">
                        <button
                          onClick={() => toggleCategory(subCategoryKey)}
                          className="w-full flex items-center justify-between py-1 rounded-md text-left text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <span>{subCategory.name}</span>
                          {expandedCategories[subCategoryKey] ? (
                            <ChevronUpIcon className="w-4 h-4" />
                          ) : (
                            <ChevronDownIcon className="w-4 h-4" />
                          )}
                        </button>
                        {expandedCategories[subCategoryKey] && (
                          <div className="pt-2 flex flex-col gap-2">
                            {subCategory.modules.map(
                              ({ type, name, icon, description }) => (
                                <ToolboxItem
                                  key={type}
                                  type={type}
                                  name={name}
                                  icon={icon}
                                  description={description}
                                  onDoubleClick={onModuleDoubleClick}
                                  onTouchEnd={handleTouchEnd}
                                />
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="p-2 border-t border-gray-300 dark:border-gray-700 flex-shrink-0">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
          Developed by TKLEEN
        </p>
        <a
          href="https://www.ai4insurance.com"
          target="_blank"
          rel="noopener noreferrer"
          title="Go to ai4insurance.com"
          className="mx-auto flex items-center justify-center w-6 h-6 bg-gray-500 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 rounded-md text-white transition-colors"
        >
          <LinkIcon className="w-5 h-5" />
        </a>
      </div>
    </aside>
  );
};
