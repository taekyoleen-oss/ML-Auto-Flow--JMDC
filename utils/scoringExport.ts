import { CanvasModule, Connection } from '../types';

/**
 * 스코어링/결과 내보내기 (작업 6 — docs/cross_app_io_improvements.md)
 *
 * 학습된 모델(TrainModel/ScoreModel 체인)이 포함된 파이프라인에 대해
 * "배포 가능한 스코어링 스니펫"을 생성한다:
 *   - joblib 모델 저장/로드
 *   - 최소 FastAPI(또는 Flask) 스코어링 엔드포인트
 *   - 요청/응답 JSON 샘플 (책 Ch3/Ch4 스타일)
 *
 * 이 모듈은 기존 전체-파이프라인 코드 생성(generateFullPipelineCode / codeSnippets 실행 템플릿)과
 * 완전히 독립된 '추가' 생성기다. verify 픽스처가 사용하는 실행 경로를 절대 건드리지 않는다.
 * 여기서는 기존 모듈 메타데이터(타입/파라미터/연결)를 '읽기'만 한다.
 */

export type ScoringFramework = 'fastapi' | 'flask';

export interface ScoringExportInfo {
  /** 스코어링 스니펫 생성이 가능한지 (학습 모델이 존재하는지) */
  available: boolean;
  /** 생성 불가 시 사용자 안내 사유 */
  reason?: string;
  /** 추론된 피처 컬럼 (요청 JSON 키) */
  featureColumns: string[];
  /** 추론된 라벨/타깃 컬럼 (응답에서 예측 대상 의미) */
  labelColumn: string | null;
  /** 추정 추론 종류(분류/회귀 등) — 표시/주석용 */
  estimatorLabel: string;
}

/** 모델 정의 모듈 타입 → 사람이 읽는 이름(주석용) */
const ESTIMATOR_LABELS: Record<string, string> = {
  LinearRegression: '선형 회귀 (Linear Regression)',
  LogisticRegression: '로지스틱 회귀 (Logistic Regression)',
  PoissonRegression: '포아송 회귀 (Poisson Regression)',
  NegativeBinomialRegression: '음이항 회귀 (Negative Binomial Regression)',
  DecisionTree: '의사결정나무 (Decision Tree)',
  RandomForest: '랜덤 포레스트 (Random Forest)',
  GradientBoosting: '그래디언트 부스팅 (Gradient Boosting)',
  NeuralNetwork: '신경망 (Neural Network)',
  SVM: '서포트 벡터 머신 (SVM)',
  LDA: '선형판별분석 (LDA)',
  NaiveBayes: '나이브 베이즈 (Naive Bayes)',
  KNN: 'K-최근접 이웃 (KNN)',
};

/** 단순 표본값: 컬럼명 휴리스틱으로 그럴듯한 예시 값 생성 (요청 JSON 샘플용) */
function sampleValueFor(col: string): number {
  // 결정적(해시 기반) — 동일 컬럼명은 항상 동일 표본값 → 재현성 보장
  let h = 0;
  for (let i = 0; i < col.length; i++) {
    h = (h * 31 + col.charCodeAt(i)) % 1000;
  }
  return Math.round((h / 1000) * 100 * 100) / 100; // 0~100 범위, 소수 2자리
}

/**
 * 파이프라인에서 학습 모델 정보를 추론한다.
 * - TrainModel 모듈이 있으면 그 feature_columns / label_column 사용
 * - 없으면 KNN 등 fit을 직접 수행하는 모델 모듈을 차선책으로 탐색
 */
export function inspectScoringPipeline(
  modules: CanvasModule[],
  connections: Connection[],
): ScoringExportInfo {
  const moduleMap = new Map<string, CanvasModule>();
  modules.forEach((m) => moduleMap.set(m.id, m));

  // TrainModel 또는 SweepParameters(둘 다 model_in + data_in → 적합 모델 출력)를 학습 모듈로 인정
  const trainModule =
    modules.find((m) => m.type === 'TrainModel') ||
    modules.find((m) => m.type === 'SweepParameters');

  // 학습 모듈에 연결된 모델 정의 모듈(model_in 포트) → 추정기 라벨 추론
  let estimatorLabel = '학습된 모델';
  if (trainModule) {
    const modelConn = connections.find(
      (c) => c.to.moduleId === trainModule.id && c.to.portName === 'model_in',
    );
    const modelDef = modelConn ? moduleMap.get(modelConn.from.moduleId) : undefined;
    if (modelDef && ESTIMATOR_LABELS[modelDef.type]) {
      estimatorLabel = ESTIMATOR_LABELS[modelDef.type];
    }
  }

  if (!trainModule) {
    return {
      available: false,
      reason:
        '학습 모델(TrainModel) 모듈이 파이프라인에 없습니다. 모델 정의 → TrainModel 체인을 구성하면 스코어링 코드를 내보낼 수 있습니다.',
      featureColumns: [],
      labelColumn: null,
      estimatorLabel,
    };
  }

  const rawFeatures = trainModule.parameters?.feature_columns;
  const featureColumns: string[] = Array.isArray(rawFeatures)
    ? rawFeatures.filter((c) => typeof c === 'string' && c.length > 0)
    : [];
  const rawLabel = trainModule.parameters?.label_column;
  const labelColumn: string | null =
    typeof rawLabel === 'string' && rawLabel.length > 0 ? rawLabel : null;

  return {
    available: true,
    featureColumns,
    labelColumn,
    estimatorLabel,
  };
}

/** Python 문자열 리스트 리터럴 생성 (None 폴백 포함) */
function pyStringList(items: string[]): string {
  if (items.length === 0) return '[]';
  return '[' + items.map((s) => `'${s.replace(/'/g, "\\'")}'`).join(', ') + ']';
}

/**
 * 요청/응답 JSON 샘플 문자열을 만든다 (책 Ch3/Ch4 스타일).
 * 피처를 모르면 일반적인 예시 키를 사용한다.
 */
export function buildScoringJsonSamples(info: ScoringExportInfo): {
  request: string;
  response: string;
} {
  const cols = info.featureColumns.length > 0 ? info.featureColumns : ['feature_1', 'feature_2'];
  const recordObj: Record<string, number> = {};
  cols.forEach((c) => (recordObj[c] = sampleValueFor(c)));

  const request = JSON.stringify({ records: [recordObj] }, null, 2);

  const predKey = info.labelColumn ? `${info.labelColumn}_pred` : 'prediction';
  const response = JSON.stringify(
    {
      predictions: [{ [predKey]: 0 }],
      model: 'pipeline_model.joblib',
    },
    null,
    2,
  );

  return { request, response };
}

/**
 * 배포용 스코어링 코드 스니펫을 생성한다.
 * (joblib 저장/로드 + FastAPI 또는 Flask 엔드포인트 + 요청/응답 JSON 샘플)
 *
 * 주의: 이 코드는 기존 전체 파이프라인 코드와는 별개로, 학습이 끝난 `trained_model`을
 * 전제로 한다. 즉, 전체 파이프라인 코드를 먼저 실행해 `trained_model`을 얻은 뒤
 * 아래 저장 스니펫으로 직렬화하고, 서버 스니펫으로 서빙하는 흐름이다.
 */
export function generateScoringCode(
  modules: CanvasModule[],
  connections: Connection[],
  framework: ScoringFramework = 'fastapi',
): string {
  const info = inspectScoringPipeline(modules, connections);

  if (!info.available) {
    return [
      '# ⚠️ 스코어링 코드를 생성할 수 없습니다.',
      `# 사유: ${info.reason}`,
      '#',
      '# 모델 정의 모듈(예: LinearRegression / LogisticRegression / RandomForest 등)을',
      '# TrainModel 모듈의 model_in 포트에 연결하고, 데이터를 data_in 포트에 연결하세요.',
    ].join('\n');
  }

  const featureList = pyStringList(info.featureColumns);
  const labelComment = info.labelColumn
    ? `라벨(타깃) 컬럼: ${info.labelColumn}`
    : '라벨(타깃) 컬럼: (자동 추론 — sklearn feature_names_in_ 사용)';
  const { request, response } = buildScoringJsonSamples(info);

  const header = [
    '# =============================================================',
    '# 배포용 스코어링 코드 (Scoring / Deployment Snippet)',
    `# 모델: ${info.estimatorLabel}`,
    `# ${labelComment}`,
    '#',
    '# 이 스니펫은 "전체 파이프라인 코드"와는 별개의 배포 보조 코드입니다.',
    '# 흐름: ① 전체 파이프라인 코드를 실행해 학습된 `trained_model`을 얻는다',
    '#       ② 아래 [1] 저장 코드로 모델을 joblib 파일로 직렬화한다',
    '#       ③ 아래 [2] 서버 코드로 예측 API를 서빙한다',
    '# =============================================================',
    '',
  ];

  const saveLoad = [
    '# -------------------------------------------------------------',
    '# [1] 모델 저장 / 로드 (joblib)',
    '# -------------------------------------------------------------',
    'import joblib',
    '',
    '# 학습 직후(전체 파이프라인 코드 실행 후) 한 번만 실행:',
    "MODEL_PATH = 'pipeline_model.joblib'",
    'joblib.dump(trained_model, MODEL_PATH)',
    "print(f'모델 저장 완료: {MODEL_PATH}')",
    '',
    '# 서빙 시 로드:',
    '# loaded_model = joblib.load(MODEL_PATH)',
    '',
  ];

  const featureBlock = [
    '# 서빙에 사용할 피처 컬럼(학습 시 사용한 순서와 동일해야 함)',
    `FEATURE_COLUMNS = ${featureList}`,
    '',
  ];

  let serverBlock: string[];
  if (framework === 'flask') {
    serverBlock = [
      '# -------------------------------------------------------------',
      '# [2] Flask 스코어링 엔드포인트',
      '# -------------------------------------------------------------',
      '# 실행: pip install flask joblib pandas && python this_file.py',
      'from flask import Flask, request, jsonify',
      'import pandas as pd',
      'import joblib',
      '',
      "MODEL_PATH = 'pipeline_model.joblib'",
      'model = joblib.load(MODEL_PATH)',
      '',
      'app = Flask(__name__)',
      '',
      "@app.route('/predict', methods=['POST'])",
      'def predict():',
      '    payload = request.get_json(force=True)',
      "    records = payload.get('records', [])",
      '    df = pd.DataFrame(records)',
      '    # 학습 시 피처 순서 보장',
      '    cols = FEATURE_COLUMNS if FEATURE_COLUMNS else list(df.columns)',
      '    X = df[cols] if cols else df',
      '    preds = model.predict(X)',
      "    key = 'prediction'",
      '    return jsonify({',
      "        'predictions': [{key: (p.item() if hasattr(p, 'item') else p)} for p in preds],",
      "        'model': MODEL_PATH,",
      '    })',
      '',
      "if __name__ == '__main__':",
      "    app.run(host='0.0.0.0', port=8000)",
      '',
    ];
  } else {
    serverBlock = [
      '# -------------------------------------------------------------',
      '# [2] FastAPI 스코어링 엔드포인트',
      '# -------------------------------------------------------------',
      '# 실행: pip install fastapi uvicorn joblib pandas',
      '#       uvicorn this_file:app --host 0.0.0.0 --port 8000',
      'from fastapi import FastAPI',
      'from pydantic import BaseModel',
      'from typing import List, Dict, Any',
      'import pandas as pd',
      'import joblib',
      '',
      "MODEL_PATH = 'pipeline_model.joblib'",
      'model = joblib.load(MODEL_PATH)',
      '',
      'app = FastAPI(title="ML Auto Flow Scoring API")',
      '',
      'class ScoreRequest(BaseModel):',
      '    records: List[Dict[str, Any]]',
      '',
      "@app.post('/predict')",
      'def predict(req: ScoreRequest):',
      '    df = pd.DataFrame(req.records)',
      '    # 학습 시 피처 순서 보장',
      '    cols = FEATURE_COLUMNS if FEATURE_COLUMNS else list(df.columns)',
      '    X = df[cols] if cols else df',
      '    preds = model.predict(X)',
      "    key = 'prediction'",
      "    return {",
      "        'predictions': [{key: (p.item() if hasattr(p, 'item') else p)} for p in preds],",
      "        'model': MODEL_PATH,",
      '    }',
      '',
    ];
  }

  const samples = [
    '# -------------------------------------------------------------',
    '# [3] 요청 / 응답 JSON 샘플',
    '# -------------------------------------------------------------',
    '# 요청 (POST /predict):',
    ...request.split('\n').map((l) => `#   ${l}`),
    '#',
    '# 응답:',
    ...response.split('\n').map((l) => `#   ${l}`),
    '#',
    '# curl 예시:',
    `#   curl -X POST http://localhost:8000/predict \\`,
    `#     -H 'Content-Type: application/json' \\`,
    `#     -d '${request.replace(/\n\s*/g, '')}'`,
    '',
  ];

  return [
    ...header,
    ...saveLoad,
    ...featureBlock,
    ...serverBlock,
    ...samples,
  ].join('\n');
}
