import type { ArrowElement as ArrowEl, ArrowHead } from '../../types';

interface Props {
  element: ArrowEl;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}

function buildMarker(id: string, arrowHead: ArrowHead, size: number, color: string) {
  if (arrowHead === 'none') return null;

  if (arrowHead === 'filled') {
    return (
      <marker id={id} markerWidth={size} markerHeight={size} refX={size} refY={size / 2} orient="auto">
        <polygon points={`0 0, ${size} ${size / 2}, 0 ${size}`} fill={color} />
      </marker>
    );
  }

  if (arrowHead === 'open') {
    const half = size / 2;
    return (
      <marker id={id} markerWidth={size} markerHeight={size} refX={size - 1} refY={half} orient="auto">
        <polyline
          points={`0 0, ${size} ${half}, 0 ${size}`}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
    );
  }

  if (arrowHead === 'circle') {
    const r = size / 2 - 1;
    return (
      <marker id={id} markerWidth={size} markerHeight={size} refX={size - 1} refY={size / 2} orient="auto">
        <circle cx={r + 1} cy={size / 2} r={r} fill={color} />
      </marker>
    );
  }

  return null;
}

export function ArrowElementComponent({ element, selected, onPointerDown }: Props) {
  const { points, color = '#000000', strokeWidth = 2, arrowHead = 'filled' } = element.properties;
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
  const markerId = `arrowhead-${element.id}`;
  const marker = buildMarker(markerId, arrowHead, markerSize, stroke);

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
        {marker && <defs>{marker}</defs>}
        <path
          d={pathDefinition}
          fill="none"
          stroke={stroke}
          strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
          markerEnd={marker ? `url(#${markerId})` : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
