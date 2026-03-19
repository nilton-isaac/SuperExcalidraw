import type { ArrowLineStyle, ArrowProperties, Point } from '../types';

export function getArrowRenderablePoints(
  properties: Pick<ArrowProperties, 'points' | 'lineStyle'>
) {
  const points = properties.points;
  const lineStyle = properties.lineStyle ?? 'straight';

  if (lineStyle !== 'orthogonal' || points.length !== 2) {
    return points;
  }

  return createOrthogonalPoints(points[0], points[1]);
}

export function buildArrowPathDefinition(
  properties: Pick<ArrowProperties, 'points' | 'lineStyle' | 'curveOffset'>
) {
  const points = getArrowRenderablePoints(properties);
  const lineStyle = properties.lineStyle ?? 'straight';
  const curveOffset = properties.curveOffset ?? 36;

  if (points.length < 2) return '';

  if (lineStyle === 'curved' && points.length === 2) {
    const [start, end] = points;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const offset = Math.min(curveOffset, length * 0.35);
    const control = {
      x: midpoint.x + (-dy / length) * offset,
      y: midpoint.y + (dx / length) * offset,
    };

    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }

  if (lineStyle === 'curved') {
    return buildSmoothPath(points);
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function insertArrowMidPoint(
  properties: Pick<ArrowProperties, 'points' | 'lineStyle'>
) {
  const points = getArrowRenderablePoints(properties);
  if (points.length < 2) return points;

  const segmentIndex = Math.max(0, Math.floor((points.length - 1) / 2));
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1] ?? points[segmentIndex];
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  return [
    ...points.slice(0, segmentIndex + 1),
    midpoint,
    ...points.slice(segmentIndex + 1),
  ];
}

function createOrthogonalPoints(start: Point, end: Point) {
  const horizontalDominant = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);

  if (horizontalDominant) {
    const midX = (start.x + end.x) / 2;
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ];
  }

  const midY = (start.y + end.y) / 2;
  return [
    start,
    { x: start.x, y: midY },
    { x: end.x, y: midY },
    end,
  ];
}

function buildSmoothPath(points: Point[]) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midpoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
    };

    path += ` Q ${current.x} ${current.y} ${midpoint.x} ${midpoint.y}`;
  }

  const secondLast = points[points.length - 2];
  const last = points[points.length - 1];
  path += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`;

  return path;
}

export function getArrowBounds(
  properties: Pick<ArrowProperties, 'points' | 'lineStyle'>,
  padding = 0
) {
  const points = getArrowRenderablePoints(properties);
  const allX = points.map((point) => point.x);
  const allY = points.map((point) => point.y);

  return {
    left: Math.min(...allX) - padding,
    top: Math.min(...allY) - padding,
    right: Math.max(...allX) + padding,
    bottom: Math.max(...allY) + padding,
  };
}

export function clampArrowLineStyle(value?: string): ArrowLineStyle {
  if (value === 'curved' || value === 'orthogonal') {
    return value;
  }
  return 'straight';
}
