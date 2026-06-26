import React, { useMemo, useState } from 'react';
import { CanvasModule, TrainedModelOutput, EvaluationOutput } from '../types';
import { XCircleIcon } from './icons';
import { TableDownloadButton } from './TableDownloadButton';

interface ModelComparisonModalProps {
    modules: CanvasModule[];
    onClose: () => void;
}

interface ModelRow {
    name: string;
    modelType: string;
    purpose: string;
    metrics: Record<string, number | string>;
    source: 'trained' | 'evaluation';
}

const METRIC_LABELS: Record<string, string> = {
    'R²': 'R²',
    'R2': 'R²',
    'R-squared': 'R²',
    'MSE': 'MSE',
    'RMSE': 'RMSE',
    'MAE': 'MAE',
    'Accuracy': 'Accuracy',
    'Precision': 'Precision',
    'Recall': 'Recall',
    'F1-Score': 'F1-Score',
    'AUC-ROC': 'AUC-ROC',
    'AIC': 'AIC',
    'BIC': 'BIC',
    'Log-Likelihood': 'Log-Likelihood',
};

const HIGHER_IS_BETTER = new Set(['R²', 'R2', 'R-squared', 'Accuracy', 'Precision', 'Recall', 'F1-Score', 'AUC-ROC']);
const LOWER_IS_BETTER = new Set(['MSE', 'RMSE', 'MAE', 'AIC', 'BIC']);

function isBetter(key: string, a: number, b: number): boolean {
    if (HIGHER_IS_BETTER.has(key)) return a > b;
    if (LOWER_IS_BETTER.has(key)) return a < b;
    return false;
}

const MetricBar: React.FC<{ value: number; max: number; isHigherBetter: boolean }> = ({ value, max, isHigherBetter }) => {
    const pct = max > 0 ? Math.min(Math.abs(value / max) * 100, 100) : 0;
    const color = isHigherBetter ? 'bg-blue-500' : 'bg-orange-400';
    return (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5">
            <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
    );
};

export const ModelComparisonModal: React.FC<ModelComparisonModalProps> = ({ modules, onClose }) => {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const models: ModelRow[] = useMemo(() => {
        const rows: ModelRow[] = [];
        for (const m of modules) {
            if (!m.outputData) continue;

            if (m.outputData.type === 'TrainedModelOutput') {
                const out = m.outputData as TrainedModelOutput;
                rows.push({
                    name: m.name,
                    modelType: String(out.modelType),
                    purpose: out.modelPurpose ?? (out.metrics['Accuracy'] !== undefined ? 'classification' : 'regression'),
                    metrics: out.metrics,
                    source: 'trained',
                });
            } else if (m.outputData.type === 'EvaluationOutput') {
                const out = m.outputData as EvaluationOutput;
                rows.push({
                    name: m.name,
                    modelType: out.modelType,
                    purpose: out.modelType,
                    metrics: out.metrics,
                    source: 'evaluation',
                });
            }
        }
        return rows;
    }, [modules]);

    // 모든 모델에서 나타나는 지표 수집
    const allMetricKeys = useMemo(() => {
        const keys = new Set<string>();
        models.forEach((m) => Object.keys(m.metrics).forEach((k) => keys.add(k)));
        return Array.from(keys);
    }, [models]);

    // 각 지표의 min/max (bar 렌더링용)
    const metricRange = useMemo(() => {
        const range: Record<string, { min: number; max: number }> = {};
        allMetricKeys.forEach((k) => {
            const vals = models.map((m) => m.metrics[k]).filter((v) => typeof v === 'number') as number[];
            if (vals.length > 0) {
                range[k] = { min: Math.min(...vals), max: Math.max(...vals) };
            }
        });
        return range;
    }, [allMetricKeys, models]);

    const sortedModels = useMemo(() => {
        if (!sortKey) return models;
        return [...models].sort((a, b) => {
            const av = typeof a.metrics[sortKey] === 'number' ? (a.metrics[sortKey] as number) : NaN;
            const bv = typeof b.metrics[sortKey] === 'number' ? (b.metrics[sortKey] as number) : NaN;
            if (isNaN(av) && isNaN(bv)) return 0;
            if (isNaN(av)) return 1;
            if (isNaN(bv)) return -1;
            return sortDir === 'desc' ? bv - av : av - bv;
        });
    }, [models, sortKey, sortDir]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortKey(key);
            setSortDir(HIGHER_IS_BETTER.has(key) ? 'desc' : 'asc');
        }
    };

    // 각 지표에서 베스트 값 계산
    const bestValues = useMemo(() => {
        const best: Record<string, number> = {};
        allMetricKeys.forEach((k) => {
            const vals = models.map((m) => m.metrics[k]).filter((v) => typeof v === 'number') as number[];
            if (vals.length === 0) return;
            if (HIGHER_IS_BETTER.has(k)) best[k] = Math.max(...vals);
            else if (LOWER_IS_BETTER.has(k)) best[k] = Math.min(...vals);
        });
        return best;
    }, [allMetricKeys, models]);

    if (models.length === 0) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md text-center" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3">모델 비교</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                        실행 완료된 TrainModel 또는 EvaluateModel 모듈이 없습니다.
                        <br />먼저 모듈을 실행한 후 다시 시도해주세요.
                    </p>
                    <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">닫기</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">모델 비교</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {models.length}개 모델 · 지표 헤더를 클릭하면 정렬됩니다 · 파란 배경 = 최우수값
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <TableDownloadButton
                            filename="모델비교"
                            columns={['모듈 이름', '소스', '유형', ...allMetricKeys]}
                            rows={sortedModels.map(model => {
                                const r: Record<string, any> = {
                                    '모듈 이름': model.name,
                                    '소스': model.source === 'evaluation' ? 'EvaluateModel' : 'TrainModel',
                                    '유형': model.purpose === 'classification' ? '분류' : '회귀',
                                };
                                allMetricKeys.forEach(k => {
                                    const v = model.metrics[k];
                                    r[k] = v === undefined || v === null ? '' : v;
                                });
                                return r;
                            })}
                            title="모델 비교표 CSV 다운로드"
                        />
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* 테이블 */}
                <div className="overflow-auto flex-1 p-4">
                    <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
                            <tr>
                                <th className="text-left p-3 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-600 min-w-[140px]">
                                    모듈 이름
                                </th>
                                <th className="text-left p-3 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-600 min-w-[100px]">
                                    유형
                                </th>
                                {allMetricKeys.map((key) => (
                                    <th
                                        key={key}
                                        className="text-center p-3 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-600 min-w-[100px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                                        onClick={() => handleSort(key)}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            {METRIC_LABELS[key] ?? key}
                                            {sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ' ↕'}
                                        </div>
                                        <div className="text-xs font-normal text-gray-400 dark:text-gray-500">
                                            {HIGHER_IS_BETTER.has(key) ? '높을수록 좋음' : LOWER_IS_BETTER.has(key) ? '낮을수록 좋음' : ''}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedModels.map((model, idx) => (
                                <tr
                                    key={idx}
                                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                >
                                    <td className="p-3 font-medium text-gray-800 dark:text-gray-200">
                                        {model.name}
                                        <div className="text-xs text-gray-400 dark:text-gray-500 font-normal mt-0.5">
                                            {model.source === 'evaluation' ? 'EvaluateModel' : 'TrainModel'}
                                        </div>
                                    </td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            model.purpose === 'classification'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                        }`}>
                                            {model.purpose === 'classification' ? '분류' : '회귀'}
                                        </span>
                                    </td>
                                    {allMetricKeys.map((key) => {
                                        const val = model.metrics[key];
                                        const numVal = typeof val === 'number' ? val : NaN;
                                        const isBest = !isNaN(numVal) && bestValues[key] === numVal;
                                        const range = metricRange[key];
                                        const higherBetter = HIGHER_IS_BETTER.has(key);
                                        return (
                                            <td
                                                key={key}
                                                className={`p-3 text-center ${isBest ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            >
                                                {val === undefined || val === null ? (
                                                    <span className="text-gray-300 dark:text-gray-600">—</span>
                                                ) : (
                                                    <div>
                                                        <span className={`font-mono font-semibold text-sm ${isBest ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                            {typeof val === 'number' ? val.toFixed(4) : val}
                                                            {isBest && <span className="ml-1 text-xs">★</span>}
                                                        </span>
                                                        {!isNaN(numVal) && range && (
                                                            <MetricBar
                                                                value={numVal}
                                                                max={range.max}
                                                                isHigherBetter={higherBetter}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 범례 */}
                <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex gap-6 text-xs text-gray-500 dark:text-gray-400">
                    <span>★ 해당 지표 최우수값</span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-blue-500"></span> 높을수록 좋은 지표
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-orange-400"></span> 낮을수록 좋은 지표
                    </span>
                </div>
            </div>
        </div>
    );
};
