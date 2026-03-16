import { v4 as uuidv4 } from 'uuid';
import type { WhiteboardElement } from '../types';

export const FIGMADOC_CLIPBOARD_PREFIX = 'FIGMADOC_CLIPBOARD::';

export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeElementsForClipboard(elements: WhiteboardElement[]) {
  return `${FIGMADOC_CLIPBOARD_PREFIX}${JSON.stringify(cloneData(elements))}`;
}

export function parseElementsFromClipboard(value: string) {
  if (!value.startsWith(FIGMADOC_CLIPBOARD_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(value.slice(FIGMADOC_CLIPBOARD_PREFIX.length)) as WhiteboardElement[];
  } catch {
    return null;
  }
}

export function cloneElementsForPaste(
  elements: WhiteboardElement[],
  maxZIndex: number,
  options?: {
    offset?: number;
    anchor?: { x: number; y: number };
  }
) {
  const offset = options?.offset ?? 24;
  const anchor = options?.anchor;
  const groupIdMap = new Map<string, string>();
  const minX = Math.min(...elements.map((element) => element.x));
  const minY = Math.min(...elements.map((element) => element.y));

  return cloneData(elements).map((element, index) => {
    const nextGroupId = element.groupId
      ? (groupIdMap.get(element.groupId) ?? (() => {
          const created = uuidv4();
          groupIdMap.set(element.groupId!, created);
          return created;
        })())
      : undefined;

    return {
      ...element,
      id: uuidv4(),
      x: anchor ? anchor.x + (element.x - minX) : element.x + offset,
      y: anchor ? anchor.y + (element.y - minY) : element.y + offset,
      zIndex: maxZIndex + index + 1,
      groupId: nextGroupId,
      locked: false,
    };
  });
}
