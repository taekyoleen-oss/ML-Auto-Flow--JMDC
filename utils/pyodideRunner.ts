/**
 * Pyodide를 사용하여 브라우저에서 Python 코드를 실행하는 유틸리티
 *
 * Pyodide는 WebAssembly를 통해 브라우저에서 직접 Python을 실행할 수 있게 해줍니다.
 * 별도의 백엔드 서버가 필요 없습니다.
 */

let pyodide: any = null;
let loadPromise: Promise<any> | null = null;  // null이면 미시작, non-null이면 진행중/완료
let loadStartTime: number = 0;

// B-1: Pyodide 로딩 진행률 콜백
type PyodideStatusCallback = (status: string, progress: number) => void;
let statusCallback: PyodideStatusCallback | null = null;

export function setPyodideStatusCallback(cb: PyodideStatusCallback | null): void {
  statusCallback = cb;
}

export function getPyodideLoadingStatus(): { isLoading: boolean; isPyodideReady: boolean } {
  return { isLoading: loadPromise !== null && !pyodide, isPyodideReady: !!pyodide };
}

function notifyStatus(status: string, progress: number): void {
  if (statusCallback) {
    statusCallback(status, progress);
  }
}

/**
 * 타임아웃을 가진 Promise 래퍼
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Pyodide를 로드합니다 (한 번만 로드)
 * 타임아웃: 30초
 */
export async function loadPyodide(timeoutMs: number = 30000): Promise<any> {
  // 이미 로드 완료
  if (pyodide) {
    return pyodide;
  }

  // 로딩 중이면 동일한 Promise 반환 (race condition 방지: 하나의 Promise만 생성)
  if (loadPromise) {
    return loadPromise;
  }

  loadStartTime = Date.now();
  // Promise 생성 즉시 변수에 할당하여 동시 호출 시 중복 초기화 방지
  loadPromise = (async () => {
    try {
      notifyStatus("Python 환경(Pyodide) 초기화 중...", 10);
      const pyodideModule = await withTimeout(
        loadPyodideModule(),
        timeoutMs,
        `Pyodide 로딩 타임아웃 (${timeoutMs / 1000}초 초과)`
      );
      pyodide = pyodideModule;

      notifyStatus("패키지 설치 중... (1/4) numpy", 55);
      const packageList = ["numpy", "scipy", "pandas", "scikit-learn"];
      const progressSteps = [55, 65, 75, 88];
      let pkgIdx = 0;

      const pkgMessageCallback = (msg: string) => {
        // 새 패키지 로딩 시 메시지를 감지하여 진행률 업데이트
        const match = msg.match(/(?:Loading|Installing|Loaded)\s+(\S+)/i);
        if (match) {
          const foundPkg = match[1].toLowerCase().replace(/[^a-z0-9-_]/g, '');
          const idx = packageList.findIndex((p) => foundPkg.startsWith(p.replace('-', '_')) || foundPkg.startsWith(p));
          if (idx >= 0 && idx !== pkgIdx) {
            pkgIdx = idx;
            notifyStatus(`패키지 설치 중... (${idx + 1}/${packageList.length}) ${packageList[idx]}`, progressSteps[idx]);
          }
        }
      };

      await withTimeout(
        pyodide.loadPackage(
          packageList,
          pkgMessageCallback
        ),
        90000,
        "패키지 설치 타임아웃 (90초 초과)"
      );

      notifyStatus("Python 환경 준비 완료!", 100);
      loadStartTime = 0;
      setTimeout(() => notifyStatus("", 0), 1500);
      return pyodide;
    } catch (error) {
      notifyStatus("", 0);
      loadPromise = null;  // 실패 시 재시도 허용
      loadStartTime = 0;
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Pyodide 모듈을 동적으로 로드합니다
 */
async function loadPyodideModule(): Promise<any> {
  // Pyodide가 이미 로드되어 있는지 확인
  if (typeof window !== "undefined" && (window as any).loadPyodide) {
    return (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
    });
  }

  // Pyodide가 아직 로드되지 않았다면 에러
  throw new Error(
    "Pyodide is not loaded. Please ensure pyodide.js is included in index.html"
  );
}

/**
 * Python 코드를 실행하고 결과를 반환합니다
 */
export async function runPython(code: string): Promise<any> {
  const py = await loadPyodide();

  try {
    const result = py.runPython(code);
    return result;
  } catch (error: any) {
    throw new Error(`Python execution error: ${error.message}`);
  }
}

/**
 * Python 함수를 호출합니다
 */
export async function callPythonFunction(
  functionName: string,
  ...args: any[]
): Promise<any> {
  const py = await loadPyodide();

  try {
    const func = py.globals.get(functionName);
    if (!func) {
      throw new Error(`Function ${functionName} not found`);
    }

    const result = func(...args);
    return result;
  } catch (error: any) {
    throw new Error(`Python function call error: ${error.message}`);
  }
}

/**
 * 데이터를 Python 객체로 변환합니다
 */
export function toPython(data: any): string {
  return JSON.stringify(data);
}

/**
 * Python 객체를 JavaScript 객체로 변환합니다
 */
export function fromPython(pythonObj: any): any {
  if (pythonObj && typeof pythonObj.toJs === "function") {
    return pythonObj.toJs({ dict_converter: Object.fromEntries });
  }
  return pythonObj;
}

/**
 * Python 코드를 실행하고 stdout과 오류를 캡처하여 반환합니다
 * 타임아웃: 90초
 */
export async function runPythonWithOutput(
  code: string,
  timeoutMs: number = 90000
): Promise<{ stdout: string; error: string | null }> {
  const py = await loadPyodide();

  // 실행 전 이전 실행의 잔여 변수 및 메모리 정리
  try {
    await py.runPythonAsync(`
import gc as _gc
# 사용자 정의 변수 정리 (내부 변수 _ 로 시작하는 것 제외)
_user_vars = [k for k in list(globals().keys()) if not k.startswith('_')]
for _k in _user_vars:
    try:
        del globals()[_k]
    except Exception:
        pass
_gc.collect()
`);
  } catch (_) {
    // 정리 실패 시 무시하고 계속 진행
  }

  const indented = code.split('\n').map((l) => '    ' + l).join('\n');
  const wrappedCode = `
import io as _io, sys as _sys, traceback as _tb
_buf = _io.StringIO()
_old = _sys.stdout
_sys.stdout = _buf
_err = None
try:
${indented}
except Exception as _e:
    _err = _tb.format_exc()
finally:
    _sys.stdout = _old
(_buf.getvalue(), _err)
`;
  const result = await withTimeout(
    py.runPythonAsync(wrappedCode),
    timeoutMs,
    '실행 타임아웃 (90초 초과)'
  );
  const jsResult = result && typeof result.toJs === 'function' ? result.toJs() : result;
  return { stdout: jsResult?.[0] || '', error: jsResult?.[1] || null };
}

/**
 * SplitData를 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function splitDataPython(
  data: any[],
  trainSize: number | undefined,
  randomState: number | undefined,
  shuffle: boolean | undefined,
  stratify: boolean | undefined,
  stratifyColumn: string | null,
  timeoutMs: number = 60000
): Promise<{ trainIndices: number[]; testIndices: number[] }> {
  let py: any = null;
  try {
    // Pyodide 로드 (타임아웃: 30초)
    try {
      py = await withTimeout(
        loadPyodide(30000),
        30000,
        "Pyodide 로딩 타임아웃 (30초 초과)"
      );
    } catch (loadError: any) {
      const loadErrorMessage = loadError.message || String(loadError);
      if (
        loadErrorMessage.includes("Failed to fetch") ||
        loadErrorMessage.includes("NetworkError")
      ) {
        throw new Error(
          `Pyodide CDN 로드 실패: 네트워크 연결을 확인하거나 인터넷 연결이 필요합니다. ${loadErrorMessage}`
        );
      }
      throw new Error(`Pyodide 로드 실패: ${loadErrorMessage}`);
    }

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);

    // stratify_column을 Python 코드에 전달하기 위한 처리
    // None이면 문자열 'None'으로, 아니면 문자열로 감싸서 전달
    const stratifyColStr = stratifyColumn ? `'${stratifyColumn}'` : "None";

    // Python 코드 실행 (에러 처리 포함)
    // 결과를 전역 변수에 저장한 후 가져오는 방식 사용
    // 값이 없으면 파라미터를 전달하지 않아 파이썬 기본값 사용
    const code = `
import json
import traceback
import sys
from sklearn.model_selection import train_test_split
import pandas as pd

try:
    # sklearn의 train_test_split을 사용하여 데이터를 분할합니다.
    dataframe = pd.DataFrame(js_data.to_py())
    
    # DataFrame 인덱스를 명시적으로 0부터 시작하도록 리셋
    dataframe.index = range(len(dataframe))
    
    # Parameters from UI (값이 없으면 파라미터를 전달하지 않음)
${
  trainSize !== undefined
    ? `    p_train_size = ${trainSize}`
    : "    # train_size: using default (None)"
}
${
  randomState !== undefined
    ? `    p_random_state = ${randomState}`
    : "    # random_state: using default (None)"
}
${
  shuffle !== undefined
    ? `    p_shuffle = ${shuffle ? "True" : "False"}`
    : "    # shuffle: using default (True)"
}
${
  stratify !== undefined
    ? `    p_stratify = ${stratify ? "True" : "False"}`
    : "    # stratify: using default (None)"
}
    p_stratify_column = ${stratifyColStr}
    
    # Stratify 배열 준비
    stratify_array = None
${
  stratify !== undefined && stratify
    ? `    if p_stratify and p_stratify_column and p_stratify_column != 'None':`
    : `    if p_stratify_column and p_stratify_column != 'None':`
}
        if p_stratify_column not in dataframe.columns:
            raise ValueError(f"Stratify column '{p_stratify_column}' not found in DataFrame")
        stratify_array = dataframe[p_stratify_column]
    
    # 데이터 분할 (값이 없으면 파라미터를 전달하지 않음)
    split_kwargs = {}
${
  trainSize !== undefined ? "    split_kwargs['train_size'] = p_train_size" : ""
}
${
  randomState !== undefined
    ? "    split_kwargs['random_state'] = p_random_state"
    : ""
}
${shuffle !== undefined ? "    split_kwargs['shuffle'] = p_shuffle" : ""}
    if stratify_array is not None:
        split_kwargs['stratify'] = stratify_array
    
    train_data, test_data = train_test_split(dataframe, **split_kwargs)
    
    result = {
        'train_indices': train_data.index.tolist(),
        'test_indices': test_data.index.tolist(),
        'train_count': len(train_data),
        'test_count': len(test_data)
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      `Python split_data 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python split_data error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result && result.__error__) {
      throw new Error(
        `Python split_data error:\n${
          result.error_traceback || result.error_message
        }`
      );
    }

    // 결과 검증
    if (!result.train_indices || !result.test_indices) {
      throw new Error(
        `Python split_data error: Missing train_indices or test_indices in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_result");
    // js_tuning_options는 Linear Regression에서만 사용되므로 존재할 때만 삭제
    if (py.globals.has("js_tuning_options")) {
      py.globals.delete("js_tuning_options");
    }

    return {
      trainIndices: result.train_indices,
      testIndices: result.test_indices,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_result");
        // js_tuning_options는 Linear Regression에서만 사용되므로 존재할 때만 삭제
        if (py.globals.has("js_tuning_options")) {
          py.globals.delete("js_tuning_options");
        }
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python split_data error: ${errorMessage}`);
  }
}

export interface LinearRegressionTuningOptions {
  enabled: boolean;
  strategy?: "GridSearch";
  alphaCandidates?: number[];
  l1RatioCandidates?: number[];
  cvFolds?: number;
  scoringMetric?: string;
}

interface LinearRegressionTuningPayload {
  enabled: boolean;
  strategy?: "grid";
  bestParams?: Record<string, number>;
  bestScore?: number;
  scoringMetric?: string;
  candidates?: { params: Record<string, number>; score: number }[];
}

export interface LogisticRegressionTuningOptions {
  enabled: boolean;
  strategy?: "GridSearch";
  cCandidates?: number[];
  l1RatioCandidates?: number[];
  cvFolds?: number;
  scoringMetric?: string;
}

interface LogisticRegressionTuningPayload {
  enabled: boolean;
  strategy?: "grid";
  bestParams?: Record<string, number>;
  bestScore?: number;
  scoringMetric?: string;
  candidates?: { params: Record<string, number>; score: number }[];
}

/**
 * LinearRegression을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitLinearRegressionPython(
  X: number[][],
  y: number[],
  modelType: string = "LinearRegression",
  fitIntercept: boolean = true,
  alpha: number = 1.0,
  l1Ratio: number = 0.5,
  featureColumns?: string[],
  timeoutMs: number = 60000,
  tuningOptions?: LinearRegressionTuningOptions
): Promise<{
  coefficients: number[];
  intercept: number;
  metrics: Record<string, number>;
  tuning?: LinearRegressionTuningPayload;
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달 (pandas DataFrame으로 변환하기 위해 전체 데이터 전달)
    // 실제 Python 코드와 동일하게 pandas DataFrame 사용
    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        // featureColumns가 없으면 x0, x1, ... 형태로 사용
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");
    py.globals.set("js_tuning_options", tuningOptions ? tuningOptions : null);

    // Python 코드 실행 (에러 처리 포함)
    // 실제 Python 코드와 동일하게 pandas DataFrame 사용
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.linear_model import LinearRegression, Lasso, Ridge, ElasticNet
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV

try:
    # 앱에서 보여지는 코드와 정확히 일치하도록 작성
    # 앱 코드: X_train = dataframe[p_feature_columns]
    #          y_train = dataframe[p_label_column]
    #          trained_model = model.fit(X_train, y_train)
    
    # 데이터 준비 - 앱 코드와 동일하게 dataframe 사용
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    # 앱 코드와 정확히 일치: X_train = dataframe[p_feature_columns]
    #                        y_train = dataframe[p_label_column]
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    # 데이터 검증
    if X_train.empty:
        raise ValueError("X_train is empty")
    if y_train.empty:
        raise ValueError("y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples: X_train.shape[0]={len(X_train)}, y_train.shape[0]={len(y_train)}")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    # 모델 생성 - LinearRegression 모듈에서 생성된 것과 동일
    model_type = '${modelType}'
    p_fit_intercept = ${fitIntercept ? "True" : "False"}
    p_alpha = ${alpha}
    p_l1_ratio = ${l1Ratio}
    
    if model_type == 'LinearRegression':
        model = LinearRegression(fit_intercept=p_fit_intercept)
    elif model_type == 'Lasso':
        model = Lasso(alpha=p_alpha, fit_intercept=p_fit_intercept, random_state=42)
    elif model_type == 'Ridge':
        model = Ridge(alpha=p_alpha, fit_intercept=p_fit_intercept, random_state=42)
    elif model_type == 'ElasticNet':
        model = ElasticNet(alpha=p_alpha, l1_ratio=p_l1_ratio, fit_intercept=p_fit_intercept, random_state=42)
    else:
        model = LinearRegression(fit_intercept=p_fit_intercept)
    
    # 튜닝 옵션 처리
    tuning_options = None
    tuning_enabled = False
    if 'js_tuning_options' in globals() and js_tuning_options is not None:
        try:
            tuning_options = js_tuning_options.to_py()
            tuning_enabled = bool(tuning_options.get('enabled'))
        except Exception:
            tuning_options = None
            tuning_enabled = False

    best_params = {}
    best_score = None
    cv_candidates = []
    scoring_metric_value = 'neg_mean_squared_error'
    if tuning_options and tuning_options.get('scoringMetric'):
        scoring_metric_value = tuning_options.get('scoringMetric')

    should_tune = tuning_enabled and tuning_options is not None and model_type in ('Lasso', 'Ridge', 'ElasticNet')

    if should_tune:
        alpha_candidates = tuning_options.get('alphaCandidates') or [p_alpha]
        alpha_candidates = [float(a) for a in alpha_candidates if a is not None]
        param_grid = {}
        if alpha_candidates:
            param_grid['alpha'] = alpha_candidates
        if model_type == 'ElasticNet':
            l1_candidates = tuning_options.get('l1RatioCandidates') or [p_l1_ratio]
            l1_candidates = [float(a) for a in l1_candidates if a is not None]
            if l1_candidates:
                param_grid['l1_ratio'] = l1_candidates
        if not param_grid:
            param_grid = {'alpha': [float(p_alpha)]}
        cv_folds = int(tuning_options.get('cvFolds', 5))
        grid_search = GridSearchCV(
            model,
            param_grid,
            cv=cv_folds,
            scoring=scoring_metric_value,
            n_jobs=None
        )
        grid_search.fit(X_train, y_train)
        trained_model = grid_search.best_estimator_
        best_params = {k: float(v) for k, v in grid_search.best_params_.items()}
        best_score = float(grid_search.best_score_)
        cv_candidates = [
            {'params': params, 'score': float(score)}
            for params, score in zip(grid_search.cv_results_['params'], grid_search.cv_results_['mean_test_score'])
        ][:10]
    else:
        trained_model = model.fit(X_train, y_train)
        if model_type in ('Lasso', 'Ridge', 'ElasticNet'):
            best_params = {'alpha': float(p_alpha)}
            if model_type == 'ElasticNet':
                best_params['l1_ratio'] = float(p_l1_ratio)
    
    # 예측 및 평가 - trained_model 사용 (앱 코드와 일치)
    y_pred = trained_model.predict(X_train)
    mse = mean_squared_error(y_train, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_train, y_pred)
    
    # 결과 준비 - coefficients를 p_feature_columns 순서대로 반환
    if p_fit_intercept:
        intercept = float(trained_model.intercept_)
        # coefficients를 p_feature_columns 순서대로 매핑
        coefficients_list = trained_model.coef_.tolist()
    else:
        intercept = 0.0
        coefficients_list = trained_model.coef_.tolist()
    
    # p_feature_columns 순서대로 coefficients 딕셔너리 생성
    coefficients_dict = {}
    for idx, col in enumerate(p_feature_columns):
        if idx < len(coefficients_list):
            coefficients_dict[col] = float(coefficients_list[idx])
    
    result = {
        'coefficients': coefficients_list,  # 배열 형태로도 반환 (기존 호환성)
        'coefficients_dict': coefficients_dict,  # 딕셔너리 형태로도 반환
        'intercept': intercept,
        'metrics': {
            'R-squared': float(r2),
            'Mean Squared Error': float(mse),
            'Root Mean Squared Error': float(rmse)
        },
        'tuning': {
            'enabled': bool(should_tune),
            'strategy': 'grid' if should_tune else None,
            'bestParams': best_params,
            'bestScore': float(best_score) if best_score is not None else None,
            'scoringMetric': scoring_metric_value if should_tune else None,
            'candidates': cv_candidates
        },
        'feature_columns': p_feature_columns  # 순서 확인용
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python LinearRegression 실행 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      // 디버깅을 위해 Python 상태 확인
      try {
        const debugInfo = py.runPython(`
import sys
debug_info = {
    'last_type': str(type(sys.last_value)) if hasattr(sys, 'last_value') and sys.last_value else None,
    'last_value': str(sys.last_value) if hasattr(sys, 'last_value') and sys.last_value else None
}
debug_info
`);
        const debug = fromPython(debugInfo);
        throw new Error(
          `Python LinearRegression error: Python code returned None or undefined. Debug info: ${JSON.stringify(
            debug
          )}`
        );
      } catch (debugError) {
        throw new Error(
          `Python LinearRegression error: Python code returned None or undefined. Check Python code execution.`
        );
      }
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 결과 검증
    if (!result || typeof result !== "object") {
      throw new Error(
        `Python LinearRegression error: Invalid result returned from Python code. Got: ${typeof result}, value: ${JSON.stringify(
          result
        )}`
      );
    }

    // 에러가 발생한 경우 처리
    if (result.__error__) {
      throw new Error(
        `Python LinearRegression error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result.coefficients || !Array.isArray(result.coefficients)) {
      throw new Error(
        `Python LinearRegression error: Missing or invalid 'coefficients' in result. Got: ${JSON.stringify(
          result
        )}`
      );
    }
    if (
      typeof result.intercept !== "number" &&
      result.intercept !== null &&
      result.intercept !== undefined
    ) {
      throw new Error(
        `Python LinearRegression error: Missing or invalid 'intercept' in result. Got: ${typeof result.intercept}`
      );
    }
    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python LinearRegression error: Missing or invalid 'metrics' in result. Got: ${typeof result.metrics}`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      coefficients: result.coefficients,
      intercept: result.intercept ?? 0.0,
      metrics: result.metrics,
      tuning: result.tuning,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    // 에러 메시지 추출
    let errorMessage = error.message || String(error);

    // Pyodide PythonError의 경우 더 자세한 정보 추출 시도
    if (
      error.name === "PythonError" ||
      error.toString().includes("Traceback")
    ) {
      try {
        const py = pyodide;
        if (py) {
          try {
            // Python의 sys.last_value에서 에러 정보 가져오기
            const lastError = py.runPython(`
import sys
import traceback
if hasattr(sys, 'last_value') and sys.last_value is not None:
    error_str = ''.join(traceback.format_exception(type(sys.last_value), sys.last_value, sys.last_traceback))
    error_str
else:
    ''
`);
            if (lastError && String(lastError).trim()) {
              errorMessage = String(lastError);
            }
          } catch (tracebackError) {
            // traceback 추출 실패 시 원본 에러 사용
          }
        }
      } catch (e) {
        // 에러 정보 추출 실패 시 원본 메시지 사용
      }
    }

    // 전체 에러 메시지 포함
    const fullError = errorMessage.includes("Traceback")
      ? errorMessage
      : `${error.toString()}\n${errorMessage}`;
    throw new Error(`Python LinearRegression error:\n${fullError}`);
  }
}

/**
 * LogisticRegression을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitLogisticRegressionPython(
  X: number[][],
  y: number[],
  penalty: string = "l2",
  C: number = 1.0,
  solver: string = "lbfgs",
  maxIter: number = 100,
  featureColumns?: string[],
  timeoutMs: number = 60000,
  tuningOptions?: LogisticRegressionTuningOptions
): Promise<{
  coefficients: number[][];
  intercept: number[];
  metrics: Record<string, number>;
  tuning?: LogisticRegressionTuningPayload;
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");
    py.globals.set("js_tuning_options", tuningOptions ? tuningOptions : null);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import GridSearchCV

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    # 데이터 검증
    if X_train.empty:
        raise ValueError("X_train is empty")
    if y_train.empty:
        raise ValueError("y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples: X_train.shape[0]={len(X_train)}, y_train.shape[0]={len(y_train)}")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    # 모델 생성
    p_penalty = '${penalty}'
    p_C = ${C}
    p_solver = '${solver}'
    p_max_iter = ${maxIter}
    
    # penalty와 solver 호환성 확인
    if p_penalty == 'l1' and p_solver not in ('liblinear', 'saga'):
        p_solver = 'liblinear'
    elif p_penalty == 'elasticnet' and p_solver != 'saga':
        p_solver = 'saga'
    elif p_penalty == 'none' and p_solver not in ('lbfgs', 'newton-cg', 'sag', 'saga'):
        p_solver = 'lbfgs'
    
    model = LogisticRegression(
        penalty=p_penalty if p_penalty != 'none' else None,
        C=p_C,
        solver=p_solver,
        max_iter=p_max_iter,
        random_state=42
    )
    
    # 튜닝 옵션 처리
    tuning_options = None
    tuning_enabled = False
    if 'js_tuning_options' in globals() and js_tuning_options is not None:
        try:
            tuning_options = js_tuning_options.to_py()
            tuning_enabled = bool(tuning_options.get('enabled'))
        except Exception:
            tuning_options = None
            tuning_enabled = False

    best_params = {}
    best_score = None
    cv_candidates = []
    scoring_metric_value = 'accuracy'
    if tuning_options and tuning_options.get('scoringMetric'):
        scoring_metric_value = tuning_options.get('scoringMetric')

    should_tune = tuning_enabled and tuning_options is not None

    if should_tune:
        c_candidates = tuning_options.get('cCandidates') or [p_C]
        c_candidates = [float(c) for c in c_candidates if c is not None]
        param_grid = {}
        if c_candidates:
            param_grid['C'] = c_candidates
        if p_penalty == 'elasticnet':
            l1_candidates = tuning_options.get('l1RatioCandidates') or [0.5]
            l1_candidates = [float(a) for a in l1_candidates if a is not None]
            if l1_candidates:
                param_grid['l1_ratio'] = l1_candidates
        if not param_grid:
            param_grid = {'C': [float(p_C)]}
        cv_folds = int(tuning_options.get('cvFolds', 5))
        grid_search = GridSearchCV(
            model,
            param_grid,
            cv=cv_folds,
            scoring=scoring_metric_value,
            n_jobs=None
        )
        grid_search.fit(X_train, y_train)
        trained_model = grid_search.best_estimator_
        best_params = {k: float(v) for k, v in grid_search.best_params_.items()}
        best_score = float(grid_search.best_score_)
        cv_candidates = [
            {'params': params, 'score': float(score)}
            for params, score in zip(grid_search.cv_results_['params'], grid_search.cv_results_['mean_test_score'])
        ][:10]
    else:
        trained_model = model.fit(X_train, y_train)
        best_params = {'C': float(p_C)}
        if p_penalty == 'elasticnet':
            best_params['l1_ratio'] = 0.5
    
    # 예측 및 평가
    y_pred = trained_model.predict(X_train)
    accuracy = accuracy_score(y_train, y_pred)
    precision = precision_score(y_train, y_pred, average='weighted', zero_division=0)
    recall = recall_score(y_train, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_train, y_pred, average='binary', zero_division=0)
    
    # ROC AUC (이진 분류인 경우만)
    roc_auc = None
    unique_labels = np.unique(y_train)
    if len(unique_labels) == 2:
        try:
            y_pred_proba = trained_model.predict_proba(X_train)[:, 1]
            roc_auc = roc_auc_score(y_train, y_pred_proba)
        except Exception:
            roc_auc = None
    
    # 결과 준비 - coefficients는 다중 클래스의 경우 2D 배열
    intercept = trained_model.intercept_.tolist()
    coefficients_list = trained_model.coef_.tolist()
    
    # p_feature_columns 순서대로 coefficients 딕셔너리 생성
    coefficients_dict = {}
    if len(coefficients_list) == 1:
        # 이진 분류
        for idx, col in enumerate(p_feature_columns):
            if idx < len(coefficients_list[0]):
                coefficients_dict[col] = float(coefficients_list[0][idx])
    else:
        # 다중 클래스
        for class_idx, coefs in enumerate(coefficients_list):
            for idx, col in enumerate(p_feature_columns):
                if idx < len(coefs):
                    key = f"{col}_class_{class_idx}"
                    coefficients_dict[key] = float(coefs[idx])
    
    metrics_dict = {
        'Accuracy': float(accuracy),
        'Precision': float(precision),
        'Recall': float(recall),
        'F1-Score': float(f1)
    }
    if roc_auc is not None:
        metrics_dict['ROC-AUC'] = float(roc_auc)
    
    result = {
        'coefficients': coefficients_list,
        'coefficients_dict': coefficients_dict,
        'intercept': intercept,
        'metrics': metrics_dict,
        'tuning': {
            'enabled': bool(should_tune),
            'strategy': 'grid' if should_tune else None,
            'bestParams': best_params,
            'bestScore': float(best_score) if best_score is not None else None,
            'scoringMetric': scoring_metric_value if should_tune else None,
            'candidates': cv_candidates
        },
        'feature_columns': p_feature_columns
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python LogisticRegression 실행 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python LogisticRegression error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result.__error__) {
      throw new Error(
        `Python LogisticRegression error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result.coefficients || !Array.isArray(result.coefficients)) {
      throw new Error(
        `Python LogisticRegression error: Missing or invalid 'coefficients' in result.`
      );
    }
    if (!result.intercept || !Array.isArray(result.intercept)) {
      throw new Error(
        `Python LogisticRegression error: Missing or invalid 'intercept' in result.`
      );
    }
    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python LogisticRegression error: Missing or invalid 'metrics' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");
    if (py.globals.has("js_tuning_options")) {
      py.globals.delete("js_tuning_options");
    }

    return {
      coefficients: result.coefficients,
      intercept: result.intercept,
      metrics: result.metrics,
      tuning: result.tuning,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
        if (py.globals.has("js_tuning_options")) {
          py.globals.delete("js_tuning_options");
        }
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python LogisticRegression error:\n${errorMessage}`);
  }
}

/**
 * K-Nearest Neighbors 모델을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitKNNPython(
  X: number[][],
  y: number[],
  modelPurpose: string = "classification",
  nNeighbors: number = 3,
  weights: string = "uniform",
  algorithm: string = "auto",
  metric: string = "minkowski",
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_squared_error, r2_score, mean_absolute_error

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    # 데이터 검증
    if X_train.empty:
        raise ValueError("X_train is empty")
    if y_train.empty:
        raise ValueError("y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples: X_train.shape[0]={len(X_train)}, y_train.shape[0]={len(y_train)}")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    # 모델 생성
    p_model_purpose = '${modelPurpose}'
    p_n_neighbors = ${nNeighbors}
    p_weights = '${weights}'
    p_algorithm = '${algorithm}'
    p_metric = '${metric}'
    
    if p_model_purpose == 'classification':
        model = KNeighborsClassifier(
            n_neighbors=p_n_neighbors,
            weights=p_weights,
            algorithm=p_algorithm,
            metric=p_metric
        )
    else:
        model = KNeighborsRegressor(
            n_neighbors=p_n_neighbors,
            weights=p_weights,
            algorithm=p_algorithm,
            metric=p_metric
        )
    
    # 모델 훈련
    trained_model = model.fit(X_train, y_train)
    
    # 예측 및 평가
    y_pred = trained_model.predict(X_train)
    
    if p_model_purpose == 'classification':
        accuracy = accuracy_score(y_train, y_pred)
        
        # 이진 분류인지 확인
        unique_labels = np.unique(y_train)
        is_binary = len(unique_labels) == 2
        
        # average 파라미터 결정: 이진 분류면 'binary', 다중 분류면 'weighted'
        avg_param = 'binary' if is_binary else 'weighted'
        
        precision = precision_score(y_train, y_pred, average=avg_param, zero_division=0)
        recall = recall_score(y_train, y_pred, average=avg_param, zero_division=0)
        f1 = f1_score(y_train, y_pred, average=avg_param, zero_division=0)
        
        # ROC AUC (이진 분류인 경우만)
        roc_auc = None
        if is_binary:
            try:
                y_pred_proba = trained_model.predict_proba(X_train)[:, 1]
                roc_auc = roc_auc_score(y_train, y_pred_proba)
            except Exception:
                roc_auc = None
        
        metrics_dict = {
            'Accuracy': float(accuracy),
            'Precision': float(precision),
            'Recall': float(recall),
            'F1-Score': float(f1)
        }
        if roc_auc is not None:
            metrics_dict['ROC-AUC'] = float(roc_auc)
    else:
        mse = mean_squared_error(y_train, y_pred)
        mae = mean_absolute_error(y_train, y_pred)
        r2 = r2_score(y_train, y_pred)
        rmse = np.sqrt(mse)
        
        metrics_dict = {
            'R-squared': float(r2),
            'Mean Squared Error': float(mse),
            'Root Mean Squared Error': float(rmse),
            'Mean Absolute Error': float(mae)
        }
    
    result = {
        'metrics': metrics_dict,
        'feature_columns': p_feature_columns
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python KNN 실행 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python KNN error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result.__error__) {
      throw new Error(
        `Python KNN error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python KNN error: Missing or invalid 'metrics' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python KNN error:\n${errorMessage}`);
  }
}

/**
 * Decision Tree 모델을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitDecisionTreePython(
  X: number[][],
  y: number[],
  modelPurpose: string = "classification",
  criterion: string = "gini",
  maxDepth: number | null = null,
  minSamplesSplit: number = 2,
  minSamplesLeaf: number = 1,
  classWeight: string | null = null,
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
  featureImportances?: Record<string, number>;
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_squared_error, r2_score, mean_absolute_error

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    # 데이터 검증
    if X_train.empty:
        raise ValueError("X_train is empty")
    if y_train.empty:
        raise ValueError("y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples: X_train.shape[0]={len(X_train)}, y_train.shape[0]={len(y_train)}")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    # 모델 생성
    p_model_purpose = '${modelPurpose}'
    p_criterion = '${criterion}'
    p_max_depth = ${maxDepth !== null ? maxDepth : "None"}
    p_min_samples_split = ${minSamplesSplit}
    p_min_samples_leaf = ${minSamplesLeaf}
    p_class_weight = ${classWeight !== null ? `'${classWeight}'` : "None"}
    
    if p_model_purpose == 'classification':
        model = DecisionTreeClassifier(
            criterion=p_criterion.lower(),
            max_depth=p_max_depth,
            min_samples_split=p_min_samples_split,
            min_samples_leaf=p_min_samples_leaf,
            class_weight=p_class_weight,
            random_state=42
        )
    else:
        criterion_reg = 'squared_error' if p_criterion == 'mse' else 'absolute_error'
        model = DecisionTreeRegressor(
            criterion=criterion_reg,
            max_depth=p_max_depth,
            min_samples_split=p_min_samples_split,
            min_samples_leaf=p_min_samples_leaf,
            random_state=42
        )
    
    # 모델 훈련
    model.fit(X_train, y_train)
    
    # 예측
    y_pred = model.predict(X_train)
    
    # 메트릭 계산
    if p_model_purpose == 'classification':
        accuracy = float(accuracy_score(y_train, y_pred))
        
        # 이진 분류인지 확인
        unique_labels = np.unique(y_train)
        is_binary = len(unique_labels) == 2
        
        # average 파라미터 결정: 이진 분류면 'binary', 다중 분류면 'weighted'
        avg_param = 'binary' if is_binary else 'weighted'
        
        precision = float(precision_score(y_train, y_pred, average=avg_param, zero_division=0))
        recall = float(recall_score(y_train, y_pred, average=avg_param, zero_division=0))
        f1 = float(f1_score(y_train, y_pred, average=avg_param, zero_division=0))
        
        metrics_dict = {
            'Accuracy': accuracy,
            'Precision': precision,
            'Recall': recall,
            'F1-Score': f1
        }
        
        # ROC-AUC 계산 (이진 분류인 경우만)
        if is_binary:
            try:
                y_pred_proba = model.predict_proba(X_train)[:, 1]
                roc_auc = float(roc_auc_score(y_train, y_pred_proba))
                metrics_dict['ROC-AUC'] = roc_auc
            except Exception:
                pass
    else:
        mse = float(mean_squared_error(y_train, y_pred))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_train, y_pred))
        r2 = float(r2_score(y_train, y_pred))
        
        metrics_dict = {
            'R-squared': r2,
            'Mean Squared Error': mse,
            'Root Mean Squared Error': rmse,
            'Mean Absolute Error': mae
        }
    
    # Feature Importance 추출 (Decision Tree의 경우)
    feature_importances = {}
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        for i, feature in enumerate(p_feature_columns):
            feature_importances[feature] = float(importances[i])
    
    result = {
        'metrics': metrics_dict,
        'feature_columns': p_feature_columns,
        'feature_importances': feature_importances
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Decision Tree 실행 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python Decision Tree error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result.__error__) {
      throw new Error(
        `Python Decision Tree error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python Decision Tree error: Missing or invalid 'metrics' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
      featureImportances: result.feature_importances || {},
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Decision Tree error:\n${errorMessage}`);
  }
}

/**
 * Neural Network 모델을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitNeuralNetworkPython(
  X: number[][],
  y: number[],
  modelPurpose: string = "classification",
  hiddenLayerSizes: string = "100",
  activation: string = "relu",
  maxIter: number = 200,
  randomState: number = 2022,
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
  featureImportances?: Record<string, number>;
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_squared_error, r2_score, mean_absolute_error

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    # 데이터 검증
    if X_train.empty:
        raise ValueError("X_train is empty")
    if y_train.empty:
        raise ValueError("y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples: X_train.shape[0]={len(X_train)}, y_train.shape[0]={len(y_train)}")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    # 모델 생성
    p_model_purpose = '${modelPurpose}'
    p_hidden_layer_sizes = '${hiddenLayerSizes}'
    p_activation = '${activation}'
    p_max_iter = ${maxIter}
    p_random_state = ${randomState}
    
    # Parse hidden_layer_sizes (e.g., "100" -> (100,), "100,50" -> (100, 50))
    if isinstance(p_hidden_layer_sizes, str):
        hidden_layers = tuple(int(x.strip()) for x in p_hidden_layer_sizes.split(','))
    else:
        hidden_layers = (100,) if p_hidden_layer_sizes is None else (p_hidden_layer_sizes,)
    
    if p_model_purpose == 'classification':
        model = MLPClassifier(
            hidden_layer_sizes=hidden_layers,
            activation=p_activation,
            max_iter=p_max_iter,
            random_state=p_random_state
        )
    else:
        model = MLPRegressor(
            hidden_layer_sizes=hidden_layers,
            activation=p_activation,
            max_iter=p_max_iter,
            random_state=p_random_state
        )
    
    # 모델 훈련
    model.fit(X_train, y_train)
    
    # 예측
    y_pred = model.predict(X_train)
    
    # 메트릭 계산
    metrics = {}
    if p_model_purpose == 'classification':
        # 분류 메트릭
        accuracy = accuracy_score(y_train, y_pred)
        metrics['Accuracy'] = float(accuracy)
        
        # 이진 분류인지 다중 분류인지 확인
        unique_labels = np.unique(y_train)
        is_binary = len(unique_labels) == 2
        
        if is_binary:
            # 이진 분류
            precision = precision_score(y_train, y_pred, average='binary', zero_division=0)
            recall = recall_score(y_train, y_pred, average='binary', zero_division=0)
            f1 = f1_score(y_train, y_pred, average='binary', zero_division=0)
            
            # ROC-AUC (이진 분류만)
            try:
                y_pred_proba = model.predict_proba(X_train)[:, 1]
                roc_auc = roc_auc_score(y_train, y_pred_proba)
                metrics['ROC-AUC'] = float(roc_auc)
            except:
                metrics['ROC-AUC'] = 0.0
        else:
            # 다중 분류
            precision = precision_score(y_train, y_pred, average='weighted', zero_division=0)
            recall = recall_score(y_train, y_pred, average='weighted', zero_division=0)
            f1 = f1_score(y_train, y_pred, average='weighted', zero_division=0)
            metrics['ROC-AUC'] = 0.0  # 다중 분류는 ROC-AUC 계산 안 함
        
        metrics['Precision'] = float(precision)
        metrics['Recall'] = float(recall)
        metrics['F1-Score'] = float(f1)
    else:
        # 회귀 메트릭
        mse = mean_squared_error(y_train, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_train, y_pred)
        r2 = r2_score(y_train, y_pred)
        
        metrics['MSE'] = float(mse)
        metrics['RMSE'] = float(rmse)
        metrics['MAE'] = float(mae)
        metrics['R-squared'] = float(r2)
    
    # Feature Importance는 Neural Network에서 직접 제공하지 않으므로 빈 딕셔너리 반환
    feature_importances = {}
    
    # 결과 반환
    result = {
        'metrics': metrics,
        'feature_importances': feature_importances
    }
    
    js_result = result
    
except Exception as e:
    error_type = type(e).__name__
    error_message = str(e)
    error_traceback = traceback.format_exc()
    
    result = {
        '__error__': True,
        'error_type': error_type,
        'error_message': error_message,
        'error_traceback': error_traceback
    }
    js_result = result
`;

    await withTimeout(
      py.runPythonAsync(code),
      timeoutMs,
      `Neural Network 훈련 타임아웃 (${timeoutMs}ms 초과)`
    );

    // 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // Python 딕셔너리를 JavaScript 객체로 변환
    let result: any;
    if (resultPyObj && typeof resultPyObj.toJs === "function") {
      result = resultPyObj.toJs({ dict_converter: Object.fromEntries });
    } else {
      // JSON을 통해 변환
      const jsonStr = py.runPython("import json; json.dumps(js_result)");
      result = JSON.parse(jsonStr);
    }

    // 에러가 발생한 경우 처리
    if (result.__error__) {
      throw new Error(
        `Python Neural Network error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python Neural Network error: Missing or invalid 'metrics' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
      featureImportances: result.feature_importances || {},
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Neural Network error:\n${errorMessage}`);
  }
}

/**
 * Neural Network 모델로 예측을 수행합니다
 * Decision Tree와 유사하게 재훈련하는 방식으로 구현
 */
export async function scoreNeuralNetworkPython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  hiddenLayerSizes: string,
  activation: string,
  maxIter: number,
  randomState: number,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_hidden_layer_sizes", hiddenLayerSizes);
    py.globals.set("js_activation", activation);
    py.globals.set("js_max_iter", maxIter);
    py.globals.set("js_random_state", randomState);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.neural_network import MLPClassifier, MLPRegressor

try:
    # 데이터 준비
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)
    model_purpose = str(js_model_purpose)
    
    # 훈련 데이터 준비
    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)
    
    # 모델 파라미터
    hidden_layer_sizes = str(js_hidden_layer_sizes)
    activation = str(js_activation)
    max_iter = int(js_max_iter)
    random_state = int(js_random_state)
    
    # Parse hidden_layer_sizes (e.g., "100" -> (100,), "100,50" -> (100, 50))
    if isinstance(hidden_layer_sizes, str):
        hidden_layers = tuple(int(x.strip()) for x in hidden_layer_sizes.split(','))
    else:
        hidden_layers = (100,) if hidden_layer_sizes is None else (hidden_layer_sizes,)
    
    # 훈련 데이터에서 특성과 레이블 추출
    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]
    
    # 모델 생성 및 훈련
    if model_purpose == 'classification':
        model = MLPClassifier(
            hidden_layer_sizes=hidden_layers,
            activation=activation,
            max_iter=max_iter,
            random_state=random_state
        )
    else:
        model = MLPRegressor(
            hidden_layer_sizes=hidden_layers,
            activation=activation,
            max_iter=max_iter,
            random_state=random_state
        )
    
    # 모델 훈련
    model.fit(X_train, y_train)
    
    # 예측 수행
    X = df[feature_columns]
    predictions = model.predict(X)
    
    # 결과 데이터프레임 생성
    result_df = df.copy()
    result_df['Predict'] = predictions
    
    # 분류 모델인 경우 확률도 계산
    if model_purpose == 'classification':
        try:
            probabilities = model.predict_proba(X)
            if probabilities.shape[1] == 2:
                # 이진 분류
                result_df['Probability_1'] = probabilities[:, 1]
            else:
                # 다중 분류
                for i in range(probabilities.shape[1]):
                    result_df[f'Probability_{i}'] = probabilities[:, i]
        except:
            pass
    
    # 결과 반환
    js_result = {
        'rows': result_df.to_dict('records'),
        'columns': [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    }
    
except Exception as e:
    error_type = type(e).__name__
    error_message = str(e)
    error_traceback = traceback.format_exc()
    
    result = {
        '__error__': True,
        'error_type': error_type,
        'error_message': error_message,
        'error_traceback': error_traceback
    }
    js_result = result
`;

    await withTimeout(
      py.runPythonAsync(code),
      timeoutMs,
      `Neural Network 예측 타임아웃 (${timeoutMs}ms 초과)`
    );

    // 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // Python 딕셔너리를 JavaScript 객체로 변환
    let result: any;
    if (resultPyObj && typeof resultPyObj.toJs === "function") {
      result = resultPyObj.toJs({ dict_converter: Object.fromEntries });
    } else {
      // JSON을 통해 변환
      const jsonStr = py.runPython("import json; json.dumps(js_result)");
      result = JSON.parse(jsonStr);
    }

    // 에러가 발생한 경우 처리
    if (result.__error__) {
      throw new Error(
        `Python Neural Network 예측 error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_hidden_layer_sizes");
    py.globals.delete("js_activation");
    py.globals.delete("js_max_iter");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return result;
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_hidden_layer_sizes");
        py.globals.delete("js_activation");
        py.globals.delete("js_max_iter");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Neural Network 예측 error:\n${errorMessage}`);
  }
}

/**
 * SVM 모델을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitSVMPython(
  X: number[][],
  y: number[],
  modelPurpose: string = "classification",
  kernel: string = "rbf",
  C: number = 1.0,
  gamma: string | number = "scale",
  degree: number = 3,
  probability: boolean = false,
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.svm import SVC, SVR
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_squared_error, r2_score, mean_absolute_error

try:
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    if X_train.empty or y_train.empty:
        raise ValueError("X_train or y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    p_model_purpose = '${modelPurpose}'
    p_kernel = '${kernel}'
    p_C = ${C}
    ${typeof gamma === "string" ? `p_gamma = '${gamma}'` : `p_gamma = ${gamma}`}
    p_degree = ${degree}
    p_probability = ${probability}
    
    if p_model_purpose == 'classification':
        model = SVC(
            kernel=p_kernel,
            C=p_C,
            gamma=p_gamma,
            degree=p_degree,
            probability=p_probability,
            random_state=42
        )
    else:
        model = SVR(
            kernel=p_kernel,
            C=p_C,
            gamma=p_gamma,
            degree=p_degree
        )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_train)
    
    if p_model_purpose == 'classification':
        accuracy = float(accuracy_score(y_train, y_pred))
        
        # 이진 분류인지 확인
        unique_labels = np.unique(y_train)
        is_binary = len(unique_labels) == 2
        
        # average 파라미터 결정: 이진 분류면 'binary', 다중 분류면 'weighted'
        avg_param = 'binary' if is_binary else 'weighted'
        
        precision = float(precision_score(y_train, y_pred, average=avg_param, zero_division=0))
        recall = float(recall_score(y_train, y_pred, average=avg_param, zero_division=0))
        f1 = float(f1_score(y_train, y_pred, average=avg_param, zero_division=0))
        
        metrics_dict = {
            'Accuracy': accuracy,
            'Precision': precision,
            'Recall': recall,
            'F1-Score': f1
        }
        
        try:
            if is_binary:
                y_pred_proba = model.predict_proba(X_train)[:, 1]
                roc_auc = float(roc_auc_score(y_train, y_pred_proba))
                metrics_dict['ROC-AUC'] = roc_auc
        except Exception:
            pass
    else:
        mse = float(mean_squared_error(y_train, y_pred))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_train, y_pred))
        r2 = float(r2_score(y_train, y_pred))
        
        metrics_dict = {
            'R-squared': r2,
            'Mean Squared Error': mse,
            'Root Mean Squared Error': rmse,
            'Mean Absolute Error': mae
        }
    
    result = {
        'metrics': metrics_dict,
        'feature_columns': p_feature_columns
    }
    
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python SVM 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python SVM error: Python code returned None or undefined.`
      );
    }

    const result = fromPython(resultPyObj);

    if (result.__error__) {
      throw new Error(
        `Python SVM error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python SVM error: Missing or invalid 'metrics' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
    };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python SVM error:\n${errorMessage}`);
  }
}

/**
 * Linear Discriminant Analysis 모델을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitLDAPython(
  X: number[][],
  y: number[],
  solver: string = "svd",
  shrinkage: number | null = null,
  nComponents: number | null = null,
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    const shrinkageStr = shrinkage !== null ? String(shrinkage) : "None";
    const nComponentsStr = nComponents !== null ? String(nComponents) : "None";

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

try:
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    if X_train.empty or y_train.empty:
        raise ValueError("X_train or y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    p_solver = '${solver}'
    p_shrinkage = ${shrinkageStr} if ${shrinkageStr} != 'None' else None
    p_n_components = ${nComponentsStr} if ${nComponentsStr} != 'None' else None
    
    model = LinearDiscriminantAnalysis(
        solver=p_solver,
        shrinkage=p_shrinkage,
        n_components=p_n_components
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_train)
    
    accuracy = float(accuracy_score(y_train, y_pred))
    
    # 이진 분류인지 확인
    unique_labels = np.unique(y_train)
    is_binary = len(unique_labels) == 2
    
    # average 파라미터 결정: 이진 분류면 'binary', 다중 분류면 'weighted'
    avg_param = 'binary' if is_binary else 'weighted'
    
    precision = float(precision_score(y_train, y_pred, average=avg_param, zero_division=0))
    recall = float(recall_score(y_train, y_pred, average=avg_param, zero_division=0))
    f1 = float(f1_score(y_train, y_pred, average=avg_param, zero_division=0))
    
    metrics_dict = {
        'Accuracy': accuracy,
        'Precision': precision,
        'Recall': recall,
        'F1-Score': f1
    }
    
    try:
        if is_binary:
            y_pred_proba = model.predict_proba(X_train)[:, 1]
            roc_auc = float(roc_auc_score(y_train, y_pred_proba))
            metrics_dict['ROC-AUC'] = roc_auc
    except Exception:
        pass
    
    result = {
        'metrics': metrics_dict,
        'feature_columns': p_feature_columns
    }
    
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python LDA 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python LDA error: Python code returned None or undefined.`
      );
    }

    const result = fromPython(resultPyObj);

    if (result.__error__) {
      throw new Error(
        `Python LDA error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python LDA error: Missing or invalid 'metrics' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
    };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python LDA error:\n${errorMessage}`);
  }
}

/**
 * Naive Bayes 모델을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function fitNaiveBayesPython(
  X: number[][],
  y: number[],
  modelType: string = "Gaussian",
  alpha: number = 1.0,
  fitPrior: boolean = true,
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.naive_bayes import GaussianNB, MultinomialNB, BernoulliNB, ComplementNB
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

try:
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    if X_train.empty or y_train.empty:
        raise ValueError("X_train or y_train is empty")
    if len(X_train) != len(y_train):
        raise ValueError(f"X_train and y_train must have same number of samples")
    if len(X_train) < 1:
        raise ValueError(f"Need at least 1 sample, got {len(X_train)}")
    
    p_model_type = '${modelType}'
    p_alpha = ${alpha}
    p_fit_prior = ${fitPrior ? "True" : "False"}
    
    if p_model_type == 'Gaussian':
        model = GaussianNB()
    elif p_model_type == 'Multinomial':
        model = MultinomialNB(alpha=p_alpha, fit_prior=p_fit_prior)
    elif p_model_type == 'Bernoulli':
        model = BernoulliNB(alpha=p_alpha, fit_prior=p_fit_prior)
    elif p_model_type == 'Complement':
        model = ComplementNB(alpha=p_alpha, fit_prior=p_fit_prior)
    else:
        model = GaussianNB()
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_train)
    
    accuracy = float(accuracy_score(y_train, y_pred))
    
    # 이진 분류인지 확인
    unique_labels = np.unique(y_train)
    is_binary = len(unique_labels) == 2
    
    # average 파라미터 결정: 이진 분류면 'binary', 다중 분류면 'weighted'
    avg_param = 'binary' if is_binary else 'weighted'
    
    precision = float(precision_score(y_train, y_pred, average=avg_param, zero_division=0))
    recall = float(recall_score(y_train, y_pred, average=avg_param, zero_division=0))
    f1 = float(f1_score(y_train, y_pred, average=avg_param, zero_division=0))
    
    metrics_dict = {
        'Accuracy': accuracy,
        'Precision': precision,
        'Recall': recall,
        'F1-Score': f1
    }
    
    try:
        if is_binary:
            y_pred_proba = model.predict_proba(X_train)[:, 1]
            roc_auc = float(roc_auc_score(y_train, y_pred_proba))
            metrics_dict['ROC-AUC'] = roc_auc
    except Exception:
        pass
    
    result = {
        'metrics': metrics_dict,
        'feature_columns': p_feature_columns
    }
    
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Naive Bayes 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Naive Bayes error: Python code returned None or undefined.`
      );
    }

    const result = fromPython(resultPyObj);

    if (result.__error__) {
      throw new Error(
        `Python Naive Bayes error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python Naive Bayes error: Missing or invalid 'metrics' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
    };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Naive Bayes error:\n${errorMessage}`);
  }
}

/**
 * Count Regression (Poisson, Negative Binomial, Quasi-Poisson)을 statsmodels로 실행합니다
 * 타임아웃: 60초
 */
export async function fitCountRegressionStatsmodels(
  X: number[][],
  y: number[],
  distributionType: string,
  featureColumns: string[],
  maxIter: number = 100,
  disp: number = 1.0,
  timeoutMs: number = 60000
): Promise<{
  coefficients: Record<string, number>;
  intercept: number;
  metrics: Record<string, number>;
  summary: {
    coefficients: Record<
      string,
      {
        coef: number;
        "std err": number;
        z: number;
        "P>|z|": number;
        "[0.025": number;
        "0.975]": number;
      }
    >;
    metrics: Record<string, number | string>;
  };
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // statsmodels 패키지 로드
    await withTimeout(
      py.loadPackage(["statsmodels"]),
      60000,
      "statsmodels 패키지 설치 타임아웃 (60초 초과)"
    );

    py.globals.set("js_X", X);
    py.globals.set("js_y", y);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_distribution_type", distributionType);
    py.globals.set("js_max_iter", maxIter);
    py.globals.set("js_disp", disp);

    const code = `
import json
import pandas as pd
import numpy as np
import sys
sys.path.append('/')
from data_analysis_modules import fit_count_regression_statsmodels

# 데이터 준비
X_array = js_X.to_py()
y_array = js_y.to_py()
feature_columns = js_feature_columns.to_py()
distribution_type = js_distribution_type.to_py()
max_iter = int(js_max_iter)
disp = float(js_disp)

# DataFrame 생성
df = pd.DataFrame(X_array, columns=feature_columns)
df['label'] = y_array

# 모델 피팅
result = fit_count_regression_statsmodels(
    df=df,
    distribution_type=distribution_type,
    feature_columns=feature_columns,
    label_column='label',
    max_iter=max_iter,
    disp=disp
)

# 결과 추출
results_obj = result['results']
coefficients_dict = result['coefficients']
metrics_dict = result['metrics']

# 계수와 절편 추출
intercept = coefficients_dict.get('const', {}).get('coef', 0.0)
feature_coefficients = {}
for col in feature_columns:
    if col in coefficients_dict:
        feature_coefficients[col] = coefficients_dict[col]['coef']

# 통계량 준비
summary_coefficients = {}
for param_name, param_data in coefficients_dict.items():
    summary_coefficients[param_name] = {
        'coef': float(param_data['coef']),
        'std err': float(param_data['std err']),
        'z': float(param_data['z']),
        'P>|z|': float(param_data['P>|z|']),
        '[0.025': float(param_data['[0.025']),
        '0.975]': float(param_data['0.975]'])
    }

# 메트릭 준비 (None 값 제거)
summary_metrics = {}
for key, value in metrics_dict.items():
    if value is not None:
        if isinstance(value, (int, float)):
            summary_metrics[key] = float(value)
        else:
            summary_metrics[key] = str(value)

# 반환값 구성
result_dict = {
    'coefficients': feature_coefficients,
    'intercept': float(intercept),
    'metrics': summary_metrics,
    'summary': {
        'coefficients': summary_coefficients,
        'metrics': summary_metrics
    }
}

json.dumps(result_dict)
`;

    const resultJson = await withTimeout(
      py.runPython(code),
      timeoutMs,
      `Count Regression 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);

    return {
      coefficients: result.coefficients,
      intercept: result.intercept,
      metrics: result.metrics,
      summary: result.summary,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(
      `Python Count Regression (statsmodels) error:\n${errorMessage}`
    );
  }
}

/**
 * Statsmodels를 사용하여 통계 모델을 실행합니다
 * 타임아웃: 120초
 */
export async function runStatsModel(
  X: number[][],
  y: number[],
  modelType: string,
  featureColumns: string[],
  timeoutMs: number = 120000,
  maxIter: number = 100,
  disp: number = 1.0
): Promise<{
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
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // statsmodels 패키지 로드
    await withTimeout(
      py.loadPackage(["statsmodels"]),
      60000,
      "statsmodels 패키지 설치 타임아웃 (60초 초과)"
    );

    py.globals.set("js_X", X);
    py.globals.set("js_y", y);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_model_type", modelType);
    py.globals.set("js_max_iter", maxIter);
    py.globals.set("js_disp", disp);

    const code = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm

# fit_count_regression_statsmodels 함수 정의
def fit_count_regression_statsmodels(df, distribution_type, feature_columns, label_column, max_iter=100, disp=1.0):
    print(f"{distribution_type} 회귀 모델 피팅 중...")
    
    X = df[feature_columns].copy()
    y = df[label_column].copy()
    
    # 결측치 제거
    mask = ~(X.isnull().any(axis=1) | y.isnull())
    X = X[mask]
    y = y[mask]
    
    if len(X) == 0:
        raise ValueError("유효한 데이터가 없습니다. 결측치를 확인하세요.")
    
    X = sm.add_constant(X, prepend=True)
    
    try:
        if distribution_type == 'Poisson':
            model = sm.Poisson(y, X)
            results = model.fit(maxiter=max_iter)
        elif distribution_type == 'NegativeBinomial':
            model = sm.NegativeBinomial(y, X, loglike_method='nb2')
            results = model.fit(maxiter=max_iter, disp=disp)
        elif distribution_type == 'QuasiPoisson':
            model = sm.GLM(y, X, family=sm.families.Poisson())
            results = model.fit(maxiter=max_iter)
            mu = results.mu
            pearson_resid = (y - mu) / np.sqrt(mu)
            phi = np.sum(pearson_resid**2) / (len(y) - len(feature_columns) - 1)
            results.scale = phi
        else:
            raise ValueError(f"지원하지 않는 분포 타입: {distribution_type}")
        
        summary_text = str(results.summary())
        print(f"\\n--- {distribution_type} 회귀 모델 결과 ---")
        print(summary_text)
        
        metrics = {}
        metrics['Log Likelihood'] = results.llf if hasattr(results, 'llf') else None
        metrics['AIC'] = results.aic if hasattr(results, 'aic') else None
        metrics['BIC'] = results.bic if hasattr(results, 'bic') else None
        metrics['Deviance'] = results.deviance if hasattr(results, 'deviance') else None
        metrics['Pearson chi2'] = results.pearson_chi2 if hasattr(results, 'pearson_chi2') else None
        
        if distribution_type == 'NegativeBinomial':
            if hasattr(model, 'alpha'):
                metrics['Dispersion (alpha)'] = model.alpha
            elif hasattr(results, 'alpha'):
                metrics['Dispersion (alpha)'] = results.alpha
        
        if distribution_type == 'QuasiPoisson':
            if hasattr(results, 'scale'):
                metrics['Dispersion (phi)'] = results.scale
        
        coefficients = {}
        if hasattr(results, 'params'):
            params = results.params
            if hasattr(params, 'to_dict'):
                params_dict = params.to_dict()
            else:
                params_dict = {}
                for i, name in enumerate(results.model.exog_names):
                    if hasattr(params, 'iloc'):
                        val = params.iloc[i]
                    elif hasattr(params, '__getitem__'):
                        val = params[i]
                    else:
                        val = params.values[i] if hasattr(params, 'values') else 0.0
                    # 값이 메서드가 아닌지 확인하고 실제 값을 가져옴
                    if callable(val) and not isinstance(val, (int, float, np.number)):
                        try:
                            val = val() if hasattr(val, '__call__') else 0.0
                        except:
                            val = 0.0
                    params_dict[name] = val
            
            if hasattr(results, 'bse'):
                bse = results.bse
                if hasattr(bse, 'to_dict'):
                    bse_dict = bse.to_dict()
                else:
                    bse_dict = {}
                    for i, name in enumerate(results.model.exog_names):
                        if hasattr(bse, 'iloc'):
                            val = bse.iloc[i]
                        elif hasattr(bse, '__getitem__'):
                            val = bse[i]
                        else:
                            val = bse.values[i] if hasattr(bse, 'values') else 0.0
                        # 값이 메서드가 아닌지 확인하고 실제 값을 가져옴
                        if callable(val) and not isinstance(val, (int, float, np.number)):
                            try:
                                val = val() if hasattr(val, '__call__') else 0.0
                            except:
                                val = 0.0
                        bse_dict[name] = val
            else:
                bse_dict = {name: 0.0 for name in params_dict.keys()}
            
            if hasattr(results, 'tvalues'):
                tvalues = results.tvalues
            elif hasattr(results, 'zvalues'):
                tvalues = results.zvalues
            else:
                tvalues = None
            
            if hasattr(results, 'pvalues'):
                pvalues = results.pvalues
            else:
                pvalues = None
            
            conf_int = None
            if hasattr(results, 'conf_int'):
                conf_int = results.conf_int()
            
            # float 변환을 안전하게 처리하는 헬퍼 함수
            def safe_float(value, default=0.0):
                if value is None:
                    return default
                # callable이지만 숫자 타입이 아닌 경우 (메서드 객체)
                if callable(value) and not isinstance(value, (int, float, np.number)):
                    try:
                        value = value()
                    except:
                        return default
                try:
                    return float(value)
                except (TypeError, ValueError):
                    return default
            
            for param_name in params_dict.keys():
                coef_value = params_dict[param_name]
                std_err = bse_dict.get(param_name, 0.0)
                z_value = tvalues[param_name] if tvalues is not None and param_name in tvalues.index else 0.0
                p_value = pvalues[param_name] if pvalues is not None and param_name in pvalues.index else 1.0
                
                conf_lower = conf_int.loc[param_name, 0] if conf_int is not None and param_name in conf_int.index else 0.0
                conf_upper = conf_int.loc[param_name, 1] if conf_int is not None and param_name in conf_int.index else 0.0
                
                coefficients[param_name] = {
                    'coef': safe_float(coef_value),
                    'std err': safe_float(std_err),
                    'z': safe_float(z_value),
                    'P>|z|': safe_float(p_value),
                    '[0.025': safe_float(conf_lower),
                    '0.975]': safe_float(conf_upper)
                }
        
        return {
            'results': results,
            'summary_text': summary_text,
            'metrics': metrics,
            'coefficients': coefficients,
            'distribution_type': distribution_type
        }
        
    except Exception as e:
        print(f"모델 피팅 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        raise

# run_stats_model 함수 정의
def run_stats_model(df, model_type, feature_columns, label_column, max_iter=100, disp=1.0):
    # Count regression 모델의 경우 fit_count_regression_statsmodels 사용
    if model_type in ['Poisson', 'NegativeBinomial', 'QuasiPoisson']:
        model_results = fit_count_regression_statsmodels(
            df, model_type, feature_columns, label_column, max_iter, disp
        )
        
        print("\\n=== 모델 통계량 ===")
        for key, value in model_results['metrics'].items():
            if value is not None:
                print(f"{key}: {value:.6f}")
        
        print("\\n=== 계수 정보 ===")
        for param_name, coef_info in model_results['coefficients'].items():
            print(f"{param_name}:")
            print(f"  계수: {coef_info['coef']:.6f}")
            print(f"  표준 오차: {coef_info['std err']:.6f}")
            print(f"  z-통계량: {coef_info['z']:.6f}")
            print(f"  p-value: {coef_info['P>|z|']:.6f}")
            print(f"  신뢰구간: [{coef_info['[0.025']:.6f}, {coef_info['0.975]']:.6f}]")
        
        return model_results['results']
    
    # 다른 모델의 경우 기존 방식 사용
    print(f"{model_type} 모델 피팅 중...")
    
    X = df[feature_columns]
    y = df[label_column]
    X = sm.add_constant(X, prepend=True)
    
    if model_type == 'OLS':
        model = sm.OLS(y, X)
    elif model_type == 'Logistic':
        model = sm.Logit(y, X)
    elif model_type == 'Gamma':
        model = sm.GLM(y, X, family=sm.families.Gamma())
    elif model_type == 'Tweedie':
        model = sm.GLM(y, X, family=sm.families.Tweedie(var_power=1.5))
    else:
        print(f"오류: 알 수 없는 모델 타입 '{model_type}'")
        return None
    
    try:
        results = model.fit()
        print(f"\\n--- {model_type} 모델 결과 ---")
        print(results.summary())
        return results
    except Exception as e:
        print(f"모델 피팅 중 오류 발생: {e}")
        return None

# 데이터 준비
X_array = js_X.to_py()
y_array = js_y.to_py()
feature_columns = js_feature_columns.to_py()
model_type = str(js_model_type)  # 이미 문자열이므로 to_py() 불필요
max_iter = int(js_max_iter)
disp = float(js_disp)

# DataFrame 생성
df = pd.DataFrame(X_array, columns=feature_columns)
df['label'] = y_array

# 모델 피팅
results_obj = run_stats_model(
    df=df,
    model_type=model_type,
    feature_columns=feature_columns,
    label_column='label',
    max_iter=max_iter,
    disp=disp
)

if results_obj is None:
    raise ValueError("모델 피팅 실패")

# 결과 추출
summary_text = str(results_obj.summary())

# 계수 정보 추출
coefficients_dict = {}
if hasattr(results_obj, 'params'):
    params = results_obj.params
    bse = results_obj.bse if hasattr(results_obj, 'bse') else None
    tvalues = results_obj.tvalues if hasattr(results_obj, 'tvalues') else None
    zvalues = results_obj.zvalues if hasattr(results_obj, 'zvalues') else None
    pvalues = results_obj.pvalues if hasattr(results_obj, 'pvalues') else None
    conf_int = results_obj.conf_int() if hasattr(results_obj, 'conf_int') else None
    
    # float 변환을 안전하게 처리하는 헬퍼 함수
    def safe_float(value, default=0.0):
        if value is None:
            return default
        # callable이지만 숫자 타입이 아닌 경우 (메서드 객체)
        if callable(value) and not isinstance(value, (int, float, np.number)):
            try:
                value = value()
            except:
                return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default
    
    for param_name in params.index:
        coef_val = params[param_name]
        coef_value = safe_float(coef_val)
        std_err_val = bse[param_name] if bse is not None else 0.0
        std_err = safe_float(std_err_val)
        z_val = zvalues[param_name] if zvalues is not None else (tvalues[param_name] if tvalues is not None else 0.0)
        z_value = safe_float(z_val)
        p_val = pvalues[param_name] if pvalues is not None else 1.0
        p_value = safe_float(p_val)
        conf_lower_val = conf_int.loc[param_name, 0] if conf_int is not None else 0.0
        conf_lower = safe_float(conf_lower_val)
        conf_upper_val = conf_int.loc[param_name, 1] if conf_int is not None else 0.0
        conf_upper = safe_float(conf_upper_val)
        
        coefficients_dict[param_name] = {
            'coef': coef_value,
            'std err': std_err,
            'z': z_value,
            't': z_value,
            'P>|z|': p_value,
            'P>|t|': p_value,
            '[0.025': conf_lower,
            '0.975]': conf_upper
        }

# 메트릭 추출
metrics_dict = {}
if hasattr(results_obj, 'llf'):
    llf_val = results_obj.llf
    metrics_dict['Log-Likelihood'] = safe_float(llf_val)
if hasattr(results_obj, 'aic'):
    aic_val = results_obj.aic
    metrics_dict['AIC'] = safe_float(aic_val)
if hasattr(results_obj, 'bic'):
    bic_val = results_obj.bic
    metrics_dict['BIC'] = safe_float(bic_val)
if hasattr(results_obj, 'rsquared'):
    rsq_val = results_obj.rsquared
    metrics_dict['R-squared'] = safe_float(rsq_val)
if hasattr(results_obj, 'rsquared_adj'):
    rsq_adj_val = results_obj.rsquared_adj
    metrics_dict['Adj. R-squared'] = safe_float(rsq_adj_val)
if hasattr(results_obj, 'fvalue'):
    fval = results_obj.fvalue
    metrics_dict['F-statistic'] = safe_float(fval)
if hasattr(results_obj, 'f_pvalue'):
    fpval = results_obj.f_pvalue
    metrics_dict['Prob (F-statistic)'] = safe_float(fpval)
if hasattr(results_obj, 'llnull'):
    llnull_val = results_obj.llnull
    metrics_dict['LL-Null'] = safe_float(llnull_val)
if hasattr(results_obj, 'llr'):
    llr_val = results_obj.llr
    metrics_dict['LLR'] = safe_float(llr_val)
if hasattr(results_obj, 'llr_pvalue'):
    llr_pval = results_obj.llr_pvalue
    metrics_dict['LLR p-value'] = safe_float(llr_pval)
if hasattr(results_obj, 'pseudo_rsquared'):
    pseudo_rsq = results_obj.pseudo_rsquared
    metrics_dict['Pseudo R-squ.'] = safe_float(pseudo_rsq)

# 반환값 구성
result_dict = {
    'summary': {
        'coefficients': coefficients_dict,
        'metrics': metrics_dict
    }
}

json.dumps(result_dict)
`;

    const resultJson = await withTimeout(
      py.runPython(code),
      timeoutMs,
      `Stats Model 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);

    return {
      summary: result.summary,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python Stats Model (statsmodels) error:\n${errorMessage}`);
  }
}

/**
 * DiversionChecker를 Python으로 실행합니다
 * 타임아웃: 120초
 */
export async function runDiversionChecker(
  X: number[][],
  y: number[],
  featureColumns: string[],
  labelColumn: string,
  maxIter: number = 100,
  timeoutMs: number = 120000
): Promise<{
  phi: number;
  recommendation: "Poisson" | "QuasiPoisson" | "NegativeBinomial";
  poissonAic: number | null;
  negativeBinomialAic: number | null;
  aicComparison: string | null;
  cameronTrivediCoef: number;
  cameronTrivediPvalue: number;
  cameronTrivediConclusion: string;
  methodsUsed: string[];
  results: {
    phi: number;
    phiInterpretation: string;
    recommendation: string;
    poissonAic: number | null;
    negativeBinomialAic: number | null;
    cameronTrivediCoef: number;
    cameronTrivediPvalue: number;
    cameronTrivediConclusion: string;
  };
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // statsmodels 패키지 로드
    await withTimeout(
      py.loadPackage(["statsmodels"]),
      60000,
      "statsmodels 패키지 설치 타임아웃 (60초 초과)"
    );

    // 데이터를 Python에 전달
    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      featureColumns.forEach((col, idx) => {
        row[col] = X[i][idx];
      });
      row[labelColumn] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_max_iter", maxIter);

    const code = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm

# fit_count_regression_statsmodels 함수 정의
def fit_count_regression_statsmodels(df, distribution_type, feature_columns, label_column, max_iter=100, disp=1.0):
    print(f"{distribution_type} 회귀 모델 피팅 중...")
    
    X = df[feature_columns].copy()
    y = df[label_column].copy()
    
    # 결측치 제거
    mask = ~(X.isnull().any(axis=1) | y.isnull())
    X = X[mask]
    y = y[mask]
    
    if len(X) == 0:
        raise ValueError("유효한 데이터가 없습니다. 결측치를 확인하세요.")
    
    X = sm.add_constant(X, prepend=True)
    
    try:
        if distribution_type == 'Poisson':
            model = sm.Poisson(y, X)
            results = model.fit(maxiter=max_iter)
        elif distribution_type == 'NegativeBinomial':
            model = sm.NegativeBinomial(y, X, loglike_method='nb2')
            results = model.fit(maxiter=max_iter, disp=disp)
        elif distribution_type == 'QuasiPoisson':
            model = sm.GLM(y, X, family=sm.families.Poisson())
            results = model.fit(maxiter=max_iter)
            mu = results.mu
            pearson_resid = (y - mu) / np.sqrt(mu)
            phi = np.sum(pearson_resid**2) / (len(y) - len(feature_columns) - 1)
            results.scale = phi
        else:
            raise ValueError(f"지원하지 않는 분포 타입: {distribution_type}")
        
        summary_text = str(results.summary())
        print(f"\\n--- {distribution_type} 회귀 모델 결과 ---")
        print(summary_text)
        
        metrics = {}
        metrics['Log Likelihood'] = results.llf if hasattr(results, 'llf') else None
        metrics['AIC'] = results.aic if hasattr(results, 'aic') else None
        metrics['BIC'] = results.bic if hasattr(results, 'bic') else None
        metrics['Deviance'] = results.deviance if hasattr(results, 'deviance') else None
        metrics['Pearson chi2'] = results.pearson_chi2 if hasattr(results, 'pearson_chi2') else None
        
        if distribution_type == 'NegativeBinomial':
            if hasattr(model, 'alpha'):
                metrics['Dispersion (alpha)'] = model.alpha
            elif hasattr(results, 'alpha'):
                metrics['Dispersion (alpha)'] = results.alpha
        
        if distribution_type == 'QuasiPoisson':
            if hasattr(results, 'scale'):
                metrics['Dispersion (phi)'] = results.scale
        
        coefficients = {}
        if hasattr(results, 'params'):
            params = results.params
            if hasattr(params, 'to_dict'):
                params_dict = params.to_dict()
            else:
                params_dict = {name: params.iloc[i] if hasattr(params, 'iloc') else params[i] 
                               for i, name in enumerate(results.model.exog_names)}
            
            if hasattr(results, 'bse'):
                bse = results.bse
                if hasattr(bse, 'to_dict'):
                    bse_dict = bse.to_dict()
                else:
                    bse_dict = {name: bse.iloc[i] if hasattr(bse, 'iloc') else bse[i] 
                               for i, name in enumerate(results.model.exog_names)}
            else:
                bse_dict = {name: 0.0 for name in params_dict.keys()}
            
            if hasattr(results, 'tvalues'):
                tvalues = results.tvalues
            elif hasattr(results, 'zvalues'):
                tvalues = results.zvalues
            else:
                tvalues = None
            
            if hasattr(results, 'pvalues'):
                pvalues = results.pvalues
            else:
                pvalues = None
            
            conf_int = None
            if hasattr(results, 'conf_int'):
                conf_int = results.conf_int()
            
            for param_name in params_dict.keys():
                coef_value = params_dict[param_name]
                std_err = bse_dict.get(param_name, 0.0)
                z_value = tvalues[param_name] if tvalues is not None and param_name in tvalues.index else 0.0
                p_value = pvalues[param_name] if pvalues is not None and param_name in pvalues.index else 1.0
                
                conf_lower = conf_int.loc[param_name, 0] if conf_int is not None and param_name in conf_int.index else 0.0
                conf_upper = conf_int.loc[param_name, 1] if conf_int is not None and param_name in conf_int.index else 0.0
                
                coefficients[param_name] = {
                    'coef': float(coef_value),
                    'std err': float(std_err),
                    'z': float(z_value),
                    'P>|z|': float(p_value),
                    '[0.025': float(conf_lower),
                    '0.975]': float(conf_upper)
                }
        
        return {
            'results': results,
            'summary_text': summary_text,
            'metrics': metrics,
            'coefficients': coefficients,
            'distribution_type': distribution_type
        }
        
    except Exception as e:
        print(f"모델 피팅 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        raise

def dispersion_checker(df, feature_columns, label_column, max_iter=100):
    print("=== 과대산포 검사 (Diversion Checker) ===\\n")
    
    # 1. 포아송 모델 적합
    print("1. 포아송 모델 적합 중...")
    poisson_result = fit_count_regression_statsmodels(
        df, 'Poisson', feature_columns, label_column, max_iter, 1.0
    )
    poisson_results = poisson_result['results']
    
    # 2. Dispersion φ 계산
    print("\\n2. Dispersion φ 계산 중...")
    y = df[label_column].copy()
    mask = ~(df[feature_columns].isnull().any(axis=1) | y.isnull())
    y = y[mask]
    # PoissonResults에서 mu는 fittedvalues 속성을 사용
    if hasattr(poisson_results, 'fittedvalues'):
        mu = poisson_results.fittedvalues
    elif hasattr(poisson_results, 'mu'):
        mu = poisson_results.mu
    else:
        # 예측값을 사용
        X = df[feature_columns].copy()
        X = X[mask]
        X = sm.add_constant(X, prepend=True)
        mu = poisson_results.predict(X)
    pearson_resid = (y - mu) / np.sqrt(mu)
    phi = np.sum(pearson_resid**2) / (len(y) - len(feature_columns) - 1)
    
    print(f"Dispersion φ = {phi:.6f}")
    
    # 3. 모델 추천
    print("\\n3. 모델 추천:")
    if phi < 1.2:
        recommendation = "Poisson"
        print(f"φ < 1.2 → Poisson 모델 추천")
    elif 1.2 <= phi < 2:
        recommendation = "QuasiPoisson"
        print(f"1.2 ≤ φ < 2 → Quasi-Poisson 모델 추천")
    else:
        recommendation = "NegativeBinomial"
        print(f"φ ≥ 2 → Negative Binomial 모델 추천")
    
    # 4. 포아송 vs 음이항 AIC 비교
    print("\\n4. 포아송 vs 음이항 AIC 비교 (보조 기준):")
    poisson_aic = poisson_result['metrics'].get('AIC', None)
    print(f"Poisson AIC: {poisson_aic:.6f}" if poisson_aic else "Poisson AIC: N/A")
    
    print("음이항 모델 적합 중...")
    nb_result = fit_count_regression_statsmodels(
        df, 'NegativeBinomial', feature_columns, label_column, max_iter, 1.0
    )
    nb_aic = nb_result['metrics'].get('AIC', None)
    print(f"Negative Binomial AIC: {nb_aic:.6f}" if nb_aic else "Negative Binomial AIC: N/A")
    
    aic_comparison = None
    if poisson_aic is not None and nb_aic is not None:
        if nb_aic < poisson_aic:
            aic_comparison = "Negative Binomial이 더 낮은 AIC를 가짐 (더 나은 적합도)"
        else:
            aic_comparison = "Poisson이 더 낮은 AIC를 가짐 (더 나은 적합도)"
        print(f"AIC 비교: {aic_comparison}")
    
    # 5. Cameron–Trivedi test
    print("\\n5. Cameron–Trivedi test (최종 확인):")
    # mu는 이미 위에서 계산됨
    X_test = df[feature_columns].copy()
    X_test = X_test[mask]
    X_test = sm.add_constant(X_test, prepend=True)
    
    test_stat = (y - mu)**2 - y
    ct_model = sm.OLS(test_stat, X_test)
    ct_results = ct_model.fit()
    
    const_coef = ct_results.params.get('const', ct_results.params.iloc[0] if len(ct_results.params) > 0 else 0)
    const_pvalue = ct_results.pvalues.get('const', ct_results.pvalues.iloc[0] if len(ct_results.pvalues) > 0 else 1.0)
    
    print(f"Cameron–Trivedi test 통계량 (상수항 계수): {const_coef:.6f}")
    print(f"Cameron–Trivedi test p-value: {const_pvalue:.6f}")
    
    if const_pvalue < 0.05:
        ct_conclusion = "과대산포가 통계적으로 유의함 (p < 0.05)"
        print(f"결론: {ct_conclusion}")
    else:
        ct_conclusion = "과대산포가 통계적으로 유의하지 않음 (p ≥ 0.05)"
        print(f"결론: {ct_conclusion}")
    
    # 최종 추천
    print("\\n=== 최종 추천 ===")
    print(f"추천 모델: {recommendation}")
    if aic_comparison:
        print(f"AIC 비교: {aic_comparison}")
    print(f"Cameron–Trivedi test: {ct_conclusion}")
    
    return {
        'phi': float(phi),
        'recommendation': recommendation,
        'poisson_aic': float(poisson_aic) if poisson_aic is not None else None,
        'negative_binomial_aic': float(nb_aic) if nb_aic is not None else None,
        'aic_comparison': aic_comparison,
        'cameron_trivedi_coef': float(const_coef),
        'cameron_trivedi_pvalue': float(const_pvalue),
        'cameron_trivedi_conclusion': ct_conclusion,
        'methods_used': [
            '1. 포아송 모델 적합',
            '2. Dispersion φ 계산',
            '3. φ 기준 모델 추천',
            '4. 포아송 vs 음이항 AIC 비교',
            '5. Cameron–Trivedi test'
        ],
        'results': {
            'phi': float(phi),
            'phi_interpretation': f"φ = {phi:.6f}",
            'recommendation': recommendation,
            'poisson_aic': float(poisson_aic) if poisson_aic is not None else None,
            'negative_binomial_aic': float(nb_aic) if nb_aic is not None else None,
            'cameron_trivedi_coef': float(const_coef),
            'cameron_trivedi_pvalue': float(const_pvalue),
            'cameron_trivedi_conclusion': ct_conclusion
        }
    }

# 데이터 준비
dataframe = pd.DataFrame(js_data.to_py())
p_feature_columns = js_feature_columns.to_py()
p_label_column = str(js_label_column)
p_max_iter = int(js_max_iter)

# Execution
result = dispersion_checker(dataframe, p_feature_columns, p_label_column, p_max_iter)
print("\\n=== 분석 완료 ===")

json.dumps(result)
`;

    const resultJson = await withTimeout(
      py.runPython(code),
      timeoutMs,
      `DiversionChecker 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);

    return {
      phi: result.phi,
      recommendation: result.recommendation,
      poissonAic: result.poisson_aic,
      negativeBinomialAic: result.negative_binomial_aic,
      aicComparison: result.aic_comparison,
      cameronTrivediCoef: result.cameron_trivedi_coef,
      cameronTrivediPvalue: result.cameron_trivedi_pvalue,
      cameronTrivediConclusion: result.cameron_trivedi_conclusion,
      methodsUsed: result.methods_used,
      results: result.results,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python DiversionChecker error:\n${errorMessage}`);
  }
}

/**
 * Statistics를 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function calculateStatisticsPython(
  data: any[],
  columns: Array<{ name: string; type: string }>,
  timeoutMs: number = 60000
): Promise<{
  stats: Record<string, any>;
  correlation: Record<string, Record<string, number>>;
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_columns", columns);

    // Python 코드 실행
    const code = `
import json
import pandas as pd
import numpy as np

# 데이터 준비
df = pd.DataFrame(js_data.to_py())

# 기술 통계량 계산
stats = {}
for col in df.columns:
    # 빈 문자열을 NaN으로 변환하지 않고 그대로 유지
    # 빈 문자열도 null로 카운트하기 위해 처리
    col_data = df[col]
    
    # 빈 문자열 개수 카운트 (NaN과 별도로)
    empty_string_count = 0
    if col_data.dtype == 'object':
        # 문자열 컬럼의 경우 빈 문자열 직접 카운트
        empty_string_count = (col_data.astype(str).str.strip() == '').sum()
    elif col_data.dtype in ['int64', 'float64']:
        # 숫자형 컬럼의 경우 빈 문자열이 문자열로 변환된 경우 카운트
        empty_string_count = (col_data.astype(str).str.strip() == '').sum()
    
    if col_data.dtype in ['int64', 'float64']:
        desc = col_data.describe()
        # NaN과 빈 문자열 모두 null로 카운트
        nulls = col_data.isnull().sum() + empty_string_count
        # Non-Null count 계산 (info() 함수와 동일)
        non_null_count = int(desc.get('count', 0))
        # 빈 문자열을 제외한 값들로 mode 계산
        non_empty = col_data[(col_data.astype(str).str.strip() != '') & (~col_data.isnull())]
        mode_val = non_empty.mode() if len(non_empty) > 0 else pd.Series(dtype=float)
        mode = float(mode_val.iloc[0]) if len(mode_val) > 0 else None
        
        stats[col] = {
            'count': int(desc.get('count', 0)),
            'mean': float(desc.get('mean', 0)) if not pd.isna(desc.get('mean', 0)) else None,
            'std': float(desc.get('std', 0)) if not pd.isna(desc.get('std', 0)) else None,
            'min': float(desc.get('min', 0)) if not pd.isna(desc.get('min', 0)) else None,
            '25%': float(desc.get('25%', 0)) if not pd.isna(desc.get('25%', 0)) else None,
            '50%': float(desc.get('50%', 0)) if not pd.isna(desc.get('50%', 0)) else None,
            '75%': float(desc.get('75%', 0)) if not pd.isna(desc.get('75%', 0)) else None,
            'max': float(desc.get('max', 0)) if not pd.isna(desc.get('max', 0)) else None,
            'nulls': int(nulls),
            'mode': mode if mode is not None else 'N/A',
            'variance': float(col_data.var()) if not pd.isna(col_data.var()) else None,
            'skewness': float(col_data.skew()) if len(non_empty) > 0 and not pd.isna(col_data.skew()) else 0.0,
            'kurtosis': float(col_data.kurtosis()) if len(non_empty) > 0 and not pd.isna(col_data.kurtosis()) else 0.0,
            'nonNullCount': non_null_count,
            'dtype': str(col_data.dtype)
        }
    else:
        # 문자열 컬럼의 경우 빈 문자열도 null로 카운트
        nulls = col_data.isnull().sum() + empty_string_count
        # Non-Null count 계산 (info() 함수와 동일)
        non_null_count = len(col_data) - int(nulls)
        # 빈 문자열을 제외한 값들로 mode 계산
        non_empty = col_data[(col_data.astype(str).str.strip() != '') & (~col_data.isnull())]
        mode_val = non_empty.mode() if len(non_empty) > 0 else pd.Series(dtype=object)
        mode = str(mode_val.iloc[0]) if len(mode_val) > 0 else 'N/A'
        
        stats[col] = {
            'count': len(col_data),
            'mean': None,
            'std': None,
            'min': None,
            '25%': None,
            '50%': None,
            '75%': None,
            'max': None,
            'nulls': int(nulls),
            'mode': mode,
            'variance': None,
            'skewness': None,
            'kurtosis': None,
            'nonNullCount': non_null_count,
            'dtype': str(col_data.dtype)
        }

# 상관관계 계산
numeric_df = df.select_dtypes(include=[np.number])
correlation = {}
if len(numeric_df.columns) > 0:
    corr_matrix = numeric_df.corr()
    for col1 in corr_matrix.columns:
        correlation[col1] = {}
        for col2 in corr_matrix.columns:
            correlation[col1][col2] = float(corr_matrix.loc[col1, col2])
else:
    correlation = {}

result = {
    'stats': stats,
    'correlation': correlation
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Statistics 실행 타임아웃 (60초 초과)"
    );

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_columns");

    return {
      stats: result.stats,
      correlation: result.correlation,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_columns");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Statistics error: ${errorMessage}`);
  }
}

/**
 * ScoreModel을 Python으로 실행합니다 (예측 수행)
 * 타임아웃: 60초
 */
export async function scoreModelPython(
  data: any[],
  featureColumns: string[],
  coefficients: Record<string, number>,
  intercept: number,
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_coefficients", coefficients);
    py.globals.set("js_intercept", intercept);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);

    // Python 코드 실행
    const code = `
import json
import pandas as pd
import numpy as np

# 데이터 준비
df = pd.DataFrame(js_data.to_py())
feature_columns = js_feature_columns.to_py()
coefficients_dict = js_coefficients.to_py()
intercept = float(js_intercept)
label_column = str(js_label_column)
model_purpose = str(js_model_purpose)

# 특성 컬럼 순서대로 coefficients 배열 생성
coefficients_list = [coefficients_dict.get(col, 0.0) for col in feature_columns]

# 예측 수행
X = df[feature_columns].values
predictions = intercept + np.dot(X, coefficients_list)

# 결과 데이터프레임 생성
result_df = df.copy()
predict_col_name = "Predict"
result_df[predict_col_name] = predictions

# 분류 모델인 경우 확률 계산
if model_purpose == 'classification':
    # sigmoid 함수: 1 / (1 + exp(-x))
    probabilities_1 = 1.0 / (1.0 + np.exp(-predictions))
    probabilities_0 = 1 - probabilities_1
    final_predictions = (probabilities_1 > 0.5).astype(int)
    
    result_df[predict_col_name] = final_predictions
    result_df[f"{label_column}_Predict_Proba_0"] = probabilities_0
    result_df[f"{label_column}_Predict_Proba_1"] = probabilities_1

# 결과를 딕셔너리 리스트로 변환
result_rows = result_df.to_dict('records')
result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]

result = {
    'rows': result_rows,
    'columns': result_columns
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python ScoreModel 실행 타임아웃 (60초 초과)"
    );

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_coefficients");
    py.globals.delete("js_intercept");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");

    return {
      rows: result.rows,
      columns: result.columns,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_coefficients");
        py.globals.delete("js_intercept");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python ScoreModel error: ${errorMessage}`);
  }
}

/**
 * KNN 모델을 사용하여 예측을 수행합니다
 * 타임아웃: 60초
 */
export async function scoreKNNPython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  nNeighbors: number,
  weights: string,
  algorithm: string,
  metric: string,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_n_neighbors", nNeighbors);
    py.globals.set("js_weights", weights);
    py.globals.set("js_algorithm", algorithm);
    py.globals.set("js_metric", metric);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor

try:
    # 데이터 준비
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)
    model_purpose = str(js_model_purpose)
    
    # 훈련 데이터 준비
    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)
    
    # 모델 파라미터
    n_neighbors = int(js_n_neighbors)
    weights = str(js_weights)
    algorithm = str(js_algorithm)
    metric = str(js_metric)
    
    # 훈련 데이터에서 특성과 레이블 추출
    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]
    
    # 모델 생성 및 훈련
    if model_purpose == 'classification':
        model = KNeighborsClassifier(
            n_neighbors=n_neighbors,
            weights=weights,
            algorithm=algorithm,
            metric=metric
        )
    else:
        model = KNeighborsRegressor(
            n_neighbors=n_neighbors,
            weights=weights,
            algorithm=algorithm,
            metric=metric
        )
    
    # 모델 훈련
    model.fit(X_train, y_train)
    
    # 예측 수행
    X = df[feature_columns]
    predictions = model.predict(X)
    
    # 결과 데이터프레임 생성
    result_df = df.copy()
    result_df['Predict'] = predictions
    
    # 분류 모델인 경우 확률도 계산
    if model_purpose == 'classification':
        try:
            probabilities = model.predict_proba(X)
            if probabilities.shape[1] == 2:
                # 이진 분류
                result_df[f"{label_column}_Predict_Proba_0"] = probabilities[:, 0]
                result_df[f"{label_column}_Predict_Proba_1"] = probabilities[:, 1]
            else:
                # 다중 클래스
                for i in range(probabilities.shape[1]):
                    result_df[f"{label_column}_Predict_Proba_{i}"] = probabilities[:, i]
        except Exception:
            pass
    
    # 결과를 딕셔너리 리스트로 변환
    result_rows = result_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    
    result = {
        'rows': result_rows,
        'columns': result_columns
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python KNN ScoreModel 실행 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python KNN ScoreModel error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result && result.__error__) {
      throw new Error(
        `Python KNN ScoreModel error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result || !result.rows || !result.columns) {
      throw new Error(
        `Python KNN ScoreModel error: Missing or invalid 'rows' or 'columns' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_n_neighbors");
    py.globals.delete("js_weights");
    py.globals.delete("js_algorithm");
    py.globals.delete("js_metric");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return {
      rows: result.rows,
      columns: result.columns,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_n_neighbors");
        py.globals.delete("js_weights");
        py.globals.delete("js_algorithm");
        py.globals.delete("js_metric");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python KNN ScoreModel error: ${errorMessage}`);
  }
}

/**
 * Decision Tree 모델을 사용하여 예측을 수행합니다
 * 타임아웃: 60초
 */
export async function scoreDecisionTreePython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  criterion: string,
  maxDepth: number | null,
  minSamplesSplit: number,
  minSamplesLeaf: number,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_criterion", criterion);
    py.globals.set("js_max_depth", maxDepth);
    py.globals.set("js_min_samples_split", minSamplesSplit);
    py.globals.set("js_min_samples_leaf", minSamplesLeaf);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

try:
    # 데이터 준비
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)
    model_purpose = str(js_model_purpose)
    
    # 훈련 데이터 준비
    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)
    
    # 모델 파라미터
    criterion = str(js_criterion)
    max_depth = js_max_depth if js_max_depth is not None else None
    min_samples_split = int(js_min_samples_split)
    min_samples_leaf = int(js_min_samples_leaf)
    
    # 훈련 데이터에서 특성과 레이블 추출
    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]
    
    # 모델 생성 및 훈련
    if model_purpose == 'classification':
        model = DecisionTreeClassifier(
            criterion=criterion.lower(),
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            random_state=42
        )
    else:
        criterion_reg = 'squared_error' if criterion == 'mse' else 'absolute_error'
        model = DecisionTreeRegressor(
            criterion=criterion_reg,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            random_state=42
        )
    
    # 모델 훈련
    model.fit(X_train, y_train)
    
    # 예측 수행
    X = df[feature_columns]
    predictions = model.predict(X)
    
    # 결과 데이터프레임 생성
    result_df = df.copy()
    result_df['Predict'] = predictions
    
    # 분류 모델인 경우 확률도 계산
    if model_purpose == 'classification':
        try:
            probabilities = model.predict_proba(X)
            if probabilities.shape[1] == 2:
                # 이진 분류
                result_df[f"{label_column}_Predict_Proba_0"] = probabilities[:, 0]
                result_df[f"{label_column}_Predict_Proba_1"] = probabilities[:, 1]
            else:
                # 다중 클래스
                for i in range(probabilities.shape[1]):
                    result_df[f"{label_column}_Predict_Proba_{i}"] = probabilities[:, i]
        except Exception:
            pass
    
    # 결과를 딕셔너리 리스트로 변환
    result_rows = result_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    
    result = {
        'rows': result_rows,
        'columns': result_columns
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Decision Tree ScoreModel 실행 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python Decision Tree ScoreModel error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result && result.__error__) {
      throw new Error(
        `Python Decision Tree ScoreModel error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result || !result.rows || !result.columns) {
      throw new Error(
        `Python Decision Tree ScoreModel error: Missing or invalid 'rows' or 'columns' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_criterion");
    py.globals.delete("js_max_depth");
    py.globals.delete("js_min_samples_split");
    py.globals.delete("js_min_samples_leaf");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return {
      rows: result.rows,
      columns: result.columns,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_criterion");
        py.globals.delete("js_max_depth");
        py.globals.delete("js_min_samples_split");
        py.globals.delete("js_min_samples_leaf");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Decision Tree ScoreModel error: ${errorMessage}`);
  }
}

/**
 * Random Forest 모델을 Python(sklearn)으로 훈련합니다 (인앱 실행, 결정적 random_state=42).
 * codeSnippets.ts RandomForest 템플릿 / data_analysis_modules.create_random_forest와 정합.
 * 타임아웃: 60초
 */
export async function fitRandomForestPython(
  X: number[][],
  y: number[],
  modelPurpose: string = "classification",
  nEstimators: number = 100,
  criterion: string = "gini",
  maxDepth: number | null = null,
  maxFeatures: string | number | null = null,
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
  featureImportances?: Record<string, number>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    const maxFeaturesLiteral =
      maxFeatures === null ||
      maxFeatures === undefined ||
      maxFeatures === "" ||
      maxFeatures === "null"
        ? "None"
        : !isNaN(Number(maxFeatures)) && `${maxFeatures}`.trim() !== ""
        ? `${Number(maxFeatures)}`
        : `'${maxFeatures}'`;

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_squared_error, r2_score, mean_absolute_error

try:
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)

    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")

    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]

    p_model_purpose = '${modelPurpose}'
    p_n_estimators = ${nEstimators}
    p_criterion = '${criterion}'
    p_max_depth = ${maxDepth !== null ? maxDepth : "None"}
    p_max_features = ${maxFeaturesLiteral}

    if p_model_purpose == 'classification':
        model = RandomForestClassifier(
            n_estimators=p_n_estimators,
            criterion=p_criterion.lower(),
            max_depth=p_max_depth,
            max_features=p_max_features,
            random_state=42
        )
    else:
        criterion_reg = 'squared_error' if p_criterion == 'mse' else 'absolute_error'
        model = RandomForestRegressor(
            n_estimators=p_n_estimators,
            criterion=criterion_reg,
            max_depth=p_max_depth,
            max_features=p_max_features,
            random_state=42
        )

    model.fit(X_train, y_train)
    y_pred = model.predict(X_train)

    if p_model_purpose == 'classification':
        accuracy = float(accuracy_score(y_train, y_pred))
        unique_labels = np.unique(y_train)
        is_binary = len(unique_labels) == 2
        avg_param = 'binary' if is_binary else 'weighted'
        precision = float(precision_score(y_train, y_pred, average=avg_param, zero_division=0))
        recall = float(recall_score(y_train, y_pred, average=avg_param, zero_division=0))
        f1 = float(f1_score(y_train, y_pred, average=avg_param, zero_division=0))
        metrics_dict = {
            'Accuracy': accuracy,
            'Precision': precision,
            'Recall': recall,
            'F1-Score': f1
        }
        if is_binary:
            try:
                y_pred_proba = model.predict_proba(X_train)[:, 1]
                metrics_dict['ROC-AUC'] = float(roc_auc_score(y_train, y_pred_proba))
            except Exception:
                pass
    else:
        mse = float(mean_squared_error(y_train, y_pred))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_train, y_pred))
        r2 = float(r2_score(y_train, y_pred))
        metrics_dict = {
            'R-squared': r2,
            'Mean Squared Error': mse,
            'Root Mean Squared Error': rmse,
            'Mean Absolute Error': mae
        }

    feature_importances = {}
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        for i, feature in enumerate(p_feature_columns):
            feature_importances[feature] = float(importances[i])

    result = {
        'metrics': metrics_dict,
        'feature_columns': p_feature_columns,
        'feature_importances': feature_importances
    }
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Random Forest 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Random Forest error: Python code returned None or undefined.`
      );
    }
    const result = fromPython(resultPyObj);
    if (result.__error__) {
      throw new Error(
        `Python Random Forest error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python Random Forest error: Missing or invalid 'metrics' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
      featureImportances: result.feature_importances || {},
    };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}
    const errorMessage = error.message || String(error);
    throw new Error(`Python Random Forest error:\n${errorMessage}`);
  }
}

/**
 * Gradient Boosting 모델을 Python(sklearn)으로 훈련합니다 (인앱 실행, 결정적 random_state=42).
 * codeSnippets.ts GradientBoosting 템플릿 / data_analysis_modules.create_gradient_boosting와 정합.
 * 타임아웃: 60초
 */
export async function fitGradientBoostingPython(
  X: number[][],
  y: number[],
  modelPurpose: string = "classification",
  nEstimators: number = 100,
  learningRate: number = 0.1,
  maxDepth: number = 3,
  featureColumns?: string[],
  timeoutMs: number = 60000
): Promise<{
  metrics: Record<string, number>;
  featureImportances?: Record<string, number>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    const dataRows: any[] = [];
    for (let i = 0; i < X.length; i++) {
      const row: any = {};
      if (featureColumns) {
        featureColumns.forEach((col, idx) => {
          row[col] = X[i][idx];
        });
      } else {
        X[i].forEach((val, idx) => {
          row[`x${idx}`] = val;
        });
      }
      row["y"] = y[i];
      dataRows.push(row);
    }

    py.globals.set("js_data", dataRows);
    py.globals.set(
      "js_feature_columns",
      featureColumns || X[0].map((_, idx) => `x${idx}`)
    );
    py.globals.set("js_label_column", "y");

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_squared_error, r2_score, mean_absolute_error

try:
    dataframe = pd.DataFrame(js_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)

    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")

    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]

    p_model_purpose = '${modelPurpose}'
    p_n_estimators = ${nEstimators}
    p_learning_rate = ${learningRate}
    p_max_depth = ${maxDepth}

    if p_model_purpose == 'classification':
        model = GradientBoostingClassifier(
            n_estimators=p_n_estimators,
            learning_rate=p_learning_rate,
            max_depth=p_max_depth,
            random_state=42
        )
    else:
        model = GradientBoostingRegressor(
            n_estimators=p_n_estimators,
            learning_rate=p_learning_rate,
            max_depth=p_max_depth,
            random_state=42
        )

    model.fit(X_train, y_train)
    y_pred = model.predict(X_train)

    if p_model_purpose == 'classification':
        accuracy = float(accuracy_score(y_train, y_pred))
        unique_labels = np.unique(y_train)
        is_binary = len(unique_labels) == 2
        avg_param = 'binary' if is_binary else 'weighted'
        precision = float(precision_score(y_train, y_pred, average=avg_param, zero_division=0))
        recall = float(recall_score(y_train, y_pred, average=avg_param, zero_division=0))
        f1 = float(f1_score(y_train, y_pred, average=avg_param, zero_division=0))
        metrics_dict = {
            'Accuracy': accuracy,
            'Precision': precision,
            'Recall': recall,
            'F1-Score': f1
        }
        if is_binary:
            try:
                y_pred_proba = model.predict_proba(X_train)[:, 1]
                metrics_dict['ROC-AUC'] = float(roc_auc_score(y_train, y_pred_proba))
            except Exception:
                pass
    else:
        mse = float(mean_squared_error(y_train, y_pred))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_train, y_pred))
        r2 = float(r2_score(y_train, y_pred))
        metrics_dict = {
            'R-squared': r2,
            'Mean Squared Error': mse,
            'Root Mean Squared Error': rmse,
            'Mean Absolute Error': mae
        }

    feature_importances = {}
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        for i, feature in enumerate(p_feature_columns):
            feature_importances[feature] = float(importances[i])

    result = {
        'metrics': metrics_dict,
        'feature_columns': p_feature_columns,
        'feature_importances': feature_importances
    }
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Gradient Boosting 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Gradient Boosting error: Python code returned None or undefined.`
      );
    }
    const result = fromPython(resultPyObj);
    if (result.__error__) {
      throw new Error(
        `Python Gradient Boosting error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result.metrics || typeof result.metrics !== "object") {
      throw new Error(
        `Python Gradient Boosting error: Missing or invalid 'metrics' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_result");

    return {
      metrics: result.metrics,
      featureImportances: result.feature_importances || {},
    };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_result");
      }
    } catch {}
    const errorMessage = error.message || String(error);
    throw new Error(`Python Gradient Boosting error:\n${errorMessage}`);
  }
}

/**
 * Random Forest ScoreModel: 훈련 데이터로 모델을 재적합한 뒤 입력 데이터를 예측합니다
 * (결정적 random_state=42). scoreDecisionTreePython 패턴 미러.
 */
export async function scoreRandomForestPython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  nEstimators: number,
  criterion: string,
  maxDepth: number | null,
  maxFeatures: string | number | null,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    const maxFeaturesLiteral =
      maxFeatures === null ||
      maxFeatures === undefined ||
      maxFeatures === "" ||
      maxFeatures === "null"
        ? "None"
        : !isNaN(Number(maxFeatures)) && `${maxFeatures}`.trim() !== ""
        ? `${Number(maxFeatures)}`
        : `'${maxFeatures}'`;

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor

try:
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)
    model_purpose = str(js_model_purpose)

    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)

    p_n_estimators = ${nEstimators}
    p_criterion = '${criterion}'
    p_max_depth = ${maxDepth !== null ? maxDepth : "None"}
    p_max_features = ${maxFeaturesLiteral}

    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]

    if model_purpose == 'classification':
        model = RandomForestClassifier(
            n_estimators=p_n_estimators,
            criterion=p_criterion.lower(),
            max_depth=p_max_depth,
            max_features=p_max_features,
            random_state=42
        )
    else:
        criterion_reg = 'squared_error' if p_criterion == 'mse' else 'absolute_error'
        model = RandomForestRegressor(
            n_estimators=p_n_estimators,
            criterion=criterion_reg,
            max_depth=p_max_depth,
            max_features=p_max_features,
            random_state=42
        )

    model.fit(X_train, y_train)
    X = df[feature_columns]
    predictions = model.predict(X)

    result_df = df.copy()
    result_df['Predict'] = predictions

    if model_purpose == 'classification':
        try:
            probabilities = model.predict_proba(X)
            if probabilities.shape[1] == 2:
                result_df[f"{label_column}_Predict_Proba_0"] = probabilities[:, 0]
                result_df[f"{label_column}_Predict_Proba_1"] = probabilities[:, 1]
            else:
                for i in range(probabilities.shape[1]):
                    result_df[f"{label_column}_Predict_Proba_{i}"] = probabilities[:, i]
        except Exception:
            pass

    result_rows = result_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    js_result = {'rows': result_rows, 'columns': result_columns}
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Random Forest ScoreModel 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Random Forest ScoreModel error: Python code returned None or undefined.`
      );
    }
    const result = fromPython(resultPyObj);
    if (result && result.__error__) {
      throw new Error(
        `Python Random Forest ScoreModel error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result || !result.rows || !result.columns) {
      throw new Error(
        `Python Random Forest ScoreModel error: Missing or invalid 'rows' or 'columns' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return { rows: result.rows, columns: result.columns };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}
    const errorMessage = error.message || String(error);
    throw new Error(`Python Random Forest ScoreModel error: ${errorMessage}`);
  }
}

/**
 * Gradient Boosting ScoreModel: 훈련 데이터로 모델을 재적합한 뒤 입력 데이터를 예측합니다
 * (결정적 random_state=42). scoreDecisionTreePython 패턴 미러.
 */
export async function scoreGradientBoostingPython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  nEstimators: number,
  learningRate: number,
  maxDepth: number,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor

try:
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)
    model_purpose = str(js_model_purpose)

    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)

    p_n_estimators = ${nEstimators}
    p_learning_rate = ${learningRate}
    p_max_depth = ${maxDepth}

    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]

    if model_purpose == 'classification':
        model = GradientBoostingClassifier(
            n_estimators=p_n_estimators,
            learning_rate=p_learning_rate,
            max_depth=p_max_depth,
            random_state=42
        )
    else:
        model = GradientBoostingRegressor(
            n_estimators=p_n_estimators,
            learning_rate=p_learning_rate,
            max_depth=p_max_depth,
            random_state=42
        )

    model.fit(X_train, y_train)
    X = df[feature_columns]
    predictions = model.predict(X)

    result_df = df.copy()
    result_df['Predict'] = predictions

    if model_purpose == 'classification':
        try:
            probabilities = model.predict_proba(X)
            if probabilities.shape[1] == 2:
                result_df[f"{label_column}_Predict_Proba_0"] = probabilities[:, 0]
                result_df[f"{label_column}_Predict_Proba_1"] = probabilities[:, 1]
            else:
                for i in range(probabilities.shape[1]):
                    result_df[f"{label_column}_Predict_Proba_{i}"] = probabilities[:, i]
        except Exception:
            pass

    result_rows = result_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    js_result = {'rows': result_rows, 'columns': result_columns}
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Gradient Boosting ScoreModel 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Gradient Boosting ScoreModel error: Python code returned None or undefined.`
      );
    }
    const result = fromPython(resultPyObj);
    if (result && result.__error__) {
      throw new Error(
        `Python Gradient Boosting ScoreModel error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result || !result.rows || !result.columns) {
      throw new Error(
        `Python Gradient Boosting ScoreModel error: Missing or invalid 'rows' or 'columns' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return { rows: result.rows, columns: result.columns };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}
    const errorMessage = error.message || String(error);
    throw new Error(
      `Python Gradient Boosting ScoreModel error: ${errorMessage}`
    );
  }
}

/**
 * SVM ScoreModel: 훈련 데이터로 모델을 재적합한 뒤 입력 데이터를 예측합니다
 * (결정적 random_state=42). fitSVMPython 정합.
 */
export async function scoreSVMPython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  kernel: string,
  C: number,
  gamma: string | number,
  degree: number,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.svm import SVC, SVR

try:
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)
    model_purpose = str(js_model_purpose)

    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)

    p_kernel = '${kernel}'
    p_C = ${C}
    ${typeof gamma === "string" ? `p_gamma = '${gamma}'` : `p_gamma = ${gamma}`}
    p_degree = ${degree}

    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]

    if model_purpose == 'classification':
        model = SVC(
            kernel=p_kernel,
            C=p_C,
            gamma=p_gamma,
            degree=p_degree,
            probability=True,
            random_state=42
        )
    else:
        model = SVR(
            kernel=p_kernel,
            C=p_C,
            gamma=p_gamma,
            degree=p_degree
        )

    model.fit(X_train, y_train)
    X = df[feature_columns]
    predictions = model.predict(X)

    result_df = df.copy()
    result_df['Predict'] = predictions

    if model_purpose == 'classification':
        try:
            probabilities = model.predict_proba(X)
            if probabilities.shape[1] == 2:
                result_df[f"{label_column}_Predict_Proba_0"] = probabilities[:, 0]
                result_df[f"{label_column}_Predict_Proba_1"] = probabilities[:, 1]
            else:
                for i in range(probabilities.shape[1]):
                    result_df[f"{label_column}_Predict_Proba_{i}"] = probabilities[:, i]
        except Exception:
            pass

    result_rows = result_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    js_result = {'rows': result_rows, 'columns': result_columns}
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python SVM ScoreModel 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python SVM ScoreModel error: Python code returned None or undefined.`
      );
    }
    const result = fromPython(resultPyObj);
    if (result && result.__error__) {
      throw new Error(
        `Python SVM ScoreModel error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result || !result.rows || !result.columns) {
      throw new Error(
        `Python SVM ScoreModel error: Missing or invalid 'rows' or 'columns' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return { rows: result.rows, columns: result.columns };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}
    const errorMessage = error.message || String(error);
    throw new Error(`Python SVM ScoreModel error: ${errorMessage}`);
  }
}

/**
 * LDA ScoreModel: 훈련 데이터로 모델을 재적합한 뒤 입력 데이터를 예측합니다 (분류 전용).
 * fitLDAPython 정합.
 */
export async function scoreLDAPython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  solver: string,
  shrinkage: number | null,
  nComponents: number | null,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    const shrinkageStr = shrinkage !== null ? String(shrinkage) : "None";
    const nComponentsStr = nComponents !== null ? String(nComponents) : "None";

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis

try:
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)

    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)

    p_solver = '${solver}'
    p_shrinkage = ${shrinkageStr} if ${shrinkageStr} != 'None' else None
    p_n_components = ${nComponentsStr} if ${nComponentsStr} != 'None' else None

    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]

    model = LinearDiscriminantAnalysis(
        solver=p_solver,
        shrinkage=p_shrinkage,
        n_components=p_n_components
    )

    model.fit(X_train, y_train)
    X = df[feature_columns]
    predictions = model.predict(X)

    result_df = df.copy()
    result_df['Predict'] = predictions

    try:
        probabilities = model.predict_proba(X)
        if probabilities.shape[1] == 2:
            result_df[f"{label_column}_Predict_Proba_0"] = probabilities[:, 0]
            result_df[f"{label_column}_Predict_Proba_1"] = probabilities[:, 1]
        else:
            for i in range(probabilities.shape[1]):
                result_df[f"{label_column}_Predict_Proba_{i}"] = probabilities[:, i]
    except Exception:
        pass

    result_rows = result_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    js_result = {'rows': result_rows, 'columns': result_columns}
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python LDA ScoreModel 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python LDA ScoreModel error: Python code returned None or undefined.`
      );
    }
    const result = fromPython(resultPyObj);
    if (result && result.__error__) {
      throw new Error(
        `Python LDA ScoreModel error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result || !result.rows || !result.columns) {
      throw new Error(
        `Python LDA ScoreModel error: Missing or invalid 'rows' or 'columns' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return { rows: result.rows, columns: result.columns };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}
    const errorMessage = error.message || String(error);
    throw new Error(`Python LDA ScoreModel error: ${errorMessage}`);
  }
}

/**
 * Naive Bayes ScoreModel: 훈련 데이터로 모델을 재적합한 뒤 입력 데이터를 예측합니다 (분류 전용).
 * fitNaiveBayesPython 정합 (fit_prior 기본 True).
 */
export async function scoreNaiveBayesPython(
  data: any[],
  featureColumns: string[],
  labelColumn: string,
  modelType: string,
  alpha: number,
  trainingData: any[],
  trainingFeatureColumns: string[],
  trainingLabelColumn: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_training_feature_columns", trainingFeatureColumns);
    py.globals.set("js_training_label_column", trainingLabelColumn);

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.naive_bayes import GaussianNB, MultinomialNB, BernoulliNB, ComplementNB

try:
    df = pd.DataFrame(js_data.to_py())
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)

    training_df = pd.DataFrame(js_training_data.to_py())
    training_feature_columns = js_training_feature_columns.to_py()
    training_label_column = str(js_training_label_column)

    p_model_type = '${modelType}'
    p_alpha = ${alpha}
    p_fit_prior = True

    X_train = training_df[training_feature_columns]
    y_train = training_df[training_label_column]

    if p_model_type == 'Gaussian':
        model = GaussianNB()
    elif p_model_type == 'Multinomial':
        model = MultinomialNB(alpha=p_alpha, fit_prior=p_fit_prior)
    elif p_model_type == 'Bernoulli':
        model = BernoulliNB(alpha=p_alpha, fit_prior=p_fit_prior)
    elif p_model_type == 'Complement':
        model = ComplementNB(alpha=p_alpha, fit_prior=p_fit_prior)
    else:
        model = GaussianNB()

    model.fit(X_train, y_train)
    X = df[feature_columns]
    predictions = model.predict(X)

    result_df = df.copy()
    result_df['Predict'] = predictions

    try:
        probabilities = model.predict_proba(X)
        if probabilities.shape[1] == 2:
            result_df[f"{label_column}_Predict_Proba_0"] = probabilities[:, 0]
            result_df[f"{label_column}_Predict_Proba_1"] = probabilities[:, 1]
        else:
            for i in range(probabilities.shape[1]):
                result_df[f"{label_column}_Predict_Proba_{i}"] = probabilities[:, i]
    except Exception:
        pass

    result_rows = result_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]
    js_result = {'rows': result_rows, 'columns': result_columns}
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Naive Bayes ScoreModel 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Naive Bayes ScoreModel error: Python code returned None or undefined.`
      );
    }
    const result = fromPython(resultPyObj);
    if (result && result.__error__) {
      throw new Error(
        `Python Naive Bayes ScoreModel error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result || !result.rows || !result.columns) {
      throw new Error(
        `Python Naive Bayes ScoreModel error: Missing or invalid 'rows' or 'columns' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_training_data");
    py.globals.delete("js_training_feature_columns");
    py.globals.delete("js_training_label_column");
    py.globals.delete("js_result");

    return { rows: result.rows, columns: result.columns };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_training_data");
        py.globals.delete("js_training_feature_columns");
        py.globals.delete("js_training_label_column");
        py.globals.delete("js_result");
      }
    } catch {}
    const errorMessage = error.message || String(error);
    throw new Error(`Python Naive Bayes ScoreModel error: ${errorMessage}`);
  }
}

/**
 * EvaluateModel을 Python으로 실행합니다 (평가 메트릭 계산)
 * 타임아웃: 60초
 */
export async function evaluateModelPython(
  data: any[],
  labelColumn: string,
  predictionColumn: string,
  modelType: "classification" | "regression",
  threshold: number = 0.5,
  timeoutMs: number = 60000,
  calculateThresholdMetrics: boolean = false // 여러 threshold에 대한 precision/recall 계산 여부
): Promise<
  Record<string, number | string> & {
    thresholdMetrics?: Array<{
      threshold: number;
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
      tp: number;
      fp: number;
      tn: number;
      fn: number;
    }>;
  }
> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_prediction_column", predictionColumn);
    py.globals.set("js_model_type", modelType);
    py.globals.set("js_threshold", threshold);
    py.globals.set("js_calculate_threshold_metrics", calculateThresholdMetrics);

    // Python 코드 실행
    const code = `
import json
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, mean_squared_error, mean_absolute_error, r2_score, confusion_matrix, roc_auc_score, average_precision_score

# 데이터 준비
df = pd.DataFrame(js_data.to_py())
label_column = str(js_label_column)
prediction_column = str(js_prediction_column)
model_type = str(js_model_type)
threshold = float(js_threshold)
calculate_threshold_metrics = bool(js_calculate_threshold_metrics)

# 실제값 추출
y_true = df[label_column].values

metrics = {}
threshold_metrics_list = []

if model_type == 'classification':
    # 분류 모델: prediction_column이 확률값인지 예측값인지 확인
    y_pred_raw = df[prediction_column].values
    
    # 예측값이 확률 범위(0~1)에 있는지 확인
    is_probability = np.all((y_pred_raw >= 0) & (y_pred_raw <= 1)) and np.any((y_pred_raw > 0) & (y_pred_raw < 1))
    
    if is_probability:
        # 확률값인 경우 threshold로 이진 분류로 변환
        y_pred = (y_pred_raw >= threshold).astype(int)
        y_pred_proba = y_pred_raw
    else:
        # 이미 예측값인 경우 그대로 사용
        y_pred = y_pred_raw.astype(int)
        y_pred_proba = None
    
    # 이진 분류인지 다중 분류인지 확인
    unique_labels = np.unique(y_true)
    is_binary = len(unique_labels) == 2
    
    # average 파라미터 결정: 이진 분류면 'binary', 다중 분류면 'weighted'
    avg_param = 'binary' if is_binary else 'weighted'
    
    # 분류 메트릭 계산
    accuracy = float(accuracy_score(y_true, y_pred))
    precision = float(precision_score(y_true, y_pred, average=avg_param, zero_division=0))
    recall = float(recall_score(y_true, y_pred, average=avg_param, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, average=avg_param, zero_division=0))
    
    # 혼동 행렬
    cm = confusion_matrix(y_true, y_pred)
    if cm.shape == (2, 2):
        tp = int(cm[1, 1])
        fp = int(cm[0, 1])
        tn = int(cm[0, 0])
        fn = int(cm[1, 0])
    else:
        tp = fp = tn = fn = 0
    
    metrics['Threshold'] = threshold
    metrics['Accuracy'] = accuracy
    metrics['Precision'] = precision
    metrics['Recall'] = recall
    metrics['F1-Score'] = f1
    metrics['Confusion Matrix'] = f"TP:{tp}, FP:{fp}, TN:{tn}, FN:{fn}"
    metrics['TP'] = tp
    metrics['FP'] = fp
    metrics['TN'] = tn
    metrics['FN'] = fn

    # ROC-AUC & 평균 정밀도(PR-AUC) — 확률 점수가 있을 때만(결정적). 하드 레이블이면 생략.
    if y_pred_proba is not None and is_binary:
        try:
            metrics['AUC-ROC'] = float(roc_auc_score(y_true, y_pred_proba))
            metrics['Average Precision'] = float(average_precision_score(y_true, y_pred_proba))
        except Exception:
            pass

    # 여러 threshold에 대한 모든 통계량 계산 (0부터 1까지 0.01 단위)
    if calculate_threshold_metrics and y_pred_proba is not None:
        threshold_list = np.arange(0, 1.01, 0.01)
        for th in threshold_list:
            y_pred_th = (y_pred_proba >= th).astype(int)
            try:
                acc = float(accuracy_score(y_true, y_pred_th))
                prec = float(precision_score(y_true, y_pred_th, average=avg_param, zero_division=0))
                rec = float(recall_score(y_true, y_pred_th, average=avg_param, zero_division=0))
                f1 = float(f1_score(y_true, y_pred_th, average=avg_param, zero_division=0))
                
                # 혼동 행렬
                cm_th = confusion_matrix(y_true, y_pred_th)
                if cm_th.shape == (2, 2):
                    tp_th = int(cm_th[1, 1])
                    fp_th = int(cm_th[0, 1])
                    tn_th = int(cm_th[0, 0])
                    fn_th = int(cm_th[1, 0])
                else:
                    tp_th = fp_th = tn_th = fn_th = 0
                
                threshold_metrics_list.append({
                    'threshold': float(th),
                    'accuracy': acc,
                    'precision': prec,
                    'recall': rec,
                    'f1Score': f1,
                    'tp': tp_th,
                    'fp': fp_th,
                    'tn': tn_th,
                    'fn': fn_th
                })
            except:
                # 에러 발생 시 스킵
                pass
        
        # threshold_metrics를 JSON 문자열로 변환하여 전달
        import json as json_module
        metrics['_threshold_metrics_json'] = json_module.dumps(threshold_metrics_list)
else:
    # 회귀 모델: prediction_column이 직접 예측값
    y_pred = df[prediction_column].values
    
    # 회귀 메트릭
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    mae = float(mean_absolute_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))

    # 상대 오차(책 Ch5 표준): 평균 예측기 대비 모델 오차 (결정적)
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)
    y_mean = float(np.mean(y_true_arr))
    ss_res = float(np.sum((y_true_arr - y_pred_arr) ** 2))
    ss_tot = float(np.sum((y_true_arr - y_mean) ** 2))
    abs_res = float(np.sum(np.abs(y_true_arr - y_pred_arr)))
    abs_tot = float(np.sum(np.abs(y_true_arr - y_mean)))
    rse = float(ss_res / ss_tot) if ss_tot > 0 else float('nan')
    rae = float(abs_res / abs_tot) if abs_tot > 0 else float('nan')

    metrics['Mean Squared Error (MSE)'] = mse
    metrics['Root Mean Squared Error (RMSE)'] = rmse
    metrics['Mean Absolute Error (MAE)'] = mae
    metrics['R-squared'] = r2
    metrics['Relative Squared Error (RSE)'] = rse
    metrics['Relative Absolute Error (RAE)'] = rae

metrics
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python EvaluateModel 실행 타임아웃 (60초 초과)"
    );

    // Python 딕셔너리를 JavaScript 객체로 변환
    const metrics = fromPython(resultPyObj);

    // threshold_metrics가 있으면 파싱
    let thresholdMetrics:
      | Array<{
          threshold: number;
          accuracy: number;
          precision: number;
          recall: number;
          f1Score: number;
          tp: number;
          fp: number;
          tn: number;
          fn: number;
        }>
      | undefined = undefined;
    if (metrics["_threshold_metrics_json"]) {
      try {
        thresholdMetrics = JSON.parse(
          metrics["_threshold_metrics_json"] as string
        );
        delete metrics["_threshold_metrics_json"];
      } catch (e) {
        // 파싱 실패 시 무시
      }
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_label_column");
    py.globals.delete("js_prediction_column");
    py.globals.delete("js_model_type");
    py.globals.delete("js_threshold");
    py.globals.delete("js_calculate_threshold_metrics");

    return { ...metrics, thresholdMetrics };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_label_column");
        py.globals.delete("js_prediction_column");
        py.globals.delete("js_model_type");
        py.globals.delete("js_threshold");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python EvaluateModel error: ${errorMessage}`);
  }
}

/**
 * PredictModel을 Python으로 실행합니다 (statsmodels 모델 예측)
 * 타임아웃: 120초
 */
export async function predictWithStatsmodel(
  data: any[],
  featureColumns: string[],
  coefficients: Record<string, { coef: number }>,
  modelType: string,
  timeoutMs: number = 120000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // statsmodels 패키지 로드
    await withTimeout(
      py.loadPackage(["statsmodels"]),
      60000,
      "statsmodels 패키지 설치 타임아웃 (60초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_coefficients", coefficients);
    py.globals.set("js_model_type", modelType);

    // Python 코드 실행
    const code = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm

# 데이터 준비
df = pd.DataFrame(js_data.to_py())
feature_columns = js_feature_columns.to_py()
coefficients_dict = js_coefficients.to_py()
model_type = str(js_model_type)

# 특성 컬럼만 선택
X = df[feature_columns].copy()

# 상수항 추가 (모델 피팅 시와 동일한 방식)
X = sm.add_constant(X, prepend=True, has_constant='add')

# 계수 정보를 사용하여 모델 재구성
# statsmodels의 predict를 정확히 재현하기 위해 모델을 다시 피팅하는 대신
# 선형 예측자를 직접 계산하고 link function을 적용

# 계수 딕셔너리에서 실제 키 이름 확인 (statsmodels가 생성한 이름 사용)
# 상수항 이름 확인 ('const' 또는 다른 이름)
const_name = None
for key in coefficients_dict.keys():
    if key.lower() in ['const', 'intercept']:
        const_name = key
        break
if const_name is None:
    # 첫 번째 키가 상수항일 가능성이 높음
    const_name = list(coefficients_dict.keys())[0] if coefficients_dict else 'const'

# exog_names 생성: 상수항 + feature_columns (계수 딕셔너리의 키 순서 사용)
# 하지만 feature_columns 순서를 우선하고, 계수 딕셔너리에 있는 것만 사용
exog_names = [const_name] + feature_columns

# 계수 배열 생성 (exog_names 순서에 맞춰)
coef_array = []
for name in exog_names:
    if name in coefficients_dict:
        coef_value = coefficients_dict[name].get('coef', 0.0) if isinstance(coefficients_dict[name], dict) else coefficients_dict[name]
        coef_array.append(float(coef_value))
    else:
        coef_array.append(0.0)
coef_array = np.array(coef_array)

# X를 exog_names 순서에 맞춰 정렬
X_aligned = X.reindex(columns=exog_names).fillna(0)

# 선형 예측자 계산
linear_predictor = np.dot(X_aligned.values, coef_array)

# 모델 타입에 따라 link function 적용
if model_type == 'OLS':
    predictions = linear_predictor
elif model_type == 'Logistic' or model_type == 'Logit':
    # Logit: exp(x) / (1 + exp(x))
    predictions = 1.0 / (1.0 + np.exp(-linear_predictor))
elif model_type in ['Poisson', 'NegativeBinomial', 'QuasiPoisson']:
    # Count regression: exp(x)
    predictions = np.exp(linear_predictor)
elif model_type == 'Gamma':
    # Gamma GLM: exp(x) (log link)
    predictions = np.exp(linear_predictor)
elif model_type == 'Tweedie':
    # Tweedie GLM: exp(x) (log link)
    predictions = np.exp(linear_predictor)
else:
    # 기본값: 선형 예측자
    predictions = linear_predictor

# 결과 데이터프레임 생성
result_df = df.copy()
result_df['Predict'] = predictions

# 정수 예측값 컬럼 추가 (Logistic, Poisson, NegativeBinomial, QuasiPoisson 모델)
if model_type in ['Logistic', 'Logit', 'Poisson', 'NegativeBinomial', 'QuasiPoisson']:
    # 가장 가까운 정수로 반올림
    predictions_int = np.round(predictions).astype(int)
    # 음수는 0으로 제한 (count 모델의 경우)
    if model_type in ['Poisson', 'NegativeBinomial', 'QuasiPoisson']:
        predictions_int = np.maximum(predictions_int, 0)
    # Logistic의 경우 0 또는 1로 제한
    elif model_type in ['Logistic', 'Logit']:
        predictions_int = np.clip(predictions_int, 0, 1)
    result_df['y_Pred'] = predictions_int

# 결과를 딕셔너리 리스트로 변환
result_rows = result_df.to_dict('records')
result_columns = [{'name': col, 'type': str(result_df[col].dtype)} for col in result_df.columns]

result = {
    'rows': result_rows,
    'columns': result_columns
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python PredictModel 실행 타임아웃 (120초 초과)"
    );

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_coefficients");
    py.globals.delete("js_model_type");

    return result;
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python PredictModel error: ${errorMessage}`);
  }
}

/**
 * EvaluateStats를 Python으로 실행합니다 (GLM 통계량 평가)
 * 타임아웃: 120초
 */
export async function evaluateStatsPython(
  data: any[],
  labelColumn: string,
  predictionColumn: string,
  modelType: string,
  timeoutMs: number = 120000
): Promise<{
  metrics: Record<string, number | string>;
  residuals?: number[];
  deviance?: number;
  pearsonChi2?: number;
  dispersion?: number;
  aic?: number;
  bic?: number;
  logLikelihood?: number;
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // statsmodels 패키지 로드
    await withTimeout(
      py.loadPackage(["statsmodels", "scipy"]),
      60000,
      "statsmodels 패키지 설치 타임아웃 (60초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_prediction_column", predictionColumn);
    py.globals.set("js_model_type", modelType);

    // Python 코드 실행
    const code = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm
from scipy import stats

# 데이터 준비
df = pd.DataFrame(js_data.to_py())
label_column = str(js_label_column)
prediction_column = str(js_prediction_column)
model_type = str(js_model_type)

# 실제값과 예측값 추출
y_true = df[label_column].values
y_pred = df[prediction_column].values

# 기본 메트릭 계산
metrics = {}
residuals = None
deviance = None
pearson_chi2 = None
dispersion = None
aic = None
bic = None
log_likelihood = None

# 잔차 계산
residuals = (y_true - y_pred).tolist()

# 기본 회귀 메트릭
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
mse = float(mean_squared_error(y_true, y_pred))
rmse = float(np.sqrt(mse))
mae = float(mean_absolute_error(y_true, y_pred))
r2 = float(r2_score(y_true, y_pred))

metrics['Mean Squared Error (MSE)'] = mse
metrics['Root Mean Squared Error (RMSE)'] = rmse
metrics['Mean Absolute Error (MAE)'] = mae
metrics['R-squared'] = r2

# 모델 타입에 따른 추가 통계량 (선택적)
# 모델 타입이 제공되면 해당 모델의 특수 통계량 계산
if model_type and model_type != '' and model_type != 'None':
    if model_type in ['Poisson', 'NegativeBinomial', 'QuasiPoisson']:
        # Count regression 모델 통계량
        # Deviance 계산
        if model_type == 'Poisson':
            # Poisson deviance: 2 * sum(y * log(y/mu) - (y - mu))
            mu = np.maximum(y_pred, 1e-10)  # 0 방지
            deviance_val = 2 * np.sum(y_true * np.log(np.maximum(y_true, 1e-10) / mu) - (y_true - mu))
            deviance = float(deviance_val)
            
            # Pearson chi2
            pearson_resid = (y_true - mu) / np.sqrt(mu)
            pearson_chi2_val = np.sum(pearson_resid ** 2)
            pearson_chi2 = float(pearson_chi2_val)
            
            # Dispersion (phi)
            n = len(y_true)
            p = 1  # 간단히 1로 가정 (실제로는 모델의 파라미터 수)
            dispersion_val = pearson_chi2_val / (n - p) if (n - p) > 0 else 1.0
            dispersion = float(dispersion_val)
            
            # Log-likelihood (Poisson)
            log_likelihood_val = np.sum(stats.poisson.logpmf(y_true, mu))
            log_likelihood = float(log_likelihood_val)
            
            # AIC, BIC (근사치)
            aic = float(-2 * log_likelihood_val + 2 * p)
            bic = float(-2 * log_likelihood_val + np.log(n) * p)
            
        elif model_type in ['NegativeBinomial', 'QuasiPoisson']:
            # Negative Binomial / Quasi-Poisson 통계량
            mu = np.maximum(y_pred, 1e-10)
            deviance_val = 2 * np.sum(y_true * np.log(np.maximum(y_true, 1e-10) / mu) - (y_true - mu))
            deviance = float(deviance_val)
            
            pearson_resid = (y_true - mu) / np.sqrt(mu)
            pearson_chi2_val = np.sum(pearson_resid ** 2)
            pearson_chi2 = float(pearson_chi2_val)
            
            n = len(y_true)
            p = 1
            dispersion_val = pearson_chi2_val / (n - p) if (n - p) > 0 else 1.0
            dispersion = float(dispersion_val)

    elif model_type in ['Logistic', 'Logit']:
        # Logistic regression 통계량
        # Deviance (binomial deviance)
        y_pred_clipped = np.clip(y_pred, 1e-10, 1 - 1e-10)
        y_true_clipped = np.clip(y_true, 1e-10, 1 - 1e-10)
        deviance_val = -2 * np.sum(y_true * np.log(y_pred_clipped) + (1 - y_true) * np.log(1 - y_pred_clipped))
        deviance = float(deviance_val)
        
        # Pearson chi2
        pearson_resid = (y_true - y_pred) / np.sqrt(y_pred * (1 - y_pred) + 1e-10)
        pearson_chi2_val = np.sum(pearson_resid ** 2)
        pearson_chi2 = float(pearson_chi2_val)
        
        # Log-likelihood
        log_likelihood_val = np.sum(y_true * np.log(y_pred_clipped) + (1 - y_true) * np.log(1 - y_pred_clipped))
        log_likelihood = float(log_likelihood_val)
        
        n = len(y_true)
        p = 1
        aic = float(-2 * log_likelihood_val + 2 * p)
        bic = float(-2 * log_likelihood_val + np.log(n) * p)

    elif model_type == 'OLS':
        # OLS 통계량
        # Deviance (residual sum of squares)
        deviance_val = np.sum((y_true - y_pred) ** 2)
        deviance = float(deviance_val)
        
        # Log-likelihood (normal distribution)
        n = len(y_true)
        sigma2 = deviance_val / n if n > 0 else 1.0
        log_likelihood_val = -0.5 * n * (np.log(2 * np.pi * sigma2) + 1)
        log_likelihood = float(log_likelihood_val)
        
        p = 1
        aic = float(-2 * log_likelihood_val + 2 * p)
        bic = float(-2 * log_likelihood_val + np.log(n) * p)

# 메트릭에 추가
if deviance is not None:
    metrics['Deviance'] = deviance
if pearson_chi2 is not None:
    metrics['Pearson chi2'] = pearson_chi2
if dispersion is not None:
    metrics['Dispersion (phi)'] = dispersion
if aic is not None:
    metrics['AIC'] = aic
if bic is not None:
    metrics['BIC'] = bic
if log_likelihood is not None:
    metrics['Log-Likelihood'] = log_likelihood

# 잔차 통계량
if residuals is not None:
    residuals_array = np.array(residuals)
    metrics['Mean Residual'] = float(np.mean(residuals_array))
    metrics['Std Residual'] = float(np.std(residuals_array))
    metrics['Min Residual'] = float(np.min(residuals_array))
    metrics['Max Residual'] = float(np.max(residuals_array))

result = {
    'metrics': metrics,
    'residuals': residuals,
    'deviance': deviance,
    'pearsonChi2': pearson_chi2,
    'dispersion': dispersion,
    'aic': aic,
    'bic': bic,
    'logLikelihood': log_likelihood
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python EvaluateStats 실행 타임아웃 (120초 초과)"
    );

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_label_column");
    py.globals.delete("js_prediction_column");
    py.globals.delete("js_model_type");

    return result;
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python EvaluateStats error: ${errorMessage}`);
  }
}

/**
 * ScoreModel 결과에 PCA를 적용하여 시각화용 차원 축소를 수행합니다
 * 타임아웃: 60초
 */
export async function calculatePCAForScoreVisualization(
  data: any[],
  featureColumns: string[],
  nComponents: number = 2,
  timeoutMs: number = 60000
): Promise<{
  coordinates: number[][]; // [n_samples, n_components]
  explainedVarianceRatio: number[];
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달 (다른 함수들과 동일한 방식)
    // 데이터 검증
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error(
        `PCA: Input data is invalid. Type: ${typeof data}, IsArray: ${Array.isArray(
          data
        )}, Length: ${data?.length || 0}`
      );
    }
    if (
      !featureColumns ||
      !Array.isArray(featureColumns) ||
      featureColumns.length === 0
    ) {
      throw new Error(
        `PCA: Feature columns are invalid. Type: ${typeof featureColumns}, IsArray: ${Array.isArray(
          featureColumns
        )}, Length: ${featureColumns?.length || 0}`
      );
    }

    // Pyodide에 데이터 설정 (동기적으로 설정)
    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_n_components", nComponents);

    // 설정 직후 확인 (디버깅용 - 동기적으로 확인)
    const verifyData = py.globals.get("js_data");
    const verifyCols = py.globals.get("js_feature_columns");
    if (!verifyData) {
      throw new Error(
        `PCA: Failed to set js_data immediately after setting. Original data length: ${data.length}`
      );
    }
    if (!verifyCols) {
      throw new Error(
        `PCA: Failed to set js_feature_columns immediately after setting. Original columns: ${featureColumns.join(
          ", "
        )}`
      );
    }

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

try:
    # 데이터 준비
    # 디버깅: js_data 상태 확인 (Python 코드 실행 시점)
    import sys
    debug_info = {
        'js_data_is_none': js_data is None,
        'js_data_type': str(type(js_data)) if js_data is not None else 'None',
        'js_data_has_to_py': hasattr(js_data, 'to_py') if js_data is not None else False,
        'js_data_repr': repr(js_data)[:100] if js_data is not None else 'None'
    }
    
    if js_data is None:
        # js_data가 None인 경우, 전역 변수에서 직접 확인 시도
        try:
            import pyodide
            if hasattr(pyodide, 'globals'):
                globals_check = pyodide.globals.get('js_data')
                debug_info['globals_js_data'] = 'exists' if globals_check is not None else 'missing'
        except:
            pass
        raise ValueError(f"js_data is None at Python execution time. Debug info: {debug_info}")
    
    # Pyodide에서 JavaScript 객체를 Python으로 변환
    # js_data는 Pyodide Proxy 객체이므로 to_py() 메서드 사용
    try:
        # 먼저 js_data의 타입과 속성 확인
        if hasattr(js_data, 'to_py'):
            data_list = js_data.to_py()
        elif isinstance(js_data, list):
            # 이미 Python 리스트인 경우
            data_list = js_data
        elif hasattr(js_data, '__iter__'):
            # iterable인 경우
            data_list = list(js_data)
        else:
            # 단일 객체인 경우 리스트로 감싸기
            data_list = [js_data]
    except Exception as e:
        raise ValueError(f"Failed to convert js_data to Python: {str(e)}. Debug info: {debug_info}")
    
    if not data_list or len(data_list) == 0:
        raise ValueError(f"Input data is empty. Data type: {type(data_list)}, Length: {len(data_list) if data_list else 0}")
    
    dataframe = pd.DataFrame(data_list)
    
    if dataframe.empty:
        raise ValueError("DataFrame is empty after conversion")
    
    if js_feature_columns is None:
        raise ValueError("js_feature_columns is None. Check if feature columns were passed correctly.")
    
    try:
        if hasattr(js_feature_columns, 'to_py'):
            p_feature_columns = js_feature_columns.to_py()
        elif isinstance(js_feature_columns, list):
            # 이미 Python 리스트인 경우
            p_feature_columns = js_feature_columns
        else:
            # 다른 타입인 경우 시도
            p_feature_columns = list(js_feature_columns) if hasattr(js_feature_columns, '__iter__') else [js_feature_columns]
    except Exception as e:
        raise ValueError(f"Failed to convert js_feature_columns to Python: {str(e)}. Type: {type(js_feature_columns)}, has to_py: {hasattr(js_feature_columns, 'to_py')}")
    
    if not p_feature_columns or len(p_feature_columns) == 0:
        raise ValueError(f"Feature columns list is empty. Columns type: {type(p_feature_columns)}, Length: {len(p_feature_columns) if p_feature_columns else 0}")
    
    p_n_components = int(js_n_components)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    
    # feature columns가 존재하는지 확인
    missing_cols = [col for col in p_feature_columns if col not in dataframe.columns]
    if missing_cols:
        raise ValueError(f"Feature columns not found in DataFrame: {missing_cols}")
    
    # Feature 데이터 추출
    X = dataframe[p_feature_columns].select_dtypes(include=[np.number])
    
    # 숫자형이 아닌 컬럼 제거
    if X.empty:
        raise ValueError("No numeric feature columns found")
    
    # 결측치가 있는 행 찾기
    valid_mask = ~X.isnull().any(axis=1)
    X_clean = X[valid_mask].copy()
    
    if len(X_clean) < 2:
        raise ValueError(f"Need at least 2 valid samples for PCA, got {len(X_clean)}")
    
    if X_clean.shape[1] < p_n_components:
        raise ValueError(f"Number of features ({X_clean.shape[1]}) must be >= n_components ({p_n_components})")
    
    # 표준화
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_clean)
    
    # PCA 적용
    pca = PCA(n_components=p_n_components)
    X_pca = pca.fit_transform(X_scaled)
    
    # 결과 준비 (유효한 데이터만 반환)
    coordinates = X_pca.tolist()
    explained_variance_ratio = pca.explained_variance_ratio_.tolist()
    
    # 유효한 인덱스 정보도 함께 반환 (필터링에 사용)
    valid_indices = X_clean.index.tolist()
    
    result = {
        'coordinates': coordinates,
        'explained_variance_ratio': explained_variance_ratio,
        'valid_indices': valid_indices
    }
    
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
except:
    # 예상치 못한 에러
    error_result = {
        '__error__': True,
        'error_type': 'UnknownError',
        'error_message': 'Unexpected error occurred: ' + str(sys.exc_info()[1]),
        'error_traceback': str(sys.exc_info())
    }
    js_result = error_result
`;

    // Python 코드 실행 (다른 함수들과 동일한 방식)
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python PCA 계산 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      // 디버깅: 데이터 상태 확인
      let debugInfo: any = {};
      try {
        const dataCheck = py.globals.get("js_data");
        const colsCheck = py.globals.get("js_feature_columns");
        const nCompCheck = py.globals.get("js_n_components");

        // Python 코드 실행 후에도 데이터가 있는지 확인
        let dataInfo: any = {};
        let colsInfo: any = {};

        if (dataCheck) {
          try {
            if (typeof dataCheck.to_py === "function") {
              const pyData = dataCheck.to_py();
              dataInfo = {
                exists: true,
                type: typeof pyData,
                isArray: Array.isArray(pyData),
                length: Array.isArray(pyData) ? pyData.length : "not_array",
              };
            } else {
              dataInfo = {
                exists: true,
                hasToPy: false,
                type: typeof dataCheck,
              };
            }
          } catch (e) {
            dataInfo = { exists: true, error: String(e) };
          }
        } else {
          dataInfo = { exists: false };
        }

        if (colsCheck) {
          try {
            if (typeof colsCheck.to_py === "function") {
              const pyCols = colsCheck.to_py();
              colsInfo = {
                exists: true,
                type: typeof pyCols,
                isArray: Array.isArray(pyCols),
                length: Array.isArray(pyCols) ? pyCols.length : "not_array",
                values: Array.isArray(pyCols) ? pyCols : "not_array",
              };
            } else {
              colsInfo = {
                exists: true,
                hasToPy: false,
                type: typeof colsCheck,
              };
            }
          } catch (e) {
            colsInfo = { exists: true, error: String(e) };
          }
        } else {
          colsInfo = { exists: false };
        }

        debugInfo = {
          afterExecution: {
            js_data: dataInfo,
            js_feature_columns: colsInfo,
            js_n_components: nCompCheck,
          },
          original: {
            dataLength: data.length,
            columns: featureColumns,
            nComponents: nComponents,
          },
        };
      } catch (e) {
        debugInfo = { error: String(e), stack: (e as Error).stack };
      }
      throw new Error(
        `Python PCA error: Python code returned None or undefined. Debug info: ${JSON.stringify(
          debugInfo,
          null,
          2
        )}`
      );
    }

    const result = fromPython(resultPyObj);

    if (result.__error__) {
      throw new Error(
        `Python PCA error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    if (!result.coordinates || !Array.isArray(result.coordinates)) {
      throw new Error(
        `Python PCA error: Missing or invalid 'coordinates' in result.`
      );
    }

    if (
      !result.explained_variance_ratio ||
      !Array.isArray(result.explained_variance_ratio)
    ) {
      throw new Error(
        `Python PCA error: Missing or invalid 'explained_variance_ratio' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_n_components");
    py.globals.delete("js_result");
    try {
      py.globals.delete("python_error");
    } catch {}

    return {
      coordinates: result.coordinates,
      explainedVarianceRatio: result.explained_variance_ratio,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_n_components");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python PCA error:\n${errorMessage}`);
  }
}

/**
 * HandleMissingValues를 Python으로 실행합니다 (결측치 처리 통계 계산)
 * 타임아웃: 60초
 */
export async function handleMissingValuesPython(
  data: any[],
  method: string,
  strategy: string,
  columns: string[] | null,
  n_neighbors: number,
  timeoutMs: number = 60000,
  data2?: any[] | null,
  inputColumns?: Array<{ name: string; type: string }>
): Promise<{
  rows: any[];
  columns: Array<{ name: string; type: string }>;
  rows2?: any[];
  columns2?: Array<{ name: string; type: string }>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_data2", data2 || null);
    py.globals.set("js_method", method);
    py.globals.set("js_strategy", strategy);
    py.globals.set("js_columns", columns);
    py.globals.set("js_n_neighbors", n_neighbors);
    py.globals.set("js_input_columns", inputColumns || []);

    const code = `
import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer

df = pd.DataFrame(js_data.to_py())
df2 = pd.DataFrame(js_data2.to_py()) if js_data2 else None
method = str(js_method)
strategy = str(js_strategy)
columns = js_columns.to_py() if js_columns else None
n_neighbors = int(js_n_neighbors)
input_columns = js_input_columns.to_py() if js_input_columns else []

# 입력 컬럼 정보를 기반으로 숫자형 컬럼을 명시적으로 변환
if input_columns:
    for col_info in input_columns:
        col_name = col_info['name']
        col_type = col_info.get('type', 'object')
        
        if col_name in df.columns:
            # pandas 숫자형 dtype인 경우 숫자로 변환
            if col_type.startswith('int') or col_type.startswith('float'):
                df[col_name] = pd.to_numeric(df[col_name], errors='coerce')

# 입력 컬럼의 원본 dtype을 저장 - 입력 컬럼 정보의 타입을 그대로 사용
original_dtypes = {}
if input_columns:
    for col_info in input_columns:
        col_name = col_info['name']
        col_type = col_info.get('type', 'object')
        # 입력 컬럼 정보의 타입을 그대로 사용 (이미 pandas dtype이거나 변환된 타입)
        original_dtypes[col_name] = col_type
else:
    # 입력 컬럼 정보가 없으면 DataFrame의 dtype 사용
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        if dtype_str.startswith('int'):
            original_dtypes[col] = 'int64'
        elif dtype_str.startswith('float'):
            original_dtypes[col] = 'float64'
        else:
            original_dtypes[col] = dtype_str

# Statistics 모듈과 동일한 방식으로 빈 문자열을 null로 카운트
# 빈 문자열을 NaN으로 변환하여 결측치로 처리하되, Statistics 모듈과 동일한 방식으로 카운트
for col in df.columns:
    # 모든 컬럼에 대해 빈 문자열을 먼저 확인하고 NaN으로 변환
    # 숫자형 컬럼의 경우 빈 문자열이 문자열로 저장되어 있을 수 있음
    col_str = df[col].astype(str)
    empty_mask = (col_str.str.strip() == '') | (col_str == 'nan') | (col_str == 'NaN') | (col_str == 'None')
    
    if df[col].dtype == 'object':
        # 문자열 컬럼의 경우 빈 문자열을 NaN으로 변환
        df[col] = df[col].replace('', np.nan)
        df.loc[empty_mask, col] = np.nan
    else:
        # 숫자형 컬럼의 경우 빈 문자열을 NaN으로 변환
        # 빈 문자열이 문자열로 저장된 경우를 처리
        df.loc[empty_mask, col] = np.nan
        # 숫자로 변환할 수 없는 값들을 NaN으로 변환
        df[col] = pd.to_numeric(df[col], errors='coerce')

df_result = df.copy()

if method == 'remove_row':
    # 선택된 열에 대해서만 결측치가 있는 행을 제거
    # remove_row는 모든 타입(숫자, 문자열 모두)에 적용 가능
    if columns:
        # 선택된 열 중 하나라도 결측치가 있는 행을 제거
        df_result = df_result.dropna(subset=columns)
        print(f"선택된 열 {columns}에 대해 행 제거 완료. {len(df)} -> {len(df_result)} 행")
    else:
        # 모든 열에 대해 결측치가 있는 행을 제거
        df_result = df_result.dropna()
        print(f"행 제거 완료. {len(df)} -> {len(df_result)} 행")
elif method == 'impute':
    cols_to_impute = columns if columns else df_result.select_dtypes(include=[np.number]).columns.tolist()
    
    for col in cols_to_impute:
        if col not in df_result.columns:
            continue
        if df_result[col].isnull().any():
            if df_result[col].dtype in ['int64', 'float64']:
                non_null_values = df_result[col].dropna()
                if len(non_null_values) == 0:
                    continue
                
                if strategy == 'mean':
                    fill_value = float(non_null_values.mean())
                elif strategy == 'median':
                    fill_value = float(non_null_values.median())
                elif strategy == 'mode':
                    mode_val = non_null_values.mode()
                    fill_value = float(mode_val.iloc[0]) if len(mode_val) > 0 else 0.0
                else:
                    fill_value = float(non_null_values.mean())
                
                df_result[col].fillna(fill_value, inplace=True)
                print(f"컬럼 '{col}' 결측치를 {strategy} 값({fill_value:.2f})으로 대체")
            else:
                # 문자열/범주형 컬럼은 mode 사용
                non_null_values = df_result[col].dropna()
                if len(non_null_values) == 0:
                    continue
                mode_val = non_null_values.mode()
                fill_value = str(mode_val.iloc[0]) if len(mode_val) > 0 else ''
                df_result[col].fillna(fill_value, inplace=True)
                print(f"컬럼 '{col}' 결측치를 mode 값({fill_value})으로 대체")
elif method == 'knn':
    # 선택된 열 중 수치형 열만 사용
    if columns:
        numeric_cols = [col for col in columns if col in df_result.columns and df_result[col].dtype in ['int64', 'float64']]
    else:
        numeric_cols = df_result.select_dtypes(include=[np.number]).columns.tolist()
    
    if len(numeric_cols) > 0:
        imputer = KNNImputer(n_neighbors=n_neighbors)
        df_result[numeric_cols] = imputer.fit_transform(df_result[numeric_cols])
        print(f"선택된 열 {numeric_cols}에 대해 KNN 방법으로 결측치 처리 완료 (n_neighbors={n_neighbors})")
        
        # 두 번째 데이터가 있으면 transform
        if df2 is not None:
            # 두 번째 데이터도 동일한 방식으로 빈 문자열 처리
            for col in df2.columns:
                col_str = df2[col].astype(str)
                empty_mask = (col_str.str.strip() == '') | (col_str == 'nan') | (col_str == 'NaN') | (col_str == 'None')
                if df2[col].dtype == 'object':
                    df2[col] = df2[col].replace('', np.nan)
                    df2.loc[empty_mask, col] = np.nan
                else:
                    df2.loc[empty_mask, col] = np.nan
                    df2[col] = pd.to_numeric(df2[col], errors='coerce')
            
            # fit된 imputer로 transform
            df2_result = df2.copy()
            numeric_cols2 = [col for col in numeric_cols if col in df2_result.columns]
            if len(numeric_cols2) > 0:
                df2_result[numeric_cols2] = imputer.transform(df2_result[numeric_cols2])
                print(f"두 번째 데이터에 대해 KNN transform 적용 완료")
    else:
        print("경고: 선택된 열 중 수치형 컬럼이 없어 KNN 방법을 사용할 수 없습니다.")

# 두 번째 데이터 처리 (fit된 파라미터로 transform)
df2_result = None
if df2 is not None:
    # 두 번째 데이터도 동일한 방식으로 빈 문자열 처리
    for col in df2.columns:
        col_str = df2[col].astype(str)
        empty_mask = (col_str.str.strip() == '') | (col_str == 'nan') | (col_str == 'NaN') | (col_str == 'None')
        if df2[col].dtype == 'object':
            df2[col] = df2[col].replace('', np.nan)
            df2.loc[empty_mask, col] = np.nan
        else:
            df2.loc[empty_mask, col] = np.nan
            df2[col] = pd.to_numeric(df2[col], errors='coerce')
    
    df2_result = df2.copy()
    
    if method == 'remove_row':
        # 선택된 열에 대해서만 결측치가 있는 행을 제거
        if columns:
            df2_result = df2_result.dropna(subset=columns)
        else:
            df2_result = df2_result.dropna()
        print(f"두 번째 데이터 행 제거 완료. {len(df2)} -> {len(df2_result)} 행")
    elif method == 'impute':
        cols_to_impute = columns if columns else df_result.select_dtypes(include=[np.number]).columns.tolist()
        
        for col in cols_to_impute:
            if col not in df2_result.columns:
                continue
            if df2_result[col].isnull().any():
                # 첫 번째 데이터에서 계산한 fill_value 사용
                if col in df_result.columns:
                    if df_result[col].dtype in ['int64', 'float64']:
                        non_null_values = df_result[col].dropna()
                        if len(non_null_values) > 0:
                            if strategy == 'mean':
                                fill_value = float(non_null_values.mean())
                            elif strategy == 'median':
                                fill_value = float(non_null_values.median())
                            elif strategy == 'mode':
                                mode_val = non_null_values.mode()
                                fill_value = float(mode_val.iloc[0]) if len(mode_val) > 0 else 0.0
                            else:
                                fill_value = float(non_null_values.mean())
                            df2_result[col].fillna(fill_value, inplace=True)
                    else:
                        # 문자열/범주형 컬럼은 mode 사용
                        non_null_values = df_result[col].dropna()
                        if len(non_null_values) > 0:
                            mode_val = non_null_values.mode()
                            fill_value = str(mode_val.iloc[0]) if len(mode_val) > 0 else ''
                            df2_result[col].fillna(fill_value, inplace=True)
        print(f"두 번째 데이터에 impute 적용 완료")

result_rows = df_result.to_dict('records')
# 입력 데이터의 원본 dtype을 유지
result_columns = []
for col in df_result.columns:
    if col in original_dtypes:
        result_columns.append({'name': col, 'type': original_dtypes[col]})
    else:
        dtype_str = str(df_result[col].dtype)
        if dtype_str.startswith('int'):
            result_columns.append({'name': col, 'type': 'int64'})
        elif dtype_str.startswith('float'):
            result_columns.append({'name': col, 'type': 'float64'})
        elif dtype_str == 'object':
            result_columns.append({'name': col, 'type': 'object'})
        elif dtype_str == 'bool':
            result_columns.append({'name': col, 'type': 'bool'})
        else:
            result_columns.append({'name': col, 'type': dtype_str})

result = {
    'rows': result_rows,
    'columns': result_columns
}

if df2_result is not None:
    result_rows2 = df2_result.to_dict('records')
    result_columns2 = []
    for col in df2_result.columns:
        if col in original_dtypes:
            result_columns2.append({'name': col, 'type': original_dtypes[col]})
        else:
            dtype_str = str(df2_result[col].dtype)
            if dtype_str.startswith('int'):
                result_columns2.append({'name': col, 'type': 'int64'})
            elif dtype_str.startswith('float'):
                result_columns2.append({'name': col, 'type': 'float64'})
            elif dtype_str == 'object':
                result_columns2.append({'name': col, 'type': 'object'})
            elif dtype_str == 'bool':
                result_columns2.append({'name': col, 'type': 'bool'})
            else:
                result_columns2.append({'name': col, 'type': dtype_str})
    result['rows2'] = result_rows2
    result['columns2'] = result_columns2

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python HandleMissingValues 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_data2");
    py.globals.delete("js_method");
    py.globals.delete("js_strategy");
    py.globals.delete("js_columns");
    py.globals.delete("js_n_neighbors");
    py.globals.delete("js_input_columns");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_data2");
        py.globals.delete("js_method");
        py.globals.delete("js_strategy");
        py.globals.delete("js_columns");
        py.globals.delete("js_n_neighbors");
        py.globals.delete("js_input_columns");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python HandleMissingValues error: ${errorMessage}`);
  }
}

/**
 * NormalizeData를 Python으로 실행합니다 (정규화 통계 계산)
 * 타임아웃: 60초
 */
export async function normalizeDataPython(
  data: any[],
  method: string,
  columns: string[],
  timeoutMs: number = 60000,
  data2?: any[] | null,
  inputColumns?: Array<{ name: string; type: string }>
): Promise<{
  rows: any[];
  columns: Array<{ name: string; type: string }>;
  rows2?: any[];
  columns2?: Array<{ name: string; type: string }>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_data2", data2 || null);
    py.globals.set("js_method", method);
    py.globals.set("js_columns", columns);
    py.globals.set("js_input_columns", inputColumns || []);

    const code = `
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler, RobustScaler

df = pd.DataFrame(js_data.to_py())
df2 = pd.DataFrame(js_data2.to_py()) if js_data2 else None
method = str(js_method)
columns = js_columns.to_py()
input_columns = js_input_columns.to_py() if js_input_columns else []

# 입력 컬럼의 원본 dtype을 먼저 저장 - 입력 컬럼 정보의 타입을 그대로 사용
original_dtypes = {}
if input_columns:
    for col_info in input_columns:
        col_name = col_info['name']
        col_type = col_info.get('type', 'object')
        # 입력 컬럼 정보의 타입을 그대로 사용 (이미 pandas dtype)
        original_dtypes[col_name] = col_type
else:
    # 입력 컬럼 정보가 없으면 DataFrame의 dtype 사용
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        if dtype_str.startswith('int'):
            original_dtypes[col] = 'int64'
        elif dtype_str.startswith('float'):
            original_dtypes[col] = 'float64'
        else:
            original_dtypes[col] = dtype_str

# 입력 컬럼 정보를 기반으로 숫자형 컬럼을 명시적으로 변환
# JavaScript에서 전달된 데이터는 문자열일 수 있으므로 숫자로 변환
if input_columns:
    for col_info in input_columns:
        col_name = col_info['name']
        col_type = col_info.get('type', 'object')
        
        if col_name in df.columns:
            # pandas 숫자형 dtype인 경우 숫자로 변환
            if col_type.startswith('int') or col_type.startswith('float'):
                # 숫자로 변환 시도
                converted = pd.to_numeric(df[col_name], errors='coerce')
                # 변환 후 dtype 확인하여 적절한 타입으로 변환
                if converted.dtype == 'float64':
                    # 정수만 있는지 확인
                    if converted.notna().any() and (converted.dropna() % 1 == 0).all():
                        # 모든 값이 정수인 경우 int64로 변환
                        df[col_name] = converted.astype('Int64').astype('float64')
                        # NaN이 있으면 float64 유지, 없으면 int64로 변환 시도
                        if df[col_name].isna().any():
                            df[col_name] = converted
                        else:
                            try:
                                df[col_name] = converted.astype('int64')
                            except:
                                df[col_name] = converted
                    else:
                        df[col_name] = converted
                else:
                    df[col_name] = converted

df_result = df.copy()

# 첫 번째 데이터로 fit하고 transform
scalers = {}
for col in columns:
    if col not in df_result.columns:
        continue
    
    if df_result[col].dtype not in ['int64', 'float64']:
        continue
    
    if method == 'MinMax':
        scaler = MinMaxScaler()
        # fit_transform은 2D 배열을 반환하므로 ravel()로 1D로 변환
        df_result[col] = scaler.fit_transform(df_result[[col]]).ravel()
        scalers[col] = scaler
        print(f"컬럼 '{col}'에 MinMax 정규화 적용")
    elif method == 'StandardScaler':
        scaler = StandardScaler()
        # 사용자 제공 코드와 동일한 방식: fit_transform 사용
        df_result[col] = scaler.fit_transform(df_result[[col]]).ravel()
        scalers[col] = scaler
        print(f"컬럼 '{col}'에 StandardScaler 정규화 적용")
    elif method == 'RobustScaler':
        scaler = RobustScaler()
        # fit_transform은 2D 배열을 반환하므로 ravel()로 1D로 변환
        df_result[col] = scaler.fit_transform(df_result[[col]]).ravel()
        scalers[col] = scaler
        print(f"컬럼 '{col}'에 RobustScaler 정규화 적용")

# 두 번째 데이터에 fit된 scaler로 transform
df2_result = None
if df2 is not None:
    df2_result = df2.copy()
    for col in columns:
        if col not in df2_result.columns or col not in scalers:
            continue
        
        if df2_result[col].dtype not in ['int64', 'float64']:
            continue
        
        # 첫 번째 데이터에서 fit된 scaler를 사용하여 transform만 수행
        scaler = scalers[col]
        df2_result[col] = scaler.transform(df2_result[[col]]).ravel()
    print(f"두 번째 데이터에 정규화 transform 적용 완료")

result_rows = df_result.to_dict('records')
# 입력 데이터의 원본 dtype을 유지 (없으면 DataFrame의 dtype 사용)
result_columns = []
for col in df_result.columns:
    if col in original_dtypes:
        # 입력 데이터의 원본 dtype 사용
        result_columns.append({'name': col, 'type': original_dtypes[col]})
    else:
        # 원본 dtype 정보가 없으면 DataFrame의 dtype 사용
        dtype_str = str(df_result[col].dtype)
        # pandas dtype을 간단한 타입으로 변환
        if dtype_str.startswith('int'):
            result_columns.append({'name': col, 'type': 'int64'})
        elif dtype_str.startswith('float'):
            result_columns.append({'name': col, 'type': 'float64'})
        elif dtype_str == 'object':
            result_columns.append({'name': col, 'type': 'object'})
        elif dtype_str == 'bool':
            result_columns.append({'name': col, 'type': 'bool'})
        else:
            result_columns.append({'name': col, 'type': dtype_str})

result = {
    'rows': result_rows,
    'columns': result_columns
}

if df2_result is not None:
    result_rows2 = df2_result.to_dict('records')
    # 두 번째 데이터도 동일한 방식으로 처리
    result_columns2 = []
    for col in df2_result.columns:
        if col in original_dtypes:
            result_columns2.append({'name': col, 'type': original_dtypes[col]})
        else:
            dtype_str = str(df2_result[col].dtype)
            if dtype_str.startswith('int'):
                result_columns2.append({'name': col, 'type': 'int64'})
            elif dtype_str.startswith('float'):
                result_columns2.append({'name': col, 'type': 'float64'})
            elif dtype_str == 'object':
                result_columns2.append({'name': col, 'type': 'object'})
            elif dtype_str == 'bool':
                result_columns2.append({'name': col, 'type': 'bool'})
            else:
                result_columns2.append({'name': col, 'type': dtype_str})
    result['rows2'] = result_rows2
    result['columns2'] = result_columns2

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python NormalizeData 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_data2");
    py.globals.delete("js_method");
    py.globals.delete("js_columns");
    py.globals.delete("js_input_columns");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_data2");
        py.globals.delete("js_method");
        py.globals.delete("js_columns");
        py.globals.delete("js_input_columns");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python NormalizeData error: ${errorMessage}`);
  }
}

/**
 * TransitionData를 Python으로 실행합니다 (수학적 변환)
 * 타임아웃: 60초
 */
export async function transformDataPython(
  data: any[],
  transformations: Record<string, string>,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_transformations", transformations);

    const code = `
import pandas as pd
import numpy as np

df = pd.DataFrame(js_data.to_py())
transformations = js_transformations.to_py()

df_transformed = df.copy()

for col, method in transformations.items():
    if method == 'None' or col not in df_transformed.columns:
        continue
    
    if not pd.api.types.is_numeric_dtype(df_transformed[col]):
        continue
    
    new_col_name = f"{col}_{method.lower().replace(' ', '_').replace('-', '_')}"
    
    if method == 'Log':
        df_transformed[new_col_name] = np.log(df_transformed[col].apply(lambda x: x if x > 0 else np.nan))
        df_transformed[new_col_name].fillna(0, inplace=True)
    elif method == 'Square Root':
        df_transformed[new_col_name] = np.sqrt(df_transformed[col].apply(lambda x: x if x >= 0 else np.nan))
        df_transformed[new_col_name].fillna(0, inplace=True)
    elif method == 'Min-Log':
        min_val = df_transformed[col].min()
        df_transformed[new_col_name] = np.log((df_transformed[col] - min_val) + 1)
    elif method == 'Min-Square Root':
        min_val = df_transformed[col].min()
        df_transformed[new_col_name] = np.sqrt((df_transformed[col] - min_val) + 1)

result_rows = df_transformed.to_dict('records')
result_columns = [{'name': col, 'type': str(df_transformed[col].dtype)} for col in df_transformed.columns]

result = {
    'rows': result_rows,
    'columns': result_columns
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python TransitionData 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_transformations");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_transformations");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python TransitionData error: ${errorMessage}`);
  }
}

/**
 * FeatureEngineer를 Python으로 실행합니다 (시계열·주기·상호작용 파생 특징, 결정적).
 * codeSnippets.ts FeatureEngineer 템플릿 / data_analysis_modules.feature_engineer 와 정합.
 * 타임아웃: 60초
 */
export async function featureEngineerPython(
  data: any[],
  operations: any[],
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_operations", operations || []);

    const code = `
import pandas as pd
import numpy as np

df = pd.DataFrame(js_data.to_py())
operations = js_operations.to_py()

df_fe = df.copy()
for op in (operations or []):
    t = op.get('type')
    if t == 'cyclical':
        col = op.get('column')
        period = float(op.get('period', 24) or 24)
        if col in df_fe.columns and period:
            ang = 2.0 * np.pi * df_fe[col].astype(float) / period
            df_fe[f'{col}_sin'] = np.sin(ang)
            df_fe[f'{col}_cos'] = np.cos(ang)
    elif t == 'interaction':
        cols = op.get('columns', []) or []
        if len(cols) == 2 and all(c in df_fe.columns for c in cols):
            new_col = f"{cols[0]}_x_{cols[1]}"
            df_fe[new_col] = df_fe[cols[0]].astype(float) * df_fe[cols[1]].astype(float)
    elif t == 'trend':
        name = op.get('name', 'trend_index') or 'trend_index'
        df_fe[name] = np.arange(len(df_fe))

result_rows = df_fe.to_dict('records')
result_columns = [{'name': col, 'type': str(df_fe[col].dtype)} for col in df_fe.columns]

result = {
    'rows': result_rows,
    'columns': result_columns
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python FeatureEngineer 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_operations");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_operations");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python FeatureEngineer error: ${errorMessage}`);
  }
}

/**
 * PythonScript(사용자 정의 코드)를 Pyodide 샌드박스에서 실행합니다(고급기능).
 * 'dataframe' 입력 → 사용자 코드 → 'scripted_data'(DataFrame) 출력. 없으면 입력 통과.
 * 임의 코드지만 브라우저 Pyodide 샌드박스라 호스트 파일시스템/네트워크에 접근 불가. 타임아웃 60초.
 */
export async function runUserScriptPython(
  data: any[],
  code: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_code", code || "scripted_data = dataframe");

    const wrapped = `
import pandas as pd
import numpy as np

dataframe = pd.DataFrame(js_data.to_py())
_user_code = str(js_code)
exec(_user_code, globals())
if 'scripted_data' not in dir():
    scripted_data = dataframe
if not isinstance(scripted_data, pd.DataFrame):
    scripted_data = pd.DataFrame(scripted_data)

result_rows = scripted_data.to_dict('records')
result_columns = [{'name': c, 'type': str(scripted_data[c].dtype)} for c in scripted_data.columns]
result = {'rows': result_rows, 'columns': result_columns}
result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(wrapped)),
      timeoutMs,
      "Python Script 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_code");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_code");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Script error: ${errorMessage}`);
  }
}

/**
 * DataFiltering을 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function filterDataPython(
  data: any[],
  filter_type: string,
  conditions: Array<{ column: string; operator: string; value: any }>,
  logical_operator: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_filter_type", filter_type);
    py.globals.set("js_conditions", conditions);
    py.globals.set("js_logical_operator", logical_operator);

    const code = `
import pandas as pd
import numpy as np
import traceback
import sys

try:
    df = pd.DataFrame(js_data.to_py())
    filter_type = str(js_filter_type)
    conditions = js_conditions.to_py()
    logical_operator = str(js_logical_operator)
    
    if filter_type == "row":
        # 행 필터링
        if not conditions or len(conditions) == 0:
            filtered_df = df.copy()
        else:
            masks = []
            for condition in conditions:
                column = condition.get("column", "")
                operator = condition.get("operator", "==")
                value = condition.get("value", "")
                
                if not column or column not in df.columns:
                    continue
                
                try:
                    # 값 타입 변환 시도
                    col_type = df[column].dtype
                    if col_type in [np.int64, np.float64] and value != "":
                        try:
                            if "." in str(value):
                                value = float(value)
                            else:
                                value = int(value)
                        except:
                            pass
                    
                    # 연산자에 따라 마스크 생성
                    if operator == "==":
                        mask = df[column] == value
                    elif operator == "!=":
                        mask = df[column] != value
                    elif operator == ">":
                        mask = df[column] > value
                    elif operator == "<":
                        mask = df[column] < value
                    elif operator == ">=":
                        mask = df[column] >= value
                    elif operator == "<=":
                        mask = df[column] <= value
                    elif operator == "contains":
                        mask = df[column].astype(str).str.contains(str(value), na=False, case=False)
                    elif operator == "not_contains":
                        mask = ~df[column].astype(str).str.contains(str(value), na=False, case=False)
                    elif operator == "is_null":
                        mask = df[column].isnull()
                    elif operator == "is_not_null":
                        mask = df[column].notnull()
                    else:
                        continue
                    
                    masks.append(mask)
                except Exception as e:
                    continue
            
            if not masks:
                filtered_df = df.copy()
            else:
                # 논리 연산자에 따라 마스크 결합
                if logical_operator == "AND":
                    final_mask = masks[0]
                    for mask in masks[1:]:
                        final_mask = final_mask & mask
                else:  # OR
                    final_mask = masks[0]
                    for mask in masks[1:]:
                        final_mask = final_mask | mask
                
                filtered_df = df[final_mask].copy()
    elif filter_type == "column":
        # 열 필터링
        if not conditions or len(conditions) == 0:
            filtered_df = df.copy()
        else:
            columns_to_keep = []
            for condition in conditions:
                column = condition.get("column", "")
                operator = condition.get("operator", "==")
                value = condition.get("value", "")
                
                if not column or column not in df.columns:
                    continue
                
                try:
                    col_values = df[column]
                    col_type = col_values.dtype
                    
                    # 값 타입 변환 시도
                    if col_type in [np.int64, np.float64] and value != "":
                        try:
                            if "." in str(value):
                                value = float(value)
                            else:
                                value = int(value)
                        except:
                            pass
                    
                    # 연산자에 따라 조건 확인
                    if operator == "==":
                        matches = (col_values == value).any()
                    elif operator == "!=":
                        matches = (col_values != value).any()
                    elif operator == ">":
                        matches = (col_values > value).any()
                    elif operator == "<":
                        matches = (col_values < value).any()
                    elif operator == ">=":
                        matches = (col_values >= value).any()
                    elif operator == "<=":
                        matches = (col_values <= value).any()
                    elif operator == "contains":
                        matches = col_values.astype(str).str.contains(str(value), na=False, case=False).any()
                    elif operator == "not_contains":
                        matches = (~col_values.astype(str).str.contains(str(value), na=False, case=False)).any()
                    elif operator == "is_null":
                        matches = col_values.isnull().any()
                    elif operator == "is_not_null":
                        matches = col_values.notnull().any()
                    else:
                        continue
                    
                    if matches:
                        columns_to_keep.append(column)
                except Exception as e:
                    continue
            
            if logical_operator == "AND":
                # AND: 모든 조건을 만족하는 열만 유지
                if len(columns_to_keep) == len(conditions):
                    filtered_df = df[columns_to_keep].copy() if columns_to_keep else pd.DataFrame()
                else:
                    filtered_df = pd.DataFrame()
            else:  # OR
                # OR: 하나라도 조건을 만족하는 열 유지
                if columns_to_keep:
                    filtered_df = df[columns_to_keep].copy()
                else:
                    filtered_df = pd.DataFrame()
    else:
        filtered_df = df.copy()
    
    result_rows = filtered_df.to_dict('records')
    result_columns = [{'name': col, 'type': str(filtered_df[col].dtype)} for col in filtered_df.columns]
    
    result = {
        'rows': result_rows,
        'columns': result_columns
    }
    
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python DataFiltering 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");

    if (!resultPyObj) {
      throw new Error(
        `Python DataFiltering error: Python code returned None or undefined.`
      );
    }

    const result = fromPython(resultPyObj);

    if (result && result.__error__) {
      throw new Error(
        `Python DataFiltering error:\n${
          result.error_traceback || result.error_message
        }`
      );
    }

    if (!result.rows || !result.columns) {
      throw new Error(
        `Python DataFiltering error: Missing rows or columns in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_filter_type");
    py.globals.delete("js_conditions");
    py.globals.delete("js_logical_operator");
    py.globals.delete("js_result");

    return {
      rows: result.rows,
      columns: result.columns,
    };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_filter_type");
        py.globals.delete("js_conditions");
        py.globals.delete("js_logical_operator");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python DataFiltering error: ${errorMessage}`);
  }
}

/**
 * 협업 필터링 추천(NMF 행렬분해)을 Python으로 실행합니다.
 * codeSnippets.ts 의 Recommender 템플릿 / data_analysis_modules.py 의
 * recommend_collaborative_filtering 와 동작이 1:1 일치합니다(재현성 불변식).
 * init='nndsvda' + random_state=42 로 완전 결정적입니다.
 * 타임아웃: 60초
 */
export async function runRecommenderPython(
  data: any[],
  user_col: string,
  item_col: string,
  rating_col: string,
  n_components: number = 2,
  top_n: number = 5,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_user_col", user_col);
    py.globals.set("js_item_col", item_col);
    py.globals.set("js_rating_col", rating_col);
    py.globals.set("js_n_components", n_components);
    py.globals.set("js_top_n", top_n);

    const code = `
import pandas as pd
import numpy as np
import traceback
from sklearn.decomposition import NMF

try:
    dataframe = pd.DataFrame(js_data.to_py())
    p_user_col = str(js_user_col)
    p_item_col = str(js_item_col)
    p_rating_col = str(js_rating_col)
    p_n_components = int(js_n_components)
    p_top_n = int(js_top_n)

    if p_user_col not in dataframe.columns or p_item_col not in dataframe.columns or p_rating_col not in dataframe.columns:
        raise ValueError("user_col / item_col / rating_col must all exist in the data.")

    # 1) (user, item) 중복 평점을 평균으로 합치고 user x item 행렬로 피벗
    agg = dataframe.groupby([p_user_col, p_item_col], as_index=False)[p_rating_col].mean()
    matrix = agg.pivot(index=p_user_col, columns=p_item_col, values=p_rating_col)
    matrix = matrix.sort_index(axis=0).sort_index(axis=1)

    users = list(matrix.index)
    items = list(matrix.columns)
    R = matrix.to_numpy(dtype=float)
    rated_mask = ~np.isnan(R)
    R_filled = np.nan_to_num(R, nan=0.0)

    # 2) NMF 행렬분해 (init='nndsvda' + random_state=42 => 완전 결정적)
    n_comp = max(1, min(p_n_components, min(R_filled.shape)))
    model = NMF(n_components=n_comp, init='nndsvda', random_state=42, max_iter=500)
    W = model.fit_transform(R_filled)
    H = model.components_
    R_hat = W @ H

    # 3) 사용자별 미평가 아이템 중 예측 평점 상위 Top-N
    recs = []
    for ui, u in enumerate(users):
        scores = R_hat[ui].copy()
        scores[rated_mask[ui]] = -np.inf
        order = sorted(range(len(items)), key=lambda j: (-scores[j], j))
        rank = 0
        for j in order:
            if not np.isfinite(scores[j]):
                continue
            rank += 1
            recs.append({
                p_user_col: u,
                'rank': rank,
                p_item_col: items[j],
                'predicted_rating': round(float(R_hat[ui, j]), 4),
            })
            if rank >= p_top_n:
                break

    recommendations = pd.DataFrame(recs, columns=[p_user_col, 'rank', p_item_col, 'predicted_rating'])
    recommendations = recommendations.sort_values([p_user_col, 'rank']).reset_index(drop=True)

    result_rows = recommendations.to_dict('records')
    result_columns = [{'name': col, 'type': str(recommendations[col].dtype)} for col in recommendations.columns]
    js_result = {'rows': result_rows, 'columns': result_columns}
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Recommender 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Recommender error: Python code returned None or undefined.`
      );
    }

    const result = fromPython(resultPyObj);

    if (result && result.__error__) {
      throw new Error(
        `Python Recommender error:\n${
          result.error_traceback || result.error_message
        }`
      );
    }

    if (!result.rows || !result.columns) {
      throw new Error(
        `Python Recommender error: Missing rows or columns in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_user_col");
    py.globals.delete("js_item_col");
    py.globals.delete("js_rating_col");
    py.globals.delete("js_n_components");
    py.globals.delete("js_top_n");
    py.globals.delete("js_result");

    return {
      rows: result.rows,
      columns: result.columns,
    };
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_user_col");
        py.globals.delete("js_item_col");
        py.globals.delete("js_rating_col");
        py.globals.delete("js_n_components");
        py.globals.delete("js_top_n");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Recommender error: ${errorMessage}`);
  }
}

/**
 * Join을 Python으로 실행합니다 (데이터 조인)
 * 타임아웃: 60초
 */
export async function joinDataPython(
  data1: any[],
  data2: any[],
  joinType: string,
  leftOn: string | null,
  rightOn: string | null,
  on: string | null,
  how: string,
  suffixes: [string, string],
  timeoutMs: number = 60000
): Promise<{
  rows: any[];
  columns: Array<{ name: string; type: string }>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data1", data1);
    py.globals.set("js_data2", data2);
    py.globals.set("js_how", how || joinType || "inner");
    py.globals.set("js_suffixes", suffixes || ["_x", "_y"]);

    let joinKeysCode = "";
    if (on) {
      py.globals.set("js_on", on);
      joinKeysCode = `on=js_on`;
    } else if (leftOn && rightOn) {
      py.globals.set("js_left_on", leftOn);
      py.globals.set("js_right_on", rightOn);
      joinKeysCode = `left_on=js_left_on, right_on=js_right_on`;
    } else {
      throw new Error("조인 키를 설정해야 합니다 (on 또는 left_on/right_on)");
    }

    const code = `
import pandas as pd
import traceback

try:
    df1 = pd.DataFrame(js_data1.to_py())
    df2 = pd.DataFrame(js_data2.to_py())
    
    result = pd.merge(
        df1,
        df2,
        ${joinKeysCode},
        how=js_how,
        suffixes=tuple(js_suffixes.to_py())
    )
    
    result_rows = result.to_dict('records')
    result_columns = [{'name': col, 'type': str(result[col].dtype)} for col in result.columns]
    
    js_result = {
        'rows': result_rows,
        'columns': result_columns
    }
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      `Python join_data 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const resultPyObj = py.globals.get("js_result");
    const result = fromPython(resultPyObj);

    if (result && result.__error__) {
      throw new Error(
        `Python join_data error:\n${
          result.error_traceback || result.error_message
        }`
      );
    }

    // 정리
    py.globals.delete("js_data1");
    py.globals.delete("js_data2");
    py.globals.delete("js_how");
    py.globals.delete("js_suffixes");
    if (on) {
      py.globals.delete("js_on");
    } else {
      py.globals.delete("js_left_on");
      py.globals.delete("js_right_on");
    }
    py.globals.delete("js_result");

    return {
      rows: result.rows,
      columns: result.columns,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data1");
        py.globals.delete("js_data2");
        py.globals.delete("js_how");
        py.globals.delete("js_suffixes");
        if (on) {
          py.globals.delete("js_on");
        } else {
          py.globals.delete("js_left_on");
          py.globals.delete("js_right_on");
        }
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python join_data error: ${errorMessage}`);
  }
}

/**
 * Concat을 Python으로 실행합니다 (데이터 연결)
 * 타임아웃: 60초
 */
export async function concatDataPython(
  data1: any[],
  data2: any[],
  axis: string,
  ignoreIndex: boolean,
  sort: boolean,
  timeoutMs: number = 60000
): Promise<{
  rows: any[];
  columns: Array<{ name: string; type: string }>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data1", data1);
    py.globals.set("js_data2", data2);
    py.globals.set("js_axis", axis === "horizontal" ? 1 : 0);
    py.globals.set("js_ignore_index", ignoreIndex);
    py.globals.set("js_sort", sort);

    const code = `
import pandas as pd
import traceback

try:
    df1 = pd.DataFrame(js_data1.to_py())
    df2 = pd.DataFrame(js_data2.to_py())
    
    result = pd.concat(
        [df1, df2],
        axis=js_axis,
        ignore_index=js_ignore_index,
        sort=js_sort
    )
    
    result_rows = result.to_dict('records')
    result_columns = [{'name': col, 'type': str(result[col].dtype)} for col in result.columns]
    
    js_result = {
        'rows': result_rows,
        'columns': result_columns
    }
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      `Python concat_data 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const resultPyObj = py.globals.get("js_result");
    const result = fromPython(resultPyObj);

    if (result && result.__error__) {
      throw new Error(
        `Python concat_data error:\n${
          result.error_traceback || result.error_message
        }`
      );
    }

    // 정리
    py.globals.delete("js_data1");
    py.globals.delete("js_data2");
    py.globals.delete("js_axis");
    py.globals.delete("js_ignore_index");
    py.globals.delete("js_sort");
    py.globals.delete("js_result");

    return {
      rows: result.rows,
      columns: result.columns,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data1");
        py.globals.delete("js_data2");
        py.globals.delete("js_axis");
        py.globals.delete("js_ignore_index");
        py.globals.delete("js_sort");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python concat_data error: ${errorMessage}`);
  }
}

/**
 * EncodeCategorical를 Python으로 실행합니다 (인코딩 매핑 생성)
 * 타임아웃: 60초
 */
export async function encodeCategoricalPython(
  data: any[],
  method: string,
  columns: string[] | null,
  ordinal_mapping: Record<string, string[]> | null,
  drop: string,
  handle_unknown: string,
  timeoutMs: number = 60000,
  data2?: any[] | null
): Promise<{
  rows: any[];
  columns: Array<{ name: string; type: string }>;
  rows2?: any[];
  columns2?: Array<{ name: string; type: string }>;
}> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_data2", data2 || null);
    py.globals.set("js_method", method);
    py.globals.set("js_columns", columns);
    py.globals.set("js_ordinal_mapping", ordinal_mapping);
    py.globals.set("js_drop", drop);
    py.globals.set("js_handle_unknown", handle_unknown);

    const code = `
import pandas as pd
from sklearn.preprocessing import LabelEncoder

df = pd.DataFrame(js_data.to_py())
df2 = pd.DataFrame(js_data2.to_py()) if js_data2 else None
method = str(js_method)
columns = js_columns.to_py() if js_columns else None
ordinal_mapping = js_ordinal_mapping.to_py() if js_ordinal_mapping else None
drop = str(js_drop)
handle_unknown = str(js_handle_unknown)

if columns is None:
    columns = df.select_dtypes(include=['object', 'category']).columns.tolist()

df_result = df.copy()

# fit 단계: 첫 번째 데이터로 매핑 생성
encoders = {}
one_hot_columns = {}
ordinal_mappings = {}

if method == 'label':
    for col in columns:
        if col not in df_result.columns:
            continue
        le = LabelEncoder()
        df_result[col] = le.fit_transform(df_result[col].astype(str))
        encoders[col] = le
        print(f"컬럼 '{col}'에 Label Encoding 적용")
elif method == 'one_hot':
    for col in columns:
        if col not in df_result.columns:
            continue
        dummies = pd.get_dummies(df_result[col], prefix=col, drop_first=(drop == 'first'))
        df_result = pd.concat([df_result.drop(col, axis=1), dummies], axis=1)
        one_hot_columns[col] = dummies.columns.tolist()
        print(f"컬럼 '{col}'에 One-Hot Encoding 적용")
elif method == 'ordinal':
    for col in columns:
        if col not in df_result.columns:
            continue
        if ordinal_mapping and col in ordinal_mapping:
            mapping = {val: idx for idx, val in enumerate(ordinal_mapping[col])}
            df_result[col] = df_result[col].map(mapping)
            if handle_unknown == 'ignore':
                df_result[col].fillna(-1, inplace=True)
            ordinal_mappings[col] = mapping
        else:
            # 알파벳 순서로 매핑
            unique_vals = sorted(df_result[col].unique())
            mapping = {val: idx for idx, val in enumerate(unique_vals)}
            df_result[col] = df_result[col].map(mapping)
            ordinal_mappings[col] = mapping
        print(f"컬럼 '{col}'에 Ordinal Encoding 적용")

# transform 단계: 두 번째 데이터에 fit된 매핑 적용
df2_result = None
if df2 is not None:
    df2_result = df2.copy()
    
    if method == 'label':
        for col in columns:
            if col not in df2_result.columns or col not in encoders:
                continue
            le = encoders[col]
            # 알려진 값만 transform, 알 수 없는 값은 -1로 처리
            known_mask = df2_result[col].astype(str).isin(le.classes_)
            df2_result.loc[known_mask, col] = le.transform(df2_result.loc[known_mask, col].astype(str))
            if handle_unknown == 'ignore':
                df2_result.loc[~known_mask, col] = -1
            print(f"두 번째 데이터 컬럼 '{col}'에 Label Encoding transform 적용")
    elif method == 'one_hot':
        for col in columns:
            if col not in df2_result.columns or col not in one_hot_columns:
                continue
            # 첫 번째 데이터에서 생성된 더미 컬럼 목록 사용
            expected_columns = one_hot_columns[col]
            dummies = pd.get_dummies(df2_result[col], prefix=col, drop_first=(drop == 'first'))
            # 첫 번째 데이터에 있던 컬럼만 유지하고, 없는 컬럼은 0으로 채움
            for expected_col in expected_columns:
                if expected_col not in dummies.columns:
                    dummies[expected_col] = 0
            # 첫 번째 데이터에 있던 컬럼만 선택
            dummies = dummies[expected_columns]
            df2_result = pd.concat([df2_result.drop(col, axis=1), dummies], axis=1)
            print(f"두 번째 데이터 컬럼 '{col}'에 One-Hot Encoding transform 적용")
    elif method == 'ordinal':
        for col in columns:
            if col not in df2_result.columns or col not in ordinal_mappings:
                continue
            mapping = ordinal_mappings[col]
            df2_result[col] = df2_result[col].map(mapping)
            if handle_unknown == 'ignore':
                df2_result[col].fillna(-1, inplace=True)
            print(f"두 번째 데이터 컬럼 '{col}'에 Ordinal Encoding transform 적용")

result_rows = df_result.to_dict('records')
result_columns = [{'name': col, 'type': str(df_result[col].dtype)} for col in df_result.columns]

result = {
    'rows': result_rows,
    'columns': result_columns
}

if df2_result is not None:
    result_rows2 = df2_result.to_dict('records')
    result_columns2 = [{'name': col, 'type': str(df2_result[col].dtype)} for col in df2_result.columns]
    result['rows2'] = result_rows2
    result['columns2'] = result_columns2

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python EncodeCategorical 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_data2");
    py.globals.delete("js_method");
    py.globals.delete("js_columns");
    py.globals.delete("js_ordinal_mapping");
    py.globals.delete("js_drop");
    py.globals.delete("js_handle_unknown");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_data2");
        py.globals.delete("js_method");
        py.globals.delete("js_columns");
        py.globals.delete("js_ordinal_mapping");
        py.globals.delete("js_drop");
        py.globals.delete("js_handle_unknown");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python EncodeCategorical error: ${errorMessage}`);
  }
}

/**
 * ResampleData를 Python으로 실행합니다 (리샘플링)
 * 타임아웃: 60초
 */
export async function resampleDataPython(
  data: any[],
  method: string,
  target_column: string,
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_method", method);
    py.globals.set("js_target_column", target_column);

    const code = `
import pandas as pd
import numpy as np
from imblearn.over_sampling import SMOTE
from imblearn.under_sampling import NearMiss

df = pd.DataFrame(js_data.to_py())
method = str(js_method)
target_column = str(js_target_column)

if target_column not in df.columns:
    raise ValueError(f"Target column '{target_column}' not found in dataframe")

X = df.drop(columns=[target_column])
y = df[target_column]

if method == 'SMOTE':
    smote = SMOTE(random_state=42)
    X_resampled, y_resampled = smote.fit_resample(X, y)
elif method == 'NearMiss':
    near_miss = NearMiss(version=1)
    X_resampled, y_resampled = near_miss.fit_resample(X, y)
else:
    raise ValueError(f"Unknown resampling method: {method}")

df_resampled = pd.DataFrame(X_resampled, columns=X.columns)
df_resampled[target_column] = y_resampled

result_rows = df_resampled.to_dict('records')
result_columns = [{'name': col, 'type': str(df_resampled[col].dtype)} for col in df_resampled.columns]

result = {
    'rows': result_rows,
    'columns': result_columns
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python ResampleData 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_method");
    py.globals.delete("js_target_column");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_method");
        py.globals.delete("js_target_column");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python ResampleData error: ${errorMessage}`);
  }
}

/**
 * TransformData를 Python으로 실행합니다 (변환 적용)
 * 타임아웃: 60초
 */
export async function applyTransformPython(
  data: any[],
  handler: any,
  exclude_columns: string[],
  timeoutMs: number = 60000
): Promise<{ rows: any[]; columns: Array<{ name: string; type: string }> }> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_handler", handler);
    py.globals.set("js_exclude_columns", exclude_columns);

    const code = `
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler, RobustScaler
from sklearn.preprocessing import LabelEncoder

df = pd.DataFrame(js_data.to_py())
handler = js_handler.to_py()
exclude_columns = js_exclude_columns.to_py() if js_exclude_columns else []

# Statistics 모듈과 동일한 방식으로 빈 문자열을 null로 카운트
# 빈 문자열을 NaN으로 변환하여 결측치로 처리하되, Statistics 모듈과 동일한 방식으로 카운트
for col in df.columns:
    # 모든 컬럼에 대해 빈 문자열을 먼저 확인하고 NaN으로 변환
    # 숫자형 컬럼의 경우 빈 문자열이 문자열로 저장되어 있을 수 있음
    col_str = df[col].astype(str)
    empty_mask = (col_str.str.strip() == '') | (col_str == 'nan') | (col_str == 'NaN') | (col_str == 'None')
    
    if df[col].dtype == 'object':
        # 문자열 컬럼의 경우 빈 문자열을 NaN으로 변환
        df[col] = df[col].replace('', np.nan)
        df.loc[empty_mask, col] = np.nan
    else:
        # 숫자형 컬럼의 경우 빈 문자열을 NaN으로 변환
        # 빈 문자열이 문자열로 저장된 경우를 처리
        df.loc[empty_mask, col] = np.nan
        # 숫자로 변환할 수 없는 값들을 NaN으로 변환
        df[col] = pd.to_numeric(df[col], errors='coerce')

df_result = df.copy()

if handler.get('type') == 'MissingHandlerOutput':
    method = handler.get('method')
    imputation_values = handler.get('imputation_values', {})
    
    if method == 'remove_row':
        df_result = df_result.dropna()
    elif method == 'impute' or method == 'knn':
        for col_name, fill_value in imputation_values.items():
            if col_name in exclude_columns:
                continue
            if col_name in df_result.columns:
                df_result[col_name].fillna(fill_value, inplace=True)

elif handler.get('type') == 'NormalizerOutput':
    method = handler.get('method')
    stats = handler.get('stats', {})
    
    for col_name, col_stats in stats.items():
        if col_name in exclude_columns or col_name not in df_result.columns:
            continue
        
        if df_result[col_name].dtype not in ['int64', 'float64']:
            continue
        
        values = df_result[col_name].values
        
        if method == 'MinMax' and 'min' in col_stats and 'max' in col_stats:
            min_val = col_stats['min']
            max_val = col_stats['max']
            range_val = max_val - min_val
            if range_val > 0:
                df_result[col_name] = (values - min_val) / range_val
            else:
                df_result[col_name] = 0.5
        elif method == 'StandardScaler' and 'mean' in col_stats and 'stdDev' in col_stats:
            mean_val = col_stats['mean']
            std_val = col_stats['stdDev']
            if std_val > 0:
                df_result[col_name] = (values - mean_val) / std_val
            else:
                df_result[col_name] = 0.0
        elif method == 'RobustScaler' and 'median' in col_stats and 'iqr' in col_stats:
            median_val = col_stats['median']
            iqr_val = col_stats['iqr']
            if iqr_val > 0:
                df_result[col_name] = (values - median_val) / iqr_val
            else:
                df_result[col_name] = 0.0

elif handler.get('type') == 'EncoderOutput':
    method = handler.get('method')
    mappings = handler.get('mappings', {})
    drop = handler.get('drop', 'first')
    
    if method == 'label' or method == 'ordinal':
        for col_name, mapping in mappings.items():
            if col_name in exclude_columns or col_name not in df_result.columns:
                continue
            df_result[col_name] = df_result[col_name].map(mapping)
            df_result[col_name] = df_result[col_name].astype('float64')
    elif method == 'one_hot':
        for col_name, unique_values in mappings.items():
            if col_name in exclude_columns or col_name not in df_result.columns:
                continue
            
            values_to_create = list(unique_values)
            if drop == 'first' and len(values_to_create) > 0:
                values_to_create = values_to_create[1:]
            elif drop == 'if_binary' and len(values_to_create) == 2:
                values_to_create = values_to_create[1:]
            
            for value in values_to_create:
                new_col_name = f"{col_name}_{value}"
                df_result[new_col_name] = (df_result[col_name] == value).astype(int)
            
            df_result = df_result.drop(columns=[col_name])

result_rows = df_result.to_dict('records')
result_columns = [{'name': col, 'type': str(df_result[col].dtype)} for col in df_result.columns]

result = {
    'rows': result_rows,
    'columns': result_columns
}

result
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python TransformData 실행 타임아웃 (60초 초과)"
    );

    const result = fromPython(resultPyObj);

    py.globals.delete("js_data");
    py.globals.delete("js_handler");
    py.globals.delete("js_exclude_columns");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_handler");
        py.globals.delete("js_exclude_columns");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python TransformData error: ${errorMessage}`);
  }
}

/**
 * Diversion Checker (과대산포 검사)를 실행합니다
 */
export async function dispersionCheckerPython(
  rows: Record<string, any>[],
  featureColumns: string[],
  labelColumn: string,
  maxIter: number = 100,
  timeoutMs: number = 120000
): Promise<{
  phi: number;
  recommendation: "Poisson" | "QuasiPoisson" | "NegativeBinomial";
  poissonAic: number | null;
  negativeBinomialAic: number | null;
  aicComparison: string | null;
  cameronTrivediCoef: number;
  cameronTrivediPvalue: number;
  cameronTrivediConclusion: string;
  methodsUsed: string[];
  results: {
    phi: number;
    phi_interpretation: string;
    recommendation: string;
    poisson_aic: number | null;
    negative_binomial_aic: number | null;
    cameron_trivedi_coef: number;
    cameron_trivedi_pvalue: number;
    cameron_trivedi_conclusion: string;
  };
}> {
  try {
    const py = await loadPyodide(30000);

    await withTimeout(
      py.loadPackage(["statsmodels", "pandas", "numpy"]),
      60000,
      "statsmodels 패키지 설치 타임아웃 (60초 초과)"
    );

    // data_analysis_modules.py 파일을 로드
    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_rows", rows);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_max_iter", maxIter);

    const code = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm
import traceback
import sys

try:
    # JavaScript에서 전달된 데이터를 DataFrame으로 변환
    rows = js_rows.to_py()
    feature_columns = js_feature_columns.to_py()
    label_column = str(js_label_column)
    max_iter = int(js_max_iter)
    
    if not rows or len(rows) == 0:
        raise ValueError("입력 데이터가 비어있습니다.")
    
    df = pd.DataFrame(rows)
    
    # NaN 값 처리 (0으로 대체)
    df = df.fillna(0)
    
    # dispersion_checker 함수 호출
    result = dispersion_checker(df, feature_columns, label_column, max_iter)
    
    # 결과를 JavaScript로 전달할 형식으로 변환
    js_result = {
        'phi': float(result['phi']),
        'recommendation': str(result['recommendation']),
        'poisson_aic': float(result['poisson_aic']) if result['poisson_aic'] is not None else None,
        'negative_binomial_aic': float(result['negative_binomial_aic']) if result['negative_binomial_aic'] is not None else None,
        'aic_comparison': str(result['aic_comparison']) if result['aic_comparison'] is not None else None,
        'cameron_trivedi_coef': float(result['cameron_trivedi_coef']),
        'cameron_trivedi_pvalue': float(result['cameron_trivedi_pvalue']),
        'cameron_trivedi_conclusion': str(result['cameron_trivedi_conclusion']),
        'methods_used': result['methods_used'],
        'results': result['results']
    }
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      `Diversion Checker 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error("Python 코드가 결과를 반환하지 않았습니다.");
    }

    const result = fromPython(resultPyObj);

    if (result.__error__) {
      throw new Error(
        `Python Diversion Checker error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    if (!result.phi || !result.recommendation) {
      throw new Error(
        "Python Diversion Checker error: Invalid result structure"
      );
    }

    py.globals.delete("js_rows");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_max_iter");
    py.globals.delete("js_result");

    return {
      phi: result.phi,
      recommendation: result.recommendation as
        | "Poisson"
        | "QuasiPoisson"
        | "NegativeBinomial",
      poissonAic: result.poisson_aic,
      negativeBinomialAic: result.negative_binomial_aic,
      aicComparison: result.aic_comparison,
      cameronTrivediCoef: result.cameron_trivedi_coef,
      cameronTrivediPvalue: result.cameron_trivedi_pvalue,
      cameronTrivediConclusion: result.cameron_trivedi_conclusion,
      methodsUsed: result.methods_used,
      results: result.results,
    };
  } catch (error: any) {
    try {
      if (pyodide) {
        pyodide.globals.delete("js_rows");
        pyodide.globals.delete("js_feature_columns");
        pyodide.globals.delete("js_label_column");
        pyodide.globals.delete("js_max_iter");
        pyodide.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Diversion Checker error:\n${errorMessage}`);
  }
}

/**
 * Decision Tree 모델의 plot_tree를 생성하여 base64 이미지로 반환합니다
 * 타임아웃: 60초
 */
export async function generateDecisionTreePlot(
  trainingData: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  criterion: string,
  maxDepth: number | null,
  minSamplesSplit: number,
  minSamplesLeaf: number,
  classWeight: string | null,
  timeoutMs: number = 60000
): Promise<string> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // matplotlib 패키지 설치
    await withTimeout(
      py.loadPackage(["matplotlib"]),
      60000,
      "matplotlib 패키지 설치 타임아웃 (60초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_criterion", criterion);
    py.globals.set("js_max_depth", maxDepth);
    py.globals.set("js_min_samples_split", minSamplesSplit);
    py.globals.set("js_min_samples_leaf", minSamplesLeaf);
    py.globals.set("js_class_weight", classWeight);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
import base64
import io
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor, plot_tree
import matplotlib
matplotlib.use('Agg')  # GUI 백엔드 사용 안 함
import matplotlib.pyplot as plt

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_training_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    p_model_purpose = str(js_model_purpose)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    # 모델 파라미터
    p_criterion = str(js_criterion)
    p_max_depth = js_max_depth if js_max_depth is not None else None
    p_min_samples_split = int(js_min_samples_split)
    p_min_samples_leaf = int(js_min_samples_leaf)
    p_class_weight = str(js_class_weight) if js_class_weight is not None else None
    
    # 모델 생성 및 훈련
    if p_model_purpose == 'classification':
        model = DecisionTreeClassifier(
            criterion=p_criterion.lower(),
            max_depth=p_max_depth,
            min_samples_split=p_min_samples_split,
            min_samples_leaf=p_min_samples_leaf,
            class_weight=p_class_weight,
            random_state=42
        )
        # class_names 생성 (이진 분류인 경우)
        unique_labels = np.unique(y_train)
        if len(unique_labels) == 2:
            class_names = [str(int(unique_labels[0])), str(int(unique_labels[1]))]
        else:
            class_names = [str(int(label)) for label in unique_labels]
    else:
        criterion_reg = 'squared_error' if p_criterion == 'mse' else 'absolute_error'
        model = DecisionTreeRegressor(
            criterion=criterion_reg,
            max_depth=p_max_depth,
            min_samples_split=p_min_samples_split,
            min_samples_leaf=p_min_samples_leaf,
            random_state=42
        )
        class_names = None
    
    # 모델 훈련
    model.fit(X_train, y_train)
    
    # plot_tree 생성
    plt.figure(figsize=(10, 8))
    if p_model_purpose == 'classification' and class_names:
        plot_tree(model, feature_names=list(X_train.columns), class_names=class_names, filled=True, fontsize=10)
    else:
        plot_tree(model, feature_names=list(X_train.columns), filled=True, fontsize=10)
    
    # 이미지를 base64로 변환
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    result = {
        'image_base64': image_base64
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Decision Tree Plot 생성 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python Decision Tree Plot error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result && result.__error__) {
      throw new Error(
        `Python Decision Tree Plot error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result || !result.image_base64) {
      throw new Error(
        `Python Decision Tree Plot error: Missing or invalid 'image_base64' in result.`
      );
    }

    // 정리
    py.globals.delete("js_training_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_criterion");
    py.globals.delete("js_max_depth");
    py.globals.delete("js_min_samples_split");
    py.globals.delete("js_min_samples_leaf");
    py.globals.delete("js_class_weight");
    py.globals.delete("js_result");

    return result.image_base64;
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_training_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_criterion");
        py.globals.delete("js_max_depth");
        py.globals.delete("js_min_samples_split");
        py.globals.delete("js_min_samples_leaf");
        py.globals.delete("js_class_weight");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Decision Tree Plot error: ${errorMessage}`);
  }
}

/**
 * Decision Tree 모델의 export_text를 생성하여 텍스트로 반환합니다
 * 타임아웃: 60초
 */
export async function generateDecisionTreeText(
  trainingData: any[],
  featureColumns: string[],
  labelColumn: string,
  modelPurpose: "classification" | "regression",
  criterion: string,
  maxDepth: number | null,
  minSamplesSplit: number,
  minSamplesLeaf: number,
  classWeight: string | null,
  timeoutMs: number = 60000
): Promise<string> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_training_data", trainingData);
    py.globals.set("js_feature_columns", featureColumns);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_model_purpose", modelPurpose);
    py.globals.set("js_criterion", criterion);
    py.globals.set("js_max_depth", maxDepth);
    py.globals.set("js_min_samples_split", minSamplesSplit);
    py.globals.set("js_min_samples_leaf", minSamplesLeaf);
    py.globals.set("js_class_weight", classWeight);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor, export_text

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_training_data.to_py())
    p_feature_columns = js_feature_columns.to_py()
    p_label_column = str(js_label_column)
    p_model_purpose = str(js_model_purpose)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if len(p_feature_columns) == 0:
        raise ValueError("No feature columns specified")
    if p_label_column not in dataframe.columns:
        raise ValueError(f"Label column '{p_label_column}' not found in DataFrame")
    
    X_train = dataframe[p_feature_columns]
    y_train = dataframe[p_label_column]
    
    # 모델 파라미터
    p_criterion = str(js_criterion)
    p_max_depth = js_max_depth if js_max_depth is not None else None
    p_min_samples_split = int(js_min_samples_split)
    p_min_samples_leaf = int(js_min_samples_leaf)
    p_class_weight = str(js_class_weight) if js_class_weight is not None else None
    
    # 모델 생성 및 훈련
    if p_model_purpose == 'classification':
        model = DecisionTreeClassifier(
            criterion=p_criterion.lower(),
            max_depth=p_max_depth,
            min_samples_split=p_min_samples_split,
            min_samples_leaf=p_min_samples_leaf,
            class_weight=p_class_weight,
            random_state=42
        )
    else:
        criterion_reg = 'squared_error' if p_criterion == 'mse' else 'absolute_error'
        model = DecisionTreeRegressor(
            criterion=criterion_reg,
            max_depth=p_max_depth,
            min_samples_split=p_min_samples_split,
            min_samples_leaf=p_min_samples_leaf,
            random_state=42
        )
    
    # 모델 훈련
    model.fit(X_train, y_train)
    
    # export_text 생성
    tree_text = export_text(model, feature_names=list(X_train.columns))
    
    # 결과 검증
    if tree_text is None:
        raise ValueError("export_text returned None")
    
    tree_text_str = str(tree_text)
    if len(tree_text_str) == 0:
        raise ValueError("export_text returned empty string")
    
    result = {
        'tree_text': tree_text_str
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Decision Tree Text 생성 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python Decision Tree Text error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 디버깅: 결과 확인
    console.log("Decision Tree Text result:", result);

    // 에러가 발생한 경우 처리
    if (result && result.__error__) {
      const errorMsg =
        result.error_traceback || result.error_message || "Unknown error";
      console.error("Decision Tree Text Python error:", errorMsg);
      throw new Error(`Python Decision Tree Text error:\n${errorMsg}`);
    }

    // 필수 속성 검증
    if (!result || !result.tree_text || typeof result.tree_text !== "string") {
      console.error("Decision Tree Text invalid result:", result);
      throw new Error(
        `Python Decision Tree Text error: Missing or invalid 'tree_text' in result. Result: ${JSON.stringify(
          result
        )}`
      );
    }

    // 정리
    py.globals.delete("js_training_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_label_column");
    py.globals.delete("js_model_purpose");
    py.globals.delete("js_criterion");
    py.globals.delete("js_max_depth");
    py.globals.delete("js_min_samples_split");
    py.globals.delete("js_min_samples_leaf");
    py.globals.delete("js_class_weight");
    py.globals.delete("js_result");

    return result.tree_text;
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_training_data");
        py.globals.delete("js_feature_columns");
        py.globals.delete("js_label_column");
        py.globals.delete("js_model_purpose");
        py.globals.delete("js_criterion");
        py.globals.delete("js_max_depth");
        py.globals.delete("js_min_samples_split");
        py.globals.delete("js_min_samples_leaf");
        py.globals.delete("js_class_weight");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Decision Tree Text error:\n${errorMessage}`);
  }
}

/**
 * 이상치 탐지를 수행합니다 (IQR, Z-score, Isolation Forest, Boxplot)
 * 타임아웃: 120초
 */
export async function detectOutliers(
  data: any[],
  column: string,
  methods: ("IQR" | "ZScore" | "IsolationForest" | "Boxplot")[] = [
    "IQR",
    "ZScore",
    "IsolationForest",
    "Boxplot",
  ],
  iqrMultiplier: number = 1.5,
  zScoreThreshold: number = 3,
  isolationForestContamination: number = 0.1,
  timeoutMs: number = 120000
): Promise<{
  results: Array<{
    method: "IQR" | "ZScore" | "IsolationForest" | "Boxplot";
    outlierIndices: number[];
    outlierCount: number;
    outlierPercentage: number;
    details?: Record<string, any>;
  }>;
  totalOutliers: number;
  outlierIndices: number[];
}> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // 필요한 패키지 설치
    await withTimeout(
      py.loadPackage(["scikit-learn"]),
      60000,
      "scikit-learn 패키지 설치 타임아웃 (60초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_column", column);
    py.globals.set("js_methods", methods);
    py.globals.set("js_iqr_multiplier", iqrMultiplier);
    py.globals.set("js_zscore_threshold", zScoreThreshold);
    py.globals.set("js_contamination", isolationForestContamination);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from sklearn.ensemble import IsolationForest

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_data.to_py())
    column_name = str(js_column)
    methods = js_methods.to_py()
    iqr_multiplier = float(js_iqr_multiplier)
    zscore_threshold = float(js_zscore_threshold)
    contamination = float(js_contamination)
    
    # 데이터 검증
    if dataframe.empty:
        raise ValueError("DataFrame is empty")
    if column_name not in dataframe.columns:
        raise ValueError(f"Column '{column_name}' not found in DataFrame")
    
    # 숫자형 컬럼인지 확인
    if not pd.api.types.is_numeric_dtype(dataframe[column_name]):
        raise ValueError(f"Column '{column_name}' is not numeric")
    
    values = dataframe[column_name].dropna().values
    if len(values) == 0:
        raise ValueError(f"Column '{column_name}' has no valid values")
    
    results = []
    all_outlier_indices = set()
    
    # IQR 기반 탐지
    if 'IQR' in methods:
        Q1 = np.percentile(values, 25)
        Q3 = np.percentile(values, 75)
        IQR = Q3 - Q1
        lower_bound = Q1 - iqr_multiplier * IQR
        upper_bound = Q3 + iqr_multiplier * IQR
        
        iqr_outliers = []
        for idx, val in enumerate(values):
            if val < lower_bound or val > upper_bound:
                iqr_outliers.append(idx)
                all_outlier_indices.add(idx)
        
        results.append({
            'method': 'IQR',
            'outlier_indices': iqr_outliers,
            'outlier_count': len(iqr_outliers),
            'outlier_percentage': len(iqr_outliers) / len(values) * 100,
            'details': {
                'Q1': float(Q1),
                'Q3': float(Q3),
                'IQR': float(IQR),
                'lower_bound': float(lower_bound),
                'upper_bound': float(upper_bound)
            }
        })
    
    # Z-score 기반 탐지
    if 'ZScore' in methods:
        mean = np.mean(values)
        std = np.std(values)
        
        if std > 0:
            z_scores = np.abs((values - mean) / std)
            zscore_outliers = []
            for idx, z_score in enumerate(z_scores):
                if z_score > zscore_threshold:
                    zscore_outliers.append(idx)
                    all_outlier_indices.add(idx)
            
            results.append({
                'method': 'ZScore',
                'outlier_indices': zscore_outliers,
                'outlier_count': len(zscore_outliers),
                'outlier_percentage': len(zscore_outliers) / len(values) * 100,
                'details': {
                    'mean': float(mean),
                    'std': float(std),
                    'threshold': zscore_threshold
                }
            })
        else:
            results.append({
                'method': 'ZScore',
                'outlier_indices': [],
                'outlier_count': 0,
                'outlier_percentage': 0.0,
                'details': {
                    'mean': float(mean),
                    'std': float(std),
                    'threshold': zscore_threshold,
                    'error': 'Standard deviation is zero'
                }
            })
    
    # Isolation Forest 기반 탐지
    if 'IsolationForest' in methods:
        try:
            # 2D 배열로 변환
            X = values.reshape(-1, 1)
            
            # Isolation Forest 모델 생성 및 학습
            iso_forest = IsolationForest(contamination=contamination, random_state=42)
            predictions = iso_forest.fit_predict(X)
            
            # -1이 이상치
            iso_outliers = []
            for idx, pred in enumerate(predictions):
                if pred == -1:
                    iso_outliers.append(idx)
                    all_outlier_indices.add(idx)
            
            results.append({
                'method': 'IsolationForest',
                'outlier_indices': iso_outliers,
                'outlier_count': len(iso_outliers),
                'outlier_percentage': len(iso_outliers) / len(values) * 100,
                'details': {
                    'contamination': contamination,
                    'n_estimators': 100
                }
            })
        except Exception as e:
            results.append({
                'method': 'IsolationForest',
                'outlier_indices': [],
                'outlier_count': 0,
                'outlier_percentage': 0.0,
                'details': {
                    'error': str(e)
                }
            })
    
    # Boxplot 기반 탐지 (IQR와 유사하지만 시각화 기준)
    if 'Boxplot' in methods:
        Q1 = np.percentile(values, 25)
        Q3 = np.percentile(values, 75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        boxplot_outliers = []
        for idx, val in enumerate(values):
            if val < lower_bound or val > upper_bound:
                boxplot_outliers.append(idx)
                all_outlier_indices.add(idx)
        
        results.append({
            'method': 'Boxplot',
            'outlier_indices': boxplot_outliers,
            'outlier_count': len(boxplot_outliers),
            'outlier_percentage': len(boxplot_outliers) / len(values) * 100,
            'details': {
                'Q1': float(Q1),
                'Q3': float(Q3),
                'IQR': float(IQR),
                'lower_bound': float(lower_bound),
                'upper_bound': float(upper_bound)
            }
        })
    
    # 결과 반환
    result = {
        'results': results,
        'total_outliers': len(all_outlier_indices),
        'outlier_indices': sorted(list(all_outlier_indices))
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Outlier Detection 타임아웃 (120초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python Outlier Detection error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result && result.__error__) {
      const errorMsg =
        result.error_traceback || result.error_message || "Unknown error";
      console.error("Outlier Detection Python error:", errorMsg);
      throw new Error(`Python Outlier Detection error:\n${errorMsg}`);
    }

    // 필수 속성 검증
    if (!result.results || !Array.isArray(result.results)) {
      console.error("Outlier Detection invalid result:", result);
      throw new Error(
        `Python Outlier Detection error: Missing or invalid 'results' in result. Result: ${JSON.stringify(
          result
        )}`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_column");
    py.globals.delete("js_methods");
    py.globals.delete("js_iqr_multiplier");
    py.globals.delete("js_zscore_threshold");
    py.globals.delete("js_contamination");
    py.globals.delete("js_result");

    return {
      results: result.results.map((r: any) => ({
        method: r.method,
        outlierIndices: r.outlier_indices,
        outlierCount: r.outlier_count,
        outlierPercentage: r.outlier_percentage,
        details: r.details,
      })),
      totalOutliers: result.total_outliers,
      outlierIndices: result.outlier_indices,
    };
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_column");
        py.globals.delete("js_methods");
        py.globals.delete("js_iqr_multiplier");
        py.globals.delete("js_zscore_threshold");
        py.globals.delete("js_contamination");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Outlier Detection error:\n${errorMessage}`);
  }
}

/**
 * ColumnPlot을 Python으로 실행합니다
 * 타임아웃: 120초
 */
export async function createColumnPlotPython(
  data: any[],
  plot_type: string,
  column1: string,
  column2: string | null,
  chart_type: string,
  timeoutMs: number = 120000
): Promise<string> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // matplotlib, scipy 패키지 로드 (seaborn은 Pyodide에서 지원하지 않음)
    await withTimeout(
      py.loadPackage(["matplotlib", "scipy"]),
      90000,
      "패키지 설치 타임아웃 (90초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_plot_type", plot_type);
    py.globals.set("js_column1", column1);
    py.globals.set("js_column2", column2 || "");
    py.globals.set("js_chart_type", chart_type);

    const code = `
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
from scipy import stats
import base64
import io
import traceback
import sys

try:
    df = pd.DataFrame(js_data.to_py())
    plot_type = str(js_plot_type)
    column1 = str(js_column1)
    column2 = str(js_column2) if js_column2 else None
    chart_type = str(js_chart_type)
    
    if column1 not in df.columns:
        raise ValueError(f"Column '{column1}' not found in DataFrame")
    
    if plot_type == "double" and column2 and column2 not in df.columns:
        raise ValueError(f"Column '{column2}' not found in DataFrame")
    
    plt.figure(figsize=(10, 6))
    
    if plot_type == "single":
        if chart_type == "Histogram":
            plt.hist(df[column1].dropna(), bins=30, edgecolor='black')
            plt.xlabel(column1)
            plt.ylabel('Frequency')
            plt.title(f'Histogram of {column1}')
        elif chart_type == "KDE Plot":
            df[column1].dropna().plot.kde()
            plt.xlabel(column1)
            plt.ylabel('Density')
            plt.title(f'KDE Plot of {column1}')
        elif chart_type == "Boxplot":
            plt.boxplot(df[column1].dropna())
            plt.ylabel(column1)
            plt.title(f'Boxplot of {column1}')
        elif chart_type == "Violin Plot":
            # Violin plot 구현 (matplotlib의 violinplot 사용)
            data = df[column1].dropna().values
            parts = plt.violinplot([data], positions=[1], widths=0.6, showmeans=True, showmedians=True)
            plt.ylabel(column1)
            plt.xticks([1], [column1])
            plt.title(f'Violin Plot of {column1}')
        elif chart_type == "ECDF Plot":
            sorted_data = np.sort(df[column1].dropna())
            y = np.arange(1, len(sorted_data) + 1) / len(sorted_data)
            plt.plot(sorted_data, y, marker='o', markersize=2)
            plt.xlabel(column1)
            plt.ylabel('Cumulative Probability')
            plt.title(f'ECDF Plot of {column1}')
        elif chart_type == "QQ-Plot":
            stats.probplot(df[column1].dropna(), dist="norm", plot=plt)
            plt.title(f'Q-Q Plot of {column1}')
        elif chart_type == "Line Plot":
            plt.plot(df[column1].dropna())
            plt.xlabel('Index')
            plt.ylabel(column1)
            plt.title(f'Line Plot of {column1}')
        elif chart_type == "Area Plot":
            plt.fill_between(range(len(df[column1].dropna())), df[column1].dropna(), alpha=0.5)
            plt.xlabel('Index')
            plt.ylabel(column1)
            plt.title(f'Area Plot of {column1}')
        elif chart_type == "Bar Plot":
            value_counts = df[column1].value_counts()
            plt.bar(range(len(value_counts)), value_counts.values)
            plt.xticks(range(len(value_counts)), value_counts.index.astype(str), rotation=45, ha='right')
            plt.xlabel(column1)
            plt.ylabel('Count')
            plt.title(f'Bar Plot of {column1}')
        elif chart_type == "Count Plot":
            value_counts = df[column1].value_counts()
            plt.bar(range(len(value_counts)), value_counts.values)
            plt.xticks(range(len(value_counts)), value_counts.index.astype(str), rotation=45, ha='right')
            plt.xlabel(column1)
            plt.ylabel('Count')
            plt.title(f'Count Plot of {column1}')
        elif chart_type == "Pie Chart":
            value_counts = df[column1].value_counts()
            plt.pie(value_counts.values, labels=value_counts.index.astype(str), autopct='%1.1f%%')
            plt.title(f'Pie Chart of {column1}')
        elif chart_type == "Frequency Table":
            value_counts = df[column1].value_counts()
            plt.axis('off')
            table_text = f"Frequency Table of {column1}\\n\\n" + value_counts.to_string()
            plt.text(0.5, 0.5, table_text, ha='center', va='center', fontsize=10, family='monospace', transform=plt.gca().transAxes)
            plt.title(f'Frequency Table of {column1}')
    else:
        # 2개열 선택
        if chart_type == "Scatter Plot":
            plt.scatter(df[column1].dropna(), df[column2].dropna(), alpha=0.5)
            plt.xlabel(column1)
            plt.ylabel(column2)
            plt.title(f'Scatter Plot: {column1} vs {column2}')
        elif chart_type == "Hexbin Plot":
            plt.hexbin(df[column1].dropna(), df[column2].dropna(), gridsize=20, cmap='Blues')
            plt.xlabel(column1)
            plt.ylabel(column2)
            plt.title(f'Hexbin Plot: {column1} vs {column2}')
            plt.colorbar()
        elif chart_type == "Joint Plot":
            plt.scatter(df[column1].dropna(), df[column2].dropna(), alpha=0.5)
            plt.xlabel(column1)
            plt.ylabel(column2)
            plt.title(f'Joint Plot: {column1} vs {column2}')
        elif chart_type == "Line Plot":
            plt.plot(df[column1].dropna(), df[column2].dropna())
            plt.xlabel(column1)
            plt.ylabel(column2)
            plt.title(f'Line Plot: {column1} vs {column2}')
        elif chart_type == "Regression Plot":
            x_data = df[column1].dropna()
            y_data = df[column2].dropna()
            # 공통 인덱스로 정렬
            common_idx = x_data.index.intersection(y_data.index)
            x_vals = x_data.loc[common_idx].values
            y_vals = y_data.loc[common_idx].values
            plt.scatter(x_vals, y_vals, alpha=0.5)
            # 회귀선 추가
            if len(x_vals) > 1:
                z = np.polyfit(x_vals, y_vals, 1)
                p = np.poly1d(z)
                plt.plot(x_vals, p(x_vals), "r--", alpha=0.8, linewidth=2)
            plt.xlabel(column1)
            plt.ylabel(column2)
            plt.title(f'Regression Plot: {column1} vs {column2}')
        elif chart_type == "Heatmap" and pd.api.types.is_numeric_dtype(df[column1]) and pd.api.types.is_numeric_dtype(df[column2]):
            corr = df[[column1, column2]].corr()
            im = plt.imshow(corr.values, cmap='coolwarm', aspect='auto', vmin=-1, vmax=1)
            plt.colorbar(im)
            plt.xticks(range(len(corr.columns)), corr.columns)
            plt.yticks(range(len(corr.index)), corr.index)
            # 상관계수 값 표시
            for i in range(len(corr.index)):
                for j in range(len(corr.columns)):
                    text = plt.text(j, i, f'{corr.iloc[i, j]:.2f}', ha="center", va="center", color="black", fontweight='bold')
            plt.title(f'Heatmap: {column1} vs {column2}')
        elif chart_type == "Box Plot":
            # 카테고리별로 그룹화하여 boxplot 생성
            groups = df.groupby(column2)[column1].apply(list).to_dict()
            data_to_plot = [groups[k] for k in groups.keys()]
            labels = list(groups.keys())
            plt.boxplot(data_to_plot, labels=labels)
            plt.xlabel(column2)
            plt.ylabel(column1)
            plt.title(f'Box Plot: {column1} by {column2}')
            plt.xticks(rotation=45, ha='right')
        elif chart_type == "Violin Plot":
            # Violin plot 구현 (matplotlib의 violinplot 사용)
            groups = df.groupby(column2)[column1].apply(list).to_dict()
            data_to_plot = [groups[k] for k in groups.keys()]
            labels = list(groups.keys())
            positions = range(1, len(labels) + 1)
            parts = plt.violinplot(data_to_plot, positions=positions, widths=0.6, showmeans=True, showmedians=True)
            plt.xticks(positions, labels, rotation=45, ha='right')
            plt.xlabel(column2)
            plt.ylabel(column1)
            plt.title(f'Violin Plot: {column1} by {column2}')
        elif chart_type == "Bar Plot":
            # 카테고리별 평균 계산
            grouped = df.groupby(column2)[column1].mean()
            plt.bar(range(len(grouped)), grouped.values)
            plt.xticks(range(len(grouped)), grouped.index.astype(str), rotation=45, ha='right')
            plt.xlabel(column2)
            plt.ylabel(column1)
            plt.title(f'Bar Plot: {column1} by {column2}')
        elif chart_type == "Strip Plot":
            # 카테고리별로 scatter plot
            groups = df.groupby(column2)[column1]
            x_pos = 0
            x_positions = []
            y_values = []
            labels = []
            for name, group in groups:
                y_vals = group.dropna().values
                x_vals = [x_pos] * len(y_vals)
                x_positions.extend(x_vals)
                y_values.extend(y_vals)
                labels.append(name)
                x_pos += 1
            plt.scatter(x_positions, y_values, alpha=0.5)
            plt.xticks(range(len(labels)), labels, rotation=45, ha='right')
            plt.xlabel(column2)
            plt.ylabel(column1)
            plt.title(f'Strip Plot: {column1} by {column2}')
        elif chart_type == "Swarm Plot":
            # Swarm plot을 strip plot으로 대체
            groups = df.groupby(column2)[column1]
            x_pos = 0
            x_positions = []
            y_values = []
            labels = []
            for name, group in groups:
                y_vals = group.dropna().values
                x_vals = [x_pos] * len(y_vals)
                x_positions.extend(x_vals)
                y_values.extend(y_vals)
                labels.append(name)
                x_pos += 1
            plt.scatter(x_positions, y_values, alpha=0.5)
            plt.xticks(range(len(labels)), labels, rotation=45, ha='right')
            plt.xlabel(column2)
            plt.ylabel(column1)
            plt.title(f'Swarm Plot: {column1} by {column2} (using Strip Plot)')
        elif chart_type == "Grouped Bar Plot":
            crosstab = pd.crosstab(df[column1].dropna(), df[column2].dropna())
            crosstab.plot(kind='bar', stacked=False)
            plt.xlabel(column1)
            plt.ylabel('Count')
            plt.title(f'Grouped Bar Plot: {column1} by {column2}')
            plt.legend(title=column2)
            plt.xticks(rotation=45, ha='right')
        elif chart_type == "Heatmap" and not (pd.api.types.is_numeric_dtype(df[column1]) and pd.api.types.is_numeric_dtype(df[column2])):
            crosstab = pd.crosstab(df[column1].dropna(), df[column2].dropna())
            im = plt.imshow(crosstab.values, cmap='Blues', aspect='auto')
            plt.colorbar(im)
            plt.xticks(range(len(crosstab.columns)), crosstab.columns, rotation=45, ha='right')
            plt.yticks(range(len(crosstab.index)), crosstab.index)
            # 값 표시
            for i in range(len(crosstab.index)):
                for j in range(len(crosstab.columns)):
                    text = plt.text(j, i, int(crosstab.iloc[i, j]), ha="center", va="center", color="white", fontweight='bold')
            plt.xlabel(column2)
            plt.ylabel(column1)
            plt.title(f'Heatmap: {column1} vs {column2}')
        elif chart_type == "Mosaic Plot":
            crosstab = pd.crosstab(df[column1].dropna(), df[column2].dropna())
            im = plt.imshow(crosstab.values, cmap='viridis', aspect='auto')
            plt.colorbar(im)
            plt.xticks(range(len(crosstab.columns)), crosstab.columns, rotation=45, ha='right')
            plt.yticks(range(len(crosstab.index)), crosstab.index)
            # 값 표시
            for i in range(len(crosstab.index)):
                for j in range(len(crosstab.columns)):
                    text = plt.text(j, i, int(crosstab.iloc[i, j]), ha="center", va="center", color="white", fontweight='bold')
            plt.xlabel(column2)
            plt.ylabel(column1)
            plt.title(f'Mosaic Plot: {column1} vs {column2}')
    
    plt.tight_layout()
    
    # 이미지를 base64로 변환
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    js_result = img_base64
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python ColumnPlot 실행 타임아웃 (120초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");

    if (!resultPyObj) {
      throw new Error(
        `Python ColumnPlot error: Python code returned None or undefined.`
      );
    }

    const result = fromPython(resultPyObj);

    if (result && result.__error__) {
      throw new Error(
        `Python ColumnPlot error:\n${
          result.error_traceback || result.error_message
        }`
      );
    }

    if (typeof result !== "string") {
      throw new Error(
        `Python ColumnPlot error: Expected string (base64 image), got ${typeof result}.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_plot_type");
    py.globals.delete("js_column1");
    py.globals.delete("js_column2");
    py.globals.delete("js_chart_type");
    py.globals.delete("js_result");

    return result;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_plot_type");
        py.globals.delete("js_column1");
        py.globals.delete("js_column2");
        py.globals.delete("js_chart_type");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python ColumnPlot error: ${errorMessage}`);
  }
}

/**
 * 가설 검정을 수행합니다
 */
export async function performHypothesisTests(
  data: any[],
  tests: Array<{
    testType:
      | "t_test_one_sample"
      | "t_test_independent"
      | "t_test_paired"
      | "chi_square"
      | "anova"
      | "ks_test"
      | "shapiro_wilk"
      | "levene";
    columns: string[];
    options?: Record<string, any>;
  }>,
  timeoutMs: number = 120000
): Promise<
  Array<{
    testType: string;
    testName: string;
    columns: string[];
    statistic?: number;
    pValue?: number;
    degreesOfFreedom?: number | number[];
    criticalValue?: number;
    conclusion?: string;
    interpretation?: string;
    details?: Record<string, any>;
  }>
> {
  const py = await loadPyodide();

  try {
    // 데이터를 Python으로 전달
    py.globals.set("js_data", data);
    py.globals.set("js_tests", tests);

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
from scipy import stats
from scipy.stats import chi2_contingency, f_oneway, levene, shapiro, kstest, ttest_1samp, ttest_ind, ttest_rel

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_data.to_py())
    tests_config = js_tests.to_py()
    
    results = []
    
    for test_config in tests_config:
        test_type = str(test_config['testType'])
        columns = test_config['columns']
        options = test_config.get('options', {})
        
        result = {
            'testType': test_type,
            'testName': '',
            'columns': columns,
            'statistic': None,
            'pValue': None,
            'degreesOfFreedom': None,
            'criticalValue': None,
            'conclusion': None,
            'interpretation': None,
            'details': {}
        }
        
        try:
            if test_type == 't_test_one_sample':
                # 단일 표본 t-검정
                if len(columns) < 1:
                    raise ValueError("t_test_one_sample requires 1 column")
                col = columns[0]
                sample = dataframe[col].dropna()
                popmean = options.get('popmean', 0)
                alternative = options.get('alternative', 'two-sided')
                
                statistic, p_value = ttest_1samp(sample, popmean, alternative=alternative)
                
                result['testName'] = 'One-Sample t-test'
                result['statistic'] = float(statistic)
                result['pValue'] = float(p_value)
                result['degreesOfFreedom'] = int(len(sample) - 1)
                result['conclusion'] = 'Reject H0' if p_value < 0.05 else 'Fail to reject H0'
                result['interpretation'] = f"t-statistic: {statistic:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'sample_size': int(len(sample)),
                    'sample_mean': float(sample.mean()),
                    'popmean': float(popmean),
                    'alternative': alternative
                }
                
            elif test_type == 't_test_independent':
                # 독립 표본 t-검정
                if len(columns) < 2:
                    raise ValueError("t_test_independent requires 2 columns")
                col1 = columns[0]
                col2 = columns[1]
                group_col = options.get('group_column')
                
                if group_col:
                    # 그룹 열이 있는 경우
                    groups = dataframe[group_col].unique()
                    if len(groups) != 2:
                        raise ValueError("group_column must have exactly 2 groups")
                    group1_data = dataframe[dataframe[group_col] == groups[0]][col1].dropna()
                    group2_data = dataframe[dataframe[group_col] == groups[1]][col1].dropna()
                else:
                    # 두 개의 숫자 열
                    group1_data = dataframe[col1].dropna()
                    group2_data = dataframe[col2].dropna()
                
                equal_var = options.get('equal_var', True)
                alternative = options.get('alternative', 'two-sided')
                
                statistic, p_value = ttest_ind(group1_data, group2_data, equal_var=equal_var, alternative=alternative)
                
                result['testName'] = 'Independent Samples t-test'
                result['statistic'] = float(statistic)
                result['pValue'] = float(p_value)
                result['degreesOfFreedom'] = int(len(group1_data) + len(group2_data) - 2)
                result['conclusion'] = 'Reject H0' if p_value < 0.05 else 'Fail to reject H0'
                result['interpretation'] = f"t-statistic: {statistic:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'group1_size': int(len(group1_data)),
                    'group1_mean': float(group1_data.mean()),
                    'group2_size': int(len(group2_data)),
                    'group2_mean': float(group2_data.mean()),
                    'equal_var': equal_var,
                    'alternative': alternative
                }
                
            elif test_type == 't_test_paired':
                # 대응 표본 t-검정
                if len(columns) < 2:
                    raise ValueError("t_test_paired requires 2 columns")
                col1 = columns[0]
                col2 = columns[1]
                
                # 결측치가 있는 행 제거
                paired_data = dataframe[[col1, col2]].dropna()
                group1_data = paired_data[col1]
                group2_data = paired_data[col2]
                
                alternative = options.get('alternative', 'two-sided')
                
                statistic, p_value = ttest_rel(group1_data, group2_data, alternative=alternative)
                
                result['testName'] = 'Paired Samples t-test'
                result['statistic'] = float(statistic)
                result['pValue'] = float(p_value)
                result['degreesOfFreedom'] = int(len(paired_data) - 1)
                result['conclusion'] = 'Reject H0' if p_value < 0.05 else 'Fail to reject H0'
                result['interpretation'] = f"t-statistic: {statistic:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'sample_size': int(len(paired_data)),
                    'group1_mean': float(group1_data.mean()),
                    'group2_mean': float(group2_data.mean()),
                    'alternative': alternative
                }
                
            elif test_type == 'chi_square':
                # 카이제곱 검정
                if len(columns) < 2:
                    raise ValueError("chi_square requires 2 categorical columns")
                col1 = columns[0]
                col2 = columns[1]
                
                contingency_table = pd.crosstab(dataframe[col1], dataframe[col2])
                chi2, p_value, dof, expected = chi2_contingency(contingency_table)
                
                result['testName'] = 'Chi-square Test'
                result['statistic'] = float(chi2)
                result['pValue'] = float(p_value)
                result['degreesOfFreedom'] = int(dof)
                result['conclusion'] = 'Reject H0' if p_value < 0.05 else 'Fail to reject H0'
                result['interpretation'] = f"Chi-square: {chi2:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'contingency_table': contingency_table.to_dict(),
                    'expected_frequencies': expected.tolist() if hasattr(expected, 'tolist') else expected
                }
                
            elif test_type == 'anova':
                # ANOVA
                if len(columns) < 2:
                    raise ValueError("anova requires at least 2 columns (1 numeric, 1 categorical)")
                numeric_col = columns[0]
                group_col = columns[1] if len(columns) > 1 else None
                
                if group_col:
                    groups = dataframe[group_col].unique()
                    group_data = [dataframe[dataframe[group_col] == g][numeric_col].dropna() for g in groups]
                else:
                    # 여러 숫자 열
                    group_data = [dataframe[col].dropna() for col in columns]
                
                if len(group_data) < 2:
                    raise ValueError("anova requires at least 2 groups")
                
                statistic, p_value = f_oneway(*group_data)
                
                result['testName'] = 'One-way ANOVA'
                result['statistic'] = float(statistic)
                result['pValue'] = float(p_value)
                result['degreesOfFreedom'] = [int(len(group_data) - 1), int(sum(len(g) for g in group_data) - len(group_data))]
                result['conclusion'] = 'Reject H0' if p_value < 0.05 else 'Fail to reject H0'
                result['interpretation'] = f"F-statistic: {statistic:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'num_groups': int(len(group_data)),
                    'group_sizes': [int(len(g)) for g in group_data],
                    'group_means': [float(g.mean()) for g in group_data]
                }
                
            elif test_type == 'ks_test':
                # Kolmogorov-Smirnov 검정
                if len(columns) < 1:
                    raise ValueError("ks_test requires at least 1 column")
                
                col = columns[0]
                sample = dataframe[col].dropna()
                
                # 분포 비교 (기본값: 정규분포)
                dist = options.get('distribution', 'norm')
                if dist == 'norm':
                    # 정규분포와 비교
                    sample_mean = sample.mean()
                    sample_std = sample.std()
                    statistic, p_value = kstest(sample, 'norm', args=(sample_mean, sample_std))
                elif dist == 'uniform':
                    statistic, p_value = kstest(sample, 'uniform')
                else:
                    # 두 표본 비교
                    if len(columns) < 2:
                        raise ValueError("ks_test with two samples requires 2 columns")
                    sample2 = dataframe[columns[1]].dropna()
                    statistic, p_value = kstest(sample, sample2)
                
                result['testName'] = 'Kolmogorov-Smirnov Test'
                result['statistic'] = float(statistic)
                result['pValue'] = float(p_value)
                result['conclusion'] = 'Reject H0' if p_value < 0.05 else 'Fail to reject H0'
                result['interpretation'] = f"KS-statistic: {statistic:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'sample_size': int(len(sample)),
                    'distribution': dist
                }
                
            elif test_type == 'shapiro_wilk':
                # Shapiro-Wilk 정규성 검정
                if len(columns) < 1:
                    raise ValueError("shapiro_wilk requires 1 column")
                col = columns[0]
                sample = dataframe[col].dropna()
                
                if len(sample) < 3:
                    raise ValueError("shapiro_wilk requires at least 3 samples")
                if len(sample) > 5000:
                    # 샘플 크기가 너무 크면 일부만 사용
                    sample = sample.sample(5000)
                
                statistic, p_value = shapiro(sample)
                
                result['testName'] = 'Shapiro-Wilk Test'
                result['statistic'] = float(statistic)
                result['pValue'] = float(p_value)
                result['conclusion'] = 'Reject H0 (not normal)' if p_value < 0.05 else 'Fail to reject H0 (normal)'
                result['interpretation'] = f"W-statistic: {statistic:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'sample_size': int(len(sample))
                }
                
            elif test_type == 'levene':
                # Levene 등분산성 검정
                if len(columns) < 2:
                    raise ValueError("levene requires at least 2 columns (1 numeric, 1 categorical)")
                numeric_col = columns[0]
                group_col = columns[1] if len(columns) > 1 else None
                
                if group_col:
                    groups = dataframe[group_col].unique()
                    group_data = [dataframe[dataframe[group_col] == g][numeric_col].dropna() for g in groups]
                else:
                    # 여러 숫자 열
                    group_data = [dataframe[col].dropna() for col in columns]
                
                if len(group_data) < 2:
                    raise ValueError("levene requires at least 2 groups")
                
                center = options.get('center', 'median')
                statistic, p_value = levene(*group_data, center=center)
                
                result['testName'] = 'Levene Test'
                result['statistic'] = float(statistic)
                result['pValue'] = float(p_value)
                result['degreesOfFreedom'] = [int(len(group_data) - 1), int(sum(len(g) for g in group_data) - len(group_data))]
                result['conclusion'] = 'Reject H0 (unequal variances)' if p_value < 0.05 else 'Fail to reject H0 (equal variances)'
                result['interpretation'] = f"W-statistic: {statistic:.4f}, p-value: {p_value:.4f}"
                result['details'] = {
                    'num_groups': int(len(group_data)),
                    'group_sizes': [int(len(g)) for g in group_data],
                    'group_variances': [float(g.var()) for g in group_data],
                    'center': center
                }
            else:
                raise ValueError(f"Unknown test type: {test_type}")
                
        except Exception as e:
            result['testName'] = f"Error: {str(e)}"
            result['details'] = {'error': str(e)}
        
        results.append(result)
    
    js_result = results
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Hypothesis Testing 실행 타임아웃 (120초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");

    if (!resultPyObj) {
      throw new Error(
        `Python Hypothesis Testing error: Python code returned None or undefined.`
      );
    }

    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    // 에러 체크
    if (result && typeof result === "object" && "__error__" in result) {
      const errorMessage = result.error_message || "Unknown error";
      const errorTraceback = result.error_traceback || "";
      throw new Error(
        `Python Hypothesis Testing error: ${errorMessage}\n${errorTraceback}`
      );
    }

    // 결과 반환
    return result as Array<{
      testType: string;
      testName: string;
      columns: string[];
      statistic?: number;
      pValue?: number;
      degreesOfFreedom?: number | number[];
      criticalValue?: number;
      conclusion?: string;
      interpretation?: string;
      details?: Record<string, any>;
    }>;
  } catch (error: any) {
    // 정리
    try {
      const py = await loadPyodide();
      if (py && py.globals) {
        py.globals.delete("js_data");
        py.globals.delete("js_tests");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Hypothesis Testing error: ${errorMessage}`);
  }
}

/**
 * 상관분석을 수행합니다 (Pearson, Spearman, Kendall, Cramér's V)
 */
export async function performCorrelationAnalysis(
  data: any[],
  columns: string[],
  numericColumns: string[],
  categoricalColumns: string[],
  timeoutMs: number = 120000
): Promise<{
  correlationMatrices: Array<{
    method: "pearson" | "spearman" | "kendall" | "cramers_v";
    matrix: Record<string, Record<string, number>>;
    columns: string[];
  }>;
  heatmapImage?: string;
  pairplotImage?: string;
  summary?: Record<string, any>;
}> {
  const py = await loadPyodide();

  try {
    // matplotlib 패키지 로드 (seaborn은 Pyodide에서 지원하지 않음)
    await withTimeout(
      py.loadPackage(["matplotlib"]),
      90000,
      "matplotlib 패키지 설치 타임아웃 (90초 초과)"
    );

    // 데이터를 Python으로 전달
    py.globals.set("js_data", data);
    py.globals.set("js_columns", columns);
    py.globals.set("js_numeric_columns", numericColumns);
    py.globals.set("js_categorical_columns", categoricalColumns);

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
import io
import base64
from scipy import stats
from scipy.stats import chi2_contingency
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

try:
    # 데이터 준비
    dataframe = pd.DataFrame(js_data.to_py())
    columns = js_columns.to_py() if js_columns is not None else []
    numeric_columns = js_numeric_columns.to_py() if js_numeric_columns is not None else []
    categorical_columns = js_categorical_columns.to_py() if js_categorical_columns is not None else []
    
    # 리스트로 변환 보장
    if not isinstance(columns, list):
        columns = list(columns) if columns else []
    if not isinstance(numeric_columns, list):
        numeric_columns = list(numeric_columns) if numeric_columns else []
    if not isinstance(categorical_columns, list):
        categorical_columns = list(categorical_columns) if categorical_columns else []
    
    correlation_matrices = []
    heatmap_image = None
    pairplot_image = None
    summary = {}
    
    # 숫자형 열이 2개 이상인 경우 상관계수 계산
    if len(numeric_columns) >= 2:
        numeric_data = dataframe[numeric_columns].dropna()
        
        # Pearson 상관계수
        pearson_matrix = numeric_data.corr(method='pearson')
        correlation_matrices.append({
            'method': 'pearson',
            'matrix': pearson_matrix.to_dict(),
            'columns': numeric_columns
        })
        
        # Spearman 상관계수
        spearman_matrix = numeric_data.corr(method='spearman')
        correlation_matrices.append({
            'method': 'spearman',
            'matrix': spearman_matrix.to_dict(),
            'columns': numeric_columns
        })
        
        # Kendall 상관계수
        kendall_matrix = numeric_data.corr(method='kendall')
        correlation_matrices.append({
            'method': 'kendall',
            'matrix': kendall_matrix.to_dict(),
            'columns': numeric_columns
        })
        
        # Heatmap 생성 (matplotlib로 구현)
        plt.figure(figsize=(10, 8))
        im = plt.imshow(pearson_matrix.values, cmap='coolwarm', aspect='auto', vmin=-1, vmax=1)
        plt.colorbar(im)
        plt.xticks(range(len(pearson_matrix.columns)), pearson_matrix.columns, rotation=45, ha='right')
        plt.yticks(range(len(pearson_matrix.index)), pearson_matrix.index)
        # 상관계수 값 표시
        for i in range(len(pearson_matrix.index)):
            for j in range(len(pearson_matrix.columns)):
                text = plt.text(j, i, f'{pearson_matrix.iloc[i, j]:.2f}',
                             ha="center", va="center", color="black", fontsize=8)
        plt.title('Correlation Heatmap (Pearson)', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        buffer.seek(0)
        heatmap_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
        plt.close()
        
        # Pairplot 생성 (열이 15개 이하인 경우만) - matplotlib로 구현
        if len(numeric_columns) <= 15:
            n_cols = len(numeric_columns)
            fig, axes = plt.subplots(n_cols, n_cols, figsize=(12, 10))
            if n_cols == 1:
                axes = [[axes]]
            else:
                axes = axes.reshape(n_cols, n_cols)
            
            for i, col1 in enumerate(numeric_columns):
                for j, col2 in enumerate(numeric_columns):
                    ax = axes[i][j]
                    if i == j:
                        # 대각선: 히스토그램
                        ax.hist(numeric_data[col1].dropna(), bins=20, alpha=0.6, edgecolor='black')
                        ax.set_ylabel(col1 if j == 0 else '')
                        ax.set_xlabel(col1 if i == n_cols - 1 else '')
                    else:
                        # 비대각선: 산점도
                        ax.scatter(numeric_data[col2], numeric_data[col1], alpha=0.6, s=10)
                        ax.set_ylabel(col1 if j == 0 else '')
                        ax.set_xlabel(col2 if i == n_cols - 1 else '')
            
            plt.suptitle('Pairplot', fontsize=14, fontweight='bold', y=1.02)
            plt.tight_layout()
            
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
            buffer.seek(0)
            pairplot_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
            plt.close()
        
        # 요약 통계
        summary['numeric_correlation_summary'] = {
            'pearson_mean': float(pearson_matrix.values[np.triu_indices_from(pearson_matrix.values, k=1)].mean()),
            'spearman_mean': float(spearman_matrix.values[np.triu_indices_from(spearman_matrix.values, k=1)].mean()),
            'kendall_mean': float(kendall_matrix.values[np.triu_indices_from(kendall_matrix.values, k=1)].mean()),
            'num_pairs': int(len(numeric_columns) * (len(numeric_columns) - 1) / 2)
        }
    
    # 범주형 열이 2개 이상인 경우 Cramér's V 계산
    if len(categorical_columns) >= 2:
        cramers_v_matrix = {}
        for col1 in categorical_columns:
            cramers_v_matrix[col1] = {}
            for col2 in categorical_columns:
                if col1 == col2:
                    cramers_v_matrix[col1][col2] = 1.0
                else:
                    # 교차표 생성
                    contingency_table = pd.crosstab(dataframe[col1], dataframe[col2])
                    chi2, p_value, dof, expected = chi2_contingency(contingency_table)
                    
                    # Cramér's V 계산
                    n = contingency_table.sum().sum()
                    cramers_v = np.sqrt(chi2 / (n * (min(contingency_table.shape) - 1))) if n > 0 and min(contingency_table.shape) > 1 else 0.0
                    cramers_v_matrix[col1][col2] = float(cramers_v)
        
        correlation_matrices.append({
            'method': 'cramers_v',
            'matrix': cramers_v_matrix,
            'columns': categorical_columns
        })
        
        # Cramér's V Heatmap 생성 (matplotlib로 구현)
        if len(categorical_columns) >= 2:
            cramers_v_df = pd.DataFrame(cramers_v_matrix)
            plt.figure(figsize=(10, 8))
            im = plt.imshow(cramers_v_df.values, cmap='coolwarm', aspect='auto', vmin=0, vmax=1)
            plt.colorbar(im)
            plt.xticks(range(len(cramers_v_df.columns)), cramers_v_df.columns, rotation=45, ha='right')
            plt.yticks(range(len(cramers_v_df.index)), cramers_v_df.index)
            # Cramér's V 값 표시
            for i in range(len(cramers_v_df.index)):
                for j in range(len(cramers_v_df.columns)):
                    text = plt.text(j, i, f'{cramers_v_df.iloc[i, j]:.2f}',
                                 ha="center", va="center", color="black", fontsize=8)
            plt.title("Cramér's V Heatmap", fontsize=14, fontweight='bold')
            plt.tight_layout()
            
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
            buffer.seek(0)
            if heatmap_image is None:
                heatmap_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
            plt.close()
        
        # 요약 통계
        if 'categorical_correlation_summary' not in summary:
            summary['categorical_correlation_summary'] = {}
        cramers_v_values = [v for row in cramers_v_matrix.values() for k, v in row.items() if k != list(cramers_v_matrix.keys())[list(cramers_v_matrix.values()).index(row)]]
        summary['categorical_correlation_summary'] = {
            'cramers_v_mean': float(np.mean([v for row in cramers_v_matrix.values() for k, v in row.items() if k != list(cramers_v_matrix.keys())[list(cramers_v_matrix.values()).index(row)]])) if len(cramers_v_matrix) > 1 else 0.0,
            'num_pairs': int(len(categorical_columns) * (len(categorical_columns) - 1) / 2)
        }
    
    result = {
        'correlation_matrices': correlation_matrices,
        'heatmap_image': heatmap_image,
        'pairplot_image': pairplot_image,
        'summary': summary
    }
    
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    js_result = error_result
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Correlation Analysis 실행 타임아웃 (120초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");

    if (!resultPyObj) {
      throw new Error(
        `Python Correlation Analysis error: Python code returned None or undefined.`
      );
    }

    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    // 에러 체크
    if (result && typeof result === "object" && "__error__" in result) {
      const errorMessage = result.error_message || "Unknown error";
      const errorTraceback = result.error_traceback || "";
      throw new Error(
        `Python Correlation Analysis error: ${errorMessage}\n${errorTraceback}`
      );
    }

    // 결과 검증 및 기본값 설정
    if (!result || typeof result !== "object") {
      throw new Error("Python Correlation Analysis returned invalid result");
    }

    const correlationMatrices =
      result.correlation_matrices || result.correlationMatrices || [];
    const heatmapImage = result.heatmap_image || result.heatmapImage;
    const pairplotImage = result.pairplot_image || result.pairplotImage;
    const summary = result.summary || {};

    // 결과 반환
    return {
      correlationMatrices: Array.isArray(correlationMatrices)
        ? correlationMatrices
        : [],
      heatmapImage: heatmapImage || undefined,
      pairplotImage: pairplotImage || undefined,
      summary: summary || {},
    } as {
      correlationMatrices: Array<{
        method: "pearson" | "spearman" | "kendall" | "cramers_v";
        matrix: Record<string, Record<string, number>>;
        columns: string[];
      }>;
      heatmapImage?: string;
      pairplotImage?: string;
      summary?: Record<string, any>;
    };
  } catch (error: any) {
    // 정리
    try {
      const py = await loadPyodide();
      if (py && py.globals) {
        py.globals.delete("js_data");
        py.globals.delete("js_columns");
        py.globals.delete("js_numeric_columns");
        py.globals.delete("js_categorical_columns");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Correlation Analysis error: ${errorMessage}`);
  }
}

/**
 * 정규성 검정을 수행합니다
 */
export async function performNormalityCheck(
  data: Record<string, any>[],
  column: string,
  tests: string[],
  timeoutMs: number = 120000
): Promise<any> {
  const py = await loadPyodide();

  try {
    // 데이터 검증
    if (!Array.isArray(data)) {
      throw new Error(
        `Expected array, got ${typeof data}: ${JSON.stringify(data).substring(
          0,
          100
        )}`
      );
    }
    if (data.length === 0) {
      throw new Error("Data array is empty");
    }
    if (!column || typeof column !== "string") {
      throw new Error(`Invalid column: ${column}`);
    }
    if (!Array.isArray(tests)) {
      throw new Error(`Expected tests array, got ${typeof tests}`);
    }

    // matplotlib 패키지 로드
    await withTimeout(
      py.loadPackage(["matplotlib", "scipy", "statsmodels"]),
      90000,
      "matplotlib 패키지 설치 타임아웃 (90초 초과)"
    );

    // 데이터를 Python으로 전달 (명시적으로 배열로 전달)
    py.globals.set("js_data", data);
    py.globals.set("js_column", column);
    py.globals.set("js_tests", tests);

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
import io
import base64
from scipy import stats
from scipy.stats import jarque_bera, shapiro, kstest, anderson, normaltest
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

try:
    # 데이터 준비
    # js_data가 None이거나 비어있는 경우 에러
    if js_data is None:
        raise ValueError("js_data is None")
    
    # js_data가 문자열인 경우 JSON으로 파싱, 아니면 to_py() 사용
    if isinstance(js_data, str):
        data_list = json.loads(js_data)
        dataframe = pd.DataFrame(data_list)
    elif hasattr(js_data, 'to_py'):
        # Pyodide proxy 객체인 경우
        dataframe = pd.DataFrame(js_data.to_py())
    else:
        # 이미 Python 리스트/딕셔너리인 경우
        dataframe = pd.DataFrame(js_data)
    
    # column은 문자열이므로 직접 사용
    column = str(js_column) if js_column is not None else ""
    
    # tests는 배열이므로 to_py() 사용 (이미 Python 객체인 경우 처리)
    if hasattr(js_tests, 'to_py'):
        tests = js_tests.to_py() if js_tests is not None else []
    else:
        tests = list(js_tests) if js_tests is not None else []
    
    if column not in dataframe.columns:
        raise ValueError(f"Column '{column}' not found in dataframe")
    
    data_series = dataframe[column].dropna()
    
    if len(data_series) == 0:
        raise ValueError(f"Column '{column}' has no valid data")
    
    # 결과 저장
    results = {
        'column': column,
        'skewness': float(stats.skew(data_series)),
        'kurtosis': float(stats.kurtosis(data_series)),
        'jarqueBera': {},
        'testResults': [],
        'histogramImage': None,
        'qqPlotImage': None,
        'ecdfImage': None,
        'boxplotImage': None
    }
    
    # Jarque-Bera test
    jb_stat, jb_pvalue = jarque_bera(data_series)
    results['jarqueBera'] = {
        'statistic': float(jb_stat),
        'pValue': float(jb_pvalue),
        'conclusion': 'Reject H0' if jb_pvalue < 0.05 else 'Fail to reject H0'
    }
    
    # Selected tests
    for test_type in tests:
        try:
            if test_type == 'shapiro_wilk':
                if len(data_series) <= 5000:
                    stat, pvalue = shapiro(data_series)
                    results['testResults'].append({
                        'testType': 'shapiro_wilk',
                        'testName': 'Shapiro-Wilk Test',
                        'statistic': float(stat),
                        'pValue': float(pvalue),
                        'conclusion': 'Reject H0' if pvalue < 0.05 else 'Fail to reject H0',
                        'interpretation': 'Data is not normally distributed' if pvalue < 0.05 else 'Data appears to be normally distributed'
                    })
            elif test_type == 'kolmogorov_smirnov':
                mean_val = data_series.mean()
                std_val = data_series.std()
                stat, pvalue = kstest(data_series, lambda x: stats.norm.cdf(x, mean_val, std_val))
                results['testResults'].append({
                    'testType': 'kolmogorov_smirnov',
                    'testName': 'Kolmogorov-Smirnov Test',
                    'statistic': float(stat),
                    'pValue': float(pvalue),
                    'conclusion': 'Reject H0' if pvalue < 0.05 else 'Fail to reject H0',
                    'interpretation': 'Data does not follow normal distribution' if pvalue < 0.05 else 'Data follows normal distribution'
                })
            elif test_type == 'anderson_darling':
                result = anderson(data_series, dist='norm')
                stat = result.statistic
                critical_value = result.critical_values[2]  # 5% significance level
                conclusion = 'Reject H0' if stat > critical_value else 'Fail to reject H0'
                results['testResults'].append({
                    'testType': 'anderson_darling',
                    'testName': 'Anderson-Darling Test',
                    'statistic': float(stat),
                    'criticalValue': float(critical_value),
                    'pValue': None,
                    'conclusion': conclusion,
                    'interpretation': 'Data is not normally distributed' if stat > critical_value else 'Data appears to be normally distributed'
                })
            elif test_type == 'dagostino_k2':
                stat, pvalue = normaltest(data_series)
                results['testResults'].append({
                    'testType': 'dagostino_k2',
                    'testName': "D'Agostino's K2 Test",
                    'statistic': float(stat),
                    'pValue': float(pvalue),
                    'conclusion': 'Reject H0' if pvalue < 0.05 else 'Fail to reject H0',
                    'interpretation': 'Data is not normally distributed' if pvalue < 0.05 else 'Data appears to be normally distributed'
                })
        except Exception as e:
            results['testResults'].append({
                'testType': test_type,
                'testName': f'Error: {str(e)}',
                'statistic': None,
                'pValue': None,
                'conclusion': 'Error',
                'interpretation': str(e)
            })
    
    # Generate plots
    def plot_to_base64(fig):
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        return img_base64
    
    # Histogram with normal curve
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(data_series, bins=30, density=True, alpha=0.7, color='skyblue', edgecolor='black')
    mu, sigma = data_series.mean(), data_series.std()
    x = np.linspace(data_series.min(), data_series.max(), 100)
    y = stats.norm.pdf(x, mu, sigma)
    ax.plot(x, y, 'r-', linewidth=2, label=f'Normal (μ={mu:.2f}, σ={sigma:.2f})')
    ax.set_xlabel('Value')
    ax.set_ylabel('Density')
    ax.set_title('Histogram with Normal Curve Overlay')
    ax.legend()
    ax.grid(True, alpha=0.3)
    results['histogramImage'] = plot_to_base64(fig)
    
    # Q-Q plot
    fig, ax = plt.subplots(figsize=(8, 8))
    stats.probplot(data_series, dist="norm", plot=ax)
    ax.set_title('Q-Q Plot')
    ax.grid(True, alpha=0.3)
    results['qqPlotImage'] = plot_to_base64(fig)
    
    # ECDF vs Normal CDF
    fig, ax = plt.subplots(figsize=(10, 6))
    sorted_data = np.sort(data_series)
    y_ecdf = np.arange(1, len(sorted_data) + 1) / len(sorted_data)
    ax.plot(sorted_data, y_ecdf, 'b-', linewidth=2, label='ECDF')
    x = np.linspace(data_series.min(), data_series.max(), 100)
    y_cdf = stats.norm.cdf(x, mu, sigma)
    ax.plot(x, y_cdf, 'r--', linewidth=2, label=f'Normal CDF (μ={mu:.2f}, σ={sigma:.2f})')
    ax.set_xlabel('Value')
    ax.set_ylabel('Cumulative Probability')
    ax.set_title('ECDF vs Normal CDF')
    ax.legend()
    ax.grid(True, alpha=0.3)
    results['ecdfImage'] = plot_to_base64(fig)
    
    # Boxplot
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.boxplot(data_series, vert=True)
    ax.set_ylabel('Value')
    ax.set_title('Boxplot')
    ax.grid(True, alpha=0.3, axis='y')
    results['boxplotImage'] = plot_to_base64(fig)
    
    # 결과를 JSON으로 변환
    js_result = json.dumps(results)
    
except Exception as e:
    error_msg = f"Error in normality check: {str(e)}\\n{traceback.format_exc()}"
    js_result = json.dumps({'error': error_msg})
    `;

    const resultJson = await withTimeout(
      py.runPython(code + "\njs_result"),
      timeoutMs,
      `Normality check timeout (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  } catch (error: any) {
    // 정리
    try {
      const py = await loadPyodide();
      if (py && py.globals) {
        py.globals.delete("js_data");
        py.globals.delete("js_column");
        py.globals.delete("js_tests");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Normality Check error: ${errorMessage}`);
  }
}

/**
 * K-Means 클러스터링 모델을 학습합니다
 */
export async function fitKMeansPython(
  X: number[][],
  n_clusters: number,
  init: string,
  n_init: number,
  max_iter: number,
  random_state: number,
  featureColumns: string[],
  timeoutMs: number = 60000
): Promise<{
  model: any;
  centroids: Record<string, number>[];
  inertia: number;
}> {
  try {
    const py = await loadPyodide();
    const dataJson = JSON.stringify(X);
    const featureColumnsJson = JSON.stringify(featureColumns);

    const code = `
import json
import numpy as np
from sklearn.cluster import KMeans

# 데이터 준비
js_data = json.loads('${dataJson.replace(/'/g, "\\'")}')
js_feature_columns = json.loads('${featureColumnsJson.replace(/'/g, "\\'")}')

X = np.array(js_data)

# K-Means 모델 학습
kmeans = KMeans(
    n_clusters=${n_clusters},
    init='${init}',
    n_init=${n_init},
    max_iter=${max_iter},
    random_state=${random_state}
)
kmeans.fit(X)

# 결과 준비
centroids_list = kmeans.cluster_centers_.tolist()
centroids = []
for i, centroid in enumerate(centroids_list):
    centroid_dict = {}
    for j, col in enumerate(js_feature_columns):
        centroid_dict[col] = float(centroid[j])
    centroids.append(centroid_dict)

results = {
    'centroids': centroids,
    'inertia': float(kmeans.inertia_),
    'model': {
        'cluster_centers_': centroids_list,
        'inertia_': float(kmeans.inertia_),
        'n_clusters': ${n_clusters},
        'n_init': ${n_init},
        'max_iter': ${max_iter},
        'random_state': ${random_state}
    }
}

js_result = json.dumps(results)
`;

    const resultJson = await withTimeout(
      py.runPython(code + "\njs_result"),
      timeoutMs,
      `K-Means 학습 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);
    return {
      model: result.model,
      centroids: result.centroids,
      inertia: result.inertia,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python K-Means 학습 오류: ${errorMessage}`);
  }
}

/**
 * K-Means 모델로 클러스터를 예측합니다
 */
export async function predictKMeansPython(
  X: number[][],
  model: any,
  featureColumns: string[],
  timeoutMs: number = 60000
): Promise<{
  clusters: number[];
}> {
  try {
    const py = await loadPyodide();
    const dataJson = JSON.stringify(X);
    const modelJson = JSON.stringify(model);

    const code = `
import json
import numpy as np
from sklearn.cluster import KMeans

# 데이터 준비
js_data = json.loads('${dataJson.replace(/'/g, "\\'")}')
js_model = json.loads('${modelJson.replace(/'/g, "\\'")}')

X = np.array(js_data)

# 학습된 클러스터 중심점 가져오기
cluster_centers = np.array(js_model['cluster_centers_'])

# K-Means 모델 재구성 - 학습된 클러스터 중심점을 init으로 사용
kmeans = KMeans(
    n_clusters=js_model['n_clusters'],
    init=cluster_centers,  # 학습된 클러스터 중심점을 초기값으로 사용
    n_init=1,  # 이미 초기값이 설정되었으므로 1번만 실행
    max_iter=1,  # 클러스터 중심점이 이미 최적이므로 1번만 반복
    random_state=js_model.get('random_state', 42)
)

# 더미 데이터로 fit 호출 (모델이 학습된 상태로 인식되도록)
# 각 클러스터 중심점을 더미 데이터로 사용
dummy_data = cluster_centers.copy()
# 최소한의 데이터를 보장하기 위해 실제 데이터의 첫 번째 행도 추가
if X.shape[0] > 0:
    if X.shape[0] >= kmeans.n_clusters:
        dummy_data = np.vstack([dummy_data, X[:kmeans.n_clusters]])
    else:
        dummy_data = np.vstack([dummy_data, X])
else:
    # 데이터가 없는 경우 클러스터 중심점만 사용
    dummy_data = cluster_centers

# fit 호출 (클러스터 중심점은 거의 변경되지 않음)
kmeans.fit(dummy_data)

# 학습된 클러스터 중심점을 원래 값으로 복원 (fit으로 인한 미세한 변경 방지)
kmeans.cluster_centers_ = cluster_centers
kmeans.inertia_ = js_model.get('inertia_', 0.0)

# 예측
clusters = kmeans.predict(X).tolist()

results = {
    'clusters': clusters
}

js_result = json.dumps(results)
`;

    const resultJson = await withTimeout(
      py.runPython(code + "\njs_result"),
      timeoutMs,
      `K-Means 예측 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);
    return {
      clusters: result.clusters,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python K-Means 예측 오류: ${errorMessage}`);
  }
}

/**
 * PCA 모델을 학습합니다
 */
export async function fitPCAPython(
  X: number[][],
  n_components: number,
  featureColumns: string[],
  timeoutMs: number = 60000
): Promise<{
  model: any;
  components: number[][];
  explainedVarianceRatio: number[];
  mean: number[];
}> {
  try {
    const py = await loadPyodide();
    const dataJson = JSON.stringify(X);
    const featureColumnsJson = JSON.stringify(featureColumns);

    const code = `
import json
import numpy as np
from sklearn.decomposition import PCA

# 데이터 준비
js_data = json.loads('${dataJson.replace(/'/g, "\\'")}')
js_feature_columns = json.loads('${featureColumnsJson.replace(/'/g, "\\'")}')

X = np.array(js_data)

# PCA 모델 학습
pca = PCA(n_components=${n_components})
pca.fit(X)

# 결과 준비
results = {
    'components': pca.components_.tolist(),
    'explained_variance_ratio': pca.explained_variance_ratio_.tolist(),
    'mean': pca.mean_.tolist(),
    'model': {
        'components_': pca.components_.tolist(),
        'explained_variance_ratio_': pca.explained_variance_ratio_.tolist(),
        'mean_': pca.mean_.tolist(),
        'n_components': ${n_components}
    }
}

js_result = json.dumps(results)
`;

    const resultJson = await withTimeout(
      py.runPython(code + "\njs_result"),
      timeoutMs,
      `PCA 학습 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);
    return {
      model: result.model,
      components: result.components,
      explainedVarianceRatio: result.explained_variance_ratio,
      mean: result.mean,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python PCA 학습 오류: ${errorMessage}`);
  }
}

/**
 * PCA 모델로 데이터를 변환합니다
 */
export async function transformPCAPython(
  X: number[][],
  model: any,
  featureColumns: string[],
  timeoutMs: number = 60000
): Promise<{
  transformedData: number[][];
}> {
  try {
    const py = await loadPyodide();
    const dataJson = JSON.stringify(X);
    const modelJson = JSON.stringify(model);

    const code = `
import json
import numpy as np
from sklearn.decomposition import PCA

# 데이터 준비
js_data = json.loads('${dataJson.replace(/'/g, "\\'")}')
js_model = json.loads('${modelJson.replace(/'/g, "\\'")}')

X = np.array(js_data)

# PCA 모델 재구성 및 변환
pca = PCA(n_components=js_model['n_components'])
pca.components_ = np.array(js_model['components_'])
pca.mean_ = np.array(js_model['mean_'])
pca.n_components = js_model['n_components']

# 변환
X_transformed = pca.transform(X)
transformed_data = X_transformed.tolist()

results = {
    'transformed_data': transformed_data
}

js_result = json.dumps(results)
`;

    const resultJson = await withTimeout(
      py.runPython(code + "\njs_result"),
      timeoutMs,
      `PCA 변환 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);
    return {
      transformedData: result.transformed_data,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python PCA 변환 오류: ${errorMessage}`);
  }
}

/**
 * DBSCAN / Agglomerative(계층적) 등 transductive 클러스터링을 학습합니다.
 * 이들은 별도 .predict가 없어 .fit_predict로 라벨을 한 번에 계산하고 labels_를 반환합니다.
 * (ClusteringData는 학습에 쓰인 동일 데이터에 이 라벨을 그대로 부여한다.)
 */
export async function fitTransductiveClusteringPython(
  X: number[][],
  algorithm: "dbscan" | "agglomerative",
  params: Record<string, any>,
  featureColumns: string[],
  timeoutMs: number = 60000
): Promise<{
  labels: number[];
  nClusters: number;
  nNoise: number;
  model: any;
}> {
  try {
    const py = await loadPyodide();
    const dataJson = JSON.stringify(X);
    const paramsJson = JSON.stringify(params || {});

    const code = `
import json
import numpy as np

# 데이터 준비
js_data = json.loads('${dataJson.replace(/'/g, "\\'")}')
js_params = json.loads('${paramsJson.replace(/'/g, "\\'")}')
algorithm = '${algorithm}'

X = np.array(js_data)

if algorithm == 'dbscan':
    from sklearn.cluster import DBSCAN
    model = DBSCAN(
        eps=float(js_params.get('eps', 0.5)),
        min_samples=int(js_params.get('min_samples', 5)),
    )
else:
    from sklearn.cluster import AgglomerativeClustering
    linkage = js_params.get('linkage', 'ward')
    metric = js_params.get('metric', 'euclidean')
    # 'ward' linkage only supports the euclidean metric.
    if linkage == 'ward':
        metric = 'euclidean'
    try:
        # sklearn >= 1.2 uses 'metric'
        model = AgglomerativeClustering(n_clusters=int(js_params.get('n_clusters', 3)), linkage=linkage, metric=metric)
    except TypeError:
        # older sklearn uses 'affinity'
        model = AgglomerativeClustering(n_clusters=int(js_params.get('n_clusters', 3)), linkage=linkage, affinity=metric)

labels = [int(v) for v in model.fit_predict(X).tolist()]
unique_labels = set(labels)
n_clusters = len([c for c in unique_labels if c != -1])
n_noise = labels.count(-1)

results = {
    'labels': labels,
    'n_clusters': n_clusters,
    'n_noise': n_noise,
    'model': {'algorithm': algorithm, 'labels_': labels},
}

js_result = json.dumps(results)
`;

    const resultJson = await withTimeout(
      py.runPython(code + "\njs_result"),
      timeoutMs,
      `클러스터링 학습 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    const result = JSON.parse(resultJson);
    return {
      labels: result.labels,
      nClusters: result.n_clusters,
      nNoise: result.n_noise,
      model: result.model,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`Python 클러스터링(transductive) 학습 오류: ${errorMessage}`);
  }
}

/**
 * Lee-Carter 모델을 Python으로 실행합니다
 * 타임아웃: 120초
 */
export async function fitLeeCarterModelPython(
  data: any[],
  ageColumn: string,
  yearColumn: string,
  deathsColumn: string,
  exposureColumn: string,
  timeoutMs: number = 120000
): Promise<any> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    await withTimeout(
      py.loadPackage(["numpy", "pandas", "scipy"]),
      60000,
      "패키지 설치 타임아웃 (60초 초과)"
    );

    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_data", data);
    py.globals.set("js_age_column", ageColumn);
    py.globals.set("js_year_column", yearColumn);
    py.globals.set("js_deaths_column", deathsColumn);
    py.globals.set("js_exposure_column", exposureColumn);

    const code = `
import json
import pandas as pd
import numpy as np
import traceback

try:
    rows = js_data.to_py()
    age_column = str(js_age_column)
    year_column = str(js_year_column)
    deaths_column = str(js_deaths_column)
    exposure_column = str(js_exposure_column)
    
    df = pd.DataFrame(rows)
    df = df.fillna(0)
    
    result = fit_lee_carter_model(
        df, age_column, year_column, deaths_column, exposure_column
    )
    
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Lee-Carter 모델 실행 타임아웃"
    );

    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    if (result.__error__) {
      throw new Error(`Lee-Carter 모델 오류: ${result.error_message}`);
    }

    return result;
  } catch (error: any) {
    throw new Error(
      `Lee-Carter 모델 실행 오류: ${error?.message || String(error)}`
    );
  }
}

/**
 * CBD 모델을 Python으로 실행합니다
 */
export async function fitCBDModelPython(
  data: any[],
  ageColumn: string,
  yearColumn: string,
  deathsColumn: string,
  exposureColumn: string,
  timeoutMs: number = 120000
): Promise<any> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃"
    );
    await withTimeout(
      py.loadPackage(["numpy", "pandas", "scipy"]),
      60000,
      "패키지 설치 타임아웃"
    );

    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_data", data);
    py.globals.set("js_age_column", ageColumn);
    py.globals.set("js_year_column", yearColumn);
    py.globals.set("js_deaths_column", deathsColumn);
    py.globals.set("js_exposure_column", exposureColumn);

    const code = `
import json
import pandas as pd
import numpy as np
import traceback

try:
    rows = js_data.to_py()
    df = pd.DataFrame(rows)
    df = df.fillna(0)
    result = fit_cbd_model(df, str(js_age_column), str(js_year_column), str(js_deaths_column), str(js_exposure_column))
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {'__error__': True, 'error_type': type(e).__name__, 'error_message': str(e), 'error_traceback': error_traceback}
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "CBD 모델 실행 타임아웃"
    );
    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    if (result.__error__) {
      throw new Error(`CBD 모델 오류: ${result.error_message}`);
    }
    return result;
  } catch (error: any) {
    throw new Error(`CBD 모델 실행 오류: ${error?.message || String(error)}`);
  }
}

/**
 * APC 모델을 Python으로 실행합니다
 */
export async function fitAPCModelPython(
  data: any[],
  ageColumn: string,
  yearColumn: string,
  deathsColumn: string,
  exposureColumn: string,
  timeoutMs: number = 120000
): Promise<any> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃"
    );
    await withTimeout(
      py.loadPackage(["numpy", "pandas", "scipy"]),
      60000,
      "패키지 설치 타임아웃"
    );

    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_data", data);
    py.globals.set("js_age_column", ageColumn);
    py.globals.set("js_year_column", yearColumn);
    py.globals.set("js_deaths_column", deathsColumn);
    py.globals.set("js_exposure_column", exposureColumn);

    const code = `
import json
import pandas as pd
import numpy as np
import traceback

try:
    rows = js_data.to_py()
    df = pd.DataFrame(rows)
    df = df.fillna(0)
    result = fit_apc_model(df, str(js_age_column), str(js_year_column), str(js_deaths_column), str(js_exposure_column))
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {'__error__': True, 'error_type': type(e).__name__, 'error_message': str(e), 'error_traceback': error_traceback}
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "APC 모델 실행 타임아웃"
    );
    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    if (result.__error__) {
      throw new Error(`APC 모델 오류: ${result.error_message}`);
    }
    return result;
  } catch (error: any) {
    throw new Error(`APC 모델 실행 오류: ${error?.message || String(error)}`);
  }
}

/**
 * RH 모델을 Python으로 실행합니다
 */
export async function fitRHModelPython(
  data: any[],
  ageColumn: string,
  yearColumn: string,
  deathsColumn: string,
  exposureColumn: string,
  timeoutMs: number = 120000
): Promise<any> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃"
    );
    await withTimeout(
      py.loadPackage(["numpy", "pandas", "scipy"]),
      60000,
      "패키지 설치 타임아웃"
    );

    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_data", data);
    py.globals.set("js_age_column", ageColumn);
    py.globals.set("js_year_column", yearColumn);
    py.globals.set("js_deaths_column", deathsColumn);
    py.globals.set("js_exposure_column", exposureColumn);

    const code = `
import json
import pandas as pd
import numpy as np
import traceback

try:
    rows = js_data.to_py()
    df = pd.DataFrame(rows)
    df = df.fillna(0)
    result = fit_rh_model(df, str(js_age_column), str(js_year_column), str(js_deaths_column), str(js_exposure_column))
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {'__error__': True, 'error_type': type(e).__name__, 'error_message': str(e), 'error_traceback': error_traceback}
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "RH 모델 실행 타임아웃"
    );
    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    if (result.__error__) {
      throw new Error(`RH 모델 오류: ${result.error_message}`);
    }
    return result;
  } catch (error: any) {
    throw new Error(`RH 모델 실행 오류: ${error?.message || String(error)}`);
  }
}

/**
 * Plat 모델을 Python으로 실행합니다
 */
export async function fitPlatModelPython(
  data: any[],
  ageColumn: string,
  yearColumn: string,
  deathsColumn: string,
  exposureColumn: string,
  timeoutMs: number = 120000
): Promise<any> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃"
    );
    await withTimeout(
      py.loadPackage(["numpy", "pandas", "scipy"]),
      60000,
      "패키지 설치 타임아웃"
    );

    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_data", data);
    py.globals.set("js_age_column", ageColumn);
    py.globals.set("js_year_column", yearColumn);
    py.globals.set("js_deaths_column", deathsColumn);
    py.globals.set("js_exposure_column", exposureColumn);

    const code = `
import json
import pandas as pd
import numpy as np
import traceback

try:
    rows = js_data.to_py()
    df = pd.DataFrame(rows)
    df = df.fillna(0)
    result = fit_plat_model(df, str(js_age_column), str(js_year_column), str(js_deaths_column), str(js_exposure_column))
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {'__error__': True, 'error_type': type(e).__name__, 'error_message': str(e), 'error_traceback': error_traceback}
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Plat 모델 실행 타임아웃"
    );
    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    if (result.__error__) {
      throw new Error(`Plat 모델 오류: ${result.error_message}`);
    }
    return result;
  } catch (error: any) {
    throw new Error(`Plat 모델 실행 오류: ${error?.message || String(error)}`);
  }
}

/**
 * P-Spline 모델을 Python으로 실행합니다
 */
export async function fitPSplineModelPython(
  data: any[],
  ageColumn: string,
  yearColumn: string,
  deathsColumn: string,
  exposureColumn: string,
  nKnots: number = 10,
  timeoutMs: number = 120000
): Promise<any> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃"
    );
    await withTimeout(
      py.loadPackage(["numpy", "pandas", "scipy"]),
      60000,
      "패키지 설치 타임아웃"
    );

    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_data", data);
    py.globals.set("js_age_column", ageColumn);
    py.globals.set("js_year_column", yearColumn);
    py.globals.set("js_deaths_column", deathsColumn);
    py.globals.set("js_exposure_column", exposureColumn);
    py.globals.set("js_n_knots", nKnots);

    const code = `
import json
import pandas as pd
import numpy as np
import traceback

try:
    rows = js_data.to_py()
    df = pd.DataFrame(rows)
    df = df.fillna(0)
    n_knots = int(js_n_knots)
    result = fit_pspline_model(df, str(js_age_column), str(js_year_column), str(js_deaths_column), str(js_exposure_column), n_knots)
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {'__error__': True, 'error_type': type(e).__name__, 'error_message': str(e), 'error_traceback': error_traceback}
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "P-Spline 모델 실행 타임아웃"
    );
    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    if (result.__error__) {
      throw new Error(`P-Spline 모델 오류: ${result.error_message}`);
    }
    return result;
  } catch (error: any) {
    throw new Error(
      `P-Spline 모델 실행 오류: ${error?.message || String(error)}`
    );
  }
}

/**
 * Mortality Result - 여러 모델 비교
 */
/**
 * VIF Checker를 Python으로 실행합니다
 * 타임아웃: 60초
 */
export async function calculateVIFPython(
  data: any[],
  featureColumns: string[],
  timeoutMs: number = 60000
): Promise<Array<{ column: string; vif: number }>> {
  let py: any = null;
  try {
    // Pyodide 로드 (타임아웃: 30초)
    try {
      py = await withTimeout(
        loadPyodide(30000),
        30000,
        "Pyodide 로딩 타임아웃 (30초 초과)"
      );
    } catch (loadError: any) {
      const loadErrorMessage = loadError.message || String(loadError);
      if (
        loadErrorMessage.includes("Failed to fetch") ||
        loadErrorMessage.includes("NetworkError")
      ) {
        throw new Error(
          `Pyodide CDN 로드 실패: 네트워크 연결을 확인하거나 인터넷 연결이 필요합니다. ${loadErrorMessage}`
        );
      }
      throw new Error(`Pyodide 로드 실패: ${loadErrorMessage}`);
    }

    // 패키지 로드
    await withTimeout(
      py.loadPackage(["pandas", "numpy", "statsmodels"]),
      60000,
      "패키지 설치 타임아웃 (60초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_feature_columns", featureColumns);

    // Python 코드 실행 (에러 처리 포함)
    const code = `
import json
import traceback
import sys
import pandas as pd
import numpy as np
from statsmodels.stats.outliers_influence import variance_inflation_factor

try:
    # 데이터프레임 생성
    dataframe = pd.DataFrame(js_data.to_py())
    
    # Feature columns 확인
    feature_cols = js_feature_columns.to_py()
    
    # 선택된 feature columns가 DataFrame에 있는지 확인
    missing_cols = [col for col in feature_cols if col not in dataframe.columns]
    if missing_cols:
        raise ValueError(f"Columns not found in DataFrame: {missing_cols}")
    
    # Feature columns만 선택
    X = dataframe[feature_cols].copy()
    
    # 결측치가 있는 행 제거
    X = X.dropna()
    
    if len(X) == 0:
        raise ValueError("No valid data after removing missing values")
    
    if len(feature_cols) < 2:
        raise ValueError("At least 2 feature columns are required for VIF calculation")
    
    # VIF 계산
    vif_data = pd.DataFrame()
    vif_data["Column"] = feature_cols
    vif_data["VIF"] = [
        variance_inflation_factor(X.values, i)
        for i in range(len(feature_cols))
    ]
    
    # 결과를 딕셔너리 리스트로 변환
    result = vif_data.to_dict("records")
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      `Python VIF calculation 실행 타임아웃 (${timeoutMs / 1000}초 초과)`
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python VIF calculation error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result && result.__error__) {
      throw new Error(
        `Python VIF calculation error:\n${
          result.error_traceback || result.error_message
        }`
      );
    }

    // 결과 검증
    if (!Array.isArray(result)) {
      throw new Error(`Python VIF calculation error: Result is not an array.`);
    }

    // 결과를 올바른 형식으로 변환
    const vifResults = result.map((item: any) => ({
      column: item.Column || item.column,
      vif: typeof item.VIF === "number" ? item.VIF : parseFloat(item.VIF) || 0,
    }));

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_feature_columns");
    py.globals.delete("js_result");

    return vifResults;
  } catch (error: any) {
    throw new Error(
      `VIF calculation 실행 오류: ${error?.message || String(error)}`
    );
  }
}

export async function compareMortalityModelsPython(
  modelResults: Array<{ modelType: string; result: any }>,
  timeoutMs: number = 180000
): Promise<any> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃"
    );
    await withTimeout(
      py.loadPackage(["numpy", "pandas", "scipy", "matplotlib"]),
      60000,
      "패키지 설치 타임아웃"
    );

    const response = await fetch("/data_analysis_modules.py");
    const pythonCode = await response.text();
    py.runPython(pythonCode);

    py.globals.set("js_model_results", modelResults);

    const code = `
import json
import pandas as pd
import numpy as np
import traceback

try:
    model_results = js_model_results.to_py()
    result = compare_mortality_models(model_results)
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {'__error__': True, 'error_type': type(e).__name__, 'error_message': str(e), 'error_traceback': error_traceback}
`;

    const resultPyObj = await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Mortality Result 실행 타임아웃"
    );
    const result = resultPyObj.toJs({ dict_converter: Object.fromEntries });

    if (result.__error__) {
      throw new Error(`Mortality Result 오류: ${result.error_message}`);
    }
    return result;
  } catch (error: any) {
    throw new Error(
      `Mortality Result 실행 오류: ${error?.message || String(error)}`
    );
  }
}

/**
 * 회귀 모형용 scatter plot을 생성하여 base64 이미지로 반환합니다
 * 타임아웃: 60초
 */
export async function generateRegressionPlotPython(
  data: any[],
  labelColumn: string,
  predictionColumn: string,
  timeoutMs: number = 60000
): Promise<string> {
  try {
    // Pyodide 로드 (타임아웃: 30초)
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    // matplotlib 패키지 설치
    await withTimeout(
      py.loadPackage(["matplotlib"]),
      60000,
      "matplotlib 패키지 설치 타임아웃 (60초 초과)"
    );

    // 데이터를 Python에 전달
    py.globals.set("js_data", data);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_prediction_column", predictionColumn);

    // Python 코드 실행
    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import sys
import base64
import io
import matplotlib
matplotlib.use('Agg')  # GUI 백엔드 사용 안 함
import matplotlib.pyplot as plt

try:
    # 데이터 준비
    df = pd.DataFrame(js_data.to_py())
    label_column = str(js_label_column)
    prediction_column = str(js_prediction_column)
    
    # 데이터 검증
    if df.empty:
        raise ValueError("DataFrame is empty")
    if label_column not in df.columns:
        raise ValueError(f"Label column '{label_column}' not found in DataFrame")
    if prediction_column not in df.columns:
        raise ValueError(f"Prediction column '{prediction_column}' not found in DataFrame")
    
    # 인덱스 리셋 (정렬을 위해)
    df = df.reset_index(drop=True)
    
    # actual 값 정렬 (x축 순서를 위해)
    df_sorted = df.sort_values(by=label_column).reset_index(drop=True)
    
    # scatter plot 생성
    plt.figure(figsize=(12, 9))
    plt.scatter(df_sorted.index, df_sorted[prediction_column], marker='x', color='r', label='prediction')
    plt.scatter(df_sorted.index, df_sorted[label_column], alpha=0.3, marker='o', color='black', label='actual')
    plt.title("prediction Result in Test Set", fontsize=20)
    plt.xlabel("Index (sorted by actual)")
    plt.ylabel("Value")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    # 이미지를 base64로 변환
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    result = {
        'image_base64': image_base64
    }
    
    # 전역 변수에 저장
    js_result = result
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    error_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
    # 전역 변수에 저장
    js_result = error_result
`;

    // Python 코드 실행
    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Regression Plot 실행 타임아웃 (60초 초과)"
    );

    // 전역 변수에서 결과 가져오기
    const resultPyObj = py.globals.get("js_result");

    // 결과 객체 검증
    if (!resultPyObj) {
      throw new Error(
        `Python Regression Plot error: Python code returned None or undefined.`
      );
    }

    // Python 딕셔너리를 JavaScript 객체로 변환
    const result = fromPython(resultPyObj);

    // 에러가 발생한 경우 처리
    if (result.__error__) {
      throw new Error(
        `Python Regression Plot error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }

    // 필수 속성 검증
    if (!result.image_base64 || typeof result.image_base64 !== "string") {
      throw new Error(
        `Python Regression Plot error: Missing or invalid 'image_base64' in result.`
      );
    }

    // 정리
    py.globals.delete("js_data");
    py.globals.delete("js_label_column");
    py.globals.delete("js_prediction_column");
    py.globals.delete("js_result");

    return result.image_base64;
  } catch (error: any) {
    // 정리
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_label_column");
        py.globals.delete("js_prediction_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Regression Plot error:\n${errorMessage}`);
  }
}

/**
 * 회귀 잔차 진단 플롯(잔차 = 예측 - 실제)을 base64 PNG로 생성합니다(앱 표시용).
 * 좌: 잔차 vs 실제 산점도(0 기준선) — 체계적 패턴/깔때기 확인.
 * 우: 잔차 히스토그램 — 치우침(skew)·이상치 확인.
 * Elston식 "잔차 심문"의 시각화(제9부 28.6). 내보낸 코드/재현성과 무관(앱 표시용).
 */
export async function generateResidualPlotPython(
  data: any[],
  labelColumn: string,
  predictionColumn: string,
  timeoutMs: number = 60000
): Promise<string> {
  try {
    const py = await withTimeout(
      loadPyodide(30000),
      30000,
      "Pyodide 로딩 타임아웃 (30초 초과)"
    );

    await withTimeout(
      py.loadPackage(["matplotlib"]),
      60000,
      "matplotlib 패키지 설치 타임아웃 (60초 초과)"
    );

    py.globals.set("js_data", data);
    py.globals.set("js_label_column", labelColumn);
    py.globals.set("js_prediction_column", predictionColumn);

    const code = `
import json
import numpy as np
import pandas as pd
import traceback
import base64
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

try:
    df = pd.DataFrame(js_data.to_py())
    label_column = str(js_label_column)
    prediction_column = str(js_prediction_column)

    if df.empty:
        raise ValueError("DataFrame is empty")
    if label_column not in df.columns:
        raise ValueError(f"Label column '{label_column}' not found in DataFrame")
    if prediction_column not in df.columns:
        raise ValueError(f"Prediction column '{prediction_column}' not found in DataFrame")

    actual = pd.to_numeric(df[label_column], errors='coerce')
    pred = pd.to_numeric(df[prediction_column], errors='coerce')
    resid = (pred - actual).dropna()
    actual_v = actual.loc[resid.index]

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    # 좌: 잔차 vs 실제
    axes[0].scatter(actual_v, resid, alpha=0.3, color='red', marker='o')
    axes[0].axhline(0, color='black', linewidth=1)
    axes[0].set_title("Residuals vs Actual", fontsize=16)
    axes[0].set_xlabel("Actual")
    axes[0].set_ylabel("Residual (pred - actual)")
    axes[0].grid(True, alpha=0.3)
    # 우: 잔차 히스토그램
    axes[1].hist(resid, bins=40, color='steelblue', alpha=0.8)
    axes[1].axvline(0, color='black', linewidth=1)
    axes[1].set_title("Residual Distribution", fontsize=16)
    axes[1].set_xlabel("Residual (pred - actual)")
    axes[1].set_ylabel("Count")
    axes[1].grid(True, alpha=0.3)
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()

    js_result = {'image_base64': image_base64}
except Exception as e:
    error_traceback = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    js_result = {
        '__error__': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': error_traceback
    }
`;

    await withTimeout(
      Promise.resolve(py.runPython(code)),
      timeoutMs,
      "Python Residual Plot 실행 타임아웃 (60초 초과)"
    );

    const resultPyObj = py.globals.get("js_result");
    if (!resultPyObj) {
      throw new Error(
        `Python Residual Plot error: Python code returned None or undefined.`
      );
    }

    const result = fromPython(resultPyObj);
    if (result.__error__) {
      throw new Error(
        `Python Residual Plot error:\n${
          result.error_traceback || result.error_message || "Unknown error"
        }`
      );
    }
    if (!result.image_base64 || typeof result.image_base64 !== "string") {
      throw new Error(
        `Python Residual Plot error: Missing or invalid 'image_base64' in result.`
      );
    }

    py.globals.delete("js_data");
    py.globals.delete("js_label_column");
    py.globals.delete("js_prediction_column");
    py.globals.delete("js_result");

    return result.image_base64;
  } catch (error: any) {
    try {
      const py = pyodide;
      if (py) {
        py.globals.delete("js_data");
        py.globals.delete("js_label_column");
        py.globals.delete("js_prediction_column");
        py.globals.delete("js_result");
      }
    } catch {}

    const errorMessage = error.message || String(error);
    throw new Error(`Python Residual Plot error:\n${errorMessage}`);
  }
}

// =====================================================================
// JMDC Analysis Helpers (PRD v2.0 §17, J1~J7)
// All analyses run in Python via Pyodide. lifelines is installed lazily
// via micropip on first use of J4/J5/J6.
// =====================================================================

let lifelinesInstalled = false;
async function ensureLifelinesInstalled(): Promise<void> {
  if (lifelinesInstalled) return;
  const py = await loadPyodide();
  notifyStatus("lifelines 패키지 설치 중... (최초 1회)", 70);
  try {
    await py.loadPackagesFromImports("import micropip");
    // Pyodide ships pandas 1.5.x; newer lifelines (>=0.28) demands pandas>=2.1
    // and breaks. Install the last lifelines version compatible with pandas 1.5.
    await py.runPythonAsync(`
import micropip
try:
    import lifelines  # already available?
except ImportError:
    # Try a compatible version chain. autograd-gamma is a lifelines dep.
    for spec in ["lifelines==0.27.8", "lifelines==0.27.4", "lifelines"]:
        try:
            await micropip.install(spec, keep_going=True)
            import lifelines  # noqa: F401
            break
        except Exception as _exc:
            last_error = _exc
            continue
    else:
        raise last_error
`);
    lifelinesInstalled = true;
    notifyStatus("", 0);
  } catch (e: any) {
    notifyStatus("", 0);
    throw new Error(`lifelines 설치 실패: ${e.message || e}`);
  }
}

async function runJMDCAnalysis(
  pythonCode: string,
  inputs: Record<string, any>,
  timeoutMs: number
): Promise<any> {
  const py = await loadPyodide();
  for (const [k, v] of Object.entries(inputs)) {
    py.globals.set(k, JSON.stringify(v));
  }
  try {
    // Sanitiser: replace NaN/Inf with null so JSON parsing on the JS side works.
    const sanitiseHelper = `
def _jmdc_clean(o):
    import math
    if isinstance(o, float):
        if math.isnan(o) or math.isinf(o):
            return None
        return o
    if isinstance(o, dict):
        return {k: _jmdc_clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jmdc_clean(v) for v in o]
    return o
`;
    const wrapped = `${sanitiseHelper}
import json, io, sys, traceback
_buf = io.StringIO()
_old = sys.stdout
sys.stdout = _buf
_err = None
_result_json = None
try:
${pythonCode.split("\n").map((l) => "    " + l).join("\n")}
except Exception as _e:
    _err = traceback.format_exc()
finally:
    sys.stdout = _old
# Re-serialise with NaN/Inf scrubbed so json.loads on JS side works.
if _result_json and not _err:
    try:
        _obj = json.loads(_result_json)
        _result_json = json.dumps(_jmdc_clean(_obj), allow_nan=False)
    except Exception:
        pass
(_result_json, _buf.getvalue(), _err)
`;
    const result = await withTimeout(
      py.runPythonAsync(wrapped),
      timeoutMs,
      `JMDC analysis timed out (${timeoutMs / 1000}s)`
    );
    const tuple = fromPython(result);
    const [resultJson, stdout, err] = Array.isArray(tuple) ? tuple : [null, "", null];
    if (err) {
      throw new Error(`Python error:\n${err}\n--- stdout ---\n${stdout}`);
    }
    if (!resultJson) {
      throw new Error(`No result returned. stdout:\n${stdout}`);
    }
    return typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
  } finally {
    for (const k of Object.keys(inputs)) {
      try { py.globals.delete(k); } catch { /* noop */ }
    }
  }
}

// ----- J1: Cohort Builder (synthetic data 통합) -----
const JMDC_COHORT_PY = `
import json
import numpy as np
import pandas as pd
from dateutil.relativedelta import relativedelta

_params = json.loads(js_params)
_input_rows = json.loads(js_input_rows) if js_input_rows else None

def make_synthetic(n, seed):
    rng = np.random.default_rng(seed)
    sex = rng.choice(['M', 'F'], size=n, p=[0.52, 0.48])
    age_now = np.clip(rng.normal(48, 14, n).round(), 20, 80).astype(int)
    birth_date = pd.Timestamp('2025-01-01') - pd.to_timedelta((age_now * 365.25).astype(int), unit='D')
    obs_start = pd.to_datetime('2015-01-01') + pd.to_timedelta(rng.integers(0, 365*6, n), unit='D')
    obs_end = obs_start + pd.to_timedelta(rng.integers(365*3, 365*8, n), unit='D')
    bmi = np.clip(rng.normal(23.5, 3.5, n), 14, 45)
    # diabetes prevalence varies by age
    diab_p = np.where(age_now >= 50, 0.18, np.where(age_now >= 30, 0.08, 0.04))
    has_diabetes = (rng.uniform(0, 1, n) < diab_p).astype(int)
    has_htn = (rng.uniform(0, 1, n) < 0.28).astype(int)
    charlson = np.clip(rng.poisson(0.4 + has_diabetes * 0.6 + has_htn * 0.2, n), 0, 8)
    df = pd.DataFrame({
        'member_id': [f'M{1000000+i}' for i in range(n)],
        'sex_code': sex,
        'birth_date': birth_date,
        'first_obs_date': obs_start,
        'last_obs_date': obs_end,
        'bmi': bmi.round(1),
        'has_diabetes': has_diabetes,
        'has_htn': has_htn,
        'charlson': charlson,
    })
    # generate synthetic event dates for outcomes used by J2
    # 5y rates from PRD §17.5
    base_rates = {
        'colon_ca':  {'ndm': 0.012, 'dm': 0.017},
        'ami':       {'ndm': 0.009, 'dm': 0.018},
        'stroke':    {'ndm': 0.014, 'dm': 0.025},
        'diabetes':  {'ndm': 0.000, 'dm': 0.000},  # exposure, not outcome
    }
    event_records = []
    for outcome, rates in base_rates.items():
        if outcome == 'diabetes':
            continue
        p = np.where(has_diabetes == 1, rates['dm'], rates['ndm'])
        will_event = rng.uniform(0, 1, n) < p
        # spread event day uniformly across 5y
        days_after_start = rng.integers(0, 365*5, n)
        for i in np.where(will_event)[0]:
            event_records.append({
                'member_id': df.iloc[i]['member_id'],
                'icd10_code': {'colon_ca': 'C18', 'ami': 'I21', 'stroke': 'I63'}[outcome],
                'onset_date': df.iloc[i]['first_obs_date'] + pd.Timedelta(days=int(days_after_start[i])),
                'suspect_flag': bool(rng.uniform(0, 1) < 0.08),
            })
    # death (5y)
    will_die = rng.uniform(0, 1, n) < 0.015
    for i in np.where(will_die)[0]:
        event_records.append({
            'member_id': df.iloc[i]['member_id'],
            'icd10_code': 'R99',
            'onset_date': df.iloc[i]['first_obs_date'] + pd.Timedelta(days=int(rng.integers(0, 365*5))),
            'suspect_flag': False,
        })
    claims_disease = pd.DataFrame(event_records)
    return df, claims_disease

# 1. Source
if _params['data_source'] == 'synthetic' or _input_rows is None:
    members, claims_disease = make_synthetic(int(_params['synthetic_n']), int(_params['synthetic_seed']))
else:
    members = pd.DataFrame(_input_rows)
    members['birth_date'] = pd.to_datetime(members['birth_date'])
    members['first_obs_date'] = pd.to_datetime(members['first_obs_date'])
    members['last_obs_date'] = pd.to_datetime(members['last_obs_date'])
    claims_disease = pd.DataFrame()  # downstream J2 supplies its own when external

funnel = [{'step': 'Source loaded', 'remaining': int(len(members))}]

# 2. Index Date
rule = _params['index_date_rule']
if rule == 'birthday_age':
    age = int(_params['index_age'])
    members['index_date'] = members['birth_date'] + pd.to_timedelta(int(age * 365.25), unit='D')
elif rule == 'fixed_date':
    members['index_date'] = pd.to_datetime(_params['index_fixed_date'])
else:
    members['index_date'] = members['first_obs_date']

# 3. Washout (Index Date 이전 최소 관측 연수)
washout_days = int(float(_params['washout_years']) * 365.25)
keep = members['first_obs_date'] <= (members['index_date'] - pd.Timedelta(days=washout_days))
keep &= members['last_obs_date'] >= members['index_date']
members['_washout_pass'] = keep
exclusion_log = {}
exclusion_log['washout_fail'] = int((~keep).sum())
members = members[keep].copy()
funnel.append({'step': f'After washout ({_params["washout_years"]}y)', 'remaining': int(len(members))})

# 4. Age window
members['age_at_index'] = ((members['index_date'] - members['birth_date']).dt.days / 365.25).astype(int)
age_min = int(_params['age_at_index_min']); age_max = int(_params['age_at_index_max'])
age_mask = (members['age_at_index'] >= age_min) & (members['age_at_index'] <= age_max)
exclusion_log['age_out_of_range'] = int((~age_mask).sum())
members = members[age_mask].copy()
funnel.append({'step': f'Age window [{age_min}, {age_max}]', 'remaining': int(len(members))})

# 5. Exclusion by ICD-10 (claims_disease 가 있을 때만)
def expand_icd_prefixes(prefixes):
    out = set()
    for p in prefixes:
        if '-' in p and len(p) >= 7 and p[0] == p[4]:  # 'C00-C97'
            letter = p[0]
            lo = int(p[1:3]); hi = int(p[5:7])
            for x in range(lo, hi + 1):
                out.add(f'{letter}{x:02d}')
        else:
            out.add(p)
    return out

exclusion_prefixes = expand_icd_prefixes(_params.get('exclusion_diseases', []))
disease_free_yrs = float(_params.get('disease_free_years', 0))
if len(claims_disease) > 0 and (exclusion_prefixes or disease_free_yrs > 0):
    claims_disease['onset_date'] = pd.to_datetime(claims_disease['onset_date'])
    if exclusion_prefixes:
        prefix_mask = claims_disease['icd10_code'].str[:3].isin(exclusion_prefixes)
        excluded = claims_disease[prefix_mask][['member_id', 'onset_date']]
        merged = members.merge(excluded, on='member_id', how='left', suffixes=('', '_dx'))
        if disease_free_yrs > 0:
            window_start = members['index_date'].repeat(merged.groupby('member_id').size() if False else 1)
            cutoff = members.set_index('member_id')['index_date'] - pd.Timedelta(days=int(disease_free_yrs * 365.25))
            bad_ids = set()
            for mid, sub in merged.groupby('member_id'):
                idx_dt = members.loc[members['member_id'] == mid, 'index_date'].iloc[0]
                cutoff_dt = idx_dt - pd.Timedelta(days=int(disease_free_yrs * 365.25))
                if sub['onset_date'].dropna().between(cutoff_dt, idx_dt).any():
                    bad_ids.add(mid)
            exclude_mask = members['member_id'].isin(bad_ids)
        else:
            exclude_mask = members['member_id'].isin(excluded['member_id'])
        exclusion_log['exclusion_icd'] = int(exclude_mask.sum())
        members = members[~exclude_mask].copy()
        funnel.append({'step': f'ICD exclusion {sorted(list(exclusion_prefixes))[:3]}…', 'remaining': int(len(members))})

# 6. Age band
members['age_band'] = pd.cut(members['age_at_index'],
                              bins=[0, 29, 39, 49, 59, 69, 200],
                              labels=['<30', '30-39', '40-49', '50-59', '60-69', '70+']).astype(str)

# Distributions
sex_dist = members['sex_code'].value_counts().to_dict()
ageband_dist = members['age_band'].value_counts().to_dict()

# Output rows: full member row + claims_disease piggy-backed for J2 via attribute
# We persist members in the dataframe; claims_disease are tracked in payload meta.
output_columns = ['member_id', 'index_date', 'age_at_index', 'sex_code', 'age_band',
                  'bmi', 'has_diabetes', 'has_htn', 'charlson',
                  'first_obs_date', 'last_obs_date']
output_columns = [c for c in output_columns if c in members.columns]
out = members[output_columns].copy()
out['index_date'] = out['index_date'].dt.strftime('%Y-%m-%d')
if 'first_obs_date' in out.columns:
    out['first_obs_date'] = pd.to_datetime(out['first_obs_date']).dt.strftime('%Y-%m-%d')
if 'last_obs_date' in out.columns:
    out['last_obs_date'] = pd.to_datetime(out['last_obs_date']).dt.strftime('%Y-%m-%d')
rows_out = out.to_dict(orient='records')

# claims_disease for J2 — keep as separate payload key
cd_out = None
if len(claims_disease) > 0:
    cd = claims_disease.copy()
    cd['onset_date'] = pd.to_datetime(cd['onset_date']).dt.strftime('%Y-%m-%d')
    cd_out = cd.to_dict(orient='records')

_result_json = json.dumps({
    'rows': rows_out,
    'columns': [{'name': c, 'type': 'string' if c in ('member_id', 'index_date', 'sex_code', 'age_band', 'first_obs_date', 'last_obs_date') else 'float64'} for c in output_columns],
    'totalRowCount': len(rows_out),
    'funnel': funnel,
    'sexDistribution': {str(k): int(v) for k, v in sex_dist.items()},
    'ageBandDistribution': {str(k): int(v) for k, v in ageband_dist.items()},
    'exclusionReasons': {k: int(v) for k, v in exclusion_log.items()},
    'dataSource': _params['data_source'],
    'parameters': _params,
    '_claims_disease': cd_out,
}, default=str)
`;

export async function performJMDCCohort(
  inputRows: Record<string, any>[] | null,
  params: Record<string, any>,
  timeoutMs: number = 120000
): Promise<any> {
  return runJMDCAnalysis(JMDC_COHORT_PY, {
    js_params: params,
    js_input_rows: inputRows,
  }, timeoutMs);
}

// ----- J2: Outcome Labeler -----
const JMDC_OUTCOME_PY = `
import json
import numpy as np
import pandas as pd

_params = json.loads(js_params)
_cohort_rows = json.loads(js_cohort_rows)
_claims_rows = json.loads(js_claims_rows) if js_claims_rows else []

cohort = pd.DataFrame(_cohort_rows)
cohort['index_date'] = pd.to_datetime(cohort['index_date'])
if 'last_obs_date' in cohort.columns:
    cohort['last_obs_date'] = pd.to_datetime(cohort['last_obs_date'])

claims = pd.DataFrame(_claims_rows) if _claims_rows else pd.DataFrame(columns=['member_id', 'icd10_code', 'onset_date', 'suspect_flag'])
if len(claims) > 0:
    claims['onset_date'] = pd.to_datetime(claims['onset_date'])

outcome_dx = _params['outcome_diseases']
window_yrs = float(_params['outcome_window_years'])
confirm = bool(_params['confirm_suspect_flag'])
mode = _params['multi_outcome_mode']

# end_of_window per member
cohort['_end_window'] = cohort['index_date'] + pd.Timedelta(days=int(window_yrs * 365.25))

# Build first-event dates per outcome label
first_events = {}
for label, prefixes in outcome_dx.items():
    if len(claims) == 0:
        first_events[label] = pd.Series(pd.NaT, index=[])
        continue
    mask = claims['icd10_code'].astype(str).str[:3].isin(prefixes)
    if confirm and 'suspect_flag' in claims.columns:
        mask &= ~claims['suspect_flag'].fillna(False).astype(bool)
    sub = claims[mask].groupby('member_id')['onset_date'].min()
    first_events[label] = sub

# Per-row event resolution
def resolve_row(row, label, fe_series):
    mid = row['member_id']
    evt = fe_series.get(mid, pd.NaT) if isinstance(fe_series, pd.Series) else pd.NaT
    end_w = row['_end_window']
    idx = row['index_date']
    last_obs = row.get('last_obs_date', end_w)
    if pd.notna(evt) and evt <= end_w and evt >= idx:
        return {
            'outcome_type': label,
            'first_event_date': evt.strftime('%Y-%m-%d'),
            'time_to_event_days': int((evt - idx).days),
            'event_flag': 1,
            'censor_reason': 'event',
        }
    # censoring
    censor_dt = min(end_w, last_obs) if pd.notna(last_obs) else end_w
    reason = 'lost_followup' if pd.notna(last_obs) and last_obs < end_w else 'admin_censor'
    return {
        'outcome_type': label,
        'first_event_date': None,
        'time_to_event_days': max(0, int((censor_dt - idx).days)),
        'event_flag': 0,
        'censor_reason': reason,
    }

if mode == 'long':
    records = []
    for _, row in cohort.iterrows():
        for label in outcome_dx.keys():
            r = dict(row)
            r.update(resolve_row(row, label, first_events.get(label)))
            records.append(r)
    out = pd.DataFrame(records)
else:
    # single mode: combine outcomes — choose earliest event across outcomes
    out_rows = []
    for _, row in cohort.iterrows():
        earliest = None
        earliest_label = None
        for label, fe in first_events.items():
            evt = fe.get(row['member_id'], pd.NaT) if isinstance(fe, pd.Series) else pd.NaT
            if pd.notna(evt) and evt <= row['_end_window'] and evt >= row['index_date']:
                if earliest is None or evt < earliest:
                    earliest = evt
                    earliest_label = label
        r = dict(row)
        if earliest is not None:
            r.update({
                'outcome_type': earliest_label,
                'first_event_date': earliest.strftime('%Y-%m-%d'),
                'time_to_event_days': int((earliest - row['index_date']).days),
                'event_flag': 1,
                'censor_reason': 'event',
            })
        else:
            last_obs = row.get('last_obs_date', row['_end_window'])
            censor_dt = min(row['_end_window'], last_obs) if pd.notna(last_obs) else row['_end_window']
            reason = 'lost_followup' if (pd.notna(last_obs) and last_obs < row['_end_window']) else 'admin_censor'
            r.update({
                'outcome_type': 'composite',
                'first_event_date': None,
                'time_to_event_days': max(0, int((censor_dt - row['index_date']).days)),
                'event_flag': 0,
                'censor_reason': reason,
            })
        out_rows.append(r)
    out = pd.DataFrame(out_rows)

# drop helper
out = out.drop(columns=['_end_window'], errors='ignore')
out['index_date'] = pd.to_datetime(out['index_date']).dt.strftime('%Y-%m-%d')
if 'last_obs_date' in out.columns:
    out['last_obs_date'] = pd.to_datetime(out['last_obs_date']).dt.strftime('%Y-%m-%d')

# Summaries
total = int(len(out))
events_n = int(out['event_flag'].sum())
censored_n = total - events_n
censor_reasons = out[out['event_flag'] == 0]['censor_reason'].value_counts().to_dict() if censored_n > 0 else {}

outcome_breakdown = {}
for label in (outcome_dx.keys() if mode == 'long' else list(set(out['outcome_type'].dropna().unique()))):
    sub = out[out['outcome_type'] == label]
    if len(sub) == 0:
        continue
    e = int(sub['event_flag'].sum())
    py_total = max(1.0, (sub['time_to_event_days'].sum() / 365.25))
    outcome_breakdown[label] = {'events': e, 'rate': float(e / py_total * 1000)}

columns_meta = []
for c in out.columns:
    dtype = str(out[c].dtype)
    t = 'int64' if dtype.startswith('int') else 'float64' if dtype.startswith('float') else 'string'
    columns_meta.append({'name': c, 'type': t})

rows_out = out.head(1000).to_dict(orient='records')  # cap preview at 1k for UI

_result_json = json.dumps({
    'rows': rows_out,
    'allRows': out.to_dict(orient='records'),  # full for downstream
    'columns': columns_meta,
    'totalRowCount': int(len(out)),
    'eventSummary': {
        'total': total,
        'events': events_n,
        'censored': censored_n,
        'censorReasons': {str(k): int(v) for k, v in censor_reasons.items()},
    },
    'outcomeBreakdown': outcome_breakdown,
}, default=str)
`;

export async function performJMDCOutcomeLabeler(
  cohortRows: Record<string, any>[],
  claimsRows: Record<string, any>[] | null,
  params: Record<string, any>,
  timeoutMs: number = 120000
): Promise<any> {
  return runJMDCAnalysis(JMDC_OUTCOME_PY, {
    js_params: params,
    js_cohort_rows: cohortRows,
    js_claims_rows: claimsRows,
  }, timeoutMs);
}

// ----- J3: Incidence Rate -----
const JMDC_INCIDENCE_PY = `
import json
import numpy as np
import pandas as pd

_params = json.loads(js_params)
_rows = json.loads(js_rows)

df = pd.DataFrame(_rows)
df['py'] = df['time_to_event_days'].astype(float) / 365.25

# Stratification
stratify = _params.get('stratify_by', 'none')
if stratify == 'sex':
    cols = ['sex_code']
elif stratify == 'age_band':
    cols = ['age_band']
elif stratify == 'sex_age':
    cols = ['sex_code', 'age_band']
else:
    cols = []

if cols:
    g = df.groupby(cols)
else:
    g = df.groupby(lambda _: 'overall')

agg = g.agg(N=('member_id', 'nunique'),
            events=('event_flag', 'sum'),
            person_years=('py', 'sum')).reset_index()

unit_map = {'1000_PY': 1000, '10000_PY': 10000, '100000_PY': 100000}
unit = unit_map.get(_params.get('rate_unit', '1000_PY'), 1000)

agg['crude_rate'] = agg['events'] / agg['person_years'].replace(0, np.nan) * unit
# Byar's CI
o = np.maximum(agg['events'].astype(float), 0.5)
agg['crude_ci_lo'] = (o * (1 - 1/(9*o) - 1.96/(3*np.sqrt(o)))**3 / agg['person_years'].replace(0, np.nan)) * unit
agg['crude_ci_hi'] = ((o+1) * (1 - 1/(9*(o+1)) + 1.96/(3*np.sqrt(o+1)))**3 / agg['person_years'].replace(0, np.nan)) * unit

# Direct standardisation if requested
std_pop = _params.get('standard_population', 'internal')
STANDARD_POPS = {
    'WHO_2000':  {'<30': 0.46, '30-39': 0.16, '40-49': 0.13, '50-59': 0.10, '60-69': 0.08, '70+': 0.07},
    'japan_2015':{'<30': 0.27, '30-39': 0.13, '40-49': 0.14, '50-59': 0.13, '60-69': 0.15, '70+': 0.18},
    'korea_2020':{'<30': 0.29, '30-39': 0.14, '40-49': 0.16, '50-59': 0.17, '60-69': 0.13, '70+': 0.11},
}
if std_pop in STANDARD_POPS and 'age_band' in cols:
    w = STANDARD_POPS[std_pop]
    agg['_w'] = agg['age_band'].astype(str).map(w).fillna(0)
    # normalise weights within each non-age stratum or overall
    other = [c for c in cols if c != 'age_band']
    if other:
        agg['_w'] = agg.groupby(other)['_w'].transform(lambda s: s / s.sum() if s.sum() > 0 else 0)
        agg['std_rate'] = agg['crude_rate'] * agg['_w']
        # leave CI as crude CI scaled by weights as approximation
        agg['std_ci_lo'] = agg['crude_ci_lo'] * agg['_w']
        agg['std_ci_hi'] = agg['crude_ci_hi'] * agg['_w']
    else:
        agg['_w'] = agg['_w'] / agg['_w'].sum()
        agg['std_rate'] = (agg['crude_rate'] * agg['_w']).sum()
        agg['std_ci_lo'] = (agg['crude_ci_lo'] * agg['_w']).sum()
        agg['std_ci_hi'] = (agg['crude_ci_hi'] * agg['_w']).sum()
    agg = agg.drop(columns=['_w'])

# stratum string
if cols:
    agg['stratum'] = agg[cols].astype(str).agg(' | '.join, axis=1)
else:
    agg['stratum'] = 'overall'

rate_table = []
for _, r in agg.iterrows():
    rec = {
        'stratum': str(r['stratum']),
        'N': int(r['N']),
        'person_years': float(r['person_years']),
        'events': int(r['events']),
        'crude_rate': float(r['crude_rate']) if pd.notna(r['crude_rate']) else 0.0,
        'crude_ci_lo': float(r['crude_ci_lo']) if pd.notna(r['crude_ci_lo']) else 0.0,
        'crude_ci_hi': float(r['crude_ci_hi']) if pd.notna(r['crude_ci_hi']) else 0.0,
    }
    if 'std_rate' in agg.columns:
        rec['std_rate'] = float(r['std_rate']) if pd.notna(r['std_rate']) else None
        rec['std_ci_lo'] = float(r['std_ci_lo']) if pd.notna(r['std_ci_lo']) else None
        rec['std_ci_hi'] = float(r['std_ci_hi']) if pd.notna(r['std_ci_hi']) else None
    rate_table.append(rec)

# CIF grid using 1-KM per stratum (analytical)
time_grid = _params.get('time_grid_years', [1, 2, 3, 4, 5])

def km_at_times(times_days, events, t_grid_years):
    """Kaplan-Meier estimator at given time points (years)."""
    if len(times_days) == 0:
        return [0.0] * len(t_grid_years)
    df_loc = pd.DataFrame({'t': times_days, 'e': events}).sort_values('t')
    n_at_risk = len(df_loc)
    surv = 1.0
    grid_results = []
    grid_idx = 0
    t_grid_days = [int(t * 365.25) for t in t_grid_years]
    for t, e in zip(df_loc['t'].values, df_loc['e'].values):
        while grid_idx < len(t_grid_days) and t_grid_days[grid_idx] < t:
            grid_results.append(1.0 - surv)
            grid_idx += 1
        if e == 1 and n_at_risk > 0:
            surv *= (1 - 1.0 / n_at_risk)
        n_at_risk -= 1
    while grid_idx < len(t_grid_days):
        grid_results.append(1.0 - surv)
        grid_idx += 1
    return grid_results

cif_grid = []
if cols:
    for keys, sub in df.groupby(cols):
        stratum_name = ' | '.join([str(k) for k in (keys if isinstance(keys, tuple) else (keys,))])
        cifs = km_at_times(sub['time_to_event_days'].values, sub['event_flag'].values, time_grid)
        for t, cif in zip(time_grid, cifs):
            cif_grid.append({'stratum': stratum_name, 't_years': float(t), 'cif': float(cif), 'ci_lo': 0.0, 'ci_hi': 0.0})
else:
    cifs = km_at_times(df['time_to_event_days'].values, df['event_flag'].values, time_grid)
    for t, cif in zip(time_grid, cifs):
        cif_grid.append({'stratum': 'overall', 't_years': float(t), 'cif': float(cif), 'ci_lo': 0.0, 'ci_hi': 0.0})

_result_json = json.dumps({
    'rateTable': rate_table,
    'cifGrid': cif_grid,
    'rateUnit': _params.get('rate_unit', '1000_PY'),
    'standardPopulation': std_pop,
    'stratifyBy': stratify,
})
`;

export async function performJMDCIncidenceRate(
  rows: Record<string, any>[],
  params: Record<string, any>,
  timeoutMs: number = 120000
): Promise<any> {
  return runJMDCAnalysis(JMDC_INCIDENCE_PY, {
    js_params: params,
    js_rows: rows,
  }, timeoutMs);
}

// ----- J4: KM Compare + log-rank -----
const JMDC_SURVIVAL_PY = `
import json
import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter
from lifelines.statistics import multivariate_logrank_test

_params = json.loads(js_params)
_rows = json.loads(js_rows)

df = pd.DataFrame(_rows)
gcol = _params['group_col']
if gcol not in df.columns:
    raise ValueError(f"group_col '{gcol}' not found in cohort columns")

df['_t_yrs'] = df['time_to_event_days'].astype(float) / 365.25
df['event_flag'] = df['event_flag'].astype(int)
df[gcol] = df[gcol].astype(str)

groups = sorted(df[gcol].unique())
curves = []
group_stats = []

for g in groups:
    sub = df[df[gcol] == g]
    kmf = KaplanMeierFitter().fit(sub['_t_yrs'], sub['event_flag'], label=g)
    surv_df = kmf.survival_function_.reset_index()
    surv_df.columns = ['t', 'survival']
    ci = kmf.confidence_interval_.reset_index()
    ci.columns = ['t', 'ci_lo', 'ci_hi']
    merged = surv_df.merge(ci, on='t')
    # sample at most 200 points to keep payload reasonable
    if len(merged) > 200:
        idxs = np.linspace(0, len(merged) - 1, 200).astype(int)
        merged = merged.iloc[idxs]
    curves.append({
        'group': g,
        't_years': [float(x) for x in merged['t'].values],
        'survival': [float(x) for x in merged['survival'].values],
        'ci_lo': [float(x) for x in merged['ci_lo'].values],
        'ci_hi': [float(x) for x in merged['ci_hi'].values],
    })
    # Median survival
    try:
        _m = kmf.median_survival_time_
        if pd.notna(_m) and not (isinstance(_m, float) and np.isinf(_m)):
            med = float(_m)
        else:
            med = None
    except Exception:
        med = None
    # Cumulative incidence at horizons
    def cif_at(t):
        try:
            v = float(1.0 - kmf.predict(t))
            if np.isnan(v) or np.isinf(v):
                return None
            return v
        except Exception:
            return None
    group_stats.append({
        'group': g,
        'N': int(len(sub)),
        'events': int(sub['event_flag'].sum()),
        'median_survival': med,
        'cum_inc_1y': cif_at(1),
        'cum_inc_3y': cif_at(3),
        'cum_inc_5y': cif_at(5),
    })

# Log-rank (standard)
try:
    lr = multivariate_logrank_test(df['_t_yrs'], df[gcol], df['event_flag'])
    logrank_p = float(lr.p_value)
except Exception as e:
    logrank_p = None

# Stratified log-rank
stratified_p = None
if _params.get('logrank_method') == 'stratified':
    strat_cols = _params.get('stratify_cols') or []
    if strat_cols:
        try:
            # use lifelines stratified via per-stratum test combined with chi-square sum
            from scipy.stats import chi2
            chi_stats = []
            dfs_total = 0
            for keys, sub in df.groupby(strat_cols):
                if sub[gcol].nunique() < 2:
                    continue
                lr2 = multivariate_logrank_test(sub['_t_yrs'], sub[gcol], sub['event_flag'])
                chi_stats.append(float(lr2.test_statistic))
                dfs_total += int(lr2.degrees_of_freedom)
            if chi_stats:
                stratified_p = float(1.0 - chi2.cdf(sum(chi_stats), max(1, dfs_total)))
        except Exception:
            stratified_p = None

_result_json = json.dumps({
    'mode': 'km',
    'curves': curves,
    'groupStats': group_stats,
    'logrankP': logrank_p,
    'stratifiedLogrankP': stratified_p,
    'groupCol': gcol,
})
`;

export async function performJMDCSurvivalCompare(
  rows: Record<string, any>[],
  params: Record<string, any>,
  timeoutMs: number = 180000
): Promise<any> {
  await ensureLifelinesInstalled();
  return runJMDCAnalysis(JMDC_SURVIVAL_PY, {
    js_params: params,
    js_rows: rows,
  }, timeoutMs);
}

// ----- J5: Cumulative Incidence (Aalen-Johansen or 1-KM) -----
const JMDC_CIF_PY = `
import json
import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter

_params = json.loads(js_params)
_rows = json.loads(js_rows)

df = pd.DataFrame(_rows)
df['_t_yrs'] = df['time_to_event_days'].astype(float) / 365.25
event_col = _params.get('event_col', 'event_flag')
group_col = _params.get('group_col') or None
competing = _params.get('competing_event_cols') or []
time_grid = _params.get('time_grid_years', [1, 2, 3, 4, 5, 7, 10])

groups = ['overall']
if group_col and group_col in df.columns:
    df[group_col] = df[group_col].astype(str)
    groups = sorted(df[group_col].unique())

curves = []
group_stats = []

for g in groups:
    sub = df if g == 'overall' else df[df[group_col] == g]
    if competing and any(c in sub.columns for c in competing):
        # Aalen-Johansen via lifelines
        try:
            from lifelines import AalenJohansenFitter
            ev = sub[event_col].astype(int).copy()
            # combine competing flags into event_of_interest=1 / competing=2 / censored=0
            ev2 = ev.copy()
            for c in competing:
                if c in sub.columns:
                    ev2 = np.where((sub[c].astype(int) == 1) & (ev == 0), 2, ev2)
            ajf = AalenJohansenFitter()
            ajf.fit(sub['_t_yrs'], ev2, event_of_interest=1)
            cif_df = ajf.cumulative_density_.reset_index()
            cif_df.columns = ['t', 'cif']
            ci_df = ajf.confidence_interval_.reset_index()
            ci_df.columns = ['t', 'ci_lo', 'ci_hi']
            merged = cif_df.merge(ci_df, on='t')
        except Exception:
            kmf = KaplanMeierFitter().fit(sub['_t_yrs'], sub[event_col])
            merged = kmf.survival_function_.reset_index()
            merged.columns = ['t', 'survival']
            merged['cif'] = 1 - merged['survival']
            merged['ci_lo'] = 0.0
            merged['ci_hi'] = 0.0
    else:
        kmf = KaplanMeierFitter().fit(sub['_t_yrs'], sub[event_col])
        merged = kmf.survival_function_.reset_index()
        merged.columns = ['t', 'survival']
        ci = kmf.confidence_interval_.reset_index()
        ci.columns = ['t', 'cs_lo', 'cs_hi']
        merged = merged.merge(ci, on='t')
        merged['cif'] = 1 - merged['survival']
        merged['ci_lo'] = 1 - merged['cs_hi']
        merged['ci_hi'] = 1 - merged['cs_lo']
    if len(merged) > 200:
        idxs = np.linspace(0, len(merged) - 1, 200).astype(int)
        merged = merged.iloc[idxs]
    curves.append({
        'group': g,
        't_years': [float(x) for x in merged['t'].values],
        'survival': [1.0 - float(x) for x in merged['cif'].values],  # store as survival for shared modal
        'ci_lo': [float(x) for x in merged['ci_lo'].values],
        'ci_hi': [float(x) for x in merged['ci_hi'].values],
    })
    # group_stats: use CIF values at horizons
    def cif_at(t_yr):
        idxs = (merged['t'] <= t_yr) if 't' in merged.columns else None
        if idxs is None or not idxs.any():
            return None
        return float(merged.loc[idxs, 'cif'].iloc[-1])
    group_stats.append({
        'group': g,
        'N': int(len(sub)),
        'events': int(sub[event_col].astype(int).sum()),
        'median_survival': None,
        'cum_inc_1y': cif_at(1),
        'cum_inc_3y': cif_at(3),
        'cum_inc_5y': cif_at(5),
    })

_result_json = json.dumps({
    'mode': 'cif',
    'curves': curves,
    'groupStats': group_stats,
    'logrankP': None,
    'stratifiedLogrankP': None,
    'groupCol': group_col,
    'competingEventCols': competing,
})
`;

export async function performJMDCCumulativeIncidence(
  rows: Record<string, any>[],
  params: Record<string, any>,
  timeoutMs: number = 180000
): Promise<any> {
  await ensureLifelinesInstalled();
  return runJMDCAnalysis(JMDC_CIF_PY, {
    js_params: params,
    js_rows: rows,
  }, timeoutMs);
}

// ----- J6: Cox PH Risk Stratification -----
const JMDC_COX_PY = `
import json
import numpy as np
import pandas as pd
from lifelines import CoxPHFitter

_params = json.loads(js_params)
_rows = json.loads(js_rows)

df = pd.DataFrame(_rows)
df['_t_yrs'] = df['time_to_event_days'].astype(float) / 365.25
df['event_flag'] = df['event_flag'].astype(int)

exposure = _params['exposure_col']
covariates = _params.get('covariates', [])
stratify_col = _params.get('stratify_col') or None
tie_method = _params.get('tie_method', 'efron')
ph_test = bool(_params.get('proportional_hazards_test', True))

# build modelling frame
feature_cols = [exposure] + [c for c in covariates if c and c != exposure]
keep_cols = ['_t_yrs', 'event_flag'] + feature_cols
if stratify_col and stratify_col in df.columns:
    keep_cols.append(stratify_col)
sub = df[keep_cols].copy()

# Coerce: convert categorical to one-hot
for c in feature_cols:
    if sub[c].dtype == object:
        sub[c] = sub[c].astype(str)
sub = pd.get_dummies(sub, columns=[c for c in feature_cols if sub[c].dtype == object], drop_first=True)
sub = sub.dropna()

cph = CoxPHFitter()
fit_kwargs = dict(duration_col='_t_yrs', event_col='event_flag')
if stratify_col and stratify_col in sub.columns:
    fit_kwargs['strata'] = [stratify_col]
# tie_method is passed via fit() in lifelines 0.27.x
try:
    cph.fit(sub, **fit_kwargs, tie_method=tie_method)
except TypeError:
    cph.fit(sub, **fit_kwargs)

hr_table = []
for var in cph.summary.index:
    row = cph.summary.loc[var]
    hr_table.append({
        'variable': str(var),
        'hr': float(row['exp(coef)']),
        'hr_ci_lo': float(row['exp(coef) lower 95%']),
        'hr_ci_hi': float(row['exp(coef) upper 95%']),
        'p_value': float(row['p']),
    })

# PH test
ph_warnings = []
if ph_test:
    try:
        check = cph.check_assumptions(sub, p_value_threshold=0.05, show_plots=False)
        # check is list of DataFrames; collect any variable with p < 0.05
        if isinstance(check, list):
            for tbl in check:
                if 'p' in tbl.columns:
                    bad = tbl[tbl['p'] < 0.05]
                    for idx in bad.index:
                        ph_warnings.append(f"PH assumption violated for {idx} (p={float(tbl.loc[idx, 'p']):.4f})")
    except Exception:
        pass

concordance = float(cph.concordance_index_)
loglik = float(cph.log_likelihood_)

_result_json = json.dumps({
    'hrTable': hr_table,
    'concordance': concordance,
    'logLikelihood': loglik,
    'exposureCol': exposure,
    'covariates': covariates,
    'phWarnings': ph_warnings,
})
`;

export async function performJMDCRiskStratification(
  rows: Record<string, any>[],
  params: Record<string, any>,
  timeoutMs: number = 240000
): Promise<any> {
  await ensureLifelinesInstalled();
  return runJMDCAnalysis(JMDC_COX_PY, {
    js_params: params,
    js_rows: rows,
  }, timeoutMs);
}

// ----- J7: KR-JP Matcher -----
const JMDC_MATCHER_PY = `
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

_params = json.loads(js_params)
_jp = json.loads(js_jp_rows)
_kr = json.loads(js_kr_rows)

jp = pd.DataFrame(_jp); jp['country'] = 'JP'
kr = pd.DataFrame(_kr); kr['country'] = 'KR'

# Layer 1: schema alignment — already assumed identical columns (warn if not)
common_cols = sorted(set(jp.columns) & set(kr.columns))
jp = jp[common_cols].copy()
kr = kr[common_cols].copy()

combined = pd.concat([jp, kr], ignore_index=True)

# Layer 4: PSM (optional)
def smd(x, y):
    nx, ny = np.var(x, ddof=1), np.var(y, ddof=1)
    pooled = np.sqrt((nx + ny) / 2.0)
    if pooled == 0:
        return 0.0
    return float((np.mean(x) - np.mean(y)) / pooled)

cov = [c for c in _params.get('psm_covariates', []) if c in combined.columns]
smd_rows = []
for c in cov:
    try:
        a = pd.to_numeric(combined.loc[combined['country'] == 'JP', c], errors='coerce').dropna().values
        b = pd.to_numeric(combined.loc[combined['country'] == 'KR', c], errors='coerce').dropna().values
        smd_rows.append({'variable': c, 'smd_before': abs(smd(a, b)), 'smd_after': abs(smd(a, b))})
    except Exception:
        continue

if _params.get('apply_psm') and cov:
    # 1:1 nearest neighbour PSM on logit(propensity) via binary search.
    X = combined[cov].apply(pd.to_numeric, errors='coerce').fillna(combined[cov].apply(pd.to_numeric, errors='coerce').mean())
    y = (combined['country'] == 'KR').astype(int)
    try:
        ps = LogisticRegression(max_iter=500).fit(X, y).predict_proba(X)[:, 1]
        ps = np.clip(ps, 1e-6, 1 - 1e-6)
        logit_ps = np.log(ps / (1 - ps))
        combined = combined.copy()
        combined['_logit_ps'] = logit_ps
        kr_pool = combined[combined['country'] == 'KR']
        jp_pool = combined[combined['country'] == 'JP'].sort_values('_logit_ps')
        caliper = float(_params.get('caliper', 0.2)) * float(np.std(logit_ps))
        if caliper <= 0:
            caliper = 1e6  # disable caliper if PS variance is tiny
        jp_ps_arr = jp_pool['_logit_ps'].values
        jp_idx_arr = jp_pool.index.values  # original combined index
        matched_jp_idx, matched_kr_idx = [], []
        from bisect import bisect_left
        for kr_idx, kr_row in kr_pool.iterrows():
            target = kr_row['_logit_ps']
            pos = bisect_left(jp_ps_arr, target)
            best = None; best_d = np.inf
            for cand in (pos - 1, pos):
                if 0 <= cand < len(jp_ps_arr):
                    d = abs(jp_ps_arr[cand] - target)
                    if d < best_d:
                        best_d = d; best = cand
            if best is not None and best_d <= caliper:
                matched_jp_idx.append(jp_idx_arr[best])
                matched_kr_idx.append(kr_idx)
        if matched_jp_idx:
            matched = combined.loc[matched_jp_idx + matched_kr_idx]
            for row in smd_rows:
                c = row['variable']
                a = pd.to_numeric(matched.loc[matched['country'] == 'JP', c], errors='coerce').dropna().values
                b = pd.to_numeric(matched.loc[matched['country'] == 'KR', c], errors='coerce').dropna().values
                if len(a) > 1 and len(b) > 1:
                    row['smd_after'] = abs(smd(a, b))
            combined_for_rates = matched
        else:
            # No matches under caliper — fall back to all data so rate/SIR rows still appear
            combined_for_rates = combined
    except Exception:
        combined_for_rates = combined
else:
    combined_for_rates = combined

# Layer 3: standardisation
STANDARD_POPS = {
    'WHO_2000':  {'<30': 0.46, '30-39': 0.16, '40-49': 0.13, '50-59': 0.10, '60-69': 0.08, '70+': 0.07},
    'japan_2015':{'<30': 0.27, '30-39': 0.13, '40-49': 0.14, '50-59': 0.13, '60-69': 0.15, '70+': 0.18},
    'korea_2020':{'<30': 0.29, '30-39': 0.14, '40-49': 0.16, '50-59': 0.17, '60-69': 0.13, '70+': 0.11},
    'combined':  {'<30': 0.33, '30-39': 0.14, '40-49': 0.15, '50-59': 0.13, '60-69': 0.13, '70+': 0.12},
}
std_key = _params.get('standard_population', 'WHO_2000')
weights = STANDARD_POPS.get(std_key, STANDARD_POPS['WHO_2000'])

def crude_rate(sub, unit=1000):
    py_total = (sub['time_to_event_days'].astype(float) / 365.25).sum()
    e = sub['event_flag'].astype(int).sum()
    return float(e / py_total * unit) if py_total > 0 else 0.0

def std_rate(sub, weights, unit=1000):
    if 'age_band' not in sub.columns:
        return crude_rate(sub, unit)
    total = 0.0
    w_sum = 0.0
    for band, w in weights.items():
        s = sub[sub['age_band'] == band]
        py = (s['time_to_event_days'].astype(float) / 365.25).sum()
        if py > 0:
            r = float(s['event_flag'].astype(int).sum()) / py * unit
            total += r * w
            w_sum += w
    return total / w_sum if w_sum > 0 else 0.0

# Byar's CI for SIR
def sir_byar(observed, expected):
    if expected <= 0:
        return 0.0, 0.0, 0.0
    o = max(observed, 0.5)
    lo = (o * (1 - 1/(9*o) - 1.96/(3*np.sqrt(o)))**3) / expected
    hi = ((o+1) * (1 - 1/(9*(o+1)) + 1.96/(3*np.sqrt(o+1)))**3) / expected
    return float(observed / expected), float(lo), float(hi)

target_outcome = _params.get('comparison_outcome')
rate_table = []
sir_table = []

# build outcome list — either single 'comparison_outcome' filter on outcome_type, or composite
def make_rates(outcome_filter):
    jp_sub = combined_for_rates[combined_for_rates['country'] == 'JP']
    kr_sub = combined_for_rates[combined_for_rates['country'] == 'KR']
    if 'outcome_type' in combined_for_rates.columns and outcome_filter:
        jp_sub = jp_sub[jp_sub['outcome_type'] == outcome_filter]
        kr_sub = kr_sub[kr_sub['outcome_type'] == outcome_filter]
    jp_raw = crude_rate(jp_sub); kr_raw = crude_rate(kr_sub)
    jp_std = std_rate(jp_sub, weights); kr_std = std_rate(kr_sub, weights)
    ratio = (kr_std / jp_std) if jp_std > 0 else 0.0
    # CI: log-ratio approx
    if jp_std > 0 and kr_std > 0 and jp_sub['event_flag'].sum() > 0 and kr_sub['event_flag'].sum() > 0:
        se = np.sqrt(1.0/jp_sub['event_flag'].sum() + 1.0/kr_sub['event_flag'].sum())
        lr = np.log(ratio); ci_lo = float(np.exp(lr - 1.96*se)); ci_hi = float(np.exp(lr + 1.96*se))
    else:
        ci_lo, ci_hi = 0.0, 0.0
    rate_table.append({
        'outcome': outcome_filter or 'overall',
        'jp_raw': jp_raw, 'jp_std': jp_std,
        'kr_raw': kr_raw, 'kr_std': kr_std,
        'ratio': float(ratio), 'ratio_ci_lo': ci_lo, 'ratio_ci_hi': ci_hi,
    })

    # SIR: KR observed vs expected using JP rates
    obs = kr_sub['event_flag'].astype(int).sum()
    # expected: JP rate × KR person-years, per age_band
    if 'age_band' in combined_for_rates.columns and len(kr_sub) > 0:
        expected = 0.0
        for band in jp_sub['age_band'].dropna().unique():
            j_band = jp_sub[jp_sub['age_band'] == band]
            k_band = kr_sub[kr_sub['age_band'] == band]
            j_py = (j_band['time_to_event_days'].astype(float) / 365.25).sum()
            k_py = (k_band['time_to_event_days'].astype(float) / 365.25).sum()
            if j_py > 0:
                rate = float(j_band['event_flag'].astype(int).sum()) / j_py
                expected += rate * k_py
    else:
        j_py = (jp_sub['time_to_event_days'].astype(float) / 365.25).sum()
        k_py = (kr_sub['time_to_event_days'].astype(float) / 365.25).sum()
        rate = float(jp_sub['event_flag'].astype(int).sum()) / j_py if j_py > 0 else 0
        expected = rate * k_py
    sir, sir_lo, sir_hi = sir_byar(obs, expected) if expected > 0 else (0.0, 0.0, 0.0)
    sir_table.append({
        'outcome': outcome_filter or 'overall',
        'observed': int(obs),
        'expected': float(expected),
        'sir': float(sir),
        'sir_ci_lo': float(sir_lo),
        'sir_ci_hi': float(sir_hi),
    })

if 'outcome_type' in combined_for_rates.columns:
    for o in sorted([x for x in combined_for_rates['outcome_type'].dropna().unique() if x != 'composite']):
        if target_outcome and o != target_outcome:
            continue
        make_rates(o)
else:
    make_rates(target_outcome)

# KM overlay — JP vs KR for target outcome (1-KM via lifelines fallback inline)
km_overlay = []
try:
    from lifelines import KaplanMeierFitter
    for country, sub in combined_for_rates.groupby('country'):
        if 'outcome_type' in sub.columns and target_outcome:
            sub = sub[sub['outcome_type'] == target_outcome]
        if len(sub) < 5:
            continue
        kmf = KaplanMeierFitter().fit(sub['time_to_event_days'].astype(float) / 365.25, sub['event_flag'].astype(int))
        surv = kmf.survival_function_.reset_index()
        surv.columns = ['t', 's']
        if len(surv) > 150:
            idxs = np.linspace(0, len(surv) - 1, 150).astype(int)
            surv = surv.iloc[idxs]
        km_overlay.append({
            'country': country,
            'group': target_outcome or 'overall',
            't_years': [float(x) for x in surv['t'].values],
            'survival': [float(x) for x in surv['s'].values],
        })
except Exception:
    pass

_result_json = json.dumps({
    'smdTable': smd_rows,
    'rateTable': rate_table,
    'sirTable': sir_table,
    'kmOverlay': km_overlay,
    'mappingVersion': 'PRD-v2.0-appendix-H/I/J',
    'applied': {
        'schema_alignment': bool(_params.get('apply_schema_alignment')),
        'vocab_mapping': bool(_params.get('apply_vocab_mapping')),
        'standardization': _params.get('apply_standardization'),
        'psm': bool(_params.get('apply_psm')),
    },
})
`;

export async function performJMDCMatcher(
  jpRows: Record<string, any>[],
  krRows: Record<string, any>[],
  params: Record<string, any>,
  timeoutMs: number = 240000
): Promise<any> {
  await ensureLifelinesInstalled();
  return runJMDCAnalysis(JMDC_MATCHER_PY, {
    js_params: params,
    js_jp_rows: jpRows,
    js_kr_rows: krRows,
  }, timeoutMs);
}
