---
name: dual-app-sync
description: ML Auto Flow와 ML_Auto_Flow-JMDC 두 앱에 변경을 동일하게 적용·검증하는 방법. 어떤 변경이 공통(양쪽)이고 어떤 것이 JMDC 전용인지 구분, 포팅, diff 검증을 다룬다. 한쪽 앱을 수정했거나 "다른 앱에도", "양쪽에", "동기화" 요청이면 반드시 참조하라.
---

# Dual-App Sync

두 앱은 동일 형태로 개발됨: `C:\00 App Project\ML Auto Flow`(베이스)와 `C:\00 App Project\ML_Auto_Flow-JMDC`(JMDC 상위집합). 한쪽만 고치면 갈라진다(drift).

## 변경 분류
**공통(양쪽 동일 적용):**
- `data_analysis_modules.py`(현재 바이트 동일), 공유 컴포넌트, `vite.config.ts`, `package.json`, 공유 `lib/`·`hooks/`·`contexts/`, AI 키/클라이언트, 성능·버그수정.

**JMDC 전용(JMDC 앱만):**
- `components/JMDCCohortPreviewModal.tsx`, `JMDCCoxPreviewModal.tsx`, `JMDCIncidencePreviewModal.tsx`, `JMDCMatcherPreviewModal.tsx`, `JMDCSurvivalPreviewModal.tsx`
- `components/ModuleDescriptionModal.tsx`, `moduleDescriptions.ts`
- `data/jmdc_synthetic/`, JMDC 합성 데이터 생성 스크립트
- J1~J7 모듈 관련 `constants.ts` / `codeSnippets.ts` 엔트리

## 적용 절차
1. 원본 앱에서 변경을 확정한다(보통 JMDC가 더 풍부하므로 JMDC에서 먼저, 또는 공통은 어느 쪽이든).
2. 변경을 **공통/JMDC전용**으로 분류한다.
3. 공통 변경을 대상 앱의 해당 위치에 적용한다. **기계적 복사가 아니라 맥락 적용** — 두 앱은 `App.tsx`·`constants.ts`·`codeSnippets.ts` 크기/라인이 다르므로 정확한 앵커로 Edit한다.
4. 파일 전체가 동일해야 하는 것(예: `data_analysis_modules.py`)은 적용 후 `diff`로 일치 확인한다.

## 검증
```bash
diff "C:/00 App Project/ML_Auto_Flow-JMDC/data_analysis_modules.py" \
     "C:/00 App Project/ML Auto Flow/data_analysis_modules.py" && echo IDENTICAL
```
- 공통 컴포넌트는 변경 블록이 양쪽에 동일하게 들어갔는지 확인.
- 의도된 차이(JMDC 전용)만 남았는지 점검.

## 함정
- JMDC 전용 변경을 베이스 앱에 잘못 포팅(존재하지 않는 모듈 참조로 깨짐).
- 앵커가 한쪽에만 있어 자동 적용 실패 → 임의 추측 금지, 수동 검토 요청.
