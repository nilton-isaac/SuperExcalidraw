import { useEffect, useCallback, useRef } from 'react';
import { useStore } from './store/useStore';
import { useAuthStore } from './store/useAuthStore';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Whiteboard } from './components/Whiteboard';
import './index.css';

export default function App() {
  const {
    theme,
    layoutMode,
    splitRatio,
    panelMode,
    persistenceMode,
    activeCloudBoardId,
    restorePersistenceMode,
    loadBoardFromSnapshot,
    setSplitRatio,
  } = useStore();
  const initialize = useAuthStore((s) => s.initialize);
  const {
    autoSaveEnabled,
    autoSaveIntervalSeconds,
    status: authStatus,
    runAutoSave,
    pullBoardFromCloud,
  } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    restorePersistenceMode();
  }, [restorePersistenceMode]);

  // Autosave para nuvem
  useEffect(() => {
    if (persistenceMode !== 'cloud' || !autoSaveEnabled || authStatus !== 'authenticated') return;
    const interval = setInterval(() => {
      const board = useStore.getState().getCurrentBoardRecord();
      runAutoSave(board);
    }, autoSaveIntervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [persistenceMode, autoSaveEnabled, autoSaveIntervalSeconds, authStatus, runAutoSave]);

  useEffect(() => {
    if (persistenceMode !== 'cloud' || authStatus !== 'authenticated' || !activeCloudBoardId) return;

    let cancelled = false;

    pullBoardFromCloud(activeCloudBoardId)
      .then(({ snapshot, name, localId }) => {
        if (cancelled) return;
        loadBoardFromSnapshot(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshot as any,
          { id: localId, name, cloudId: activeCloudBoardId, saveLocally: false }
        );
      })
      .catch(() => {
        // cloud error handled in auth store
      });

    return () => {
      cancelled = true;
    };
  }, [persistenceMode, authStatus, activeCloudBoardId, pullBoardFromCloud, loadBoardFromSnapshot]);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const isH = layoutMode === 'horizontal';
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let ratio: number;
      if (isH) {
        ratio = (ev.clientX - rect.left) / rect.width;
      } else {
        ratio = (ev.clientY - rect.top) / rect.height;
      }
      setSplitRatio(Math.max(0.15, Math.min(0.65, ratio)));
    };

    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isH, setSplitRatio]);

  const sidebarSize = `${(splitRatio * 100).toFixed(1)}%`;
  const whiteboardSize = `${((1 - splitRatio) * 100).toFixed(1)}%`;
  const showSplitHandle = panelMode === 'split';
  const hiddenPanelStyle = {
    flex: '0 1 0',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    pointerEvents: 'none' as const,
    opacity: 0,
    visibility: 'hidden' as const,
    [isH ? 'width' : 'height']: 0,
  };

  const docsPanelStyle = panelMode === 'split'
    ? {
        [isH ? 'width' : 'height']: sidebarSize,
        flexShrink: 0,
        minWidth: 0,
        minHeight: 0,
      }
    : panelMode === 'docs-only'
      ? {
          flex: 1,
          minWidth: 0,
          minHeight: 0,
        }
      : hiddenPanelStyle;

  const whiteboardPanelStyle = panelMode === 'split'
    ? {
        [isH ? 'width' : 'height']: whiteboardSize,
        flex: 1,
        minWidth: 0,
        minHeight: 0,
      }
    : panelMode === 'whiteboard-only'
      ? {
          flex: 1,
          minWidth: 0,
          minHeight: 0,
        }
      : hiddenPanelStyle;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
      }}
    >
      <Header />

      {/* Main split */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isH ? 'row' : 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div
          style={{
            ...docsPanelStyle,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Sidebar />
        </div>

        {showSplitHandle && (
          <div
            onMouseDown={onSplitMouseDown}
            title="Drag to resize"
            style={{
              [isH ? 'width' : 'height']: 4,
              [isH ? 'height' : 'width']: '100%',
              flexShrink: 0,
              background: 'color-mix(in srgb, var(--glass-border) 80%, transparent)',
              cursor: isH ? 'col-resize' : 'row-resize',
              transition: 'background 0.15s ease',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--border-color)';
            }}
          />
        )}

        <div
          style={{
            ...whiteboardPanelStyle,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <Whiteboard />
        </div>
      </div>
    </div>
  );
}
