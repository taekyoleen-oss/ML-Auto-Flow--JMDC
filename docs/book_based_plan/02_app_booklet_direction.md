# JMDC — 앱 설명 책자 제작 방향 및 가능성

> 원형: `ML Auto Flow/docs/azure_ml_book/02_app_booklet_direction.md`.
> 목표: Jeff Barnes의 *Microsoft Azure Essentials: Azure Machine Learning*과 **유사한 형식**으로 **ML_Auto_Flow-JMDC를 설명하는 책자**를 만든다. 본 문서는 그 **방향·가능성·구조·작업량** 기획서(작성은 승인 후).

---

## 1. 가능성 평가 — 결론: **높음 / 난이도 낮음**

JMDC는 베이스 ML Auto Flow의 모든 자산을 상속하므로, 베이스 책자의 1~8장을 거의 그대로 재사용하고 **JMDC 헬스케어 장(章)만 추가**하면 된다.

| 책자 구성요소 | 이미 존재하는 자산(JMDC) | 비고 |
|---|---|---|
| 모듈별 상세 설명 | `moduleDescriptions.ts` | 베이스 모듈 + J1~J7 |
| 앱 개요·사용법 | `README.md`, `APP_ANALYSIS_AND_USAGE.md`, `JMDC_TEST_GUIDE.md` | 그대로 활용 |
| Python 분석/재현 | `PYTHON_ANALYSIS_README.md`, `MODULE_EXECUTION_MAPPING.md`, `PYODIDE_DEVELOPMENT_GUIDE.md` | 차별화 강점 |
| 코드 예제 | `codeSnippets.ts`, `verify/` 검증 파이프라인 | 실행·재현 보장 |
| JMDC 헬스케어 | `data/jmdc_synthetic/`, J 모듈 미리보기 모달 5종, `논문내용.md` | **JMDC 전용 장** |
| 변경 이력 | `HISTORY.md`, `CLAUDE.md` 변경표 | 부록 |

→ 베이스와 동일하게 **클라우드·과금 불필요 + 브라우저 내 Python(Pyodide) 즉시 실행 + 재현성 + AI 해설**을 부각.

---

## 2. 책자 목차(안) — 베이스 미러 + JMDC 장 추가

| 장 | 제목 | 책 대응 | 핵심 내용 | 주 자산 |
|---|---|---|---|---|
| 1 | 데이터 과학과 ML 입문 | Ch1 | 지도/비지도, 예측 분석 | 신규 서술 |
| 2 | JMDC 시작하기 | Ch3 전반 | 캔버스·모듈·연결·실행, 클라우드 불필요 | `README.md`, `JMDC_TEST_GUIDE.md` |
| 3 | 첫 파이프라인: 회귀(end-to-end) | Ch3/Ch5 | Load→Split→Train→Score→Evaluate | `verify/` |
| 4 | 분류 모델 | Ch3 | 의사결정나무·랜덤포레스트·로지스틱 | `verify/` |
| 5 | 군집 분석 | Ch6 | K-Means + 해석 | `verify/` |
| 6 | 통계·검정 모듈 | (책 없음) | 가설검정·정규성·상관·VIF | `moduleDescriptions.ts` |
| 7 | **Python 코드 내보내기와 재현성** | (앱 차별화) | 외부 실행·byte-identical, verify | `PYTHON_ANALYSIS_README.md`, `verify/` |
| 8 | **AI 보조 기능** | (앱 차별화) | 코드/결과/오류 해설, AI 파이프라인 생성 | `lib/aiHelpers.ts` |
| **9** | **JMDC 헬스케어 코호트 분석** | (JMDC 전용) | J1 코호트→J2 라벨→J3 발생률→J4 생존(KM)→J5 누적발생→J6 Cox(Schoenfeld)→J7 KR/JP 매칭 | `data/jmdc_synthetic/`, J 모달 5종 |
| 부록 A | 모듈 레퍼런스 | — | 모듈 카드(입출력·파라미터·오류) | `moduleDescriptions.ts` |
| 부록 B | 변경 이력 | — | 기능 연혁 | `HISTORY.md`, `CLAUDE.md` |

### 부각할 강점(책 대비)
1. **클라우드·과금 불필요** — 브라우저만으로.
2. **브라우저 내 Python(Pyodide)** — 설치 없는 즉시 실행.
3. **재현성 보증** — 내보낸 코드 외부 동일 결과(byte-identical) + 자동 회귀 검증.
4. **AI 해설** — 결과·코드·오류 한국어 해설.
5. **헬스케어 실무 코호트** — 합성 JMDC 데이터로 생존/Cox/한일 비교까지.

---

## 3. 제작 경로 / 포맷

| 옵션 | 도구/스킬 | 권장도 |
|---|---|---|
| Markdown → PDF | `make-pdf` | ★ 주 산출물 |
| Word(.docx) | `report-builder` | 보조 |
| PPT(.pptx) | `app-doc-ppt` (백엔드 3002 PPT 생성 활용) | 발표용 |

**권장:** Markdown SSOT → `make-pdf`로 PDF → 필요 시 Word/PPT 파생.

---

## 4. 시각자료 & 작업량

- **스크린샷 자동화:** Playwright(MCP)로 앱(`npm run dev`, 127.0.0.1:3003 / 백엔드 3002)을 띄워 각 장 예제 캔버스·결과 모달 캡처. `samples/`·`data/jmdc_synthetic/` 로드로 동일 화면 재현.
- **코드 일관성:** 책자 코드는 `verify`로 검증된 코드만.

| 단계 | 범위 | 산출물 | 분량 |
|---|---|---|---|
| MVP | 1~5장 + 부록 A | PDF | 40~60p |
| 확장판 | 6~9장(헬스케어 포함) + 부록 B | PDF | +40~60p |
| 발표본 | 핵심 요약 | PPTX | 20~30 슬라이드 |

> **권고:** ML Auto Flow(베이스)와 **공통 책자 본문(1~8장)을 공유**하고, **9장(JMDC 헬스케어)·부록은 JMDC 전용 분리**. 두 앱 동기화 불변식과 정합.
