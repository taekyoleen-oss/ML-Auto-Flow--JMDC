import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CanvasModule, EvaluationOutput, ConfusionMatrix, DataPreview, Connection } from '../types';
import { XCircleIcon } from './icons';
import { explainModuleResult } from '../lib/aiHelpers';
import { ApiKeyMissingError } from '../lib/aiClient';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';
import { TableDownloadButton } from './TableDownloadButton';

// C-1: 인터랙티브 메트릭 바 차트
const MetricBarChart: React.FC<{ metrics: Record<string, number | string>; modelType: 'classification' | 'regression' }> = ({ metrics, modelType }) => {
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);

    // 0~1 범위 지표 (높을수록 좋음)
    const UNIT_METRICS = new Set(['Accuracy', 'Precision', 'Recall', 'F1-Score', 'AUC-ROC', 'Average Precision', 'R²', 'R2', 'R-squared']);
    // 낮을수록 좋은 지표 (최대값 기준으로 역방향 표시)
    const LOWER_BETTER = new Set(['MSE', 'RMSE', 'MAE', 'MedAE', 'Relative Squared Error (RSE)', 'Relative Absolute Error (RAE)']);

    const entries = Object.entries(metrics).filter(([, v]) => typeof v === 'number') as [string, number][];
    if (entries.length === 0) return null;

    const maxVal = Math.max(...entries.map(([, v]) => Math.abs(v)));

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">성능 지표 시각화</h4>
            <div className="space-y-2.5">
                {entries.map(([key, value]) => {
                    const isUnit = UNIT_METRICS.has(key);
                    const isLowerBetter = LOWER_BETTER.has(key);
                    const barWidth = isUnit
                        ? Math.max(Math.min(value * 100, 100), 0)
                        : maxVal > 0 ? Math.min((Math.abs(value) / maxVal) * 100, 100) : 0;

                    const barColor = isUnit
                        ? value >= 0.9 ? 'bg-green-500' : value >= 0.7 ? 'bg-blue-500' : 'bg-orange-400'
                        : isLowerBetter ? 'bg-orange-400' : 'bg-blue-400';

                    const quality = isUnit
                        ? value >= 0.9 ? '우수' : value >= 0.7 ? '양호' : '개선 필요'
                        : null;

                    return (
                        <div
                            key={key}
                            className={`rounded p-2 transition-colors cursor-default ${hoveredKey === key ? 'bg-white shadow-sm' : ''}`}
                            onMouseEnter={() => setHoveredKey(key)}
                            onMouseLeave={() => setHoveredKey(null)}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-700">{key}</span>
                                    {quality && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                            quality === '우수' ? 'bg-green-100 text-green-700'
                                            : quality === '양호' ? 'bg-blue-100 text-blue-700'
                                            : 'bg-orange-100 text-orange-700'
                                        }`}>{quality}</span>
                                    )}
                                    {isLowerBetter && <span className="text-xs text-gray-400">↓ 낮을수록 좋음</span>}
                                </div>
                                <span className="text-xs font-mono font-bold text-gray-800">
                                    {value.toFixed(4)}
                                </span>
                            </div>
                            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
                                    style={{ width: `${barWidth}%` }}
                                />
                            </div>
                            {isUnit && (
                                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                                    <span>0</span>
                                    <span>0.5</span>
                                    <span>1.0</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface EvaluationPreviewModalProps {
    module: CanvasModule;
    onClose: () => void;
    onThresholdChange?: (moduleId: string, threshold: number) => void;
    modules?: CanvasModule[];
    connections?: Connection[];
}

interface ThresholdTableRow {
    threshold: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    tp: number;
    fp: number;
    tn: number;
    fn: number;
}

export const EvaluationPreviewModal: React.FC<EvaluationPreviewModalProps> = ({ 
    module, 
    onClose,
    onThresholdChange,
    modules = [],
    connections = []
}) => {
    const output = module.outputData as EvaluationOutput;
    if (!output || output.type !== 'EvaluationOutput') return null;

    const { modelType, metrics, confusionMatrix, threshold: currentThreshold, thresholdMetrics: outputThresholdMetrics } = output;
    const [selectedThreshold, setSelectedThreshold] = useState<number>(currentThreshold ?? 0.5);
    const [selectedRow, setSelectedRow] = useState<ThresholdTableRow | null>(null);
    const [selectedColumn1, setSelectedColumn1] = useState<string>('accuracy');
    const [selectedColumn2, setSelectedColumn2] = useState<string>('');
    // ✨ AI 해설
    const [explanation, setExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);
    const [aiError, setAiError] = useState('');

    // 선택 가능한 열 목록
    const availableColumns = [
        { value: 'accuracy', label: 'Accuracy' },
        { value: 'precision', label: 'Precision' },
        { value: 'recall', label: 'Recall' },
        { value: 'f1Score', label: 'F1-Score' }
    ];

    // thresholdMetrics를 테이블 형식으로 변환 (useMemo로 참조 안정화 — 매 렌더 새 배열 생성 시
    // 아래 effect deps가 매번 바뀌어 setState→재렌더 무한 루프가 발생하던 것을 방지)
    const thresholdTable: ThresholdTableRow[] = useMemo(() => (
        outputThresholdMetrics && outputThresholdMetrics.length > 0
            ? outputThresholdMetrics.map(m => ({
                threshold: m.threshold,
                accuracy: m.accuracy,
                precision: m.precision,
                recall: m.recall,
                f1Score: m.f1Score,
                tp: m.tp,
                fp: m.fp,
                tn: m.tn,
                fn: m.fn
            }))
            : []
    ), [outputThresholdMetrics]);

    // 선택된 threshold에 해당하는 행 찾기
    useEffect(() => {
        if (thresholdTable.length > 0) {
            const row = thresholdTable.find(r => Math.abs(r.threshold - selectedThreshold) < 0.001);
            if (row) {
                setSelectedRow(row);
            } else {
                // 가장 가까운 threshold 찾기
                const closest = thresholdTable.reduce((prev, curr) =>
                    Math.abs(curr.threshold - selectedThreshold) < Math.abs(prev.threshold - selectedThreshold) ? curr : prev
                );
                setSelectedRow(closest);
                // 실제로 값이 달라질 때만 갱신(동일 값 setState로 인한 재렌더 루프 방지)
                if (Math.abs(closest.threshold - selectedThreshold) > 0.001) {
                    setSelectedThreshold(closest.threshold);
                }
            }
        } else if (modelType === 'classification' && confusionMatrix) {
            // thresholdMetrics가 없으면 현재 metrics 사용
            setSelectedRow({
                threshold: currentThreshold ?? 0.5,
                accuracy: typeof metrics['Accuracy'] === 'number' ? metrics['Accuracy'] as number : 0,
                precision: typeof metrics['Precision'] === 'number' ? metrics['Precision'] as number : 0,
                recall: typeof metrics['Recall'] === 'number' ? metrics['Recall'] as number : 0,
                f1Score: typeof metrics['F1-Score'] === 'number' ? metrics['F1-Score'] as number : 0,
                tp: confusionMatrix.tp,
                fp: confusionMatrix.fp,
                tn: confusionMatrix.tn,
                fn: confusionMatrix.fn
            });
        }
    }, [thresholdTable, selectedThreshold, currentThreshold, metrics, confusionMatrix, modelType]);

    // 모듈의 outputData가 변경될 때 selectedThreshold 업데이트
    useEffect(() => {
        const output = module.outputData as EvaluationOutput;
        if (output && output.type === 'EvaluationOutput') {
            const { threshold: newThreshold } = output;
            if (newThreshold !== undefined && newThreshold !== null) {
                setSelectedThreshold(newThreshold);
            }
        }
    }, [module.outputData, currentThreshold]);

    const handleThresholdSelect = useCallback((threshold: number) => {
        // 0.01 단위로 반올림
        const roundedThreshold = Math.round(threshold * 100) / 100;
        const clampedThreshold = Math.max(0, Math.min(1, roundedThreshold));
        setSelectedThreshold(clampedThreshold);
        
        // 테이블에서 해당 threshold의 행 찾기
        const row = thresholdTable.find(r => Math.abs(r.threshold - clampedThreshold) < 0.001);
        if (row) {
            setSelectedRow(row);
        }
        
        // 모듈 파라미터 업데이트 (재계산하지 않음)
        if (onThresholdChange) {
            onThresholdChange(module.id, clampedThreshold);
        }
    }, [module.id, onThresholdChange, thresholdTable]);

    const handleColumnClick = useCallback((column: string) => {
        if (selectedColumn1 === column) {
            // 이미 선택된 열이면 두 번째 열로 설정
            if (selectedColumn2 !== column) {
                setSelectedColumn2(column);
            }
        } else if (selectedColumn2 === column) {
            // 두 번째 열이면 해제
            setSelectedColumn2('');
        } else {
            // 첫 번째 열로 설정
            setSelectedColumn1(column);
        }
    }, [selectedColumn1, selectedColumn2]);

    // 그래프 데이터 준비
    const getGraphData = (column: string) => {
        if (!thresholdTable.length) return [];
        return thresholdTable.map(row => ({
            threshold: row.threshold,
            value: row[column as keyof ThresholdTableRow] as number
        }));
    };

    const graphData1 = getGraphData(selectedColumn1);
    const graphData2 = selectedColumn2 ? getGraphData(selectedColumn2) : [];

    // 그래프 최대값 계산
    const maxValue = Math.max(
        ...graphData1.map(d => d.value),
        ...graphData2.map(d => d.value),
        1.0
    );

    // ROC Curve 데이터 계산
    const rocData = thresholdTable.length > 0
        ? thresholdTable.map(row => {
            // TPR (True Positive Rate) = Recall = TP / (TP + FN)
            const tpr = (row.tp + row.fn) > 0 ? row.tp / (row.tp + row.fn) : 0;
            // FPR (False Positive Rate) = FP / (FP + TN)
            const fpr = (row.fp + row.tn) > 0 ? row.fp / (row.fp + row.tn) : 0;
            return {
                fpr,
                tpr,
                threshold: row.threshold
            };
        }).sort((a, b) => a.fpr - b.fpr) // FPR 순서로 정렬
        : [];

    // AUC 계산 (사다리꼴 공식 사용)
    const calculateAUC = (rocPoints: Array<{fpr: number, tpr: number}>) => {
        if (rocPoints.length < 2) return 0;
        let auc = 0;
        for (let i = 1; i < rocPoints.length; i++) {
            const width = rocPoints[i].fpr - rocPoints[i - 1].fpr;
            const avgHeight = (rocPoints[i].tpr + rocPoints[i - 1].tpr) / 2;
            auc += width * avgHeight;
        }
        return auc;
    };

    const auc = rocData.length > 0 ? calculateAUC(rocData) : 0;

    // Precision-Recall Curve 데이터 계산 (recall 오름차순 정렬)
    const prData = thresholdTable.length > 0
        ? thresholdTable.map(row => {
            // Recall = TP / (TP + FN), Precision = TP / (TP + FP)
            const recall = (row.tp + row.fn) > 0 ? row.tp / (row.tp + row.fn) : 0;
            const precision = (row.tp + row.fp) > 0 ? row.tp / (row.tp + row.fp) : 1;
            return { recall, precision, threshold: row.threshold };
        }).sort((a, b) => a.recall - b.recall)
        : [];

    // Average Precision (PR 곡선 아래 면적, 사다리꼴 근사)
    const calculateAveragePrecision = (prPoints: Array<{recall: number, precision: number}>) => {
        if (prPoints.length < 2) return 0;
        let ap = 0;
        for (let i = 1; i < prPoints.length; i++) {
            const width = prPoints[i].recall - prPoints[i - 1].recall;
            const avgHeight = (prPoints[i].precision + prPoints[i - 1].precision) / 2;
            ap += width * avgHeight;
        }
        return ap;
    };
    const averagePrecision = prData.length > 0 ? calculateAveragePrecision(prData) : 0;

    // 회귀 모형용 scatter plot 데이터 가져오기
    const getInputData = useMemo((): DataPreview | null => {
        if (modelType !== 'regression' || !modules || !connections) return null;
        
        const inputConnection = connections.find(
            (c) =>
                c && c.to && c.to.moduleId === module.id && c.to.portName === "data_in"
        );
        if (!inputConnection || !inputConnection.from) return null;
        
        const sourceModule = modules.find(
            (m) => m && m.id === inputConnection.from.moduleId
        );
        if (!sourceModule?.outputData) return null;

        if (sourceModule.outputData.type === "DataPreview") {
            return sourceModule.outputData;
        }
        if (sourceModule.outputData.type === "SplitDataOutput") {
            const fromPortName = inputConnection.from?.portName;
            if (fromPortName === "train_data_out") {
                return sourceModule.outputData.train;
            } else if (fromPortName === "test_data_out") {
                return sourceModule.outputData.test;
            }
        }
        return null;
    }, [module.id, modelType, modules, connections]);

    // 회귀 모형용 scatter plot 이미지 생성
    const [regressionPlotImage, setRegressionPlotImage] = useState<string | null>(null);
    const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
    // 회귀 잔차 진단 플롯(잔차 vs 실제 + 잔차 분포) — 제9부 28.6, 앱 표시용(재현성 무관)
    const [residualPlotImage, setResidualPlotImage] = useState<string | null>(null);

    useEffect(() => {
        if (modelType === 'regression' && getInputData && module.parameters) {
            const labelColumn = module.parameters.label_column;
            const predictionColumn = module.parameters.prediction_column;
            
            if (labelColumn && predictionColumn && getInputData.rows) {
                setIsGeneratingPlot(true);
                
                // Pyodide를 사용하여 scatter plot 생성
                const generatePlot = async () => {
                    try {
                        const pyodideModule = await import('../utils/pyodideRunner');
                        const { generateRegressionPlotPython } = pyodideModule;
                        
                        const plotImage = await generateRegressionPlotPython(
                            getInputData.rows || [],
                            labelColumn,
                            predictionColumn
                        );
                        
                        setRegressionPlotImage(plotImage);
                    } catch (error: any) {
                        console.error('Failed to generate regression plot:', error);
                        setRegressionPlotImage(null);
                    } finally {
                        setIsGeneratingPlot(false);
                    }
                };
                
                generatePlot();
            } else {
                setRegressionPlotImage(null);
            }
        } else {
            setRegressionPlotImage(null);
        }
    }, [modelType, getInputData, module.parameters]);

    // 회귀 잔차 진단 플롯 생성(잔차 = 예측 - 실제) — Elston식 "잔차 심문"의 시각화(28.6)
    useEffect(() => {
        if (modelType === 'regression' && getInputData && module.parameters) {
            const labelColumn = module.parameters.label_column;
            const predictionColumn = module.parameters.prediction_column;
            if (labelColumn && predictionColumn && getInputData.rows) {
                const generateResidual = async () => {
                    try {
                        const pyodideModule = await import('../utils/pyodideRunner');
                        const { generateResidualPlotPython } = pyodideModule;
                        const img = await generateResidualPlotPython(
                            getInputData.rows || [],
                            labelColumn,
                            predictionColumn
                        );
                        setResidualPlotImage(img);
                    } catch (error: any) {
                        console.error('Failed to generate residual plot:', error);
                        setResidualPlotImage(null);
                    }
                };
                generateResidual();
            } else {
                setResidualPlotImage(null);
            }
        } else {
            setResidualPlotImage(null);
        }
    }, [modelType, getInputData, module.parameters]);

    // ✨ AI 해설: 평가 지표/혼동행렬을 요약하여 explainModuleResult에 전달
    const handleExplain = async () => {
        setIsExplaining(true);
        setAiError('');
        setExplanation('');
        try {
            const metricLines = Object.entries(metrics)
                .map(([k, v]) => `- ${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
                .join('\n');

            let cmLine = '';
            if (modelType === 'classification' && selectedRow) {
                cmLine = `\n\n[혼동행렬 (threshold=${selectedRow.threshold.toFixed(2)})]\n- TP=${selectedRow.tp}, FP=${selectedRow.fp}, TN=${selectedRow.tn}, FN=${selectedRow.fn}`;
                if (auc > 0) cmLine += `\n- AUC=${auc.toFixed(4)}`;
            }

            const summary = `모델 유형: ${modelType}\n\n[성능 지표]\n${metricLines}${cmLine}`;
            const result = await explainModuleResult(
                modelType === 'classification' ? 'Evaluation(분류 모델 평가)' : 'Evaluation(회귀 모델 평가)',
                summary
            );
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
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-gray-800">Evaluation Results: {module.name}</h2>
                        <p className="text-sm text-gray-500">Model Type: <span className="capitalize">{modelType}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                        <AdvancedOnly>
                        <button
                            onClick={handleExplain}
                            disabled={isExplaining}
                            className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${ADVANCED_BTN_DIM}`}
                            title="AI가 이 평가 결과를 해설합니다"
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
                <main className="flex-grow p-6 overflow-auto">
                    {/* ✨ AI 해설 패널 */}
                    {(isExplaining || explanation || aiError) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                            <h3 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <span aria-hidden>✨</span> AI 해설
                            </h3>
                            {isExplaining && (
                                <p className="text-sm text-gray-500 animate-pulse">AI가 평가 결과를 해설하고 있습니다…</p>
                            )}
                            {aiError && <p className="text-sm text-red-600">{aiError}</p>}
                            {explanation && <MarkdownRenderer text={explanation} />}
                        </div>
                    )}

                    {/* Performance Metrics - 선택된 threshold의 통계량 표시 (스윕이 있을 때만; 없으면 아래 폴백 1곳에서만 표시해 중복 방지) */}
                    {modelType === 'classification' && selectedRow && thresholdTable.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                                Selected Threshold: {selectedRow.threshold.toFixed(2)}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-base">
                                <div className="flex flex-col">
                                    <span className="text-gray-600 text-sm">Accuracy</span>
                                    <span className="font-mono text-gray-800 font-medium text-lg">
                                        {selectedRow.accuracy.toFixed(4)}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-gray-600 text-sm">Precision</span>
                                    <span className="font-mono text-gray-800 font-medium text-lg">
                                        {selectedRow.precision.toFixed(4)}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-gray-600 text-sm">Recall</span>
                                    <span className="font-mono text-gray-800 font-medium text-lg">
                                        {selectedRow.recall.toFixed(4)}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-gray-600 text-sm">F1-Score</span>
                                    <span className="font-mono text-gray-800 font-medium text-lg">
                                        {selectedRow.f1Score.toFixed(4)}
                                    </span>
                                </div>
                            </div>
                            {/* 2-1: 임계값(threshold) 슬라이더 — 이진 분류에서 P/R/F1 즉시 재계산 (앱 전용, 내보낸 코드 무관) */}
                            {thresholdTable.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-blue-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            임계값 조정 (Threshold Slider)
                                        </label>
                                        <span className="text-sm font-mono font-bold text-blue-700">
                                            {selectedThreshold.toFixed(2)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedThreshold}
                                        onChange={(e) => handleThresholdSelect(parseFloat(e.target.value))}
                                        className="w-full accent-blue-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>0.00</span>
                                        <span>0.50</span>
                                        <span>1.00</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        슬라이더를 움직이면 해당 임계값의 Precision/Recall/F1·혼동행렬이 즉시 갱신됩니다(미리 계산된 값에서 선택, 내보낸 Python 결과에는 영향 없음).
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Classification-specific content */}
                    {modelType === 'classification' && (
                        <>
                            {thresholdTable.length > 0 ? (
                                <div className="flex flex-col gap-4">
                                    {/* Column Selection Controls */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h3 className="text-lg font-semibold text-gray-700 mb-3 text-center">
                                            그래프에 표시할 열 선택
                                        </h3>
                                        <div className="flex items-center gap-4 justify-center">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-medium text-gray-700">첫 번째 열:</label>
                                                <select
                                                    value={selectedColumn1}
                                                    onChange={(e) => {
                                                        const newCol = e.target.value;
                                                        if (newCol !== selectedColumn2) {
                                                            setSelectedColumn1(newCol);
                                                        }
                                                    }}
                                                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                                                >
                                                    {availableColumns.map(col => (
                                                        <option key={col.value} value={col.value}>
                                                            {col.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-medium text-gray-700">두 번째 열 (비교용):</label>
                                                <select
                                                    value={selectedColumn2}
                                                    onChange={(e) => setSelectedColumn2(e.target.value)}
                                                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                                                >
                                                    <option value="">없음</option>
                                                    {availableColumns
                                                        .filter(col => col.value !== selectedColumn1)
                                                        .map(col => (
                                                            <option key={col.value} value={col.value}>
                                                                {col.label}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Table and Graph Layout */}
                                    <div className="flex gap-4">
                                        {/* Left: Threshold Table */}
                                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-gray-700">
                                                    Threshold Statistics Table
                                                </h3>
                                                <TableDownloadButton
                                                    filename={`${module.name}_임계값통계`}
                                                    columns={['Threshold', 'Accuracy', 'Precision', 'Recall', 'F1-Score', 'TP', 'FP', 'TN', 'FN']}
                                                    rows={thresholdTable.map(row => ({
                                                        'Threshold': row.threshold,
                                                        'Accuracy': row.accuracy,
                                                        'Precision': row.precision,
                                                        'Recall': row.recall,
                                                        'F1-Score': row.f1Score,
                                                        'TP': row.tp,
                                                        'FP': row.fp,
                                                        'TN': row.tn,
                                                        'FN': row.fn,
                                                    }))}
                                                />
                                            </div>
                                            <div className="overflow-x-auto max-h-[500px]">
                                                <table className="w-full border-collapse text-sm">
                                                    <thead className="bg-gray-100 sticky top-0">
                                                        <tr>
                                                            <th className="border border-gray-300 p-2 text-left">Threshold</th>
                                                            <th 
                                                                className={`border border-gray-300 p-2 text-center cursor-pointer hover:bg-blue-100 ${
                                                                    selectedColumn1 === 'accuracy' || selectedColumn2 === 'accuracy' ? 'bg-blue-200 font-semibold' : ''
                                                                }`}
                                                                onClick={() => handleColumnClick('accuracy')}
                                                            >
                                                                Accuracy
                                                            </th>
                                                            <th 
                                                                className={`border border-gray-300 p-2 text-center cursor-pointer hover:bg-blue-100 ${
                                                                    selectedColumn1 === 'precision' || selectedColumn2 === 'precision' ? 'bg-blue-200 font-semibold' : ''
                                                                }`}
                                                                onClick={() => handleColumnClick('precision')}
                                                            >
                                                                Precision
                                                            </th>
                                                            <th 
                                                                className={`border border-gray-300 p-2 text-center cursor-pointer hover:bg-blue-100 ${
                                                                    selectedColumn1 === 'recall' || selectedColumn2 === 'recall' ? 'bg-blue-200 font-semibold' : ''
                                                                }`}
                                                                onClick={() => handleColumnClick('recall')}
                                                            >
                                                                Recall
                                                            </th>
                                                            <th 
                                                                className={`border border-gray-300 p-2 text-center cursor-pointer hover:bg-blue-100 ${
                                                                    selectedColumn1 === 'f1Score' || selectedColumn2 === 'f1Score' ? 'bg-blue-200 font-semibold' : ''
                                                                }`}
                                                                onClick={() => handleColumnClick('f1Score')}
                                                            >
                                                                F1-Score
                                                            </th>
                                                            <th className="border border-gray-300 p-2 text-center">TP</th>
                                                            <th className="border border-gray-300 p-2 text-center">FP</th>
                                                            <th className="border border-gray-300 p-2 text-center">TN</th>
                                                            <th className="border border-gray-300 p-2 text-center">FN</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {thresholdTable.map((row, index) => {
                                                            const isSelected = selectedRow && Math.abs(row.threshold - selectedRow.threshold) < 0.001;
                                                            return (
                                                                <tr
                                                                    key={index}
                                                                    onClick={() => handleThresholdSelect(row.threshold)}
                                                                    className={`cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-100 font-semibold' : ''}`}
                                                                >
                                                                    <td className="border border-gray-300 p-2 font-mono">
                                                                        {row.threshold.toFixed(2)}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.accuracy.toFixed(4)}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.precision.toFixed(4)}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.recall.toFixed(4)}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.f1Score.toFixed(4)}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.tp}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.fp}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.tn}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-2 text-center">
                                                                        {row.fn}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 text-center">
                                                행 클릭: threshold 선택 | 열 헤더 클릭: 그래프에 표시 ({thresholdTable.length}개 threshold 값)
                                            </p>
                                        </div>

                                        {/* Right: Graph */}
                                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                                                {availableColumns.find(c => c.value === selectedColumn1)?.label}
                                                {selectedColumn2 && ` vs ${availableColumns.find(c => c.value === selectedColumn2)?.label}`}
                                            </h3>
                                            <div className="relative" style={{ height: '500px' }}>
                                                <svg width="100%" height="100%" className="border border-gray-300 rounded" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
                                                    <defs>
                                                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                                                        </pattern>
                                                    </defs>
                                                    <rect width="100%" height="100%" fill="url(#grid)" />
                                                    
                                                    {/* Grid lines - Y axis */}
                                                    {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(val => {
                                                        const y = 460 - (val / maxValue) * 420;
                                                        return (
                                                            <g key={`y-${val}`}>
                                                                <line
                                                                    x1="60"
                                                                    y1={y}
                                                                    x2="780"
                                                                    y2={y}
                                                                    stroke="#d1d5db"
                                                                    strokeWidth="1"
                                                                />
                                                                <text
                                                                    x="55"
                                                                    y={y + 5}
                                                                    fontSize="12"
                                                                    fill="#6b7280"
                                                                    textAnchor="end"
                                                                >
                                                                    {val.toFixed(1)}
                                                                </text>
                                                            </g>
                                                        );
                                                    })}
                                                    
                                                    {/* X-axis labels - Threshold */}
                                                    {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(val => {
                                                        const x = 60 + (val / 1.0) * 720;
                                                        return (
                                                            <text
                                                                key={`x-${val}`}
                                                                x={x}
                                                                y="495"
                                                                fontSize="12"
                                                                fill="#6b7280"
                                                                textAnchor="middle"
                                                            >
                                                                {val.toFixed(1)}
                                                            </text>
                                                        );
                                                    })}

                                                    {/* First column line */}
                                                    {graphData1.length > 1 && graphData1.map((d, i) => {
                                                        if (i === 0) return null;
                                                        const x1 = 60 + (graphData1[i - 1].threshold / 1.0) * 720;
                                                        const y1 = 460 - (graphData1[i - 1].value / maxValue) * 420;
                                                        const x2 = 60 + (d.threshold / 1.0) * 720;
                                                        const y2 = 460 - (d.value / maxValue) * 420;
                                                        return (
                                                            <line
                                                                key={`line1-${i}`}
                                                                x1={x1}
                                                                y1={y1}
                                                                x2={x2}
                                                                y2={y2}
                                                                stroke="#3b82f6"
                                                                strokeWidth="2"
                                                            />
                                                        );
                                                    })}

                                                    {/* Second column line */}
                                                    {graphData2.length > 1 && graphData2.map((d, i) => {
                                                        if (i === 0) return null;
                                                        const x1 = 60 + (graphData2[i - 1].threshold / 1.0) * 720;
                                                        const y1 = 460 - (graphData2[i - 1].value / maxValue) * 420;
                                                        const x2 = 60 + (d.threshold / 1.0) * 720;
                                                        const y2 = 460 - (d.value / maxValue) * 420;
                                                        return (
                                                            <line
                                                                key={`line2-${i}`}
                                                                x1={x1}
                                                                y1={y1}
                                                                x2={x2}
                                                                y2={y2}
                                                                stroke="#10b981"
                                                                strokeWidth="2"
                                                            />
                                                        );
                                                    })}

                                                    {/* Current threshold indicator line */}
                                                    {selectedThreshold !== undefined && (
                                                        <line
                                                            x1={60 + (selectedThreshold / 1.0) * 720}
                                                            y1="40"
                                                            x2={60 + (selectedThreshold / 1.0) * 720}
                                                            y2="460"
                                                            stroke="#ef4444"
                                                            strokeWidth="2"
                                                            strokeDasharray="4,4"
                                                            opacity="0.7"
                                                        />
                                                    )}

                                                    {/* Labels */}
                                                    <text x="400" y="25" fontSize="14" fontWeight="bold" fill="#374151" textAnchor="middle">
                                                        Threshold
                                                    </text>
                                                    <text
                                                        x="20"
                                                        y="250"
                                                        fontSize="14"
                                                        fontWeight="bold"
                                                        fill="#374151"
                                                        transform="rotate(-90, 20, 250)"
                                                    >
                                                        Value
                                                    </text>

                                                    {/* Legend */}
                                                    <g transform="translate(650, 40)">
                                                        <line x1="0" y1="0" x2="30" y2="0" stroke="#3b82f6" strokeWidth="2" />
                                                        <text x="35" y="5" fontSize="12" fill="#3b82f6">
                                                            {availableColumns.find(c => c.value === selectedColumn1)?.label}
                                                        </text>
                                                        {selectedColumn2 && (
                                                            <>
                                                                <line x1="0" y1="20" x2="30" y2="20" stroke="#10b981" strokeWidth="2" />
                                                                <text x="35" y="25" fontSize="12" fill="#10b981">
                                                                    {availableColumns.find(c => c.value === selectedColumn2)?.label}
                                                                </text>
                                                            </>
                                                        )}
                                                        {selectedThreshold !== undefined && (
                                                            <>
                                                                <line x1="0" y1="40" x2="30" y2="40" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,4" opacity="0.7" />
                                                                <text x="35" y="45" fontSize="12" fill="#ef4444">Selected Threshold</text>
                                                            </>
                                                        )}
                                                    </g>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // thresholdMetrics가 없으면 기존 방식으로 표시
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                                        Performance Metrics
                                    </h3>
                                    <div className="space-y-3 text-base">
                                        {Object.entries(metrics)
                                            .filter(([key]) => !['TP', 'FP', 'TN', 'FN', 'Confusion Matrix'].includes(key))
                                            .map(([key, value]) => (
                                            <div key={key} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                                <span className="text-gray-600">{key}:</span>
                                                <span className="font-mono text-gray-800 font-medium">
                                                    {typeof value === 'number' ? value.toFixed(4) : value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* C-1: 분류 지표 바 차트 */}
                                    <MetricBarChart
                                        metrics={Object.fromEntries(Object.entries(metrics).filter(([k]) => !['TP','FP','TN','FN','Confusion Matrix'].includes(k)))}
                                        modelType="classification"
                                    />
                                </div>
                            )}

                            {/* Confusion Matrix Table - 선택된 threshold의 혼동행렬 */}
                            {selectedRow && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-700">
                                            Confusion Matrix{thresholdTable.length > 0 ? ` (Threshold: ${selectedRow.threshold.toFixed(2)})` : ''}
                                        </h3>
                                        <TableDownloadButton
                                            filename={`${module.name}_혼동행렬_threshold${selectedRow.threshold.toFixed(2)}`}
                                            columns={['', 'Predicted: 0', 'Predicted: 1']}
                                            rows={[
                                                { '': 'Actual: 0', 'Predicted: 0': selectedRow.tn, 'Predicted: 1': selectedRow.fp },
                                                { '': 'Actual: 1', 'Predicted: 0': selectedRow.fn, 'Predicted: 1': selectedRow.tp },
                                            ]}
                                        />
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="border border-gray-300 p-2 bg-gray-100"></th>
                                                    <th className="border border-gray-300 p-2 bg-gray-100 text-center">Predicted: 0</th>
                                                    <th className="border border-gray-300 p-2 bg-gray-100 text-center">Predicted: 1</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="border border-gray-300 p-2 bg-gray-100 font-semibold">Actual: 0</td>
                                                    <td className="border border-gray-300 p-2 text-center bg-green-50">
                                                        <div className="font-semibold text-gray-800">{selectedRow.tn}</div>
                                                        <div className="text-xs text-gray-500">TN</div>
                                                    </td>
                                                    <td className="border border-gray-300 p-2 text-center bg-red-50">
                                                        <div className="font-semibold text-gray-800">{selectedRow.fp}</div>
                                                        <div className="text-xs text-gray-500">FP</div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-gray-300 p-2 bg-gray-100 font-semibold">Actual: 1</td>
                                                    <td className="border border-gray-300 p-2 text-center bg-red-50">
                                                        <div className="font-semibold text-gray-800">{selectedRow.fn}</div>
                                                        <div className="text-xs text-gray-500">FN</div>
                                                    </td>
                                                    <td className="border border-gray-300 p-2 text-center bg-green-50">
                                                        <div className="font-semibold text-gray-800">{selectedRow.tp}</div>
                                                        <div className="text-xs text-gray-500">TP</div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ROC Curve and AUC */}
                            {rocData.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-700">
                                            ROC Curve
                                        </h3>
                                        <div className="text-lg font-bold text-blue-600">
                                            AUC: {auc.toFixed(4)}
                                        </div>
                                    </div>
                                    <div className="relative" style={{ height: '500px' }}>
                                        <svg width="100%" height="100%" className="border border-gray-300 rounded" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
                                            <defs>
                                                <pattern id="rocGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                                                </pattern>
                                            </defs>
                                            <rect width="100%" height="100%" fill="url(#rocGrid)" />
                                            
                                            {/* Diagonal line (random classifier) */}
                                            <line
                                                x1="60"
                                                y1="460"
                                                x2="780"
                                                y2="40"
                                                stroke="#9ca3af"
                                                strokeWidth="1"
                                                strokeDasharray="4,4"
                                                opacity="0.5"
                                            />
                                            <text x="400" y="250" fontSize="12" fill="#9ca3af" textAnchor="middle" opacity="0.7">
                                                Random Classifier (AUC = 0.5)
                                            </text>
                                            
                                            {/* Grid lines - Y axis (TPR) */}
                                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(val => {
                                                const y = 460 - val * 420;
                                                return (
                                                    <g key={`y-${val}`}>
                                                        <line
                                                            x1="60"
                                                            y1={y}
                                                            x2="780"
                                                            y2={y}
                                                            stroke="#d1d5db"
                                                            strokeWidth="1"
                                                        />
                                                        <text
                                                            x="55"
                                                            y={y + 5}
                                                            fontSize="12"
                                                            fill="#6b7280"
                                                            textAnchor="end"
                                                        >
                                                            {val.toFixed(1)}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                            
                                            {/* Grid lines - X axis (FPR) */}
                                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(val => {
                                                const x = 60 + val * 720;
                                                return (
                                                    <g key={`x-${val}`}>
                                                        <line
                                                            x1={x}
                                                            y1="40"
                                                            x2={x}
                                                            y2="460"
                                                            stroke="#d1d5db"
                                                            strokeWidth="1"
                                                        />
                                                        <text
                                                            x={x}
                                                            y="495"
                                                            fontSize="12"
                                                            fill="#6b7280"
                                                            textAnchor="middle"
                                                        >
                                                            {val.toFixed(1)}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* ROC Curve line */}
                                            {rocData.length > 1 && rocData.map((point, i) => {
                                                if (i === 0) return null;
                                                const x1 = 60 + rocData[i - 1].fpr * 720;
                                                const y1 = 460 - rocData[i - 1].tpr * 420;
                                                const x2 = 60 + point.fpr * 720;
                                                const y2 = 460 - point.tpr * 420;
                                                return (
                                                    <line
                                                        key={`roc-${i}`}
                                                        x1={x1}
                                                        y1={y1}
                                                        x2={x2}
                                                        y2={y2}
                                                        stroke="#3b82f6"
                                                        strokeWidth="2"
                                                    />
                                                );
                                            })}

                                            {/* ROC Curve points */}
                                            {rocData.map((point, i) => {
                                                const x = 60 + point.fpr * 720;
                                                const y = 460 - point.tpr * 420;
                                                return (
                                                    <circle
                                                        key={`point-${i}`}
                                                        cx={x}
                                                        cy={y}
                                                        r="3"
                                                        fill="#3b82f6"
                                                    />
                                                );
                                            })}

                                            {/* Labels */}
                                            <text x="400" y="25" fontSize="14" fontWeight="bold" fill="#374151" textAnchor="middle">
                                                False Positive Rate (FPR)
                                            </text>
                                            <text
                                                x="20"
                                                y="250"
                                                fontSize="14"
                                                fontWeight="bold"
                                                fill="#374151"
                                                transform="rotate(-90, 20, 250)"
                                            >
                                                True Positive Rate (TPR)
                                            </text>
                                        </svg>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                        ROC Curve: 각 threshold에 대한 TPR과 FPR을 표시합니다. AUC (Area Under Curve)는 모델의 분류 성능을 나타냅니다.
                                    </p>
                                </div>
                            )}

                            {/* 2-1: Precision-Recall Curve and Average Precision */}
                            {prData.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-700">
                                            Precision-Recall Curve
                                        </h3>
                                        <div className="text-lg font-bold text-emerald-600">
                                            Avg Precision: {averagePrecision.toFixed(4)}
                                        </div>
                                    </div>
                                    <div className="relative" style={{ height: '500px' }}>
                                        <svg width="100%" height="100%" className="border border-gray-300 rounded" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
                                            <defs>
                                                <pattern id="prGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                                                </pattern>
                                            </defs>
                                            <rect width="100%" height="100%" fill="url(#prGrid)" />

                                            {/* Grid lines - Y axis (Precision) */}
                                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(val => {
                                                const y = 460 - val * 420;
                                                return (
                                                    <g key={`pr-y-${val}`}>
                                                        <line x1="60" y1={y} x2="780" y2={y} stroke="#d1d5db" strokeWidth="1" />
                                                        <text x="55" y={y + 5} fontSize="12" fill="#6b7280" textAnchor="end">
                                                            {val.toFixed(1)}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* Grid lines - X axis (Recall) */}
                                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(val => {
                                                const x = 60 + val * 720;
                                                return (
                                                    <g key={`pr-x-${val}`}>
                                                        <line x1={x} y1="40" x2={x} y2="460" stroke="#d1d5db" strokeWidth="1" />
                                                        <text x={x} y="495" fontSize="12" fill="#6b7280" textAnchor="middle">
                                                            {val.toFixed(1)}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* PR Curve line */}
                                            {prData.length > 1 && prData.map((point, i) => {
                                                if (i === 0) return null;
                                                const x1 = 60 + prData[i - 1].recall * 720;
                                                const y1 = 460 - prData[i - 1].precision * 420;
                                                const x2 = 60 + point.recall * 720;
                                                const y2 = 460 - point.precision * 420;
                                                return (
                                                    <line key={`pr-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#10b981" strokeWidth="2" />
                                                );
                                            })}

                                            {/* PR Curve points */}
                                            {prData.map((point, i) => {
                                                const x = 60 + point.recall * 720;
                                                const y = 460 - point.precision * 420;
                                                return (
                                                    <circle key={`pr-point-${i}`} cx={x} cy={y} r="3" fill="#10b981" />
                                                );
                                            })}

                                            {/* Labels */}
                                            <text x="400" y="25" fontSize="14" fontWeight="bold" fill="#374151" textAnchor="middle">
                                                Recall
                                            </text>
                                            <text x="20" y="250" fontSize="14" fontWeight="bold" fill="#374151" transform="rotate(-90, 20, 250)">
                                                Precision
                                            </text>
                                        </svg>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                        Precision-Recall Curve: 각 threshold에 대한 Precision과 Recall을 표시합니다. Average Precision은 PR 곡선 아래 면적입니다(불균형 데이터에 특히 유용).
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Regression metrics */}
                    {modelType === 'regression' && (
                        <>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                                    Performance Metrics
                                </h3>
                                <div className="space-y-3 text-base">
                                    {Object.entries(metrics).map(([key, value]) => (
                                        <div key={key} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                            <span className="text-gray-600">{key}:</span>
                                            <span className="font-mono text-gray-800 font-medium">
                                                {typeof value === 'number' ? value.toFixed(4) : value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {/* C-1: 인터랙티브 바 차트 */}
                                <MetricBarChart metrics={metrics} modelType={modelType} />
                            </div>
                            
                            {/* Regression Scatter Plot */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                                    Prediction Result in Test Set
                                </h3>
                                {isGeneratingPlot ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="text-gray-600">Generating plot...</div>
                                    </div>
                                ) : regressionPlotImage ? (
                                    <div className="flex items-center justify-center">
                                        <img 
                                            src={`data:image/png;base64,${regressionPlotImage}`} 
                                            alt="Prediction Result in Test Set"
                                            className="max-w-full h-auto"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center py-8 text-gray-500">
                                        No plot data available
                                    </div>
                                )}
                            </div>

                            {/* Residual Diagnostics (잔차 진단 — 제9부 28.6) */}
                            {residualPlotImage && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                    <h3 className="text-lg font-semibold text-gray-700 mb-1 text-center">
                                        Residual Diagnostics (잔차 진단)
                                    </h3>
                                    <p className="text-xs text-gray-500 text-center mb-3">
                                        잔차 = 예측 − 실제. 좌: 잔차 vs 실제(0 기준선 주위 무작위가 이상적) · 우: 잔차 분포(치우침·이상치 확인)
                                    </p>
                                    <div className="flex items-center justify-center">
                                        <img
                                            src={`data:image/png;base64,${residualPlotImage}`}
                                            alt="Residual Diagnostics"
                                            className="max-w-full h-auto"
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};
