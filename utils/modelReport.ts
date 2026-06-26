// 모델 분석보고서(ModelAnalysisReport) — 메타데이터 수집 + 결정적 폴백 HTML 조립.
//
// 이 모듈은 **데이터 분석이 아니라 문서화(메타) 모듈**이다. AI 산출물/폴백 HTML 모두
// codeSnippets/export/verify 대상이 아니다(Python 재현성 불변식과 무관).
// - gatherReportContext: report_in 연결에서 역방향으로 그래프를 거슬러 업스트림 모듈의
//   파라미터·출력 메타데이터를 수집한다(안전 가드: 없으면 생략).
// - buildModelReportHtmlFallback: AI 없이 ctx만으로 자기완결 HTML(인라인 CSS)을 조립한다.
//   창작 0, 메타데이터 직접 바인딩. 값 없으면 "(자료 없음)".

import { CanvasModule, Connection, ModuleType, ReportContext } from "../types";

/** HTML 특수문자 이스케이프(자기완결 HTML 안전 삽입용). */
export function escapeHtml(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NA = "(자료 없음)";

function fmtBool(v: any): string {
  if (v === true || v === "True" || v === "true") return "True";
  if (v === false || v === "False" || v === "false") return "False";
  return v === undefined || v === null ? NA : String(v);
}

function fmtNum(v: any): string {
  if (v === undefined || v === null || v === "") return NA;
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  // 정수는 그대로, 소수는 최대 4자리.
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(4);
}

// 모델 정의(지도/비지도) 모듈 유형 → 한글 라벨.
const MODEL_KIND_LABEL: Partial<Record<ModuleType, string>> = {
  [ModuleType.LinearRegression]: "Linear Regression(선형 회귀)",
  [ModuleType.LogisticRegression]: "Logistic Regression(로지스틱 회귀)",
  [ModuleType.DecisionTree]: "Decision Tree(의사결정나무)",
  [ModuleType.RandomForest]: "Random Forest(랜덤 포레스트)",
  [ModuleType.GradientBoosting]: "Gradient Boosting",
  [ModuleType.NeuralNetwork]: "Neural Network(신경망)",
  [ModuleType.SVM]: "SVM(서포트 벡터 머신)",
  [ModuleType.LDA]: "LDA(선형판별분석)",
  [ModuleType.NaiveBayes]: "Naive Bayes(나이브 베이즈)",
  [ModuleType.KNN]: "KNN(K-최근접 이웃)",
  [ModuleType.KMeans]: "K-Means(군집)",
  [ModuleType.DBSCAN]: "DBSCAN(밀도 기반 군집)",
  [ModuleType.HierarchicalClustering]: "Hierarchical(계층적 군집)",
  [ModuleType.PCA]: "PCA(주성분 분석)",
};

const MODEL_DEFINITION_TYPES = new Set<ModuleType>([
  ModuleType.LinearRegression,
  ModuleType.LogisticRegression,
  ModuleType.DecisionTree,
  ModuleType.RandomForest,
  ModuleType.GradientBoosting,
  ModuleType.NeuralNetwork,
  ModuleType.SVM,
  ModuleType.LDA,
  ModuleType.NaiveBayes,
  ModuleType.KNN,
  ModuleType.KMeans,
  ModuleType.DBSCAN,
  ModuleType.HierarchicalClustering,
  ModuleType.PCA,
  ModuleType.PrincipalComponentAnalysis,
]);

/**
 * report_in 연결에서 역방향으로 그래프를 거슬러 업스트림 메타데이터를 수집한다.
 * BFS로 모든 조상 모듈을 모은 뒤, 유형별로 필요한 정보를 추출한다.
 */
export function gatherReportContext(
  reportModule: CanvasModule,
  modules: CanvasModule[],
  connections: Connection[]
): ReportContext {
  const ctx: ReportContext = {};
  const byId = new Map(modules.map((m) => [m.id, m]));

  // 1) report_in으로 들어오는 연결에서 시작해 모든 조상(ancestors) BFS 수집.
  const ancestors: CanvasModule[] = [];
  const seen = new Set<string>();
  const queue: string[] = [];
  connections
    .filter((c) => c.to.moduleId === reportModule.id)
    .forEach((c) => queue.push(c.from.moduleId));

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const m = byId.get(id);
    if (!m) continue;
    ancestors.push(m);
    connections
      .filter((c) => c.to.moduleId === id)
      .forEach((c) => {
        if (!seen.has(c.from.moduleId)) queue.push(c.from.moduleId);
      });
  }

  // 발견된 모듈 유형별로 첫 번째(가장 가까운 것 우선 — ancestors는 BFS 순서) 선택.
  const find = (t: ModuleType) => ancestors.find((m) => m.type === t);

  // 2) LoadData — 데이터셋 메타.
  const loadData =
    find(ModuleType.LoadData) ||
    ancestors.find((m) => String(m.type).toLowerCase().includes("load"));
  if (loadData) {
    const src = String(loadData.parameters?.source || "").trim();
    ctx.dataSource = src || undefined;
    ctx.datasetName =
      src.replace(/\.[^.]+$/, "") || loadData.name || undefined;
    ctx.title = ctx.title || loadData.parameters?.dataDescription || undefined;
    const od: any = loadData.outputData;
    if (od && od.type === "DataPreview") {
      ctx.rowCount = od.totalRowCount;
      ctx.columnCount = od.columns?.length;
      if (Array.isArray(od.columns)) {
        const sampleRow = (od.rows && od.rows[0]) || {};
        ctx.columns = od.columns.map((c: any) => ({
          name: c.name,
          type: c.type,
          sample:
            sampleRow[c.name] !== undefined ? String(sampleRow[c.name]) : undefined,
        }));
      }
      if (Array.isArray(od.rows)) ctx.sampleRows = od.rows.slice(0, 5);
    }
  }

  // 2-b) 행/열 수 보강: LoadData 출력이 없거나 totalRowCount 미설정이면
  // 다른 조상의 DataPreview(직접/래퍼/Split train+test)에서 유추한다.
  // (보고서가 "(자료 없음)"으로 나오던 케이스 방지 — 어느 조상이든 실행됐으면 메타 확보)
  if (ctx.rowCount === undefined || ctx.columnCount === undefined || !ctx.columns) {
    const applyDp = (dp: any) => {
      if (!dp) return;
      if (ctx.rowCount === undefined && typeof dp.totalRowCount === "number") ctx.rowCount = dp.totalRowCount;
      if (ctx.columnCount === undefined && Array.isArray(dp.columns)) ctx.columnCount = dp.columns.length;
      if (!ctx.columns && Array.isArray(dp.columns)) {
        ctx.columns = dp.columns.map((c: any) => ({ name: c.name, type: c.type }));
      }
      if (!ctx.sampleRows && Array.isArray(dp.rows)) ctx.sampleRows = dp.rows.slice(0, 5);
    };
    for (const m of ancestors) {
      const od: any = m.outputData;
      if (!od) continue;
      if (od.type === "DataPreview") applyDp(od);
      else if (od.data && od.data.type === "DataPreview") applyDp(od.data);
      else if (od.type === "SplitDataOutput") {
        if (ctx.rowCount === undefined) {
          const tr = od.train?.totalRowCount ?? 0;
          const te = od.test?.totalRowCount ?? 0;
          if (tr || te) ctx.rowCount = tr + te;
        }
        applyDp(od.train);
      }
      if (ctx.rowCount !== undefined && ctx.columnCount !== undefined && ctx.columns) break;
    }
  }
  // 최후: columns만 있고 columnCount 미설정이면 보강.
  if (ctx.columnCount === undefined && Array.isArray(ctx.columns)) ctx.columnCount = ctx.columns.length;

  // 3) SplitData — 분할 설정.
  const split = find(ModuleType.SplitData);
  if (split) {
    const p = split.parameters || {};
    ctx.split = {
      train_size:
        p.train_size !== undefined ? Number(p.train_size) : undefined,
      random_state:
        p.random_state !== undefined && p.random_state !== null
          ? Number(p.random_state)
          : (p.random_state ?? null),
      shuffle: p.shuffle === undefined ? undefined : p.shuffle === "True" || p.shuffle === true,
      stratify: p.stratify === undefined ? undefined : p.stratify === "True" || p.stratify === true,
    };
  }

  // 4) 모델 정의 모듈 — 종류 + 하이퍼파라미터.
  const modelDef = ancestors.find((m) => MODEL_DEFINITION_TYPES.has(m.type));
  if (modelDef) {
    ctx.modelDefinition = {
      kind: MODEL_KIND_LABEL[modelDef.type] || String(modelDef.type),
      params: { ...(modelDef.parameters || {}) },
    };
  }

  // 5) TrainModel — feature/label, modelPurpose.
  const train = find(ModuleType.TrainModel);
  if (train) {
    const od: any = train.outputData;
    if (od && od.type === "TrainedModelOutput") {
      ctx.features = od.featureColumns;
      ctx.labelColumn = od.labelColumn;
      if (od.modelPurpose && !ctx.modelType) {
        ctx.modelType =
          od.modelPurpose === "classification" ? "분류(Classification)" : "회귀(Regression)";
      }
    } else {
      const p = train.parameters || {};
      if (Array.isArray(p.feature_columns)) ctx.features = p.feature_columns;
      if (p.label_column) ctx.labelColumn = p.label_column;
    }
  }

  // 6) EvaluateModel — 지표/혼동행렬/임계값.
  const evalMod = find(ModuleType.EvaluateModel);
  if (evalMod) {
    const od: any = evalMod.outputData;
    if (od && od.type === "EvaluationOutput") {
      ctx.metrics = od.metrics;
      if (od.modelType && !ctx.modelType) {
        ctx.modelType =
          od.modelType === "classification" ? "분류(Classification)" : "회귀(Regression)";
      }
      if (od.confusionMatrix) {
        ctx.confusionMatrix = {
          tp: od.confusionMatrix.tp,
          fp: od.confusionMatrix.fp,
          tn: od.confusionMatrix.tn,
          fn: od.confusionMatrix.fn,
        };
      }
      if (Array.isArray(od.thresholdMetrics) && od.thresholdMetrics.length) {
        // 대표 3개(낮음/기본/높음)만 보존.
        const tm = od.thresholdMetrics;
        const pick = [
          tm.find((t: any) => Math.abs(t.threshold - 0.2) < 0.051),
          tm.find((t: any) => Math.abs(t.threshold - 0.5) < 0.051),
          tm.find((t: any) => Math.abs(t.threshold - 0.8) < 0.051),
        ].filter(Boolean);
        ctx.thresholdMetrics = (pick.length ? pick : tm.slice(0, 5)).map(
          (t: any) => ({
            threshold: t.threshold,
            accuracy: t.accuracy,
            precision: t.precision,
            recall: t.recall,
            f1Score: t.f1Score,
          })
        );
      }
    }
  }

  // 7) 군집(해당시) — TrainClusteringModel / ClusteringData.
  const cluster =
    find(ModuleType.TrainClusteringModel) || find(ModuleType.ClusteringData);
  if (cluster) {
    const od: any = cluster.outputData;
    if (od && od.type === "TrainedClusteringModelOutput") {
      ctx.modelType = ctx.modelType || "군집(Clustering)";
      ctx.clustering = {
        k: od.centroids ? od.centroids.length : od.nClusters,
        inertia: od.inertia,
        nClusters: od.nClusters,
        nNoise: od.nNoise,
      };
      if (od.featureColumns && !ctx.features) ctx.features = od.featureColumns;
    } else if (od && od.type === "ClusteringDataOutput") {
      ctx.modelType = ctx.modelType || "군집(Clustering)";
      // 클러스터 분포 집계.
      const cd: any = od.clusteredData;
      if (cd && Array.isArray(cd.rows)) {
        const counts = new Map<string, number>();
        cd.rows.forEach((r: any) => {
          const k = String(r.cluster ?? r.Cluster ?? r.labels ?? "?");
          counts.set(k, (counts.get(k) || 0) + 1);
        });
        ctx.clustering = {
          ...(ctx.clustering || {}),
          distribution: Array.from(counts.entries())
            .map(([cluster, count]) => ({ cluster, count }))
            .sort((a, b) => a.cluster.localeCompare(b.cluster)),
        };
      }
    }
  }

  // 8) 모델 유형 최종 추론(없으면 모델 정의로).
  if (!ctx.modelType && ctx.modelDefinition?.kind) {
    ctx.modelType = ctx.modelDefinition.kind;
  }

  // 9) 파이프라인 단계 목록(업스트림 → 보고서 순서 근사: ancestors 역순).
  ctx.steps = ancestors
    .slice()
    .reverse()
    .map((m) => ({
      type: String(m.type),
      name: m.name,
      params: m.parameters || {},
    }));

  ctx.title =
    reportModule.parameters?.title?.trim() ||
    ctx.title ||
    (ctx.datasetName
      ? `${ctx.datasetName} · 모델 분석보고서`
      : "모델 분석보고서");

  return ctx;
}

// ---------------------------------------------------------------------------
// 결정적 폴백 HTML 조립 (AI 없이 ctx만으로). 예시 HTML과 동일 스타일(인라인 CSS).
// ---------------------------------------------------------------------------

const REPORT_CSS = `
  :root { --ink:#1e293b; --muted:#64748b; --line:#e2e8f0; --accent:#0891b2;
    --accent-soft:#ecfeff; --th:#f8fafc; --good:#16a34a; --warn:#d97706; --bad:#dc2626; --code-bg:#f1f5f9; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f1f5f9; color:var(--ink); line-height:1.65; font-size:15px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Roboto,sans-serif; }
  .report { max-width:880px; margin:32px auto; background:#fff; border:1px solid var(--line);
    border-radius:12px; padding:56px 64px; box-shadow:0 1px 3px rgba(15,23,42,.06); }
  .cover { border-bottom:2px solid var(--ink); padding-bottom:22px; margin-bottom:32px; }
  .cover h1 { font-size:30px; line-height:1.25; margin:0 0 10px; letter-spacing:-.01em; }
  .cover .sub { color:var(--muted); font-size:15px; margin:0; }
  .cover .meta { color:var(--muted); font-size:13px; margin-top:14px; }
  .badge { display:inline-block; font-size:12px; font-weight:600; padding:2px 9px; border-radius:999px;
    background:var(--accent-soft); color:var(--accent); }
  h2 { font-size:21px; margin:38px 0 14px; padding-left:12px; border-left:4px solid var(--accent); }
  h3 { font-size:16px; margin:24px 0 8px; color:#334155; }
  ul { margin:10px 0; padding-left:22px; } li { margin:5px 0; }
  code { font-family:"JetBrains Mono","Consolas","D2Coding",monospace; background:var(--code-bg);
    padding:1px 6px; border-radius:4px; font-size:.88em; }
  table { border-collapse:collapse; width:100%; margin:14px 0; font-size:14px; }
  th,td { border:1px solid var(--line); padding:8px 11px; text-align:left; vertical-align:top; }
  thead th { background:var(--th); font-weight:600; color:#334155; }
  td.num,th.num { text-align:right; font-variant-numeric:tabular-nums; }
  tbody tr:nth-child(even){ background:#fcfdfe; }
  .callout { border:1px solid var(--line); border-left:4px solid var(--accent); background:var(--accent-soft);
    border-radius:8px; padding:12px 16px; margin:16px 0; }
  .callout.warn { border-left-color:var(--warn); background:#fffbeb; }
  .callout .label { font-weight:700; color:#155e75; } .callout.warn .label { color:#92400e; }
  pre { background:#0f172a; color:#e2e8f0; border-radius:8px; padding:14px 16px; overflow-x:auto; font-size:13px; line-height:1.5; }
  pre code { background:none; color:inherit; padding:0; }
  .src { color:var(--muted); font-size:12.5px; font-style:italic; margin-top:6px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:16px 0; }
  .kpi { border:1px solid var(--line); border-radius:8px; padding:12px 14px; }
  .kpi .k { font-size:12px; color:var(--muted); } .kpi .v { font-size:20px; font-weight:700; font-variant-numeric:tabular-nums; }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:12.5px; }
  @media print { body{background:#fff;} .report{border:none;box-shadow:none;margin:0;max-width:none;padding:0;} }
`;

function kpiCards(metrics?: Record<string, number | string>): string {
  if (!metrics || !Object.keys(metrics).length) {
    return `<div class="kpi"><div class="k">지표</div><div class="v">${NA}</div></div>`;
  }
  return Object.entries(metrics)
    .slice(0, 9)
    .map(
      ([k, v]) =>
        `<div class="kpi"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(
          typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(4)) : v
        )}</div></div>`
    )
    .join("\n");
}

function datasetTable(ctx: ReportContext): string {
  return `<table><tbody>
    <tr><th>데이터셋 이름</th><td>${escapeHtml(ctx.datasetName || NA)}</td></tr>
    <tr><th>파일/출처</th><td><code>${escapeHtml(ctx.dataSource || NA)}</code></td></tr>
    <tr><th>행 수</th><td>${escapeHtml(fmtNum(ctx.rowCount))}</td></tr>
    <tr><th>열 수</th><td>${escapeHtml(fmtNum(ctx.columnCount))}</td></tr>
    <tr><th>모델 유형</th><td>${escapeHtml(ctx.modelType || NA)}</td></tr>
    <tr><th>타깃 변수</th><td>${escapeHtml(ctx.labelColumn ? `<code>${ctx.labelColumn}</code>` : NA)}</td></tr>
  </tbody></table>`;
}

function columnDictTable(ctx: ReportContext): string {
  if (!ctx.columns || !ctx.columns.length) {
    return `<p>${NA}</p>`;
  }
  const used = new Set((ctx.features || []).map((f) => f));
  const rows = ctx.columns
    .map((c, i) => {
      const isTarget = ctx.labelColumn && c.name === ctx.labelColumn;
      const usage = isTarget ? "타깃" : used.has(c.name) ? "사용" : "미사용";
      return `<tr><td class="num">${i + 1}</td><td><code>${escapeHtml(
        c.name
      )}</code></td><td>${escapeHtml(c.type || "")}</td><td>${escapeHtml(
        c.sample ?? ""
      )}</td><td>${usage}</td></tr>`;
    })
    .join("\n");
  return `<table><thead><tr><th class="num">#</th><th>컬럼명</th><th>유형</th><th>예시값</th><th>사용 여부</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function sampleRowsTable(ctx: ReportContext): string {
  if (!ctx.sampleRows || !ctx.sampleRows.length || !ctx.columns) return "";
  const cols = ctx.columns.slice(0, 8).map((c) => c.name);
  const head = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = ctx.sampleRows
    .map(
      (r) =>
        `<tr>${cols
          .map((c) => `<td>${escapeHtml(r[c] ?? "")}</td>`)
          .join("")}</tr>`
    )
    .join("\n");
  return `<h3>원본 데이터 표본 (처음 ${ctx.sampleRows.length}행)</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function targetSection(ctx: ReportContext): string {
  if (ctx.clustering) {
    const c = ctx.clustering;
    let dist = "";
    if (c.distribution && c.distribution.length) {
      dist =
        `<table><thead><tr><th>클러스터</th><th class="num">건수</th></tr></thead><tbody>` +
        c.distribution
          .map(
            (d) =>
              `<tr><td><code>${escapeHtml(d.cluster)}</code></td><td class="num">${escapeHtml(
                fmtNum(d.count)
              )}</td></tr>`
          )
          .join("") +
        `</tbody></table>`;
    }
    return `<ul>
      <li>군집 수(k): <b>${escapeHtml(fmtNum(c.k ?? c.nClusters))}</b></li>
      ${c.inertia !== undefined ? `<li>관성(Inertia): <b>${escapeHtml(fmtNum(c.inertia))}</b></li>` : ""}
      ${c.nNoise !== undefined ? `<li>노이즈 포인트(-1): <b>${escapeHtml(fmtNum(c.nNoise))}</b></li>` : ""}
    </ul>${dist}`;
  }
  if (ctx.classDistribution && ctx.classDistribution.length) {
    const rows = ctx.classDistribution
      .map(
        (d) =>
          `<tr><td><code>${escapeHtml(d.label)}</code></td><td class="num">${escapeHtml(
            fmtNum(d.count)
          )}</td><td class="num">${
            d.ratio !== undefined ? (d.ratio * 100).toFixed(1) + "%" : NA
          }</td></tr>`
      )
      .join("");
    return `<table><thead><tr><th>클래스</th><th class="num">건수</th><th class="num">비율</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<p>타깃 분포 정보가 메타데이터에 없습니다. ${NA}</p>`;
}

function pipelineDiagram(ctx: ReportContext): string {
  if (!ctx.steps || !ctx.steps.length) return NA;
  return ctx.steps
    .map((s, i) => `[${i + 1}] ${s.type}${s.name && s.name !== s.type ? ` (${s.name})` : ""}`)
    .join("  →  ");
}

/**
 * AI 프롬프트용으로 ReportContext에서 무거운/불필요 필드를 제거한다.
 * 특히 steps[].params.fileContent(원본 CSV 전체)가 JSON.stringify로 프롬프트에 섞이면
 * 토큰 한도(1M)를 초과해 400이 나므로 반드시 제거한다(폴백 pipelineSteps와 동일 제외).
 * 방어적으로 긴 문자열 파라미터도 잘라낸다. sampleRows는 5행으로 제한.
 */
export function sanitizeReportContextForPrompt(ctx: ReportContext): ReportContext {
  const HEAVY_KEYS = ["fileContent", "columnSelections", "_outlierOutput"];
  const cleanParams = (params: any): any => {
    if (!params || typeof params !== "object") return params;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      if (HEAVY_KEYS.includes(k)) continue;
      if (typeof v === "string" && v.length > 3000) {
        out[k] = v.slice(0, 3000) + "…(생략)";
        continue;
      }
      out[k] = v;
    }
    return out;
  };
  return {
    ...ctx,
    sampleRows: Array.isArray(ctx.sampleRows) ? ctx.sampleRows.slice(0, 5) : ctx.sampleRows,
    modelDefinition: ctx.modelDefinition
      ? { ...ctx.modelDefinition, params: cleanParams(ctx.modelDefinition.params) }
      : ctx.modelDefinition,
    steps: Array.isArray(ctx.steps)
      ? ctx.steps.map((s) => ({ ...s, params: cleanParams(s.params) }))
      : ctx.steps,
  };
}

function pipelineSteps(ctx: ReportContext): string {
  if (!ctx.steps || !ctx.steps.length) return `<p>${NA}</p>`;
  return ctx.steps
    .map((s) => {
      const keyParams = Object.entries(s.params || {})
        .filter(
          ([k, v]) =>
            v !== undefined &&
            v !== null &&
            v !== "" &&
            !["fileContent", "columnSelections", "_outlierOutput"].includes(k) &&
            !(Array.isArray(v) && v.length === 0) &&
            !(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
        )
        .slice(0, 8)
        .map(
          ([k, v]) =>
            `<code>${escapeHtml(k)}=${escapeHtml(
              Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : v
            )}</code>`
        )
        .join(", ");
      return `<h3>${escapeHtml(s.name || s.type)} <span style="color:#64748b;font-weight:400;">(${escapeHtml(
        s.type
      )})</span></h3><ul><li>주요 파라미터: ${keyParams || NA}</li></ul>`;
    })
    .join("\n");
}

function resultsSection(ctx: ReportContext): string {
  let html = "";
  if (ctx.confusionMatrix) {
    const cm = ctx.confusionMatrix;
    html += `<h3>혼동행렬 (Confusion Matrix)</h3>
    <table><thead><tr><th></th><th class="num">예측 음성</th><th class="num">예측 양성</th></tr></thead>
    <tbody>
      <tr><th>실제 음성</th><td class="num">TN = ${escapeHtml(fmtNum(cm.tn))}</td><td class="num">FP = ${escapeHtml(fmtNum(cm.fp))}</td></tr>
      <tr><th>실제 양성</th><td class="num">FN = ${escapeHtml(fmtNum(cm.fn))}</td><td class="num">TP = ${escapeHtml(fmtNum(cm.tp))}</td></tr>
    </tbody></table>`;
  }
  if (ctx.thresholdMetrics && ctx.thresholdMetrics.length) {
    const rows = ctx.thresholdMetrics
      .map(
        (t) =>
          `<tr><td class="num">${escapeHtml(fmtNum(t.threshold))}</td><td class="num">${escapeHtml(
            fmtNum(t.accuracy)
          )}</td><td class="num">${escapeHtml(fmtNum(t.precision))}</td><td class="num">${escapeHtml(
            fmtNum(t.recall)
          )}</td><td class="num">${escapeHtml(fmtNum(t.f1Score))}</td></tr>`
      )
      .join("");
    html += `<h3>임계값(Threshold) 조정 효과</h3>
    <table><thead><tr><th class="num">임계값</th><th class="num">Accuracy</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">F1</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (ctx.metrics && Object.keys(ctx.metrics).length) {
    const rows = Object.entries(ctx.metrics)
      .map(
        ([k, v]) =>
          `<tr><td>${escapeHtml(k)}</td><td class="num">${escapeHtml(
            typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(6)) : v
          )}</td></tr>`
      )
      .join("");
    html += `<h3>전체 지표</h3><table><thead><tr><th>지표</th><th class="num">값</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (!html) html = `<p>평가 결과 메타데이터가 없습니다. ${NA}</p>`;
  return html;
}

function splitBullets(ctx: ReportContext): string {
  if (!ctx.split) return "";
  const s = ctx.split;
  return `<li><b>데이터 분할:</b> <code>train_size=${escapeHtml(
    fmtNum(s.train_size)
  )}</code>, <code>random_state=${escapeHtml(
    s.random_state === null || s.random_state === undefined ? NA : String(s.random_state)
  )}</code>, <code>shuffle=${escapeHtml(fmtBool(s.shuffle))}</code>, <code>stratify=${escapeHtml(
    fmtBool(s.stratify)
  )}</code></li>`;
}

/** AI 없이 ReportContext만으로 자기완결 HTML 보고서를 조립한다(결정적, 창작 0). */
export function buildModelReportHtmlFallback(ctx: ReportContext): string {
  const generatedAt = ctx.generatedAt || new Date().toISOString().slice(0, 10);
  const title = ctx.title || "모델 분석보고서";
  const subtitle = ctx.datasetName
    ? `${escapeHtml(ctx.datasetName)} 데이터셋 · 모델 개발 과정 문서화`
    : "파이프라인 메타데이터 기반 모델 분석보고서";

  const featureNote =
    ctx.features && ctx.features.length
      ? `학습에 사용된 특성 ${ctx.features.length}개: ${ctx.features
          .map((f) => `<code>${escapeHtml(f)}</code>`)
          .join(", ")}.${
          ctx.columnCount
            ? ` 전체 ${ctx.columnCount}개 컬럼 중 나머지는 미사용(타깃·인코딩 미적용 등).`
            : ""
        }`
      : "사용/미사용 특성 정보가 메타데이터에 없습니다. (자료 없음)";

  const extra = ctx.extraInfo?.trim()
    ? `<h2>추가 정보 (사용자 제공)</h2><div class="callout">${escapeHtml(
        ctx.extraInfo.trim()
      ).replace(/\n/g, "<br/>")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<article class="report">
  <header class="cover">
    <div class="badge">모델 분석보고서</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${subtitle}</p>
    <p class="meta">생성: ${escapeHtml(generatedAt)} · 작성: ML Auto Flow · 모델 유형: ${escapeHtml(
    ctx.modelType || "(자료 없음)"
  )}</p>
  </header>

  <div class="callout"><span class="label">목적</span> — 본 문서는 이 파이프라인의 <b>① 데이터셋 구조</b>와 <b>② 모델 개발 과정·결과</b>를 자동 수집된 메타데이터로 정리한 것입니다. 모든 수치는 동일 파이프라인 실행 결과에서 가져왔습니다(창작 없음). API 키 미설정 또는 AI 생성 실패 시 제공되는 <b>결정적 폴백 보고서</b>입니다.</div>

  <h2>1. 요약</h2>
  <ul>
    <li><b>모델 유형:</b> ${escapeHtml(ctx.modelType || NA)}</li>
    <li><b>데이터:</b> ${escapeHtml(ctx.datasetName || NA)} (${escapeHtml(
    fmtNum(ctx.rowCount)
  )}행 × ${escapeHtml(fmtNum(ctx.columnCount))}열)</li>
    ${ctx.labelColumn ? `<li><b>타깃 변수:</b> <code>${escapeHtml(ctx.labelColumn)}</code></li>` : ""}
    ${
      ctx.modelDefinition?.kind
        ? `<li><b>모델:</b> ${escapeHtml(ctx.modelDefinition.kind)}</li>`
        : ""
    }
    ${splitBullets(ctx)}
  </ul>
  <div class="kpi-grid">${kpiCards(ctx.metrics)}</div>

  <h2>2. 데이터셋 개요</h2>
  ${datasetTable(ctx)}
  ${sampleRowsTable(ctx)}
  <p class="src">출처: ${escapeHtml(ctx.dataSource || NA)}</p>

  <h2>3. 변수(컬럼) 사전</h2>
  ${columnDictTable(ctx)}
  <div class="callout warn"><span class="label">사용/미사용 특성</span> — ${featureNote}</div>

  <h2>4. 타깃/클래스 분포</h2>
  ${targetSection(ctx)}

  <h2>5. 모델 개발 과정 (파이프라인)</h2>
  <pre><code>${escapeHtml(pipelineDiagram(ctx))}</code></pre>
  ${pipelineSteps(ctx)}

  <h2>6. 분석 결과와 해석</h2>
  ${resultsSection(ctx)}

  <h2>7. 재현성</h2>
  <ul>
    <li>캔버스 모듈은 브라우저 Python(Pyodide)으로 실행되고, "전체 코드 보기"는 외부에서 그대로 실행되는 standalone Python을 내보냅니다.</li>
    <li>난수는 분할/모델 시드(<code>random_state</code>)로 고정되어 동일 결과가 재현됩니다.</li>
    <li>본 보고서가 인용한 수치는 위 파이프라인의 결정적 실행 결과에서 직접 수집되었습니다.</li>
  </ul>

  <h2>8. 결론 및 한계</h2>
  <ul>
    <li>본 보고서는 자동 수집 메타데이터 기반으로 작성되었습니다. 메타데이터에 없는 항목은 "(자료 없음)"으로 표기됩니다.</li>
    ${
      ctx.features && ctx.columnCount && ctx.features.length < ctx.columnCount - 1
        ? `<li>전체 컬럼 중 일부만 특성으로 사용했습니다. 미사용 변수 인코딩·추가로 성능 개선 여지가 있습니다.</li>`
        : ""
    }
    <li>더 풍부한 해설(도메인 배경·개선 제안)은 상단 설정에서 Claude API 키를 입력하면 AI 생성 보고서로 보강됩니다.</li>
  </ul>
  ${extra}

  <footer>본 보고서는 ML Auto Flow의 실제 파이프라인 메타데이터를 기반으로 자동 생성되었습니다. · 모듈: <b>모델 분석보고서</b> · 생성 도구: ML Auto Flow (결정적 폴백)</footer>
</article>
</body>
</html>`;
}
