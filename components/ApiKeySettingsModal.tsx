import React, { useEffect, useState } from 'react';
import { getStoredApiKey, setApiKey, clearApiKey, getApiKey } from '../lib/aiClient';

interface ApiKeySettingsModalProps {
  onClose: () => void;
}

/** 입력 키를 마스킹해서 표시 (앞 4 / 뒤 4만 노출). */
function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({ onClose }) => {
  const [input, setInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);

  const storedKey = getStoredApiKey();
  // 사용자 키가 없어도 dev env 폴백 키가 잡히는지 표시
  const effectiveKey = getApiKey();
  const usingEnvFallback = !storedKey && !!effectiveKey;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setSaved(true);
    setInput('');
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClear = () => {
    clearApiKey();
    setInput('');
    setSaved(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl w-[480px] max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">AI 설정 · Gemini API 키</h2>
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
            AI 기능(모듈 추천, 파이프라인 생성, 결과 해설 등)은 본인의 <b>Google Gemini API 키</b>로 동작합니다.
            키는 이 브라우저의 <b>localStorage에만 저장</b>되며 서버로 전송되지 않습니다.
          </p>

          {/* 현재 상태 */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5 text-xs">
            <span className="font-semibold text-gray-500 dark:text-gray-400">현재 키 상태: </span>
            {storedKey ? (
              <span className="text-green-600 dark:text-green-400 font-mono">{maskKey(storedKey)} (저장됨)</span>
            ) : usingEnvFallback ? (
              <span className="text-amber-600 dark:text-amber-400">개발용 .env 폴백 키 사용 중 (저장된 사용자 키 없음)</span>
            ) : (
              <span className="text-red-500 dark:text-red-400">설정되지 않음</span>
            )}
          </div>

          {/* 입력 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              API 키 입력
            </label>
            <div className="flex gap-2">
              <input
                type={reveal ? 'text' : 'password'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="AIza... 로 시작하는 Gemini API 키"
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setReveal(r => !r)}
                className="px-2.5 text-[11px] rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {reveal ? '숨김' : '표시'}
              </button>
            </div>
          </div>

          {/* 액션 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!input.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saved ? '저장됨 ✓' : '저장'}
            </button>
            {storedKey && (
              <button
                onClick={handleClear}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                저장된 키 삭제
              </button>
            )}
          </div>

          {/* 안내 */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-3 py-2.5">
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              키 발급:{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                Google AI Studio → Get API key
              </a>
              에서 무료로 발급받을 수 있습니다.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <p className="text-[10px] text-gray-400">키는 브라우저에만 저장됩니다 · Esc로 닫기</p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettingsModal;
