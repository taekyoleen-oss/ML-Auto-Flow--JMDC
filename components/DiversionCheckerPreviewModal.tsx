import React, { useState } from "react";
import { CanvasModule, DiversionCheckerOutput } from "../types";
import { XCircleIcon, SparklesIcon } from "./icons";
import { generateClaudeText } from '../lib/aiClient';
import { MarkdownRenderer } from "./MarkdownRenderer";
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';

interface DiversionCheckerPreviewModalProps {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
}

export const DiversionCheckerPreviewModal: React.FC<
  DiversionCheckerPreviewModalProps
> = ({ module, projectName, onClose }) => {
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);

  const output = module.outputData as DiversionCheckerOutput;
  if (!output || output.type !== "DiversionCheckerOutput") return null;

  const {
    phi,
    recommendation,
    poissonAic,
    negativeBinomialAic,
    aicComparison,
    cameronTrivediCoef,
    cameronTrivediPvalue,
    cameronTrivediConclusion,
    methodsUsed,
    results,
  } = output;

  const handleInterpret = async () => {
    setIsInterpreting(true);
    setAiInterpretation(null);
    try {
      const prompt = `
You are a statistician writing a brief report for a non-technical audience. Please use Korean and simple Markdown.

### 과대산포 검사 분석 보고서

**프로젝트:** ${projectName}
**모듈:** ${module.name}

**분석 방법:**
${methodsUsed.map((m) => `- ${m}`).join("\n")}

**주요 결과:**
- Dispersion φ (phi): ${phi.toFixed(6)}
- 추천 모델: ${recommendation}
- Poisson AIC: ${poissonAic !== null ? poissonAic.toFixed(6) : "N/A"}
- Negative Binomial AIC: ${
        negativeBinomialAic !== null ? negativeBinomialAic.toFixed(6) : "N/A"
      }
${aicComparison ? `- AIC 비교: ${aicComparison}` : ""}
- Cameron–Trivedi test 계수: ${cameronTrivediCoef.toFixed(6)}
- Cameron–Trivedi test p-value: ${cameronTrivediPvalue.toFixed(6)}
- Cameron–Trivedi test 결론: ${cameronTrivediConclusion}

---

**1. Dispersion φ 해석:**
- φ 값이 ${phi.toFixed(6)}인데, 이것이 의미하는 바는 무엇입니까?
- 이 값이 1.2 미만, 1.2-2 사이, 또는 2 이상인지에 따라 어떤 모델이 추천되었는지 설명해 주세요.

**2. 모델 추천 근거:**
- 왜 "${recommendation}" 모델이 추천되었는지 설명해 주세요.
- ${
        aicComparison
          ? `AIC 비교 결과(${aicComparison})가 추천에 어떤 영향을 미쳤는지 설명해 주세요.`
          : "AIC 비교 결과를 바탕으로 설명해 주세요."
      }

**3. Cameron–Trivedi Test 해석:**
- Cameron–Trivedi test의 p-value가 ${cameronTrivediPvalue.toFixed(
        6
      )}인데, 이것이 의미하는 바는 무엇입니까?
- ${cameronTrivediConclusion}라는 결론이 나온 이유를 설명해 주세요.

**4. 최종 권장사항:**
- 이 분석 결과를 바탕으로 사용자에게 어떤 모델을 사용하는 것이 좋을지 권장해 주세요.
- 선택한 모델을 사용할 때 주의해야 할 사항이 있다면 알려주세요.

**지시:** 각 항목을 한두 문장으로 매우 간결하게 작성하십시오.
`;
      const text = await generateClaudeText({ prompt });

      setAiInterpretation(text);
    } catch (error) {
      console.error("AI interpretation failed:", error);
      setAiInterpretation(
        "결과를 해석하는 동안 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setIsInterpreting(false);
    }
  };

  const getRecommendationColor = () => {
    if (recommendation === "Poisson") return "text-green-400";
    if (recommendation === "QuasiPoisson") return "text-yellow-400";
    return "text-orange-400";
  };

  const getPhiInterpretation = () => {
    if (phi < 1.2) return "과대산포가 거의 없음 (φ < 1.2)";
    if (phi < 2) return "약간의 과대산포 (1.2 ≤ φ < 2)";
    return "심각한 과대산포 (φ ≥ 2)";
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800 font-sans">
            Diversion Checker Results: {module.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="flex-grow p-4 overflow-auto text-sm">
          <div className="flex justify-end mb-4 font-sans">
            <AdvancedOnly>
            <button
              onClick={handleInterpret}
              disabled={isInterpreting}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-wait transition-colors ${ADVANCED_BTN_DIM}`}
            >
              <AdvancedLockBadge />
              <SparklesIcon className="w-5 h-5" />
              {isInterpreting ? "분석 중..." : "AI로 결과 해석하기"}
            </button>
            </AdvancedOnly>
          </div>

          {/* 통계량 섹션 */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800 font-sans">
              통계 분석 결과 및 해석
            </h3>

            {/* Dispersion φ */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-2">
                Dispersion φ (phi)
              </h4>
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {phi.toFixed(6)}
              </div>
              <div className="text-sm text-gray-600">
                {getPhiInterpretation()}
              </div>
            </div>

            {/* 모델 추천 */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-2">추천 모델</h4>
              <div
                className={`text-2xl font-bold ${getRecommendationColor()} mb-1`}
              >
                {recommendation}
              </div>
              <div className="text-sm text-gray-600">
                {recommendation === "Poisson" &&
                  "과대산포가 거의 없으므로 포아송 모델이 적합합니다."}
                {recommendation === "QuasiPoisson" &&
                  "약간의 과대산포가 있으므로 Quasi-Poisson 모델을 사용합니다."}
                {recommendation === "NegativeBinomial" &&
                  "심각한 과대산포가 있으므로 음이항 모델을 사용합니다."}
              </div>
            </div>

            {/* AIC 비교 */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-2">
                AIC 비교 (보조 기준)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Poisson AIC:</span>
                  <span className="font-mono">
                    {poissonAic !== null ? poissonAic.toFixed(6) : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Negative Binomial AIC:</span>
                  <span className="font-mono">
                    {negativeBinomialAic !== null
                      ? negativeBinomialAic.toFixed(6)
                      : "N/A"}
                  </span>
                </div>
                {aicComparison && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <span className="text-gray-600">비교 결과:</span>
                    <div className="text-sm text-gray-800 mt-1">
                      {aicComparison}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cameron–Trivedi Test */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-2">
                Cameron–Trivedi Test (최종 확인)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Test 통계량 (상수항 계수):
                  </span>
                  <span className="font-mono">
                    {cameronTrivediCoef.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">p-value:</span>
                  <span
                    className={`font-mono ${
                      cameronTrivediPvalue < 0.05
                        ? "text-red-600 font-bold"
                        : "text-gray-800"
                    }`}
                  >
                    {cameronTrivediPvalue.toFixed(6)}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <span className="text-gray-600">결론:</span>
                  <div
                    className={`text-sm mt-1 ${
                      cameronTrivediPvalue < 0.05
                        ? "text-red-600 font-semibold"
                        : "text-gray-800"
                    }`}
                  >
                    {cameronTrivediConclusion}
                  </div>
                </div>
              </div>
            </div>

            {/* 사용된 방법 */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-2">
                사용된 분석 방법
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {methodsUsed.map((method, index) => (
                  <li key={index}>{method}</li>
                ))}
              </ul>
            </div>

            {/* 해석 섹션 */}
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-3">결과 해석</h4>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <h5 className="font-semibold text-gray-800 mb-1">
                    1. Dispersion φ (phi) 해석
                  </h5>
                  <p className="text-gray-700">
                    Dispersion φ 값이 <strong>{phi.toFixed(6)}</strong>로
                    계산되었습니다.{" "}
                    {phi < 1.2
                      ? "이 값은 1.2 미만이므로 과대산포가 거의 없음을 의미합니다. 포아송 모델의 기본 가정(평균 = 분산)이 충족됩니다."
                      : phi < 2
                      ? "이 값은 1.2 이상 2 미만이므로 약간의 과대산포가 존재함을 의미합니다. Quasi-Poisson 모델을 사용하여 분산을 조정해야 합니다."
                      : "이 값은 2 이상이므로 심각한 과대산포가 존재함을 의미합니다. 음이항 모델을 사용하여 과대산포를 명시적으로 모델링해야 합니다."}
                  </p>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-800 mb-1">
                    2. 모델 추천 근거
                  </h5>
                  <p className="text-gray-700">
                    <strong>{recommendation}</strong> 모델이 추천되었습니다.{" "}
                    {recommendation === "Poisson"
                      ? "이는 데이터에 과대산포가 거의 없어 포아송 모델의 기본 가정이 충족되기 때문입니다."
                      : recommendation === "QuasiPoisson"
                      ? "이는 약간의 과대산포가 있어 분산을 조정할 필요가 있지만, 음이항 모델까지는 필요하지 않기 때문입니다."
                      : "이는 심각한 과대산포가 있어 음이항 모델의 추가 분산 파라미터가 필요하기 때문입니다."}
                    {aicComparison && (
                      <>
                        {" "}
                        또한 AIC 비교 결과,{" "}
                        {aicComparison.includes("Negative Binomial")
                          ? "Negative Binomial 모델이 더 낮은 AIC를 보여 더 나은 적합도를 나타냅니다."
                          : "Poisson 모델이 더 낮은 AIC를 보여 더 나은 적합도를 나타냅니다."}
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-800 mb-1">
                    3. Cameron–Trivedi Test 해석
                  </h5>
                  <p className="text-gray-700">
                    Cameron–Trivedi test의 p-value가{" "}
                    <strong>{cameronTrivediPvalue.toFixed(6)}</strong>입니다.{" "}
                    {cameronTrivediPvalue < 0.05
                      ? "p-value가 0.05 미만이므로 과대산포가 통계적으로 유의하게 존재함을 의미합니다. 이는 추천된 모델 선택이 적절함을 뒷받침합니다."
                      : "p-value가 0.05 이상이므로 과대산포가 통계적으로 유의하지 않습니다. 그러나 φ 값과 AIC 비교를 종합적으로 고려하여 모델을 선택하는 것이 좋습니다."}
                  </p>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-800 mb-1">
                    4. 최종 권장사항
                  </h5>
                  <p className="text-gray-700">
                    {recommendation === "Poisson"
                      ? "Poisson 회귀 모델을 사용하시기 바랍니다. 이 모델은 과대산포가 없는 카운트 데이터에 가장 적합합니다."
                      : recommendation === "QuasiPoisson"
                      ? "Quasi-Poisson 모델을 사용하시기 바랍니다. Stat Models 모듈에서 'QuasiPoisson' 옵션을 선택하여 사용할 수 있습니다."
                      : "Negative Binomial 회귀 모델을 사용하시기 바랍니다. 이 모델은 과대산포를 명시적으로 모델링하여 더 정확한 추정을 제공합니다."}{" "}
                    모델을 선택한 후에는 Result Model 모듈을 사용하여 상세한
                    통계 분석을 수행할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI 해석 */}
          {aiInterpretation && (
            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="text-lg font-bold mb-3 text-purple-800 font-sans">
                AI 해석
              </h3>
              <div className="prose prose-sm max-w-none">
                <MarkdownRenderer text={aiInterpretation} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
