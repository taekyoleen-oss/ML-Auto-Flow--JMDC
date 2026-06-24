import React, { useRef, useCallback, useState } from 'react';
import { CanvasModule, ModuleStatus } from '../types';

interface Props {
  modules: CanvasModule[];
  pan: { x: number; y: number };
  scale: number;
  containerWidth: number;
  containerHeight: number;
  onPanTo: (pan: { x: number; y: number }) => void;
}

const MINIMAP_W = 160;
const MINIMAP_H = 100;
const MODULE_W = 256;
const MODULE_H = 130;
const PADDING = 40;

function statusColor(status: string): string {
  if (status === ModuleStatus.Success) return '#22c55e';
  if (status === ModuleStatus.Error) return '#ef4444';
  if (status === ModuleStatus.Running) return '#f59e0b';
  return '#6b7280';
}

export const CanvasMinimap: React.FC<Props> = ({ modules, pan, scale, containerWidth, containerHeight, onPanTo }) => {
  const ref = useRef<SVGSVGElement>(null);

  // 미니맵 위치 이동 — 기본 우하단(bottom-4 right-4)에서 드래그 핸들로 자유 이동.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setOffset({ x: d.ox + (ev.clientX - d.sx), y: d.oy + (ev.clientY - d.sy) });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [offset]);

  const xs = modules.length > 0 ? modules.map(m => m.position.x) : [0];
  const ys = modules.length > 0 ? modules.map(m => m.position.y) : [0];
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const maxX = Math.max(...xs) + MODULE_W + PADDING;
  const maxY = Math.max(...ys) + MODULE_H + PADDING;
  const worldW = maxX - minX;
  const worldH = maxY - minY;

  const scaleX = MINIMAP_W / worldW;
  const scaleY = MINIMAP_H / worldH;
  const ms = Math.min(scaleX, scaleY);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = mx / ms + minX;
    const worldY = my / ms + minY;
    onPanTo({
      x: -(worldX * scale - containerWidth / 2),
      y: -(worldY * scale - containerHeight / 2),
    });
  }, [ms, minX, minY, scale, containerWidth, containerHeight, onPanTo]);

  if (modules.length === 0) return null;

  const toMX = (x: number) => (x - minX) * ms;
  const toMY = (y: number) => (y - minY) * ms;

  const vpX = -pan.x / scale;
  const vpY = -pan.y / scale;
  const vpW = containerWidth / scale;
  const vpH = containerHeight / scale;

  const vpMX = Math.max(0, toMX(vpX));
  const vpMY = Math.max(0, toMY(vpY));
  const vpMW = Math.min(MINIMAP_W - vpMX, vpW * ms);
  const vpMH = Math.min(MINIMAP_H - vpMY, vpH * ms);

  return (
    <div
      className="absolute bottom-4 right-4 z-30 rounded-lg overflow-hidden shadow-lg border border-gray-600 bg-gray-900/85 backdrop-blur-sm"
      style={{ width: MINIMAP_W, transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      {/* 드래그 핸들 — 잡고 끌어 미니맵을 이동. 더블클릭하면 원위치로 복귀. */}
      <div
        onMouseDown={onHandleMouseDown}
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        className="cursor-move select-none flex items-center gap-1 px-2 py-1 bg-gray-800/90 text-gray-300 text-[10px] font-medium border-b border-gray-700"
        title="드래그하여 이동 · 더블클릭하면 원위치"
      >
        <span aria-hidden>⠿</span>
        <span>전체 보기</span>
      </div>
      <svg
        ref={ref}
        width={MINIMAP_W}
        height={MINIMAP_H}
        onClick={handleClick}
        className="cursor-crosshair block"
      >
        {modules.map(m => (
          <rect
            key={m.id}
            x={toMX(m.position.x)}
            y={toMY(m.position.y)}
            width={MODULE_W * ms}
            height={MODULE_H * ms}
            rx={2}
            fill={statusColor(m.status)}
            opacity={0.8}
          />
        ))}
        <rect
          x={vpMX}
          y={vpMY}
          width={Math.max(4, vpMW)}
          height={Math.max(4, vpMH)}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={1.5}
          rx={1}
          opacity={0.9}
        />
      </svg>
    </div>
  );
};
