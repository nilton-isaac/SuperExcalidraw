import type { CSSProperties } from 'react';
import { useStore } from '../../store/useStore';

type ResizeHandlePosition = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface ResizeableBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  element: ResizeableBounds;
  zoom: number;
  minWidth: number;
  minHeight: number;
  onResize: (updates: Pick<ResizeableBounds, 'x' | 'y' | 'width' | 'height'>) => void;
}

const HANDLES: Array<{
  pos: ResizeHandlePosition;
  cursor: string;
  style: CSSProperties;
}> = [
  { pos: 'nw', cursor: 'nw-resize', style: { top: -6, left: -6 } },
  { pos: 'n', cursor: 'n-resize', style: { top: -6, left: '50%', marginLeft: -5 } },
  { pos: 'ne', cursor: 'ne-resize', style: { top: -6, right: -6 } },
  { pos: 'e', cursor: 'e-resize', style: { top: '50%', right: -6, marginTop: -5 } },
  { pos: 'se', cursor: 'se-resize', style: { bottom: -6, right: -6 } },
  { pos: 's', cursor: 's-resize', style: { bottom: -6, left: '50%', marginLeft: -5 } },
  { pos: 'sw', cursor: 'sw-resize', style: { bottom: -6, left: -6 } },
  { pos: 'w', cursor: 'w-resize', style: { top: '50%', left: -6, marginTop: -5 } },
];

export function ElementResizeHandles({
  element,
  zoom,
  minWidth,
  minHeight,
  onResize,
}: Props) {
  const { historyPush } = useStore();

  const onHandleDown = (event: React.PointerEvent, position: ResizeHandlePosition) => {
    event.stopPropagation();
    event.preventDefault();
    historyPush();

    const startX = event.clientX;
    const startY = event.clientY;
    const { x, y, width, height } = element;
    const right = x + width;
    const bottom = y + height;

    const onMove = (nextEvent: PointerEvent) => {
      const dx = (nextEvent.clientX - startX) / zoom;
      const dy = (nextEvent.clientY - startY) / zoom;

      let nextX = x;
      let nextY = y;
      let nextWidth = width;
      let nextHeight = height;

      if (position.includes('e')) {
        nextWidth = Math.max(minWidth, width + dx);
      }

      if (position.includes('s')) {
        nextHeight = Math.max(minHeight, height + dy);
      }

      if (position.includes('w')) {
        nextX = Math.min(x + dx, right - minWidth);
        nextWidth = right - nextX;
      }

      if (position.includes('n')) {
        nextY = Math.min(y + dy, bottom - minHeight);
        nextHeight = bottom - nextY;
      }

      onResize({ x: nextX, y: nextY, width: nextWidth, height: nextHeight });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      {HANDLES.map(({ pos, cursor, style }) => (
        <div
          key={pos}
          onPointerDown={(event) => onHandleDown(event, pos)}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--primary)',
            border: '2px solid var(--primary-contrast)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
            cursor,
            ...style,
          }}
        />
      ))}
    </>
  );
}
