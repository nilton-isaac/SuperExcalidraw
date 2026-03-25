import { getArrow } from 'perfect-arrows';
import type { ArrowLineStyle, ArrowProperties, Point } from '../types';

interface RouteBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function getArrowRenderablePoints(
  properties: Pick<ArrowProperties, 'points' | 'lineStyle'> & {
    startBounds?: RouteBounds;
    endBounds?: RouteBounds;
  }
) {
  const points = properties.points;
  const lineStyle = properties.lineStyle ?? 'straight';

  if (lineStyle !== 'orthogonal' || points.length !== 2) {
    return points;
  }

  return createOrthogonalPoints(points[0], points[1], properties.startBounds, properties.endBounds);
}

export function buildArrowPathDefinition(
  properties: Pick<ArrowProperties, 'points' | 'lineStyle' | 'curveOffset'> & {
    startBounds?: RouteBounds;
    endBounds?: RouteBounds;
  }
) {
  const points = getArrowRenderablePoints(properties);
  const lineStyle = properties.lineStyle ?? 'straight';
  const curveOffset = properties.curveOffset ?? 36;

  if (points.length < 2) return '';

  if (lineStyle === 'curved' && points.length === 2) {
    return buildNaturalCurvePath(points[0], points[1], curveOffset);
  }

  if (lineStyle === 'curved') {
    return buildSmoothPath(points);
  }

  if (lineStyle === 'orthogonal') {
    return buildRoundedOrthogonalPath(points);
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function insertArrowMidPoint(
  properties: Pick<ArrowProperties, 'points' | 'lineStyle'> & {
    startBounds?: RouteBounds;
    endBounds?: RouteBounds;
  }
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

function createOrthogonalPoints(start: Point, end: Point, startBounds?: RouteBounds, endBounds?: RouteBounds) {
  if (startBounds || endBounds) {
    return createAutoRoutedOrthogonalPoints(start, end, startBounds, endBounds);
  }

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

function createAutoRoutedOrthogonalPoints(
  start: Point,
  end: Point,
  startBounds?: RouteBounds,
  endBounds?: RouteBounds,
) {
  const startSide = startBounds ? getClosestSide(startBounds, start) : inferSideFromDirection(start, end);
  const endSide = endBounds ? getClosestSide(endBounds, end) : inferSideFromDirection(end, start);
  const axisDistance = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  const gutter = Math.max(24, Math.min(48, axisDistance * 0.45 || 32));
  const startLead = movePointFromSide(start, startSide, gutter);
  const endLead = movePointFromSide(end, endSide, gutter);

  const candidates: Point[][] = [];

  candidates.push([
    start,
    startLead,
    { x: endLead.x, y: startLead.y },
    endLead,
    end,
  ]);
  candidates.push([
    start,
    startLead,
    { x: startLead.x, y: endLead.y },
    endLead,
    end,
  ]);

  if (isHorizontalSide(startSide) && isHorizontalSide(endSide)) {
    const facingEachOther =
      (startSide === 'right' && endSide === 'left' && startLead.x <= endLead.x) ||
      (startSide === 'left' && endSide === 'right' && startLead.x >= endLead.x);

    if (facingEachOther) {
      const midX = (startLead.x + endLead.x) / 2;
      candidates.push([
        start,
        startLead,
        { x: midX, y: startLead.y },
        { x: midX, y: endLead.y },
        endLead,
        end,
      ]);
    } else {
      const corridorX = getHorizontalCorridor(startBounds, endBounds, startSide, gutter);
      candidates.push([
        start,
        startLead,
        { x: corridorX, y: startLead.y },
        { x: corridorX, y: endLead.y },
        endLead,
        end,
      ]);
    }
  }

  if (!isHorizontalSide(startSide) && !isHorizontalSide(endSide)) {
    const facingEachOther =
      (startSide === 'bottom' && endSide === 'top' && startLead.y <= endLead.y) ||
      (startSide === 'top' && endSide === 'bottom' && startLead.y >= endLead.y);

    if (facingEachOther) {
      const midY = (startLead.y + endLead.y) / 2;
      candidates.push([
        start,
        startLead,
        { x: startLead.x, y: midY },
        { x: endLead.x, y: midY },
        endLead,
        end,
      ]);
    } else {
      const corridorY = getVerticalCorridor(startBounds, endBounds, startSide, gutter);
      candidates.push([
        start,
        startLead,
        { x: startLead.x, y: corridorY },
        { x: endLead.x, y: corridorY },
        endLead,
        end,
      ]);
    }
  }

  return pickBestOrthogonalRoute(candidates, startBounds, endBounds);
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

function buildNaturalCurvePath(start: Point, end: Point, curveOffset: number) {
  const distance = Math.max(1, getDistance(start, end));
  const bow = Math.max(0.08, Math.min(0.42, curveOffset / Math.max(distance, 48)));
  const [sx, sy, cx, cy, ex, ey] = getArrow(start.x, start.y, end.x, end.y, {
    bow,
    stretch: Math.max(0.15, Math.min(0.55, bow * 1.75)),
    stretchMin: 24,
    stretchMax: 420,
    straights: false,
  });

  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
}

function buildRoundedOrthogonalPath(points: Point[]) {
  const normalized = compressOrthogonalPoints(points);
  if (normalized.length < 2) return '';
  if (normalized.length === 2) {
    return normalized.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  }

  let path = `M ${normalized[0].x} ${normalized[0].y}`;

  for (let index = 1; index < normalized.length - 1; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const next = normalized[index + 1];
    const previousDistance = getDistance(previous, current);
    const nextDistance = getDistance(current, next);
    const radius = Math.min(14, previousDistance / 2, nextDistance / 2);

    if (radius < 1 || isCollinear(previous, current, next)) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const entry = moveTowards(current, previous, radius);
    const exit = moveTowards(current, next, radius);
    path += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
  }

  const last = normalized[normalized.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

function compressOrthogonalPoints(points: Point[]) {
  const compacted = points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return previous.x !== point.x || previous.y !== point.y;
  });

  if (compacted.length < 3) return compacted;

  const normalized: Point[] = [compacted[0]];
  for (let index = 1; index < compacted.length - 1; index += 1) {
    const previous = normalized[normalized.length - 1];
    const current = compacted[index];
    const next = compacted[index + 1];
    if (isCollinear(previous, current, next)) {
      continue;
    }
    normalized.push(current);
  }
  normalized.push(compacted[compacted.length - 1]);
  return normalized;
}

function pickBestOrthogonalRoute(
  candidates: Point[][],
  startBounds?: RouteBounds,
  endBounds?: RouteBounds,
) {
  const normalizedCandidates = candidates
    .map((candidate) => compressOrthogonalPoints(candidate))
    .filter((candidate, index, all) =>
      all.findIndex((other) => serializePointList(other) === serializePointList(candidate)) === index
    );

  let bestCandidate = normalizedCandidates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of normalizedCandidates) {
    const score = scoreOrthogonalRoute(candidate, startBounds, endBounds);
    if (score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function scoreOrthogonalRoute(points: Point[], startBounds?: RouteBounds, endBounds?: RouteBounds) {
  let score = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    score += getDistance(start, end);

    const isFirstSegment = index === 0;
    const isLastSegment = index === points.length - 2;

    if (!isFirstSegment && startBounds && segmentIntersectsRect(start, end, startBounds)) {
      score += 2000;
    }
    if (!isLastSegment && endBounds && segmentIntersectsRect(start, end, endBounds)) {
      score += 2000;
    }
  }

  score += (points.length - 2) * 18;
  return score;
}

function segmentIntersectsRect(start: Point, end: Point, rect: RouteBounds) {
  const inset = 6;
  const left = rect.left - inset;
  const right = rect.right + inset;
  const top = rect.top - inset;
  const bottom = rect.bottom + inset;

  if (start.x === end.x) {
    if (start.x < left || start.x > right) return false;
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return maxY >= top && minY <= bottom;
  }

  if (start.y === end.y) {
    if (start.y < top || start.y > bottom) return false;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return maxX >= left && minX <= right;
  }

  return false;
}

function serializePointList(points: Point[]) {
  return points.map((point) => `${point.x}:${point.y}`).join('|');
}

function moveTowards(origin: Point, target: Point, distance: number) {
  const length = getDistance(origin, target);
  if (length === 0) return origin;
  const ratio = distance / length;
  return {
    x: origin.x + (target.x - origin.x) * ratio,
    y: origin.y + (target.y - origin.y) * ratio,
  };
}

function getClosestSide(bounds: RouteBounds, point: Point) {
  const distances = [
    { side: 'top' as const, value: Math.abs(point.y - bounds.top) },
    { side: 'bottom' as const, value: Math.abs(point.y - bounds.bottom) },
    { side: 'left' as const, value: Math.abs(point.x - bounds.left) },
    { side: 'right' as const, value: Math.abs(point.x - bounds.right) },
  ];
  return distances.sort((a, b) => a.value - b.value)[0].side;
}

function inferSideFromDirection(origin: Point, target: Point) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

function movePointFromSide(point: Point, side: 'top' | 'bottom' | 'left' | 'right', offset: number) {
  if (side === 'top') return { x: point.x, y: point.y - offset };
  if (side === 'bottom') return { x: point.x, y: point.y + offset };
  if (side === 'left') return { x: point.x - offset, y: point.y };
  return { x: point.x + offset, y: point.y };
}

function getHorizontalCorridor(
  startBounds: RouteBounds | undefined,
  endBounds: RouteBounds | undefined,
  side: 'left' | 'right',
  gutter: number,
) {
  if (side === 'right') {
    return Math.max(startBounds?.right ?? Number.NEGATIVE_INFINITY, endBounds?.right ?? Number.NEGATIVE_INFINITY) + gutter;
  }
  return Math.min(startBounds?.left ?? Number.POSITIVE_INFINITY, endBounds?.left ?? Number.POSITIVE_INFINITY) - gutter;
}

function getVerticalCorridor(
  startBounds: RouteBounds | undefined,
  endBounds: RouteBounds | undefined,
  side: 'top' | 'bottom',
  gutter: number,
) {
  if (side === 'bottom') {
    return Math.max(startBounds?.bottom ?? Number.NEGATIVE_INFINITY, endBounds?.bottom ?? Number.NEGATIVE_INFINITY) + gutter;
  }
  return Math.min(startBounds?.top ?? Number.POSITIVE_INFINITY, endBounds?.top ?? Number.POSITIVE_INFINITY) - gutter;
}

function isHorizontalSide(side: 'top' | 'bottom' | 'left' | 'right') {
  return side === 'left' || side === 'right';
}

function isCollinear(previous: Point, current: Point, next: Point) {
  return (previous.x === current.x && current.x === next.x) || (previous.y === current.y && current.y === next.y);
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
  properties: Pick<ArrowProperties, 'points' | 'lineStyle'> & {
    startBounds?: RouteBounds;
    endBounds?: RouteBounds;
  },
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

export function resolveArrowLineStyle(
  lineStyle: ArrowLineStyle | undefined,
  startElementId?: string,
  endElementId?: string,
): ArrowLineStyle {
  const normalized = clampArrowLineStyle(lineStyle);
  if (
    normalized === 'straight' &&
    startElementId &&
    endElementId &&
    startElementId !== endElementId
  ) {
    return 'orthogonal';
  }
  return normalized;
}
