import React, { useState, useRef, DragEvent } from 'react';
import { XCircleIcon, SparklesIcon, FolderOpenIcon } from './icons';

interface AIPipelineFromDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (goal: string, fileContent: string, fileName: string) => void;
}

export const AIPipelineFromDataModal: React.FC<AIPipelineFromDataModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [goal, setGoal] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFile = (selectedFile: File) => {
        if (selectedFile) {
            if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
                setError('CSV 파일만 업로드할 수 있습니다.');
                return;
            }
            setError(null);
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                setFileContent(event.target?.result as string);
            };
            reader.readAsText(selectedFile);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) processFile(selectedFile);
    };
    
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) processFile(droppedFile);
    };

    const handleSubmit = () => {
        if (goal.trim() && fileContent && file) {
            onSubmit(goal, fileContent, file.name);
        }
    };
    
    const handleClose = () => {
        setGoal('');
        setFile(null);
        setFileContent(null);
        setError(null);
        setIsDraggingOver(false);
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl w-full max-w-2xl"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                        AI로 데이터 분석 실행하기
                    </h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="p-6 space-y-4">
                     <div>
                        <label className="block text-gray-600 dark:text-gray-400 mb-2">1. 분석 목표를 설명해주세요.</label>
                        <textarea
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            placeholder="예: 보험 청구 데이터를 사용하여 사기 여부 분류하기"
                            className="w-full h-24 p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-200"
                            autoFocus
                        />
                    </div>
                     <div>
                        <label className="block text-gray-600 dark:text-gray-400 mb-2">2. 분석할 데이터를 업로드해주세요. (CSV)</label>
                        <div
                            className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDraggingOver ? 'border-indigo-400 bg-indigo-50 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500'}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                            {file ? (
                                <p className="text-green-600 dark:text-green-400">{file.name}</p>
                            ) : (
                                <div className="text-center text-gray-500 dark:text-gray-500">
                                    <FolderOpenIcon className="w-8 h-8 mx-auto mb-2" />
                                    <p>파일을 선택하거나 여기에 드래그 앤 드롭하세요.</p>
                                </div>
                            )}
                        </div>
                        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
                    </div>
                </main>
                <footer className="flex justify-end p-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md mr-2"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!goal.trim() || !fileContent}
                        className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed rounded-md"
                    >
                        분석하기
                    </button>
                </footer>
            </div>
        </div>
    );
};