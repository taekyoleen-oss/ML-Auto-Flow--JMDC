// 재사용 가능한 AI 헬퍼 레이어.
// 모든 함수는 중앙 클라이언트(getGeminiClient)를 사용하므로, 키 관리/폴백/에러 처리가 한 곳에서 일관되게 동작한다.
// AI 기능을 새로 붙일 때는 새 호출부에서 new GoogleGenAI를 만들지 말고 이 헬퍼를 재사용한다.

import { getGeminiClient } from "./aiClient";

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
