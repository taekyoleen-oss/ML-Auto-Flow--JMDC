import React, { useEffect, useState } from 'react';
import { useAdvancedFeature, ADVANCED_PASSWORD_HASH } from '../contexts/AdvancedFeatureContext';

interface AdvancedUnlockModalProps {
  onClose: () => void;
}

/**
 * 고급기능(AI 파이프라인 생성 / AI 데이터 분석 / PPT 생성 / 코드 보기·내보내기 / API 키 설정)
 * 잠금 해제용 비밀번호 입력 모달.
 */
export const AdvancedUnlockModal: React.FC<AdvancedUnlockModalProps> = ({ onClose }) => {
  const { isUnlocked, unlock, lock } = useAdvancedFeature();
  const [input, setInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleUnlock = async () => {
    const pw = input.trim();
    if (!pw) return;
    setChecking(true);
    setError(null);
    try {
      if (!ADVANCED_PASSWORD_HASH) {
        setError('고급기능 비밀번호가 아직 설정되지 않았습니다. 관리자에게 문의하세요.');
        return;
      }
      const ok = await unlock(pw);
      if (ok) {
        setInput('');
        onClose();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      setError(`확인 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl w-[440px] max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span aria-hidden>{isUnlocked ? '🔓' : '🔒'}</span>
            고급기능 {isUnlocked ? '· 해제됨' : '실행'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            고급기능은 <b>AI 파이프라인 생성</b>, <b>AI 데이터 분석</b>, <b>PPT 생성</b>,
            <b> 코드 보기·내보내기</b>, <b>API 키 설정</b> 등 API·코드 관련 기능입니다.
            일반 사용자는 잠금 상태에서도 모듈 배치·연결·실행·결과 확인을 그대로 사용할 수 있습니다.
          </p>

          {isUnlocked ? (
            <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 px-3 py-2.5 text-xs text-green-700 dark:text-green-300">
              ✓ 고급기능이 현재 해제되어 있습니다.
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                고급기능 비밀번호
              </label>
              <div className="flex gap-2">
                <input
                  type={reveal ? 'text' : 'password'}
                  value={input}
                  autoFocus
                  onChange={e => { setInput(e.target.value); setError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                  placeholder="비밀번호 입력"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => setReveal(r => !r)}
                  className="px-2.5 text-[11px] rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {reveal ? '숨김' : '표시'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
              ✕ {error}
            </div>
          )}

          {/* 액션 */}
          <div className="flex items-center gap-2 flex-wrap">
            {isUnlocked ? (
              <button
                onClick={() => { lock(); onClose(); }}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                다시 잠그기
              </button>
            ) : (
              <button
                onClick={handleUnlock}
                disabled={checking || !input.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {checking ? '확인 중…' : '잠금 해제'}
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <p className="text-[10px] text-gray-400">해제 상태는 이 브라우저에 저장됩니다 · Esc로 닫기</p>
        </div>
      </div>
    </div>
  );
};

export default AdvancedUnlockModal;
