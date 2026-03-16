import { useEffect, useRef, useState } from 'react';
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
  const { updateElement } = useStore();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(element.properties.text ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const shapeStyle: CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'move',
    userSelect: 'none',
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
  };

  return (
    <div style={shapeStyle} onPointerDown={onPointerDown}>
      <div
        style={innerStyle}
        onDoubleClick={() => {
          setEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {editing ? (
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commitText}
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
            {text || (selected ? <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Double-click</span> : null)}
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
