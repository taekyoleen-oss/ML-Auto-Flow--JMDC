import React, { useState } from 'react';
import { CanvasModule, NormalityCheckerOutput } from '../types';
import { XCircleIcon } from './icons';
import { ApiKeyMissingError } from '../lib/aiClient';
import { explainModuleResult } from '../lib/aiHelpers';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';
import { TableDownloadButton } from './TableDownloadButton';

interface NormalityCheckerPreviewModalProps {
    module: CanvasModule;
    projectName: string;
    onClose: () => void;
}

export const NormalityCheckerPreviewModal: React.FC<NormalityCheckerPreviewModalProps> = ({ 
    module, 
    projectName, 
    onClose
}) => {
    const output = module.outputData as NormalityCheckerOutput;
    if (!output || output.type !== 'NormalityCheckerOutput') return null;

    const [activeTab, setActiveTab] = useState<'summary' | 'qqplot' | 'ecdf' | 'boxplot'>('summary');

    // ✨ AI 해설 (explainModuleResult 기반)
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);
    const [aiError, setAiError] = useState('');

    const { column, skewness, kurtosis, jarqueBera, testResults, histogramImage, qqPlotImage, ecdfImage, boxplotImage } = output;

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'number') {
            if (Math.abs(value) < 0.0001 || Math.abs(value) > 1000000) {
                return value.toExponential(4);
            }
            return value.toFixed(4);
        }
        return String(value);
    };

    const getConclusionColor = (conclusion?: string): string => {
        if (!conclusion) return 'text-gray-400';
        if (conclusion.includes('Reject')) return 'text-red-400';
        if (conclusion.includes('Fail to reject')) return 'text-green-400';
        return 'text-gray-400';
    };

    // 각 통계량에 대한 설명
    const getStatisticDescription = (measure: string): string => {
        switch (measure) {
            case 'Skewness':
                return '데이터의 비대칭 정도를 측정합니다. 0에 가까울수록 대칭적입니다.';
            case 'Kurtosis':
                return '데이터의 꼬리 두께를 측정합니다. 정규분포는 0에 가까운 값을 가집니다.';
            case 'Jarque-Bera Statistic':
                return '왜도와 첨도를 기반으로 한 정규성 검정 통계량입니다.';
            default:
                return '';
        }
    };

    // 각 검정에 대한 설명
    const getTestDescription = (testType: string): string => {
        switch (testType) {
            case 'shapiro_wilk':
                return '가장 널리 사용되는 정규성 검정입니다. 소표본에 강합니다.';
            case 'kolmogorov_smirnov':
                return '분포 전체를 비교하는 검정입니다. 큰 표본에 적합합니다.';
            case 'anderson_darling':
                return '꼬리 부분에 민감한 검정입니다. Tail 분석에 강합니다.';
            case 'dagostino_k2':
                return '왜도·첨도 기반 검정입니다. 빠르고 직관적입니다.';
            case 'jarque_bera':
                return '왜도와 첨도를 기반으로 한 정규성 검정입니다.';
            default:
                return '';
        }
    };

    // ✨ AI 해설: 왜도/첨도 및 각 정규성 검정 결과를 요약해 explainModuleResult에 전달
    const handleExplain = async () => {
        setIsExplaining(true);
        setAiError('');
        setExplanation('');
        try {
            const testLines = (testResults || []).map(t => {
                const parts = [
                    `- ${t.testName}`,
                    t.statistic !== undefined ? `통계량=${formatValue(t.statistic)}` : null,
                    t.pValue !== undefined ? `p값=${formatValue(t.pValue)}` : (t.criticalValue !== undefined ? `임계값=${formatValue(t.criticalValue)}` : null),
                    t.conclusion ? `결론=${t.conclusion}` : null,
                ].filter(Boolean).join(', ');
                return parts;
            }).join('\n');

            const summary = `프로젝트: ${projectName}\n대상 컬럼: ${column}\n왜도(skewness)=${formatValue(skewness)}, 첨도(kurtosis)=${formatValue(kurtosis)}\nJarque-Bera: 통계량=${formatValue(jarqueBera.statistic)}, p값=${formatValue(jarqueBera.pValue)}, 결론=${jarqueBera.conclusion ?? 'N/A'}\n\n[정규성 검정]\n${testLines || '(추가 검정 없음)'}`;
            const result = await explainModuleResult('Normality Checker(정규성 검정)', summary);
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

    const tabs = [
        { id: 'summary' as const, label: 'Summary' },
        { id: 'qqplot' as const, label: 'Q-Q Plot' },
        { id: 'ecdf' as const, label: 'ECDF vs Normal CDF' },
        { id: 'boxplot' as const, label: 'Boxplot' },
    ];

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
                    <h2 className="text-xl font-bold text-gray-800">Normality Checker: {module.name}</h2>
                    <div className="flex items-center gap-2">
                        <AdvancedOnly>
                        <button
                            onClick={handleExplain}
                            disabled={isExplaining}
                            className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${ADVANCED_BTN_DIM}`}
                            title="AI가 이 정규성 검정 결과를 해설합니다"
                        >
                            <AdvancedLockBadge />
                            <span aria-hidden>✨</span>
                            <span>{isExplaining ? 'AI 분석 중…' : 'AI 해설'}</span>
                        </button>
                        </AdvancedOnly>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                
                <div className="flex-shrink-0 border-b border-gray-200">
                    <div className="flex">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                                        : 'text-gray-400 hover:bg-gray-700/50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <main className="flex-grow p-6 overflow-auto">
                    {/* ✨ AI 해설 패널 (explainModuleResult) */}
                    {(isExplaining || explanation || aiError) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                            <h3 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <span aria-hidden>✨</span> AI 해설
                            </h3>
                            {isExplaining && (
                                <p className="text-sm text-gray-500 animate-pulse">AI가 정규성 검정 결과를 해설하고 있습니다…</p>
                            )}
                            {aiError && <p className="text-sm text-red-600">{aiError}</p>}
                            {explanation && <MarkdownRenderer text={explanation} />}
                        </div>
                    )}

                    {activeTab === 'summary' && (
                        <div className="space-y-6">
                            {/* Column name */}
                            <div className="text-lg font-semibold text-gray-800">
                                Column: <span className="font-mono text-blue-600">{column}</span>
                            </div>

                            {/* Statistics Table and Test Results */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Statistics Table */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-md font-bold text-gray-800">Statistics</h3>
                                        <TableDownloadButton
                                            filename={`${module.name}_${column}_정규성통계량`}
                                            columns={['Measure', 'Value']}
                                            rows={[
                                                { Measure: 'Skewness', Value: skewness },
                                                { Measure: 'Kurtosis', Value: kurtosis },
                                                { Measure: 'Jarque-Bera Statistic', Value: jarqueBera.statistic },
                                            ]}
                                        />
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-300">
                                                <th className="text-left py-2 px-3 font-semibold">Measure</th>
                                                <th className="text-right py-2 px-3 font-semibold">Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-gray-200">
                                                <td className="py-2 px-3">
                                                    <div>Skewness</div>
                                                    <div className="text-xs text-gray-500 mt-1">{getStatisticDescription('Skewness')}</div>
                                                </td>
                                                <td className="text-right py-2 px-3 font-mono">{formatValue(skewness)}</td>
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td className="py-2 px-3">
                                                    <div>Kurtosis</div>
                                                    <div className="text-xs text-gray-500 mt-1">{getStatisticDescription('Kurtosis')}</div>
                                                </td>
                                                <td className="text-right py-2 px-3 font-mono">{formatValue(kurtosis)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3">
                                                    <div>Jarque-Bera Statistic</div>
                                                    <div className="text-xs text-gray-500 mt-1">{getStatisticDescription('Jarque-Bera Statistic')}</div>
                                                </td>
                                                <td className="text-right py-2 px-3 font-mono">{formatValue(jarqueBera.statistic)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Right: Test Results */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-md font-bold text-gray-800">Test Results</h3>
                                        <TableDownloadButton
                                            filename={`${module.name}_${column}_정규성검정결과`}
                                            columns={['검정', '통계량', 'p값', '임계값', '결론']}
                                            rows={[
                                                {
                                                    '검정': 'Jarque-Bera Test',
                                                    '통계량': jarqueBera.statistic,
                                                    'p값': jarqueBera.pValue,
                                                    '임계값': '',
                                                    '결론': jarqueBera.conclusion ?? '',
                                                },
                                                ...(testResults || []).map(test => ({
                                                    '검정': test.testName,
                                                    '통계량': test.statistic,
                                                    'p값': test.pValue,
                                                    '임계값': test.criticalValue,
                                                    '결론': test.conclusion ?? '',
                                                })),
                                            ]}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        {/* Jarque-Bera Test */}
                                        <div className="bg-white rounded p-3 border border-gray-200">
                                            <div className="text-sm font-semibold text-gray-700 mb-1">Jarque-Bera Test</div>
                                            <div className="text-xs text-gray-500 mb-2">{getTestDescription('jarque_bera')}</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-gray-500">p-value:</span>
                                                    <span className={`ml-2 font-mono ${
                                                        jarqueBera.pValue < 0.05 ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                        {formatValue(jarqueBera.pValue)}
                                                    </span>
                                                </div>
                                                <div className={getConclusionColor(jarqueBera.conclusion)}>
                                                    {jarqueBera.conclusion}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Other Tests */}
                                        {testResults.map((test, index) => (
                                            <div key={index} className="bg-white rounded p-3 border border-gray-200">
                                                <div className="text-sm font-semibold text-gray-700 mb-1">{test.testName}</div>
                                                <div className="text-xs text-gray-500 mb-2">{getTestDescription(test.testType)}</div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {test.statistic !== undefined && (
                                                        <div>
                                                            <span className="text-gray-500">Statistic:</span>
                                                            <span className="ml-2 font-mono">{formatValue(test.statistic)}</span>
                                                        </div>
                                                    )}
                                                    {test.pValue !== undefined ? (
                                                        <div>
                                                            <span className="text-gray-500">p-value:</span>
                                                            <span className={`ml-2 font-mono ${
                                                                test.pValue < 0.05 ? 'text-red-600' : 'text-green-600'
                                                            }`}>
                                                                {formatValue(test.pValue)}
                                                            </span>
                                                        </div>
                                                    ) : test.criticalValue !== undefined && (
                                                        <div>
                                                            <span className="text-gray-500">Critical Value:</span>
                                                            <span className="ml-2 font-mono">{formatValue(test.criticalValue)}</span>
                                                        </div>
                                                    )}
                                                    {test.conclusion && (
                                                        <div className={`col-span-2 ${getConclusionColor(test.conclusion)}`}>
                                                            {test.conclusion}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Histogram with Normal Curve Overlay */}
                            {histogramImage && (
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <h3 className="text-md font-bold text-gray-800 mb-4">Histogram + Normal Curve Overlay</h3>
                                    <div className="flex justify-center">
                                        <img 
                                            src={`data:image/png;base64,${histogramImage}`} 
                                            alt="Histogram with Normal Curve" 
                                            className="max-w-full h-auto rounded"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'qqplot' && qqPlotImage && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <h3 className="text-md font-bold text-gray-800 mb-4">Q-Q Plot</h3>
                            <div className="flex justify-center">
                                <img 
                                    src={`data:image/png;base64,${qqPlotImage}`} 
                                    alt="Q-Q Plot" 
                                    className="max-w-full h-auto rounded"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'ecdf' && ecdfImage && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <h3 className="text-md font-bold text-gray-800 mb-4">ECDF vs Normal CDF</h3>
                            <div className="flex justify-center">
                                <img 
                                    src={`data:image/png;base64,${ecdfImage}`} 
                                    alt="ECDF vs Normal CDF" 
                                    className="max-w-full h-auto rounded"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'boxplot' && boxplotImage && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <h3 className="text-md font-bold text-gray-800 mb-4">Boxplot</h3>
                            <div className="flex justify-center">
                                <img 
                                    src={`data:image/png;base64,${boxplotImage}`} 
                                    alt="Boxplot" 
                                    className="max-w-full h-auto rounded"
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
