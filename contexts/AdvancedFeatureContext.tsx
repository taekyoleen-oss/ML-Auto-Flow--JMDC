import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * 고급기능(AI 파이프라인 생성 / AI 데이터 분석 / PPT 생성 / 코드 보기·내보내기 / API 키 설정 등
 * API·코드 관련 기능) 잠금 게이트.
 *
 * - 일반 사용자: 잠금 상태에서 모듈 배치·연결·실행·결과 미리보기 등 노코드 핵심 기능만 사용.
 * - 고급 사용자: 비밀번호로 잠금 해제 시 위 기능들이 노출된다.
 *
 * 보안 메모: 이것은 클라이언트 측 게이트로, 일반(비개발) 사용자의 우발적 사용을 막기 위한 것이다.
 * 비밀번호 평문은 번들에 남기지 않고 SHA-256 해시만 비교한다. 잠금 해제 시 검증된 해시를
 * localStorage에 저장하고, 로드 시 저장값이 알려진 해시와 일치할 때만 해제 상태로 본다
 * (단순 `=true` 조작 방지). 결정적인 우회를 막는 강한 보안은 아니다.
 */

// 고급기능 비밀번호의 SHA-256 해시(소문자 hex). 사용자가 지정한 비밀번호로부터 계산하여 채운다.
// 비어 있으면 어떤 비밀번호로도 해제되지 않는다(안전한 기본값).
export const ADVANCED_PASSWORD_HASH = '';

const STORAGE_KEY = 'mlaf_advanced_unlocked';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface AdvancedFeatureContextType {
  /** 고급기능 잠금이 해제되었는지 여부 */
  isUnlocked: boolean;
  /** 비밀번호로 잠금 해제 시도. 성공하면 true 반환 후 상태/스토리지 갱신 */
  unlock: (password: string) => Promise<boolean>;
  /** 다시 잠금 */
  lock: () => void;
}

const AdvancedFeatureContext = createContext<AdvancedFeatureContextType | undefined>(undefined);

export const AdvancedFeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      // 해시 미설정 시 항상 잠금
      if (!ADVANCED_PASSWORD_HASH) return false;
      return localStorage.getItem(STORAGE_KEY) === ADVANCED_PASSWORD_HASH;
    } catch {
      return false;
    }
  });

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    if (!ADVANCED_PASSWORD_HASH) return false;
    const hashed = await sha256Hex(password);
    if (hashed === ADVANCED_PASSWORD_HASH) {
      setIsUnlocked(true);
      try {
        localStorage.setItem(STORAGE_KEY, ADVANCED_PASSWORD_HASH);
      } catch {
        /* 스토리지 비활성 환경에서도 세션 동안은 해제 유지 */
      }
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  return (
    <AdvancedFeatureContext.Provider value={{ isUnlocked, unlock, lock }}>
      {children}
    </AdvancedFeatureContext.Provider>
  );
};

export const useAdvancedFeature = (): AdvancedFeatureContextType => {
  const context = useContext(AdvancedFeatureContext);
  if (!context) {
    throw new Error('useAdvancedFeature must be used within AdvancedFeatureProvider');
  }
  return context;
};

/**
 * 자식을 고급기능 잠금 해제 상태에서만 렌더링한다.
 * 모달 내부의 AI(결과 해석/AI 해설/원인분석) 트리거 버튼처럼 산재한 고급 기능을
 * 최소 변경으로 가리는 데 사용한다.
 */
export const AdvancedOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isUnlocked } = useAdvancedFeature();
  return isUnlocked ? <>{children}</> : null;
};

/**
 * 고급기능 버튼을 일반 버튼과 시각적으로 구분하기 위한 공통 클래스.
 * 평소 흐리게(opacity-60) 보이다가 hover 시 또렷해진다.
 */
export const ADVANCED_BTN_DIM = 'opacity-60 hover:opacity-100 transition-opacity';

/**
 * 고급기능 버튼임을 알리는 자물쇠(🔒) 배지. 버튼 라벨 앞에 둔다.
 */
export const AdvancedLockBadge: React.FC<{ className?: string }> = ({ className }) => (
  <span aria-hidden title="고급기능" className={className ?? 'leading-none'}>🔒</span>
);
