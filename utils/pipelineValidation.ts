import { CanvasModule, Connection } from '../types';

/**
 * Python 실행 오류를 카테고리별로 분류하여 한국어 안내 메시지 반환
 */
export function classifyPythonError(error: any): { category: string; userMessage: string } {
  const msg = (error.message || String(error)).toLowerCase();
  const errType = (error.error_type || '').toLowerCase();
  const tb = (error.traceback || error.error_traceback || error.stack || '').toLowerCase();
  const all = `${msg} ${errType} ${tb}`;

  if (all.includes('modulenotfounderror') || all.includes('importerror') || all.includes('no module named'))
    return { category: '📦 패키지 미설치', userMessage: '필요한 Python 패키지가 설치되지 않았습니다. Pyodide 환경에서 해당 패키지를 지원하지 않을 수 있습니다.' };

  if (all.includes('keyerror') || all.includes('not found in') || all.includes('dataframe is empty') || (all.includes('column') && all.includes('not found')))
    return { category: '📋 데이터 컬럼 오류', userMessage: '입력 데이터의 컬럼명이나 형식이 맞지 않습니다. LoadData 모듈의 데이터와 컬럼 설정을 확인해주세요.' };

  if (all.includes('valueerror') || all.includes('no feature') || all.includes('label column') || all.includes('invalid value') || all.includes('must have same number') || all.includes('파라미터') || all.includes('설정값'))
    return { category: '⚙️ 파라미터 오류', userMessage: '모듈 설정값이 올바르지 않습니다. 속성 패널에서 파라미터를 확인하고 수정해주세요.' };

  if (all.includes('typeerror') || all.includes('cannot convert') || all.includes('expected number') || all.includes('int() argument') || all.includes('unsupported operand') || all.includes('must be numeric'))
    return { category: '🔢 데이터 타입 오류', userMessage: '데이터 타입이 맞지 않습니다. 숫자형 컬럼에 문자열이 포함되어 있거나 타입 변환이 필요합니다.' };

  if (all.includes('timeout') || all.includes('타임아웃') || all.includes('timed out'))
    return { category: '⏱️ 타임아웃 오류', userMessage: '실행 시간이 초과되었습니다. 데이터 크기를 줄이거나 파라미터를 조정해주세요.' };

  if (all.includes('upstream') || all.includes('did not run successfully') || all.includes('no data available') || all.includes('먼저 실행') || all.includes('모듈을 먼저'))
    return { category: '🔗 상위 모듈 미실행', userMessage: '연결된 이전 모듈이 성공적으로 실행되지 않았습니다. 상위 모듈부터 순서대로 실행해주세요.' };

  if (all.includes('memoryerror') || all.includes('out of memory') || all.includes('메모리'))
    return { category: '💾 메모리 오류', userMessage: '데이터가 너무 크거나 메모리가 부족합니다. 데이터 크기를 줄이거나 샘플링을 적용해주세요.' };

  if (all.includes('zerodivisionerror') || all.includes('division by zero'))
    return { category: '➗ 연산 오류', userMessage: '0으로 나누기 오류가 발생했습니다. 입력 데이터에 0 값이 있는지 확인해주세요.' };

  if (all.includes('indexerror') || all.includes('index out of') || all.includes('list index'))
    return { category: '📌 인덱스 오류', userMessage: '데이터 인덱스가 범위를 벗어났습니다. 데이터 크기나 컬럼 선택을 확인해주세요.' };

  if (all.includes('runtimeerror') || all.includes('코드 생성에 실패') || all.includes('코드 생성 실패'))
    return { category: '⚙️ 코드 생성 오류', userMessage: '모듈 코드 생성에 실패했습니다. 파라미터 설정을 확인하고 다시 실행해주세요.' };

  if (all.includes('순환 연결') || all.includes('circular') || all.includes('cycle'))
    return { category: '🔄 순환 연결 오류', userMessage: '파이프라인에 순환 연결이 있습니다. 모듈 간 연결 방향을 확인해주세요.' };

  if (all.includes('convergencewarn') || all.includes('failed to converge') || all.includes('max_iter'))
    return { category: '📈 수렴 경고', userMessage: '모델 학습이 수렴하지 않았습니다. max_iter를 늘리거나 데이터를 스케일링해보세요.' };

  if (all.includes('attributeerror') || all.includes('has no attribute') || all.includes('object has no'))
    return { category: '🔗 모듈 연결 오류', userMessage: '모듈 간 데이터 타입이 맞지 않습니다. 연결된 모듈의 출력 형식을 확인해주세요.' };

  return { category: '❌ 실행 오류', userMessage: '모듈 실행 중 오류가 발생했습니다. 하단 터미널 로그에서 상세 내용을 확인하세요.' };
}

/**
 * 모듈 파라미터 사전 유효성 검사 (#3 확장 버전)
 * Python 실행 전 잘못된 파라미터를 감지하여 즉각적인 피드백 제공
 */
export function validateModuleParameters(module: CanvasModule): string | null {
  const p = module.parameters || {};

  switch (module.type) {
    case 'SplitData': {
      const ts = parseFloat(p.train_size);
      if (!isNaN(ts) && (ts <= 0 || ts >= 1))
        return `train_size는 0~1 사이 값이어야 합니다 (현재: ${ts}). 예: 0.8`;
      break;
    }

    case 'TrainModel': {
      const fc = p.feature_columns;
      if (!fc || (Array.isArray(fc) && fc.length === 0))
        return '특성 컬럼(feature_columns)을 1개 이상 선택해야 합니다. 속성 패널에서 컬럼을 선택해주세요.';
      if (!p.label_column || p.label_column === '')
        return '레이블 컬럼(label_column)을 선택해야 합니다. 속성 패널에서 목표 컬럼을 선택해주세요.';
      break;
    }
    case 'SweepParameters': {
      const fc = p.feature_columns;
      if (!fc || (Array.isArray(fc) && fc.length === 0))
        return '특성 컬럼(feature_columns)을 1개 이상 선택해야 합니다. 속성 패널에서 컬럼을 선택해주세요.';
      if (!p.label_column || p.label_column === '')
        return '레이블 컬럼(label_column)을 선택해야 합니다. 속성 패널에서 목표 컬럼을 선택해주세요.';
      if (p.param_grid !== undefined && p.param_grid !== null && p.param_grid !== '') {
        try {
          const grid = typeof p.param_grid === 'string' ? JSON.parse(p.param_grid) : p.param_grid;
          if (typeof grid !== 'object' || Array.isArray(grid) || Object.keys(grid).length === 0)
            return 'param_grid는 비어있지 않은 JSON 객체여야 합니다. 예: {"max_depth": [3, 5]}';
        } catch {
          return 'param_grid가 올바른 JSON이 아닙니다. 예: {"max_depth": [3, 5], "min_samples_split": [2, 5]}';
        }
      }
      const cv = Number(p.cv);
      if (!isNaN(cv) && cv < 2)
        return 'cv(교차검증 fold 수)는 2 이상의 정수여야 합니다 (현재: ' + p.cv + ').';
      break;
    }
    case 'EvaluateModel': {
      if (!p.label_column || p.label_column === '')
        return '평가할 레이블 컬럼(label_column)을 선택해야 합니다.';
      break;
    }

    case 'SelectData': {
      const sel = p.columnSelections || p.selectedColumns || p.columns;
      // 빈/미설정 columnSelections는 "전체 컬럼 통과(passthrough)"로 유효 처리한다.
      // (인앱 실행 분기와 내보낸 select_data() 모두 빈 선택을 전체 컬럼 통과로 처리하므로 정합)
      const isEmpty =
        !sel ||
        (Array.isArray(sel) && sel.length === 0) ||
        (typeof sel === 'object' && !Array.isArray(sel) && Object.keys(sel).length === 0);
      if (isEmpty) break;
      // 설정된 경우에만: 최소 1개 컬럼이 선택(selected !== false)되어 있어야 한다.
      const hasSelection = Array.isArray(sel)
        ? sel.length > 0
        : Object.values(sel).some(
            (v: any) => v && (v === true || v.selected !== false)
          );
      if (!hasSelection)
        return '출력할 컬럼을 1개 이상 선택해야 합니다.';
      break;
    }
    case 'DataFiltering': {
      if (!p.filter_column && !p.filterColumn)
        return '필터링할 컬럼(filter_column)을 지정해야 합니다.';
      break;
    }

    case 'KNN': {
      const nn = parseInt(p.n_neighbors);
      if (!isNaN(nn) && nn < 1)
        return `n_neighbors는 1 이상이어야 합니다 (현재: ${nn})`;
      break;
    }

    case 'KMeans': {
      const nc = parseInt(p.n_clusters);
      if (!isNaN(nc) && nc < 1)
        return `n_clusters는 1 이상이어야 합니다 (현재: ${nc})`;
      break;
    }
    case 'TrainClusteringModel': {
      const nc = parseInt(p.n_clusters);
      if (!isNaN(nc) && nc < 1)
        return `n_clusters는 1 이상이어야 합니다 (현재: ${nc})`;
      break;
    }

    case 'PCA': {
      const nc = parseInt(p.n_components);
      if (!isNaN(nc) && nc < 1)
        return `n_components는 1 이상이어야 합니다 (현재: ${nc})`;
      break;
    }

    case 'DecisionTree':
    case 'RandomForest':
    case 'GradientBoosting': {
      const md = parseInt(p.max_depth);
      if (!isNaN(md) && md < 1)
        return `max_depth는 1 이상이거나 비워두어야 합니다 (현재: ${md})`;
      const nest = parseInt(p.n_estimators);
      if (!isNaN(nest) && nest < 1)
        return `n_estimators는 1 이상이어야 합니다 (현재: ${nest})`;
      break;
    }

    case 'HandleMissingValues': {
      if (p.strategy === 'constant' && (p.fill_value === undefined || p.fill_value === ''))
        return '전략이 constant일 때 fill_value를 입력해야 합니다';
      break;
    }

    case 'NeuralNetwork': {
      const epochs = parseInt(p.epochs ?? p.max_iter);
      if (!isNaN(epochs) && epochs < 1)
        return `epochs는 1 이상이어야 합니다 (현재: ${epochs})`;
      break;
    }

    case 'ColumnPlot': {
      if (!p.column1 || p.column1 === '')
        return '시각화할 컬럼(column1)을 선택해야 합니다.';
      break;
    }

    case 'Correlation': {
      if (p.columns && Array.isArray(p.columns) && p.columns.length < 2)
        return '상관관계 분석을 위해 컬럼을 2개 이상 선택해야 합니다.';
      break;
    }
  }
  return null;
}

/**
 * #8: 모듈 실행 전 필수 입력 포트 연결 검사
 */
export function validateModuleConnections(
  module: CanvasModule,
  connections: Connection[]
): string | null {
  if (module.inputs.length === 0) return null;

  const unconnected = module.inputs.filter(
    (port) => !connections.some((c) => c.to.moduleId === module.id && c.to.portName === port.name)
  );

  if (unconnected.length > 0) {
    const portNames = unconnected.map((p) => `'${p.name}'`).join(', ');
    return `필수 입력 포트가 연결되지 않았습니다: ${portNames}. 이전 모듈에서 연결선을 연결해주세요.`;
  }
  return null;
}
