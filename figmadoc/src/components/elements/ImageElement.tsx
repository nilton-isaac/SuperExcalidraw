import type { ImageElement as ImageEl } from '../../types';
import { useStore } from '../../store/useStore';
import { Icon } from '../Icon';
import { ElementResizeHandles } from './ElementResizeHandles';

interface Props {
  element: ImageEl;
  selected: boolean;
  zoom: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function ImageElementComponent({ element, selected, zoom, onPointerDown }: Props) {
  const { updateElement } = useStore();
  const { src, alt, objectFit = 'contain' } = element.properties;

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        cursor: element.locked ? 'default' : 'move',
        userSelect: 'none',
        zIndex: element.zIndex,
        boxShadow: selected
          ? '0 0 0 2px var(--primary), 0 12px 24px rgba(0,0,0,0.12)'
          : '0 8px 18px rgba(0,0,0,0.1)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--bg-tertiary)',
        transform: `rotate(${element.rotation ?? 0}deg)`,
        transformOrigin: 'center center',
      }}
      onPointerDown={onPointerDown}
    >
      <img
        src={src}
        alt={alt ?? ''}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          display: 'block',
          pointerEvents: 'none',
        }}
        onError={(event) => {
          (event.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />

      {!src && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          <Icon name="image" size={28} />
          <span>No image</span>
        </div>
      )}

      {selected && (
        <ElementResizeHandles
          element={element}
          zoom={zoom}
          minWidth={40}
          minHeight={30}
          onResize={(updates) => updateElement(element.id, updates)}
        />
      )}
    </div>
  );
}
