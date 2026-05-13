import React, { useMemo, useState } from "react";
import { CanvasModule, JMDCIncidenceOutput } from "../types";
import { XCircleIcon } from "./icons";

interface Props {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export const JMDCIncidencePreviewModal: React.FC<Props> = ({ module, onClose }) => {
  const output = module.outputData as JMDCIncidenceOutput | undefined;
  if (!output || output.type !== "JMDCIncidenceOutput") return null;

  const [tab, setTab] = useState<"rates" | "cif">("rates");

  const maxRate = useMemo(
    () => Math.max(1e-6, ...output.rateTable.map((r) => Math.max(r.crude_rate, r.crude_ci_hi || 0, r.std_rate || 0))),
    [output.rateTable]
  );

  // Group CIF by stratum for chart
  const cifByStratum = useMemo(() => {
    const m: Record<string, Array<{ t: number; v: number }>> = {};
    output.cifGrid.forEach((p) => {
      m[p.stratum] = m[p.stratum] || [];
      m[p.stratum].push({ t: p.t_years, v: p.cif });
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.t - b.t));
    return m;
  }, [output.cifGrid]);

  const cifMax = Math.max(0.01, ...output.cifGrid.map((p) => p.cif));
  const cifTimes = useMemo(() => Array.from(new Set(output.cifGrid.map((p) => p.t_years))).sort((a, b) => a - b), [output.cifGrid]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">[J3] JMDC Incidence Rate: {module.name}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Stratify: <span className="font-mono">{output.stratifyBy}</span> · Unit:{" "}
              <span className="font-mono">{output.rateUnit}</span> · Standard pop:{" "}
              <span className="font-mono">{output.standardPopulation}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="flex">
            {(["rates", "cif"] as const).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 px-4 py-3 text-sm font-semibold ${
                  tab === id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {id === "rates" ? "Incidence Rates" : "Cumulative Incidence"}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-grow p-6 overflow-auto">
          {tab === "rates" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-md font-bold text-gray-800 mb-3">Stratum-level rates (per {output.rateUnit})</h3>
                <div className="space-y-2">
                  {output.rateTable.map((r, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-mono">{r.stratum}</span>
                        <span>
                          {r.crude_rate.toFixed(2)} ({r.crude_ci_lo.toFixed(2)}–{r.crude_ci_hi.toFixed(2)}) · N={r.N.toLocaleString()} · events=
                          {r.events}
                        </span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="absolute left-0 top-0 h-3 bg-blue-500 rounded-full"
                          style={{ width: `${(r.crude_rate / maxRate) * 100}%` }}
                        />
                        {r.std_rate !== undefined && r.std_rate !== null && (
                          <div
                            className="absolute top-0 h-3 border-r-2 border-red-500"
                            style={{ left: `${(r.std_rate / maxRate) * 100}%`, width: "2px" }}
                            title={`Standardised: ${r.std_rate.toFixed(2)}`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left py-2 px-3">Stratum</th>
                      <th className="text-right py-2 px-3">N</th>
                      <th className="text-right py-2 px-3">PY</th>
                      <th className="text-right py-2 px-3">Events</th>
                      <th className="text-right py-2 px-3">Crude (95% CI)</th>
                      <th className="text-right py-2 px-3">Std (95% CI)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {output.rateTable.map((r, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="py-1.5 px-3 font-mono">{r.stratum}</td>
                        <td className="py-1.5 px-3 text-right">{r.N.toLocaleString()}</td>
                        <td className="py-1.5 px-3 text-right">{r.person_years.toFixed(0)}</td>
                        <td className="py-1.5 px-3 text-right">{r.events}</td>
                        <td className="py-1.5 px-3 text-right font-mono">
                          {r.crude_rate.toFixed(2)} ({r.crude_ci_lo.toFixed(2)}–{r.crude_ci_hi.toFixed(2)})
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono">
                          {r.std_rate !== undefined && r.std_rate !== null
                            ? `${r.std_rate.toFixed(2)} (${(r.std_ci_lo ?? 0).toFixed(2)}–${(r.std_ci_hi ?? 0).toFixed(2)})`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "cif" && (
            <div>
              <h3 className="text-md font-bold text-gray-800 mb-3">Cumulative Incidence by Stratum</h3>
              {/* SVG line chart */}
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <svg viewBox="0 0 600 320" className="w-full h-72">
                  {/* axes */}
                  <line x1="60" y1="280" x2="580" y2="280" stroke="#9ca3af" />
                  <line x1="60" y1="20" x2="60" y2="280" stroke="#9ca3af" />
                  <text x="320" y="310" textAnchor="middle" fontSize="11" fill="#4b5563">Years from index date</text>
                  <text x="20" y="150" transform="rotate(-90 20,150)" textAnchor="middle" fontSize="11" fill="#4b5563">Cumulative incidence</text>
                  {/* y ticks */}
                  {[0, 0.25, 0.5, 0.75, 1].map((p) => {
                    const y = 280 - p * 260;
                    return (
                      <g key={p}>
                        <line x1="55" y1={y} x2="60" y2={y} stroke="#9ca3af" />
                        <text x="50" y={y + 3} textAnchor="end" fontSize="10" fill="#4b5563">
                          {(p * cifMax).toFixed(3)}
                        </text>
                      </g>
                    );
                  })}
                  {/* x ticks */}
                  {cifTimes.map((t, i) => {
                    const x = 60 + (i / Math.max(1, cifTimes.length - 1)) * 520;
                    return (
                      <g key={t}>
                        <line x1={x} y1="280" x2={x} y2="285" stroke="#9ca3af" />
                        <text x={x} y="297" textAnchor="middle" fontSize="10" fill="#4b5563">
                          {t}y
                        </text>
                      </g>
                    );
                  })}
                  {/* curves */}
                  {(Object.entries(cifByStratum) as Array<[string, Array<{ t: number; v: number }>]>).map(([stratum, pts], idx) => {
                    const color = COLORS[idx % COLORS.length];
                    const xFor = (t: number) => {
                      const i = cifTimes.indexOf(t);
                      return 60 + (i / Math.max(1, cifTimes.length - 1)) * 520;
                    };
                    const yFor = (v: number) => 280 - (v / cifMax) * 260;
                    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.t)} ${yFor(p.v)}`).join(" ");
                    return (
                      <g key={stratum}>
                        <path d={d} stroke={color} strokeWidth="2" fill="none" />
                        {pts.map((p, i) => (
                          <circle key={i} cx={xFor(p.t)} cy={yFor(p.v)} r="3" fill={color} />
                        ))}
                      </g>
                    );
                  })}
                </svg>
                {/* legend */}
                <div className="flex flex-wrap gap-3 mt-3 text-xs">
                  {Object.keys(cifByStratum).map((stratum, idx) => (
                    <div key={stratum} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-mono">{stratum}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
