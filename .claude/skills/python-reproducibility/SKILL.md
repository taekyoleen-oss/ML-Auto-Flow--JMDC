---
name: python-reproducibility
description: ML Auto Flow / JMDC 앱에서 분석 모듈을 추가·수정·강화할 때 Python 재현성 불변식을 유지하는 방법. data_analysis_modules.py와 codeSnippets.ts 동기화, 경계면 정합성, Pyodide/서버 실행 제약을 다룬다. 모듈/파이프라인/코드 내보내기/성능 강화 작업이면 반드시 참조하라.
---

# Python Reproducibility

이 앱의 **가장 중요한 불변식**: 노코드 캔버스로 만든 모든 분석 모듈은 사용자가 내보낸 **Python 코드로 동일 결과를 재현**할 수 있어야 한다. 이유: 사용자가 코드 수준에서 검증·재현·이식하는 것이 앱의 핵심 가치다.

## 핵심 파일
- `data_analysis_modules.py` — Python 분석 본체(두 앱 바이트 동일).
- `codeSnippets.ts` — 각 모듈이 내보내는 Python 코드 문자열.
- `constants.ts` — 모듈 정의/입출력 파라미터.
- `components/*PreviewModal.tsx` — 모듈 결과 미리보기(스키마 일치 필요).

## 모듈 추가/수정 절차
1. **Python 먼저:** `data_analysis_modules.py`에 함수/로직을 작성·수정한다. 결정성(시드 고정, 정렬 순서) 보장.
2. **내보내기 코드 동기화:** `codeSnippets.ts`의 해당 모듈 Python 코드를 본체와 **동작이 일치하도록** 갱신한다. 둘 중 하나만 바꾸지 않는다.
3. **모듈 정의:** `constants.ts`에 파라미터/입출력을 반영한다.
4. **미리보기 모달:** 출력 스키마가 바뀌면 해당 `*PreviewModal.tsx`도 맞춘다.
5. **검증:** 내보낸 Python 코드를 단독 실행해 UI 실행 결과와 동일한지 교차 비교한다(`qa-verifier`).

## 라이브러리 제약
- 허용: `requirements.txt`의 pandas, numpy, scikit-learn, statsmodels, scipy, seaborn, matplotlib, imbalanced-learn, python-pptx 등.
- Pyodide(브라우저)에서 실행되는 모듈은 Pyodide가 지원하는 패키지만 사용. 서버 실행(`server/split-data-server.js`)은 로컬 Python 환경 사용.
- 새 의존성이 필요하면 임의 추가 금지 — 보고하고 합의 후 `requirements.txt`에 반영.

## 성능/기능 강화 시
- 벡터화(numpy/pandas), 불필요한 복사 제거, 알고리즘 개선으로 성능을 높이되 **출력 동등성**을 유지한다.
- 강화 전후 동일 입력에 대해 동일(또는 수치적으로 동치) 출력이 나오는지 확인한다.

## 흔한 함정
- UI 로직만 바꾸고 `codeSnippets.ts`를 안 고쳐 내보낸 코드가 실제와 달라짐 → 재현 실패.
- 랜덤 시드 미고정으로 재현 불가.
- Pyodide 미지원 패키지 사용으로 브라우저 실행 깨짐.
