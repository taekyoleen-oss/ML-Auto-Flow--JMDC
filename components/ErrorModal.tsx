import React, { useState, useEffect } from 'react';
import { XCircleIcon } from './icons';
import { suggestErrorFix } from '../lib/aiHelpers';
import { ApiKeyMissingError } from '../lib/aiClient';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ErrorModalProps {
  error: {
    moduleName: string;
    message: string;
    details?: string;
  } | null;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ error, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (error) {
      setCopied(false);
      setSuggestion('');
      setAiError('');
      setIsAnalyzing(false);
    }
  }, [error]);

  if (!error) return null;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAiError('');
    setSuggestion('');
    try {
      const result = await suggestErrorFix(
        error.message,
        `모듈: ${error.moduleName}\n${error.details ?? ''}`
      );
      setSuggestion(result);
    } catch (err) {
      if (err instanceof ApiKeyMissingError) {
        // 설정 모달은 자동으로 열린다. 패널에는 간단 안내만 표시.
        setAiError('Gemini API 키가 필요합니다. 설정(⚙)에서 키를 입력한 뒤 다시 시도하세요.');
      } else {
        setAiError(`AI 원인 분석 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const showPanel = isAnalyzing || !!suggestion || !!aiError;

  const handleCopy = () => {
    const errorText = `Module: ${error.moduleName}\nError: ${error.message}${error.details ? `\nDetails:\n${error.details}` : ''}`;
    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-red-600">Module Execution Error</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="flex-grow p-6 overflow-auto">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Module:</h3>
              <p className="text-gray-900 font-mono text-sm">{error.moduleName}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Error Message:</h3>
              <p className="text-gray-900 font-mono text-sm whitespace-pre-wrap break-words">{error.message}</p>
            </div>
            {error.details && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Details:</h3>
                <pre className="text-gray-900 font-mono text-xs whitespace-pre-wrap break-words bg-gray-50 p-3 rounded border border-gray-200 overflow-auto">
                  {error.details}
                </pre>
              </div>
            )}
            {showPanel && (
              <div className="bg-blue-50 rounded-md border border-blue-200 p-4">
                <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                  <span aria-hidden>✨</span> AI 원인 분석
                </h3>
                {isAnalyzing && (
                  <p className="text-sm text-gray-500 animate-pulse">AI가 오류 원인을 분석하고 있습니다…</p>
                )}
                {aiError && (
                  <p className="text-sm text-red-600">{aiError}</p>
                )}
                {suggestion && (
                  <div className="text-sm leading-relaxed text-gray-800">
                    <MarkdownRenderer text={suggestion} />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        <footer className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="mr-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="AI가 이 오류의 원인과 해결 방법을 분석합니다"
          >
            <span aria-hidden>✨</span>
            <span>{isAnalyzing ? 'AI 분석 중…' : 'AI 원인 분석'}</span>
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Error
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
