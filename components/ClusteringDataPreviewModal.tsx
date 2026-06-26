import React, { useMemo } from 'react';
import { CanvasModule, ClusteringDataOutput, TrainedClusteringModelOutput, DataPreview, Connection, ModuleType } from '../types';
import { XCircleIcon } from './icons';
import { ClusterScatterPlot, useCluster2DProjection, pickNumericFeatures } from './ClusterScatterPlot';
import { TableDownloadButton } from './TableDownloadButton';

interface ClusteringDataPreviewModalProps {
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

// 클러스터 분포 컴포넌트 (K-Means 전용)
const ClusterDistribution: React.FC<{
    clusteredData: DataPreview;
}> = ({ clusteredData }) => {
    const clusterColumn = clusteredData.columns.find(col => col.name === 'cluster');
    if (!clusterColumn) return null;

    const distribution = useMemo(() => {
        const counts: Record<number, number> = {};
        clusteredData.rows.forEach(row => {
            const cluster = row.cluster;
            if (typeof cluster === 'number') {
                counts[cluster] = (counts[cluster] || 0) + 1;
            }
        });
        return counts;
    }, [clusteredData.rows]);

    const total = clusteredData.rows.length;
    const clusters = Object.keys(distribution).map(Number).sort((a, b) => a - b);

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">클러스터 분포</h3>
            <div className="space-y-3">
                {clusters.map(cluster => {
                    const count = distribution[cluster];
                    const percentage = (count / total) * 100;
                    return (
                        <div key={cluster} className="flex items-center gap-4">
                            <div className="w-24 text-sm font-semibold text-gray-700">Cluster {cluster}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                                <div
                                    className="bg-blue-600 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                                    style={{ width: `${percentage}%` }}
                                >
                                    {percentage > 10 && (
                                        <span className="text-xs text-white font-semibold">{count.toLocaleString()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="w-32 text-sm text-gray-600 text-right">
                                {count.toLocaleString()} ({percentage.toFixed(1)}%)
                            </div>
                        </div>
                    );
                })}
                <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                        <span className="font-semibold text-gray-700">전체</span>
                        <span className="text-gray-600">{total.toLocaleString()} (100.0%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 실루엣 점수 계산 (간단한 버전)
const calculateSilhouetteScore = (
    data: DataPreview,
    clusterAssignments: number[],
    centroids: Record<string, number>[],
    featureColumns: string[]
): number => {
    if (data.rows.length === 0 || centroids.length === 0) return 0;

    let totalSilhouette = 0;
    const n = Math.min(data.rows.length, 1000); // 성능을 위해 최대 1000개만 계산

    for (let i = 0; i < n; i++) {
        const point = data.rows[i] as Record<string, number>;
        const cluster = clusterAssignments[i];

        // 같은 클러스터 내 평균 거리 (a_i)
        const sameClusterPoints = data.rows
            .map((row, idx) => ({ row, idx, cluster: clusterAssignments[idx] }))
            .filter(item => item.cluster === cluster && item.idx !== i)
            .slice(0, 100); // 성능 제한

        let a_i = 0;
        if (sameClusterPoints.length > 0) {
            const distances = sameClusterPoints.map(item => 
                calculateDistance(point, item.row as Record<string, number>, featureColumns)
            );
            a_i = distances.reduce((a, b) => a + b, 0) / distances.length;
        }

        // 가장 가까운 다른 클러스터의 평균 거리 (b_i)
        let b_i = Infinity;
        for (let j = 0; j < centroids.length; j++) {
            if (j === cluster) continue;
            
            const otherClusterPoints = data.rows
                .map((row, idx) => ({ row, idx, cluster: clusterAssignments[idx] }))
                .filter(item => item.cluster === j)
                .slice(0, 100); // 성능 제한

            if (otherClusterPoints.length > 0) {
                const distances = otherClusterPoints.map(item =>
                    calculateDistance(point, item.row as Record<string, number>, featureColumns)
                );
                const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
                b_i = Math.min(b_i, avgDistance);
            }
        }

        // 실루엣 점수 계산
        if (a_i === 0 && b_i === Infinity) {
            continue;
        }
        const maxDist = Math.max(a_i, b_i);
        if (maxDist > 0) {
            totalSilhouette += (b_i - a_i) / maxDist;
        }
    }

    return totalSilhouette / n;
};

// PCA 재구성 오차 계산
const calculateReconstructionError = (
    originalData: DataPreview,
    transformedData: DataPreview,
    components: number[][],
    mean: number[],
    featureColumns: string[]
): number => {
    if (!originalData || !transformedData || components.length === 0 || mean.length === 0) return 0;

    let totalError = 0;
    const n = Math.min(originalData.rows.length, 1000); // 성능을 위해 최대 1000개만 계산

    for (let i = 0; i < n; i++) {
        const originalRow = originalData.rows[i] as Record<string, number>;
        const transformedRow = transformedData.rows[i] as Record<string, number>;

        // 재구성된 데이터 계산: X_reconstructed = X_transformed @ components.T + mean
        let reconstructionError = 0;
        for (let j = 0; j < featureColumns.length; j++) {
            const col = featureColumns[j];
            const originalValue = typeof originalRow[col] === 'number' 
                ? originalRow[col] 
                : parseFloat(String(originalRow[col])) || 0;
            
            // 재구성된 값 계산
            let reconstructedValue = mean[j] || 0;
            for (let k = 0; k < components.length; k++) {
                const pcValue = typeof transformedRow[`PC${k + 1}`] === 'number'
                    ? transformedRow[`PC${k + 1}`]
                    : parseFloat(String(transformedRow[`PC${k + 1}`])) || 0;
                reconstructedValue += pcValue * (components[k][j] || 0);
            }
            
            reconstructionError += Math.pow(originalValue - reconstructedValue, 2);
        }
        totalError += Math.sqrt(reconstructionError / featureColumns.length);
    }

    return totalError / n;
};

// K-Means 클러스터링 뷰
const KMeansClusteringView: React.FC<{
    output: ClusteringDataOutput;
    trainedModel: TrainedClusteringModelOutput | null;
    originalData: DataPreview | null;
    baseName: string;
}> = ({ output, trainedModel, originalData, baseName }) => {
    const clusteredData = output.clusteredData;
    const centroids = trainedModel?.centroids || [];
    const featureColumns = trainedModel?.featureColumns || [];
    const inertia = trainedModel?.inertia || 0;

    // 클러스터별 통계량 계산
    const clusterStats = useMemo(() => {
        if (!originalData || !originalData.rows || featureColumns.length === 0) return [];
        
        const clusterColumn = clusteredData.columns.find(col => col.name === 'cluster');
        if (!clusterColumn) return [];

        const stats: Array<Record<string, { mean: number; std: number; min: number; max: number; count: number }>> = [];
        const clusterAssignments = clusteredData.rows.map(row => row.cluster as number);

        // 각 클러스터별로 통계량 계산
        for (let i = 0; i < centroids.length; i++) {
            const clusterRows = originalData.rows.filter((_, idx) => clusterAssignments[idx] === i);
            const clusterStat: Record<string, { mean: number; std: number; min: number; max: number; count: number }> = {};
            
            for (const col of featureColumns) {
                const colInfo = originalData.columns.find(c => c.name === col);
                if (!colInfo || colInfo.type !== 'number') continue;

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
    }, [originalData, clusteredData, centroids, featureColumns]);

    // 클러스터별 포인트 수
    const clusterCounts = useMemo(() => {
        const counts: number[] = new Array(centroids.length).fill(0);
        clusteredData.rows.forEach(row => {
            const cluster = row.cluster as number;
            if (typeof cluster === 'number' && cluster >= 0 && cluster < centroids.length) {
                counts[cluster]++;
            }
        });
        return counts;
    }, [clusteredData.rows, centroids.length]);

    // 클러스터 간 거리 계산
    const centroidDistances = useMemo(() => {
        if (centroids.length === 0) return [];
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
    }, [centroids, featureColumns]);

    // 실루엣 점수 계산
    const silhouetteScore = useMemo(() => {
        if (!originalData || !originalData.rows || centroids.length === 0) return null;
        
        const clusterAssignments = clusteredData.rows.map(row => row.cluster as number);
        return calculateSilhouetteScore(originalData, clusterAssignments, centroids, featureColumns);
    }, [originalData, clusteredData, centroids, featureColumns]);

    // Davies-Bouldin Index 계산 (간단한 버전)
    const daviesBouldinIndex = useMemo(() => {
        if (!originalData || centroids.length < 2) return null;
        
        const clusterAssignments = clusteredData.rows.map(row => row.cluster as number);
        const clusterVariances: number[] = [];
        
        // 각 클러스터의 분산 계산
        for (let i = 0; i < centroids.length; i++) {
            const clusterPoints = originalData.rows
                .map((row, idx) => ({ row, idx }))
                .filter(item => clusterAssignments[item.idx] === i);
            
            if (clusterPoints.length === 0) {
                clusterVariances.push(0);
                continue;
            }
            
            let totalVariance = 0;
            for (const col of featureColumns) {
                const values = clusterPoints.map(item => {
                    const val = (item.row as Record<string, number>)[col];
                    return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
                });
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
                totalVariance += variance;
            }
            clusterVariances.push(Math.sqrt(totalVariance / featureColumns.length));
        }
        
        // Davies-Bouldin Index 계산
        let dbIndex = 0;
        for (let i = 0; i < centroids.length; i++) {
            let maxRatio = 0;
            for (let j = 0; j < centroids.length; j++) {
                if (i === j) continue;
                const centroidDistance = calculateDistance(centroids[i], centroids[j], featureColumns);
                if (centroidDistance > 0) {
                    const ratio = (clusterVariances[i] + clusterVariances[j]) / centroidDistance;
                    maxRatio = Math.max(maxRatio, ratio);
                }
            }
            dbIndex += maxRatio;
        }
        return dbIndex / centroids.length;
    }, [originalData, clusteredData, centroids, featureColumns]);

    // 산점도용 수치형 피처 (cluster 제외). 값 기반 판정으로 type 오추론에도 견고.
    const scatterFeatures = useMemo(() => {
        const base = featureColumns.length > 0
            ? featureColumns
            : clusteredData.columns.map(c => c.name);
        return pickNumericFeatures(clusteredData.rows, base);
    }, [featureColumns, clusteredData]);

    const clusterLabels = useMemo(
        () => clusteredData.rows.map(row => {
            const v = row['cluster'];
            return typeof v === 'number' ? v : parseInt(String(v), 10) || 0;
        }),
        [clusteredData]
    );

    // centroid가 없는 transductive(DBSCAN/계층형) 결과를 위한 고유 클러스터 수
    const distinctClusterCount = useMemo(() => {
        const s = new Set<number>();
        clusterLabels.forEach(v => s.add(v));
        return s.size;
    }, [clusterLabels]);

    const { projection, loading: projLoading, error: projError } = useCluster2DProjection(
        clusteredData.rows,
        scatterFeatures,
        clusterLabels
    );

    return (
        <div className="space-y-6">
            {/* 적합 수준 통계량 */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">클러스터링 적합 수준</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">실루엣 점수</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {silhouetteScore !== null ? silhouetteScore.toFixed(4) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {silhouetteScore !== null && (
                                <span className={silhouetteScore > 0.5 ? 'text-green-600' : silhouetteScore > 0.25 ? 'text-yellow-600' : 'text-red-600'}>
                                    {silhouetteScore > 0.5 ? '우수' : silhouetteScore > 0.25 ? '보통' : '개선 필요'}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Davies-Bouldin Index</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {daviesBouldinIndex !== null ? daviesBouldinIndex.toFixed(4) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {daviesBouldinIndex !== null && (
                                <span className={daviesBouldinIndex < 1 ? 'text-green-600' : daviesBouldinIndex < 2 ? 'text-yellow-600' : 'text-red-600'}>
                                    {daviesBouldinIndex < 1 ? '우수' : daviesBouldinIndex < 2 ? '보통' : '개선 필요'}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Inertia (WSS)</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {inertia > 0 ? inertia.toFixed(2) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">낮을수록 좋음</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">클러스터 수</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {centroids.length > 0 ? centroids.length : distinctClusterCount}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">총 {clusteredData.rows.length.toLocaleString()}개 포인트</div>
                    </div>
                </div>
            </div>

            {/* 클러스터 분포 */}
            <ClusterDistribution clusteredData={clusteredData} />

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
                        title={scatterFeatures.length >= 3
                            ? '클러스터 산점도 (PCA로 2D 축소, 색=클러스터)'
                            : '클러스터 산점도 (색=클러스터)'}
                    />
                )}
            </div>

            {/* 클러스터별 통계량 */}
            {clusterStats.length > 0 && originalData && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">클러스터별 통계량</h3>
                    {clusterStats.map((stats, clusterIdx) => (
                        <div key={clusterIdx} className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-md font-semibold text-gray-700">
                                    Cluster {clusterIdx} (n={clusterCounts[clusterIdx] || 0})
                                </h4>
                                <TableDownloadButton
                                    filename={`${baseName}_cluster${clusterIdx}_통계량`}
                                    columns={['특성', '평균', '표준편차', '최소값', '최대값']}
                                    rows={featureColumns
                                        .filter(col => stats[col])
                                        .map(col => ({
                                            '특성': col,
                                            '평균': stats[col].mean,
                                            '표준편차': stats[col].std,
                                            '최소값': stats[col].min,
                                            '최대값': stats[col].max,
                                        }))}
                                />
                            </div>
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
            )}

            {/* 클러스터 간 거리 */}
            {centroidDistances.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">클러스터 간 거리</h3>
                        <TableDownloadButton
                            filename={`${baseName}_클러스터간거리`}
                            columns={['클러스터', ...centroids.map((_, idx) => `Cluster ${idx}`)]}
                            rows={centroidDistances.map((row, idx) => {
                                const r: Record<string, any> = { '클러스터': `Cluster ${idx}` };
                                row.forEach((distance, colIdx) => { r[`Cluster ${colIdx}`] = distance; });
                                return r;
                            })}
                        />
                    </div>
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
            )}

            {/* 데이터 테이블 (클러스터 포함) */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">클러스터링된 데이터</h3>
                    <TableDownloadButton
                        filename={`${baseName}_클러스터링데이터`}
                        columns={clusteredData.columns}
                        rows={clusteredData.rows}
                        title="전체 행 CSV 다운로드"
                    />
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '400px' }}>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                {clusteredData.columns.map(col => (
                                    <th key={col.name} className={`py-2 px-3 font-semibold text-gray-600 ${col.type === 'number' ? 'text-right' : 'text-left'} ${col.name === 'cluster' ? 'bg-blue-50' : ''}`}>
                                        {col.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clusteredData.rows.slice(0, 1000).map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                                    {clusteredData.columns.map(col => (
                                        <td key={col.name} className={`py-1.5 px-3 ${col.type === 'number' ? 'font-mono text-right' : 'text-left'} ${col.name === 'cluster' ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}`}>
                                            {row[col.name] === null || row[col.name] === undefined ? (
                                                <span className="text-gray-400 italic">null</span>
                                            ) : (
                                                String(row[col.name])
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {clusteredData.rows.length > 1000 && (
                        <div className="p-2 text-sm text-gray-500 text-center">
                            표시된 행: 1-1000 / 전체: {clusteredData.rows.length}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// PCA 클러스터링 뷰
const PCAClusteringView: React.FC<{
    output: ClusteringDataOutput;
    trainedModel: TrainedClusteringModelOutput | null;
    originalData: DataPreview | null;
    baseName: string;
}> = ({ output, trainedModel, originalData, baseName }) => {
    const clusteredData = output.clusteredData;
    const explainedVarianceRatio = trainedModel?.explainedVarianceRatio || [];
    const components = trainedModel?.components || [];
    const mean = trainedModel?.mean || [];
    const featureColumns = trainedModel?.featureColumns || [];
    const nComponents = explainedVarianceRatio.length;

    // 재구성 오차 계산
    const reconstructionError = useMemo(() => {
        if (!originalData || components.length === 0 || mean.length === 0) return null;
        return calculateReconstructionError(originalData, clusteredData, components, mean, featureColumns);
    }, [originalData, clusteredData, components, mean, featureColumns]);

    // 총 설명된 분산 비율
    const totalExplainedVariance = useMemo(() => {
        return explainedVarianceRatio.reduce((a, b) => a + b, 0) * 100;
    }, [explainedVarianceRatio]);

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
        if (!clusteredData || !clusteredData.rows || clusteredData.rows.length === 0 || nComponents < 2) return null;

        const width = 600;
        const height = 400;
        const padding = { top: 40, right: 60, bottom: 50, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // PC1과 PC2 값 추출
        const pc1Values = clusteredData.rows.map(row => {
            const val = row['PC1'];
            return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        });
        const pc2Values = clusteredData.rows.map(row => {
            const val = row['PC2'];
            return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        });

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
                    {clusteredData.rows.slice(0, 5000).forEach((row, idx) => {
                        const pc1 = typeof row['PC1'] === 'number' ? row['PC1'] : parseFloat(String(row['PC1'])) || 0;
                        const pc2 = typeof row['PC2'] === 'number' ? row['PC2'] : parseFloat(String(row['PC2'])) || 0;
                        const x = scaleX(pc1);
                        const y = scaleY(pc2);
                        return (
                            <circle
                                key={idx}
                                cx={x}
                                cy={y}
                                r={2}
                                fill="#3b82f6"
                                opacity={0.5}
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
                {clusteredData.rows.length > 5000 && (
                    <div className="text-xs text-gray-500 text-center mt-2">
                        표시된 포인트: 5,000 / 전체: {clusteredData.rows.length.toLocaleString()}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* 적합 수준 통계량 */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">PCA 적합 수준</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">총 설명된 분산</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {totalExplainedVariance.toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            <span className={totalExplainedVariance > 80 ? 'text-green-600' : totalExplainedVariance > 60 ? 'text-yellow-600' : 'text-red-600'}>
                                {totalExplainedVariance > 80 ? '우수' : totalExplainedVariance > 60 ? '보통' : '개선 필요'}
                            </span>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">재구성 오차</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {reconstructionError !== null ? reconstructionError.toFixed(4) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">낮을수록 좋음</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">주성분 수</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {nComponents}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">원본 변수: {featureColumns.length}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">차원 축소율</div>
                        <div className="text-xl font-mono font-semibold text-gray-800">
                            {featureColumns.length > 0 ? ((1 - nComponents / featureColumns.length) * 100).toFixed(1) : '0'}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">축소된 차원 비율</div>
                    </div>
                </div>
            </div>

            {/* 설명된 분산 비율 */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">설명된 분산 비율</h3>
                    <TableDownloadButton
                        filename={`${baseName}_설명된분산비율`}
                        columns={['주성분', '분산비율(%)', '누적분산(%)']}
                        rows={explainedVarianceRatio.map((ratio, idx) => ({
                            '주성분': `PC${idx + 1}`,
                            '분산비율(%)': ratio * 100,
                            '누적분산(%)': explainedVarianceRatio.slice(0, idx + 1).reduce((a, b) => a + b, 0) * 100,
                        }))}
                    />
                </div>
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
            {components.length > 0 && featureColumns.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">주성분 계수 (Loading Matrix)</h3>
                        <TableDownloadButton
                            filename={`${baseName}_주성분계수`}
                            columns={['원본변수', ...Array.from({ length: nComponents }, (_, i) => `PC${i + 1}`)]}
                            rows={featureColumns.map((col, colIdx) => {
                                const r: Record<string, any> = { '원본변수': col };
                                components.forEach((component, compIdx) => { r[`PC${compIdx + 1}`] = component[colIdx]; });
                                return r;
                            })}
                        />
                    </div>
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
            )}

            {/* 변환된 데이터 테이블 */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">변환된 데이터 (주성분 공간)</h3>
                    <TableDownloadButton
                        filename={`${baseName}_변환된데이터`}
                        columns={clusteredData.columns}
                        rows={clusteredData.rows}
                        title="전체 행 CSV 다운로드"
                    />
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '400px' }}>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                {clusteredData.columns.map(col => (
                                    <th key={col.name} className="py-2 px-3 font-semibold text-gray-600 text-right">
                                        {col.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clusteredData.rows.slice(0, 1000).map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                                    {clusteredData.columns.map(col => (
                                        <td key={col.name} className="py-1.5 px-3 font-mono text-right text-gray-700">
                                            {row[col.name] === null || row[col.name] === undefined ? (
                                                <span className="text-gray-400 italic">null</span>
                                            ) : (
                                                typeof row[col.name] === 'number' 
                                                    ? row[col.name].toFixed(4) 
                                                    : String(row[col.name])
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {clusteredData.rows.length > 1000 && (
                        <div className="p-2 text-sm text-gray-500 text-center">
                            표시된 행: 1-1000 / 전체: {clusteredData.rows.length}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ClusteringDataPreviewModal: React.FC<ClusteringDataPreviewModalProps> = ({
    module,
    projectName,
    onClose,
    modules = [],
    connections = []
}) => {
    const output = module.outputData as ClusteringDataOutput;
    
    if (!output) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">오류</h3>
                    <p className="text-gray-600">클러스터링 출력 데이터를 찾을 수 없습니다.</p>
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

    // 학습된 모델 가져오기 (model_in 포트)
    const trainedModel = useMemo(() => {
        const modelConnection = connections.find(
            c => c && c.to && c.to.moduleId === module.id && c.to.portName === 'model_in'
        );
        
        if (modelConnection && modelConnection.from && modelConnection.from.moduleId) {
            const sourceModule = modules.find(m => m && m.id === modelConnection.from.moduleId);
            if (sourceModule?.outputData?.type === 'TrainedClusteringModelOutput') {
                return sourceModule.outputData as TrainedClusteringModelOutput;
            }
        }
        return null;
    }, [module.id, modules, connections]);

    // 원본 입력 데이터 가져오기 (data_in 포트) - 통계량 계산용
    const originalData = useMemo(() => {
        const dataConnection = connections.find(
            c => c && c.to && c.to.moduleId === module.id && c.to.portName === 'data_in'
        );
        
        if (dataConnection && dataConnection.from && dataConnection.from.moduleId) {
            const sourceModule = modules.find(m => m && m.id === dataConnection.from.moduleId);
            if (sourceModule?.outputData) {
                if (sourceModule.outputData.type === 'DataPreview') {
                    return sourceModule.outputData;
                }
                if (sourceModule.outputData.type === 'SplitDataOutput') {
                    const portName = dataConnection?.from?.portName;
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
                        <h2 className="text-xl font-bold text-gray-800">Clustering Data: {module.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            모델 타입: {
                                output.modelType === ModuleType.KMeans ? 'K-Means'
                                : output.modelType === ModuleType.DBSCAN ? 'DBSCAN'
                                : output.modelType === ModuleType.HierarchicalClustering ? '계층적 클러스터링'
                                : 'PCA'
                            }
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
                    {output.modelType === ModuleType.PrincipalComponentAnalysis ? (
                        <PCAClusteringView
                            output={output}
                            trainedModel={trainedModel}
                            originalData={originalData}
                            baseName={module.name}
                        />
                    ) : (
                        // KMeans · DBSCAN · 계층형(transductive) 모두 클러스터 할당 뷰 사용
                        <KMeansClusteringView
                            output={output}
                            trainedModel={trainedModel}
                            originalData={originalData}
                            baseName={module.name}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
