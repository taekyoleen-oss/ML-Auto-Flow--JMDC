import React, { useState } from 'react';
import { CanvasModule, HypothesisTestingOutput } from '../types';
import { XCircleIcon } from './icons';
import { ApiKeyMissingError } from '../lib/aiClient';
import { explainModuleResult } from '../lib/aiHelpers';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';

interface HypothesisTestingPreviewModalProps {
    module: CanvasModule;
    projectName: string;
    onClose: () => void;
}

export const HypothesisTestingPreviewModal: React.FC<HypothesisTestingPreviewModalProps> = ({ 
    module, 
    projectName, 
    onClose
}) => {
    const output = module.outputData as HypothesisTestingOutput;
    if (!output || output.type !== 'HypothesisTestingOutput') return null;

    const { results } = output;

    // ✨ AI 해설 (explainModuleResult 기반)
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);
    const [aiError, setAiError] = useState('');

    const getTestTypeLabel = (testType: string): string => {
        const labels: Record<string, string> = {
            't_test_one_sample': 'One-Sample t-test',
            't_test_independent': 'Independent Samples t-test',
            't_test_paired': 'Paired Samples t-test',
            'chi_square': 'Chi-square Test',
            'anova': 'One-way ANOVA',
            'ks_test': 'Kolmogorov-Smirnov Test',
            'shapiro_wilk': 'Shapiro-Wilk Test',
            'levene': 'Levene Test',
        };
        return labels[testType] || testType;
    };

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'number') {
            if (Math.abs(value) < 0.0001 || Math.abs(value) > 1000000) {
                return value.toExponential(4);
            }
            return value.toFixed(4);
        }
        if (Array.isArray(value)) {
            return `[${value.map(v => formatValue(v)).join(', ')}]`;
        }
        return String(value);
    };

    const getConclusionColor = (conclusion?: string): string => {
        if (!conclusion) return 'text-gray-400';
        if (conclusion.includes('Reject')) return 'text-red-400';
        if (conclusion.includes('Fail to reject')) return 'text-green-400';
        return 'text-gray-400';
    };

    // ✨ AI 해설: 각 가설검정의 통계량/p값/결론을 요약해 explainModuleResult에 전달
    const handleExplain = async () => {
        setIsExplaining(true);
        setAiError('');
        setExplanation('');
        try {
            const lines = results.map((r, i) => {
                const name = r.testName || getTestTypeLabel(r.testType);
                const parts = [
                    `${i + 1}. ${name} [${(r.columns || []).join(', ')}]`,
                    r.statistic !== undefined ? `통계량=${formatValue(r.statistic)}` : null,
                    r.pValue !== undefined ? `p값=${formatValue(r.pValue)}` : null,
                    r.degreesOfFreedom !== undefined ? `자유도=${formatValue(r.degreesOfFreedom)}` : null,
                    r.conclusion ? `결론=${r.conclusion}` : null,
                ].filter(Boolean).join(', ');
                return parts;
            }).join('\n');

            const summary = `프로젝트: ${projectName}\n검정 ${results.length}건\n\n${lines || '(검정 결과 없음)'}`;
            const result = await explainModuleResult('Hypothesis Testing(가설검정)', summary);
            setExplanation(result);
        } catch (err) {
            if (err instanceof ApiKeyMissingError) {
                setAiError('Gemini API 키가 필요합니다. 설정(⚙)에서 키를 입력한 뒤 다시 시도하세요.');
            } else {
                setAiError(`AI 해설 생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
            }
        } finally {
            setIsExplaining(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">Hypothesis Testing: {module.name}</h2>
                    <div className="flex items-center gap-2">
                        {results.length > 0 && (
                            <AdvancedOnly>
                            <button
                                onClick={handleExplain}
                                disabled={isExplaining}
                                className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${ADVANCED_BTN_DIM}`}
                                title="AI가 이 가설검정 결과를 해설합니다"
                            >
                                <AdvancedLockBadge />
                                <span aria-hidden>✨</span>
                                <span>{isExplaining ? 'AI 분석 중…' : 'AI 해설'}</span>
                            </button>
                            </AdvancedOnly>
                        )}
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                
                <main className="flex-grow p-6 overflow-auto space-y-6">
                    {/* ✨ AI 해설 패널 (explainModuleResult) */}
                    {(isExplaining || explanation || aiError) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h3 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <span aria-hidden>✨</span> AI 해설
                            </h3>
                            {isExplaining && (
                                <p className="text-sm text-gray-500 animate-pulse">AI가 가설검정 결과를 해설하고 있습니다…</p>
                            )}
                            {aiError && <p className="text-sm text-red-600">{aiError}</p>}
                            {explanation && <MarkdownRenderer text={explanation} />}
                        </div>
                    )}

                    {results.length === 0 ? (
                        <div className="text-center text-gray-500 p-8">
                            <p>No test results available.</p>
                        </div>
                    ) : (
                        results.map((result, index) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                                        {result.testName || getTestTypeLabel(result.testType)}
                                    </h3>
                                    <div className="text-sm text-gray-600">
                                        <span className="font-semibold">Columns:</span> {result.columns.join(', ')}
                                    </div>
                                </div>

                                {/* 주요 결과 */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    {result.statistic !== undefined && (
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="text-xs text-gray-500 mb-1">Statistic</div>
                                            <div className="text-lg font-semibold text-gray-900">
                                                {formatValue(result.statistic)}
                                            </div>
                                        </div>
                                    )}
                                    {result.pValue !== undefined && (
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="text-xs text-gray-500 mb-1">p-value</div>
                                            <div className={`text-lg font-semibold ${
                                                result.pValue < 0.05 ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                                {formatValue(result.pValue)}
                                            </div>
                                        </div>
                                    )}
                                    {result.degreesOfFreedom !== undefined && (
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="text-xs text-gray-500 mb-1">Degrees of Freedom</div>
                                            <div className="text-lg font-semibold text-gray-900">
                                                {formatValue(result.degreesOfFreedom)}
                                            </div>
                                        </div>
                                    )}
                                    {result.criticalValue !== undefined && (
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="text-xs text-gray-500 mb-1">Critical Value</div>
                                            <div className="text-lg font-semibold text-gray-900">
                                                {formatValue(result.criticalValue)}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 결론 */}
                                {result.conclusion && (
                                    <div className={`mb-4 p-3 rounded-lg border ${
                                        result.conclusion.includes('Reject')
                                            ? 'bg-red-50 border-red-200'
                                            : 'bg-green-50 border-green-200'
                                    }`}>
                                        <div className="text-sm font-semibold text-gray-700 mb-1">Conclusion</div>
                                        <div className={getConclusionColor(result.conclusion)}>
                                            {result.conclusion}
                                        </div>
                                    </div>
                                )}

                                {/* 해석 */}
                                {result.interpretation && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="text-sm font-semibold text-blue-900 mb-1">Interpretation</div>
                                        <div className="text-sm text-blue-800">{result.interpretation}</div>
                                    </div>
                                )}

                                {/* 상세 정보 */}
                                {result.details && Object.keys(result.details).length > 0 && (
                                    <div className="mt-4">
                                        <div className="text-sm font-semibold text-gray-700 mb-2">Details</div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                {Object.entries(result.details).map(([key, value]) => (
                                                    <div key={key} className="flex justify-between">
                                                        <span className="text-gray-600">{key}:</span>
                                                        <span className="font-mono text-gray-800 text-right">
                                                            {formatValue(value)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 에러 표시 */}
                                {result.testName && result.testName.startsWith('Error:') && (
                                    <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                                        <div className="text-sm font-semibold text-red-900 mb-1">Error</div>
                                        <div className="text-sm text-red-800">{result.testName}</div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </main>
            </div>
        </div>
    );
};


