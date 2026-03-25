import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ShapeElement as ShapeEl } from '../../types';
import { useStore } from '../../store/useStore';
import { ElementResizeHandles } from './ElementResizeHandles';

interface Props {
  element: ShapeEl;
  selected: boolean;
  zoom: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function ShapeElementComponent({ element, selected, zoom, onPointerDown }: Props) {
  const { updateElement, selectedIds } = useStore();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(element.properties.text ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastPressRef = useRef<{ time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setText(element.properties.text ?? '');
  }, [element.properties.text]);

  const {
    shapeType,
    strokeColor = '#000000',
    fillColor = '#ffffff',
    textColor = '#000000',
    fontSize = 14,
    fontFamily = 'Inter',
    fontWeight = 'normal',
    textAlign = 'center',
  } = element.properties;

  const commitText = () => {
    setEditing(false);
    updateElement(element.id, {
      properties: {
        ...element.properties,
        text,
      },
    });
  };

  const startEditing = useCallback(() => {
    setEditing(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
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

  const shapeStyle: CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: editing ? 'text' : 'move',
    userSelect: editing ? 'text' : 'none',
    zIndex: element.zIndex,
    transform: `rotate(${element.rotation ?? 0}deg)`,
    transformOrigin: 'center center',
  };

  const innerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    background: fillColor === 'transparent' ? 'transparent' : fillColor,
    border: `2px solid ${strokeColor}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize,
    fontFamily,
    fontWeight,
    color: textColor,
    padding: 8,
    textAlign,
    borderRadius: shapeType === 'circle' ? '50%' : shapeType === 'rectangle' ? 10 : 0,
    transform: shapeType === 'diamond' ? 'rotate(45deg)' : undefined,
    boxShadow: selected ? '0 0 0 2px var(--primary), 0 12px 24px rgba(0,0,0,0.12)' : undefined,
    overflow: 'hidden',
    pointerEvents: editing ? 'auto' : 'none',
    userSelect: editing ? 'text' : 'none',
  };

  return (
    <div style={shapeStyle} onPointerDown={handlePointerDown} onDoubleClick={handleDoubleClick}>
      <div style={innerStyle}>
        {editing ? (
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commitText}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') commitText();
            }}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              resize: 'none',
              outline: 'none',
              fontSize,
              textAlign,
              fontFamily,
              fontWeight,
              color: textColor,
              transform: shapeType === 'diamond' ? 'rotate(-45deg)' : undefined,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          />
        ) : (
          <span
            style={{
              transform: shapeType === 'diamond' ? 'rotate(-45deg)' : undefined,
              pointerEvents: 'none',
              width: '100%',
              padding: 4,
              textAlign,
              color: textColor,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {text || (selected ? <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Double-click to edit</span> : null)}
          </span>
        )}
      </div>

      {selected && (
        <ElementResizeHandles
          element={element}
          zoom={zoom}
          minWidth={60}
          minHeight={40}
          onResize={(updates) => updateElement(element.id, updates)}
        />
      )}
    </div>
  );
}
