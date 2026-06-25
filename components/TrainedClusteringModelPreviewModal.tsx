import React, { useMemo, useState } from 'react';
import { CanvasModule, TrainedClusteringModelOutput, DataPreview, Connection, ModuleType } from '../types';
import { XCircleIcon, SparklesIcon } from './icons';
import { ClusterScatterPlot, useCluster2DProjection, pickNumericFeatures } from './ClusterScatterPlot';

interface TrainedClusteringModelPreviewModalProps {
    module: CanvasModule;
    projectName: string;
    onClose: () => void;
    modules?: CanvasModule[];
    connections?: Connection[];
}

// 유클리드 거리 계산 함수
const calculateDistance = (point1: Record<string, number>, point2: Record<string, number>, featureColumns: string[]): number => {
    let sum = 0;
    for (const col of featureColumns) {
        const diff = (point1[col] || 0) - (point2[col] || 0);
        sum += diff * diff;
    }
    return Math.sqrt(sum);
};

// 클러스터 간 거리 계산
const calculateCentroidDistances = (centroids: Record<string, number>[], featureColumns: string[]): number[][] => {
    const distances: number[][] = [];
    for (let i = 0; i < centroids.length; i++) {
        distances[i] = [];
        for (let j = 0; j < centroids.length; j++) {
            if (i === j) {
                distances[i][j] = 0;
            } else {
                distances[i][j] = calculateDistance(centroids[i], centroids[j], featureColumns);
            }
        }
    }
    return distances;
};

// K-Means 결과 표시 컴포넌트
const KMeansResults: React.FC<{
    output: TrainedClusteringModelOutput;
    inputData: DataPreview | null;
    moduleId: string;
    modules: CanvasModule[];
    connections: Connection[];
}> = ({ output, inputData, moduleId, modules, connections }) => {
    const centroids = output.centroids || [];
    const inertia = output.inertia || 0;
    const featureColumns = output.featureColumns || [];

    // 입력 데이터 가져오기
    const trainingData = useMemo(() => {
        if (inputData) return inputData;
        
        // data_in 포트로 연결된 데이터 찾기
        const dataConnection = connections.find(
            c => c.to.moduleId === moduleId && c.to.portName === 'data_in'
        );
        
        if (dataConnection) {
            const sourceModule = modules.find(m => m.id === dataConnection.from.moduleId);
            if (sourceModule?.outputData) {
                if (sourceModule.outputData.type === 'DataPreview') {
                    return sourceModule.outputData;
                }
                if (sourceModule.outputData.type === 'SplitDataOutput') {
                    const portName = dataConnection.from.portName;
                    if (portName === 'train_data_out') {
                        return sourceModule.outputData.train;
                    } else if (portName === 'test_data_out') {
                        return sourceModule.outputData.test;
                    }
                    return sourceModule.outputData.train;
                }
            }
        }
        return null;
    }, [inputData, moduleId, modules, connections]);

    // 클러스터 할당 계산 (간단한 버전 - 실제로는 모델에서 가져와야 함)
    const clusterAssignments = useMemo(() => {
        if (!trainingData || !trainingData.rows || centroids.length === 0) return [];
        
        return trainingData.rows.map(row => {
            let minDistance = Infinity;
            let assignedCluster = 0;
            
            for (let i = 0; i < centroids.length; i++) {
                const distance = calculateDistance(row as Record<string, number>, centroids[i], featureColumns);
                if (distance < minDistance) {
                    minDistance = distance;
                    assignedCluster = i;
                }
            }
            return assignedCluster;
        });
    }, [trainingData, centroids, featureColumns]);

    // 클러스터별 통계량 계산
    const clusterStats = useMemo(() => {
        if (!trainingData || !trainingData.rows || clusterAssignments.length === 0) return [];
        
        const stats: Array<Record<string, { mean: number; std: number; min: number; max: number; count: number }>> = [];
        
        for (let i = 0; i < centroids.length; i++) {
            const clusterRows = trainingData.rows.filter((_, idx) => clusterAssignments[idx] === i);
            const clusterStat: Record<string, { mean: number; std: number; min: number; max: number; count: number }> = {};
            
            for (const col of featureColumns) {
                const values = clusterRows.map(row => {
                    const val = row[col];
                    return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
                }).filter(v => !isNaN(v));
                
                if (values.length > 0) {
                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
                    const std = Math.sqrt(variance);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    
                    clusterStat[col] = { mean, std, min, max, count: values.length };
                }
            }
            
            stats.push(clusterStat);
        }
        
        return stats;
    }, [trainingData, clusterAssignments, featureColumns]);

    // 클러스터 간 거리 계산
    const centroidDistances = useMemo(() => {
        return calculateCentroidDistances(centroids, featureColumns);
    }, [centroids, featureColumns]);

    // 클러스터별 포인트 수
    const clusterCounts = useMemo(() => {
        const counts: number[] = new Array(centroids.length).fill(0);
        clusterAssignments.forEach(cluster => {
            counts[cluster]++;
        });
        return counts;
    }, [clusterAssignments, centroids.length]);

    // 클러스터 산점도(2D 투영)용 — 학습 데이터를 중심점 기준 할당 클러스터로 색 구분.
    // 값 기반 수치 판정(type 오추론에도 견고). featureColumns가 비면 학습데이터 컬럼에서 유추.
    const scatterFeatures = useMemo(() => {
        const base = featureColumns.length > 0
            ? featureColumns
            : (trainingData?.columns.map(c => c.name) ?? []);
        return pickNumericFeatures(trainingData?.rows, base);
    }, [featureColumns, trainingData]);

    const { projection, loading: projLoading, error: projError } = useCluster2DProjection(
        trainingData?.rows,
        scatterFeatures,
        clusterAssignments.length > 0 ? clusterAssignments : null
    );

    return (
        <div className="space-y-6">
            {/* 클러스터 중심점 정보 */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">클러스터 중심점 (Centroids)</h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-2 px-3 text-left font-semibold text-gray-600">클러스터</th>
                                {featureColumns.map(col => (
                                    <th key={col} className="py-2 px-3 text-right font-semibold text-gray-600">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {centroids.map((centroid, idx) => (
                                <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                                    <td className="py-2 px-3 font-medium text-gray-700">Cluster {idx}</td>
                                    {featureColumns.map(col => (
                                        <td key={col} className="py-2 px-3 font-mono text-right text-gray-800">
                                            {centroid[col]?.toFixed(4) || 'N/A'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 품질 지표 */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">품질 지표</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-gray-600 mb-1">Inertia (Within-cluster Sum of Squares)</div>
                            <div className="text-lg font-mono font-semibold text-gray-800">{inertia.toFixed(4)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-600 mb-1">클러스터 수</div>
                            <div className="text-lg font-mono font-semibold text-gray-800">{centroids.length}</div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="text-sm text-gray-600 mb-2">클러스터별 데이터 포인트 수</div>
                        <div className="flex gap-4">
                            {clusterCounts.map((count, idx) => (
                                <div key={idx} className="text-center">
                                    <div className="text-xs text-gray-500">Cluster {idx}</div>
                                    <div className="text-lg font-mono font-semibold text-gray-800">{count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 클러스터 산점도 (2D 투영) */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">클러스터 산점도 (PCA 2D 투영)</h3>
                {projLoading && (
                    <div className="text-sm text-gray-500 p-4 border border-gray-200 rounded-lg bg-white">
                        2D 투영 계산 중...
                    </div>
                )}
                {!projLoading && projError && (
                    <div className="text-sm text-red-500 p-4 border border-gray-200 rounded-lg bg-white">
                        산점도를 생성하지 못했습니다: {projError}
                    </div>
                )}
                {!projLoading && !projError && projection && (
                    <ClusterScatterPlot
                        points={projection.points}
                        labels={projection.labels ?? undefined}
                        xLabel={projection.xLabel}
                        yLabel={projection.yLabel}
                        title={featureColumns.length >= 3
                            ? '클러스터 산점도 (PCA로 2D 축소, 색=할당 클러스터)'
                            : '클러스터 산점도 (색=할당 클러스터)'}
                    />
                )}
            </div>

            {/* 클러스터별 통계량 */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">클러스터별 통계량</h3>
                {clusterStats.map((stats, clusterIdx) => (
                    <div key={clusterIdx} className="mb-4">
                        <h4 className="text-md font-semibold text-gray-700 mb-2">Cluster {clusterIdx} (n={clusterCounts[clusterIdx]})</h4>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-600">특성</th>
                                        <th className="py-2 px-3 text-right font-semibold text-gray-600">평균</th>
                                        <th className="py-2 px-3 text-right font-semibold text-gray-600">표준편차</th>
                                        <th className="py-2 px-3 text-right font-semibold text-gray-600">최소값</th>
                                        <th className="py-2 px-3 text-right font-semibold text-gray-600">최대값</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {featureColumns.map(col => {
                                        const stat = stats[col];
                                        if (!stat) return null;
                                        return (
                                            <tr key={col} className="border-b border-gray-200 last:border-b-0">
                                                <td className="py-2 px-3 font-medium text-gray-700">{col}</td>
                                                <td className="py-2 px-3 font-mono text-right text-gray-800">{stat.mean.toFixed(4)}</td>
                                                <td className="py-2 px-3 font-mono text-right text-gray-800">{stat.std.toFixed(4)}</td>
                                                <td className="py-2 px-3 font-mono text-right text-gray-800">{stat.min.toFixed(4)}</td>
                                                <td className="py-2 px-3 font-mono text-right text-gray-800">{stat.max.toFixed(4)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {/* 클러스터 간 거리 행렬 */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">클러스터 간 거리</h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-2 px-3 text-left font-semibold text-gray-600">클러스터</th>
                                {centroids.map((_, idx) => (
                                    <th key={idx} className="py-2 px-3 text-right font-semibold text-gray-600">Cluster {idx}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {centroidDistances.map((row, idx) => (
                                <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                                    <td className="py-2 px-3 font-medium text-gray-700">Cluster {idx}</td>
                                    {row.map((distance, colIdx) => (
                                        <td key={colIdx} className={`py-2 px-3 font-mono text-right ${idx === colIdx ? 'text-gray-400' : 'text-gray-800'}`}>
                                            {distance.toFixed(4)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 데이터 테이블 (클러스터 포함 여부 및 거리 추가) */}
            {trainingData && trainingData.rows && trainingData.rows.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">학습 데이터 (클러스터 할당 포함)</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '400px' }}>
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    {trainingData.columns.map(col => (
                                        <th key={col.name} className={`py-2 px-3 font-semibold text-gray-600 ${col.type === 'number' ? 'text-right' : 'text-left'}`}>
                                            {col.name}
                                        </th>
                                    ))}
                                    <th className="py-2 px-3 font-semibold text-gray-600 text-center">클러스터</th>
                                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">중심점 거리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trainingData.rows.slice(0, 1000).map((row, rowIdx) => {
                                    const cluster = clusterAssignments[rowIdx];
                                    const distance = calculateDistance(row as Record<string, number>, centroids[cluster], featureColumns);
                                    return (
                                        <tr key={rowIdx} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                                            {trainingData.columns.map(col => (
                                                <td key={col.name} className={`py-1.5 px-3 ${col.type === 'number' ? 'font-mono text-right' : 'text-left'} text-gray-700`}>
                                                    {row[col.name] === null || row[col.name] === undefined ? (
                                                        <span className="text-gray-400 italic">null</span>
                                                    ) : (
                                                        String(row[col.name])
                                                    )}
                                                </td>
                                            ))}
                                            <td className="py-1.5 px-3 text-center font-semibold text-gray-800">Cluster {cluster}</td>
                                            <td className="py-1.5 px-3 font-mono text-right text-gray-700">{distance.toFixed(4)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {trainingData.rows.length > 1000 && (
                            <div className="p-2 text-sm text-gray-500 text-center">
                                표시된 행: 1-1000 / 전체: {trainingData.rows.length}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// PCA 결과 표시 컴포넌트
const PCAResults: React.FC<{
    output: TrainedClusteringModelOutput;
    inputData: DataPreview | null;
    moduleId: string;
    modules: CanvasModule[];
    connections: Connection[];
}> = ({ output, inputData, moduleId, modules, connections }) => {
    const explainedVarianceRatio = output.explainedVarianceRatio || [];
    const components = output.components || [];
    const mean = output.mean || [];
    const featureColumns = output.featureColumns || [];
    const nComponents = explainedVarianceRatio.length;

    // 입력 데이터 가져오기
    const trainingData = useMemo(() => {
        if (inputData) return inputData;
        
        const dataConnection = connections.find(
            c => c.to.moduleId === moduleId && c.to.portName === 'data_in'
        );
        
        if (dataConnection) {
            const sourceModule = modules.find(m => m.id === dataConnection.from.moduleId);
            if (sourceModule?.outputData) {
                if (sourceModule.outputData.type === 'DataPreview') {
                    return sourceModule.outputData;
                }
                if (sourceModule.outputData.type === 'SplitDataOutput') {
                    const portName = dataConnection.from.portName;
                    if (portName === 'train_data_out') {
                        return sourceModule.outputData.train;
                    } else if (portName === 'test_data_out') {
                        return sourceModule.outputData.test;
                    }
                    return sourceModule.outputData.train;
                }
            }
        }
        return null;
    }, [inputData, moduleId, modules, connections]);

    // 변환된 데이터 계산
    const transformedData = useMemo(() => {
        if (!trainingData || !trainingData.rows || components.length === 0) return null;
        
        return trainingData.rows.map(row => {
            const transformed: number[] = [];
            for (let i = 0; i < nComponents; i++) {
                let value = 0;
                for (let j = 0; j < featureColumns.length; j++) {
                    const col = featureColumns[j];
                    const rowValue = row[col];
                    const numValue = typeof rowValue === 'number' ? rowValue : parseFloat(String(rowValue)) || 0;
                    value += (numValue - (mean[j] || 0)) * (components[i][j] || 0);
                }
                transformed.push(value);
            }
            return transformed;
        });
    }, [trainingData, components, mean, featureColumns, nComponents]);

    // Scree Plot 데이터
    const screePlotData = useMemo(() => {
        return explainedVarianceRatio.map((ratio, idx) => ({
            component: idx + 1,
            variance: ratio * 100, // 퍼센트로 변환
            cumulative: explainedVarianceRatio.slice(0, idx + 1).reduce((a, b) => a + b, 0) * 100
        }));
    }, [explainedVarianceRatio]);

    // Scree Plot SVG
    const ScreePlot: React.FC = () => {
        const width = 600;
        const height = 300;
        const padding = { top: 40, right: 60, bottom: 50, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const maxVariance = Math.max(...screePlotData.map(d => d.variance));
        const scaleY = (value: number) => padding.top + chartHeight - (value / maxVariance) * chartHeight;
        const scaleX = (idx: number) => padding.left + (idx / (screePlotData.length - 1 || 1)) * chartWidth;

        return (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h4 className="text-md font-semibold text-gray-700 mb-3">Scree Plot (설명된 분산 비율)</h4>
                <svg width={width} height={height} className="border border-gray-300 rounded">
                    {/* 배경 그리드 */}
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                        const y = scaleY(maxVariance * ratio);
                        return (
                            <line
                                key={ratio}
                                x1={padding.left}
                                y1={y}
                                x2={width - padding.right}
                                y2={y}
                                stroke="#e5e7eb"
                                strokeWidth={1}
                            />
                        );
                    })}
                    
                    {/* 막대 그래프 */}
                    {screePlotData.map((d, idx) => {
                        const x = scaleX(idx);
                        const barWidth = chartWidth / screePlotData.length * 0.8;
                        const barHeight = chartHeight - (scaleY(d.variance) - padding.top);
                        return (
                            <g key={idx}>
                                <rect
                                    x={x - barWidth / 2}
                                    y={scaleY(d.variance)}
                                    width={barWidth}
                                    height={barHeight}
                                    fill="#3b82f6"
                                    opacity={0.7}
                                />
                                <text
                                    x={x}
                                    y={scaleY(d.variance) - 5}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#1f2937"
                                >
                                    {d.variance.toFixed(1)}%
                                </text>
                            </g>
                        );
                    })}
                    
                    {/* X축 레이블 */}
                    {screePlotData.map((d, idx) => {
                        const x = scaleX(idx);
                        return (
                            <text
                                key={idx}
                                x={x}
                                y={height - padding.bottom + 20}
                                textAnchor="middle"
                                fontSize="11"
                                fill="#4b5563"
                            >
                                PC{d.component}
                            </text>
                        );
                    })}
                    
                    {/* Y축 레이블 */}
                    <text
                        x={padding.left - 30}
                        y={height / 2}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#4b5563"
                        transform={`rotate(-90 ${padding.left - 30} ${height / 2})`}
                    >
                        설명된 분산 비율 (%)
                    </text>
                </svg>
            </div>
        );
    };

    // 주성분 공간 시각화 (2D)
    const PCAScatterPlot: React.FC = () => {
        if (!transformedData || transformedData.length === 0) return null;

        const width = 600;
        const height = 400;
        const padding = { top: 40, right: 60, bottom: 50, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // PC1과 PC2 값 추출
        const pc1Values = transformedData.map(d => d[0] || 0);
        const pc2Values = transformedData.map(d => d[1] || 0);

        const pc1Min = Math.min(...pc1Values);
        const pc1Max = Math.max(...pc1Values);
        const pc2Min = Math.min(...pc2Values);
        const pc2Max = Math.max(...pc2Values);

        const pc1Range = pc1Max - pc1Min || 1;
        const pc2Range = pc2Max - pc2Min || 1;

        const scaleX = (value: number) => padding.left + ((value - pc1Min) / pc1Range) * chartWidth;
        const scaleY = (value: number) => padding.top + chartHeight - ((value - pc2Min) / pc2Range) * chartHeight;

        return (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h4 className="text-md font-semibold text-gray-700 mb-3">주성분 공간 시각화 (PC1 vs PC2)</h4>
                <svg width={width} height={height} className="border border-gray-300 rounded">
                    {/* 배경 그리드 */}
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                        const x = padding.left + ratio * chartWidth;
                        const y = padding.top + ratio * chartHeight;
                        return (
                            <g key={ratio}>
                                <line
                                    x1={x}
                                    y1={padding.top}
                                    x2={x}
                                    y2={height - padding.bottom}
                                    stroke="#e5e7eb"
                                    strokeWidth={1}
                                />
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="#e5e7eb"
                                    strokeWidth={1}
                                />
                            </g>
                        );
                    })}
                    
                    {/* 데이터 포인트 */}
                    {transformedData.map((point, idx) => {
                        const x = scaleX(point[0] || 0);
                        const y = scaleY(point[1] || 0);
                        return (
                            <circle
                                key={idx}
                                cx={x}
                                cy={y}
                                r={3}
                                fill="#3b82f6"
                                opacity={0.6}
                            />
                        );
                    })}
                    
                    {/* X축 레이블 */}
                    <text
                        x={width / 2}
                        y={height - padding.bottom + 30}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#4b5563"
                        fontWeight="semibold"
                    >
                        PC1 ({explainedVarianceRatio[0] ? (explainedVarianceRatio[0] * 100).toFixed(1) : '0'}%)
                    </text>
                    
                    {/* Y축 레이블 */}
                    <text
                        x={padding.left - 30}
                        y={height / 2}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#4b5563"
                        fontWeight="semibold"
                        transform={`rotate(-90 ${padding.left - 30} ${height / 2})`}
                    >
                        PC2 ({explainedVarianceRatio[1] ? (explainedVarianceRatio[1] * 100).toFixed(1) : '0'}%)
                    </text>
                </svg>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* 설명된 분산 비율 */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">설명된 분산 비율</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <div className="text-sm text-gray-600 mb-1">주성분 수</div>
                            <div className="text-lg font-mono font-semibold text-gray-800">{nComponents}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-600 mb-1">총 설명된 분산</div>
                            <div className="text-lg font-mono font-semibold text-gray-800">
                                {(explainedVarianceRatio.reduce((a, b) => a + b, 0) * 100).toFixed(2)}%
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="py-2 px-3 text-left font-semibold text-gray-600">주성분</th>
                                    <th className="py-2 px-3 text-right font-semibold text-gray-600">분산 비율</th>
                                    <th className="py-2 px-3 text-right font-semibold text-gray-600">누적 분산</th>
                                </tr>
                            </thead>
                            <tbody>
                                {explainedVarianceRatio.map((ratio, idx) => {
                                    const cumulative = explainedVarianceRatio.slice(0, idx + 1).reduce((a, b) => a + b, 0);
                                    return (
                                        <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                                            <td className="py-2 px-3 font-medium text-gray-700">PC{idx + 1}</td>
                                            <td className="py-2 px-3 font-mono text-right text-gray-800">{(ratio * 100).toFixed(2)}%</td>
                                            <td className="py-2 px-3 font-mono text-right text-gray-800">{(cumulative * 100).toFixed(2)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Scree Plot */}
            <div>
                <ScreePlot />
            </div>

            {/* 주성분 공간 시각화 */}
            {nComponents >= 2 && (
                <div>
                    <PCAScatterPlot />
                </div>
            )}

            {/* 주성분 계수 행렬 */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">주성분 계수 (Loading Matrix)</h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '400px' }}>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="py-2 px-3 text-left font-semibold text-gray-600">원본 변수</th>
                                {Array.from({ length: nComponents }, (_, i) => (
                                    <th key={i} className="py-2 px-3 text-right font-semibold text-gray-600">PC{i + 1}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {featureColumns.map((col, colIdx) => (
                                <tr key={col} className="border-b border-gray-200 last:border-b-0">
                                    <td className="py-2 px-3 font-medium text-gray-700">{col}</td>
                                    {components.map((component, compIdx) => (
                                        <td key={compIdx} className="py-2 px-3 font-mono text-right text-gray-800">
                                            {component[colIdx]?.toFixed(4) || 'N/A'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const TrainedClusteringModelPreviewModal: React.FC<TrainedClusteringModelPreviewModalProps> = ({
    module,
    projectName,
    onClose,
    modules = [],
    connections = []
}) => {
    const output = module.outputData as TrainedClusteringModelOutput;
    
    if (!output) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">오류</h3>
                    <p className="text-gray-600">모델 출력 데이터를 찾을 수 없습니다.</p>
                    <button
                        onClick={onClose}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        닫기
                    </button>
                </div>
            </div>
        );
    }

    // 입력 데이터 가져오기
    const inputData = useMemo(() => {
        const dataConnection = connections.find(
            c => {
                const targetModule = modules.find(m => m.id === c.to.moduleId);
                return targetModule && targetModule.id === module.id && c.to.portName === 'data_in';
            }
        );
        
        if (dataConnection) {
            const sourceModule = modules.find(m => m.id === dataConnection.from.moduleId);
            if (sourceModule?.outputData) {
                if (sourceModule.outputData.type === 'DataPreview') {
                    return sourceModule.outputData;
                }
                if (sourceModule.outputData.type === 'SplitDataOutput') {
                    return sourceModule.outputData.train;
                }
            }
        }
        return null;
    }, [module.id, modules, connections]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Train Clustering Model: {module.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            모델 타입: {output.modelType === ModuleType.KMeans ? 'K-Means' : 'PCA'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* 내용 */}
                <div className="flex-grow overflow-y-auto p-6">
                    {output.modelType === ModuleType.KMeans ? (
                        <KMeansResults
                            output={output}
                            inputData={inputData}
                            moduleId={module.id}
                            modules={modules}
                            connections={connections}
                        />
                    ) : (
                        <PCAResults
                            output={output}
                            inputData={inputData}
                            moduleId={module.id}
                            modules={modules}
                            connections={connections}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
