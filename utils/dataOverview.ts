// 데이터 개요/요약 유틸 (작업1, docs/cross_app_io_improvements.md)
//
// 이미 로드된 미리보기 데이터(columns + rows)만으로 순수 TS에서 계산하는
// 읽기 전용 요약 헬퍼. Python/Pyodide를 호출하지 않으며, 새 모듈도 만들지 않는다.
// 행 수·열 수, 열별 추론 타입(수치형/범주형), 가용 행 내 결측/빈값 수를 산출한다.
//
// 주의: ML Auto Flow ↔ ML_Auto_Flow-JMDC 동일 코드 유지(공통 자산).

import type { ColumnInfo } from "../types";

export interface ColumnOverview {
  name: string;
  /** 원본 dtype 문자열(예: int64/float64/object) 또는 number/string */
  rawType: string;
  /** 추론 타입: 수치형 여부 */
  isNumeric: boolean;
  /** 표시용 타입 라벨(한국어) */
  typeLabel: string;
  /** 가용 행(미리보기 rows) 내 결측/빈값 수 */
  missingCount: number;
  /** 결측 비율(0~1). 가용 행이 0이면 0 */
  missingRatio: number;
}

export interface DataOverview {
  /** 전체 행 수(미리보기 표본이 아닌 totalRowCount 우선) */
  rowCount: number;
  /** 실제 결측 계산에 사용한 가용 행(표본) 수 */
  sampledRowCount: number;
  /** 열 수 */
  columnCount: number;
  /** 수치형 열 수 */
  numericCount: number;
  /** 범주형 열 수 */
  categoricalCount: number;
  /** 결측이 하나라도 있는 열 수(가용 행 기준) */
  columnsWithMissing: number;
  /** 가용 행 기준 총 결측 셀 수 */
  totalMissingCells: number;
  /** 열별 요약 */
  columns: ColumnOverview[];
}

// 컬럼 dtype이 수치형인지 판정한다(앱 전역 isNumericType와 동일 규칙).
const isNumericType = (t?: string): boolean => {
  if (!t) return false;
  const s = t.toLowerCase();
  return (
    s === "number" ||
    s.startsWith("int") ||
    s.startsWith("float") ||
    s.startsWith("uint") ||
    s.startsWith("double")
  );
};

const isMissingValue = (v: any): boolean =>
  v === null ||
  v === undefined ||
  v === "" ||
  (typeof v === "string" && v.trim() === "");

/**
 * 이미 로드된 미리보기 데이터에서 데이터 개요를 순수 TS로 계산한다.
 * @param columns ColumnInfo 배열
 * @param rows 미리보기 행(표본). 결측 계산에 사용
 * @param totalRowCount 전체 행 수(있으면 표시에 우선). 없으면 rows.length
 * @returns 데이터가 없으면 null
 */
export function computeDataOverview(
  columns: ColumnInfo[] | undefined | null,
  rows: Record<string, any>[] | undefined | null,
  totalRowCount?: number
): DataOverview | null {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  const safeRows = Array.isArray(rows) ? rows : [];
  const sampledRowCount = safeRows.length;

  let numericCount = 0;
  let columnsWithMissing = 0;
  let totalMissingCells = 0;

  const columnOverviews: ColumnOverview[] = columns
    .filter((c) => c && typeof c.name === "string")
    .map((c) => {
      const numeric = isNumericType(c.type);
      if (numeric) numericCount++;

      let missingCount = 0;
      for (const r of safeRows) {
        if (!r || isMissingValue(r[c.name])) missingCount++;
      }
      if (missingCount > 0) columnsWithMissing++;
      totalMissingCells += missingCount;

      return {
        name: c.name,
        rawType: c.type || "",
        isNumeric: numeric,
        typeLabel: numeric ? "수치형" : "범주형",
        missingCount,
        missingRatio:
          sampledRowCount > 0 ? missingCount / sampledRowCount : 0,
      };
    });

  const columnCount = columnOverviews.length;

  return {
    rowCount:
      typeof totalRowCount === "number" && totalRowCount >= 0
        ? totalRowCount
        : sampledRowCount,
    sampledRowCount,
    columnCount,
    numericCount,
    categoricalCount: columnCount - numericCount,
    columnsWithMissing,
    totalMissingCells,
    columns: columnOverviews,
  };
}
