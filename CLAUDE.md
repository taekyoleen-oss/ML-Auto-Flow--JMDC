# ML Auto Flow / JMDC — 프로젝트 지침

## 절대 불변식
1. **Python 재현성:** 모든 분석 모듈은 사용자가 내보낸 Python 코드로 동일 결과를 재현 가능해야 한다. `data_analysis_modules.py` ↔ `codeSnippets.ts` 정합성을 항상 유지한다.
2. **두 앱 동기화:** `ML Auto Flow`(베이스)와 `ML_Auto_Flow-JMDC`(JMDC 상위집합)의 공통 변경은 양쪽에 동일 적용하고, JMDC 전용만 차이로 남긴다.

## 하네스: ML Flow (두 앱 수정·강화·테스트)

**목표:** 두 앱의 Python 모듈 강화·AI 기능·프론트엔드 변경을 에이전트 팀으로 조율하되 위 두 불변식을 지킨다.

**트리거:** 두 앱 관련 수정·강화·모듈/AI/성능 작업 또는 "다시 실행/재실행/업데이트/이어서/다른 앱에도/보완" 요청 시 `ml-flow-orchestrator` 스킬을 사용하라. 단순 사실 질문은 직접 응답 가능.

**구성:** 에이전트 `.claude/agents/`(python-module-engineer, ai-feature-engineer, frontend-engineer, dual-app-sync, qa-verifier), 스킬 `.claude/skills/`(ml-flow-orchestrator, python-reproducibility, dual-app-sync, ai-key-and-features).

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-07 | 초기 구성 | 전체 | 하네스 신규 구축 |
| 2026-06-07 | AI 로컬 API 키화 (첫 실행) | lib/aiClient.ts, ApiKeySettingsModal.tsx, App.tsx, PropertiesPanel.tsx, 8개 모달, vite.config.ts (양쪽 앱) | 번들 하드코딩 키 제거→사용자별 localStorage 키 입력+중앙 클라이언트 통일, dev env 폴백 유지 |
| 2026-06-07 | AI 기능 확장 #1 | lib/aiHelpers.ts, PipelineCodeModal.tsx (양쪽 앱) | 재사용 AI 헬퍼(코드해설/결과해설/오류수정) + 내보낸 Python 코드 'AI 설명' 통합. Python 재현성 강화 |
| 2026-06-07 | AI 기능 확장 #2 | StatisticsPreviewModal/EvaluationPreviewModal/EvaluateStatPreviewModal.tsx (양쪽 앱) | 결과 미리보기에 explainModuleResult ✨ 해설 통합 (frontend-engineer 위임) |
| 2026-06-07 | AI 기능 확장 #3 | ErrorModal.tsx (양쪽 앱) | 모듈 오류에 suggestErrorFix ✨ 원인분석 통합 (ai-feature-engineer 위임) |
| 2026-06-07 | Python 재현성 강화 | data_analysis_modules.py, codeSnippets.ts (양쪽 앱) | split 내보내기 코드 random_state None→42 폴백(자기재현 보장), create_neural_network 누락 random_state=42 추가(NameError+결정성). 앱 런타임 출력 불변 |
| 2026-06-07 | 전체코드 standalone 실행성+재현성 수정 | codeSnippets.ts, utils/generatePipelineCode.ts (양쪽 앱) | 전체 파이프라인 코드가 외부 Python에서 바로 실행되고 동일 결과 재현되도록 5개 버그 수정: ①객체파라미터 JS불리언→Python리터럴(toPyLiteral) ②주석된 실행호출 활성화 ③빈 컬럼선택→전체수치형 ④모델생성 모듈 변수매핑 ⑤SplitData train/test 포트 구분. 실제 Python 3회 실행 byte-identical 검증 |
| 2026-06-07 | 전체코드 실행위주 간결화 | utils/generatePipelineCode.ts (양쪽 앱) | 전체코드는 설명주석/배너 제거+1줄 헤더로 실행 위주 표시(stripCommentsKeepCode). 개별 모듈 코드(PropertiesPanel getModuleCode)는 옵션 그대로 유지 |
| 2026-06-07 | AI 기능 확장 #4 | CorrelationPreviewModal/HypothesisTestingPreviewModal/NormalityCheckerPreviewModal/OutlierDetectorPreviewModal.tsx (양쪽 앱) | 4개 통계 미리보기 모달에 explainModuleResult ✨ 결과 해설 통합(기존 패턴 동일). 양쪽 앱 byte-identical |
| 2026-06-07 | 회귀 검증 하네스 추가 | verify/ (run-verification.mjs, generate.ts, pipelines/*.json, README), package.json(verify:pipelines), .gitignore (양쪽 앱) | 전체 파이프라인 코드가 외부 python으로 바로 실행+2회 byte-identical 재현되는지 자동 회귀 검증. 픽스처 5개 5/5 PASS(양쪽). 클러스터링 모듈은 Python 템플릿 부재로 범위 외(README 명시) |
| 2026-06-07 | 클러스터링 전체코드 템플릿 추가 | codeSnippets.ts(KMeans/PCA/TrainClusteringModel/ClusteringData), generatePipelineCode.ts(MODULE_OUTPUT_VAR), verify/pipelines/07_clustering_kmeans.json, verify/README (양쪽 앱) | 클러스터링 K-Means 체인을 전체코드로 내보내 외부 python 실행+재현 가능하게 함(지도학습 TrainModel/ScoreModel 변수 와이어링 미러, 시드 42 고정). verify 6/6 PASS(양쪽). PCA 템플릿도 추가했으나 DEFAULT_MODULES의 PCA가 PrincipalComponentAnalysis(미존재 ModuleType) 오타라 fixture 보류 |
