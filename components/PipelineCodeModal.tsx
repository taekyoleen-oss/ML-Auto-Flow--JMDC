import React, { useState, useEffect } from 'react';
import { XCircleIcon, CodeBracketIcon, ClipboardIcon, CheckIcon } from './icons';
import { streamExplainPythonCode } from '../lib/aiHelpers';
import { ApiKeyMissingError } from '../lib/aiClient';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';

interface PipelineCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    code: string;
}

export const PipelineCodeModal: React.FC<PipelineCodeModalProps> = ({ isOpen, onClose, code }) => {
    const [copied, setCopied] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [aiError, setAiError] = useState('');

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const handleExplain = async () => {
        setIsExplaining(true);
        setIsStreaming(false);
        setAiError('');
        setExplanation('');
        try {
            for await (const chunk of streamExplainPythonCode(code)) {
                setIsStreaming(true); // 첫 청크 도착 → 로딩 표시 종료
                setExplanation(prev => prev + chunk);
            }
        } catch (err) {
            if (err instanceof ApiKeyMissingError) {
                // 설정 모달은 자동으로 열린다. 패널에는 간단 안내만 표시.
                setAiError('Gemini API 키가 필요합니다. 설정(⚙)에서 키를 입력한 뒤 다시 시도하세요.');
            } else {
                setAiError(`AI 설명 생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
            }
        } finally {
            setIsExplaining(false);
            setIsStreaming(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setCopied(false);
            setExplanation('');
            setAiError('');
            setIsExplaining(false);
            setIsStreaming(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const showPanel = isExplaining || !!explanation || !!aiError;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CodeBracketIcon className="w-6 h-6 text-blue-400" />
                        전체 파이프라인 코드
                    </h2>
                    <div className="flex items-center gap-2">
                        <AdvancedOnly>
                        <button
                            onClick={handleExplain}
                            disabled={isExplaining}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors ${ADVANCED_BTN_DIM}`}
                            title="AI가 이 Python 코드를 설명합니다"
                        >
                            <AdvancedLockBadge />
                            <span aria-hidden>✨</span>
                            <span>{isExplaining ? 'AI 분석 중…' : 'AI 설명'}</span>
                        </button>
                        </AdvancedOnly>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                            title="코드 복사"
                        >
                            {copied ? (
                                <>
                                    <CheckIcon className="w-4 h-4 text-green-400" />
                                    <span className="text-green-400">복사됨</span>
                                </>
                            ) : (
                                <>
                                    <ClipboardIcon className="w-4 h-4" />
                                    <span>복사</span>
                                </>
                            )}
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                <main className="flex-1 overflow-hidden p-4 flex gap-4 min-h-0">
                    <pre className={`bg-gray-900 p-4 rounded-md overflow-auto text-sm font-mono text-gray-200 whitespace-pre-wrap ${showPanel ? 'w-1/2' : 'w-full'}`}>
                        <code>{code}</code>
                    </pre>
                    {showPanel && (
                        <div className="w-1/2 bg-white text-gray-800 rounded-md overflow-auto p-4">
                            <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                                <span aria-hidden>✨</span> AI 코드 설명
                            </h3>
                            {isExplaining && !isStreaming && (
                                <p className="text-sm text-gray-500 animate-pulse">AI가 코드를 분석하고 있습니다…</p>
                            )}
                            {aiError && (
                                <p className="text-sm text-red-600">{aiError}</p>
                            )}
                            {explanation && (
                                <div className="text-sm leading-relaxed">
                                    <MarkdownRenderer text={explanation} />
                                </div>
                            )}
                        </div>
                    )}
                </main>
                <footer className="flex justify-end p-4 bg-gray-900 rounded-b-lg border-t border-gray-700 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-white bg-gray-700 hover:bg-gray-600 rounded-md"
                    >
                        닫기
                    </button>
                </footer>
            </div>
        </div>
    );
};
