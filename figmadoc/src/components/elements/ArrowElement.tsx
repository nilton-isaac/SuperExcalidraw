import { buildArrowPathDefinition, getArrowRenderablePoints, resolveArrowLineStyle } from '../../lib/arrows';
import { useStore } from '../../store/useStore';
import type { ArrowElement as ArrowEl, ArrowHead, WhiteboardElement } from '../../types';

interface Props {
  element: ArrowEl;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}

function buildMarker(id: string, arrowHead: ArrowHead, size: number, color: string, position: 'start' | 'end') {
  if (arrowHead === 'none') return null;

  if (arrowHead === 'filled') {
    return position === 'end' ? (
      <marker id={id} markerWidth={size} markerHeight={size} refX={size} refY={size / 2} orient="auto">
        <polygon points={`0 0, ${size} ${size / 2}, 0 ${size}`} fill={color} />
      </marker>
    ) : (
      <marker id={id} markerWidth={size} markerHeight={size} refX={0} refY={size / 2} orient="auto">
        <polygon points={`${size} 0, 0 ${size / 2}, ${size} ${size}`} fill={color} />
      </marker>
    );
  }

  if (arrowHead === 'open') {
    const points = position === 'end'
      ? `0 0, ${size} ${size / 2}, 0 ${size}`
      : `${size} 0, 0 ${size / 2}, ${size} ${size}`;

    return (
      <marker
        id={id}
        markerWidth={size}
        markerHeight={size}
        refX={position === 'end' ? size - 1 : 1}
        refY={size / 2}
        orient="auto"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
    );
  }

  const radius = size / 2 - 1;
  return (
    <marker
      id={id}
      markerWidth={size}
      markerHeight={size}
      refX={position === 'end' ? size - 2 : 2}
      refY={size / 2}
      orient="auto"
    >
      <circle cx={radius + 1} cy={size / 2} r={radius} fill={color} />
    </marker>
  );
}

export function ArrowElementComponent({ element, selected, onPointerDown }: Props) {
  const { elements, activeTool } = useStore();
  const {
    points,
    color = '#000000',
    strokeWidth = 2,
    arrowHead,
    startArrowHead = 'none',
    endArrowHead = arrowHead ?? 'filled',
    lineStyle = 'straight',
    curveOffset = 36,
    startElementId,
    endElementId,
  } = element.properties;

  if (points.length < 2) return null;

  const startConnectedElement = startElementId ? elements.find((candidate) => candidate.id === startElementId) : undefined;
  const endConnectedElement = endElementId ? elements.find((candidate) => candidate.id === endElementId) : undefined;
  const startBounds = startConnectedElement ? getRouteBounds(startConnectedElement) : undefined;
  const endBounds = endConnectedElement ? getRouteBounds(endConnectedElement) : undefined;
  const effectiveLineStyle = resolveArrowLineStyle(lineStyle, startElementId, endElementId);
  const renderPoints = getArrowRenderablePoints({
    points,
    lineStyle: effectiveLineStyle,
    startBounds,
    endBounds,
  });
  const markerSize = Math.max(8, (selected ? strokeWidth + 1 : strokeWidth) * 4);
  const boundsPadding = Math.max(20, curveOffset, markerSize + 12);
  const allX = renderPoints.map((point) => point.x);
  const allY = renderPoints.map((point) => point.y);
  const minX = Math.min(...allX) - boundsPadding;
  const minY = Math.min(...allY) - boundsPadding;
  const maxX = Math.max(...allX) + boundsPadding;
  const maxY = Math.max(...allY) + boundsPadding;
  const svgWidth = maxX - minX;
  const svgHeight = maxY - minY;
  const translatedPoints = renderPoints.map((point) => ({
    x: point.x - minX,
    y: point.y - minY,
  }));
  const pathDefinition = buildArrowPathDefinition({
    points: translatedPoints,
    lineStyle: effectiveLineStyle,
    curveOffset,
    startBounds: startBounds
      ? {
          left: startBounds.left - minX,
          top: startBounds.top - minY,
          right: startBounds.right - minX,
          bottom: startBounds.bottom - minY,
        }
      : undefined,
    endBounds: endBounds
      ? {
          left: endBounds.left - minX,
          top: endBounds.top - minY,
          right: endBounds.right - minX,
          bottom: endBounds.bottom - minY,
        }
      : undefined,
  });

  const stroke = selected ? 'var(--primary)' : color;
  const startMarkerId = `arrowhead-start-${element.id}`;
  const endMarkerId = `arrowhead-end-${element.id}`;
  const startMarker = buildMarker(startMarkerId, startArrowHead, markerSize, stroke, 'start');
  const endMarker = buildMarker(endMarkerId, endArrowHead, markerSize, stroke, 'end');
  return (
    <div
      style={{
        position: 'absolute',
        left: element.x + minX,
        top: element.y + minY,
        width: svgWidth,
        height: svgHeight,
        cursor: 'pointer',
        pointerEvents: activeTool === 'arrow' ? 'none' : 'auto',
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
          pointerEvents: activeTool === 'arrow' ? 'none' : 'all',
        }}
      >
        {(startMarker || endMarker) && (
          <defs>
            {startMarker}
            {endMarker}
          </defs>
        )}
        <path
          d={pathDefinition}
          fill="none"
          stroke={stroke}
          strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
          markerStart={startMarker ? `url(#${startMarkerId})` : undefined}
          markerEnd={endMarker ? `url(#${endMarkerId})` : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function getRouteBounds(element: WhiteboardElement) {
  const padding = getConnectionPadding(element);
  return {
    left: element.x - padding,
    top: element.y - padding,
    right: element.x + element.width + padding,
    bottom: element.y + element.height + padding,
  };
}

function getConnectionPadding(element: WhiteboardElement) {
  if (element.type === 'text') return 16;
  return 4;
}
