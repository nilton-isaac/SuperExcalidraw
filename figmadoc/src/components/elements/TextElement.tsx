import { useRef, useState } from 'react';
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
  const { updateElement } = useStore();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const commit = () => setEditing(false);

  const fontFamily = element.properties.fontFamily ?? 'Inter';
  const fontWeight = element.properties.fontWeight ?? 'normal';
  const color = element.properties.color ?? '#000000';
  const textAlign = element.properties.textAlign ?? 'left';

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        minHeight: element.height,
        cursor: 'move',
        userSelect: 'none',
        zIndex: element.zIndex,
        outline: selected ? '2px solid var(--primary)' : undefined,
        outlineOffset: 4,
        borderRadius: 6,
        transform: `rotate(${element.rotation ?? 0}deg)`,
        transformOrigin: 'center center',
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={() => {
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }}
    >
      {editing ? (
        <textarea
          ref={inputRef}
          value={element.properties.text}
          onChange={(event) =>
            updateElement(element.id, {
              properties: { ...element.properties, text: event.target.value },
            })
          }
          onBlur={commit}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            width: '100%',
            minHeight: element.height,
            height: '100%',
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
          }}
        />
      ) : (
        <div
          style={{
            fontSize: element.properties.fontSize,
            fontWeight,
            color,
            fontFamily,
            lineHeight: 1.4,
            wordBreak: 'break-word',
            padding: 2,
            textAlign,
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
