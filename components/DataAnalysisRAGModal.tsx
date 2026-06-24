import React, { useState, useRef, useEffect } from 'react';
import { 
  XMarkIcon, 
  ArrowUpIcon,
  DocumentTextIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ClipboardIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { CanvasModule } from '../types';
import { GoogleGenAI } from '@google/genai';
import { getGeminiClient } from '../lib/aiClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DataAnalysisRAGModalProps {
  module: CanvasModule;
  onClose: () => void;
}

export const DataAnalysisRAGModal: React.FC<DataAnalysisRAGModalProps> = ({ 
  module, 
  onClose 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getDataInfo = () => {
    if (!module.outputData || module.outputData.type !== 'DataPreview') {
      return null;
    }

    const outputData = module.outputData as any;
    return {
      columnCount: outputData.columns?.length || 0,
      rowCount: outputData.rows?.length || 0,
      columns: outputData.columns?.map((col: any) => col.name) || [],
      dataTypes: outputData.columns?.reduce((acc: any, col: any) => {
        acc[col.name] = col.type;
        return acc;
      }, {}) || {},
    };
  };

  useEffect(() => {
    // 모달이 열릴 때 자동으로 데이터 분석 수행
    performAutoAnalysis();
  }, []);

  const performAutoAnalysis = async () => {
    const dataInfo = getDataInfo();
    
    if (!dataInfo) {
      const errorMessage: Message = {
        role: 'assistant',
        content: '데이터가 로드되지 않았습니다. 먼저 Load Data 모듈에서 데이터를 로드해주세요.',
      };
      setMessages([errorMessage]);
      return;
    }

    setIsLoading(true);
    
    // 자동 분석 질문 생성
    const question = `이 데이터를 분석하는 방법을 알려주세요. 데이터 정보: ${dataInfo.columnCount}개 컬럼, ${dataInfo.rowCount}개 행, 컬럼 목록: ${dataInfo.columns.slice(0, 10).join(', ')}${dataInfo.columns.length > 10 ? '...' : ''}`;
    
    const userMessage: Message = {
      role: 'user',
      content: question,
    };
    
    setMessages([userMessage]);

    try {
      // Gemini API 직접 호출
      const genAI = getGeminiClient();
      
      // 데이터 정보를 포함한 프롬프트 구성
      const prompt = `당신은 데이터 분석 전문가입니다. 다음 데이터 정보를 바탕으로 질문에 답변해주세요.

[데이터 정보]
- 컬럼 수: ${dataInfo.columnCount}
- 행 수: ${dataInfo.rowCount}
- 컬럼 목록: ${dataInfo.columns.join(', ')}
- 데이터 타입: ${JSON.stringify(dataInfo.dataTypes, null, 2)}

[질문]
${question}

[답변 지침]
1. 데이터 분석 방법을 구체적이고 상세하게 설명하세요.
2. 가능하면 구체적인 예시나 단계를 포함하세요.
3. 한국어로 답변하세요.
4. 이 앱의 모듈을 사용해서 분석 예시를 보여주세요. 예를 들어 "Load Data → Select Data → Statistics → ..." 같은 순서도를 제시하세요.
5. 전처리(공백 처리, 정규화, 결측치 처리 등)에 대한 구체적인 제안도 포함해주세요.`;

      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const answer = result.text;

      const assistantMessage: Message = {
        role: 'assistant',
        content: answer,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `오류가 발생했습니다: ${error.message}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const dataInfo = getDataInfo();

      // Gemini API 직접 호출
      const genAI = getGeminiClient();
      
      // 데이터 정보를 포함한 프롬프트 구성
      let prompt = currentInput;
      
      if (dataInfo) {
        prompt = `당신은 데이터 분석 전문가입니다. 다음 데이터 정보를 바탕으로 질문에 답변해주세요.

[데이터 정보]
- 컬럼 수: ${dataInfo.columnCount}
- 행 수: ${dataInfo.rowCount}
- 컬럼 목록: ${dataInfo.columns.join(', ')}
- 데이터 타입: ${JSON.stringify(dataInfo.dataTypes, null, 2)}

[질문]
${currentInput}

[답변 지침]
1. 데이터 정보를 고려하여 정확하고 상세하게 답변하세요.
2. 가능하면 구체적인 예시나 단계를 포함하세요.
3. 한국어로 답변하세요.
4. 이 앱의 모듈을 사용해서 분석 예시를 보여주세요. 예를 들어 "Load Data → Select Data → Statistics → ..." 같은 순서도를 제시하세요.
5. 전처리(공백 처리, 정규화, 결측치 처리 등)에 대한 구체적인 제안도 포함해주세요.`;
      }

      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const answer = result.text;

      const assistantMessage: Message = {
        role: 'assistant',
        content: answer,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `오류가 발생했습니다: ${error.message}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasData = getDataInfo() !== null;
  const dataInfo = getDataInfo();

  const handleCopyAnswer = async () => {
    // 모든 assistant 메시지의 내용을 합쳐서 복사
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length > 0) {
      const allAnswers = assistantMessages.map(m => m.content).join('\n\n---\n\n');
      try {
        await navigator.clipboard.writeText(allAnswers);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        console.error('복사 실패:', error);
      }
    }
  };

  const hasAssistantMessage = messages.some(m => m.role === 'assistant' && m.content);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg flex flex-col shadow-2xl transition-all duration-300 ${
        isMaximized
          ? 'w-screen h-screen rounded-none'
          : 'w-full max-w-4xl h-[80vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI로 데이터 사전 분석하기</h2>
              {hasData && dataInfo && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {dataInfo.columnCount}개 컬럼, {dataInfo.rowCount}개 행
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={isMaximized ? "최소화" : "최대화"}
            >
              {isMaximized ? (
                <ArrowsPointingInIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <ArrowsPointingOutIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 panel-scrollbar">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-500 mt-8">
              <p className="mb-2">데이터 분석을 준비하고 있습니다...</p>
            </div>
          )}
          
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
          
          {/* 복사 버튼 - 답변이 있을 때만 표시 */}
          {hasAssistantMessage && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCopyAnswer}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors text-white"
              >
                {isCopied ? (
                  <>
                    <CheckIcon className="w-5 h-5 text-green-400" />
                    복사됨
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="w-5 h-5" />
                    답변 전체 복사
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleAsk()}
              placeholder="질문을 입력하세요... (예: 이 데이터를 분석하는 방법을 알려주세요)"
              className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-transparent rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleAsk}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              <ArrowUpIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

