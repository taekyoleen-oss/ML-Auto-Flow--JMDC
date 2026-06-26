// 중앙 AI 클라이언트 — Claude(@anthropic-ai/sdk) 키 관리 및 클라이언트 생성을 한 곳으로 통일.
//
// 키 로드 우선순위:
//   1) localStorage('anthropic_api_key')  — 사용자가 설정 모달에서 직접 입력한 키
//   2) (dev 폴백) process.env.ANTHROPIC_API_KEY / API_KEY — vite.config가 개발 모드에서만 주입,
//      프로덕션 빌드에서는 빈 문자열로 치환되어 번들에 키가 노출되지 않는다.
//
// 키가 없으면 ApiKeyMissingError를 던지고 설정 모달을 열도록 이벤트를 발행한다(앱 크래시 금지).

import Anthropic from "@anthropic-ai/sdk";

export const API_KEY_STORAGE_KEY = "anthropic_api_key";
export const API_KEY_CHANGED_EVENT = "anthropic-api-key-changed";
export const OPEN_API_KEY_SETTINGS_EVENT = "open-api-key-settings";

/** 목적별 모델 티어. */
// 빠른 보조: 코드해설·결과해설·오류수정 등 경량 작업.
export const CLAUDE_FAST = "claude-haiku-4-5";
// 생성·추론: 모델 분석보고서, 모듈/파이프라인 추천 등 무거운 작업.
export const CLAUDE_CAPABLE = "claude-sonnet-4-6";

/** 사용자에게 친절히 안내할 수 있는, 키 미설정 전용 에러. */
export class ApiKeyMissingError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Anthropic Claude API 키가 설정되지 않았습니다. 우측 상단 설정(⚙) 버튼에서 본인의 Claude API 키를 입력해 주세요."
    );
    this.name = "ApiKeyMissingError";
  }
}

/** localStorage에 저장된 사용자 키를 읽는다. */
export function getStoredApiKey(): string {
  try {
    return (typeof localStorage !== "undefined" && localStorage.getItem(API_KEY_STORAGE_KEY)) || "";
  } catch {
    return "";
  }
}

/** dev 전용 env 폴백. 프로덕션 빌드에서는 vite define이 빈 문자열로 치환한다. */
function getEnvApiKey(): string {
  try {
    // 아래 참조들은 vite.config의 define으로 빌드 시 치환된다.
    return (
      ((typeof process !== "undefined" && process.env && (process.env.ANTHROPIC_API_KEY as string)) || "") ||
      ((typeof process !== "undefined" && process.env && (process.env.API_KEY as string)) || "")
    );
  } catch {
    return "";
  }
}

/** 실제 사용할 API 키(사용자 키 우선, 없으면 dev env 폴백). */
export function getApiKey(): string {
  return getStoredApiKey() || getEnvApiKey();
}

/** 키 보유 여부. */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/** 사용자 키 저장. 변경 이벤트를 발행하여 UI가 즉시 반영하도록 한다. */
export function setApiKey(key: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    window.dispatchEvent(new CustomEvent(API_KEY_CHANGED_EVENT));
  } catch {
    /* localStorage 사용 불가 환경 무시 */
  }
}

/** 저장된 사용자 키 삭제. */
export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(API_KEY_CHANGED_EVENT));
  } catch {
    /* noop */
  }
}

/** 설정 모달을 열도록 앱에 요청한다. */
export function requestApiKeySettings(): void {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_API_KEY_SETTINGS_EVENT));
  } catch {
    /* noop */
  }
}

/**
 * Claude 클라이언트를 생성해 반환한다.
 * 키가 없으면 설정 모달을 열도록 요청하고 ApiKeyMissingError를 던진다.
 * 모든 AI 호출부는 `new Anthropic(...)` 대신 이 함수를 사용한다.
 * 브라우저 직접 호출이므로 dangerouslyAllowBrowser를 켠다(기존 Gemini도 동일하게 브라우저에 키 노출).
 */
export function getClaudeClient(): Anthropic {
  const apiKey = getApiKey();
  if (!apiKey) {
    requestApiKeySettings();
    throw new ApiKeyMissingError();
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/**
 * 응답 content 블록에서 text만 추출해 합친다(Claude messages.create 응답 헬퍼).
 */
export function extractText(resp: Anthropic.Message): string {
  return resp.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();
}

/**
 * 비스트리밍 단건 프롬프트 호출 공통 헬퍼.
 * 호출부(미리보기 모달 등)에서 `getClaudeClient()` + `messages.create` 보일러플레이트를 줄인다.
 * 키 없으면 getClaudeClient가 ApiKeyMissingError를 던지고 설정 모달이 자동으로 열린다.
 */
export async function generateClaudeText(opts: {
  prompt: string;
  model?: string;
  maxTokens?: number;
  system?: string;
}): Promise<string> {
  const client = getClaudeClient();
  const resp = await client.messages.create({
    model: opts.model ?? CLAUDE_FAST,
    max_tokens: opts.maxTokens ?? 8192,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });
  return extractText(resp);
}

/**
 * 주어진 key로 실제 연결을 1회 시도해 유효성을 검사한다.
 * (저장된 키가 아니라 인자로 받은 key로 테스트하므로, 저장 전 검증에 사용할 수 있다.)
 * 401/429/네트워크 등 실패 유형을 분류해 사용자 친화 메시지로 반환한다. 절대 throw하지 않는다.
 */
export async function testApiKey(key: string): Promise<{ ok: boolean; message: string }> {
  const trimmed = (key || "").trim();
  if (!trimmed) {
    return { ok: false, message: "API 키가 비어 있습니다. 키를 입력한 뒤 다시 시도해 주세요." };
  }
  try {
    const client = new Anthropic({ apiKey: trimmed, dangerouslyAllowBrowser: true });
    await client.messages.create({
      model: CLAUDE_FAST,
      max_tokens: 4,
      messages: [{ role: "user", content: "ping" }],
    });
    return { ok: true, message: "연결 성공 · 키가 정상적으로 동작합니다." };
  } catch (err) {
    // SDK 타입 우선 분류, 없으면 status/메시지 폴백.
    const status = (err as any)?.status;
    if (err instanceof Anthropic.AuthenticationError || status === 401) {
      return { ok: false, message: "인증 실패(401) · API 키가 올바르지 않거나 권한이 없습니다." };
    }
    if (err instanceof Anthropic.PermissionDeniedError || status === 403) {
      return { ok: false, message: "권한 없음(403) · 이 키로는 해당 모델/기능에 접근할 수 없습니다." };
    }
    if (err instanceof Anthropic.RateLimitError || status === 429) {
      return { ok: false, message: "요청 한도 초과(429) · 키는 유효하지만 잠시 후 다시 시도해 주세요." };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { ok: false, message: "네트워크 오류 · 인터넷 연결을 확인한 뒤 다시 시도해 주세요." };
    }
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch") || lower.includes("timeout") || lower.includes("enotfound")) {
      return { ok: false, message: "네트워크 오류 · 인터넷 연결을 확인한 뒤 다시 시도해 주세요." };
    }
    return { ok: false, message: `연결 테스트 실패: ${raw}` };
  }
}
