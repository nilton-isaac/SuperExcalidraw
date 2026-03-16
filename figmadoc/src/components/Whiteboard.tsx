import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { parseElementsFromClipboard } from '../lib/whiteboardData';
import type { Point, WhiteboardElement } from '../types';
import { SelectionInspector } from './SelectionInspector';
import { Icon } from './Icon';
import { ArrowElementComponent } from './elements/ArrowElement';
import { CodeBlockElement } from './elements/CodeBlockElement';
import { ImageElementComponent } from './elements/ImageElement';
import { ShapeElementComponent } from './elements/ShapeElement';
import { StickyElementComponent } from './elements/StickyElement';
import { TextElementComponent } from './elements/TextElement';

export function Whiteboard() {
  const {
    elements,
    selectedIds,
    activeTool,
    viewState,
    selectElement,
    clearSelection,
    addElement,
    updateElements,
    deleteSelectedElements,
    duplicateElement,
    selectAll,
    setSelectedIds,
    setViewState,
    setActiveTool,
    groupSelected,
    ungroupSelected,
    toggleLock,
    copySelected,
    paste,
    historyPush,
    undo,
    redo,
    activeSurface,
    setActiveSurface,
    toolDefaults,
    bringSelectionToFront,
    sendSelectionToBack,
  } = useStore();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [drawingShape, setDrawingShape] = useState<{
    shapeType: 'rectangle' | 'circle' | 'diamond';
    start: Point;
    current: Point;
  } | null>(null);
  const [drawingArrow, setDrawingArrow] = useState<Point[] | null>(null);
  const [penPoints, setPenPoints] = useState<Point[] | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    start: Point;
    current: Point;
    additive: boolean;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const panStart = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);
  const lastPointerCanvasRef = useRef<Point | null>(null);

  const toCanvas = useCallback(
    (screenX: number, screenY: number): Point => {
      const rect = wrapperRef.current!.getBoundingClientRect();
      return {
        x: (screenX - rect.left - viewState.x) / viewState.zoom,
        y: (screenY - rect.top - viewState.y) / viewState.zoom,
      };
    },
    [viewState]
  );

  const getViewportCenter = useCallback((): Point => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 240, y: 180 };
    return toCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [toCanvas]);

  const getPasteAnchor = useCallback((): Point => {
    return lastPointerCanvasRef.current ?? getViewportCenter();
  }, [getViewportCenter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing = isEditableTarget(target);
      const insideWhiteboard = isInsideSurface(target, 'whiteboard');
      const insideDocs = isInsideSurface(target, 'document');
      const hasPrimaryModifier = event.ctrlKey || event.metaKey;
      const hasToolModifier = hasPrimaryModifier || event.altKey;
      const shouldHandleWhiteboard =
        !insideDocs && !isEditing && (insideWhiteboard || activeSurface === 'whiteboard');

      if (!shouldHandleWhiteboard) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setIsSpaceDown(true);
      }

      if (hasPrimaryModifier && !event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        undo();
        return;
      }

      if (hasPrimaryModifier && event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        redo();
        return;
      }

      if (hasPrimaryModifier && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelectedElements();
      if (event.key === 'Escape') {
        clearSelection();
        setActiveTool('select');
      }
      if (hasPrimaryModifier && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        selectAll();
        return;
      }
      if (hasPrimaryModifier && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault();
        selectedIds.forEach((id) => duplicateElement(id));
        return;
      }
      if (hasPrimaryModifier && (event.key === 'c' || event.key === 'C')) {
        event.preventDefault();
        void copySelected();
        return;
      }
      if (hasPrimaryModifier && !event.shiftKey && (event.key === 'g' || event.key === 'G')) {
        event.preventDefault();
        groupSelected();
        return;
      }
      if (hasPrimaryModifier && event.shiftKey && (event.key === 'g' || event.key === 'G')) {
        event.preventDefault();
        ungroupSelected();
        return;
      }

      if (hasToolModifier) {
        return;
      }

      if (event.key === 'l' || event.key === 'L') selectedIds.forEach((id) => toggleLock(id));
      if (event.key === 'v' || event.key === 'V') setActiveTool('select');
      if (event.key === 'h' || event.key === 'H') setActiveTool('hand');
      if (event.key === 'r' || event.key === 'R') setActiveTool('rectangle');
      if (event.key === 'o' || event.key === 'O') setActiveTool('circle');
      if (event.key === 'd' || event.key === 'D') setActiveTool('diamond');
      if (event.key === 's' || event.key === 'S') setActiveTool('sticky');
      if (event.key === 'c' || event.key === 'C') setActiveTool('code');
      if (event.key === 'a' || event.key === 'A') setActiveTool('arrow');
      if (event.key === 't' || event.key === 'T') setActiveTool('text');
      if (event.key === 'i' || event.key === 'I') setActiveTool('image');
      if (event.key === 'p' || event.key === 'P') setActiveTool('pen');
      if (event.key === 'e' || event.key === 'E') setActiveTool('eraser');
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpaceDown(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activeSurface,
    selectedIds,
    deleteSelectedElements,
    clearSelection,
    selectAll,
    duplicateElement,
    setActiveTool,
    copySelected,
        groupSelected,
        ungroupSelected,
        toggleLock,
        undo,
        redo,
  ]);

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      const target = event.target;
      const isEditing = isEditableTarget(target);
      const insideWhiteboard = isInsideSurface(target, 'whiteboard');
      const insideDocs = isInsideSurface(target, 'document');
      if (isEditing || insideDocs || (!insideWhiteboard && activeSurface !== 'whiteboard')) return;

      const clipboardData = event.clipboardData;
      if (!clipboardData) return;
      const anchor = getPasteAnchor();

      const imageItem = Array.from(clipboardData.items).find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (!file) return;
        event.preventDefault();
        const src = await readFileAsDataURL(file);
        const id = addElement({
          type: 'image',
          x: anchor.x,
          y: anchor.y,
          width: 360,
          height: 240,
          properties: {
            src,
            alt: file.name || 'Pasted image',
            objectFit: 'contain',
          },
        });
        selectElement(id);
        return;
      }

      const text = clipboardData.getData('text/plain');
      if (!text.trim()) {
        paste(undefined, anchor);
        return;
      }

      event.preventDefault();
      const parsedElements = parseElementsFromClipboard(text);
      if (parsedElements && parsedElements.length > 0) {
        paste(parsedElements, anchor);
        return;
      }

      const lines = text.split(/\r?\n/);
      const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
      const width = Math.max(180, Math.min(460, longestLine * 8 + 32));
      const height = Math.max(42, Math.min(320, lines.length * 26 + 20));
      const id = addElement({
        type: 'text',
        x: anchor.x,
        y: anchor.y,
        width,
        height,
        properties: {
          text,
          fontSize: 18,
          fontWeight: 'normal',
          color: '#000000',
          fontFamily: 'Inter',
          textAlign: 'left',
        },
      });
      selectElement(id);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [activeSurface, addElement, getPasteAnchor, paste, selectElement]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const factor = event.deltaY < 0 ? 1.08 : 0.93;
        const nextZoom = Math.max(0.05, Math.min(5, viewState.zoom * factor));
        const rect = element.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        setViewState({
          zoom: nextZoom,
          x: mouseX - (mouseX - viewState.x) * (nextZoom / viewState.zoom),
          y: mouseY - (mouseY - viewState.y) * (nextZoom / viewState.zoom),
        });
      } else if (event.shiftKey) {
        setViewState({ x: viewState.x - event.deltaY, y: viewState.y - event.deltaX });
      } else {
        setViewState({ x: viewState.x - event.deltaX, y: viewState.y - event.deltaY });
      }
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [viewState, setViewState]);

  const isPanMode = activeTool === 'hand' || isSpaceDown;

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (isPanMode) return 'grab';
    if (activeTool === 'eraser') return 'cell';
    if (activeTool !== 'select') return 'crosshair';
    return 'default';
  };

  const onCanvasPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      setContextMenu(null);
      const point = toCanvas(event.clientX, event.clientY);
      lastPointerCanvasRef.current = point;

      if (isPanMode) {
        setIsPanning(true);
        panStart.current = { mx: event.clientX, my: event.clientY, vx: viewState.x, vy: viewState.y };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === 'select') {
        const additive = event.shiftKey || event.ctrlKey || event.metaKey;
        if (!additive) clearSelection();
        setSelectionBox({
          start: point,
          current: point,
          additive,
        });
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        return;
      }

      clearSelection();

      if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'diamond') {
        setDrawingShape({
          shapeType:
            activeTool === 'rectangle'
              ? 'rectangle'
              : activeTool === 'circle'
                ? 'circle'
                : 'diamond',
          start: point,
          current: point,
        });
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === 'sticky') {
        const id = addElement({
          type: 'sticky',
          x: point.x - 90,
          y: point.y - 60,
          width: 180,
          height: 120,
          properties: {
            text: '',
            color: toolDefaults.sticky.color,
            textColor: toolDefaults.sticky.textColor,
            fontSize: toolDefaults.sticky.fontSize,
            fontFamily: toolDefaults.sticky.fontFamily,
            textAlign: toolDefaults.sticky.textAlign,
          },
        });
        selectElement(id);
        setActiveTool('select');
        return;
      }

      if (activeTool === 'code') {
        const id = addElement({
          type: 'code',
          x: point.x - 200,
          y: point.y - 170,
          width: 400,
          height: 340,
          properties: {
            title: 'React Block',
            runtime: 'react',
            html: '<div id="root"></div>',
            css: 'body{background:#fff;color:#000;font-family:Inter,system-ui,sans-serif;}\n.card{display:grid;gap:16px;padding:24px;max-width:320px;margin:24px auto;border:1px solid #000;border-radius:24px;box-shadow:0 18px 40px rgba(0,0,0,0.08);}\nbutton{height:42px;border-radius:999px;border:1px solid #000;background:#000;color:#fff;font-weight:700;cursor:pointer;}\np{margin:0;color:#444;}',
            js: "import React, { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className=\"card\">\n      <div>\n        <h2>React JSX ready</h2>\n        <p>This sandbox now runs AI-generated JSX and TSX snippets.</p>\n      </div>\n      <button onClick={() => setCount((value) => value + 1)}>\n        Clicked {count} times\n      </button>\n    </div>\n  );\n}\n",
          },
        });
        selectElement(id);
        setActiveTool('select');
        return;
      }

      if (activeTool === 'text') {
        const id = addElement({
          type: 'text',
          x: point.x,
          y: point.y,
          width: 220,
          height: 36,
          properties: {
            text: 'Text',
            fontSize: toolDefaults.text.fontSize,
            fontWeight: toolDefaults.text.fontWeight,
            color: toolDefaults.text.color,
            fontFamily: toolDefaults.text.fontFamily,
            textAlign: toolDefaults.text.textAlign,
          },
        });
        selectElement(id);
        setActiveTool('select');
        return;
      }

      if (activeTool === 'image') {
        const clickPoint = { ...point };
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            const src = readerEvent.target?.result as string;
            const id = addElement({
              type: 'image',
              x: clickPoint.x - 150,
              y: clickPoint.y - 100,
              width: 300,
              height: 200,
              properties: { src, alt: file.name, objectFit: 'contain' },
            });
            selectElement(id);
            setActiveTool('select');
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }

      if (activeTool === 'arrow') {
        setDrawingArrow([point]);
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === 'pen') {
        setPenPoints([point]);
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }
    },
    [activeTool, isPanMode, toCanvas, addElement, selectElement, clearSelection, setActiveTool, toolDefaults]
  );

  const onCanvasPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const point = toCanvas(event.clientX, event.clientY);
      lastPointerCanvasRef.current = point;

      if (panStart.current) {
        setViewState({
          x: panStart.current.vx + (event.clientX - panStart.current.mx),
          y: panStart.current.vy + (event.clientY - panStart.current.my),
        });
        return;
      }

      if (selectionBox) {
        setSelectionBox((previous) => (previous ? { ...previous, current: point } : previous));
        return;
      }

      if (drawingShape) {
        setDrawingShape((previous) => (previous ? { ...previous, current: point } : previous));
        return;
      }

      if (drawingArrow) {
        setDrawingArrow([drawingArrow[0], point]);
        return;
      }

      if (penPoints) {
        setPenPoints((previous) => (previous ? [...previous, point] : []));
      }
    },
    [drawingArrow, drawingShape, penPoints, selectionBox, toCanvas, setViewState]
  );

  const onCanvasPointerUp = useCallback(
    (_event: React.PointerEvent) => {
      if (panStart.current) {
        setIsPanning(false);
        panStart.current = null;
        return;
      }

      if (drawingShape) {
        const left = Math.min(drawingShape.start.x, drawingShape.current.x);
        const top = Math.min(drawingShape.start.y, drawingShape.current.y);
        const rawWidth = Math.abs(drawingShape.current.x - drawingShape.start.x);
        const rawHeight = Math.abs(drawingShape.current.y - drawingShape.start.y);
        const width = rawWidth < 8 ? 140 : rawWidth;
        const height = rawHeight < 8 ? 72 : rawHeight;
        const x = rawWidth < 8 ? drawingShape.start.x - width / 2 : left;
        const y = rawHeight < 8 ? drawingShape.start.y - height / 2 : top;

        const id = addElement({
          type: 'shape',
          x,
          y,
          width,
          height,
          properties: {
            shapeType: drawingShape.shapeType,
            text: '',
            fillColor: toolDefaults.shape.fillColor,
            strokeColor: toolDefaults.shape.strokeColor,
            textColor: toolDefaults.shape.textColor,
            fontSize: toolDefaults.shape.fontSize,
            fontFamily: toolDefaults.shape.fontFamily,
            fontWeight: toolDefaults.shape.fontWeight,
            textAlign: toolDefaults.shape.textAlign,
          },
        });
        setDrawingShape(null);
        selectElement(id);
        setActiveTool('select');
        return;
      }

      if (drawingArrow && drawingArrow.length === 2) {
        const [from, to] = drawingArrow;
        if (Math.hypot(to.x - from.x, to.y - from.y) > 10) {
          addElement({
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            properties: {
              points: drawingArrow,
              color: toolDefaults.arrow.color,
              strokeWidth: toolDefaults.arrow.strokeWidth,
            },
          });
        }
        setDrawingArrow(null);
        setActiveTool('select');
        return;
      }

      if (penPoints && penPoints.length > 2) {
        addElement({
          type: 'pen',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          properties: {
            points: penPoints,
            color: toolDefaults.pen.color,
            strokeWidth: toolDefaults.pen.strokeWidth,
          },
        });
        setPenPoints(null);
        setActiveTool('select');
        return;
      }

      if (selectionBox) {
        const idsInBox = getElementIdsInSelectionBox(elements, selectionBox);
        if (selectionBox.additive) {
          setSelectedIds([...selectedIds, ...idsInBox]);
        } else {
          setSelectedIds(idsInBox);
        }
        setSelectionBox(null);
        return;
      }

      setPenPoints(null);
      setDrawingArrow(null);
      setDrawingShape(null);
    },
    [drawingArrow, drawingShape, elements, penPoints, selectedIds, selectionBox, addElement, selectElement, setActiveTool, setSelectedIds, toolDefaults]
  );

  const onElementPointerDown = useCallback(
    (event: React.PointerEvent, element: WhiteboardElement) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setContextMenu(null);
      lastPointerCanvasRef.current = toCanvas(event.clientX, event.clientY);

      if (activeTool === 'eraser') {
        useStore.getState().deleteElement(element.id);
        return;
      }

      if (activeTool !== 'select') return;

      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      if (additive) {
        selectElement(element.id, true);
        return;
      }

      const state = useStore.getState();
      const directSelectionIds = element.groupId
        ? state.elements.filter((candidate) => candidate.groupId === element.groupId).map((candidate) => candidate.id)
        : [element.id];
      const dragIds = state.selectedIds.includes(element.id) ? state.selectedIds : directSelectionIds;

      if (!state.selectedIds.includes(element.id)) {
        setSelectedIds(directSelectionIds);
      }

      const draggableElements = state.elements.filter(
        (candidate) => dragIds.includes(candidate.id) && !candidate.locked
      );
      if (draggableElements.length === 0) return;

      historyPush();
      const startX = event.clientX;
      const startY = event.clientY;
      const startPositions = new Map(
        draggableElements.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }])
      );
      let frame = 0;
      let lastEvent: PointerEvent | null = null;

      const onMove = (nextEvent: PointerEvent) => {
        lastEvent = nextEvent;
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          if (!lastEvent) {
            frame = 0;
            return;
          }

          const dx = (lastEvent.clientX - startX) / viewState.zoom;
          const dy = (lastEvent.clientY - startY) / viewState.zoom;
          updateElements(
            draggableElements.map((candidate) => {
              const initial = startPositions.get(candidate.id)!;
              return {
                id: candidate.id,
                updates: {
                  x: initial.x + dx,
                  y: initial.y + dy,
                },
              };
            })
          );
          frame = 0;
        });
      };

      const onUp = () => {
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [activeTool, historyPush, selectElement, setSelectedIds, toCanvas, updateElements, viewState.zoom]
  );

  const onElementContextMenu = useCallback(
    (event: React.MouseEvent, id: string) => {
      event.preventDefault();
      event.stopPropagation();
      selectElement(id);
      setContextMenu({ x: event.clientX, y: event.clientY, elementId: id });
    },
    [selectElement]
  );

  const activeGroupId = (() => {
    for (const id of selectedIds) {
      const element = elements.find((candidate) => candidate.id === id);
      if (element?.groupId) return element.groupId;
    }
    return null;
  })();

  const groupBox = activeGroupId
    ? (() => {
        const members = elements.filter((element) => element.groupId === activeGroupId);
        const xs = members.map((member) => member.x);
        const ys = members.map((member) => member.y);
        const xe = members.map((member) => member.x + member.width);
        const ye = members.map((member) => member.y + member.height);
        return {
          x: Math.min(...xs) - 8,
          y: Math.min(...ys) - 8,
          w: Math.max(...xe) - Math.min(...xs) + 16,
          h: Math.max(...ye) - Math.min(...ys) + 16,
        };
      })()
    : null;

  const contextElement = contextMenu
    ? elements.find((element) => element.id === contextMenu.elementId)
    : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div
        ref={wrapperRef}
        data-whiteboard-root="true"
        tabIndex={0}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--canvas-bg)',
          cursor: getCursor(),
          minHeight: 0,
          outline: 'none',
        }}
        onPointerDownCapture={() => setActiveSurface('whiteboard')}
        onFocusCapture={() => setActiveSurface('whiteboard')}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle, var(--grid-color) 1.2px, transparent 1.2px)',
            backgroundSize: `${24 * viewState.zoom}px ${24 * viewState.zoom}px`,
            backgroundPosition: `${viewState.x % (24 * viewState.zoom)}px ${viewState.y % (24 * viewState.zoom)}px`,
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {groupBox && (
            <div
              style={{
                position: 'absolute',
                left: groupBox.x,
                top: groupBox.y,
                width: groupBox.w,
                height: groupBox.h,
                border: '1.5px dashed var(--primary)',
                borderRadius: 10,
                pointerEvents: 'none',
                opacity: 0.7,
              }}
            />
          )}

          {penPoints && penPoints.length > 1 && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              <path
                d={penPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')}
                fill="none"
                stroke="var(--text-primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {drawingArrow && drawingArrow.length === 2 && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id="arrow-preview" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="var(--text-primary)" />
                </marker>
              </defs>
              <line
                x1={drawingArrow[0].x}
                y1={drawingArrow[0].y}
                x2={drawingArrow[1].x}
                y2={drawingArrow[1].y}
                stroke="var(--text-primary)"
                strokeWidth={2}
                strokeDasharray="6 4"
                markerEnd="url(#arrow-preview)"
              />
            </svg>
          )}

          {drawingShape && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(drawingShape.start.x, drawingShape.current.x),
                top: Math.min(drawingShape.start.y, drawingShape.current.y),
                width: Math.max(4, Math.abs(drawingShape.current.x - drawingShape.start.x)),
                height: Math.max(4, Math.abs(drawingShape.current.y - drawingShape.start.y)),
                border: `2px solid ${toolDefaults.shape.strokeColor}`,
                background: toolDefaults.shape.fillColor === 'transparent' ? 'transparent' : toolDefaults.shape.fillColor,
                borderRadius:
                  drawingShape.shapeType === 'circle'
                    ? '50%'
                    : drawingShape.shapeType === 'rectangle'
                      ? 10
                      : 0,
                transform: drawingShape.shapeType === 'diamond' ? 'rotate(45deg)' : undefined,
                transformOrigin: 'center center',
                opacity: 0.65,
                pointerEvents: 'none',
              }}
            />
          )}

          {selectionBox && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(selectionBox.start.x, selectionBox.current.x),
                top: Math.min(selectionBox.start.y, selectionBox.current.y),
                width: Math.abs(selectionBox.current.x - selectionBox.start.x),
                height: Math.abs(selectionBox.current.y - selectionBox.start.y),
                border: '1.5px dashed var(--primary)',
                background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                borderRadius: 8,
                pointerEvents: 'none',
              }}
            />
          )}

          {[...elements].sort((a, b) => a.zIndex - b.zIndex).map((element) => {
            const isSelected = selectedIds.includes(element.id);
            const sharedProps = {
              key: element.id,
              selected: isSelected,
              zoom: viewState.zoom,
              onPointerDown: (event: React.PointerEvent) => onElementPointerDown(event, element),
            };

            const wrapped = (node: ReactNode) => (
              <div key={element.id} onContextMenu={(event) => onElementContextMenu(event, element.id)} style={{ display: 'contents' }}>
                {node}
                {element.locked && (
                  <div
                    style={{
                      position: 'absolute',
                      left: element.x + element.width - 18,
                      top: element.y - 6,
                      pointerEvents: 'none',
                      zIndex: element.zIndex + 1,
                      userSelect: 'none',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 999,
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <Icon name="lock" size={14} />
                  </div>
                )}
              </div>
            );

            if (element.type === 'shape') return wrapped(<ShapeElementComponent element={element} {...sharedProps} />);
            if (element.type === 'sticky') return wrapped(<StickyElementComponent element={element} {...sharedProps} />);
            if (element.type === 'code') return wrapped(<CodeBlockElement element={element} {...sharedProps} />);
            if (element.type === 'image') return wrapped(<ImageElementComponent element={element} {...sharedProps} />);
            if (element.type === 'text') {
              return wrapped(
                <TextElementComponent
                  element={element}
                  selected={isSelected}
                  zoom={viewState.zoom}
                  onPointerDown={(event) => onElementPointerDown(event, element)}
                />
              );
            }
            if (element.type === 'arrow') {
              return (
                <ArrowElementComponent
                  key={element.id}
                  element={element}
                  selected={isSelected}
                  onPointerDown={(event) => onElementPointerDown(event, element)}
                />
              );
            }
            if (element.type === 'pen') {
              return (
                <PenSVG
                  key={element.id}
                  element={element}
                  selected={isSelected}
                  onPointerDown={(event) => onElementPointerDown(event, element)}
                />
              );
            }
            return null;
          })}
        </div>

        {elements.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.45 }}>
              <Icon name="draw" size={54} />
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}
            >
              Empty canvas
            </div>
            <div style={{ fontSize: 12 }}>Pick a tool from the toolbar and click to add elements</div>
          </div>
        )}

        <SelectionInspector />

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 28,
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'flex', gap: 14 }}>
            <span>
              {elements.length} element{elements.length !== 1 ? 's' : ''}
            </span>
            {selectedIds.length > 0 && (
              <span style={{ color: 'var(--text-secondary)' }}>
                {selectedIds.length} selected | Ctrl+G group | L lock | Ctrl+C/V copy and paste
              </span>
            )}
          </span>
          <span style={{ display: 'flex', gap: 12 }}>
            <span>Ctrl+Scroll zoom | Shift+Scroll horizontal | Scroll pan</span>
            <span
              style={{ fontVariantNumeric: 'tabular-nums', cursor: 'pointer', color: 'var(--text-secondary)' }}
              onClick={() => setViewState({ zoom: 1 })}
              title="Click to reset zoom"
            >
              {Math.round(viewState.zoom * 100)}%
            </span>
          </span>
        </div>
      </div>

      {contextMenu && contextElement && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 997 }} onClick={() => setContextMenu(null)} />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--bg-primary)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              zIndex: 998,
              overflow: 'hidden',
              minWidth: 200,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {[
              { icon: 'content_copy', label: 'Duplicate', action: () => duplicateElement(contextMenu.elementId) },
              {
                icon: contextElement.locked ? 'lock_open' : 'lock',
                label: contextElement.locked ? 'Unlock' : 'Lock',
                action: () => toggleLock(contextMenu.elementId),
              },
              {
                icon: 'vertical_align_top',
                label: 'Bring to front',
                action: bringSelectionToFront,
              },
              {
                icon: 'vertical_align_bottom',
                label: 'Send to back',
                action: sendSelectionToBack,
              },
              {
                icon: 'layers',
                label: 'Group selection',
                action: groupSelected,
                disabled: selectedIds.length < 2,
              },
              {
                icon: 'grid_off',
                label: 'Ungroup',
                action: ungroupSelected,
                disabled: !contextElement.groupId,
              },
              {
                icon: 'delete',
                label: 'Delete',
                action: () => useStore.getState().deleteElement(contextMenu.elementId),
              },
            ].map(({ icon, label, action, disabled }) => (
              <button
                key={label}
                onClick={() => {
                  if (!disabled) {
                    action();
                    setContextMenu(null);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: disabled ? 'default' : 'pointer',
                  fontSize: 13,
                  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                }}
                onMouseEnter={(event) => {
                  if (!disabled) {
                    (event.currentTarget as HTMLButtonElement).style.background = 'var(--bg-tertiary)';
                  }
                }}
                onMouseLeave={(event) => {
                  (event.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <Icon name={icon} size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable]')
  );
}

function isInsideSurface(target: EventTarget | null, surface: 'document' | 'whiteboard') {
  if (!(target instanceof HTMLElement)) return false;
  const selector = surface === 'document' ? '[data-docs-root="true"]' : '[data-whiteboard-root="true"]';
  return Boolean(target.closest(selector));
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getElementIdsInSelectionBox(
  elements: WhiteboardElement[],
  selectionBox: { start: Point; current: Point }
) {
  const box = {
    left: Math.min(selectionBox.start.x, selectionBox.current.x),
    top: Math.min(selectionBox.start.y, selectionBox.current.y),
    right: Math.max(selectionBox.start.x, selectionBox.current.x),
    bottom: Math.max(selectionBox.start.y, selectionBox.current.y),
  };

  if (box.right - box.left < 4 && box.bottom - box.top < 4) {
    return [];
  }

  return elements
    .filter((element) => !element.locked && intersectsBox(box, getElementBounds(element)))
    .map((element) => element.id);
}

function getElementBounds(element: WhiteboardElement) {
  if (element.type === 'arrow' || element.type === 'pen') {
    const points = element.properties.points;
    const allX = points.map((point) => point.x + element.x);
    const allY = points.map((point) => point.y + element.y);

    return {
      left: Math.min(...allX),
      top: Math.min(...allY),
      right: Math.max(...allX),
      bottom: Math.max(...allY),
    };
  }

  return {
    left: element.x,
    top: element.y,
    right: element.x + element.width,
    bottom: element.y + element.height,
  };
}

function intersectsBox(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function PenSVG({
  element,
  selected,
  onPointerDown,
}: {
  element: WhiteboardElement & { type: 'pen' };
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const { points, color, strokeWidth } = element.properties;
  if (!points || points.length < 2) return null;
  const path = points
    .map((point: Point, index: number) => `${index === 0 ? 'M' : 'L'} ${point.x + element.x} ${point.y + element.y}`)
    .join(' ');

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      <path
        d={path}
        fill="none"
        stroke={selected ? 'var(--primary)' : color}
        strokeWidth={selected ? strokeWidth + 1.5 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'stroke', cursor: 'move' }}
        onPointerDown={onPointerDown as unknown as React.PointerEventHandler<SVGPathElement>}
      />
    </svg>
  );
}
