import React, {
  useState,
  useCallback,
  MouseEvent,
  useEffect,
  useRef,
} from "react";
import { Toolbox } from "./components/Toolbox";
import { Canvas } from "./components/Canvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
// fix: Add missing 'Port' type to handle portType argument in getSingleInputData.
import {
  CanvasModule,
  ModuleType,
  Connection,
  ModuleStatus,
  StatisticsOutput,
  DataPreview,
  ColumnInfo,
  SplitDataOutput,
  TrainedModelOutput,
  ModelDefinitionOutput,
  StatsModelsResultOutput,
  FittedDistributionOutput,
  ExposureCurveOutput,
  XoLPriceOutput,
  XolContractOutput,
  FinalXolPriceOutput,
  EvaluationOutput,
  KMeansOutput,
  PCAOutput,
  TrainedClusteringModelOutput,
  ClusteringDataOutput,
  MissingHandlerOutput,
  Port,
  EncoderOutput,
  NormalizerOutput,
  DiversionCheckerOutput,
  EvaluateStatOutput,
  StatsModelFamily,
  OutlierDetectorOutput,
  HypothesisTestingOutput,
  HypothesisTestType,
  NormalityCheckerOutput,
  NormalityTestType,
  CorrelationOutput,
  VIFCheckerOutput,
  MortalityModelOutput,
  MortalityResultOutput,
  JoinOutput,
  ConcatOutput,
} from "./types";
import { DEFAULT_MODULES, TOOLBOX_MODULES, SAMPLE_MODELS } from "./constants";
import { SAVED_SAMPLES } from "./savedSamples";
import {
  isSupabaseConfigured,
  fetchAutoflowSamplesList,
  fetchAutoflowSampleById,
} from "./utils/supabase-samples";

// SAVED_SAMPLES가 없을 경우를 대비한 기본값
const getSavedSamples = () => {
  try {
    return SAVED_SAMPLES || [];
  } catch (error) {
    console.error("Failed to load SAVED_SAMPLES:", error);
    return [];
  }
};

// 마지막 작업 저장 시각을 사람이 읽기 좋은 상대/절대 시간으로 포맷.
const formatSavedAt = (ts: number): string => {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
};

import {
  LogoIcon,
  PlayIcon,
  CodeBracketIcon,
  FolderOpenIcon,
  PlusIcon,
  MinusIcon,
  Bars3Icon,
  CogIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  SparklesIcon,
  ArrowsPointingOutIcon,
  Squares2X2Icon,
  CheckIcon,
  ArrowPathIcon,
  StarIcon,
  ArrowDownTrayIcon,
  SunIcon,
  MoonIcon,
} from "./components/icons";
import { useTheme } from "./contexts/ThemeContext";
import useHistoryState from "./hooks/useHistoryState";
import { DataPreviewModal } from "./components/DataPreviewModal";
import { StatisticsPreviewModal } from "./components/StatisticsPreviewModal";
import { SplitDataPreviewModal } from "./components/SplitDataPreviewModal";
import { TrainedModelPreviewModal } from "./components/TrainedModelPreviewModal";
import { TrainedClusteringModelPreviewModal } from "./components/TrainedClusteringModelPreviewModal";
import { ClusteringDataPreviewModal } from "./components/ClusteringDataPreviewModal";
import { StatsModelsResultPreviewModal } from "./components/StatsModelsResultPreviewModal";
import { DiversionCheckerPreviewModal } from "./components/DiversionCheckerPreviewModal";
import { EvaluateStatPreviewModal } from "./components/EvaluateStatPreviewModal";
import { XoLPricePreviewModal } from "./components/XoLPricePreviewModal";
import { FinalXolPricePreviewModal } from "./components/FinalXolPricePreviewModal";
import { PredictModelPreviewModal } from "./components/PredictModelPreviewModal";
import { EvaluationPreviewModal } from "./components/EvaluationPreviewModal";
import { ModelReportPreviewModal } from "./components/ModelReportPreviewModal";
import { ColumnPlotPreviewModal } from "./components/ColumnPlotPreviewModal";
import { OutlierDetectorPreviewModal } from "./components/OutlierDetectorPreviewModal";
import { HypothesisTestingPreviewModal } from "./components/HypothesisTestingPreviewModal";
import { NormalityCheckerPreviewModal } from "./components/NormalityCheckerPreviewModal";
import { CorrelationPreviewModal } from "./components/CorrelationPreviewModal";
import { JMDCCohortPreviewModal } from "./components/JMDCCohortPreviewModal";
import { JMDCIncidencePreviewModal } from "./components/JMDCIncidencePreviewModal";
import { JMDCSurvivalPreviewModal } from "./components/JMDCSurvivalPreviewModal";
import { JMDCCoxPreviewModal } from "./components/JMDCCoxPreviewModal";
import { JMDCMatcherPreviewModal } from "./components/JMDCMatcherPreviewModal";
import { ModelComparisonModal } from "./components/ModelComparisonModal";
import { RunHistoryModal } from "./components/RunHistoryModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { AIPipelineFromGoalModal } from "./components/AIPipelineFromGoalModal";
import { AIPipelineFromDataModal } from "./components/AIPipelineFromDataModal";
import { AIPlanDisplayModal } from "./components/AIPlanDisplayModal";
import { PipelineCodePanel } from "./components/PipelineCodePanel";
import { ErrorModal } from "./components/ErrorModal";
import SamplesModal from "./components/SamplesModal";
import { SamplesManagementModal } from "./components/SamplesManagementModal";
import { getClaudeClient, extractText, CLAUDE_CAPABLE, OPEN_API_KEY_SETTINGS_EVENT } from './lib/aiClient';
import { ApiKeySettingsModal } from "./components/ApiKeySettingsModal";
import { AdvancedUnlockModal } from "./components/AdvancedUnlockModal";
import { useAdvancedFeature, ADVANCED_BTN_DIM, AdvancedLockBadge } from "./contexts/AdvancedFeatureContext";
import { savePipeline, loadPipeline } from "./utils/fileOperations";
import { setPyodideStatusCallback } from "./utils/pyodideRunner";
import { bindDatasetsToModules, contentSizeMB, EMBED_SIZE_LIMIT_MB, resolveDatasetContent, uploadDatasetToWeb } from "./utils/datasetRegistry";
import { SaveModelOptionsModal, type LoaderDataInfo, type SaveDecisions } from "./components/SaveModelOptionsModal";
import { classifyPythonError, validateModuleParameters, validateModuleConnections } from "./utils/pipelineValidation";
import { autoLayoutModules } from "./utils/autoLayout";
import { copyShareLink, detectSharedPipeline } from "./utils/pipelineShare";
import { CanvasMinimap } from "./components/CanvasMinimap";
import { useAutoSave, loadLastWork, getLastWorkMeta, type LastWorkMeta } from "./hooks/useAutoSave";
// Samples와 Examples는 빌드 시점에 생성된 JSON 파일에서 직접 로드하므로 import 제거

type TerminalLog = {
  id: number;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  message: string;
  timestamp: string;
};

type RunHistorySession = {
  id: string;
  timestamp: number;
  results: Array<{
    name: string;
    type: string;
    status: ModuleStatus;
    executionTime?: number;
  }>;
};

type PropertiesTab = "properties" | "preview" | "code" | "terminal";

// --- Helper Functions (classifyPythonError, validateModuleParameters, validateModuleConnections
//     are imported from utils/pipelineValidation.ts)

// Sigmoid function for logistic regression predictions
const sigmoid = (x: number): number => {
  return 1 / (1 + Math.exp(-x));
};

// Helper function to determine model type
const isClassification = (
  modelType: ModuleType,
  modelPurpose?: "classification" | "regression"
): boolean => {
  const classificationTypes = [
    ModuleType.LogisticRegression,
    ModuleType.LDA,
    ModuleType.NaiveBayes,
  ];
  const dualPurposeTypes = [
    ModuleType.KNN,
    ModuleType.DecisionTree,
    ModuleType.RandomForest,
    ModuleType.GradientBoosting,
    ModuleType.NeuralNetwork,
    ModuleType.SVM,
  ];

  if (classificationTypes.includes(modelType)) {
    return true;
  }
  if (
    dualPurposeTypes.includes(modelType) &&
    modelPurpose === "classification"
  ) {
    return true;
  }
  return false;
};

// All regression and statistical calculations are now performed using Pyodide (Python)
// These JavaScript implementations have been removed to ensure Python-compatible results

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [modules, setModules, undo, redo, resetModules, canUndo, canRedo] =
    useHistoryState<CanvasModule[]>([]);
  const [connections, _setConnections] = useState<Connection[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [projectName, setProjectName] = useState("Data Analysis");
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);

  const [scale, setScale] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewingDataForModule, setViewingDataForModule] =
    useState<CanvasModule | null>(null);
  const [viewingSplitDataForModule, setViewingSplitDataForModule] =
    useState<CanvasModule | null>(null);
  const [viewingTrainedModel, setViewingTrainedModel] =
    useState<CanvasModule | null>(null);
  const [viewingStatsModelsResult, setViewingStatsModelsResult] =
    useState<CanvasModule | null>(null);
  const [viewingDiversionChecker, setViewingDiversionChecker] =
    useState<CanvasModule | null>(null);
  const [viewingEvaluateStat, setViewingEvaluateStat] =
    useState<CanvasModule | null>(null);
  const [viewingXoLPrice, setViewingXoLPrice] = useState<CanvasModule | null>(
    null
  );
  const [viewingFinalXolPrice, setViewingFinalXolPrice] =
    useState<CanvasModule | null>(null);
  const [viewingEvaluation, setViewingEvaluation] =
    useState<CanvasModule | null>(null);
  const [viewingPredictModel, setViewingPredictModel] =
    useState<CanvasModule | null>(null);
  const [viewingColumnPlot, setViewingColumnPlot] =
    useState<CanvasModule | null>(null);
  const [viewingOutlierDetector, setViewingOutlierDetector] =
    useState<CanvasModule | null>(null);
  const [viewingHypothesisTesting, setViewingHypothesisTesting] =
    useState<CanvasModule | null>(null);
  const [viewingNormalityChecker, setViewingNormalityChecker] =
    useState<CanvasModule | null>(null);
  const [viewingCorrelation, setViewingCorrelation] =
    useState<CanvasModule | null>(null);
  const [viewingClusteringData, setViewingClusteringData] =
    useState<CanvasModule | null>(null);
  const [viewingTrainedClusteringModel, setViewingTrainedClusteringModel] =
    useState<CanvasModule | null>(null);
  const [viewingModelReport, setViewingModelReport] =
    useState<CanvasModule | null>(null);
  // JMDC Analysis (PRD v2.0 §17, J1~J7)
  const [viewingJMDCCohort, setViewingJMDCCohort] = useState<CanvasModule | null>(null);
  const [viewingJMDCIncidence, setViewingJMDCIncidence] = useState<CanvasModule | null>(null);
  const [viewingJMDCSurvival, setViewingJMDCSurvival] = useState<CanvasModule | null>(null);
  const [viewingJMDCCox, setViewingJMDCCox] = useState<CanvasModule | null>(null);
  const [viewingJMDCMatcher, setViewingJMDCMatcher] = useState<CanvasModule | null>(null);

  const [showModelComparison, setShowModelComparison] = useState(false);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistorySession[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  // 고급기능(AI·PPT·코드·API) 잠금 게이트
  const { isUnlocked: isAdvancedUnlocked } = useAdvancedFeature();
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  // AI 호출부에서 키가 없을 때 자동으로 설정 모달을 연다.
  useEffect(() => {
    const open = () => setIsApiKeyModalOpen(true);
    window.addEventListener(OPEN_API_KEY_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_API_KEY_SETTINGS_EVENT, open);
  }, []);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // #11: Run All 진행률 상태
  const [runAllProgress, setRunAllProgress] = useState<{ current: number; total: number } | null>(null);

  // '모델 분석보고서 생성' 버튼(고급) 진행 상태(중복 실행 방지·로딩 표시).
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [aiPipelineData, setAiPipelineData] = useState<{
    modules: any[];
    connections: any[];
    file?: { content: string; name: string };
  } | null>(null);
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false);
  const [isSamplesManagementOpen, setIsSamplesManagementOpen] = useState(false);
  const sampleMenuRef = useRef<HTMLDivElement>(null);
  const [folderSamples, setFolderSamples] = useState<
    Array<{
      id?: number | string;
      modelId?: string;
      filename: string;
      name: string;
      data: any;
      inputData?: string;
      description?: string;
      category?: string;
      developerEmail?: string;
    }>
  >([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [isMyWorkMenuOpen, setIsMyWorkMenuOpen] = useState(false);
  const myWorkMenuRef = useRef<HTMLDivElement>(null);
  const [myWorkModels, setMyWorkModels] = useState<any[]>([]);
  // 마지막 작업(localStorage 영구 저장) 메타 — '내 작업' 메뉴 버튼 라벨/활성화용
  const [lastWorkMeta, setLastWorkMeta] = useState<LastWorkMeta | null>(null);
  const isSavingRef = useRef(false); // 저장 중 플래그
  // 샘플 로드 중에는 보고서 리셋을 억제(베이크된 폴백 보고서가 지워지지 않게).
  const suppressReportResetRef = useRef(false);
  // 저장 옵션 모달(데이터 포함/제외·웹 등록·설명 선택)
  const [saveOptions, setSaveOptions] = useState<{
    open: boolean;
    mode: "mywork" | "sample";
    name: string;
    loaders: LoaderDataInfo[];
  }>({ open: false, mode: "mywork", name: "", loaders: [] });
  const [isSavingModel, setIsSavingModel] = useState(false);

  // B-1: Pyodide 로딩 진행 상태
  const [pyodideStatus, setPyodideStatus] = useState<{ message: string; progress: number } | null>(null);

  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const [isCodePanelVisible, setIsCodePanelVisible] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    moduleName: string;
    message: string;
    details?: string;
  } | null>(null);
  const [activePropertiesTab, setActivePropertiesTab] =
    useState<PropertiesTab>("properties");
  const [rightPanelWidth, setRightPanelWidth] = useState(384); // w-96 in Tailwind is 384px

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const folderHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [suggestion, setSuggestion] = useState<{
    module: CanvasModule;
    connection: Connection;
  } | null>(null);
  const [clipboard, setClipboard] = useState<{
    modules: CanvasModule[];
    connections: Connection[];
  } | null>(null);
  const pasteOffset = useRef(0);

  const [isDirty, setIsDirty] = useState(false);
  const [saveButtonText, setSaveButtonText] = useState("저장");
  const [dfaPipelineInitialized, setDfaPipelineInitialized] = useState(false);

  // Canvas tabs: multiple canvases with add/rename
  const [tabs, setTabs] = useState<{ id: string; name: string; backgroundColor?: string }[]>([{ id: "tab-1", name: "Tab 1" }]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const tabContentsRef = useRef<Record<string, { modules: CanvasModule[]; connections: Connection[]; scale: number; pan: { x: number; y: number }; selectedModuleIds: string[] }>>({});
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState("");
  const prevActiveTabIdRef = useRef<string>("tab-1");
  const [tabContextMenu, setTabContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const tabContextMenuRef = useRef<HTMLDivElement>(null);

  // Draggable control panel state
  const [controlPanelPos, setControlPanelPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const isDraggingControlPanel = useRef(false);
  const controlPanelDragOffset = useRef({ x: 0, y: 0 });

  /**
   * 모델 구조·내용이 바뀌면(비-보고서 모듈의 파라미터/연결/추가·삭제) 기존
   * '모델 분석보고서' 모듈들을 미실행(Pending)·출력 비움 상태로 되돌린다.
   * 이렇게 하면 보고서가 변경 전 모델을 설명하는 stale 문서로 남지 않는다.
   * (보고서 자신·보고서로의 연결 변경은 호출 측에서 가드하여 제외한다.)
   * 보고서가 없으면 no-op. 일반 사용자에게도 안전(상태만 초기화).
   */
  const resetModelReportsOnChange = useCallback(() => {
    // 샘플 로드 중에는 억제(베이크된 폴백 보고서 보존).
    if (suppressReportResetRef.current) return;
    setModules((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (
          m.type === ModuleType.ModelAnalysisReport &&
          (m.outputData !== undefined || m.status !== ModuleStatus.Pending)
        ) {
          changed = true;
          return { ...m, status: ModuleStatus.Pending, outputData: undefined };
        }
        return m;
      });
      return changed ? next : prev;
    });
  }, [setModules]);

  const setConnections = useCallback(
    (value: React.SetStateAction<Connection[]>) => {
      const prevConnections = connections;
      const newConnections =
        typeof value === "function" ? value(prevConnections) : value;

      // If a connection to TrainModel is removed, mark connected model definition module as Pending
      const removedConnections = prevConnections.filter(
        (c) => !newConnections.some((nc) => nc.id === c.id)
      );

      removedConnections.forEach((removedConn) => {
        if (removedConn.to.moduleId) {
          const trainModelModule = modules.find(
            (m) =>
              m.id === removedConn.to.moduleId &&
              m.type === ModuleType.TrainModel
          );
          if (trainModelModule && removedConn.to.portName === "model_in") {
            const modelDefinitionModuleId = removedConn.from.moduleId;
            setModules((prev) =>
              prev.map((m) => {
                if (
                  m.id === modelDefinitionModuleId &&
                  MODEL_DEFINITION_TYPES.includes(m.type)
                ) {
                  return {
                    ...m,
                    status: ModuleStatus.Pending,
                    outputData: undefined,
                  };
                }
                return m;
              })
            );
          }
        }
      });

      _setConnections(newConnections);
      setIsDirty(true);

      // 모델 구조(연결) 변경 시 기존 '모델 분석보고서' 리셋.
      // 단, 보고서 모듈 자신을 한쪽 끝으로 하는 연결의 추가·삭제는 제외(보고서 자동연결/배선).
      const addedConnections = newConnections.filter(
        (nc) => !prevConnections.some((c) => c.id === nc.id)
      );
      const isReportEndpoint = (c: Connection) =>
        modules.some(
          (m) =>
            m.type === ModuleType.ModelAnalysisReport &&
            (m.id === c.from.moduleId || m.id === c.to.moduleId)
        );
      const structuralChange = [...addedConnections, ...removedConnections].some(
        (c) => !isReportEndpoint(c)
      );
      if (structuralChange) resetModelReportsOnChange();
    },
    [connections, modules, setModules, resetModelReportsOnChange]
  );

  // Save current canvas state to the active tab (for tab switching)
  const saveCurrentTabContent = useCallback(() => {
    tabContentsRef.current[activeTabId] = {
      modules: JSON.parse(JSON.stringify(modules)),
      connections: JSON.parse(JSON.stringify(connections)),
      scale,
      pan: { ...pan },
      selectedModuleIds: [...selectedModuleIds],
    };
  }, [activeTabId, modules, connections, scale, pan, selectedModuleIds]);

  // B-1: Pyodide 로딩 상태 콜백 등록
  useEffect(() => {
    setPyodideStatusCallback((message, progress) => {
      if (message) {
        setPyodideStatus({ message, progress });
      } else {
        setPyodideStatus(null);
      }
    });
    return () => {
      setPyodideStatusCallback(null);
    };
  }, []);

  // #5: 자동 저장 / 복원 (hooks/useAutoSave.ts)
  useAutoSave({
    modules,
    connections,
    projectName,
    onRestore: (savedModules, savedConnections, savedProjectName) => {
      resetModules(savedModules);
      _setConnections(savedConnections);
      if (savedProjectName) setProjectName(savedProjectName);
    },
    onRestoreLog: (message) => addLog('INFO', message),
  });

  // URL 해시에서 공유 파이프라인 감지 및 복원
  useEffect(() => {
    const shared = detectSharedPipeline();
    if (shared) {
      resetModules(shared.modules);
      _setConnections(shared.connections);
      if (shared.projectName) setProjectName(shared.projectName);
      window.history.replaceState(null, '', window.location.pathname);
      addLog('SUCCESS', `공유된 파이프라인 '${shared.projectName}'을 불러왔습니다.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When active tab changes, restore that tab's canvas state
  useEffect(() => {
    if (prevActiveTabIdRef.current === activeTabId) return;
    const data = tabContentsRef.current[activeTabId];
    if (data) {
      resetModules(data.modules);
      _setConnections(data.connections);
      setScale(data.scale);
      setPan(data.pan);
      setSelectedModuleIds(data.selectedModuleIds);
    } else {
      resetModules([]);
      _setConnections([]);
      setScale(0.8);
      setPan({ x: 0, y: 0 });
      setSelectedModuleIds([]);
    }
    prevActiveTabIdRef.current = activeTabId;
  }, [activeTabId, resetModules]);

  const handleTabClick = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    saveCurrentTabContent();
    setActiveTabId(tabId);
  }, [activeTabId, saveCurrentTabContent]);

  const handleAddTab = useCallback(() => {
    saveCurrentTabContent();
    const newId = `tab-${Date.now()}`;
    setTabs((prev) => [...prev, { id: newId, name: `Tab ${prev.length + 1}` }]);
    setActiveTabId(newId);
  }, [saveCurrentTabContent]);

  const handleTabRename = useCallback((tabId: string, newName: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name: newName.trim() || t.name } : t)));
    setEditingTabId(null);
  }, []);

  const handleDeleteTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;
    saveCurrentTabContent();
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    delete tabContentsRef.current[tabId];
    if (activeTabId === tabId) {
      const idx = tabs.findIndex((t) => t.id === tabId);
      const newActiveId = (idx > 0 ? tabs[idx - 1] : nextTabs[0])?.id;
      if (newActiveId) {
        setActiveTabId(newActiveId);
        prevActiveTabIdRef.current = newActiveId;
      }
    }
    setTabs(nextTabs);
    setTabContextMenu(null);
  }, [activeTabId, tabs, saveCurrentTabContent]);

  const handleTabBackgroundColor = useCallback((tabId: string, color: string | undefined) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, backgroundColor: color } : t)));
    setTabContextMenu(null);
  }, []);

  useEffect(() => {
    if (!tabContextMenu) return;
    const close = (e: MouseEvent) => {
      if (tabContextMenuRef.current?.contains(e.target as Node)) return;
      setTabContextMenu(null);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [tabContextMenu]);

  // fix: Moved 'addLog' before 'handleSuggestModule' to fix "used before its declaration" error.
  const addLog = useCallback((level: TerminalLog["level"], message: string) => {
    setTerminalLogs((prev) => [
      ...prev,
      {
        id: Date.now(),
        level,
        message,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    if (level === "ERROR" || level === "WARN") {
      setIsRightPanelVisible(true);
      setIsCodePanelVisible(false); // 에러/경고 시 속성 패널 열면 코드 패널 닫기
    }
  }, []);

  const handleSuggestModule = useCallback(
    async (fromModuleId: string, fromPortName: string) => {
      clearSuggestion();
      const fromModule = modules.find((m) => m.id === fromModuleId);
      if (!fromModule) return;

      setIsAiGenerating(true);
      addLog(
        "INFO",
        `AI is suggesting a module to connect to '${fromModule.name}'...`
      );
      try {
        const ai = getClaudeClient();
        const fromPort = fromModule.outputs.find(
          (p) => p.name === fromPortName
        );
        if (!fromPort) throw new Error("Source port not found.");

        const availableModuleTypes = TOOLBOX_MODULES.map((m) => m.type).join(
          ", "
        );

        const prompt = `Given a module of type '${fromModule.type}' with an output port of type '${fromPort.type}', what is the single most logical module type to connect next?
Available module types: [${availableModuleTypes}].
Respond with ONLY the module type string, for example: 'ScoreModel'`;

        const response = await ai.messages.create({
          model: CLAUDE_CAPABLE,
          max_tokens: 16000,
          messages: [{ role: "user", content: prompt }],
        });

        const suggestedType = extractText(response) as ModuleType;
        const defaultModule = DEFAULT_MODULES.find(
          (m) => m.type === suggestedType
        );
        if (!defaultModule) {
          throw new Error(
            `AI suggested an unknown module type: '${suggestedType}'`
          );
        }

        const count =
          modules.filter((m) => m.type === suggestedType).length + 1;
        const newModule: CanvasModule = {
          id: `suggestion-${suggestedType}-${Date.now()}`,
          name: `${suggestedType} ${count}`,
          type: suggestedType,
          position: {
            x: fromModule.position.x,
            y: fromModule.position.y + 180,
          },
          status: ModuleStatus.Pending,
          parameters: { ...defaultModule.parameters },
          inputs: [...defaultModule.inputs],
          outputs: [...defaultModule.outputs],
        };

        const toPort = newModule.inputs.find((p) => p.type === fromPort.type);
        if (!toPort) {
          throw new Error(
            `Suggested module '${suggestedType}' has no compatible input port for type '${fromPort.type}'.`
          );
        }

        const newConnection: Connection = {
          id: `suggestion-conn-${Date.now()}`,
          from: { moduleId: fromModuleId, portName: fromPortName },
          to: { moduleId: newModule.id, portName: toPort.name },
        };

        setSuggestion({ module: newModule, connection: newConnection });
        addLog(
          "SUCCESS",
          `AI suggested connecting a '${suggestedType}' module.`
        );
      } catch (error: any) {
        console.error("AI suggestion failed:", error);
        addLog("ERROR", `AI suggestion failed: ${error.message}`);
      } finally {
        setIsAiGenerating(false);
      }
    },
    [modules, addLog]
  );

  const acceptSuggestion = useCallback(() => {
    if (suggestion) {
      const newModuleId = suggestion.module.id.replace("suggestion-", "");
      const newConnectionId = suggestion.connection.id.replace(
        "suggestion-",
        ""
      );

      const finalModule = { ...suggestion.module, id: newModuleId };
      const finalConnection = {
        ...suggestion.connection,
        id: newConnectionId,
        to: { ...suggestion.connection.to, moduleId: newModuleId },
      };

      setModules((prev) => [...prev, finalModule]);
      setConnections((prev) => [...prev, finalConnection]);
      setSuggestion(null);
      setIsDirty(true);
    }
  }, [suggestion, setModules, setConnections]);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startWidth = rightPanelWidth;
      const startX = e.clientX;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      // fix: Changed MouseEvent to globalThis.MouseEvent to match the native event type expected by window.addEventListener.
      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth - dx;

        const minWidth = 320; // Corresponds to w-80
        const maxWidth = 800; // An arbitrary upper limit

        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setRightPanelWidth(newWidth);
        }
      };

      const handleMouseUp = () => {
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [rightPanelWidth]
  );

  const handleToggleRightPanel = () => {
    setIsRightPanelVisible((prev) => {
      if (!prev) setIsCodePanelVisible(false); // 속성 패널 열면 코드 패널 닫기
      return !prev;
    });
  };

  const handleModuleDoubleClick = useCallback((id: string) => {
    setSelectedModuleIds((prev) => {
      if (prev.length === 1 && prev[0] === id) {
        return prev;
      }
      return [id];
    });
    setIsRightPanelVisible(true);
    setIsCodePanelVisible(false); // 모듈 더블클릭 시 코드 패널 닫기
    setActivePropertiesTab("properties");
  }, []);

  const handleFitToView = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const canvasRect = canvasContainerRef.current.getBoundingClientRect();

    if (modules.length === 0) {
      setPan({ x: 0, y: 0 });
      setScale(1);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const moduleWidth = 256; // w-64 (Updated from 192)
    const moduleHeight = 120; // approximate height

    modules.forEach((module) => {
      minX = Math.min(minX, module.position.x);
      minY = Math.min(minY, module.position.y);
      maxX = Math.max(maxX, module.position.x + moduleWidth);
      maxY = Math.max(maxY, module.position.y + moduleHeight);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // 왼쪽 패널(Toolbox) 너비: w-56 = 224px
    const leftPanelWidth = isLeftPanelVisible ? 224 : 0;
    // 오른쪽 패널(PropertiesPanel) 너비
    const rightPanelWidthActual = isRightPanelVisible ? rightPanelWidth : 0;

    // 사용 가능한 캔버스 영역 계산
    const availableWidth =
      canvasRect.width - leftPanelWidth - rightPanelWidthActual;
    const availableHeight = canvasRect.height;

    // 컨트롤 패널 높이 고려 (약 60px)
    const controlPanelHeight = 60;
    const availableHeightForContent = availableHeight - controlPanelHeight;

    const padding = 50;
    const scaleX = (availableWidth - padding * 2) / contentWidth;
    const scaleY = (availableHeightForContent - padding * 2) / contentHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    // 왼쪽 패널을 고려한 중앙 계산
    const centerX = leftPanelWidth + availableWidth / 2;
    const centerY = availableHeightForContent / 2;

    const newPanX = centerX - (minX + contentWidth / 2) * newScale;
    const newPanY = centerY - (minY + contentHeight / 2) * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [modules, isLeftPanelVisible, isRightPanelVisible, rightPanelWidth]);

  const handleRotateModules = useCallback(() => {
    if (modules.length === 0) return;

    const moduleWidth = 256; // w-64
    const moduleHeight = 120; // approximate height

    // Calculate bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    modules.forEach((module) => {
      minX = Math.min(minX, module.position.x);
      minY = Math.min(minY, module.position.y);
      maxX = Math.max(maxX, module.position.x + moduleWidth);
      maxY = Math.max(maxY, module.position.y + moduleHeight);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate center point
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Determine rotation direction based on aspect ratio
    // 세로가 긴 경우: 90도 반시계방향 (counter-clockwise) -> 가로 모드로 변환
    // 가로가 긴 경우: 90도 시계방향 (clockwise) -> 세로 모드로 변환
    const isVertical = contentHeight > contentWidth;
    const rotationAngle = isVertical ? -90 : 90; // -90 for counter-clockwise, 90 for clockwise
    const isConvertingToHorizontal = isVertical; // 세로 -> 가로 변환
    const spacingMultiplier = isConvertingToHorizontal ? 2 : 0.5; // 가로 모드: 2배 넓게, 세로 모드: 2배 작게

    // Convert angle to radians
    const angleRad = (rotationAngle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Rotate each module around the center point
    const rotatedModules = modules.map((module) => {
      // Translate to origin (center)
      const dx = module.position.x + moduleWidth / 2 - centerX;
      const dy = module.position.y + moduleHeight / 2 - centerY;

      // Rotate
      const rotatedDx = dx * cos - dy * sin;
      const rotatedDy = dx * sin + dy * cos;

      // Translate back
      const newX = centerX + rotatedDx - moduleWidth / 2;
      const newY = centerY + rotatedDy - moduleHeight / 2;

      return {
        ...module,
        position: { x: newX, y: newY },
      };
    });

    // Calculate new bounding box after rotation
    let newMinX = Infinity;
    let newMinY = Infinity;
    let newMaxX = -Infinity;
    let newMaxY = -Infinity;

    rotatedModules.forEach((module) => {
      newMinX = Math.min(newMinX, module.position.x);
      newMinY = Math.min(newMinY, module.position.y);
      newMaxX = Math.max(newMaxX, module.position.x + moduleWidth);
      newMaxY = Math.max(newMaxY, module.position.y + moduleHeight);
    });

    const newCenterX = (newMinX + newMaxX) / 2;
    const newCenterY = (newMinY + newMaxY) / 2;

    // Adjust spacing: 가로 모드로 변환 시 간격을 넓히고, 세로 모드로 변환 시 간격을 좁힘
    const adjustedModules = rotatedModules.map((module) => {
      // 모듈 중심점에서 새로운 중심점까지의 거리
      const moduleCenterX = module.position.x + moduleWidth / 2;
      const moduleCenterY = module.position.y + moduleHeight / 2;

      const offsetX = moduleCenterX - newCenterX;
      const offsetY = moduleCenterY - newCenterY;

      // 간격 조정 (중심점에서 멀어지거나 가까워지도록)
      const adjustedOffsetX = offsetX * spacingMultiplier;
      const adjustedOffsetY = offsetY * spacingMultiplier;

      return {
        ...module,
        position: {
          x: newCenterX + adjustedOffsetX - moduleWidth / 2,
          y: newCenterY + adjustedOffsetY - moduleHeight / 2,
        },
      };
    });

    setModules(adjustedModules);
    setIsDirty(true);

    // Fit to view after rotation
    setTimeout(() => handleFitToView(), 100);
  }, [modules, setModules, handleFitToView]);

  const handleRearrangeModules = useCallback(() => {
    if (modules.length === 0) return;

    // 1. Identify unconnected and connected modules
    const allModuleIds = new Set(modules.map((m) => m.id));
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {}; // Adjacency list for traversing

    modules.forEach((m) => {
      inDegree[m.id] = 0;
      outDegree[m.id] = 0;
      adj[m.id] = [];
    });

    const connectionsToUse = connections.filter(
      (c) =>
        c &&
        c.from &&
        c.to &&
        c.from.moduleId &&
        c.to.moduleId &&
        allModuleIds.has(c.from.moduleId) &&
        allModuleIds.has(c.to.moduleId)
    );

    connectionsToUse.forEach((conn) => {
      if (
        !conn ||
        !conn.from ||
        !conn.to ||
        !conn.from.moduleId ||
        !conn.to.moduleId
      )
        return;
      adj[conn.from.moduleId].push(conn.to.moduleId);
      inDegree[conn.to.moduleId]++;
      outDegree[conn.from.moduleId]++;
    });

    const unconnectedModuleIds = modules
      .filter((m) => inDegree[m.id] === 0 && outDegree[m.id] === 0)
      .map((m) => m.id);

    const connectedModuleIds = modules
      .filter((m) => !unconnectedModuleIds.includes(m.id))
      .map((m) => m.id);

    // 2. Compute Levels (Topological Depth) for Connected Modules
    // Simple longest path algorithm for DAGs
    const levels: Record<string, number> = {};

    const computeLevel = (id: string, visited: Set<string>): number => {
      if (levels[id] !== undefined) return levels[id];
      if (visited.has(id)) return 0; // Break cycle safely

      visited.add(id);

      // Find parents
      const parents = connectionsToUse
        .filter((c) => c.to.moduleId === id)
        .map((c) => c.from.moduleId);

      if (parents.length === 0) {
        levels[id] = 0;
      } else {
        let maxParentLevel = -1;
        parents.forEach((pid) => {
          maxParentLevel = Math.max(
            maxParentLevel,
            computeLevel(pid, new Set(visited))
          );
        });
        levels[id] = maxParentLevel + 1;
      }
      return levels[id];
    };

    connectedModuleIds.forEach((id) => computeLevel(id, new Set()));

    // 2.5. Adjust levels for model definition modules to match their data input's level
    // Model definition types that should be placed at the same level as their data input
    const MODEL_DEFINITION_TYPES: ModuleType[] = [
      ModuleType.LinearRegression,
      ModuleType.LogisticRegression,
      ModuleType.PoissonRegression,
      ModuleType.NegativeBinomialRegression,
      ModuleType.DecisionTree,
      ModuleType.RandomForest,
      ModuleType.GradientBoosting,
      ModuleType.NeuralNetwork,
      ModuleType.SVM,
      ModuleType.LDA,
      ModuleType.NaiveBayes,
      ModuleType.KNN,
      ModuleType.KMeans,
      ModuleType.PCA,
    ];

    // Unsupervised learning model types for Train Clustering Model
    const UNSUPERVISED_MODEL_TYPES: ModuleType[] = [
      ModuleType.KMeans,
      ModuleType.PCA,
    ];

    // Find TrainModel modules and adjust model definition and data input levels
    // Place them one level to the left (one level before) the TrainModel
    modules.forEach((module) => {
      if (module.type === ModuleType.TrainModel) {
        // Get TrainModel's level
        const trainModelLevel = levels[module.id] ?? 0;

        // Find model_in connection (model definition)
        const modelConn = connectionsToUse.find(
          (c) => c.to.moduleId === module.id && c.to.portName === "model_in"
        );
        // Find data_in connection (data input)
        const dataConn = connectionsToUse.find(
          (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
        );

        if (modelConn && dataConn) {
          const modelDefModule = modules.find(
            (m) => m.id === modelConn.from.moduleId
          );
          const dataModule = modules.find(
            (m) => m.id === dataConn.from.moduleId
          );

          if (
            modelDefModule &&
            dataModule &&
            MODEL_DEFINITION_TYPES.includes(modelDefModule.type)
          ) {
            // Set both model definition and data input to be one level before TrainModel
            // This ensures they appear one column to the left of TrainModel
            const targetLevel = Math.max(0, trainModelLevel - 1);
            levels[modelDefModule.id] = targetLevel;
            levels[dataModule.id] = targetLevel;
          }
        }
      }
    });

    // 2.5. Identify modules with exactly 2 inputs for special handling
    // Store parent IDs with connection information (port names and order)
    interface TwoInputInfo {
      parent1Id: string;
      parent2Id: string;
      parent1PortName: string;
      parent2PortName: string;
      parent1ConnIndex: number;
      parent2ConnIndex: number;
    }
    const modulesWithTwoInputs: Record<string, TwoInputInfo> = {};

    connectedModuleIds.forEach((moduleId) => {
      const parentConnections = connectionsToUse.filter(
        (c) => c.to.moduleId === moduleId
      );
      if (parentConnections.length === 2) {
        // Sort by port name priority (data_in > model_in > others) or connection order
        const sorted = parentConnections.sort((a, b) => {
          // Priority: data_in > model_in > others, then by connection order
          const getPriority = (portName: string) => {
            if (portName === "data_in") return 0;
            if (portName === "model_in") return 1;
            return 2;
          };
          const priorityDiff =
            getPriority(a.to.portName) - getPriority(b.to.portName);
          if (priorityDiff !== 0) return priorityDiff;
          // If same priority, use connection order (index in connectionsToUse)
          return connectionsToUse.indexOf(a) - connectionsToUse.indexOf(b);
        });

        modulesWithTwoInputs[moduleId] = {
          parent1Id: sorted[0].from.moduleId,
          parent2Id: sorted[1].from.moduleId,
          parent1PortName: sorted[0].to.portName,
          parent2PortName: sorted[1].to.portName,
          parent1ConnIndex: connectionsToUse.indexOf(sorted[0]),
          parent2ConnIndex: connectionsToUse.indexOf(sorted[1]),
        };
      }
    });

    // 2.6. Ensure all parent modules are at least one level before their children
    // This guarantees that input modules are always positioned one column to the left
    // of modules that use them, preventing overlap
    // This must run after all other level adjustments
    let changed = true;
    let iterations = 0;
    const maxIterations = 200; // Prevent infinite loops

    while (changed && iterations < maxIterations) {
      changed = false;
      connectionsToUse.forEach((conn) => {
        if (
          !conn ||
          !conn.from ||
          !conn.to ||
          !conn.from.moduleId ||
          !conn.to.moduleId
        )
          return;
        const parentId = conn.from.moduleId;
        const childId = conn.to.moduleId;
        const parentLevel = levels[parentId] ?? 0;
        const childLevel = levels[childId] ?? 0;

        // If parent is not at least one level before child, adjust parent level
        if (parentLevel >= childLevel) {
          const newParentLevel = Math.max(0, childLevel - 1);
          if (levels[parentId] !== newParentLevel) {
            levels[parentId] = newParentLevel;
            changed = true;
          }
        }
      });
      iterations++;
    }

    // 2.7. Adjust levels for modules with 2 inputs - make parents same level
    // But ensure they are still at least one level before the child
    Object.entries(modulesWithTwoInputs).forEach(([moduleId, info]) => {
      const childLevel = levels[moduleId] ?? 0;
      const parent1Level = levels[info.parent1Id] ?? 0;
      const parent2Level = levels[info.parent2Id] ?? 0;

      // Set both parents to the same level, but ensure they are at least one level before child
      const maxParentLevel = Math.max(parent1Level, parent2Level);
      const targetLevel = Math.max(0, Math.min(maxParentLevel, childLevel - 1));
      levels[info.parent1Id] = targetLevel;
      levels[info.parent2Id] = targetLevel;
    });

    // 2.8. Final pass: Ensure all parent modules are at least one level before their children
    // Run one more time after 2-input module adjustments
    changed = true;
    iterations = 0;
    while (changed && iterations < maxIterations) {
      changed = false;
      connectionsToUse.forEach((conn) => {
        if (
          !conn ||
          !conn.from ||
          !conn.to ||
          !conn.from.moduleId ||
          !conn.to.moduleId
        )
          return;
        const parentId = conn.from.moduleId;
        const childId = conn.to.moduleId;
        const parentLevel = levels[parentId] ?? 0;
        const childLevel = levels[childId] ?? 0;

        // If parent is not at least one level before child, adjust parent level
        if (parentLevel >= childLevel) {
          const newParentLevel = Math.max(0, childLevel - 1);
          if (levels[parentId] !== newParentLevel) {
            levels[parentId] = newParentLevel;
            changed = true;
          }
        }
      });
      iterations++;
    }

    // 3. Group nodes by Level
    const levelGroups: Record<number, string[]> = {};
    let maxLevel = 0;

    Object.entries(levels).forEach(([id, lvl]) => {
      if (!connectedModuleIds.includes(id)) return;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(id);
      maxLevel = Math.max(maxLevel, lvl);
    });

    // 3.5. Sort each level group: Model definition modules first (top), then others
    Object.keys(levelGroups).forEach((levelStr) => {
      const level = parseInt(levelStr);
      levelGroups[level].sort((a, b) => {
        const moduleA = modules.find((m) => m.id === a);
        const moduleB = modules.find((m) => m.id === b);
        const isModelDefA = moduleA
          ? MODEL_DEFINITION_TYPES.includes(moduleA.type)
          : false;
        const isModelDefB = moduleB
          ? MODEL_DEFINITION_TYPES.includes(moduleB.type)
          : false;

        // Model definition modules come first (top)
        if (isModelDefA && !isModelDefB) return -1;
        if (!isModelDefA && isModelDefB) return 1;
        return 0; // Keep original order for same type
      });
    });

    // 4. Layout Configuration
    const newModules = [...modules];
    const moduleWidth = 256; // w-64 (ML Auto Flow uses w-48 = 192px, but we'll use 256 for consistency)
    const moduleHeight = 110; // Height of module card
    const colSpacing = 60; // Horizontal gap
    const rowSpacing = 40; // Vertical gap between stacked items
    const initialX = 50;
    const initialY = 50;
    const groupGap = 100;

    // --- Place Unconnected Modules (Left Column) ---
    let maxX_Unconnected = initialX;
    let regularUnconnectedY = initialY;

    // Place regular unconnected modules first
    if (unconnectedModuleIds.length > 0) {
      unconnectedModuleIds.forEach((moduleId, index) => {
        const moduleIndex = newModules.findIndex((m) => m.id === moduleId);
        if (moduleIndex !== -1) {
          const x = initialX;
          const y = initialY + index * (moduleHeight + rowSpacing);
          newModules[moduleIndex].position = { x, y };
          regularUnconnectedY = y + moduleHeight + rowSpacing;
        }
      });
      maxX_Unconnected += moduleWidth;
    } else {
      maxX_Unconnected = initialX - groupGap; // Reset if empty
    }

    // --- Place Connected Modules (Layered Layout) ---
    const startX_Connected = maxX_Unconnected + groupGap;

    // Sort groups to minimize crossing (Heuristic: Average Y of parents)
    // We process levels 1..N
    for (let l = 1; l <= maxLevel; l++) {
      if (!levelGroups[l]) continue;
      levelGroups[l].sort((a, b) => {
        const getAvgParentY = (nodeId: string) => {
          const parents = connectionsToUse
            .filter((c) => c.to.moduleId === nodeId)
            .map((c) => c.from.moduleId);
          if (parents.length === 0) return 0;
          const parentYs = parents.map((pid) => {
            const pm = newModules.find((m) => m.id === pid);
            return pm ? pm.position.y : 0;
          });
          return parentYs.reduce((sum, y) => sum + y, 0) / parentYs.length;
        };
        return getAvgParentY(a) - getAvgParentY(b);
      });
    }

    // 5. Assign coordinates with 10-column wrapping logic
    const COLUMNS_PER_ROW = 10;
    const COLUMN_WIDTH = moduleWidth + colSpacing;

    // Track which modules have been placed (for special 2-input handling)
    const placedModules = new Set<string>();

    // We need to track the Y-offset for each "Row of Columns"
    let currentYBase = initialY;

    for (
      let rowStartLevel = 0;
      rowStartLevel <= maxLevel;
      rowStartLevel += COLUMNS_PER_ROW
    ) {
      let maxStackHeightInRow = 0;

      // First pass: determine max height needed for this row of columns
      for (let l = rowStartLevel; l < rowStartLevel + COLUMNS_PER_ROW; l++) {
        if (levelGroups[l]) {
          const stackHeight =
            levelGroups[l].length * (moduleHeight + rowSpacing);
          maxStackHeightInRow = Math.max(maxStackHeightInRow, stackHeight);
        }
      }

      // Second pass: Place nodes
      for (let l = rowStartLevel; l < rowStartLevel + COLUMNS_PER_ROW; l++) {
        if (!levelGroups[l]) continue;

        const group = levelGroups[l];
        const colIndex = l % COLUMNS_PER_ROW;
        const x = startX_Connected + colIndex * COLUMN_WIDTH;

        // Place stacked items
        group.forEach((moduleId, stackIndex) => {
          const moduleIndex = newModules.findIndex((m) => m.id === moduleId);
          if (moduleIndex === -1 || placedModules.has(moduleId)) return;

          // Default placement: Simple stacking from top of the row base
          const y = currentYBase + stackIndex * (moduleHeight + rowSpacing);
          newModules[moduleIndex].position = { x, y };
          placedModules.add(moduleId);
        });
      }

      // Advance Y base for the next row of columns
      currentYBase += maxStackHeightInRow + 80; // Extra padding between graph rows
    }

    // Post-process: Handle modules with 2 inputs
    // Case 1: Train Model - Arrange model definition and data input in same column, Train Model in middle
    // Case 2: Score Model - Adjust vertical position to show connections clearly
    Object.entries(modulesWithTwoInputs).forEach(([moduleId, info]) => {
      const parent1Id = info.parent1Id;
      const parent2Id = info.parent2Id;
      const moduleIndex = newModules.findIndex((m) => m.id === moduleId);
      const parent1Index = newModules.findIndex((m) => m.id === parent1Id);
      const parent2Index = newModules.findIndex((m) => m.id === parent2Id);

      if (moduleIndex === -1 || parent1Index === -1 || parent2Index === -1)
        return;

      const parent1 = newModules[parent1Index];
      const parent2 = newModules[parent2Index];
      const child = newModules[moduleIndex];
      const childModule = modules.find((m) => m.id === moduleId);

      // Check if one parent is a model definition module (for Train Model case)
      const parent1Module = modules.find((m) => m.id === parent1Id);
      const parent2Module = modules.find((m) => m.id === parent2Id);
      const isParent1ModelDef = parent1Module
        ? MODEL_DEFINITION_TYPES.includes(parent1Module.type)
        : false;
      const isParent2ModelDef = parent2Module
        ? MODEL_DEFINITION_TYPES.includes(parent2Module.type)
        : false;

      // Case 1: Train Model with model definition + data input
      if (
        childModule?.type === ModuleType.TrainModel &&
        (isParent1ModelDef || isParent2ModelDef)
      ) {
        // Identify which is model definition and which is data input
        const modelDefParent = isParent1ModelDef ? parent1 : parent2;
        const dataParent = isParent1ModelDef ? parent2 : parent1;
        const modelDefParentIndex = isParent1ModelDef
          ? parent1Index
          : parent2Index;
        const dataParentIndex = isParent1ModelDef ? parent2Index : parent1Index;

        // Get the level (should be same after level adjustment)
        const targetLevel = levels[dataParent.id] ?? 0;
        const colIndex = targetLevel % COLUMNS_PER_ROW;
        const targetX = startX_Connected + colIndex * COLUMN_WIDTH;

        // Place both parents in the same column, model definition on top, data input below
        const parentSpacing = moduleHeight + rowSpacing;
        // 모델 정의 모듈을 한 단계 위로 배치 (한 행 위)
        const modelDefY =
          Math.min(modelDefParent.position.y, dataParent.position.y) -
          (moduleHeight + rowSpacing);
        const dataY = modelDefY + parentSpacing;

        newModules[modelDefParentIndex].position = {
          x: targetX,
          y: modelDefY,
        };
        newModules[dataParentIndex].position = {
          x: targetX,
          y: dataY,
        };

        // Calculate middle Y position between the two parents
        const finalModelDefY = newModules[modelDefParentIndex].position.y;
        const finalDataY = newModules[dataParentIndex].position.y;
        const middleY = (finalModelDefY + finalDataY + moduleHeight) / 2;

        // Place Train Model at the middle Y position, next column
        const childLevel = levels[moduleId] ?? targetLevel + 1;
        const childColIndex = childLevel % COLUMNS_PER_ROW;
        const childX = startX_Connected + childColIndex * COLUMN_WIDTH;

        newModules[moduleIndex].position = {
          x: childX,
          y: middleY - moduleHeight / 2,
        };
      }
      // Case 1.5: Train Clustering Model with unsupervised model + data input
      else if (
        childModule?.type === ModuleType.TrainClusteringModel &&
        (isParent1Unsupervised || isParent2Unsupervised)
      ) {
        // Identify which is unsupervised model and which is data input
        const unsupervisedParent = isParent1Unsupervised ? parent1 : parent2;
        const dataParent = isParent1Unsupervised ? parent2 : parent1;
        const unsupervisedParentIndex = isParent1Unsupervised
          ? parent1Index
          : parent2Index;
        const dataParentIndex = isParent1Unsupervised
          ? parent2Index
          : parent1Index;

        // Get the level (should be same after level adjustment)
        const targetLevel = levels[dataParent.id] ?? 0;
        const colIndex = targetLevel % COLUMNS_PER_ROW;
        const targetX = startX_Connected + colIndex * COLUMN_WIDTH;

        // Place both parents in the same column, unsupervised model on top, data input below
        const parentSpacing = moduleHeight + rowSpacing;
        // 비지도학습 모듈을 한 단계 위로 배치 (한 행 위)
        const unsupervisedY =
          Math.min(unsupervisedParent.position.y, dataParent.position.y) -
          (moduleHeight + rowSpacing);
        const dataY = unsupervisedY + parentSpacing;

        newModules[unsupervisedParentIndex].position = {
          x: targetX,
          y: unsupervisedY,
        };
        newModules[dataParentIndex].position = {
          x: targetX,
          y: dataY,
        };

        // Calculate middle Y position between the two parents
        const finalUnsupervisedY =
          newModules[unsupervisedParentIndex].position.y;
        const finalDataY = newModules[dataParentIndex].position.y;
        const middleY = (finalUnsupervisedY + finalDataY + moduleHeight) / 2;

        // Place Train Clustering Model at the middle Y position, next column
        const childLevel = levels[moduleId] ?? targetLevel + 1;
        const childColIndex = childLevel % COLUMNS_PER_ROW;
        const childX = startX_Connected + childColIndex * COLUMN_WIDTH;

        newModules[moduleIndex].position = {
          x: childX,
          y: middleY - moduleHeight / 2,
        };
      }
      // Case 1.5: Train Clustering Model with unsupervised model + data input
      else if (
        childModule?.type === ModuleType.TrainClusteringModel &&
        (isParent1Unsupervised || isParent2Unsupervised)
      ) {
        // Identify which is unsupervised model and which is data input
        const unsupervisedParent = isParent1Unsupervised ? parent1 : parent2;
        const dataParent = isParent1Unsupervised ? parent2 : parent1;
        const unsupervisedParentIndex = isParent1Unsupervised
          ? parent1Index
          : parent2Index;
        const dataParentIndex = isParent1Unsupervised
          ? parent2Index
          : parent1Index;

        // Get the level (should be same after level adjustment)
        const targetLevel = levels[dataParent.id] ?? 0;
        const colIndex = targetLevel % COLUMNS_PER_ROW;
        const targetX = startX_Connected + colIndex * COLUMN_WIDTH;

        // Place both parents in the same column, unsupervised model on top, data input below
        const parentSpacing = moduleHeight + rowSpacing;
        // 비지도학습 모듈을 한 단계 위로 배치 (한 행 위)
        const unsupervisedY =
          Math.min(unsupervisedParent.position.y, dataParent.position.y) -
          (moduleHeight + rowSpacing);
        const dataY = unsupervisedY + parentSpacing;

        newModules[unsupervisedParentIndex].position = {
          x: targetX,
          y: unsupervisedY,
        };
        newModules[dataParentIndex].position = {
          x: targetX,
          y: dataY,
        };

        // Calculate middle Y position between the two parents
        const finalUnsupervisedY =
          newModules[unsupervisedParentIndex].position.y;
        const finalDataY = newModules[dataParentIndex].position.y;
        const middleY = (finalUnsupervisedY + finalDataY + moduleHeight) / 2;

        // Place Train Clustering Model at the middle Y position, next column
        const childLevel = levels[moduleId] ?? targetLevel + 1;
        const childColIndex = childLevel % COLUMNS_PER_ROW;
        const childX = startX_Connected + childColIndex * COLUMN_WIDTH;

        newModules[moduleIndex].position = {
          x: childX,
          y: middleY - moduleHeight / 2,
        };
      }
      // Case 2: Score Model or other 2-input modules - adjust vertical position for visibility
      else {
        // Get current positions
        const parent1Y = parent1.position.y;
        const parent2Y = parent2.position.y;
        const childY = child.position.y;

        // Calculate ideal Y position (middle of parents)
        const idealY = (parent1Y + parent2Y + moduleHeight) / 2;
        const idealChildY = idealY - moduleHeight / 2;

        // Only adjust if the child is not already close to the ideal position
        // This allows for minor adjustments to show connections clearly
        const threshold = moduleHeight / 2;
        if (Math.abs(childY - idealChildY) > threshold) {
          // Adjust child position to be closer to middle of parents
          const childLevel = levels[moduleId] ?? 0;
          const childColIndex = childLevel % COLUMNS_PER_ROW;
          const childX = startX_Connected + childColIndex * COLUMN_WIDTH;

          newModules[moduleIndex].position = {
            x: childX,
            y: idealChildY,
          };
        }
      }
    });

    setModules(newModules);
    setIsDirty(true);
    setTimeout(() => handleFitToView(), 0);
  }, [modules, connections, setModules, handleFitToView]);

  const handleGeneratePipeline = async (
    prompt: string,
    type: "goal" | "data",
    file?: { content: string; name: string },
    analysisOnly: boolean = false
  ) => {
    setIsAiGenerating(true);
    addLog("INFO", "AI pipeline generation started...");
    try {
      // API 키 확인
      const ai = getClaudeClient();

      const moduleDescriptions: Record<string, string> = {
        LoadData: "Loads a dataset from a user-provided CSV file.",
        Statistics:
          "Calculates descriptive statistics and correlation matrix for a dataset.",
        SelectData: "Selects or removes specific columns from a dataset.",
        HandleMissingValues:
          "Handles missing (null) values in a dataset by removing rows or filling values.",
        EncodeCategorical:
          "Converts categorical (string) columns into numerical format for modeling.",
        NormalizeData:
          "Scales numerical features to a standard range (e.g., 0-1).",
        TransitionData:
          "Applies mathematical transformations (e.g., log, sqrt) to numeric columns.",
        SplitData: "Splits a dataset into training and testing sets.",
        LinearRegression: "Defines a scikit-learn Linear Regression model.",
        LogisticRegression:
          "Defines a Logistic Regression model for classification.",
        DecisionTreeClassifier:
          "Defines a Decision Tree model for classification.",
        StatModels:
          "Defines a statistical model from the statsmodels library (e.g., OLS, Logit).",
        TrainModel: "Trains a model algorithm using a training dataset.",
        ResultModel:
          "Fits a statistical model (from StatModels) to a dataset and shows the results summary.",
        ScoreModel:
          "Applies a trained ML model to a dataset to generate predictions.",
        PredictModel:
          "Applies a fitted statistical model to a dataset to generate predictions.",
        EvaluateModel:
          "Evaluates the performance of a trained model on a test dataset.",
      };

      const detailedModulesString = DEFAULT_MODULES.map((defaultModule) => {
        const moduleInfo = TOOLBOX_MODULES.find(
          (m) => m.type === defaultModule.type
        );
        const description =
          moduleDescriptions[defaultModule.type] || "A standard module.";
        return `
- type: ${defaultModule.type}
  name: ${moduleInfo?.name}
  description: ${description}
  inputs: ${JSON.stringify(defaultModule.inputs)}
  outputs: ${JSON.stringify(defaultModule.outputs)}
`;
      }).join("");

      const fullPrompt = `
You are an expert ML pipeline architect for a tool called "ML Pipeline Canvas Pro".
Your task is to generate a logical machine learning pipeline based on the user's goal and available data, and provide a clear plan for your design.
The pipeline MUST be a valid JSON object containing a 'plan', a list of 'modules', and the 'connections' between them.

### Available Modules & Their Ports
Here are the only modules you can use. You MUST NOT invent new module types. Each module has specific input and output ports. Use these exact port names and types for connections.
${detailedModulesString}

### User's Goal & Data
${prompt}

### Instructions
1.  **Comprehensive Data Analysis**: Before designing the pipeline, you MUST perform a thorough analysis of the dataset using the provided sample data. In the \`plan\` field, include a detailed "## 데이터셋 분석" section that covers:
    *   **컬럼 타입**: Analyze each column from the sample data and identify the data type (numeric (int/float), categorical (string), datetime, boolean, etc.). For each column, specify its type clearly.
    *   **통계적 특성**: 
        - For numeric columns: Calculate and report mean, median, std, min, max, quartiles
        - For categorical columns: Count unique values, identify most frequent values, check cardinality
        - For all columns: Report the total number of rows and any patterns you observe
    *   **결측치 현황**: 
        - Check for missing values (null, NaN, empty strings, etc.) in each column
        - Report the count and percentage of missing data for each column
        - Identify columns with significant missing data (>5%, >10%, >50%)
    *   **이상치 여부**: 
        - For numeric columns: Use statistical methods (IQR method, Z-score) to identify potential outliers
        - Report which columns have outliers and estimate the percentage
        - Consider the impact of outliers on the analysis
    *   **스케일링 필요 여부**: 
        - Examine the scale and range of numerical features
        - Check if features have vastly different scales (e.g., one column ranges 0-1, another 0-10000)
        - Determine if normalization or standardization is needed
        - Specify which columns would benefit from scaling
    *   **인코딩 필요 여부**: 
        - Identify categorical columns (string columns, non-numeric categories)
        - Determine the encoding method needed (one-hot encoding for low cardinality, label encoding for ordinal, etc.)
        - Check if there are high-cardinality categorical features that might need special handling
    *   **분석 방식 적합성 판단**: Based on the data characteristics and user's goal, determine which type of analysis is most suitable:
        - **지도학습 (Supervised Learning)**: 
            - 분류 (Classification): If the goal involves predicting categories/classes
            - 회귀 (Regression): If the goal involves predicting continuous values
        - **비지도학습 (Unsupervised Learning)**: 
            - 군집화 (Clustering): If the goal is to find patterns or groups in data
            - 차원 축소 (Dimensionality Reduction): If there are many features that need reduction
        - **예측 (Prediction)**: General prediction tasks
    *   **Label 특성 분석** (if label column is identified or can be inferred from the goal):
        - **범주형/연속형 여부**: Determine if the label is categorical (classification task) or continuous (regression task)
        - **불균형 여부**: For classification tasks, check if classes are imbalanced (one class significantly more frequent than others)
        - **분포 특성**: Analyze the distribution of the label (normal distribution, skewed, uniform, etc.)
        - **클래스 수**: For classification, report the number of unique classes

2.  **Pipeline Design**: Based on the comprehensive data analysis, design an optimal pipeline using the available modules. In the \`plan\` field, include a "## 파이프라인 설계" section that explains:
    *   **단계별 모듈 선택 및 이유**: For each step in the pipeline, specify:
        - Which module to use (e.g., HandleMissingValues, EncodeCategorical, NormalizeData, SplitData, TrainModel, etc.)
        - WHY this module is necessary based on the data analysis results
        - What problem it solves or what transformation it performs
        - How it addresses the issues identified in the data analysis (e.g., "결측치가 10% 이상인 컬럼이 있으므로 HandleMissingValues 모듈을 사용하여 결측치를 처리합니다")
    *   **모듈 파라미터 설정 및 근거**: For each module, recommend specific parameter settings and explain the reasoning in detail:
        - **HandleMissingValues (Missing Transform)**: 
            - Which method to use (remove rows, impute with mean/median/mode/constant) and why
            - Which columns need missing value handling based on the analysis
            - If using imputation, explain why mean vs median vs mode is chosen
        - **EncodeCategorical (Encoding Transform)**: 
            - Which encoding method to use (one-hot encoding, label encoding, etc.) and why
            - Which categorical columns need encoding
            - How to handle high-cardinality categorical features
        - **NormalizeData (Scaling Transform)**: 
            - Which scaling method to use (MinMaxScaler, StandardScaler, etc.) and why
            - Which columns need scaling based on the scale analysis
            - Explain the impact of scaling on the model performance
        - **SplitData**: 
            - What train/test split ratio to use (e.g., 80/20, 70/30) and why
            - Whether stratified splitting is needed (for imbalanced classification)
            - Random seed considerations
        - **TrainModel**: 
            - Which algorithm to use (LinearRegression, LogisticRegression, DecisionTree, RandomForest, etc.) and why
            - Feature selection considerations
            - Hyperparameter recommendations if applicable
        - **Other modules**: 
            - Appropriate parameter settings based on data characteristics
            - Explain how each parameter choice addresses the data analysis findings
    *   **전체 파이프라인 순서**: Present the complete pipeline flow in a clear, numbered, sequential order showing:
        - The exact order of modules from LoadData to final output
        - How data flows through each module
        - The connections between modules
        - The final output or result expected from the pipeline

3.  **Select Modules**: Choose a logical sequence of modules from the list above to accomplish the goal. Start with 'LoadData'. If the data has categorical features (strings), you MUST use the 'EncodeCategorical' module. If there are missing values, use 'HandleMissingValues'.
4.  **Configure Modules**:
    *   Provide a short, descriptive \`name\` for each module instance.
    *   If column names are available, set the \`parameters\` for modules like 'TrainModel' or 'ResultModel' by inferring the 'feature_columns' and 'label_column'.
5.  **Define Connections**:
    *   Create connections between the modules using their 0-based index in the 'modules' array.
    *   **CRITICAL**: Connect output ports to input ports. The \`type\` of the ports must match (e.g., 'data' to 'data', 'model' to 'model'). Use the exact port names from the module list.
6.  **Create an Execution Plan**: In the \`plan\` field, provide a comprehensive explanation in Korean using Markdown. The plan MUST include:
    *   **## 데이터셋 분석** section (as described in step 1): This should be the first section, providing a thorough analysis of the dataset before any pipeline design.
    *   **## 파이프라인 설계** section (as described in step 2): This should explain the rationale behind each module choice and parameter setting.
    *   **## 파이프라인 실행 순서** section: A clear, numbered list showing:
        - The complete execution order of all modules from start to finish
        - For each module, briefly state what it does and what its output is
        - Show the data flow: which module's output becomes which module's input
        - Example format:
          1. LoadData: 데이터 파일을 로드합니다. 출력: 원본 데이터
          2. HandleMissingValues: 결측치를 처리합니다. 입력: LoadData의 출력. 출력: 결측치 처리된 데이터
          3. EncodeCategorical: 범주형 변수를 인코딩합니다. 입력: HandleMissingValues의 출력. 출력: 인코딩된 데이터
          ... (continue for all modules)
    *   **IMPORTANT**: If you cannot fully satisfy the user's request with the available modules (e.g., user asks for "time series analysis" but there's no such module), build the best possible pipeline with the existing tools. Then, in the plan, create a "## 추가 제안" section and clearly state the limitations and what the user should do next to fully achieve their goal. DO NOT invent modules.
7.  **Final Output**: Respond ONLY with a single, valid JSON object that conforms to the schema below. Do not include any explanatory text, markdown formatting, or anything else outside the JSON structure.

### JSON Output Schema
The JSON object must contain 'plan', 'modules', and 'connections'.
- \`plan\`: A string containing the Markdown explanation of your pipeline design.
- \`modules\`: An array of module objects.
- \`connections\`: An array of connection objects.
`;

      // Claude는 Gemini responseSchema 대신 "오직 JSON으로 답하라" 프롬프트로 구조화 출력을 유도한다.
      // 위 fullPrompt 7번 지시("Respond ONLY with a single, valid JSON object...")가 이미 JSON-only를 명시.
      const response = await ai.messages.create({
        model: CLAUDE_CAPABLE,
        max_tokens: 16000,
        messages: [{ role: "user", content: fullPrompt }],
      });

      // 코드펜스(```json …```)가 섞여 오면 제거하고 JSON 본문만 파싱.
      let responseText = extractText(response);
      const fence = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence && fence[1]) responseText = fence[1].trim();
      const pipeline = JSON.parse(responseText);

      if (!pipeline.modules || !pipeline.connections || !pipeline.plan) {
        throw new Error(
          "AI response is missing 'plan', 'modules', or 'connections'."
        );
      }

      setAiPlan(pipeline.plan);

      // 파이프라인 데이터 저장 (나중에 생성 버튼에서 사용)
      setAiPipelineData({
        modules: pipeline.modules,
        connections: pipeline.connections,
        file: file,
      });

      // 분석만 수행하는 경우 파이프라인을 생성하지 않음
      if (analysisOnly) {
        addLog("SUCCESS", "데이터 분석이 완료되었습니다.");
        return;
      }

      // --- Render the generated pipeline ---
      const previousState = {
        modules: [...modules],
        connections: [...connections],
      };

      const newModules: CanvasModule[] = [];
      pipeline.modules.forEach((mod: any, index: number) => {
        const defaultData = DEFAULT_MODULES.find((m) => m.type === mod.type);
        if (!defaultData) {
          addLog(
            "WARN",
            `AI generated an unknown module type: '${mod.type}'. Skipping.`
          );
          return;
        }
        const newModule: CanvasModule = {
          id: `${mod.type}-${Date.now()}-${index}`,
          name: mod.name,
          type: mod.type as ModuleType,
          position: { x: 250, y: 100 + index * 150 }, // Simple vertical layout
          status: ModuleStatus.Pending,
          parameters: { ...defaultData.parameters, ...mod.parameters },
          inputs: [...defaultData.inputs],
          outputs: [...defaultData.outputs],
        };

        if (file && newModule.type === ModuleType.LoadData) {
          newModule.parameters.fileContent = file.content;
          newModule.parameters.source = file.name;
        }

        newModules.push(newModule);
      });

      const newConnections: Connection[] = [];
      pipeline.connections.forEach((conn: any, index: number) => {
        const fromModule = newModules[conn.fromModuleIndex];
        const toModule = newModules[conn.toModuleIndex];
        if (fromModule && toModule) {
          newConnections.push({
            id: `conn-ai-${Date.now()}-${index}`,
            from: { moduleId: fromModule.id, portName: conn.fromPort },
            to: { moduleId: toModule.id, portName: conn.toPort },
          });
        }
      });

      // Use a single state update for undo/redo
      setModules(newModules);
      setConnections(newConnections);
      setIsDirty(false);

      setTimeout(() => handleFitToView(), 0);

      addLog("SUCCESS", "AI successfully generated a new pipeline.");
    } catch (error: any) {
      console.error("AI pipeline generation failed:", error);
      addLog("ERROR", `AI generation failed: ${error.message}`);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleCreatePipelineFromAnalysis = () => {
    if (!aiPipelineData) {
      addLog("ERROR", "파이프라인 데이터가 없습니다.");
      return;
    }

    setIsAiGenerating(true);
    addLog("INFO", "파이프라인을 생성합니다...");
    try {
      const pipeline = {
        modules: aiPipelineData.modules,
        connections: aiPipelineData.connections,
      };

      // --- Render the generated pipeline ---
      const newModules: CanvasModule[] = [];
      pipeline.modules.forEach((mod: any, index: number) => {
        const defaultData = DEFAULT_MODULES.find((m) => m.type === mod.type);
        if (!defaultData) {
          addLog(
            "WARN",
            `AI generated an unknown module type: '${mod.type}'. Skipping.`
          );
          return;
        }
        const newModule: CanvasModule = {
          id: `${mod.type}-${Date.now()}-${index}`,
          name: mod.name,
          type: mod.type as ModuleType,
          position: { x: 250, y: 100 + index * 150 }, // Simple vertical layout
          status: ModuleStatus.Pending,
          parameters: { ...defaultData.parameters, ...mod.parameters },
          inputs: [...defaultData.inputs],
          outputs: [...defaultData.outputs],
        };

        if (aiPipelineData.file && newModule.type === ModuleType.LoadData) {
          newModule.parameters.fileContent = aiPipelineData.file.content;
          newModule.parameters.source = aiPipelineData.file.name;
        }

        newModules.push(newModule);
      });

      const newConnections: Connection[] = [];
      pipeline.connections.forEach((conn: any, index: number) => {
        const fromModule = newModules[conn.fromModuleIndex];
        const toModule = newModules[conn.toModuleIndex];
        if (fromModule && toModule) {
          newConnections.push({
            id: `conn-ai-${Date.now()}-${index}`,
            from: { moduleId: fromModule.id, portName: conn.fromPort },
            to: { moduleId: toModule.id, portName: conn.toPort },
          });
        }
      });

      // Use a single state update for undo/redo
      setModules(newModules);
      setConnections(newConnections);
      setIsDirty(false);

      setTimeout(() => handleFitToView(), 0);

      // 모달 닫기
      setAiPlan(null);
      setAiPipelineData(null);

      addLog("SUCCESS", "파이프라인이 성공적으로 생성되었습니다.");
    } catch (error: any) {
      console.error("Pipeline creation failed:", error);
      addLog("ERROR", `파이프라인 생성 실패: ${error.message}`);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleGeneratePipelineFromGoal = (goal: string) => {
    handleGeneratePipeline(`Goal: ${goal}`, "goal");
  };

  const handleAnalyzeData = async (
    goal: string,
    fileContent: string,
    fileName: string
  ) => {
    // 분석 시작 시 즉시 모달 열기
    setAiPlan("");
    setAiPipelineData(null);
    setIsAiGenerating(true);
    addLog("INFO", "데이터 분석을 시작합니다...");
    try {
      const lines = fileContent.trim().split("\n");
      if (lines.length === 0) {
        addLog("ERROR", "Uploaded file is empty.");
        setIsAiGenerating(false);
        return;
      }
      const header = lines[0];
      // 샘플 데이터를 더 많이 포함하여 분석에 활용 (최대 50행)
      const sampleRows = lines.slice(1, Math.min(51, lines.length)).join("\n");
      const totalRows = lines.length - 1; // 헤더 제외
      const dataPrompt = `
Goal: ${goal}

Data file: ${fileName}
Total rows: ${totalRows}
Column headers:
${header}
Sample data (first 50 rows for analysis):
${sampleRows}

Please analyze this dataset comprehensively and design an optimal pipeline.
`;

      // 분석만 수행 (파이프라인 생성은 하지 않음)
      await handleGeneratePipeline(
        dataPrompt,
        "data",
        {
          content: fileContent,
          name: fileName,
        },
        true
      ); // 분석만 수행하는 플래그
    } catch (error: any) {
      console.error("Data analysis failed:", error);
      addLog("ERROR", `데이터 분석 실패: ${error.message}`);
      setAiPlan(
        `## 오류 발생\n\n데이터 분석 중 오류가 발생했습니다: ${error.message}`
      );
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleGeneratePipelineFromData = (
    goal: string,
    fileContent: string,
    fileName: string
  ) => {
    handleAnalyzeData(goal, fileContent, fileName);
  };

  const handleSavePipeline = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      try {
        const pipelineState = { modules, connections, projectName };

        await savePipeline(pipelineState, {
          extension: ".ins",
          description: "ML Pipeline File",
          onSuccess: (fileName) => {
            addLog("SUCCESS", `Pipeline saved to '${fileName}'.`);
            setIsDirty(false);
            setSaveButtonText("저장됨!");
            setTimeout(() => setSaveButtonText("저장"), 2000);
          },
          onError: (error) => {
            console.error("Failed to save pipeline:", error);
            addLog("ERROR", `Failed to save pipeline: ${error.message}`);
          },
        });
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Failed to save pipeline:", error);
          addLog("ERROR", `Failed to save pipeline: ${error.message}`);
        }
      }
    },
    [modules, connections, projectName, addLog]
  );

  // ── 저장 옵션(데이터 포함/제외·웹 등록·설명) 지원 ──
  // 데이터 로더로 취급할 모듈 타입 판정.
  const isLoaderModuleType = useCallback(
    (t: ModuleType) =>
      t === ModuleType.LoadData || t === ModuleType.XolLoading,
    []
  );

  // 현재 모듈에서 데이터 로더 정보를 수집(저장 옵션 모달용).
  const collectLoaderInfos = useCallback(
    (mods: CanvasModule[]): LoaderDataInfo[] => {
      const out: LoaderDataInfo[] = [];
      for (const m of mods) {
        if (!isLoaderModuleType(m.type)) continue;
        const p: any = m.parameters || {};
        const content = typeof p.fileContent === "string" ? p.fileContent : "";
        out.push({
          moduleId: m.id,
          name: m.name || m.type,
          source: String(p.source || ""),
          sizeMB: content ? contentSizeMB(content) : 0,
          hasContent: !!content,
          description: String(p.dataDescription || ""),
        });
      }
      return out;
    },
    [isLoaderModuleType]
  );

  // 저장 옵션 모달 열기(mode: mywork=로컬 저장, sample=JSON 다운로드).
  const openSaveOptions = useCallback(
    (mode: "mywork" | "sample") => {
      if (modules.length === 0) {
        addLog("WARN", "저장할 모델이 없습니다. 먼저 모듈을 추가해주세요.");
        return;
      }
      setSaveOptions({
        open: true,
        mode,
        name:
          projectName ||
          (mode === "sample" ? "Untitled Sample" : "My Model"),
        loaders: collectLoaderInfos(modules),
      });
    },
    [modules, projectName, collectLoaderInfos, addLog]
  );

  const isQuotaError = (e: any): boolean =>
    !!e &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014);

  // 저장 옵션 모달 확정 시 실제 저장 수행.
  const performModelSave = useCallback(
    async (name: string, decisions: SaveDecisions) => {
      const mode = saveOptions.mode;
      setIsSavingModel(true);
      const warnings: string[] = [];
      try {
        // 모듈 파라미터에 결정 적용(필요 시 웹 업로드).
        const moduleOut = await Promise.all(
          modules.map(async (m) => {
            const params: any = { ...(m.parameters || {}) };
            const d = decisions[m.id];
            if (d && isLoaderModuleType(m.type)) {
              params.dataDescription = d.description || "";
              const content =
                typeof params.fileContent === "string"
                  ? params.fileContent
                  : "";
              if (d.registerToWeb && content) {
                const res = await uploadDatasetToWeb(
                  String(params.source || ""),
                  content
                );
                if (res.ok) {
                  // 참조 저장: 본문 제거, 파일명(source) 유지 → 로드 시 레지스트리/웹에서 해석.
                  delete params.fileContent;
                  params.sourceType = "file";
                  addLog(
                    "SUCCESS",
                    `'${m.name}' 데이터를 웹 예제로 등록했습니다: ${params.source}`
                  );
                } else {
                  warnings.push(
                    `'${m.name}' 웹 등록 실패(${res.error}). 데이터 본문은 그대로 둡니다.`
                  );
                }
              }
              // 사용자가 '제외' 선택(웹 등록이 아니면서 포함 해제) → 본문 제거.
              if (!d.include && !d.registerToWeb && params.fileContent) {
                delete params.fileContent;
              }
            }
            return {
              type: m.type,
              position: m.position || { x: 0, y: 0 },
              name: m.name || m.type,
              parameters: params,
            };
          })
        );

        const connOut = connections
          .map((c) => {
            const fromIndex = modules.findIndex(
              (m) => m.id === c.from.moduleId
            );
            const toIndex = modules.findIndex((m) => m.id === c.to.moduleId);
            if (fromIndex < 0 || toIndex < 0) return null;
            return {
              fromModuleIndex: fromIndex,
              fromPort: c.from.portName,
              toModuleIndex: toIndex,
              toPort: c.to.portName,
            };
          })
          .filter((c) => c !== null);

        const savedModel = { name, modules: moduleOut, connections: connOut };

        if (mode === "mywork") {
          const existingStr = localStorage.getItem("myWorkModels");
          let existing: any[] = [];
          try {
            existing = existingStr ? JSON.parse(existingStr) : [];
            if (!Array.isArray(existing)) existing = [];
          } catch {
            existing = [];
          }
          const updated = [
            ...existing.filter((m: any) => m.name !== name),
            savedModel,
          ];
          try {
            localStorage.setItem("myWorkModels", JSON.stringify(updated));
            setMyWorkModels(updated);
            addLog("SUCCESS", `모델 "${name}"이 저장되었습니다. (개인용)`);
          } catch (e: any) {
            if (isQuotaError(e)) {
              addLog(
                "ERROR",
                `저장 용량 초과: 데이터가 브라우저 저장 한도(약 5MB)를 넘었습니다. 큰 데이터는 저장 옵션에서 '제외' 또는 '웹 예제로 등록'을 선택해 다시 저장하세요.`
              );
            } else {
              addLog("ERROR", `저장 실패: ${e?.message || e}`);
            }
            warnings.forEach((w) => addLog("WARN", w));
            return; // 모달 유지(사용자가 옵션을 조정하도록)
          }
        } else {
          const blob = new Blob([JSON.stringify(savedModel, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const safe = (name || "sample")
            .replace(/[^a-zA-Z0-9가-힣\s]/g, "_")
            .replace(/\s+/g, "_");
          a.download = `${safe}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addLog(
            "SUCCESS",
            `Sample 파일이 다운로드되었습니다. 'samples' 폴더에 복사 후 빌드하면 Samples 메뉴에 표시됩니다.`
          );
        }

        warnings.forEach((w) => addLog("WARN", w));
        setSaveOptions((s) => ({ ...s, open: false }));
      } catch (error: any) {
        console.error("Model save failed:", error);
        addLog("ERROR", `저장 실패: ${error?.message || error}`);
      } finally {
        setIsSavingModel(false);
      }
    },
    [saveOptions.mode, modules, connections, isLoaderModuleType, addLog]
  );

  // 현재 파이프라인을 Sample로 저장(옵션 모달을 통해).
  const handleSaveAsSample = useCallback(async () => {
    openSaveOptions("sample");
  }, [openSaveOptions]);

  const [isGeneratingPPTs, setIsGeneratingPPTs] = useState(false);
  const [pptProgress, setPptProgress] = useState<{
    status: "idle" | "generating" | "success" | "error";
    message: string;
    details?: string;
  }>({
    status: "idle",
    message: "",
  });

  const handleGeneratePPTs = useCallback(async () => {
    if (modules.length === 0) {
      addLog("WARN", "모듈이 없습니다. PPT를 생성할 수 없습니다.");
      return;
    }

    setIsGeneratingPPTs(true);
    setPptProgress({
      status: "generating",
      message: "PPT 생성 준비 중...",
    });
    addLog("INFO", "모듈별 PPT 생성 중...");

    try {
      // 진행 상태 업데이트
      setPptProgress({
        status: "generating",
        message: "프로젝트 데이터 준비 중...",
      });

      const projectData = {
        modules,
        connections,
        projectName,
      };

      // 진행 상태 업데이트
      setPptProgress({
        status: "generating",
        message: "서버에 요청 전송 중...",
      });

      const response = await fetch("/api/generate-ppts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectData }),
      });

      // 진행 상태 업데이트
      setPptProgress({
        status: "generating",
        message: "PPT 파일 생성 중...",
        details: "모듈별 슬라이드를 생성하고 있습니다.",
      });

      if (!response.ok) {
        let errorMessage = "PPT 생성 실패";
        let errorDetails = "";
        try {
          const responseText = await response.text();
          console.error("서버 응답 텍스트:", responseText);

          if (responseText) {
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.error || errorMessage;
              errorDetails = errorData.details || errorData.stack || "";
              console.error("서버 에러 상세:", errorData);
            } catch (parseError) {
              // JSON 파싱 실패 시 원본 텍스트 사용
              errorMessage = `서버 오류 (${response.status}): ${response.statusText}`;
              errorDetails = responseText;
              console.error("JSON 파싱 실패, 원본 텍스트 사용:", parseError);
            }
          } else {
            errorMessage = `서버 오류 (${response.status}): ${response.statusText}`;
            console.error("서버가 빈 응답을 반환했습니다.");
          }
        } catch (e) {
          errorMessage = `서버 오류 (${response.status}): ${response.statusText}`;
          console.error("응답 읽기 실패:", e);
        }
        const fullErrorMessage = errorDetails
          ? `${errorMessage}\n\n상세 정보:\n${errorDetails}`
          : errorMessage;
        throw new Error(fullErrorMessage);
      }

      const result = await response.json();

      if (result.success) {
        const fileCount = result.files?.length || 0;
        const downloadPath = result.downloadPath || result.files?.[0]?.filepath;

        // 완료 메시지 설정
        let successMessage = `PPT 파일이 생성되었습니다!`;
        let details = "";

        if (fileCount > 0) {
          successMessage = `PPT 파일이 생성되었습니다! (${fileCount}개 모듈 포함)`;

          if (downloadPath) {
            details = `저장 위치: ${downloadPath}`;
            addLog(
              "SUCCESS",
              `PPT 파일이 생성되었습니다. (${fileCount}개 모듈 포함)`
            );
            addLog(
              "SUCCESS",
              `다운로드 폴더에 저장되었습니다: ${downloadPath}`
            );
          } else {
            // stdout에서 경로 추출 시도
            const pathMatch = result.message?.match(
              /다운로드 폴더에 저장되었습니다:\s*(.+)/
            );
            if (pathMatch) {
              details = `저장 위치: ${pathMatch[1]}`;
              addLog(
                "SUCCESS",
                `PPT 파일이 생성되었습니다. (${fileCount}개 모듈 포함)`
              );
              addLog(
                "SUCCESS",
                `다운로드 폴더에 저장되었습니다: ${pathMatch[1]}`
              );
            } else {
              details = "PC의 다운로드 폴더에 저장되었습니다.";
              addLog(
                "SUCCESS",
                `PPT 파일이 생성되었습니다. (${fileCount}개 모듈 포함)`
              );
              addLog("INFO", "파일이 PC의 다운로드 폴더에 저장되었습니다.");
            }
          }
        } else {
          addLog("SUCCESS", "PPT 파일이 생성되었습니다.");
        }

        setPptProgress({
          status: "success",
          message: successMessage,
          details: details,
        });

        // 3초 후 자동으로 닫기
        setTimeout(() => {
          setIsGeneratingPPTs(false);
          setPptProgress({ status: "idle", message: "" });
        }, 3000);
      } else {
        throw new Error(result.error || "PPT 생성 실패");
      }
    } catch (error: any) {
      console.error("PPT 생성 오류:", error);
      const errorMessage = error.message || "알 수 없는 오류";

      // 서버 연결 오류인 경우 안내 메시지 추가
      if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("ECONNREFUSED")
      ) {
        const errorDetails =
          "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요. (http://localhost:3001)";
        setPptProgress({
          status: "error",
          message: "PPT 생성 실패",
          details: errorDetails,
        });
        addLog("ERROR", `PPT 생성 실패: ${errorDetails}`);
      } else {
        setPptProgress({
          status: "error",
          message: "PPT 생성 실패",
          details: errorMessage,
        });
        addLog("ERROR", `PPT 생성 실패: ${errorMessage}`);
      }

      // 에러 메시지는 5초 후 자동으로 닫기
      setTimeout(() => {
        setIsGeneratingPPTs(false);
        setPptProgress({ status: "idle", message: "" });
      }, 5000);
    }
  }, [modules, connections, projectName, addLog]);

  const handleLoadPipeline = useCallback(async () => {
    const savedState = await loadPipeline({
      extension: ".ins",
      onError: (error) => {
        addLog("ERROR", error.message);
      },
    });

    if (savedState) {
      if (savedState.modules && savedState.connections) {
        resetModules(savedState.modules);
        _setConnections(savedState.connections);
        if (savedState.projectName) {
          setProjectName(savedState.projectName);
        }
        setSelectedModuleIds([]);
        setIsDirty(false);
        addLog("SUCCESS", "Pipeline loaded successfully.");
      } else {
        addLog("WARN", "Invalid pipeline file format.");
      }
    }
  }, [resetModules, addLog]);

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      const files = Array.from(e.dataTransfer.files);
      const pipelineFile = files.find(
        (f) => f.name.endsWith(".ins") || f.name.endsWith(".json")
      );
      if (!pipelineFile) return;

      e.preventDefault();
      e.stopPropagation();

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (!parsed.modules || !parsed.connections) {
            addLog("WARN", "유효하지 않은 파이프라인 파일 형식입니다.");
            return;
          }
          resetModules(parsed.modules);
          _setConnections(parsed.connections);
          if (parsed.projectName) setProjectName(parsed.projectName);
          setSelectedModuleIds([]);
          setIsDirty(false);
          addLog(
            "SUCCESS",
            `파이프라인 불러오기 완료: '${pipelineFile.name}'. LoadData 모듈이 있다면 CSV 파일을 다시 선택해주세요.`
          );
        } catch {
          addLog("ERROR", "파이프라인 파일 파싱 실패: 올바른 JSON 형식인지 확인하세요.");
        }
      };
      reader.readAsText(pipelineFile);
    },
    [resetModules, addLog]
  );

  const handleLoadSample = useCallback(
    async (
      sampleName: string,
      source: "samples" | "mywork" | "folder" = "samples",
      filename?: string,
      sampleId?: number | string // DB ID 또는 Supabase UUID
    ) => {
      console.log(
        "handleLoadSample called with:",
        sampleName,
        "from:",
        source,
        "filename:",
        filename,
        "sampleId:",
        sampleId
      );
      // 샘플 로드 동안 보고서 리셋 억제(베이크된 폴백 보고서 보존).
      suppressReportResetRef.current = true;
      try {
        let sampleModel: any = null;

        if (source === "folder") {
          if (sampleId && typeof sampleId === "string" && isSupabaseConfigured()) {
            const supabaseSample = await fetchAutoflowSampleById(sampleId);
            if (supabaseSample) sampleModel = supabaseSample.file_content;
            if (!sampleModel) {
              addLog("ERROR", "샘플을 불러올 수 없습니다. Supabase 설정을 확인하세요.");
              return;
            }
          } else {
            addLog("ERROR", "Samples는 Supabase에서만 불러옵니다. .env에 Supabase를 설정하세요.");
            return;
          }
        } else if (source === "mywork") {
          // My Work에서 찾기
          const myWorkModelsStr = localStorage.getItem("myWorkModels");
          if (myWorkModelsStr) {
            try {
              const myWorkModels = JSON.parse(myWorkModelsStr);
              if (Array.isArray(myWorkModels)) {
                sampleModel = myWorkModels.find(
                  (m: any) => m.name === sampleName
                );
              }
            } catch (error) {
              console.error("Failed to parse my work models:", error);
            }
          }
        } else {
          // Samples에서 찾기
          // 먼저 SAVED_SAMPLES에서 찾기
          const savedSamples = getSavedSamples();
          if (savedSamples && savedSamples.length > 0) {
            sampleModel = savedSamples.find((m: any) => m.name === sampleName);
          }

          // SAVED_SAMPLES에 없으면 SAMPLE_MODELS에서 찾기
          if (!sampleModel) {
            sampleModel = SAMPLE_MODELS.find((m: any) => m.name === sampleName);
          }
        }

        console.log("Found sample model:", sampleModel);
        if (!sampleModel) {
          console.error("Sample model not found:", sampleName);
          addLog("ERROR", `Sample model "${sampleName}" not found.`);
          return;
        }

        // Convert sample model format to app format
        // 원본 모듈 ID를 새 모듈 ID로 매핑하는 맵 생성 (연결 처리에 필요)
        const originalIdToNewIdMap = new Map<string, string>();
        const newModules: CanvasModule[] = sampleModel.modules.map(
          (m: any, index: number) => {
            const moduleId = `module-${Date.now()}-${index}`;
            const originalId = m.id; // 원본 모듈 ID 저장

            // 원본 ID가 있으면 매핑에 추가
            if (originalId) {
              originalIdToNewIdMap.set(originalId, moduleId);
            }

            const defaultModule = DEFAULT_MODULES.find(
              (dm) => dm.type === m.type
            );
            if (!defaultModule) {
              addLog(
                "ERROR",
                `Module type "${m.type}" not found in DEFAULT_MODULES.`
              );
              throw new Error(`Module type "${m.type}" not found`);
            }
            const moduleInfo = TOOLBOX_MODULES.find((tm) => tm.type === m.type);
            const defaultName = moduleInfo ? moduleInfo.name : m.type;
            return {
              ...defaultModule,
              id: moduleId,
              name: m.name || defaultName,
              position: m.position || { x: 0, y: 0 },
              // 베이크된 outputData(예: 폴백 분석보고서 HTML)가 있으면 살리고
              // Success로 표시해 일반 사용자도 결과를 바로 열람할 수 있게 한다.
              status: m.outputData ? ModuleStatus.Success : ModuleStatus.Pending,
              parameters: m.parameters || {}, // 파라미터도 로드
              ...(m.outputData ? { outputData: m.outputData } : {}),
            };
          }
        );

        // 연결 형식 처리: 두 가지 형식 지원
        // 1. fromModuleIndex/toModuleIndex 형식 (변환된 형식)
        // 2. from.moduleId/to.moduleId 형식 (원본 .ins 형식)
        console.log(
          "Processing connections, total:",
          sampleModel.connections?.length || 0
        );
        console.log("First connection sample:", sampleModel.connections?.[0]);
        console.log("Modules count:", sampleModel.modules?.length || 0);
        console.log("New modules count:", newModules.length);

        const newConnections: Connection[] = (sampleModel.connections || [])
          .map((conn: any, index: number) => {
            try {
              let fromModule: CanvasModule | undefined;
              let toModule: CanvasModule | undefined;
              let fromPort: string;
              let toPort: string;

              // 형식 1: fromModuleIndex/toModuleIndex (변환된 형식)
              if (
                typeof conn.fromModuleIndex === "number" &&
                typeof conn.toModuleIndex === "number"
              ) {
                fromModule = newModules[conn.fromModuleIndex];
                toModule = newModules[conn.toModuleIndex];
                fromPort = conn.fromPort || conn.from?.portName;
                toPort = conn.toPort || conn.to?.portName;
              }
              // 형식 2: from.moduleId/to.moduleId (원본 .ins 형식)
              else if (conn.from?.moduleId && conn.to?.moduleId) {
                // 원본 모듈의 id를 찾아서 새로 생성된 모듈의 id로 매핑
                const originalFromId = conn.from.moduleId;
                const originalToId = conn.to.moduleId;

                // 매핑 맵에서 새 모듈 ID 찾기
                const newFromId = originalIdToNewIdMap.get(originalFromId);
                const newToId = originalIdToNewIdMap.get(originalToId);

                if (newFromId && newToId) {
                  // 새 모듈 ID로 모듈 찾기
                  fromModule = newModules.find((m) => m.id === newFromId);
                  toModule = newModules.find((m) => m.id === newToId);
                  fromPort = conn.from.portName;
                  toPort = conn.to.portName;
                } else {
                  // 매핑 맵에 없으면 인덱스로 찾기 (폴백)
                  const originalFromIndex = sampleModel.modules.findIndex(
                    (m: any) => m.id === originalFromId
                  );
                  const originalToIndex = sampleModel.modules.findIndex(
                    (m: any) => m.id === originalToId
                  );

                  if (originalFromIndex >= 0 && originalToIndex >= 0) {
                    fromModule = newModules[originalFromIndex];
                    toModule = newModules[originalToIndex];
                    fromPort = conn.from.portName;
                    toPort = conn.to.portName;
                  } else {
                    console.warn(
                      `Connection at index ${index}: Could not find module IDs`,
                      {
                        originalFromId,
                        originalToId,
                        newFromId,
                        newToId,
                        fromIndex: originalFromIndex,
                        toIndex: originalToIndex,
                        availableModuleIds:
                          sampleModel.modules?.map((m: any) => m.id) || [],
                        mapSize: originalIdToNewIdMap.size,
                      }
                    );
                    return null;
                  }
                }
              } else {
                console.warn(`Connection at index ${index}: Unknown format`, {
                  conn,
                  hasFromModuleIndex:
                    typeof conn.fromModuleIndex !== "undefined",
                  hasToModuleIndex: typeof conn.toModuleIndex !== "undefined",
                  hasFromModuleId: !!conn.from?.moduleId,
                  hasToModuleId: !!conn.to?.moduleId,
                });
                return null;
              }

              if (!fromModule || !toModule) {
                console.warn(
                  `Invalid connection at index ${index}: Module not found`,
                  {
                    fromModule: !!fromModule,
                    toModule: !!toModule,
                    fromModuleIndex: conn.fromModuleIndex,
                    toModuleIndex: conn.toModuleIndex,
                    fromModuleId: conn.from?.moduleId,
                    toModuleId: conn.to?.moduleId,
                  }
                );
                return null;
              }

              if (!fromPort || !toPort) {
                console.warn(
                  `Invalid connection at index ${index}: Missing port names`,
                  { fromPort, toPort, conn }
                );
                return null;
              }

              return {
                id: `connection-${Date.now()}-${index}`,
                from: { moduleId: fromModule.id, portName: fromPort },
                to: { moduleId: toModule.id, portName: toPort },
              };
            } catch (error: any) {
              console.error(
                `Error processing connection at index ${index}:`,
                error,
                conn
              );
              return null;
            }
          })
          .filter((conn): conn is Connection => conn !== null);

        console.log(
          `Successfully processed ${newConnections.length} out of ${
            sampleModel.connections?.length || 0
          } connections`
        );

        // 데이터 자동 바인딩(하이브리드 레지스트리): 큐레이션 샘플은 LoadData에
        // 파일명(source)만 담는 경우가 있다. 본문이 없는 로더에 실제 CSV를 주입해
        // 샘플 로드 즉시 실행 가능하게 만든다. 못 찾으면 하드에러 대신 안내만 한다.
        try {
          const binding = await bindDatasetsToModules(newModules);
          if (binding.bound.length > 0) {
            addLog(
              "INFO",
              `데이터 자동 로드됨: ${binding.bound.join(", ")}`
            );
          }
          for (const m of binding.missing) {
            addLog(
              "WARN",
              `'${m.name}'의 데이터 '${m.source}'를 찾지 못했습니다. LoadData에서 파일을 직접 선택하거나 URL로 불러오세요.`
            );
          }
        } catch (bindError) {
          console.warn("Dataset binding skipped:", bindError);
        }

        resetModules(newModules);
        _setConnections(newConnections);
        setSelectedModuleIds([]);
        setIsDirty(false);
        setProjectName(sampleName);
        setIsSampleMenuOpen(false);
        addLog("SUCCESS", `Sample model "${sampleName}" loaded successfully.`);
        setTimeout(() => handleFitToView(), 100);
      } catch (error: any) {
        console.error("Error loading sample:", error);
        addLog(
          "ERROR",
          `Failed to load sample: ${error.message || "Unknown error"}`
        );
        setIsSampleMenuOpen(false);
      } finally {
        // setModules/setConnections 반영(다음 틱) 후 억제 해제 — 그 사이의
        // 구조 변경 감지가 베이크된 보고서를 지우지 못하게 한다.
        setTimeout(() => {
          suppressReportResetRef.current = false;
        }, 0);
      }
    },
    [resetModules, addLog, handleFitToView]
  );

  // Samples 목록: Supabase 전용 (app_section=ML)
  const loadFolderSamplesLocal = useCallback(async () => {
    setIsLoadingSamples(true);
    try {
      if (!isSupabaseConfigured()) {
        setFolderSamples([]);
        return;
      }
      const list = await fetchAutoflowSamplesList();
      console.log(`Loaded ${list.length} samples from Supabase (ML)`);
      setFolderSamples(
        list.map((s) => ({
          id: s.id,
          modelId: s.model_id,
          filename: s.model_name,
          name: s.model_name,
          inputData: s.input_data_name ?? undefined,
          description: s.description ?? undefined,
          category: s.category ?? "머신러닝",
          developerEmail: s.developer_email ?? undefined,
          data: null,
        }))
      );
    } catch (error: any) {
      console.error("Error loading samples:", error);
      setFolderSamples([]);
    } finally {
      setIsLoadingSamples(false);
    }
  }, []);

  // Samples 메뉴가 열릴 때마다 폴더 샘플 목록 새로고침
  useEffect(() => {
    if (isSampleMenuOpen) {
      console.log("Samples menu opened, loading folder samples...");
      // 약간의 지연을 두어 메뉴가 완전히 열린 후 로드
      const timer = setTimeout(() => {
        loadFolderSamplesLocal();
      }, 100);
      return () => clearTimeout(timer);
    }
    // 메뉴가 닫혀도 상태는 유지 (다음에 열 때 빠르게 표시)
  }, [isSampleMenuOpen, loadFolderSamplesLocal]);

  // 디버깅: folderSamples 상태 변경 추적
  useEffect(() => {
    if (folderSamples.length > 0) {
      console.log(
        `folderSamples updated: ${folderSamples.length} samples`,
        folderSamples.map((s) => s.name || s.filename)
      );
    } else if (isSampleMenuOpen && !isLoadingSamples) {
      console.log("folderSamples is empty but menu is open and not loading");
    }
  }, [folderSamples, isSampleMenuOpen, isLoadingSamples]);

  // My Work 모델 목록 로드
  useEffect(() => {
    const myWorkModelsStr = localStorage.getItem("myWorkModels");
    if (myWorkModelsStr) {
      try {
        const models = JSON.parse(myWorkModelsStr);
        setMyWorkModels(Array.isArray(models) ? models : []);
      } catch (error) {
        console.error("Failed to load my work models:", error);
      }
    }
  }, []);

  // '내 작업' 메뉴가 열릴 때 마지막 작업 메타를 새로고침(저장 시각·모듈 수 표시).
  useEffect(() => {
    if (isMyWorkMenuOpen) setLastWorkMeta(getLastWorkMeta());
  }, [isMyWorkMenuOpen]);

  // 초기 화면 로드
  useEffect(() => {
    const initialModelStr = localStorage.getItem("initialModel");
    if (initialModelStr && modules.length === 0) {
      try {
        const initialModel = JSON.parse(initialModelStr);

        // initialModel 객체를 직접 사용하여 모델 로드
        if (initialModel.modules && initialModel.connections) {
          // Convert initial model format to app format
          // 존재하지 않는 모듈 타입 필터링
          const skippedModules = new Set<string>();
          const validModules = initialModel.modules.filter((m: any) => {
            const defaultModule = DEFAULT_MODULES.find(
              (dm) => dm.type === m.type
            );
            if (!defaultModule) {
              // 중복 경고 방지
              if (!skippedModules.has(m.type)) {
                skippedModules.add(m.type);
                console.warn(
                  `Module type "${m.type}" not found in DEFAULT_MODULES. Skipping...`
                );
              }
              return false;
            }
            return true;
          });

          const newModules: CanvasModule[] = validModules.map(
            (m: any, index: number) => {
              const moduleId = `module-${Date.now()}-${index}`;
              const defaultModule = DEFAULT_MODULES.find(
                (dm) => dm.type === m.type
              );
              if (!defaultModule) {
                // 이미 필터링했으므로 여기서는 발생하지 않아야 함
                throw new Error(`Module type "${m.type}" not found`);
              }
              const moduleInfo = TOOLBOX_MODULES.find(
                (tm) => tm.type === m.type
              );
              const defaultName = moduleInfo ? moduleInfo.name : m.type;
              return {
                ...defaultModule,
                id: moduleId,
                name: m.name || defaultName,
                position: m.position,
                parameters: m.parameters || defaultModule.parameters,
                status: ModuleStatus.Pending,
              };
            }
          );

          // 유효한 모듈 인덱스 매핑 생성 (필터링된 모듈에 맞게 인덱스 재매핑)
          const originalToNewIndexMap = new Map<number, number>();
          let newIndex = 0;
          initialModel.modules.forEach((m: any, originalIndex: number) => {
            const defaultModule = DEFAULT_MODULES.find(
              (dm) => dm.type === m.type
            );
            if (defaultModule) {
              originalToNewIndexMap.set(originalIndex, newIndex);
              newIndex++;
            }
          });

          // 필터링된 connection 개수 추적 (경고 메시지 최소화)
          let skippedConnections = 0;
          const newConnections: Connection[] = initialModel.connections
            .map((conn: any, index: number) => {
              const newFromIndex = originalToNewIndexMap.get(
                conn.fromModuleIndex
              );
              const newToIndex = originalToNewIndexMap.get(conn.toModuleIndex);

              if (newFromIndex === undefined || newToIndex === undefined) {
                // 필터링된 모듈과 연결된 connection은 건너뛰기
                skippedConnections++;
                return null;
              }

              const fromModule = newModules[newFromIndex];
              const toModule = newModules[newToIndex];
              if (!fromModule || !toModule) {
                skippedConnections++;
                return null;
              }
              return {
                id: `connection-${Date.now()}-${index}`,
                from: { moduleId: fromModule.id, portName: conn.fromPort },
                to: { moduleId: toModule.id, portName: conn.toPort },
              };
            })
            .filter(
              (conn: Connection | null): conn is Connection => conn !== null
            );

          // 건너뛴 connection이 있으면 한 번만 경고 출력
          if (skippedConnections > 0) {
            console.warn(
              `${skippedConnections} connection(s) were skipped due to removed modules.`
            );
          }

          // 제거된 모듈이 있으면 localStorage 업데이트
          if (skippedModules.size > 0 || skippedConnections > 0) {
            const cleanedModel = {
              name: initialModel.name || "Data Analysis",
              modules: newModules.map((m) => ({
                type: m.type,
                name: m.name,
                position: m.position,
                parameters: m.parameters,
              })),
              connections: newConnections.map((c) => {
                const fromIndex = newModules.findIndex(
                  (m) => m.id === c.from.moduleId
                );
                const toIndex = newModules.findIndex(
                  (m) => m.id === c.to.moduleId
                );
                return {
                  fromModuleIndex: fromIndex,
                  fromPort: c.from.portName,
                  toModuleIndex: toIndex,
                  toPort: c.to.portName,
                };
              }),
            };
            localStorage.setItem("initialModel", JSON.stringify(cleanedModel));

            // 제거된 모듈 목록 로그 출력
            const removedModulesList = Array.from(skippedModules).join(", ");
            console.log(
              `Removed modules from initialModel: ${removedModulesList}`
            );
            addLog(
              "INFO",
              `Cleaned initial model: Removed ${skippedModules.size} module(s) and ${skippedConnections} connection(s).`
            );
          }

          resetModules(newModules);
          _setConnections(newConnections);
          setSelectedModuleIds([]);
          setIsDirty(false);
          setProjectName(initialModel.name || "Data Analysis");
          addLog(
            "SUCCESS",
            `Initial model "${
              initialModel.name || "My Model"
            }" loaded successfully.`
          );
          setTimeout(() => handleFitToView(), 100);
        } else {
          // 기존 방식 (name으로 찾기) - 하위 호환성
          handleLoadSample(initialModel.name);
        }
      } catch (error) {
        console.error("Failed to load initial model:", error);
        addLog(
          "ERROR",
          `Failed to load initial model: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 마운트 시에만 실행

  // Fit to View는 사용자가 명시적으로 트리거할 때만 실행 (모듈 이동/추가 시 자동 재중앙 정렬 제거)
  // 로드/AI 파이프라인 생성 등 필요한 곳에서는 명시적으로 handleFitToView()를 호출함

  // Close sample menu and my work menu when clicking outside
  useEffect(() => {
    if (!isSampleMenuOpen && !isMyWorkMenuOpen) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (sampleMenuRef.current && !sampleMenuRef.current.contains(target)) {
        setIsSampleMenuOpen(false);
      }
      if (myWorkMenuRef.current && !myWorkMenuRef.current.contains(target)) {
        setIsMyWorkMenuOpen(false);
      }
    };

    // Longer delay to ensure button click completes first
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isSampleMenuOpen, isMyWorkMenuOpen]);

  // fix: Added missing handleSetFolder function to resolve "Cannot find name" error.
  const handleSetFolder = useCallback(async () => {
    try {
      if (!("showDirectoryPicker" in window)) {
        addLog(
          "WARN",
          "현재 브라우저에서는 폴더 설정 기능을 지원하지 않습니다."
        );
        return;
      }
      const handle = await (window as any).showDirectoryPicker();
      folderHandleRef.current = handle;
      addLog("SUCCESS", `저장 폴더가 '${handle.name}'(으)로 설정되었습니다.`);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Failed to set save folder:", error);
        addLog(
          "ERROR",
          `폴더를 설정하지 못했습니다: ${error.message}. 브라우저 권한 설정을 확인해 주세요.`
        );
      }
    }
  }, [addLog]);

  const createModule = useCallback(
    (type: ModuleType, position: { x: number; y: number }) => {
      clearSuggestion();

      // Handle shape types (TextBox, GroupBox)
      if (type === ModuleType.TextBox || type === ModuleType.GroupBox) {
        const shapeName =
          type === ModuleType.TextBox ? "텍스트 상자" : "그룹 상자";
        const count = modules.filter((m) => m.type === type).length + 1;

        let shapeData: CanvasModule["shapeData"];

        if (type === ModuleType.TextBox) {
          shapeData = { text: "", width: 200, height: 100, fontSize: 14 };
        } else {
          // GroupBox: Calculate bounds for selected modules
          const selectedModules = modules.filter(
            (m) =>
              selectedModuleIds.includes(m.id) &&
              m.type !== ModuleType.TextBox &&
              m.type !== ModuleType.GroupBox
          );

          if (selectedModules.length > 0) {
            const moduleWidth = 256;
            const moduleHeight = 120;

            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity;

            selectedModules.forEach((module) => {
              const x = module.position.x;
              const y = module.position.y;
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x + moduleWidth);
              maxY = Math.max(maxY, y + moduleHeight);
            });

            // 모듈만 들어갈 수 있도록 여백 최소화
            const padding = 10;
            const bounds = {
              x: minX - padding,
              y: minY - padding,
              width: maxX - minX + padding * 2,
              height: maxY - minY + padding * 2,
            };

            shapeData = {
              moduleIds: selectedModules.map((m) => m.id),
              bounds,
            };

            // Set group box position to bounds position
            position = { x: bounds.x, y: bounds.y };
          } else {
            // Default bounds if no modules selected
            const defaultWidth = 300;
            const defaultHeight = 200;
            shapeData = {
              moduleIds: [],
              bounds: {
                x: position.x,
                y: position.y,
                width: defaultWidth,
                height: defaultHeight,
              },
            };
          }
        }

        const newModule: CanvasModule = {
          id: `${type}-${Date.now()}`,
          name: `${shapeName} ${count}`,
          type,
          position,
          status: ModuleStatus.Pending,
          parameters: {},
          inputs: [],
          outputs: [],
          shapeData,
        };
        setModules((prev) => [...prev, newModule]);
        setSelectedModuleIds([newModule.id]);
        setIsDirty(true);
        return;
      }

      const defaultData = DEFAULT_MODULES.find((m) => m.type === type);
      if (!defaultData) {
        console.error(`No default data found for module type: ${type}`);
        addLog(
          "ERROR",
          `Module type '${type}' is not supported. Please check if the module is properly defined.`
        );
        return;
      }

      const moduleInfo = TOOLBOX_MODULES.find((m) => m.type === type);
      const baseName = moduleInfo ? moduleInfo.name : type;

      const count = modules.filter((m) => m.type === type).length + 1;
      const newModule: CanvasModule = {
        id: `${type}-${Date.now()}`,
        name: `${baseName} ${count}`,
        type,
        position,
        status: ModuleStatus.Pending,
        parameters: { ...defaultData.parameters },
        inputs: [...defaultData.inputs],
        outputs: [...defaultData.outputs],
      };

      setModules((prev) => [...prev, newModule]);
      setSelectedModuleIds([newModule.id]);
      setIsDirty(true);
      // 비-보고서 모듈 추가 → 모델 구조 변경 → 기존 보고서 리셋(보고서 추가 자체는 제외).
      if (type !== ModuleType.ModelAnalysisReport) resetModelReportsOnChange();
    },
    [modules, setModules, setSelectedModuleIds, clearSuggestion, addLog, resetModelReportsOnChange]
  );

  const handleModuleToolboxDoubleClick = useCallback(
    (type: ModuleType) => {
      // GroupBox는 선택된 모듈들을 기준으로 생성
      if (type === ModuleType.GroupBox) {
        const selectedModules = modules.filter(
          (m) =>
            selectedModuleIds.includes(m.id) &&
            m.type !== ModuleType.TextBox &&
            m.type !== ModuleType.GroupBox
        );

        if (selectedModules.length === 0) {
          addLog(
            "WARN",
            "그룹 상자를 만들려면 하나 이상의 모듈을 선택해야 합니다."
          );
          return;
        }

        const moduleWidth = 256;
        const moduleHeight = 120;
        const padding = 10; // 여백을 줄임

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        selectedModules.forEach((module) => {
          const x = module.position.x;
          const y = module.position.y;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + moduleWidth);
          maxY = Math.max(maxY, y + moduleHeight);
        });

        const bounds = {
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
        };

        const shapeName = "그룹 상자";
        const count = modules.filter((m) => m.type === type).length + 1;
        const newModule: CanvasModule = {
          id: `${type}-${Date.now()}`,
          name: `${shapeName} ${count}`,
          type,
          position: { x: bounds.x, y: bounds.y }, // position과 bounds.x, bounds.y를 일치시킴
          status: ModuleStatus.Pending,
          parameters: {},
          inputs: [],
          outputs: [],
          shapeData: {
            moduleIds: selectedModules.map((m) => m.id),
            bounds,
          },
        };

        setModules((prev) => [...prev, newModule]);
        setSelectedModuleIds([newModule.id]);
        setIsDirty(true);
        addLog(
          "SUCCESS",
          `${selectedModules.length}개의 모듈을 그룹으로 묶었습니다.`
        );
        return;
      }

      // 다른 모듈들은 화면 중앙 근처에 생성하되, 기존 모듈과 겹치지 않도록 오프셋 적용
      if (canvasContainerRef.current) {
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();
        const moduleWidth = 256;
        const moduleHeight = 120;

        // 현재 화면(viewport) 중앙의 캔버스 좌표
        const baseX = (canvasRect.width / 2 - moduleWidth / 2 - pan.x) / scale;
        const baseY = (canvasRect.height / 2 - moduleHeight / 2 - pan.y) / scale;

        // 같은 자리에 이미 모듈이 있으면 (20, 20)씩 어긋나게 배치
        const STEP = 20;
        const THRESHOLD = 10; // 이 거리 안에 있으면 "겹친다"고 판단
        let candidate = { x: baseX, y: baseY };
        let attempt = 0;
        const maxAttempts = 50;
        while (
          attempt < maxAttempts &&
          modules.some(
            (m) =>
              Math.abs(m.position.x - candidate.x) < THRESHOLD &&
              Math.abs(m.position.y - candidate.y) < THRESHOLD
          )
        ) {
          attempt += 1;
          candidate = {
            x: baseX + attempt * STEP,
            y: baseY + attempt * STEP,
          };
        }

        createModule(type, candidate);
      }
    },
    [
      createModule,
      scale,
      pan,
      modules,
      selectedModuleIds,
      setModules,
      setSelectedModuleIds,
      addLog,
    ]
  );

  const handleFontSizeChange = useCallback(
    (increase: boolean) => {
      const selectedTextBoxes = modules.filter(
        (m) => selectedModuleIds.includes(m.id) && m.type === ModuleType.TextBox
      );

      if (selectedTextBoxes.length === 0) {
        addLog("WARN", "글자 크기를 조절하려면 텍스트 상자를 선택하세요.");
        return;
      }

      setModules(
        (prev) =>
          prev.map((m) => {
            if (selectedTextBoxes.some((tb) => tb.id === m.id)) {
              const currentFontSize = m.shapeData?.fontSize || 14;
              const newFontSize = increase
                ? Math.min(currentFontSize + 2, 32) // 최대 32px
                : Math.max(currentFontSize - 2, 8); // 최소 8px

              return {
                ...m,
                shapeData: {
                  ...m.shapeData,
                  fontSize: newFontSize,
                },
              };
            }
            return m;
          }),
        true
      );
      setIsDirty(true);
    },
    [modules, selectedModuleIds, setModules, addLog]
  );

  const updateModulePositions = useCallback(
    (updates: { id: string; position: { x: number; y: number } }[]) => {
      const updatesMap = new Map(updates.map((u) => [u.id, u.position]));
      setModules((prev) => {
        // First pass: Calculate group box movements and store dx/dy
        const groupMovements = new Map<string, { dx: number; dy: number }>();

        const updatedModules = prev.map((m) => {
          const newPos = updatesMap.get(m.id);
          if (!newPos) return m;

          // If this is a GroupBox being moved, calculate movement delta
          if (m.type === ModuleType.GroupBox && m.shapeData?.moduleIds) {
            const dx = newPos.x - m.position.x;
            const dy = newPos.y - m.position.y;

            // Store movement delta for modules in this group
            if (dx !== 0 || dy !== 0) {
              groupMovements.set(m.id, { dx, dy });
            }

            // Update bounds to match new position
            const newBounds = m.shapeData.bounds
              ? {
                  ...m.shapeData.bounds,
                  x: newPos.x, // bounds.x를 새 position과 일치시킴
                  y: newPos.y, // bounds.y를 새 position과 일치시킴
                }
              : undefined;

            // Return updated group box
            return {
              ...m,
              position: newPos,
              shapeData: { ...m.shapeData, bounds: newBounds },
            };
          }

          return { ...m, position: newPos };
        });

        // Second pass: Update modules in groups if group box was moved
        return updatedModules.map((m) => {
          // Skip if this module is a group box or shape
          if (m.type === ModuleType.GroupBox || m.type === ModuleType.TextBox) {
            return m;
          }

          // Find the group box that contains this module
          const groupBox = updatedModules.find(
            (g) =>
              g.type === ModuleType.GroupBox &&
              g.shapeData?.moduleIds?.includes(m.id)
          );

          if (groupBox && groupMovements.has(groupBox.id)) {
            const movement = groupMovements.get(groupBox.id)!;
            return {
              ...m,
              position: {
                x: m.position.x + movement.dx,
                y: m.position.y + movement.dy,
              },
            };
          }

          return m;
        });
      }, true);
      setIsDirty(true);
    },
    [setModules]
  );

  // Helper function to find all downstream modules (modules that depend on the given module)
  const getDownstreamModules = useCallback(
    (
      moduleId: string,
      allModules: CanvasModule[],
      allConnections: Connection[]
    ): string[] => {
      const downstream: string[] = [];
      const visited = new Set<string>();

      const traverse = (currentId: string) => {
        if (visited.has(currentId)) return;
        visited.add(currentId);

        // Find all modules that receive output from this module
        const outgoingConnections = allConnections.filter(
          (c) => c.from.moduleId === currentId
        );
        outgoingConnections.forEach((conn) => {
          const targetId = conn.to.moduleId;
          if (!downstream.includes(targetId)) {
            downstream.push(targetId);
            traverse(targetId); // Recursively find downstream modules
          }
        });
      };

      traverse(moduleId);
      return downstream;
    },
    []
  );

  const updateModuleParameters = useCallback(
    (id: string, newParams: Record<string, any>) => {
      setModules((prev) => {
        const updated = prev.map((m) =>
          m.id === id
            ? { ...m, parameters: { ...m.parameters, ...newParams } }
            : m
        );

        // Find all downstream modules
        const downstreamIds = getDownstreamModules(id, updated, connections);

        // Find connected model definition module if this is TrainModel
        let modelDefinitionModuleId: string | null = null;
        const modifiedModule = updated.find((m) => m.id === id);
        if (modifiedModule && modifiedModule.type === ModuleType.TrainModel) {
          const modelInputConnection = connections.find(
            (c) => c.to.moduleId === id && c.to.portName === "model_in"
          );
          if (modelInputConnection) {
            modelDefinitionModuleId = modelInputConnection.from.moduleId;
          }
        }

        // Mark modified module and all downstream modules as Pending
        // Also mark connected model definition module as Pending if TrainModel is modified
        return updated.map((m) => {
          if (m.id === id || downstreamIds.includes(m.id)) {
            return {
              ...m,
              status: ModuleStatus.Pending,
              outputData: undefined,
            };
          }
          // Mark connected model definition module as Pending when TrainModel is modified
          if (
            modelDefinitionModuleId &&
            m.id === modelDefinitionModuleId &&
            MODEL_DEFINITION_TYPES.includes(m.type)
          ) {
            return {
              ...m,
              status: ModuleStatus.Pending,
              outputData: undefined,
            };
          }
          return m;
        });
      });
      setIsDirty(true);
      // 비-보고서 모듈 파라미터가 바뀌면 모델이 달라진 것 → 기존 보고서 리셋.
      // (보고서 자신의 파라미터 편집(제목/추가정보 등)은 제외.)
      const editedModule = modules.find((m) => m.id === id);
      if (editedModule && editedModule.type !== ModuleType.ModelAnalysisReport) {
        resetModelReportsOnChange();
      }
    },
    [setModules, connections, getDownstreamModules, modules, resetModelReportsOnChange]
  );

  const updateModule = useCallback(
    (id: string, updates: Partial<CanvasModule>) => {
      setModules(
        (prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        true
      );
      setIsDirty(true);
    },
    [setModules]
  );

  const updateModuleName = useCallback(
    (id: string, newName: string) => {
      setModules((prev) => {
        const updated = prev.map((m) =>
          m.id === id ? { ...m, name: newName } : m
        );

        // Find all downstream modules
        const downstreamIds = getDownstreamModules(id, updated, connections);

        // Mark modified module and all downstream modules as Pending
        return updated.map((m) => {
          if (m.id === id || downstreamIds.includes(m.id)) {
            return {
              ...m,
              status: ModuleStatus.Pending,
              outputData: undefined,
            };
          }
          return m;
        });
      });
      setIsDirty(true);
    },
    [setModules, connections, getDownstreamModules]
  );

  const updateModuleNotes = useCallback(
    (id: string, notes: string) => {
      setModules((prev) => prev.map((m) => m.id === id ? { ...m, notes } : m));
    },
    [setModules]
  );

  const deleteModules = useCallback(
    (idsToDelete: string[]) => {
      // 삭제 대상에 비-보고서 모듈이 포함되면 모델 구조가 바뀐 것 → 보고서 리셋.
      const deletingNonReport = modules.some(
        (m) =>
          idsToDelete.includes(m.id) &&
          m.type !== ModuleType.ModelAnalysisReport
      );
      setModules((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
      setConnections((prev) =>
        prev.filter(
          (c) =>
            !idsToDelete.includes(c.from.moduleId) &&
            !idsToDelete.includes(c.to.moduleId)
        )
      );
      setSelectedModuleIds((prev) =>
        prev.filter((id) => !idsToDelete.includes(id))
      );
      setIsDirty(true);
      if (deletingNonReport) resetModelReportsOnChange();
    },
    [modules, setModules, setConnections, setSelectedModuleIds, resetModelReportsOnChange]
  );

  const handleViewDetails = (moduleId: string) => {
    const module = modules.find((m) => m.id === moduleId);
    console.log("handleViewDetails called for module:", moduleId, module);
    if (module?.outputData) {
      console.log("Module outputData type:", module.outputData.type);
      if (
        module.type === ModuleType.PredictModel &&
        module.outputData.type === "DataPreview"
      ) {
        setViewingPredictModel(module);
      } else if (module.outputData.type === "StatsModelsResultOutput") {
        setViewingStatsModelsResult(module);
      } else if (module.outputData.type === "DiversionCheckerOutput") {
        setViewingDiversionChecker(module);
      } else if (module.outputData.type === "EvaluateStatOutput") {
        setViewingEvaluateStat(module);
      } else if (module.outputData.type === "SplitDataOutput") {
        setViewingSplitDataForModule(module);
      } else if (
        module.outputData.type === "JoinOutput" ||
        module.outputData.type === "ConcatOutput"
      ) {
        setViewingDataForModule(module);
      } else if (module.outputData.type === "TrainedModelOutput") {
        setViewingTrainedModel(module);
      } else if (module.outputData.type === "XoLPriceOutput") {
        setViewingXoLPrice(module);
      } else if (module.outputData.type === "FinalXolPriceOutput") {
        setViewingFinalXolPrice(module);
      } else if (module.outputData.type === "EvaluationOutput") {
        setViewingEvaluation(module);
      } else if (module.outputData.type === "StatisticsOutput") {
        setViewingDataForModule(module);
      } else if (
        module.type === ModuleType.ColumnPlot &&
        module.outputData.type === "ColumnPlotOutput"
      ) {
        setViewingColumnPlot(module);
      } else if (module.type === ModuleType.OutlierDetector) {
        // OutlierDetector 모듈의 경우, outputData가 DataPreview여도 View Details를 위해 별도 처리
        if (module.outputData.type === "OutlierDetectorOutput") {
          setViewingOutlierDetector(module);
        } else if (
          module.outputData.type === "DataPreview" &&
          module.parameters._outlierOutput
        ) {
          // parameters에 저장된 OutlierDetectorOutput 정보 사용
          const moduleWithOutlierOutput = {
            ...module,
            outputData: module.parameters
              ._outlierOutput as OutlierDetectorOutput,
          };
          setViewingOutlierDetector(moduleWithOutlierOutput);
        } else {
          setViewingOutlierDetector(module);
        }
      } else if (module.outputData.type === "HypothesisTestingOutput") {
        setViewingHypothesisTesting(module);
      } else if (module.outputData.type === "NormalityCheckerOutput") {
        setViewingNormalityChecker(module);
      } else if (module.outputData.type === "CorrelationOutput") {
        setViewingCorrelation(module);
      } else if (module.outputData.type === "VIFCheckerOutput") {
        console.log("Setting viewingDataForModule for VIFCheckerOutput");
        setViewingDataForModule(module);
      } else if (module.outputData.type === "ClusteringDataOutput") {
        console.log("Setting viewingClusteringData for ClusteringDataOutput");
        setViewingClusteringData(module);
      } else if (module.outputData.type === "TrainedClusteringModelOutput") {
        console.log(
          "Setting viewingTrainedClusteringModel for TrainedClusteringModelOutput"
        );
        setViewingTrainedClusteringModel(module);
      } else if (module.outputData.type === "ModelReportOutput") {
        // 모델 분석보고서 결과 — 열람은 게이트 없음(일반 사용자 가능).
        setViewingModelReport(module);
      } else if (module.outputData.type === "JMDCCohortOutput") {
        setViewingJMDCCohort(module);
      } else if (module.outputData.type === "JMDCOutcomeOutput") {
        // J2 outputs use the generic DataPreview modal (labeled cohort frame)
        setViewingDataForModule(module);
      } else if (module.outputData.type === "JMDCIncidenceOutput") {
        setViewingJMDCIncidence(module);
      } else if (module.outputData.type === "JMDCSurvivalOutput") {
        setViewingJMDCSurvival(module);
      } else if (module.outputData.type === "JMDCCoxOutput") {
        setViewingJMDCCox(module);
      } else if (module.outputData.type === "JMDCMatcherOutput") {
        setViewingJMDCMatcher(module);
      } else {
        console.log(
          "Setting viewingDataForModule for other type:",
          module.outputData.type
        );
        setViewingDataForModule(module);
      }
    } else {
      console.warn("Module has no outputData:", module);
    }
  };

  const handleCloseModal = () => {
    setViewingDataForModule(null);
    setViewingSplitDataForModule(null);
    setViewingTrainedModel(null);
    setViewingStatsModelsResult(null);
    setViewingDiversionChecker(null);
    setViewingEvaluateStat(null);
    setViewingXoLPrice(null);
    setViewingFinalXolPrice(null);
    setViewingEvaluation(null);
    setViewingPredictModel(null);
    setViewingColumnPlot(null);
    setViewingOutlierDetector(null);
    setViewingHypothesisTesting(null);
    setViewingNormalityChecker(null);
    setViewingCorrelation(null);
    setViewingTrainedClusteringModel(null);
    setViewingClusteringData(null);
    setViewingModelReport(null);
    setViewingJMDCCohort(null);
    setViewingJMDCIncidence(null);
    setViewingJMDCSurvival(null);
    setViewingJMDCCox(null);
    setViewingJMDCMatcher(null);
  };

  // Model definition modules that should not be executed directly in Run All
  const MODEL_DEFINITION_TYPES: ModuleType[] = [
    // Supervised Learning Models
    ModuleType.LinearRegression,
    ModuleType.LogisticRegression,
    ModuleType.PoissonRegression,
    ModuleType.NegativeBinomialRegression,
    ModuleType.DecisionTree,
    ModuleType.RandomForest,
    ModuleType.GradientBoosting,
    ModuleType.NeuralNetwork,
    ModuleType.SVM,
    ModuleType.LDA,
    ModuleType.NaiveBayes,
    ModuleType.KNN,
    // Unsupervised Learning Models
    ModuleType.KMeans,
    ModuleType.PCA,
    // Traditional Analysis - Statsmodels Models
    ModuleType.OLSModel,
    ModuleType.LogisticModel,
    ModuleType.PoissonModel,
    ModuleType.QuasiPoissonModel,
    ModuleType.NegativeBinomialModel,
    // Statistical Models
    ModuleType.StatModels,
  ];

  // Helper function to check if all upstream modules are successfully executed
  const areUpstreamModulesReady = useCallback(
    (
      moduleId: string,
      allModules: CanvasModule[],
      allConnections: Connection[]
    ): boolean => {
      const upstreamConnections = allConnections.filter(
        (c) => c && c.to && c.to.moduleId === moduleId
      );
      if (upstreamConnections.length === 0) return true; // No dependencies

      return upstreamConnections.every((conn) => {
        if (!conn || !conn.from || !conn.from.moduleId) return true;
        const sourceModule = allModules.find(
          (m) => m && m.id === conn.from.moduleId
        );
        // Model definition modules are always considered ready (they don't need to be executed)
        if (
          sourceModule &&
          MODEL_DEFINITION_TYPES.includes(sourceModule.type)
        ) {
          return true;
        }
        return sourceModule?.status === ModuleStatus.Success;
      });
    },
    []
  );

  // Helper function to process annual aggregation for SimulateFreqSevTable
  const processAnnualAggregation = (inputData: DataPreview): DataPreview => {
    // 연도별을 하나의 사고로 해서 테이블 구성
    // 연도 컬럼을 찾아서 연도별로 그룹화
    const yearColumn = inputData.columns.find(
      (col) => col.name.toLowerCase().includes("year") || col.name.toLowerCase().includes("연도")
    );
    
    if (!yearColumn) {
      throw new Error("Year column not found. Please ensure your data has a year column.");
    }

    const groupedByYear: Record<string, any[]> = {};
    (inputData.rows || []).forEach((row) => {
      const year = String(row[yearColumn.name]);
      if (!groupedByYear[year]) {
        groupedByYear[year] = [];
      }
      groupedByYear[year].push(row);
    });

    // 연도별로 집계된 데이터 생성
    const annualRows: Record<string, any>[] = [];
    Object.keys(groupedByYear).forEach((year) => {
      const yearData = groupedByYear[year];
      // 각 연도를 하나의 사고로 처리
      const aggregatedRow: Record<string, any> = {
        year: year,
        claim_count: yearData.length,
        // 필요한 경우 추가 집계 컬럼 추가
      };
      
      // 숫자형 컬럼들의 합계 계산
      inputData.columns.forEach((col) => {
        if (col.type === "int64" || col.type === "float64") {
          const sum = yearData.reduce((acc, row) => {
            const val = row[col.name];
            return acc + (typeof val === "number" ? val : 0);
          }, 0);
          aggregatedRow[`total_${col.name}`] = sum;
        }
      });
      
      annualRows.push(aggregatedRow);
    });

    const annualColumns: ColumnInfo[] = [
      { name: "year", type: "object" },
      { name: "claim_count", type: "int64" },
      ...inputData.columns
        .filter((col) => col.type === "int64" || col.type === "float64")
        .map((col) => ({ name: `total_${col.name}`, type: col.type })),
    ];

    return {
      type: "DataPreview",
      columns: annualColumns,
      totalRowCount: annualRows.length,
      rows: annualRows,
    };
  };

  // Helper function to process claim aggregation for SimulateFreqSevTable
  const processClaimAggregation = (inputData: DataPreview): DataPreview => {
    // 사고별 집계 (XoL 사용) - 원본 데이터를 그대로 반환하거나 필요한 집계 수행
    // 사고별 데이터는 원본 구조를 유지
    return {
      type: "DataPreview",
      columns: inputData.columns,
      totalRowCount: inputData.totalRowCount,
      rows: inputData.rows || [],
    };
  };

  // Helper function to combine two loss models
  const combineLossModels = (
    freqSevData: DataPreview,
    lossData: DataPreview
  ): { columns: ColumnInfo[]; rows: Record<string, any>[] } => {
    // 두 데이터를 합산하여 VaR 등 계산
    // 간단한 합산 예시 (실제로는 더 복잡한 계산 필요)
    const combinedRows: Record<string, any>[] = [];
    
    // 공통 컬럼 찾기
    const commonColumns = freqSevData.columns.filter((col) =>
      lossData.columns.some((c) => c.name === col.name)
    );

    // 합산 가능한 숫자형 컬럼 찾기
    const numericColumns = commonColumns.filter(
      (col) => col.type === "int64" || col.type === "float64"
    );

    // 두 데이터의 행 수가 같다고 가정 (실제로는 더 복잡한 매칭 필요)
    const maxRows = Math.max(
      freqSevData.rows?.length || 0,
      lossData.rows?.length || 0
    );

    for (let i = 0; i < maxRows; i++) {
      const freqSevRow = freqSevData.rows?.[i] || {};
      const lossRow = lossData.rows?.[i] || {};

      const combinedRow: Record<string, any> = {};

      // 공통 컬럼 합산
      numericColumns.forEach((col) => {
        const freqSevVal = freqSevRow[col.name] || 0;
        const lossVal = lossRow[col.name] || 0;
        combinedRow[col.name] =
          (typeof freqSevVal === "number" ? freqSevVal : 0) +
          (typeof lossVal === "number" ? lossVal : 0);
      });

      // 고유 컬럼 추가
      freqSevData.columns.forEach((col) => {
        if (!commonColumns.some((c) => c.name === col.name)) {
          combinedRow[`freq_sev_${col.name}`] = freqSevRow[col.name];
        }
      });
      lossData.columns.forEach((col) => {
        if (!commonColumns.some((c) => c.name === col.name)) {
          combinedRow[`loss_${col.name}`] = lossRow[col.name];
        }
      });

      combinedRows.push(combinedRow);
    }

    const combinedColumns: ColumnInfo[] = [
      ...commonColumns,
      ...freqSevData.columns
        .filter((col) => !commonColumns.some((c) => c.name === col.name))
        .map((col) => ({ name: `freq_sev_${col.name}`, type: col.type })),
      ...lossData.columns
        .filter((col) => !commonColumns.some((c) => c.name === col.name))
        .map((col) => ({ name: `loss_${col.name}`, type: col.type })),
    ];

    return { columns: combinedColumns, rows: combinedRows };
  };

  const runSimulation = async (
    startModuleId: string,
    runAll: boolean = false
  ) => {
    const runQueue: string[] = [];
    const visited = new Set<string>();
    // 최신 modules 상태를 가져오기 위해 함수 내부에서 참조
    // 클로저를 통해 항상 최신 상태를 참조하도록 함
    const getCurrentModules = () => [...modules];
    let currentModules = getCurrentModules(); // Use a mutable copy for the current simulation run

    const traverse = (moduleId: string) => {
      if (visited.has(moduleId)) return;
      visited.add(moduleId);

      const module = currentModules.find((m) => m.id === moduleId);
      const isModelDefinition =
        module && MODEL_DEFINITION_TYPES.includes(module.type);

      // In Run All mode, skip model definition modules but still process their dependencies
      if (runAll && isModelDefinition) {
        // Still traverse upstream to ensure dependencies are included
        const upstreamConnections = connections.filter(
          (c) => c && c.to && c.to.moduleId === moduleId
        );
        const parentModules = currentModules.filter(
          (m) =>
            m &&
            upstreamConnections.some(
              (c) => c && c.from && c.from.moduleId === m.id
            )
        );
        parentModules.forEach((p) => traverse(p.id));

        // Traverse downstream to ensure modules that depend on this model definition are included
        const downstreamConnections = connections.filter(
          (c) => c && c.from && c.from.moduleId === moduleId
        );
        const childModules = currentModules.filter(
          (m) =>
            m &&
            downstreamConnections.some(
              (c) => c && c.to && c.to.moduleId === m.id
            )
        );
        childModules.forEach((child) => traverse(child.id));
        return; // Don't add model definition to queue
      }

      // Traverse upstream dependencies first
      const upstreamConnections = connections.filter(
        (c) => c && c.to && c.to.moduleId === moduleId
      );
      const parentModules = currentModules.filter(
        (m) =>
          m &&
          upstreamConnections.some(
            (c) => c && c.from && c.from.moduleId === m.id
          )
      );
      parentModules.forEach((p) => traverse(p.id));

      // Add to queue if not already present
      if (!runQueue.includes(moduleId)) {
        runQueue.push(moduleId);
      }

      // In Run All mode, also traverse downstream to ensure all connected modules are included
      if (runAll) {
        const downstreamConnections = connections.filter(
          (c) => c.from.moduleId === moduleId
        );
        const childModules = currentModules.filter((m) =>
          downstreamConnections.some((c) => c.to.moduleId === m.id)
        );
        childModules.forEach((child) => {
          if (!visited.has(child.id)) {
            traverse(child.id);
          }
        });
      }
    };

    if (runAll) {
      // Run All: traverse from all root nodes to include all modules
      // Ignore startModuleId and traverse all root nodes
      const rootNodes = currentModules.filter(
        (m) => !connections.some((c) => c.to.moduleId === m.id)
      );
      if (rootNodes.length > 0) {
        // Traverse all root nodes to ensure all modules are included
        rootNodes.forEach((node) => traverse(node.id));
      } else {
        // If no root nodes (circular dependencies), traverse all modules
        currentModules.forEach((m) => traverse(m.id));
      }
    } else {
      // Individual module run: only run this module (but still check dependencies)
      traverse(startModuleId);
      // Only keep the target module in the queue for individual runs
      runQueue.length = 0;
      runQueue.push(startModuleId);
    }

    const getSingleInputData = (
      moduleId: string,
      portType: Port["type"] = "data",
      portName?: string
    ): DataPreview | null => {
      const inputConnection = connections.find((c) => {
        if (!c || !c.to || !c.from) return false;
        if (c.to.moduleId === moduleId) {
          const targetModule = currentModules.find((m) => m.id === moduleId);
          const targetPort = targetModule?.inputs.find(
            (p) => p.name === c.to.portName
          );
          if (targetPort?.type !== portType) return false;
          // 포트 이름이 지정된 경우 일치하는지 확인
          if (portName && c.to.portName !== portName) return false;
          return true;
        }
        return false;
      });

      if (
        !inputConnection ||
        !inputConnection.from ||
        !inputConnection.from.moduleId
      ) {
        console.log(
          `getSingleInputData: No input connection found for module ${moduleId}, portType: ${portType}, portName: ${portName}`
        );
        return null;
      }

      const sourceModule = currentModules.find(
        (sm) => sm && sm.id === inputConnection.from.moduleId
      );

      if (!sourceModule) {
        console.log(
          `getSingleInputData: Source module not found for connection from ${inputConnection.from.moduleId}`
        );
        return null;
      }

      if (!sourceModule.outputData) {
        console.log(
          `getSingleInputData: Source module ${sourceModule.name} (${sourceModule.type}) has no outputData`
        );
        return null;
      }

      const fromPortName = inputConnection.from?.portName;
      console.log(
        `getSingleInputData: Found connection from ${sourceModule.name} (${sourceModule.type}) port ${fromPortName} to module ${moduleId}, outputData type: ${sourceModule.outputData.type}`
      );

      // 두 번째 출력 포트 처리
      if (fromPortName === "data_out2" && (sourceModule as any).outputData2) {
        const outputData2 = (sourceModule as any).outputData2;
        if (outputData2.type === "DataPreview" && portType === "data") {
          return outputData2;
        }
      }

      // SimulateFreqSevTable의 output_1, output_2 포트 처리
      if (sourceModule.type === ModuleType.SimulateFreqSevTable && portType === "data") {
        if (fromPortName === "output_1" && (sourceModule as any).outputData1) {
          return (sourceModule as any).outputData1;
        }
        if (fromPortName === "output_2" && (sourceModule as any).outputData2) {
          return (sourceModule as any).outputData2;
        }
      }

      if (
        sourceModule.outputData.type === "SplitDataOutput" &&
        portType === "data"
      ) {
        if (fromPortName === "train_data_out")
          return sourceModule.outputData.train;
        if (fromPortName === "test_data_out")
          return sourceModule.outputData.test;
      }

      // DataPreview 타입인 경우 포트 이름과 관계없이 반환 (Score Model 등은 다양한 포트 이름 사용)
      if (
        sourceModule.outputData.type === "DataPreview" &&
        portType === "data"
      ) {
        // 포트 이름이 data_out, scored_data_out, predictions_out이거나 지정되지 않은 경우 반환
        if (
          !fromPortName ||
          fromPortName === "data_out" ||
          fromPortName === "scored_data_out" ||
          fromPortName === "predictions_out"
        ) {
          console.log(
            `getSingleInputData: Returning DataPreview from ${sourceModule.name} (port: ${fromPortName})`
          );
          return sourceModule.outputData;
        }
      }

      // JMDC outputs (Cohort, Outcome) carry DataPreview-compatible rows/columns
      // and can be consumed by downstream JMDC modules as a data input.
      if (
        (sourceModule.outputData.type === "JMDCCohortOutput" ||
          sourceModule.outputData.type === "JMDCOutcomeOutput") &&
        portType === "data"
      ) {
        return sourceModule.outputData as unknown as DataPreview;
      }

      if (
        (sourceModule.outputData.type === "MissingHandlerOutput" &&
          portType === "handler") ||
        (sourceModule.outputData.type === "EncoderOutput" &&
          portType === "handler") ||
        (sourceModule.outputData.type === "NormalizerOutput" &&
          portType === "handler")
      ) {
        return sourceModule.outputData;
      }

      console.log(
        `getSingleInputData: No matching output data type. outputData.type: ${sourceModule.outputData.type}, portType: ${portType}, fromPortName: ${fromPortName}`
      );
      return null;
    };

    if (runAll && runQueue.length > 0) {
      setRunAllProgress({ current: 0, total: runQueue.length });
    }
    let runQueueIndex = 0;
    for (const moduleId of runQueue) {
      if (runAll) {
        setRunAllProgress({ current: runQueueIndex, total: runQueue.length });
      }
      runQueueIndex++;
      const module = currentModules.find((m) => m.id === moduleId)!;
      const moduleName = module.name;

      // Skip model definition modules - they should only run through Train Model
      if (MODEL_DEFINITION_TYPES.includes(module.type)) {
        addLog(
          "INFO",
          `Module [${moduleName}] is a model definition module and will be executed when Train Model runs.`
        );
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, status: ModuleStatus.Pending } : m
          )
        );
        continue;
      }

      // Check if upstream modules are ready (only for individual runs, not Run All)
      if (
        !runAll &&
        !areUpstreamModulesReady(moduleId, currentModules, connections)
      ) {
        addLog(
          "WARN",
          `Module [${moduleName}] cannot run: upstream modules are not ready.`
        );
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, status: ModuleStatus.Error } : m
          )
        );
        continue;
      }

      // #8: 입력 포트 연결 검사 (개별 실행 시)
      if (!runAll) {
        const connError = validateModuleConnections(module, connections);
        if (connError) {
          addLog("ERROR", `[${moduleName}] 연결 오류: ${connError}`);
          setModules((prev) =>
            prev.map((m) =>
              m.id === moduleId ? { ...m, status: ModuleStatus.Error } : m
            )
          );
          continue;
        }
      }

      // #3: 파라미터 유효성 사전 검사
      const paramError = validateModuleParameters(module);
      if (paramError) {
        addLog("ERROR", `[${moduleName}] 파라미터 오류: ${paramError}`);
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, status: ModuleStatus.Error } : m
          )
        );
        continue;
      }

      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId ? { ...m, status: ModuleStatus.Running } : m
        )
      );
      addLog("INFO", `Module [${moduleName}] execution started.`);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const moduleStartTime = Date.now();
      let newStatus = ModuleStatus.Error;
      let newOutputData: CanvasModule["outputData"] | undefined = undefined;
      let logMessage = `Module [${moduleName}] failed.`;
      let logLevel: TerminalLog["level"] = "ERROR";

      try {
        if (module.type === ModuleType.LoadData) {
          let fileContent = module.parameters.fileContent as string;
          // 데이터 본문이 없으면 데이터셋 레지스트리에서 파일명(source)으로 해석 시도.
          // 캐시 → 번들 public/examples-in-load.json → Supabase 'datasets' 웹 폴백 순.
          // 샘플/참조 저장 모델이 어떤 경로로 로드됐든 실행 시 데이터를 자동 확보한다.
          if (!fileContent) {
            const src = String(module.parameters.source || "").trim();
            if (src) {
              addLog(
                "INFO",
                `데이터 본문이 없어 '${src}'를 데이터셋(예제/웹)에서 불러옵니다…`
              );
              const resolved = await resolveDatasetContent(src);
              if (resolved) {
                fileContent = resolved;
                const isExcel = /\.xlsx?$/i.test(src);
                updateModuleParameters(module.id, {
                  fileContent: resolved,
                  fileType: isExcel ? "excel" : "csv",
                  sourceType: "file",
                });
                addLog("SUCCESS", `'${src}' 데이터를 불러왔습니다.`);
              }
            }
          }
          if (!fileContent)
            throw new Error(
              "No file content loaded. Please select a CSV file."
            );

          // B-2: 대용량 파일 경고
          const fileSizeMB = (new Blob([fileContent]).size) / (1024 * 1024);
          if (fileSizeMB > 20) {
            addLog("ERROR", `파일 크기가 ${fileSizeMB.toFixed(1)}MB로 너무 큽니다. Pyodide 실행 시 메모리 초과가 발생할 수 있습니다. 10MB 이하를 권장합니다.`);
            throw new Error(`파일 크기(${fileSizeMB.toFixed(1)}MB)가 Pyodide 한계(20MB)를 초과합니다.`);
          }
          if (fileSizeMB > 10) {
            addLog("WARN", `대용량 파일 감지: ${fileSizeMB.toFixed(1)}MB. Pyodide 실행이 느릴 수 있습니다. 데이터 일부만 사용하거나 외부 Python(Jupyter)에서 실행을 권장합니다.`);
          }

          // CSV 파싱 함수 (따옴표 처리 포함)
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const nextChar = line[i + 1];

              if (char === '"') {
                if (inQuotes && nextChar === '"') {
                  // 이스케이프된 따옴표
                  current += '"';
                  i++; // 다음 문자 건너뛰기
                } else {
                  // 따옴표 시작/끝
                  inQuotes = !inQuotes;
                }
              } else if (char === "," && !inQuotes) {
                // 쉼표로 필드 구분
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim()); // 마지막 필드
            return result;
          };

          const lines = fileContent
            .trim()
            .split(/\r?\n/)
            .filter((line) => line.trim() !== "");
          if (lines.length < 1)
            throw new Error("CSV file is empty or invalid.");

          const header = parseCSVLine(lines[0]).map((h) =>
            h.replace(/^"|"$/g, "")
          );
          if (header.length === 0)
            throw new Error("CSV file has no header row.");

          const stringRows = lines.slice(1).map((line) => {
            const values = parseCSVLine(line).map((v) =>
              v.replace(/^"|"$/g, "")
            );
            const rowObj: Record<string, string> = {};
            header.forEach((col, index) => {
              rowObj[col] = values[index] || "";
            });
            return rowObj;
          });

          // 컬럼 이름 중복 처리
          const uniqueHeader: string[] = [];
          const headerCount: Record<string, number> = {};
          header.forEach((name) => {
            const originalName = name || "Unnamed";
            if (headerCount[originalName] !== undefined) {
              headerCount[originalName]++;
              uniqueHeader.push(`${originalName}_${headerCount[originalName]}`);
            } else {
              headerCount[originalName] = 0;
              uniqueHeader.push(originalName);
            }
          });

          const columns: ColumnInfo[] = uniqueHeader.map((name) => {
            const sample = stringRows
              .slice(0, 100)
              .map((r) => r[name])
              .filter(
                (v) => v !== undefined && v !== null && String(v).trim() !== ""
              );

            // 샘플이 없으면 object로 설정 (빈 컬럼)
            if (sample.length === 0) {
              return { name, type: "object" };
            }

            // pandas dtype 결정: 숫자인지 확인
            // 모든 샘플 값이 유효한 숫자인지 확인
            const allAreNumbers = sample.every((v) => {
              const strVal = String(v).trim();
              // 빈 문자열이면 false
              if (strVal === "") return false;
              const num = Number(strVal);
              // NaN이 아니고 유한한 숫자인지 확인
              return !isNaN(num) && isFinite(num);
            });

            if (allAreNumbers) {
              // 정수만 있는지 확인 (소수점이 없는지)
              // 문자열에서 직접 정수인지 확인 (더 정확함)
              const allAreIntegers = sample.every((v) => {
                const strVal = String(v).trim();
                const num = Number(strVal);
                // 숫자이고 정수인지 확인
                return !isNaN(num) && isFinite(num) && Number.isInteger(num);
              });
              // 정수만 있으면 int64, 실수가 있으면 float64
              return { name, type: allAreIntegers ? "int64" : "float64" };
            } else {
              // 문자열인 경우 object
              return { name, type: "object" };
            }
          });

          if (columns.length === 0) {
            throw new Error("No valid columns found in CSV file.");
          }

          const rows = stringRows
            .map((stringRow, rowIndex) => {
              const typedRow: Record<string, string | number | null> = {};
              for (const col of columns) {
                const val = stringRow[col.name];
                // pandas dtype에 따라 처리
                if (col.type === "int64" || col.type === "float64") {
                  // 숫자형 컬럼
                  if (
                    val === undefined ||
                    val === null ||
                    String(val).trim() === ""
                  ) {
                    typedRow[col.name] = "";
                  } else {
                    const numVal =
                      col.type === "int64"
                        ? parseInt(String(val), 10)
                        : parseFloat(String(val));
                    typedRow[col.name] =
                      !isNaN(numVal) && isFinite(numVal) ? numVal : "";
                  }
                } else {
                  // 문자열형 컬럼 (object 등)
                  typedRow[col.name] =
                    val !== undefined && val !== null ? val : "";
                }
              }
              return typedRow;
            })
            .filter((row) => {
              // 모든 값이 null인 행 제거
              return Object.values(row).some(
                (val) => val !== null && val !== ""
              );
            });

          if (rows.length === 0) {
            throw new Error(
              "No valid data rows found in CSV file after parsing."
            );
          }

          // 전체 데이터를 저장 (View Details에서는 미리보기만 제한하여 표시)
          newOutputData = {
            type: "DataPreview",
            columns,
            totalRowCount: rows.length,
            rows: rows,
          };
        } else if (module.type === ModuleType.SelectData) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (inputData) {
            const selections =
              (module.parameters.columnSelections as Record<
                string,
                { selected: boolean; type: string }
              >) || {};
            const isConfigured = Object.keys(selections).length > 0;

            // 디버깅: selections 상태 확인
            console.log("SelectData Debug:", {
              isConfigured,
              selectionsKeys: Object.keys(selections),
              selections,
              inputColumns: inputData.columns.map((c) => c.name),
            });

            const newColumns: ColumnInfo[] = [];
            inputData.columns.forEach((col) => {
              const selection = selections[col.name];
              // If the module is unconfigured, default to selecting all columns. Otherwise, respect the selection.
              let shouldInclude: boolean;
              if (!isConfigured) {
                // configured가 아니면 모든 열 선택 (기본 동작)
                shouldInclude = true;
              } else {
                // configured인 경우
                // selection이 없으면 기본적으로 선택된 것으로 간주 (새로 추가된 열 등)
                // selection이 있으면 selected 값에 따라 결정
                // selected가 명시적으로 false가 아니면 선택 (true 또는 undefined도 선택으로 간주)
                shouldInclude = selection ? selection.selected !== false : true;
              }

              if (shouldInclude) {
                // selection?.type이 있고 유효한 값이면 사용, 없거나 빈 문자열이면 원본 컬럼 타입 사용
                // 원본 컬럼 타입이 이미 pandas dtype이므로 그대로 사용
                let columnType: string;
                if (selection?.type && selection.type.trim() !== "") {
                  // selection에 타입이 명시적으로 설정되어 있으면 사용
                  columnType = selection.type;
                } else {
                  // selection이 없거나 타입이 없으면 원본 컬럼 타입 사용
                  // 이는 pandas dtype (int64, float64, object 등)이어야 함
                  columnType = col.type;
                }

                // 디버깅: 컬럼 타입 확인
                if (col.name === "CHAS" || col.type === "int64") {
                  console.log("SelectData column type assignment:", {
                    colName: col.name,
                    originalType: col.type,
                    selectionType: selection?.type,
                    finalType: columnType,
                  });
                }

                newColumns.push({
                  name: col.name,
                  type: columnType,
                });
              }
            });

            // 디버깅: 선택된 열 확인
            console.log("SelectData Debug - Selected columns:", {
              newColumnsCount: newColumns.length,
              newColumnsNames: newColumns.map((c) => c.name),
            });

            if (
              isConfigured &&
              newColumns.length === 0 &&
              inputData.columns.length > 0
            ) {
              console.error("SelectData Error - No columns selected:", {
                isConfigured,
                selections,
                inputColumns: inputData.columns.map((c) => c.name),
              });
              throw new Error(
                "No columns selected. Please select at least one column in the Properties panel."
              );
            }

            // 디버깅: newColumns 타입 확인
            console.log("SelectData Debug - newColumns types:", {
              newColumns: newColumns.map((c) => ({
                name: c.name,
                type: c.type,
              })),
              inputColumns: inputData.columns.map((c) => ({
                name: c.name,
                type: c.type,
              })),
            });

            const newRows = (inputData.rows || []).map((row) => {
              const newRow: Record<string, any> = {};
              newColumns.forEach((col) => {
                const originalValue = row[col.name];
                let newValue = originalValue; // Default to original

                // pandas dtype에 따라 변환
                const dtype = col.type;

                if (dtype.startsWith("int")) {
                  // int64, int32, int16, int8
                  if (
                    originalValue === null ||
                    originalValue === undefined ||
                    String(originalValue).trim() === ""
                  ) {
                    newValue = "";
                  } else {
                    const num = Number(originalValue);
                    newValue = isNaN(num) ? "" : Math.floor(num);
                  }
                } else if (dtype.startsWith("float")) {
                  // float64, float32
                  if (
                    originalValue === null ||
                    originalValue === undefined ||
                    String(originalValue).trim() === ""
                  ) {
                    newValue = "";
                  } else {
                    const num = Number(originalValue);
                    newValue = isNaN(num) ? "" : num;
                  }
                } else if (dtype === "object") {
                  // 문자열 (object)
                  newValue =
                    originalValue === null || originalValue === undefined
                      ? ""
                      : String(originalValue);
                } else if (dtype === "bool") {
                  // 불리언
                  if (originalValue === null || originalValue === undefined) {
                    newValue = false;
                  } else {
                    const strVal = String(originalValue).toLowerCase().trim();
                    newValue =
                      strVal === "true" || strVal === "1" || strVal === "yes";
                  }
                } else if (
                  dtype === "datetime64" ||
                  dtype.startsWith("datetime")
                ) {
                  // 날짜/시간
                  newValue =
                    originalValue === null || originalValue === undefined
                      ? ""
                      : String(originalValue);
                } else if (dtype === "category") {
                  // 카테고리
                  newValue =
                    originalValue === null || originalValue === undefined
                      ? ""
                      : String(originalValue);
                }
                // 기타 타입은 원본 값 유지

                newRow[col.name] = newValue;
              });
              return newRow;
            });
            newOutputData = {
              type: "DataPreview",
              columns: newColumns,
              totalRowCount: inputData.totalRowCount,
              rows: newRows,
            };
          } else {
            throw new Error(
              "Input data not available or is of the wrong type."
            );
          }
        } else if (module.type === ModuleType.DataFiltering) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const {
            filter_type = "row",
            conditions = [],
            logical_operator = "AND",
          } = module.parameters;

          if (!conditions || conditions.length === 0) {
            throw new Error(
              "At least one condition is required for filtering."
            );
          }

          // Pyodide를 사용하여 Python으로 필터링 수행
          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 데이터 필터링 수행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { filterDataPython } = pyodideModule;

            const result = await filterDataPython(
              inputData.rows || [],
              filter_type,
              conditions,
              logical_operator,
              60000 // 타임아웃: 60초
            );

            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };

            addLog("SUCCESS", "Python으로 데이터 필터링 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python DataFiltering 실패: ${errorMessage}`);
            throw new Error(`데이터 필터링 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.Recommender) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const {
            user_col = "",
            item_col = "",
            rating_col = "",
            n_components = 2,
            top_n = 5,
          } = module.parameters;

          if (!user_col || !item_col || !rating_col) {
            throw new Error(
              "User, Item, and Rating columns must all be selected."
            );
          }

          // Pyodide를 사용하여 Python으로 협업 필터링 추천 수행 (NMF, random_state=42)
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 협업 필터링 추천 수행 중... (user=${user_col}, item=${item_col}, rating=${rating_col})`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { runRecommenderPython } = pyodideModule;

            const result = await runRecommenderPython(
              inputData.rows || [],
              user_col,
              item_col,
              rating_col,
              Number(n_components) || 2,
              Number(top_n) || 5,
              60000 // 타임아웃: 60초
            );

            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };

            addLog(
              "SUCCESS",
              `Python으로 추천 완료: ${result.rows.length}건 추천 생성`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python Recommender 실패: ${errorMessage}`);
            throw new Error(`추천 수행 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.ColumnPlot) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const {
            plot_type = "single",
            column1 = "",
            column2 = "",
          } = module.parameters;

          if (!column1) {
            throw new Error("Column 1 must be selected.");
          }

          if (plot_type === "double" && !column2) {
            throw new Error("Column 2 must be selected for two-column plots.");
          }

          // 컬럼 타입 확인
          const col1 = inputData.columns.find((c) => c.name === column1);
          const col2 = column2
            ? inputData.columns.find((c) => c.name === column2)
            : undefined;

          if (!col1) {
            throw new Error(`Column '${column1}' not found in input data.`);
          }

          const column1Type: "number" | "string" =
            col1.type === "number" ? "number" : "string";
          const column2Type: "number" | "string" | undefined = col2
            ? col2.type === "number"
              ? "number"
              : "string"
            : undefined;

          // 사용 가능한 차트 타입 결정
          const getAvailableCharts = (
            plot_type: "single" | "double",
            column1Type: "number" | "string",
            column2Type?: "number" | "string"
          ): string[] => {
            if (plot_type === "single") {
              if (column1Type === "number") {
                return [
                  "Histogram",
                  "KDE Plot",
                  "Boxplot",
                  "Violin Plot",
                  "ECDF Plot",
                  "QQ-Plot",
                  "Line Plot",
                  "Area Plot",
                ];
              } else {
                return [
                  "Bar Plot",
                  "Count Plot",
                  "Pie Chart",
                  "Frequency Table",
                ];
              }
            } else {
              if (column1Type === "number" && column2Type === "number") {
                return [
                  "Scatter Plot",
                  "Hexbin Plot",
                  "Joint Plot",
                  "Line Plot",
                  "Regression Plot",
                  "Heatmap",
                ];
              } else if (
                (column1Type === "number" && column2Type === "string") ||
                (column1Type === "string" && column2Type === "number")
              ) {
                return [
                  "Box Plot",
                  "Violin Plot",
                  "Bar Plot",
                  "Strip Plot",
                  "Swarm Plot",
                ];
              } else {
                return ["Grouped Bar Plot", "Heatmap", "Mosaic Plot"];
              }
            }
          };

          const availableCharts = getAvailableCharts(
            plot_type as "single" | "double",
            column1Type,
            column2Type
          );

          // ColumnPlotOutput 생성 (실제 차트는 View Details에서 생성)
          newOutputData = {
            type: "ColumnPlotOutput",
            plot_type: plot_type as "single" | "double",
            column1,
            column2: column2 || undefined,
            column1Type,
            column2Type,
            availableCharts,
          };

          addLog("SUCCESS", "Column Plot 설정 완료");
        } else if (module.type === ModuleType.OutlierDetector) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const { columns = [] } = module.parameters;

          if (!Array.isArray(columns) || columns.length === 0) {
            throw new Error(
              "At least one column must be selected for outlier detection."
            );
          }

          if (columns.length > 5) {
            throw new Error(
              "Maximum 5 columns can be selected for outlier detection."
            );
          }

          // 컬럼 확인
          const invalidColumns: string[] = [];
          const numericColumns: string[] = [];
          columns.forEach((colName: string) => {
            const col = inputData.columns.find((c) => c.name === colName);
            if (!col) {
              invalidColumns.push(colName);
            } else if (
              !(col.type.startsWith("int") || col.type.startsWith("float"))
            ) {
              invalidColumns.push(colName);
            } else {
              numericColumns.push(colName);
            }
          });

          if (invalidColumns.length > 0) {
            throw new Error(
              `Invalid columns: ${invalidColumns.join(
                ", "
              )}. All columns must be numeric.`
            );
          }

          // Pyodide를 사용하여 Python으로 각 열에 대해 이상치 탐지
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 이상치 탐지 중... (Columns: ${columns.join(
                ", "
              )})`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { detectOutliers } = pyodideModule;

            const columnResults: Array<{
              column: string;
              results: Array<{
                method: "IQR" | "ZScore" | "IsolationForest" | "Boxplot";
                outlierIndices: number[];
                outlierCount: number;
                outlierPercentage: number;
                details?: Record<string, any>;
              }>;
              totalOutliers: number;
              outlierIndices: number[];
            }> = [];

            // 모든 열에 대해 이상치 탐지 수행
            for (const column of columns) {
              const result = await detectOutliers(
                inputData.rows || [],
                column,
                ["IQR", "ZScore", "IsolationForest", "Boxplot"], // 모든 방법 사용
                1.5, // IQR multiplier
                3, // Z-score threshold
                0.1, // Isolation Forest contamination
                120000 // 타임아웃: 120초
              );

              columnResults.push({
                column,
                results: result.results,
                totalOutliers: result.totalOutliers,
                outlierIndices: result.outlierIndices,
              });
            }

            // 모든 열에서 탐지된 이상치 인덱스 합집합
            const allOutlierIndicesSet = new Set<number>();
            columnResults.forEach((cr) => {
              cr.outlierIndices.forEach((idx) => allOutlierIndicesSet.add(idx));
            });
            const allOutlierIndices = Array.from(allOutlierIndicesSet).sort(
              (a, b) => a - b
            );

            // 원본 데이터 저장 (제거 작업을 위해 필요)
            const originalRows = inputData.rows || [];

            newOutputData = {
              type: "OutlierDetectorOutput",
              columns,
              columnResults,
              totalOutliers: allOutlierIndices.length,
              allOutlierIndices,
              originalData: originalRows,
              // 초기에는 cleanedData를 생성하지 않음 (사용자가 제거할 때 생성)
            };

            addLog(
              "SUCCESS",
              `Python으로 이상치 탐지 완료: ${columns.length}개 열에서 총 ${allOutlierIndices.length}개 이상치 행 발견`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python Outlier Detection 실패: ${errorMessage}`);
            throw new Error(`이상치 탐지 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.HypothesisTesting) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const { tests = [] } = module.parameters;

          if (!Array.isArray(tests) || tests.length === 0) {
            throw new Error(
              "At least one test must be selected for hypothesis testing."
            );
          }

          // 각 테스트에 대해 열이 선택되었는지 확인
          const invalidTests: string[] = [];
          tests.forEach((test: any, index: number) => {
            if (!test.testType) {
              invalidTests.push(`Test ${index + 1}: missing testType`);
            } else if (
              !Array.isArray(test.columns) ||
              test.columns.length === 0
            ) {
              invalidTests.push(
                `Test ${index + 1} (${test.testType}): no columns selected`
              );
            }
          });

          if (invalidTests.length > 0) {
            throw new Error(
              `Invalid test configuration:\n${invalidTests.join("\n")}`
            );
          }

          // Pyodide를 사용하여 Python으로 가설 검정 수행
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 가설 검정 수행 중... (${tests.length}개 테스트)`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { performHypothesisTests } = pyodideModule;

            const results = await performHypothesisTests(
              inputData.rows || [],
              tests,
              120000 // 타임아웃: 120초
            );

            newOutputData = {
              type: "HypothesisTestingOutput",
              results: results.map((r) => ({
                testType: r.testType as HypothesisTestType,
                testName: r.testName,
                columns: r.columns,
                statistic: r.statistic,
                pValue: r.pValue,
                degreesOfFreedom: r.degreesOfFreedom,
                criticalValue: r.criticalValue,
                conclusion: r.conclusion,
                interpretation: r.interpretation,
                details: r.details,
              })),
            };

            const successCount = results.filter(
              (r) => r.pValue !== undefined && !r.testName.startsWith("Error:")
            ).length;
            addLog(
              "SUCCESS",
              `Python으로 가설 검정 완료: ${successCount}/${results.length}개 테스트 성공`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python Hypothesis Testing 실패: ${errorMessage}`);
            throw new Error(`가설 검정 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.NormalityChecker) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const { column = "", tests = [] } = module.parameters;

          if (!column) {
            throw new Error("Column must be selected for normality checking.");
          }

          if (!Array.isArray(tests) || tests.length === 0) {
            throw new Error(
              "At least one test must be selected for normality checking."
            );
          }

          // 선택된 열이 입력 데이터에 있는지 확인
          const col = inputData.columns.find((c) => c.name === column);
          if (!col) {
            throw new Error(`Column '${column}' not found in input data.`);
          }

          if (!(col.type.startsWith("int") || col.type.startsWith("float"))) {
            throw new Error(
              `Column '${column}' must be numeric for normality checking.`
            );
          }

          // Pyodide를 사용하여 Python으로 정규성 검정 수행
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 정규성 검정 수행 중... (${tests.length}개 테스트)`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { performNormalityCheck } = pyodideModule;

            const result = await performNormalityCheck(
              inputData.rows || [],
              column,
              tests,
              120000 // 타임아웃: 120초
            );

            newOutputData = {
              type: "NormalityCheckerOutput",
              column: result.column,
              skewness: result.skewness,
              kurtosis: result.kurtosis,
              jarqueBera: result.jarqueBera,
              testResults: result.testResults.map((r: any) => ({
                testType: r.testType as NormalityTestType,
                testName: r.testName,
                statistic: r.statistic,
                pValue: r.pValue,
                criticalValue: r.criticalValue,
                conclusion: r.conclusion,
                interpretation: r.interpretation,
                details: r.details,
              })),
              histogramImage: result.histogramImage,
              qqPlotImage: result.qqPlotImage,
              ecdfImage: result.ecdfImage,
              boxplotImage: result.boxplotImage,
            };

            const successCount = result.testResults.filter(
              (r: any) =>
                r.statistic !== undefined && !r.testName.startsWith("Error:")
            ).length;
            addLog(
              "SUCCESS",
              `Python으로 정규성 검정 완료: ${successCount}/${result.testResults.length}개 테스트 성공`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python Normality Check 실패: ${errorMessage}`);
            throw new Error(`정규성 검정 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.JMDCCohortBuilder) {
          // [J1] Cohort Builder — synthetic mode integrated; optional upstream data
          const inputData = getSingleInputData(module.id) as DataPreview | null;
          try {
            addLog("INFO", "[J1] JMDC Cohort Builder 실행 중 (Python/Pyodide)...");
            const { performJMDCCohort } = await import("./utils/pyodideRunner");
            const result = await performJMDCCohort(
              inputData?.rows ?? null,
              module.parameters
            );
            // store hidden _claimsDisease in module.parameters for J2 to pick up
            const newParams = {
              ...module.parameters,
              _claims_disease: result._claims_disease ?? null,
            };
            setModules((prev) =>
              prev.map((m) =>
                m.id === module.id ? { ...m, parameters: newParams } : m
              )
            );
            newOutputData = {
              type: "JMDCCohortOutput",
              rows: result.rows,
              columns: result.columns,
              totalRowCount: result.totalRowCount,
              funnel: result.funnel,
              sexDistribution: result.sexDistribution,
              ageBandDistribution: result.ageBandDistribution,
              exclusionReasons: result.exclusionReasons,
              dataSource: result.dataSource,
              parameters: result.parameters,
            };
            addLog(
              "SUCCESS",
              `[J1] Cohort 생성 완료: N=${result.totalRowCount.toLocaleString()} (source: ${result.dataSource})`
            );
          } catch (error: any) {
            addLog("ERROR", `[J1] Cohort Builder 실패: ${error.message || error}`);
            throw new Error(`Cohort Builder 실패: ${error.message || error}`);
          }
        } else if (module.type === ModuleType.JMDCOutcomeLabeler) {
          // [J2] Outcome Labeler
          // dataframe : cohort from J1 (port data_in)
          // dataframe2: external claims_disease (port data_in2, optional);
          //             when absent, use synthetic claims piggy-backed on the J1 module parameters.
          const cohortInput = getSingleInputData(module.id, "data", "data_in") as DataPreview | null;
          const claimsInput = getSingleInputData(module.id, "data", "data_in2") as DataPreview | null;
          if (!cohortInput) {
            throw new Error("[J2] cohort 입력이 없습니다 (J1 모듈을 data_in에 연결).");
          }
          // Try to recover claims_disease from upstream J1 module's hidden param
          let claimsRows: any[] | null = claimsInput?.rows ?? null;
          if (!claimsRows) {
            const upstreamConn = connections.find(
              (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
            );
            if (upstreamConn) {
              const up = modules.find((m) => m.id === upstreamConn.from.moduleId);
              if (up && up.parameters?._claims_disease) {
                claimsRows = up.parameters._claims_disease;
              }
            }
          }
          try {
            addLog("INFO", "[J2] Outcome Labeler 실행 중 (Python/Pyodide)...");
            const { performJMDCOutcomeLabeler } = await import("./utils/pyodideRunner");
            const result = await performJMDCOutcomeLabeler(
              cohortInput.rows ?? [],
              claimsRows,
              module.parameters
            );
            newOutputData = {
              type: "JMDCOutcomeOutput",
              rows: result.allRows ?? result.rows,
              columns: result.columns,
              totalRowCount: result.totalRowCount,
              eventSummary: result.eventSummary,
              outcomeBreakdown: result.outcomeBreakdown,
            } as any;
            addLog(
              "SUCCESS",
              `[J2] Outcome 라벨링 완료: events=${result.eventSummary.events}/${result.eventSummary.total}`
            );
          } catch (error: any) {
            addLog("ERROR", `[J2] Outcome Labeler 실패: ${error.message || error}`);
            throw new Error(`Outcome Labeler 실패: ${error.message || error}`);
          }
        } else if (module.type === ModuleType.JMDCIncidenceRate) {
          const inputData = getSingleInputData(module.id) as DataPreview | null;
          if (!inputData) throw new Error("[J3] J2의 labeled cohort를 입력에 연결하세요.");
          try {
            addLog("INFO", "[J3] Incidence Rate 계산 중 (Python/Pyodide)...");
            const { performJMDCIncidenceRate } = await import("./utils/pyodideRunner");
            const result = await performJMDCIncidenceRate(
              inputData.rows ?? [],
              module.parameters
            );
            newOutputData = {
              type: "JMDCIncidenceOutput",
              ...result,
            } as any;
            addLog("SUCCESS", `[J3] Incidence Rate 산출 완료 (${result.rateTable.length} strata).`);
          } catch (error: any) {
            addLog("ERROR", `[J3] Incidence Rate 실패: ${error.message || error}`);
            throw new Error(`Incidence Rate 실패: ${error.message || error}`);
          }
        } else if (module.type === ModuleType.JMDCSurvivalCompare) {
          const inputData = getSingleInputData(module.id) as DataPreview | null;
          if (!inputData) throw new Error("[J4] J2의 labeled cohort를 입력에 연결하세요.");
          try {
            addLog("INFO", "[J4] KM Survival Compare 실행 중 (Python + lifelines)...");
            const { performJMDCSurvivalCompare } = await import("./utils/pyodideRunner");
            const result = await performJMDCSurvivalCompare(
              inputData.rows ?? [],
              module.parameters
            );
            newOutputData = { type: "JMDCSurvivalOutput", ...result } as any;
            addLog(
              "SUCCESS",
              `[J4] KM 비교 완료 (groups=${result.curves.length}, log-rank p=${result.logrankP?.toExponential?.(3) ?? "—"}).`
            );
          } catch (error: any) {
            addLog("ERROR", `[J4] Survival Compare 실패: ${error.message || error}`);
            throw new Error(`Survival Compare 실패: ${error.message || error}`);
          }
        } else if (module.type === ModuleType.JMDCCumulativeIncidence) {
          const inputData = getSingleInputData(module.id) as DataPreview | null;
          if (!inputData) throw new Error("[J5] J2의 labeled cohort를 입력에 연결하세요.");
          try {
            addLog("INFO", "[J5] Cumulative Incidence 계산 중 (Python + lifelines)...");
            const { performJMDCCumulativeIncidence } = await import("./utils/pyodideRunner");
            const result = await performJMDCCumulativeIncidence(
              inputData.rows ?? [],
              module.parameters
            );
            newOutputData = { type: "JMDCSurvivalOutput", ...result } as any;
            addLog("SUCCESS", `[J5] CIF 산출 완료 (${result.curves.length} curves).`);
          } catch (error: any) {
            addLog("ERROR", `[J5] Cumulative Incidence 실패: ${error.message || error}`);
            throw new Error(`Cumulative Incidence 실패: ${error.message || error}`);
          }
        } else if (module.type === ModuleType.JMDCRiskStratification) {
          const inputData = getSingleInputData(module.id) as DataPreview | null;
          if (!inputData) throw new Error("[J6] J2의 labeled cohort를 입력에 연결하세요.");
          try {
            addLog("INFO", "[J6] Cox PH 모형 적합 중 (Python + lifelines)...");
            const { performJMDCRiskStratification } = await import("./utils/pyodideRunner");
            const result = await performJMDCRiskStratification(
              inputData.rows ?? [],
              module.parameters
            );
            newOutputData = { type: "JMDCCoxOutput", ...result } as any;
            addLog(
              "SUCCESS",
              `[J6] Cox 적합 완료 (C-index=${result.concordance?.toFixed?.(3) ?? "—"}, vars=${result.hrTable.length}).`
            );
          } catch (error: any) {
            addLog("ERROR", `[J6] Risk Stratification 실패: ${error.message || error}`);
            throw new Error(`Risk Stratification 실패: ${error.message || error}`);
          }
        } else if (module.type === ModuleType.JMDCKRJPMatcher) {
          const jpInput = getSingleInputData(module.id, "data", "data_in") as DataPreview | null;
          const krInput = getSingleInputData(module.id, "data", "data_in2") as DataPreview | null;
          if (!jpInput || !krInput) {
            throw new Error("[J7] JP 코호트와 KR 코호트를 각각 data_in, data_in2 포트에 연결하세요.");
          }
          try {
            addLog("INFO", "[J7] KR-JP Matcher 실행 중 (Python + sklearn + lifelines)...");
            const { performJMDCMatcher } = await import("./utils/pyodideRunner");
            const result = await performJMDCMatcher(
              jpInput.rows ?? [],
              krInput.rows ?? [],
              module.parameters
            );
            newOutputData = { type: "JMDCMatcherOutput", ...result } as any;
            addLog(
              "SUCCESS",
              `[J7] KR-JP 매칭 완료 (variables=${result.smdTable.length}, SIR rows=${result.sirTable.length}).`
            );
          } catch (error: any) {
            addLog("ERROR", `[J7] KR-JP Matcher 실패: ${error.message || error}`);
            throw new Error(`KR-JP Matcher 실패: ${error.message || error}`);
          }
        } else if (module.type === ModuleType.VIFChecker) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const { feature_columns = [] } = module.parameters;

          if (!Array.isArray(feature_columns) || feature_columns.length < 2) {
            throw new Error(
              "At least 2 feature columns must be selected for VIF calculation."
            );
          }

          // 선택된 열이 입력 데이터에 있는지 확인
          const invalidColumns: string[] = [];
          feature_columns.forEach((colName: string) => {
            const col = inputData.columns.find((c) => c.name === colName);
            if (!col) {
              invalidColumns.push(colName);
            } else {
              // 숫자형 열인지 확인
              if (
                !col.type.startsWith("int") &&
                !col.type.startsWith("float")
              ) {
                invalidColumns.push(`${colName} (non-numeric: ${col.type})`);
              }
            }
          });

          if (invalidColumns.length > 0) {
            throw new Error(
              `Invalid or non-numeric columns: ${invalidColumns.join(", ")}`
            );
          }

          // Pyodide를 사용하여 Python으로 VIF 계산 수행
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 VIF 계산 수행 중... (${feature_columns.length}개 열)`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { calculateVIFPython } = pyodideModule;

            const vifResults = await calculateVIFPython(
              inputData.rows || [],
              feature_columns,
              120000 // 타임아웃: 120초
            );

            newOutputData = {
              type: "VIFCheckerOutput",
              results: vifResults,
            } as VIFCheckerOutput;

            addLog("SUCCESS", `VIF 계산 완료 (${vifResults.length}개 열 분석)`);
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `VIF 계산 실패: ${errorMessage}`);
            throw new Error(`VIF calculation failed: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.Correlation) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const { columns = [] } = module.parameters;

          if (!Array.isArray(columns) || columns.length === 0) {
            throw new Error(
              "At least one column must be selected for correlation analysis."
            );
          }

          // 선택된 열이 입력 데이터에 있는지 확인
          const invalidColumns: string[] = [];
          columns.forEach((colName: string) => {
            const col = inputData.columns.find((c) => c.name === colName);
            if (!col) {
              invalidColumns.push(colName);
            }
          });

          if (invalidColumns.length > 0) {
            throw new Error(`Invalid columns: ${invalidColumns.join(", ")}`);
          }

          // 숫자형과 범주형 열 분리
          const numericColumns: string[] = [];
          const categoricalColumns: string[] = [];
          columns.forEach((colName: string) => {
            const col = inputData.columns.find((c) => c.name === colName);
            if (col) {
              if (col.type.startsWith("int") || col.type.startsWith("float")) {
                numericColumns.push(colName);
              } else if (col.type === "object") {
                categoricalColumns.push(colName);
              }
            }
          });

          // Pyodide를 사용하여 Python으로 상관분석 수행
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 상관분석 수행 중... (${columns.length}개 열)`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { performCorrelationAnalysis } = pyodideModule;

            const result = await performCorrelationAnalysis(
              inputData.rows || [],
              columns,
              numericColumns,
              categoricalColumns,
              120000 // 타임아웃: 120초
            );

            // 결과 검증
            if (!result) {
              throw new Error("Correlation analysis returned no result");
            }
            if (
              !result.correlationMatrices ||
              !Array.isArray(result.correlationMatrices)
            ) {
              throw new Error(
                "Correlation analysis returned invalid correlationMatrices"
              );
            }

            newOutputData = {
              type: "CorrelationOutput",
              columns,
              numericColumns,
              categoricalColumns,
              correlationMatrices: result.correlationMatrices || [],
              heatmapImage: result.heatmapImage,
              pairplotImage: result.pairplotImage,
              summary: result.summary || {},
            };

            const methodCount = result.correlationMatrices?.length || 0;
            addLog(
              "SUCCESS",
              `Python으로 상관분석 완료: ${methodCount}개 방법, ${numericColumns.length}개 숫자형, ${categoricalColumns.length}개 범주형 열 분석`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog(
              "ERROR",
              `Python Correlation Analysis 실패: ${errorMessage}`
            );
            throw new Error(`상관분석 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.HandleMissingValues) {
          const inputData = getSingleInputData(
            module.id,
            "data",
            "data_in"
          ) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          // 두 번째 입력 확인
          const inputData2 = getSingleInputData(
            module.id,
            "data",
            "data_in2"
          ) as DataPreview | null;

          const { method, strategy, n_neighbors } = module.parameters;
          const columnSelections = module.parameters.columnSelections || {};

          // columnSelections에서 선택된 열만 추출 (기본값: 모든 열 선택)
          const selectedColumns = inputData.columns
            .filter((col) => {
              const selection = columnSelections[col.name];
              return selection?.selected !== false; // 기본값은 true (선택됨)
            })
            .map((col) => col.name);

          const columns =
            selectedColumns.length > 0 &&
            selectedColumns.length < inputData.columns.length
              ? selectedColumns
              : null; // 모든 열이 선택된 경우 null (전체 처리)

          // Pyodide를 사용하여 Python으로 결측치 처리 수행
          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 결측치 처리 수행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { handleMissingValuesPython } = pyodideModule;

            const result = await handleMissingValuesPython(
              inputData.rows || [],
              method || "impute",
              strategy || "mean",
              columns || null,
              parseInt(n_neighbors) || 5,
              60000, // 타임아웃: 60초
              inputData2 ? inputData2.rows || [] : null,
              inputData.columns // 입력 컬럼 정보 전달 (원본 dtype 유지용)
            );

            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };

            // 두 번째 출력이 있으면 별도로 저장 (모듈의 outputData2 속성에 저장)
            if (result.rows2 && result.columns2) {
              (module as any).outputData2 = {
                type: "DataPreview",
                columns: result.columns2,
                totalRowCount: result.rows2.length,
                rows: result.rows2,
              };
            }

            addLog("SUCCESS", "Python으로 결측치 처리 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python HandleMissingValues 실패: ${errorMessage}`);
            throw new Error(`결측치 처리 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.EncodeCategorical) {
          const inputData = getSingleInputData(
            module.id,
            "data",
            "data_in"
          ) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          // 두 번째 입력 확인
          const inputData2 = getSingleInputData(
            module.id,
            "data",
            "data_in2"
          ) as DataPreview | null;

          const {
            method,
            columns: targetColumns,
            ordinal_mapping: ordinalMappingStr,
            drop,
            handle_unknown,
          } = module.parameters;

          const columnsToEncode =
            targetColumns && targetColumns.length > 0
              ? targetColumns
              : inputData.columns
                  .filter((c) => c.type === "string")
                  .map((c) => c.name);

          // Pyodide를 사용하여 Python으로 인코딩 수행
          try {
            addLog("INFO", "Pyodide를 사용하여 Python으로 인코딩 수행 중...");

            const pyodideModule = await import("./utils/pyodideRunner");
            const { encodeCategoricalPython } = pyodideModule;

            let ordinalMapping: Record<string, string[]> | null = null;
            if (ordinalMappingStr) {
              try {
                ordinalMapping = JSON.parse(ordinalMappingStr);
              } catch (e) {
                ordinalMapping = null;
              }
            }

            const result = await encodeCategoricalPython(
              inputData.rows || [],
              method || "label",
              columnsToEncode.length > 0 ? columnsToEncode : null,
              ordinalMapping,
              drop || "first",
              handle_unknown || "ignore",
              60000, // 타임아웃: 60초
              inputData2 ? inputData2.rows || [] : null
            );

            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };

            // 두 번째 출력이 있으면 별도로 저장
            if (result.rows2 && result.columns2) {
              (module as any).outputData2 = {
                type: "DataPreview",
                columns: result.columns2,
                totalRowCount: result.rows2.length,
                rows: result.rows2,
              };
            }

            addLog("SUCCESS", "Python으로 인코딩 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python EncodeCategorical 실패: ${errorMessage}`);
            throw new Error(`인코딩 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.ScalingTransform) {
          const inputData = getSingleInputData(
            module.id,
            "data",
            "data_in"
          ) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          // 두 번째 입력 확인
          const inputData2 = getSingleInputData(
            module.id,
            "data",
            "data_in2"
          ) as DataPreview | null;

          const selections =
            (module.parameters.columnSelections as Record<
              string,
              { selected: boolean }
            >) || {};
          const method = (module.parameters.method as string) || "MinMax";

          // columnSelections가 없거나 비어있으면 모든 숫자형 열 선택
          const hasSelections =
            selections && Object.keys(selections).length > 0;
          const columnsToNormalize = inputData.columns
            .filter((col) => {
              // pandas dtype이 숫자형인지 확인 (int64, float64 등)
              if (
                !col ||
                !(col.type.startsWith("int") || col.type.startsWith("float"))
              )
                return false;
              // columnSelections가 없거나 비어있으면 모든 숫자형 열 선택
              if (!hasSelections) return true;
              // 해당 열이 selections에 없으면 선택된 것으로 간주 (기본값)
              if (!selections[col.name]) return true;
              return selections[col.name]?.selected !== false;
            })
            .map((col) => col.name);

          // Pyodide를 사용하여 Python으로 정규화 수행
          try {
            addLog("INFO", "Pyodide를 사용하여 Python으로 정규화 수행 중...");

            const pyodideModule = await import("./utils/pyodideRunner");
            const { normalizeDataPython } = pyodideModule;

            const result = await normalizeDataPython(
              inputData.rows || [],
              method || "MinMax",
              columnsToNormalize,
              60000, // 타임아웃: 60초
              inputData2 ? inputData2.rows || [] : null,
              inputData.columns // 입력 컬럼 정보 전달 (원본 dtype 유지용)
            );

            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };

            // 두 번째 출력이 있으면 별도로 저장
            if (result.rows2 && result.columns2) {
              (module as any).outputData2 = {
                type: "DataPreview",
                columns: result.columns2,
                totalRowCount: result.rows2.length,
                rows: result.rows2,
              };
            }

            addLog("SUCCESS", "Python으로 정규화 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python NormalizeData 실패: ${errorMessage}`);
            throw new Error(`정규화 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.PythonScript) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const code =
            (module.parameters.code as string) || "scripted_data = dataframe";

          try {
            addLog("INFO", "Pyodide 샌드박스에서 사용자 Python 스크립트 실행 중...");
            const pyodideModule = await import("./utils/pyodideRunner");
            const { runUserScriptPython } = pyodideModule;
            const result = await runUserScriptPython(
              inputData.rows || [],
              code,
              60000
            );
            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };
            addLog("SUCCESS", "사용자 Python 스크립트 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python Script 실패: ${errorMessage}`);
            throw new Error(`Python Script 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.FeatureEngineer) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const operations = (module.parameters.operations as any[]) || [];

          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 특징 공학 수행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { featureEngineerPython } = pyodideModule;

            const result = await featureEngineerPython(
              inputData.rows || [],
              operations,
              60000
            );

            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };

            addLog("SUCCESS", "Python으로 특징 공학 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python FeatureEngineer 실패: ${errorMessage}`);
            throw new Error(`특징 공학 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.TransitionData) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const transformations =
            (module.parameters.transformations as Record<string, string>) || {};

          // Pyodide를 사용하여 Python으로 수학적 변환 수행
          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 데이터 변환 수행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { transformDataPython } = pyodideModule;

            const result = await transformDataPython(
              inputData.rows || [],
              transformations,
              60000 // 타임아웃: 60초
            );

            newOutputData = {
              type: "DataPreview",
              columns: result.columns,
              totalRowCount: result.rows.length,
              rows: result.rows,
            };

            addLog("SUCCESS", "Python으로 데이터 변환 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python TransitionData 실패: ${errorMessage}`);
            throw new Error(`데이터 변환 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.Join) {
          const inputData1 = getSingleInputData(
            module.id,
            "data",
            "data_in"
          ) as DataPreview | null;
          const inputData2 = getSingleInputData(
            module.id,
            "data",
            "data_in2"
          ) as DataPreview | null;

          if (!inputData1 || !inputData2) {
            throw new Error("Both input data sources must be connected.");
          }

          const { join_type, left_on, right_on, on, how, suffixes } =
            module.parameters;

          // 조인 키 검증
          if (!on && (!left_on || !right_on)) {
            throw new Error(
              "Join key must be specified (on or left_on/right_on)."
            );
          }

          // Pyodide를 사용하여 Python으로 조인 수행
          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 데이터 조인 수행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { joinDataPython } = pyodideModule;

            const result = await joinDataPython(
              inputData1.rows || [],
              inputData2.rows || [],
              join_type || "inner",
              left_on || null,
              right_on || null,
              on || null,
              how || join_type || "inner",
              suffixes || ["_x", "_y"],
              60000 // 타임아웃: 60초
            );

            newOutputData = {
              type: "JoinOutput",
              rows: result.rows,
              columns: result.columns,
            };

            addLog(
              "SUCCESS",
              `Python으로 데이터 조인 완료: ${result.rows.length}행 × ${result.columns.length}열`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python Join 실패: ${errorMessage}`);
            throw new Error(`데이터 조인 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.Concat) {
          const inputData1 = getSingleInputData(
            module.id,
            "data",
            "data_in"
          ) as DataPreview | null;
          const inputData2 = getSingleInputData(
            module.id,
            "data",
            "data_in2"
          ) as DataPreview | null;

          if (!inputData1 || !inputData2) {
            throw new Error("Both input data sources must be connected.");
          }

          const { axis, ignore_index, sort } = module.parameters;
          const rows1 = inputData1.rows?.length || 0;
          const rows2 = inputData2.rows?.length || 0;
          const cols1 = inputData1.columns?.length || 0;
          const cols2 = inputData2.columns?.length || 0;

          // 요구사항 검증
          const isVertical = axis === "vertical";
          if (isVertical && cols1 !== cols2) {
            throw new Error(
              `Column count mismatch: Input 1 has ${cols1} columns, Input 2 has ${cols2} columns. For vertical concatenation, both inputs must have the same number of columns.`
            );
          }
          if (!isVertical && rows1 !== rows2) {
            throw new Error(
              `Row count mismatch: Input 1 has ${rows1} rows, Input 2 has ${rows2} rows. For horizontal concatenation, both inputs must have the same number of rows.`
            );
          }

          // Pyodide를 사용하여 Python으로 연결 수행
          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 데이터 연결 수행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { concatDataPython } = pyodideModule;

            const result = await concatDataPython(
              inputData1.rows || [],
              inputData2.rows || [],
              axis || "vertical",
              ignore_index || false,
              sort || false,
              60000 // 타임아웃: 60초
            );

            newOutputData = {
              type: "ConcatOutput",
              rows: result.rows,
              columns: result.columns,
            };

            addLog(
              "SUCCESS",
              `Python으로 데이터 연결 완료: ${result.rows.length}행 × ${result.columns.length}열`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python Concat 실패: ${errorMessage}`);
            throw new Error(`데이터 연결 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.ResampleData) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const { method, target_column } = module.parameters;
          if (!target_column)
            throw new Error("Target Column parameter is not set.");

          const inputRows = inputData.rows || [];
          if (inputRows.length === 0) {
            newOutputData = { ...inputData }; // Pass through empty data
          } else {
            const groups: Record<string, Record<string, any>[]> = {};
            inputRows.forEach((row) => {
              const key = String(row[target_column]);
              if (!groups[key]) {
                groups[key] = [];
              }
              groups[key].push(row);
            });

            let newRows: Record<string, any>[] = [];

            if (method === "SMOTE") {
              const counts = Object.values(groups).map((g) => g.length);
              const maxCount = Math.max(...counts);

              for (const key in groups) {
                const classRows = groups[key];
                newRows.push(...classRows);
                const diff = maxCount - classRows.length;
                for (let i = 0; i < diff; i++) {
                  // Simple random over-sampling as a simulation of SMOTE
                  newRows.push(
                    classRows[Math.floor(Math.random() * classRows.length)]
                  );
                }
              }
            } else if (method === "NearMiss") {
              const counts = Object.values(groups).map((g) => g.length);
              const minCount = Math.min(...counts);

              for (const key in groups) {
                const classRows = groups[key];
                // Shuffle for random undersampling
                for (let i = classRows.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [classRows[i], classRows[j]] = [classRows[j], classRows[i]];
                }
                newRows.push(...classRows.slice(0, minCount));
              }
            }

            // Final shuffle of the entire dataset
            for (let i = newRows.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [newRows[i], newRows[j]] = [newRows[j], newRows[i]];
            }

            newOutputData = {
              type: "DataPreview",
              columns: inputData.columns,
              totalRowCount: newRows.length,
              rows: newRows,
            };
          }
        } else if (module.type === ModuleType.SplitData) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const {
            train_size,
            random_state,
            shuffle,
            stratify,
            stratify_column,
          } = module.parameters;
          const inputRows = inputData.rows || [];

          // Pyodide를 사용하여 브라우저에서 직접 Python 실행
          // Python의 sklearn.train_test_split과 동일한 결과를 보장합니다.
          // 타임아웃 발생 시 Node.js 백엔드로 전환합니다.

          let useNodeBackend = false;
          let pyodideErrorForNode = "";
          const totalTimeout = 180000; // 전체 타임아웃: 180초 (3분)
          const startTime = Date.now();

          try {
            // Pyodide 동적 import
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 데이터 분할 중... (최대 3분)"
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { splitDataPython } = pyodideModule;

            // 전체 타임아웃을 포함한 Python 실행 시도
            // 값이 없으면 undefined로 전달하여 파이썬 기본값 사용
            const executionPromise = splitDataPython(
              inputRows,
              train_size !== undefined &&
                train_size !== null &&
                train_size !== ""
                ? parseFloat(String(train_size))
                : undefined,
              random_state !== undefined &&
                random_state !== null &&
                random_state !== ""
                ? parseInt(String(random_state))
                : undefined,
              shuffle === undefined || shuffle === null || shuffle === ""
                ? undefined
                : shuffle === "True" || shuffle === true,
              stratify === undefined || stratify === null || stratify === ""
                ? undefined
                : stratify === "True" || stratify === true,
              stratify_column && stratify_column !== "None"
                ? stratify_column
                : null,
              120000 // Python 실행 타임아웃: 120초 (2분)
            );

            // 전체 타임아웃 래퍼
            const timeoutPromise = new Promise<{
              trainIndices: number[];
              testIndices: number[];
            }>((_, reject) => {
              const elapsed = Date.now() - startTime;
              const remaining = totalTimeout - elapsed;
              if (remaining <= 0) {
                reject(new Error("전체 실행 타임아웃 (3분 초과)"));
              } else {
                setTimeout(
                  () => reject(new Error("전체 실행 타임아웃 (3분 초과)")),
                  remaining
                );
              }
            });

            const { trainIndices, testIndices } = await Promise.race([
              executionPromise,
              timeoutPromise,
            ]);

            const elapsedTime = Date.now() - startTime;
            addLog(
              "INFO",
              `Pyodide 실행 완료 (소요 시간: ${(elapsedTime / 1000).toFixed(
                1
              )}초)`
            );

            // Python에서 받은 인덱스를 사용하여 데이터 분할
            const trainRows = trainIndices.map((i: number) => inputRows[i]);
            const testRows = testIndices.map((i: number) => inputRows[i]);

            // Python에서 반환된 실제 인덱스 개수 사용
            const totalTrainCount = trainIndices.length;
            const totalTestCount = testIndices.length;

            const trainData: DataPreview = {
              type: "DataPreview",
              columns: inputData.columns,
              totalRowCount: totalTrainCount,
              rows: trainRows,
            };
            const testData: DataPreview = {
              type: "DataPreview",
              columns: inputData.columns,
              totalRowCount: totalTestCount,
              rows: testRows,
            };

            newOutputData = {
              type: "SplitDataOutput",
              train: trainData,
              test: testData,
            };
            addLog(
              "SUCCESS",
              "Python으로 데이터 분할 완료 (sklearn.train_test_split 사용)"
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            const elapsedTime = Date.now() - startTime;

            // Pyodide 에러 메시지 저장
            pyodideErrorForNode = errorMessage;

            // 타임아웃이거나 Pyodide 실패 시 Node.js 백엔드로 전환
            // "Failed to fetch"는 네트워크 오류이므로 Pyodide 오류로 간주하고 Node.js 백엔드로 전환
            if (
              errorMessage.includes("타임아웃") ||
              errorMessage.includes("timeout") ||
              errorMessage.includes("Timeout") ||
              errorMessage.includes("Failed to fetch") ||
              errorMessage.includes("NetworkError")
            ) {
              addLog(
                "WARN",
                `Pyodide 타임아웃/오류 발생 (${(elapsedTime / 1000).toFixed(
                  1
                )}초 경과), Node.js 백엔드로 전환: ${errorMessage}`
              );
              useNodeBackend = true;
            } else {
              addLog(
                "WARN",
                `Pyodide 실행 실패 (${(elapsedTime / 1000).toFixed(
                  1
                )}초 경과), Node.js 백엔드로 전환: ${errorMessage}`
              );
              useNodeBackend = true;
            }
          }

          // Node.js 백엔드로 전환
          if (useNodeBackend) {
            try {
              addLog(
                "INFO",
                "Node.js 백엔드를 통해 Python으로 데이터 분할 중... (최대 2분)"
              );

              // Node.js 백엔드 API 호출 (타임아웃: 120초)
              const nodeBackendPromise = fetch("/api/split-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  data: inputRows,
                  train_size:
                    train_size !== undefined &&
                    train_size !== null &&
                    train_size !== ""
                      ? parseFloat(String(train_size))
                      : undefined,
                  random_state:
                    random_state !== undefined &&
                    random_state !== null &&
                    random_state !== ""
                      ? parseInt(String(random_state))
                      : undefined,
                  shuffle:
                    shuffle === undefined || shuffle === null || shuffle === ""
                      ? undefined
                      : shuffle === "True" || shuffle === true,
                  stratify:
                    stratify === undefined ||
                    stratify === null ||
                    stratify === ""
                      ? undefined
                      : stratify === "True" || stratify === true,
                  stratify_column:
                    stratify_column && stratify_column !== "None"
                      ? stratify_column
                      : null,
                }),
              });

              const nodeTimeoutPromise = new Promise<Response>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Node.js 백엔드 타임아웃 (2분 초과)")),
                  120000
                )
              );

              const response = await Promise.race([
                nodeBackendPromise,
                nodeTimeoutPromise,
              ]);

              if (response.ok) {
                const { trainIndices, testIndices } = await response.json();

                // Node.js 백엔드에서 받은 인덱스를 사용하여 데이터 분할
                const trainRows = trainIndices.map((i: number) => inputRows[i]);
                const testRows = testIndices.map((i: number) => inputRows[i]);

                // Python에서 반환된 실제 인덱스 개수 사용
                const totalTrainCount = trainIndices.length;
                const totalTestCount = testIndices.length;

                const trainData: DataPreview = {
                  type: "DataPreview",
                  columns: inputData.columns,
                  totalRowCount: totalTrainCount,
                  rows: trainRows,
                };
                const testData: DataPreview = {
                  type: "DataPreview",
                  columns: inputData.columns,
                  totalRowCount: totalTestCount,
                  rows: testRows,
                };

                newOutputData = {
                  type: "SplitDataOutput",
                  train: trainData,
                  test: testData,
                };
                addLog(
                  "SUCCESS",
                  "Node.js 백엔드로 데이터 분할 완료 (sklearn.train_test_split 사용)"
                );
              } else {
                const errorText = await response.text();
                throw new Error(
                  `Node.js 백엔드 응답 오류: ${response.status} - ${errorText}`
                );
              }
            } catch (nodeError: any) {
              // Node.js 백엔드도 실패하면 에러 발생
              const nodeErrorMessage = nodeError.message || String(nodeError);

              // Pyodide 에러 메시지 (이전 catch 블록에서 저장된 에러)
              const pyodideErrorMsg =
                typeof pyodideErrorForNode !== "undefined"
                  ? pyodideErrorForNode
                  : "알 수 없는 Pyodide 오류";

              // Node.js 백엔드 에러 메시지
              let nodeErrorMsg = "";
              if (
                nodeErrorMessage.includes("Failed to fetch") ||
                nodeErrorMessage.includes("NetworkError") ||
                nodeErrorMessage.includes("ERR_CONNECTION_REFUSED")
              ) {
                nodeErrorMsg =
                  'Express 서버(포트 3001)를 찾을 수 없습니다. 터미널에서 "pnpm run server" 또는 "pnpm run dev:full" 명령어로 Express 서버를 실행하세요.';
              } else if (nodeErrorMessage.includes("타임아웃")) {
                nodeErrorMsg = `Express 서버 타임아웃: ${nodeErrorMessage}`;
              } else {
                nodeErrorMsg = `Express 서버 오류: ${nodeErrorMessage}`;
              }

              // js_tuning_options 관련 에러인 경우 더 명확한 메시지 제공
              let enhancedPyodideError = pyodideErrorMsg;
              if (
                pyodideErrorMsg.includes("js_tuning_options") ||
                pyodideErrorMsg.includes("KeyError")
              ) {
                enhancedPyodideError = `내부 오류 (이미 수정됨): ${pyodideErrorMsg}. 페이지를 새로고침하고 다시 시도해주세요.`;
              }

              throw new Error(
                `데이터 분할 실패: Pyodide와 Express 서버 모두 실패했습니다.\n\nPyodide 오류: ${enhancedPyodideError}\n\nExpress 서버 오류: ${nodeErrorMsg}\n\n해결 방법:\n1. 페이지를 새로고침하고 다시 시도\n2. Express 서버 실행: "pnpm run server" 또는 "pnpm run dev:full"\n3. Python이 설치되어 있고 sklearn, pandas가 설치되어 있는지 확인: "pip install scikit-learn pandas"`
              );
            }
          }
        } else if (module.type === ModuleType.Statistics) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData || !inputData.rows) {
            throw new Error(
              "Input data not available or is of the wrong type."
            );
          }

          // Pyodide를 사용하여 Python으로 통계 계산
          try {
            addLog("INFO", "Pyodide를 사용하여 Python으로 통계 계산 중...");

            const pyodideModule = await import("./utils/pyodideRunner");
            const { calculateStatisticsPython } = pyodideModule;

            const result = await calculateStatisticsPython(
              inputData.rows,
              inputData.columns,
              60000 // 타임아웃: 60초
            );

            newOutputData = {
              type: "StatisticsOutput",
              stats: result.stats,
              correlation: result.correlation,
              columns: inputData.columns,
            };
            addLog("SUCCESS", "Python으로 통계 계산 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python 통계 계산 실패: ${errorMessage}`);
            throw new Error(`통계 계산 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.TrainModel) {
          const modelInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "model_in"
          );
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!modelInputConnection || !dataInputConnection) {
            throw new Error(
              "Both 'model_in' and 'data_in' ports must be connected."
            );
          }

          const modelSourceModule = currentModules.find(
            (m) => m.id === modelInputConnection.from.moduleId
          );
          if (!modelSourceModule)
            throw new Error("Model source module not found.");

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview") {
            inputData = dataSourceModule.outputData;
          } else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            if (portName === "train_data_out") {
              inputData = dataSourceModule.outputData.train;
            } else if (portName === "test_data_out") {
              inputData = dataSourceModule.outputData.test;
            }
          }

          if (!inputData)
            throw new Error(
              "Input data not available or is of the wrong type."
            );

          const { feature_columns, label_column } = module.parameters;
          if (
            !feature_columns ||
            feature_columns.length === 0 ||
            !label_column
          ) {
            throw new Error("Feature and label columns are not configured.");
          }

          const ordered_feature_columns = inputData.columns
            .map((c) => c.name)
            .filter((name) => feature_columns.includes(name));

          if (ordered_feature_columns.length === 0) {
            throw new Error("No valid feature columns found in the data.");
          }

          let trainedModelOutput: TrainedModelOutput | undefined = undefined;
          let intercept = 0;
          const coefficients: Record<string, number> = {};
          const metrics: Record<string, number> = {};

          const modelIsClassification = isClassification(
            modelSourceModule.type,
            modelSourceModule.parameters.model_purpose
          );
          const modelIsRegression = !modelIsClassification;

          // Prepare data for training
          const rows = inputData.rows || [];
          if (rows.length === 0) {
            throw new Error("No data rows available for training.");
          }

          // Extract feature matrix X and target vector y
          const X: number[][] = [];
          const y: number[] = [];

          if (!rows || rows.length === 0) {
            throw new Error("Input data has no rows.");
          }

          if (
            !ordered_feature_columns ||
            ordered_feature_columns.length === 0
          ) {
            throw new Error("No feature columns specified.");
          }

          // 분류 모델은 범주형(문자열) 라벨을 정수 코드로 인코딩한다.
          // (이전 버그: 라벨이 숫자가 아니면 모든 행을 버려 'No valid data rows' 발생 —
          //  Adult Income의 income(>50K/<=50K) 같은 문자열 라벨에서 분류 학습 불가했음.)
          const labelClassMap: Record<string, number> = {};
          let nextLabelCode = 0;

          for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];
            if (!row) {
              continue; // Skip null/undefined rows
            }

            const featureRow: number[] = [];
            let hasValidFeatures = true;

            for (
              let colIdx = 0;
              colIdx < ordered_feature_columns.length;
              colIdx++
            ) {
              const col = ordered_feature_columns[colIdx];
              if (!col) {
                hasValidFeatures = false;
                break;
              }
              const value = row[col];
              if (
                typeof value === "number" &&
                !isNaN(value) &&
                value !== null &&
                value !== undefined
              ) {
                featureRow.push(value);
              } else {
                hasValidFeatures = false;
                break;
              }
            }

            if (!hasValidFeatures) {
              continue; // Skip rows with invalid features
            }

            if (featureRow.length !== ordered_feature_columns.length) {
              continue; // Skip rows with incomplete features
            }

            const labelValue = row[label_column];
            if (modelIsClassification) {
              // 분류: 비어있지 않은 라벨이면 클래스 코드로 인코딩(문자열/숫자/불리언 허용).
              if (
                labelValue !== null &&
                labelValue !== undefined &&
                String(labelValue).trim() !== ""
              ) {
                const key = String(labelValue);
                if (!(key in labelClassMap)) labelClassMap[key] = nextLabelCode++;
                X.push(featureRow);
                y.push(labelClassMap[key]);
              }
            } else {
              // 회귀: 숫자 라벨만(숫자 형태의 문자열도 허용).
              const num =
                typeof labelValue === "number" ? labelValue : Number(labelValue);
              if (
                labelValue !== null &&
                labelValue !== undefined &&
                String(labelValue).trim() !== "" &&
                !isNaN(num)
              ) {
                X.push(featureRow);
                y.push(num);
              }
            }
          }

          if (X.length === 0) {
            throw new Error(
              `No valid data rows found after filtering. Checked ${
                rows.length
              } rows. Ensure feature columns (${ordered_feature_columns.join(
                ", "
              )}) and label column (${label_column}) contain valid numeric values.`
            );
          }

          if (X.length < ordered_feature_columns.length) {
            throw new Error(
              `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but only found ${X.length} valid rows.`
            );
          }

          // tuningSummary를 초기화 (모든 모델 타입에서 사용 가능하도록)
          let tuningSummary: TrainedModelOutput["tuningSummary"] = undefined;

          if (modelIsRegression) {
            // Pyodide를 사용하여 Python으로 Linear Regression 훈련
            if (modelSourceModule.type === ModuleType.LinearRegression) {
              const fitIntercept =
                modelSourceModule.parameters.fit_intercept === "True";
              const modelType =
                modelSourceModule.parameters.model_type || "LinearRegression";
              const alpha =
                parseFloat(modelSourceModule.parameters.alpha) || 1.0;
              const l1_ratio =
                parseFloat(modelSourceModule.parameters.l1_ratio) || 0.5;
              const parseCandidates = (
                raw: any,
                fallback: number[]
              ): number[] => {
                if (Array.isArray(raw)) {
                  const parsed = raw
                    .map((val) => {
                      const num =
                        typeof val === "number" ? val : parseFloat(val);
                      return isNaN(num) ? null : num;
                    })
                    .filter((num): num is number => num !== null);
                  return parsed.length ? parsed : fallback;
                }
                if (typeof raw === "string") {
                  const parsed = raw
                    .split(",")
                    .map((part) => parseFloat(part.trim()))
                    .filter((num) => !isNaN(num));
                  return parsed.length ? parsed : fallback;
                }
                if (typeof raw === "number" && !isNaN(raw)) {
                  return [raw];
                }
                return fallback;
              };
              const tuningEnabled =
                modelSourceModule.parameters.tuning_enabled === "True";
              const tuningOptions = tuningEnabled
                ? {
                    enabled: true,
                    strategy: "GridSearch" as const,
                    alphaCandidates: parseCandidates(
                      modelSourceModule.parameters.alpha_candidates,
                      [alpha]
                    ),
                    l1RatioCandidates:
                      modelType === "ElasticNet"
                        ? parseCandidates(
                            modelSourceModule.parameters.l1_ratio_candidates,
                            [l1_ratio]
                          )
                        : undefined,
                    cvFolds: Math.max(
                      2,
                      parseInt(modelSourceModule.parameters.cv_folds, 10) || 5
                    ),
                    scoringMetric:
                      modelSourceModule.parameters.scoring_metric ||
                      "neg_mean_squared_error",
                  }
                : undefined;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 ${modelType} 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitLinearRegressionPython } = pyodideModule;

                const fitResult = await fitLinearRegressionPython(
                  X,
                  y,
                  modelType,
                  fitIntercept,
                  alpha,
                  l1_ratio,
                  ordered_feature_columns, // feature columns 전달
                  60000, // 타임아웃: 60초
                  tuningOptions
                );

                if (
                  !fitResult.coefficients ||
                  fitResult.coefficients.length !==
                    ordered_feature_columns.length
                ) {
                  throw new Error(
                    `Coefficient count mismatch: expected ${
                      ordered_feature_columns.length
                    }, got ${fitResult.coefficients?.length || 0}.`
                  );
                }

                intercept = fitResult.intercept;
                ordered_feature_columns.forEach((col, idx) => {
                  if (fitResult.coefficients[idx] !== undefined) {
                    coefficients[col] = fitResult.coefficients[idx];
                  } else {
                    throw new Error(
                      `Missing coefficient for feature ${col} at index ${idx}.`
                    );
                  }
                });
                tuningSummary = fitResult.tuning
                  ? {
                      enabled: Boolean(fitResult.tuning.enabled),
                      strategy: fitResult.tuning.strategy,
                      bestParams: fitResult.tuning.bestParams,
                      bestScore:
                        typeof fitResult.tuning.bestScore === "number"
                          ? fitResult.tuning.bestScore
                          : undefined,
                      scoringMetric: fitResult.tuning.scoringMetric,
                      candidates: Array.isArray(fitResult.tuning.candidates)
                        ? fitResult.tuning.candidates
                        : undefined,
                    }
                  : undefined;
                if (tuningSummary?.enabled && tuningSummary.bestParams) {
                  addLog(
                    "INFO",
                    `Hyperparameter tuning selected params: ${Object.entries(
                      tuningSummary.bestParams
                    )
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}.`
                  );
                }

                // Python에서 계산된 메트릭 사용
                const r2Value =
                  typeof fitResult.metrics["R-squared"] === "number"
                    ? fitResult.metrics["R-squared"]
                    : parseFloat(fitResult.metrics["R-squared"]);
                const mseValue =
                  typeof fitResult.metrics["Mean Squared Error"] === "number"
                    ? fitResult.metrics["Mean Squared Error"]
                    : parseFloat(fitResult.metrics["Mean Squared Error"]);
                const rmseValue =
                  typeof fitResult.metrics["Root Mean Squared Error"] ===
                  "number"
                    ? fitResult.metrics["Root Mean Squared Error"]
                    : parseFloat(fitResult.metrics["Root Mean Squared Error"]);

                metrics["R-squared"] = parseFloat(r2Value.toFixed(4));
                metrics["Mean Squared Error"] = parseFloat(mseValue.toFixed(4));
                metrics["Root Mean Squared Error"] = parseFloat(
                  rmseValue.toFixed(4)
                );

                addLog("SUCCESS", `Python으로 ${modelType} 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python LinearRegression 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (
              modelSourceModule.type === ModuleType.PoissonModel ||
              modelSourceModule.type === ModuleType.QuasiPoissonModel ||
              modelSourceModule.type === ModuleType.NegativeBinomialModel ||
              modelSourceModule.type === ModuleType.PoissonRegression ||
              modelSourceModule.type === ModuleType.NegativeBinomialRegression
            ) {
              // statsmodels를 사용한 포아송/음이항/Quasi-Poisson 회귀
              let distributionType: string;
              let maxIter: number;
              let disp: number;

              if (modelSourceModule.type === ModuleType.PoissonModel) {
                distributionType = "Poisson";
                maxIter =
                  parseInt(modelSourceModule.parameters.max_iter, 10) || 100;
                disp = 1.0;
              } else if (
                modelSourceModule.type === ModuleType.QuasiPoissonModel
              ) {
                distributionType = "QuasiPoisson";
                maxIter =
                  parseInt(modelSourceModule.parameters.max_iter, 10) || 100;
                disp = 1.0;
              } else if (
                modelSourceModule.type === ModuleType.NegativeBinomialModel
              ) {
                distributionType = "NegativeBinomial";
                maxIter =
                  parseInt(modelSourceModule.parameters.max_iter, 10) || 100;
                disp = parseFloat(modelSourceModule.parameters.disp) || 1.0;
              } else {
                // 기존 모듈 (deprecated)
                distributionType =
                  modelSourceModule.parameters.distribution_type ||
                  (modelSourceModule.type === ModuleType.PoissonRegression
                    ? "Poisson"
                    : "NegativeBinomial");
                maxIter =
                  parseInt(modelSourceModule.parameters.max_iter, 10) || 100;
                disp = parseFloat(modelSourceModule.parameters.disp) || 1.0;
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 ${distributionType} 회귀 모델 훈련 중 (statsmodels)...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitCountRegressionStatsmodels } = pyodideModule;

                const fitResult = await fitCountRegressionStatsmodels(
                  X,
                  y,
                  distributionType,
                  ordered_feature_columns,
                  maxIter,
                  disp,
                  60000 // 타임아웃: 60초
                );

                intercept = fitResult.intercept;
                Object.entries(fitResult.coefficients).forEach(
                  ([col, coef]) => {
                    coefficients[col] = coef;
                  }
                );

                // 통계량 설정
                Object.entries(fitResult.metrics).forEach(([key, value]) => {
                  if (typeof value === "number") {
                    metrics[key] = parseFloat(value.toFixed(4));
                  } else {
                    metrics[key] = value;
                  }
                });

                // TrainedModelOutput에 summary 정보 추가 (StatsModelsResultOutput 형식으로)
                trainedModelOutput = {
                  type: "TrainedModelOutput",
                  modelType: modelSourceModule.type,
                  modelPurpose: "regression",
                  coefficients,
                  intercept,
                  metrics,
                  featureColumns: ordered_feature_columns,
                  labelColumn: label_column,
                  tuningSummary: undefined,
                  // statsmodels 결과를 StatsModelsResultOutput 형식으로 저장
                  statsModelsResult: {
                    type: "StatsModelsResultOutput",
                    summary: fitResult.summary,
                    modelType: distributionType as StatsModelFamily,
                    labelColumn: label_column,
                    featureColumns: ordered_feature_columns,
                  },
                };

                addLog(
                  "SUCCESS",
                  `Python으로 ${distributionType} 회귀 모델 훈련 완료 (statsmodels)`
                );
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python ${distributionType} 회귀 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.DecisionTree) {
              // Pyodide를 사용하여 Python으로 Decision Tree 훈련
              const modelPurpose =
                modelSourceModule.parameters.model_purpose || "classification";
              // modelPurpose에 따라 기본 criterion 설정
              const defaultCriterion =
                modelPurpose === "classification" ? "gini" : "mse";
              const criterion =
                modelSourceModule.parameters.criterion || defaultCriterion;
              const maxDepth =
                modelSourceModule.parameters.max_depth === "" ||
                modelSourceModule.parameters.max_depth === null ||
                modelSourceModule.parameters.max_depth === undefined
                  ? null
                  : parseInt(modelSourceModule.parameters.max_depth, 10);
              const minSamplesSplit =
                parseInt(modelSourceModule.parameters.min_samples_split, 10) ||
                2;
              const minSamplesLeaf =
                parseInt(modelSourceModule.parameters.min_samples_leaf, 10) ||
                1;
              const classWeight =
                modelPurpose === "classification"
                  ? modelSourceModule.parameters.class_weight || null
                  : null;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Decision Tree 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitDecisionTreePython } = pyodideModule;

                const fitResult = await fitDecisionTreePython(
                  X,
                  y,
                  modelPurpose,
                  criterion,
                  maxDepth,
                  minSamplesSplit,
                  minSamplesLeaf,
                  classWeight,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // Decision Tree는 coefficients와 intercept가 없으므로 Feature Importance 사용
                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  // Feature Importance를 coefficients로 사용
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  // Feature Importance가 없는 경우 0으로 설정
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                // Python에서 계산된 메트릭 사용
                metrics["R-squared"] = parseFloat(
                  (fitResult.metrics["R-squared"] || 0).toFixed(4)
                );
                metrics["Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Root Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Mean Absolute Error"] = parseFloat(
                  (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                );

                addLog("SUCCESS", `Python으로 Decision Tree 모델 훈련 완료`);

                // Decision Tree plot_tree 생성을 위한 훈련 데이터와 모델 파라미터 저장
                const trainingDataForPlot = rows.map((row) => {
                  const dataRow: any = {};
                  ordered_feature_columns.forEach((col) => {
                    dataRow[col] = row[col];
                  });
                  dataRow[label_column] = row[label_column];
                  return dataRow;
                });

                // trainedModelOutput에 훈련 데이터와 모델 파라미터 추가
                if (!trainedModelOutput) {
                  trainedModelOutput = {
                    type: "TrainedModelOutput",
                    modelType: modelSourceModule.type,
                    modelPurpose: modelPurpose,
                    coefficients,
                    intercept,
                    metrics,
                    featureColumns: ordered_feature_columns,
                    labelColumn: label_column,
                    tuningSummary: undefined,
                    trainingData: trainingDataForPlot,
                    modelParameters: {
                      criterion,
                      maxDepth,
                      minSamplesSplit,
                      minSamplesLeaf,
                      classWeight,
                    },
                  };
                } else {
                  trainedModelOutput.trainingData = trainingDataForPlot;
                  trainedModelOutput.modelParameters = {
                    criterion,
                    maxDepth,
                    minSamplesSplit,
                    minSamplesLeaf,
                    classWeight,
                  };
                }
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Decision Tree 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.NeuralNetwork) {
              // Pyodide를 사용하여 Python으로 Neural Network 훈련 (회귀)
              const modelPurpose = "regression";
              const hiddenLayerSizes =
                modelSourceModule.parameters.hidden_layer_sizes || "100";
              const activation =
                modelSourceModule.parameters.activation || "relu";
              const maxIter =
                parseInt(modelSourceModule.parameters.max_iter, 10) || 200;
              const randomState =
                parseInt(modelSourceModule.parameters.random_state, 10) || 2022;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Neural Network 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitNeuralNetworkPython } = pyodideModule;

                const fitResult = await fitNeuralNetworkPython(
                  X,
                  y,
                  modelPurpose,
                  hiddenLayerSizes,
                  activation,
                  maxIter,
                  randomState,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // Neural Network는 coefficients와 intercept가 없으므로 Feature Importance 사용
                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  // Feature Importance를 coefficients로 사용
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  // Feature Importance가 없는 경우 0으로 설정
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                // Python에서 계산된 메트릭 사용
                metrics["R-squared"] = parseFloat(
                  (fitResult.metrics["R-squared"] || 0).toFixed(4)
                );
                metrics["MSE"] = parseFloat(
                  (fitResult.metrics["MSE"] || 0).toFixed(4)
                );
                metrics["RMSE"] = parseFloat(
                  (fitResult.metrics["RMSE"] || 0).toFixed(4)
                );
                metrics["MAE"] = parseFloat(
                  (fitResult.metrics["MAE"] || 0).toFixed(4)
                );

                addLog("SUCCESS", `Python으로 Neural Network 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Neural Network 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.SVM) {
              // Pyodide를 사용하여 Python으로 SVM 훈련 (회귀)
              const modelPurpose = "regression";
              const kernel = modelSourceModule.parameters.kernel || "rbf";
              const C = parseFloat(modelSourceModule.parameters.C) || 1.0;
              const gamma =
                modelSourceModule.parameters.gamma === "" ||
                modelSourceModule.parameters.gamma === null ||
                modelSourceModule.parameters.gamma === undefined
                  ? "scale"
                  : modelSourceModule.parameters.gamma;
              const degree =
                parseInt(modelSourceModule.parameters.degree, 10) || 3;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 SVM 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitSVMPython } = pyodideModule;

                const gammaValue =
                  typeof gamma === "string" ? gamma : parseFloat(gamma);

                const fitResult = await fitSVMPython(
                  X,
                  y,
                  modelPurpose,
                  kernel,
                  C,
                  gammaValue,
                  degree,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // SVM은 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용
                metrics["R-squared"] = parseFloat(
                  (fitResult.metrics["R-squared"] || 0).toFixed(4)
                );
                metrics["Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Root Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Mean Absolute Error"] = parseFloat(
                  (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                );

                addLog("SUCCESS", `Python으로 SVM 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog("ERROR", `Python SVM 훈련 실패: ${errorMessage}`);
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.RandomForest) {
              // Pyodide를 사용하여 Python으로 Random Forest 훈련 (회귀, 결정적 random_state=42)
              const modelPurpose = "regression";
              const nEstimators =
                parseInt(modelSourceModule.parameters.n_estimators, 10) || 100;
              const criterion =
                modelSourceModule.parameters.criterion || "mse";
              const maxDepth =
                modelSourceModule.parameters.max_depth === "" ||
                modelSourceModule.parameters.max_depth === null ||
                modelSourceModule.parameters.max_depth === undefined
                  ? null
                  : parseInt(modelSourceModule.parameters.max_depth, 10);
              const maxFeatures =
                modelSourceModule.parameters.max_features === "" ||
                modelSourceModule.parameters.max_features === null ||
                modelSourceModule.parameters.max_features === undefined
                  ? null
                  : modelSourceModule.parameters.max_features;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Random Forest 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitRandomForestPython } = pyodideModule;

                const fitResult = await fitRandomForestPython(
                  X,
                  y,
                  modelPurpose,
                  nEstimators,
                  criterion,
                  maxDepth,
                  maxFeatures,
                  ordered_feature_columns,
                  60000
                );

                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                metrics["R-squared"] = parseFloat(
                  (fitResult.metrics["R-squared"] || 0).toFixed(4)
                );
                metrics["Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Root Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Mean Absolute Error"] = parseFloat(
                  (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                );

                addLog("SUCCESS", `Python으로 Random Forest 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Random Forest 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.GradientBoosting) {
              // Pyodide를 사용하여 Python으로 Gradient Boosting 훈련 (회귀, 결정적 random_state=42)
              const modelPurpose = "regression";
              const nEstimators =
                parseInt(modelSourceModule.parameters.n_estimators, 10) || 100;
              const learningRate =
                parseFloat(modelSourceModule.parameters.learning_rate) || 0.1;
              const maxDepth =
                parseInt(modelSourceModule.parameters.max_depth, 10) || 3;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Gradient Boosting 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitGradientBoostingPython } = pyodideModule;

                const fitResult = await fitGradientBoostingPython(
                  X,
                  y,
                  modelPurpose,
                  nEstimators,
                  learningRate,
                  maxDepth,
                  ordered_feature_columns,
                  60000
                );

                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                metrics["R-squared"] = parseFloat(
                  (fitResult.metrics["R-squared"] || 0).toFixed(4)
                );
                metrics["Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Root Mean Squared Error"] = parseFloat(
                  (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(4)
                );
                metrics["Mean Absolute Error"] = parseFloat(
                  (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                );

                addLog("SUCCESS", `Python으로 Gradient Boosting 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Gradient Boosting 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else {
              // For other regression models, use simulation for now
              intercept = Math.random() * 10;
              ordered_feature_columns.forEach((col) => {
                coefficients[col] = Math.random() * 5 - 2.5;
              });
              metrics["R-squared"] = 0.65 + Math.random() * 0.25;
              metrics["Mean Squared Error"] = 150 - Math.random() * 100;
              metrics["Root Mean Squared Error"] = Math.sqrt(
                metrics["Mean Squared Error"]
              );
            }
          } else if (modelIsClassification) {
            // Pyodide를 사용하여 Python으로 Logistic Regression 훈련
            if (modelSourceModule.type === ModuleType.LogisticRegression) {
              const penalty = modelSourceModule.parameters.penalty || "l2";
              const C = parseFloat(modelSourceModule.parameters.C) || 1.0;
              const solver = modelSourceModule.parameters.solver || "lbfgs";
              const maxIter =
                parseInt(modelSourceModule.parameters.max_iter, 10) || 100;

              const parseCandidates = (
                raw: any,
                fallback: number[]
              ): number[] => {
                if (Array.isArray(raw)) {
                  const parsed = raw
                    .map((val) => {
                      const num =
                        typeof val === "number" ? val : parseFloat(val);
                      return isNaN(num) ? null : num;
                    })
                    .filter((num): num is number => num !== null);
                  return parsed.length ? parsed : fallback;
                }
                if (typeof raw === "string") {
                  const parsed = raw
                    .split(",")
                    .map((part) => parseFloat(part.trim()))
                    .filter((num) => !isNaN(num));
                  return parsed.length ? parsed : fallback;
                }
                if (typeof raw === "number" && !isNaN(raw)) {
                  return [raw];
                }
                return fallback;
              };
              const tuningEnabled =
                modelSourceModule.parameters.tuning_enabled === "True";
              const tuningOptions = tuningEnabled
                ? {
                    enabled: true,
                    strategy: "GridSearch" as const,
                    cCandidates: parseCandidates(
                      modelSourceModule.parameters.c_candidates,
                      [C]
                    ),
                    l1RatioCandidates:
                      penalty === "elasticnet"
                        ? parseCandidates(
                            modelSourceModule.parameters.l1_ratio_candidates,
                            [0.5]
                          )
                        : undefined,
                    cvFolds: Math.max(
                      2,
                      parseInt(modelSourceModule.parameters.cv_folds, 10) || 5
                    ),
                    scoringMetric:
                      modelSourceModule.parameters.scoring_metric || "accuracy",
                  }
                : undefined;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Logistic Regression 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitLogisticRegressionPython } = pyodideModule;

                const fitResult = await fitLogisticRegressionPython(
                  X,
                  y,
                  penalty,
                  C,
                  solver,
                  maxIter,
                  ordered_feature_columns,
                  60000, // 타임아웃: 60초
                  tuningOptions
                );

                // Logistic Regression은 다중 클래스를 지원하므로 coefficients가 2D 배열일 수 있음
                if (
                  !fitResult.coefficients ||
                  !Array.isArray(fitResult.coefficients)
                ) {
                  throw new Error(
                    `Invalid coefficients: expected array, got ${typeof fitResult.coefficients}.`
                  );
                }

                // 이진 분류인 경우
                if (
                  fitResult.coefficients.length === 1 &&
                  fitResult.coefficients[0].length ===
                    ordered_feature_columns.length
                ) {
                  intercept = fitResult.intercept[0];
                  ordered_feature_columns.forEach((col, idx) => {
                    if (fitResult.coefficients[0][idx] !== undefined) {
                      coefficients[col] = fitResult.coefficients[0][idx];
                    } else {
                      throw new Error(
                        `Missing coefficient for feature ${col} at index ${idx}.`
                      );
                    }
                  });
                } else {
                  // 다중 클래스인 경우 첫 번째 클래스의 계수 사용
                  intercept = fitResult.intercept[0] || 0;
                  ordered_feature_columns.forEach((col, idx) => {
                    if (
                      fitResult.coefficients[0] &&
                      fitResult.coefficients[0][idx] !== undefined
                    ) {
                      coefficients[col] = fitResult.coefficients[0][idx];
                    } else {
                      coefficients[col] = 0;
                    }
                  });
                }

                tuningSummary = fitResult.tuning
                  ? {
                      enabled: Boolean(fitResult.tuning.enabled),
                      strategy: fitResult.tuning.strategy,
                      bestParams: fitResult.tuning.bestParams,
                      bestScore:
                        typeof fitResult.tuning.bestScore === "number"
                          ? fitResult.tuning.bestScore
                          : undefined,
                      scoringMetric: fitResult.tuning.scoringMetric,
                      candidates: Array.isArray(fitResult.tuning.candidates)
                        ? fitResult.tuning.candidates
                        : undefined,
                    }
                  : undefined;
                if (tuningSummary?.enabled && tuningSummary.bestParams) {
                  addLog(
                    "INFO",
                    `Hyperparameter tuning selected params: ${Object.entries(
                      tuningSummary.bestParams
                    )
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}.`
                  );
                }

                // Python에서 계산된 메트릭 사용
                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    fitResult.metrics["ROC-AUC"].toFixed(4)
                  );
                }

                addLog(
                  "SUCCESS",
                  `Python으로 Logistic Regression 모델 훈련 완료`
                );
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python LogisticRegression 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.KNN) {
              // Pyodide를 사용하여 Python으로 KNN 훈련
              const modelPurpose =
                modelSourceModule.parameters.model_purpose || "classification";
              const nNeighbors =
                parseInt(modelSourceModule.parameters.n_neighbors, 10) || 3;
              const weights = modelSourceModule.parameters.weights || "uniform";
              const algorithm =
                modelSourceModule.parameters.algorithm || "auto";
              const metric = modelSourceModule.parameters.metric || "minkowski";

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 KNN 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitKNNPython } = pyodideModule;

                const fitResult = await fitKNNPython(
                  X,
                  y,
                  modelPurpose,
                  nNeighbors,
                  weights,
                  algorithm,
                  metric,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // KNN은 coefficients와 intercept가 없으므로 메트릭만 사용
                // coefficients와 intercept는 빈 값으로 설정
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용
                if (modelPurpose === "classification") {
                  metrics["Accuracy"] = parseFloat(
                    (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                  );
                  metrics["Precision"] = parseFloat(
                    (fitResult.metrics["Precision"] || 0).toFixed(4)
                  );
                  metrics["Recall"] = parseFloat(
                    (fitResult.metrics["Recall"] || 0).toFixed(4)
                  );
                  metrics["F1-Score"] = parseFloat(
                    (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                  );
                  if (fitResult.metrics["ROC-AUC"] !== undefined) {
                    metrics["ROC-AUC"] = parseFloat(
                      fitResult.metrics["ROC-AUC"].toFixed(4)
                    );
                  }
                } else {
                  metrics["R-squared"] = parseFloat(
                    (fitResult.metrics["R-squared"] || 0).toFixed(4)
                  );
                  metrics["Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                  );
                  metrics["Root Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(
                      4
                    )
                  );
                  metrics["Mean Absolute Error"] = parseFloat(
                    (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 KNN 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog("ERROR", `Python KNN 훈련 실패: ${errorMessage}`);
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.DecisionTree) {
              // Pyodide를 사용하여 Python으로 Decision Tree 훈련
              const modelPurpose =
                modelSourceModule.parameters.model_purpose || "classification";
              const criterion =
                modelSourceModule.parameters.criterion || "gini";
              const maxDepth =
                modelSourceModule.parameters.max_depth === "" ||
                modelSourceModule.parameters.max_depth === null ||
                modelSourceModule.parameters.max_depth === undefined
                  ? null
                  : parseInt(modelSourceModule.parameters.max_depth, 10);
              const minSamplesSplit =
                parseInt(modelSourceModule.parameters.min_samples_split, 10) ||
                2;
              const minSamplesLeaf =
                parseInt(modelSourceModule.parameters.min_samples_leaf, 10) ||
                1;
              const classWeight =
                modelPurpose === "classification"
                  ? modelSourceModule.parameters.class_weight || null
                  : null;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Decision Tree 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitDecisionTreePython } = pyodideModule;

                const fitResult = await fitDecisionTreePython(
                  X,
                  y,
                  modelPurpose,
                  criterion,
                  maxDepth,
                  minSamplesSplit,
                  minSamplesLeaf,
                  classWeight,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // Decision Tree는 coefficients와 intercept가 없으므로 Feature Importance 사용
                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  // Feature Importance를 coefficients로 사용
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  // Feature Importance가 없는 경우 0으로 설정
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                // Python에서 계산된 메트릭 사용
                if (modelPurpose === "classification") {
                  metrics["Accuracy"] = parseFloat(
                    (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                  );
                  metrics["Precision"] = parseFloat(
                    (fitResult.metrics["Precision"] || 0).toFixed(4)
                  );
                  metrics["Recall"] = parseFloat(
                    (fitResult.metrics["Recall"] || 0).toFixed(4)
                  );
                  metrics["F1-Score"] = parseFloat(
                    (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                  );
                  if (fitResult.metrics["ROC-AUC"] !== undefined) {
                    metrics["ROC-AUC"] = parseFloat(
                      fitResult.metrics["ROC-AUC"].toFixed(4)
                    );
                  }
                } else {
                  metrics["R-squared"] = parseFloat(
                    (fitResult.metrics["R-squared"] || 0).toFixed(4)
                  );
                  metrics["Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                  );
                  metrics["Root Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(
                      4
                    )
                  );
                  metrics["Mean Absolute Error"] = parseFloat(
                    (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 Decision Tree 모델 훈련 완료`);

                // Decision Tree plot_tree 생성을 위한 훈련 데이터와 모델 파라미터 저장
                const trainingDataForPlot = rows.map((row) => {
                  const dataRow: any = {};
                  ordered_feature_columns.forEach((col) => {
                    dataRow[col] = row[col];
                  });
                  dataRow[label_column] = row[label_column];
                  return dataRow;
                });

                // trainedModelOutput에 훈련 데이터와 모델 파라미터 추가
                if (!trainedModelOutput) {
                  trainedModelOutput = {
                    type: "TrainedModelOutput",
                    modelType: modelSourceModule.type,
                    modelPurpose: modelPurpose,
                    coefficients,
                    intercept,
                    metrics,
                    featureColumns: ordered_feature_columns,
                    labelColumn: label_column,
                    tuningSummary: undefined,
                    trainingData: trainingDataForPlot,
                    modelParameters: {
                      criterion,
                      maxDepth,
                      minSamplesSplit,
                      minSamplesLeaf,
                      classWeight,
                    },
                  };
                } else {
                  trainedModelOutput.trainingData = trainingDataForPlot;
                  trainedModelOutput.modelParameters = {
                    criterion,
                    maxDepth,
                    minSamplesSplit,
                    minSamplesLeaf,
                    classWeight,
                  };
                }
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Decision Tree 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.SVM) {
              // Pyodide를 사용하여 Python으로 SVM 훈련
              const modelPurpose =
                modelSourceModule.parameters.model_purpose || "classification";
              const kernel = modelSourceModule.parameters.kernel || "rbf";
              const C = parseFloat(modelSourceModule.parameters.C) || 1.0;
              const gamma =
                modelSourceModule.parameters.gamma === "" ||
                modelSourceModule.parameters.gamma === null ||
                modelSourceModule.parameters.gamma === undefined
                  ? "scale"
                  : modelSourceModule.parameters.gamma;
              const degree =
                parseInt(modelSourceModule.parameters.degree, 10) || 3;
              const probability =
                modelSourceModule.parameters.probability === "True" ||
                modelSourceModule.parameters.probability === true;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 SVM 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitSVMPython } = pyodideModule;

                const gammaValue =
                  typeof gamma === "string" ? gamma : parseFloat(gamma);

                const fitResult = await fitSVMPython(
                  X,
                  y,
                  modelPurpose,
                  kernel,
                  C,
                  gammaValue,
                  degree,
                  probability,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // SVM은 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용
                if (modelPurpose === "classification") {
                  metrics["Accuracy"] = parseFloat(
                    (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                  );
                  metrics["Precision"] = parseFloat(
                    (fitResult.metrics["Precision"] || 0).toFixed(4)
                  );
                  metrics["Recall"] = parseFloat(
                    (fitResult.metrics["Recall"] || 0).toFixed(4)
                  );
                  metrics["F1-Score"] = parseFloat(
                    (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                  );
                  if (fitResult.metrics["ROC-AUC"] !== undefined) {
                    metrics["ROC-AUC"] = parseFloat(
                      fitResult.metrics["ROC-AUC"].toFixed(4)
                    );
                  }
                } else {
                  metrics["R-squared"] = parseFloat(
                    (fitResult.metrics["R-squared"] || 0).toFixed(4)
                  );
                  metrics["Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                  );
                  metrics["Root Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(
                      4
                    )
                  );
                  metrics["Mean Absolute Error"] = parseFloat(
                    (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 SVM 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog("ERROR", `Python SVM 훈련 실패: ${errorMessage}`);
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (
              modelSourceModule.type === ModuleType.LinearDiscriminantAnalysis
            ) {
              // Pyodide를 사용하여 Python으로 LDA 훈련
              const solver = modelSourceModule.parameters.solver || "svd";
              const shrinkage =
                modelSourceModule.parameters.shrinkage === "" ||
                modelSourceModule.parameters.shrinkage === null ||
                modelSourceModule.parameters.shrinkage === undefined
                  ? null
                  : parseFloat(modelSourceModule.parameters.shrinkage);
              const nComponents =
                modelSourceModule.parameters.n_components === "" ||
                modelSourceModule.parameters.n_components === null ||
                modelSourceModule.parameters.n_components === undefined
                  ? null
                  : parseInt(modelSourceModule.parameters.n_components, 10);

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 LDA 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitLDAPython } = pyodideModule;

                const fitResult = await fitLDAPython(
                  X,
                  y,
                  solver,
                  shrinkage,
                  nComponents,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // LDA는 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용 (LDA는 분류만 지원)
                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    fitResult.metrics["ROC-AUC"].toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 LDA 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog("ERROR", `Python LDA 훈련 실패: ${errorMessage}`);
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.NaiveBayes) {
              // Pyodide를 사용하여 Python으로 Naive Bayes 훈련
              const modelType =
                modelSourceModule.parameters.model_type || "GaussianNB";
              // model_type에서 "NB" 제거 (예: "GaussianNB" -> "Gaussian")
              const modelTypeShort = modelType.replace("NB", "");
              const alpha =
                parseFloat(modelSourceModule.parameters.alpha) || 1.0;
              const fitPrior =
                modelSourceModule.parameters.fit_prior === "True" ||
                modelSourceModule.parameters.fit_prior === true;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Naive Bayes 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitNaiveBayesPython } = pyodideModule;

                const fitResult = await fitNaiveBayesPython(
                  X,
                  y,
                  modelTypeShort,
                  alpha,
                  fitPrior,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // Naive Bayes는 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용 (Naive Bayes는 분류만 지원)
                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    fitResult.metrics["ROC-AUC"].toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 Naive Bayes 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Naive Bayes 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.DecisionTree) {
              // Pyodide를 사용하여 Python으로 Decision Tree 훈련
              const modelPurpose =
                modelSourceModule.parameters.model_purpose || "classification";
              const criterion =
                modelSourceModule.parameters.criterion || "gini";
              const maxDepth =
                modelSourceModule.parameters.max_depth === "" ||
                modelSourceModule.parameters.max_depth === null ||
                modelSourceModule.parameters.max_depth === undefined
                  ? null
                  : parseInt(modelSourceModule.parameters.max_depth, 10);
              const minSamplesSplit =
                parseInt(modelSourceModule.parameters.min_samples_split, 10) ||
                2;
              const minSamplesLeaf =
                parseInt(modelSourceModule.parameters.min_samples_leaf, 10) ||
                1;
              const classWeight =
                modelPurpose === "classification"
                  ? modelSourceModule.parameters.class_weight || null
                  : null;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Decision Tree 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitDecisionTreePython } = pyodideModule;

                const fitResult = await fitDecisionTreePython(
                  X,
                  y,
                  modelPurpose,
                  criterion,
                  maxDepth,
                  minSamplesSplit,
                  minSamplesLeaf,
                  classWeight,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // Decision Tree는 coefficients와 intercept가 없으므로 Feature Importance 사용
                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  // Feature Importance를 coefficients로 사용
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  // Feature Importance가 없는 경우 0으로 설정
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                // Python에서 계산된 메트릭 사용
                if (modelPurpose === "classification") {
                  metrics["Accuracy"] = parseFloat(
                    (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                  );
                  metrics["Precision"] = parseFloat(
                    (fitResult.metrics["Precision"] || 0).toFixed(4)
                  );
                  metrics["Recall"] = parseFloat(
                    (fitResult.metrics["Recall"] || 0).toFixed(4)
                  );
                  metrics["F1-Score"] = parseFloat(
                    (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                  );
                  if (fitResult.metrics["ROC-AUC"] !== undefined) {
                    metrics["ROC-AUC"] = parseFloat(
                      fitResult.metrics["ROC-AUC"].toFixed(4)
                    );
                  }
                } else {
                  metrics["R-squared"] = parseFloat(
                    (fitResult.metrics["R-squared"] || 0).toFixed(4)
                  );
                  metrics["Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                  );
                  metrics["Root Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(
                      4
                    )
                  );
                  metrics["Mean Absolute Error"] = parseFloat(
                    (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 Decision Tree 모델 훈련 완료`);

                // Decision Tree plot_tree 생성을 위한 훈련 데이터와 모델 파라미터 저장
                const trainingDataForPlot = rows.map((row) => {
                  const dataRow: any = {};
                  ordered_feature_columns.forEach((col) => {
                    dataRow[col] = row[col];
                  });
                  dataRow[label_column] = row[label_column];
                  return dataRow;
                });

                // trainedModelOutput에 훈련 데이터와 모델 파라미터 추가
                if (!trainedModelOutput) {
                  trainedModelOutput = {
                    type: "TrainedModelOutput",
                    modelType: modelSourceModule.type,
                    modelPurpose: modelPurpose,
                    coefficients,
                    intercept,
                    metrics,
                    featureColumns: ordered_feature_columns,
                    labelColumn: label_column,
                    tuningSummary: undefined,
                    trainingData: trainingDataForPlot,
                    modelParameters: {
                      criterion,
                      maxDepth,
                      minSamplesSplit,
                      minSamplesLeaf,
                      classWeight,
                    },
                  };
                } else {
                  trainedModelOutput.trainingData = trainingDataForPlot;
                  trainedModelOutput.modelParameters = {
                    criterion,
                    maxDepth,
                    minSamplesSplit,
                    minSamplesLeaf,
                    classWeight,
                  };
                }
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Decision Tree 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.SVM) {
              // Pyodide를 사용하여 Python으로 SVM 훈련
              const modelPurpose =
                modelSourceModule.parameters.model_purpose || "classification";
              const kernel = modelSourceModule.parameters.kernel || "rbf";
              const C = parseFloat(modelSourceModule.parameters.C) || 1.0;
              const gamma =
                modelSourceModule.parameters.gamma === "" ||
                modelSourceModule.parameters.gamma === null ||
                modelSourceModule.parameters.gamma === undefined
                  ? "scale"
                  : modelSourceModule.parameters.gamma;
              const degree =
                parseInt(modelSourceModule.parameters.degree, 10) || 3;
              const probability =
                modelSourceModule.parameters.probability === "True" ||
                modelSourceModule.parameters.probability === true;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 SVM 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitSVMPython } = pyodideModule;

                const gammaValue =
                  typeof gamma === "string" ? gamma : parseFloat(gamma);

                const fitResult = await fitSVMPython(
                  X,
                  y,
                  modelPurpose,
                  kernel,
                  C,
                  gammaValue,
                  degree,
                  probability,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // SVM은 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용
                if (modelPurpose === "classification") {
                  metrics["Accuracy"] = parseFloat(
                    (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                  );
                  metrics["Precision"] = parseFloat(
                    (fitResult.metrics["Precision"] || 0).toFixed(4)
                  );
                  metrics["Recall"] = parseFloat(
                    (fitResult.metrics["Recall"] || 0).toFixed(4)
                  );
                  metrics["F1-Score"] = parseFloat(
                    (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                  );
                  if (fitResult.metrics["ROC-AUC"] !== undefined) {
                    metrics["ROC-AUC"] = parseFloat(
                      fitResult.metrics["ROC-AUC"].toFixed(4)
                    );
                  }
                } else {
                  metrics["R-squared"] = parseFloat(
                    (fitResult.metrics["R-squared"] || 0).toFixed(4)
                  );
                  metrics["Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Mean Squared Error"] || 0).toFixed(4)
                  );
                  metrics["Root Mean Squared Error"] = parseFloat(
                    (fitResult.metrics["Root Mean Squared Error"] || 0).toFixed(
                      4
                    )
                  );
                  metrics["Mean Absolute Error"] = parseFloat(
                    (fitResult.metrics["Mean Absolute Error"] || 0).toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 SVM 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog("ERROR", `Python SVM 훈련 실패: ${errorMessage}`);
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (
              modelSourceModule.type === ModuleType.LinearDiscriminantAnalysis
            ) {
              // Pyodide를 사용하여 Python으로 LDA 훈련
              const solver = modelSourceModule.parameters.solver || "svd";
              const shrinkage =
                modelSourceModule.parameters.shrinkage === "" ||
                modelSourceModule.parameters.shrinkage === null ||
                modelSourceModule.parameters.shrinkage === undefined
                  ? null
                  : parseFloat(modelSourceModule.parameters.shrinkage);
              const nComponents =
                modelSourceModule.parameters.n_components === "" ||
                modelSourceModule.parameters.n_components === null ||
                modelSourceModule.parameters.n_components === undefined
                  ? null
                  : parseInt(modelSourceModule.parameters.n_components, 10);

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 LDA 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitLDAPython } = pyodideModule;

                const fitResult = await fitLDAPython(
                  X,
                  y,
                  solver,
                  shrinkage,
                  nComponents,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // LDA는 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용 (LDA는 분류만 지원)
                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    fitResult.metrics["ROC-AUC"].toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 LDA 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog("ERROR", `Python LDA 훈련 실패: ${errorMessage}`);
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.NaiveBayes) {
              // Pyodide를 사용하여 Python으로 Naive Bayes 훈련
              const modelType =
                modelSourceModule.parameters.model_type || "GaussianNB";
              // model_type에서 "NB" 제거 (예: "GaussianNB" -> "Gaussian")
              const modelTypeShort = modelType.replace("NB", "");
              const alpha =
                parseFloat(modelSourceModule.parameters.alpha) || 1.0;
              const fitPrior =
                modelSourceModule.parameters.fit_prior === "True" ||
                modelSourceModule.parameters.fit_prior === true;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Naive Bayes 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitNaiveBayesPython } = pyodideModule;

                const fitResult = await fitNaiveBayesPython(
                  X,
                  y,
                  modelTypeShort,
                  alpha,
                  fitPrior,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // Naive Bayes는 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용 (Naive Bayes는 분류만 지원)
                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    fitResult.metrics["ROC-AUC"].toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 Naive Bayes 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Naive Bayes 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.NeuralNetwork) {
              // Pyodide를 사용하여 Python으로 Neural Network 훈련 (분류)
              const modelPurpose = "classification";
              const hiddenLayerSizes =
                modelSourceModule.parameters.hidden_layer_sizes || "100";
              const activation =
                modelSourceModule.parameters.activation || "relu";
              const maxIter =
                parseInt(modelSourceModule.parameters.max_iter, 10) || 200;
              const randomState =
                parseInt(modelSourceModule.parameters.random_state, 10) || 2022;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Neural Network 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitNeuralNetworkPython } = pyodideModule;

                const fitResult = await fitNeuralNetworkPython(
                  X,
                  y,
                  modelPurpose,
                  hiddenLayerSizes,
                  activation,
                  maxIter,
                  randomState,
                  ordered_feature_columns,
                  60000 // 타임아웃: 60초
                );

                // Neural Network는 coefficients와 intercept가 없으므로 메트릭만 사용
                intercept = 0;
                ordered_feature_columns.forEach((col) => {
                  coefficients[col] = 0;
                });

                // Python에서 계산된 메트릭 사용
                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    fitResult.metrics["ROC-AUC"].toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 Neural Network 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Neural Network 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.RandomForest) {
              // Pyodide를 사용하여 Python으로 Random Forest 훈련 (분류, 결정적 random_state=42)
              const modelPurpose = "classification";
              const nEstimators =
                parseInt(modelSourceModule.parameters.n_estimators, 10) || 100;
              const criterion =
                modelSourceModule.parameters.criterion || "gini";
              const maxDepth =
                modelSourceModule.parameters.max_depth === "" ||
                modelSourceModule.parameters.max_depth === null ||
                modelSourceModule.parameters.max_depth === undefined
                  ? null
                  : parseInt(modelSourceModule.parameters.max_depth, 10);
              const maxFeatures =
                modelSourceModule.parameters.max_features === "" ||
                modelSourceModule.parameters.max_features === null ||
                modelSourceModule.parameters.max_features === undefined
                  ? null
                  : modelSourceModule.parameters.max_features;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Random Forest 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitRandomForestPython } = pyodideModule;

                const fitResult = await fitRandomForestPython(
                  X,
                  y,
                  modelPurpose,
                  nEstimators,
                  criterion,
                  maxDepth,
                  maxFeatures,
                  ordered_feature_columns,
                  60000
                );

                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    (fitResult.metrics["ROC-AUC"] || 0).toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 Random Forest 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Random Forest 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else if (modelSourceModule.type === ModuleType.GradientBoosting) {
              // Pyodide를 사용하여 Python으로 Gradient Boosting 훈련 (분류, 결정적 random_state=42)
              const modelPurpose = "classification";
              const nEstimators =
                parseInt(modelSourceModule.parameters.n_estimators, 10) || 100;
              const learningRate =
                parseFloat(modelSourceModule.parameters.learning_rate) || 0.1;
              const maxDepth =
                parseInt(modelSourceModule.parameters.max_depth, 10) || 3;

              if (X.length < ordered_feature_columns.length) {
                throw new Error(
                  `Insufficient data: need at least ${ordered_feature_columns.length} samples for ${ordered_feature_columns.length} features, but got ${X.length}.`
                );
              }

              try {
                addLog(
                  "INFO",
                  `Pyodide를 사용하여 Python으로 Gradient Boosting 모델 훈련 중...`
                );

                const pyodideModule = await import("./utils/pyodideRunner");
                const { fitGradientBoostingPython } = pyodideModule;

                const fitResult = await fitGradientBoostingPython(
                  X,
                  y,
                  modelPurpose,
                  nEstimators,
                  learningRate,
                  maxDepth,
                  ordered_feature_columns,
                  60000
                );

                intercept = 0;
                if (
                  fitResult.featureImportances &&
                  Object.keys(fitResult.featureImportances).length > 0
                ) {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = fitResult.featureImportances[col] || 0;
                  });
                } else {
                  ordered_feature_columns.forEach((col) => {
                    coefficients[col] = 0;
                  });
                }

                metrics["Accuracy"] = parseFloat(
                  (fitResult.metrics["Accuracy"] || 0).toFixed(4)
                );
                metrics["Precision"] = parseFloat(
                  (fitResult.metrics["Precision"] || 0).toFixed(4)
                );
                metrics["Recall"] = parseFloat(
                  (fitResult.metrics["Recall"] || 0).toFixed(4)
                );
                metrics["F1-Score"] = parseFloat(
                  (fitResult.metrics["F1-Score"] || 0).toFixed(4)
                );
                if (fitResult.metrics["ROC-AUC"] !== undefined) {
                  metrics["ROC-AUC"] = parseFloat(
                    (fitResult.metrics["ROC-AUC"] || 0).toFixed(4)
                  );
                }

                addLog("SUCCESS", `Python으로 Gradient Boosting 모델 훈련 완료`);
              } catch (error: any) {
                const errorMessage = error.message || String(error);
                addLog(
                  "ERROR",
                  `Python Gradient Boosting 훈련 실패: ${errorMessage}`
                );
                throw new Error(`모델 훈련 실패: ${errorMessage}`);
              }
            } else {
              // For other classification models, use simulation for now
              intercept = Math.random() - 0.5;
              ordered_feature_columns.forEach((col) => {
                coefficients[col] = Math.random() * 2 - 1;
              });
              metrics["Accuracy"] = 0.75 + Math.random() * 0.2;
              metrics["Precision"] = 0.7 + Math.random() * 0.25;
              metrics["Recall"] = 0.7 + Math.random() * 0.25;
              metrics["F1-Score"] =
                (2 * (metrics["Precision"] * metrics["Recall"])) /
                (metrics["Precision"] + metrics["Recall"]);
            }
          } else {
            throw new Error(
              `Training simulation for model type '${modelSourceModule.type}' is not implemented, or its 'model_purpose' parameter is not set correctly.`
            );
          }

          // trainedModelOutput이 이미 설정되지 않은 경우에만 기본값으로 생성
          if (!trainedModelOutput) {
            trainedModelOutput = {
              type: "TrainedModelOutput",
              modelType: modelSourceModule.type,
              modelPurpose: modelIsClassification
                ? "classification"
                : "regression",
              coefficients,
              intercept,
              metrics,
              featureColumns: ordered_feature_columns,
              labelColumn: label_column,
              tuningSummary,
            };
          }

          newOutputData = trainedModelOutput;
        } else if (module.type === ModuleType.ScoreModel) {
          const modelInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "model_in"
          );
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!modelInputConnection || !dataInputConnection) {
            throw new Error(
              "Both 'model_in' and 'data_in' ports must be connected."
            );
          }

          const trainedModelSourceModule = currentModules.find(
            (m) => m.id === modelInputConnection.from.moduleId
          );
          if (
            !trainedModelSourceModule ||
            !trainedModelSourceModule.outputData ||
            trainedModelSourceModule.outputData.type !== "TrainedModelOutput"
          ) {
            throw new Error(
              "A successfully trained model must be connected to 'model_in'."
            );
          }

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview") {
            inputData = dataSourceModule.outputData;
          } else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            if (portName === "train_data_out") {
              inputData = dataSourceModule.outputData.train;
            } else if (portName === "test_data_out") {
              inputData = dataSourceModule.outputData.test;
            }
          }

          if (!inputData)
            throw new Error(
              "Input data for scoring not available or is of the wrong type."
            );

          const trainedModel = trainedModelSourceModule.outputData;
          const modelIsClassification = isClassification(
            trainedModel.modelType,
            trainedModel.modelPurpose
          );
          const labelColumn = trainedModel.labelColumn;

          // KNN, Decision Tree, SVM, LDA, NaiveBayes, RandomForest, GradientBoosting 모델의 경우 별도 처리 (coefficients/intercept가 없는 모델 → 훈련 데이터로 재적합 후 예측)
          if (
            trainedModel.modelType === ModuleType.KNN ||
            trainedModel.modelType === ModuleType.DecisionTree ||
            trainedModel.modelType === ModuleType.NeuralNetwork ||
            trainedModel.modelType === ModuleType.SVM ||
            trainedModel.modelType === ModuleType.LinearDiscriminantAnalysis ||
            trainedModel.modelType === ModuleType.NaiveBayes ||
            trainedModel.modelType === ModuleType.RandomForest ||
            trainedModel.modelType === ModuleType.GradientBoosting
          ) {
            // Train Model 모듈에서 훈련 데이터 가져오기
            const trainModelModule = currentModules.find(
              (m) => m.id === trainedModelSourceModule.id
            );

            if (!trainModelModule) {
              throw new Error("Train Model module not found.");
            }

            // Train Model의 입력 데이터 찾기
            const trainDataInputConnection = connections.find(
              (c) =>
                c.to.moduleId === trainModelModule.id &&
                c.to.portName === "data_in"
            );

            if (!trainDataInputConnection) {
              throw new Error(
                `Training data connection not found for ${trainedModel.modelType} model.`
              );
            }

            const trainDataSourceModule = currentModules.find(
              (m) => m.id === trainDataInputConnection.from.moduleId
            );

            if (!trainDataSourceModule || !trainDataSourceModule.outputData) {
              throw new Error("Training data source module not found.");
            }

            let trainingData: DataPreview | null = null;
            if (trainDataSourceModule.outputData.type === "DataPreview") {
              trainingData = trainDataSourceModule.outputData;
            } else if (
              trainDataSourceModule.outputData.type === "SplitDataOutput"
            ) {
              const portName = trainDataInputConnection.from.portName;
              if (portName === "train_data_out") {
                trainingData = trainDataSourceModule.outputData.train;
              } else if (portName === "test_data_out") {
                trainingData = trainDataSourceModule.outputData.test;
              }
            }

            if (!trainingData) {
              throw new Error(
                `Training data not available for ${trainedModel.modelType} model.`
              );
            }

            // 모델 정의 모듈 찾기
            const modelDefConnection = connections.find(
              (c) =>
                c.to.moduleId === trainModelModule.id &&
                c.to.portName === "model_in"
            );

            if (!modelDefConnection) {
              throw new Error(
                `${trainedModel.modelType} model definition connection not found.`
              );
            }

            const modelDefModule = currentModules.find(
              (m) => m.id === modelDefConnection.from.moduleId
            );

            if (!modelDefModule) {
              throw new Error(
                `${trainedModel.modelType} model definition module not found.`
              );
            }

            try {
              const pyodideModule = await import("./utils/pyodideRunner");
              let result: {
                rows: any[];
                columns: Array<{ name: string; type: string }>;
              };

              if (trainedModel.modelType === ModuleType.KNN) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 KNN 모델 예측 수행 중..."
                );

                const modelPurpose =
                  modelDefModule.parameters.model_purpose || "classification";
                const nNeighbors =
                  parseInt(modelDefModule.parameters.n_neighbors, 10) || 3;
                const weights = modelDefModule.parameters.weights || "uniform";
                const algorithm = modelDefModule.parameters.algorithm || "auto";
                const metric = modelDefModule.parameters.metric || "minkowski";

                const { scoreKNNPython } = pyodideModule;
                result = await scoreKNNPython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  modelIsClassification ? "classification" : "regression",
                  nNeighbors,
                  weights,
                  algorithm,
                  metric,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 KNN 모델 예측 완료");
              } else if (trainedModel.modelType === ModuleType.DecisionTree) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 Decision Tree 모델 예측 수행 중..."
                );

                const modelPurpose =
                  modelDefModule.parameters.model_purpose || "classification";
                const criterion = modelDefModule.parameters.criterion || "gini";
                const maxDepth =
                  modelDefModule.parameters.max_depth === "" ||
                  modelDefModule.parameters.max_depth === null ||
                  modelDefModule.parameters.max_depth === undefined
                    ? null
                    : parseInt(modelDefModule.parameters.max_depth, 10);
                const minSamplesSplit =
                  parseInt(modelDefModule.parameters.min_samples_split, 10) ||
                  2;
                const minSamplesLeaf =
                  parseInt(modelDefModule.parameters.min_samples_leaf, 10) || 1;

                const { scoreDecisionTreePython } = pyodideModule;
                result = await scoreDecisionTreePython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  modelIsClassification ? "classification" : "regression",
                  criterion,
                  maxDepth,
                  minSamplesSplit,
                  minSamplesLeaf,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 Decision Tree 모델 예측 완료");
              } else if (trainedModel.modelType === ModuleType.NeuralNetwork) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 Neural Network 모델 예측 수행 중..."
                );

                const modelPurpose =
                  modelDefModule.parameters.model_purpose || "classification";
                const hiddenLayerSizes =
                  modelDefModule.parameters.hidden_layer_sizes || "100";
                const activation =
                  modelDefModule.parameters.activation || "relu";
                const maxIter =
                  parseInt(modelDefModule.parameters.max_iter, 10) || 200;
                const randomState =
                  parseInt(modelDefModule.parameters.random_state, 10) || 2022;

                const { scoreNeuralNetworkPython } = pyodideModule;
                result = await scoreNeuralNetworkPython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  modelIsClassification ? "classification" : "regression",
                  hiddenLayerSizes,
                  activation,
                  maxIter,
                  randomState,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 Neural Network 모델 예측 완료");
              } else if (trainedModel.modelType === ModuleType.SVM) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 SVM 모델 예측 수행 중..."
                );

                const modelPurpose =
                  modelDefModule.parameters.model_purpose || "classification";
                const kernel = modelDefModule.parameters.kernel || "rbf";
                const C = parseFloat(modelDefModule.parameters.C) || 1.0;
                const gamma =
                  modelDefModule.parameters.gamma === "" ||
                  modelDefModule.parameters.gamma === null ||
                  modelDefModule.parameters.gamma === undefined
                    ? "scale"
                    : modelDefModule.parameters.gamma;
                const degree =
                  parseInt(modelDefModule.parameters.degree, 10) || 3;

                const gammaValue =
                  typeof gamma === "string" ? gamma : parseFloat(gamma);

                const { scoreSVMPython } = pyodideModule;
                result = await scoreSVMPython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  modelIsClassification ? "classification" : "regression",
                  kernel,
                  C,
                  gammaValue,
                  degree,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 SVM 모델 예측 완료");
              } else if (
                trainedModel.modelType === ModuleType.LinearDiscriminantAnalysis
              ) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 LDA 모델 예측 수행 중..."
                );

                const solver = modelDefModule.parameters.solver || "svd";
                const shrinkage =
                  modelDefModule.parameters.shrinkage === "" ||
                  modelDefModule.parameters.shrinkage === null ||
                  modelDefModule.parameters.shrinkage === undefined
                    ? null
                    : parseFloat(modelDefModule.parameters.shrinkage);
                const nComponents =
                  modelDefModule.parameters.n_components === "" ||
                  modelDefModule.parameters.n_components === null ||
                  modelDefModule.parameters.n_components === undefined
                    ? null
                    : parseInt(modelDefModule.parameters.n_components, 10);

                const { scoreLDAPython } = pyodideModule;
                result = await scoreLDAPython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  solver,
                  shrinkage,
                  nComponents,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 LDA 모델 예측 완료");
              } else if (trainedModel.modelType === ModuleType.NaiveBayes) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 Naive Bayes 모델 예측 수행 중..."
                );

                const modelType =
                  modelDefModule.parameters.model_type || "Gaussian";
                const alpha =
                  parseFloat(modelDefModule.parameters.alpha) || 1.0;

                const { scoreNaiveBayesPython } = pyodideModule;
                result = await scoreNaiveBayesPython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  modelType,
                  alpha,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 Naive Bayes 모델 예측 완료");
              } else if (
                trainedModel.modelType === ModuleType.RandomForest
              ) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 Random Forest 모델 예측 수행 중..."
                );

                const nEstimators =
                  parseInt(modelDefModule.parameters.n_estimators, 10) || 100;
                const criterion =
                  modelDefModule.parameters.criterion ||
                  (modelIsClassification ? "gini" : "mse");
                const maxDepth =
                  modelDefModule.parameters.max_depth === "" ||
                  modelDefModule.parameters.max_depth === null ||
                  modelDefModule.parameters.max_depth === undefined
                    ? null
                    : parseInt(modelDefModule.parameters.max_depth, 10);
                const maxFeatures =
                  modelDefModule.parameters.max_features === "" ||
                  modelDefModule.parameters.max_features === null ||
                  modelDefModule.parameters.max_features === undefined
                    ? null
                    : modelDefModule.parameters.max_features;

                const { scoreRandomForestPython } = pyodideModule;
                result = await scoreRandomForestPython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  modelIsClassification ? "classification" : "regression",
                  nEstimators,
                  criterion,
                  maxDepth,
                  maxFeatures,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 Random Forest 모델 예측 완료");
              } else if (
                trainedModel.modelType === ModuleType.GradientBoosting
              ) {
                addLog(
                  "INFO",
                  "Pyodide를 사용하여 Python으로 Gradient Boosting 모델 예측 수행 중..."
                );

                const nEstimators =
                  parseInt(modelDefModule.parameters.n_estimators, 10) || 100;
                const learningRate =
                  parseFloat(modelDefModule.parameters.learning_rate) || 0.1;
                const maxDepth =
                  parseInt(modelDefModule.parameters.max_depth, 10) || 3;

                const { scoreGradientBoostingPython } = pyodideModule;
                result = await scoreGradientBoostingPython(
                  inputData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  modelIsClassification ? "classification" : "regression",
                  nEstimators,
                  learningRate,
                  maxDepth,
                  trainingData.rows || [],
                  trainedModel.featureColumns,
                  labelColumn,
                  60000
                );

                addLog("SUCCESS", "Python으로 Gradient Boosting 모델 예측 완료");
              } else {
                throw new Error(
                  `Unsupported model type for ScoreModel: ${trainedModel.modelType}`
                );
              }

              newOutputData = {
                type: "DataPreview",
                columns: result.columns,
                totalRowCount: inputData.totalRowCount,
                rows: result.rows,
              };
            } catch (error: any) {
              const errorMessage = error.message || String(error);
              addLog(
                "ERROR",
                `Python ${trainedModel.modelType} ScoreModel 실패: ${errorMessage}`
              );
              throw new Error(`모델 예측 실패: ${errorMessage}`);
            }
          } else {
            // 기존 방식 (coefficients/intercept 사용)
            // Pyodide를 사용하여 Python으로 예측 수행
            try {
              addLog(
                "INFO",
                "Pyodide를 사용하여 Python으로 모델 예측 수행 중..."
              );

              const pyodideModule = await import("./utils/pyodideRunner");
              const { scoreModelPython } = pyodideModule;

              const result = await scoreModelPython(
                inputData.rows || [],
                trainedModel.featureColumns,
                trainedModel.coefficients,
                trainedModel.intercept,
                labelColumn,
                modelIsClassification ? "classification" : "regression",
                60000 // 타임아웃: 60초
              );

              newOutputData = {
                type: "DataPreview",
                columns: result.columns,
                totalRowCount: inputData.totalRowCount,
                rows: result.rows,
              };

              addLog("SUCCESS", "Python으로 모델 예측 완료");

              // 연결된 Evaluate Model의 파라미터 자동 설정
              const evaluateModelConnections = connections.filter(
                (c) =>
                  c.from.moduleId === module.id &&
                  currentModules.find((m) => m.id === c.to.moduleId)?.type ===
                    ModuleType.EvaluateModel
              );

              for (const evalConn of evaluateModelConnections) {
                const evalModule = currentModules.find(
                  (m) => m.id === evalConn.to.moduleId
                );
                if (evalModule) {
                  const evalParams = evalModule.parameters || {};
                  const updates: Record<string, any> = {};

                  const inputColumns = result.columns.map((c) => c.name);

                  // label_column 자동 설정 (항상 업데이트)
                  if (inputColumns.includes(labelColumn)) {
                    updates.label_column = labelColumn;
                  } else if (inputColumns.length > 0) {
                    updates.label_column = inputColumns[0];
                  }

                  // prediction_column 자동 설정 (항상 업데이트)
                  if (modelIsClassification) {
                    const probaColumn = `${labelColumn}_Predict_Proba_1`;
                    if (inputColumns.includes(probaColumn)) {
                      updates.prediction_column = probaColumn;
                    } else if (inputColumns.includes("Predict")) {
                      updates.prediction_column = "Predict";
                    }
                  } else {
                    if (inputColumns.includes("Predict")) {
                      updates.prediction_column = "Predict";
                    }
                  }

                  // model_type 자동 설정 (항상 업데이트)
                  const detectedModelType = modelIsClassification
                    ? "classification"
                    : "regression";
                  updates.model_type = detectedModelType;

                  // threshold 기본값 설정 (분류 모델인 경우, 값이 없을 때만)
                  // threshold가 이미 설정되어 있으면 절대 변경하지 않음
                  if (
                    modelIsClassification &&
                    (evalParams.threshold === undefined ||
                      evalParams.threshold === null)
                  ) {
                    // threshold가 없을 때만 기본값 설정
                    updates.threshold = 0.5;
                  }
                  // threshold가 이미 설정되어 있으면 updates에 추가하지 않음

                  // 파라미터 업데이트 (threshold는 절대 덮어쓰지 않음)
                  if (Object.keys(updates).length > 0) {
                    setModules(
                      (prev) =>
                        prev.map((m) => {
                          if (m.id === evalModule.id) {
                            // threshold를 제외한 파라미터만 업데이트
                            const finalUpdates = { ...updates };
                            const existingThreshold = m.parameters?.threshold;

                            // threshold가 이미 있으면 절대 덮어쓰지 않음
                            if (
                              existingThreshold !== undefined &&
                              existingThreshold !== null
                            ) {
                              delete finalUpdates.threshold;
                            }

                            // threshold를 제외한 파라미터만 업데이트하고, threshold는 기존 값 유지
                            return {
                              ...m,
                              parameters: {
                                ...m.parameters,
                                ...finalUpdates,
                                // threshold는 기존 값 명시적으로 유지
                                threshold:
                                  existingThreshold !== undefined &&
                                  existingThreshold !== null
                                    ? existingThreshold
                                    : finalUpdates.threshold !== undefined
                                    ? finalUpdates.threshold
                                    : m.parameters?.threshold,
                              },
                            };
                          }
                          return m;
                        }),
                      true
                    );

                    // 파라미터 업데이트만 하고 자동 재실행은 하지 않음
                    // 사용자가 수동으로 실행하거나, Score Model이 완료된 후에 실행되도록 함
                    addLog(
                      "INFO",
                      `Evaluate Model [${evalModule.name}] 파라미터가 자동으로 설정되었습니다. 실행하려면 모듈을 클릭하세요.`
                    );
                  }
                }
              }
            } catch (error: any) {
              const errorMessage = error.message || String(error);
              addLog("ERROR", `Python ScoreModel 실패: ${errorMessage}`);
              throw new Error(`모델 예측 실패: ${errorMessage}`);
            }
          }
        } else if (module.type === ModuleType.FeatureImportance) {
          // 순열 특징중요도는 학습된 모델 객체가 필요하지만, 인앱 실행기는 (지도학습의 경우)
          // 선형 계수만 보관하므로 트리 등 일반 모델을 인앱에서 재예측할 수 없다.
          // 따라서 인앱에서는 안내만 제공하고, 실제 계산은 '전체 코드 보기'로 내보낸
          // 결정적 Python(permutation_importance, random_state=42)에서 수행한다(정직한 한계).
          newOutputData = {
            type: "DataPreview",
            columns: [{ name: "info", type: "string" }],
            totalRowCount: 1,
            rows: [
              {
                info:
                  "순열 특징중요도는 '전체 코드 보기'로 내보낸 Python에서 결정적으로 계산됩니다(random_state=42).",
              },
            ],
          };
          addLog(
            "INFO",
            "FeatureImportance: 인앱은 안내만 제공 — 전체코드 내보내기에서 순열 중요도를 계산합니다(정직한 한계)."
          );
        } else if (module.type === ModuleType.EvaluateModel) {
          const inputData = getSingleInputData(
            module.id,
            "data",
            "data_in"
          ) as DataPreview;
          if (!inputData)
            throw new Error("Input data for evaluation not available.");

          // 최신 모듈 상태에서 파라미터 가져오기 (threshold 변경 반영)
          // getCurrentModules()를 통해 항상 최신 상태를 가져옴
          const latestModules = getCurrentModules();
          const latestModule =
            latestModules.find((m) => m.id === module.id) || module;
          let { label_column, prediction_column, model_type, threshold } =
            latestModule.parameters;

          // threshold가 설정되어 있으면 로그 출력 (디버깅용)
          if (threshold !== undefined && threshold !== null) {
            addLog(
              "INFO",
              `Evaluate Model [${module.name}] 실행 시 threshold: ${threshold} (최신 상태에서 가져옴)`
            );
          } else {
            addLog(
              "INFO",
              `Evaluate Model [${module.name}] threshold가 설정되지 않음`
            );
          }

          // 연결된 Train Model을 찾아서 modelPurpose를 자동으로 감지 및 기본값 설정
          let detectedModelType: "classification" | "regression" =
            model_type === "regression" ? "regression" : "classification";
          let trainModelLabelColumn: string | null = null;

          // Evaluate Model의 입력 연결 찾기 (보통 Score Model)
          const inputConnection = connections.find(
            (c) => c.to.moduleId === module.id
          );
          if (inputConnection) {
            const sourceModule = currentModules.find(
              (m) => m.id === inputConnection.from.moduleId
            );

            // Score Model인 경우, 그 Score Model이 연결된 Train Model 찾기
            if (sourceModule?.type === ModuleType.ScoreModel) {
              const modelInputConnection = connections.find(
                (c) =>
                  c.to.moduleId === sourceModule.id &&
                  c.to.portName === "model_in"
              );
              if (modelInputConnection) {
                const trainModelModule = currentModules.find(
                  (m) =>
                    m.id === modelInputConnection.from.moduleId &&
                    m.outputData?.type === "TrainedModelOutput"
                );
                if (
                  trainModelModule?.outputData?.type === "TrainedModelOutput"
                ) {
                  const trainedModel = trainModelModule.outputData;
                  trainModelLabelColumn = trainedModel.labelColumn;

                  // modelPurpose가 있으면 사용, 없으면 modelType으로 추론
                  if (trainedModel.modelPurpose) {
                    detectedModelType = trainedModel.modelPurpose;
                    addLog(
                      "INFO",
                      `연결된 모델 타입 자동 감지: ${detectedModelType} (${trainModelModule.name})`
                    );
                  } else {
                    // modelType으로 분류 모델인지 확인
                    const isClassModel = isClassification(
                      trainedModel.modelType,
                      trainedModel.modelPurpose
                    );
                    detectedModelType = isClassModel
                      ? "classification"
                      : "regression";
                    addLog(
                      "INFO",
                      `모델 타입 자동 감지: ${detectedModelType} (${trainModelModule.name})`
                    );
                  }
                }
              }
            }
          }

          // 자동 기본값 설정
          const inputColumns = inputData.columns.map((c) => c.name);
          const paramUpdates: Record<string, any> = {};

          // label_column 자동 설정
          if (!label_column) {
            if (
              trainModelLabelColumn &&
              inputColumns.includes(trainModelLabelColumn)
            ) {
              label_column = trainModelLabelColumn;
              paramUpdates.label_column = label_column;
              addLog("INFO", `Label column 자동 설정: ${label_column}`);
            } else if (inputColumns.length > 0) {
              label_column = inputColumns[0];
              paramUpdates.label_column = label_column;
              addLog("INFO", `Label column 자동 설정: ${label_column}`);
            }
          }

          // prediction_column 자동 설정
          if (!prediction_column) {
            if (
              detectedModelType === "classification" &&
              trainModelLabelColumn
            ) {
              // 분류 모델: {label_column}_Predict_Proba_1 찾기
              const probaColumn = `${trainModelLabelColumn}_Predict_Proba_1`;
              if (inputColumns.includes(probaColumn)) {
                prediction_column = probaColumn;
                paramUpdates.prediction_column = prediction_column;
                addLog(
                  "INFO",
                  `Prediction column 자동 설정: ${prediction_column} (확률값)`
                );
              } else if (inputColumns.includes("Predict")) {
                prediction_column = "Predict";
                paramUpdates.prediction_column = prediction_column;
                addLog(
                  "INFO",
                  `Prediction column 자동 설정: ${prediction_column}`
                );
              }
            } else {
              // 회귀 모델: Predict 사용
              if (inputColumns.includes("Predict")) {
                prediction_column = "Predict";
                paramUpdates.prediction_column = prediction_column;
                addLog(
                  "INFO",
                  `Prediction column 자동 설정: ${prediction_column}`
                );
              }
            }
          }

          // model_type 자동 설정
          if (model_type !== detectedModelType) {
            paramUpdates.model_type = detectedModelType;
          }

          // threshold 기본값 설정 (분류 모델인 경우, 값이 없을 때만)
          // threshold가 이미 설정되어 있으면 절대 덮어쓰지 않음
          if (detectedModelType === "classification") {
            if (threshold === undefined || threshold === null) {
              // threshold가 없을 때만 기본값 설정
              threshold = 0.5;
              // paramUpdates에 추가하지 않음 (사용자가 변경한 값이 있을 수 있으므로)
              // 대신 threshold 변수만 업데이트하여 평가에 사용
              addLog(
                "INFO",
                `Evaluate Model [${module.name}] threshold 기본값 사용: ${threshold} (파라미터에는 저장하지 않음)`
              );
            } else {
              // threshold가 이미 설정되어 있으면 그 값을 사용
              addLog(
                "INFO",
                `Evaluate Model [${module.name}] threshold 사용: ${threshold}`
              );
            }
          }

          // 자동으로 설정한 파라미터들을 모듈에 저장
          // threshold는 절대 paramUpdates에 추가하지 않음 (사용자가 변경한 값 유지)
          if (Object.keys(paramUpdates).length > 0) {
            setModules(
              (prev) =>
                prev.map((m) => {
                  if (m.id === module.id) {
                    // threshold를 제외한 파라미터만 업데이트
                    const finalParamUpdates = { ...paramUpdates };
                    // threshold가 paramUpdates에 있으면 제거
                    delete finalParamUpdates.threshold;

                    // 기존 threshold 값 확인 (절대 변경하지 않음)
                    const existingThreshold = m.parameters?.threshold;

                    // threshold는 기존 값을 명시적으로 유지 (절대 변경하지 않음)
                    const updatedParameters = {
                      ...m.parameters,
                      ...finalParamUpdates,
                      // threshold는 기존 값 유지 (변경하지 않음)
                      threshold:
                        existingThreshold !== undefined &&
                        existingThreshold !== null
                          ? existingThreshold
                          : threshold !== undefined && threshold !== null
                          ? threshold
                          : 0.5,
                    };

                    addLog(
                      "INFO",
                      `Evaluate Model [${module.name}] 파라미터 업데이트 후 threshold: ${updatedParameters.threshold} (기존: ${existingThreshold})`
                    );

                    return { ...m, parameters: updatedParameters };
                  }
                  return m;
                }),
              true
            );
          }

          if (!label_column || !prediction_column) {
            throw new Error(
              "Label and prediction columns must be configured for evaluation."
            );
          }

          const rows = inputData.rows || [];
          if (rows.length === 0)
            throw new Error("No rows in input data to evaluate.");

          // Pyodide를 사용하여 Python으로 평가 메트릭 계산
          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 모델 평가 수행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { evaluateModelPython } = pyodideModule;

            // 분류 모델인 경우 여러 threshold에 대한 precision/recall도 계산
            const calculateThresholdMetrics =
              detectedModelType === "classification";

            const result = await evaluateModelPython(
              rows,
              label_column,
              prediction_column,
              detectedModelType, // 자동 감지된 모델 타입 사용
              threshold, // threshold 전달 (분류 모델인 경우)
              120000, // 타임아웃: 120초 (여러 threshold 계산 시 시간이 더 걸림)
              calculateThresholdMetrics // 여러 threshold에 대한 precision/recall 계산
            );

            const { thresholdMetrics, ...metrics } = result;

            addLog("SUCCESS", "Python으로 모델 평가 완료");

            // 혼동행렬 추출
            const confusionMatrix =
              detectedModelType === "classification" &&
              typeof metrics["TP"] === "number" &&
              typeof metrics["FP"] === "number" &&
              typeof metrics["TN"] === "number" &&
              typeof metrics["FN"] === "number"
                ? {
                    tp: metrics["TP"] as number,
                    fp: metrics["FP"] as number,
                    tn: metrics["TN"] as number,
                    fn: metrics["FN"] as number,
                  }
                : undefined;

            newOutputData = {
              type: "EvaluationOutput",
              modelType: detectedModelType, // 자동 감지된 모델 타입 사용
              metrics,
              confusionMatrix,
              threshold:
                detectedModelType === "classification" ? threshold : undefined,
              thresholdMetrics: thresholdMetrics, // 여러 threshold에 대한 precision/recall
            };
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Python EvaluateModel 실패: ${errorMessage}`);
            throw new Error(`모델 평가 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.OLSModel) {
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "statsmodels",
            modelType: "OLS",
            parameters: {},
          };
          addLog(
            "INFO",
            `모델 정의 모듈 '${module.name}' (OLS)이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.LogisticModel) {
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "statsmodels",
            modelType: "Logit",
            parameters: {},
          };
          addLog(
            "INFO",
            `모델 정의 모듈 '${module.name}' (Logistic)이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.PoissonModel) {
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "statsmodels",
            modelType: "Poisson",
            parameters: {
              max_iter: module.parameters.max_iter || 100,
            },
          };
          addLog(
            "INFO",
            `모델 정의 모듈 '${module.name}' (Poisson)이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.QuasiPoissonModel) {
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "statsmodels",
            modelType: "QuasiPoisson",
            parameters: {
              max_iter: module.parameters.max_iter || 100,
            },
          };
          addLog(
            "INFO",
            `모델 정의 모듈 '${module.name}' (Quasi-Poisson)이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.NegativeBinomialModel) {
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "statsmodels",
            modelType: "NegativeBinomial",
            parameters: {
              max_iter: module.parameters.max_iter || 100,
              disp: module.parameters.disp || 1.0,
            },
          };
          addLog(
            "INFO",
            `모델 정의 모듈 '${module.name}' (Negative Binomial)이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.StatModels) {
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "statsmodels",
            modelType: module.parameters.model,
            parameters: {},
          };
          addLog(
            "INFO",
            `모델 정의 모듈 '${module.name}' (${module.parameters.model})이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.ResultModel) {
          const modelInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "model_in"
          );
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );
          if (!modelInputConnection || !dataInputConnection)
            throw new Error(
              "Both 'model_in' and 'data_in' ports must be connected."
            );

          const modelSourceModule = currentModules.find(
            (m) => m.id === modelInputConnection.from.moduleId
          );
          if (!modelSourceModule)
            throw new Error("Model source module not found.");

          // 모델 정의 모듈이 output이 없으면 자동으로 생성
          if (
            MODEL_DEFINITION_TYPES.includes(modelSourceModule.type) &&
            !modelSourceModule.outputData
          ) {
            // 모델 정의 output 자동 생성
            let modelType: string;
            let parameters: Record<string, any> = {};

            if (modelSourceModule.type === ModuleType.OLSModel) {
              modelType = "OLS";
            } else if (modelSourceModule.type === ModuleType.LogisticModel) {
              modelType = "Logit";
            } else if (modelSourceModule.type === ModuleType.PoissonModel) {
              modelType = "Poisson";
              parameters = {
                max_iter: modelSourceModule.parameters.max_iter || 100,
              };
            } else if (
              modelSourceModule.type === ModuleType.QuasiPoissonModel
            ) {
              modelType = "QuasiPoisson";
              parameters = {
                max_iter: modelSourceModule.parameters.max_iter || 100,
              };
            } else if (
              modelSourceModule.type === ModuleType.NegativeBinomialModel
            ) {
              modelType = "NegativeBinomial";
              parameters = {
                max_iter: modelSourceModule.parameters.max_iter || 100,
                disp: modelSourceModule.parameters.disp || 1.0,
              };
            } else if (modelSourceModule.type === ModuleType.StatModels) {
              modelType = modelSourceModule.parameters.model || "Gamma";
            } else {
              throw new Error(
                `Unsupported model definition type: ${modelSourceModule.type}`
              );
            }

            // 모델 정의 모듈의 output 생성
            const modelDefinitionOutput = {
              type: "ModelDefinitionOutput" as const,
              modelFamily: "statsmodels" as const,
              modelType: modelType as any,
              parameters,
            };

            // 현재 모듈 목록 업데이트
            currentModules = currentModules.map((m) =>
              m.id === modelSourceModule.id
                ? {
                    ...m,
                    outputData: modelDefinitionOutput,
                    status: ModuleStatus.Success,
                  }
                : m
            );

            // 상태 업데이트
            setModules((prevModules) =>
              prevModules.map((m) =>
                m.id === modelSourceModule.id
                  ? {
                      ...m,
                      outputData: modelDefinitionOutput,
                      status: ModuleStatus.Success,
                    }
                  : m
              )
            );

            addLog(
              "INFO",
              `모델 정의 모듈 '${modelSourceModule.name}'의 output이 자동 생성되었습니다.`
            );
          }

          // 업데이트된 모듈에서 다시 찾기
          const updatedModelSourceModule = currentModules.find(
            (m) => m.id === modelInputConnection.from.moduleId
          );

          if (
            !updatedModelSourceModule ||
            updatedModelSourceModule.outputData?.type !==
              "ModelDefinitionOutput"
          )
            throw new Error("A Stat Models module must be connected.");

          const modelDefinition = updatedModelSourceModule.outputData;
          if (modelDefinition.modelFamily !== "statsmodels")
            throw new Error("Connected model is not a statsmodels type.");

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview")
            inputData = dataSourceModule.outputData;
          else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            inputData =
              portName === "train_data_out"
                ? dataSourceModule.outputData.train
                : dataSourceModule.outputData.test;
          }
          if (!inputData) throw new Error("Input data not available.");

          const { feature_columns, label_column } = module.parameters;
          if (!feature_columns || feature_columns.length === 0 || !label_column)
            throw new Error("Feature and label columns must be configured.");

          const ordered_feature_columns = inputData.columns
            .map((c) => c.name)
            .filter((name) => feature_columns.includes(name));

          const modelType = modelDefinition.modelType;
          const modelParams = modelDefinition.parameters || {};

          // 모든 모델 타입을 Python으로 실행
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 ${modelType} 모델 피팅 중 (statsmodels)...`
            );

            // 데이터 검증
            if (!inputData.rows || inputData.rows.length === 0) {
              throw new Error("입력 데이터가 비어있습니다.");
            }
            if (ordered_feature_columns.length === 0) {
              throw new Error("특성 컬럼이 선택되지 않았습니다.");
            }

            const X = (inputData.rows || []).map((row) =>
              ordered_feature_columns.map((col) => {
                const val = row[col];
                if (typeof val !== "number" || isNaN(val)) {
                  addLog(
                    "WARNING",
                    `컬럼 '${col}'의 값이 숫자가 아니거나 NaN입니다. 0으로 대체합니다.`
                  );
                  return 0;
                }
                return val;
              })
            );
            const y = (inputData.rows || []).map((row) => {
              const val = row[label_column];
              if (typeof val !== "number" || isNaN(val)) {
                addLog(
                  "WARNING",
                  `레이블 컬럼 '${label_column}'의 값이 숫자가 아니거나 NaN입니다. 0으로 대체합니다.`
                );
                return 0;
              }
              return val;
            });

            // 데이터 크기 검증
            if (X.length === 0 || y.length === 0) {
              throw new Error("데이터가 비어있습니다.");
            }
            if (X.length !== y.length) {
              throw new Error(
                `X와 y의 길이가 일치하지 않습니다: X=${X.length}, y=${y.length}`
              );
            }
            if (X[0].length === 0) {
              throw new Error("특성 데이터가 비어있습니다.");
            }

            addLog(
              "INFO",
              `데이터 준비 완료: ${X.length}개 샘플, ${X[0].length}개 특성`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { runStatsModel } = pyodideModule;

            // 모델 파라미터 추출
            const maxIter = modelParams.max_iter || 100;
            const disp = modelParams.disp || 1.0;

            const fitResult = await runStatsModel(
              X,
              y,
              modelType === "Logit" ? "Logistic" : modelType,
              ordered_feature_columns,
              60000, // 타임아웃: 60초
              maxIter,
              disp
            );

            // 결과 변환
            const summaryCoefficients: StatsModelsResultOutput["summary"]["coefficients"] =
              {};
            Object.entries(fitResult.summary.coefficients).forEach(
              ([paramName, coefData]) => {
                summaryCoefficients[paramName] = {
                  coef: coefData.coef,
                  "std err": coefData["std err"],
                  t: coefData.t,
                  z: coefData.z,
                  "P>|t|": coefData["P>|t|"],
                  "P>|z|": coefData["P>|z|"],
                  "[0.025": coefData["[0.025"],
                  "0.975]": coefData["0.975]"],
                };
              }
            );

            const metrics: StatsModelsResultOutput["summary"]["metrics"] = {};
            Object.entries(fitResult.summary.metrics).forEach(
              ([key, value]) => {
                if (typeof value === "number") {
                  metrics[key] = value.toFixed(6);
                } else {
                  metrics[key] = value;
                }
              }
            );

            newOutputData = {
              type: "StatsModelsResultOutput",
              modelType: modelDefinition.modelType,
              summary: { coefficients: summaryCoefficients, metrics },
              featureColumns: ordered_feature_columns,
              labelColumn: label_column,
            };

            addLog(
              "SUCCESS",
              `Python으로 ${modelType} 모델 피팅 완료 (statsmodels)`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog(
              "ERROR",
              `Python ${modelType} 모델 피팅 실패: ${errorMessage}`
            );
            throw new Error(`모델 피팅 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.PredictModel) {
          const modelInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "model_in"
          );
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!modelInputConnection || !dataInputConnection) {
            throw new Error(
              "Both 'model_in' and 'data_in' ports must be connected."
            );
          }

          const modelSourceModule = currentModules.find(
            (m) => m.id === modelInputConnection.from.moduleId
          );
          if (
            !modelSourceModule ||
            !modelSourceModule.outputData ||
            modelSourceModule.outputData.type !== "StatsModelsResultOutput"
          ) {
            throw new Error(
              "A successful Result Model module must be connected to 'model_in'."
            );
          }
          const modelOutput = modelSourceModule.outputData;

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview") {
            inputData = dataSourceModule.outputData;
          } else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            if (portName === "train_data_out") {
              inputData = dataSourceModule.outputData.train;
            } else if (portName === "test_data_out") {
              inputData = dataSourceModule.outputData.test;
            }
          }

          if (!inputData)
            throw new Error(
              "Input data for prediction not available or is of the wrong type."
            );

          const labelColumn = modelOutput.labelColumn;
          const predictColName = "y_pred_prob";

          // Logistic, Poisson, Quasi-Poisson, Negative Binomial 모델의 경우 y_pred 열 추가
          const needsRoundedColumn = [
            "Logit",
            "Logistic",
            "Poisson",
            "QuasiPoisson",
            "NegativeBinomial",
          ].includes(modelOutput.modelType);
          const roundedColName = "y_pred";

          const newColumns: ColumnInfo[] = [...inputData.columns];
          if (!newColumns.some((c) => c.name === predictColName)) {
            newColumns.push({ name: predictColName, type: "number" });
          }
          if (
            needsRoundedColumn &&
            !newColumns.some((c) => c.name === roundedColName)
          ) {
            newColumns.push({ name: roundedColName, type: "number" });
          }
          const inputRows = inputData.rows || [];

          const newRows = inputRows.map((row) => {
            let linearPredictor =
              modelOutput.summary.coefficients["const"]?.coef ?? 0;

            for (const feature of modelOutput.featureColumns) {
              const featureValue = row[feature] as number;
              const coefficient =
                modelOutput.summary.coefficients[feature]?.coef;
              if (
                typeof featureValue === "number" &&
                typeof coefficient === "number"
              ) {
                linearPredictor += featureValue * coefficient;
              }
            }

            let prediction: number;
            switch (modelOutput.modelType) {
              case "OLS":
                prediction = linearPredictor;
                break;
              case "Logit":
              case "Logistic":
                prediction = sigmoid(linearPredictor);
                break;
              case "Poisson":
              case "QuasiPoisson":
              case "NegativeBinomial":
              case "Gamma":
              case "Tweedie":
                prediction = Math.exp(linearPredictor);
                break;
              default:
                prediction = NaN;
            }

            const resultRow: Record<string, any> = {
              ...row,
              [predictColName]: parseFloat(prediction.toFixed(4)),
            };

            // Logistic, Poisson, Quasi-Poisson, Negative Binomial 모델의 경우 반올림된 정수 추가
            if (needsRoundedColumn) {
              resultRow[roundedColName] = Math.round(prediction);
            }

            return resultRow;
          });

          newOutputData = {
            type: "DataPreview",
            columns: newColumns,
            totalRowCount: inputData.totalRowCount,
            rows: newRows,
          };
        } else if (module.type === ModuleType.DiversionChecker) {
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!dataInputConnection) {
            throw new Error("'data_in' port must be connected.");
          }

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview") {
            inputData = dataSourceModule.outputData;
          } else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            inputData =
              portName === "train_data_out"
                ? dataSourceModule.outputData.train
                : dataSourceModule.outputData.test;
          }
          if (!inputData) throw new Error("Input data not available.");

          const { feature_columns, label_column, max_iter } = module.parameters;
          if (!feature_columns || feature_columns.length === 0 || !label_column)
            throw new Error("Feature and label columns must be configured.");

          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 Diversion Checker 실행 중..."
            );

            const ordered_feature_columns = inputData.columns
              .map((c) => c.name)
              .filter((name) => feature_columns.includes(name));

            const X = (inputData.rows || []).map((row) =>
              ordered_feature_columns.map((col) => {
                const val = row[col];
                return typeof val === "number" ? val : 0;
              })
            );
            const y = (inputData.rows || []).map((row) => {
              const val = row[label_column];
              return typeof val === "number" ? val : 0;
            });

            // 데이터 검증
            if (X.length === 0 || y.length === 0) {
              throw new Error(
                "입력 데이터가 비어있습니다. 데이터 소스를 확인해주세요."
              );
            }
            if (X[0].length !== ordered_feature_columns.length) {
              throw new Error("특성 컬럼 수가 데이터와 일치하지 않습니다.");
            }
            if (X.length !== y.length) {
              throw new Error(
                "특성 데이터와 레이블 데이터의 행 수가 일치하지 않습니다."
              );
            }

            const pyodideModule = await import("./utils/pyodideRunner");
            const { runDiversionChecker } = pyodideModule;

            const result = await runDiversionChecker(
              X,
              y,
              ordered_feature_columns,
              label_column,
              max_iter || 100,
              120000 // 타임아웃: 120초
            );

            // runDiversionChecker는 Python 결과를 그대로 반환하므로 snake_case를 사용
            const pythonResults = result.results as any;
            newOutputData = {
              type: "DiversionCheckerOutput",
              phi: result.phi,
              recommendation: result.recommendation,
              poissonAic: result.poissonAic,
              negativeBinomialAic: result.negativeBinomialAic,
              aicComparison: result.aicComparison,
              cameronTrivediCoef: result.cameronTrivediCoef,
              cameronTrivediPvalue: result.cameronTrivediPvalue,
              cameronTrivediConclusion: result.cameronTrivediConclusion,
              methodsUsed: result.methodsUsed,
              results: {
                phi: pythonResults.phi,
                phi_interpretation:
                  pythonResults.phi_interpretation ||
                  `φ = ${result.phi.toFixed(6)}`,
                recommendation: pythonResults.recommendation,
                poisson_aic: pythonResults.poisson_aic ?? null,
                negative_binomial_aic:
                  pythonResults.negative_binomial_aic ?? null,
                cameron_trivedi_coef: pythonResults.cameron_trivedi_coef,
                cameron_trivedi_pvalue: pythonResults.cameron_trivedi_pvalue,
                cameron_trivedi_conclusion:
                  pythonResults.cameron_trivedi_conclusion,
              },
            } as DiversionCheckerOutput;

            addLog("SUCCESS", "Diversion Checker 실행 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Diversion Checker 실행 실패: ${errorMessage}`);
            throw new Error(`Diversion Checker 실행 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.EvaluateStat) {
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!dataInputConnection) {
            throw new Error("'data_in' port must be connected.");
          }

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview") {
            inputData = dataSourceModule.outputData;
          } else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            inputData =
              portName === "train_data_out"
                ? dataSourceModule.outputData.train
                : dataSourceModule.outputData.test;
          }
          if (!inputData) throw new Error("Input data not available.");

          const { label_column, prediction_column, model_type } =
            module.parameters;
          if (!label_column || !prediction_column) {
            throw new Error(
              "Label column and prediction column must be configured."
            );
          }

          // 예측 컬럼이 데이터에 있는지 확인
          if (!inputData.columns.some((c) => c.name === prediction_column)) {
            throw new Error(
              `Prediction column '${prediction_column}' not found in data.`
            );
          }
          if (!inputData.columns.some((c) => c.name === label_column)) {
            throw new Error(
              `Label column '${label_column}' not found in data.`
            );
          }

          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 Evaluate Stat 실행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { evaluateStatsPython } = pyodideModule;

            const result = await evaluateStatsPython(
              inputData.rows || [],
              label_column,
              prediction_column,
              model_type || "",
              120000 // 타임아웃: 120초
            );

            newOutputData = {
              type: "EvaluateStatOutput",
              modelType: model_type,
              metrics: result.metrics,
              residuals: result.residuals,
              deviance: result.deviance,
              pearsonChi2: result.pearsonChi2,
              dispersion: result.dispersion,
              aic: result.aic,
              bic: result.bic,
              logLikelihood: result.logLikelihood,
            } as EvaluateStatOutput;

            addLog("SUCCESS", "Evaluate Stat 실행 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Evaluate Stat 실행 실패: ${errorMessage}`);
            throw new Error(`Evaluate Stat 실행 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.SimulateFreqSevTable) {
          const inputData = getSingleInputData(module.id) as DataPreview;
          if (!inputData) throw new Error("Input data not available.");

          const { outputFormat } = module.parameters;
          if (!outputFormat) {
            throw new Error("Output Format must be configured.");
          }

          try {
            addLog(
              "INFO",
              `Simulate Freq-Sev Table 실행 중 (Output Format: ${outputFormat})...`
            );

            // Output Format에 따라 다른 출력 생성
            let annualData: DataPreview | null = null;
            let claimData: DataPreview | null = null;

            if (outputFormat === "annual") {
              // 연도별 집계 (DFA 사용) - output_1
              // 연도별을 하나의 사고로 해서 테이블 구성
              annualData = processAnnualAggregation(inputData);
              newOutputData = annualData;
            } else if (outputFormat === "claim") {
              // 사고별 집계 (XoL 사용) - output_2
              claimData = processClaimAggregation(inputData);
              newOutputData = claimData;
            } else {
              throw new Error(`Invalid output format: ${outputFormat}`);
            }

            // 모듈 상태 업데이트 시 outputData1과 outputData2도 함께 저장
            setModules((prev) =>
              prev.map((m) => {
                if (m.id === module.id) {
                  const updated: any = {
                    ...m,
                    outputData: newOutputData,
                  };
                  if (annualData) {
                    updated.outputData1 = annualData;
                  }
                  if (claimData) {
                    updated.outputData2 = claimData;
                  }
                  return updated;
                }
                return m;
              })
            );

            // currentModules도 업데이트
            currentModules = currentModules.map((m) => {
              if (m.id === module.id) {
                const updated: any = {
                  ...m,
                  outputData: newOutputData,
                };
                if (annualData) {
                  updated.outputData1 = annualData;
                }
                if (claimData) {
                  updated.outputData2 = claimData;
                }
                return updated;
              }
              return m;
            });

            addLog("SUCCESS", "Simulate Freq-Sev Table 실행 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Simulate Freq-Sev Table 실행 실패: ${errorMessage}`);
            throw new Error(`Simulate Freq-Sev Table 실행 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.CombineLossModel) {
          // 두 개의 입력 포트 확인
          const freqSevInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "freq_serv_in"
          );
          const lossInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "loss_in"
          );

          if (!freqSevInputConnection) {
            throw new Error(
              "Frequency-Severity simulation input not available. Please connect Simulate Freq-Sev Table module's 'output_1' port to the 'freq_serv_in' port."
            );
          }
          if (!lossInputConnection) {
            throw new Error(
              "Loss model input not available. Please connect a loss model module to the 'loss_in' port."
            );
          }

          const freqSevSourceModule = currentModules.find(
            (m) => m.id === freqSevInputConnection.from.moduleId
          );
          const lossSourceModule = currentModules.find(
            (m) => m.id === lossInputConnection.from.moduleId
          );

          if (!freqSevSourceModule || !lossSourceModule) {
            throw new Error("Source modules not found.");
          }

          // output_1 포트에서 데이터 가져오기
          let freqSevData: DataPreview | null = null;
          if (freqSevInputConnection.from.portName === "output_1") {
            freqSevData = (freqSevSourceModule as any).outputData1;
          } else {
            // 기본 outputData 사용
            if (freqSevSourceModule.outputData?.type === "DataPreview") {
              freqSevData = freqSevSourceModule.outputData;
            }
          }

          let lossData: DataPreview | null = null;
          if (lossSourceModule.outputData?.type === "DataPreview") {
            lossData = lossSourceModule.outputData;
          }

          if (!freqSevData || !lossData) {
            throw new Error("Input data not available from source modules.");
          }

          try {
            addLog("INFO", "Combine Loss Model 실행 중...");

            // 두 데이터를 합산하여 VaR 등 계산
            const combinedData = combineLossModels(freqSevData, lossData);

            newOutputData = {
              type: "DataPreview",
              columns: combinedData.columns,
              totalRowCount: combinedData.rows.length,
              rows: combinedData.rows,
            };

            addLog("SUCCESS", "Combine Loss Model 실행 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Combine Loss Model 실행 실패: ${errorMessage}`);
            throw new Error(`Combine Loss Model 실행 실패: ${errorMessage}`);
          }
        } else if (
          module.type === ModuleType.LeeCarterModel ||
          module.type === ModuleType.CBDModel ||
          module.type === ModuleType.APCModel ||
          module.type === ModuleType.RHModel ||
          module.type === ModuleType.PlatModel ||
          module.type === ModuleType.PSplineModel
        ) {
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!dataInputConnection) {
            throw new Error("'data_in' port must be connected.");
          }

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview")
            inputData = dataSourceModule.outputData;
          else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            inputData =
              portName === "train_data_out"
                ? dataSourceModule.outputData.train
                : dataSourceModule.outputData.test;
          }
          if (!inputData) throw new Error("Input data not available.");

          const { ageColumn, yearColumn, deathsColumn, exposureColumn } =
            module.parameters;
          if (!ageColumn || !yearColumn || !deathsColumn || !exposureColumn)
            throw new Error(
              "Age, Year, Deaths, and Exposure columns must be configured."
            );

          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 ${module.type} 모델 피팅 중...`
            );

            if (!inputData.rows || inputData.rows.length === 0) {
              throw new Error("입력 데이터가 비어있습니다.");
            }

            const pyodideModule = await import("./utils/pyodideRunner");
            let fitResult: any;

            if (module.type === ModuleType.LeeCarterModel) {
              const { fitLeeCarterModelPython } = pyodideModule;
              fitResult = await fitLeeCarterModelPython(
                inputData.rows,
                ageColumn,
                yearColumn,
                deathsColumn,
                exposureColumn,
                120000
              );
              newOutputData = {
                type: "MortalityModelOutput",
                modelType: "LeeCarter",
                a_x: fitResult.a_x,
                b_x: fitResult.b_x,
                k_t: fitResult.k_t,
                mortality_matrix: fitResult.mortality_matrix,
                predicted_mortality: fitResult.predicted_mortality,
                mse: fitResult.mse,
                mae: fitResult.mae,
                ages: fitResult.ages,
                years: fitResult.years,
              };
            } else if (module.type === ModuleType.CBDModel) {
              const { fitCBDModelPython } = pyodideModule;
              fitResult = await fitCBDModelPython(
                inputData.rows,
                ageColumn,
                yearColumn,
                deathsColumn,
                exposureColumn,
                120000
              );
              newOutputData = {
                type: "MortalityModelOutput",
                modelType: "CBD",
                beta: fitResult.beta,
                kappa_1: fitResult.kappa_1,
                kappa_2: fitResult.kappa_2,
                mortality_matrix: fitResult.mortality_matrix,
                predicted_mortality: fitResult.predicted_mortality,
                mse: fitResult.mse,
                mae: fitResult.mae,
                ages: fitResult.ages,
                years: fitResult.years,
              };
            } else if (module.type === ModuleType.APCModel) {
              const { fitAPCModelPython } = pyodideModule;
              fitResult = await fitAPCModelPython(
                inputData.rows,
                ageColumn,
                yearColumn,
                deathsColumn,
                exposureColumn,
                120000
              );
              newOutputData = {
                type: "MortalityModelOutput",
                modelType: "APC",
                a_x: fitResult.a_x,
                k_t: fitResult.k_t,
                gamma_c: fitResult.gamma_c,
                mortality_matrix: fitResult.mortality_matrix,
                predicted_mortality: fitResult.predicted_mortality,
                mse: fitResult.mse,
                mae: fitResult.mae,
                ages: fitResult.ages,
                years: fitResult.years,
              };
            } else if (module.type === ModuleType.RHModel) {
              const { fitRHModelPython } = pyodideModule;
              fitResult = await fitRHModelPython(
                inputData.rows,
                ageColumn,
                yearColumn,
                deathsColumn,
                exposureColumn,
                120000
              );
              newOutputData = {
                type: "MortalityModelOutput",
                modelType: "RH",
                a_x: fitResult.a_x,
                b_x_1: fitResult.b_x_1,
                b_x_2: fitResult.b_x_2,
                k_t_1: fitResult.k_t_1,
                k_t_2: fitResult.k_t_2,
                gamma_c: fitResult.gamma_c,
                mortality_matrix: fitResult.mortality_matrix,
                predicted_mortality: fitResult.predicted_mortality,
                mse: fitResult.mse,
                mae: fitResult.mae,
                ages: fitResult.ages,
                years: fitResult.years,
              };
            } else if (module.type === ModuleType.PlatModel) {
              const { fitPlatModelPython } = pyodideModule;
              fitResult = await fitPlatModelPython(
                inputData.rows,
                ageColumn,
                yearColumn,
                deathsColumn,
                exposureColumn,
                120000
              );
              newOutputData = {
                type: "MortalityModelOutput",
                modelType: "Plat",
                a_x: fitResult.a_x,
                b_x: fitResult.b_x,
                k_t: fitResult.k_t,
                kappa_1: fitResult.kappa_1,
                kappa_2: fitResult.kappa_2,
                mortality_matrix: fitResult.mortality_matrix,
                predicted_mortality: fitResult.predicted_mortality,
                mse: fitResult.mse,
                mae: fitResult.mae,
                ages: fitResult.ages,
                years: fitResult.years,
              };
            } else if (module.type === ModuleType.PSplineModel) {
              const { fitPSplineModelPython } = pyodideModule;
              const nKnots = module.parameters.n_knots || 10;
              fitResult = await fitPSplineModelPython(
                inputData.rows,
                ageColumn,
                yearColumn,
                deathsColumn,
                exposureColumn,
                nKnots,
                120000
              );
              newOutputData = {
                type: "MortalityModelOutput",
                modelType: "PSpline",
                mortality_matrix: fitResult.mortality_matrix,
                predicted_mortality: fitResult.predicted_mortality,
                mse: fitResult.mse,
                mae: fitResult.mae,
                ages: fitResult.ages,
                years: fitResult.years,
              };
            }

            addLog("SUCCESS", `Python으로 ${module.type} 모델 피팅 완료`);
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `${module.type} 모델 피팅 실패: ${errorMessage}`);
            throw new Error(`모델 피팅 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.MortalityResult) {
          // MortalityResult는 여러 모델 결과를 입력으로 받아 비교
          const connectedModelConnections = connections.filter(
            (c) =>
              c &&
              c.to &&
              c.to.moduleId === module.id &&
              c.from &&
              c.from.moduleId
          );

          if (connectedModelConnections.length === 0) {
            throw new Error(
              "최소 하나 이상의 사망률 모델 결과가 연결되어야 합니다."
            );
          }

          const modelResults: Array<{ modelType: string; result: any }> = [];

          for (const conn of connectedModelConnections) {
            if (!conn || !conn.from || !conn.from.moduleId) continue;

            const sourceModule = currentModules.find(
              (m) => m && m.id === conn.from.moduleId
            );
            if (
              sourceModule &&
              sourceModule.outputData &&
              sourceModule.outputData.type === "MortalityModelOutput"
            ) {
              modelResults.push({
                modelType: sourceModule.outputData.modelType,
                result: sourceModule.outputData,
              });
            }
          }

          if (modelResults.length === 0) {
            throw new Error("연결된 모듈 중 사망률 모델 결과가 없습니다.");
          }

          try {
            addLog(
              "INFO",
              "Pyodide를 사용하여 Python으로 Mortality Result 실행 중..."
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const { compareMortalityModelsPython } = pyodideModule;

            const comparisonResult = await compareMortalityModelsPython(
              modelResults,
              180000
            );

            newOutputData = {
              type: "MortalityResultOutput",
              models: comparisonResult.models,
              comparison: comparisonResult.comparison,
              visualizations: comparisonResult.visualizations,
            };

            addLog("SUCCESS", "Mortality Result 실행 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `Mortality Result 실행 실패: ${errorMessage}`);
            throw new Error(`Mortality Result 실행 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.KMeans) {
          // K-Means 모델 정의만 생성 (LinearRegression처럼)
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "sklearn",
            modelType: "KMeans" as any,
            parameters: {
              n_clusters: module.parameters.n_clusters || 3,
              init: module.parameters.init || "k-means++",
              n_init: module.parameters.n_init || 10,
              max_iter: module.parameters.max_iter || 300,
              random_state: module.parameters.random_state || 42,
            },
          } as ModelDefinitionOutput;
          addLog(
            "INFO",
            `K-Means 모델 정의 모듈 '${module.name}'이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.PrincipalComponentAnalysis) {
          // PCA 모델 정의만 생성
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "sklearn",
            modelType: "PCA" as any,
            parameters: {
              n_components: module.parameters.n_components || 2,
            },
          } as ModelDefinitionOutput;
          addLog(
            "INFO",
            `PCA 모델 정의 모듈 '${module.name}'이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.DBSCAN) {
          // DBSCAN 모델 정의만 생성
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "sklearn",
            modelType: "DBSCAN" as any,
            parameters: {
              eps: module.parameters.eps ?? 0.5,
              min_samples: module.parameters.min_samples ?? 5,
            },
          } as ModelDefinitionOutput;
          addLog(
            "INFO",
            `DBSCAN 모델 정의 모듈 '${module.name}'이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.HierarchicalClustering) {
          // 계층적(Agglomerative) 모델 정의만 생성
          newOutputData = {
            type: "ModelDefinitionOutput",
            modelFamily: "sklearn",
            modelType: "HierarchicalClustering" as any,
            parameters: {
              n_clusters: module.parameters.n_clusters ?? 3,
              linkage: module.parameters.linkage || "ward",
              metric: module.parameters.metric || "euclidean",
            },
          } as ModelDefinitionOutput;
          addLog(
            "INFO",
            `계층적 클러스터링 모델 정의 모듈 '${module.name}'이 생성되었습니다.`
          );
        } else if (module.type === ModuleType.TrainClusteringModel) {
          // TrainClusteringModel: 모델 + 데이터로 학습
          const modelInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "model_in"
          );
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!modelInputConnection || !dataInputConnection) {
            throw new Error(
              "Both 'model_in' and 'data_in' ports must be connected."
            );
          }

          const modelSourceModule = currentModules.find(
            (m) => m.id === modelInputConnection.from.moduleId
          );
          if (!modelSourceModule)
            throw new Error("Model source module not found.");

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview") {
            inputData = dataSourceModule.outputData;
          } else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            if (portName === "train_data_out") {
              inputData = dataSourceModule.outputData.train;
            } else if (portName === "test_data_out") {
              inputData = dataSourceModule.outputData.test;
            }
          }

          if (!inputData)
            throw new Error(
              "Input data not available or is of the wrong type."
            );

          // 모듈을 미리 선택(PropertiesPanel 초기화)하지 않아도 바로 실행되도록,
          // feature_columns가 비어 있으면 즉시 수치형 컬럼으로 기본값을 채운다.
          // (이전 버그: module.parameters만 갱신하고 아래 필터에서 쓰는 지역 변수는
          //  빈 배열 그대로라 'No valid feature columns' 오류가 났음.)
          let { feature_columns = [] } = module.parameters;
          if (!feature_columns || feature_columns.length === 0) {
            // 기본값: 모든 숫자형 컬럼 사용
            const numericColumns = inputData.columns
              .filter(
                (c) => c.type.startsWith("int") || c.type.startsWith("float")
              )
              .map((c) => c.name);
            if (numericColumns.length === 0) {
              throw new Error("No numeric columns found in the data.");
            }
            feature_columns = numericColumns;
            module.parameters.feature_columns = numericColumns;
          }

          const ordered_feature_columns = inputData.columns
            .map((c) => c.name)
            .filter((name) => feature_columns.includes(name));

          if (ordered_feature_columns.length === 0) {
            throw new Error("No valid feature columns found in the data.");
          }

          // 모델 타입 확인
          if (
            modelSourceModule.type !== ModuleType.KMeans &&
            modelSourceModule.type !== ModuleType.PrincipalComponentAnalysis &&
            modelSourceModule.type !== ModuleType.DBSCAN &&
            modelSourceModule.type !== ModuleType.HierarchicalClustering
          ) {
            throw new Error(
              "TrainClusteringModel supports K-Means, PCA, DBSCAN, and Hierarchical models."
            );
          }

          // Python으로 클러스터링 모델 학습
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 클러스터링 모델 학습 중...`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const rows = inputData.rows || [];
            if (rows.length === 0) {
              throw new Error("No data rows available for training.");
            }

            // Extract feature matrix X
            const X: number[][] = [];
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
              const row = rows[rowIndex];
              const featureRow: number[] = [];
              for (const col of ordered_feature_columns) {
                let value = row[col];

                // 값이 null이나 undefined인 경우 처리
                if (value === null || value === undefined) {
                  throw new Error(
                    `Invalid value in column '${col}' at row ${
                      rowIndex + 1
                    }: null or undefined value found. Please handle missing values first.`
                  );
                }

                // 값이 객체인 경우 처리 (예: {value: 25} 같은 형태)
                if (typeof value === "object" && value !== null) {
                  // 객체에 value 속성이 있으면 사용
                  if ("value" in value && typeof value.value === "number") {
                    value = value.value;
                  } else if (
                    "Value" in value &&
                    typeof value.Value === "number"
                  ) {
                    value = value.Value;
                  } else {
                    // 객체를 JSON 문자열로 변환 후 숫자로 파싱 시도
                    const stringValue = JSON.stringify(value);
                    const parsed = parseFloat(stringValue);
                    if (isNaN(parsed)) {
                      throw new Error(
                        `Invalid value in column '${col}' at row ${
                          rowIndex + 1
                        }: expected number, got object ${JSON.stringify(value)}`
                      );
                    }
                    value = parsed;
                  }
                }

                // 값이 문자열인 경우 숫자로 변환 시도
                if (typeof value === "string") {
                  const trimmed = value.trim();
                  if (
                    trimmed === "" ||
                    trimmed.toLowerCase() === "null" ||
                    trimmed.toLowerCase() === "nan"
                  ) {
                    throw new Error(
                      `Invalid value in column '${col}' at row ${
                        rowIndex + 1
                      }: empty string or null value found. Please handle missing values first.`
                    );
                  }
                  const parsed = parseFloat(trimmed);
                  if (isNaN(parsed)) {
                    throw new Error(
                      `Invalid value in column '${col}' at row ${
                        rowIndex + 1
                      }: cannot convert string "${trimmed}" to number`
                    );
                  }
                  value = parsed;
                }

                // 최종 검증: 숫자인지 확인
                if (typeof value !== "number" || isNaN(value)) {
                  throw new Error(
                    `Invalid value in column '${col}' at row ${
                      rowIndex + 1
                    }: expected number, got ${typeof value} (value: ${JSON.stringify(
                      value
                    )})`
                  );
                }

                featureRow.push(value);
              }
              X.push(featureRow);
            }

            if (modelSourceModule.type === ModuleType.KMeans) {
              const { fitKMeansPython } = pyodideModule;
              const modelParams =
                modelSourceModule.outputData?.type === "ModelDefinitionOutput"
                  ? modelSourceModule.outputData.parameters
                  : modelSourceModule.parameters;

              const fitResult = await fitKMeansPython(
                X,
                modelParams.n_clusters || 3,
                modelParams.init || "k-means++",
                modelParams.n_init || 10,
                modelParams.max_iter || 300,
                modelParams.random_state || 42,
                ordered_feature_columns,
                60000
              );

              newOutputData = {
                type: "TrainedClusteringModelOutput",
                modelType: ModuleType.KMeans,
                featureColumns: ordered_feature_columns,
                model: fitResult.model,
                centroids: fitResult.centroids,
                inertia: fitResult.inertia,
              } as TrainedClusteringModelOutput;
            } else if (
              modelSourceModule.type === ModuleType.PrincipalComponentAnalysis
            ) {
              const { fitPCAPython } = pyodideModule;
              const modelParams =
                modelSourceModule.outputData?.type === "ModelDefinitionOutput"
                  ? modelSourceModule.outputData.parameters
                  : modelSourceModule.parameters;

              const fitResult = await fitPCAPython(
                X,
                modelParams.n_components || 2,
                ordered_feature_columns,
                60000
              );

              newOutputData = {
                type: "TrainedClusteringModelOutput",
                modelType: ModuleType.PrincipalComponentAnalysis,
                featureColumns: ordered_feature_columns,
                model: fitResult.model,
                components: fitResult.components,
                explainedVarianceRatio: fitResult.explainedVarianceRatio,
                mean: fitResult.mean,
              } as TrainedClusteringModelOutput;
            } else if (
              modelSourceModule.type === ModuleType.DBSCAN ||
              modelSourceModule.type === ModuleType.HierarchicalClustering
            ) {
              // Transductive(.predict 없음): fit_predict로 라벨을 계산해 저장한다.
              const { fitTransductiveClusteringPython } = pyodideModule;
              const modelParams =
                modelSourceModule.outputData?.type === "ModelDefinitionOutput"
                  ? modelSourceModule.outputData.parameters
                  : modelSourceModule.parameters;
              const algorithm =
                modelSourceModule.type === ModuleType.DBSCAN
                  ? "dbscan"
                  : "agglomerative";

              const fitResult = await fitTransductiveClusteringPython(
                X,
                algorithm,
                modelParams,
                ordered_feature_columns,
                60000
              );

              newOutputData = {
                type: "TrainedClusteringModelOutput",
                modelType: modelSourceModule.type,
                featureColumns: ordered_feature_columns,
                model: fitResult.model,
                labels: fitResult.labels,
                nClusters: fitResult.nClusters,
                nNoise: fitResult.nNoise,
              } as TrainedClusteringModelOutput;
            }

            addLog("SUCCESS", "클러스터링 모델 학습 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `클러스터링 모델 학습 실패: ${errorMessage}`);
            throw new Error(`클러스터링 모델 학습 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.ClusteringData) {
          // ClusteringData: 학습된 모델로 새 데이터에 클러스터 할당 또는 PCA 변환
          const modelInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "model_in"
          );
          const dataInputConnection = connections.find(
            (c) => c.to.moduleId === module.id && c.to.portName === "data_in"
          );

          if (!modelInputConnection || !dataInputConnection) {
            throw new Error(
              "Both 'model_in' and 'data_in' ports must be connected."
            );
          }

          const trainedModelSourceModule = currentModules.find(
            (m) => m.id === modelInputConnection.from.moduleId
          );
          if (
            !trainedModelSourceModule ||
            !trainedModelSourceModule.outputData ||
            trainedModelSourceModule.outputData.type !==
              "TrainedClusteringModelOutput"
          ) {
            throw new Error(
              "A successfully trained clustering model must be connected to 'model_in'."
            );
          }

          const dataSourceModule = currentModules.find(
            (m) => m.id === dataInputConnection.from.moduleId
          );
          if (!dataSourceModule || !dataSourceModule.outputData)
            throw new Error("Data source module has no output.");

          let inputData: DataPreview | null = null;
          if (dataSourceModule.outputData.type === "DataPreview") {
            inputData = dataSourceModule.outputData;
          } else if (dataSourceModule.outputData.type === "SplitDataOutput") {
            const portName = dataInputConnection.from.portName;
            if (portName === "train_data_out") {
              inputData = dataSourceModule.outputData.train;
            } else if (portName === "test_data_out") {
              inputData = dataSourceModule.outputData.test;
            }
          }

          if (!inputData)
            throw new Error(
              "Input data for clustering not available or is of the wrong type."
            );

          const trainedModel =
            trainedModelSourceModule.outputData as TrainedClusteringModelOutput;

          // Python으로 클러스터 할당 또는 PCA 변환 수행
          try {
            addLog(
              "INFO",
              `Pyodide를 사용하여 Python으로 클러스터링 데이터 처리 중...`
            );

            const pyodideModule = await import("./utils/pyodideRunner");
            const rows = inputData.rows || [];
            if (rows.length === 0) {
              throw new Error("No data rows available for clustering.");
            }

            // Extract feature matrix X
            const X: number[][] = [];
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
              const row = rows[rowIndex];
              const featureRow: number[] = [];
              for (const col of trainedModel.featureColumns) {
                let value = row[col];

                // 값이 null이나 undefined인 경우 처리
                if (value === null || value === undefined) {
                  throw new Error(
                    `Invalid value in column '${col}' at row ${
                      rowIndex + 1
                    }: null or undefined value found. Please handle missing values first.`
                  );
                }

                // 값이 객체인 경우 처리 (예: {value: 25} 같은 형태)
                if (typeof value === "object" && value !== null) {
                  // 객체에 value 속성이 있으면 사용
                  if ("value" in value && typeof value.value === "number") {
                    value = value.value;
                  } else if (
                    "Value" in value &&
                    typeof value.Value === "number"
                  ) {
                    value = value.Value;
                  } else {
                    // 객체를 JSON 문자열로 변환 후 숫자로 파싱 시도
                    const stringValue = JSON.stringify(value);
                    const parsed = parseFloat(stringValue);
                    if (isNaN(parsed)) {
                      throw new Error(
                        `Invalid value in column '${col}' at row ${
                          rowIndex + 1
                        }: expected number, got object ${JSON.stringify(value)}`
                      );
                    }
                    value = parsed;
                  }
                }

                // 값이 문자열인 경우 숫자로 변환 시도
                if (typeof value === "string") {
                  const trimmed = value.trim();
                  if (
                    trimmed === "" ||
                    trimmed.toLowerCase() === "null" ||
                    trimmed.toLowerCase() === "nan"
                  ) {
                    throw new Error(
                      `Invalid value in column '${col}' at row ${
                        rowIndex + 1
                      }: empty string or null value found. Please handle missing values first.`
                    );
                  }
                  const parsed = parseFloat(trimmed);
                  if (isNaN(parsed)) {
                    throw new Error(
                      `Invalid value in column '${col}' at row ${
                        rowIndex + 1
                      }: cannot convert string "${trimmed}" to number`
                    );
                  }
                  value = parsed;
                }

                // 최종 검증: 숫자인지 확인
                if (typeof value !== "number" || isNaN(value)) {
                  throw new Error(
                    `Invalid value in column '${col}' at row ${
                      rowIndex + 1
                    }: expected number, got ${typeof value} (value: ${JSON.stringify(
                      value
                    )})`
                  );
                }

                featureRow.push(value);
              }
              X.push(featureRow);
            }

            if (trainedModel.modelType === ModuleType.KMeans) {
              const { predictKMeansPython } = pyodideModule;
              const result = await predictKMeansPython(
                X,
                trainedModel.model,
                trainedModel.featureColumns,
                60000
              );

              // 클러스터 할당이 추가된 데이터 생성
              const newRows = rows.map((row, idx) => ({
                ...row,
                cluster: result.clusters[idx],
              }));
              const newColumns = [
                ...inputData.columns,
                { name: "cluster", type: "number" },
              ];

              const clusteredData: DataPreview = {
                type: "DataPreview",
                columns: newColumns,
                totalRowCount: inputData.totalRowCount,
                rows: newRows,
              };

              newOutputData = {
                type: "ClusteringDataOutput",
                clusteredData,
                modelType: ModuleType.KMeans,
              } as ClusteringDataOutput;
            } else if (
              trainedModel.modelType === ModuleType.PrincipalComponentAnalysis
            ) {
              const { transformPCAPython } = pyodideModule;
              const result = await transformPCAPython(
                X,
                trainedModel.model,
                trainedModel.featureColumns,
                60000
              );

              // PCA 변환된 데이터 생성
              const n_components = result.transformedData[0]?.length || 2;
              const newColumns: ColumnInfo[] = Array.from(
                { length: n_components },
                (_, i) => ({
                  name: `PC${i + 1}`,
                  type: "number",
                })
              );

              const newRows = result.transformedData.map((row) => {
                const newRow: Record<string, number> = {};
                for (let i = 0; i < n_components; i++) {
                  newRow[`PC${i + 1}`] = row[i];
                }
                return newRow;
              });

              const transformedData: DataPreview = {
                type: "DataPreview",
                columns: newColumns,
                totalRowCount: inputData.totalRowCount,
                rows: newRows,
              };

              newOutputData = {
                type: "ClusteringDataOutput",
                clusteredData: transformedData,
                modelType: ModuleType.PrincipalComponentAnalysis,
              } as ClusteringDataOutput;
            } else if (
              trainedModel.modelType === ModuleType.DBSCAN ||
              trainedModel.modelType === ModuleType.HierarchicalClustering
            ) {
              // Transductive: 학습 시 계산한 라벨을 동일 데이터에 그대로 부여한다.
              // (이들은 새 데이터를 예측할 수 없으므로 행 수가 일치해야 한다.)
              const labels = trainedModel.labels || [];
              if (labels.length !== rows.length) {
                throw new Error(
                  `Transductive 클러스터링(DBSCAN/Hierarchical)은 새 데이터에 예측할 수 없습니다. 학습 ${labels.length}행 ≠ 입력 ${rows.length}행. 학습에 사용한 동일 데이터를 연결하세요.`
                );
              }
              const newRows = rows.map((row, idx) => ({
                ...row,
                cluster: labels[idx],
              }));
              const newColumns = [
                ...inputData.columns,
                { name: "cluster", type: "number" },
              ];

              const clusteredData: DataPreview = {
                type: "DataPreview",
                columns: newColumns,
                totalRowCount: inputData.totalRowCount,
                rows: newRows,
              };

              newOutputData = {
                type: "ClusteringDataOutput",
                clusteredData,
                modelType: trainedModel.modelType,
              } as ClusteringDataOutput;
            }

            addLog("SUCCESS", "클러스터링 데이터 처리 완료");
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `클러스터링 데이터 처리 실패: ${errorMessage}`);
            throw new Error(`클러스터링 데이터 처리 실패: ${errorMessage}`);
          }
        } else if (module.type === ModuleType.ModelAnalysisReport) {
          // 문서화(메타) 모듈 — 데이터 분석 아님(export/verify 무관).
          // 실행(생성)은 고급 사용자만. 일반 사용자는 거부(열람은 게이트 없음).
          if (!isAdvancedUnlocked) {
            // 전체 실행: 일반 사용자는 보고서 모듈을 에러 없이 건너뛰고 기존 출력 보존.
            if (runAll) {
              addLog(
                "INFO",
                `[${moduleName}] 모델 분석보고서 생성은 고급기능이라 전체 실행에서 건너뜁니다. (기존 보고서는 그대로 열람 가능)`
              );
              // 기존 출력이 있으면 보존, 없으면 Pending 유지(미실행 안내).
              newOutputData = module.outputData;
              newStatus = module.outputData
                ? ModuleStatus.Success
                : ModuleStatus.Pending;
              logLevel = "INFO";
              logMessage = `Module [${moduleName}] skipped (advanced-only generation).`;
              const skipState = {
                ...module,
                status: newStatus,
                outputData: newOutputData,
              };
              const skipIdx = currentModules.findIndex((m) => m.id === moduleId);
              if (skipIdx !== -1) currentModules[skipIdx] = skipState;
              setModules((prev) =>
                prev.map((m) => (m.id === moduleId ? skipState : m))
              );
              addLog(logLevel, logMessage);
              continue;
            }
            // 개별 실행: 일반 사용자는 거부(명확한 안내).
            addLog(
              "INFO",
              "모델 분석보고서 '생성'은 고급기능입니다. 상단 '✨ 모델 분석보고서 생성'(고급 해제 후)으로 만드세요. (기존 보고서 '열람'은 누구나 가능)"
            );
            throw new Error(
              "모델 분석보고서 생성은 고급기능입니다. 상단 '고급기능 실행'으로 잠금을 해제한 뒤 '✨ 모델 분석보고서 생성' 버튼을 사용하세요."
            );
          }
          try {
            addLog(
              "INFO",
              "업스트림 파이프라인 메타데이터를 수집하여 분석보고서를 생성합니다…"
            );
            const { gatherReportContext } = await import("./utils/modelReport");
            const { generateModelReportHtml } = await import("./lib/aiHelpers");

            // 최신 모듈 상태(실행 결과 outputData 포함)에서 수집.
            const latestModules = getCurrentModules();
            const latestModule =
              latestModules.find((m) => m.id === module.id) || module;
            const ctx = gatherReportContext(
              latestModule,
              latestModules,
              connections
            );

            // 사용자 추가정보(텍스트) + PDF 추출 텍스트 병합 → extraInfo.
            const extraText = String(
              latestModule.parameters?.extra_info || ""
            ).trim();
            const pdfText = String(
              latestModule.parameters?.extra_pdf_text || ""
            ).trim();
            const pdfName = String(
              latestModule.parameters?.extra_pdf_name || ""
            ).trim();
            const mergedExtra = [
              extraText,
              pdfText
                ? `${pdfName ? `[첨부 PDF: ${pdfName}]\n` : ""}${pdfText}`
                : "",
            ]
              .filter(Boolean)
              .join("\n\n");
            if (mergedExtra) ctx.extraInfo = mergedExtra;
            ctx.generatedAt = new Date().toISOString().slice(0, 10);

            // 스트리밍 진행률 로그(과도한 로그 방지: 4000자 단위로만).
            let lastLoggedChars = 0;
            const { html, source } = await generateModelReportHtml(ctx, (chars) => {
              if (chars - lastLoggedChars >= 4000) {
                lastLoggedChars = chars;
                addLog("INFO", `AI 보고서 생성 중… ${chars.toLocaleString()}자 작성됨`);
              }
            });

            newOutputData = {
              type: "ModelReportOutput",
              html,
              generatedAt: new Date().toISOString(),
              source,
              context: ctx,
            };
            addLog(
              "SUCCESS",
              `모델 분석보고서 생성 완료 (${source === "ai" ? "AI 생성" : "결정적 폴백"}).`
            );
          } catch (error: any) {
            const errorMessage = error.message || String(error);
            addLog("ERROR", `모델 분석보고서 생성 실패: ${errorMessage}`);
            throw new Error(`모델 분석보고서 생성 실패: ${errorMessage}`);
          }
        } else {
          const inputConnection = connections.find(
            (c) => c.to.moduleId === module.id
          );
          if (inputConnection) {
            const sourceModule = currentModules.find(
              (sm) => sm.id === inputConnection.from.moduleId
            );
            if (sourceModule?.outputData?.type === "DataPreview") {
              newOutputData = sourceModule.outputData;
            } else if (sourceModule?.status !== ModuleStatus.Success) {
              throw new Error(
                `Upstream module [${sourceModule?.name}] did not run successfully.`
              );
            }
          }
        }
        newStatus = ModuleStatus.Success;
        logLevel = "SUCCESS";
        logMessage = `Module [${moduleName}] executed successfully.`;
      } catch (error: any) {
        newStatus = ModuleStatus.Error;
        logLevel = "ERROR";
        logMessage = `Module [${moduleName}] failed: ${error.message}`;

        // A-5: 오류 유형 분류 후 한국어 안내 표시
        const { category, userMessage } = classifyPythonError(error);
        const technicalDetail = error.message
          ? `${error.message}${error.traceback || error.error_traceback ? `\n\n${error.traceback || error.error_traceback}` : ""}`
          : String(error);

        setErrorModal({
          moduleName: moduleName,
          message: `${category}\n\n${userMessage}`,
          details: technicalDetail,
        });
      }

      const finalModuleState = {
        ...module,
        status: newStatus,
        outputData: newOutputData,
        executionTime: newStatus === ModuleStatus.Success ? Date.now() - moduleStartTime : module.executionTime,
        // outputData2가 있으면 포함
        ...((module as any).outputData2 && {
          outputData2: (module as any).outputData2,
        }),
      };

      // Update the mutable array for the current run
      const moduleIndex = currentModules.findIndex((m) => m.id === moduleId);
      if (moduleIndex !== -1) {
        currentModules[moduleIndex] = finalModuleState;
      }

      // If TrainModel succeeded, mark the connected model definition module as Success
      // If TrainModel is set to Pending, also mark the connected model definition module as Pending
      let modelDefinitionModuleId: string | null = null;
      let shouldUpdateModelDefinition = false;
      let modelDefinitionNewStatus: ModuleStatus | null = null;

      if (module.type === ModuleType.TrainModel) {
        const modelInputConnection = connections.find(
          (c) => c.to.moduleId === moduleId && c.to.portName === "model_in"
        );
        if (modelInputConnection) {
          modelDefinitionModuleId = modelInputConnection.from.moduleId;
          if (newStatus === ModuleStatus.Success) {
            shouldUpdateModelDefinition = true;
            modelDefinitionNewStatus = ModuleStatus.Success;
          } else if (
            newStatus === ModuleStatus.Pending ||
            newStatus === ModuleStatus.Error
          ) {
            // When TrainModel becomes Pending or Error, mark connected model definition module as Pending
            shouldUpdateModelDefinition = true;
            modelDefinitionNewStatus = ModuleStatus.Pending;
          }
        }
      }

      // Update React's state for the UI
      setModules((prev) =>
        prev.map((m) => {
          if (m.id === moduleId) {
            // viewingEvaluation이 열려있고 이 모듈이면 자동으로 업데이트
            if (viewingEvaluation && viewingEvaluation.id === moduleId) {
              setViewingEvaluation(finalModuleState);
            }
            return finalModuleState;
          }
          // Update connected model definition module status when TrainModel status changes
          if (
            shouldUpdateModelDefinition &&
            modelDefinitionModuleId &&
            m.id === modelDefinitionModuleId &&
            MODEL_DEFINITION_TYPES.includes(m.type) &&
            modelDefinitionNewStatus
          ) {
            return {
              ...m,
              status: modelDefinitionNewStatus,
              outputData:
                modelDefinitionNewStatus === ModuleStatus.Pending
                  ? undefined
                  : m.outputData,
            };
          }
          return m;
        })
      );
      addLog(logLevel, logMessage);

      if (newStatus === ModuleStatus.Error) {
        break;
      }
    }
    if (runAll) {
      const snapshot: RunHistorySession = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        results: currentModules.map(m => ({
          name: m.name,
          type: m.type,
          status: m.status,
          executionTime: m.executionTime,
        })),
      };
      setRunHistory(prev => [snapshot, ...prev].slice(0, 10));
      setRunAllProgress(null);
    }
  };

  /**
   * ✨ 모델 분석보고서 생성(고급 전용, 자동연결+생성).
   * 1) 종단 모델 모듈 탐색(EvaluateModel > Train(Clustering)Model > ClusteringData > 마지막 data 출력).
   * 2) 보고서 모듈 확보(기존 재사용 또는 신규 생성, 종단 아래 배치).
   * 3) 자동 연결(종단 출력 타입 → 대응 report 입력 포트, 기존 보고서 입력 연결은 제거).
   * 4) 실행(gather→generateModelReportHtml(onProgress))→outputData 세팅→미리보기 자동 오픈.
   * runSimulation을 거치지 않고 인라인 수집/생성하여(클로저 stale 회피) 새로 만든 모듈/연결을 바로 반영한다.
   */
  const handleGenerateModelReport = async () => {
    if (isGeneratingReport) return;
    if (!isAdvancedUnlocked) {
      addLog(
        "INFO",
        "모델 분석보고서 생성은 고급기능입니다. 상단 '고급기능 실행'으로 잠금을 해제하세요."
      );
      return;
    }

    // 1) 종단 모델 모듈 탐색.
    // 주요 출력 포트가 (보고서가 아닌) 다른 모듈로 연결되지 않은 '종단'을 찾는다.
    const PRIMARY_OUTPUT: Partial<Record<ModuleType, { port: string; type: "data" | "model" | "evaluation" }>> = {
      [ModuleType.EvaluateModel]: { port: "evaluation_out", type: "evaluation" },
      [ModuleType.TrainClusteringModel]: { port: "trained_model_out", type: "model" },
      [ModuleType.TrainModel]: { port: "trained_model_out", type: "model" },
      [ModuleType.ClusteringData]: { port: "clustered_data_out", type: "data" },
    };
    // data 출력(말단) 폴백 후보(주요 모델 출력이 없을 때).
    const reportModulePresent = (m: CanvasModule) =>
      m.type === ModuleType.ModelAnalysisReport;

    const isTerminalOutput = (m: CanvasModule, portName: string) =>
      !connections.some(
        (c) =>
          c.from.moduleId === m.id &&
          c.from.portName === portName &&
          !modules.some(
            (dst) => dst.id === c.to.moduleId && reportModulePresent(dst)
          )
      );

    type Terminal = { module: CanvasModule; port: string; type: "data" | "model" | "evaluation" };
    const collectTerminals = (type: ModuleType): Terminal[] => {
      const info = PRIMARY_OUTPUT[type];
      if (!info) return [];
      return modules
        .filter((m) => m.type === type && isTerminalOutput(m, info.port))
        .map((m) => ({ module: m, port: info.port, type: info.type }));
    };

    let terminal: Terminal | undefined =
      collectTerminals(ModuleType.EvaluateModel)[0] ||
      collectTerminals(ModuleType.TrainClusteringModel)[0] ||
      collectTerminals(ModuleType.TrainModel)[0] ||
      collectTerminals(ModuleType.ClusteringData)[0];

    // 폴백: 위 모델 종단이 없으면 마지막 data 출력(말단) 모듈.
    if (!terminal) {
      const dataTerminals = modules
        .filter(
          (m) =>
            m.type !== ModuleType.ModelAnalysisReport &&
            m.type !== ModuleType.TextBox &&
            m.type !== ModuleType.GroupBox &&
            (m.outputs || []).some(
              (p) => p.type === "data" && isTerminalOutput(m, p.name)
            )
        )
        .map((m) => {
          const port = (m.outputs || []).find(
            (p) => p.type === "data" && isTerminalOutput(m, p.name)
          )!;
          return { module: m, port: port.name, type: "data" as const };
        });
      terminal = dataTerminals[dataTerminals.length - 1];
    }

    if (!terminal) {
      addLog(
        "INFO",
        "분석할 모델이 없습니다. EvaluateModel 등 모델 파이프라인을 먼저 구성·실행하세요."
      );
      return;
    }

    // 종단 출력 타입 → 대응 report 입력 포트.
    const reportPortByType: Record<"data" | "model" | "evaluation", string> = {
      evaluation: "report_in_eval",
      model: "report_in_model",
      data: "report_in",
    };
    const targetReportPort = reportPortByType[terminal.type];

    setIsGeneratingReport(true);
    try {
      // 2) 보고서 모듈 확보(기존 재사용 또는 신규).
      let reportModule = modules.find(
        (m) => m.type === ModuleType.ModelAnalysisReport
      );
      let workingModules = modules;
      if (reportModule) {
        // 기존 재사용 — 출력 비우고 Pending.
        const reused = {
          ...reportModule,
          status: ModuleStatus.Pending,
          outputData: undefined,
        };
        reportModule = reused;
        workingModules = modules.map((m) => (m.id === reused.id ? reused : m));
      } else {
        // 신규 생성 — constants 템플릿 기반, 종단 아래(x, y+260)에 배치.
        const tpl = DEFAULT_MODULES.find(
          (m) => m.type === ModuleType.ModelAnalysisReport
        );
        const count =
          modules.filter((m) => m.type === ModuleType.ModelAnalysisReport)
            .length + 1;
        const created: CanvasModule = {
          id: `${ModuleType.ModelAnalysisReport}-${Date.now()}`,
          name: `모델 분석보고서 ${count}`,
          type: ModuleType.ModelAnalysisReport,
          position: {
            x: terminal.module.position.x,
            y: terminal.module.position.y + 260,
          },
          status: ModuleStatus.Pending,
          parameters: { ...(tpl?.parameters || {}) },
          inputs: [...(tpl?.inputs || [])],
          outputs: [...(tpl?.outputs || [])],
        };
        reportModule = created;
        workingModules = [...modules, created];
      }

      const reportId = reportModule.id;

      // 3) 자동 연결 — 보고서로 들어오는 기존 연결 제거 후 종단→대응 포트 1개 추가.
      const newConnection: Connection = {
        id: `report-conn-${Date.now()}`,
        from: { moduleId: terminal.module.id, portName: terminal.port },
        to: { moduleId: reportId, portName: targetReportPort },
      };
      const workingConnections = [
        ...connections.filter((c) => c.to.moduleId !== reportId),
        newConnection,
      ];

      // 모듈/연결을 먼저 커밋(자동연결 시각화). _setConnections로 리셋 가드 우회.
      setModules(() => workingModules);
      _setConnections(workingConnections);
      setIsDirty(true);

      addLog(
        "INFO",
        `종단 모듈 [${terminal.module.name}]을(를) 보고서에 연결하고 분석보고서를 생성합니다…`
      );

      // 4) 인라인 수집/생성(runSimulation 미경유 — 방금 만든 모듈/연결을 바로 사용).
      const { gatherReportContext } = await import("./utils/modelReport");
      const { generateModelReportHtml } = await import("./lib/aiHelpers");

      const latestReport =
        workingModules.find((m) => m.id === reportId) || reportModule;
      const ctx = gatherReportContext(
        latestReport,
        workingModules,
        workingConnections
      );

      const extraText = String(latestReport.parameters?.extra_info || "").trim();
      const pdfText = String(
        latestReport.parameters?.extra_pdf_text || ""
      ).trim();
      const pdfName = String(
        latestReport.parameters?.extra_pdf_name || ""
      ).trim();
      const mergedExtra = [
        extraText,
        pdfText
          ? `${pdfName ? `[첨부 PDF: ${pdfName}]\n` : ""}${pdfText}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (mergedExtra) ctx.extraInfo = mergedExtra;
      ctx.generatedAt = new Date().toISOString().slice(0, 10);

      let lastLoggedChars = 0;
      const { html, source } = await generateModelReportHtml(ctx, (chars) => {
        if (chars - lastLoggedChars >= 4000) {
          lastLoggedChars = chars;
          addLog("INFO", `AI 보고서 생성 중… ${chars.toLocaleString()}자 작성됨`);
        }
      });

      const reportOutput = {
        type: "ModelReportOutput" as const,
        html,
        generatedAt: new Date().toISOString(),
        source,
        context: ctx,
      };

      const finalReport: CanvasModule = {
        ...latestReport,
        status: ModuleStatus.Success,
        outputData: reportOutput as any,
      };

      setModules((prev) =>
        prev.map((m) => (m.id === reportId ? finalReport : m))
      );
      addLog(
        "SUCCESS",
        `모델 분석보고서 생성 완료 (${source === "ai" ? "AI 생성" : "결정적 폴백"}). 미리보기를 엽니다.`
      );
      // 미리보기 자동 오픈.
      setViewingModelReport(finalReport);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      addLog("ERROR", `모델 분석보고서 생성 실패: ${errorMessage}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleAutoLayout = () => {
    if (modules.length === 0) return;
    const arranged = autoLayoutModules(modules, connections);
    setModules(arranged);
    addLog('INFO', `자동 레이아웃 적용됨 (${modules.length}개 모듈)`);
  };

  const handleShareLink = async () => {
    if (modules.length === 0) {
      addLog('WARN', '공유할 모듈이 없습니다. 먼저 파이프라인을 구성해주세요.');
      return;
    }
    try {
      await copyShareLink(modules, connections, projectName);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
      addLog('SUCCESS', '공유 링크가 클립보드에 복사되었습니다.');
    } catch {
      addLog('ERROR', '링크 복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const handleRunAll = () => {
    // Run All runs only the currently active tab's modules/connections (state is always active tab).

    // A-1: 순환 참조(Circular Dependency) 검사
    const detectCycles = (): string[][] => {
      const graph = new Map<string, string[]>();
      modules.forEach((m) => graph.set(m.id, []));
      connections.forEach((c) => {
        const downstream = graph.get(c.from.moduleId);
        if (downstream) downstream.push(c.to.moduleId);
      });

      const cycles: string[][] = [];
      const visited = new Set<string>();
      const inStack = new Set<string>();
      const stack: string[] = [];

      const dfs = (id: string) => {
        if (inStack.has(id)) {
          const cycleStart = stack.indexOf(id);
          const cycleModuleNames = stack.slice(cycleStart).map((mid) => {
            const m = modules.find((mod) => mod.id === mid);
            return m ? m.name : mid;
          });
          cycles.push(cycleModuleNames);
          return;
        }
        if (visited.has(id)) return;
        inStack.add(id);
        stack.push(id);
        for (const child of graph.get(id) || []) {
          dfs(child);
        }
        stack.pop();
        inStack.delete(id);
        visited.add(id);
      };

      modules.forEach((m) => dfs(m.id));
      return cycles;
    };

    const cycles = detectCycles();
    if (cycles.length > 0) {
      const cycleDescriptions = cycles
        .map((c) => c.join(" → "))
        .join("\n");
      addLog(
        "ERROR",
        `⚠️ 순환 참조(Circular Dependency) 감지됨! 실행을 중단합니다.\n순환 경로:\n${cycleDescriptions}`
      );
      setErrorModal({
        moduleName: "파이프라인 검증",
        message: `순환 참조(Circular Dependency)가 감지되어 실행할 수 없습니다.`,
        details: `다음 순환 경로를 제거한 후 다시 실행해주세요:\n\n${cycleDescriptions}`,
      });
      return;
    }

    // A-2: 필수 입력 포트 연결 검증
    const unconnectedInputs: string[] = [];
    modules.forEach((m) => {
      if (m.inputs.length === 0) return; // 입력 포트 없는 모듈은 건너뜀
      m.inputs.forEach((port) => {
        const isConnected = connections.some(
          (c) => c.to.moduleId === m.id && c.to.portName === port.name
        );
        if (!isConnected) {
          unconnectedInputs.push(`• ${m.name}: '${port.name}' 입력 포트 미연결`);
        }
      });
    });

    if (unconnectedInputs.length > 0) {
      addLog(
        "WARN",
        `⚠️ 미연결 입력 포트가 있습니다. 실행 중 오류가 발생할 수 있습니다:\n${unconnectedInputs.join("\n")}`
      );
    }

    const rootNodes = modules.filter(
      (m) => !connections.some((c) => c.to.moduleId === m.id)
    );
    if (rootNodes.length > 0) {
      addLog(
        "INFO",
        `Project Run All started (active tab only) with ${rootNodes.length} root node(s)...`
      );
      setModules((prev) =>
        prev.map((m) => {
          // 일반 사용자: '모델 분석보고서'는 전체 실행에서 건너뛰고 기존 출력 보존
          // (생성은 고급 전용). 고급 사용자/그 외 모듈은 기존대로 초기화.
          if (
            !isAdvancedUnlocked &&
            m.type === ModuleType.ModelAnalysisReport &&
            m.outputData
          ) {
            return m;
          }
          return { ...m, status: ModuleStatus.Pending, outputData: undefined };
        })
      );
      // Run all modules starting from all root nodes
      // Pass the first root node ID, but runAll=true will traverse all root nodes
      runSimulation(rootNodes[0].id, true);
    } else if (modules.length > 0) {
      addLog(
        "WARN",
        "No root nodes found. Starting from all modules."
      );
      setModules((prev) =>
        prev.map((m) => {
          if (
            !isAdvancedUnlocked &&
            m.type === ModuleType.ModelAnalysisReport &&
            m.outputData
          ) {
            return m;
          }
          return { ...m, status: ModuleStatus.Pending, outputData: undefined };
        })
      );
      // When no root nodes, runAll will traverse all modules
      runSimulation(modules[0].id, true);
    } else {
      addLog("WARN", "No modules on canvas to run.");
    }
  };

  const adjustScale = (delta: number) => {
    setScale((prev) => Math.max(0.2, Math.min(2, prev + delta)));
  };

  const selectedModule =
    modules.find(
      (m) => m.id === selectedModuleIds[selectedModuleIds.length - 1]
    ) || null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isEditingText =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable);
      if (isEditingText) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          // Ctrl+A: 모든 모듈 선택
          const allModuleIds = modules.map((m) => m.id);
          setSelectedModuleIds(allModuleIds);
          addLog("INFO", `모든 모듈 선택됨 (${allModuleIds.length}개)`);
        } else if (e.key === "z") {
          e.preventDefault();
          undo();
        } else if (e.key === "y") {
          e.preventDefault();
          redo();
        } else if (e.key === "c") {
          // 텍스트가 선택돼 있으면 브라우저 기본 복사(Ctrl+C)를 허용한다.
          // (코드 패널·터미널 로그·미리보기 등의 텍스트를 별도 복사 버튼 없이 그대로 복사)
          const textSel = window.getSelection();
          if (textSel && textSel.toString().trim()) {
            return; // 기본 동작: 선택 텍스트 복사 (모듈 복사로 가로채지 않음)
          }
          if (selectedModuleIds.length > 0) {
            e.preventDefault();
            pasteOffset.current = 0;
            const selectedModules = modules.filter((m) =>
              selectedModuleIds.includes(m.id)
            );
            const selectedIdsSet = new Set(selectedModuleIds);
            const internalConnections = connections.filter(
              (c) =>
                selectedIdsSet.has(c.from.moduleId) &&
                selectedIdsSet.has(c.to.moduleId)
            );
            setClipboard({
              modules: JSON.parse(JSON.stringify(selectedModules)),
              connections: JSON.parse(JSON.stringify(internalConnections)),
            });
            addLog(
              "INFO",
              `${selectedModuleIds.length} module(s) copied to clipboard.`
            );
          }
        } else if (e.key === "v") {
          e.preventDefault();
          if (clipboard) {
            pasteOffset.current += 30;
            const idMap: Record<string, string> = {};
            const newModules = clipboard.modules.map((mod) => {
              const newId = `${mod.type}-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 7)}`;
              idMap[mod.id] = newId;
              return {
                ...mod,
                id: newId,
                position: {
                  x: mod.position.x + pasteOffset.current,
                  y: mod.position.y + pasteOffset.current,
                },
                status: ModuleStatus.Pending,
                outputData: undefined,
              };
            });
            const newConnections = clipboard.connections.map((conn) => ({
              ...conn,
              id: `conn-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 7)}`,
              from: { ...conn.from, moduleId: idMap[conn.from.moduleId] },
              to: { ...conn.to, moduleId: idMap[conn.to.moduleId] },
            }));

            setModules((prev) => [...prev, ...newModules]);
            setConnections((prev) => [...prev, ...newConnections]);
            setSelectedModuleIds(newModules.map((m) => m.id));
            addLog(
              "INFO",
              `${newModules.length} module(s) pasted from clipboard.`
            );
          }
        } else if (e.key === "x") {
          // Cut (copy and delete) — 텍스트 선택 중이면 기본 동작 허용(모듈 잘라내기 방지)
          const textSelX = window.getSelection();
          if (textSelX && textSelX.toString().trim()) {
            return;
          }
          if (selectedModuleIds.length > 0) {
            e.preventDefault();
            pasteOffset.current = 0;
            const selectedModules = modules.filter((m) =>
              selectedModuleIds.includes(m.id)
            );
            const selectedIdsSet = new Set(selectedModuleIds);
            const internalConnections = connections.filter(
              (c) =>
                selectedIdsSet.has(c.from.moduleId) &&
                selectedIdsSet.has(c.to.moduleId)
            );
            setClipboard({
              modules: JSON.parse(JSON.stringify(selectedModules)),
              connections: JSON.parse(JSON.stringify(internalConnections)),
            });
            deleteModules([...selectedModuleIds]);
            addLog("INFO", `${selectedModuleIds.length} module(s) cut.`);
          }
        } else if (e.key === "s") {
          e.preventDefault();
          handleSavePipeline();
        } else if (e.key === "=" || e.key === "+") {
          // Zoom in (step by step)
          e.preventDefault();
          const newScale = Math.min(2, scale + 0.1);
          setScale(newScale);
        } else if (e.key === "-" || e.key === "_") {
          // Zoom out (step by step)
          e.preventDefault();
          const newScale = Math.max(0.2, scale - 0.1);
          setScale(newScale);
        } else if (e.key === "0") {
          // Fit to view
          e.preventDefault();
          handleFitToView();
        } else if (e.key === "1") {
          // 100% view
          e.preventDefault();
          setScale(1);
          setPan({ x: 0, y: 0 });
        }
      } else if (selectedModuleIds.length > 0) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          deleteModules([...selectedModuleIds]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedModuleIds,
    undo,
    redo,
    setModules,
    setConnections,
    setSelectedModuleIds,
    modules,
    connections,
    clipboard,
    deleteModules,
    addLog,
    scale,
    setScale,
    setPan,
    handleFitToView,
    handleSavePipeline,
  ]);

  useEffect(() => {
    const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
      if (isDraggingControlPanel.current) {
        // 마우스 위치에서 오프셋을 빼서 패널 위치 계산
        const newX = e.clientX - controlPanelDragOffset.current.x;
        const newY = e.clientY - controlPanelDragOffset.current.y;

        // 화면 경계 내에 유지
        const panelWidth = 300; // 대략적인 패널 너비
        const panelHeight = 50; // 대략적인 패널 높이
        const constrainedX = Math.max(
          0,
          Math.min(newX, window.innerWidth - panelWidth)
        );
        const constrainedY = Math.max(
          0,
          Math.min(newY, window.innerHeight - panelHeight)
        );

        setControlPanelPos({
          x: constrainedX,
          y: constrainedY,
        });
      }
    };

    const handleWindowMouseUp = () => {
      isDraggingControlPanel.current = false;
    };

    // 화면 리사이즈 시 컨트롤 패널 위치 조정
    const handleWindowResize = () => {
      if (controlPanelPos) {
        const panelWidth = 300;
        const panelHeight = 50;
        const constrainedX = Math.max(
          0,
          Math.min(controlPanelPos.x, window.innerWidth - panelWidth)
        );
        const constrainedY = Math.max(
          0,
          Math.min(controlPanelPos.y, window.innerHeight - panelHeight)
        );

        // 위치가 변경된 경우에만 업데이트
        if (
          constrainedX !== controlPanelPos.x ||
          constrainedY !== controlPanelPos.y
        ) {
          setControlPanelPos({
            x: constrainedX,
            y: constrainedY,
          });
        }
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [controlPanelPos]);

  const handleControlPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas panning

    // 마우스 이벤트만 허용 (키보드나 터치 이벤트는 무시)
    if (e.type !== "mousedown") return;

    isDraggingControlPanel.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    controlPanelDragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // 첫 드래그인 경우 현재 위치를 명시적으로 설정
    if (!controlPanelPos) {
      setControlPanelPos({
        x: rect.left,
        y: rect.top,
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white h-screen w-screen flex flex-col overflow-hidden transition-colors duration-200">
      {/* B-1: Pyodide 로딩 진행 표시 배너 */}
      {pyodideStatus && (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-blue-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs font-medium text-gray-100 truncate">{pyodideStatus.message}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pyodideStatus.progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{pyodideStatus.progress}% 완료</p>
        </div>
      )}
      {isAiGenerating && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex flex-col items-center justify-center z-50">
          <div role="status">
            <svg
              aria-hidden="true"
              className="w-12 h-12 text-gray-700 dark:text-gray-200 animate-spin fill-blue-600"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0492C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            AI가 최적의 파이프라인을 설계하고 있습니다...
          </p>
        </div>
      )}

      {isGeneratingPPTs && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex flex-col items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            {pptProgress.status === "generating" && (
              <>
                <div className="flex flex-col items-center mb-4">
                  <div role="status">
                    <svg
                      aria-hidden="true"
                      className="w-12 h-12 text-gray-700 dark:text-gray-200 animate-spin fill-blue-600"
                      viewBox="0 0 100 101"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                        fill="currentColor"
                      />
                      <path
                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0492C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                        fill="currentFill"
                      />
                    </svg>
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                  {pptProgress.message}
                </p>
                {pptProgress.details && (
                  <p className="text-sm text-gray-400 text-center">
                    {pptProgress.details}
                  </p>
                )}
              </>
            )}

            {pptProgress.status === "success" && (
              <>
                <div className="flex flex-col items-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-semibold text-white text-center mb-2">
                  {pptProgress.message}
                </p>
                {pptProgress.details && (
                  <p className="text-sm text-gray-400 text-center mb-4">
                    {pptProgress.details}
                  </p>
                )}
                <button
                  onClick={() => {
                    setIsGeneratingPPTs(false);
                    setPptProgress({ status: "idle", message: "" });
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                  확인
                </button>
              </>
            )}

            {pptProgress.status === "error" && (
              <>
                <div className="flex flex-col items-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-semibold text-white text-center mb-2">
                  {pptProgress.message}
                </p>
                {pptProgress.details && (
                  <p className="text-sm text-gray-400 text-center mb-4">
                    {pptProgress.details}
                  </p>
                )}
                <button
                  onClick={() => {
                    setIsGeneratingPPTs(false);
                    setPptProgress({ status: "idle", message: "" });
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <header className="flex flex-col px-4 py-1.5 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 flex-shrink-0 z-20 relative overflow-visible">
        {/* 첫 번째 줄: 제목 및 모델 이름 */}
        <div className="flex items-center w-full">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <LogoIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <h1 className="text-base md:text-xl font-bold text-blue-600 dark:text-blue-300 tracking-wide flex-shrink-0">
              ML Auto Flow
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-gray-400 dark:text-gray-600 hidden md:inline">
                |
              </span>
              {isEditingProjectName ? (
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onBlur={() => setIsEditingProjectName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      setIsEditingProjectName(false);
                    }
                  }}
                  className="bg-gray-100 dark:bg-gray-800 text-sm md:text-lg font-semibold text-gray-900 dark:text-white px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                  autoFocus
                />
              ) : (
                <h2
                  onClick={() => setIsEditingProjectName(true)}
                  className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded-md cursor-pointer truncate"
                  title="클릭하여 프로젝트 이름 수정"
                >
                  {projectName}
                </h2>
              )}
            </div>
          </div>
        </div>

        {/* 두 번째 줄: Load, Save 등 버튼들 */}
        <div className="flex items-center justify-end gap-2 w-full overflow-x-auto scrollbar-hide mt-1">
          {/* 테마 전환 버튼 */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
            title={
              theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
            }
          >
            {theme === "dark" ? (
              <SunIcon className="h-5 w-5 text-yellow-400" />
            ) : (
              <MoonIcon className="h-5 w-5 text-gray-700" />
            )}
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="실행 취소 (Ctrl+Z)"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="다시 실행 (Ctrl+Y)"
          >
            <ArrowUturnRightIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0 text-xs font-bold"
            title="키보드 단축키 안내"
          >
            ?
          </button>
          {isAdvancedUnlocked && (
          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className={`flex items-center gap-0.5 p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0 text-sm ${ADVANCED_BTN_DIM}`}
            title="AI 설정 (Claude API 키) (고급기능)"
          >
            <AdvancedLockBadge className="text-[10px] leading-none" />
            ⚙
          </button>
          )}
          <div className="h-5 border-l border-gray-700"></div>
          <button
            onClick={handleShareLink}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
            title="파이프라인 공유 링크 복사"
          >
            {shareLinkCopied ? (
              <CheckIcon className="h-5 w-5 text-green-500" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
          <div className="h-5 border-l border-gray-700"></div>
          <button
            onClick={handleSetFolder}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-semibold transition-colors flex-shrink-0"
            title="저장 폴더 설정"
          >
            <FolderOpenIcon className="h-4 w-4" />
            <span>폴더 설정</span>
          </button>
          <button
            onClick={handleLoadPipeline}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-semibold transition-colors flex-shrink-0"
            title="파이프라인 불러오기"
          >
            <FolderOpenIcon className="h-4 w-4" />
            <span>불러오기</span>
          </button>
          <button
            onClick={handleSavePipeline}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white dark:text-white ${
              !isDirty
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50"
                : "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
            }`}
            title="파이프라인 저장"
          >
            {saveButtonText === "저장" ? (
              <ArrowDownTrayIcon className="h-4 w-4" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
            <span>{saveButtonText}</span>
          </button>
          <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <button
              onClick={handleRunAll}
              disabled={!!runAllProgress}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 ${runAllProgress ? 'bg-green-700 opacity-70 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'} text-white`}
              title="전체 모듈 실행"
            >
              <PlayIcon className="h-4 w-4" />
              <span>{runAllProgress ? `실행 중 (${runAllProgress.current}/${runAllProgress.total})` : '전체 실행'}</span>
            </button>
            {runAllProgress && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: runAllProgress.total > 0 ? `${(runAllProgress.current / runAllProgress.total) * 100}%` : '0%' }}
                />
              </div>
            )}
          </div>
          <button
            onClick={() => setShowModelComparison(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white"
            title="실행 완료된 모델들의 성능 지표 비교"
          >
            <span>⚖️ 모델 비교</span>
          </button>
          {/* ✨ 모델 분석보고서 생성(고급 전용) — 종단 모델 자동연결 후 생성+미리보기 */}
          {isAdvancedUnlocked && (
            <button
              onClick={handleGenerateModelReport}
              disabled={isGeneratingReport}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white ${
                isGeneratingReport
                  ? "bg-cyan-700 opacity-70 cursor-not-allowed"
                  : "bg-cyan-600 hover:bg-cyan-500"
              } ${ADVANCED_BTN_DIM}`}
              title="종단 모델을 자동 연결해 모델 분석보고서를 생성합니다(고급기능)"
            >
              <AdvancedLockBadge className="text-[10px] leading-none" />
              <span>{isGeneratingReport ? "보고서 생성 중…" : "✨ 모델 분석보고서 생성"}</span>
            </button>
          )}
        </div>

        {/* 세 번째 줄: 햄버거 버튼(왼쪽) 및 AI 버튼 2개, PPT 생성, 설정 버튼(오른쪽) */}
        <div className="flex items-center justify-between gap-1 md:gap-2 w-full mt-1 overflow-visible">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setIsLeftPanelVisible((v) => !v)}
              className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
              aria-label="모듈 패널 토글"
              title="모듈 패널 열기/닫기"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
            <div
              className="relative flex-shrink-0"
              ref={sampleMenuRef}
              style={{ zIndex: 1000 }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(
                    "Samples button clicked, current state:",
                    isSampleMenuOpen,
                    "SAMPLE_MODELS:",
                    SAMPLE_MODELS
                  );
                  setIsSampleMenuOpen(true);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors cursor-pointer ${
                  isSampleMenuOpen
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200"
                }`}
                title="샘플 모델 불러오기"
                type="button"
              >
                <SparklesIcon className="h-4 w-4" />
                <span>샘플</span>
              </button>
            </div>
            {/* My Work 버튼 */}
            <div
              className="relative flex-shrink-0"
              ref={myWorkMenuRef}
              style={{ zIndex: 1000 }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMyWorkMenuOpen((prev) => !prev);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors cursor-pointer ${
                  isMyWorkMenuOpen
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200"
                }`}
                title="내 작업"
                type="button"
              >
                <FolderOpenIcon className="h-4 w-4" />
                <span>내 작업</span>
              </button>
              {isMyWorkMenuOpen && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-xl min-w-[220px]"
                  style={{ zIndex: 9999 }}
                >
                  {/* 마지막 작업 불러오기 (localStorage 영구 저장 — 브라우저를 닫아도 복원) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const snap = loadLastWork();
                      if (!snap || !snap.modules?.length) {
                        addLog("INFO", "복원할 마지막 작업이 없습니다.");
                        setIsMyWorkMenuOpen(false);
                        return;
                      }
                      const restored = snap.modules.map((m: any) => ({
                        ...m,
                        status: m.outputData
                          ? ModuleStatus.Success
                          : ModuleStatus.Pending,
                      }));
                      resetModules(restored as CanvasModule[]);
                      _setConnections(snap.connections || []);
                      if (snap.projectName) setProjectName(snap.projectName);
                      setSelectedModuleIds([]);
                      setIsDirty(false);
                      addLog(
                        "SUCCESS",
                        `마지막 작업을 불러왔습니다 (${restored.length}개 모듈, ${formatSavedAt(
                          snap.savedAt
                        )} 저장).` +
                          (snap.dataStripped
                            ? " 데이터가 커서 본문은 제외됐습니다 — 실행 시 파일명으로 자동 재로드하거나 LoadData에서 파일을 다시 선택하세요."
                            : "")
                      );
                      setIsMyWorkMenuOpen(false);
                      setTimeout(() => handleFitToView(), 100);
                    }}
                    disabled={!lastWorkMeta}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 ${
                      lastWorkMeta
                        ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    }`}
                    type="button"
                    title="가장 최근에 작업한 파이프라인을 복원합니다 (브라우저를 닫아도 유지)"
                  >
                    <span aria-hidden className="text-base leading-none">
                      🕘
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium">마지막 작업 불러오기</span>
                      {lastWorkMeta ? (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {formatSavedAt(lastWorkMeta.savedAt)} ·{" "}
                          {lastWorkMeta.moduleCount}개 모듈
                          {lastWorkMeta.dataStripped ? " · 데이터 제외" : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          저장된 작업 없음
                        </span>
                      )}
                    </span>
                  </button>

                  {/* 파일에서 불러오기 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".json,.ins";
                      input.onchange = (event: Event) => {
                        const target = event.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (e: ProgressEvent<FileReader>) => {
                          try {
                            const content = e.target?.result as string;
                            if (!content) {
                              addLog("ERROR", "파일이 비어있습니다.");
                              return;
                            }
                            const savedState = JSON.parse(content);
                            if (savedState.modules && savedState.connections) {
                              resetModules(savedState.modules);
                              _setConnections(savedState.connections);
                              if (savedState.projectName) {
                                setProjectName(savedState.projectName);
                              }
                              setSelectedModuleIds([]);
                              setIsDirty(false);
                              addLog(
                                "SUCCESS",
                                `파일 '${file.name}'을 불러왔습니다.`
                              );
                              setIsMyWorkMenuOpen(false);
                            } else if (savedState.name && savedState.modules) {
                              // Sample 형식인 경우
                              handleLoadSample(savedState.name, "mywork");
                              setIsMyWorkMenuOpen(false);
                            } else {
                              addLog("WARN", "올바르지 않은 파일 형식입니다.");
                            }
                          } catch (error) {
                            console.error("Failed to load file:", error);
                            addLog("ERROR", "파일을 불러오는데 실패했습니다.");
                          }
                        };
                        reader.readAsText(file);
                      };
                      input.click();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                    type="button"
                  >
                    <FolderOpenIcon className="w-4 h-4 text-blue-400" />
                    <span>파일에서 불러오기</span>
                  </button>

                  {/* 현재 모델 저장 (개인용) — 저장 옵션 모달(데이터 포함/제외·웹 등록·설명) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsMyWorkMenuOpen(false);
                      openSaveOptions("mywork");
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                    type="button"
                  >
                    <PlusIcon className="w-4 h-4 text-blue-400" />
                    <span>현재 모델 저장</span>
                  </button>

                  {/* 초기 화면으로 설정 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentModel = {
                        name: projectName || "My Model",
                        modules: modules.map((m) => ({
                          type: m.type,
                          position: m.position,
                          name: m.name,
                          parameters: m.parameters,
                        })),
                        connections: connections.map((c) => ({
                          fromModuleIndex: modules.findIndex(
                            (m) => m.id === c.from.moduleId
                          ),
                          fromPort: c.from.portName,
                          toModuleIndex: modules.findIndex(
                            (m) => m.id === c.to.moduleId
                          ),
                          toPort: c.to.portName,
                        })),
                      };
                      localStorage.setItem(
                        "initialModel",
                        JSON.stringify(currentModel)
                      );
                      addLog("SUCCESS", "초기 화면으로 설정되었습니다.");
                      setIsMyWorkMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                    type="button"
                  >
                    <StarIcon className="w-4 h-4 text-yellow-400" />
                    <span className="text-green-400">초기 화면으로 설정</span>
                  </button>

                  {/* 구분선 */}
                  <div className="border-b border-gray-700 my-1"></div>

                  {/* 저장된 모델 목록 */}
                  {myWorkModels && myWorkModels.length > 0 ? (
                    myWorkModels.map((saved: any) => (
                      <div key={saved.name} className="flex items-center group last:rounded-b-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSample(saved.name, "mywork");
                            setIsMyWorkMenuOpen(false);
                          }}
                          className="flex-1 text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer min-w-0"
                          type="button"
                        >
                          <span className="truncate block">{saved.name}</span>
                          {saved.modules && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {saved.modules.length}개 모듈
                            </span>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!window.confirm(`"${saved.name}"을 삭제하시겠습니까?`)) return;
                            const updatedModels = myWorkModels.filter((m: any) => m.name !== saved.name);
                            localStorage.setItem("myWorkModels", JSON.stringify(updatedModels));
                            setMyWorkModels(updatedModels);
                            addLog("SUCCESS", `모델 "${saved.name}"이 삭제되었습니다.`);
                          }}
                          className="px-2 py-2 text-gray-400 hover:text-red-400 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="삭제"
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-400 last:rounded-b-md">
                      저장된 모델이 없습니다
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            {/* 고급기능 실행/해제 버튼 (항상 표시) */}
            <button
              onClick={() => setIsAdvancedModalOpen(true)}
              className={`flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-0.5 md:py-1 text-[7px] md:text-xs rounded-md font-bold transition-colors flex-shrink-0 ${
                isAdvancedUnlocked
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
              title={isAdvancedUnlocked ? "고급기능 해제됨 (클릭하여 관리)" : "고급기능 실행 (비밀번호 필요)"}
            >
              <span aria-hidden>{isAdvancedUnlocked ? "🔓" : "🔒"}</span>
              <span className="whitespace-nowrap">
                {isAdvancedUnlocked ? "고급기능 해제됨" : "고급기능 실행"}
              </span>
            </button>
            {runHistory.length > 0 && (
              <button
                onClick={() => setShowRunHistory(true)}
                className="flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-0.5 md:py-1 text-[5px] md:text-[8px] bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-md font-semibold transition-colors flex-shrink-0"
                title="실행 히스토리 보기"
              >
                <span className="h-1.5 w-1.5 md:h-2.5 md:w-2.5 flex items-center justify-center text-[6px] md:text-[10px]">📋</span>
                <span className="whitespace-nowrap">히스토리</span>
                <span className="bg-blue-500 text-white text-[4px] md:text-[8px] rounded-full px-0.5 md:px-1 leading-tight">{runHistory.length}</span>
              </button>
            )}
            {isAdvancedUnlocked && (
            <>
            <button
              onClick={() => setIsCodePanelVisible((v) => {
                if (!v) setIsRightPanelVisible(false); // 코드 패널 열면 속성 패널 닫기
                return !v;
              })}
              className={`flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-0.5 md:py-1 text-[5px] md:text-[8px] bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-md font-semibold transition-colors flex-shrink-0 ${ADVANCED_BTN_DIM}`}
              title="전체 파이프라인 코드 보기 (고급기능)"
            >
              <AdvancedLockBadge className="text-[6px] md:text-[9px] leading-none" />
              <CodeBracketIcon className="h-1.5 w-1.5 md:h-2.5 md:w-2.5" />
              <span className="whitespace-nowrap">전체 코드</span>
            </button>
            <button
              onClick={() => setIsGoalModalOpen(true)}
              className={`flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-0.5 md:py-1 text-[5px] md:text-[8px] bg-purple-600 dark:bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-700 text-white rounded-md font-semibold transition-colors flex-shrink-0 ${ADVANCED_BTN_DIM}`}
              title="목표로부터 파이프라인 자동 생성 (고급기능)"
            >
              <AdvancedLockBadge className="text-[6px] md:text-[9px] leading-none" />
              <SparklesIcon className="h-1.5 w-1.5 md:h-2.5 md:w-2.5" />
              <span className="whitespace-nowrap">
                AI로 파이프라인 생성하기
              </span>
            </button>
            <button
              onClick={() => setIsDataModalOpen(true)}
              className={`flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-0.5 md:py-1 text-[5px] md:text-[8px] bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-700 text-white rounded-md font-semibold transition-colors flex-shrink-0 ${ADVANCED_BTN_DIM}`}
              title="데이터로부터 파이프라인 자동 생성 (고급기능)"
            >
              <AdvancedLockBadge className="text-[6px] md:text-[9px] leading-none" />
              <SparklesIcon className="h-1.5 w-1.5 md:h-2.5 md:w-2.5" />
              <span className="whitespace-nowrap">
                AI로 데이터 분석 실행하기
              </span>
            </button>
            <button
              onClick={handleGeneratePPTs}
              disabled={isGeneratingPPTs || modules.length === 0}
              className={`flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-0.5 md:py-1 text-[7px] md:text-xs rounded-md font-bold transition-colors flex-shrink-0 ${
                isGeneratingPPTs || modules.length === 0
                  ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-50"
                  : "bg-blue-600 dark:bg-blue-600 hover:bg-blue-500 dark:hover:bg-blue-500"
              } text-white ${ADVANCED_BTN_DIM}`}
              title="모든 모듈 PPT 생성 (고급기능)"
            >
              <AdvancedLockBadge className="text-[7px] md:text-[10px] leading-none" />
              {isGeneratingPPTs ? (
                <ArrowPathIcon className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isGeneratingPPTs ? "생성 중..." : "PPT 생성"}
              </span>
            </button>
            </>
            )}
            <button
              onClick={handleToggleRightPanel}
              className="p-1 md:p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
              title="속성 패널 열기/닫기"
            >
              <CogIcon className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-grow min-h-0 relative flex flex-col">
        {/* Canvas tabs: click to switch, double-click to rename, + to add */}
        <div className="flex items-center gap-0 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-x-auto scrollbar-hide min-h-0 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTabId(tab.id);
                setEditingTabName(tab.name);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTabContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
              className={`flex items-center min-w-0 max-w-[140px] px-2 py-1 cursor-pointer border-r border-gray-300 dark:border-gray-600 select-none ${
                tab.backgroundColor
                  ? (activeTabId === tab.id ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-700 dark:text-gray-300 hover:opacity-90")
                  : (activeTabId === tab.id ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 font-semibold" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700")
              }`}
              style={tab.backgroundColor ? { backgroundColor: tab.backgroundColor } : undefined}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={() => handleTabRename(tab.id, editingTabName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleTabRename(tab.id, editingTabName);
                    }
                    if (e.key === "Escape") {
                      setEditingTabName(tab.name);
                      setEditingTabId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent border border-blue-500 rounded px-1 py-0.5 text-xs text-gray-900 dark:text-white focus:outline-none"
                  autoFocus
                />
              ) : (
                <span className="truncate text-xs">{tab.name}</span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAddTab();
            }}
            className="flex-shrink-0 p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="탭 추가"
            aria-label="탭 추가"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          {tabContextMenu && (
            <div
              ref={tabContextMenuRef}
              className="fixed z-[9999] min-w-[140px] py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg"
              style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            >
              <button
                type="button"
                onClick={() => {
                  const tab = tabs.find((t) => t.id === tabContextMenu.tabId);
                  if (tab) {
                    setEditingTabId(tab.id);
                    setEditingTabName(tab.name);
                    setTabContextMenu(null);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                이름 바꾸기
              </button>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">배경색</div>
              <div className="flex flex-wrap gap-1 px-2 pb-1">
                {[
                  { label: "기본", value: undefined },
                  { label: "흰색", value: "#ffffff" },
                  { label: "회색", value: "#9ca3af" },
                  { label: "검정", value: "#111827" },
                  { label: "파란", value: "#3b82f6" },
                  { label: "빨간", value: "#ef4444" },
                ].map(({ label, value }) => (
                  <button
                    key={value ?? "default"}
                    type="button"
                    onClick={() => handleTabBackgroundColor(tabContextMenu.tabId, value)}
                    className={`px-2 py-1 text-xs rounded border ${
                      value ? "" : "border-gray-300 dark:border-gray-600"
                    } hover:bg-gray-100 dark:hover:bg-gray-700`}
                    style={value ? { backgroundColor: value } : undefined}
                    title={value ?? "테마 기본"}
                  >
                    {label ?? ""}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <button
                type="button"
                onClick={() => handleDeleteTab(tabContextMenu.tabId)}
                disabled={tabs.length <= 1}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                탭 삭제
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-1 min-h-0 min-w-0">
          {/* Left module panel (Toolbox) - below tabs */}
          <div
            className={`flex-shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-in-out ${
              isLeftPanelVisible ? "w-56" : "w-0"
            }`}
          >
            <div className="w-56 h-full overflow-y-auto border-r border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
              <Toolbox
                onModuleDoubleClick={handleModuleToolboxDoubleClick}
                onFontSizeChange={handleFontSizeChange}
              />
            </div>
          </div>
          <main
            ref={canvasContainerRef}
            className={`flex-1 min-h-0 min-w-0 relative overflow-hidden ${theme === "dark" ? "canvas-bg" : "canvas-bg-light"}`}
            onDragOver={(e) => {
              if (e.dataTransfer.files.length > 0 || Array.from(e.dataTransfer.items).some((item) => item.kind === "file")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={handleFileDrop}
          >
          <Canvas
            modules={modules}
            connections={connections}
            setConnections={setConnections}
            selectedModuleIds={selectedModuleIds}
            setSelectedModuleIds={setSelectedModuleIds}
            updateModulePositions={updateModulePositions}
            onModuleDrop={createModule}
            scale={scale}
            setScale={setScale}
            pan={pan}
            setPan={setPan}
            canvasContainerRef={canvasContainerRef}
            onViewDetails={handleViewDetails}
            onModuleDoubleClick={handleModuleDoubleClick}
            onRunModule={(moduleId) => runSimulation(moduleId, false)}
            onDeleteModule={(id) => deleteModules([id])}
            onUpdateModuleName={updateModuleName}
            onUpdateModule={updateModule}
            suggestion={suggestion}
            onAcceptSuggestion={acceptSuggestion}
            onClearSuggestion={clearSuggestion}
            onStartSuggestion={handleSuggestModule}
            areUpstreamModulesReady={areUpstreamModulesReady}
          />
          <CanvasMinimap
            modules={modules}
            pan={pan}
            scale={scale}
            containerWidth={canvasContainerRef.current?.clientWidth ?? 800}
            containerHeight={canvasContainerRef.current?.clientHeight ?? 600}
            onPanTo={setPan}
          />
          <div
            onMouseDown={handleControlPanelMouseDown}
            style={{
              position: "fixed",
              left: controlPanelPos ? `${controlPanelPos.x}px` : "50%",
              bottom: controlPanelPos ? "auto" : "2rem",
              top: controlPanelPos ? `${controlPanelPos.y}px` : "auto",
              transform: controlPanelPos ? "none" : "translateX(-50%)",
              cursor: isDraggingControlPanel.current ? "grabbing" : "grab",
              pointerEvents: "auto",
            }}
            className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-3 shadow-2xl z-[100] border border-gray-300 dark:border-gray-700 select-none transition-none active:scale-95"
          >
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  adjustScale(-0.1);
                }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="축소"
              >
                <MinusIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="px-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white min-w-[2.5rem] text-center"
                title="뷰 초기화"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  adjustScale(0.1);
                }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="확대"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-3 bg-gray-300 dark:bg-gray-700"></div>

            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFitToView();
                }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="화면에 맞추기"
              >
                <ArrowsPointingOutIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRearrangeModules();
                }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="자동 레이아웃"
              >
                <SparklesIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
        </div>

        {/* -- Unified Side Panels -- */}
        {/* Code Panel - Rightmost */}
        <ErrorBoundary>
          <PipelineCodePanel
            modules={modules}
            connections={connections}
            isVisible={isCodePanelVisible}
            onToggle={() => setIsCodePanelVisible((v) => {
              if (!v) setIsRightPanelVisible(false);
              return !v;
            })}
          />
        </ErrorBoundary>

        <div
          className={`absolute top-0 right-0 h-full z-10 transition-transform duration-300 ease-in-out ${
            isRightPanelVisible ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div
            className="flex h-full"
            style={{ width: `${rightPanelWidth}px` }}
          >
            <div
              onMouseDown={handleResizeMouseDown}
              className="flex-shrink-0 w-1.5 cursor-col-resize bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 transition-colors"
              title="패널 크기 조정"
            />
            <div className="flex-grow h-full min-w-0">
              <PropertiesPanel
                module={selectedModule}
                projectName={projectName}
                updateModuleParameters={updateModuleParameters}
                updateModuleName={updateModuleName}
                onUpdateNotes={updateModuleNotes}
                logs={terminalLogs}
                modules={modules}
                connections={connections}
                activeTab={activePropertiesTab}
                setActiveTab={setActivePropertiesTab}
                onViewDetails={handleViewDetails}
                folderHandle={folderHandleRef.current}
                onRunModule={(moduleId) => runSimulation(moduleId, false)}
                validationError={selectedModule ? validateModuleParameters(selectedModule) : null}
              />
            </div>
          </div>
        </div>
      </div>

      <AIPipelineFromGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSubmit={(goal) => {
          setIsGoalModalOpen(false);
          handleGeneratePipelineFromGoal(goal);
        }}
      />
      <AIPipelineFromDataModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onSubmit={(goal, fileContent, fileName) => {
          setIsDataModalOpen(false);
          handleGeneratePipelineFromData(goal, fileContent, fileName);
        }}
      />

      <AIPlanDisplayModal
        isOpen={!!aiPlan || isAiGenerating}
        onClose={() => {
          if (!isAiGenerating) {
            setAiPlan(null);
            setAiPipelineData(null);
          }
        }}
        plan={aiPlan || ""}
        onCreatePipeline={handleCreatePipelineFromAnalysis}
        hasPipelineData={!!aiPipelineData}
        isLoading={isAiGenerating}
      />
      <ErrorModal error={errorModal} onClose={() => setErrorModal(null)} />

      {/* -- Modals -- */}
      {(() => {
        const shouldShowModal =
          viewingDataForModule &&
          (viewingDataForModule.outputData?.type === "DataPreview" ||
            viewingDataForModule.outputData?.type === "KMeansOutput" ||
            viewingDataForModule.outputData?.type === "PCAOutput" ||
            viewingDataForModule.outputData?.type === "VIFCheckerOutput" ||
            viewingDataForModule.outputData?.type === "JMDCOutcomeOutput");

        if (shouldShowModal) {
          console.log(
            "Rendering DataPreviewModal for:",
            viewingDataForModule.id,
            viewingDataForModule.name,
            viewingDataForModule.outputData?.type
          );
        }

        return (
          shouldShowModal && (
            <ErrorBoundary>
              <DataPreviewModal
                module={viewingDataForModule}
                projectName={projectName}
                onClose={handleCloseModal}
                modules={modules}
                connections={connections}
              />
            </ErrorBoundary>
          )
        );
      })()}
      {viewingDataForModule &&
        viewingDataForModule.outputData?.type === "StatisticsOutput" && (
          <ErrorBoundary>
            <StatisticsPreviewModal
              module={viewingDataForModule}
              projectName={projectName}
              onClose={handleCloseModal}
            />
          </ErrorBoundary>
        )}
      {viewingSplitDataForModule && (
        <SplitDataPreviewModal
          module={viewingSplitDataForModule}
          onClose={handleCloseModal}
        />
      )}
      {viewingTrainedModel && (
        <TrainedModelPreviewModal
          module={viewingTrainedModel}
          projectName={projectName}
          onClose={handleCloseModal}
        />
      )}
      {viewingStatsModelsResult && (
        <StatsModelsResultPreviewModal
          module={viewingStatsModelsResult}
          projectName={projectName}
          onClose={handleCloseModal}
        />
      )}
      {viewingDiversionChecker && (
        <DiversionCheckerPreviewModal
          module={viewingDiversionChecker}
          projectName={projectName}
          onClose={handleCloseModal}
        />
      )}
      {viewingEvaluateStat && (
        <EvaluateStatPreviewModal
          module={viewingEvaluateStat}
          projectName={projectName}
          onClose={handleCloseModal}
        />
      )}
      {viewingXoLPrice && (
        <XoLPricePreviewModal
          module={viewingXoLPrice}
          onClose={handleCloseModal}
        />
      )}
      {viewingFinalXolPrice && (
        <FinalXolPricePreviewModal
          module={viewingFinalXolPrice}
          onClose={handleCloseModal}
        />
      )}
      {viewingPredictModel && (
        <PredictModelPreviewModal
          module={viewingPredictModel}
          projectName={projectName}
          onClose={handleCloseModal}
          modules={modules}
          connections={connections}
        />
      )}
      {viewingColumnPlot && (
        <ColumnPlotPreviewModal
          module={viewingColumnPlot}
          projectName={projectName}
          onClose={handleCloseModal}
          modules={modules}
          connections={connections}
        />
      )}
      {viewingOutlierDetector &&
        (() => {
          const currentModule = modules.find(
            (m) => m.id === viewingOutlierDetector.id
          );
          if (!currentModule) return null;

          return (
            <OutlierDetectorPreviewModal
              module={currentModule}
              projectName={projectName}
              onClose={handleCloseModal}
              onRemoveOutliers={(column: string, indices: number[]) => {
                // 이상치 제거 처리
                const module = modules.find(
                  (m) => m.id === viewingOutlierDetector.id
                );
                if (
                  !module ||
                  !module.outputData ||
                  module.outputData.type !== "OutlierDetectorOutput"
                )
                  return;

                const output = module.outputData;
                const outlierIndicesSet = new Set(indices);

                // 해당 열의 이상치 인덱스 업데이트
                const updatedColumnResults = output.columnResults.map((cr) => {
                  if (cr.column === column) {
                    const newOutlierIndices = cr.outlierIndices.filter(
                      (idx) => !outlierIndicesSet.has(idx)
                    );
                    // 각 방법별 결과도 업데이트
                    const updatedResults = cr.results.map((r) => {
                      const filteredIndices = r.outlierIndices.filter(
                        (idx) => !outlierIndicesSet.has(idx)
                      );
                      return {
                        ...r,
                        outlierIndices: filteredIndices,
                        outlierCount: filteredIndices.length,
                        outlierPercentage: output.originalData
                          ? (filteredIndices.length /
                              output.originalData.length) *
                            100
                          : 0,
                      };
                    });
                    return {
                      ...cr,
                      results: updatedResults,
                      totalOutliers: newOutlierIndices.length,
                      outlierIndices: newOutlierIndices,
                    };
                  }
                  return cr;
                });

                // 모든 열에서 제거된 이상치를 제외한 전체 이상치 인덱스 재계산
                const newAllOutlierIndicesSet = new Set<number>();
                updatedColumnResults.forEach((cr) => {
                  cr.outlierIndices.forEach((idx) =>
                    newAllOutlierIndicesSet.add(idx)
                  );
                });
                const newAllOutlierIndices = Array.from(
                  newAllOutlierIndicesSet
                ).sort((a, b) => a - b);

                // 제거된 행을 제외한 전체 테이블 생성
                const originalRows = output.originalData || [];
                const cleanedRows = originalRows.filter(
                  (_, idx) => !outlierIndicesSet.has(idx)
                );

                // 원본 데이터에서 입력 데이터 구조 가져오기
                const inputData = getSingleInputData(
                  viewingOutlierDetector.id
                ) as DataPreview;
                if (!inputData) return;

                // OutlierDetectorOutput 업데이트 (View Details용)
                const updatedOutput: OutlierDetectorOutput = {
                  ...output,
                  columnResults: updatedColumnResults,
                  totalOutliers: newAllOutlierIndices.length,
                  allOutlierIndices: newAllOutlierIndices,
                  cleanedData: cleanedRows,
                  originalData: originalRows, // 원본 데이터 유지
                };

                // 모듈의 출력을 DataPreview로 변경하여 다음 모듈로 전달 가능하도록
                const newOutputDataPreview: DataPreview = {
                  type: "DataPreview",
                  columns: inputData.columns,
                  totalRowCount: cleanedRows.length,
                  rows: cleanedRows,
                };

                // 모듈 업데이트 - outputData를 DataPreview로 설정하여 다음 모듈로 전달
                // View Details를 위해 parameters에 OutlierDetectorOutput 정보도 저장
                updateModule(viewingOutlierDetector.id, {
                  ...module,
                  outputData: newOutputDataPreview,
                  parameters: {
                    ...module.parameters,
                    _outlierOutput: updatedOutput, // View Details를 위해 저장
                  },
                });

                addLog(
                  "SUCCESS",
                  `이상치 ${indices.length}개 행 제거 완료. 출력 테이블 업데이트됨 (${cleanedRows.length}행).`
                );
              }}
              onUpdateData={(data: Record<string, any>[]) => {
                // 데이터 업데이트
                const module = modules.find(
                  (m) => m.id === viewingOutlierDetector.id
                );
                if (!module) return;

                const inputData = getSingleInputData(
                  viewingOutlierDetector.id
                ) as DataPreview;
                if (inputData) {
                  const newOutputDataPreview: DataPreview = {
                    type: "DataPreview",
                    columns: inputData.columns,
                    totalRowCount: data.length,
                    rows: data,
                  };

                  updateModule(viewingOutlierDetector.id, {
                    ...module,
                    outputData: newOutputDataPreview,
                  });
                }
              }}
            />
          );
        })()}
      {viewingHypothesisTesting && (
        <HypothesisTestingPreviewModal
          module={viewingHypothesisTesting}
          projectName={projectName}
          onClose={handleCloseModal}
        />
      )}
      {viewingNormalityChecker && (
        <NormalityCheckerPreviewModal
          module={viewingNormalityChecker}
          projectName={projectName}
          onClose={handleCloseModal}
        />
      )}
      {viewingCorrelation && (
        <CorrelationPreviewModal
          module={viewingCorrelation}
          projectName={projectName}
          onClose={handleCloseModal}
        />
      )}
      {viewingTrainedClusteringModel && (
        <TrainedClusteringModelPreviewModal
          module={viewingTrainedClusteringModel}
          projectName={projectName}
          onClose={handleCloseModal}
          modules={modules}
          connections={connections}
        />
      )}
      {viewingClusteringData && (
        <ClusteringDataPreviewModal
          module={viewingClusteringData}
          projectName={projectName}
          onClose={handleCloseModal}
          modules={modules}
          connections={connections}
        />
      )}
      {viewingJMDCCohort && (
        <ErrorBoundary>
          <JMDCCohortPreviewModal
            module={viewingJMDCCohort}
            projectName={projectName}
            onClose={handleCloseModal}
          />
        </ErrorBoundary>
      )}
      {viewingJMDCIncidence && (
        <ErrorBoundary>
          <JMDCIncidencePreviewModal
            module={viewingJMDCIncidence}
            projectName={projectName}
            onClose={handleCloseModal}
          />
        </ErrorBoundary>
      )}
      {viewingJMDCSurvival && (
        <ErrorBoundary>
          <JMDCSurvivalPreviewModal
            module={viewingJMDCSurvival}
            projectName={projectName}
            onClose={handleCloseModal}
          />
        </ErrorBoundary>
      )}
      {viewingJMDCCox && (
        <ErrorBoundary>
          <JMDCCoxPreviewModal
            module={viewingJMDCCox}
            projectName={projectName}
            onClose={handleCloseModal}
          />
        </ErrorBoundary>
      )}
      {viewingJMDCMatcher && (
        <ErrorBoundary>
          <JMDCMatcherPreviewModal
            module={viewingJMDCMatcher}
            projectName={projectName}
            onClose={handleCloseModal}
          />
        </ErrorBoundary>
      )}
      {viewingEvaluation &&
        (() => {
          // 최신 모듈 상태를 가져와서 모달에 전달
          const latestModule =
            modules.find((m) => m.id === viewingEvaluation.id) ||
            viewingEvaluation;
          return (
            <EvaluationPreviewModal
              module={latestModule}
              onClose={handleCloseModal}
              modules={modules}
              connections={connections}
              onThresholdChange={async (moduleId, newThreshold) => {
                // threshold 변경 시 파라미터만 업데이트 (재계산하지 않음)
                addLog(
                  "INFO",
                  `Evaluate Model threshold 변경: ${newThreshold.toFixed(
                    2
                  )} (재계산 없음)`
                );

                // threshold를 명시적으로 설정 (재계산하지 않음)
                setModules(
                  (prev) =>
                    prev.map((m) => {
                      if (m.id === moduleId) {
                        const updated = {
                          ...m,
                          parameters: {
                            ...m.parameters,
                            threshold: newThreshold,
                          },
                        };
                        addLog(
                          "INFO",
                          `Evaluate Model [${m.name}] threshold 업데이트: ${updated.parameters.threshold}`
                        );
                        return updated;
                      }
                      return m;
                    }),
                  true
                );
              }}
            />
          );
        })()}

      {/* 모델 분석보고서 미리보기 (열람은 게이트 없음) */}
      {viewingModelReport && (
        <ModelReportPreviewModal
          module={
            modules.find((m) => m.id === viewingModelReport.id) ||
            viewingModelReport
          }
          onClose={handleCloseModal}
        />
      )}

      {/* C-2: 모델 비교 모달 */}
      {showModelComparison && (
        <ModelComparisonModal
          modules={modules}
          onClose={() => setShowModelComparison(false)}
        />
      )}

      {/* 실행 히스토리 모달 */}
      {showRunHistory && (
        <RunHistoryModal
          sessions={runHistory}
          onClose={() => setShowRunHistory(false)}
        />
      )}

      {/* 단축키 안내 모달 */}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* AI 설정 (Claude API 키) 모달 */}
      {isApiKeyModalOpen && (
        <ApiKeySettingsModal onClose={() => setIsApiKeyModalOpen(false)} />
      )}

      {/* 고급기능 잠금 해제 모달 */}
      {isAdvancedModalOpen && (
        <AdvancedUnlockModal onClose={() => setIsAdvancedModalOpen(false)} />
      )}

      {/* 모델 저장 옵션 모달 (데이터 포함/제외·웹 등록·설명) */}
      <SaveModelOptionsModal
        isOpen={saveOptions.open}
        title={saveOptions.mode === "sample" ? "Sample로 저장" : "내 작업으로 저장"}
        defaultName={saveOptions.name}
        loaders={saveOptions.loaders}
        embedLimitMB={EMBED_SIZE_LIMIT_MB}
        isSaving={isSavingModel}
        onConfirm={performModelSave}
        onClose={() => setSaveOptions((s) => ({ ...s, open: false }))}
      />

      {/* Samples Modal */}
      <SamplesModal
        isOpen={isSampleMenuOpen}
        onClose={() => setIsSampleMenuOpen(false)}
        samples={folderSamples}
        onLoadSample={(sampleName, filename, sampleId) => {
          handleLoadSample(sampleName, "folder", filename, sampleId);
        }}
        onRefresh={loadFolderSamplesLocal}
        isLoading={isLoadingSamples}
      />

      {/* Samples Management Modal */}
      <SamplesManagementModal
        isOpen={isSamplesManagementOpen}
        onClose={() => setIsSamplesManagementOpen(false)}
        onRefresh={() => {
          loadFolderSamplesLocal();
        }}
      />
    </div>
  );
};

export default App;
