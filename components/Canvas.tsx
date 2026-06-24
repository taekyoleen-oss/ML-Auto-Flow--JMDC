import React, { useState, useCallback, useRef, MouseEvent, TouchEvent, useEffect, useLayoutEffect, useMemo } from 'react';
import { CanvasModule, Connection, ModuleType, DataPreview, ColumnInfo } from '../types';
import { ComponentRenderer as ModuleNode } from './ComponentRenderer';
import { ShapeRenderer } from './ShapeRenderer';
import { SpreadViewModal } from './SpreadViewModal';
import { useTheme } from '../contexts/ThemeContext';

interface CanvasProps {
  modules: CanvasModule[];
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  selectedModuleIds: string[];
  setSelectedModuleIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateModulePositions: (updates: { id: string, position: { x: number, y: number } }[]) => void;
  onModuleDrop: (type: ModuleType, position: { x: number; y: number }) => void;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number, y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
  canvasContainerRef: React.RefObject<HTMLDivElement>;
  onViewDetails: (moduleId: string) => void;
  onModuleDoubleClick: (moduleId: string) => void;
  onRunModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
  onUpdateModuleName: (id: string, newName: string) => void;
  onUpdateModule: (id: string, updates: Partial<CanvasModule>) => void;
  suggestion: { module: CanvasModule, connection: Connection } | null;
  onAcceptSuggestion: () => void;
  onClearSuggestion: () => void;
  onStartSuggestion: (moduleId: string, portName: string) => void;
  areUpstreamModulesReady: (moduleId: string, allModules: CanvasModule[], allConnections: Connection[]) => boolean;
}

export const Canvas: React.FC<CanvasProps> = ({ 
    modules, connections, setConnections, selectedModuleIds, setSelectedModuleIds, 
    updateModulePositions, onModuleDrop, scale, setScale, pan, setPan, 
    canvasContainerRef, onViewDetails, onModuleDoubleClick, onRunModule, 
    onDeleteModule, onUpdateModuleName, onUpdateModule, suggestion, onAcceptSuggestion, 
    onClearSuggestion, onStartSuggestion, areUpstreamModulesReady
}) => {
  const { theme } = useTheme();
  const [dragConnection, setDragConnection] = useState<{ from: { moduleId: string, portName: string, isInput: boolean }, to: { x: number, y: number } } | null>(null);
  const [isSuggestionDrag, setIsSuggestionDrag] = useState(false);
  const [tappedSourcePort, setTappedSourcePort] = useState<{ moduleId: string; portName: string; } | null>(null);
  const portRefs = useRef(new Map<string, HTMLDivElement>());
  const modulesLayerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const isSelecting = useRef(false);
  const isSpacePressed = useRef(false);
  const selectionStartRef = useRef<{ x: number, y: number } | null>(null);
  const [connectionDataView, setConnectionDataView] = useState<{
    connection: Connection;
    data: Array<Record<string, any>>;
    columns: Array<{ name: string; type?: string }>;
  } | null>(null);
  const [connectionTooltip, setConnectionTooltip] = useState<{
    screenX: number;
    screenY: number;
    fromName: string;
    toName: string;
    rowCount: number;
    columns: Array<{ name: string; type?: string }>;
  } | null>(null);
  
  // Refs for optimized dragging
  const dragInfoRef = useRef<{
    draggedModuleIds: string[];
    startPositions: Map<string, { x: number, y: number }>;
    dragStartPoint: { x: number, y: number };
  } | null>(null);
  
  const touchDragInfoRef = useRef<{
    draggedModuleIds: string[];
    startPositions: Map<string, { x: number, y: number }>;
    dragStartPoint: { x: number, y: number };
    touchIdentifier: number;
  } | null>(null);

  const latestMousePosRef = useRef<{ x: number, y: number } | null>(null);
  const requestRef = useRef<number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.code === 'Space' || e.key === ' ') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
                isSpacePressed.current = true;
                if (canvasContainerRef.current) {
                    canvasContainerRef.current.style.cursor = 'grabbing';
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if ((e.key === 'Control' || e.key === 'Meta') && isSuggestionDrag) {
                onClearSuggestion();
                setDragConnection(null);
                setIsSuggestionDrag(false);
            }
            if (e.code === 'Space' || e.key === ' ') {
                isSpacePressed.current = false;
                if (!isPanning.current && canvasContainerRef.current) {
                    canvasContainerRef.current.style.cursor = 'grab';
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isSuggestionDrag, onClearSuggestion, canvasContainerRef]);
    
    const cancelDragConnection = useCallback(() => {
        setDragConnection(null);
    }, []);
    
    useEffect(() => {
        // When an AI suggestion is created, clear any existing drag connection
        // to avoid visual glitches or conflicting states.
        if (suggestion) {
            cancelDragConnection();
        }
    }, [suggestion, cancelDragConnection]);

  const getPortPosition = useCallback((
    module: CanvasModule,
    portName: string,
    isInput: boolean,
  ) => {
    const portEl = portRefs.current.get(`${module.id}-${portName}-${isInput ? 'in' : 'out'}`);
    if (!portEl || !canvasContainerRef.current) {
        const portIndex = isInput ? module.inputs.findIndex(p => p.name === portName) : module.outputs.findIndex(p => p.name === portName);
        const portCount = isInput ? module.inputs.length : module.outputs.length;
        const moduleWidth = 256; // Updated to match component width
        const moduleHeight = 110; // Approximate module height
        
        // Special cases for specific modules
        if (isInput) {
          if (module.type === ModuleType.XolCalculator) {
            // XoL Calculator: data_in on left (center), contract_in on top (center)
            if (portName === 'data_in') {
        return { 
                x: module.position.x - 9,
                y: module.position.y + moduleHeight / 2
              };
            } else if (portName === 'contract_in') {
              // contract_in on top at 1/4 position
              return {
                x: module.position.x + moduleWidth / 4,
                y: module.position.y - 9
              };
            }
          }
          
          if (module.type === ModuleType.SplitByThreshold || module.type === ModuleType.ApplyThreshold) {
            // Split By Threshold, Apply Threshold: data_in on left (center), threshold_in on top (center)
            if (portName === 'data_in') {
              return {
                x: module.position.x - 9,
                y: module.position.y + moduleHeight / 2
              };
            } else if (portName === 'threshold_in') {
              // threshold_in on top at 1/4 position
              return {
                x: module.position.x + moduleWidth / 4,
                y: module.position.y - 9
              };
            }
          }
          
          // Default: input ports on left side
          return {
            x: module.position.x - 9,
            y: module.position.y + (moduleHeight / (portCount + 1)) * (portIndex + 1)
          };
        } else {
          // Output ports on right side
          return {
            x: module.position.x + moduleWidth + 9,
            y: module.position.y + (moduleHeight / (portCount + 1)) * (portIndex + 1)
        };
        }
    }

    const portRect = portEl.getBoundingClientRect();
    const canvasRect = canvasContainerRef.current.getBoundingClientRect();
    
    // Reverse the transformation to get canvas-space ("world") coordinates
    return {
        x: (portRect.left + portRect.width / 2 - canvasRect.left - pan.x) / scale,
        y: (portRect.top + portRect.height / 2 - canvasRect.top - pan.y) / scale
    };
  }, [scale, pan, canvasContainerRef]);

  // 화살표(연결선) 초기 위치 어긋남 방지.
  // 연결선은 렌더 중 getPortPosition()으로 포트 좌표를 구하는데, 포트 DOM이
  // portRefs(useRef)에 등록되기 전 첫 렌더에서는 moduleHeight 근사 폴백 좌표로
  // 그려진다. portRefs는 ref라 등록돼도 재렌더를 일으키지 않으므로, 모듈을
  // 선택하는 등 다른 상태 변경이 있기 전까지 화살표가 어긋난 채 남는다.
  // → 모듈 "구성"이 바뀌면(초기 표시·샘플 로드·추가/삭제 등) 포트 ref 콜백이
  //   commit 단계에서 채워진 뒤, 페인트 직전 useLayoutEffect로 1회 강제 재계산해
  //   측정된 정확한 좌표로 다시 그린다(깜빡임 없음). 위치 드래그만 한 경우엔
  //   구성 키가 그대로라 추가 재계산이 일어나지 않아 성능 영향이 없다.
  const [, bumpConnectionLayout] = useState(0);
  const moduleStructureKey = useMemo(
    () => modules.map(m => `${m.id}:${m.type}`).join('|'),
    [modules]
  );
  useLayoutEffect(() => {
    bumpConnectionLayout(t => t + 1);
  }, [moduleStructureKey]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onClearSuggestion();
    
    if (!canvasContainerRef.current) {
      console.error('Canvas container ref is not available');
      return;
    }
    
    const typeString = e.dataTransfer.getData('application/reactflow');
    // Check if type is valid ModuleType (non-empty string)
    if (!typeString || typeString.trim() === '') {
      console.error('Invalid module type received from drag:', typeString);
      return;
    }
    
    // Validate that the type is a valid ModuleType enum value
    const type = typeString as ModuleType;
    const validTypes = Object.values(ModuleType);
    if (!validTypes.includes(type)) {
      console.error('Module type is not a valid ModuleType enum value:', type);
      return;
    }
    
    const canvasBounds = canvasContainerRef.current.getBoundingClientRect();
    const moduleWidth = 256; // Updated to match component width
    
    const position = {
      x: (e.clientX - canvasBounds.left - pan.x) / scale,
      y: (e.clientY - canvasBounds.top - pan.y) / scale,
    };
    onModuleDrop(type, {x: position.x - moduleWidth / 2, y: position.y});
  };

  // The animate function for rAF
  const animateDrag = useCallback(() => {
      if (!dragInfoRef.current || !latestMousePosRef.current || !canvasContainerRef.current) {
          return;
      }

      const { dragStartPoint, startPositions } = dragInfoRef.current;
      const currentMousePos = latestMousePosRef.current;
      const canvasBounds = canvasContainerRef.current.getBoundingClientRect();
      
      // Convert screen coordinates to canvas coordinates
      const startCanvasX = (dragStartPoint.x - canvasBounds.left - pan.x) / scale;
      const startCanvasY = (dragStartPoint.y - canvasBounds.top - pan.y) / scale;
      const currentCanvasX = (currentMousePos.x - canvasBounds.left - pan.x) / scale;
      const currentCanvasY = (currentMousePos.y - canvasBounds.top - pan.y) / scale;
      
      const dx = currentCanvasX - startCanvasX;
      const dy = currentCanvasY - startCanvasY;

      const updates: { id: string, position: { x: number, y: number } }[] = [];
      startPositions.forEach((startPos, id) => {
          updates.push({
              id,
              position: {
                  x: startPos.x + dx,
                  y: startPos.y + dy,
              }
          });
      });

      if (updates.length > 0) {
          updateModulePositions(updates);
      }
      
      requestRef.current = null;
  }, [scale, pan, canvasContainerRef, updateModulePositions]);

  const handleDragMove = useCallback((e: globalThis.MouseEvent) => {
      if (!dragInfoRef.current) return;
      
      // Just update the ref, don't trigger state update directly
      latestMousePosRef.current = { x: e.clientX, y: e.clientY };
      
      // Schedule animation frame if not already scheduled
      if (!requestRef.current) {
          requestRef.current = requestAnimationFrame(animateDrag);
      }

  }, [animateDrag]);

  const handleDragEnd = useCallback(() => {
      dragInfoRef.current = null;
      latestMousePosRef.current = null;
      if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = null;
      }
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  const handleModuleDragStart = useCallback((draggedModuleId: string, e: MouseEvent) => {
    if (e.button !== 0) return;

    const isShift = e.shiftKey;
    const alreadySelected = selectedModuleIds.includes(draggedModuleId);
    let idsToDrag = selectedModuleIds;

    if (isShift) {
        const newSelection = alreadySelected
            ? selectedModuleIds.filter(id => id !== draggedModuleId)
            : [...selectedModuleIds, draggedModuleId];
        setSelectedModuleIds(newSelection);
        idsToDrag = newSelection;
    } else if (!alreadySelected) {
        setSelectedModuleIds([draggedModuleId]);
        idsToDrag = [draggedModuleId];
    }
    
    const startPositions = new Map<string, { x: number, y: number }>();
    modules.forEach(m => {
        if (idsToDrag.includes(m.id)) {
            startPositions.set(m.id, m.position);
        }
    });

    dragInfoRef.current = {
        draggedModuleIds: idsToDrag,
        startPositions,
        dragStartPoint: { x: e.clientX, y: e.clientY },
    };
    latestMousePosRef.current = { x: e.clientX, y: e.clientY };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  }, [modules, selectedModuleIds, setSelectedModuleIds, handleDragMove, handleDragEnd]);
  
  // Similar optimization for Touch events could be added, 
  // but sticking to mouse for now as per request priority.
  const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (!touchDragInfoRef.current || !canvasContainerRef.current) return;
    
    let currentTouch: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchDragInfoRef.current.touchIdentifier) {
            currentTouch = e.touches[i];
            break;
        }
    }
    if (!currentTouch) return;

    e.preventDefault();

    const { dragStartPoint, startPositions } = touchDragInfoRef.current;
    const canvasBounds = canvasContainerRef.current.getBoundingClientRect();
    
    // Convert screen coordinates to canvas coordinates
    const startCanvasX = (dragStartPoint.x - canvasBounds.left - pan.x) / scale;
    const startCanvasY = (dragStartPoint.y - canvasBounds.top - pan.y) / scale;
    const currentCanvasX = (currentTouch.clientX - canvasBounds.left - pan.x) / scale;
    const currentCanvasY = (currentTouch.clientY - canvasBounds.top - pan.y) / scale;
    
    const dx = currentCanvasX - startCanvasX;
    const dy = currentCanvasY - startCanvasY;

    const updates: { id: string, position: { x: number, y: number } }[] = [];
    startPositions.forEach((startPos, id) => {
        updates.push({
            id,
            position: { x: startPos.x + dx, y: startPos.y + dy }
        });
    });

    if (updates.length > 0) {
        updateModulePositions(updates);
    }
  }, [scale, pan, canvasContainerRef, updateModulePositions]);

  const handleTouchEnd = useCallback(() => {
    if (touchDragInfoRef.current) {
        touchDragInfoRef.current = null;
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
    }
  }, [handleTouchMove]);
  
  const handleModuleTouchDragStart = useCallback((draggedModuleId: string, e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    const isShift = e.shiftKey;
    const alreadySelected = selectedModuleIds.includes(draggedModuleId);
    let idsToDrag = selectedModuleIds;

    if (isShift) {
        const newSelection = alreadySelected
            ? selectedModuleIds.filter(id => id !== draggedModuleId)
            : [...selectedModuleIds, draggedModuleId];
        setSelectedModuleIds(newSelection);
        idsToDrag = newSelection;
    } else if (!alreadySelected) {
        setSelectedModuleIds([draggedModuleId]);
        idsToDrag = [draggedModuleId];
    }
    
    const startPositions = new Map<string, { x: number, y: number }>();
    modules.forEach(m => {
        if (idsToDrag.includes(m.id)) {
            startPositions.set(m.id, m.position);
        }
    });

    touchDragInfoRef.current = {
        draggedModuleIds: idsToDrag,
        startPositions,
        dragStartPoint: { x: touch.clientX, y: touch.clientY },
        touchIdentifier: touch.identifier,
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  }, [modules, selectedModuleIds, setSelectedModuleIds, handleTouchMove, handleTouchEnd]);
  
  const handleSelectionMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (isSelecting.current && selectionStartRef.current && canvasContainerRef.current) {
      const canvasRect = canvasContainerRef.current.getBoundingClientRect();
      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;
      setSelectionBox({
        x1: selectionStartRef.current.x,
        y1: selectionStartRef.current.y,
        x2: currentX,
        y2: currentY,
      });
    }
  }, []);

  const handleSelectionMouseUp = useCallback((e: globalThis.MouseEvent) => {
    if (isSelecting.current) {
      isSelecting.current = false;
      window.removeEventListener('mousemove', handleSelectionMouseMove);
      window.removeEventListener('mouseup', handleSelectionMouseUp);
      
      if (selectionStartRef.current && canvasContainerRef.current) {
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();
        const endX = e.clientX - canvasRect.left;
        const endY = e.clientY - canvasRect.top;
        const { x: startX, y: startY } = selectionStartRef.current;

        const selectionRect = {
          minX: (Math.min(startX, endX) - pan.x) / scale,
          minY: (Math.min(startY, endY) - pan.y) / scale,
          maxX: (Math.max(startX, endX) - pan.x) / scale,
          maxY: (Math.max(startY, endY) - pan.y) / scale,
        };

        const moduleWidth = 256; // Updated to match component width
        const moduleHeight = 120; 

        const newlySelectedIds = modules
          .filter(module => {
            const moduleRect = {
              x: module.position.x,
              y: module.position.y,
              width: moduleWidth,
              height: moduleHeight,
            };
            return (
              moduleRect.x < selectionRect.maxX &&
              moduleRect.x + moduleRect.width > selectionRect.minX &&
              moduleRect.y < selectionRect.maxY &&
              moduleRect.y + moduleRect.height > selectionRect.minY
            );
          })
          .map(m => m.id);

        if (newlySelectedIds.length > 0) {
          if (e.shiftKey) {
            setSelectedModuleIds(prev => {
              const newSet = new Set(prev);
              newlySelectedIds.forEach(id => newSet.add(id));
              return Array.from(newSet);
            });
          } else {
            setSelectedModuleIds(newlySelectedIds);
          }
        }
      }
      setSelectionBox(null);
      selectionStartRef.current = null;
    }
  }, [pan, scale, modules, setSelectedModuleIds, handleSelectionMouseMove]);

  const handleCanvasMouseDown = (e: MouseEvent) => {
    // Panning with middle mouse button
    if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
        return;
    }

    // 모듈 드래그 중이면 박스 선택 시작하지 않음
    if (dragInfoRef.current) {
        return;
    }

    if (e.target === e.currentTarget && e.button === 0) {
        onClearSuggestion();
        setTappedSourcePort(null);
        
        if (isSpacePressed.current) {
            // Space 키를 누른 상태에서만 패닝
            e.preventDefault();
            isPanning.current = true;
            panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
        } else {
            // 일반 드래그 시 선택 박스 모드
            if (!e.shiftKey) {
                setSelectedModuleIds([]);
            }
            isSelecting.current = true;
            const canvasRect = canvasContainerRef.current!.getBoundingClientRect();
            const startX = e.clientX - canvasRect.left;
            const startY = e.clientY - canvasRect.top;
            selectionStartRef.current = { x: startX, y: startY };
            setSelectionBox({ x1: startX, y1: startY, x2: startX, y2: startY });
            
            // 전역 이벤트 리스너 등록
            window.addEventListener('mousemove', handleSelectionMouseMove);
            window.addEventListener('mouseup', handleSelectionMouseUp);
        }
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
      // 모듈 드래그 중이면 패닝하지 않음
      if (dragInfoRef.current) {
          return;
      }
      
      if (dragConnection && canvasContainerRef.current) {
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();
        setDragConnection(prev => prev ? ({
            ...prev,
            to: { 
                x: (e.clientX - canvasRect.left - pan.x) / scale, 
                y: (e.clientY - canvasRect.top - pan.y) / scale
            },
        }) : null);
      } else if (isPanning.current) {
          e.preventDefault();
          setPan({
              x: e.clientX - panStart.current.x,
              y: e.clientY - panStart.current.y
          });
      }
      // 박스 선택은 전역 이벤트 리스너로 처리
  };

  const handleCanvasMouseUp = (e: MouseEvent) => {
      if (isSuggestionDrag) {
        onAcceptSuggestion();
      }
      setIsSuggestionDrag(false);
      setDragConnection(null);

      if(isPanning.current) {
          isPanning.current = false;
          if (e.currentTarget) {
              (e.currentTarget as HTMLElement).style.cursor = 'grab';
          }
      }
      // 박스 선택은 전역 이벤트 리스너로 처리
  };
  
  const handleWheel = (e: React.WheelEvent) => {
        // SpreadViewModal이 열려 있을 때는 캔버스 확대/축소를 막음
        if (connectionDataView) {
            return;
        }
        
        // Ctrl + Wheel: Natural zoom
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY * -0.001;
            const newScale = Math.max(0.2, Math.min(2, scale + delta));
            if (!canvasContainerRef.current) return;
            const canvasRect = canvasContainerRef.current.getBoundingClientRect();
            const mousePoint = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
            const canvasPoint = {
                x: (mousePoint.x - pan.x) / scale,
                y: (mousePoint.y - pan.y) / scale,
            };
            const newPan = {
                x: mousePoint.x - canvasPoint.x * newScale,
                y: mousePoint.y - canvasPoint.y * newScale,
            };
            setScale(newScale);
            setPan(newPan);
            return;
        }
        
        // Shift + Wheel: Horizontal scroll
        if (e.shiftKey) {
            e.preventDefault();
            const deltaX = e.deltaY; // Use deltaY for horizontal scrolling when Shift is pressed
            if (!canvasContainerRef.current) return;
            setPan(prev => ({ x: prev.x - deltaX, y: prev.y }));
            return;
        }
        
        // Default: Normal zoom (if not Ctrl or Shift)
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newScale = Math.max(0.2, Math.min(2, scale + delta));
        if (!canvasContainerRef.current) return;
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();
        const mousePoint = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
        const canvasPoint = {
            x: (mousePoint.x - pan.x) / scale,
            y: (mousePoint.y - pan.y) / scale,
        };
        const newPan = {
            x: mousePoint.x - canvasPoint.x * newScale,
            y: mousePoint.y - canvasPoint.y * newScale,
        };
        setScale(newScale);
        setPan(newPan);
  };

  const handleStartConnection = useCallback((moduleId: string, portName: string, clientX: number, clientY: number, isInput: boolean) => {
    if (!canvasContainerRef.current) return;
    const canvasRect = canvasContainerRef.current.getBoundingClientRect();
    const to = { 
        x: (clientX - canvasRect.left - pan.x) / scale, 
        y: (clientY - canvasRect.top - pan.y) / scale
    };
    
    setDragConnection({ from: { moduleId, portName, isInput }, to });
  }, [scale, pan, canvasContainerRef]);

    const handleStartSuggestionDrag = useCallback((moduleId: string, portName: string, clientX: number, clientY: number, isInput: boolean) => {
        setIsSuggestionDrag(true);
        onStartSuggestion(moduleId, portName);
    }, [onStartSuggestion]);

  const handleEndConnection = useCallback((moduleId: string, portName: string, dropOnIsInput: boolean) => {
    if (isSuggestionDrag) {
        onAcceptSuggestion();
    } else if (dragConnection) {
        const fromModule = modules.find(m => m.id === dragConnection.from.moduleId);
        const toModule = modules.find(m => m.id === moduleId);

        if (!fromModule || !toModule || fromModule.id === toModule.id) {
            setDragConnection(null);
            return;
        }

        const dragFromIsInput = dragConnection.from.isInput;

        if (dragFromIsInput && !dropOnIsInput) { // Drag from INPUT to OUTPUT
            const fromPort = toModule.outputs.find(p => p.name === portName);
            const toPort = fromModule.inputs.find(p => p.name === dragConnection.from.portName);
            if (fromPort && toPort && fromPort.type === toPort.type) {
                const newConnection: Connection = {
                    id: `conn-${Date.now()}`,
                    from: { moduleId: toModule.id, portName: fromPort.name },
                    to: { moduleId: fromModule.id, portName: toPort.name },
                };
                setConnections(prev => [
                    ...prev.filter(c => !(c.to.moduleId === fromModule.id && c.to.portName === toPort.name)),
                    newConnection,
                ]);
            }
        } else if (!dragFromIsInput && dropOnIsInput) { // Drag from OUTPUT to INPUT
            const fromPort = fromModule.outputs.find(p => p.name === dragConnection.from.portName);
            const toPort = toModule.inputs.find(p => p.name === portName);
            if (fromPort && toPort && fromPort.type === toPort.type) {
                const newConnection: Connection = {
                    id: `conn-${Date.now()}`,
                    from: { moduleId: fromModule.id, portName: fromPort.name },
                    to: { moduleId: toModule.id, portName: toPort.name },
                };
                setConnections(prev => [
                    ...prev.filter(c => !(c.to.moduleId === toModule.id && c.to.portName === toPort.name)),
                    newConnection,
                ]);
            }
        }
    }
    setDragConnection(null);
    setIsSuggestionDrag(false);
  }, [dragConnection, isSuggestionDrag, modules, setConnections, onAcceptSuggestion]);

  const handleTapPort = useCallback((moduleId: string, portName: string, isInput: boolean) => {
    cancelDragConnection(); 

    if (isInput) {
        if (tappedSourcePort) {
            const sourceModule = modules.find(m => m.id === tappedSourcePort.moduleId);
            const targetModule = modules.find(m => m.id === moduleId);
            if (!sourceModule || !targetModule || sourceModule.id === targetModule.id) {
                setTappedSourcePort(null);
                return;
            }

            const sourcePort = sourceModule.outputs.find(p => p.name === tappedSourcePort.portName);
            const targetPort = targetModule.inputs.find(p => p.name === portName);

            if (sourcePort && targetPort && sourcePort.type === targetPort.type) {
                const newConnection: Connection = {
                    id: `conn-${Date.now()}`,
                    from: tappedSourcePort,
                    to: { moduleId, portName },
                };
                setConnections(prev => [
                    ...prev.filter(c => !(c.to.moduleId === moduleId && c.to.portName === portName)),
                    newConnection,
                ]);
            }
            setTappedSourcePort(null);
        }
    } else {
        if (tappedSourcePort && tappedSourcePort.moduleId === moduleId && tappedSourcePort.portName === portName) {
            setTappedSourcePort(null);
        } else {
            setTappedSourcePort({ moduleId, portName });
        }
    }
  }, [tappedSourcePort, modules, setConnections, cancelDragConnection]);
  
    const handleCanvasTouchEnd = (e: React.TouchEvent) => {
        if (dragConnection) {
            cancelDragConnection();
        }
    }

    const handleConnectionDoubleClick = useCallback((connectionId: string) => {
        if (suggestion && suggestion.connection.id === connectionId) {
            return;
        }
        setConnections(prev => prev.filter(c => c.id !== connectionId));
    }, [setConnections, suggestion]);

    // 베지어 곡선의 중간점 계산 함수
    const getBezierMidpoint = useCallback((
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): { x: number; y: number } => {
        // Cubic Bezier 곡선: M${start.x},${start.y} C${start.x},${start.y + 75} ${end.x},${end.y - 75} ${end.x},${end.y}
        // P0 = start, P1 = (start.x, start.y + 75), P2 = (end.x, end.y - 75), P3 = end
        // t = 0.5일 때의 점 계산
        const t = 0.5;
        const p0 = { x: start.x, y: start.y };
        const p1 = { x: start.x, y: start.y + 75 };
        const p2 = { x: end.x, y: end.y - 75 };
        const p3 = { x: end.x, y: end.y };
        
        const mt = 1 - t;
        const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
        const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
        
        return { x, y };
    }, []);

    // 연결선을 통해 전달되는 데이터를 가져오는 함수
    const getConnectionData = useCallback((connection: Connection): {
        data: Array<Record<string, any>>;
        columns: Array<{ name: string; type?: string }>;
    } | null => {
        if (!connection || !connection.from || !connection.from.moduleId) return null;
        const fromModule = modules.find(m => m && m.id === connection.from.moduleId);
        if (!fromModule) return null;

        const fromPortName = connection.from?.portName;
        if (!fromPortName) return null;

        // 두 번째 출력 포트 처리
        if (fromPortName === "data_out2" && (fromModule as any).outputData2) {
            const outputData2 = (fromModule as any).outputData2;
            if (outputData2.type === "DataPreview") {
                return {
                    data: outputData2.rows || [],
                    columns: outputData2.columns || [],
                };
            }
        }

        if (!fromModule.outputData) return null;

        const outputData = fromModule.outputData;

        // DataPreview 타입
        if (outputData.type === "DataPreview" && fromPortName === "data_out") {
            const dataPreview = outputData as DataPreview;
            return {
                data: dataPreview.rows || [],
                columns: dataPreview.columns || [],
            };
        }

        // SplitDataOutput
        if (outputData.type === "SplitDataOutput") {
            if (fromPortName === "train_data_out") {
                const trainData = outputData.train;
                return {
                    data: trainData?.rows || [],
                    columns: trainData?.columns || [],
                };
            } else if (fromPortName === "test_data_out") {
                const testData = outputData.test;
                return {
                    data: testData?.rows || [],
                    columns: testData?.columns || [],
                };
            }
        }

        // MissingHandlerOutput, EncoderOutput, NormalizerOutput
        if (
            outputData.type === "MissingHandlerOutput" ||
            outputData.type === "EncoderOutput" ||
            outputData.type === "NormalizerOutput"
        ) {
            const data = (outputData as any).data;
            if (data && data.type === "DataPreview") {
                return {
                    data: data.rows || [],
                    columns: data.columns || [],
                };
            }
        }

        // KMeansOutput
        if (outputData.type === "KMeansOutput") {
            const clusterData = outputData.clusterAssignments;
            return {
                data: clusterData?.rows || [],
                columns: clusterData?.columns || [],
            };
        }

        // PCAOutput
        if (outputData.type === "PCAOutput") {
            const transformedData = outputData.transformedData;
            return {
                data: transformedData?.rows || [],
                columns: transformedData?.columns || [],
            };
        }

        // ClusteringDataOutput
        if (outputData.type === "ClusteringDataOutput") {
            const clusteredData = outputData.clusteredData;
            return {
                data: clusteredData?.rows || [],
                columns: clusteredData?.columns || [],
            };
        }

        return null;
    }, [modules]);

    // 연결선 중간 사각형 클릭 핸들러
    const handleConnectionMarkerClick = useCallback((connection: Connection, e: React.MouseEvent) => {
        e.stopPropagation();
        const connectionData = getConnectionData(connection);
        if (connectionData && connectionData.data.length > 0) {
            setConnectionDataView({
                connection,
                data: connectionData.data,
                columns: connectionData.columns,
            });
        }
    }, [getConnectionData]);

    const allModules = suggestion ? [...modules, suggestion.module] : modules;
    const allConnections = suggestion ? [...connections, suggestion.connection] : connections;

  return (
    <div
      className="w-full h-full relative"
      style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onTouchEnd={handleCanvasTouchEnd}
      onWheel={handleWheel}
    >
      {/* Layer 1: Modules (HTML elements) */}
      <div
        ref={modulesLayerRef}
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {allModules.map(module => {
          // Render shapes separately
          if (module.type === ModuleType.TextBox || module.type === ModuleType.GroupBox) {
            return (
              <ShapeRenderer
                key={module.id}
                module={module}
                isSelected={selectedModuleIds.includes(module.id)}
                onDragStart={handleModuleDragStart}
                onDelete={onDeleteModule}
                onUpdateModule={onUpdateModule}
                scale={scale}
              />
            );
          }
          // Render regular modules
          return (
            <ModuleNode 
              key={module.id} 
              module={module} 
              isSelected={selectedModuleIds.includes(module.id)} 
              onDragStart={handleModuleDragStart}
              onTouchDragStart={handleModuleTouchDragStart}
              onDoubleClick={onModuleDoubleClick}
              portRefs={portRefs}
              onStartConnection={handleStartConnection}
              onEndConnection={handleEndConnection}
              onViewDetails={onViewDetails}
              scale={scale}
              onRunModule={onRunModule}
              tappedSourcePort={tappedSourcePort}
              onTapPort={handleTapPort}
              cancelDragConnection={cancelDragConnection}
              onDelete={onDeleteModule}
              onModuleNameChange={onUpdateModuleName}
              isSuggestion={!!suggestion && suggestion.module.id === module.id}
              onAcceptSuggestion={onAcceptSuggestion}
              onStartSuggestion={handleStartSuggestionDrag}
              dragConnection={dragConnection}
              areUpstreamModulesReady={areUpstreamModulesReady}
              allModules={allModules}
              allConnections={allConnections}
            />
          );
        })}
      </div>

       {selectionBox && (
            <div
                className="absolute border-2 border-dashed border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none z-30"
                style={{
                    left: Math.min(selectionBox.x1, selectionBox.x2),
                    top: Math.min(selectionBox.y1, selectionBox.y2),
                    width: Math.abs(selectionBox.x1 - selectionBox.x2),
                    height: Math.abs(selectionBox.y1 - selectionBox.y2),
                }}
            />
        )}

      {/* Layer 2: Connections (SVG overlay) */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      >
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={theme === 'light' ? '#1f2937' : '#FFFFFF'} />
            </marker>
             <marker id="arrow-drag" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
            </marker>
        </defs>
        {/* This group element applies the same pan and zoom to the connections as the modules */}
        <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`}}>
            {allConnections.map(conn => {
                const fromModule = allModules.find(m => m.id === conn.from.moduleId);
                const toModule = allModules.find(m => m.id === conn.to.moduleId);
                if (!fromModule || !toModule) return null;

                const start = getPortPosition(fromModule, conn.from.portName, false);
                const end = getPortPosition(toModule, conn.to.portName, true);
                const isSuggestionConn = !!suggestion && suggestion.connection.id === conn.id;
                const pathD = `M${start.x},${start.y} C${start.x},${start.y + 75} ${end.x},${end.y - 75} ${end.x},${end.y}`;

                // 연결선 중간점 계산
                const midpoint = getBezierMidpoint(start, end);
                const connectionData = getConnectionData(conn);
                const hasData = connectionData !== null && connectionData.data.length > 0;

                return (
                    <g key={conn.id} onDoubleClick={() => handleConnectionDoubleClick(conn.id)}>
                        <path
                            d={pathD}
                            stroke={isSuggestionConn ? "#a78bfa" : (theme === 'light' ? "#1f2937" : "#FFFFFF")}
                            strokeWidth={theme === 'light' ? "2.5" : "3"}
                            fill="none"
                            strokeDasharray={isSuggestionConn ? "6,6" : undefined}
                            markerEnd="url(#arrow)"
                            style={{ pointerEvents: 'none' }}
                        />
                        <path
                            d={pathD}
                            stroke="transparent"
                            strokeWidth="20"
                            fill="none"
                            style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                            title="Double-click to delete connection"
                        />
                        {/* 연결선 중간 사각형 마커 */}
                        {hasData && (
                            <g>
                                <rect
                                    x={midpoint.x - 8}
                                    y={midpoint.y - 8}
                                    width={16}
                                    height={16}
                                    fill="#3b82f6"
                                    stroke="#1e40af"
                                    strokeWidth="2"
                                    rx="2"
                                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                                    onClick={(e) => handleConnectionMarkerClick(conn, e)}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as SVGRectElement).setAttribute('fill', '#2563eb');
                                        if (connectionData) {
                                            const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                                            const canvasRect = canvasContainerRef.current?.getBoundingClientRect();
                                            setConnectionTooltip({
                                                screenX: rect.left + rect.width / 2 - (canvasRect?.left ?? 0),
                                                screenY: rect.top - (canvasRect?.top ?? 0) - 8,
                                                fromName: fromModule.name,
                                                toName: toModule.name,
                                                rowCount: connectionData.data.length,
                                                columns: connectionData.columns,
                                            });
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as SVGRectElement).setAttribute('fill', '#3b82f6');
                                        setConnectionTooltip(null);
                                    }}
                                />
                                <text
                                    x={midpoint.x}
                                    y={midpoint.y + 4}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#FFFFFF"
                                    fontWeight="bold"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    ⚡
                                </text>
                            </g>
                        )}
                    </g>
                )
            })}
            {dragConnection && (
                () => {
                    const fromModule = modules.find(m => m.id === dragConnection.from.moduleId);
                    if (!fromModule) return null;
                    
                    const isInput = dragConnection.from.isInput;
                    const start = getPortPosition(fromModule, dragConnection.from.portName, isInput);
                    const end = dragConnection.to;
                    
                    const path = isInput
                        ? `M${end.x},${end.y} C${end.x},${end.y + 75} ${start.x},${start.y - 75} ${start.x},${start.y}`
                        : `M${start.x},${start.y} C${start.x},${start.y + 75} ${end.x},${end.y - 75} ${end.x},${end.y}`;

                    return (
                         <path
                            d={path}
                            stroke="#a78bfa"
                            strokeWidth="3"
                            fill="none"
                            strokeDasharray="6,6"
                            markerEnd={!isInput ? "url(#arrow-drag)" : undefined}
                            markerStart={isInput ? "url(#arrow-drag)" : undefined}
                        />
                    )
                }
            )()}
        </g>
      </svg>

      {/* Connection Hover Tooltip */}
      {connectionTooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: connectionTooltip.screenX,
            top: connectionTooltip.screenY,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-xl px-3 py-2 text-xs text-white min-w-[180px] max-w-[260px]">
            <div className="text-[10px] text-gray-400 mb-1 truncate">
              {connectionTooltip.fromName} → {connectionTooltip.toName}
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-semibold text-blue-300">{connectionTooltip.rowCount.toLocaleString()} rows</span>
              <span className="text-gray-500">×</span>
              <span className="font-semibold text-blue-300">{connectionTooltip.columns.length} cols</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {connectionTooltip.columns.slice(0, 6).map(col => (
                <span key={col.name} className="bg-gray-700 text-gray-200 rounded px-1 py-0.5 text-[10px] truncate max-w-[80px]" title={col.name}>
                  {col.name}
                </span>
              ))}
              {connectionTooltip.columns.length > 6 && (
                <span className="text-gray-500 text-[10px]">+{connectionTooltip.columns.length - 6}개</span>
              )}
            </div>
            <div className="mt-1.5 text-[10px] text-gray-500">⚡ 클릭하여 전체 데이터 보기</div>
          </div>
          {/* 아래 화살표 */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-600" />
        </div>
      )}

      {/* Connection Data View Modal */}
      {connectionDataView && (
        <SpreadViewModal
          onClose={() => setConnectionDataView(null)}
          data={connectionDataView.data}
          columns={connectionDataView.columns}
          title={`Connection Data: ${allModules.find(m => m.id === connectionDataView.connection.from.moduleId)?.name || 'Unknown'} → ${allModules.find(m => m.id === connectionDataView.connection.to.moduleId)?.name || 'Unknown'}`}
        />
      )}
    </div>
  );
};