---
name: ai-key-and-features
description: ML Auto Flow / JMDC 앱의 Gemini(@google/genai) AI 기능 작업 방법. 하드코딩 키 제거 후 사용자별 로컬 API 키 입력(localStorage) + 중앙 AI 클라이언트 구조, AI 기능 확장 패턴을 다룬다. AI/Gemini/API 키/설정 모달/AI 기능 추가 작업이면 반드시 참조하라.
---

# AI Key & Features

이 앱의 AI는 `@google/genai`(Gemini)다. 현재 문제: 키가 `vite.config.ts`의 `define`으로 **빌드 번들에 하드코딩 주입**되어 노출된다. 목표: **사용자가 본인 키를 로컬 입력**해 쓰도록 전환 + AI 활용 확대.

## 로컬 API 키 아키텍처
1. **중앙 AI 클라이언트** (`lib/aiClient.ts` 신규):
   - 키 로드 우선순위: `localStorage('gemini_api_key')` → (dev 폴백) `process.env.GEMINI_API_KEY`.
   - `getGeminiClient()` / `getApiKey()` / `setApiKey()` / `hasApiKey()` 제공.
   - 키 없으면 사용자에게 설정 모달을 안내하는 명확한 에러를 던진다(크래시 금지).
2. **설정 모달** (`components/ApiKeySettingsModal.tsx` 신규, `frontend-engineer`):
   - 키 입력/저장/삭제, 마스킹 표시, "키 발급 방법" 링크.
   - 헤더/툴바에 진입점(설정 아이콘) 추가.
3. **호출부 통일:** 분산된 `new GoogleGenAI({ apiKey: process.env.API_KEY ... })`를 중앙 클라이언트 호출로 교체.
   - 위치: `App.tsx`, `components/PropertiesPanel.tsx`, `DataAnalysisRAGModal.tsx`, `DiversionCheckerPreviewModal.tsx`, `FinalXolPricePreviewModal.tsx`, `DataPreviewModal.tsx`.
4. **vite.config.ts:** `define`의 `process.env.API_KEY`/`GEMINI_API_KEY` 키 주입 제거(또는 빈 문자열). dev 폴백을 유지하려면 env 노출 대신 클라이언트가 import.meta.env를 읽도록 처리.

## env 폴백 정책 (사용자 결정: 유지)
- dev에서 키 미입력 시 `.env.local`의 키를 폴백 사용. 단, **프로덕션 빌드 번들에는 키를 박지 않는다**.
- Vite는 `import.meta.env`로 `VITE_`/허용 프리픽스 변수를 노출하므로, dev 폴백은 빌드 모드 분기 또는 별도 처리로 프로덕션 노출을 막는다.

## AI 기능 확장 후보
- **모듈 자동 추천:** 데이터/목표 기반 파이프라인 제안(기존 AIPipelineFrom* 모달 강화).
- **결과 자연어 해설:** 모듈 실행 결과를 사람 언어로 요약.
- **코드 설명:** 내보낸 Python 코드 라인별 설명(재현성과 연계).
- **오류 자동수정 제안:** 실패한 모듈/코드에 대한 수정안.
- 신규 AI 기능도 Python 재현성 불변식을 따른다 → `python-reproducibility` 참조.

## 에러 처리
- 401(키 오류)→설정 모달 유도, 429(쿼터)→재시도/안내, 네트워크→재시도. 유형별 메시지 구분.

## 함정
- 키를 `define`/번들에 남겨두면 노출 지속.
- 호출부 일부만 중앙화하면 키 로직 분산 유지.
- dev 폴백을 프로덕션에까지 노출해 키 유출.
