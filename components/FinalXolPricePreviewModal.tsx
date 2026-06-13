import React, { useState } from 'react';
import { CanvasModule, FinalXolPriceOutput } from '../types';
import { XCircleIcon, SparklesIcon } from './icons';
import { GoogleGenAI } from "@google/genai";
import { getGeminiClient } from '../lib/aiClient';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';

interface FinalXolPricePreviewModalProps {
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

export const FinalXolPricePreviewModal: React.FC<FinalXolPricePreviewModalProps> = ({ module, onClose }) => {
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);
    
    const output = module.outputData as FinalXolPriceOutput;
    if (!output || output.type !== 'FinalXolPriceOutput') return null;

    const { expectedLoss, stdDev, volatilityMargin, purePremium, expenseLoading, finalPremium } = output;

    const handleInterpret = async () => {
        setIsInterpreting(true);
        setAiInterpretation(null);
        try {
            const ai = getGeminiClient();
            const prompt = `
You are a senior actuary creating a concise premium breakdown report. Use Korean and simple Markdown.

### 재보험료 구성 요소 요약

*   **예상 손실액 (${formatCurrency(expectedLoss)}):** 보험료 산정의 기초가 되는 평균적인 손실 예상치입니다.
*   **변동성 마진 (${formatCurrency(volatilityMargin)}):** 예상치 못한 손실 변동의 위험을 대비하기 위한 추가 금액입니다.
*   **순보험료 (${formatCurrency(purePremium)}):** 예상 손실액과 변동성 마진을 합한 금액입니다.
*   **사업비 및 이익 (${formatCurrency(expenseLoading)}):** 회사의 운영 비용과 이익을 포함하는 금액입니다.
*   **최종 보험료 (${formatCurrency(finalPremium)}):** 모든 요소를 합산한 최종 고객 부담액입니다.

**지시:** 위의 형식과 같이 각 항목의 역할을 한 문장으로 요약하여 보고서를 완성해 주십시오. 이미 제공된 텍스트를 기반으로 간결하게 다듬어주세요.
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
                className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                     <h2 className="text-xl font-bold text-gray-800">XoL Contract Pricing Details: {module.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="flex-grow p-6 overflow-auto">
                     <div className="flex justify-end mb-4">
                        <AdvancedOnly>
                        <button
                            onClick={handleInterpret}
                            disabled={isInterpreting}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-wait transition-colors ${ADVANCED_BTN_DIM}`}
                        >
                            <AdvancedLockBadge />
                            <SparklesIcon className="w-5 h-5" />
                            {isInterpreting ? '분석 중...' : 'AI로 결과 해석하기'}
                        </button>
                        </AdvancedOnly>
                    </div>

                    {isInterpreting && <div className="text-center p-4 text-gray-600">AI가 프리미엄 구성요소를 분석하고 있습니다...</div>}
                    {aiInterpretation && (
                         <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-6">
                            <h3 className="text-lg font-bold text-purple-800 mb-2 font-sans flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5"/>
                                AI 분석 요약
                            </h3>
                            <MarkdownRenderer text={aiInterpretation} />
                        </div>
                    )}

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                            Premium Calculation Breakdown
                        </h3>
                        <div className="space-y-4 text-base">
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600">Avg. Yearly Ceded Loss (Expected Loss):</span>
                                <span className="font-mono text-gray-800 font-medium">{formatCurrency(expectedLoss)}</span>
                            </div>
                             <div className="flex justify-between items-center py-2 border-t">
                                <span className="text-gray-600">Volatility (Std Dev of Yearly Loss):</span>
                                <span className="font-mono text-gray-800 font-medium">{formatCurrency(stdDev)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600">Volatility Margin:</span>
                                <span className="font-mono text-gray-800 font-medium">{formatCurrency(volatilityMargin)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-t font-semibold">
                                <span className="text-gray-700">Pure Premium (Loss + Volatility):</span>
                                <span className="font-mono text-gray-900">{formatCurrency(purePremium)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600">Expense &amp; Profit Loading:</span>
                                <span className="font-mono text-gray-800 font-medium">{formatCurrency(expenseLoading)}</span>
                            </div>
                             <div className="flex justify-between items-center py-3 mt-4 bg-green-100 rounded-lg px-4 border border-green-200">
                                <span className="font-bold text-green-800 text-lg">Final Gross Premium:</span>
                                <span className="font-mono text-green-800 font-bold text-xl">{formatCurrency(finalPremium)}</span>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};