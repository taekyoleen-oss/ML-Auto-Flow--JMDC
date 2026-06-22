import { CanvasModule, Connection } from '../types';
import { inspectScoringPipeline, type ScoringExportInfo } from './scoringExport';

/**
 * 모델 재학습 / 지속학습 워크플로 — 모델 버전 스냅샷 내보내기
 * (개선 항목 3-7 — docs/azure_ml_book/01_book_based_improvements.md, Ch8 Retraining/지속학습)
 *
 * 앱은 이미 "저장 파이프라인을 다시 실행"하는 흐름을 갖추고 있다. 여기에
 * 가산적으로 더하는 단 하나의 신규 기능은 **버전이 매겨진 모델 스냅샷 번들**을 만드는 것이다:
 *   - 메타데이터 헤더(모델 타입 / 피처 컬럼 / 데이터 소스 참조 / (있으면)지표 / VERSION 라벨)
 *   - joblib 모델 저장/로드 스니펫 (학습된 trained_model 전제)
 *   - 버전 메타를 JSON 사이드카로 함께 기록하는 코드
 *
 * 재현성 메모: 버전/타임스탬프 라벨은 절대 Date.now() 등으로 자동 생성하지 않는다.
 * 호출자가 UI 입력 필드에서 받은 값(기본 'v1')을 그대로 사용한다. 따라서 동일 입력이면
 * 동일 출력(결정적)이며, 외부 verify 실행 경로/실행 템플릿/모듈 동작은 전혀 건드리지 않는다.
 * 여기서는 기존 모듈 메타데이터(타입/파라미터/연결)를 '읽기'만 한다.
 */

export interface RetrainSnapshotOptions {
  /** UI 입력에서 받은 버전 라벨 (기본 'v1'). Date.now() 자동 생성 금지 — 재현성. */
  versionLabel: string;
  /** UI 입력에서 받은(선택) 데이터 소스 참조. 빈 값이면 LoadData 추론값 사용. */
  dataSourceRef?: string;
}

export interface RetrainExportInfo extends ScoringExportInfo {
  /** 추론된 데이터 소스 참조(LoadData url/fileName 등) */
  dataSourceRef: string | null;
}

/** Python 문자열 리터럴 (작은따옴표 이스케이프) */
function pyStr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Python 문자열 리스트 리터럴 */
function pyStringList(items: string[]): string {
  if (items.length === 0) return '[]';
  return '[' + items.map(pyStr).join(', ') + ']';
}

/**
 * LoadData 모듈에서 데이터 소스 참조(파일명/URL)를 추론한다 (표시/기록용, 읽기 전용).
 */
function inferDataSourceRef(modules: CanvasModule[]): string | null {
  const loadModules = modules.filter((m) => m.type === 'LoadData');
  for (const m of loadModules) {
    const p = m.parameters || {};
    const candidates = [p.url, p.fileUrl, p.dataUrl, p.fileName, p.source, p.path];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) return c.trim();
    }
  }
  return null;
}

/**
 * 재학습 스냅샷 내보내기 가능 여부 및 메타데이터를 추론한다.
 * 스코어링과 동일한 학습 모듈 탐색을 재사용한다.
 */
export function inspectRetrainPipeline(
  modules: CanvasModule[],
  connections: Connection[],
): RetrainExportInfo {
  const base = inspectScoringPipeline(modules, connections);
  return {
    ...base,
    dataSourceRef: inferDataSourceRef(modules),
  };
}

/** 버전 라벨 정규화: 파일명에 안전한 형태로(영숫자/._- 만 허용). 빈 값이면 'v1'. */
export function sanitizeVersionLabel(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'v1';
  return trimmed.replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * 버전이 매겨진 모델 스냅샷 코드를 생성한다.
 * (메타데이터 헤더 + joblib 저장/로드 + 버전 메타 JSON 사이드카)
 *
 * 전체 파이프라인 코드를 먼저 실행해 학습된 `trained_model`을 얻은 뒤,
 * 이 스니펫으로 버전별 모델 파일 + 메타 JSON을 직렬화하는 흐름이다.
 */
export function generateRetrainSnapshotCode(
  modules: CanvasModule[],
  connections: Connection[],
  options: RetrainSnapshotOptions,
): string {
  const info = inspectRetrainPipeline(modules, connections);
  const version = sanitizeVersionLabel(options.versionLabel);
  const dataSource =
    (options.dataSourceRef && options.dataSourceRef.trim()) || info.dataSourceRef || '(미지정)';

  if (!info.available) {
    return [
      '# ⚠️ 모델 버전 스냅샷을 생성할 수 없습니다.',
      `# 사유: ${info.reason}`,
      '#',
      '# 모델 정의 모듈(예: LinearRegression / RandomForest 등)을 TrainModel의 model_in 포트에',
      '# 연결하고 데이터를 data_in 포트에 연결한 뒤 다시 시도하세요.',
    ].join('\n');
  }

  const modelFile = `model_${version}.joblib`;
  const metaFile = `model_${version}.meta.json`;
  const labelLine = info.labelColumn
    ? `라벨(타깃) 컬럼: ${info.labelColumn}`
    : '라벨(타깃) 컬럼: (자동 추론)';

  const header = [
    '# =============================================================',
    '# 모델 버전 스냅샷 (Model Version Snapshot — 재학습/지속학습 3-7)',
    `# VERSION : ${version}`,
    `# 모델     : ${info.estimatorLabel}`,
    `# ${labelLine}`,
    `# 피처 컬럼: ${info.featureColumns.length > 0 ? info.featureColumns.join(', ') : '(자동 추론)'}`,
    `# 데이터 소스: ${dataSource}`,
    '#',
    '# 지속학습 워크플로:',
    '#   ① 파이프라인 불러오기(저장된 .json)  ② LoadData 소스 교체(파일/URL)',
    '#   ③ 다시 실행해 trained_model 재학습   ④ 아래 코드로 새 버전 스냅샷 저장',
    '#',
    '# ⚠️ 재현성: VERSION 라벨은 자동 타임스탬프가 아니라 사용자가 지정한 값입니다.',
    '#    동일 데이터 + 동일 시드(파이프라인 코드의 random_state=42)면 동일 모델이 재현됩니다.',
    '# =============================================================',
    '',
  ];

  const saveBlock = [
    '# -------------------------------------------------------------',
    '# [1] 버전별 모델 저장 (joblib) — 학습된 trained_model 전제',
    '# -------------------------------------------------------------',
    'import json',
    'import joblib',
    '',
    `VERSION = ${pyStr(version)}`,
    `MODEL_PATH = ${pyStr(modelFile)}`,
    `META_PATH = ${pyStr(metaFile)}`,
    `FEATURE_COLUMNS = ${pyStringList(info.featureColumns)}`,
    `LABEL_COLUMN = ${info.labelColumn ? pyStr(info.labelColumn) : 'None'}`,
    `DATA_SOURCE = ${pyStr(dataSource)}`,
    '',
    '# 전체 파이프라인 코드를 먼저 실행해 trained_model 을 얻은 뒤 실행:',
    'joblib.dump(trained_model, MODEL_PATH)',
    '',
    '# 버전 메타데이터 사이드카(JSON) 기록 — 모델 버전 관리/추적용',
    'metadata = {',
    "    'version': VERSION,",
    `    'estimator': ${pyStr(info.estimatorLabel)},`,
    "    'feature_columns': FEATURE_COLUMNS,",
    "    'label_column': LABEL_COLUMN,",
    "    'data_source': DATA_SOURCE,",
    "    'model_file': MODEL_PATH,",
    '    # (선택) 학습 시 계산한 지표를 채워 버전 간 성능을 비교하세요.',
    "    'metrics': {},  # 예: {'r2': 0.0, 'rmse': 0.0} 또는 {'accuracy': 0.0}",
    '}',
    'with open(META_PATH, "w", encoding="utf-8") as f:',
    '    json.dump(metadata, f, ensure_ascii=False, indent=2)',
    "print(f'모델 버전 저장 완료: {MODEL_PATH} (+ {META_PATH})')",
    '',
  ];

  const loadBlock = [
    '# -------------------------------------------------------------',
    '# [2] 버전 로드 / 비교 (서빙 또는 다음 재학습 시)',
    '# -------------------------------------------------------------',
    '# loaded_model = joblib.load(MODEL_PATH)',
    '# with open(META_PATH, encoding="utf-8") as f:',
    '#     loaded_meta = json.load(f)',
    "# print('로드한 버전:', loaded_meta['version'])",
    '#',
    '# 여러 버전(model_v1.joblib, model_v2.joblib ...)을 보관하고 metrics 를 비교해',
    '# 가장 좋은 버전을 배포(스코어링 코드의 MODEL_PATH 로 지정)하세요.',
    '',
  ];

  return [...header, ...saveBlock, ...loadBlock].join('\n');
}
