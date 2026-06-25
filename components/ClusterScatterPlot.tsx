import React, { useMemo, useState, useEffect } from 'react';

// 클러스터 색상 팔레트 (최대 12색 순환). 노이즈(-1)는 회색 고정.
const CLUSTER_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
    '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7',
];
const NOISE_COLOR = '#9ca3af';

export interface ScatterPoint {
    x: number;
    y: number;
}

interface ClusterScatterPlotProps {
    points: ScatterPoint[];
    /** points와 1:1 정렬된 클러스터 라벨. -1=노이즈. 생략 시 단색(범례 없음). */
    labels?: number[];
    xLabel: string;
    yLabel: string;
    title?: string;
    width?: number;
    height?: number;
}

const colorForLabel = (label: number | undefined): string => {
    if (label === undefined || label === null) return CLUSTER_COLORS[0];
    if (label < 0) return NOISE_COLOR;
    return CLUSTER_COLORS[label % CLUSTER_COLORS.length];
};

/**
 * 2D 좌표(이미 PCA 등으로 투영됨)를 클러스터 색으로 구분해 그리는 SVG 산점도.
 * 인앱 표시 전용 — 내보낸 Python 코드/재현성과 무관.
 */
export const ClusterScatterPlot: React.FC<ClusterScatterPlotProps> = ({
    points,
    labels,
    xLabel,
    yLabel,
    title = '클러스터 산점도 (2D 투영)',
    width = 600,
    height = 420,
}) => {
    const padding = { top: 24, right: 24, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const { xMin, xRange, yMin, yRange } = useMemo(() => {
        if (!points || points.length === 0) {
            return { xMin: 0, xRange: 1, yMin: 0, yRange: 1 };
        }
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const xmin = Math.min(...xs);
        const xmax = Math.max(...xs);
        const ymin = Math.min(...ys);
        const ymax = Math.max(...ys);
        // 1% 여백
        const xpad = (xmax - xmin) * 0.05 || 1;
        const ypad = (ymax - ymin) * 0.05 || 1;
        return {
            xMin: xmin - xpad,
            xRange: (xmax - xmin) + 2 * xpad || 1,
            yMin: ymin - ypad,
            yRange: (ymax - ymin) + 2 * ypad || 1,
        };
    }, [points]);

    // 범례용 클러스터 집계 (라벨이 있을 때만)
    const legend = useMemo(() => {
        if (!labels || labels.length === 0) return [];
        const counts = new Map<number, number>();
        labels.forEach(l => counts.set(l, (counts.get(l) || 0) + 1));
        return Array.from(counts.keys())
            .sort((a, b) => a - b)
            .map(label => ({ label, count: counts.get(label) || 0, color: colorForLabel(label) }));
    }, [labels]);

    if (!points || points.length === 0) return null;

    const scaleX = (v: number) => padding.left + ((v - xMin) / xRange) * chartWidth;
    const scaleY = (v: number) => padding.top + chartHeight - ((v - yMin) / yRange) * chartHeight;

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <h4 className="text-md font-semibold text-gray-700 mb-3">{title}</h4>
            <svg width={width} height={height} className="border border-gray-300 rounded max-w-full">
                {/* 배경 그리드 */}
                {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                    const x = padding.left + ratio * chartWidth;
                    const y = padding.top + ratio * chartHeight;
                    return (
                        <g key={ratio}>
                            <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="#e5e7eb" strokeWidth={1} />
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        </g>
                    );
                })}

                {/* 데이터 포인트 */}
                {points.map((p, idx) => (
                    <circle
                        key={idx}
                        cx={scaleX(p.x)}
                        cy={scaleY(p.y)}
                        r={2.5}
                        fill={colorForLabel(labels ? labels[idx] : undefined)}
                        opacity={0.6}
                    />
                ))}

                {/* X축 레이블 */}
                <text x={padding.left + chartWidth / 2} y={height - 12} textAnchor="middle" fontSize="12" fill="#4b5563" fontWeight="600">
                    {xLabel}
                </text>

                {/* Y축 레이블 */}
                <text
                    x={16}
                    y={padding.top + chartHeight / 2}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#4b5563"
                    fontWeight="600"
                    transform={`rotate(-90 16 ${padding.top + chartHeight / 2})`}
                >
                    {yLabel}
                </text>
            </svg>

            {/* 범례 */}
            {legend.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                    {legend.map(({ label, count, color }) => (
                        <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                            <span>{label < 0 ? '노이즈' : `Cluster ${label}`} ({count.toLocaleString()})</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * 후보 컬럼 중 "값이 실제로 수치형"인 것만 고른다.
 * 컬럼 메타의 type 라벨('number')에 의존하지 않고 표본 값을 파싱해 판정하므로,
 * CSV 파싱 등으로 type이 문자열로 잘못 추론된 데이터에서도 산점도가 동작한다.
 */
export const pickNumericFeatures = (
    rows: Array<Record<string, any>> | null | undefined,
    candidates: string[],
): string[] => {
    if (!rows || rows.length === 0) return [];
    const sample = rows.slice(0, 30);
    return candidates.filter(name => {
        if (name === 'cluster') return false;
        let ok = 0, seen = 0;
        for (const r of sample) {
            const v = r[name];
            if (v === null || v === undefined || v === '') continue;
            seen++;
            const n = typeof v === 'number' ? v : parseFloat(String(v));
            if (Number.isFinite(n)) ok++;
        }
        return seen > 0 && ok / seen >= 0.8;
    });
};

interface ProjectionState {
    points: ScatterPoint[];
    labels: number[] | null;
    xLabel: string;
    yLabel: string;
}

/**
 * 피처 행렬을 Pyodide로 2D 투영(PCA 등)하는 공유 훅. 인앱 표시 전용.
 * rows를 결정적으로 최대 5000개로 샘플링한 뒤 라벨과 1:1 정렬해 좌표를 계산한다.
 */
export const useCluster2DProjection = (
    rows: Array<Record<string, any>> | null | undefined,
    numericFeatures: string[],
    labels: number[] | null | undefined,
): { projection: ProjectionState | null; loading: boolean; error: string | null } => {
    const [projection, setProjection] = useState<ProjectionState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const featKey = numericFeatures.join('|');
    const rowCount = rows ? rows.length : 0;
    const labelLen = labels && labels.length > 0 ? labels.length : 0;

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setProjection(null);
            setError(null);
            if (!rows || rows.length === 0 || numericFeatures.length < 1) return;

            const MAX = 5000;
            const step = rows.length > MAX ? Math.ceil(rows.length / MAX) : 1;
            const toNum = (v: any) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0);
            const hasLabels = !!(labels && labels.length > 0);
            const X: number[][] = [];
            const sampledLabels: number[] = [];
            for (let i = 0; i < rows.length; i += step) {
                X.push(numericFeatures.map(c => toNum(rows[i][c])));
                if (hasLabels) sampledLabels.push(labels![i]);
            }

            setLoading(true);
            try {
                const { computeCluster2DProjectionPython } = await import('../utils/pyodideRunner');
                const res = await computeCluster2DProjectionPython(X, numericFeatures);
                if (cancelled) return;
                const points = res.coords.map(c => ({ x: c[0] ?? 0, y: c[1] ?? 0 }));
                setProjection({ points, labels: hasLabels ? sampledLabels : null, xLabel: res.xLabel, yLabel: res.yLabel });
            } catch (e: any) {
                if (!cancelled) setError(e?.message || String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowCount, featKey, labelLen]);

    return { projection, loading, error };
};
