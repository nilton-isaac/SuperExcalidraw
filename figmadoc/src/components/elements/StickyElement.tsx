import { useCallback, useEffect, useRef } from 'react';
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
  const { updateElement } = useStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.max(80, textarea.scrollHeight + 28);
    textarea.style.height = `${Math.max(0, nextHeight - 28)}px`;
    if (Math.abs(nextHeight - element.height) > 1) {
      updateElement(element.id, { height: nextHeight });
    }
  }, [element.height, element.id, updateElement]);

  useEffect(() => {
    autoResize();
  }, [autoResize, element.properties.text]);

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
        cursor: 'move',
        userSelect: 'none',
        zIndex: element.zIndex,
        transform: `rotate(${element.rotation ?? 0}deg)`,
        transformOrigin: 'center center',
      }}
      onPointerDown={onPointerDown}
    >
      <textarea
        ref={textareaRef}
        value={element.properties.text}
        onChange={(event) => {
          updateElement(element.id, {
            properties: { ...element.properties, text: event.target.value },
          });
          requestAnimationFrame(autoResize);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="Type your note..."
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          resize: 'none',
          outline: 'none',
          fontSize: element.properties.fontSize ?? 14,
          lineHeight: 1.5,
          color: element.properties.textColor ?? '#000000',
          fontFamily: element.properties.fontFamily ?? 'Inter',
          textAlign: element.properties.textAlign ?? 'left',
          userSelect: 'text',
          cursor: 'text',
        }}
      />

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
