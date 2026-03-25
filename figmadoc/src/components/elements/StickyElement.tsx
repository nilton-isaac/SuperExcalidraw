import { useCallback, useEffect, useRef, useState } from 'react';
import type { StickyElement as StickyEl } from '../../types';
import { useStore } from '../../store/useStore';
import { ElementResizeHandles } from './ElementResizeHandles';

interface Props {
  element: StickyEl;
  selected: boolean;
  zoom: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function StickyElementComponent({ element, selected, zoom, onPointerDown }: Props) {
  const { updateElement, selectedIds } = useStore();
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastPressRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const nextHeight = Math.max(80, textarea.scrollHeight + 28);
      textarea.style.height = `${Math.max(52, nextHeight - 28)}px`;
      if (Math.abs(nextHeight - element.height) > 1) {
        updateElement(element.id, { height: nextHeight });
      }
      return;
    }

    const content = contentRef.current;
    if (!content) return;
    const nextHeight = Math.max(80, content.scrollHeight + 28);
    if (Math.abs(nextHeight - element.height) > 1) {
      updateElement(element.id, { height: nextHeight });
    }
  }, [element.height, element.id, updateElement]);

  useEffect(() => {
    autoResize();
  }, [
    autoResize,
    editing,
    element.properties.fontFamily,
    element.properties.fontSize,
    element.properties.text,
    element.width,
  ]);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!selected || editing) {
      lastPressRef.current = null;
    }
  }, [editing, selected]);

  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (editing) {
        event.stopPropagation();
        return;
      }
      const now = Date.now();
      const previous = lastPressRef.current;
      const isRapidSecondPress =
        previous &&
        now - previous.time <= 320 &&
        Math.hypot(previous.x - event.clientX, previous.y - event.clientY) <= 8;

      if (
        isRapidSecondPress &&
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

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        background: element.properties.color,
        padding: 14,
        boxShadow: selected
          ? '0 0 0 2px var(--primary), 0 12px 24px rgba(0,0,0,0.15)'
          : '0 10px 24px rgba(0,0,0,0.1)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: editing ? 'text' : 'move',
        userSelect: editing ? 'text' : 'none',
        zIndex: element.zIndex,
        transform: `rotate(${element.rotation ?? 0}deg)`,
        transformOrigin: 'center center',
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={element.properties.text}
          onChange={(event) => {
            updateElement(element.id, {
              properties: { ...element.properties, text: event.target.value },
            });
            requestAnimationFrame(autoResize);
          }}
          onBlur={commit}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              commit();
            }
          }}
          placeholder="Type your note..."
          style={{
            width: '100%',
            minHeight: Math.max(52, element.height - 28),
            background: 'transparent',
            border: 'none',
            resize: 'none',
            outline: 'none',
            overflow: 'hidden',
            fontSize: element.properties.fontSize ?? 14,
            lineHeight: 1.5,
            color: element.properties.textColor ?? '#000000',
            fontFamily: element.properties.fontFamily ?? 'Inter',
            textAlign: element.properties.textAlign ?? 'left',
            userSelect: 'text',
            cursor: 'text',
          }}
        />
      ) : (
        <div
          ref={contentRef}
          style={{
            width: '100%',
            minHeight: Math.max(52, element.height - 28),
            boxSizing: 'border-box',
            fontSize: element.properties.fontSize ?? 14,
            lineHeight: 1.5,
            color: element.properties.textColor ?? '#000000',
            fontFamily: element.properties.fontFamily ?? 'Inter',
            textAlign: element.properties.textAlign ?? 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {element.properties.text || (
            <span style={{ color: 'var(--text-muted)' }}>Double-click to edit</span>
          )}
        </div>
      )}

      {selected && (
        <ElementResizeHandles
          element={element}
          zoom={zoom}
          minWidth={120}
          minHeight={80}
          onResize={(updates) => updateElement(element.id, updates)}
        />
      )}
    </div>
  );
}
