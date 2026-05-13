import React, { useMemo } from "react";
import { CanvasModule, JMDCCoxOutput } from "../types";
import { XCircleIcon } from "./icons";

interface Props {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
}

export const JMDCCoxPreviewModal: React.FC<Props> = ({ module, onClose }) => {
  const output = module.outputData as JMDCCoxOutput | undefined;
  if (!output || output.type !== "JMDCCoxOutput") return null;

  // Forest plot bounds — symmetric log scale
  const maxAbs = useMemo(() => {
    const all = output.hrTable.flatMap((r) => [Math.log(Math.max(0.05, r.hr_ci_lo)), Math.log(Math.max(0.05, r.hr_ci_hi))]);
    return Math.max(Math.log(3), ...all.map((v) => Math.abs(v)));
  }, [output.hrTable]);

  const xFor = (hr: number) => {
    const lo = -maxAbs;
    const hi = maxAbs;
    const v = Math.log(Math.max(0.05, hr));
    return 180 + ((v - lo) / (hi - lo)) * 380;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">[J6] JMDC Risk Stratification (Cox PH): {module.name}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Exposure: <span className="font-mono">{output.exposureCol}</span>
              {output.covariates.length > 0 && (
                <> · Covariates: <span className="font-mono">{output.covariates.join(", ")}</span></>
              )}
              {output.concordance !== null && output.concordance !== undefined && (
                <> · C-index: <span className="font-mono">{output.concordance.toFixed(3)}</span></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-grow p-6 overflow-auto">
          {/* PH warnings */}
          {output.phWarnings.length > 0 && (
            <div className="mb-4 px-4 py-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
              <strong>⚠ Proportional Hazards assumption check:</strong>
              <ul className="list-disc list-inside mt-1 text-sm">
                {output.phWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Forest plot */}
          <h3 className="text-md font-bold text-gray-800 mb-3">Hazard Ratios (forest plot, log scale)</h3>
          <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
            <svg viewBox="0 0 600 360" className="w-full" style={{ minHeight: `${Math.max(180, 40 + output.hrTable.length * 28)}px` }}>
              {/* HR = 1 reference */}
              <line x1={xFor(1)} y1="20" x2={xFor(1)} y2={20 + output.hrTable.length * 28} stroke="#9ca3af" strokeDasharray="3,3" />
              <text x={xFor(1)} y="14" textAnchor="middle" fontSize="10" fill="#6b7280">
                HR=1
              </text>
              {[0.25, 0.5, 1, 2, 4].map((v) => (
                <text key={v} x={xFor(v)} y={30 + output.hrTable.length * 28} textAnchor="middle" fontSize="10" fill="#6b7280">
                  {v}
                </text>
              ))}
              {output.hrTable.map((r, i) => {
                const y = 28 + i * 28;
                const xH = xFor(r.hr);
                const xLo = xFor(r.hr_ci_lo);
                const xHi = xFor(r.hr_ci_hi);
                const sig = r.p_value < 0.05;
                return (
                  <g key={r.variable}>
                    <text x="170" y={y + 4} textAnchor="end" fontSize="11" fill="#1f2937" className="font-mono">
                      {r.variable}
                    </text>
                    <line x1={xLo} y1={y} x2={xHi} y2={y} stroke={sig ? "#dc2626" : "#374151"} strokeWidth="2" />
                    <line x1={xLo} y1={y - 4} x2={xLo} y2={y + 4} stroke={sig ? "#dc2626" : "#374151"} strokeWidth="2" />
                    <line x1={xHi} y1={y - 4} x2={xHi} y2={y + 4} stroke={sig ? "#dc2626" : "#374151"} strokeWidth="2" />
                    <circle cx={xH} cy={y} r="5" fill={sig ? "#dc2626" : "#374151"} />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Coefficient table */}
          <h3 className="text-md font-bold text-gray-800 mb-3">Coefficient Table</h3>
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left py-2 px-3">Variable</th>
                <th className="text-right py-2 px-3">HR</th>
                <th className="text-right py-2 px-3">95% CI</th>
                <th className="text-right py-2 px-3">p-value</th>
                <th className="text-right py-2 px-3">PH test p</th>
              </tr>
            </thead>
            <tbody>
              {output.hrTable.map((r) => (
                <tr key={r.variable} className="border-t border-gray-200">
                  <td className="py-1.5 px-3 font-mono">{r.variable}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{r.hr.toFixed(3)}</td>
                  <td className="py-1.5 px-3 text-right font-mono">
                    {r.hr_ci_lo.toFixed(3)} – {r.hr_ci_hi.toFixed(3)}
                  </td>
                  <td className={`py-1.5 px-3 text-right font-mono ${r.p_value < 0.05 ? "text-red-600 font-semibold" : ""}`}>
                    {r.p_value < 1e-4 ? r.p_value.toExponential(2) : r.p_value.toFixed(4)}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono">
                    {r.ph_test_p !== undefined && r.ph_test_p !== null ? r.ph_test_p.toFixed(4) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {output.logLikelihood !== null && output.logLikelihood !== undefined && (
            <p className="text-xs text-gray-500 mt-2">
              Log-likelihood: <span className="font-mono">{output.logLikelihood.toFixed(3)}</span>
            </p>
          )}
        </main>
      </div>
    </div>
  );
};
