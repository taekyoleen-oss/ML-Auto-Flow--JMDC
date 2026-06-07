// 중앙 AI 클라이언트 — Gemini(@google/genai) 키 관리 및 클라이언트 생성을 한 곳으로 통일.
//
// 키 로드 우선순위:
//   1) localStorage('gemini_api_key')  — 사용자가 설정 모달에서 직접 입력한 키
//   2) (dev 폴백) process.env.GEMINI_API_KEY / API_KEY — vite.config가 개발 모드에서만 주입,
//      프로덕션 빌드에서는 빈 문자열로 치환되어 번들에 키가 노출되지 않는다.
//
// 키가 없으면 ApiKeyMissingError를 던지고 설정 모달을 열도록 이벤트를 발행한다(앱 크래시 금지).

import { GoogleGenAI } from "@google/genai";

export const API_KEY_STORAGE_KEY = "gemini_api_key";
export const API_KEY_CHANGED_EVENT = "gemini-api-key-changed";
export const OPEN_API_KEY_SETTINGS_EVENT = "open-api-key-settings";

/** 사용자에게 친절히 안내할 수 있는, 키 미설정 전용 에러. */
export class ApiKeyMissingError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Gemini API 키가 설정되지 않았습니다. 우측 상단 설정(⚙) 버튼에서 본인의 Gemini API 키를 입력해 주세요."
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
      ((typeof process !== "undefined" && process.env && (process.env.GEMINI_API_KEY as string)) || "") ||
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
 * Gemini 클라이언트를 생성해 반환한다.
 * 키가 없으면 설정 모달을 열도록 요청하고 ApiKeyMissingError를 던진다.
 * 모든 AI 호출부는 `new GoogleGenAI(...)` 대신 이 함수를 사용한다.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    requestApiKeySettings();
    throw new ApiKeyMissingError();
  }
  return new GoogleGenAI({ apiKey });
}
