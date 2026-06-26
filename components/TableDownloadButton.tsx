import React from 'react';
import { ArrowDownTrayIcon } from './icons';
import { downloadRowsAsCsv, CsvColumn } from '../utils/csvExport';

interface TableDownloadButtonProps {
  /** Base file name (without extension). Sanitized automatically. */
  filename: string;
  /** Column definitions (name strings or {name} objects). Defines CSV column order. */
  columns: ReadonlyArray<CsvColumn>;
  /** Row objects keyed by column name. */
  rows: ReadonlyArray<Record<string, any>>;
  /** Tooltip text. */
  title?: string;
  /** Override the default button styling. */
  className?: string;
}

/**
 * Small reusable "CSV" download button placed next to a table title.
 * Disabled (dimmed) when there are no rows. Shared across all preview modals
 * so each individual table can be exported (in-app display only — does not
 * affect exported Python or reproducibility).
 */
export const TableDownloadButton: React.FC<TableDownloadButtonProps> = ({
  filename,
  columns,
  rows,
  title = 'CSV 다운로드',
  className,
}) => {
  const disabled = !rows || rows.length === 0;
  return (
    <button
      type="button"
      onClick={() => downloadRowsAsCsv(filename, columns, rows)}
      disabled={disabled}
      title={title}
      className={
        className ??
        'inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0'
      }
    >
      <ArrowDownTrayIcon className="w-4 h-4" />
      CSV
    </button>
  );
};
