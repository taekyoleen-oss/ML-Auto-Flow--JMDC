# JMDC — 책 기반 개선 사항 및 추가 기능 (앱별 계획)

> 출처: Jeff Barnes, *Microsoft Azure Essentials: Azure Machine Learning* (Microsoft Press, 2015).
> 원형: `ML Auto Flow/docs/azure_ml_book/01_book_based_improvements.md`. 횡단 공통 I/O는 `ML Auto Flow/docs/cross_app_io_improvements.md` 참조.
> 대상: **ML_Auto_Flow-JMDC** (ML Auto Flow의 **상위집합**). 본 문서는 **계획서**이며 구현은 승인 후 별도 진행.

---

## 0. 한눈에 보기 — JMDC는 베이스를 거의 전량 상속

JMDC는 ML Auto Flow와 **동일 코드베이스**다(탐색 확인: `data_analysis_modules.py`, `codeSnippets.ts`, `types.ts`, `constants.ts`, `components/PropertiesPanel.tsx`, `components/ComponentRenderer.tsx`, `moduleDescriptions.ts`, `lib/aiHelpers.ts`, `verify/run-verification.mjs`, `samples/samples-metadata.json` 모두 존재). 따라서 01의 **모든 개선안이 그대로 적용**되며, 본 문서는 그 위에 **JMDC 전용 헬스케어 관점**만 덧붙인다.

차이점:
- **JMDC 전용 모듈 7종**(`types.ts`): `JMDCCohortBuilder`[J1], `JMDCOutcomeLabeler`[J2], `JMDCIncidenceRate`[J3], `JMDCSurvivalCompare`[J4], `JMDCCumulativeIncidence`[J5], `JMDCRiskStratification`[J6, Cox PH], `JMDCKRJPMatcher`[J7] + 대응 미리보기 모달 5종.
- **합성 데이터:** `data/jmdc_synthetic/`(his_population/claims/claims_disease 등 7테이블, 1,000명 코호트).
- **백엔드:** Express 포트 3002(SplitData/PPT/Samples), 프런트 3003.
- **`verify/datasets/` 부재** — 베이스의 `Examples_in_Load/`·`samples/` 경유.

---

## 1. 베이스 상속 개선 항목 (01과 동일, 양쪽 동기화)

아래는 01의 항목을 **양쪽 앱 공통**으로 적용. 영향 파일·재현성·우선순위는 01과 동일하므로 요약만 싣는다.

| 01 항목 | JMDC 적용 | 핵심 영향 파일(JMDC 기준, 확인됨) |
|---|---|---|
| 2-1 Evaluate ROC/AUC·혼동행렬 강화 | ✅ 공통 | `data_analysis_modules.py`, `codeSnippets.ts`, `components/EvaluationPreviewModal.tsx` |
| 2-2 회귀지표 정합(RMSE/MAE/상대오차) | ✅ 공통 | 동상 |
| 2-3 데이터 개요/요약 패널 | ✅ 공통(→공통 문서 작업1) | `components/StatisticsPreviewModal.tsx` |
| 3-1 그래디언트 부스팅 모듈 ★최우선 | ✅ 공통 | `types.ts`, `constants.ts`, `codeSnippets.ts`, `data_analysis_modules.py`, `components/PropertiesPanel.tsx`, `components/ComponentRenderer.tsx` |
| 3-2 URL 데이터 로더 | ✅ 공통(→공통 문서 작업2) | `codeSnippets.ts`(LoadData), `components/PropertiesPanel.tsx`, `server/split-data-server.js`(프록시) |
| 3-3 번들 샘플 확장 | ✅ 공통(→공통 문서 작업3) | `samples/`, `samples/samples-metadata.json` |
| 3-4 하이퍼파라미터 스윕/CV | ✅ 공통 | `types.ts`, `constants.ts`, `codeSnippets.ts`, `data_analysis_modules.py`, `components/PropertiesPanel.tsx` |
| 3-6 배포/스코어링 내보내기 | ✅ 공통(→공통 문서 작업6) | `utils/`, `codeSnippets.ts`, `components/PipelineCodeModal.tsx` — 고급기능 게이트 |
| 3-7 재학습 워크플로 | ✅ 공통(장기) | `samples/` 포맷, `App.tsx` |

> **재현성 불변식:** 모든 무작위 단계 `random_state=42`, `data_analysis_modules.py` ↔ `codeSnippets.ts` 정합, `verify/pipelines/` 픽스처로 byte-identical. **동기화 불변식:** 위 항목은 ML Auto Flow와 동일 변경.

---

## 2. JMDC 전용 관점 (베이스와 차이로 남길 부분)

### 2-1. 추천 모듈(01의 3-5) → 헬스케어 교차판매 시나리오 ★중
- **근거:** 01은 추천을 보험/헬스케어 교차판매 활용 가치로 언급. JMDC는 실제 코호트·질병 유병(DM 9.9%, HTN 26.8%, Cancer 4.5%) 데이터가 있어 **질환 기반 상품/중재 추천** 시나리오를 구체화하기 좋다.
- **구현 메모:** 베이스 추천 모듈(행렬분해/`surprise`)을 공통으로 추가하되, JMDC 데모는 `data/jmdc_synthetic/` 코호트×아이템으로 구성. Pyodide 패키지 가용성 사전 확인(미지원 시 외부 Python 전용).
- **재현성:** seed 고정. **동기화:** 모듈 자체는 공통, **헬스케어 데모/샘플만 JMDC 전용**.

### 2-2. 샘플 레퍼런스에 JMDC 합성코호트 추가(공통 문서 작업3의 JMDC 분기)
- `data/jmdc_synthetic/`의 `cohort_ready.csv`를 입력으로 한 **J1→J2→J3/J4/J6** 데모 파이프라인을 `samples/`에 추가하고 `samples-metadata.json`에 등록.
- 메타 스키마(공통 문서 작업4)에 **헬스케어 속성**(질환·관찰기간·KR/JP 비교 여부) 추가.

### 2-3. verify `datasets/` 보강(공통 문서 작업5의 JMDC 분기)
- 베이스와 동일 하네스이나 `verify/datasets/`가 없으므로, JMDC 합성 샘플의 결정적 부분(통계/생존곡선 요약값)을 픽스처화. J 모듈은 결정성 확인 가능한 출력만 우선 대상.

---

## 3. 우선순위 요약 (JMDC)

| 우선순위 | 항목 | 비고 |
|---|---|---|
| 1 | 3-1 그래디언트 부스팅(공통) | 책 핵심·트리 미러링 |
| 2 | 공통 I/O 작업4→3 (샘플 메타→확장, JMDC 코호트 포함) | 난이도 낮음 |
| 3 | 2-1 Evaluate 강화(공통) | |
| 4 | 3-2 URL 로더(공통) | |
| 5 | 3-6 스코어링 내보내기(공통, 고급 게이트) | |
| 6 | 2-1(전용) 헬스케어 추천 시나리오 | JMDC 차별화 |
| 7 | 3-4 스윕 / 3-7 재학습(공통, 장기) | |

> 본 계획의 공통 항목은 **반드시 ML Auto Flow와 동일 적용**하고, J 모듈/헬스케어 데모/샘플만 JMDC 차이로 유지한다(프로젝트 불변식).


---

## 부록: 구현 결과 (2026-06-22)

> 베이스(ML Auto Flow)와 **동일하게 공통 I/O 6종 + 모델 개선 3종**을 구현·동기화했습니다. 추천(헬스케어 시나리오)·재학습은 후속.

### 항목별 구현 상태 (베이스 동기화)
| 항목 | 상태 | 비고 |
|---|---|---|
| 2-1 Evaluate ROC/AUC 강화 | ✅ | 베이스와 byte-identical |
| 2-2 회귀지표 정합 | ✅ | RSE·RAE 추가 |
| 2-3 데이터 개요 패널 | ✅ | utils/dataOverview.ts |
| 3-1 그래디언트 부스팅 | ✅ | 베이스와 동일, 픽스처 14 |
| 3-2 URL 로더 / 3-3 샘플 / 3-6 스코어링 내보내기 | ✅ | 공통 |
| 3-4 하이퍼파라미터 스윕 | ✅ | SweepParameters, 픽스처 15 |
| (JMDC 전용) 합성 코호트 샘플 | ✅ | samples/JMDC_Cohort_IncidenceSurvival.json |
| 3-5 추천(헬스케어 교차판매) | ⏳ 후속 | 모듈 공통 구현 후 헬스케어 데모 추가 예정 |
| 3-7 재학습 | ⏳ 후속 | 장기 |

### 검증
- `npm run verify:pipelines` → **14/14 PASS** (베이스와 동일 픽스처, byte-identical 재현).
- `vite build` 성공. 공통 코드는 베이스와 동기화, JMDC 전용(J1~J7·코호트)만 차이.
