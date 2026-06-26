import React, { useRef } from "react";
import { CanvasModule, ModelReportOutput } from "../types";
import { XCircleIcon } from "./icons";

interface ModelReportPreviewModalProps {
  module: CanvasModule;
  onClose: () => void;
}

/**
 * 모델 분석보고서(ModelAnalysisReport) 결과 미리보기.
 * - 자기완결 HTML을 sandbox <iframe srcDoc>로 렌더한다(allow-scripts 제외 = 스크립트 비실행, 보안).
 * - HTML 다운로드 / 인쇄 / source 배지(AI·폴백) 제공.
 * - 열람은 게이트 없음(일반 사용자도 가능).
 */
export const ModelReportPreviewModal: React.FC<
  ModelReportPreviewModalProps
> = ({ module, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const output = module.outputData as ModelReportOutput | undefined;

  if (!output || output.type !== "ModelReportOutput") {
    return null;
  }

  const isAi = output.source === "ai";

  const handleDownload = () => {
    try {
      const blob = new Blob([output.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (module.name || "모델").replace(/[\\/:*?"<>|]/g, "_");
      a.download = `${safeName}_분석보고서.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[ModelReportPreviewModal] 다운로드 실패:", err);
    }
  };

  const handlePrint = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }
    } catch (err) {
      console.error("[ModelReportPreviewModal] 인쇄 실패:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800">
                모델 분석보고서: {module.name}
              </h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isAi
                    ? "bg-cyan-100 text-cyan-700"
                    : "bg-gray-100 text-gray-600"
                }`}
                title={
                  isAi
                    ? "Gemini AI가 생성한 보고서"
                    : "API 키 미설정/실패 시 메타데이터 기반 결정적 폴백 보고서"
                }
              >
                {isAi ? "✨ AI 생성" : "결정적 폴백"}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              생성: {new Date(output.generatedAt).toLocaleString("ko-KR")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
              title="자기완결 HTML 파일로 저장"
            >
              HTML 다운로드
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              title="보고서 인쇄 / PDF로 저장"
            >
              인쇄
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800"
              title="닫기"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </header>
        <main className="flex-grow overflow-hidden p-2 bg-gray-100">
          {/* sandbox: allow-same-origin만 — 스크립트 미허용(보안). 자기완결 HTML 렌더. */}
          <iframe
            ref={iframeRef}
            title="모델 분석보고서"
            srcDoc={output.html}
            sandbox="allow-same-origin allow-modals"
            className="w-full h-full min-h-[60vh] bg-white rounded border border-gray-200"
          />
        </main>
      </div>
    </div>
  );
};
