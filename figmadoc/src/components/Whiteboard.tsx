import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buildArrowPathDefinition, getArrowBounds, getArrowRenderablePoints } from '../lib/arrows';
import { createDefaultDataSheet, serializeDataSheet } from '../lib/dataSheet';
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
import { ChartElementComponent } from './elements/ChartElement';
import { TableElementComponent } from './elements/TableElement';

interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

interface ArrowDraft {
  start: Point;
  end: Point;
  startElementId?: string;
  endElementId?: string;
}

interface PanelDraft {
  type: 'code' | 'table' | 'chart';
  start: Point;
  current: Point;
}

// ── Helper: snap arrow point to nearest element edge anchor ──────────────────
function getSnapTarget(
  point: Point,
  elements: WhiteboardElement[],
  threshold = 20
): { snappedPoint: Point; elementId: string } | null {
  let best: { snappedPoint: Point; elementId: string; dist: number } | null = null;

  for (const el of elements) {
    if (el.type === 'arrow' || el.type === 'pen') continue;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const anchors: Point[] = [
      { x: cx, y: el.y },                   // top center
      { x: cx, y: el.y + el.height },        // bottom center
      { x: el.x, y: cy },                    // left center
      { x: el.x + el.width, y: cy },         // right center
    ];
    for (const anchor of anchors) {
      const dist = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { snappedPoint: anchor, elementId: el.id, dist };
      }
    }
  }

  return best ? { snappedPoint: best.snappedPoint, elementId: best.elementId } : null;
}


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
  const [drawingArrow, setDrawingArrow] = useState<ArrowDraft | null>(null);
  const [penPoints, setPenPoints] = useState<Point[] | null>(null);
  const [panelDraft, setPanelDraft] = useState<PanelDraft | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    start: Point;
    current: Point;
    additive: boolean;
  } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const panStart = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);
  const lastPointerCanvasRef = useRef<Point | null>(null);
  const erasedIdsRef = useRef<Set<string>>(new Set());
  const pointerGlowRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

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

  const eraseAtPoint = useCallback((point: Point) => {
    const target = findTopmostElementAtPoint(elements, point);
    if (!target || erasedIdsRef.current.has(target.id)) {
      return;
    }

    erasedIdsRef.current.add(target.id);
    useStore.setState((state) => ({
      elements: state.elements.filter((element) => element.id !== target.id),
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== target.id),
    }));
  }, [elements]);

  const paintPointerGlow = useCallback((clientX: number, clientY: number, visible = true) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const glow = pointerGlowRef.current;
    if (!rect || !glow) return;

    glow.style.opacity = visible ? '1' : '0';
    glow.style.mixBlendMode =
      getComputedStyle(document.documentElement).getPropertyValue('--pointer-glow-blend').trim() || 'multiply';
    glow.style.background = `radial-gradient(220px circle at ${clientX - rect.left}px ${clientY - rect.top}px, var(--pointer-glow-center) 0%, var(--pointer-glow-mid) 34%, transparent 72%)`;
  }, []);

  const finishSingleUseTool = useCallback((selectedId?: string) => {
    if (activeTool === 'pen' || activeTool === 'select' || activeTool === 'hand') {
      return;
    }

    setActiveTool('select');
    if (selectedId) {
      requestAnimationFrame(() => {
        useStore.getState().setSelectedIds([selectedId]);
      });
    }
  }, [activeTool, setActiveTool]);

  const resetTransientPointerState = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    panStart.current = null;
    erasedIdsRef.current.clear();
    setIsPanning(false);
    setIsErasing(false);
    setSelectionBox(null);
    setPanelDraft(null);
    setDrawingShape(null);
    setDrawingArrow(null);
    setPenPoints(null);
    setAlignmentGuides([]);
    paintPointerGlow(0, 0, false);
  }, [paintPointerGlow]);

  const startCapturedDrag = useCallback((
    captureTarget: HTMLElement | null,
    pointerId: number,
    onMove: (event: PointerEvent) => void,
    onEnd: () => void,
  ) => {
    dragCleanupRef.current?.();

    let completed = false;

    const cleanup = () => {
      if (completed) return;
      completed = true;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleFinish);
      window.removeEventListener('pointercancel', handleFinish);
      window.removeEventListener('blur', handleFinish);
      captureTarget?.removeEventListener('lostpointercapture', handleFinish);
      if (captureTarget?.hasPointerCapture(pointerId)) {
        captureTarget.releasePointerCapture(pointerId);
      }
      dragCleanupRef.current = null;
      onEnd();
    };

    const handleMove = (event: PointerEvent) => {
      onMove(event);
    };
    const handleFinish = () => {
      cleanup();
    };

    if (captureTarget) {
      try {
        captureTarget.setPointerCapture(pointerId);
      } catch {
        // Pointer capture may fail when the pointer is already inactive.
      }
      captureTarget.addEventListener('lostpointercapture', handleFinish);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleFinish);
    window.addEventListener('pointercancel', handleFinish);
    window.addEventListener('blur', handleFinish);

    dragCleanupRef.current = cleanup;
  }, []);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    window.addEventListener('blur', resetTransientPointerState);
    return () => window.removeEventListener('blur', resetTransientPointerState);
  }, [resetTransientPointerState]);

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
        setDrawingArrow(null);
        setDrawingShape(null);
        setPanelDraft(null);
        setPenPoints(null);
        setIsErasing(false);
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
      const insideCodeBlock = target instanceof HTMLElement && Boolean(target.closest('[data-code-block="true"]'));
      if (isEditing || insideDocs || insideCodeBlock || (!insideWhiteboard && activeSurface !== 'whiteboard')) return;

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
      // Allow native scroll inside code blocks (CodeMirror editors)
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[data-code-block="true"]') &&
        !event.ctrlKey && !event.metaKey
      ) {
        return;
      }
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

        // Check if click is inside combined bounding box of selected elements
        if (!additive && selectedIds.length > 0) {
          const state = useStore.getState();
          const selectedElements = state.elements.filter((e) => selectedIds.includes(e.id));
          if (selectedElements.length > 0) {
            const combinedBounds = getCombinedBounds(selectedElements);
            if (
              point.x >= combinedBounds.left &&
              point.x <= combinedBounds.right &&
              point.y >= combinedBounds.top &&
              point.y <= combinedBounds.bottom
            ) {
              // Start drag of selected elements instead of selection box
              const draggableElements = selectedElements.filter((e) => !e.locked);
              if (draggableElements.length > 0) {
                const startX = event.clientX;
                const startY = event.clientY;
                const staticElements = state.elements.filter((e) => !selectedIds.includes(e.id));
                const startPositions = new Map(
                  draggableElements.map((e) => [e.id, { x: e.x, y: e.y }])
                );
                const selectionBounds = getCombinedBounds(draggableElements);
                let frame = 0;
                let lastEvent: PointerEvent | null = null;
                let didDrag = false;
                const captureTarget = wrapperRef.current ?? (event.currentTarget as HTMLElement);

                const onMove = (nextEvent: PointerEvent) => {
                  lastEvent = nextEvent;
                  if (frame) return;
                  frame = window.requestAnimationFrame(() => {
                    if (!lastEvent) { frame = 0; return; }
                    const clientDx = lastEvent.clientX - startX;
                    const clientDy = lastEvent.clientY - startY;
                    if (!didDrag && Math.hypot(clientDx, clientDy) < 4) {
                      frame = 0;
                      return;
                    }
                    if (!didDrag) {
                      historyPush();
                      didDrag = true;
                    }
                    const currentViewState = useStore.getState().viewState;
                    const dx = clientDx / currentViewState.zoom;
                    const dy = clientDy / currentViewState.zoom;
                    const alignment = getAlignmentResult(selectionBounds, staticElements, dx, dy, 6 / currentViewState.zoom);
                    const movedUpdates = draggableElements.map((e) => {
                      const initial = startPositions.get(e.id)!;
                      return {
                        id: e.id,
                        updates: {
                          x: initial.x + alignment.dx,
                          y: initial.y + alignment.dy,
                        },
                      };
                    });

                    // Also update connected arrows
                    const arrowUpdates = computeConnectedArrowUpdates(
                      useStore.getState().elements,
                      draggableElements.map((e) => ({
                        ...e,
                        x: (startPositions.get(e.id)?.x ?? e.x) + alignment.dx,
                        y: (startPositions.get(e.id)?.y ?? e.y) + alignment.dy,
                      }))
                    );

                    updateElements([...movedUpdates, ...arrowUpdates]);
                    setAlignmentGuides(alignment.guides);
                    frame = 0;
                  });
                };

                const onUp = () => {
                  if (frame) window.cancelAnimationFrame(frame);
                  setAlignmentGuides([]);
                };

                startCapturedDrag(captureTarget, event.pointerId, onMove, onUp);
                return;
              }
            }
          }
        }

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
        finishSingleUseTool(id);
        return;
      }

      if (activeTool === 'code') {
        setPanelDraft({
          type: 'code',
          start: point,
          current: point,
        });
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
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
        finishSingleUseTool(id);
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
            finishSingleUseTool(id);
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }

      if (activeTool === 'table' || activeTool === 'chart') {
        setPanelDraft({
          type: activeTool,
          start: point,
          current: point,
        });
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === 'eraser') {
        historyPush();
        erasedIdsRef.current.clear();
        setIsErasing(true);
        eraseAtPoint(point);
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === 'arrow') {
        const snapTarget = getSnapTarget(point, elements);
        const startPoint = snapTarget?.snappedPoint ?? point;
        setDrawingArrow({
          start: startPoint,
          end: startPoint,
          startElementId: snapTarget?.elementId,
          endElementId: snapTarget?.elementId,
        });
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === 'pen') {
        setPenPoints([point]);
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }
    },
    [activeTool, eraseAtPoint, finishSingleUseTool, isPanMode, toCanvas, addElement, selectElement, clearSelection, toolDefaults, historyPush, updateElements, selectedIds, elements, startCapturedDrag, viewState]
  );

  const onCanvasPointerMove = useCallback(
    (event: React.PointerEvent) => {
      paintPointerGlow(event.clientX, event.clientY);
      const point = toCanvas(event.clientX, event.clientY);
      lastPointerCanvasRef.current = point;

      if (panStart.current) {
        setViewState({
          x: panStart.current.vx + (event.clientX - panStart.current.mx),
          y: panStart.current.vy + (event.clientY - panStart.current.my),
        });
        return;
      }

      if (isErasing) {
        eraseAtPoint(point);
        return;
      }

      if (selectionBox) {
        setSelectionBox((previous) => (previous ? { ...previous, current: point } : previous));
        return;
      }

      if (panelDraft) {
        setPanelDraft((previous) => (previous ? { ...previous, current: point } : previous));
        return;
      }

      if (drawingShape) {
        setDrawingShape((previous) => (previous ? { ...previous, current: point } : previous));
        return;
      }

      if (drawingArrow) {
        const snapTarget = getSnapTarget(point, elements);
        setDrawingArrow((previous) =>
          previous
            ? {
                ...previous,
                end: snapTarget?.snappedPoint ?? point,
                endElementId: snapTarget?.elementId,
              }
            : previous
        );
        return;
      }

      if (penPoints) {
        setPenPoints((previous) => (previous ? [...previous, point] : []));
      }
    },
    [drawingArrow, drawingShape, eraseAtPoint, isErasing, paintPointerGlow, panelDraft, penPoints, selectionBox, toCanvas, setViewState, elements]
  );

  const onCanvasPointerUp = useCallback(
    (_event: React.PointerEvent) => {
      if (panStart.current) {
        setIsPanning(false);
        panStart.current = null;
        return;
      }

      if (isErasing) {
        setIsErasing(false);
        erasedIdsRef.current.clear();
        finishSingleUseTool();
        return;
      }

      if (panelDraft) {
        const left = Math.min(panelDraft.start.x, panelDraft.current.x);
        const top = Math.min(panelDraft.start.y, panelDraft.current.y);
        const rawWidth = Math.abs(panelDraft.current.x - panelDraft.start.x);
        const rawHeight = Math.abs(panelDraft.current.y - panelDraft.start.y);

        const defaults = panelDraft.type === 'code'
          ? { width: 400, height: 340 }
          : panelDraft.type === 'table'
            ? { width: 520, height: 360 }
            : { width: 420, height: 320 };

        const width = rawWidth < 8 ? defaults.width : rawWidth;
        const height = rawHeight < 8 ? defaults.height : rawHeight;
        const x = rawWidth < 8 ? panelDraft.start.x - width / 2 : left;
        const y = rawHeight < 8 ? panelDraft.start.y - height / 2 : top;

        const id = addElement(
          panelDraft.type === 'code'
            ? {
                type: 'code',
                x,
                y,
                width,
                height,
                properties: {
                  title: 'React Block',
                  runtime: 'react',
                  theme: 'vscode-dark',
                  html: '<div id="root"></div>',
                  css: 'body{background:#fff;color:#000;font-family:Inter,system-ui,sans-serif;}\n.card{display:grid;gap:16px;padding:24px;max-width:320px;margin:24px auto;border:1px solid #000;border-radius:24px;box-shadow:0 18px 40px rgba(0,0,0,0.08);}\nbutton{height:42px;border-radius:999px;border:1px solid #000;background:#000;color:#fff;font-weight:700;cursor:pointer;}\np{margin:0;color:#444;}',
                  js: "import React, { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className=\"card\">\n      <div>\n        <h2>React JSX ready</h2>\n        <p>This sandbox now runs AI-generated JSX and TSX snippets.</p>\n      </div>\n      <button onClick={() => setCount((value) => value + 1)}>\n        Clicked {count} times\n      </button>\n    </div>\n  );\n}\n",
                },
              }
            : panelDraft.type === 'table'
              ? {
                  type: 'table',
                  x,
                  y,
                  width,
                  height,
                  properties: {
                    model: serializeDataSheet(createDefaultDataSheet()),
                  },
                }
              : {
                  type: 'chart',
                  x,
                  y,
                  width,
                  height,
                  properties: {
                    chartType: 'bar',
                    title: 'Chart',
                    labels: [],
                    datasets: [],
                    sourceTableId: elements.find((element) => element.type === 'table')?.id,
                    labelColumnId: undefined,
                    valueColumnIds: [],
                    pieMode: 'row-total',
                  },
                }
        );
        setPanelDraft(null);
        selectElement(id);
        finishSingleUseTool(id);
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
        finishSingleUseTool(id);
        return;
      }

      if (drawingArrow) {
        const distance = Math.hypot(drawingArrow.end.x - drawingArrow.start.x, drawingArrow.end.y - drawingArrow.start.y);
        if (distance > 6) {
          const id = addElement({
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            properties: {
              points: [drawingArrow.start, drawingArrow.end],
              color: toolDefaults.arrow.color,
              strokeWidth: toolDefaults.arrow.strokeWidth,
              startArrowHead: toolDefaults.arrow.startArrowHead,
              endArrowHead: toolDefaults.arrow.endArrowHead,
              lineStyle: toolDefaults.arrow.lineStyle,
              curveOffset: toolDefaults.arrow.curveOffset,
              startElementId: drawingArrow.startElementId,
              endElementId: drawingArrow.endElementId,
            },
          });
          selectElement(id);
          finishSingleUseTool(id);
        }
        setDrawingArrow(null);
        return;
      }

      if (penPoints && penPoints.length > 2) {
        const penBounds = getPointBounds(penPoints);
        addElement({
          type: 'pen',
          x: penBounds.left,
          y: penBounds.top,
          width: Math.max(1, penBounds.right - penBounds.left),
          height: Math.max(1, penBounds.bottom - penBounds.top),
          properties: {
            points: penPoints.map((point) => ({
              x: point.x - penBounds.left,
              y: point.y - penBounds.top,
            })),
            color: toolDefaults.pen.color,
            strokeWidth: toolDefaults.pen.strokeWidth,
          },
        });
        setPenPoints(null);
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
      setDrawingShape(null);
      setDrawingArrow(null);
    },
    [addElement, drawingArrow, drawingShape, elements, finishSingleUseTool, isErasing, panelDraft, penPoints, selectElement, selectedIds, selectionBox, setSelectedIds, toolDefaults]
  );

  const onCanvasDoubleClick = useCallback(
    (_event: React.MouseEvent) => {
      // The arrow tool is drag-based now. Double-click is intentionally ignored.
    },
    []
  );

  const onElementPointerDown = useCallback(
    (event: React.PointerEvent, element: WhiteboardElement) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setContextMenu(null);
      lastPointerCanvasRef.current = toCanvas(event.clientX, event.clientY);

      if (activeTool === 'eraser') {
        historyPush();
        erasedIdsRef.current.clear();
        setIsErasing(true);
        eraseAtPoint(lastPointerCanvasRef.current ?? { x: element.x + element.width / 2, y: element.y + element.height / 2 });
        wrapperRef.current?.setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === 'arrow') {
        const startPoint = getAnchorForElement(
          element,
          lastPointerCanvasRef.current ?? { x: element.x + element.width / 2, y: element.y + element.height / 2 }
        );
        setDrawingArrow({
          start: startPoint,
          end: startPoint,
          startElementId: element.id,
          endElementId: element.id,
        });
        wrapperRef.current?.setPointerCapture(event.pointerId);
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

      const startX = event.clientX;
      const startY = event.clientY;
      const staticElements = state.elements.filter((candidate) => !dragIds.includes(candidate.id));
      const startPositions = new Map(
        draggableElements.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }])
      );
      const selectionBounds = getCombinedBounds(draggableElements);
      let frame = 0;
      let lastEvent: PointerEvent | null = null;
      let didDrag = false;
      const captureTarget = wrapperRef.current ?? (event.currentTarget as HTMLElement);

      const onMove = (nextEvent: PointerEvent) => {
        lastEvent = nextEvent;
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          if (!lastEvent) {
            frame = 0;
            return;
          }

          const clientDx = lastEvent.clientX - startX;
          const clientDy = lastEvent.clientY - startY;
          if (!didDrag && Math.hypot(clientDx, clientDy) < 4) {
            frame = 0;
            return;
          }
          if (!didDrag) {
            historyPush();
            didDrag = true;
          }

          const currentViewState = useStore.getState().viewState;
          const dx = clientDx / currentViewState.zoom;
          const dy = clientDy / currentViewState.zoom;
          const alignment = getAlignmentResult(selectionBounds, staticElements, dx, dy, 6 / currentViewState.zoom);
          const movedUpdates = draggableElements.map((candidate) => {
            const initial = startPositions.get(candidate.id)!;
            return {
              id: candidate.id,
              updates: {
                x: initial.x + alignment.dx,
                y: initial.y + alignment.dy,
              },
            };
          });

          // Also update connected arrows
          const arrowUpdates = computeConnectedArrowUpdates(
            useStore.getState().elements,
            draggableElements.map((e) => ({
              ...e,
              x: (startPositions.get(e.id)?.x ?? e.x) + alignment.dx,
              y: (startPositions.get(e.id)?.y ?? e.y) + alignment.dy,
            }))
          );

          updateElements([...movedUpdates, ...arrowUpdates]);
          setAlignmentGuides(alignment.guides);
          frame = 0;
        });
      };

      const onUp = () => {
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        setAlignmentGuides([]);
      };

      startCapturedDrag(captureTarget, event.pointerId, onMove, onUp);
    },
    [activeTool, eraseAtPoint, historyPush, selectElement, setSelectedIds, startCapturedDrag, toCanvas, updateElements]
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

  // Sort: pen elements always above image elements, then by zIndex
  const sortedElements = [...elements].sort((a, b) => {
    const layerA = a.type === 'pen' ? 1 : 0;
    const layerB = b.type === 'pen' ? 1 : 0;
    if (layerA !== layerB) return layerA - layerB;
    return a.zIndex - b.zIndex;
  });

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
          background: `radial-gradient(circle at 12% 10%, var(--app-gradient-1), transparent 26%), radial-gradient(circle at 84% 18%, var(--app-gradient-2), transparent 24%), var(--canvas-bg)`,
          cursor: getCursor(),
          minHeight: 0,
          outline: 'none',
        }}
        onPointerDownCapture={() => setActiveSurface('whiteboard')}
        onFocusCapture={() => setActiveSurface('whiteboard')}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={resetTransientPointerState}
        onLostPointerCapture={resetTransientPointerState}
        onDoubleClick={onCanvasDoubleClick}
        onPointerLeave={() => paintPointerGlow(0, 0, false)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          ref={pointerGlowRef}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.16s ease',
            filter: 'blur(10px)',
          }}
        />
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

          {alignmentGuides.map((guide, index) => (
            <div
              key={`${guide.orientation}-${guide.position}-${index}`}
              style={{
                position: 'absolute',
                left: guide.orientation === 'vertical' ? guide.position : guide.start,
                top: guide.orientation === 'vertical' ? guide.start : guide.position,
                width: guide.orientation === 'vertical' ? 1 : guide.end - guide.start,
                height: guide.orientation === 'vertical' ? guide.end - guide.start : 1,
                background: 'var(--primary)',
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent)',
                pointerEvents: 'none',
                opacity: 0.9,
              }}
            />
          ))}

          {penPoints && penPoints.length > 1 && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              <path
                d={buildSmoothPath(penPoints)}
                fill="none"
                stroke={toolDefaults.pen.color}
                strokeWidth={toolDefaults.pen.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {drawingArrow && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id="arrow-preview" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="var(--text-primary)" />
                </marker>
              </defs>
              <path
                d={buildArrowPathDefinition({
                  points: [drawingArrow.start, drawingArrow.end],
                  lineStyle: toolDefaults.arrow.lineStyle,
                  curveOffset: toolDefaults.arrow.curveOffset,
                })}
                fill="none"
                stroke="var(--text-primary)"
                strokeWidth={2}
                strokeDasharray="6 4"
                markerEnd={toolDefaults.arrow.endArrowHead === 'none' ? undefined : 'url(#arrow-preview)'}
              />
              <circle cx={drawingArrow.start.x} cy={drawingArrow.start.y} r={3} fill="var(--primary)" />
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

          {panelDraft && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(panelDraft.start.x, panelDraft.current.x),
                top: Math.min(panelDraft.start.y, panelDraft.current.y),
                width: Math.max(4, Math.abs(panelDraft.current.x - panelDraft.start.x)),
                height: Math.max(4, Math.abs(panelDraft.current.y - panelDraft.start.y)),
                border: '1px solid color-mix(in srgb, var(--primary) 72%, transparent)',
                background: 'color-mix(in srgb, var(--glass-bg) 78%, transparent)',
                borderRadius: 22,
                boxShadow: 'var(--shadow-md)',
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

          {sortedElements.map((element) => {
            const isSelected = selectedIds.includes(element.id);
            const sharedProps = {
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

            if (element.type === 'shape') return wrapped(<ShapeElementComponent key={element.id} element={element} {...sharedProps} />);
            if (element.type === 'sticky') return wrapped(<StickyElementComponent key={element.id} element={element} {...sharedProps} />);
            if (element.type === 'code') return wrapped(<CodeBlockElement key={element.id} element={element} {...sharedProps} />);
            if (element.type === 'image') return wrapped(<ImageElementComponent key={element.id} element={element} {...sharedProps} />);
            if (element.type === 'chart') return wrapped(<ChartElementComponent key={element.id} element={element} {...sharedProps} />);
            if (element.type === 'table') return wrapped(<TableElementComponent key={element.id} element={element} {...sharedProps} />);
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
                  zoom={viewState.zoom}
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
              padding: '22px 26px',
              borderRadius: 24,
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--shadow-md)',
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
            bottom: 14,
            left: 14,
            maxWidth: 'calc(100% - 28px)',
            minHeight: 36,
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 999,
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '8px 12px',
            fontSize: 11,
            color: 'var(--text-muted)',
            boxShadow: 'var(--shadow-md)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>
              {elements.length} element{elements.length !== 1 ? 's' : ''}
            </span>
            {selectedIds.length > 0 && (
              <span style={{ color: 'var(--text-secondary)' }}>
                {selectedIds.length} selected | Ctrl+G group | L lock | Ctrl+C/V copy and paste
              </span>
            )}
          </span>
          <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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

// ── Connected arrow update helper ────────────────────────────────────────────
function computeConnectedArrowUpdates(
  allElements: WhiteboardElement[],
  movedElements: WhiteboardElement[]
): Array<{ id: string; updates: Partial<WhiteboardElement> }> {
  const movedMap = new Map(movedElements.map((e) => [e.id, e]));
  const updates: Array<{ id: string; updates: Partial<WhiteboardElement> }> = [];

  for (const el of allElements) {
    if (el.type !== 'arrow') continue;
    const props = el.properties;
    let points = [...props.points];
    let changed = false;

    if (props.startElementId && movedMap.has(props.startElementId)) {
      const movedEl = movedMap.get(props.startElementId)!;
      const anchor = getAnchorForElement(movedEl, points[0]);
      points[0] = anchor;
      changed = true;
    }

    if (props.endElementId && movedMap.has(props.endElementId)) {
      const movedEl = movedMap.get(props.endElementId)!;
      const anchor = getAnchorForElement(movedEl, points[points.length - 1]);
      points[points.length - 1] = anchor;
      changed = true;
    }

    if (changed) {
      updates.push({
        id: el.id,
        updates: { properties: { ...props, points } },
      });
    }
  }

  return updates;
}

function getAnchorForElement(el: WhiteboardElement, nearPoint: Point): Point {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const anchors: Point[] = [
    { x: cx, y: el.y },
    { x: cx, y: el.y + el.height },
    { x: el.x, y: cy },
    { x: el.x + el.width, y: cy },
  ];
  let best = anchors[0];
  let bestDist = Infinity;
  for (const anchor of anchors) {
    const dist = Math.hypot(nearPoint.x - anchor.x, nearPoint.y - anchor.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = anchor;
    }
  }
  return best;
}

// ────────────────────────────────────────────────────────────────────────────

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
    const strokePadding = Math.max(8, (element.properties.strokeWidth ?? 2) + 6);
    const translatedPoints = element.properties.points.map((point) => ({
      x: point.x + element.x,
      y: point.y + element.y,
    }));
    return element.type === 'arrow'
      ? getArrowBounds({ points: translatedPoints, lineStyle: element.properties.lineStyle }, strokePadding)
      : getPointBounds(translatedPoints, strokePadding);
  }

  return {
    left: element.x,
    top: element.y,
    right: element.x + element.width,
    bottom: element.y + element.height,
  };
}

function getCombinedBounds(elements: WhiteboardElement[]) {
  const bounds = elements.map(getElementBounds);
  return {
    left: Math.min(...bounds.map((bound) => bound.left)),
    top: Math.min(...bounds.map((bound) => bound.top)),
    right: Math.max(...bounds.map((bound) => bound.right)),
    bottom: Math.max(...bounds.map((bound) => bound.bottom)),
  };
}

function offsetBounds(
  bounds: { left: number; top: number; right: number; bottom: number },
  dx: number,
  dy: number
) {
  return {
    left: bounds.left + dx,
    top: bounds.top + dy,
    right: bounds.right + dx,
    bottom: bounds.bottom + dy,
  };
}

function getAlignmentResult(
  selectionBounds: { left: number; top: number; right: number; bottom: number },
  staticElements: WhiteboardElement[],
  rawDx: number,
  rawDy: number,
  threshold: number
) {
  let snappedDx = rawDx;
  let snappedDy = rawDy;
  let verticalGuide: AlignmentGuide | null = null;
  let horizontalGuide: AlignmentGuide | null = null;
  let bestVerticalDelta = threshold + 1;
  let bestHorizontalDelta = threshold + 1;

  const movedBounds = offsetBounds(selectionBounds, rawDx, rawDy);
  const movingXPoints = [
    movedBounds.left,
    (movedBounds.left + movedBounds.right) / 2,
    movedBounds.right,
  ];
  const movingYPoints = [
    movedBounds.top,
    (movedBounds.top + movedBounds.bottom) / 2,
    movedBounds.bottom,
  ];

  for (const element of staticElements) {
    const otherBounds = getElementBounds(element);
    const otherXPoints = [
      otherBounds.left,
      (otherBounds.left + otherBounds.right) / 2,
      otherBounds.right,
    ];
    const otherYPoints = [
      otherBounds.top,
      (otherBounds.top + otherBounds.bottom) / 2,
      otherBounds.bottom,
    ];

    for (const movingPoint of movingXPoints) {
      for (const otherPoint of otherXPoints) {
        const delta = otherPoint - movingPoint;
        if (Math.abs(delta) <= threshold && Math.abs(delta) < bestVerticalDelta) {
          bestVerticalDelta = Math.abs(delta);
          snappedDx = rawDx + delta;
          const snappedBounds = offsetBounds(selectionBounds, snappedDx, rawDy);
          verticalGuide = {
            orientation: 'vertical',
            position: otherPoint,
            start: Math.min(snappedBounds.top, otherBounds.top) - 24,
            end: Math.max(snappedBounds.bottom, otherBounds.bottom) + 24,
          };
        }
      }
    }

    for (const movingPoint of movingYPoints) {
      for (const otherPoint of otherYPoints) {
        const delta = otherPoint - movingPoint;
        if (Math.abs(delta) <= threshold && Math.abs(delta) < bestHorizontalDelta) {
          bestHorizontalDelta = Math.abs(delta);
          snappedDy = rawDy + delta;
          const snappedBounds = offsetBounds(selectionBounds, snappedDx, snappedDy);
          horizontalGuide = {
            orientation: 'horizontal',
            position: otherPoint,
            start: Math.min(snappedBounds.left, otherBounds.left) - 24,
            end: Math.max(snappedBounds.right, otherBounds.right) + 24,
          };
        }
      }
    }
  }

  return {
    dx: snappedDx,
    dy: snappedDy,
    guides: [verticalGuide, horizontalGuide].filter((guide): guide is AlignmentGuide => guide != null),
  };
}

function buildSmoothPath(points: Point[]) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midpoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
    };

    path += ` Q ${current.x} ${current.y} ${midpoint.x} ${midpoint.y}`;
  }

  const secondLast = points[points.length - 2];
  const last = points[points.length - 1];
  path += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`;

  return path;
}

function getPointBounds(points: Point[], padding = 0) {
  const allX = points.map((point) => point.x);
  const allY = points.map((point) => point.y);

  return {
    left: Math.min(...allX) - padding,
    top: Math.min(...allY) - padding,
    right: Math.max(...allX) + padding,
    bottom: Math.max(...allY) + padding,
  };
}

function findTopmostElementAtPoint(elements: WhiteboardElement[], point: Point) {
  return [...elements]
    .sort((a, b) => {
      const layerA = getRenderLayerWeight(a);
      const layerB = getRenderLayerWeight(b);
      if (layerA !== layerB) return layerA - layerB;
      return a.zIndex - b.zIndex;
    })
    .reverse()
    .find((element) => elementContainsPoint(element, point));
}

function getRenderLayerWeight(element: WhiteboardElement) {
  return element.type === 'pen' ? 1 : 0;
}

function elementContainsPoint(element: WhiteboardElement, point: Point) {
  if (element.type === 'arrow' || element.type === 'pen') {
    const translatedPoints = (element.type === 'arrow'
      ? getArrowRenderablePoints({
          points: element.properties.points,
          lineStyle: element.properties.lineStyle,
        })
      : element.properties.points
    ).map((candidate) => ({
      x: candidate.x + element.x,
      y: candidate.y + element.y,
    }));
    const threshold = Math.max(8, (element.properties.strokeWidth ?? 2) + 6);

    for (let index = 0; index < translatedPoints.length - 1; index += 1) {
      const distance = distancePointToSegment(point, translatedPoints[index], translatedPoints[index + 1]);
      if (distance <= threshold) {
        return true;
      }
    }
  }

  const bounds = getElementBounds(element);
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  );
}

function distancePointToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
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
  const translatedPoints = points.map((point: Point) => ({
    x: point.x + element.x,
    y: point.y + element.y,
  }));
  const path = buildSmoothPath(translatedPoints);

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: element.zIndex + 20000 }}>
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
