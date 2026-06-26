import React, { useState } from 'react';
import { CanvasModule, EvaluateStatOutput } from '../types';
import { XCircleIcon } from './icons';
import { explainModuleResult } from '../lib/aiHelpers';
import { ApiKeyMissingError } from '../lib/aiClient';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';

interface EvaluateStatPreviewModalProps {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
}

export const EvaluateStatPreviewModal: React.FC<EvaluateStatPreviewModalProps> = ({
  module,
  projectName,
  onClose,
}) => {
  // ✨ AI 해설
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiError, setAiError] = useState('');

  const output = module.outputData as EvaluateStatOutput;
  if (!output || output.type !== 'EvaluateStatOutput') return null;

  const { modelType, metrics, residuals, deviance, pearsonChi2, dispersion, aic, bic, logLikelihood } = output;

  // ✨ AI 해설: 통계 평가 지표를 요약하여 explainModuleResult에 전달
  const handleExplain = async () => {
    setIsExplaining(true);
    setAiError('');
    setExplanation('');
    try {
      const metricLines = Object.entries(metrics)
        .map(([k, v]) => `- ${k}: ${typeof v === 'number' ? v.toFixed(6) : String(v)}`)
        .join('\n');

      const extra: string[] = [];
      if (deviance !== undefined) extra.push(`- Deviance: ${deviance.toFixed(6)}`);
      if (pearsonChi2 !== undefined) extra.push(`- Pearson Chi²: ${pearsonChi2.toFixed(6)}`);
      if (dispersion !== undefined) extra.push(`- Dispersion(φ): ${dispersion.toFixed(6)}`);
      if (aic !== undefined) extra.push(`- AIC: ${aic.toFixed(6)}`);
      if (bic !== undefined) extra.push(`- BIC: ${bic.toFixed(6)}`);
      if (logLikelihood !== undefined) extra.push(`- Log-Likelihood: ${logLikelihood.toFixed(6)}`);

      const summary = `모델 유형: ${modelType}\n프로젝트: ${projectName}\n\n[지표]\n${metricLines}`
        + (extra.length ? `\n\n[추가 통계량]\n${extra.join('\n')}` : '');

      const result = await explainModuleResult('EvaluateStat(통계 모델 평가)', summary);
      setExplanation(result);
    } catch (err) {
      if (err instanceof ApiKeyMissingError) {
        setAiError('Claude API 키가 필요합니다. 설정(⚙)에서 키를 입력한 뒤 다시 시도하세요.');
      } else {
        setAiError(`AI 해설 생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Evaluate Stat - {module.name}
          </h2>
          <div className="flex items-center gap-2">
            <AdvancedOnly>
            <button
              onClick={handleExplain}
              disabled={isExplaining}
              className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors ${ADVANCED_BTN_DIM}`}
              title="AI가 이 평가 결과를 해설합니다"
            >
              <AdvancedLockBadge />
              <span aria-hidden>✨</span>
              <span>{isExplaining ? 'AI 분석 중…' : 'AI 해설'}</span>
            </button>
            </AdvancedOnly>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {/* ✨ AI 해설 패널 */}
          {(isExplaining || explanation || aiError) && (
            <div className="mb-6 bg-white text-gray-800 rounded-lg p-4 border border-blue-300">
              <h3 className="text-md font-bold text-blue-700 mb-2 flex items-center gap-2">
                <span aria-hidden>✨</span> AI 해설
              </h3>
              {isExplaining && (
                <p className="text-sm text-gray-500 animate-pulse">AI가 평가 결과를 해설하고 있습니다…</p>
              )}
              {aiError && <p className="text-sm text-red-600">{aiError}</p>}
              {explanation && <MarkdownRenderer text={explanation} />}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Model Type: {modelType}</h3>
          </div>

          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Metrics</h3>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                    <span className="text-gray-900 dark:text-white font-mono">
                      {typeof value === 'number' ? value.toFixed(6) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(deviance !== undefined || pearsonChi2 !== undefined || dispersion !== undefined || 
            aic !== undefined || bic !== undefined || logLikelihood !== undefined) && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Additional Statistics</h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  {deviance !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Deviance:</span>
                      <span className="text-gray-900 dark:text-white font-mono">{deviance.toFixed(6)}</span>
                    </div>
                  )}
                  {pearsonChi2 !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Pearson Chi²:</span>
                      <span className="text-gray-900 dark:text-white font-mono">{pearsonChi2.toFixed(6)}</span>
                    </div>
                  )}
                  {dispersion !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Dispersion (φ):</span>
                      <span className="text-gray-900 dark:text-white font-mono">{dispersion.toFixed(6)}</span>
                    </div>
                  )}
                  {aic !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">AIC:</span>
                      <span className="text-gray-900 dark:text-white font-mono">{aic.toFixed(6)}</span>
                    </div>
                  )}
                  {bic !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">BIC:</span>
                      <span className="text-gray-900 dark:text-white font-mono">{bic.toFixed(6)}</span>
                    </div>
                  )}
                  {logLikelihood !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Log-Likelihood:</span>
                      <span className="text-gray-900 dark:text-white font-mono">{logLikelihood.toFixed(6)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {residuals && residuals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                Residuals (First 100)
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                  {residuals.slice(0, 100).map((res, idx) => (
                    <div key={idx} className="py-1">
                      {res.toFixed(6)}
                    </div>
                  ))}
                  {residuals.length > 100 && (
                    <div className="text-gray-500 dark:text-gray-500 mt-2">
                      ... and {residuals.length - 100} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

