import { CanvasModule } from '../types';

interface CsvData {
  rows: Record<string, any>[];
  columns: Array<{ name: string; type?: string }>;
}

/** A column for a downloadable table: either a name string or an object with a `name`. */
export type CsvColumn = { name: string; type?: string } | string;

/** Sanitize an arbitrary label into a safe file base name (keeps Korean letters). */
function safeFileName(baseName: string): string {
  return (baseName || 'table').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
}

/**
 * Generic, table-level CSV download. Accepts arbitrary columns + rows so any
 * preview modal can give individual tables (data, stats, distance matrices, …)
 * their own download button. UTF-8 BOM is prepended for Excel compatibility.
 * No-op when there are no rows.
 */
export function downloadRowsAsCsv(
  baseName: string,
  columns: ReadonlyArray<CsvColumn>,
  rows: ReadonlyArray<Record<string, any>>
): void {
  if (!rows || rows.length === 0) return;
  const cols = columns.map(c => (typeof c === 'string' ? { name: c } : c));
  const csv = toCsvString({ rows: rows as Record<string, any>[], columns: cols });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(baseName)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Check if module has SplitData output with separate train/test sets. */
export function isSplitDataModule(module: CanvasModule): boolean {
  return (module.outputData as any)?.type === 'SplitDataOutput';
}

/** Download train or test set from a SplitData module. */
export function downloadSplitDataAsCsv(module: CanvasModule, split: 'train' | 'test'): void {
  const od = module.outputData as any;
  if (!od || od.type !== 'SplitDataOutput') return;
  const target = split === 'train' ? od.train : od.test;
  if (!target?.rows?.length) return;
  const data: CsvData = { rows: target.rows, columns: target.columns || [] };
  const csv = toCsvString(data);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${module.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_${split}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Extract downloadable tabular data from a module's outputData. Returns null if none available. */
export function getModuleCsvData(module: CanvasModule): CsvData | null {
  const od = module.outputData as any;
  if (!od) return null;

  // Direct DataPreview
  if (od.type === 'DataPreview' && Array.isArray(od.rows) && od.rows.length > 0) {
    return { rows: od.rows, columns: od.columns || [] };
  }

  // SplitDataOutput — skip single download (handled by isSplitDataModule/downloadSplitDataAsCsv)
  if (od.type === 'SplitDataOutput') return null;

  // Wrapper outputs (MissingHandlerOutput, EncoderOutput, NormalizerOutput, etc.)
  if (od.data?.type === 'DataPreview' && Array.isArray(od.data.rows) && od.data.rows.length > 0) {
    return { rows: od.data.rows, columns: od.data.columns || [] };
  }

  // KMeansOutput / ClusteringDataOutput
  const clusterTarget = od.clusterAssignments || od.clusteredData;
  if (clusterTarget?.rows?.length > 0) {
    return { rows: clusterTarget.rows, columns: clusterTarget.columns || [] };
  }

  // PCAOutput
  if (od.transformedData?.rows?.length > 0) {
    return { rows: od.transformedData.rows, columns: od.transformedData.columns || [] };
  }

  return null;
}

/** Convert rows+columns to a CSV string. */
function toCsvString(data: CsvData): string {
  const colNames = data.columns.map(c => c.name);
  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = colNames.map(escape).join(',');
  const body = data.rows.map(row => colNames.map(col => escape(row[col])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/** Trigger a browser download of the module's output data as CSV. */
export function downloadModuleDataAsCsv(module: CanvasModule): void {
  const data = getModuleCsvData(module);
  if (!data) return;

  const csv = toCsvString(data);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${module.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
