import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  CanvasModule,
  ColumnInfo,
  DataPreview,
  ModuleType,
  Connection,
  JoinOutput,
  ConcatOutput,
  VIFCheckerOutput,
} from "../types";
import {
  XCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
} from "./icons";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SpreadViewModal } from "./SpreadViewModal";
import { DataOverviewPanel } from "./DataOverviewPanel";
import { TableDownloadButton } from "./TableDownloadButton";

interface DataPreviewModalProps {
    module: CanvasModule;
    projectName: string;
    onClose: () => void;
    modules?: CanvasModule[];
    connections?: Connection[];
}

type SortConfig = {
    key: string;
  direction: "ascending" | "descending";
} | null;

// 컬럼 dtype이 수치형인지 판정한다. pyodide가 컬럼 type에 pandas dtype 문자열
// ('int64'/'float64'/'object' 등)을 넣으므로 '=== "number"'로는 매칭되지 않는다.
// (App.tsx 등 다른 경로와 동일하게 startsWith로 판정 + 정규화된 'number'도 허용.)
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

// Statistics 모듈의 CorrelationHeatmap 컴포넌트 (Load Data 모듈용)
const CorrelationHeatmap: React.FC<{
  matrix: Record<string, Record<string, number>>;
}> = ({ matrix }) => {
    const columns = Object.keys(matrix);
    
    const getColor = (value: number) => {
        const alpha = Math.abs(value);
        if (value > 0) return `rgba(59, 130, 246, ${alpha})`; // Blue for positive
        return `rgba(239, 68, 68, ${alpha})`; // Red for negative
    };

    return (
        <div className="p-2">
            <div className="flex text-xs font-bold">
                <div className="w-20 flex-shrink-0"></div>
        {columns.map((col) => (
          <div key={col} className="flex-1 text-center truncate" title={col}>
            {col}
            </div>
        ))}
      </div>
      {columns.map((rowCol) => (
                <div key={rowCol} className="flex items-center text-xs">
          <div className="w-20 flex-shrink-0 font-bold truncate" title={rowCol}>
            {rowCol}
          </div>
          {columns.map((colCol) => (
                        <div key={`${rowCol}-${colCol}`} className="flex-1 p-0.5">
                            <div
                                className="w-full h-6 rounded-sm flex items-center justify-center text-white font-mono"
                style={{
                  backgroundColor: getColor(matrix[rowCol]?.[colCol] || 0),
                }}
                title={`${rowCol} vs ${colCol}: ${(
                  matrix[rowCol]?.[colCol] || 0
                ).toFixed(5)}`}
                            >
                                {(matrix[rowCol]?.[colCol] || 0).toFixed(5)}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

// Statistics 모듈의 Pairplot Cell 컴포넌트 (Load Data 모듈용)
const PairplotCell: React.FC<{ 
    row: number; 
    col: number; 
    displayColumns: string[]; 
    correlation: Record<string, Record<string, number>>;
    rows: Record<string, any>[];
}> = ({ row, col, displayColumns, correlation, rows }) => {
    const colNameX = displayColumns[col];
    const colNameY = displayColumns[row];

  if (row === col) {
    // Diagonal -> Histogram
    const columnData = rows
      .map((r) => parseFloat(r[colNameX]))
      .filter((v) => !isNaN(v));
        if (columnData.length === 0) {
            return (
                <div className="w-full h-full border border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                    No data
                </div>
            );
        }
        const min = Math.min(...columnData);
        const max = Math.max(...columnData);
        const numBins = 10;
        const binSize = (max - min) / numBins || 1;
        const bins = Array(numBins).fill(0);
        
        for (const value of columnData) {
            let binIndex = binSize > 0 ? Math.floor((value - min) / binSize) : 0;
            if (binIndex === numBins) binIndex--;
            if (binIndex >= 0 && binIndex < numBins) {
                bins[binIndex]++;
            }
        }
        
        const maxBinCount = Math.max(...bins, 1);
        
        return (
            <div className="w-full h-full border border-gray-300 rounded flex items-end justify-around gap-px p-1 bg-gray-100">
                {bins.map((count, i) => (
                    <div 
                        key={i} 
                        className="bg-gray-400 w-full" 
                        style={{ height: `${(count / maxBinCount) * 100}%` }}
                    />
                ))}
            </div>
        );
  } else {
    // Off-diagonal -> Scatter plot
        const corrValue = correlation[colNameY]?.[colNameX] || 0;
    const xData = rows
      .map((r) => parseFloat(r[colNameX]))
      .filter((v) => !isNaN(v));
    const yData = rows
      .map((r) => parseFloat(r[colNameY]))
      .filter((v) => !isNaN(v));
        
        if (xData.length === 0 || yData.length === 0) {
            return (
                <div className="w-full h-full border border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                    No data
                </div>
            );
        }
        
        const xMin = Math.min(...xData);
        const xMax = Math.max(...xData);
        const yMin = Math.min(...yData);
        const yMax = Math.max(...yData);
        
        const xRange = xMax - xMin || 1;
        const yRange = yMax - yMin || 1;
        
    const points = xData
      .map((x, i) => {
            const y = yData[i];
            return {
                x: ((x - xMin) / xRange) * 100,
          y: ((y - yMin) / yRange) * 100,
            };
      })
      .slice(0, 100); // 최대 100개 포인트만 표시
        
        return (
            <div className="w-full h-full border border-gray-300 rounded p-1 relative">
                <div className="absolute top-0 left-0 text-xs font-semibold text-gray-700 px-1 bg-white bg-opacity-75 rounded">
                    r = {corrValue.toFixed(2)}
                </div>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          className="overflow-visible"
        >
                    {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={100 - p.y}
              r="1.5"
              fill="#3b82f6"
              opacity="0.6"
            />
                    ))}
                </svg>
            </div>
        );
    }
};

// Statistics 모듈의 Pairplot 컴포넌트 (Load Data 모듈용)
const Pairplot: React.FC<{ 
    correlation: Record<string, Record<string, number>>;
    numericColumns: string[];
    rows: Record<string, any>[];
}> = ({ correlation, numericColumns, rows }) => {
    if (numericColumns.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No numeric columns to display in pairplot.
      </p>
    );
    }
    const displayColumns = numericColumns.slice(0, 15); 

    const gridStyle: React.CSSProperties = {
    display: "grid",
        gridTemplateColumns: `repeat(${displayColumns.length}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${displayColumns.length}, minmax(0, 1fr))`,
    gap: "8px",
    };
    
    return (
        <div>
            {displayColumns.length < numericColumns.length && (
        <p className="text-sm text-gray-500 mb-2">
          Displaying first {displayColumns.length} of {numericColumns.length}{" "}
          numeric columns for brevity.
        </p>
            )}
            <div className="flex">
                <div className="flex flex-col justify-around w-20 text-xs font-bold text-right pr-2">
          {displayColumns.map((col) => (
            <div key={col} className="truncate" title={col}>
              {col}
                </div>
          ))}
        </div>
        <div className="flex-1" style={{ aspectRatio: "1 / 1" }}>
                    <div style={gridStyle} className="w-full h-full">
                        {displayColumns.map((_, rowIndex) => 
                            displayColumns.map((_, colIndex) => (
                                <PairplotCell 
                                    key={`${rowIndex}-${colIndex}`} 
                                    row={rowIndex} 
                                    col={colIndex} 
                                    displayColumns={displayColumns} 
                                    correlation={correlation}
                                    rows={rows}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
            <div className="flex">
                <div className="w-20"></div>
                <div className="flex-1 flex justify-around text-xs font-bold text-center pt-2">
          {displayColumns.map((col) => (
            <div key={col} className="truncate" title={col}>
              {col}
            </div>
          ))}
                </div>
            </div>
        </div>
    );
};

const HistogramPlot: React.FC<{
  rows: Record<string, any>[];
  column: string;
}> = ({ rows, column }) => {
  const data = useMemo(() => rows.map((r) => r[column]), [rows, column]);
  const numericData = useMemo(
    () => data.map((v) => parseFloat(v as string)).filter((v) => !isNaN(v)),
    [data]
  );

    if (numericData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No numeric data in this column to plot.
      </div>
    );
    }

    const { bins } = useMemo(() => {
        const min = Math.min(...numericData);
        const max = Math.max(...numericData);
        const numBins = 10;
        const binSize = (max - min) / numBins;
        const bins = Array(numBins).fill(0);

        for (const value of numericData) {
            let binIndex = binSize > 0 ? Math.floor((value - min) / binSize) : 0;
            if (binIndex === numBins) binIndex--;
            if (binIndex >= 0 && binIndex < numBins) {
                bins[binIndex]++;
            }
        }
        return { bins };
    }, [numericData]);
    
    const maxBinCount = Math.max(...bins, 0);

    return (
        <div className="w-full h-full p-4 flex flex-col border border-gray-200 rounded-lg">
             <div className="flex-grow flex items-center gap-2 overflow-hidden">
                {/* Y-axis Label */}
                <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-gray-600 font-semibold transform -rotate-90 whitespace-nowrap">
                        Frequency
                    </p>
                </div>
                
                {/* Plot area */}
                <div className="flex-grow h-full flex flex-col">
                    <div className="flex-grow flex items-end justify-around gap-1 pt-4">
                        {bins.map((count, index) => {
              const heightPercentage =
                maxBinCount > 0 ? (count / maxBinCount) * 100 : 0;
                            return (
                <div
                  key={index}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative"
                  title={`Count: ${count}`}
                >
                  <span className="absolute -top-5 text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {count}
                  </span>
                                    <div 
                                        className="w-full bg-blue-400 hover:bg-blue-500 transition-colors"
                                        style={{ height: `${heightPercentage}%` }}
                  ></div>
                                </div>
                            );
                        })}
                    </div>
                    {/* X-axis Label */}
                    <div className="w-full text-center text-sm text-gray-600 font-semibold mt-2 border-t pt-1">
                        {column}
                    </div>
                </div>
             </div>
        </div>
    );
};

const ScatterPlot: React.FC<{
  rows: Record<string, any>[];
  xCol: string;
  yCol: string;
}> = ({ rows, xCol, yCol }) => {
  const dataPoints = useMemo(
    () =>
      rows
        .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
        .filter((p) => !isNaN(p.x) && !isNaN(p.y)),
    [rows, xCol, yCol]
  );

    if (dataPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No valid data points for scatter plot.
      </div>
    );
    }

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = 600;
    const height = 400;

  const xMin = Math.min(...dataPoints.map((d) => d.x));
  const xMax = Math.max(...dataPoints.map((d) => d.x));
  const yMin = Math.min(...dataPoints.map((d) => d.y));
  const yMax = Math.max(...dataPoints.map((d) => d.y));

  const xScale = (x: number) =>
    margin.left +
    ((x - xMin) / (xMax - xMin || 1)) * (width - margin.left - margin.right);
  const yScale = (y: number) =>
    height -
    margin.bottom -
    ((y - yMin) / (yMax - yMin || 1)) * (height - margin.top - margin.bottom);
    
    const getTicks = (min: number, max: number, count: number) => {
        if (min === max) return [min];
        const ticks = [];
        const step = (max - min) / (count - 1);
        for (let i = 0; i < count; i++) {
            ticks.push(min + i * step);
        }
        return ticks;
    };
    
    const xTicks = getTicks(xMin, xMax, 5);
    const yTicks = getTicks(yMin, yMax, 5);

    return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto max-w-full"
    >
            {/* Axes */}
      <line
        x1={margin.left}
        y1={height - margin.bottom}
        x2={width - margin.right}
        y2={height - margin.bottom}
        stroke="currentColor"
        strokeWidth="1"
      />
      <line
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={height - margin.bottom}
        stroke="currentColor"
        strokeWidth="1"
      />

            {/* X Ticks and Labels */}
            {xTicks.map((tick, i) => (
        <g
          key={`x-${i}`}
          transform={`translate(${xScale(tick)}, ${height - margin.bottom})`}
        >
                    <line y2="5" stroke="currentColor" strokeWidth="1" />
          <text y="20" textAnchor="middle" fill="currentColor" fontSize="10">
            {tick.toFixed(1)}
          </text>
                </g>
            ))}
      <text
        x={width / 2}
        y={height - 5}
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="bold"
      >
        {xCol}
      </text>
            
            {/* Y Ticks and Labels */}
            {yTicks.map((tick, i) => (
        <g
          key={`y-${i}`}
          transform={`translate(${margin.left}, ${yScale(tick)})`}
        >
                    <line x2="-5" stroke="currentColor" strokeWidth="1" />
          <text
            x="-10"
            y="3"
            textAnchor="end"
            fill="currentColor"
            fontSize="10"
          >
            {tick.toFixed(1)}
          </text>
                </g>
            ))}
      <text
        transform={`translate(${15}, ${height / 2}) rotate(-90)`}
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="bold"
      >
        {yCol}
      </text>

            {/* Points */}
            <g>
                {dataPoints.map((d, i) => (
          <circle
            key={i}
            cx={xScale(d.x)}
            cy={yScale(d.y)}
            r="2.5"
            fill="rgba(59, 130, 246, 0.7)"
          />
                ))}
            </g>
        </svg>
    );
};

// 상관계수 계산 함수
const calculateCorrelation = (x: number[], y: number[]): number => {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    
    const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );
    
    if (denominator === 0) return 0;
    return numerator / denominator;
};

// 상관계수 행렬 계산
const calculateCorrelationMatrix = (
  rows: Record<string, any>[],
  numericColumns: string[]
): number[][] => {
    const matrix: number[][] = [];
    
    for (let i = 0; i < numericColumns.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < numericColumns.length; j++) {
            if (i === j) {
                matrix[i][j] = 1;
            } else {
                const col1 = numericColumns[i];
                const col2 = numericColumns[j];
        const values1 = rows
          .map((r) => Number(r[col1]))
          .filter((v) => !isNaN(v));
        const values2 = rows
          .map((r) => Number(r[col2]))
          .filter((v) => !isNaN(v));
                
                // 길이가 같은 값들만 사용
                const minLength = Math.min(values1.length, values2.length);
                const valid1 = values1.slice(0, minLength);
                const valid2 = values2.slice(0, minLength);
                
                matrix[i][j] = calculateCorrelation(valid1, valid2);
            }
        }
    }
    
    return matrix;
};

// 작은 히스토그램 플롯 (Pairplot 대각선용)
const SmallHistogram: React.FC<{
  rows: Record<string, any>[];
  column: string;
}> = ({ rows, column }) => {
  const data = useMemo(() => rows.map((r) => r[column]), [rows, column]);
  const numericData = useMemo(
    () => data.map((v) => parseFloat(v as string)).filter((v) => !isNaN(v)),
    [data]
  );

    if (numericData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        No data
      </div>
    );
    }

    const { bins } = useMemo(() => {
        const min = Math.min(...numericData);
        const max = Math.max(...numericData);
        const numBins = 10;
        const binSize = (max - min) / numBins;
        const bins = Array(numBins).fill(0);

        for (const value of numericData) {
            let binIndex = binSize > 0 ? Math.floor((value - min) / binSize) : 0;
            if (binIndex === numBins) binIndex--;
            if (binIndex >= 0 && binIndex < numBins) {
                bins[binIndex]++;
            }
        }
        return { bins };
    }, [numericData]);
    
    const maxBinCount = Math.max(...bins, 0);

    return (
        <div className="w-full h-full p-2">
            <div className="flex-grow flex items-end justify-around gap-0.5 h-full">
                {bins.map((count, index) => {
          const heightPercentage =
            maxBinCount > 0 ? (count / maxBinCount) * 100 : 0;
                    return (
            <div
              key={index}
              className="flex-1 h-full flex flex-col justify-end items-center"
            >
                            <div 
                                className="w-full bg-blue-400"
                                style={{ height: `${heightPercentage}%` }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// 작은 산점도 플롯 (Pairplot용)
const SmallScatterPlot: React.FC<{
  rows: Record<string, any>[];
  xCol: string;
  yCol: string;
}> = ({ rows, xCol, yCol }) => {
  const dataPoints = useMemo(
    () =>
      rows
        .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
        .filter((p) => !isNaN(p.x) && !isNaN(p.y)),
    [rows, xCol, yCol]
  );

    if (dataPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        No data
      </div>
    );
    }

    const margin = { top: 5, right: 5, bottom: 20, left: 20 };
    const width = 120;
    const height = 120;

  const xMin = Math.min(...dataPoints.map((d) => d.x));
  const xMax = Math.max(...dataPoints.map((d) => d.x));
  const yMin = Math.min(...dataPoints.map((d) => d.y));
  const yMax = Math.max(...dataPoints.map((d) => d.y));

  const xScale = (x: number) =>
    margin.left +
    ((x - xMin) / (xMax - xMin || 1)) * (width - margin.left - margin.right);
  const yScale = (y: number) =>
    height -
    margin.bottom -
    ((y - yMin) / (yMax - yMin || 1)) * (height - margin.top - margin.bottom);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            {/* Axes */}
      <line
        x1={margin.left}
        y1={height - margin.bottom}
        x2={width - margin.right}
        y2={height - margin.bottom}
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <line
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={height - margin.bottom}
        stroke="currentColor"
        strokeWidth="0.5"
      />

            {/* Points */}
            <g>
                {dataPoints.map((d, i) => (
          <circle
            key={i}
            cx={xScale(d.x)}
            cy={yScale(d.y)}
            r="1.5"
            fill="rgba(59, 130, 246, 0.6)"
          />
                ))}
            </g>
        </svg>
    );
};

// Pairplot 컴포넌트
const CorrelationPlots: React.FC<{ 
    correlationMatrix: number[][]; 
    columnNames: string[];
    rows: Record<string, any>[];
}> = ({ correlationMatrix, columnNames, rows }) => {
    const numCols = columnNames.length;
    
    return (
        <div className="w-full overflow-auto">
            <div 
                className="inline-grid gap-1 border border-gray-300 p-2 bg-white"
                style={{ 
                    gridTemplateColumns: `repeat(${numCols}, minmax(120px, 1fr))`,
          gridTemplateRows: `repeat(${numCols}, minmax(120px, 1fr))`,
                }}
            >
                {columnNames.map((colY, rowIdx) =>
                    columnNames.map((colX, colIdx) => {
                        const isDiagonal = rowIdx === colIdx;
                        const isUpperTriangle = rowIdx < colIdx;
                        const isLowerTriangle = rowIdx > colIdx;
                        
                        return (
                            <div 
                                key={`${rowIdx}-${colIdx}`}
                                className="border border-gray-200 rounded bg-white relative"
                style={{ minWidth: "120px", minHeight: "120px" }}
                            >
                                {isDiagonal ? (
                                    // 대각선: 히스토그램
                                    <>
                                        <div className="absolute top-1 left-1 text-xs font-semibold text-gray-700 z-10">
                      {colX.length > 10 ? colX.substring(0, 10) + "..." : colX}
                                        </div>
                                        <SmallHistogram rows={rows} column={colX} />
                                    </>
                                ) : isUpperTriangle ? (
                                    // 위쪽 삼각형: 산점도 (상관계수 표시)
                                    <>
                                        <div className="absolute top-1 left-1 text-xs font-semibold text-gray-700 z-10">
                                            r = {correlationMatrix[rowIdx][colIdx].toFixed(2)}
                                        </div>
                                        <SmallScatterPlot rows={rows} xCol={colX} yCol={colY} />
                                    </>
                                ) : (
                                    // 아래쪽 삼각형: 산점도 (상관계수 표시)
                                    <>
                                        <div className="absolute top-1 left-1 text-xs font-semibold text-gray-700 z-10">
                                            r = {correlationMatrix[rowIdx][colIdx].toFixed(2)}
                                        </div>
                                        <SmallScatterPlot rows={rows} xCol={colX} yCol={colY} />
                                    </>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

// Prep Missing 처리 내용 표시 컴포넌트
const PrepMissingProcessingInfo: React.FC<{
  module: CanvasModule;
  inputData: DataPreview | null;
  outputData: DataPreview | null;
  modules: CanvasModule[];
  connections: Connection[];
  baseName: string;
}> = ({ module, inputData, outputData, baseName }) => {
  const { method, strategy, n_neighbors, columnSelections } = module.parameters;
  const selectedColumns = React.useMemo(() => {
    if (!inputData || !Array.isArray(inputData.columns)) return [];
    return inputData.columns
      .filter((col) => {
        if (!col) return false;
        const selection = columnSelections?.[col.name];
        return selection?.selected !== false;
      })
      .map((col) => col.name);
  }, [inputData, columnSelections]);

  const processingInfo = React.useMemo(() => {
    if (!inputData || !outputData) return [];
    if (!Array.isArray(inputData.columns) || !Array.isArray(outputData.columns))
      return [];

    const info: Array<{
      column: string;
      method: string;
      removedRows?: number;
      imputedCount?: number;
      imputedValue?: number | string;
    }> = [];

    if (method === "remove_row") {
      const removedCount = inputData.totalRowCount - outputData.totalRowCount;
      if (selectedColumns.length > 0) {
        selectedColumns.forEach((col) => {
          info.push({
            column: col,
            method: "remove_row",
            removedRows: removedCount,
          });
        });
      } else {
        info.push({
          column: "All Columns",
          method: "remove_row",
          removedRows: removedCount,
        });
      }
    } else if (method === "impute") {
      // 입력 데이터와 출력 데이터를 비교하여 대체된 값 추정
      selectedColumns.forEach((col) => {
        const inputCol = inputData.columns.find((c) => c && c.name === col);
        const outputCol = outputData.columns.find((c) => c && c.name === col);
        if (inputCol && outputCol && inputData.rows && outputData.rows) {
          // 입력 데이터에서 결측치 개수 계산
          const inputValues = inputData.rows.map((r) => r[col]);
          const missingCount = inputValues.filter(
            (v) =>
              v === null ||
              v === undefined ||
              v === "" ||
              String(v).trim() === ""
          ).length;

          // 출력 데이터에서 대체된 값 추정 (간단한 방법)
          const outputValues = outputData.rows
            .map((r) => r[col])
            .filter((v) => v !== null && v !== undefined && v !== "");
          let imputedValue: string | number = "N/A";
          if (outputValues.length > 0 && strategy) {
            if (strategy === "mean" || strategy === "median") {
              const numValues = outputValues
                .map((v) => parseFloat(String(v)))
                .filter((v) => !isNaN(v));
              if (numValues.length > 0) {
                if (strategy === "mean") {
                  imputedValue =
                    numValues.reduce((a, b) => a + b, 0) / numValues.length;
                } else {
                  const sorted = [...numValues].sort((a, b) => a - b);
                  imputedValue = sorted[Math.floor(sorted.length / 2)];
                }
              }
            } else if (strategy === "mode") {
              // 가장 빈도가 높은 값
              const counts: Record<string, number> = {};
              outputValues.forEach((v) => {
                const key = String(v);
                counts[key] = (counts[key] || 0) + 1;
              });
              const mode = Object.keys(counts).reduce((a, b) =>
                counts[a] > counts[b] ? a : b
              );
              imputedValue = mode;
            }
          }

          info.push({
            column: col,
            method: "impute",
            imputedCount: missingCount,
            imputedValue: imputedValue,
          });
        }
      });
    } else if (method === "knn") {
      selectedColumns.forEach((col) => {
        info.push({
          column: col,
          method: "knn",
          n_neighbors: n_neighbors || 5,
        });
      });
    }

    return info;
  }, [inputData, outputData, method, strategy, n_neighbors, selectedColumns]);

  return (
    <div className="flex-grow overflow-auto" style={{ userSelect: "text" }}>
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Processing Summary
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Method:</span>
              <span className="text-gray-600">{method || "N/A"}</span>
            </div>
            {method === "impute" && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Strategy:</span>
                <span className="text-gray-600">{strategy || "N/A"}</span>
              </div>
            )}
            {method === "knn" && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">
                  N Neighbors:
                </span>
                <span className="text-gray-600">{n_neighbors || 5}</span>
              </div>
            )}
            {inputData && outputData && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Rows:</span>
                <span className="text-gray-600">
                  {inputData.totalRowCount} → {outputData.totalRowCount}(
                  {inputData.totalRowCount - outputData.totalRowCount} removed)
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-700">처리 상세</h3>
          <TableDownloadButton
            filename={`${baseName}_결측치처리`}
            columns={
              method === "remove_row"
                ? ["Column", "Processing", "Removed Rows"]
                : method === "impute"
                ? ["Column", "Processing", "Imputed Count", "Imputed Value"]
                : ["Column", "Processing"]
            }
            rows={processingInfo.map((item) => {
              const base: Record<string, any> = {
                Column: item.column,
                Processing: item.method,
              };
              if (method === "remove_row") base["Removed Rows"] = item.removedRows ?? 0;
              if (method === "impute") {
                base["Imputed Count"] = item.imputedCount ?? "";
                base["Imputed Value"] = item.imputedValue ?? "";
              }
              return base;
            })}
          />
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  Column
                </th>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  Processing
                </th>
                {method === "remove_row" && (
                  <th className="py-2 px-4 text-left font-semibold text-gray-700">
                    Removed Rows
                  </th>
                )}
                {method === "impute" && (
                  <>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Imputed Count
                    </th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Imputed Value
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {processingInfo.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-2 px-4">{item.column}</td>
                  <td className="py-2 px-4">{item.method}</td>
                  {method === "remove_row" && (
                    <td className="py-2 px-4">{item.removedRows || 0}</td>
                  )}
                  {method === "impute" && (
                    <>
                      <td className="py-2 px-4">
                        {item.imputedCount || "N/A"}
                      </td>
                      <td className="py-2 px-4">
                        {String(item.imputedValue || "N/A")}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Prep Encode 처리 내용 표시 컴포넌트
const PrepEncodeProcessingInfo: React.FC<{
  module: CanvasModule;
  inputData: DataPreview | null;
  outputData: DataPreview | null;
  baseName: string;
}> = ({ module, inputData, outputData, baseName }) => {
  const { method, columns: targetColumns } = module.parameters;

  const encodingInfo = useMemo(() => {
    if (!inputData || !outputData)
      return { info: [], selectedColumns: [], newColumns: [] };
    if (!Array.isArray(inputData.columns) || !Array.isArray(outputData.columns))
      return { info: [], selectedColumns: [], newColumns: [] };

    const info: Array<{
      column: string;
      method: string;
      before: string;
      after: string;
    }> = [];

    const columnsToEncode =
      targetColumns && targetColumns.length > 0
        ? targetColumns
        : inputData.columns
            .filter((c) => c && c.type === "string")
            .map((c) => c.name);

    // 입력 데이터의 모든 열 이름
    const inputColumnNames = new Set(
      inputData.columns.map((c) => c?.name).filter(Boolean)
    );

    // 기존 열 목록 (입력 데이터에 있던 열들 중 출력 데이터에도 있는 열들)
    const existingColumns: string[] = [];
    // 신규 생성 열 목록 (출력에 있지만 입력에 없는 열들)
    const newColumns: string[] = [];

    outputData.columns.forEach((outputCol) => {
      if (outputCol?.name) {
        if (inputColumnNames.has(outputCol.name)) {
          existingColumns.push(outputCol.name);
        } else {
          newColumns.push(outputCol.name);
        }
      }
    });

    // 각 기존 열에 대해 생성된 신규 열들을 매핑
    const columnToNewColumns: Record<string, string[]> = {};

    columnsToEncode.forEach((col) => {
      const inputCol = inputData.columns.find((c) => c && c.name === col);
      const outputCols = outputData.columns.filter(
        (c) =>
          c && c.name && c.name.startsWith(col) && !inputColumnNames.has(c.name)
      );

      if (inputCol) {
        // 신규 열들만 수집 (입력에 없던 열들)
        columnToNewColumns[col] = outputCols.map((c) => c.name).filter(Boolean);

        if (method === "one_hot") {
          info.push({
            column: col,
            method: "one_hot",
            before: `1 column (${inputCol.type})`,
            after: `${outputCols.length} columns (number)`,
          });
        } else {
          info.push({
            column: col,
            method: method || "label",
            before: `${inputCol.type}`,
            after: "number",
          });
        }
      }
    });

    return {
      info,
      selectedColumns: columnsToEncode,
      newColumns,
      existingColumns,
      columnToNewColumns,
    };
  }, [inputData, outputData, method, targetColumns]);

  return (
    <div className="flex-grow overflow-auto" style={{ userSelect: "text" }}>
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Encoding Summary
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Method:</span>
            <span className="text-gray-600">{method || "N/A"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-700">인코딩 상세</h3>
          <TableDownloadButton
            filename={`${baseName}_인코딩`}
            columns={["Column", "Method", "Before", "After"]}
            rows={encodingInfo.info.map((item) => ({
              Column: item.column,
              Method: item.method,
              Before: item.before,
              After: item.after,
            }))}
          />
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  Column
                </th>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  Method
                </th>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  Before
                </th>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              {encodingInfo.info.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-2 px-4">{item.column}</td>
                  <td className="py-2 px-4">{item.method}</td>
                  <td className="py-2 px-4">{item.before}</td>
                  <td className="py-2 px-4">{item.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 기존 열 및 변경하고자 하는 열 테이블 */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-700">열 매핑</h3>
          <TableDownloadButton
            filename={`${baseName}_인코딩_열매핑`}
            columns={["기존 열", "변경하고자 하는 열"]}
            rows={encodingInfo.selectedColumns.flatMap((col) => {
              const newCols = encodingInfo.columnToNewColumns?.[col] || [];
              if (newCols.length > 0) {
                return newCols.map((newCol) => ({
                  "기존 열": col,
                  "변경하고자 하는 열": newCol,
                }));
              }
              return [{ "기존 열": col, "변경하고자 하는 열": "-" }];
            })}
          />
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-4 text-left font-semibold text-gray-700 border border-gray-300">
                  기존 열
                </th>
                <th className="py-2 px-4 text-left font-semibold text-gray-700 border border-gray-300">
                  변경하고자 하는 열
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 각 기존 열에 대해 생성된 신규 열들을 표시 */}
              {encodingInfo.selectedColumns.length > 0
                ? encodingInfo.selectedColumns.map((col, idx) => {
                    const newCols =
                      encodingInfo.columnToNewColumns?.[col] || [];
                    const rowSpan = Math.max(1, newCols.length);

                    return newCols.length > 0 ? (
                      newCols.map((newCol, newIdx) => (
                        <tr
                          key={`${col}-${newIdx}`}
                          className="border-b border-gray-200"
                        >
                          {newIdx === 0 && (
                            <td
                              rowSpan={rowSpan}
                              className="py-2 px-4 border border-gray-300 align-top"
                            >
                              {col}
                            </td>
                          )}
                          <td className="py-2 px-4 border border-gray-300">
                            {newCol}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr
                        key={`${col}-empty`}
                        className="border-b border-gray-200"
                      >
                        <td className="py-2 px-4 border border-gray-300">
                          {col}
                        </td>
                        <td className="py-2 px-4 border border-gray-300 text-gray-500">
                          -
                        </td>
                      </tr>
                    );
                  })
                : null}
              {/* 열이 없는 경우 */}
              {encodingInfo.selectedColumns.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="py-4 px-4 text-center text-gray-500 border border-gray-300"
                  >
                    열 정보가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Prep Normalize 처리 내용 표시 컴포넌트
const PrepNormalizeProcessingInfo: React.FC<{
  module: CanvasModule;
  inputData: DataPreview | null;
  outputData: DataPreview | null;
  baseName: string;
}> = ({ module, inputData, outputData, baseName }) => {
  const { method, columnSelections } = module.parameters;

  const normalizeInfo = useMemo(() => {
    if (!inputData || !outputData) {
      console.log(
        "PrepNormalizeProcessingInfo: Missing inputData or outputData",
        {
          hasInputData: !!inputData,
          hasOutputData: !!outputData,
          inputData,
          outputData,
        }
      );
      return [];
    }

    // inputData.columns가 배열이 아니면 빈 배열로 처리
    const inputColumns = Array.isArray(inputData.columns)
      ? inputData.columns
      : [];
    const outputColumns = Array.isArray(outputData.columns)
      ? outputData.columns
      : [];

    if (inputColumns.length === 0 || outputColumns.length === 0) {
      console.log("PrepNormalizeProcessingInfo: No columns available", {
        inputColumnsLength: inputColumns.length,
        outputColumnsLength: outputColumns.length,
        inputDataColumns: inputData.columns,
        outputDataColumns: outputData.columns,
      });
      return [];
    }

    // columnSelections가 없거나 비어있으면 모든 숫자형 열 선택
    // pandas dtype 사용 (int64, float64 등)
    const allNumericCols = inputColumns
      .filter(
        (col) =>
          col && (col.type.startsWith("int") || col.type.startsWith("float"))
      )
      .map((col) => col.name);

    // columnSelections가 없거나 비어있으면 모든 숫자형 열 선택
    const hasSelections =
      columnSelections && Object.keys(columnSelections).length > 0;

    const selectedCols = inputColumns
      .filter((col) => {
        // pandas dtype이 숫자형인지 확인 (int64, float64 등)
        if (
          !col ||
          !(col.type.startsWith("int") || col.type.startsWith("float"))
        )
          return false;
        // columnSelections가 없거나 비어있으면 모든 숫자형 열 선택
        if (!hasSelections) {
          return true;
        }
        // columnSelections가 있으면 selected가 true이거나 undefined인 경우 선택
        // (App.tsx와 동일한 로직: selected !== false)
        const selection = columnSelections[col.name];
        if (!selection) return true; // columnSelections에 없으면 선택된 것으로 간주 (기본값)
        return selection?.selected !== false;
      })
      .map((col) => col.name);

    console.log("PrepNormalizeProcessingInfo: Column selection", {
      allNumericCols,
      selectedCols,
      columnSelections,
      method,
      inputDataColumns: inputColumns.map((c) => ({
        name: c.name,
        type: c.type,
      })),
      outputDataColumns: outputColumns.map((c) => ({
        name: c.name,
        type: c.type,
      })),
    });

    const info: Array<{
      column: string;
      method: string;
      params: Record<string, number>;
    }> = [];

    // selectedCols가 비어있으면 모든 숫자형 열 사용
    const colsToProcess =
      selectedCols.length > 0 ? selectedCols : allNumericCols;

    console.log("PrepNormalizeProcessingInfo: Processing columns", {
      selectedCols,
      allNumericCols,
      colsToProcess,
    });

    colsToProcess.forEach((col) => {
      const inputCol = inputColumns.find((c) => c && c.name === col);
      if (
        inputCol &&
        inputData.rows &&
        outputData.rows &&
        Array.isArray(inputData.rows) &&
        inputData.rows.length > 0
      ) {
        const inputValues = inputData.rows
          .map((r) => {
            if (!r || r[col] === null || r[col] === undefined || r[col] === "")
              return NaN;
            const parsed = parseFloat(String(r[col]));
            return isNaN(parsed) ? NaN : parsed;
          })
          .filter((v) => !isNaN(v));

        console.log(`PrepNormalizeProcessingInfo: Column ${col}`, {
          inputValuesLength: inputValues.length,
          firstFewValues: inputValues.slice(0, 5),
        });

        if (inputValues.length > 0) {
          const params: Record<string, number> = {};

          if (method === "MinMax") {
            params.min = Math.min(...inputValues);
            params.max = Math.max(...inputValues);
          } else if (method === "StandardScaler") {
            const mean =
              inputValues.reduce((a, b) => a + b, 0) / inputValues.length;
            const variance =
              inputValues.reduce(
                (sum, val) => sum + Math.pow(val - mean, 2),
                0
              ) / inputValues.length;
            params.mean = mean;
            params.stdDev = Math.sqrt(variance);
          } else if (method === "RobustScaler") {
            const sorted = [...inputValues].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            params.median =
              sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
            params.q1 = sorted[Math.floor(sorted.length * 0.25)];
            params.q3 = sorted[Math.floor(sorted.length * 0.75)];
            params.iqr = params.q3 - params.q1;
          }

          info.push({
            column: col,
            method: method || "MinMax",
            params,
          });

          console.log(
            `PrepNormalizeProcessingInfo: Added info for column ${col}`,
            params
          );
        } else {
          console.log(
            `PrepNormalizeProcessingInfo: No valid values for column ${col}`,
            {
              inputRowsLength: inputData.rows.length,
              sampleRow: inputData.rows[0],
              colValue: inputData.rows[0]?.[col],
            }
          );
        }
      } else {
        console.log(
          `PrepNormalizeProcessingInfo: Missing data for column ${col}`,
          {
            hasInputCol: !!inputCol,
            hasInputRows: !!inputData.rows,
            inputRowsIsArray: Array.isArray(inputData.rows),
            inputRowsLength: inputData.rows?.length || 0,
            hasOutputRows: !!outputData.rows,
          }
        );
      }
    });

    console.log("PrepNormalizeProcessingInfo: Final normalizeInfo", {
      infoLength: info.length,
      info,
    });
    return info;
  }, [inputData, outputData, method, columnSelections]);

  return (
    <div className="flex-grow overflow-auto" style={{ userSelect: "text" }}>
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Normalization Summary
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Method:</span>
            <span className="text-gray-600">{method || "N/A"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-700">정규화 상세</h3>
          <TableDownloadButton
            filename={`${baseName}_정규화`}
            columns={
              method === "MinMax"
                ? ["Column", "Method", "Min", "Max"]
                : method === "StandardScaler"
                ? ["Column", "Method", "Mean", "Std Dev"]
                : method === "RobustScaler"
                ? ["Column", "Method", "Median", "Q1", "Q3", "IQR"]
                : ["Column", "Method"]
            }
            rows={normalizeInfo.map((item) => {
              const base: Record<string, any> = {
                Column: item.column,
                Method: item.method,
              };
              if (method === "MinMax") {
                base["Min"] = item.params.min;
                base["Max"] = item.params.max;
              } else if (method === "StandardScaler") {
                base["Mean"] = item.params.mean;
                base["Std Dev"] = item.params.stdDev;
              } else if (method === "RobustScaler") {
                base["Median"] = item.params.median;
                base["Q1"] = item.params.q1;
                base["Q3"] = item.params.q3;
                base["IQR"] = item.params.iqr;
              }
              return base;
            })}
          />
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  Column
                </th>
                <th className="py-2 px-4 text-left font-semibold text-gray-700">
                  Method
                </th>
                {method === "MinMax" && (
                  <>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Min
                    </th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Max
                    </th>
                  </>
                )}
                {method === "StandardScaler" && (
                  <>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Mean
                    </th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Std Dev
                    </th>
                  </>
                )}
                {method === "RobustScaler" && (
                  <>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Median
                    </th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Q1
                    </th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      Q3
                    </th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-700">
                      IQR
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {normalizeInfo.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      method === "MinMax"
                        ? 4
                        : method === "StandardScaler"
                        ? 4
                        : 6
                    }
                    className="py-4 px-4 text-center text-gray-500"
                  >
                    정규화된 열이 없습니다. 속성 패널에서 정규화할 열을
                    선택해주세요.
                  </td>
                </tr>
              ) : (
                normalizeInfo.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-2 px-4">{item.column}</td>
                    <td className="py-2 px-4">{item.method}</td>
                    {method === "MinMax" && (
                      <>
                        <td className="py-2 px-4">
                          {item.params.min?.toFixed(4) || "N/A"}
                        </td>
                        <td className="py-2 px-4">
                          {item.params.max?.toFixed(4) || "N/A"}
                        </td>
                      </>
                    )}
                    {method === "StandardScaler" && (
                      <>
                        <td className="py-2 px-4">
                          {item.params.mean?.toFixed(4) || "N/A"}
                        </td>
                        <td className="py-2 px-4">
                          {item.params.stdDev?.toFixed(4) || "N/A"}
                        </td>
                      </>
                    )}
                    {method === "RobustScaler" && (
                      <>
                        <td className="py-2 px-4">
                          {item.params.median?.toFixed(4) || "N/A"}
                        </td>
                        <td className="py-2 px-4">
                          {item.params.q1?.toFixed(4) || "N/A"}
                        </td>
                        <td className="py-2 px-4">
                          {item.params.q3?.toFixed(4) || "N/A"}
                        </td>
                        <td className="py-2 px-4">
                          {item.params.iqr?.toFixed(4) || "N/A"}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ColumnStatistics: React.FC<{
  data: (string | number | null)[];
  columnName: string | null;
  isNumeric: boolean;
}> = ({ data, columnName, isNumeric }) => {
    const stats = useMemo(() => {
    const isNull = (v: any) => v === null || v === undefined || v === "";
    const nonNullValues = data.filter((v) => !isNull(v));
        const nulls = data.length - nonNullValues.length;
        const count = data.length;

    let mode: number | string = "N/A";
        if (nonNullValues.length > 0) {
            const counts: Record<string, number> = {};
      for (const val of nonNullValues) {
                const key = String(val);
                counts[key] = (counts[key] || 0) + 1;
            }
      mode = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b
      );
        }

        if (!isNumeric) {
            return {
                Count: count,
                Null: nulls,
                Mode: mode,
            };
        }
        
    const numericValues = nonNullValues
      .map((v) => Number(v))
      .filter((v) => !isNaN(v));

        if (numericValues.length === 0) {
             return {
                Count: count,
                Null: nulls,
                Mode: mode,
            };
        }
        
    numericValues.sort((a, b) => a - b);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const mean = sum / numericValues.length;
        const n = numericValues.length;
    const stdDev = Math.sqrt(
      numericValues.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) /
        n
    );
    const skewness =
      stdDev > 0
        ? numericValues.reduce((s, val) => s + Math.pow(val - mean, 3), 0) /
          (n * Math.pow(stdDev, 3))
        : 0;
    const kurtosis =
      stdDev > 0
        ? numericValues.reduce((s, val) => s + Math.pow(val - mean, 4), 0) /
            (n * Math.pow(stdDev, 4)) -
          3
        : 0;

        const getQuantile = (q: number) => {
            const pos = (numericValues.length - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (numericValues[base + 1] !== undefined) {
        return (
          numericValues[base] +
          rest * (numericValues[base + 1] - numericValues[base])
        );
            } else {
                return numericValues[base];
            }
        };

        const numericMode = Number(mode);

        return {
            Count: data.length,
            Mean: mean.toFixed(2),
      "Std Dev": stdDev.toFixed(2),
            Median: getQuantile(0.5).toFixed(2),
            Min: numericValues[0].toFixed(2),
            Max: numericValues[numericValues.length - 1].toFixed(2),
      "25%": getQuantile(0.25).toFixed(2),
      "75%": getQuantile(0.75).toFixed(2),
            Mode: isNaN(numericMode) ? mode : numericMode,
            Null: nulls,
            Skew: skewness.toFixed(2),
            Kurt: kurtosis.toFixed(2),
        };
    }, [data, isNumeric]);
    
    const statOrder = isNumeric 
    ? [
        "Count",
        "Mean",
        "Std Dev",
        "Median",
        "Min",
        "Max",
        "25%",
        "75%",
        "Mode",
        "Null",
        "Skew",
        "Kurt",
      ]
    : ["Count", "Null", "Mode"];

    return (
        <div className="w-full p-4 border border-gray-200 rounded-lg">
      <h4 className="font-semibold text-gray-700 mb-3">
        Statistics for {columnName}
      </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
        {statOrder.map((key) => {
                    const value = (stats as Record<string, any>)[key];
                    if (value === undefined || value === null) return null;
                    return (
                        <React.Fragment key={key}>
                           <span className="text-gray-500">{key}:</span> 
              <span className="font-mono text-gray-800 font-medium">
                {String(value)}
              </span>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export const DataPreviewModal: React.FC<DataPreviewModalProps> = ({
  module,
  projectName,
  onClose,
  modules = [],
  connections = [],
}) => {
  // Prep Missing, Prep Encode, Prep Normalize용 탭 상태 (먼저 선언)
  const isPrepModule =
    module.type === ModuleType.HandleMissingValues ||
    module.type === ModuleType.EncodeCategorical ||
    module.type === ModuleType.ScalingTransform;

  // Join, Concat 모듈 확인
  const isJoinConcatModule =
    module.type === ModuleType.Join || module.type === ModuleType.Concat;

  // Join/Concat 모듈용 탭 상태
  const [joinConcatTab, setJoinConcatTab] = useState<
    "input1" | "input2" | "output"
  >("input1");

  // Join/Concat 모듈용 입력 데이터 가져오기
  const getInputData = (portName: string): DataPreview | null => {
    if (!isJoinConcatModule || !modules || !connections) return null;
    const inputConnection = connections.find(
      (c) =>
        c && c.to && c.to.moduleId === module.id && c.to.portName === portName
    );
    if (!inputConnection || !inputConnection.from) return null;
    const sourceModule = modules.find(
      (m) => m && m.id === inputConnection.from.moduleId
    );
    if (!sourceModule?.outputData) return null;

    if (sourceModule.outputData.type === "DataPreview") {
      return sourceModule.outputData;
    }
    if (sourceModule.outputData.type === "SplitDataOutput") {
      const fromPortName = inputConnection.from.portName;
      if (fromPortName === "train_data_out") {
        return sourceModule.outputData.train;
      } else if (fromPortName === "test_data_out") {
        return sourceModule.outputData.test;
      }
    }
    return null;
  };

  const input1Data = getInputData("data_in");
  const input2Data = getInputData("data_in2");
  const input1Columns = Array.isArray(input1Data?.columns)
    ? input1Data.columns
    : [];
  const input1Rows = Array.isArray(input1Data?.rows) ? input1Data.rows : [];
  const input2Columns = Array.isArray(input2Data?.columns)
    ? input2Data.columns
    : [];
  const input2Rows = Array.isArray(input2Data?.rows) ? input2Data.rows : [];

  // Join/Concat 모듈의 출력 데이터
  const getJoinConcatOutput = (): DataPreview | null => {
    if (!isJoinConcatModule || !module.outputData) return null;
    if (
      module.outputData.type === "JoinOutput" ||
      module.outputData.type === "ConcatOutput"
    ) {
      return {
        type: "DataPreview",
        columns: module.outputData.columns,
        rows: module.outputData.rows,
        totalRowCount: module.outputData.rows?.length || 0,
      };
    }
    if (module.outputData.type === "DataPreview") {
      return module.outputData;
    }
    return null;
  };

  const outputData = getJoinConcatOutput();
  const outputColumns = Array.isArray(outputData?.columns)
    ? outputData.columns
    : [];
  const outputRows = Array.isArray(outputData?.rows) ? outputData.rows : [];

  // Join/Concat 모듈의 현재 탭에 따른 데이터
  const getJoinConcatCurrentData = () => {
    if (joinConcatTab === "input1") {
      return { data: input1Data, columns: input1Columns, rows: input1Rows };
    } else if (joinConcatTab === "input2") {
      return { data: input2Data, columns: input2Columns, rows: input2Rows };
    } else {
      return { data: outputData, columns: outputColumns, rows: outputRows };
    }
  };

  const joinConcatCurrent = getJoinConcatCurrentData();

    // 안전한 데이터 가져오기
    const getPreviewData = (): DataPreview | null => {
        try {
      console.log(
        "DataPreviewModal getPreviewData called for module:",
        module.id,
        module.name,
        "outputData type:",
        module.outputData?.type
      );
            if (!module || !module.outputData) {
        console.warn("DataPreviewModal: No module or outputData");
                return null;
            }
      if (module.outputData.type === "DataPreview") return module.outputData;
      if (module.outputData.type === "KMeansOutput") {
                return module.outputData.clusterAssignments || null;
        }
        // ClusteringDataOutput은 별도의 ClusteringDataPreviewModal에서 처리
      if (module.outputData.type === "ClusteringDataOutput") {
                return null;
        }
      if (module.outputData.type === "PCAOutput") {
                return module.outputData.transformedData || null;
        }
        // TrainedClusteringModelOutput은 별도의 TrainedClusteringModelPreviewModal에서 처리
      if (module.outputData.type === "TrainedClusteringModelOutput") {
                return null;
        }
      // VIFCheckerOutput은 별도로 처리
      if (module.outputData.type === "VIFCheckerOutput") {
        return null;
      }
      // 이제 모든 전처리 모듈은 DataPreview를 직접 출력합니다
        return null;
        } catch (error) {
      console.error("Error in getPreviewData:", error);
            return null;
        }
    };
    
    const data = getPreviewData();
    const columns = Array.isArray(data?.columns) ? data.columns : [];
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Join/Concat 모듈의 경우 현재 탭에 따라 초기 컬럼 선택
  const getInitialSelectedColumn = () => {
    if (isJoinConcatModule) {
      return joinConcatCurrent.columns[0]?.name || null;
    }
    return columns[0]?.name || null;
  };

  const [selectedColumn, setSelectedColumn] = useState<string | null>(
    getInitialSelectedColumn()
  );

  // Join/Concat 모듈의 탭이 변경되면 selectedColumn 업데이트
  React.useEffect(() => {
    if (isJoinConcatModule) {
      const newSelected = joinConcatCurrent.columns[0]?.name || null;
      if (newSelected !== selectedColumn) {
        setSelectedColumn(newSelected);
      }
    }
  }, [isJoinConcatModule, joinConcatTab, joinConcatCurrent.columns]);
    const [yAxisCol, setYAxisCol] = useState<string | null>(null);
    const [showSpreadView, setShowSpreadView] = useState(false);
    
  // Prep Missing, Prep Encode, Prep Normalize용 탭 상태
  const [prepTab, setPrepTab] = useState<"processing" | "output1" | "output2">(
    "processing"
  );

  // 두 번째 출력 데이터 가져오기
  const getOutput2Data = (): DataPreview | null => {
    if (!isPrepModule) return null;
    // modules 배열에서 최신 모듈 상태 가져오기
    const currentModule =
      (modules && modules.find((m) => m.id === module.id)) || module;
    const outputData2 = (currentModule as any).outputData2;
    if (outputData2 && outputData2.type === "DataPreview") {
      // totalRowCount가 없으면 rows.length로 설정
      if (
        outputData2.totalRowCount === undefined &&
        Array.isArray(outputData2.rows)
      ) {
        outputData2.totalRowCount = outputData2.rows.length;
      }
      // columns가 배열이 아니면 빈 배열로 설정
      if (!Array.isArray(outputData2.columns)) {
        outputData2.columns = [];
      }
      // rows가 배열이 아니면 빈 배열로 설정
      if (!Array.isArray(outputData2.rows)) {
        outputData2.rows = [];
      }
      return outputData2;
    }
    return null;
  };

  const data2 = getOutput2Data();
  const columns2 = Array.isArray(data2?.columns) ? data2.columns : [];
  const rows2 = Array.isArray(data2?.rows) ? data2.rows : [];

  // 두 번째 입력(data_in2)이 연결되어 있는지 확인
  const hasSecondInput = React.useMemo(() => {
    if (!isPrepModule || !connections) return false;
    const secondInputConnection = connections.find(
      (c) => c.to.moduleId === module.id && c.to.portName === "data_in2"
    );
    return !!secondInputConnection && !!data2;
  }, [isPrepModule, connections, module.id, data2]);

  // 두 번째 입력이 없는데 output2 탭이 선택되어 있으면 processing 탭으로 전환
  React.useEffect(() => {
    if (isPrepModule && prepTab === "output2" && !hasSecondInput) {
      setPrepTab("processing");
    }
  }, [isPrepModule, prepTab, hasSecondInput]);

  // 현재 탭에 따라 표시할 데이터 결정
  const currentData =
    prepTab === "output1" ? data : prepTab === "output2" ? data2 : null;
  const currentColumns =
    prepTab === "output1" ? columns : prepTab === "output2" ? columns2 : [];
  const currentRows =
    prepTab === "output1" ? rows : prepTab === "output2" ? rows2 : [];

    // Load Data 모듈용 탭 상태
  const [loadDataTab, setLoadDataTab] = useState<"detail" | "graph">("detail");
    const [graphXCol, setGraphXCol] = useState<string | null>(null);
    const [graphYCol, setGraphYCol] = useState<string | null>(null);
    
    // Load Data 모듈인지 확인
    const isLoadDataModule = module.type === ModuleType.LoadData;
    // Select Data 모듈도 Load Data와 동일한 형식으로 표시
    const isSelectDataModule = module.type === ModuleType.SelectData;
  // Transition Data, Resample Data, Transform Data도 동일한 형식으로 표시
  const isDataModule =
    isLoadDataModule ||
                         isSelectDataModule || 
                         module.type === ModuleType.TransitionData ||
                         module.type === ModuleType.ResampleData ||
    module.type === ModuleType.TransformData;

  // VIF Checker 모듈인지 확인
  const isVIFCheckerModule = module.outputData?.type === "VIFCheckerOutput";

    const sortedRows = useMemo(() => {
        try {
      let rowsToSort: any[] = [];
      if (isJoinConcatModule) {
        rowsToSort = joinConcatCurrent.rows;
      } else if (isPrepModule && prepTab !== "processing") {
        rowsToSort = currentRows;
      } else {
        rowsToSort = rows;
      }
      if (!Array.isArray(rowsToSort)) return [];
      let sortableItems = [...rowsToSort];
            if (sortConfig !== null && sortConfig.key) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                if (valA < valB) {
            return sortConfig.direction === "ascending" ? -1 : 1;
                }
                if (valA > valB) {
            return sortConfig.direction === "ascending" ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
        } catch (error) {
      console.error("Error sorting rows:", error);
      return Array.isArray(rowsToSort) ? rowsToSort : [];
        }
  }, [
    rows,
    currentRows,
    isPrepModule,
    prepTab,
    sortConfig,
    isJoinConcatModule,
    joinConcatCurrent.rows,
  ]);

  // 메인 데이터 테이블에 표시되는 컬럼(현재 탭 기준). CSV 다운로드용으로도 사용.
  const displayedColumns = isJoinConcatModule
    ? joinConcatCurrent.columns
    : isPrepModule && prepTab !== "processing"
    ? currentColumns
    : columns;

    const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
        }
        setSortConfig({ key, direction });
    };

    const selectedColumnData = useMemo(() => {
        try {
      let rowsToUse: any[] = [];
      if (isJoinConcatModule) {
        rowsToUse = joinConcatCurrent.rows;
      } else if (isPrepModule && prepTab !== "processing") {
        rowsToUse = currentRows;
      } else {
        rowsToUse = rows;
      }
      if (!selectedColumn || !Array.isArray(rowsToUse)) return null;
      return rowsToUse.map((row) => row[selectedColumn]);
        } catch (error) {
      console.error("Error getting selected column data:", error);
            return null;
        }
  }, [
    selectedColumn,
    rows,
    currentRows,
    isPrepModule,
    prepTab,
    isJoinConcatModule,
    joinConcatCurrent.rows,
  ]);
    
    const selectedColInfo = useMemo(() => {
        try {
      let colsToUse: ColumnInfo[] = [];
      if (isJoinConcatModule) {
        colsToUse = joinConcatCurrent.columns;
      } else if (isPrepModule && prepTab !== "processing") {
        colsToUse = currentColumns;
      } else {
        colsToUse = columns;
      }
      if (!Array.isArray(colsToUse) || !selectedColumn) return null;
      return colsToUse.find((c) => c && c.name === selectedColumn) || null;
        } catch (error) {
      console.error("Error finding selected column info:", error);
            return null;
        }
  }, [
    columns,
    currentColumns,
    selectedColumn,
    isPrepModule,
    prepTab,
    isJoinConcatModule,
    joinConcatCurrent.columns,
  ]);
    
  const isSelectedColNumeric = useMemo(
    () => isNumericType(selectedColInfo?.type),
    [selectedColInfo]
  );
    
    const numericCols = useMemo(() => {
        try {
      let colsToUse: ColumnInfo[] = [];
      if (isJoinConcatModule) {
        colsToUse = joinConcatCurrent.columns;
      } else if (isPrepModule && prepTab !== "processing") {
        colsToUse = currentColumns;
      } else {
        colsToUse = columns;
      }
      if (!Array.isArray(colsToUse)) return [];
      return colsToUse
        .filter((c) => c && isNumericType(c.type))
        .map((c) => c.name)
        .filter(Boolean);
        } catch (error) {
      console.error("Error getting numeric columns:", error);
            return [];
        }
  }, [
    columns,
    currentColumns,
    isPrepModule,
    prepTab,
    isJoinConcatModule,
    joinConcatCurrent.columns,
  ]);

    useEffect(() => {
        if (isSelectedColNumeric && selectedColumn) {
      const defaultY = numericCols.find((c) => c !== selectedColumn);
            setYAxisCol(defaultY || null);
        } else {
            setYAxisCol(null);
        }
    }, [isSelectedColNumeric, selectedColumn, numericCols]);
    
    // Load Data/Select Data 모듈용: Graph 탭에서 사용할 열 초기화 (Detail 탭에서 선택된 열을 기본으로 사용)
    useEffect(() => {
        if (isDataModule && numericCols.length >= 2) {
            // Detail 탭에서 선택된 열이 숫자형이면 기본값으로 사용
            if (selectedColumn && isSelectedColNumeric) {
                if (!graphXCol || graphXCol !== selectedColumn) {
                    setGraphXCol(selectedColumn);
                }
                if (!graphYCol || graphYCol === selectedColumn) {
          const defaultY =
            numericCols.find((c) => c !== selectedColumn) ||
            numericCols[1] ||
            null;
                    setGraphYCol(defaultY);
                }
            } else if (!graphXCol) {
                // 선택된 열이 없거나 숫자형이 아니면 첫 번째 숫자형 열 사용
                setGraphXCol(numericCols[0] || null);
            }
            if (!graphYCol && graphXCol) {
        const defaultY =
          numericCols.find((c) => c !== graphXCol) || numericCols[1] || null;
                setGraphYCol(defaultY);
            }
        }
  }, [
    isDataModule,
    numericCols,
    selectedColumn,
    isSelectedColNumeric,
    graphXCol,
    graphYCol,
  ]);
    
    // 상관계수 행렬 계산 (Load Data/Select Data 모듈용)
    const correlationMatrix = useMemo(() => {
        if (!isDataModule || numericCols.length < 2) return null;
        return calculateCorrelationMatrix(rows, numericCols);
  }, [isDataModule, rows, numericCols]);
    
    // correlationMatrix를 Statistics 형식의 correlation으로 변환
    const correlation = useMemo(() => {
        if (!correlationMatrix || !numericCols.length) return null;
        const result: Record<string, Record<string, number>> = {};
        numericCols.forEach((col, i) => {
            result[col] = {};
            numericCols.forEach((col2, j) => {
                result[col][col2] = correlationMatrix[i][j];
            });
        });
        return result;
    }, [correlationMatrix, numericCols]);

  // Prep Module의 경우 data가 없어도 Processing Info 탭을 보여줄 수 있음
  // Join/Concat 모듈의 경우 입력 데이터가 있으면 표시 가능
  // VIFChecker 모듈의 경우 data가 없어도 VIF 결과를 표시할 수 있음
  if (!data && !isPrepModule && !isJoinConcatModule && !isVIFCheckerModule) {
    console.warn(
      "DataPreviewModal: No data available for module",
      module.id,
      module.type,
      module.outputData
    );
        return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-white p-6 rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
                    <h3 className="text-lg font-bold">No Data Available</h3>
                    <p>The selected module has no previewable data.</p>
          <p className="text-sm text-gray-500 mt-2">
            Module Type: {module.type}
          </p>
          <p className="text-sm text-gray-500">
            Output Data Type: {module.outputData?.type || "null"}
          </p>
                </div>
            </div>
        );
    }
    
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            Data Preview: {module.name}
          </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSpreadView(true)}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                        >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
                            </svg>
                            Spread View
                        </button>
                        <button
                            onClick={() => {
                const dataToExport =
                  isPrepModule && prepTab !== "processing" ? currentData : data;
                const colsToExport =
                  isPrepModule && prepTab !== "processing"
                    ? currentColumns
                    : columns;
                const rowsToExport =
                  isPrepModule && prepTab !== "processing" ? currentRows : rows;
                if (!dataToExport || !colsToExport || !rowsToExport) return;
                                const csvContent = [
                  colsToExport.map((c) => c.name).join(","),
                  ...rowsToExport.map((row) =>
                    colsToExport
                      .map((col) => {
                                            const val = row[col.name];
                        if (val === null || val === undefined) return "";
                                            const str = String(val);
                        return str.includes(",") ||
                          str.includes('"') ||
                          str.includes("\n")
                                                ? `"${str.replace(/"/g, '""')}"` 
                                                : str;
                      })
                      .join(",")
                  ),
                ].join("\n");
                const bom = "\uFEFF";
                const blob = new Blob([bom + csvContent], {
                  type: "text/csv;charset=utf-8;",
                });
                const link = document.createElement("a");
                                link.href = URL.createObjectURL(blob);
                link.download = `${module.name}_${
                  prepTab === "output1"
                    ? "output1"
                    : prepTab === "output2"
                    ? "output2"
                    : "data"
                }.csv`;
                                link.click();
                            }}
                            className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100"
                            title="Download CSV"
                        >
                            <ArrowDownTrayIcon className="w-6 h-6" />
                        </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800"
            >
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
        <main
          className="flex-grow p-4 overflow-auto flex flex-col gap-4"
          style={{ userSelect: "text" }}
        >
          {/* Prep Missing, Prep Encode, Prep Normalize용 탭 */}
          {isPrepModule && (
            <div className="flex-shrink-0 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setPrepTab("processing")}
                  className={`${
                    prepTab === "processing"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Processing Info
                </button>
                <button
                  onClick={() => setPrepTab("output1")}
                  className={`${
                    prepTab === "output1"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Output_1
                </button>
                {hasSecondInput && (
                  <button
                    onClick={() => setPrepTab("output2")}
                    className={`${
                      prepTab === "output2"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Output_2
                  </button>
                )}
              </nav>
            </div>
          )}
          {/* Join/Concat 모듈용 탭 */}
          {isJoinConcatModule && (
            <div className="flex-shrink-0 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setJoinConcatTab("input1")}
                  className={`${
                    joinConcatTab === "input1"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Input 1
                </button>
                <button
                  onClick={() => setJoinConcatTab("input2")}
                  className={`${
                    joinConcatTab === "input2"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Input 2
                </button>
                <button
                  onClick={() => setJoinConcatTab("output")}
                  className={`${
                    joinConcatTab === "output"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Output
                </button>
              </nav>
            </div>
          )}
                    {/* Load Data/Select Data 모듈용 탭 */}
                    {isDataModule && (
                        <div className="flex-shrink-0 border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button
                  onClick={() => setLoadDataTab("detail")}
                                    className={`${
                    loadDataTab === "detail"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Detail
                                </button>
                                <button
                  onClick={() => setLoadDataTab("graph")}
                                    className={`${
                    loadDataTab === "graph"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Graph
                                </button>
                            </nav>
                        </div>
                    )}
                    
          {/* Prep Module 처리 내용 탭 */}
          {isPrepModule && prepTab === "processing" ? (
            (() => {
              // 입력 데이터 찾기
              const inputConnection = connections.find(
                (c) =>
                  c &&
                  c.to &&
                  c.to.moduleId === module.id &&
                  c.to.portName === "data_in"
              );
              const inputModule =
                inputConnection &&
                inputConnection.from &&
                inputConnection.from.moduleId
                  ? modules.find(
                      (m) => m && m.id === inputConnection.from.moduleId
                    )
                : null;

              // 입력 데이터 가져오기 (다양한 출력 타입 처리)
              let inputData: DataPreview | null = null;
              if (inputModule?.outputData) {
                if (inputModule.outputData.type === "DataPreview") {
                  inputData = inputModule.outputData;
                } else if (inputModule.outputData.type === "SplitDataOutput") {
                  const fromPortName = inputConnection?.from?.portName;
                  if (fromPortName === "train_data_out") {
                    inputData = inputModule.outputData.train;
                  } else if (fromPortName === "test_data_out") {
                    inputData = inputModule.outputData.test;
                  }
                }
              }

              console.log("PrepNormalizeProcessingInfo: Input data retrieval", {
                hasInputModule: !!inputModule,
                inputModuleType: inputModule?.type,
                outputDataType: inputModule?.outputData?.type,
                inputDataType: inputData?.type,
                inputDataColumnsIsArray: Array.isArray(inputData?.columns),
                inputDataColumns: inputData?.columns,
              });

              if (module.type === ModuleType.HandleMissingValues) {
                return (
                  <PrepMissingProcessingInfo
                    module={module}
                    inputData={inputData}
                    outputData={data}
                    modules={modules}
                    connections={connections}
                    baseName={module.name}
                  />
                );
              } else if (module.type === ModuleType.EncodeCategorical) {
                return (
                  <PrepEncodeProcessingInfo
                    module={module}
                    inputData={inputData}
                    outputData={data}
                    baseName={module.name}
                  />
                );
              } else if (module.type === ModuleType.ScalingTransform) {
                return (
                  <PrepNormalizeProcessingInfo
                    module={module}
                    inputData={inputData}
                    outputData={data}
                    baseName={module.name}
                  />
                );
              }
              return null;
            })()
          ) : isDataModule && loadDataTab === "graph" ? (
                        /* Graph 탭 */
                        <div className="flex-grow flex flex-col gap-4">
                            <div className="flex-shrink-0 flex items-center gap-4">
                                <div className="flex items-center gap-2">
                  <label
                    htmlFor="graph-x-select"
                    className="font-semibold text-gray-700"
                  >
                    X-Axis:
                  </label>
                                    <select
                                        id="graph-x-select"
                    value={graphXCol || ""}
                    onChange={(e) => setGraphXCol(e.target.value)}
                                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                    <option value="" disabled>
                      Select a column
                    </option>
                    {numericCols.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                  <label
                    htmlFor="graph-y-select"
                    className="font-semibold text-gray-700"
                  >
                    Y-Axis:
                  </label>
                                    <select
                                        id="graph-y-select"
                    value={graphYCol || ""}
                    onChange={(e) => setGraphYCol(e.target.value)}
                                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                    <option value="" disabled>
                      Select a column
                    </option>
                    {numericCols
                      .filter((c) => c !== graphXCol)
                      .map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {graphXCol && graphYCol ? (
                                <div className="flex-grow flex items-center justify-center border border-gray-200 rounded-lg p-4">
                                    <ScatterPlot rows={rows} xCol={graphXCol} yCol={graphYCol} />
                                </div>
                            ) : (
                                <div className="flex-grow flex items-center justify-center text-gray-500">
                                    Please select both X and Y axis columns.
                                </div>
                            )}
                        </div>
          ) : isVIFCheckerModule ? (
            /* VIF Checker 모듈 */
            <div className="flex-grow flex flex-col gap-4">
              {module.outputData?.type === "VIFCheckerOutput" && (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-700">
                      VIF (Variance Inflation Factor) Results
                    </h3>
                    <TableDownloadButton
                      filename={`${module.name}_VIF`}
                      columns={["Column", "VIF Factor"]}
                      rows={(module.outputData as VIFCheckerOutput).results.map(
                        (result) => ({
                          Column: result.column,
                          "VIF Factor": result.vif,
                        })
                      )}
                    />
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="py-3 px-4 font-semibold text-gray-600 text-left">
                            Column
                          </th>
                          <th className="py-3 px-4 font-semibold text-gray-600 text-right">
                            VIF Factor
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(module.outputData as VIFCheckerOutput).results.map(
                          (result, index) => {
                            const vif = result.vif;
                            let bgColor = "";
                            let textColor = "";

                            if (vif > 10) {
                              // High multicollinearity (red)
                              bgColor = "bg-red-100";
                              textColor = "text-red-800";
                            } else if (vif > 5) {
                              // Moderate multicollinearity (light red)
                              bgColor = "bg-red-50";
                              textColor = "text-red-600";
                            } else {
                              // Low multicollinearity (normal)
                              bgColor = "";
                              textColor = "text-gray-800";
                            }

                            return (
                              <tr
                                key={index}
                                className={`${bgColor} ${
                                  index % 2 === 0 ? "" : "bg-opacity-50"
                                }`}
                              >
                                <td className="py-2 px-4 font-medium text-gray-700">
                                  {result.column}
                                </td>
                                <td
                                  className={`py-2 px-4 text-right font-mono font-semibold ${textColor}`}
                                >
                                  {vif.toFixed(4)}
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">
                    <p>
                      <span className="font-semibold">Interpretation:</span>
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>
                        <span className="text-red-800 font-semibold">
                          VIF &gt; 10:
                        </span>{" "}
                        High multicollinearity (consider removing variable)
                      </li>
                      <li>
                        <span className="text-red-600 font-semibold">
                          5 &lt; VIF ≤ 10:
                        </span>{" "}
                        Moderate multicollinearity (caution)
                      </li>
                      <li>
                        <span className="text-gray-800 font-semibold">
                          VIF ≤ 5:
                        </span>{" "}
                        Low multicollinearity (acceptable)
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Detail 탭 또는 일반 모듈 또는 Output_1/Output_2 탭 또는 Join/Concat 탭 */
                        <div className="flex-grow flex flex-col gap-4">
              {/* Join/Concat 모듈의 경우 데이터 정보 표시 */}
              {isJoinConcatModule && joinConcatCurrent.data && (
                <div className="flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-600">
                    Showing {Math.min(joinConcatCurrent.rows.length, 1000)} of{" "}
                    {(
                      joinConcatCurrent.data.totalRowCount ??
                      joinConcatCurrent.rows.length ??
                      0
                    ).toLocaleString()}{" "}
                    rows and {joinConcatCurrent.columns.length} columns. Click a
                    column to see details.
                  </div>
                </div>
              )}
              {/* Prep 모듈의 경우 입력/출력 데이터 행/열 정보 표시 (Output_1/Output_2 탭에서만) */}
              {isPrepModule &&
              prepTab !== "processing" &&
              modules &&
              connections ? (
                (() => {
                  // 입력 데이터 찾기 (data_in 포트)
                  const inputConnection = connections.find(
                    (c) =>
                      c.to.moduleId === module.id && c.to.portName === "data_in"
                  );
                  const inputModule = inputConnection
                    ? modules.find(
                        (m) => m.id === inputConnection.from.moduleId
                      )
                    : null;

                  let inputData: DataPreview | null = null;
                  if (inputModule?.outputData) {
                    const fromPortName = inputConnection?.from.portName;
                    if (inputModule.outputData.type === "DataPreview") {
                      inputData = inputModule.outputData;
                    } else if (
                      inputModule.outputData.type === "SplitDataOutput"
                    ) {
                      // SplitDataOutput 처리
                      if (fromPortName === "train_data_out") {
                        inputData = inputModule.outputData.train;
                      } else if (fromPortName === "test_data_out") {
                        inputData = inputModule.outputData.test;
                      }
                    }
                  }

                  // 디버깅: 입력 데이터 확인
                  if (!inputData && inputConnection) {
                    console.log("DataPreviewModal: Input data not found", {
                      moduleId: module.id,
                      moduleType: module.type,
                      inputModuleId: inputModule?.id,
                      inputModuleType: inputModule?.type,
                      outputDataType: inputModule?.outputData?.type,
                      fromPortName: inputConnection?.from.portName,
                    });
                  }

                  return (
                            <div className="flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700">
                            입력 데이터:
                          </span>
                                        <span className="text-gray-600">
                            {inputData
                              ? `${(
                                  inputData.totalRowCount ??
                                  inputData.rows?.length ??
                                  0
                                ).toLocaleString()}행 × ${
                                  Array.isArray(inputData.columns)
                                    ? inputData.columns.length
                                    : 0
                                }열`
                              : "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700">
                            결과 데이터:
                          </span>
                                        <span className="text-gray-600">
                            {currentData
                              ? `${(
                                  currentData.totalRowCount ??
                                  currentRows.length ??
                                  0
                                ).toLocaleString()}행 × ${
                                  currentColumns.length
                                }열`
                              : "N/A"}
                                        </span>
                                    </div>
                      </div>
                    </div>
                  );
                })()
              ) : !isPrepModule && !isJoinConcatModule ? (
                <>
                  <DataOverviewPanel
                    columns={columns}
                    rows={rows}
                    totalRowCount={data?.totalRowCount ?? data?.rows?.length}
                  />
                  <div className="flex justify-between items-center flex-shrink-0">
                    <div className="text-sm text-gray-600">
                      Showing {Math.min(rows.length, 1000)} of{" "}
                      {(
                        data?.totalRowCount ??
                        data?.rows?.length ??
                        0
                      ).toLocaleString()}{" "}
                      rows and {columns.length} columns. Click a column to see
                      details.
                                </div>
                            </div>
                </>
              ) : !isJoinConcatModule ? (
                <>
                  <DataOverviewPanel
                    columns={currentColumns}
                    rows={currentRows}
                    totalRowCount={
                      currentData?.totalRowCount ?? currentRows.length
                    }
                  />
                  <div className="flex justify-between items-center flex-shrink-0">
                                <div className="text-sm text-gray-600">
                    Showing {Math.min(currentRows.length, 1000)} of{" "}
                    {(
                      currentData?.totalRowCount ??
                      currentRows.length ??
                      0
                    ).toLocaleString()}{" "}
                    rows and {currentColumns.length} columns. Click a column to
                    see details.
                                </div>
                            </div>
                </>
              ) : null}
              <div
                className="flex-grow flex gap-4 overflow-hidden"
                style={{ userSelect: "text" }}
              >
                            {/* Score Model인 경우 테이블만 표시 */}
                            {module.type === ModuleType.ScoreModel ? (
                                <div className="w-full flex flex-col gap-2">
                                  <div className="flex items-center justify-end">
                                    <TableDownloadButton
                                      filename={`${module.name}_데이터`}
                                      columns={displayedColumns}
                                      rows={sortedRows}
                                      title="전체 행 CSV 다운로드"
                                    />
                                  </div>
                                  <div className="w-full overflow-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full text-sm text-left">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                          {(isJoinConcatModule
                            ? joinConcatCurrent.columns
                            : isPrepModule && prepTab !== "processing"
                            ? currentColumns
                            : columns
                          ).map((col) => (
                                                    <th 
                                                        key={col.name} 
                                                        className="py-2 px-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                                        onClick={() => requestSort(col.name)}
                                                    >
                                                        <div className="flex items-center gap-1">
                                <span className="truncate" title={col.name}>
                                  {col.name}
                                </span>
                                {sortConfig?.key === col.name &&
                                  (sortConfig.direction === "ascending" ? (
                                    <ChevronUpIcon className="w-3 h-3" />
                                  ) : (
                                    <ChevronDownIcon className="w-3 h-3" />
                                  ))}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="border-b border-gray-200 last:border-b-0"
                          >
                            {(isJoinConcatModule
                              ? joinConcatCurrent.columns
                              : isPrepModule && prepTab !== "processing"
                              ? currentColumns
                              : columns
                            ).map((col) => {
                              const isNumberColumn = isNumericType(col.type);
                              const alignClass = isNumberColumn
                                ? "text-right"
                                : "text-left";
                                                        return (
                                                            <td 
                                                                key={col.name} 
                                  className={`py-1.5 px-3 truncate hover:bg-gray-50 ${
                                    isNumberColumn ? "font-mono" : ""
                                  } ${alignClass}`}
                                                                title={String(row[col.name])}
                                                            >
                                  {row[col.name] === null ||
                                  row[col.name] === ""
                                    ? ""
                                    : String(row[col.name])}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                  </div>
                                </div>
                            ) : (
                                <>
                    <div
                      className={`border border-gray-200 rounded-lg ${
                        selectedColumnData ? "w-1/2" : "w-full"
                      } overflow-hidden flex flex-col`}
                    >
                      <div className="flex items-center justify-end p-1.5 border-b border-gray-200 bg-gray-50/50">
                        <TableDownloadButton
                          filename={`${module.name}_데이터`}
                          columns={displayedColumns}
                          rows={sortedRows}
                          title="전체 행 CSV 다운로드"
                        />
                      </div>
                      <div
                        className="overflow-y-auto overflow-x-auto"
                        style={{ maxHeight: "400px" }}
                      >
                                    <table className="min-w-full text-sm text-left">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                              {(isJoinConcatModule
                                ? joinConcatCurrent.columns
                                : isPrepModule && prepTab !== "processing"
                                ? currentColumns
                                : columns
                              ).map((col) => (
                                                    <th 
                                                        key={col.name} 
                                                        className="py-2 px-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                                        onClick={() => requestSort(col.name)}
                                                    >
                                                        <div className="flex items-center gap-1">
                                    <span className="truncate" title={col.name}>
                                      {col.name}
                                    </span>
                                    {sortConfig?.key === col.name &&
                                      (sortConfig.direction === "ascending" ? (
                                        <ChevronUpIcon className="w-3 h-3" />
                                      ) : (
                                        <ChevronDownIcon className="w-3 h-3" />
                                      ))}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((row, rowIndex) => (
                              <tr
                                key={rowIndex}
                                className="border-b border-gray-200 last:border-b-0"
                              >
                                {(isJoinConcatModule
                                  ? joinConcatCurrent.columns
                                  : isPrepModule && prepTab !== "processing"
                                  ? currentColumns
                                  : columns
                                ).map((col) => {
                                  const isNumberColumn = isNumericType(col.type);
                                  const alignClass = isNumberColumn
                                    ? "text-right"
                                    : "text-left";
                                                        return (
                                                            <td 
                                                                key={col.name} 
                                      className={`py-1.5 px-3 truncate ${
                                        selectedColumn === col.name
                                          ? "bg-blue-100"
                                          : "hover:bg-gray-50 cursor-pointer"
                                      } ${
                                        isNumberColumn ? "font-mono" : ""
                                      } ${alignClass}`}
                                      onClick={() =>
                                        setSelectedColumn(col.name)
                                      }
                                                                title={String(row[col.name])}
                                                            >
                                      {row[col.name] === null ||
                                      row[col.name] === ""
                                        ? ""
                                        : String(row[col.name])}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {selectedColumnData && (
                                <div className="w-1/2 flex flex-col gap-4">
                                    {isSelectedColNumeric ? (
                          <HistogramPlot
                            rows={
                              isJoinConcatModule
                                ? joinConcatCurrent.rows
                                : isPrepModule && prepTab !== "processing"
                                ? currentRows
                                : rows
                            }
                            column={selectedColumn!}
                          />
                                    ) : (
                                        <div className="w-full h-full p-4 flex flex-col border border-gray-200 rounded-lg items-center justify-center">
                            <p className="text-gray-500">
                              Plot is not available for non-numeric columns.
                            </p>
                                        </div>
                                    )}
                        <ColumnStatistics
                          data={selectedColumnData}
                          columnName={selectedColumn}
                          isNumeric={isSelectedColNumeric}
                        />
                                </div>
                                    )}
                                </>
                            )}
                        </div>
                        
                        {/* Load Data/Select Data 모듈용: 상관계수 표시 (Statistics 모듈 형식) */}
              {isDataModule &&
                !isPrepModule &&
                numericCols.length >= 2 &&
                correlation && (
                            <div className="flex-shrink-0 flex flex-col gap-4">
                                <div className="border-t border-gray-200 pt-4">
                                    {/* Correlation Analysis Section */}
                                    <div>
                        <h3 className="text-lg font-semibold mb-2 text-gray-700">
                          Correlation Analysis
                        </h3>
                                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                            <CorrelationHeatmap matrix={correlation} />
                                        </div>
                                    </div>

                                    {/* Pairplot Visualization Section */}
                                    <div className="mt-4">
                        <h3 className="text-lg font-semibold mb-2 text-gray-700">
                          Pairplot
                        </h3>
                                        <div className="p-4 border border-gray-200 rounded-lg">
                          <Pairplot
                            correlation={correlation}
                            numericColumns={numericCols}
                            rows={rows}
                          />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    )}
                </main>
            </div>
      {showSpreadView &&
        (isPrepModule && prepTab !== "processing" ? currentRows : rows).length >
          0 && (
                <SpreadViewModal
                    onClose={() => setShowSpreadView(false)}
            data={isPrepModule && prepTab !== "processing" ? currentRows : rows}
            columns={
              isPrepModule && prepTab !== "processing"
                ? currentColumns
                : columns
            }
                    title={`Spread View: ${module.name}`}
                />
            )}
        </div>
    );
};
