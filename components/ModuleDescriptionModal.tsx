import React from "react";
import { ModuleType } from "../types";
import { MODULE_DESCRIPTIONS } from "../moduleDescriptions";
import { XCircleIcon } from "./icons";

interface ModuleDescriptionModalProps {
  moduleType: ModuleType | null;
  onClose: () => void;
}

export const ModuleDescriptionModal: React.FC<ModuleDescriptionModalProps> = ({
  moduleType,
  onClose,
}) => {
  if (!moduleType) return null;
  const desc = MODULE_DESCRIPTIONS[moduleType];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">
              {desc?.title ?? moduleType}
            </h2>
            {desc?.category && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {desc.category}
              </p>
            )}
            <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-0.5">
              {moduleType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            aria-label="닫기"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-grow p-6 overflow-auto">
          {!desc ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>이 모듈에 대한 상세 설명이 아직 작성되지 않았습니다.</p>
              <p className="mt-2">
                기본 동작은 모듈의 코드 탭(Code) 또는 결과 보기에서 확인할 수
                있습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-5 text-sm leading-relaxed">
              <Section title="역할" body={desc.role} />
              <Section title="입력" body={desc.input} />
              <Section title="결과" body={desc.output} />
              {desc.parameters && (
                <Section title="파라미터" body={desc.parameters} mono />
              )}
              {desc.notes && (
                <Section title="비고" body={desc.notes} muted />
              )}
            </div>
          )}
        </main>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  body: string;
  mono?: boolean;
  muted?: boolean;
}> = ({ title, body, mono, muted }) => (
  <section>
    <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">
      {title}
    </h3>
    <p
      className={[
        "whitespace-pre-wrap",
        mono ? "font-mono text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700" : "",
        muted ? "text-gray-600 dark:text-gray-400 text-xs" : "text-gray-800 dark:text-gray-200",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {body}
    </p>
  </section>
);
