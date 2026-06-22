import React, { useMemo, useState } from "react";
import type { ColumnInfo } from "../types";
import { computeDataOverview } from "../utils/dataOverview";

// 데이터 개요/요약 패널 (작업1, docs/cross_app_io_improvements.md)
//
// 이미 로드된 미리보기 데이터(columns + rows)만으로 순수 TS에서 계산하는
// 읽기 전용 요약 섹션. Python/Pyodide 호출 없음, 새 모듈 없음.
// 데이터가 없으면 아무것도 렌더링하지 않는다(가산적/additive).
//
// 주의: ML Auto Flow ↔ ML_Auto_Flow-JMDC 동일 코드 유지(공통 자산).

interface DataOverviewPanelProps {
  columns: ColumnInfo[] | undefined | null;
  rows: Record<string, any>[] | undefined | null;
  totalRowCount?: number;
}

export const DataOverviewPanel: React.FC<DataOverviewPanelProps> = ({
  columns,
  rows,
  totalRowCount,
}) => {
  const [open, setOpen] = useState(false);
  const overview = useMemo(
    () => computeDataOverview(columns, rows, totalRowCount),
    [columns, rows, totalRowCount]
  );

  if (!overview) return null;

  const sampledNote =
    overview.rowCount !== overview.sampledRowCount
      ? ` · 결측치는 미리보기 표본 ${overview.sampledRowCount.toLocaleString()}행 기준`
      : "";

  return (
    <div className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span className="font-semibold text-slate-700">데이터 개요</span>
          <span className="text-slate-600">
            {overview.rowCount.toLocaleString()}행 × {overview.columnCount}열
          </span>
          <span className="text-slate-500">
            수치형 {overview.numericCount} · 범주형{" "}
            {overview.categoricalCount}
          </span>
          {overview.columnsWithMissing > 0 ? (
            <span className="text-amber-700 font-medium">
              결측 열 {overview.columnsWithMissing}개 (총{" "}
              {overview.totalMissingCells.toLocaleString()}개)
            </span>
          ) : (
            <span className="text-emerald-700">결측치 없음</span>
          )}
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0">
          {open ? "접기 ▲" : "열별 보기 ▼"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 border-t border-slate-200">
          <div className="max-h-48 overflow-auto mt-2 rounded border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="py-1.5 px-3 text-left font-semibold text-slate-600">
                    열
                  </th>
                  <th className="py-1.5 px-3 text-left font-semibold text-slate-600">
                    타입
                  </th>
                  <th className="py-1.5 px-3 text-right font-semibold text-slate-600">
                    결측/빈값
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.columns.map((col) => {
                  const hasMissing = col.missingCount > 0;
                  return (
                    <tr
                      key={col.name}
                      className={`border-b border-slate-100 last:border-b-0 ${
                        hasMissing ? "bg-amber-50" : ""
                      }`}
                    >
                      <td
                        className="py-1.5 px-3 truncate max-w-[16rem] text-slate-700"
                        title={col.name}
                      >
                        {col.name}
                      </td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            col.isNumeric
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {col.typeLabel}
                        </span>
                      </td>
                      <td
                        className={`py-1.5 px-3 text-right font-mono ${
                          hasMissing
                            ? "text-amber-700 font-semibold"
                            : "text-slate-400"
                        }`}
                      >
                        {col.missingCount.toLocaleString()}
                        {hasMissing && overview.sampledRowCount > 0
                          ? ` (${(col.missingRatio * 100).toFixed(1)}%)`
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            읽기 전용 요약(클라이언트 계산){sampledNote}.
          </p>
        </div>
      )}
    </div>
  );
};

export default DataOverviewPanel;
