import React, { useState, useMemo } from "react";
import { CanvasModule, JMDCCohortOutput } from "../types";
import { XCircleIcon, ArrowDownTrayIcon } from "./icons";

interface Props {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
}

export const JMDCCohortPreviewModal: React.FC<Props> = ({ module, projectName, onClose }) => {
  const output = module.outputData as JMDCCohortOutput | undefined;
  if (!output || output.type !== "JMDCCohortOutput") return null;

  const [tab, setTab] = useState<"funnel" | "demographics" | "exclusions" | "preview">("funnel");

  const funnelMax = Math.max(1, ...output.funnel.map((s) => s.remaining));

  const sexEntries = useMemo(
    () => Object.entries(output.sexDistribution).sort(([a], [b]) => a.localeCompare(b)),
    [output.sexDistribution]
  );
  const ageEntries = useMemo(() => {
    const order = ["<30", "30-39", "40-49", "50-59", "60-69", "70+"];
    return order
      .filter((k) => k in output.ageBandDistribution)
      .map((k) => [k, output.ageBandDistribution[k]] as [string, number]);
  }, [output.ageBandDistribution]);
  const exclEntries = useMemo(
    () => Object.entries(output.exclusionReasons),
    [output.exclusionReasons]
  );

  const downloadCsv = () => {
    if (!output.rows.length) return;
    const cols = output.columns.map((c) => c.name);
    const header = cols.join(",");
    const lines = output.rows.map((r) =>
      cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "cohort"}_${module.name || "J1"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: Array<[typeof tab, string]> = [
    ["funnel", "Funnel"],
    ["demographics", "Demographics"],
    ["exclusions", "Exclusions"],
    ["preview", "Preview"],
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">[J1] JMDC Cohort Builder: {module.name}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Source: <span className="font-mono">{output.dataSource}</span> · Final N ={" "}
              <span className="font-semibold">{output.totalRowCount.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              <ArrowDownTrayIcon className="w-4 h-4" /> CSV
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="flex">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 px-4 py-3 text-sm font-semibold ${
                  tab === id ? "bg-blue-600 text-white border-b-2 border-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-grow p-6 overflow-auto">
          {tab === "funnel" && (
            <div className="space-y-3">
              <h3 className="text-md font-bold text-gray-800">Cohort Funnel</h3>
              {output.funnel.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{s.step}</span>
                    <span className="font-mono text-gray-700">{s.remaining.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full"
                      style={{ width: `${(s.remaining / funnelMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "demographics" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-md font-bold text-gray-800 mb-3">Sex Distribution</h3>
                {sexEntries.map(([k, v]) => (
                  <div key={k} className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-mono">{k}</span>
                      <span>{v.toLocaleString()} ({((v / output.totalRowCount) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(v / output.totalRowCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-md font-bold text-gray-800 mb-3">Age Band Distribution</h3>
                {ageEntries.map(([k, v]) => (
                  <div key={k} className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-mono">{k}</span>
                      <span>{v.toLocaleString()} ({((v / output.totalRowCount) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(v / output.totalRowCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "exclusions" && (
            <div>
              <h3 className="text-md font-bold text-gray-800 mb-3">Exclusion Reasons</h3>
              {exclEntries.length === 0 ? (
                <p className="text-gray-500">No exclusions recorded.</p>
              ) : (
                <table className="w-full text-sm border border-gray-200 rounded">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left py-2 px-3">Reason</th>
                      <th className="text-right py-2 px-3">Members Excluded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exclEntries.map(([k, v]) => (
                      <tr key={k} className="border-t border-gray-200">
                        <td className="py-2 px-3 font-mono">{k}</td>
                        <td className="py-2 px-3 text-right">{v.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "preview" && (
            <div>
              <h3 className="text-md font-bold text-gray-800 mb-3">Cohort Preview (top 100 rows)</h3>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {output.columns.map((c) => (
                        <th key={c.name} className="text-left py-2 px-3 font-semibold whitespace-nowrap">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {output.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t border-gray-200 hover:bg-gray-50">
                        {output.columns.map((c) => (
                          <td key={c.name} className="py-1.5 px-3 font-mono whitespace-nowrap">
                            {String(r[c.name] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
