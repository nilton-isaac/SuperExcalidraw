import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { DocPage, FontWeight, Point, TextAlign, Tool, ViewState, WhiteboardElement } from '../types';
import {
  cloneData,
  cloneElementsForPaste,
  serializeElementsForClipboard,
} from '../lib/whiteboardData';

const MAX_HISTORY = 60;
const APP_STORAGE_KEY = 'sketch-docs-v1';
const LEGACY_STORAGE_KEYS = ['code-canvas-v1', 'figmadoc-v1'];
const APP_NAME = 'Sketch Docs';
const LEGACY_APP_NAMES = ['Code Canvas', 'FigmaDoc'];

const PAGE_ICON_MAP: Record<string, string> = {
  '📄': 'description',
  '📝': 'article',
};

const fallbackStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    if (name !== APP_STORAGE_KEY) {
      return localStorage.getItem(name);
    }

    return (
      localStorage.getItem(name)
      ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find((value) => value != null)
      ?? null
    );
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(name, value);
    if (name === APP_STORAGE_KEY) {
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(name);
    if (name === APP_STORAGE_KEY) {
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    }
  },
};

const normalizePageIcon = (icon?: string) => {
  if (!icon) return 'description';
  return PAGE_ICON_MAP[icon] ?? icon;
};

const normalizeLegacyTitle = (value?: string | null) => {
  const normalized = value?.trim();
  if (!normalized || LEGACY_APP_NAMES.includes(normalized)) {
    return APP_NAME;
  }
  return normalized;
};

const normalizePages = (pages: DocPage[]): DocPage[] =>
  pages.map((page) => ({
    ...page,
    icon: normalizePageIcon(page.icon),
    children: page.children ? normalizePages(page.children) : undefined,
  }));

const makeInitialPages = (): DocPage[] => [
  {
    id: 'page-1',
    title: 'Untitled',
    icon: 'description',
    content: '<h1>Untitled</h1><p>Start writing here...</p>',
  },
];

const updatePageTree = (pages: DocPage[], id: string, updates: Partial<DocPage>): DocPage[] =>
  pages.map((page) => {
    if (page.id === id) return { ...page, ...updates };
    if (!page.children) return page;
    return {
      ...page,
      children: updatePageTree(page.children, id, updates),
    };
  });

const deletePageTree = (pages: DocPage[], id: string): DocPage[] =>
  pages.flatMap((page) => {
    if (page.id === id) return [];
    if (!page.children) return [page];
    return [
      {
        ...page,
        children: deletePageTree(page.children, id),
      },
    ];
  });

const findFirstPageId = (pages: DocPage[]): string | null => {
  for (const page of pages) {
    return page.id;
  }

  return null;
};

interface ToolDefaults {
  shape: {
    fillColor: string;
    strokeColor: string;
    textColor: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: FontWeight;
    textAlign: TextAlign;
  };
  sticky: {
    color: string;
    textColor: string;
    fontSize: number;
    fontFamily: string;
    textAlign: TextAlign;
  };
  text: {
    color: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: FontWeight;
    textAlign: TextAlign;
  };
  arrow: {
    color: string;
    strokeWidth: number;
  };
  pen: {
    color: string;
    strokeWidth: number;
  };
}

interface BoardSnapshot {
  elements: WhiteboardElement[];
  pages: DocPage[];
  activePageId: string | null;
  documentTitle: string;
  theme: 'light' | 'dark';
  layoutMode: 'horizontal' | 'vertical';
  splitRatio: number;
  panelMode: 'split' | 'docs-only' | 'whiteboard-only';
  docsNavigatorCollapsed: boolean;
  viewState: ViewState;
}

interface SavedBoard {
  id: string;
  name: string;
  updatedAt: string;
  snapshot: BoardSnapshot;
}

const makeInitialViewState = (): ViewState => ({ x: 0, y: 0, zoom: 1 });
const makeInitialToolDefaults = (): ToolDefaults => ({
  shape: {
    fillColor: '#ffffff',
    strokeColor: '#000000',
    textColor: '#000000',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    textAlign: 'center',
  },
  sticky: {
    color: '#f2f2f2',
    textColor: '#000000',
    fontSize: 14,
    fontFamily: 'Inter',
    textAlign: 'left',
  },
  text: {
    color: '#000000',
    fontSize: 18,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    textAlign: 'left',
  },
  arrow: {
    color: '#000000',
    strokeWidth: 2,
  },
  pen: {
    color: '#000000',
    strokeWidth: 2,
  },
});

const makeBlankBoard = (title = 'Untitled Board'): BoardSnapshot => ({
  elements: [],
  pages: makeInitialPages(),
  activePageId: 'page-1',
  documentTitle: normalizeLegacyTitle(title),
  theme: 'light',
  layoutMode: 'horizontal',
  splitRatio: 0.28,
  panelMode: 'split',
  docsNavigatorCollapsed: false,
  viewState: makeInitialViewState(),
});

const normalizeSavedBoards = (boards: SavedBoard[] | undefined): SavedBoard[] =>
  (boards ?? []).map((board) => ({
    ...board,
    name: normalizeLegacyTitle(board.name),
    snapshot: {
      ...board.snapshot,
      pages: normalizePages(board.snapshot.pages ?? makeInitialPages()),
      activePageId: board.snapshot.activePageId ?? findFirstPageId(board.snapshot.pages ?? makeInitialPages()),
      viewState: board.snapshot.viewState ?? makeInitialViewState(),
      documentTitle: normalizeLegacyTitle(board.snapshot.documentTitle ?? board.name),
      theme: board.snapshot.theme ?? 'light',
      layoutMode: board.snapshot.layoutMode ?? 'horizontal',
      splitRatio: board.snapshot.splitRatio ?? 0.28,
      panelMode: board.snapshot.panelMode ?? 'split',
      docsNavigatorCollapsed: board.snapshot.docsNavigatorCollapsed ?? false,
      elements: board.snapshot.elements ?? [],
    },
  }));

const createBoardSnapshot = (state: Pick<
  AppStore,
  | 'elements'
  | 'pages'
  | 'activePageId'
  | 'documentTitle'
  | 'theme'
  | 'layoutMode'
  | 'splitRatio'
  | 'panelMode'
  | 'docsNavigatorCollapsed'
  | 'viewState'
>): BoardSnapshot => ({
  elements: cloneData(state.elements),
  pages: cloneData(state.pages),
  activePageId: state.activePageId,
  documentTitle: state.documentTitle,
  theme: state.theme,
  layoutMode: state.layoutMode,
  splitRatio: state.splitRatio,
  panelMode: state.panelMode,
  docsNavigatorCollapsed: state.docsNavigatorCollapsed,
  viewState: cloneData(state.viewState),
});

interface AppStore {
  elements: WhiteboardElement[];
  pages: DocPage[];
  activePageId: string | null;
  documentTitle: string;
  savedBoards: SavedBoard[];
  activeBoardId: string | null;
  theme: 'light' | 'dark';
  layoutMode: 'horizontal' | 'vertical';
  splitRatio: number;
  panelMode: 'split' | 'docs-only' | 'whiteboard-only';
  docsNavigatorCollapsed: boolean;
  docsEditorChromeCollapsed: boolean;
  activeSurface: 'document' | 'whiteboard';
  toolDefaults: ToolDefaults;

  selectedIds: string[];
  activeTool: Tool;
  viewState: ViewState;
  undoPast: WhiteboardElement[][];
  undoFuture: WhiteboardElement[][];
  clipboard: WhiteboardElement[];

  historyPush: () => void;
  undo: () => void;
  redo: () => void;

  addElement: (element: Omit<WhiteboardElement, 'id' | 'zIndex'>) => string;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
  updateElements: (updates: Array<{ id: string; updates: Partial<WhiteboardElement> }>) => void;
  deleteElement: (id: string) => void;
  deleteSelectedElements: () => void;
  duplicateElement: (id: string) => void;

  selectElement: (id: string, additive?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;

  groupSelected: () => void;
  ungroupSelected: () => void;
  toggleLock: (id: string) => void;
  bringSelectionToFront: () => void;
  sendSelectionToBack: () => void;

  copySelected: () => Promise<void>;
  paste: (source?: WhiteboardElement[], anchor?: Point) => void;

  setActiveTool: (tool: Tool) => void;
  setViewState: (vs: Partial<ViewState>) => void;

  addPage: (parentId?: string) => void;
  updatePage: (id: string, updates: Partial<DocPage>) => void;
  deletePage: (id: string) => void;
  setActivePageId: (id: string) => void;
  setDocumentTitle: (title: string) => void;
  saveCurrentBoard: (name?: string) => string;
  saveBoardAs: (name: string) => string;
  loadBoard: (id: string) => void;
  deleteBoard: (id: string) => void;
  createBoard: (title?: string) => void;
  importBoard: (data: unknown) => void;
  importAllBoards: (data: unknown) => void;

  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLayoutMode: (mode: 'horizontal' | 'vertical') => void;
  setSplitRatio: (ratio: number) => void;
  setPanelMode: (mode: 'split' | 'docs-only' | 'whiteboard-only') => void;
  setDocsNavigatorCollapsed: (collapsed: boolean) => void;
  toggleDocsNavigatorCollapsed: () => void;
  setDocsEditorChromeCollapsed: (collapsed: boolean) => void;
  toggleDocsEditorChromeCollapsed: () => void;
  setActiveSurface: (surface: 'document' | 'whiteboard') => void;
  updateToolDefaults: <K extends keyof ToolDefaults>(tool: K, patch: Partial<ToolDefaults[K]>) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      elements: [],
      pages: makeInitialPages(),
      activePageId: 'page-1',
      documentTitle: APP_NAME,
      savedBoards: [],
      activeBoardId: null,
      theme: 'light',
      layoutMode: 'horizontal',
      splitRatio: 0.28,
      panelMode: 'split',
      docsNavigatorCollapsed: false,
      docsEditorChromeCollapsed: false,
      activeSurface: 'whiteboard',
      toolDefaults: makeInitialToolDefaults(),

      selectedIds: [],
      activeTool: 'select',
      viewState: makeInitialViewState(),
      undoPast: [],
      undoFuture: [],
      clipboard: [],

      historyPush: () => {
        const { elements, undoPast } = get();
        set({
          undoPast: [...undoPast, elements].slice(-MAX_HISTORY),
          undoFuture: [],
        });
      },

      undo: () => {
        const { undoPast, elements, undoFuture } = get();
        if (undoPast.length === 0) return;
        const previous = undoPast[undoPast.length - 1];
        set({
          elements: previous,
          undoPast: undoPast.slice(0, -1),
          undoFuture: [elements, ...undoFuture].slice(0, MAX_HISTORY),
          selectedIds: [],
        });
      },

      redo: () => {
        const { undoFuture, elements, undoPast } = get();
        if (undoFuture.length === 0) return;
        const next = undoFuture[0];
        set({
          elements: next,
          undoFuture: undoFuture.slice(1),
          undoPast: [...undoPast, elements].slice(-MAX_HISTORY),
          selectedIds: [],
        });
      },

      addElement: (element) => {
        get().historyPush();
        const id = uuidv4();
        const maxZIndex = get().elements.reduce((max, current) => Math.max(max, current.zIndex), 0);
        const nextElement = { ...element, id, zIndex: maxZIndex + 1 } as WhiteboardElement;
        set((state) => ({ elements: [...state.elements, nextElement] }));
        return id;
      },

      updateElement: (id, updates) =>
        set((state) => ({
          elements: state.elements.map((element) =>
            element.id === id ? ({ ...element, ...updates } as WhiteboardElement) : element
          ),
        })),

      updateElements: (updates) =>
        set((state) => {
          if (updates.length === 0) return state;
          const updateMap = new Map(updates.map((entry) => [entry.id, entry.updates]));
          return {
            elements: state.elements.map((element) => {
              const patch = updateMap.get(element.id);
              return patch ? ({ ...element, ...patch } as WhiteboardElement) : element;
            }),
          };
        }),

      deleteElement: (id) => {
        get().historyPush();
        set((state) => ({
          elements: state.elements.filter((element) => element.id !== id),
          selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
        }));
      },

      deleteSelectedElements: () => {
        const ids = get().selectedIds;
        if (ids.length === 0) return;
        get().historyPush();
        set((state) => ({
          elements: state.elements.filter((element) => !ids.includes(element.id)),
          selectedIds: [],
        }));
      },

      duplicateElement: (id) => {
        const element = get().elements.find((candidate) => candidate.id === id);
        if (!element) return;
        get().historyPush();
        const maxZIndex = get().elements.reduce((max, current) => Math.max(max, current.zIndex), 0);
        const duplicated: WhiteboardElement = {
          ...element,
          id: uuidv4(),
          x: element.x + 20,
          y: element.y + 20,
          zIndex: maxZIndex + 1,
          groupId: undefined,
          locked: false,
        };
        set((state) => ({
          elements: [...state.elements, duplicated],
          selectedIds: [duplicated.id],
        }));
      },

      selectElement: (id, additive = false) => {
        const { elements } = get();
        const element = elements.find((candidate) => candidate.id === id);
        if (element?.locked) {
          set({ selectedIds: [id] });
          return;
        }
        const groupId = element?.groupId;
        const nextIds = groupId
          ? elements.filter((candidate) => candidate.groupId === groupId).map((candidate) => candidate.id)
          : [id];

        set((state) => ({
          selectedIds: additive
            ? nextIds.every((candidateId) => state.selectedIds.includes(candidateId))
              ? state.selectedIds.filter((selectedId) => !nextIds.includes(selectedId))
              : [...new Set([...state.selectedIds, ...nextIds])]
            : nextIds,
        }));
      },

      setSelectedIds: (selectedIds) => set({ selectedIds: [...new Set(selectedIds)] }),

      clearSelection: () => set({ selectedIds: [] }),

      selectAll: () =>
        set((state) => ({
          selectedIds: state.elements.filter((element) => !element.locked).map((element) => element.id),
        })),

      groupSelected: () => {
        const { selectedIds, elements } = get();
        if (selectedIds.length < 2) return;
        get().historyPush();
        const groupId = uuidv4();
        set({
          elements: elements.map((element) =>
            selectedIds.includes(element.id) ? { ...element, groupId } : element
          ),
        });
      },

      ungroupSelected: () => {
        const { selectedIds, elements } = get();
        if (selectedIds.length === 0) return;
        get().historyPush();
        set({
          elements: elements.map((element) =>
            selectedIds.includes(element.id) ? { ...element, groupId: undefined } : element
          ),
        });
      },

      toggleLock: (id) => {
        const target = get().elements.find((element) => element.id === id);
        if (!target) return;
        set({
          elements: get().elements.map((element) =>
            element.id === id ? { ...element, locked: !element.locked } : element
          ),
          selectedIds: target.locked
            ? get().selectedIds
            : get().selectedIds.filter((selectedId) => selectedId !== id),
        });
      },

      bringSelectionToFront: () => {
        const { selectedIds, elements } = get();
        if (selectedIds.length === 0) return;
        get().historyPush();
        const selected = elements
          .filter((element) => selectedIds.includes(element.id))
          .sort((a, b) => a.zIndex - b.zIndex);
        const unselected = elements.filter((element) => !selectedIds.includes(element.id));
        let nextZ = unselected.reduce((max, element) => Math.max(max, element.zIndex), 0);

        set({
          elements: elements.map((element) => {
            const index = selected.findIndex((candidate) => candidate.id === element.id);
            if (index === -1) return element;
            nextZ += 1;
            return { ...element, zIndex: nextZ };
          }),
        });
      },

      sendSelectionToBack: () => {
        const { selectedIds, elements } = get();
        if (selectedIds.length === 0) return;
        get().historyPush();
        const selected = elements
          .filter((element) => selectedIds.includes(element.id))
          .sort((a, b) => a.zIndex - b.zIndex);
        const unselected = elements
          .filter((element) => !selectedIds.includes(element.id))
          .sort((a, b) => a.zIndex - b.zIndex);
        const ordered = [...selected, ...unselected];

        set({
          elements: elements.map((element) => {
            const index = ordered.findIndex((candidate) => candidate.id === element.id);
            return index === -1 ? element : { ...element, zIndex: index + 1 };
          }),
        });
      },

      copySelected: async () => {
        const { elements, selectedIds } = get();
        const clipboard = elements.filter((element) => selectedIds.includes(element.id));
        set({ clipboard });
        if (clipboard.length === 0 || !navigator?.clipboard?.writeText) return;
        try {
          await navigator.clipboard.writeText(serializeElementsForClipboard(clipboard));
        } catch {
          // Ignore clipboard permission failures.
        }
      },

      paste: (source, anchor) => {
        const { clipboard, elements } = get();
        const sourceElements = source && source.length > 0 ? source : clipboard;
        if (sourceElements.length === 0) return;
        get().historyPush();
        const maxZIndex = elements.reduce((max, current) => Math.max(max, current.zIndex), 0);
        const pasted = cloneElementsForPaste(sourceElements, maxZIndex, anchor ? { anchor } : undefined);

        set((state) => ({
          elements: [...state.elements, ...pasted],
          selectedIds: pasted.map((element) => element.id),
          clipboard: pasted,
        }));
      },

      setActiveTool: (tool) => set({ activeTool: tool, selectedIds: [] }),

      setViewState: (viewState) =>
        set((state) => ({
          viewState: { ...state.viewState, ...viewState },
        })),

      addPage: (parentId) => {
        const newPage: DocPage = {
          id: uuidv4(),
          title: 'Untitled',
          icon: 'article',
          content: '<h1>Untitled</h1><p>Start writing here...</p>',
        };

        set((state) => {
          if (parentId) {
            return {
              pages: state.pages.map((page) =>
                page.id === parentId
                  ? { ...page, children: [...(page.children ?? []), newPage] }
                  : page
              ),
              activePageId: newPage.id,
            };
          }

          return {
            pages: [...state.pages, newPage],
            activePageId: newPage.id,
          };
        });
      },

      updatePage: (id, updates) =>
        set((state) => ({
          pages: updatePageTree(state.pages, id, updates),
        })),

      deletePage: (id) =>
        set((state) => {
          const pages = deletePageTree(state.pages, id);
          return {
            pages,
            activePageId:
              state.activePageId === id
                ? findFirstPageId(pages)
                : state.activePageId,
          };
        }),

      setActivePageId: (id) => set({ activePageId: id }),
      setDocumentTitle: (documentTitle) => set({ documentTitle: normalizeLegacyTitle(documentTitle) }),
      saveCurrentBoard: (name) => {
        const state = get();
        const id = state.activeBoardId ?? uuidv4();
        const boardName = name?.trim() || state.documentTitle.trim() || 'Untitled Board';
        const nextBoard: SavedBoard = {
          id,
          name: boardName,
          updatedAt: new Date().toISOString(),
          snapshot: { ...createBoardSnapshot(state), documentTitle: boardName },
        };

        set((current) => ({
          savedBoards: [
            nextBoard,
            ...current.savedBoards.filter((board) => board.id !== id),
          ].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
          activeBoardId: id,
          documentTitle: boardName,
        }));

        return id;
      },
      saveBoardAs: (name) => {
        const state = get();
        const id = uuidv4();
        const boardName = name.trim() || state.documentTitle.trim() || 'Untitled Board';
        const nextBoard: SavedBoard = {
          id,
          name: boardName,
          updatedAt: new Date().toISOString(),
          snapshot: { ...createBoardSnapshot(state), documentTitle: boardName },
        };

        set((current) => ({
          savedBoards: [nextBoard, ...current.savedBoards].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
          activeBoardId: id,
          documentTitle: boardName,
        }));

        return id;
      },
      loadBoard: (id) => {
        const board = get().savedBoards.find((candidate) => candidate.id === id);
        if (!board) return;

        const snapshot = cloneData(board.snapshot);
        const pages = normalizePages(snapshot.pages);
        set({
          elements: snapshot.elements,
          pages,
          activePageId: snapshot.activePageId ?? findFirstPageId(pages),
          documentTitle: snapshot.documentTitle,
          activeBoardId: board.id,
          theme: snapshot.theme,
          layoutMode: snapshot.layoutMode,
          splitRatio: snapshot.splitRatio,
          panelMode: snapshot.panelMode,
          docsNavigatorCollapsed: snapshot.docsNavigatorCollapsed,
          viewState: snapshot.viewState,
          selectedIds: [],
          activeTool: 'select',
          undoPast: [],
          undoFuture: [],
          clipboard: [],
        });
      },
      deleteBoard: (id) =>
        set((state) => ({
          savedBoards: state.savedBoards.filter((board) => board.id !== id),
          activeBoardId: state.activeBoardId === id ? null : state.activeBoardId,
        })),
      createBoard: (title) => {
        const blank = makeBlankBoard(title?.trim() || 'Untitled Board');
        set({
          elements: blank.elements,
          pages: blank.pages,
          activePageId: blank.activePageId,
          documentTitle: blank.documentTitle,
          activeBoardId: null,
          theme: blank.theme,
          layoutMode: blank.layoutMode,
          splitRatio: blank.splitRatio,
          panelMode: blank.panelMode,
          docsNavigatorCollapsed: blank.docsNavigatorCollapsed,
          selectedIds: [],
          activeTool: 'select',
          viewState: blank.viewState,
          undoPast: [],
          undoFuture: [],
          clipboard: [],
        });
      },

      importBoard: (rawData) => {
        const data = rawData as Record<string, unknown>;
        if (!data || typeof data !== 'object') throw new Error('Invalid file');
        const elements = Array.isArray(data.elements) ? (data.elements as WhiteboardElement[]) : [];
        const rawPages = Array.isArray(data.pages) ? (data.pages as DocPage[]) : makeInitialPages();
        const pages = normalizePages(rawPages);
        const title = typeof data.documentTitle === 'string' ? data.documentTitle.trim() : '';
        const boardName = title || 'Imported Board';
        const activePageId = typeof data.activePageId === 'string' ? data.activePageId : findFirstPageId(pages);
        const id = uuidv4();
        const snapshot: BoardSnapshot = {
          elements,
          pages,
          activePageId,
          documentTitle: boardName,
          theme: (data.theme as 'light' | 'dark') ?? 'light',
          layoutMode: (data.layoutMode as 'horizontal' | 'vertical') ?? 'horizontal',
          splitRatio: typeof data.splitRatio === 'number' ? data.splitRatio : 0.28,
          panelMode: (data.panelMode as 'split' | 'docs-only' | 'whiteboard-only') ?? 'split',
          docsNavigatorCollapsed: Boolean(data.docsNavigatorCollapsed),
          viewState: makeInitialViewState(),
        };
        const newBoard: SavedBoard = { id, name: boardName, updatedAt: new Date().toISOString(), snapshot };
        set((current) => ({
          elements: snapshot.elements,
          pages: snapshot.pages,
          activePageId: snapshot.activePageId,
          documentTitle: boardName,
          activeBoardId: id,
          theme: snapshot.theme,
          layoutMode: snapshot.layoutMode,
          splitRatio: snapshot.splitRatio,
          panelMode: snapshot.panelMode,
          docsNavigatorCollapsed: snapshot.docsNavigatorCollapsed,
          viewState: snapshot.viewState,
          savedBoards: [newBoard, ...current.savedBoards].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
          selectedIds: [],
          activeTool: 'select',
          undoPast: [],
          undoFuture: [],
          clipboard: [],
        }));
      },

      importAllBoards: (rawData) => {
        const data = rawData as Record<string, unknown>;
        if (!data || !Array.isArray(data.boards)) throw new Error('Invalid backup file');
        const imported = normalizeSavedBoards(data.boards as SavedBoard[]);
        set((current) => ({
          savedBoards: [
            ...imported.filter((b) => !current.savedBoards.some((e) => e.id === b.id)),
            ...current.savedBoards,
          ].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
        }));
      },

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      setSplitRatio: (splitRatio) => set({ splitRatio }),
      setPanelMode: (panelMode) => set({ panelMode }),
      setDocsNavigatorCollapsed: (docsNavigatorCollapsed) => set({ docsNavigatorCollapsed }),
      toggleDocsNavigatorCollapsed: () =>
        set((state) => ({ docsNavigatorCollapsed: !state.docsNavigatorCollapsed })),
      setDocsEditorChromeCollapsed: (docsEditorChromeCollapsed) => set({ docsEditorChromeCollapsed }),
      toggleDocsEditorChromeCollapsed: () =>
        set((state) => ({ docsEditorChromeCollapsed: !state.docsEditorChromeCollapsed })),
      setActiveSurface: (activeSurface) => set({ activeSurface }),
      updateToolDefaults: (tool, patch) =>
        set((state) => ({
          toolDefaults: {
            ...state.toolDefaults,
            [tool]: {
              ...state.toolDefaults[tool],
              ...patch,
            },
          },
        })),
    }),
    {
      name: APP_STORAGE_KEY,
      storage: createJSONStorage(() => fallbackStorage),
      version: 7,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppStore> | undefined;
        const pages = state?.pages ? normalizePages(state.pages) : makeInitialPages();
        return {
          elements: state?.elements ?? [],
          pages,
          activePageId: state?.activePageId ?? pages[0]?.id ?? null,
          documentTitle: normalizeLegacyTitle(state?.documentTitle),
          savedBoards: normalizeSavedBoards(state?.savedBoards),
          activeBoardId: state?.activeBoardId ?? null,
          theme: state?.theme ?? 'light',
          layoutMode: state?.layoutMode ?? 'horizontal',
          splitRatio: state?.splitRatio ?? 0.28,
          panelMode: state?.panelMode ?? 'split',
          docsNavigatorCollapsed: state?.docsNavigatorCollapsed ?? false,
          docsEditorChromeCollapsed: state?.docsEditorChromeCollapsed ?? false,
          toolDefaults: state?.toolDefaults ?? makeInitialToolDefaults(),
          viewState: state?.viewState ?? makeInitialViewState(),
        };
      },
      partialize: (state) => ({
        elements: state.elements,
        pages: state.pages,
        activePageId: state.activePageId,
        documentTitle: state.documentTitle,
        savedBoards: state.savedBoards,
        activeBoardId: state.activeBoardId,
        theme: state.theme,
        layoutMode: state.layoutMode,
        splitRatio: state.splitRatio,
        panelMode: state.panelMode,
        docsNavigatorCollapsed: state.docsNavigatorCollapsed,
        docsEditorChromeCollapsed: state.docsEditorChromeCollapsed,
        toolDefaults: state.toolDefaults,
        viewState: state.viewState,
      }),
    }
  )
);
