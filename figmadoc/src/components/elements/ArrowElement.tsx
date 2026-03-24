import { buildArrowPathDefinition, getArrowRenderablePoints, insertArrowMidPoint, snapArrowHandlePoint } from '../../lib/arrows';
import { useStore } from '../../store/useStore';
import type { ArrowElement as ArrowEl, ArrowHead, Point } from '../../types';

interface Props {
  element: ArrowEl;
  selected: boolean;
  zoom: number;
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

export function ArrowElementComponent({ element, selected, zoom, onPointerDown }: Props) {
  const { elements, historyPush, updateElement } = useStore();
  const {
    points,
    color = '#000000',
    strokeWidth = 2,
    arrowHead,
    startArrowHead = 'none',
    endArrowHead = arrowHead ?? 'filled',
    lineStyle = 'straight',
    curveOffset = 36,
  } = element.properties;

  if (points.length < 2) return null;

  const renderPoints = getArrowRenderablePoints({ points, lineStyle });
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
    lineStyle,
    curveOffset,
  });

  const stroke = selected ? 'var(--primary)' : color;
  const startMarkerId = `arrowhead-start-${element.id}`;
  const endMarkerId = `arrowhead-end-${element.id}`;
  const startMarker = buildMarker(startMarkerId, startArrowHead, markerSize, stroke, 'start');
  const endMarker = buildMarker(endMarkerId, endArrowHead, markerSize, stroke, 'end');
  const editablePoints = points.length === renderPoints.length ? points : renderPoints;
  const addPointAnchor = getAddPointAnchor(renderPoints);

  const updatePoints = (nextPoints: Point[], edgePatch?: { startElementId?: string; endElementId?: string }) => {
    updateElement(element.id, {
      properties: {
        ...element.properties,
        points: nextPoints,
        ...edgePatch,
      },
    });
  };

  const onHandlePointerDown = (event: React.PointerEvent, pointIndex: number) => {
    event.stopPropagation();
    event.preventDefault();
    historyPush();

    const startX = event.clientX;
    const startY = event.clientY;
    const initialPoint = editablePoints[pointIndex];
    const basePoints = editablePoints.map((point) => ({ ...point }));
    const isStart = pointIndex === 0;
    const isEnd = pointIndex === editablePoints.length - 1;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      const movedPoint = { x: initialPoint.x + dx, y: initialPoint.y + dy };
      const snappedHandlePoint = snapArrowHandlePoint(basePoints, pointIndex, movedPoint, lineStyle);
      const snapTarget = isStart || isEnd
        ? getSnapTarget(
            snappedHandlePoint,
            elements.filter((candidate) => candidate.id !== element.id),
          )
        : null;

      updatePoints(
        basePoints.map((point, index) =>
          index === pointIndex
            ? (snapTarget?.snappedPoint ?? snappedHandlePoint)
            : point
        ),
        isStart || isEnd
          ? {
              startElementId: isStart ? snapTarget?.elementId : element.properties.startElementId,
              endElementId: isEnd ? snapTarget?.elementId : element.properties.endElementId,
            }
          : undefined
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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

        {selected &&
          translatedPoints.map((point, index) => (
            <circle
              key={`${element.id}-handle-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === 0 || index === translatedPoints.length - 1 ? 7 : 6}
              fill="var(--glass-bg)"
              stroke="var(--primary)"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onPointerDown={(event) => onHandlePointerDown(event, index)}
            />
          ))}

        {selected && addPointAnchor && (
          <g
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              historyPush();
              updatePoints(insertArrowMidPoint({ points: editablePoints, lineStyle }));
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={addPointAnchor.x - minX}
              cy={addPointAnchor.y - minY}
              r={10}
              fill="var(--glass-bg)"
              stroke="var(--primary)"
              strokeWidth={1.5}
            />
            <path
              d={`M ${addPointAnchor.x - minX - 4} ${addPointAnchor.y - minY} L ${addPointAnchor.x - minX + 4} ${addPointAnchor.y - minY} M ${addPointAnchor.x - minX} ${addPointAnchor.y - minY - 4} L ${addPointAnchor.x - minX} ${addPointAnchor.y - minY + 4}`}
              stroke="var(--primary)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function getAddPointAnchor(points: Point[]) {
  if (points.length < 2) return null;
  const segmentIndex = Math.max(0, Math.floor((points.length - 1) / 2));
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1] ?? points[segmentIndex];

  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function getSnapTarget(point: Point, elements: ReturnType<typeof useStore.getState>['elements'], threshold = 22) {
  let best: { snappedPoint: Point; elementId: string; dist: number } | null = null;

  for (const element of elements) {
    if (element.type === 'arrow' || element.type === 'pen') continue;
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const anchors: Point[] = [
      { x: cx, y: element.y },
      { x: cx, y: element.y + element.height },
      { x: element.x, y: cy },
      { x: element.x + element.width, y: cy },
    ];

    for (const anchor of anchors) {
      const dist = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { snappedPoint: anchor, elementId: element.id, dist };
      }
    }
  }

  return best ? { snappedPoint: best.snappedPoint, elementId: best.elementId } : null;
}
