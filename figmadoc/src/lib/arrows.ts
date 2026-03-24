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

export function snapArrowHandlePoint(
  points: Point[],
  pointIndex: number,
  movedPoint: Point,
  lineStyle?: ArrowLineStyle,
) {
  if (lineStyle !== 'orthogonal' || points.length < 2) {
    return movedPoint;
  }

  const previousPoint = points[pointIndex - 1];
  const nextPoint = points[pointIndex + 1];

  if (previousPoint && nextPoint) {
    const previousAngle = getSnappedAngle(previousPoint, movedPoint);
    const nextAngle = getSnappedAngle(nextPoint, movedPoint);
    const candidates = [
      projectPointAtAngle(previousPoint, movedPoint, previousAngle),
      projectPointAtAngle(nextPoint, movedPoint, nextAngle),
    ];
    const intersection = getLineIntersection(previousPoint, previousAngle, nextPoint, nextAngle);
    if (intersection) {
      candidates.push(intersection);
    }

    return candidates.reduce((bestCandidate, candidate) =>
      getDistance(candidate, movedPoint) < getDistance(bestCandidate, movedPoint)
        ? candidate
        : bestCandidate
    );
  }

  if (previousPoint) {
    return projectPointAtAngle(previousPoint, movedPoint, getSnappedAngle(previousPoint, movedPoint));
  }

  if (nextPoint) {
    return projectPointAtAngle(nextPoint, movedPoint, getSnappedAngle(nextPoint, movedPoint));
  }

  return movedPoint;
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

function getSnappedAngle(origin: Point, target: Point) {
  const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
  return snapAngle(angle);
}

function snapAngle(angle: number) {
  const step = Math.PI / 4;
  return Math.round(angle / step) * step;
}

function projectPointAtAngle(origin: Point, target: Point, angle: number) {
  const distance = getDistance(origin, target);
  return {
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y + Math.sin(angle) * distance,
  };
}

function getLineIntersection(originA: Point, angleA: number, originB: Point, angleB: number) {
  const directionA = { x: Math.cos(angleA), y: Math.sin(angleA) };
  const directionB = { x: Math.cos(angleB), y: Math.sin(angleB) };
  const determinant = directionA.x * directionB.y - directionA.y * directionB.x;

  if (Math.abs(determinant) < 0.0001) {
    return null;
  }

  const deltaX = originB.x - originA.x;
  const deltaY = originB.y - originA.y;
  const t = (deltaX * directionB.y - deltaY * directionB.x) / determinant;

  return {
    x: originA.x + directionA.x * t,
    y: originA.y + directionA.y * t,
  };
}

function getDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
