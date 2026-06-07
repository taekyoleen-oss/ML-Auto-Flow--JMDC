import React, { useState } from 'react';
import { CanvasModule, XoLPriceOutput } from '../types';
import { XCircleIcon, SparklesIcon } from './icons';
import { GoogleGenAI } from "@google/genai";
import { getGeminiClient } from '../lib/aiClient';
import { MarkdownRenderer } from './MarkdownRenderer';

interface XoLPricePreviewModalProps {
    module: CanvasModule;
    onClose: () => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export const XoLPricePreviewModal: React.FC<XoLPricePreviewModalProps> = ({ module, onClose }) => {
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);

    const output = module.outputData as XoLPriceOutput;
    if (!output || output.type !== 'XoLPriceOutput') return null;

    const { retention, limit, expectedLayerLoss, rateOnLinePct, premium } = output;

    const handleInterpret = async () => {
        setIsInterpreting(true);
        setAiInterpretation(null);
        try {
            const ai = getGeminiClient();
            const prompt = `
You are a reinsurance expert writing a brief pricing summary for a client. Use Korean and simple Markdown.

### XoL 재보험료 산출 요약

**계약 구조:** ${formatCurrency(limit)} xs ${formatCurrency(retention)}
**최종 보험료:** ${formatCurrency(premium)}

---

*   **보장 내용:** 이 계약이 보장하는 손실 구간을 한 문장으로 설명해 주십시오.
*   **주요 지표:** '예상 손실액'(${formatCurrency(expectedLayerLoss)})과 'Rate on Line'(${rateOnLinePct.toFixed(2)}%)의 의미를 각각 한 문장으로 요약해 주십시오.
*   **최종 비용:** 최종 보험료가 무엇을 의미하는지 간략히 설명해 주십시오.

**지시:** 각 항목을 매우 간결하게 작성하십시오.
`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setAiInterpretation(response.text);
        } catch (error) {
            console.error("AI interpretation failed:", error);
            setAiInterpretation("결과를 해석하는 동안 오류가 발생했습니다.");
        } finally {
            setIsInterpreting(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                     <h2 className="text-xl font-bold text-gray-800">XoL Pricing Results: {module.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="flex-grow p-6 overflow-auto">
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={handleInterpret}
                            disabled={isInterpreting}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-wait transition-colors"
                        >
                            <SparklesIcon className="w-5 h-5" />
                            {isInterpreting ? '분석 중...' : 'AI로 결과 해석하기'}
                        </button>
                    </div>

                    {isInterpreting && <div className="text-center p-4 text-gray-600">AI가 가격 책정 결과를 분석하고 있습니다...</div>}
                    {aiInterpretation && (
                         <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-6">
                            <h3 className="text-lg font-bold text-purple-800 mb-2 font-sans flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5"/>
                                AI 분석 요약
                            </h3>
                            <MarkdownRenderer text={aiInterpretation} />
                        </div>
                    )}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                            Layer: {formatCurrency(limit)} xs {formatCurrency(retention)}
                        </h3>
                        <div className="space-y-3 text-base">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Retention (Deductible):</span>
                                <span className="font-mono text-gray-800 font-medium">{formatCurrency(retention)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Limit (Coverage):</span>
                                <span className="font-mono text-gray-800 font-medium">{formatCurrency(limit)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Expected Layer Loss (Technical Premium):</span>
                                <span className="font-mono text-gray-800 font-medium">{formatCurrency(expectedLayerLoss)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Rate on Line (RoL):</span>
                                <span className="font-mono text-gray-800 font-medium">{rateOnLinePct.toFixed(2)}%</span>
                            </div>
                             <div className="flex justify-between items-center py-3 mt-2 bg-blue-50 rounded-md px-3">
                                <span className="font-bold text-blue-800">Final Quoted Premium:</span>
                                <span className="font-mono text-blue-800 font-bold text-lg">{formatCurrency(premium)}</span>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};