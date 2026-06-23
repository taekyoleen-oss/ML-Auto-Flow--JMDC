import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  CanvasModule,
  ModuleType,
  ModuleStatus,
  StatisticsOutput,
  Connection,
  DataPreview,
  TrainedModelOutput,
  StatsModelsResultOutput,
  EvaluationOutput,
  ColumnInfo,
  SplitDataOutput,
  MissingHandlerOutput,
  EncoderOutput,
  NormalizerOutput,
  OutlierDetectorOutput,
  VIFCheckerOutput,
} from "../types";
import {
  PlayIcon,
  TableCellsIcon,
  CommandLineIcon,
  CogIcon,
  CodeBracketIcon,
  InformationCircleIcon,
  SparklesIcon,
  ClipboardIcon,
  CheckIcon,
  ArrowDownTrayIcon,
} from "./icons";
import { getModuleCode } from "../codeSnippets";
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from "../contexts/AdvancedFeatureContext";
// Examples_in_Load 디렉토리에서 예제 데이터를 로드하는 함수는 아래에서 정의
import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiClient } from '../lib/aiClient';
import { DEFAULT_MODULES } from "../constants";
import { ExcelInputModal } from "./ExcelInputModal";
import { DataAnalysisRAGModal } from "./DataAnalysisRAGModal";
import { ModuleDescriptionModal } from "./ModuleDescriptionModal";
import { useTheme } from "../contexts/ThemeContext";
import { cacheFileContent, listCachedFiles, getCachedFileContent } from "../utils/fileContentCache";

// Dynamic import for xlsx to handle module resolution issues
let XLSX: any = null;
const loadXLSX = async () => {
  if (!XLSX) {
    XLSX = await import("xlsx");
  }
  return XLSX;
};

type TerminalLog = {
  id: number;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  message: string;
  timestamp: string;
};

interface PropertiesPanelProps {
  module: CanvasModule | null;
  projectName: string;
  updateModuleParameters: (id: string, newParams: Record<string, any>) => void;
  updateModuleName: (id: string, newName: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  logs: TerminalLog[];
  modules: CanvasModule[];
  connections: Connection[];
  activeTab: "properties" | "preview" | "code" | "terminal";
  setActiveTab: (tab: "properties" | "preview" | "code" | "terminal") => void;
  onViewDetails: (moduleId: string) => void;
  folderHandle: FileSystemDirectoryHandle | null;
  onRunModule?: (moduleId: string) => void;
  validationError?: string | null;
}

const ExplanationRenderer: React.FC<{ text: string }> = ({ text }) => {
  const renderLine = (line: string) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const codeRegex = /`([^`]+)`/g;
    const parts = [];
    let lastIndex = 0;
    let result;

    const combinedRegex = new RegExp(
      `(${boldRegex.source})|(${codeRegex.source})`,
      "g"
    );

    while ((result = combinedRegex.exec(line)) !== null) {
      // Text before the match
      if (result.index > lastIndex) {
        parts.push(line.substring(lastIndex, result.index));
      }
      // Matched part
      if (result[2]) {
        // Bold
        parts.push(<strong key={result.index}>{result[2]}</strong>);
      } else if (result[4]) {
        // Code
        parts.push(
          <code
            key={result.index}
            className="bg-gray-200 dark:bg-gray-700 text-purple-600 dark:text-purple-300 px-1 py-0.5 rounded text-xs"
          >
            {result[4]}
          </code>
        );
      }
      lastIndex = combinedRegex.lastIndex;
    }

    // Text after the last match
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : <>{line}</>;
  };

  return (
    <div className="text-gray-700 dark:text-gray-300 space-y-2 text-sm">
      {text.split("\n").map((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("### ")) {
          return (
            <h4
              key={index}
              className="text-md font-semibold mt-3 mb-1 text-gray-800 dark:text-gray-200"
            >
              {renderLine(trimmedLine.substring(4))}
            </h4>
          );
        }
        if (trimmedLine.startsWith("## ")) {
          return (
            <h3
              key={index}
              className="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100"
            >
              {renderLine(trimmedLine.substring(3))}
            </h3>
          );
        }
        if (trimmedLine.startsWith("* ")) {
          return (
            <div key={index} className="flex items-start pl-2">
              <span className="mr-2 mt-1">•</span>
              <div className="flex-1">
                {renderLine(trimmedLine.substring(2))}
              </div>
            </div>
          );
        }
        if (trimmedLine === "") {
          return null;
        }
        return <p key={index}>{renderLine(line)}</p>;
      })}
    </div>
  );
};

const AIModuleExplanation: React.FC<{ module: CanvasModule }> = ({
  module,
}) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handleExplain = async () => {
    if (explanation) {
      setShow(!show);
      return;
    }
    setIsLoading(true);
    setShow(true);
    try {
      const ai = getGeminiClient();

      const defaultModuleData = DEFAULT_MODULES.find(
        (m) => m.type === module.type
      );
      const defaultParams = defaultModuleData
        ? defaultModuleData.parameters
        : {};

      const paramDetails = Object.keys(module.parameters)
        .map((key) => {
          const currentValue = module.parameters[key];
          const defaultValue = defaultParams[key];
          return `- **${key}**: (현재 값: \`${JSON.stringify(
            currentValue
          )}\`, 기본값: \`${JSON.stringify(defaultValue)}\`)`;
        })
        .join("\n");

      let optionsContext = "";
      if (
        module.type === ModuleType.ScalingTransform &&
        "method" in module.parameters
      ) {
        optionsContext =
          "\n\n**옵션 컨텍스트:**\n'method' 파라미터는 ['MinMax', 'StandardScaler', 'RobustScaler'] 옵션을 가집니다. 각 옵션의 차이점을 설명해 주세요.";
      } else if (
        module.type === ModuleType.SplitData &&
        "shuffle" in module.parameters
      ) {
        optionsContext =
          "\n\n**옵션 컨텍스트:**\n'shuffle'과 'stratify' 파라미터는 ['True', 'False'] 옵션을 가집니다. 각 옵션이 언제 사용되는지 설명해 주세요.";
      } else if (
        module.type === ModuleType.StatModels &&
        "model" in module.parameters
      ) {
        optionsContext =
          "\n\n**옵션 컨텍스트:**\n'model' 파라미터는 ['OLS', 'Logit', 'Poisson', 'NegativeBinomial', 'Gamma', 'Tweedie'] 옵션을 가집니다. 각 모델의 용도를 간략히 설명해 주세요.";
      }

      const prompt = `
당신은 머신러닝 파이프라인 도구를 위한 전문 AI 어시스턴트입니다. 주어진 모듈과 파라미터에 대해 한국어로 명확하고 유용한 설명을 간단한 마크다운 형식으로 제공해야 합니다.

**모듈:** \`${module.type}\`

### 모듈의 목적
(이 모듈이 무엇을 하는지, 어떤 문제를 해결하는지 한두 문장으로 설명해 주세요.)

### 파라미터 상세 정보
${paramDetails}
${optionsContext}

---
**요청사항:**
위 정보를 바탕으로, 각 파라미터에 대해 아래 형식을 사용하여 상세한 설명을 생성해 주세요.

*   **\`파라미터명\`**
    *   **설명:** 이 파라미터의 역할과 중요성을 설명합니다.
    *   **추천:** 일반적인 사용 사례나 추천하는 값 또는 값의 범위를 제시합니다. (예: "일반적으로 0.7 또는 0.8을 사용합니다.")
    *   **옵션:** (선택 가능한 옵션이 있는 경우) 각 옵션의 의미와 장단점, 그리고 어떤 상황에 사용해야 하는지 설명합니다.

전체적으로 초보자도 이해하기 쉽게, 간결하면서도 정보를 충분히 담아 작성해 주세요.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      setExplanation(response.text);
    } catch (error) {
      console.error("AI explanation failed:", error);
      setExplanation("설명을 생성하는 데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdvancedOnly>
    <div className="mt-4 border-t border-gray-700 pt-3">
      <button
        onClick={handleExplain}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-md font-semibold text-white transition-colors ${ADVANCED_BTN_DIM}`}
      >
        <AdvancedLockBadge />
        <SparklesIcon className="h-4 w-4" />
        {isLoading
          ? "생성 중..."
          : show && explanation
          ? "설명 숨기기"
          : "AI로 파라미터 설명 보기"}
      </button>
      {show && (
        <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          {isLoading && (
            <p className="text-sm text-gray-700 dark:text-gray-400">
              AI 설명을 생성하고 있습니다...
            </p>
          )}
          {explanation && <ExplanationRenderer text={explanation} />}
        </div>
      )}
    </div>
    </AdvancedOnly>
  );
};

const AIParameterRecommender: React.FC<{
  module: CanvasModule;
  inputColumns: string[];
  projectName: string;
  updateModuleParameters: (id: string, newParams: Record<string, any>) => void;
}> = ({ module, inputColumns, projectName, updateModuleParameters }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRecommend = async () => {
    setIsLoading(true);
    try {
      const ai = getGeminiClient();

      const prompt = `
You are an expert data scientist AI assistant. Your task is to recommend the optimal feature columns and a single label/target column for a machine learning model based on a project goal and a list of available data columns.

### Project Goal
"${projectName}"

### Available Columns
- ${inputColumns.join("\n- ")}

### Instructions
1.  Analyze the project goal and column names to infer the prediction target.
2.  Identify the column that is most likely the **label column** (the variable to be predicted).
3.  Select a set of columns that would be good **feature columns** (input variables for the model). Exclude the label column and any columns that seem irrelevant or are identifiers.
4.  Provide your response *only* in a valid JSON format. The JSON object must contain two keys:
    - \`label_column\`: A string with the name of the single recommended label column.
    - \`feature_columns\`: An array of strings with the names of the recommended feature columns.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feature_columns: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              label_column: { type: Type.STRING },
            },
          },
        },
      });

      const resultJson = JSON.parse(response.text);

      if (resultJson.feature_columns && resultJson.label_column) {
        const validFeatures = resultJson.feature_columns.filter((col: string) =>
          inputColumns.includes(col)
        );
        const validLabel = inputColumns.includes(resultJson.label_column)
          ? resultJson.label_column
          : null;

        updateModuleParameters(module.id, {
          feature_columns: validFeatures,
          label_column: validLabel,
        });
      } else {
        throw new Error("Invalid JSON structure in AI response.");
      }
    } catch (error) {
      console.error("AI recommendation failed:", error);
      // Optionally, add user-facing error feedback here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdvancedOnly>
    <div className="mb-4">
      <button
        onClick={handleRecommend}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-md font-semibold text-white transition-colors ${ADVANCED_BTN_DIM}`}
      >
        <AdvancedLockBadge />
        <SparklesIcon className="h-4 w-4" />
        {isLoading ? "분석 중..." : "AI 추천"}
      </button>
    </div>
    </AdvancedOnly>
  );
};

const PropertyGroup: React.FC<{
  title: string;
  children: React.ReactNode;
  module: CanvasModule;
}> = ({ title, children, module }) => (
  <div className="mb-4">
    <h4 className="text-xs text-gray-700 dark:text-gray-500 uppercase font-bold mb-2">{title}</h4>
    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
      {children}
      <AIModuleExplanation module={module} />
    </div>
  </div>
);

const PropertyInput: React.FC<{
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: string;
  step?: string;
  placeholder?: string;
  description?: string;
}> = ({ label, value, onChange, type = "text", step, placeholder, description }) => (
  <div className="mb-3 last:mb-0">
    <label className="block text-sm text-gray-700 dark:text-gray-400 mb-1">{label}</label>
    <input
      type={type}
      value={value === null || value === undefined ? "" : value}
      step={step}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(
          e.target.value === ""
            ? undefined
            : type === "number"
            ? parseFloat(e.target.value)
            : e.target.value
        )
      }
      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {description && (
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-snug">{description}</p>
    )}
  </div>
);

const PropertySelect: React.FC<{
  label: string;
  value: any;
  onChange: (value: string) => void;
  options: (string | { label: string; value: string; description?: string })[];
  description?: string;
}> = ({ label, value, onChange, options, description }) => {
  const selected = options.find(
    (opt) => (typeof opt === "string" ? opt : opt.value) === value
  );
  const selectedDescription =
    typeof selected === "object" ? selected?.description : undefined;
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-sm text-gray-700 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((opt) => {
          const optionValue = typeof opt === "string" ? opt : opt.value;
          const optionLabel = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
      {(selectedDescription || description) && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-snug">
          {selectedDescription || description}
        </p>
      )}
    </div>
  );
};

const PropertyCheckbox: React.FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="mb-3 last:mb-0">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700 dark:text-gray-400">{label}</span>
    </label>
  </div>
);

const PropertyDisplay: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="mb-3 last:mb-0">
    <label className="block text-sm text-gray-700 dark:text-gray-400 mb-1">{label}</label>
    <div className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">
      {value}
    </div>
  </div>
);

// Helper function to get connected data source, used in renderParameters and PropertiesPanel
const getConnectedDataSourceHelper = (
  moduleId: string,
  allModules: CanvasModule[],
  allConnections: Connection[],
  portNameToFind?: string
): DataPreview | undefined => {
  const portName = portNameToFind || "data_in";
  let inputConnection = allConnections.find(
    (c) => c && c.to && c.to.moduleId === moduleId && c.to.portName === portName
  );

  // Only perform fallback if no specific port was requested and the initial attempt failed
  if (!inputConnection && !portNameToFind) {
    // A safer fallback: find the first connection to any 'data' type port.
    inputConnection = allConnections.find((c) => {
      if (!c || !c.to) return false;
      if (c.to.moduleId === moduleId) {
        const targetModule = allModules.find((m) => m && m.id === moduleId);
        const targetPort = targetModule?.inputs.find(
          (p) => p.name === c.to.portName
        );
        return targetPort?.type === "data";
      }
      return false;
    });
  }

  if (
    !inputConnection ||
    !inputConnection.from ||
    !inputConnection.from.moduleId
  )
    return undefined;

  const sourceModule = allModules.find(
    (m) => m && m.id === inputConnection.from.moduleId
  );
  if (!sourceModule?.outputData) return undefined;

  if (sourceModule.outputData.type === "DataPreview") {
    return sourceModule.outputData;
  } else if (sourceModule.outputData.type === "SplitDataOutput") {
    const fromPortName = inputConnection.from?.portName;
    return fromPortName === "train_data_out"
      ? sourceModule.outputData.train
      : sourceModule.outputData.test;
  }
  return undefined;
};

const renderParameters = (
  module: CanvasModule,
  onParamChange: (key: string, value: any) => void,
  fileInputRef: React.RefObject<HTMLInputElement>,
  allModules: CanvasModule[],
  allConnections: Connection[],
  projectName: string,
  updateModuleParameters: (id: string, newParams: Record<string, any>) => void,
  onSampleLoad: (sample: { name: string; content: string }) => void,
  folderHandle: FileSystemDirectoryHandle | null,
  onOpenExcelModal?: () => void,
  onOpenRAGModal?: () => void,
  isLoadingExamples?: boolean,
  exampleDataList?: Array<{ name: string; content: string }>
) => {
  // Use the helper function
  const getConnectedDataSource = (moduleId: string, portNameToFind?: string) =>
    getConnectedDataSourceHelper(
      moduleId,
      allModules,
      allConnections,
      portNameToFind
    );

  switch (module.type) {
    // ... [Previous cases remain unchanged: LoadData, SelectData, HandleMissingValues, TransformData, EncodeCategorical, NormalizeData, TransitionData, ResampleData, SplitData] ...
    case ModuleType.LoadData:
    case ModuleType.XolLoading: {
      // 현재 데이터를 Example로 저장하는 함수
      const handleSaveAsExample = () => {
        if (
          !module ||
          !module.outputData ||
          module.outputData.type !== "DataPreview"
        ) {
          console.warn("No data available to save as example");
          alert("데이터를 먼저 로드하고 실행해주세요.");
          return;
        }

        try {
          const dataPreview = module.outputData as DataPreview;
          const columns = dataPreview.columns || [];
          const rows = dataPreview.rows || [];

          if (columns.length === 0 || rows.length === 0) {
            console.warn("No data to save");
            return;
          }

          // CSV 형식으로 변환
          const csvHeader = columns.map((col) => col.name).join(",");
          const csvRows = rows.map((row) =>
            columns
              .map((col) => {
              const value = row[col.name];
              // CSV 형식에 맞게 이스케이프 처리
                if (value === null || value === undefined) return "";
              const str = String(value);
                if (
                  str.includes(",") ||
                  str.includes('"') ||
                  str.includes("\n")
                ) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
              })
              .join(",")
          );

          const csvContent = [csvHeader, ...csvRows].join("\n");

          // CSV 파일로 다운로드
          const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const safeFilename = (module.name || "example")
            .replace(/[^a-zA-Z0-9가-힣\s]/g, "_")
            .replace(/\s+/g, "_");
          a.download = `${safeFilename}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          // 성공 메시지는 App.tsx의 addLog를 통해 표시되도록 하거나
          // 여기서 직접 표시할 수 있습니다
          console.log("Example CSV file downloaded successfully");
        } catch (error: any) {
          console.error("Failed to save example:", error);
        }
      };

      // 엑셀 파일을 CSV로 변환하는 함수
      const convertExcelToCSV = async (
        workbook: any,
        sheetName?: string
      ): Promise<string> => {
        const xlsx = await loadXLSX();
        const targetSheet = sheetName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[targetSheet];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          raw: false,
        });

        return jsonData
          .map((row: any) => {
            return row
              .map((cell: any) => {
                if (cell === null || cell === undefined) return "";
                const str = String(cell);
                if (
                  str.includes(",") ||
                  str.includes('"') ||
                  str.includes("\n")
                ) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              })
              .join(",");
          })
          .join("\n");
      };

      const handleBrowseClick = async () => {
        if (folderHandle && (window as any).showOpenFilePicker) {
          try {
            const [fileHandle] = await (window as any).showOpenFilePicker({
              startIn: folderHandle,
              types: [
                {
                  description: "CSV Files",
                  accept: { "text/csv": [".csv"] },
                },
                {
                  description: "Excel Files",
                  accept: {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                      [".xlsx"],
                    "application/vnd.ms-excel": [".xls"],
                  },
                },
              ],
            });
            const file = await fileHandle.getFile();
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
              // 엑셀 파일 처리
              const xlsx = await loadXLSX();
              const arrayBuffer = await file.arrayBuffer();
              const workbook = xlsx.read(arrayBuffer, { type: "array" });
              const firstSheetName = workbook.SheetNames[0];
              const csvContent = await convertExcelToCSV(
                workbook,
                firstSheetName
              );

              updateModuleParameters(module.id, {
                source: file.name,
                fileContent: csvContent,
                fileType: "excel",
                sheetName: firstSheetName,
                sourceType: "file",
              });
            } else {
              // CSV 파일 처리
              const reader = new FileReader();
              reader.onload = (e) => {
                const content = e.target?.result as string;
                updateModuleParameters(module.id, {
                  source: file.name,
                  fileContent: content,
                  fileType: "csv",
                  sourceType: "file",
                });
              };
              reader.readAsText(file);
            }
          } catch (error: any) {
            if (error.name !== "AbortError") {
              console.warn(
                "Could not use directory picker, falling back to default.",
                error
              );
              fileInputRef.current?.click();
            }
          }
        } else {
          fileInputRef.current?.click();
        }
      };

      // Phase 4: URL/원격 CSV 로더 — JS로 CSV 텍스트를 받아 업로드 파일과
      // 동일하게 fileContent에 저장한다. Pyodide 실행 경로는 변경 없음.
      const handleUrlLoad = async () => {
        const url = String(module.parameters.url || "").trim();
        if (!url) {
          alert("CSV 파일의 URL을 입력해주세요.");
          return;
        }
        if (!/^https?:\/\//i.test(url)) {
          alert("http:// 또는 https:// 로 시작하는 URL을 입력해주세요.");
          return;
        }
        try {
          updateModuleParameters(module.id, { urlLoading: true });
          let text: string | null = null;
          // 1차: 서버측 CORS 프록시 경유
          try {
            const proxied = await fetch(
              `/api/proxy-csv?url=${encodeURIComponent(url)}`
            );
            if (proxied.ok) {
              text = await proxied.text();
            }
          } catch {
            /* 프록시 실패 시 직접 fetch로 폴백 */
          }
          // 2차(폴백): 브라우저에서 직접 fetch (CORS 허용 서버 대상)
          if (text === null) {
            const direct = await fetch(url);
            if (!direct.ok) {
              throw new Error(`HTTP ${direct.status} ${direct.statusText}`);
            }
            text = await direct.text();
          }
          if (!text || !text.trim()) {
            throw new Error("빈 응답입니다(데이터가 없습니다).");
          }
          const fileName = (() => {
            try {
              const p = new URL(url).pathname;
              const base = p.substring(p.lastIndexOf("/") + 1);
              return base || url;
            } catch {
              return url;
            }
          })();
          cacheFileContent(fileName, text);
          // 업로드 파일과 동일한 파라미터 구조로 저장 → DataPreview 생성 경로 동일
          updateModuleParameters(module.id, {
            source: url,
            fileContent: text,
            fileType: "csv",
            sourceType: "url",
            sheetName: undefined,
            urlLoading: false,
          });
        } catch (error: any) {
          updateModuleParameters(module.id, { urlLoading: false });
          console.error("URL CSV 로드 실패:", error);
          alert(
            `URL에서 CSV를 불러오지 못했습니다.\n${
              error?.message || error
            }\n\n서버(포트 3002)가 실행 중인지, URL이 올바른지 확인해주세요.`
          );
        }
      };

      return (
        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-400 mb-1">Source</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={module.parameters.source}
              onChange={(e) => onParamChange("source", e.target.value)}
              className="flex-grow bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="No file selected"
            />
            <button
              onClick={handleBrowseClick}
              className="px-3 py-1.5 text-sm bg-gray-600 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500 rounded-md font-semibold text-white transition-colors"
            >
              Browse...
            </button>
          </div>
          {/* Phase 4: URL/원격 CSV 로더 (가산 기능, 기본 소스는 파일) */}
          <div className="mt-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              또는 URL에서 불러오기
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={module.parameters.url || ""}
                onChange={(e) => onParamChange("url", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUrlLoad();
                }}
                className="flex-grow bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/data.csv"
              />
              <button
                onClick={handleUrlLoad}
                disabled={!!module.parameters.urlLoading}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-semibold text-white transition-colors whitespace-nowrap"
              >
                {module.parameters.urlLoading ? "불러오는 중..." : "URL 로드"}
              </button>
            </div>
            {module.parameters.sourceType === "url" && (
              <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                URL 소스로 로드됨 · 내보낸 코드는 pd.read_csv(URL)을 사용합니다.
              </div>
            )}
          </div>
          {/* 파일 타입 표시 */}
          {module.parameters.fileType === "excel" &&
            module.parameters.sheetName && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-500">
                Excel Sheet: {module.parameters.sheetName}
              </div>
            )}
          {/* 다른 탭에서 로드된 파일 재사용 */}
          {(() => {
            const cached = listCachedFiles().filter(
              (f) => f !== module.parameters.source
            );
            if (cached.length === 0) return null;
            return (
              <div className="mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">다른 탭에서 불러온 파일:</p>
                <div className="flex flex-wrap gap-1">
                  {cached.map((fname) => (
                    <button
                      key={fname}
                      onClick={() => {
                        const content = getCachedFileContent(fname);
                        if (content) {
                          const isExcel = fname.endsWith('.xlsx') || fname.endsWith('.xls');
                          onParamChange('source', fname);
                          onParamChange('fileContent', content);
                          onParamChange('fileType', isExcel ? 'excel' : 'csv');
                          onParamChange('sourceType', 'file');
                        }
                      }}
                      className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors max-w-[180px] truncate"
                      title={`클릭하면 ${fname} 파일을 재사용합니다`}
                    >
                      ♻ {fname}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* 엑셀 데이터 직접 입력 버튼 */}
          <button
            onClick={() => {
              if (onOpenExcelModal) {
                onOpenExcelModal();
              }
            }}
            className="mt-2 px-3 py-1.5 text-sm bg-gray-600 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500 rounded-md font-semibold text-white transition-colors"
          >
            엑셀 데이터 직접 입력
          </button>
          <AdvancedOnly>
          <div className="mt-4">
            <button
              onClick={() => onOpenRAGModal?.()}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 rounded-md font-semibold text-white transition-colors ${ADVANCED_BTN_DIM}`}
            >
              <AdvancedLockBadge />
              <SparklesIcon className="h-4 w-4" />
              AI로 데이터 사전 분석하기
            </button>
          </div>
          </AdvancedOnly>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-gray-500 uppercase font-bold">
              Examples
            </h4>
              <button
                onClick={handleSaveAsExample}
                disabled={
                  !module.outputData || module.outputData.type !== "DataPreview"
                }
                className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                  !module.outputData || module.outputData.type !== "DataPreview"
                    ? "bg-gray-600 cursor-not-allowed opacity-50"
                    : "bg-green-600 hover:bg-green-700"
                } text-white`}
                title={
                  !module.outputData || module.outputData.type !== "DataPreview"
                    ? "Load and run data first to save as Example"
                    : "Save current data as Example CSV file"
                }
              >
                <ArrowDownTrayIcon className="h-3 w-3" />
                <span className="hidden sm:inline">Example로 저장</span>
                <span className="sm:hidden">저장</span>
              </button>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md space-y-1">
              {isLoadingExamples ? (
                <div className="px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 text-center">
                  Loading examples...
                </div>
              ) : (exampleDataList || []).length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 text-center">
                  No examples found
                </div>
              ) : (
                (exampleDataList || []).map((sample) => (
                  <div
                    key={sample.name}
                    onDoubleClick={() => onSampleLoad(sample)}
                    className="px-2 py-1.5 text-sm text-gray-900 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                    title="Double-click to load"
                  >
                    {sample.name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }
    case ModuleType.SelectData: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      // pandas dtype 목록 (파이썬 코드 기준)
      const availableDataTypes = [
        "int64",
        "int32",
        "int16",
        "int8",
        "float64",
        "float32",
        "object",
        "bool",
        "datetime64",
        "category",
      ];

      const currentSelections = module.parameters.columnSelections || {};

      // 입력 컬럼 타입을 그대로 사용 (이미 pandas dtype)
      const getPandasDtype = (colType: string): string => {
        return colType;
      };

      const handleSelectionChange = (
        colName: string,
        key: "selected" | "type",
        value: boolean | string
      ) => {
        const newSelections = {
          ...currentSelections,
          [colName]: {
            ...(currentSelections[colName] || {
              selected: true,
              type: getPandasDtype(
                inputColumns.find((c) => c.name === colName)?.type || "object"
              ),
            }),
            [key]: value,
          },
        };
        onParamChange("columnSelections", newSelections);
      };

      const handleSelectAll = (selectAll: boolean) => {
        const newSelections = { ...currentSelections };
        inputColumns.forEach((col) => {
          newSelections[col.name] = {
            ...(currentSelections[col.name] || {
              type: getPandasDtype(col.type),
            }),
            selected: selectAll,
          };
        });
        onParamChange("columnSelections", newSelections);
      };

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure columns.
          </p>
        );
      }

      return (
        <div className="flex flex-col">
          <div className="flex justify-end gap-2 mb-2">
            <button
              onClick={() => handleSelectAll(true)}
              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
            >
              Select All
            </button>
            <button
              onClick={() => handleSelectAll(false)}
              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
            >
              Deselect All
            </button>
          </div>
          <div className="space-y-2 pr-2">
            <div className="grid grid-cols-3 gap-2 items-center sticky top-0 bg-gray-100 dark:bg-gray-800 py-1">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-400 col-span-2">
                Column Name
              </span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-400">Data Type</span>
            </div>
            {inputColumns.map((col) => {
              // selection이 없으면 기본값으로 selected: true, type: pandas dtype 사용
              const selection = currentSelections[col.name];
              const isChecked = selection ? selection.selected : true;
              const columnType = selection
                ? selection.type
                : getPandasDtype(col.type);
              
              return (
                <div
                  key={col.name}
                  className="grid grid-cols-3 gap-2 items-center"
                >
                  <label
                    className="flex items-center gap-2 text-sm truncate col-span-2 text-gray-900 dark:text-white"
                    title={col.name}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        // 체크박스 변경 시 명시적으로 selected 값을 저장
                        handleSelectionChange(
                          col.name,
                          "selected",
                          e.target.checked
                        );
                      }}
                      className="h-4 w-4 rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{col.name}</span>
                  </label>
                  <select
                    value={columnType}
                    onChange={(e) =>
                      handleSelectionChange(col.name, "type", e.target.value)
                    }
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {availableDataTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case ModuleType.DataFiltering: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const {
        filter_type = "row",
        conditions = [],
        logical_operator = "AND",
      } = module.parameters;

      const operators = [
        { label: "Equals (==)", value: "==" },
        { label: "Not Equals (!=)", value: "!=" },
        { label: "Greater Than (>)", value: ">" },
        { label: "Less Than (<)", value: "<" },
        { label: "Greater or Equal (>=)", value: ">=" },
        { label: "Less or Equal (<=)", value: "<=" },
        { label: "Quantile ≥ (백분위 이상 유지·하위꼬리 제거)", value: "quantile_above" },
        { label: "Quantile ≤ (백분위 이하 유지·상위꼬리 제거)", value: "quantile_below" },
        { label: "Contains", value: "contains" },
        { label: "Not Contains", value: "not_contains" },
        { label: "Is Null", value: "is_null" },
        { label: "Is Not Null", value: "is_not_null" },
      ];

      const handleAddCondition = () => {
        const newConditions = [
          ...conditions,
          { column: inputColumns[0]?.name || "", operator: "==", value: "" },
        ];
        onParamChange("conditions", newConditions);
      };

      const handleRemoveCondition = (index: number) => {
        const newConditions = conditions.filter(
          (_: any, i: number) => i !== index
        );
        onParamChange("conditions", newConditions);
      };

      const handleConditionChange = (
        index: number,
        key: "column" | "operator" | "value",
        value: string
      ) => {
        const newConditions = [...conditions];
        newConditions[index] = {
          ...newConditions[index],
          [key]: value,
        };
        onParamChange("conditions", newConditions);
      };

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure filtering.
          </p>
        );
      }

      return (
        <div className="space-y-4">
          <PropertySelect
            label="Filter Type"
            value={filter_type}
            onChange={(v) => onParamChange("filter_type", v)}
            options={[
              { label: "Filter Rows", value: "row" },
              { label: "Filter Columns", value: "column" },
            ]}
          />

          <div className="border-t border-gray-700 pt-4">
            <div className="flex justify-between items-center mb-3">
              <h5 className="text-xs text-gray-500 uppercase font-bold">
                Conditions
              </h5>
              <button
                onClick={handleAddCondition}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded-md font-semibold text-white transition-colors"
              >
                + Add Condition
              </button>
            </div>

            {conditions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No conditions added. Click "Add Condition" to start filtering.
              </p>
            ) : (
              <div className="space-y-3">
                {conditions.map((condition: any, index: number) => (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md border border-gray-300 dark:border-gray-700"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-700 dark:text-gray-400 mb-1">
                            Column
                          </label>
                          <select
                            value={condition.column || ""}
                            onChange={(e) =>
                              handleConditionChange(
                                index,
                                "column",
                                e.target.value
                              )
                            }
                            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select column...</option>
                            {inputColumns.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-700 dark:text-gray-400 mb-1">
                            Operator
                          </label>
                          <select
                            value={condition.operator || "=="}
                            onChange={(e) =>
                              handleConditionChange(
                                index,
                                "operator",
                                e.target.value
                              )
                            }
                            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {operators.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-700 dark:text-gray-400 mb-1">
                            Value
                          </label>
                          {condition.operator === "is_null" ||
                          condition.operator === "is_not_null" ? (
                            <input
                              type="text"
                              value="N/A"
                              disabled
                              className="w-full bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-500 cursor-not-allowed"
                            />
                          ) : (
                            <input
                              type="text"
                              value={condition.value || ""}
                              onChange={(e) =>
                                handleConditionChange(
                                  index,
                                  "value",
                                  e.target.value
                                )
                              }
                              placeholder="Enter value..."
                              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCondition(index)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded-md font-semibold text-white transition-colors mt-6"
                        title="Remove condition"
                      >
                        ×
                      </button>
                    </div>
                    {index < conditions.length - 1 && (
                      <div className="text-center mt-2">
                        <span className="text-xs text-gray-500 font-semibold">
                          {logical_operator}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {conditions.length > 1 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <PropertySelect
                  label="Logical Operator"
                  value={logical_operator}
                  onChange={(v) => onParamChange("logical_operator", v)}
                  options={[
                    {
                      label: "AND (all conditions must be true)",
                      value: "AND",
                    },
                    { label: "OR (any condition can be true)", value: "OR" },
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      );
    }
    case ModuleType.ColumnPlot: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const {
        plot_type = "single",
        column1 = "",
        column2 = "",
      } = module.parameters;

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure plotting.
          </p>
        );
      }

      return (
        <div className="space-y-4">
          <PropertySelect
            label="Plot Type"
            value={plot_type}
            onChange={(v) => {
              onParamChange("plot_type", v);
              if (v === "single") {
                onParamChange("column2", "");
              }
            }}
            options={[
              { label: "Single Column", value: "single" },
              { label: "Two Columns", value: "double" },
            ]}
          />

          <div className="border-t border-gray-300 dark:border-gray-700 pt-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-400 mb-1">
                {plot_type === "single" ? "Column" : "X-Axis Column"}
              </label>
              <select
                value={column1}
                onChange={(e) => onParamChange("column1", e.target.value)}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select column...</option>
                {inputColumns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            </div>

            {plot_type === "double" && (
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-1">
                  Y-Axis Column
                </label>
                <select
                  value={column2}
                  onChange={(e) => onParamChange("column2", e.target.value)}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select column...</option>
                  {inputColumns
                    .filter((col) => col.name !== column1)
                    .map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.type})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>
      );
    }
    case ModuleType.OutlierDetector: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const { columns = [] } = module.parameters;

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure outlier detection.
          </p>
        );
      }

      // 숫자형 컬럼만 필터링
      const numericColumns = inputColumns.filter(
        (col) => col.type.startsWith("int") || col.type.startsWith("float")
      );

      const handleColumnToggle = (columnName: string) => {
        const currentColumns = Array.isArray(columns) ? columns : [];
        if (currentColumns.includes(columnName)) {
          onParamChange(
            "columns",
            currentColumns.filter((c: string) => c !== columnName)
          );
        } else {
          if (currentColumns.length >= 5) {
            alert("최대 5개까지 열을 선택할 수 있습니다.");
            return;
          }
          onParamChange("columns", [...currentColumns, columnName]);
        }
      };

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
              Columns (최대 5개 선택)
            </label>
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 max-h-60 overflow-y-auto">
              {numericColumns.length === 0 ? (
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  No numeric columns available. Outlier detection requires
                  numeric data.
                </p>
              ) : (
                <div className="space-y-2">
                  {numericColumns.map((col) => {
                    const isSelected =
                      Array.isArray(columns) && columns.includes(col.name);
                    return (
                      <label
                        key={col.name}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded text-gray-900 dark:text-white"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleColumnToggle(col.name)}
                          className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                          disabled={
                            !isSelected &&
                            Array.isArray(columns) &&
                            columns.length >= 5
                          }
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-300">
                          {col.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {Array.isArray(columns) && columns.length > 0 && (
              <p className="text-xs text-gray-700 dark:text-gray-400 mt-2">
                선택된 열: {columns.length}개 / 5개
              </p>
            )}
          </div>
          <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-700 dark:text-gray-500">
              This module will detect outliers using multiple methods:
              <br />• IQR (Interquartile Range)
              <br />• Z-score
              <br />• Isolation Forest
              <br />• Boxplot
            </p>
          </div>
        </div>
      );
    }
    case ModuleType.HypothesisTesting: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const { tests = [] } = module.parameters;

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure hypothesis testing.
          </p>
        );
      }

      // 숫자형과 범주형 컬럼 분리
      const numericColumns = inputColumns.filter(
        (col) => col.type.startsWith("int") || col.type.startsWith("float")
      );
      const categoricalColumns = inputColumns.filter(
        (col) => col.type === "string"
      );

      const testTypes = [
        {
          value: "t_test_one_sample",
          label: "One-Sample t-test",
          requiresNumeric: 1,
          requiresCategorical: 0,
        },
        {
          value: "t_test_independent",
          label: "Independent Samples t-test",
          requiresNumeric: 1,
          requiresCategorical: 0,
        },
        {
          value: "t_test_paired",
          label: "Paired Samples t-test",
          requiresNumeric: 2,
          requiresCategorical: 0,
        },
        {
          value: "chi_square",
          label: "Chi-square Test",
          requiresNumeric: 0,
          requiresCategorical: 2,
        },
        {
          value: "anova",
          label: "ANOVA",
          requiresNumeric: 1,
          requiresCategorical: 0,
        },
        {
          value: "ks_test",
          label: "KS-test",
          requiresNumeric: 1,
          requiresCategorical: 0,
        },
        {
          value: "shapiro_wilk",
          label: "Shapiro-Wilk Test",
          requiresNumeric: 1,
          requiresCategorical: 0,
        },
        {
          value: "levene",
          label: "Levene Test",
          requiresNumeric: 1,
          requiresCategorical: 0,
        },
      ];

      const handleTestToggle = (testType: string) => {
        const currentTests = Array.isArray(tests) ? tests : [];
        const testIndex = currentTests.findIndex(
          (t: any) => t.testType === testType
        );

        if (testIndex >= 0) {
          // 테스트 제거
          onParamChange(
            "tests",
            currentTests.filter((_: any, i: number) => i !== testIndex)
          );
        } else {
          // 테스트 추가
          onParamChange("tests", [
            ...currentTests,
            { testType, columns: [], options: {} },
          ]);
        }
      };

      const handleTestColumnChange = (testIndex: number, columns: string[]) => {
        const currentTests = Array.isArray(tests) ? [...tests] : [];
        if (currentTests[testIndex]) {
          currentTests[testIndex] = { ...currentTests[testIndex], columns };
          onParamChange("tests", currentTests);
        }
      };

      const getAvailableColumns = (testType: string) => {
        const testDef = testTypes.find((t) => t.value === testType);
        if (!testDef) return { numeric: [], categorical: [] };

        if (testDef.requiresCategorical > 0) {
          return { numeric: [], categorical: categoricalColumns };
        }
        return { numeric: numericColumns, categorical: [] };
      };

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
              Select Tests
            </label>
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {testTypes.map((test) => {
                  const isSelected =
                    Array.isArray(tests) &&
                    tests.some((t: any) => t.testType === test.value);
                  const availableCols = getAvailableColumns(test.value);
                  const canSelect =
                    (test.requiresNumeric === 0 ||
                      availableCols.numeric.length >= test.requiresNumeric) &&
                    (test.requiresCategorical === 0 ||
                      availableCols.categorical.length >=
                        test.requiresCategorical);

                  return (
                    <label
                      key={test.value}
                      className={`flex items-center gap-2 p-2 rounded ${
                        canSelect
                          ? "cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          canSelect && handleTestToggle(test.value)
                        }
                        disabled={!canSelect}
                        className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-900 dark:text-gray-300">
                          {test.label}
                        </span>
                        {!canSelect && (
                          <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                            {test.requiresNumeric > 0 &&
                              availableCols.numeric.length <
                                test.requiresNumeric &&
                              `Requires ${test.requiresNumeric} numeric column(s)`}
                            {test.requiresCategorical > 0 &&
                              availableCols.categorical.length <
                                test.requiresCategorical &&
                              `Requires ${test.requiresCategorical} categorical column(s)`}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 선택된 테스트별 열 선택 */}
          {Array.isArray(tests) && tests.length > 0 && (
            <div className="space-y-4 border-t border-gray-300 dark:border-gray-700 pt-4">
              <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
                Configure Columns for Each Test
              </label>
              {tests.map((test: any, testIndex: number) => {
                const testDef = testTypes.find(
                  (t) => t.value === test.testType
                );
                const availableCols = getAvailableColumns(test.testType);
                const selectedColumns = Array.isArray(test.columns)
                  ? test.columns
                  : [];

                return (
                  <div
                    key={testIndex}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-300 dark:border-gray-700"
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-2">
                      {testDef?.label || test.testType}
                    </div>
                    <div className="space-y-2">
                      {testDef?.requiresNumeric > 0 && (
                        <div>
                          <label className="block text-xs text-gray-700 dark:text-gray-400 mb-1">
                            Numeric Columns ({testDef.requiresNumeric} required)
                          </label>
                          <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 max-h-32 overflow-y-auto">
                            {availableCols.numeric.length === 0 ? (
                              <p className="text-xs text-yellow-500">
                                No numeric columns available
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {availableCols.numeric.map((col) => {
                                  const isSelected = selectedColumns.includes(
                                    col.name
                                  );
                                  const maxSelections =
                                    testDef?.requiresNumeric || 1;
                                  const canSelect =
                                    isSelected ||
                                    selectedColumns.length < maxSelections;

                                  return (
                                    <label
                                      key={col.name}
                                      className={`flex items-center gap-2 p-1 rounded ${
                                        canSelect
                                          ? "cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                          : "opacity-50 cursor-not-allowed"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                          if (!canSelect && !isSelected) return;
                                          const newColumns = isSelected
                                            ? selectedColumns.filter(
                                                (c: string) => c !== col.name
                                              )
                                            : [
                                                ...selectedColumns,
                                                col.name,
                                              ].slice(0, maxSelections);
                                          handleTestColumnChange(
                                            testIndex,
                                            newColumns
                                          );
                                        }}
                                        disabled={!canSelect && !isSelected}
                                        className="w-3 h-3 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-900 dark:text-gray-300">
                                        {col.name}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {testDef?.requiresCategorical > 0 && (
                        <div>
                          <label className="block text-xs text-gray-700 dark:text-gray-400 mb-1">
                            Categorical Columns ({testDef.requiresCategorical}{" "}
                            required)
                          </label>
                          <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 max-h-32 overflow-y-auto">
                            {availableCols.categorical.length === 0 ? (
                              <p className="text-xs text-yellow-600 dark:text-yellow-500">
                                No categorical columns available
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {availableCols.categorical.map((col) => {
                                  const isSelected = selectedColumns.includes(
                                    col.name
                                  );
                                  const maxSelections =
                                    testDef?.requiresCategorical || 1;
                                  const canSelect =
                                    isSelected ||
                                    selectedColumns.length < maxSelections;

                                  return (
                                    <label
                                      key={col.name}
                                      className={`flex items-center gap-2 p-1 rounded ${
                                        canSelect
                                          ? "cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                          : "opacity-50 cursor-not-allowed"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                          if (!canSelect && !isSelected) return;
                                          const newColumns = isSelected
                                            ? selectedColumns.filter(
                                                (c: string) => c !== col.name
                                              )
                                            : [
                                                ...selectedColumns,
                                                col.name,
                                              ].slice(0, maxSelections);
                                          handleTestColumnChange(
                                            testIndex,
                                            newColumns
                                          );
                                        }}
                                        disabled={!canSelect && !isSelected}
                                        className="w-3 h-3 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-900 dark:text-gray-300">
                                        {col.name}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-500">
              Select tests and configure columns for each test. Column types
              (numeric/categorical) are automatically filtered based on test
              requirements.
            </p>
          </div>
        </div>
      );
    }
    case ModuleType.NormalityChecker: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const {
        column = "",
        tests = [
          "shapiro_wilk",
          "kolmogorov_smirnov",
          "anderson_darling",
          "dagostino_k2",
        ],
      } = module.parameters;

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure normality checking.
          </p>
        );
      }

      // 숫자형 열만 필터링
      const numericColumns = inputColumns.filter(
        (col) => col.type.startsWith("int") || col.type.startsWith("float")
      );

      if (numericColumns.length === 0) {
        return (
          <p className="text-sm text-yellow-500">
            No numeric columns available for normality checking.
          </p>
        );
      }

      const testTypes = [
        { value: "shapiro_wilk", label: "Shapiro-Wilk Test" },
        { value: "kolmogorov_smirnov", label: "Kolmogorov-Smirnov Test" },
        { value: "anderson_darling", label: "Anderson-Darling Test" },
        { value: "dagostino_k2", label: "D'Agostino's K2 Test" },
      ];

      const handleTestToggle = (testType: string) => {
        const currentTests = Array.isArray(tests) ? [...tests] : [];
        if (currentTests.includes(testType)) {
          onParamChange(
            "tests",
            currentTests.filter((t) => t !== testType)
          );
        } else {
          onParamChange("tests", [...currentTests, testType]);
        }
      };

      const handleSelectAllTests = (selectAll: boolean) => {
        if (selectAll) {
          onParamChange(
            "tests",
            testTypes.map((t) => t.value)
          );
        } else {
          onParamChange("tests", []);
        }
      };

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Select Column
            </label>
            <select
              value={column}
              onChange={(e) => onParamChange("column", e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a column</option>
              {numericColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm text-gray-700 dark:text-gray-400">
                Select Tests
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectAllTests(true)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAllTests(false)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="bg-gray-700 border border-gray-600 rounded px-2 py-2 max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {testTypes.map((test) => {
                  const isSelected =
                    Array.isArray(tests) && tests.includes(test.value);
                  return (
                    <label
                      key={test.value}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-600"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTestToggle(test.value)}
                        className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">
                        {test.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }
    case ModuleType.VIFChecker: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const { feature_columns = [] } = module.parameters;

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure VIF analysis.
          </p>
        );
      }

      // 숫자형 열만 필터링 (VIF는 숫자형 변수에만 적용)
      const numericColumns = inputColumns.filter(
        (col) =>
          col && (col.type.startsWith("int") || col.type.startsWith("float"))
      );

      if (numericColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            No numeric columns available for VIF analysis.
          </p>
        );
      }

      const handleColumnToggle = (columnName: string) => {
        const currentColumns = Array.isArray(feature_columns)
          ? feature_columns
          : [];
        if (currentColumns.includes(columnName)) {
          onParamChange(
            "feature_columns",
            currentColumns.filter((c: string) => c !== columnName)
          );
        } else {
          onParamChange("feature_columns", [...currentColumns, columnName]);
        }
      };

      const handleSelectAll = () => {
        const allColumnNames = numericColumns.map((col) => col.name);
        onParamChange("feature_columns", allColumnNames);
      };

      const handleDeselectAll = () => {
        onParamChange("feature_columns", []);
      };

      const currentColumns = Array.isArray(feature_columns)
        ? feature_columns
        : [];
      const allSelected =
        numericColumns.length > 0 &&
        currentColumns.length === numericColumns.length;
      const someSelected =
        currentColumns.length > 0 &&
        currentColumns.length < numericColumns.length;

      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-gray-700 dark:text-gray-400">
                Select Feature Columns
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {numericColumns.map((col) => {
                  const isSelected =
                    Array.isArray(feature_columns) &&
                    feature_columns.includes(col.name);
                  return (
                    <label
                      key={col.name}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded text-gray-900 dark:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleColumnToggle(col.name)}
                        className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-300">
                        {col.name}
                        <span className="text-xs text-gray-600 dark:text-gray-500 ml-2">
                          ({col.type})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-400 mt-2">
              Selected: {currentColumns.length} / {numericColumns.length}{" "}
              column(s)
            </p>
          </div>
          <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-700 dark:text-gray-500">
              Select numeric feature columns to calculate Variance Inflation
              Factor (VIF). VIF values:
              <br />• VIF &gt; 10: High multicollinearity (red)
              <br />• 5 &lt; VIF ≤ 10: Moderate multicollinearity (light red)
              <br />• VIF ≤ 5: Low multicollinearity (normal)
            </p>
          </div>
        </div>
      );
    }
    case ModuleType.Correlation: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const { columns = [] } = module.parameters;

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure correlation analysis.
          </p>
        );
      }

      const handleColumnToggle = (columnName: string) => {
        const currentColumns = Array.isArray(columns) ? columns : [];
        if (currentColumns.includes(columnName)) {
          onParamChange(
            "columns",
            currentColumns.filter((c: string) => c !== columnName)
          );
        } else {
          onParamChange("columns", [...currentColumns, columnName]);
        }
      };

      const handleSelectAll = () => {
        const allColumnNames = inputColumns.map((col) => col.name);
        onParamChange("columns", allColumnNames);
      };

      const handleDeselectAll = () => {
        onParamChange("columns", []);
      };

      const currentColumns = Array.isArray(columns) ? columns : [];
      const allSelected =
        inputColumns.length > 0 &&
        currentColumns.length === inputColumns.length;
      const someSelected =
        currentColumns.length > 0 &&
        currentColumns.length < inputColumns.length;

      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-gray-700 dark:text-gray-400">
                Select Columns
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {inputColumns.map((col) => {
                  const isSelected =
                    Array.isArray(columns) && columns.includes(col.name);
                  return (
                    <label
                      key={col.name}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded text-gray-900 dark:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleColumnToggle(col.name)}
                        className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-300">
                        {col.name}
                        <span className="text-xs text-gray-600 dark:text-gray-500 ml-2">
                          (
                          {col.type.startsWith("int") ||
                          col.type.startsWith("float")
                            ? "numeric"
                            : "categorical"}
                          )
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-400 mt-2">
              Selected: {currentColumns.length} / {inputColumns.length}{" "}
              column(s)
            </p>
          </div>
          <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-700 dark:text-gray-500">
              Select columns to analyze correlations. The module will
              automatically:
              <br />• Calculate Pearson/Spearman/Kendall correlations for
              numeric columns
              <br />• Calculate Cramér's V for categorical columns
              <br />• Generate heatmap and pairplot visualizations
            </p>
          </div>
        </div>
      );
    }
    case ModuleType.HandleMissingValues: {
      const { method, strategy, n_neighbors, metric } = module.parameters;
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const currentSelections = module.parameters.columnSelections || {};

      // 기본값 초기화는 PropertiesPanel 컴포넌트의 useEffect에서 처리됨

      // 입력 컬럼 타입을 그대로 사용 (이미 pandas dtype)
      const getPandasDtype = (colType: string): string => {
        return colType;
      };

      const handleSelectionChange = (colName: string, value: boolean) => {
        const col = inputColumns.find((c) => c.name === colName);
        const newSelections = {
          ...currentSelections,
          [colName]: {
            ...(currentSelections[colName] || {
              type: col ? getPandasDtype(col.type) : "object",
            }),
            selected: value,
          },
        };
        onParamChange("columnSelections", newSelections);
      };

      const handleSelectAll = (selectAll: boolean) => {
        const newSelections = { ...currentSelections };
        inputColumns.forEach((col) => {
          const pandasDtype = getPandasDtype(col.type);
          // Method에 따라 선택 가능 여부 결정
          const isDisabled =
            (method === "impute" &&
              !(
                pandasDtype.startsWith("int") || pandasDtype.startsWith("float")
              )) ||
            (method === "knn" &&
              !(
                pandasDtype.startsWith("int") || pandasDtype.startsWith("float")
              ));

          if (!isDisabled) {
          newSelections[col.name] = {
              ...(currentSelections[col.name] || { type: pandasDtype }),
            selected: selectAll,
          };
          }
        });
        onParamChange("columnSelections", newSelections);
      };

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure columns.
          </p>
        );
      }

      return (
        <>
          <PropertySelect
            label="Method (in the Selected Columns)"
            value={method}
            onChange={(v) => onParamChange("method", v)}
            options={[
              { label: "Remove Entire Row", value: "remove_row" },
              { label: "Impute with Representative Value", value: "impute" },
              { label: "Impute using Neighbors (KNN)", value: "knn" },
            ]}
          />
          {method === "impute" && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <PropertySelect
                label="Strategy"
                value={strategy}
                onChange={(v) => onParamChange("strategy", v)}
                options={["mean", "median", "mode"]}
              />
            </div>
          )}
          {method === "knn" && (
            <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
              <PropertyInput
                label="n_neighbors"
                type="number"
                value={n_neighbors}
                onChange={(v) => onParamChange("n_neighbors", v)}
              />
              <PropertySelect
                label="Metric"
                value={metric}
                onChange={(v) => onParamChange("metric", v)}
                options={["nan_euclidean"]}
              />
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-gray-300 dark:border-gray-700">
            <h5 className="text-xs text-gray-700 dark:text-gray-500 uppercase font-bold mb-2">
              COLUMNS TO PROCESS
            </h5>
            <div className="flex justify-end gap-2 mb-2">
              <button
                onClick={() => handleSelectAll(true)}
                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
              >
                Select All
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
              >
                Deselect All
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto panel-scrollbar pr-2">
              {inputColumns.map((col) => {
                // 입력 컬럼 타입을 그대로 사용 (이미 pandas dtype)
                const getPandasDtype = (colType: string): string => {
                  return colType;
                };

                const pandasDtype = getPandasDtype(col.type);
                const selection = currentSelections[col.name] || {
                  selected: true, // 기본값: 선택됨
                  type: pandasDtype,
                };

                // Method에 따라 선택 가능 여부 결정
                const isDisabled =
                  (method === "impute" &&
                    !(
                      pandasDtype.startsWith("int") ||
                      pandasDtype.startsWith("float")
                    )) ||
                  (method === "knn" &&
                    !(
                      pandasDtype.startsWith("int") ||
                      pandasDtype.startsWith("float")
                    ));
                // remove_row는 모든 타입에 적용 가능

                return (
                  <label
                    key={col.name}
                    className={`flex items-center gap-2 text-sm truncate cursor-pointer hover:bg-gray-700/50 p-1 rounded ${
                      isDisabled ? "opacity-50" : ""
                    }`}
                    title={col.name}
                  >
                    <input
                      type="checkbox"
                      checked={selection.selected && !isDisabled}
                      onChange={(e) =>
                        handleSelectionChange(col.name, e.target.checked)
                      }
                      disabled={isDisabled}
                      className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <span className="truncate">{col.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      ({pandasDtype})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      );
    }
    case ModuleType.EncodeCategorical: {
      const sourceData = getConnectedDataSource(module.id);
      const categoricalColumns = (sourceData?.columns || []).filter(
        (c) => c.type === "string"
      );
      const {
        method,
        columns = [],
        handle_unknown,
        drop,
        ordinal_mapping,
      } = module.parameters;

      const handleColumnToggle = (colName: string) => {
        const newColumns = columns.includes(colName)
          ? columns.filter((c: string) => c !== colName)
          : [...columns, colName];
        onParamChange("columns", newColumns);
      };

      if (!sourceData) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source to see available columns.
          </p>
        );
      }
      if (categoricalColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            No categorical (string) columns found in input data.
          </p>
        );
      }

      return (
        <>
          <PropertySelect
            label="Method"
            value={method}
            onChange={(v) => onParamChange("method", v)}
            options={[
              { label: "One-Hot Encoding", value: "one_hot" },
              { label: "Ordinal Encoding", value: "ordinal" },
              { label: "Label Encoding", value: "label" },
            ]}
          />

          {method === "one_hot" && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <PropertySelect
                label="Drop"
                value={drop}
                onChange={(v) => onParamChange("drop", v === "None" ? null : v)}
                options={["first", "if_binary", "None"]}
              />
              <PropertySelect
                label="Handle Unknown"
                value={handle_unknown}
                onChange={(v) => onParamChange("handle_unknown", v)}
                options={["error", "ignore"]}
              />
            </div>
          )}

          {method === "ordinal" && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <label className="block text-sm text-gray-400 mb-1">
                Ordinal Mapping (JSON)
              </label>
              <textarea
                value={ordinal_mapping}
                onChange={(e) =>
                  onParamChange("ordinal_mapping", e.target.value)
                }
                placeholder={'{\n  "column_name": ["low", "medium", "high"]\n}'}
                className="w-full h-24 p-2 font-mono text-xs bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Define the order of categories for each column. Unmapped columns
                will be ordered alphabetically.
              </p>
            </div>
          )}

          <div className="mt-4">
            <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
              COLUMNS TO ENCODE
            </h5>
            <p className="text-xs text-gray-500 mb-2">
              If none are selected, all string columns will be encoded.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto panel-scrollbar pr-2">
              {categoricalColumns.map((col) => (
                <label
                  key={col.name}
                  className="flex items-center gap-2 text-sm truncate"
                  title={col.name}
                >
                  <input
                    type="checkbox"
                    checked={columns.includes(col.name)}
                    onChange={() => handleColumnToggle(col.name)}
                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{col.name}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      );
    }
    case ModuleType.ScalingTransform: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];
      const currentSelections = module.parameters.columnSelections || {};

      // 입력 컬럼 타입을 그대로 사용 (이미 pandas dtype)
      const getPandasDtype = (colType: string): string => {
        return colType;
      };

      // pandas dtype이 숫자형인지 확인하는 함수
      const isNumericDtype = (dtype: string): boolean => {
        return dtype.startsWith("int") || dtype.startsWith("float");
      };

      const handleSelectionChange = (colName: string, value: boolean) => {
        const col = inputColumns.find((c) => c.name === colName);
        const newSelections = {
          ...currentSelections,
          [colName]: {
            ...(currentSelections[colName] || {
              type: col ? getPandasDtype(col.type) : "object",
            }),
            selected: value,
          },
        };
        onParamChange("columnSelections", newSelections);
      };

      const handleSelectAll = (selectAll: boolean) => {
        const newSelections = { ...currentSelections };
        inputColumns.forEach((col) => {
          const pandasDtype = getPandasDtype(col.type);
          if (isNumericDtype(pandasDtype)) {
            // Only affect numeric columns
            newSelections[col.name] = {
              ...(currentSelections[col.name] || { type: pandasDtype }),
              selected: selectAll,
            };
          }
        });
        onParamChange("columnSelections", newSelections);
      };

      return (
        <>
          <PropertySelect
            label="Method"
            value={module.parameters.method}
            onChange={(v) => onParamChange("method", v)}
            options={["MinMax", "StandardScaler", "RobustScaler"]}
          />

          {inputColumns.length === 0 ? (
            <p className="text-sm text-gray-700 dark:text-gray-500 mt-4">
              Connect a data source module to configure columns.
            </p>
          ) : (
            <div className="mt-4">
              <h5 className="text-xs text-gray-700 dark:text-gray-500 uppercase font-bold mb-2">
                COLUMNS TO NORMALIZE
              </h5>
              <div className="flex justify-end gap-2 mb-2">
                <button
                  onClick={() => handleSelectAll(true)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Select All Numeric
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Deselect All
                </button>
              </div>
              <div className="space-y-2 pr-2">
                <div className="grid grid-cols-5 gap-2 items-center sticky top-0 bg-gray-100 dark:bg-gray-800 py-1">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-400 col-span-3">
                    Column Name
                  </span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-400 col-span-2">
                    Data Type
                  </span>
                </div>
                {inputColumns.map((col) => {
                  const pandasDtype = getPandasDtype(col.type);
                  const isNumeric = isNumericDtype(pandasDtype);

                  // 디버깅: 컬럼 타입 확인 (CHAS 또는 int64인 경우)
                  if (
                    col.name === "CHAS" ||
                    col.type === "int64" ||
                    col.type === "string"
                  ) {
                    console.log(
                      "ScalingTransform PropertiesPanel - Column type:",
                      {
                        colName: col.name,
                        originalType: col.type,
                        pandasDtype: pandasDtype,
                        isNumeric: isNumeric,
                      }
                    );
                  }

                  const selection = currentSelections[col.name] || {
                    selected: false,
                    type: pandasDtype,
                  };
                  return (
                    <div
                      key={col.name}
                      className="grid grid-cols-5 gap-2 items-center"
                    >
                      <label
                        className="flex items-center gap-2 text-sm truncate col-span-3 text-gray-900 dark:text-white"
                        title={col.name}
                      >
                        <input
                          type="checkbox"
                          checked={selection.selected}
                          onChange={(e) =>
                            handleSelectionChange(col.name, e.target.checked)
                          }
                          className="h-4 w-4 rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                          disabled={!isNumeric}
                        />
                        <span
                          className={`truncate ${
                            !isNumeric ? "text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {col.name}
                        </span>
                      </label>
                      <div className="col-span-2">
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1 rounded-md">
                          {pandasDtype}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      );
    }
    case ModuleType.PythonScript: {
      const code = (module.parameters.code as string) ?? "";
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">
            Python Script는 <b>고급기능</b>입니다. 잠금 상태에서는 편집기가 숨겨집니다(상단 “고급기능 실행”으로 해제).
          </p>
          <AdvancedOnly>
            <div className="space-y-2">
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠️ 임의 Python 코드를 실행합니다 — <b>신뢰할 수 있는 코드만</b> 입력하세요.
                입력 변수 <code>dataframe</code>, 출력 변수 <code>scripted_data</code>(DataFrame)를 만들어야 합니다.
                무작위 연산은 시드를 고정하세요(<code>random_state=42</code> 등) — 재현성.
              </div>
              <textarea
                className="w-full h-48 text-xs font-mono border border-gray-300 rounded p-2"
                defaultValue={code}
                spellCheck={false}
                onBlur={(e) => onParamChange("code", e.target.value)}
              />
              <p className="text-[11px] text-gray-500">
                이 코드는 “전체 코드 보기”로 내보낸 Python에 <b>그대로 포함</b>됩니다. 브라우저(Pyodide) 샌드박스에서 실행됩니다.
              </p>
            </div>
          </AdvancedOnly>
        </div>
      );
    }
    case ModuleType.FeatureEngineer: {
      const operations = module.parameters.operations || [];
      const opsHelp =
        '예시(JSON 배열):\n[\n  {"type": "cyclical", "column": "hr", "period": 24},\n  {"type": "interaction", "columns": ["workingday", "hr"]},\n  {"type": "trend", "name": "trend_index"}\n]\n- cyclical: {col}_sin, {col}_cos = sin/cos(2π·col/period)\n- interaction: a_x_b = a * b\n- trend: 0..n-1 순번(추세)';
      return (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h5 className="text-xs text-gray-500 uppercase font-bold">
              Feature Operations (JSON)
            </h5>
            <div title={opsHelp}>
              <InformationCircleIcon className="w-5 h-5 text-gray-400 cursor-help" />
            </div>
          </div>
          <textarea
            className="w-full h-40 text-xs font-mono border border-gray-300 rounded p-2"
            defaultValue={JSON.stringify(operations, null, 2)}
            onBlur={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) onParamChange("operations", parsed);
              } catch {
                /* 유효하지 않은 JSON: 이전 값 유지 */
              }
            }}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            cyclical(주기 인코딩) · interaction(상호작용) · trend(추세 순번). 유효한 JSON 배열일 때만 저장됩니다.
          </p>
        </div>
      );
    }
    case ModuleType.TransitionData: {
      const sourceData = getConnectedDataSource(module.id);
      const numericColumns = (sourceData?.columns || []).filter(
        (c) => c.type === "number"
      );
      const transformations = module.parameters.transformations || {};

      const handleTransformChange = (colName: string, method: string) => {
        const newTransforms = { ...transformations, [colName]: method };
        onParamChange("transformations", newTransforms);
      };

      if (!sourceData) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure columns.
          </p>
        );
      }

      const formulaTooltip = `Formulas:\n- Log: log(x)\n- Square Root: sqrt(x)\n- Min-Log: log((x - min) + 1)\n- Min-Square Root: sqrt((x - min) + 1)`;

      return (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h5 className="text-xs text-gray-500 uppercase font-bold">
              Column Transformations
            </h5>
            <div title={formulaTooltip}>
              <InformationCircleIcon className="w-5 h-5 text-gray-400 cursor-help" />
            </div>
          </div>
          {numericColumns.length === 0 ? (
            <p className="text-sm text-gray-500">
              No numeric columns found in the input data.
            </p>
          ) : (
            <div className="space-y-3">
              {numericColumns.map((col) => (
                <div
                  key={col.name}
                  className="grid grid-cols-2 gap-2 items-center"
                >
                  <label className="text-sm truncate" title={col.name}>
                    {col.name}
                  </label>
                  <select
                    value={transformations[col.name] || "None"}
                    onChange={(e) =>
                      handleTransformChange(col.name, e.target.value)
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="None">None</option>
                    <option value="Log">Log</option>
                    <option value="Square Root">Square Root</option>
                    <option value="Min-Log">Min-Log</option>
                    <option value="Min-Square Root">Min-Square Root</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case ModuleType.ResampleData: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source to configure resampling.
          </p>
        );
      }

      return (
        <>
          <PropertySelect
            label="Method"
            value={module.parameters.method}
            onChange={(v) => onParamChange("method", v)}
            options={["SMOTE", "NearMiss"]}
          />
          <PropertySelect
            label="Target Column"
            value={module.parameters.target_column || ""}
            onChange={(v) =>
              onParamChange("target_column", v === "" ? null : v)
            }
            options={["", ...inputColumns.map((c) => c.name)]}
          />
        </>
      );
    }
    case ModuleType.Join: {
      const sourceData1 = getConnectedDataSource(module.id, "data_in");
      const sourceData2 = getConnectedDataSource(module.id, "data_in2");

      const columns1 = sourceData1?.columns || [];
      const columns2 = sourceData2?.columns || [];
      const rows1 = sourceData1?.rows?.length || 0;
      const rows2 = sourceData2?.rows?.length || 0;
      const cols1 = columns1.length;
      const cols2 = columns2.length;

      const commonColumns = columns1
        .filter((c1) => columns2.some((c2) => c2.name === c1.name))
        .map((c) => c.name);

      return (
        <>
          {/* 데이터 정보 표시 */}
          <div className="mb-4 p-3 bg-gray-800 rounded-md">
            <div className="text-xs text-gray-400 mb-2">
              Input Data Information
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500">Input 1:</div>
                <div className="text-gray-300">
                  {rows1} rows × {cols1} cols
                </div>
              </div>
              <div>
                <div className="text-gray-500">Input 2:</div>
                <div className="text-gray-300">
                  {rows2} rows × {cols2} cols
                </div>
              </div>
            </div>
          </div>

          <PropertySelect
            label="Join Type"
            value={
              module.parameters.how || module.parameters.join_type || "inner"
            }
            onChange={(v) => {
              onParamChange("how", v);
              onParamChange("join_type", v);
            }}
            options={[
              { label: "Inner Join", value: "inner" },
              { label: "Outer Join", value: "outer" },
              { label: "Left Join", value: "left" },
              { label: "Right Join", value: "right" },
            ]}
          />

          {columns1.length > 0 && columns2.length > 0 && (
            <>
              <PropertySelect
                label="Join Key (Both)"
                value={module.parameters.on || ""}
                onChange={(v) => {
                  onParamChange("on", v || null);
                  if (v) {
                    onParamChange("left_on", null);
                    onParamChange("right_on", null);
                  }
                }}
                options={["", ...commonColumns]}
              />

              <div className="text-xs text-gray-400 mb-2 text-center">OR</div>

              <PropertySelect
                label="Left Key"
                value={module.parameters.left_on || ""}
                onChange={(v) => {
                  onParamChange("left_on", v || null);
                  if (v) onParamChange("on", null);
                }}
                options={["", ...columns1.map((c) => c.name)]}
              />

              <PropertySelect
                label="Right Key"
                value={module.parameters.right_on || ""}
                onChange={(v) => {
                  onParamChange("right_on", v || null);
                  if (v) onParamChange("on", null);
                }}
                options={["", ...columns2.map((c) => c.name)]}
              />
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <PropertyInput
              label="Left Suffix"
              value={module.parameters.suffixes?.[0] || "_x"}
              onChange={(v) => {
                const suffixes = module.parameters.suffixes || ["_x", "_y"];
                onParamChange("suffixes", [v, suffixes[1]]);
              }}
            />
            <PropertyInput
              label="Right Suffix"
              value={module.parameters.suffixes?.[1] || "_y"}
              onChange={(v) => {
                const suffixes = module.parameters.suffixes || ["_x", "_y"];
                onParamChange("suffixes", [suffixes[0], v]);
              }}
            />
          </div>

          {/* 검증 메시지 */}
          {(!sourceData1 || !sourceData2) && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-md">
              <div className="text-sm text-red-400 font-semibold">
                ⚠ Cannot Execute
              </div>
              <div className="text-xs text-red-300 mt-1">
                Both input data sources must be connected.
              </div>
            </div>
          )}
          {sourceData1 &&
            sourceData2 &&
            !module.parameters.on &&
            !module.parameters.left_on &&
            !module.parameters.right_on && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-md">
                <div className="text-sm text-red-400 font-semibold">
                  ⚠ Cannot Execute
                </div>
                <div className="text-xs text-red-300 mt-1">
                  Join key must be specified (on or left_on/right_on).
                </div>
              </div>
            )}
        </>
      );
    }
    case ModuleType.Concat: {
      const sourceData1 = getConnectedDataSource(module.id, "data_in");
      const sourceData2 = getConnectedDataSource(module.id, "data_in2");

      const rows1 = sourceData1?.rows?.length || 0;
      const rows2 = sourceData2?.rows?.length || 0;
      const cols1 = sourceData1?.columns?.length || 0;
      const cols2 = sourceData2?.columns?.length || 0;

      const axis = module.parameters.axis || "vertical";
      const isValid =
        axis === "vertical"
          ? cols1 === cols2 || cols1 === 0 || cols2 === 0 // Vertical: 컬럼 수가 같아야 함
          : rows1 === rows2 || rows1 === 0 || rows2 === 0; // Horizontal: 행 수가 같아야 함

      return (
        <>
          {/* 데이터 정보 표시 */}
          <div className="mb-4 p-3 bg-gray-800 rounded-md">
            <div className="text-xs text-gray-400 mb-2">
              Input Data Information
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500">Input 1:</div>
                <div className="text-gray-300">
                  {rows1} rows × {cols1} cols
                </div>
              </div>
              <div>
                <div className="text-gray-500">Input 2:</div>
                <div className="text-gray-300">
                  {rows2} rows × {cols2} cols
                </div>
              </div>
            </div>
            {sourceData1 && sourceData2 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="text-xs text-gray-400">Expected Output:</div>
                <div className="text-sm text-gray-300">
                  {axis === "vertical"
                    ? `${rows1 + rows2} rows × ${Math.max(cols1, cols2)} cols`
                    : `${Math.max(rows1, rows2)} rows × ${cols1 + cols2} cols`}
                </div>
              </div>
            )}
          </div>

          <PropertySelect
            label="Axis"
            value={module.parameters.axis || "vertical"}
            onChange={(v) => onParamChange("axis", v)}
            options={[
              { label: "Vertical (Rows)", value: "vertical" },
              { label: "Horizontal (Columns)", value: "horizontal" },
            ]}
          />

          <PropertyCheckbox
            label="Ignore Index"
            value={module.parameters.ignore_index || false}
            onChange={(v) => onParamChange("ignore_index", v)}
          />

          <PropertyCheckbox
            label="Sort Columns"
            value={module.parameters.sort || false}
            onChange={(v) => onParamChange("sort", v)}
          />

          {/* 검증 메시지 */}
          {(!sourceData1 || !sourceData2) && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-md">
              <div className="text-sm text-red-400 font-semibold">
                ⚠ Cannot Execute
              </div>
              <div className="text-xs text-red-300 mt-1">
                Both input data sources must be connected.
              </div>
            </div>
          )}
          {sourceData1 && sourceData2 && !isValid && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-md">
              <div className="text-sm text-red-400 font-semibold">
                ⚠ Cannot Execute
              </div>
              <div className="text-xs text-red-300 mt-1">
                {axis === "vertical"
                  ? `Column count mismatch: Input 1 has ${cols1} columns, Input 2 has ${cols2} columns. For vertical concatenation, both inputs must have the same number of columns.`
                  : `Row count mismatch: Input 1 has ${rows1} rows, Input 2 has ${rows2} rows. For horizontal concatenation, both inputs must have the same number of rows.`}
              </div>
            </div>
          )}
        </>
      );
    }
    case ModuleType.SplitData: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];

      if (inputColumns.length === 0 && !sourceData) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source module to configure parameters.
          </p>
        );
      }

      return (
        <>
          <PropertyInput
            label="Train Size (optional, default: None)"
            type="number"
            value={module.parameters.train_size || ""}
            onChange={(v) =>
              onParamChange("train_size", v === "" ? undefined : v)
            }
            placeholder="Leave empty for default"
          />
          <PropertyInput
            label="Random State (optional, default: None)"
            type="number"
            value={module.parameters.random_state || ""}
            onChange={(v) =>
              onParamChange("random_state", v === "" ? undefined : v)
            }
            placeholder="Leave empty for default"
          />
          <PropertySelect
            label="Shuffle (optional, default: True)"
            value={module.parameters.shuffle || ""}
            onChange={(v) => onParamChange("shuffle", v === "" ? undefined : v)}
            options={["", "True", "False"]}
          />
          <PropertySelect
            label="Stratify (optional, default: None)"
            value={module.parameters.stratify || ""}
            onChange={(v) =>
              onParamChange("stratify", v === "" ? undefined : v)
            }
            options={["", "False", "True"]}
          />
          {module.parameters.stratify === "True" && (
            <PropertySelect
              label="Stratify by Column"
              value={module.parameters.stratify_column || "None"}
              onChange={(v) =>
                onParamChange("stratify_column", v === "None" ? undefined : v)
              }
              options={["None", ...inputColumns.map((c) => c.name)]}
            />
          )}
        </>
      );
    }
    case ModuleType.LinearRegression:
      return (
        <>
          <PropertyDisplay label="Model Purpose" value="Regression" />
          <PropertySelect
            label="Model Type"
            value={module.parameters.model_type}
            onChange={(v) => onParamChange("model_type", v)}
            options={["LinearRegression", "Lasso", "Ridge", "ElasticNet"]}
          />
          <PropertySelect
            label="Fit Intercept"
            value={module.parameters.fit_intercept}
            onChange={(v) => onParamChange("fit_intercept", v)}
            options={["True", "False"]}
          />
          {["Lasso", "Ridge", "ElasticNet"].includes(
            module.parameters.model_type
          ) && (
            <PropertyInput
              label="Alpha (Regularization)"
              type="number"
              value={module.parameters.alpha}
              onChange={(v) => onParamChange("alpha", v)}
              step="0.1"
            />
          )}
          {module.parameters.model_type === "ElasticNet" && (
            <PropertyInput
              label="L1 Ratio"
              type="number"
              value={module.parameters.l1_ratio}
              onChange={(v) => onParamChange("l1_ratio", v)}
              step="0.1"
            />
          )}
          <PropertySelect
            label="Hyperparameter Tuning"
            value={module.parameters.tuning_enabled || "False"}
            onChange={(v) => onParamChange("tuning_enabled", v)}
            options={["False", "True"]}
          />
          {module.parameters.tuning_enabled === "True" && (
            <>
              <PropertySelect
                label="Tuning Strategy"
                value={module.parameters.tuning_strategy || "GridSearch"}
                onChange={(v) => onParamChange("tuning_strategy", v)}
                options={["GridSearch"]}
              />
              <PropertyInput
                label="Alpha Candidates (comma-separated)"
                type="text"
                value={module.parameters.alpha_candidates || "0.01,0.1,1,10"}
                onChange={(v) => onParamChange("alpha_candidates", v)}
              />
              {module.parameters.model_type === "ElasticNet" && (
                <PropertyInput
                  label="L1 Ratio Candidates (comma-separated)"
                  type="text"
                  value={module.parameters.l1_ratio_candidates || "0.2,0.5,0.8"}
                  onChange={(v) => onParamChange("l1_ratio_candidates", v)}
                />
              )}
              <PropertyInput
                label="CV Folds"
                type="number"
                min="2"
                value={module.parameters.cv_folds ?? 5}
                onChange={(v) => onParamChange("cv_folds", v)}
              />
              <PropertySelect
                label="Scoring Metric"
                value={
                  module.parameters.scoring_metric || "neg_mean_squared_error"
                }
                onChange={(v) => onParamChange("scoring_metric", v)}
                options={[
                  "neg_mean_squared_error",
                  "neg_mean_absolute_error",
                  "r2",
                ]}
              />
            </>
          )}
        </>
      );
    case ModuleType.SweepParameters: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source to the 'data_in' port and a model definition to
            the 'model_in' port to configure.
          </p>
        );
      }

      const {
        feature_columns: sweepFeatures = [],
        label_column: sweepLabel = null,
        search_strategy = "GridSearchCV",
        param_grid = '{"max_depth": [3, 5, 7], "min_samples_split": [2, 5]}',
        cv = 5,
        scoring = "accuracy",
        n_iter = 10,
      } = module.parameters;

      const handleSweepFeatureChange = (colName: string, isChecked: boolean) => {
        const newFeatures = isChecked
          ? [...sweepFeatures, colName]
          : sweepFeatures.filter((c: string) => c !== colName);
        onParamChange("feature_columns", newFeatures);
      };

      const handleSweepLabelChange = (colName: string) => {
        const newLabel = colName === "" ? null : colName;
        onParamChange("label_column", newLabel);
        if (newLabel && sweepFeatures.includes(newLabel)) {
          onParamChange(
            "feature_columns",
            sweepFeatures.filter((c: string) => c !== newLabel)
          );
        }
      };

      const handleSweepSelectAll = (selectAll: boolean) => {
        if (selectAll) {
          onParamChange(
            "feature_columns",
            inputColumns
              .map((col) => col.name)
              .filter((name) => name !== sweepLabel)
          );
        } else {
          onParamChange("feature_columns", []);
        }
      };

      let paramGridValid = true;
      try {
        const parsed =
          typeof param_grid === "string" ? JSON.parse(param_grid) : param_grid;
        paramGridValid =
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          Object.keys(parsed).length > 0;
      } catch {
        paramGridValid = false;
      }

      return (
        <div className="space-y-4">
          <div>
            <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
              Search Strategy
            </h5>
            <select
              value={search_strategy}
              onChange={(e) => onParamChange("search_strategy", e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="GridSearchCV">GridSearchCV (결정적·기본)</option>
              <option value="RandomizedSearchCV">
                RandomizedSearchCV (random_state=42)
              </option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              GridSearchCV는 정수 cv와 함께 완전히 결정적입니다(재현성 보장).
            </p>
          </div>

          <div>
            <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
              Param Grid (JSON)
            </h5>
            <textarea
              value={
                typeof param_grid === "string"
                  ? param_grid
                  : JSON.stringify(param_grid)
              }
              onChange={(e) => onParamChange("param_grid", e.target.value)}
              rows={3}
              spellCheck={false}
              className={`w-full font-mono bg-white dark:bg-gray-700 border rounded px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                paramGridValid
                  ? "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  : "border-red-400 focus:ring-red-500"
              }`}
            />
            {!paramGridValid && (
              <p className="text-[11px] text-red-500 mt-1">
                올바른 JSON 객체가 아닙니다. 예:{" "}
                {'{"max_depth": [3, 5], "min_samples_split": [2, 5]}'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
                CV Folds
              </h5>
              <input
                type="number"
                min={2}
                step={1}
                value={cv}
                onChange={(e) =>
                  onParamChange("cv", parseInt(e.target.value, 10) || 5)
                }
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
                Scoring
              </h5>
              <input
                type="text"
                value={scoring}
                placeholder="accuracy / r2 / f1_macro …"
                onChange={(e) => onParamChange("scoring", e.target.value)}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {search_strategy === "RandomizedSearchCV" && (
            <div>
              <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
                N Iter (RandomizedSearchCV)
              </h5>
              <input
                type="number"
                min={1}
                step={1}
                value={n_iter}
                onChange={(e) =>
                  onParamChange("n_iter", parseInt(e.target.value, 10) || 10)
                }
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
              Label Column
            </h5>
            <select
              value={sweepLabel || ""}
              onChange={(e) => handleSweepLabelChange(e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">공백</option>
              {inputColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs text-gray-700 dark:text-gray-500 uppercase font-bold">
                Feature Columns
              </h5>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSweepSelectAll(true)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSweepSelectAll(false)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="space-y-2 pr-2">
              {inputColumns.map((col) => (
                <label
                  key={col.name}
                  className="flex items-center gap-2 text-sm truncate text-gray-900 dark:text-white"
                  title={col.name}
                >
                  <input
                    type="checkbox"
                    checked={sweepFeatures.includes(col.name)}
                    onChange={(e) =>
                      handleSweepFeatureChange(col.name, e.target.checked)
                    }
                    disabled={col.name === sweepLabel}
                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="truncate">{col.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case ModuleType.TrainModel:
    case ModuleType.ResultModel: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source to the 'data_in' port to configure.
          </p>
        );
      }

      const { feature_columns = [], label_column = null } = module.parameters;

      const handleFeatureChange = (colName: string, isChecked: boolean) => {
        const newFeatures = isChecked
          ? [...feature_columns, colName]
          : feature_columns.filter((c: string) => c !== colName);
        onParamChange("feature_columns", newFeatures);
      };

      const handleLabelChange = (colName: string) => {
        const newLabel = colName === "" ? null : colName;
        onParamChange("label_column", newLabel);
        // If the new label was a feature, unselect it as a feature
        if (newLabel && feature_columns.includes(newLabel)) {
          onParamChange(
            "feature_columns",
            feature_columns.filter((c: string) => c !== newLabel)
          );
        }
      };

      const handleSelectAllFeatures = (selectAll: boolean) => {
        if (selectAll) {
          const allFeatureCols = inputColumns
            .map((col) => col.name)
            .filter((name) => name !== label_column);
          onParamChange("feature_columns", allFeatureCols);
        } else {
          onParamChange("feature_columns", []);
        }
      };

      return (
        <div>
          <AIParameterRecommender
            module={module}
            inputColumns={inputColumns.map((c) => c.name)}
            projectName={projectName}
            updateModuleParameters={updateModuleParameters}
          />
          <div className="mb-4">
            <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
              Label Column
            </h5>
            <select
              value={label_column || ""}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">공백</option>
              {inputColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs text-gray-700 dark:text-gray-500 uppercase font-bold">
                Feature Columns
              </h5>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectAllFeatures(true)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAllFeatures(false)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="space-y-2 pr-2">
              {inputColumns.map((col) => (
                <label
                  key={col.name}
                  className="flex items-center gap-2 text-sm truncate text-gray-900 dark:text-white"
                  title={col.name}
                >
                  <input
                    type="checkbox"
                    checked={feature_columns.includes(col.name)}
                    onChange={(e) =>
                      handleFeatureChange(col.name, e.target.checked)
                    }
                    disabled={col.name === label_column}
                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="truncate">{col.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }
    // K-Means: 모델 정의만 (하이퍼파라미터만 설정)
    case ModuleType.KMeans:
      return (
        <>
          <PropertyInput
            label="Number of Clusters"
            value={module.parameters.n_clusters || 3}
            type="number"
            onChange={(v) => onParamChange("n_clusters", v)}
          />
          <PropertySelect
            label="Init"
            value={module.parameters.init || "k-means++"}
            options={["k-means++", "random"]}
            onChange={(v) => onParamChange("init", v)}
          />
          <PropertyInput
            label="N Init"
            value={module.parameters.n_init || 10}
            type="number"
            onChange={(v) => onParamChange("n_init", v)}
          />
          <PropertyInput
            label="Max Iter"
            value={module.parameters.max_iter || 300}
            type="number"
            onChange={(v) => onParamChange("max_iter", v)}
          />
          <PropertyInput
            label="Random State"
            value={module.parameters.random_state || 42}
            type="number"
            onChange={(v) => onParamChange("random_state", v)}
          />
        </>
      );
    // PCA: 모델 정의만 (하이퍼파라미터만 설정)
    case ModuleType.PrincipalComponentAnalysis:
      return (
        <>
          <PropertyInput
            label="Number of Components"
            value={module.parameters.n_components || 2}
            type="number"
            onChange={(v) => onParamChange("n_components", v)}
          />
        </>
      );
    // DBSCAN: 모델 정의만 (밀도 기반 하이퍼파라미터)
    case ModuleType.DBSCAN:
      return (
        <>
          <PropertyInput
            label="Eps (이웃 반경)"
            value={module.parameters.eps ?? 0.5}
            type="number"
            onChange={(v) => onParamChange("eps", v)}
          />
          <PropertyInput
            label="Min Samples (핵심점 최소 이웃 수)"
            value={module.parameters.min_samples ?? 5}
            type="number"
            onChange={(v) => onParamChange("min_samples", v)}
          />
        </>
      );
    // Hierarchical(Agglomerative): 모델 정의만 (클러스터 수 + 연결 방법)
    case ModuleType.HierarchicalClustering:
      return (
        <>
          <PropertyInput
            label="Number of Clusters"
            value={module.parameters.n_clusters ?? 3}
            type="number"
            onChange={(v) => onParamChange("n_clusters", v)}
          />
          <PropertySelect
            label="Linkage (연결 방법)"
            value={module.parameters.linkage || "ward"}
            options={["ward", "complete", "average", "single"]}
            onChange={(v) => onParamChange("linkage", v)}
          />
        </>
      );
    // TrainClusteringModel: feature_columns 선택
    case ModuleType.TrainClusteringModel: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = (sourceData?.columns || [])
        .filter((c) => c.type === "number")
        .map((c) => c.name);

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source with numeric columns to configure.
          </p>
        );
      }

      const { feature_columns = [] } = module.parameters;

      const handleFeatureChange = (colName: string, isChecked: boolean) => {
        const newFeatures = isChecked
          ? [...feature_columns, colName]
          : feature_columns.filter((c: string) => c !== colName);
        onParamChange("feature_columns", newFeatures);
      };

      const handleSelectAllFeatures = (selectAll: boolean) => {
        onParamChange("feature_columns", selectAll ? inputColumns : []);
      };

      return (
        <>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs text-gray-500 uppercase font-bold">
                Feature Columns
              </h5>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectAllFeatures(true)}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md font-semibold"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAllFeatures(false)}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md font-semibold"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Select feature columns for clustering. If none are selected, all
              numeric columns will be used.
            </p>
            <div className="space-y-2 pr-2 max-h-40 overflow-y-auto panel-scrollbar">
              {inputColumns.map((col) => (
                <label
                  key={col}
                  className="flex items-center gap-2 text-sm truncate"
                  title={col}
                >
                  <input
                    type="checkbox"
                    checked={feature_columns.includes(col)}
                    onChange={(e) => handleFeatureChange(col, e.target.checked)}
                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{col}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      );
    }
    // ClusteringData: 파라미터 없음
    case ModuleType.ClusteringData:
      return (
        <p className="text-sm text-gray-500">
          This module applies a trained clustering model to assign clusters or
          transform data. No parameters needed.
        </p>
      );
    // Recommender: 협업 필터링 (사용자/아이템/평점 컬럼 매핑 + 요인 수 + Top-N)
    case ModuleType.Recommender: {
      const sourceData = getConnectedDataSource(module.id);
      const allColumns = (sourceData?.columns || []).map((c) => c.name);

      if (allColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a long-format ratings data source (user_id, item_id, rating)
            to configure.
          </p>
        );
      }

      return (
        <>
          <p className="text-xs text-gray-500 mb-2">
            Map the long-format ratings columns, then choose the number of latent
            factors and Top-N recommendations per user. NMF matrix factorization
            (random_state=42) is deterministic.
          </p>
          <PropertySelect
            label="User Column"
            value={module.parameters.user_col || ""}
            options={allColumns}
            onChange={(v) => onParamChange("user_col", v)}
          />
          <PropertySelect
            label="Item Column"
            value={module.parameters.item_col || ""}
            options={allColumns}
            onChange={(v) => onParamChange("item_col", v)}
          />
          <PropertySelect
            label="Rating Column"
            value={module.parameters.rating_col || ""}
            options={allColumns}
            onChange={(v) => onParamChange("rating_col", v)}
          />
          <PropertyInput
            label="Latent Factors (n_components)"
            value={module.parameters.n_components ?? 2}
            type="number"
            onChange={(v) => onParamChange("n_components", v)}
          />
          <PropertyInput
            label="Top-N per User"
            value={module.parameters.top_n ?? 5}
            type="number"
            onChange={(v) => onParamChange("top_n", v)}
          />
        </>
      );
    }
    case ModuleType.LogisticRegression:
      return (
        <>
          <PropertyDisplay label="Model Purpose" value="Classification" />
          <PropertySelect
            label="Penalty"
            value={module.parameters.penalty || "l2"}
            onChange={(v) => onParamChange("penalty", v)}
            options={["l1", "l2", "elasticnet", "none"]}
          />
          <PropertyInput
            label="C (Regularization)"
            type="number"
            value={module.parameters.C || 1.0}
            onChange={(v) => onParamChange("C", v)}
            step="0.1"
          />
          <PropertySelect
            label="Solver"
            value={module.parameters.solver || "lbfgs"}
            onChange={(v) => onParamChange("solver", v)}
            options={["lbfgs", "newton-cg", "liblinear", "sag", "saga"]}
          />
          <PropertyInput
            label="Max Iterations"
            type="number"
            value={module.parameters.max_iter || 100}
            onChange={(v) => onParamChange("max_iter", v)}
          />
          case ModuleType.PoissonRegression: return{" "}
          <>
            <PropertyDisplay
              label="Model Purpose"
              value="Regression (Count Data)"
            />
            <PropertySelect
              label="Distribution Type"
              value={module.parameters.distribution_type || "Poisson"}
              onChange={(v) => onParamChange("distribution_type", v)}
              options={["Poisson", "QuasiPoisson"]}
            />
            <PropertyInput
              label="Max Iterations"
              type="number"
              value={module.parameters.max_iter || 100}
              onChange={(v) => onParamChange("max_iter", v)}
            />
          </>
          ; case ModuleType.NegativeBinomialRegression: return{" "}
          <>
            <PropertyDisplay
              label="Model Purpose"
              value="Regression (Overdispersed Count Data)"
            />
            <PropertySelect
              label="Distribution Type"
              value={module.parameters.distribution_type || "NegativeBinomial"}
              onChange={(v) => onParamChange("distribution_type", v)}
              options={["NegativeBinomial", "QuasiPoisson"]}
            />
            <PropertyInput
              label="Max Iterations"
              type="number"
              value={module.parameters.max_iter || 100}
              onChange={(v) => onParamChange("max_iter", v)}
            />
            <PropertyInput
              label="Dispersion (alpha)"
              type="number"
              value={module.parameters.disp || 1.0}
              onChange={(v) => onParamChange("disp", v)}
              step="0.1"
            />
          </>
          ;
          <PropertySelect
            label="Hyperparameter Tuning"
            value={module.parameters.tuning_enabled || "False"}
            onChange={(v) => onParamChange("tuning_enabled", v)}
            options={["False", "True"]}
          />
          {module.parameters.tuning_enabled === "True" && (
            <>
              <PropertySelect
                label="Tuning Strategy"
                value={module.parameters.tuning_strategy || "GridSearch"}
                onChange={(v) => onParamChange("tuning_strategy", v)}
                options={["GridSearch"]}
              />
              <PropertyInput
                label="C Candidates (comma-separated)"
                type="text"
                value={module.parameters.c_candidates || "0.01,0.1,1,10,100"}
                onChange={(v) => onParamChange("c_candidates", v)}
              />
              {module.parameters.penalty === "elasticnet" && (
                <PropertyInput
                  label="L1 Ratio Candidates (comma-separated)"
                  type="text"
                  value={module.parameters.l1_ratio_candidates || "0.2,0.5,0.8"}
                  onChange={(v) => onParamChange("l1_ratio_candidates", v)}
                />
              )}
              <PropertyInput
                label="CV Folds"
                type="number"
                min="2"
                value={module.parameters.cv_folds ?? 5}
                onChange={(v) => onParamChange("cv_folds", v)}
              />
              <PropertySelect
                label="Scoring Metric"
                value={module.parameters.scoring_metric || "accuracy"}
                onChange={(v) => onParamChange("scoring_metric", v)}
                options={["accuracy", "precision", "recall", "f1", "roc_auc"]}
              />
            </>
          )}
        </>
      );
    case ModuleType.NaiveBayes:
      return (
        <>
          <PropertyDisplay label="Model Purpose" value="Classification" />
          <PropertySelect
            label="Model Type"
            value={module.parameters.model_type || "GaussianNB"}
            onChange={(v) => onParamChange("model_type", v)}
            options={["GaussianNB", "MultinomialNB", "BernoulliNB"]}
          />
          <PropertyInput
            label="Alpha (Laplace Smoothing)"
            type="number"
            value={module.parameters.alpha || 1.0}
            onChange={(v) => onParamChange("alpha", v)}
            step="0.1"
          />
          <PropertySelect
            label="Fit Prior"
            value={module.parameters.fit_prior || "True"}
            onChange={(v) => onParamChange("fit_prior", v)}
            options={["True", "False"]}
          />
          <PropertySelect
            label="Hyperparameter Tuning"
            value={module.parameters.tuning_enabled || "False"}
            onChange={(v) => onParamChange("tuning_enabled", v)}
            options={["False", "True"]}
          />
        </>
      );
    case ModuleType.DecisionTree: {
      const purpose = module.parameters.model_purpose;
      const handlePurposeChange = (newPurpose: string) => {
        onParamChange("model_purpose", newPurpose);
        if (
          newPurpose === "classification" &&
          !["gini", "entropy"].includes(module.parameters.criterion)
        ) {
          onParamChange("criterion", "gini");
        } else if (
          newPurpose === "regression" &&
          ![
            "squared_error",
            "friedman_mse",
            "absolute_error",
            "poisson",
          ].includes(module.parameters.criterion)
        ) {
          onParamChange("criterion", "squared_error");
        }
      };
      return (
        <>
          <PropertySelect
            label="Model Purpose"
            value={purpose}
            onChange={handlePurposeChange}
            options={["classification", "regression"]}
          />
          <PropertyInput
            label="Max Depth"
            type="number"
            value={module.parameters.max_depth}
            onChange={(v) => onParamChange("max_depth", v)}
          />
          <PropertySelect
            label="Criterion"
            value={module.parameters.criterion}
            onChange={(v) => onParamChange("criterion", v)}
            options={
              purpose === "classification"
                ? ["gini", "entropy"]
                : ["squared_error", "friedman_mse", "absolute_error", "poisson"]
            }
          />
          <PropertyInput
            label="Min Samples Split"
            type="number"
            value={module.parameters.min_samples_split ?? 2}
            onChange={(v) => onParamChange("min_samples_split", v)}
          />
          {purpose === "classification" && (
            <PropertySelect
              label="Class Weight"
              value={module.parameters.class_weight ?? "None"}
              onChange={(v) =>
                onParamChange("class_weight", v === "None" ? null : v)
              }
              options={["None", "balanced"]}
            />
          )}
        </>
      );
    }
    case ModuleType.RandomForest: {
      const purpose = module.parameters.model_purpose;
      const handlePurposeChange = (newPurpose: string) => {
        onParamChange("model_purpose", newPurpose);
        if (
          newPurpose === "classification" &&
          !["gini", "entropy"].includes(module.parameters.criterion)
        ) {
          onParamChange("criterion", "gini");
        } else if (
          newPurpose === "regression" &&
          !["squared_error", "absolute_error", "poisson"].includes(
            module.parameters.criterion
          )
        ) {
          onParamChange("criterion", "squared_error");
        }
      };
      return (
        <>
          <PropertySelect
            label="Model Purpose"
            value={purpose}
            onChange={handlePurposeChange}
            options={["classification", "regression"]}
          />
          <PropertyInput
            label="n_estimators"
            type="number"
            value={module.parameters.n_estimators}
            onChange={(v) => onParamChange("n_estimators", v)}
          />
          <PropertyInput
            label="max_depth"
            type="number"
            value={module.parameters.max_depth}
            onChange={(v) => onParamChange("max_depth", v)}
          />
          <PropertySelect
            label="max_features"
            value={
              module.parameters.max_features === null
                ? "None"
                : typeof module.parameters.max_features === "number"
                ? `custom_${module.parameters.max_features}`
                : String(module.parameters.max_features)
            }
            onChange={(v) => {
              if (v === "None") {
                onParamChange("max_features", null);
              } else if (v === "auto" || v === "sqrt" || v === "log2") {
                onParamChange("max_features", v);
              } else if (v.startsWith("custom_")) {
                const numValue = parseFloat(v.replace("custom_", ""));
                if (!isNaN(numValue)) {
                  onParamChange("max_features", numValue);
                }
              }
            }}
            options={["None", "auto", "sqrt", "log2"]}
          />
          {typeof module.parameters.max_features === "number" && (
            <PropertyInput
              label="max_features (숫자)"
              type="number"
              value={module.parameters.max_features}
              onChange={(v) => {
                if (typeof v === "number") {
                  onParamChange("max_features", v);
                } else if (v === "" || v === null) {
                  onParamChange("max_features", null);
                }
              }}
            />
          )}
          <PropertySelect
            label="Criterion"
            value={module.parameters.criterion}
            onChange={(v) => onParamChange("criterion", v)}
            options={
              purpose === "classification"
                ? ["gini", "entropy"]
                : ["squared_error", "absolute_error", "poisson"]
            }
          />
        </>
      );
    }
    case ModuleType.GradientBoosting: {
      const purpose = module.parameters.model_purpose;
      return (
        <>
          <PropertySelect
            label="Model Purpose"
            value={purpose}
            onChange={(v) => onParamChange("model_purpose", v)}
            options={["classification", "regression"]}
          />
          <PropertyInput
            label="n_estimators"
            type="number"
            value={module.parameters.n_estimators}
            onChange={(v) => onParamChange("n_estimators", v)}
          />
          <PropertyInput
            label="learning_rate"
            type="number"
            value={module.parameters.learning_rate}
            onChange={(v) => onParamChange("learning_rate", v)}
            step="0.01"
          />
          <PropertyInput
            label="max_depth"
            type="number"
            value={module.parameters.max_depth}
            onChange={(v) => onParamChange("max_depth", v)}
          />
        </>
      );
    }
    case ModuleType.NeuralNetwork: {
      const purpose = module.parameters.model_purpose;
      const handlePurposeChange = (newPurpose: string) => {
        onParamChange("model_purpose", newPurpose);
      };
      return (
        <>
          <PropertySelect
            label="Model Purpose"
            value={purpose}
            onChange={handlePurposeChange}
            options={["classification", "regression"]}
          />
          <PropertyInput
            label="Hidden Layer Sizes"
            type="text"
            value={module.parameters.hidden_layer_sizes || "100"}
            onChange={(v) => onParamChange("hidden_layer_sizes", v)}
            placeholder="100 or 100,50"
          />
          <PropertySelect
            label="Activation"
            value={module.parameters.activation || "relu"}
            onChange={(v) => onParamChange("activation", v)}
            options={["relu", "tanh", "logistic"]}
          />
          <PropertyInput
            label="Max Iter"
            type="number"
            value={module.parameters.max_iter || 200}
            onChange={(v) => onParamChange("max_iter", v)}
          />
          <PropertyInput
            label="Random State"
            type="number"
            value={module.parameters.random_state || 2022}
            onChange={(v) => onParamChange("random_state", v)}
          />
        </>
      );
    }
    case ModuleType.SVM: {
      const kernel = module.parameters.kernel || "rbf";
      return (
        <>
          <PropertySelect
            label="Model Purpose"
            value={module.parameters.model_purpose || "classification"}
            onChange={(v) => onParamChange("model_purpose", v)}
            options={["classification", "regression"]}
          />
          <PropertySelect
            label="Kernel Type"
            value={kernel}
            onChange={(v) => onParamChange("kernel", v)}
            options={["linear", "rbf", "poly", "sigmoid"]}
          />
          <PropertyInput
            label="C (Regularization)"
            type="number"
            value={module.parameters.C || 1.0}
            onChange={(v) => onParamChange("C", v)}
            step="0.1"
          />
          <PropertyInput
            label="Gamma"
            value={module.parameters.gamma || "scale"}
            onChange={(v) => onParamChange("gamma", v)}
            placeholder="scale, auto, or number"
          />
          {kernel === "poly" && (
            <PropertyInput
              label="Degree"
              type="number"
              value={module.parameters.degree || 3}
              onChange={(v) => onParamChange("degree", v)}
            />
          )}
          <PropertySelect
            label="Probability Estimates"
            value={module.parameters.probability || "False"}
            onChange={(v) => onParamChange("probability", v)}
            options={["False", "True"]}
          />
          <PropertySelect
            label="Hyperparameter Tuning"
            value={module.parameters.tuning_enabled || "False"}
            onChange={(v) => onParamChange("tuning_enabled", v)}
            options={["False", "True"]}
          />
        </>
      );
    }
    case ModuleType.FeatureImportance: {
      const fiSource = getConnectedDataSource(module.id);
      const fiColumns = fiSource?.columns?.map((c) => c.name) || [];
      const fiParams = module.parameters || {};
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 uppercase font-bold mb-1">
              Label Column (정답 열)
            </label>
            {fiColumns.length > 0 ? (
              <select
                className="w-full text-sm border border-gray-300 rounded p-1.5"
                value={(fiParams.label_column as string) || ""}
                onChange={(e) => onParamChange("label_column", e.target.value)}
              >
                <option value="">(선택)</option>
                {fiColumns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full text-sm border border-gray-300 rounded p-1.5"
                defaultValue={(fiParams.label_column as string) || ""}
                placeholder="예: cnt"
                onBlur={(e) => onParamChange("label_column", e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase font-bold mb-1">
              n_repeats (셔플 반복수)
            </label>
            <input
              type="number"
              min={1}
              className="w-full text-sm border border-gray-300 rounded p-1.5"
              defaultValue={(fiParams.n_repeats as number) ?? 10}
              onBlur={(e) =>
                onParamChange("n_repeats", parseInt(e.target.value, 10) || 10)
              }
            />
          </div>
          <p className="text-[11px] text-gray-500">
            학습된 모델(model_in)과 데이터(data_in, 보통 test 분할)를 연결하세요. 순열 특징중요도는
            결정적(random_state=42)이며, 전체 코드 내보내기로 재현 가능한 표를 산출합니다.
          </p>
        </div>
      );
    }
    case ModuleType.EvaluateModel: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns?.map((c) => c.name) || [];

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a scored data module to configure evaluation.
          </p>
        );
      }

      // module.parameters가 undefined일 수 있으므로 안전하게 처리
      const params = module.parameters || {};

      // 연결된 Train Model을 찾아서 모델 타입 감지 및 기본값 설정
      // allConnections와 allModules를 사용해야 함
      const inputConnection = allConnections.find(
        (c) => c.to.moduleId === module.id
      );
      let detectedModelType: "classification" | "regression" | null = null;
      let trainModelLabelColumn: string | null = null;

      if (inputConnection) {
        const sourceModule = allModules.find(
          (m) => m.id === inputConnection.from.moduleId
        );

        // Score Model인 경우, 그 Score Model이 연결된 Train Model 찾기
        if (sourceModule?.type === ModuleType.ScoreModel) {
          const modelInputConnection = allConnections.find(
            (c) =>
              c.to.moduleId === sourceModule.id && c.to.portName === "model_in"
          );
          if (modelInputConnection) {
            const trainModelModule = allModules.find(
              (m) =>
                m.id === modelInputConnection.from.moduleId &&
                m.outputData?.type === "TrainedModelOutput"
            );
            if (trainModelModule?.outputData?.type === "TrainedModelOutput") {
              const trainedModel = trainModelModule.outputData;
              trainModelLabelColumn = trainedModel.labelColumn;
              if (trainedModel.modelPurpose) {
                detectedModelType = trainedModel.modelPurpose;
              } else {
                // modelType으로 분류 모델인지 확인 (간단한 체크)
                const classificationTypes = [
                  ModuleType.LogisticRegression,
                  ModuleType.LinearDiscriminantAnalysis,
                  ModuleType.NaiveBayes,
                ];
                detectedModelType = classificationTypes.includes(
                  trainedModel.modelType
                )
                  ? "classification"
                  : "regression";
              }
            }
          }
        }
      }

      const isClassification =
        detectedModelType === "classification" ||
        params.model_type === "classification";
      const thresholdValue = params.threshold ?? 0.5;

      return (
        <>
          <PropertySelect
            label="Actual Label Column"
            value={params.label_column || ""}
            onChange={(v) => onParamChange("label_column", v)}
            options={["", ...inputColumns]}
          />
          <PropertySelect
            label="Prediction Column"
            value={params.prediction_column || ""}
            onChange={(v) => onParamChange("prediction_column", v)}
            options={["", ...inputColumns]}
          />
          <PropertySelect
            label="Model Type"
            value={params.model_type || "regression"}
            onChange={(v) => onParamChange("model_type", v)}
            options={["regression", "classification"]}
          />
          {isClassification && (
            <PropertyInput
              label="Threshold"
              type="number"
              value={typeof thresholdValue === "number" ? thresholdValue : 0.5}
              onChange={(v) => {
                const newThreshold =
                  typeof v === "number" ? Math.round(v * 10) / 10 : 0.5; // 0.1 단위로 반올림
                onParamChange("threshold", newThreshold);
              }}
              step="0.1"
              min="0"
              max="1"
            />
          )}
        </>
      );
    }
    case ModuleType.StatModels:
      return (
        <PropertySelect
          label="Model Type"
          value={module.parameters.model}
          onChange={(v) => onParamChange("model", v)}
          options={[
            "OLS",
            "Logit",
            "Poisson",
            "NegativeBinomial",
            "Gamma",
            "Tweedie",
          ]}
        />
      );
    case ModuleType.DiversionChecker: {
      const sourceData = getConnectedDataSource(module.id);
      const inputColumns = sourceData?.columns || [];

      if (inputColumns.length === 0) {
        return (
          <p className="text-sm text-gray-500">
            Connect a data source to the 'data_in' port to configure.
          </p>
        );
      }

      const { feature_columns = [], label_column = null } = module.parameters;

      const handleFeatureChange = (colName: string, isChecked: boolean) => {
        const newFeatures = isChecked
          ? [...feature_columns, colName]
          : feature_columns.filter((c: string) => c !== colName);
        onParamChange("feature_columns", newFeatures);
      };

      const handleLabelChange = (colName: string) => {
        const newLabel = colName === "" ? null : colName;
        onParamChange("label_column", newLabel);
        // If the new label was a feature, unselect it as a feature
        if (newLabel && feature_columns.includes(newLabel)) {
          onParamChange(
            "feature_columns",
            feature_columns.filter((c: string) => c !== newLabel)
          );
        }
      };

      const handleSelectAllFeatures = (selectAll: boolean) => {
        if (selectAll) {
          const allFeatureCols = inputColumns
            .map((col) => col.name)
            .filter((name) => name !== label_column);
          onParamChange("feature_columns", allFeatureCols);
        } else {
          onParamChange("feature_columns", []);
        }
      };

      return (
        <div>
          <AIParameterRecommender
            module={module}
            inputColumns={inputColumns.map((c) => c.name)}
            projectName={projectName}
            updateModuleParameters={updateModuleParameters}
          />
          <div className="mb-4">
            <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">
              Label Column
            </h5>
            <select
              value={label_column || ""}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">공백</option>
              {inputColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs text-gray-700 dark:text-gray-500 uppercase font-bold">
                Feature Columns
              </h5>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectAllFeatures(true)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAllFeatures(false)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md font-semibold text-gray-900 dark:text-white"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="space-y-2 pr-2">
              {inputColumns.map((col) => (
                <label
                  key={col.name}
                  className="flex items-center gap-2 text-sm truncate text-gray-900 dark:text-white"
                  title={col.name}
                >
                  <input
                    type="checkbox"
                    checked={feature_columns.includes(col.name)}
                    onChange={(e) =>
                      handleFeatureChange(col.name, e.target.checked)
                    }
                    disabled={col.name === label_column}
                    className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span
                    className={
                      col.name === label_column
                        ? "text-gray-500 line-through"
                        : ""
                    }
                  >
                    {col.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case ModuleType.JMDCCohortBuilder: {
      const {
        data_source = "synthetic",
        synthetic_n = 100000,
        synthetic_seed = 43,
        index_date_rule = "birthday_age",
        index_age = 50,
        index_fixed_date = "2018-01-01",
        age_at_index_min = 30,
        age_at_index_max = 70,
        washout_years = 2,
        exclusion_diseases = ["C00-C97"],
        disease_free_years = 0,
      } = module.parameters;

      const dataSourceOptions = [
        {
          value: "synthetic",
          label: "Synthetic (오프라인 데모용 가상 데이터)",
          description:
            "내장 생성기로 JMDC-유사 가상 데이터를 만듭니다. 외부 입력 없이 단독 실행 가능합니다.",
        },
        {
          value: "csv",
          label: "CSV (data_in 포트로 연결된 CSV 사용)",
          description:
            "Load Data 등으로 연결된 CSV(member·claim·disease long format)를 사용합니다. data_in 포트 연결이 필요합니다.",
        },
        {
          value: "supabase",
          label: "Supabase (data_in 포트로 연결된 Supabase 테이블 사용)",
          description:
            "Supabase에서 로드해 data_in 포트로 연결된 데이터를 사용합니다. data_in 포트 연결이 필요합니다.",
        },
      ];

      const indexDateRuleOptions = [
        {
          value: "birthday_age",
          label: "birthday_age (생일 기준 만 N세 시점)",
          description:
            "member의 birth_date에 지정한 Index Age(년)을 더해 Index Date를 정합니다.",
        },
        {
          value: "enrollment_date",
          label: "enrollment_date (가입/첫 관찰 시점)",
          description: "member의 first_obs_date를 Index Date로 사용합니다.",
        },
        {
          value: "fixed_date",
          label: "fixed_date (고정 일자)",
          description:
            "모든 member에 대해 Index Fixed Date를 Index Date로 사용합니다.",
        },
      ];

      const exclusionStr = Array.isArray(exclusion_diseases)
        ? exclusion_diseases.join(", ")
        : String(exclusion_diseases ?? "");

      return (
        <div>
          <PropertySelect
            label="Data Source"
            value={data_source}
            onChange={(v) => onParamChange("data_source", v)}
            options={dataSourceOptions}
          />
          {data_source === "synthetic" && (
            <>
              <PropertyInput
                label="Synthetic N (생성할 가상 member 수)"
                type="number"
                value={synthetic_n}
                onChange={(v) => onParamChange("synthetic_n", v)}
                description="합성 데이터 모드에서 생성할 가상 member 수입니다."
              />
              <PropertyInput
                label="Synthetic Seed (재현용 난수 시드)"
                type="number"
                value={synthetic_seed}
                onChange={(v) => onParamChange("synthetic_seed", v)}
                description="같은 시드를 쓰면 동일한 합성 데이터가 재현됩니다."
              />
            </>
          )}
          <PropertySelect
            label="Index Date Rule"
            value={index_date_rule}
            onChange={(v) => onParamChange("index_date_rule", v)}
            options={indexDateRuleOptions}
          />
          {index_date_rule === "birthday_age" && (
            <PropertyInput
              label="Index Age (만 N세 시점)"
              type="number"
              value={index_age}
              onChange={(v) => onParamChange("index_age", v)}
              description="birthday_age 규칙에서 Index Date로 잡을 만 나이입니다."
            />
          )}
          {index_date_rule === "fixed_date" && (
            <PropertyInput
              label="Index Fixed Date (YYYY-MM-DD)"
              value={index_fixed_date}
              onChange={(v) => onParamChange("index_fixed_date", v)}
              placeholder="2018-01-01"
              description="fixed_date 규칙에서 모든 member의 공통 Index Date입니다."
            />
          )}
          <PropertyInput
            label="Age at Index — Min"
            type="number"
            value={age_at_index_min}
            onChange={(v) => onParamChange("age_at_index_min", v)}
            description="Index Date 시점의 최소 연령(이상). 미만은 코호트에서 제외됩니다."
          />
          <PropertyInput
            label="Age at Index — Max"
            type="number"
            value={age_at_index_max}
            onChange={(v) => onParamChange("age_at_index_max", v)}
            description="Index Date 시점의 최대 연령(이하). 초과는 코호트에서 제외됩니다."
          />
          <PropertyInput
            label="Washout Years (Index 이전 관찰 기간)"
            type="number"
            value={washout_years}
            onChange={(v) => onParamChange("washout_years", v)}
            description="Index Date 이전에 최소 몇 년의 연속 관찰 기록이 있어야 하는지입니다."
          />
          <PropertyInput
            label="Exclusion Diseases (ICD-10 prefix, comma-separated)"
            value={exclusionStr}
            onChange={(v) =>
              onParamChange(
                "exclusion_diseases",
                String(v ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder="C00-C97, I20"
            description="Index Date 이전 이 ICD-10 코드 prefix(또는 범위)에 해당하면 제외됩니다. 콤마로 구분."
          />
          <PropertyInput
            label="Disease-free Years"
            type="number"
            value={disease_free_years}
            onChange={(v) => onParamChange("disease_free_years", v)}
            description="Index Date 이전 N년간 Exclusion Diseases가 없어야 코호트에 포함됩니다. 0이면 미적용."
          />
        </div>
      );
    }
    default:
      const hasParams = Object.keys(module.parameters).length > 0;
      if (!hasParams) {
        return (
          <p className="text-sm text-gray-500">
            This module has no configurable parameters.
          </p>
        );
      }
      return (
        <div>
          {Object.entries(module.parameters).map(([key, value]) => {
            if (typeof value === "boolean") {
              return (
                <PropertySelect
                  key={key}
                  label={key}
                  value={value ? "True" : "False"}
                  onChange={(v) => onParamChange(key, v === "True")}
                  options={["True", "False"]}
                />
              );
            }
            if (typeof value === "number") {
              return (
                <PropertyInput
                  key={key}
                  label={key}
                  value={value}
                  type="number"
                  onChange={(v) => onParamChange(key, v)}
                />
              );
            }
            return (
              <PropertyInput
                key={key}
                label={key}
                value={value}
                onChange={(v) => onParamChange(key, v)}
              />
            );
          })}
        </div>
      );
  }
};

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex justify-between items-center text-sm py-1.5 px-2 border-b border-gray-700 last:border-b-0">
    <span className="text-gray-400">{label}</span>
    <span
      className="font-mono text-gray-200 font-medium truncate"
      title={String(value)}
    >
      {value}
    </span>
  </div>
);

const ColumnInfoTable: React.FC<{
  columns: ColumnInfo[];
  highlights?: Record<string, { color?: string; strikethrough?: boolean }>;
}> = ({ columns, highlights = {} }) => (
  <div className="text-sm">
    {columns.map((col) => {
      const highlight = highlights[col.name] || {};
      const colorClass = highlight.color
        ? `text-${highlight.color}-400`
        : "text-gray-200";
      const strikethroughClass = highlight.strikethrough ? "line-through" : "";

      return (
        <div
          key={col.name}
          className="flex justify-between items-center py-1 px-2 border-b border-gray-700 last:border-b-0"
        >
          <span
            className={`font-mono truncate ${colorClass} ${strikethroughClass}`}
          >
            {col.name}
          </span>
          <span className="text-gray-500 font-mono">{col.type}</span>
        </div>
      );
    })}
  </div>
);

const DataStatsSummary: React.FC<{ data: DataPreview; title?: string }> = ({
  data,
  title,
}) => {
  const numericCols = useMemo(
    () => data.columns.filter((c) => c.type === "number"),
    [data.columns]
  );
  const rows = useMemo(() => data.rows || [], [data.rows]);

  return (
    <div>
      {title && (
        <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
          {title}
        </h4>
      )}
      <div className="space-y-2">
        {numericCols.map((col) => {
          const values = rows
            .map((r) => r[col.name] as number)
            .filter((v) => typeof v === "number" && !isNaN(v));
          if (values.length === 0) return null;
          const sum = values.reduce((a, b) => a + b, 0);
          const mean = sum / values.length;
          const stdDev = Math.sqrt(
            values
              .map((x) => Math.pow(x - mean, 2))
              .reduce((a, b) => a + b, 0) / values.length
          );
          return (
            <div key={col.name} className="bg-gray-800 p-2 rounded">
              <p className="font-semibold text-sm truncate">{col.name}</p>
              <div className="grid grid-cols-2 gap-x-2 text-xs">
                <StatRow label="Mean" value={mean.toFixed(2)} />
                <StatRow label="Std Dev" value={stdDev.toFixed(2)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MissingValueSummary: React.FC<{ data: DataPreview; title?: string }> = ({
  data,
  title,
}) => {
  const missingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!data.columns) return [];
    data.columns.forEach((col) => {
      counts[col.name] = (data.rows || []).filter(
        (row) => row[col.name] == null || row[col.name] === ""
      ).length;
    });
    return Object.entries(counts);
  }, [data]);

  return (
    <div>
      {title && (
        <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
          {title}
        </h4>
      )}
      <StatRow label="Total Rows" value={data.totalRowCount.toLocaleString()} />
      <StatRow label="Total Columns" value={data.columns.length} />
      <h5 className="text-xs text-gray-500 uppercase font-bold my-2">
        Missing Values per Column
      </h5>
      {missingCounts.length > 0 ? (
        <div className="max-h-96 overflow-y-auto panel-scrollbar pr-2">
          {missingCounts.map(([name, count]) => {
            const percentage =
              data.totalRowCount > 0
                ? ((count / data.totalRowCount) * 100).toFixed(1)
                : "0.0";
            return (
              <StatRow
                key={name}
                label={name}
                value={`${count} (${percentage}%)`}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center p-2">
          No columns in input data.
        </p>
      )}
    </div>
  );
};

const DataTableStats: React.FC<{
  data: DataPreview;
  title?: string;
  highlightedColumns?: string[];
}> = ({ data, title, highlightedColumns = [] }) => {
  const numericCols = useMemo(
    () => data.columns.filter((c) => c.type === "number"),
    [data.columns]
  );
  const rows = useMemo(() => data.rows || [], [data.rows]);

  const colStats = useMemo(() => {
    const stats: Record<
      string,
      { mean: number; std: number; min: number; max: number }
    > = {};
    numericCols.forEach((col) => {
      const values = rows
        .map((r) => r[col.name] as number)
        .filter((v) => typeof v === "number" && !isNaN(v));
      if (values.length === 0) return;
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      const std = Math.sqrt(
        values.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) /
          values.length
      );
      const min = Math.min(...values);
      const max = Math.max(...values);
      stats[col.name] = { mean, std, min, max };
    });
    return stats;
  }, [numericCols, rows]);

  return (
    <div>
      {title && (
        <h3 className="text-md font-semibold mb-2 text-gray-300">{title}</h3>
      )}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="text-gray-200">
          {/* Header */}
          <div className="grid grid-cols-5 gap-4 px-4 py-2 border-b border-gray-600 font-semibold text-sm text-gray-400">
            <div className="col-span-1">Column</div>
            <div className="text-right">Mean</div>
            <div className="text-right">Std Dev</div>
            <div className="text-right">Min</div>
            <div className="text-right">Max</div>
          </div>
          {/* Body */}
          <div className="max-h-96 overflow-y-auto panel-scrollbar">
            {Object.keys(colStats).map((colName) => {
              const stats = colStats[colName];
              const isHighlighted = highlightedColumns.includes(colName);
              return (
                <div
                  key={colName}
                  className="grid grid-cols-5 gap-4 px-4 py-2.5 text-sm border-b border-gray-800 last:border-b-0"
                >
                  <div
                    className={`font-mono truncate ${
                      isHighlighted ? "text-red-400" : ""
                    }`}
                    title={colName}
                  >
                    {colName}
                  </div>
                  <div className="font-mono text-right">
                    {stats.mean.toFixed(2)}
                  </div>
                  <div className="font-mono text-right">
                    {stats.std.toFixed(2)}
                  </div>
                  <div className="font-mono text-right">
                    {stats.min.toFixed(2)}
                  </div>
                  <div className="font-mono text-right">
                    {stats.max.toFixed(2)}
                  </div>
                </div>
              );
            })}
            {Object.keys(colStats).length === 0 && (
              <p className="text-sm text-gray-500 text-center p-4">
                No numeric columns to display stats for.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PanelModelMetrics: React.FC<{
  metrics: Record<string, string | number>;
}> = ({ metrics }) => (
  <div>
    <h3 className="text-md font-semibold mb-2 text-gray-300">
      Performance Metrics
    </h3>
    <div className="bg-gray-800 rounded-lg p-3 space-y-2">
      {Object.entries(metrics).map(([key, value]) => (
        <StatRow
          key={key}
          label={key}
          value={typeof value === "number" ? Number(value).toFixed(4) : value}
        />
      ))}
    </div>
  </div>
);

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  module,
  projectName,
  updateModuleParameters,
  updateModuleName,
  onUpdateNotes,
  logs,
  modules,
  connections,
  activeTab,
  setActiveTab,
  onViewDetails,
  folderHandle,
  onRunModule,
  validationError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<"입력" | "출력">(
    "입력"
  );
  const [localModuleName, setLocalModuleName] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showRAGModal, setShowRAGModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [exampleDataList, setExampleDataList] = useState<
    Array<{ name: string; content: string }>
  >([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (module) {
      setLocalModuleName(module.name);
      setActivePreviewTab(
        module.status === ModuleStatus.Success ? "출력" : "입력"
      );
    }
  }, [module]);

  // Prep Missing 모듈의 columnSelections 초기화
  useEffect(() => {
    if (module?.type === ModuleType.HandleMissingValues) {
      const sourceData = getConnectedDataSourceHelper(
        module.id,
        modules,
        connections
      );
      const inputColumns = sourceData?.columns || [];
      const currentSelections = module.parameters.columnSelections || {};

      // 기본값: 모든 열이 선택되지 않은 경우 모든 열을 선택으로 설정
      if (
        inputColumns.length > 0 &&
        Object.keys(currentSelections).length === 0
      ) {
        const hasAnySelection = inputColumns.some(
          (col) => currentSelections[col.name]?.selected === true
        );
        if (!hasAnySelection) {
          // 모든 열을 기본값으로 선택
          const newSelections: Record<
            string,
            { selected: boolean; type: string }
          > = {};
          // 입력 컬럼 타입을 그대로 사용 (이미 pandas dtype)
          const getPandasDtype = (colType: string): string => {
            return colType;
          };

          inputColumns.forEach((col) => {
            newSelections[col.name] = {
              selected: true,
              type: getPandasDtype(col.type),
            };
          });
          updateModuleParameters(module.id, {
            columnSelections: newSelections,
          });
        }
      }
    }
  }, [
    module?.id,
    module?.type,
    module?.parameters.columnSelections,
    modules,
    connections,
    updateModuleParameters,
  ]);

  // SelectData 모듈의 columnSelections 초기화
  useEffect(() => {
    if (!module || module.type !== ModuleType.SelectData) return;

    const sourceData = getConnectedDataSourceHelper(
      module.id,
      modules,
      connections
    );
    const inputColumns = sourceData?.columns || [];
    const currentSelections = module.parameters.columnSelections || {};

    // 입력 컬럼 타입을 그대로 사용 (이미 pandas dtype)
    const getPandasDtype = (colType: string): string => {
      return colType;
    };

    // 기본값: 모든 열이 선택되지 않은 경우 모든 열을 선택으로 설정
    if (
      inputColumns.length > 0 &&
      Object.keys(currentSelections).length === 0
    ) {
      const hasAnySelection = inputColumns.some(
        (col) => currentSelections[col.name]?.selected === true
      );
      if (!hasAnySelection) {
        // 모든 열을 기본값으로 선택 (원본 타입 유지)
        const newSelections: Record<
          string,
          { selected: boolean; type: string }
        > = {};

        inputColumns.forEach((col) => {
          newSelections[col.name] = {
            selected: true,
            type: getPandasDtype(col.type), // 원본 pandas dtype 사용
          };
        });
        updateModuleParameters(module.id, {
          columnSelections: newSelections,
        });
      }
    }
  }, [
    module?.id,
    module?.type,
    module?.parameters.columnSelections,
    modules,
    connections,
    updateModuleParameters,
  ]);

  // VIF Checker 모듈의 feature_columns 초기화
  useEffect(() => {
    if (!module || module.type !== ModuleType.VIFChecker) return;

    const sourceData = getConnectedDataSourceHelper(
      module.id,
      modules,
      connections
    );
    const inputColumns = sourceData?.columns || [];
    const currentFeatureColumns = module.parameters.feature_columns || [];

    // 숫자형 열만 필터링
    const numericColumns = inputColumns.filter(
      (col) =>
        col && (col.type.startsWith("int") || col.type.startsWith("float"))
    );

    // 기본값: feature_columns가 비어있고 숫자형 열이 있으면 모든 숫자형 열을 기본값으로 선택
    if (
      numericColumns.length > 0 &&
      (!Array.isArray(currentFeatureColumns) ||
        currentFeatureColumns.length === 0)
    ) {
      const allNumericColumnNames = numericColumns.map((col) => col.name);
      updateModuleParameters(module.id, {
        ...module.parameters,
        feature_columns: allNumericColumnNames,
      });
    }
  }, [
    module?.id,
    module?.type,
    module?.parameters.feature_columns,
    modules,
    connections,
  ]);

  // Prep Normalize 모듈의 columnSelections 초기화
  useEffect(() => {
    if (!module || module.type !== ModuleType.ScalingTransform) return;

    const sourceData = getConnectedDataSourceHelper(
      module.id,
      modules,
      connections
    );
    const inputColumns = sourceData?.columns || [];
    const currentSelections = module.parameters.columnSelections || {};

    // 입력 컬럼 타입을 그대로 사용 (이미 pandas dtype)
    const getPandasDtype = (colType: string): string => {
      return colType;
    };

    // pandas dtype이 숫자형인지 확인하는 함수
    const isNumericDtype = (dtype: string): boolean => {
      return dtype.startsWith("int") || dtype.startsWith("float");
    };

    // 기본값: 모든 숫자형 열이 선택되지 않은 경우 모든 숫자형 열을 선택으로 설정
    if (
      inputColumns.length > 0 &&
      Object.keys(currentSelections).length === 0
    ) {
      const hasAnySelection = inputColumns.some((col) => {
        const pandasDtype = getPandasDtype(col.type);
        return (
          isNumericDtype(pandasDtype) &&
          currentSelections[col.name]?.selected === true
      );
      });
      if (!hasAnySelection) {
        // 모든 숫자형 열을 기본값으로 선택
        const newSelections: Record<
          string,
          { selected: boolean; type: string }
        > = {};
        inputColumns.forEach((col) => {
          const pandasDtype = getPandasDtype(col.type);
          if (isNumericDtype(pandasDtype)) {
            newSelections[col.name] = {
              selected: true,
              type: pandasDtype,
            };
          }
        });
        if (Object.keys(newSelections).length > 0) {
          updateModuleParameters(module.id, {
            columnSelections: newSelections,
          });
        }
      }
    }
  }, [
    module?.id,
    module?.type,
    module?.parameters.columnSelections,
    modules,
    connections,
    updateModuleParameters,
  ]);

  // Examples_in_Load 디렉토리에서 예제 데이터 로드
  useEffect(() => {
    const loadExamples = async () => {
      if (
        module?.type !== ModuleType.LoadData &&
        module?.type !== ModuleType.XolLoading
      ) {
        return;
      }

      setIsLoadingExamples(true);
      try {
        // 빌드 시점에 생성된 JSON 파일을 직접 로드
        console.log("Loading examples from /examples-in-load.json...");
        const response = await fetch("/examples-in-load.json", {
          cache: "no-cache", // 캐시 방지
        });

        console.log(
          `Response status: ${response.status} ${response.statusText}`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch examples-in-load.json: ${response.status} ${response.statusText}`
          );
        }

        const examplesData = await response.json();
        console.log(
          `Received examples data:`,
          Array.isArray(examplesData)
            ? `${examplesData.length} items`
            : "not an array"
        );

        if (Array.isArray(examplesData)) {
          // JSON 파일에는 이미 name, filename, content가 포함되어 있음
          const validExamples = examplesData.map((ex: any) => ({
            name: ex.name || ex.filename,
            content: ex.content,
          }));
          
          // boston_housing.csv가 있는지 확인하고 제거
          const filteredExamples = validExamples.filter((ex: any) => {
            const name = ex.name || "";
            const isOldBoston = name.toLowerCase() === "boston_housing.csv";
            if (isOldBoston) {
              console.warn(`⚠ Filtering out old file: ${name}`);
            }
            return !isOldBoston;
          });

          setExampleDataList(filteredExamples);
          if (filteredExamples.length === 0) {
            console.warn("No examples loaded from examples-in-load.json");
          } else {
            console.log(
              `✓ Loaded ${filteredExamples.length} examples from examples-in-load.json`
            );
            console.log(
              `✓ Example files: ${filteredExamples
                .map((ex: any) => ex.name)
                .join(", ")}`
            );
            const bostonHousing = filteredExamples.find(
              (ex: any) => ex.name === "BostonHousing.csv"
            );
            const oldBoston = filteredExamples.find(
              (ex: any) =>
                (ex.name || "").toLowerCase() === "boston_housing.csv"
            );
            if (bostonHousing) {
              console.log(`✓ BostonHousing.csv is available`);
            } else {
              console.warn(`⚠ BostonHousing.csv NOT found in loaded examples`);
            }
            if (oldBoston) {
              console.error(
                `✗ ERROR: boston_housing.csv still exists in examples!`
              );
            }
          }
        } else {
          console.warn(
            "Invalid examples-in-load.json format - expected array, got:",
            typeof examplesData
          );
          setExampleDataList([]);
        }
      } catch (error: any) {
        console.error("Error loading examples:", error);
        console.error("Error details:", error.message, error.stack);
        // 에러 발생 시 빈 배열로 설정 (서버 없이도 작동하도록)
        setExampleDataList([]);
      } finally {
        setIsLoadingExamples(false);
      }
    };

    loadExamples();
  }, [module?.type]);

  const handleParamChange = useCallback(
    (key: string, value: any) => {
      if (module) {
        updateModuleParameters(module.id, { [key]: value });
      }
    },
    [module, updateModuleParameters]
  );

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file && module) {
      const fileName = file.name.toLowerCase();

      if (
        (module.type === ModuleType.LoadData ||
          module.type === ModuleType.XolLoading) &&
        (fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))
      ) {
        // 엑셀 파일 처리
        try {
          const xlsx = await loadXLSX();
          const arrayBuffer = await file.arrayBuffer();
          const workbook = xlsx.read(arrayBuffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];

          const convertExcelToCSV = async (
            workbook: any,
            sheetName?: string
          ): Promise<string> => {
            const targetSheet = sheetName || workbook.SheetNames[0];
            const worksheet = workbook.Sheets[targetSheet];
            const jsonData = xlsx.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: null,
              raw: false,
            });

            return jsonData
              .map((row: any) => {
                return row
                  .map((cell: any) => {
                    if (cell === null || cell === undefined) return "";
                    const str = String(cell);
                    if (
                      str.includes(",") ||
                      str.includes('"') ||
                      str.includes("\n")
                    ) {
                      return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                  })
                  .join(",");
              })
              .join("\n");
          };

          const csvContent = await convertExcelToCSV(workbook, firstSheetName);
          cacheFileContent(file.name, csvContent);
          updateModuleParameters(module.id, {
            source: file.name,
            fileContent: csvContent,
            fileType: "excel",
            sheetName: firstSheetName,
            sourceType: "file",
          });
        } catch (error) {
          console.error("Error processing Excel file:", error);
          alert("엑셀 파일 처리 중 오류가 발생했습니다.");
        }
      } else {
        // CSV 파일 처리
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          cacheFileContent(file.name, content);
          updateModuleParameters(module.id, {
            source: file.name,
            fileContent: content,
            fileType: "csv",
            sourceType: "file",
          });
        };
        reader.readAsText(file);
      }
    }
  };

  const handleLoadSample = (sample: { name: string; content: string }) => {
    if (module) {
      updateModuleParameters(module.id, {
        source: sample.name,
        fileContent: sample.content,
        sourceType: "file",
      });
    }
  };

  const handleNameInputBlur = () => {
    if (module && localModuleName.trim() && localModuleName !== module.name) {
      updateModuleName(module.id, localModuleName.trim());
    } else if (module) {
      setLocalModuleName(module.name); // revert if empty or unchanged
    }
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleNameInputBlur();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      if (module) setLocalModuleName(module.name);
      e.currentTarget.blur();
    }
  };

  const codeSnippet = useMemo(() => getModuleCode(module), [module]);

  const handleCopyCode = useCallback(() => {
    if (codeSnippet) {
      navigator.clipboard
        .writeText(codeSnippet)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Failed to copy code: ", err);
        });
    }
  }, [codeSnippet]);

  const getConnectedModelSource = useCallback(
    (moduleId: string): CanvasModule | undefined => {
      const modelInputConnection = connections.find(
        (c) => c.to.moduleId === moduleId && c.to.portName === "model_in"
      );
      if (!modelInputConnection) return undefined;
      return modules.find((m) => m.id === modelInputConnection.from.moduleId);
    },
    [modules, connections]
  );

  const getConnectedDataSource = useCallback(
    (moduleId: string, portNameToFind?: string) => {
      return getConnectedDataSourceHelper(
        moduleId,
        modules,
        connections,
        portNameToFind
      );
    },
    [modules, connections]
  );

  const renderInputPreview = () => {
    if (!module) return null;

    const handlerConnection = connections.find(
      (c) => c.to.moduleId === module.id && c.to.portName === "handler_in"
    );
    const handlerSourceModule = handlerConnection
      ? modules.find((m) => m.id === handlerConnection.from.moduleId)
      : undefined;
    const handler = handlerSourceModule?.outputData as
      | MissingHandlerOutput
      | EncoderOutput
      | NormalizerOutput
      | undefined;

    if (
      module.type === ModuleType.LoadData ||
      module.type === ModuleType.XolLoading
    ) {
      return (
        <StatRow label="File Name" value={module.parameters.source || "N/A"} />
      );
    }

    if (module.type === ModuleType.TrainModel) {
      const modelSource = getConnectedModelSource(module.id);
      if (!modelSource) {
        return (
          <div className="text-center text-gray-500 p-4">
            Connect a model module to 'model_in'.
          </div>
        );
      }

      // Linear Regression 모듈의 경우 model_type 파라미터에서 실제 모델 타입 가져오기
      let modelTypeDisplay = modelSource.type;
      if (modelSource.type === ModuleType.LinearRegression) {
        const modelTypeParam = modelSource.parameters?.model_type;
        if (modelTypeParam && typeof modelTypeParam === "string") {
          modelTypeDisplay = modelTypeParam;
        }
      } else if (modelSource.type === ModuleType.LogisticRegression) {
        // Logistic Regression의 경우 penalty와 C를 조합하여 표시
        const penalty = modelSource.parameters?.penalty || "l2";
        const C = modelSource.parameters?.C || 1.0;
        modelTypeDisplay = `LogisticRegression (${penalty}, C=${C})`;
      }

      return <StatRow label="Model Type" value={modelTypeDisplay} />;
    }

    const inputData = getConnectedDataSource(module.id);
    if (!inputData) {
      return (
        <div className="text-center text-gray-500 p-4">
          Input data not available. Connect a preceding module.
        </div>
      );
    }

    switch (module.type) {
      case ModuleType.ResampleData: {
        const targetColumn = module.parameters.target_column;
        if (!targetColumn)
          return (
            <p className="text-sm text-gray-500">
              Select a target column to see value counts.
            </p>
          );

        const counts: Record<string, number> = {};
        (inputData.rows || []).forEach((row) => {
          const key = String(row[targetColumn]);
          counts[key] = (counts[key] || 0) + 1;
        });

        return (
          <div>
            <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
              Value Counts for '{targetColumn}'
            </h4>
            {Object.keys(counts).length > 0 ? (
              Object.entries(counts).map(([key, value]) => (
                <StatRow key={key} label={key} value={value} />
              ))
            ) : (
              <p className="text-sm text-gray-500">No data to count.</p>
            )}
          </div>
        );
      }
      case ModuleType.Statistics:
      case ModuleType.SelectData:
        return <ColumnInfoTable columns={inputData.columns} />;
      case ModuleType.EncodeCategorical: {
        const categoricalColumns = inputData.columns.filter(
          (c) => c.type === "string"
        );
        return (
          <div>
            <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
              Categorical Columns Found
            </h4>
            {categoricalColumns.length > 0 ? (
              <ColumnInfoTable columns={categoricalColumns} />
            ) : (
              <p className="text-sm text-gray-500">
                No string columns to encode.
              </p>
            )}
          </div>
        );
      }
      case ModuleType.HandleMissingValues:
        return <MissingValueSummary data={inputData} />;
      case ModuleType.ScalingTransform:
        return <DataTableStats data={inputData} />;
      case ModuleType.FeatureEngineer:
        return <DataStatsSummary data={inputData} />;
      case ModuleType.TransitionData:
        return <DataStatsSummary data={inputData} />;
      case ModuleType.SplitData:
      case ModuleType.ScoreModel:
        return (
          <div>
            <StatRow
              label="Total Rows"
              value={inputData.totalRowCount.toLocaleString()}
            />
            <StatRow label="Total Columns" value={inputData.columns.length} />
          </div>
        );
      default:
        return <ColumnInfoTable columns={inputData.columns} />;
    }
  };

  // canVisualize 함수를 renderOutputPreview 외부로 이동
  const visualizableTypes = [
    "DataPreview",
    "StatisticsOutput",
    "SplitDataOutput",
    "TrainedModelOutput",
    "StatsModelsResultOutput",
    "EvaluationOutput",
    "KMeansOutput",
    "PCAOutput",
    "TrainedClusteringModelOutput",
    "ClusteringDataOutput",
    "MissingHandlerOutput",
    "EncoderOutput",
    "NormalizerOutput",
    "ColumnPlotOutput",
    "OutlierDetectorOutput",
    "VIFCheckerOutput",
  ];

  const canVisualize = () => {
    if (!module || !module.outputData) return false;
    if (visualizableTypes.includes(module.outputData.type)) return true;
    if (
      [
        "KMeansOutput",
        "TrainedClusteringModelOutput",
        "ClusteringDataOutput",
      ].includes(module.outputData.type)
    )
      return true;
    return false;
  };

  const renderOutputPreview = () => {
    if (
      !module ||
      module.status !== ModuleStatus.Success ||
      !module.outputData
    ) {
      return (
        <div className="text-center text-gray-500 p-4">
          Run the module successfully to see the output.
        </div>
      );
    }
    const outputData = module.outputData;

    const visualizableTypes = [
      "DataPreview",
      "StatisticsOutput",
      "SplitDataOutput",
      "TrainedModelOutput",
      "StatsModelsResultOutput",
      "XoLPriceOutput",
      "FinalXolPriceOutput",
      "EvaluationOutput",
      "KMeansOutput",
      "PCAOutput",
      "TrainedClusteringModelOutput",
      "ClusteringDataOutput",
      "DiversionCheckerOutput",
      "EvaluateStatOutput",
      "MissingHandlerOutput",
      "EncoderOutput",
      "NormalizerOutput",
      "ColumnPlotOutput",
      "OutlierDetectorOutput",
    ];

    const canVisualize = () => {
      if (!module || !module.outputData) return false;
      if (visualizableTypes.includes(module.outputData.type)) return true;
      if (
        [
          "KMeansOutput",
          "TrainedClusteringModelOutput",
          "ClusteringDataOutput",
        ].includes(module.outputData.type)
      )
        return true;
      return false;
    };

    const renderTitle = (title: string) => (
      <h3 className="text-md font-semibold mb-2 text-gray-300">{title}</h3>
    );

    const previewContent = (() => {
      switch (module.type) {
        case ModuleType.LoadData:
          if (outputData.type === "DataPreview") {
            return (
              <>
                <h3 className="text-md font-semibold mb-2 text-gray-300">
                  Column Structure
                </h3>
                <ColumnInfoTable columns={outputData.columns} />
              </>
            );
          }
          break;
        case ModuleType.Statistics:
          if (outputData.type === "StatisticsOutput") {
            return (
              <div>
                {renderTitle("Column Statistics")}
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <div className="text-gray-200">
                    {/* Header */}
                    <div className="grid grid-cols-4 gap-4 px-4 py-2 border-b border-gray-600 font-semibold text-sm text-gray-400">
                      <div>Column</div>
                      <div className="text-right">Mean</div>
                      <div className="text-right">Median</div>
                      <div className="text-right">nulls</div>
                    </div>
                    {/* Body */}
                    <div className="max-h-96 overflow-y-auto panel-scrollbar">
                      {Object.keys(outputData.stats).map((col) => {
                        const columnStats = outputData.stats[col];
                        return (
                          <div
                            key={col}
                            className="grid grid-cols-4 gap-4 px-4 py-2.5 text-sm border-b border-gray-800 last:border-b-0"
                          >
                            <div className="font-mono truncate" title={col}>
                              {col}
                            </div>
                            <div className="font-mono text-right">
                              {typeof columnStats.mean === "number" &&
                              !isNaN(columnStats.mean)
                                ? columnStats.mean.toFixed(2)
                                : "N/A"}
                            </div>
                            <div className="font-mono text-right">
                              {typeof columnStats["50%"] === "number" &&
                              !isNaN(columnStats["50%"])
                                ? columnStats["50%"].toFixed(2)
                                : "N/A"}
                            </div>
                            <div className="font-mono text-right">
                              {columnStats.nulls}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          break;
        case ModuleType.SelectData:
          if (outputData.type === "DataPreview") {
            const originalData = getConnectedDataSource(module.id);
            const originalCols = originalData?.columns.map((c) => c.name) || [];
            const newCols = outputData.columns.map((c) => c.name);
            const removedCols = originalCols.filter(
              (c) => !newCols.includes(c)
            );

            const highlights: Record<string, { strikethrough: boolean }> = {};
            removedCols.forEach((colName) => {
              highlights[colName] = { strikethrough: true };
            });

            return (
              <ColumnInfoTable
                columns={originalData?.columns || []}
                highlights={highlights}
              />
            );
          }
          break;
        case ModuleType.VIFChecker:
          if (outputData.type === "VIFCheckerOutput") {
            const vifOutput = outputData as VIFCheckerOutput;
            return (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                    VIF Results
                  </h4>
                  <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Total Columns:</span>
                      <span className="font-mono text-gray-200 font-medium">
                        {vifOutput.results.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">High VIF (&gt; 10):</span>
                      <span className="font-mono text-red-400 font-medium">
                        {vifOutput.results.filter((r) => r.vif > 10).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        Moderate VIF (5-10):
                      </span>
                      <span className="font-mono text-red-300 font-medium">
                        {
                          vifOutput.results.filter(
                            (r) => r.vif > 5 && r.vif <= 10
                          ).length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Low VIF (≤ 5):</span>
                      <span className="font-mono text-gray-200 font-medium">
                        {vifOutput.results.filter((r) => r.vif <= 5).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          break;
        case ModuleType.Correlation:
          if (outputData.type === "CorrelationOutput") {
            const correlationOutput = outputData as CorrelationOutput;
            return (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                    Correlation Analysis Summary
                  </h4>
                  <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Total Columns:</span>
                      <span className="font-mono text-gray-200 font-medium">
                        {correlationOutput.columns.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Numeric Columns:</span>
                      <span className="font-mono text-gray-200 font-medium">
                        {correlationOutput.numericColumns.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        Categorical Columns:
                      </span>
                      <span className="font-mono text-gray-200 font-medium">
                        {correlationOutput.categoricalColumns.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Methods:</span>
                      <span className="font-mono text-gray-200 font-medium text-xs">
                        {correlationOutput.correlationMatrices
                          .map((m) => m.method)
                          .join(", ")}
                      </span>
                    </div>
                    {correlationOutput.heatmapImage && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Heatmap:</span>
                        <span className="font-mono text-green-400 font-medium">
                          Available
                        </span>
                      </div>
                    )}
                    {correlationOutput.pairplotImage && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Pairplot:</span>
                        <span className="font-mono text-green-400 font-medium">
                          Available
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          break;
        case ModuleType.ResampleData: {
          const inputData = getConnectedDataSource(module.id);
          if (!inputData || outputData.type !== "DataPreview") break;

          const targetColumn = module.parameters.target_column;
          if (!targetColumn)
            return (
              <p className="text-sm text-gray-500">
                Select a target column to see value counts.
              </p>
            );

          const counts: Record<string, number> = {};
          (outputData.rows || []).forEach((row) => {
            const key = String(row[targetColumn]);
            counts[key] = (counts[key] || 0) + 1;
          });
          return (
            <div>
              <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                Value Counts for '{targetColumn}'
              </h4>
              {Object.keys(counts).length > 0 ? (
                Object.entries(counts).map(([key, value]) => (
                  <StatRow key={key} label={key} value={value} />
                ))
              ) : (
                <p className="text-sm text-gray-500">No data to count.</p>
              )}
            </div>
          );
        }
        case ModuleType.SplitData:
          if (outputData.type === "SplitDataOutput") {
            return (
              <div className="space-y-4">
                <DataStatsSummary
                  data={outputData.train}
                  title="Train Data Summary"
                />
                <DataStatsSummary
                  data={outputData.test}
                  title="Test Data Summary"
                />
              </div>
            );
          }
          break;
        case ModuleType.TrainModel:
          if (outputData.type === "TrainedModelOutput") {
            const {
              modelType,
              coefficients,
              intercept,
              featureColumns,
              labelColumn,
            } = outputData;

            const complexModels = [
              ModuleType.DecisionTree,
              ModuleType.RandomForest,
              ModuleType.GradientBoosting,
              ModuleType.NeuralNetwork,
              ModuleType.SVM,
              ModuleType.KNN,
              ModuleType.NaiveBayes,
              ModuleType.LinearDiscriminantAnalysis,
            ];

            let formulaParts: string[] = [];
            if (!complexModels.includes(modelType)) {
              if (modelType === ModuleType.LogisticRegression) {
                formulaParts = [`ln(p / (1 - p)) = ${intercept.toFixed(4)}`];
              } else {
                formulaParts = [`${labelColumn} ≈ ${intercept.toFixed(4)}`];
              }

              featureColumns.forEach((feature) => {
                const value = coefficients[feature];
                const coeff = typeof value === "number" ? value : 0;
                if (coeff >= 0) {
                  formulaParts.push(` + ${coeff.toFixed(4)} * [${feature}]`);
                } else {
                  formulaParts.push(
                    ` - ${Math.abs(coeff).toFixed(4)} * [${feature}]`
                  );
                }
              });
            }

            return (
              <div className="space-y-4">
                {formulaParts.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                      Model Equation
                    </h4>
                    <div className="bg-gray-900/50 p-3 rounded-lg font-mono text-xs text-green-700 whitespace-normal break-words">
                      <span>{formulaParts[0]}</span>
                      {formulaParts.slice(1).map((part, i) => (
                        <span key={i}>{part}</span>
                      ))}
                    </div>
                  </div>
                )}
                {formulaParts.length === 0 &&
                  complexModels.includes(modelType) &&
                  modelType !== ModuleType.NeuralNetwork && (
                    <div className="bg-blue-900/30 p-3 rounded-lg text-xs text-blue-300 border border-blue-700/50">
                      <p className="font-sans">
                        {modelType === ModuleType.DecisionTree ||
                        modelType === ModuleType.RandomForest ||
                        modelType === ModuleType.GradientBoosting
                          ? "Decision Tree 기반 모델은 트리 구조로 예측을 수행합니다. Feature Importance를 확인하세요."
                          : "이 모델 타입은 선형 방정식으로 표현할 수 없습니다."}
                      </p>
                    </div>
                  )}
                <PanelModelMetrics metrics={outputData.metrics} />
              </div>
            );
          }
          break;
        case ModuleType.EvaluateModel:
          if (outputData.type === "EvaluationOutput") {
            return <PanelModelMetrics metrics={outputData.metrics} />;
          }
          break;
        case ModuleType.ResultModel:
          if (outputData.type === "StatsModelsResultOutput") {
            const { summary, modelType, labelColumn, featureColumns } =
              outputData;

            // 수식 생성 (Train Model 참고)
            const generateFormula = () => {
              const coefficients = summary.coefficients;
              const intercept = coefficients["const"]?.coef || 0;
              const formulaParts: string[] = [];

              // 모델 타입에 따라 수식 형식 결정
              if (modelType === "Logistic" || modelType === "Logit") {
                formulaParts.push(`ln(p / (1 - p)) = ${intercept.toFixed(4)}`);
              } else {
                formulaParts.push(`${labelColumn} ≈ ${intercept.toFixed(4)}`);
              }

              // featureColumns를 사용하여 수식 생성
              if (featureColumns && featureColumns.length > 0) {
                featureColumns.forEach((feature) => {
                  const coeffInfo = coefficients[feature];
                  if (coeffInfo) {
                    const coeff = coeffInfo.coef;
                    if (coeff >= 0) {
                      formulaParts.push(
                        ` + ${coeff.toFixed(4)} * [${feature}]`
                      );
                    } else {
                      formulaParts.push(
                        ` - ${Math.abs(coeff).toFixed(4)} * [${feature}]`
                      );
                    }
                  }
                });
              } else {
                // featureColumns가 없으면 coefficients에서 const를 제외한 모든 계수 사용
                Object.entries(coefficients).forEach(([param, values]) => {
                  if (param !== "const") {
                    const coeff = values.coef;
                    if (coeff >= 0) {
                      formulaParts.push(` + ${coeff.toFixed(4)} * [${param}]`);
                    } else {
                      formulaParts.push(
                        ` - ${Math.abs(coeff).toFixed(4)} * [${param}]`
                      );
                    }
                  }
                });
              }

              return formulaParts;
            };

            const formulaParts = generateFormula();

            return (
              <div className="space-y-4">
                {formulaParts.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                      Fitted Model Equation
                    </h4>
                    <div className="bg-gray-900/50 p-3 rounded-lg font-mono text-xs text-green-700 whitespace-normal break-words">
                      <span>{formulaParts[0]}</span>
                      {formulaParts.slice(1).map((part, i) => (
                        <span key={i}>{part}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                    Model Metrics
                  </h4>
                  <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                    {Object.entries(summary.metrics)
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-gray-400">{key}:</span>
                          <span className="font-mono text-gray-200 font-medium">
                            {typeof value === "number"
                              ? Number(value).toFixed(4)
                              : value}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            );
          }
          break;
        case ModuleType.OutlierDetector:
          if (outputData.type === "OutlierDetectorOutput") {
            const outlierOutput = outputData as OutlierDetectorOutput;
            return (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                    Outlier Detection Summary
                  </h4>
                  <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Columns Analyzed:</span>
                      <span className="font-mono text-gray-200 font-medium">
                        {outlierOutput.columns.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        Total Outliers (All Columns):
                      </span>
                      <span className="font-mono text-gray-200 font-medium">
                        {outlierOutput.totalOutliers}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        Unique Outlier Rows:
                      </span>
                      <span className="font-mono text-gray-200 font-medium">
                        {outlierOutput.allOutlierIndices.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Columns:</span>
                      <span className="font-mono text-gray-200 font-medium text-xs">
                        {outlierOutput.columns.join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                    Column Results
                  </h4>
                  <div className="bg-gray-900/50 rounded-lg p-3 space-y-3 max-h-60 overflow-y-auto">
                    {outlierOutput.columnResults.map((colResult) => (
                      <div
                        key={colResult.column}
                        className="border-b border-gray-700 pb-2 last:border-0"
                      >
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-300 font-semibold">
                            {colResult.column}
                          </span>
                          <span className="font-mono text-gray-200">
                            {colResult.totalOutliers} outliers
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 ml-2">
                          Methods:{" "}
                          {colResult.results.map((r) => r.method).join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          // DataPreview인 경우 (이상치 제거 후)
          if (
            outputData.type === "DataPreview" &&
            module.parameters._outlierOutput
          ) {
            const outlierOutput = module.parameters
              ._outlierOutput as OutlierDetectorOutput;
            return (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
                    Outlier Detection Summary
                  </h4>
                  <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Columns Analyzed:</span>
                      <span className="font-mono text-gray-200 font-medium">
                        {outlierOutput.columns.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        Total Outliers (All Columns):
                      </span>
                      <span className="font-mono text-gray-200 font-medium">
                        {outlierOutput.totalOutliers}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        Output Rows (After Removal):
                      </span>
                      <span className="font-mono text-gray-200 font-medium">
                        {outputData.totalRowCount}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-green-900/30 p-3 rounded-lg border border-green-700/50">
                  <p className="text-xs text-green-300">
                    이상치가 제거된 데이터가 출력됩니다. 결과 보기에서 상세
                    정보를 확인할 수 있습니다.
                  </p>
                </div>
              </div>
            );
          }
          break;
        default:
          if (outputData.type === "DataPreview") {
            return (
              <MissingValueSummary
                data={outputData}
                title="Output Data Summary"
              />
            );
          }
          break;
      }
      return (
        <div className="text-center text-gray-500 p-4">
          No specific preview for this module's output.
        </div>
      );
    })();

    // 수치형 컬럼 통계 요약 (DataPreview 계열)
    const statsRows: { col: string; mean: string; std: string; min: string; max: string }[] = (() => {
      let rows: Record<string, any>[] | undefined;
      let cols: Array<{ name: string; type?: string }> | undefined;
      const od = outputData as any;
      if (od.type === 'DataPreview') { rows = od.rows; cols = od.columns; }
      else if (od.data?.type === 'DataPreview') { rows = od.data.rows; cols = od.data.columns; }
      else if (od.type === 'SplitDataOutput' && od.train?.rows) { rows = od.train.rows; cols = od.train.columns; }
      else if (od.clusterAssignments?.rows) { rows = od.clusterAssignments.rows; cols = od.clusterAssignments.columns; }
      else if (od.transformedData?.rows) { rows = od.transformedData.rows; cols = od.transformedData.columns; }
      if (!rows?.length || !cols?.length) return [];
      const numericCols = cols.filter(c => {
        const v = rows![0]?.[c.name];
        return typeof v === 'number' || (!isNaN(Number(v)) && v !== '' && v !== null);
      }).slice(0, 8);
      return numericCols.map(c => {
        const vals = rows!.map(r => Number(r[c.name])).filter(v => !isNaN(v));
        if (!vals.length) return null;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
        const std = Math.sqrt(variance);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const fmt = (n: number) => Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0)
          ? n.toExponential(2) : n.toFixed(3);
        return { col: c.name, mean: fmt(mean), std: fmt(std), min: fmt(min), max: fmt(max) };
      }).filter(Boolean) as any[];
    })();

    return (
      <div className="space-y-4">
        {previewContent}
        {statsRows.length > 0 && (
          <div className="border-t border-gray-700 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">수치형 컬럼 통계</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="text-left pb-1 pr-2 font-semibold">컬럼</th>
                    <th className="text-right pb-1 px-1 font-semibold">평균</th>
                    <th className="text-right pb-1 px-1 font-semibold">표준편차</th>
                    <th className="text-right pb-1 px-1 font-semibold">최솟값</th>
                    <th className="text-right pb-1 font-semibold">최댓값</th>
                  </tr>
                </thead>
                <tbody>
                  {statsRows.map(r => (
                    <tr key={r.col} className="border-b border-gray-800 hover:bg-gray-700/30">
                      <td className="py-1 pr-2 text-gray-300 truncate max-w-[80px]" title={r.col}>{r.col}</td>
                      <td className="py-1 px-1 text-right font-mono text-blue-300">{r.mean}</td>
                      <td className="py-1 px-1 text-right font-mono text-gray-400">{r.std}</td>
                      <td className="py-1 px-1 text-right font-mono text-orange-300">{r.min}</td>
                      <td className="py-1 text-right font-mono text-green-300">{r.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {canVisualize() && (
          <div className="mt-4 border-t border-gray-700 pt-4">
            <button
              onClick={() => onViewDetails(module.id)}
              className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md font-semibold text-white transition-colors"
            >
              결과 보기
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white h-full flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={
          module?.type === ModuleType.LoadData ? ".csv,.xlsx,.xls" : ".csv"
        }
        className="hidden"
      />
      <div className="flex-grow flex flex-col min-h-0">
        <div className="p-3 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localModuleName}
              onChange={(e) => setLocalModuleName(e.target.value)}
              onBlur={handleNameInputBlur}
              onKeyDown={handleNameInputKeyDown}
              className="flex-1 bg-transparent text-lg font-bold focus:outline-none focus:bg-gray-700 rounded-md px-2 py-1 -ml-2"
              placeholder="Module Name"
              disabled={!module}
            />
            {module && (
              <button
                onClick={() => setShowDescriptionModal(true)}
                className="px-2 py-1 text-xs border border-blue-500 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors flex-shrink-0 flex items-center gap-1"
                title="이 모듈의 입력·역할·결과 설명 보기"
              >
                <InformationCircleIcon className="w-4 h-4" />
                설명
              </button>
            )}
            {module &&
              onRunModule &&
              (() => {
                // Stat Model, 지도학습, 비지도학습 모델은 실행 버튼 표시하지 않음
                const noRunButtonTypes = [
                  // Stat Model
                  ModuleType.OLSModel,
                  ModuleType.LogisticModel,
                  ModuleType.PoissonModel,
                  ModuleType.QuasiPoissonModel,
                  ModuleType.NegativeBinomialModel,
                  ModuleType.StatModels,
                  // 지도학습
                  ModuleType.LinearRegression,
                  ModuleType.LogisticRegression,
                  ModuleType.PoissonRegression,
                  ModuleType.NegativeBinomialRegression,
                  ModuleType.DecisionTree,
                  ModuleType.RandomForest,
                  ModuleType.GradientBoosting,
                  ModuleType.NeuralNetwork,
                  ModuleType.SVM,
                  ModuleType.LinearDiscriminantAnalysis,
                  ModuleType.NaiveBayes,
                  ModuleType.KNN,
                  // 비지도학습
                  ModuleType.KMeans,
                  ModuleType.HierarchicalClustering,
                  ModuleType.DBSCAN,
                  ModuleType.PrincipalComponentAnalysis,
                ];

                if (noRunButtonTypes.includes(module.type)) {
                  return null;
                }

                return (
                  <button
                    onClick={() => onRunModule(module.id)}
                    className="p-2 bg-green-600 hover:bg-green-500 rounded-md transition-colors flex-shrink-0"
                    title="모듈 실행"
                  >
                    <PlayIcon className="w-4 h-4 text-white" />
                  </button>
                );
              })()}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {module ? module.type : "모듈을 선택하세요"}
          </p>
        </div>

        {module && (
          <div className="flex-shrink-0 border-b border-gray-300 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab("properties")}
                className={`flex-1 flex items-center justify-center p-3 text-xs font-semibold ${
                  activeTab === "properties"
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                속성
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex-1 flex items-center justify-center p-3 text-xs font-semibold ${
                  activeTab === "preview"
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                미리보기
              </button>
              <AdvancedOnly>
              <button
                onClick={() => setActiveTab("code")}
                className={`flex-1 flex items-center justify-center gap-1 p-3 text-xs font-semibold ${ADVANCED_BTN_DIM} ${
                  activeTab === "code"
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                <AdvancedLockBadge />
                코드
              </button>
              </AdvancedOnly>
              <button
                onClick={() => setActiveTab("terminal")}
                className={`flex-1 flex items-center justify-center p-3 text-xs font-semibold ${
                  activeTab === "terminal"
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                터미널
              </button>
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto panel-scrollbar p-3">
          {!module ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">
                Select a module to see its properties.
              </p>
            </div>
          ) : (
            <>
              {activeTab === "properties" && (
                <div>
                  {validationError && (
                    <div className="mb-3 flex items-start gap-2 rounded-md bg-red-900/40 border border-red-600/60 px-3 py-2 text-xs text-red-300">
                      <span className="mt-0.5 flex-shrink-0">⚠</span>
                      <span>{validationError}</span>
                    </div>
                  )}
                  <PropertyGroup title="Parameters" module={module}>
                    {renderParameters(
                      module,
                      handleParamChange,
                      fileInputRef,
                      modules,
                      connections,
                      projectName,
                      updateModuleParameters,
                      handleLoadSample,
                      folderHandle,
                      () => setShowExcelModal(true),
                      () => setShowRAGModal(true),
                      isLoadingExamples,
                      exampleDataList
                    )}
                  </PropertyGroup>
                  {canVisualize() && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                      <button
                        onClick={() => onViewDetails(module.id)}
                        className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md font-semibold text-white transition-colors"
                      >
                        결과 보기
                      </button>
                    </div>
                  )}
                  {/* 모듈 메모 */}
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">📝 메모</label>
                    <textarea
                      value={module.notes ?? ''}
                      onChange={e => onUpdateNotes(module.id, e.target.value)}
                      placeholder="이 모듈에 대한 메모를 입력하세요..."
                      rows={3}
                      className="w-full px-2 py-1.5 text-xs bg-gray-700 dark:bg-gray-700 text-gray-200 border border-gray-600 rounded-md resize-none focus:outline-none focus:border-blue-500 placeholder-gray-500"
                    />
                  </div>
                </div>
              )}
              {activeTab === "preview" && (
                <div>
                  <div className="flex mb-3 rounded-md bg-gray-700 p-1">
                    <button
                      onClick={() => setActivePreviewTab("입력")}
                      className={`flex-1 text-center text-sm py-1 rounded-md transition-colors ${
                        activePreviewTab === "입력"
                          ? "bg-gray-600 font-semibold"
                          : "hover:bg-gray-600/50"
                      }`}
                    >
                      입력
                    </button>
                    <button
                      onClick={() => setActivePreviewTab("출력")}
                      className={`flex-1 text-center text-sm py-1 rounded-md transition-colors ${
                        activePreviewTab === "출력"
                          ? "bg-gray-600 font-semibold"
                          : "hover:bg-gray-600/50"
                      }`}
                    >
                      출력
                    </button>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    {activePreviewTab === "입력"
                      ? renderInputPreview()
                      : renderOutputPreview()}
                  </div>
                </div>
              )}
              {activeTab === "code" && (
                <AdvancedOnly>
                <div>
                  <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <button
                      onClick={handleCopyCode}
                      className="absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-300 transition-colors"
                      title="Copy to clipboard"
                    >
                      {isCopied ? (
                        <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ClipboardIcon className="w-4 h-4" />
                      )}
                    </button>
                    <pre className="p-4 text-xs text-gray-900 dark:text-gray-300 overflow-x-auto">
                      <code>{codeSnippet}</code>
                    </pre>
                  </div>
                </div>
                </AdvancedOnly>
              )}
              {activeTab === "terminal" && (
                <div
                  ref={logContainerRef}
                  className="flex-grow overflow-y-auto bg-gray-100 dark:bg-gray-900 text-xs font-mono p-2 space-y-1"
                  onContextMenu={(e) => {
                    // 텍스트가 선택되어 있으면 컨텍스트 메뉴에서 복사 가능하도록
                    const selection = window.getSelection();
                    if (selection && selection.toString().trim()) {
                      // 브라우저 기본 컨텍스트 메뉴 사용 (복사 옵션 포함)
                      return;
                    }
                    // 텍스트가 선택되지 않았으면 기본 동작 방지
                    e.preventDefault();
                  }}
                >
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex group hover:bg-gray-200/50 dark:hover:bg-gray-800/50 rounded px-1 py-0.5"
                    >
                      <span className="text-gray-600 dark:text-gray-500 mr-2 flex-shrink-0 select-none">
                        {log.timestamp}
                      </span>
                      <span
                        className={`mr-2 font-bold flex-shrink-0 select-none ${
                          log.level === "INFO"
                            ? "text-blue-600 dark:text-blue-400"
                            : log.level === "WARN"
                            ? "text-yellow-600 dark:text-yellow-400"
                            : log.level === "ERROR"
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {log.level}:
                      </span>
                      <span
                        className="flex-1 whitespace-pre-wrap break-words cursor-text select-text text-gray-900 dark:text-gray-200"
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          const text = log.message;
                          navigator.clipboard.writeText(text).then(() => {
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          });
                        }}
                        onMouseUp={(e) => {
                          // 텍스트 선택 후 Ctrl+C 또는 우클릭으로 복사 가능
                          const selection = window.getSelection();
                          if (selection && selection.toString().trim()) {
                            // 선택된 텍스트가 있으면 복사 가능
                          }
                        }}
                        title="텍스트를 선택하여 복사하거나 더블클릭하여 전체 메시지 복사"
                      >
                        {log.message}
                      </span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const text = `${log.timestamp} ${log.level}: ${log.message}`;
                          navigator.clipboard.writeText(text).then(() => {
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          });
                        }}
                        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="전체 로그 복사"
                      >
                        {isCopied ? (
                          <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <ClipboardIcon className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300" />
                        )}
                      </button>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-gray-600 dark:text-gray-500 text-center py-4">
                      로그가 없습니다
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Excel Input Modal */}
      {showExcelModal && module && module.type === ModuleType.LoadData && (
        <ExcelInputModal
          onClose={() => setShowExcelModal(false)}
          onApply={(csvContent) => {
            updateModuleParameters(module.id, {
              source: "pasted_data.csv",
              fileContent: csvContent,
              fileType: "pasted",
            });
            setShowExcelModal(false);
          }}
        />
      )}

      {/* RAG Analysis Modal */}
      {showRAGModal && module && module.type === ModuleType.LoadData && (
        <DataAnalysisRAGModal
          module={module}
          onClose={() => setShowRAGModal(false)}
        />
      )}

      {/* Module Description Modal — 모듈 입력·역할·결과 정적 설명 */}
      {showDescriptionModal && module && (
        <ModuleDescriptionModal
          moduleType={module.type}
          onClose={() => setShowDescriptionModal(false)}
        />
      )}
    </div>
  );
};
