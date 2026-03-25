import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextElement as TextEl } from '../../types';
import { useStore } from '../../store/useStore';
import { ElementResizeHandles } from './ElementResizeHandles';

interface Props {
  element: TextEl;
  selected: boolean;
  zoom?: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function TextElementComponent({ element, selected, zoom = 1, onPointerDown }: Props) {
  const { updateElement, selectedIds } = useStore();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastPressRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const fontFamily = element.properties.fontFamily ?? 'Inter';
  const fontWeight = element.properties.fontWeight ?? 'normal';
  const color = element.properties.color ?? '#000000';
  const textAlign = element.properties.textAlign ?? 'left';

  const autoResize = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const newHeight = Math.max(36, ta.scrollHeight);
    ta.style.height = `${newHeight}px`;
    const lines = ta.value.split(/\r?\n/);
    const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const newWidth = Math.max(140, Math.min(680, longestLine * ((element.properties.fontSize ?? 18) * 0.58) + 28));
    updateElement(element.id, { height: newHeight, width: newWidth });
  }, [element.id, element.properties.fontSize, updateElement]);

  useEffect(() => {
    if (editing) {
      autoResize();
      inputRef.current?.focus();
    }
  }, [editing, autoResize]);

  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);

  useEffect(() => {
    if (!selected || editing) {
      lastPressRef.current = null;
    }
  }, [editing, selected]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const now = Date.now();
      const previous = lastPressRef.current;
      const isRapidSecondPress =
        previous &&
        now - previous.time <= 320 &&
        Math.hypot(previous.x - event.clientX, previous.y - event.clientY) <= 8;

      if (
        isRapidSecondPress &&
        !editing &&
        selected &&
        selectedIds.length === 1 &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        lastPressRef.current = null;
        event.preventDefault();
        event.stopPropagation();
        startEditing();
        return;
      }

      lastPressRef.current = {
        time: now,
        x: event.clientX,
        y: event.clientY,
      };
      onPointerDown(event);
    },
    [editing, onPointerDown, selected, selectedIds.length, startEditing]
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (
        editing ||
        !selected ||
        selectedIds.length !== 1 ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      startEditing();
    },
    [editing, selected, selectedIds.length, startEditing]
  );

  const commit = () => setEditing(false);

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        cursor: editing ? 'text' : 'move',
        userSelect: editing ? 'text' : 'none',
        zIndex: element.zIndex,
        outline: selected ? '2px solid var(--primary)' : undefined,
        outlineOffset: 4,
        borderRadius: 6,
        transform: `rotate(${element.rotation ?? 0}deg)`,
        transformOrigin: 'center center',
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {editing ? (
        <textarea
          ref={inputRef}
          value={element.properties.text}
          onChange={(event) => {
            updateElement(element.id, {
              properties: { ...element.properties, text: event.target.value },
            });
            requestAnimationFrame(autoResize);
          }}
          onBlur={commit}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            width: '100%',
            minHeight: element.height,
            background: 'var(--bg-primary)',
            border: '1px solid var(--primary)',
            borderRadius: 6,
            padding: 6,
            resize: 'none',
            outline: 'none',
            fontSize: element.properties.fontSize,
            fontWeight,
            color,
            fontFamily,
            lineHeight: 1.4,
            textAlign,
            overflow: 'hidden',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            minHeight: '100%',
            boxSizing: 'border-box',
            fontSize: element.properties.fontSize,
            fontWeight,
            color,
            fontFamily,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            padding: 2,
            textAlign,
            cursor: 'inherit',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {element.properties.text || (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Double-click to edit</span>
          )}
        </div>
      )}

      {selected && !editing && (
        <ElementResizeHandles
          element={element}
          zoom={zoom}
          minWidth={120}
          minHeight={36}
          onResize={(updates) => updateElement(element.id, updates)}
        />
      )}
    </div>
  );
}
