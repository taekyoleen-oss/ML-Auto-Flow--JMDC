import { CanvasModule, Connection } from '../types';
import { getModuleCode } from '../codeSnippets';

/**
 * Unicode 안전 Base64 인코딩 (브라우저 btoa는 멀티바이트 문자 처리 불가)
 */
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * LoadData 모듈의 outputData를 Pyodide 실행용 데이터 주입 코드로 변환
 * - outputData가 있으면 Base64 인코딩하여 pd.DataFrame()으로 주입
 * - outputData가 없으면 모듈을 먼저 실행하라는 에러 코드 생성
 */
export function generateLoadDataInjectionCode(module: CanvasModule): string {
  const outputData = module.outputData as any;
  const source = String(module.parameters?.source || 'data.csv');

  if (!outputData || outputData.type !== 'DataPreview' || !outputData.rows?.length) {
    return [
      `# ⚠️  Pyodide 실행: 로컬 파일 접근 불가 (브라우저 환경 제한)`,
      `# 해결 방법: 캔버스에서 LoadData 모듈을 먼저 실행(▶)한 후 다시 시도하세요.`,
      `# 외부 Python(Jupyter, 스크립트)에서는: dataframe = pd.read_csv('${source}')`,
      `raise RuntimeError("LoadData 모듈을 먼저 실행해주세요. 모듈 선택 후 ▶ 버튼을 클릭하세요.")`,
    ].join('\n');
  }

  const rows = outputData.rows as Record<string, any>[];
  const totalCount: number = outputData.totalRowCount || rows.length;
  const columns: string[] = (outputData.columns as any[])?.map((c: any) => c.name)
    ?? Object.keys(rows[0] ?? {});
  const isPartial = rows.length < totalCount;

  // 컬럼별 배열 구조로 변환 (pd.DataFrame() 직접 주입에 최적)
  const colData: Record<string, any[]> = {};
  columns.forEach((col) => {
    colData[col] = rows.map((row) => row[col] ?? null);
  });

  const b64 = encodeBase64(JSON.stringify(colData));

  const label = isPartial
    ? `앱에서 로드된 데이터 (${rows.length}행 / 전체 ${totalCount}행 미리보기)`
    : `앱에서 로드된 데이터 (전체 ${rows.length}행)`;

  return [
    `import base64 as _b64, json as _json`,
    `# Pyodide 실행: ${label}`,
    `# 외부 Python(Jupyter, 스크립트)에서는: dataframe = pd.read_csv('${source}')`,
    `dataframe = pd.DataFrame(_json.loads(_b64.b64decode('${b64}').decode('utf-8')))`,
  ].join('\n');
}

/**
 * 모듈 간 의존성을 기반으로 실행 순서를 결정합니다 (위상 정렬)
 * 순환 의존성 감지 시 에러를 throw합니다.
 */
function getExecutionOrder(
  modules: CanvasModule[],
  connections: Connection[]
): CanvasModule[] {
  const moduleMap = new Map<string, CanvasModule>();
  modules.forEach((m) => moduleMap.set(m.id, m));

  const dependencies = new Map<string, Set<string>>();
  modules.forEach((m) => dependencies.set(m.id, new Set()));

  connections.forEach((conn) => {
    const fromModule = moduleMap.get(conn.from.moduleId);
    const toModule = moduleMap.get(conn.to.moduleId);
    if (fromModule && toModule) {
      const deps = dependencies.get(toModule.id);
      if (deps) {
        deps.add(fromModule.id);
      }
    }
  });

  const ordered: CanvasModule[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(moduleId: string, path: string[] = []) {
    if (visiting.has(moduleId)) {
      // 순환 경로를 이름으로 표시하여 에러 발생
      const cycleStart = path.indexOf(moduleId);
      const cyclePath = path.slice(cycleStart).map((id) => moduleMap.get(id)?.name ?? id);
      cyclePath.push(moduleMap.get(moduleId)?.name ?? moduleId);
      throw new Error(`순환 연결이 감지되었습니다: ${cyclePath.join(' → ')}\n파이프라인의 연결 방향을 확인해주세요.`);
    }
    if (visited.has(moduleId)) return;

    visiting.add(moduleId);
    const deps = dependencies.get(moduleId);
    if (deps) {
      deps.forEach((depId) => visit(depId, [...path, moduleId]));
    }
    visiting.delete(moduleId);
    visited.add(moduleId);

    const module = moduleMap.get(moduleId);
    if (module) {
      ordered.push(module);
    }
  }

  modules.forEach((m) => visit(m.id));
  return ordered;
}

/**
 * 모듈 템플릿에는 실제 실행 호출이 주석 처리되어 있는 경우가 많다
 * (예: "# selected_data = select_data(dataframe, selected_columns)").
 * 템플릿은 '표시용'이고 앱은 별도 경로로 실행하기 때문이다.
 * 전체 파이프라인 코드는 외부 Python에서 그대로 실행되어야 하므로,
 * 주석 처리된 실행 호출(함수 호출 형태의 대입문)을 활성화한다.
 *
 * - 단일 라인 호출: `# var = func(...)` → `var = func(...)`
 * - 여러 줄에 걸친 호출: `# var = func(` 로 시작해 괄호가 닫힐 때까지 연속된 주석 라인을 함께 활성화
 * 순수 설명 주석(대입/호출 형태가 아님)은 그대로 둔다.
 */
function activateExecutionCalls(code: string): string {
  const lines = code.split('\n');
  const out: string[] = [];
  const startRe = /^(\s*)#\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*\s*=\s*[A-Za-z_][\w.]*\(.*)$/;
  const countParens = (s: string) => {
    // 문자열 리터럴을 제외한 괄호 균형 계산(간단 버전)
    const noStr = s.replace(/'[^']*'|"[^"]*"/g, '');
    return (noStr.match(/\(/g) || []).length - (noStr.match(/\)/g) || []).length;
  };
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe);
    if (!m) { out.push(lines[i]); continue; }
    // 실행 호출(주석) 시작 — 활성화
    const indent = m[1];
    let body = m[2];
    let depth = countParens(body);
    out.push(indent + body.replace(/\s+$/, ''));
    // 괄호가 아직 안 닫혔으면 후속 주석 라인을 이어서 활성화
    while (depth > 0 && i + 1 < lines.length) {
      const cont = lines[i + 1].match(/^(\s*)#\s?(.*)$/);
      if (!cont) break;
      i++;
      out.push(cont[1] + cont[2].replace(/\s+$/, ''));
      depth += countParens(cont[2]);
    }
  }
  return out.join('\n');
}

/**
 * 전체 파이프라인 코드를 '실행 위주'로 간결화한다.
 * 설명용 전체-라인 주석(#로 시작)을 제거하되, 함수/실행 코드·docstring·인라인 주석·print는 보존한다.
 * 삼중따옴표 문자열(docstring) 내부의 #-라인은 제거하지 않는다(실행 의미 보존).
 * 주석만 제거하므로 실행 결과(동일 결과)는 절대 바뀌지 않는다.
 */
function stripCommentsKeepCode(code: string): string {
  const lines = code.split('\n');
  const out: string[] = [];
  let inTriple = false;
  for (const line of lines) {
    const tripleCount =
      (line.match(/"""/g) || []).length + (line.match(/'''/g) || []).length;
    if (!inTriple) {
      const trimmed = line.trim();
      // 문자열 밖의 전체-라인 주석 제거(단, 보존 가치가 있는 헤더 라인 '# ──'는 유지)
      if (trimmed.startsWith('#') && !trimmed.startsWith('# ──')) {
        if (tripleCount % 2 === 1) inTriple = true; // 안전장치(주석 라인엔 보통 없음)
        continue;
      }
      out.push(line);
      if (tripleCount % 2 === 1) inTriple = true;
    } else {
      out.push(line);
      if (tripleCount % 2 === 1) inTriple = false;
    }
  }
  // 빈 줄 3개 이상은 2개로 축약
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * 전체코드를 '실행 과정 위주'로 더 간결하게: 단순 스칼라 파라미터(p_xxx = 숫자/문자열/None/불리언)를
 * 사용처에 인라인하고 그 대입문을 제거한다. 리스트/딕셔너리/표현식/재대입 변수는 건드리지 않는다.
 * (예: p_method='MinMax'; ...normalize(df, p_method, ...) → normalize(df, 'MinMax', ...))
 * 값 자체는 그대로 흐르므로 실행 결과는 변하지 않는다. 개별 모듈 코드(getModuleCode)에는 적용하지 않는다.
 */
function inlineScalarParams(code: string): string {
  const lines = code.split('\n');
  const scalarRe = /^(\s*)(p_[A-Za-z0-9_]+)\s*=\s*(None|True|False|-?\d+(?:\.\d+)?|'[^'\\]*'|"[^"\\]*")\s*$/;
  const assignCount = new Map<string, number>();
  for (const l of lines) {
    const m = l.match(/^\s*(p_[A-Za-z0-9_]+)\s*=(?!=)/);
    if (m) assignCount.set(m[1], (assignCount.get(m[1]) || 0) + 1);
  }
  const consts = new Map<string, string>();
  for (const l of lines) {
    const m = l.match(scalarRe);
    if (m && assignCount.get(m[2]) === 1) consts.set(m[2], m[3]);
  }
  if (consts.size === 0) return code;
  const out: string[] = [];
  for (const l of lines) {
    const m = l.match(scalarRe);
    if (m && consts.has(m[2])) continue; // 스칼라 대입문 제거
    let line = l;
    for (const [name, val] of consts) {
      line = line.replace(new RegExp(`\\b${name}\\b`, 'g'), val);
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * 모듈 타입별 내부 출력 변수명 매핑
 */
const MODULE_OUTPUT_VAR: Record<string, string> = {
  LoadData: 'dataframe',
  SelectData: 'selected_data',
  DataFiltering: 'dataframe',
  HandleMissingValues: 'cleaned_data',
  EncodeCategorical: 'encoded_data',
  ScalingTransform: 'normalized_data',
  TransformData: 'transformed_data',
  TransitionData: 'transformed_data',
  ResampleData: 'resampled_data',
  TrainModel: 'trained_model',
  SweepParameters: 'trained_model',
  ScoreModel: 'scored_data',
  EvaluateModel: 'evaluation_metrics',
  ResultModel: 'model_results',
  PredictModel: 'predicted_data',
  KNN: 'trained_model',
  TrainClusteringModel: 'trained_model',
  ClusteringData: 'clustered_data',
  Recommender: 'recommendations',
  OutlierDetector: 'dataframe',
  NormalityChecker: 'dataframe',
  HypothesisTesting: 'dataframe',
  Correlation: 'dataframe',
  Join: 'dataframe',
  Concat: 'dataframe',
};

/**
 * 전체 파이프라인의 Python 코드를 생성합니다
 * @param forExecution true이면 Pyodide 실행용 (LoadData에 outputData 주입)
 */
export function generateFullPipelineCode(
  modules: CanvasModule[],
  connections: Connection[],
  forExecution = false
): string {
  if (modules.length === 0) {
    return '# 파이프라인이 비어있습니다.';
  }

  // 순환 의존성은 RuntimeError로 전달하여 사용자가 인지할 수 있도록 함
  let executionOrder: CanvasModule[];
  try {
    executionOrder = getExecutionOrder(modules, connections);
  } catch (e: any) {
    throw new Error(e?.message || '파이프라인 순서 결정 중 오류가 발생했습니다.');
  }
  const moduleMap = new Map<string, CanvasModule>();
  modules.forEach((m) => moduleMap.set(m.id, m));

  const codeLines: string[] = [];
  codeLines.push('# 전체 파이프라인 실행 코드 (외부 Python에서 그대로 실행 가능 · 동일 결과 재현)');
  codeLines.push('import pandas as pd');
  codeLines.push('import numpy as np');
  codeLines.push('');

  const variableMap = new Map<string, string>(); // moduleId -> outputVarName

  executionOrder.forEach((module, index) => {
    // ── 모듈 섹션 헤더 (간결: 1줄, stripCommentsKeepCode가 보존하는 '# ──' 접두사 사용) ──
    codeLines.push(`# ── [${index + 1}/${executionOrder.length}] ${module.name} (${module.type}) ──`);

    // ── 모듈 코드 생성 ──────────────────────────────────────────────────────
    let moduleCode: string;
    if (forExecution && module.type === 'LoadData') {
      // Pyodide 실행 시: 로컬 파일 대신 outputData를 직접 주입
      moduleCode = generateLoadDataInjectionCode(module);
    } else {
      try {
        moduleCode = inlineScalarParams(activateExecutionCalls(getModuleCode(module, modules, connections)));
      } catch (e: any) {
        // 코드 생성 실패 시 주석으로 숨기지 않고 Python 실행 시점에 명확한 에러 발생
        const errMsg = e?.message || String(e);
        moduleCode = [
          `# ❌ [${module.name}] 코드 생성 실패: ${errMsg}`,
          `raise RuntimeError("[${module.name}] 코드 생성에 실패했습니다: ${errMsg.replace(/"/g, "'")}")`,
        ].join('\n');
      }
    }

    // ── 출력 변수명 결정 ────────────────────────────────────────────────────
    const safeId = module.id.slice(0, 8).replace(/-/g, '_');
    let outputVarName = '';
    if (module.outputs.length > 0) {
      const outputType = module.outputs[0].type;
      if (outputType === 'data') {
        outputVarName = `data_${safeId}`;
      } else if (outputType === 'model') {
        outputVarName = `model_${safeId}`;
      } else if (outputType === 'handler') {
        outputVarName = `handler_${safeId}`;
      } else if (outputType === 'evaluation') {
        outputVarName = `eval_${safeId}`;
      } else {
        outputVarName = `result_${safeId}`;
      }
    }

    // ── 입력 연결 처리: 이전 모듈 출력을 표준 변수명으로 받음 ───────────────
    const inputConnections = connections.filter((c) => c.to.moduleId === module.id);
    const inputPrefixLines: string[] = [];

    // data_in 포트에 연결된 변수들을 순서대로 추적 (Join/Concat의 두 번째 데이터 포트 대응)
    const dataInVars: string[] = [];

    inputConnections.forEach((conn) => {
      const fromModule = moduleMap.get(conn.from.moduleId);
      let prevVarName = variableMap.get(conn.from.moduleId);
      if (!prevVarName || !fromModule) return;
      // SplitData는 train/test 두 출력을 가지므로 연결된 포트에 맞춰 변수를 선택한다.
      // (기존 버그: 항상 train을 사용해 test_data_out 연결도 train 데이터를 잘못 참조)
      if (fromModule.type === 'SplitData') {
        prevVarName = `${prevVarName}_${conn.from.portName === 'test_data_out' ? 'test' : 'train'}`;
      }

      const toPort = conn.to.portName;
      const fromLabel = fromModule.name;

      if (toPort === 'data_in') {
        dataInVars.push(prevVarName);
      } else if (toPort === 'data_in2') {
        // Join/Concat의 명시적 두 번째 데이터 포트
        inputPrefixLines.push(`dataframe2 = ${prevVarName}  # ← [${fromLabel}] 출력`);
      } else if (toPort === 'model_in') {
        inputPrefixLines.push(`trained_model = ${prevVarName}  # ← [${fromLabel}] 출력`);
      } else if (toPort === 'score_data_in') {
        // ScoreModel의 데이터 포트 (모델과 분리)
        inputPrefixLines.push(`second_data = ${prevVarName}  # ← [${fromLabel}] 출력`);
      } else if (toPort === 'handler_in') {
        inputPrefixLines.push(`handler = ${prevVarName}  # ← [${fromLabel}] 출력`);
      } else if (toPort === 'dist_in') {
        inputPrefixLines.push(`dist = ${prevVarName}  # ← [${fromLabel}] 출력`);
      } else if (toPort === 'curve_in') {
        inputPrefixLines.push(`curve = ${prevVarName}  # ← [${fromLabel}] 출력`);
      } else if (toPort === 'contract_in') {
        inputPrefixLines.push(`contract = ${prevVarName}  # ← [${fromLabel}] 출력`);
      } else if (toPort === 'eval_in') {
        inputPrefixLines.push(`scored_data = ${prevVarName}  # ← [${fromLabel}] 출력`);
      }
    });

    // data_in 포트 처리: 첫 번째는 dataframe, 두 번째는 dataframe2 (Join/Concat 템플릿 기준)
    if (dataInVars.length >= 1) {
      const firstFrom = inputConnections.find((c) => c.to.portName === 'data_in');
      const firstName = firstFrom ? moduleMap.get(firstFrom.from.moduleId)?.name ?? '' : '';
      inputPrefixLines.unshift(`dataframe = ${dataInVars[0]}  # ← [${firstName}] 출력`);
    }
    if (dataInVars.length >= 2) {
      const secondFrom = inputConnections.filter((c) => c.to.portName === 'data_in')[1];
      const secondName = secondFrom ? moduleMap.get(secondFrom.from.moduleId)?.name ?? '' : '';
      inputPrefixLines.push(`dataframe2 = ${dataInVars[1]}  # ← [${secondName}] 출력`);
    }

    // 입력 연결이 있으면 모듈 코드 앞에 주입
    if (inputPrefixLines.length > 0) {
      inputPrefixLines.forEach((line) => codeLines.push(line));
      codeLines.push('');
    }

    // 전체코드는 '실행 위주'로 — 설명용 주석을 제거(실행 결과 불변)
    codeLines.push(stripCommentsKeepCode(moduleCode));

    // ── 출력 변수 명시적 할당 ───────────────────────────────────────────────
    let outputAssigned = false;
    if (outputVarName) {
      if (module.type === 'SplitData') {
        codeLines.push(`${outputVarName}_train = train_data`);
        codeLines.push(`${outputVarName}_test = test_data`);
        outputAssigned = true;
      } else {
        let internalVar = MODULE_OUTPUT_VAR[module.type] || '';
        // 매핑되지 않은 모델 생성 모듈(LinearRegression/DecisionTree/NeuralNetwork 등)은
        // 템플릿이 일관되게 'model' 변수를 만든다 → 출력 타입이 model이면 'model'로 폴백
        if (!internalVar && module.outputs[0]?.type === 'model') internalVar = 'model';
        // 모듈 코드가 실제로 그 변수를 만들 때만 출력 변수를 할당한다.
        // (정의 전용 모듈: OLSModel 등 통계모델 정의 — 실제 코드는 ResultModel이 생성하므로
        //  여기서 변수를 참조하면 NameError가 난다. 템플릿이 없는 모듈도 동일하게 방지.)
        const assignsVar =
          !!internalVar && new RegExp(`(^|\\n)\\s*${internalVar}\\s*=(?!=)`).test(moduleCode);
        if (assignsVar) {
          codeLines.push(`${outputVarName} = ${internalVar}`);
          outputAssigned = true;
        }
      }
    }

    // ── 실행 결과 확인용 print (출력 변수가 실제로 할당된 경우에만) ───────────
    if (outputAssigned) {
      const outputType = module.outputs.length > 0 ? module.outputs[0].type : '';
      if (module.type === 'SplitData') {
        codeLines.push(`print(f"[${module.name}] train: {${outputVarName}_train.shape}, test: {${outputVarName}_test.shape}")`);
        codeLines.push(`print()`);
      } else if (outputType === 'data') {
        codeLines.push(`print(f"[${module.name}] shape: {${outputVarName}.shape}")`);
        codeLines.push(`print(${outputVarName}.head(5).to_string())`);
        codeLines.push(`print()`);
      } else if (outputType === 'model') {
        codeLines.push(`print(f"[${module.name}] 모델: {${outputVarName}}")`);
        codeLines.push(`print()`);
      } else {
        codeLines.push(`print(f"[${module.name}] 완료")`);
        codeLines.push(`print(${outputVarName})`);
        codeLines.push(`print()`);
      }
    }

    codeLines.push('');

    // 출력 변수명을 다음 모듈을 위해 저장 (실제로 할당된 경우에만)
    if (outputAssigned) {
      // SplitData는 base 변수명을 저장하고, 연결 포트에 따라 _train/_test를 위 wiring에서 부여한다.
      variableMap.set(module.id, outputVarName);
    }
  });

  codeLines.push('# ── 파이프라인 실행 완료 ──');

  return codeLines.join('\n');
}
