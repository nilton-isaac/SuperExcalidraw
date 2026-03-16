import type { ArrowElement as ArrowEl } from '../../types';

interface Props {
  element: ArrowEl;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function ArrowElementComponent({ element, selected, onPointerDown }: Props) {
  const { points, color = '#000000', strokeWidth = 2 } = element.properties;
  if (points.length < 2) return null;

  const allX = points.map((point) => point.x);
  const allY = points.map((point) => point.y);
  const minX = Math.min(...allX) - 20;
  const minY = Math.min(...allY) - 20;
  const maxX = Math.max(...allX) + 20;
  const maxY = Math.max(...allY) + 20;
  const svgWidth = maxX - minX;
  const svgHeight = maxY - minY;

  const pathDefinition = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x - minX} ${point.y - minY}`)
    .join(' ');

  const stroke = selected ? 'var(--primary)' : color;
  const markerSize = Math.max(8, (selected ? strokeWidth + 1 : strokeWidth) * 4);

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x + minX,
        top: element.y + minY,
        width: svgWidth,
        height: svgHeight,
        cursor: 'move',
        zIndex: element.zIndex,
        transform: `rotate(${element.rotation ?? 0}deg)`,
        transformOrigin: 'center center',
      }}
      onPointerDown={onPointerDown}
    >
      <svg
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'all',
        }}
      >
        <defs>
          <marker
            id={`arrowhead-${element.id}`}
            markerWidth={markerSize}
            markerHeight={markerSize}
            refX={markerSize}
            refY={markerSize / 2}
            orient="auto"
          >
            <polygon
              points={`0 0, ${markerSize} ${markerSize / 2}, 0 ${markerSize}`}
              fill={stroke}
            />
          </marker>
        </defs>
        <path
          d={pathDefinition}
          fill="none"
          stroke={stroke}
          strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
          markerEnd={`url(#arrowhead-${element.id})`}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
