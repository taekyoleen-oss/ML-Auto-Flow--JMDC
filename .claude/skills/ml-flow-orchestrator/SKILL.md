---
name: ml-flow-orchestrator
description: ML Auto Flow / JMDC 두 앱의 수정·강화·테스트를 에이전트 팀으로 조율하는 오케스트레이터. Python 모듈 강화, AI 기능(로컬 키/확장), 프론트엔드 변경, 두 앱 동기화, QA가 필요한 모든 작업에 사용. "ML Auto Flow 수정", "JMDC 모듈 추가/강화", "AI 키 로컬화", "두 앱 동기화", "성능 강화"는 물론 "다시 실행", "재실행", "업데이트", "이어서", "보완", "방금 그 작업 다른 앱에도" 같은 후속 요청에도 반드시 이 스킬을 사용하라. 단순 사실 질문은 직접 답해도 된다.
---

# ML Flow Orchestrator

ML Auto Flow(`C:\00 App Project\ML Auto Flow`)와 ML_Auto_Flow-JMDC(`C:\00 App Project\ML_Auto_Flow-JMDC`) 두 앱을 **에이전트 팀**으로 조율한다.

**실행 모드:** 에이전트 팀 (기본). 2명 이상 협업 + 실시간 정합성 조율이 필요하므로 팀 모드.

## 절대 불변식 (모든 작업에 우선)
1. **Python 재현성:** 모든 분석 모듈은 내보낸 Python 코드로 재현 가능해야 한다. `data_analysis_modules.py` ↔ `codeSnippets.ts` 정합성 유지. → `python-reproducibility` 스킬.
2. **두 앱 동기화:** 공통 변경은 양쪽에 동일 적용, JMDC 전용만 차이로 남긴다. → `dual-app-sync` 스킬.

## 팀 구성
| 에이전트 | 역할 |
|----------|------|
| `python-module-engineer` | Python 모듈, codeSnippets, 재현성 |
| `ai-feature-engineer` | Gemini AI, 로컬 키, AI 확장 |
| `frontend-engineer` | React/TS, 캔버스, 모달, 설정 UI |
| `dual-app-sync` | 두 앱 변경 동기화·정합성 |
| `qa-verifier` | 빌드/타입/재현성/UI 검증 |

모든 Agent 호출에 `model: "opus"` 명시. 모든 에이전트는 `general-purpose` 타입으로 스폰하되, 위 정의 파일의 역할을 prompt에 주입한다.

## Phase 0: 컨텍스트 확인
1. `_workspace/` 존재 여부 확인.
   - 없음 → **초기 실행**.
   - 있음 + 부분 수정 요청 → **부분 재실행**(해당 에이전트만 재호출, 이전 노트 읽기).
   - 있음 + 새 작업 → `_workspace/`를 `_workspace_prev/`로 이동 후 **새 실행**.
2. 작업이 어느 앱에 영향을 주는지 판단(공통/JMDC전용/둘 다).

## Phase 1: 분석 & 계획
1. 요청을 작업 유형으로 분류: Python 모듈 / AI / 프론트엔드 / 동기화 / QA(보통 복합).
2. 관련 메모리(`python-module-reproducibility`, `dual-app-sync`, `ai-local-api-key`, `ml-auto-flow-architecture`) 참조.
3. 작업을 분해해 `TaskCreate`로 등록하고 의존관계 설정.

## Phase 2: 팀 실행
1. `TeamCreate`로 필요한 에이전트만 팀 구성(작업에 무관한 에이전트 제외).
2. `TaskCreate`로 작업 할당. 일반 데이터 흐름:
   - 구현(`python-module-engineer` / `ai-feature-engineer` / `frontend-engineer`) → 변경 파일 목록 산출
   - → `dual-app-sync`가 양쪽 앱에 적용 + diff 검증
   - → `qa-verifier`가 빌드/타입/재현성/UI 검증 (점진적, 모듈 완성 즉시)
3. 팀원은 `SendMessage`로 직접 조율, 산출물은 `_workspace/`에 파일로 저장.

## Phase 3: 종합 & 보고
1. `_workspace/` 산출물 수집, 최종 변경 요약.
2. 빌드/검증 결과를 **증거(명령 출력)와 함께** 보고. 실패는 숨기지 않는다.
3. 두 앱 정합성(의도된 차이만 남았는지) 확인 보고.
4. 변경 이력을 양쪽 `CLAUDE.md`에 기록.
5. 사용자에게 개선 피드백 기회 제공(Phase 7 진화).

## 데이터 전달 프로토콜
- 태스크 기반(조율) + 파일 기반(`_workspace/{phase}_{agent}_{artifact}.md`) + 메시지 기반(실시간).
- 최종 산출물만 실제 코드에 반영, 중간 노트는 `_workspace/` 보존.

## 에러 핸들링
- 1회 재시도 후 재실패 시 해당 결과 없이 진행하되 보고서에 누락 명시.
- `dual-app-sync`가 앵커 못 찾으면 임의 적용 금지, 수동 검토 요청.
- 빌드 실패 시 완료 주장 금지 — 실패 출력 그대로 보고.

## 테스트 시나리오
- **정상 흐름:** "AI 키를 로컬 입력 방식으로 바꿔줘" → 팀 구성(ai+frontend+sync+qa) → 중앙 클라이언트+설정모달 구현 → 양쪽 앱 적용 → 빌드/키경로 검증 → 보고.
- **에러 흐름:** `dual-app-sync`가 ML Auto Flow에서 앵커 불일치 발견 → 자동 적용 중단, 차이점과 함께 수동 검토 요청, JMDC만 우선 반영 후 보고.

## 후속 작업
- "다시", "재실행", "이어서", "다른 앱에도", "보완" 등의 요청 시 Phase 0에서 `_workspace/`를 확인해 부분/새 실행을 판별한다.
