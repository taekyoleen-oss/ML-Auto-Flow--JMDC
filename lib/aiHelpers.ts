// 재사용 가능한 AI 헬퍼 레이어.
// 모든 함수는 중앙 클라이언트(getGeminiClient)를 사용하므로, 키 관리/폴백/에러 처리가 한 곳에서 일관되게 동작한다.
// AI 기능을 새로 붙일 때는 새 호출부에서 new GoogleGenAI를 만들지 말고 이 헬퍼를 재사용한다.

import { getGeminiClient, hasApiKey } from "./aiClient";
import { ReportContext } from "../types";
import { buildModelReportHtmlFallback } from "../utils/modelReport";

/** 빠른 응답용 기본 모델. 무거운 추론이 필요하면 gemini-2.5-pro로 교체 가능. */
export const DEFAULT_AI_MODEL = "gemini-2.5-flash";

/** 프롬프트 1건을 보내고 텍스트 응답을 받는다(공통 래퍼). */
export async function runPrompt(prompt: string, model: string = DEFAULT_AI_MODEL): Promise<string> {
  const ai = getGeminiClient(); // 키 없으면 ApiKeyMissingError + 설정 모달 자동 오픈
  const response = await ai.models.generateContent({ model, contents: prompt });
  return (response.text || "").trim();
}

/**
 * 프롬프트 1건을 스트리밍으로 보내고, 도착하는 텍스트 청크를 순차적으로 yield한다(공통 스트리밍 래퍼).
 * 키 없으면 runPrompt와 동일하게 ApiKeyMissingError를 던지며 설정 모달이 자동으로 열린다.
 */
export async function* streamPrompt(
  prompt: string,
  model: string = DEFAULT_AI_MODEL
): AsyncGenerator<string> {
  const ai = getGeminiClient(); // 키 없으면 ApiKeyMissingError + 설정 모달 자동 오픈
  const stream = await ai.models.generateContentStream({ model, contents: prompt });
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

/**
 * 내보낸 Python 파이프라인 코드를 한국어로 해설한다.
 * 이 앱의 핵심 가치(모듈의 Python 재현성)를 사용자가 코드 수준에서 이해하도록 돕는다.
 */
export async function explainPythonCode(code: string): Promise<string> {
  return runPrompt(buildExplainPythonCodePrompt(code));
}

/** explainPythonCode와 동일한 프롬프트를 만들어 반환한다(스트리밍 래퍼와 공유). */
function buildExplainPythonCodePrompt(code: string): string {
  return `당신은 친절한 데이터 사이언스 교육자입니다. 아래는 노코드 ML 파이프라인 도구가 생성한 **재현 가능한 Python 코드**입니다.
이 코드를 처음 보는 분석가도 이해할 수 있도록 한국어로 설명해 주세요.

다음 형식의 마크다운으로 답하세요(불필요한 서론 없이):
**한 줄 요약:** (이 파이프라인이 전체적으로 무엇을 하는지)
**단계별 설명:** (주요 블록/함수를 위에서 아래로, 각 단계가 데이터에 무엇을 하는지)
**사용된 핵심 라이브러리:** (pandas, scikit-learn 등과 그 역할)
**재현 시 주의점:** (랜덤 시드, 입력 데이터 형식, 필요한 패키지 등 동일 결과 재현에 중요한 점)

코드:
\`\`\`python
${code}
\`\`\``;
}

/** explainPythonCode의 스트리밍 버전. 동일 프롬프트를 청크 단위로 흘려보낸다. */
export async function* streamExplainPythonCode(code: string): AsyncGenerator<string> {
  yield* streamPrompt(buildExplainPythonCodePrompt(code));
}

/** 모듈 실행 결과(요약/표)를 한국어로 해설한다. */
export async function explainModuleResult(moduleType: string, resultSummary: string): Promise<string> {
  const prompt = `당신은 데이터 분석 전문가입니다. '${moduleType}' 모듈의 실행 결과를 비전문가도 이해할 수 있게 한국어로 해설해 주세요.
숫자의 의미, 주목할 패턴, 실무적 시사점을 간결한 마크다운(불릿 위주)으로 정리하세요. 과장 없이 데이터가 말하는 것만 설명하세요.

결과 요약:
${resultSummary}`;
  return runPrompt(prompt);
}

/** 모듈/코드 실행 오류에 대한 원인 추정과 수정안을 제시한다. */
export async function suggestErrorFix(errorMessage: string, context?: string): Promise<string> {
  return runPrompt(buildSuggestErrorFixPrompt(errorMessage, context));
}

/** suggestErrorFix와 동일한 프롬프트를 만들어 반환한다(스트리밍 래퍼와 공유). */
function buildSuggestErrorFixPrompt(errorMessage: string, context?: string): string {
  return `당신은 Python/데이터분석 디버깅 전문가입니다. 아래 오류의 가장 가능성 높은 원인과 구체적 해결 단계를 한국어 마크다운으로 제시하세요.
**추정 원인:** / **해결 방법:** (번호 매긴 단계) / **예방 팁:** 형식으로 답하세요.

오류 메시지:
${errorMessage}
${context ? `\n관련 맥락:\n${context}` : ""}`;
}

/** suggestErrorFix의 스트리밍 버전. 동일 프롬프트를 청크 단위로 흘려보낸다. */
export async function* streamSuggestErrorFix(
  errorMessage: string,
  context?: string
): AsyncGenerator<string> {
  yield* streamPrompt(buildSuggestErrorFixPrompt(errorMessage, context));
}

// ---------------------------------------------------------------------------
// 모델 분석보고서(ModelAnalysisReport) — 자기완결 HTML 보고서 생성.
// 문서화(메타) 기능: codeSnippets/export/verify와 무관(Python 재현성 불변식 비대상).
// ---------------------------------------------------------------------------

/** AI가 생성한 HTML이 자기완결·안전한지 검증한다(<html> 포함, <script> 없음). */
function isValidReportHtml(html: string): boolean {
  if (!html || html.length < 200) return false;
  const lower = html.toLowerCase();
  if (!lower.includes("<html")) return false;
  if (lower.includes("<script")) return false; // 보안: 스크립트 금지
  return true;
}

/** AI 응답에서 코드펜스(```html …```)를 제거하고 HTML만 남긴다. */
function stripHtmlFence(text: string): string {
  let t = (text || "").trim();
  // ```html ... ``` 또는 ``` ... ``` 제거
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  // 앞부분 잡설이 있으면 <!DOCTYPE 또는 <html부터 시작.
  const idx = t.search(/<!doctype html|<html/i);
  if (idx > 0) t = t.slice(idx);
  return t.trim();
}

function buildModelReportPrompt(ctx: ReportContext): string {
  const styleHint =
    'CSS 변수(--ink/--muted/--line/--accent/--accent-soft/--th 등)와 .report/.cover/.badge/.callout/.callout.warn/.kpi-grid/.kpi/table(th,td,.num)/pre 클래스를 사용한 인라인 <style>를 head에 포함하라(예시 디자인과 동일한 깔끔한 문서 스타일).';
  return `너는 ML 모델 문서 작성가다. 아래 파이프라인 메타데이터(JSON)와 사용자 추가정보만으로, 한국어 **자기완결 HTML** 모델 분석보고서를 1개 작성한다.

[필수 규칙]
1) 메타데이터에 있는 수치만 사용한다(수치 창작 절대 금지). 없는 값은 비우거나 "(자료 없음)"으로 둔다.
2) 데이터셋/도메인 배경 서술에 일반 지식을 쓸 수 있으나, 그런 문장은 "(일반 지식 기반)"으로 표기해 실측과 구분한다.
3) 출력은 \`<!DOCTYPE html>\`로 시작하는 **완전한 HTML 1개**. 외부 CSS/JS/폰트 0, \`<script>\` 태그 절대 금지(보안). ${styleHint}
4) 섹션 구조: 표지(badge "모델 분석보고서")·1.요약(+KPI 그리드)·2.데이터셋 개요(표+표본)·3.변수(컬럼) 사전(사용/미사용 특성 명시)·4.타깃/클래스 또는 군집 분포·5.모델 개발 과정(파이프라인 다이어그램 pre + 단계별 파라미터)·6.분석 결과와 해석(혼동행렬·임계값·지표)·7.재현성·8.결론 및 한계.
5) 표·callout·KPI 카드를 적극 활용하고, 미사용 특성·클래스 불균형 등 한계를 정직하게 기술한다.
6) HTML 외에 다른 텍스트(설명·코드펜스)를 출력하지 마라.

[파이프라인 메타데이터 JSON]
${JSON.stringify(ctx, null, 2)}

${
  ctx.extraInfo && ctx.extraInfo.trim()
    ? `[사용자 추가정보 — 최우선 근거로 반영]\n${ctx.extraInfo.trim()}`
    : "[사용자 추가정보 없음 — 데이터셋/도메인 배경은 일반 지식으로 보강하되 '(일반 지식 기반)'으로 표기하라]"
}`;
}

/**
 * 모델 분석보고서 HTML을 생성한다.
 * - API 키가 없으면 모달을 띄우지 않고 결정적 폴백 HTML을 반환한다(일반 사용자도 결과 열람 가능).
 * - 키가 있으면 gemini-2.5-pro로 생성(실패/한도 시 flash 재시도, 그래도 실패하면 폴백).
 * - AI 출력은 자기완결·안전(<html> 포함·<script> 없음) 검증을 통과해야 채택된다.
 */
export async function generateModelReportHtml(
  ctx: ReportContext
): Promise<{ html: string; source: "ai" | "fallback" }> {
  if (!hasApiKey()) {
    return { html: buildModelReportHtmlFallback(ctx), source: "fallback" };
  }
  const prompt = buildModelReportPrompt(ctx);
  const models = ["gemini-2.5-pro", DEFAULT_AI_MODEL];
  for (const model of models) {
    try {
      const raw = await runPrompt(prompt, model);
      const html = stripHtmlFence(raw);
      if (isValidReportHtml(html)) {
        return { html, source: "ai" };
      }
    } catch (err) {
      // 다음 모델로 재시도. 마지막 실패 시 폴백.
      console.warn(`[generateModelReportHtml] ${model} 실패:`, err);
    }
  }
  return { html: buildModelReportHtmlFallback(ctx), source: "fallback" };
}
