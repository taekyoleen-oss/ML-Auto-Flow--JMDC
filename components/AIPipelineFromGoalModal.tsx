import React, { useState } from 'react';
import { XCircleIcon, SparklesIcon } from './icons';

interface AIPipelineFromGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (goal: string) => void;
}

export const AIPipelineFromGoalModal: React.FC<AIPipelineFromGoalModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [goal, setGoal] = useState('');

    const handleSubmit = () => {
        if (goal.trim()) {
            onSubmit(goal);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl w-full max-w-2xl"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                        AI로 파이프라인 생성하기
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="p-6">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        달성하고자 하는 분석 목표를 설명해주세요. AI가 목표에 맞는 표준적인 파이프라인 템플릿을 생성해 드립니다.
                    </p>
                    <textarea
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="예: 고객 데이터를 사용하여 다음 달 이탈 고객 예측하기"
                        className="w-full h-32 p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-200"
                        autoFocus
                    />
                </main>
                <footer className="flex justify-end p-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md mr-2"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!goal.trim()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed rounded-md"
                    >
                        파이프라인 생성
                    </button>
                </footer>
            </div>
        </div>
    );
};