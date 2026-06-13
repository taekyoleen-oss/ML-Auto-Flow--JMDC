import React, { useState, useEffect } from 'react';
import { CanvasModule, CorrelationOutput } from '../types';
import { XCircleIcon } from './icons';
import { ApiKeyMissingError } from '../lib/aiClient';
import { explainModuleResult } from '../lib/aiHelpers';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';

interface CorrelationPreviewModalProps {
    module: CanvasModule;
    projectName: string;
    onClose: () => void;
}

export const CorrelationPreviewModal: React.FC<CorrelationPreviewModalProps> = ({ 
    module, 
    projectName, 
    onClose
}) => {
    const output = module.outputData as CorrelationOutput;
    if (!output || output.type !== 'CorrelationOutput') return null;

    const { columns, numericColumns, categoricalColumns, correlationMatrices, heatmapImage, pairplotImage, summary } = output;

    // 사용 가능한 메서드 목록
    const availableMethods = correlationMatrices?.map(m => m.method) || [];
    const defaultTab = availableMethods.length > 0 ? availableMethods[0] : "pearson";
    
    const [activeTab, setActiveTab] = useState<string>(defaultTab);

    // ✨ AI 해설 (explainModuleResult 기반)
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);
    const [aiError, setAiError] = useState('');

    // activeTab이 설정되지 않았거나 사용 불가능한 경우 기본값으로 설정
    useEffect(() => {
        // heatmap이나 pairplot이 활성화되어 있으면 유지
        if (activeTab === "heatmap" && heatmapImage) return;
        if (activeTab === "pairplot" && pairplotImage) return;
        
        // 그 외의 경우 사용 가능한 메서드로 설정
        if (!activeTab || (!availableMethods.includes(activeTab) && activeTab !== "heatmap" && activeTab !== "pairplot")) {
            setActiveTab(defaultTab);
        }
    }, [availableMethods, defaultTab, activeTab, heatmapImage, pairplotImage]);

    const getMethodLabel = (method: string): string => {
        const labels: Record<string, string> = {
            'pearson': 'Pearson Correlation',
            'spearman': 'Spearman Correlation',
            'kendall': 'Kendall Correlation',
            'cramers_v': "Cramér's V",
        };
        return labels[method] || method;
    };

    const formatValue = (value: number): string => {
        if (value === null || value === undefined) return 'N/A';
        if (Math.abs(value) < 0.0001 || Math.abs(value) > 1000000) {
            return value.toExponential(5);
        }
        return value.toFixed(5);
    };

    const getCorrelationColor = (value: number): string => {
        const absValue = Math.abs(value);
        if (absValue >= 0.7) return 'text-red-600 font-bold';
        if (absValue >= 0.5) return 'text-orange-600 font-semibold';
        if (absValue >= 0.3) return 'text-yellow-600';
        return 'text-gray-600';
    };

    // ✨ AI 해설: 상관행렬 중 강한 상관쌍을 요약해 explainModuleResult에 전달
    const handleExplain = async () => {
        setIsExplaining(true);
        setAiError('');
        setExplanation('');
        try {
            const matrixLines = (correlationMatrices || []).map(cm => {
                const cols = cm.columns;
                const pairs: string[] = [];
                for (let i = 0; i < cols.length; i++) {
                    for (let j = i + 1; j < cols.length; j++) {
                        const v = cm.matrix[cols[i]]?.[cols[j]];
                        if (typeof v === 'number' && Math.abs(v) > 0.5) {
                            pairs.push(`  - ${cols[i]} ↔ ${cols[j]}: ${v.toFixed(3)}`);
                        }
                    }
                }
                return `[${getMethodLabel(cm.method)}] 강한 상관쌍 (|r|>0.5):\n${pairs.length ? pairs.join('\n') : '  - (없음)'}`;
            }).join('\n\n');

            const summary = `프로젝트: ${projectName}\n수치형 ${numericColumns.length}개 / 범주형 ${categoricalColumns.length}개 / 전체 ${columns.length}개 컬럼\n분석 방법: ${availableMethods.map(getMethodLabel).join(', ') || '없음'}\n\n${matrixLines || '(상관행렬 없음)'}`;
            const result = await explainModuleResult('Correlation(상관분석)', summary);
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

    const canExplain = (correlationMatrices?.length || 0) > 0;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">Correlation Analysis: {module.name}</h2>
                    <div className="flex items-center gap-2">
                        {canExplain && (
                            <AdvancedOnly>
                            <button
                                onClick={handleExplain}
                                disabled={isExplaining}
                                className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${ADVANCED_BTN_DIM}`}
                                title="AI가 이 상관분석 결과를 해설합니다"
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
                
                {/* 탭 네비게이션 */}
                <div className="flex-shrink-0 border-b border-gray-200">
                    <div className="flex overflow-x-auto">
                        {availableMethods.map((method) => {
                            const isActive = activeTab === method;
                            return (
                                <button
                                    key={method}
                                    onClick={() => setActiveTab(method)}
                                    className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                        isActive
                                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                    }`}
                                >
                                    {getMethodLabel(method)}
                                </button>
                            );
                        })}
                        {heatmapImage && (
                            <button
                                onClick={() => setActiveTab("heatmap")}
                                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                    activeTab === "heatmap"
                                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                Heatmap
                            </button>
                        )}
                        {pairplotImage && (
                            <button
                                onClick={() => setActiveTab("pairplot")}
                                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                    activeTab === "pairplot"
                                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                Pairplot
                            </button>
                        )}
                    </div>
                </div>

                <main className="flex-grow p-6 overflow-auto space-y-6">
                    {/* ✨ AI 해설 패널 (explainModuleResult) */}
                    {(isExplaining || explanation || aiError) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h3 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <span aria-hidden>✨</span> AI 해설
                            </h3>
                            {isExplaining && (
                                <p className="text-sm text-gray-500 animate-pulse">AI가 상관분석 결과를 해설하고 있습니다…</p>
                            )}
                            {aiError && <p className="text-sm text-red-600">{aiError}</p>}
                            {explanation && <MarkdownRenderer text={explanation} />}
                        </div>
                    )}

                    {/* 요약 정보 */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h3 className="text-lg font-bold text-blue-900 mb-2">Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600 mb-1">Total Columns</p>
                                <p className="font-semibold text-gray-900">{columns.length}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 mb-1">Numeric Columns</p>
                                <p className="font-semibold text-gray-900">{numericColumns.length}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 mb-1">Categorical Columns</p>
                                <p className="font-semibold text-gray-900">{categoricalColumns.length}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 mb-1">Methods</p>
                                <p className="font-semibold text-gray-900">{correlationMatrices.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* 상관계수 행렬 표시 */}
                    {activeTab !== "heatmap" && activeTab !== "pairplot" && availableMethods.includes(activeTab) && (() => {
                        const currentMatrix = correlationMatrices?.find(m => m.method === activeTab);
                        if (!currentMatrix) return null;

                        const matrix = currentMatrix.matrix;
                        const matrixColumns = currentMatrix.columns;

                        return (
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-3">
                                    {getMethodLabel(currentMatrix.method)} Matrix
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-700 bg-gray-100 sticky left-0 z-10"></th>
                                                {matrixColumns.map(col => (
                                                    <th key={col} className="px-3 py-2 text-center font-semibold text-gray-700 bg-gray-100 min-w-[100px]">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixColumns.map((rowCol) => (
                                                <tr key={rowCol}>
                                                    <td className="px-3 py-2 font-semibold text-gray-700 bg-gray-100 sticky left-0 z-10">
                                                        {rowCol}
                                                    </td>
                                                    {matrixColumns.map((colCol) => {
                                                        const value = matrix[rowCol]?.[colCol];
                                                        return (
                                                            <td key={colCol} className={`px-3 py-2 text-center ${getCorrelationColor(value || 0)}`}>
                                                                {value !== undefined && value !== null ? formatValue(value) : 'N/A'}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Heatmap 이미지 */}
                    {activeTab === "heatmap" && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-3">Correlation Heatmap</h3>
                            {heatmapImage ? (
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <img 
                                        src={`data:image/png;base64,${heatmapImage}`} 
                                        alt="Correlation Heatmap"
                                        className="w-full h-auto"
                                    />
                                </div>
                            ) : (
                                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                    <p className="text-yellow-800">Heatmap 이미지가 생성되지 않았습니다.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pairplot 이미지 */}
                    {activeTab === "pairplot" && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-3">Pairplot</h3>
                            {pairplotImage ? (
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <img 
                                        src={`data:image/png;base64,${pairplotImage}`} 
                                        alt="Pairplot"
                                        className="w-full h-auto"
                                    />
                                </div>
                            ) : (
                                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                    <p className="text-yellow-800">Pairplot 이미지가 생성되지 않았습니다. (5개 이하의 숫자형 열이 필요합니다)</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 요약 통계 */}
                    {summary && Object.keys(summary).length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-3">Summary Statistics</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(summary).map(([key, value]) => (
                                    <div key={key} className="bg-white rounded-lg p-3 border border-gray-200">
                                        <div className="text-sm font-semibold text-gray-700 mb-2">{key.replace(/_/g, ' ').toUpperCase()}</div>
                                        {typeof value === 'object' && value !== null ? (
                                            <div className="space-y-1 text-sm">
                                                {Object.entries(value).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between">
                                                        <span className="text-gray-600">{k.replace(/_/g, ' ')}:</span>
                                                        <span className="font-mono text-gray-800">
                                                            {typeof v === 'number' ? formatValue(v) : String(v)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm font-mono text-gray-800">
                                                {typeof value === 'number' ? formatValue(value) : String(value)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Heatmap 시각화 (맨 아래) */}
                    {(() => {
                        // Pearson 상관계수 행렬을 기본으로 사용, 없으면 첫 번째 행렬 사용
                        const pearsonMatrix = correlationMatrices?.find(m => m.method === 'pearson');
                        const defaultMatrix = correlationMatrices?.[0];
                        const heatmapMatrix = pearsonMatrix || defaultMatrix;
                        
                        if (!heatmapMatrix || !heatmapMatrix.matrix) return null;
                        
                        const matrix = heatmapMatrix.matrix;
                        const matrixColumns = heatmapMatrix.columns;
                        
                        const getColor = (value: number) => {
                            const alpha = Math.abs(value);
                            if (value > 0) return `rgba(59, 130, 246, ${alpha})`; // Blue for positive
                            return `rgba(239, 68, 68, ${alpha})`; // Red for negative
                        };
                        
                        return (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-3">
                                    Correlation Heatmap ({getMethodLabel(heatmapMatrix.method)})
                                </h3>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                                    <div className="p-2">
                                        <div className="flex text-xs font-bold">
                                            <div className="w-20 flex-shrink-0"></div>
                                            {matrixColumns.map((col) => (
                                                <div key={col} className="flex-1 text-center truncate" title={col}>
                                                    {col}
                                                </div>
                                            ))}
                                        </div>
                                        {matrixColumns.map((rowCol) => (
                                            <div key={rowCol} className="flex items-center text-xs">
                                                <div className="w-20 flex-shrink-0 font-bold truncate" title={rowCol}>
                                                    {rowCol}
                                                </div>
                                                {matrixColumns.map((colCol) => {
                                                    const value = matrix[rowCol]?.[colCol] || 0;
                                                    return (
                                                        <div key={`${rowCol}-${colCol}`} className="flex-1 p-0.5">
                                                            <div
                                                                className="w-full h-6 rounded-sm flex items-center justify-center text-white font-mono"
                                                                style={{ backgroundColor: getColor(value) }}
                                                                title={`${rowCol} vs ${colCol}: ${formatValue(value)}`}
                                                            >
                                                                {formatValue(value)}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </main>
            </div>
        </div>
    );
};

