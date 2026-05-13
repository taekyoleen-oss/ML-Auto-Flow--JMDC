import React, { useMemo, useState } from "react";
import { CanvasModule, JMDCMatcherOutput } from "../types";
import { XCircleIcon } from "./icons";

interface Props {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
}

const COUNTRY_COLOR = { JP: "#ef4444", KR: "#3b82f6" } as const;

export const JMDCMatcherPreviewModal: React.FC<Props> = ({ module, onClose }) => {
  const output = module.outputData as JMDCMatcherOutput | undefined;
  if (!output || output.type !== "JMDCMatcherOutput") return null;

  const [tab, setTab] = useState<"smd" | "km" | "sir" | "rates">("smd");

  const smdMax = useMemo(
    () => Math.max(0.2, ...output.smdTable.flatMap((r) => [r.smd_before, r.smd_after])),
    [output.smdTable]
  );

  const sirMax = useMemo(
    () => Math.max(2, ...output.sirTable.flatMap((r) => [r.sir_ci_hi, r.sir])),
    [output.sirTable]
  );

  const sirXFor = (sir: number) => 200 + (Math.log(Math.max(0.05, sir)) / Math.log(sirMax)) * 320;

  const tMax = useMemo(
    () => Math.max(1, ...output.kmOverlay.flatMap((c) => c.t_years)),
    [output.kmOverlay]
  );

  const tabs: Array<[typeof tab, string]> = [
    ["smd", "SMD Before/After"],
    ["km", "KM Overlay"],
    ["sir", "SIR Forest"],
    ["rates", "Standardised Rates"],
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">[J7] JMDC KR-JP Matcher: {module.name}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Mapping: <span className="font-mono">{output.mappingVersion}</span> · Applied:{" "}
              {[
                output.applied.schema_alignment && "L1",
                output.applied.vocab_mapping && "L2",
                output.applied.standardization !== "none" && `L3(${output.applied.standardization})`,
                output.applied.psm && "L4(PSM)",
              ]
                .filter(Boolean)
                .join(" + ")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="flex">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 px-4 py-3 text-sm font-semibold ${
                  tab === id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-grow p-6 overflow-auto">
          {tab === "smd" && (
            <div>
              <h3 className="text-md font-bold text-gray-800 mb-3">Standardised Mean Difference (|SMD| ≥ 0.1 unbalanced)</h3>
              <div className="space-y-3">
                {output.smdTable.map((r) => (
                  <div key={r.variable}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-mono">{r.variable}</span>
                      <span>
                        before <span className={r.smd_before >= 0.1 ? "text-red-600 font-semibold" : ""}>{r.smd_before.toFixed(3)}</span> →
                        after <span className={r.smd_after >= 0.1 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold"}>
                          {r.smd_after.toFixed(3)}
                        </span>
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1 bg-gray-200 rounded h-4 relative">
                        <div
                          className="absolute left-0 top-0 h-4 rounded bg-amber-500"
                          style={{ width: `${(r.smd_before / smdMax) * 100}%` }}
                          title={`Before: ${r.smd_before.toFixed(3)}`}
                        />
                        <div className="absolute left-1/2 top-0 bottom-0 border-l border-red-500" style={{ left: `${(0.1 / smdMax) * 100}%` }} />
                      </div>
                      <div className="flex-1 bg-gray-200 rounded h-4 relative">
                        <div
                          className="absolute left-0 top-0 h-4 rounded bg-emerald-500"
                          style={{ width: `${(r.smd_after / smdMax) * 100}%` }}
                          title={`After: ${r.smd_after.toFixed(3)}`}
                        />
                        <div className="absolute top-0 bottom-0 border-l border-red-500" style={{ left: `${(0.1 / smdMax) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">Red line = balance threshold (|SMD| = 0.1).</p>
            </div>
          )}

          {tab === "km" && (
            <div>
              <h3 className="text-md font-bold text-gray-800 mb-3">KM Overlay (JP vs KR)</h3>
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <svg viewBox="0 0 600 320" className="w-full h-72">
                  <line x1="60" y1="280" x2="580" y2="280" stroke="#9ca3af" />
                  <line x1="60" y1="20" x2="60" y2="280" stroke="#9ca3af" />
                  {[0, 0.25, 0.5, 0.75, 1].map((p) => {
                    const y = 280 - p * 260;
                    return (
                      <text key={p} x="50" y={y + 3} textAnchor="end" fontSize="10" fill="#4b5563">
                        {p.toFixed(2)}
                      </text>
                    );
                  })}
                  {Array.from({ length: 6 }, (_, i) => (tMax * i) / 5).map((t, i) => {
                    const x = 60 + (t / tMax) * 520;
                    return (
                      <text key={i} x={x} y="297" textAnchor="middle" fontSize="10" fill="#4b5563">
                        {t.toFixed(1)}y
                      </text>
                    );
                  })}
                  {output.kmOverlay.map((c, idx) => {
                    const color = COUNTRY_COLOR[c.country];
                    const d = c.t_years.map((t, i) => `${i === 0 ? "M" : "L"} ${60 + (t / tMax) * 520} ${280 - c.survival[i] * 260}`).join(" ");
                    return <path key={idx} d={d} stroke={color} strokeWidth="2" fill="none" />;
                  })}
                </svg>
                <div className="flex gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: COUNTRY_COLOR.JP }} /> JP
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: COUNTRY_COLOR.KR }} /> KR
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "sir" && (
            <div>
              <h3 className="text-md font-bold text-gray-800 mb-3">Standardised Incidence Ratio (KR observed / JP-expected)</h3>
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <svg viewBox="0 0 600 360" className="w-full" style={{ minHeight: `${Math.max(180, 40 + output.sirTable.length * 28)}px` }}>
                  <line x1={sirXFor(1)} y1="20" x2={sirXFor(1)} y2={20 + output.sirTable.length * 28} stroke="#9ca3af" strokeDasharray="3,3" />
                  <text x={sirXFor(1)} y="14" textAnchor="middle" fontSize="10" fill="#6b7280">SIR=1</text>
                  {output.sirTable.map((r, i) => {
                    const y = 28 + i * 28;
                    const sig = r.sir_ci_lo > 1 || r.sir_ci_hi < 1;
                    return (
                      <g key={r.outcome}>
                        <text x="190" y={y + 4} textAnchor="end" fontSize="11" fill="#1f2937" className="font-mono">
                          {r.outcome}
                        </text>
                        <line x1={sirXFor(r.sir_ci_lo)} y1={y} x2={sirXFor(r.sir_ci_hi)} y2={y} stroke={sig ? "#dc2626" : "#374151"} strokeWidth="2" />
                        <circle cx={sirXFor(r.sir)} cy={y} r="5" fill={sig ? "#dc2626" : "#374151"} />
                        <text x={sirXFor(r.sir_ci_hi) + 8} y={y + 4} fontSize="10" fill="#374151" className="font-mono">
                          {r.sir.toFixed(2)} ({r.sir_ci_lo.toFixed(2)}–{r.sir_ci_hi.toFixed(2)})
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {tab === "rates" && (
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left py-2 px-3">Outcome</th>
                  <th className="text-right py-2 px-3">JP raw</th>
                  <th className="text-right py-2 px-3">JP std</th>
                  <th className="text-right py-2 px-3">KR raw</th>
                  <th className="text-right py-2 px-3">KR std</th>
                  <th className="text-right py-2 px-3">Ratio (95% CI)</th>
                </tr>
              </thead>
              <tbody>
                {output.rateTable.map((r) => (
                  <tr key={r.outcome} className="border-t border-gray-200">
                    <td className="py-1.5 px-3 font-mono">{r.outcome}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{r.jp_raw.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{r.jp_std.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{r.kr_raw.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{r.kr_std.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {r.ratio.toFixed(2)} ({r.ratio_ci_lo.toFixed(2)}–{r.ratio_ci_hi.toFixed(2)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </div>
  );
};
