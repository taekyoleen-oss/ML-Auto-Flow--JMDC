import React, { useMemo, useState } from "react";
import { CanvasModule, JMDCSurvivalOutput } from "../types";
import { XCircleIcon } from "./icons";

interface Props {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];

// Shared by J4 (KM) and J5 (CIF). For CIF mode we plot 1-S, for KM we plot S.
export const JMDCSurvivalPreviewModal: React.FC<Props> = ({ module, onClose }) => {
  const output = module.outputData as JMDCSurvivalOutput | undefined;
  if (!output || output.type !== "JMDCSurvivalOutput") return null;

  const [showCi, setShowCi] = useState(true);
  const isCIF = output.mode === "cif";

  const tMax = useMemo(
    () => Math.max(1, ...output.curves.flatMap((c) => c.t_years)),
    [output.curves]
  );

  // For CIF mode, transform: y axis is 1 - survival
  const yFor = (s: number) => {
    const v = isCIF ? 1 - s : s;
    return 280 - v * 260;
  };
  const xFor = (t: number) => 60 + (t / tMax) * 520;

  const isViolation = output.logrankP !== null && output.logrankP < 0.05;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {isCIF ? "[J5] Cumulative Incidence" : "[J4] Survival Compare (KM)"}: {module.name}
            </h2>
            {output.groupCol && (
              <p className="text-xs text-gray-500 mt-1">
                Group by: <span className="font-mono">{output.groupCol}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={showCi} onChange={(e) => setShowCi(e.target.checked)} /> 95% CI band
            </label>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="flex-grow p-6 overflow-auto">
          {/* Log-rank banner */}
          {!isCIF && output.logrankP !== null && (
            <div
              className={`mb-4 px-4 py-2 rounded ${
                isViolation ? "bg-red-50 border border-red-200 text-red-800" : "bg-emerald-50 border border-emerald-200 text-emerald-800"
              }`}
            >
              <strong>Log-rank p-value:</strong> {output.logrankP.toExponential(3)}{" "}
              {output.stratifiedLogrankP !== null && (
                <>· <strong>Stratified:</strong> {output.stratifiedLogrankP.toExponential(3)}</>
              )}{" "}
              {isViolation ? "→ groups differ significantly" : "→ no significant group difference"}
            </div>
          )}

          {/* Chart */}
          <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
            <svg viewBox="0 0 600 320" className="w-full h-80">
              <line x1="60" y1="280" x2="580" y2="280" stroke="#9ca3af" />
              <line x1="60" y1="20" x2="60" y2="280" stroke="#9ca3af" />
              <text x="320" y="310" textAnchor="middle" fontSize="11" fill="#4b5563">
                Years from index date
              </text>
              <text x="20" y="150" transform="rotate(-90 20,150)" textAnchor="middle" fontSize="11" fill="#4b5563">
                {isCIF ? "Cumulative incidence" : "Survival probability"}
              </text>
              {/* y ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((p) => {
                const y = 280 - p * 260;
                return (
                  <g key={p}>
                    <line x1="55" y1={y} x2="60" y2={y} stroke="#9ca3af" />
                    <text x="50" y={y + 3} textAnchor="end" fontSize="10" fill="#4b5563">
                      {p.toFixed(2)}
                    </text>
                  </g>
                );
              })}
              {/* x ticks */}
              {Array.from({ length: 6 }, (_, i) => (tMax * i) / 5).map((t, i) => (
                <g key={i}>
                  <line x1={xFor(t)} y1="280" x2={xFor(t)} y2="285" stroke="#9ca3af" />
                  <text x={xFor(t)} y="297" textAnchor="middle" fontSize="10" fill="#4b5563">
                    {t.toFixed(1)}
                  </text>
                </g>
              ))}
              {/* curves */}
              {output.curves.map((c, idx) => {
                const color = COLORS[idx % COLORS.length];
                if (c.t_years.length === 0) return null;
                const dLine = c.t_years.map((t, i) => `${i === 0 ? "M" : "L"} ${xFor(t)} ${yFor(c.survival[i])}`).join(" ");
                // CI band as filled polygon
                let dBand = "";
                if (showCi && c.ci_lo.length > 0) {
                  const up = c.t_years.map((t, i) => `${i === 0 ? "M" : "L"} ${xFor(t)} ${yFor(c.ci_hi[i])}`).join(" ");
                  const downReversed = c.t_years
                    .map((_, i) => c.t_years.length - 1 - i)
                    .map((i) => `L ${xFor(c.t_years[i])} ${yFor(c.ci_lo[i])}`)
                    .join(" ");
                  dBand = `${up} ${downReversed} Z`;
                }
                return (
                  <g key={c.group}>
                    {dBand && <path d={dBand} fill={color} opacity="0.15" />}
                    <path d={dLine} stroke={color} strokeWidth="2" fill="none" />
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              {output.curves.map((c, idx) => (
                <div key={c.group} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="font-mono">{c.group}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Group stats table */}
          <h3 className="text-md font-bold text-gray-800 mb-3">Group statistics</h3>
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left py-2 px-3">Group</th>
                <th className="text-right py-2 px-3">N</th>
                <th className="text-right py-2 px-3">Events</th>
                <th className="text-right py-2 px-3">Median survival (y)</th>
                <th className="text-right py-2 px-3">CIF @ 1y</th>
                <th className="text-right py-2 px-3">CIF @ 3y</th>
                <th className="text-right py-2 px-3">CIF @ 5y</th>
              </tr>
            </thead>
            <tbody>
              {output.groupStats.map((g) => (
                <tr key={g.group} className="border-t border-gray-200">
                  <td className="py-1.5 px-3 font-mono">{g.group}</td>
                  <td className="py-1.5 px-3 text-right">{g.N.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right">{g.events}</td>
                  <td className="py-1.5 px-3 text-right">{g.median_survival !== null ? g.median_survival.toFixed(2) : "—"}</td>
                  <td className="py-1.5 px-3 text-right">{g.cum_inc_1y !== null ? `${(g.cum_inc_1y * 100).toFixed(2)}%` : "—"}</td>
                  <td className="py-1.5 px-3 text-right">{g.cum_inc_3y !== null ? `${(g.cum_inc_3y * 100).toFixed(2)}%` : "—"}</td>
                  <td className="py-1.5 px-3 text-right">{g.cum_inc_5y !== null ? `${(g.cum_inc_5y * 100).toFixed(2)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      </div>
    </div>
  );
};
