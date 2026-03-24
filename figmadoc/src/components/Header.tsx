import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Tool } from '../types';
import { Icon } from './Icon';
import { AuthModal } from './AuthModal';

const PLATFORM_NAME = 'Synth';
const BOARD_EXPORT_FORMAT = 'synth-board';
const BACKUP_EXPORT_FORMAT = 'synth-backup';
const LEGACY_BACKUP_EXPORT_FORMATS = ['superexcalidraw-backup'];

const isBackupExportFormat = (value: unknown) =>
  typeof value === 'string' && (value === BACKUP_EXPORT_FORMAT || LEGACY_BACKUP_EXPORT_FORMATS.includes(value));

const buildBrowserTitle = (title: string) => {
  const normalized = title.trim();
  if (!normalized || normalized === PLATFORM_NAME) {
    return PLATFORM_NAME;
  }
  return `${normalized} | ${PLATFORM_NAME}`;
};

const TOOL_GROUPS: Array<Array<{ tool: Tool; icon: string; label: string }>> = [
  [
    { tool: 'select', icon: 'north_west', label: 'Select (V)' },
    { tool: 'hand', icon: 'pan_tool', label: 'Hand / Pan (H)' },
  ],
  [
    { tool: 'rectangle', icon: 'crop_square', label: 'Rectangle (R)' },
    { tool: 'circle', icon: 'radio_button_unchecked', label: 'Circle (O)' },
    { tool: 'diamond', icon: 'diamond', label: 'Diamond (D)' },
  ],
  [
    { tool: 'arrow', icon: 'arrow_right_alt', label: 'Arrow (A)' },
  ],
  [
    { tool: 'text', icon: 'text_fields', label: 'Text (T)' },
    { tool: 'sticky', icon: 'sticky_note_2', label: 'Sticky Note (S)' },
    { tool: 'code', icon: 'code', label: 'Code Block (C)' },
    { tool: 'image', icon: 'image', label: 'Image (I)' },
  ],
  [
    { tool: 'pen', icon: 'edit', label: 'Pen (P)' },
    { tool: 'eraser', icon: 'backspace', label: 'Eraser (E)' },
  ],
  [
    { tool: 'chart', icon: 'bar_chart', label: 'Chart From Table' },
    { tool: 'table', icon: 'table_chart', label: 'Data Table' },
  ],
];

export function Header() {
  const {
    activeTool,
    setActiveTool,
    theme,
    toggleTheme,
    documentTitle,
    setDocumentTitle,
    layoutMode,
    setLayoutMode,
    panelMode,
    setPanelMode,
    persistenceMode,
    setPersistenceMode,
    undo,
    redo,
    undoPast,
    undoFuture,
    savedBoards,
    activeBoardId,
    getCurrentBoardRecord,
    markBoardCloudSynced,
    saveCurrentBoard,
    saveBoardAs,
    loadBoard,
    deleteBoard,
    createBoard,
  } = useStore();

  const { status: authStatus, pushBoardToCloud } = useAuthStore();

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(documentTitle);
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState(documentTitle);

  useEffect(() => {
    setTitleDraft(documentTitle);
    setBoardNameDraft(documentTitle);
    document.title = buildBrowserTitle(documentTitle);
  }, [documentTitle]);

  const commitTitle = () => {
    setTitleEditing(false);
    const nextTitle = titleDraft.trim() || PLATFORM_NAME;
    setDocumentTitle(nextTitle);
  };

  const handlePrimarySave = async () => {
    if (persistenceMode === 'local') {
      saveCurrentBoard();
      return;
    }

    if (authStatus !== 'authenticated') {
      setAuthOpen(true);
      return;
    }

    try {
      const board = getCurrentBoardRecord();
      const cloudId = await pushBoardToCloud(board);
      markBoardCloudSynced(board.id, cloudId);
    } catch {
      setBoardsOpen(true);
    }
  };

  const handleCreateBoard = () => {
    createBoard();
    if (boardsOpen) {
      setBoardsOpen(false);
    }
  };

  return (
    <header
      style={{
        height: 'calc(58px + var(--safe-area-top))',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 96%, white), color-mix(in srgb, var(--glass-bg) 76%, transparent))',
        borderBottom: '1px solid var(--glass-border)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--safe-area-top) calc(var(--safe-area-right) + 10px) 0 calc(var(--safe-area-left) + 10px)',
        gap: 8,
        flexShrink: 0,
        zIndex: 100,
        boxShadow: '0 14px 40px rgba(15, 23, 42, 0.08)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', marginRight: 6 }}>
        <img
          src="/logo.png"
          alt={`${PLATFORM_NAME} logo`}
          style={{
            width: 32,
            height: 32,
            borderRadius: 11,
            objectFit: 'cover',
            flexShrink: 0,
            boxShadow: '0 12px 28px rgba(76, 90, 124, 0.18)',
          }}
        />

        {titleEditing ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTitle();
              if (event.key === 'Escape') {
                setTitleDraft(documentTitle);
                setTitleEditing(false);
              }
            }}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-primary)',
              width: 160,
            }}
          />
        ) : (
          <span
            onDoubleClick={() => {
              setTitleEditing(true);
              setTitleDraft(documentTitle);
            }}
            style={{
              fontSize: 14,
              fontWeight: 700,
              cursor: 'text',
              userSelect: 'none',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.02em',
            }}
            title="Double-click to rename"
          >
            {documentTitle}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flex: 1,
          justifyContent: 'center',
          flexWrap: 'nowrap',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {TOOL_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {groupIndex > 0 && <Divider />}
            {group.map(({ tool, icon, label }) => (
              <ToolBtn
                key={tool}
                icon={icon}
                active={activeTool === tool}
                title={label}
                onClick={() => setActiveTool(tool)}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
        <IconBtn
          icon="undo"
          title="Undo (Ctrl+Z)"
          onClick={undo}
          disabled={undoPast.length === 0}
        />
        <IconBtn
          icon="redo"
          title="Redo (Ctrl+Shift+Z)"
          onClick={redo}
          disabled={undoFuture.length === 0}
        />

        <Divider />

        <IconBtn
          icon="description"
          title="Document only"
          active={panelMode === 'docs-only'}
          onClick={() => setPanelMode('docs-only')}
        />
        <IconBtn
          icon="splitscreen"
          title="Split view"
          active={panelMode === 'split'}
          onClick={() => setPanelMode('split')}
        />
        <IconBtn
          icon="space_dashboard"
          title="Whiteboard only"
          active={panelMode === 'whiteboard-only'}
          onClick={() => setPanelMode('whiteboard-only')}
        />

        <Divider />

        <IconBtn
          icon={layoutMode === 'horizontal' ? 'view_agenda' : 'view_week'}
          title={layoutMode === 'horizontal' ? 'Vertical split' : 'Horizontal split'}
          onClick={() => setLayoutMode(layoutMode === 'horizontal' ? 'vertical' : 'horizontal')}
          disabled={panelMode !== 'split'}
        />

        <IconBtn
          icon={theme === 'light' ? 'dark_mode' : 'light_mode'}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          onClick={toggleTheme}
        />

        <Divider />

        <ActionBtn
          icon="save"
          onClick={handlePrimarySave}
        >
          {persistenceMode === 'cloud' ? 'Salvar Nuvem' : 'Save'}
        </ActionBtn>

        <ActionBtn
          icon="folder_open"
          onClick={() => setBoardsOpen(true)}
        >
          Boards
        </ActionBtn>

        <ActionBtn
          icon="add_box"
          onClick={handleCreateBoard}
        >
          {persistenceMode === 'cloud' ? 'Nova Nuvem' : 'New'}
        </ActionBtn>

        <Divider />

        <ActionBtn
          icon={authStatus === 'authenticated' ? 'cloud_done' : 'cloud_off'}
          onClick={() => setAuthOpen(true)}
        >
          {authStatus === 'authenticated' ? 'Nuvem' : 'Entrar'}
        </ActionBtn>

      </div>

      {boardsOpen && (
        <BoardManager
          activeBoardId={activeBoardId}
          boardNameDraft={boardNameDraft}
          documentTitle={documentTitle}
          persistenceMode={persistenceMode}
          savedBoards={savedBoards}
          onPersistenceModeChange={setPersistenceMode}
          onBoardNameDraftChange={setBoardNameDraft}
          onClose={() => setBoardsOpen(false)}
          onCreateBoard={handleCreateBoard}
          onDeleteBoard={deleteBoard}
          onLoadBoard={(id) => { loadBoard(id); setBoardsOpen(false); }}
          onSaveAs={() => saveBoardAs(boardNameDraft)}
          onSaveCurrent={() => saveCurrentBoard(boardNameDraft)}
          importBoard={useStore.getState().importBoard}
          importAllBoards={useStore.getState().importAllBoards}
        />
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </header>
  );
}

function useStorageUsage() {
  const [usage, setUsage] = useState(() => calcUsage());

  useEffect(() => {
    setUsage(calcUsage());
    const id = setInterval(() => setUsage(calcUsage()), 3000);
    return () => clearInterval(id);
  }, []);

  return usage;
}

function calcUsage() {
  const LIMIT = 5 * 1024 * 1024; // 5 MB (typical browser limit)
  let usedChars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) ?? '';
    usedChars += k.length + (localStorage.getItem(k) ?? '').length;
  }
  const usedBytes = usedChars * 2; // UTF-16: ~2 bytes per char
  return { usedBytes, limitBytes: LIMIT, percent: Math.min((usedBytes / LIMIT) * 100, 100) };
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function StorageBar() {
  const { usedBytes, limitBytes, percent } = useStorageUsage();
  const color = percent < 60 ? '#22c55e' : percent < 85 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Storage
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>
          {fmt(usedBytes)} / {fmt(limitBytes)} · <span style={{ color, fontWeight: 700 }}>{percent.toFixed(1)}%</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 99,
            background: color,
            transition: 'width 0.4s ease, background 0.4s ease',
          }}
        />
      </div>
      {percent >= 85 && (
        <div style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="warning" size={13} />
          Espaço crítico — exporte e limpe boards não utilizados.
        </div>
      )}
    </div>
  );
}

function BoardManager({
  activeBoardId,
  boardNameDraft,
  documentTitle,
  persistenceMode,
  savedBoards,
  onPersistenceModeChange,
  onBoardNameDraftChange,
  onClose,
  onCreateBoard,
  onDeleteBoard,
  onLoadBoard,
  onSaveAs,
  onSaveCurrent,
  importBoard,
  importAllBoards,
}: {
  activeBoardId: string | null;
  boardNameDraft: string;
  documentTitle: string;
  persistenceMode: 'local' | 'cloud';
  savedBoards: Array<{ id: string; name: string; updatedAt: string; cloudId?: string; cloudSyncedAt?: string }>;
  onPersistenceModeChange: (mode: 'local' | 'cloud') => void;
  onBoardNameDraftChange: (value: string) => void;
  onClose: () => void;
  onCreateBoard: () => void;
  onDeleteBoard: (id: string) => void;
  onLoadBoard: (id: string) => void;
  onSaveAs: () => void;
  onSaveCurrent: () => void;
  importBoard: (data: unknown) => void;
  importAllBoards: (data: unknown) => void;
}) {
  const importSingleRef = useRef<HTMLInputElement>(null);
  const importAllRef = useRef<HTMLInputElement>(null);
  const [cloudActionLoading, setCloudActionLoading] = useState<string | null>(null);
  const activeTab = persistenceMode;

  const {
    status: authStatus,
    cloudBoards,
    cloudBoardsLoading,
    cloudError,
    fetchCloudBoards,
    pushBoardToCloud,
    pullBoardFromCloud,
    deleteCloudBoard,
    renameCloudBoard,
    clearCloudError,
    autoSaveEnabled,
    autoSaveIntervalSeconds,
    lastAutoSave,
    autoSaving,
    toggleAutoSave,
    setAutoSaveInterval,
  } = useAuthStore();

  const {
    markBoardCloudSynced,
    loadBoardFromSnapshot,
    activeBoardId: currentBoardId,
    getCurrentBoardRecord,
  } = useStore();
  const importCloudRef = useRef<HTMLInputElement>(null);
  const [renamingCloudId, setRenamingCloudId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Carrega boards da nuvem ao abrir a aba
  useEffect(() => {
    if (activeTab === 'cloud' && authStatus === 'authenticated') {
      fetchCloudBoards();
    }
  }, [activeTab, authStatus, fetchCloudBoards]);

  const handlePushToCloud = async () => {
    const board = getCurrentBoardRecord();
    const actionKey = currentBoardId ? `push-${currentBoardId}` : 'push-current';
    setCloudActionLoading(actionKey);
    try {
      const cloudId = await pushBoardToCloud(board);
      markBoardCloudSynced(board.id, cloudId);
    } catch {
      // error shown via cloudError state
    } finally {
      setCloudActionLoading(null);
    }
  };

  const handlePullFromCloud = async (cloudId: string, cloudName: string, localId: string) => {
    setCloudActionLoading(`pull-${cloudId}`);
    try {
      const { snapshot, name, localId: remoteLocalId } = await pullBoardFromCloud(cloudId);
      loadBoardFromSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        snapshot as any,
        { id: remoteLocalId || localId, name: name || cloudName, cloudId, saveLocally: false }
      );
      onClose();
    } catch {
      // error shown via cloudError state
    } finally {
      setCloudActionLoading(null);
    }
  };

  const handleDeleteCloud = async (cloudId: string) => {
    setCloudActionLoading(`del-${cloudId}`);
    try {
      await deleteCloudBoard(cloudId);
    } catch {
      // error shown via cloudError state
    } finally {
      setCloudActionLoading(null);
    }
  };

  const handleRenameCloud = async (cloudId: string) => {
    const name = renameDraft.trim();
    if (!name) { setRenamingCloudId(null); return; }
    setCloudActionLoading(`rename-${cloudId}`);
    try {
      await renameCloudBoard(cloudId, name);
    } catch {
      // error shown via cloudError state
    } finally {
      setCloudActionLoading(null);
      setRenamingCloudId(null);
    }
  };

  const handleExportCloud = async (cloudId: string, cloudName: string) => {
    setCloudActionLoading(`export-${cloudId}`);
    try {
      const { snapshot, name } = await pullBoardFromCloud(cloudId);
      const payload = { format: BOARD_EXPORT_FORMAT, version: 1, ...snapshot, documentTitle: name, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(name || cloudName).replace(/[^a-z0-9_\-. ]/gi, '_')}.board.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      // error shown via cloudError state
    } finally {
      setCloudActionLoading(null);
    }
  };

  const handleImportToCloud = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as Record<string, unknown>;
        const boards = isBackupExportFormat(data.format) && Array.isArray(data.boards)
          ? (data.boards as Array<{ id: string; name: string; updatedAt: string; snapshot: Record<string, unknown> }>)
          : [{ id: crypto.randomUUID(), name: String(data.documentTitle ?? 'Imported'), updatedAt: new Date().toISOString(), snapshot: data }];
        for (const b of boards) {
          await pushBoardToCloud({ id: b.id, name: b.name, updatedAt: b.updatedAt, snapshot: b.snapshot });
        }
      } catch {
        // error shown via cloudError state
      }
    };
    reader.readAsText(file);
  };

  const handleFile = (file: File, mode: 'single' | 'all') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (mode === 'all' || isBackupExportFormat(data.format)) {
          importAllBoards(data);
        } else {
          importBoard(data);
        }
        onClose();
      } catch {
        alert('Arquivo inválido. Selecione um arquivo .json exportado por esta aplicação.');
      }
    };
    reader.readAsText(file);
  };

  const exportCurrent = () => {
    const state = useStore.getState();
    const payload = {
      format: BOARD_EXPORT_FORMAT,
      version: 1,
      documentTitle: state.documentTitle,
      elements: state.elements,
      pages: state.pages,
      activePageId: state.activePageId,
      theme: state.theme,
      layoutMode: state.layoutMode,
      splitRatio: state.splitRatio,
      panelMode: state.panelMode,
      docsNavigatorCollapsed: state.docsNavigatorCollapsed,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeName = (state.documentTitle || 'board').replace(/[^a-z0-9_\-. ]/gi, '_');
    link.download = `${safeName}.board.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportAll = () => {
    const { savedBoards: boards } = useStore.getState();
    const payload = {
      format: BACKUP_EXPORT_FORMAT,
      version: 1,
      boards,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `synth-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 1200 }}
        onClick={onClose}
      />

      {/* Hidden file inputs */}
      <input ref={importSingleRef} type="file" accept=".json" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, 'single'); e.target.value = ''; }}
      />
      <input ref={importAllRef} type="file" accept=".json" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, 'all'); e.target.value = ''; }}
      />

      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--safe-area-top) + 76px)',
          right: 'calc(var(--safe-area-right) + 16px)',
          width: 'min(440px, calc(100vw - var(--safe-area-left) - var(--safe-area-right) - 32px))',
          maxHeight: 'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom) - 92px)',
          overflow: 'hidden',
          borderRadius: 18,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1201,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Whiteboards
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{documentTitle}</div>
          </div>
          <IconBtn icon="close" title="Close" onClick={onClose} />
        </div>

        {/* Tabs: Local / Cloud */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          {(['local', 'cloud'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { onPersistenceModeChange(tab); if (cloudError) clearCloudError(); }}
              style={{
                flex: 1,
                height: 40,
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.12s',
              }}
            >
              <Icon name={tab === 'local' ? 'hard_drive' : authStatus === 'authenticated' ? 'cloud_done' : 'cloud_off'} size={16} />
              {tab === 'local' ? 'Local' : 'Nuvem'}
            </button>
          ))}
        </div>

        {/* ── LOCAL TAB ── */}
        {activeTab === 'local' && (
          <>
            {/* Storage bar */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <StorageBar />
            </div>

            {/* Actions */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'grid', gap: 10, flexShrink: 0 }}>
              <input
                value={boardNameDraft}
                onChange={(event) => onBoardNameDraftChange(event.target.value)}
                placeholder="Board name"
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  padding: '0 12px',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ActionBtn icon="save" onClick={onSaveCurrent}>Save</ActionBtn>
                <ActionBtn icon="library_add" onClick={onSaveAs}>Save As</ActionBtn>
                <ActionBtn icon="add_box" onClick={onCreateBoard}>New Board</ActionBtn>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ActionBtn icon="download" onClick={exportCurrent}>Export</ActionBtn>
                <ActionBtn icon="upload" onClick={() => importSingleRef.current?.click()}>Import</ActionBtn>
                <ActionBtn icon="backup" onClick={exportAll}>Export All</ActionBtn>
                <ActionBtn icon="cloud_download" onClick={() => importAllRef.current?.click()}>Import All</ActionBtn>
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
              {savedBoards.length === 0 ? (
                <div style={{ padding: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Nenhuma board salva ainda. Use "Save" para manter diferentes whiteboards no navegador.
                </div>
              ) : (
                savedBoards.map((board) => (
                  <div
                    key={board.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 14,
                      padding: 12,
                      display: 'grid',
                      gap: 8,
                      background: board.id === activeBoardId ? 'var(--bg-tertiary)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {board.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(board.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                      {board.id === activeBoardId && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                          Atual
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <ActionBtn icon="folder_open" onClick={() => onLoadBoard(board.id)}>Open</ActionBtn>
                      <ActionBtn icon="delete" onClick={() => onDeleteBoard(board.id)}>Delete</ActionBtn>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── CLOUD TAB ── */}
        {activeTab === 'cloud' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Hidden import-to-cloud input */}
            <input ref={importCloudRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportToCloud(f); e.target.value = ''; }}
            />

            {authStatus !== 'authenticated' ? (
              <div style={{ padding: 24, textAlign: 'center', display: 'grid', gap: 12 }}>
                <Icon name="cloud_off" size={48} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Faça login para acessar a nuvem</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Salve suas boards na nuvem e acesse de qualquer dispositivo.
                </div>
              </div>
            ) : (
              <>
                {/* Autosave bar */}
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={toggleAutoSave}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
                      border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: autoSaveEnabled ? 'var(--primary)' : 'var(--bg-tertiary)',
                      color: autoSaveEnabled ? 'var(--primary-contrast)' : 'var(--text-primary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon name={autoSaving ? 'sync' : autoSaveEnabled ? 'cloud_done' : 'cloud_off'} size={14} className={autoSaving ? 'spin' : undefined} />
                    Autosave {autoSaveEnabled ? 'ON' : 'OFF'}
                  </button>

                  {autoSaveEnabled && (
                    <select
                      value={autoSaveIntervalSeconds}
                      onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
                      style={{ height: 28, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 11, padding: '0 6px', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value={30}>30s</option>
                      <option value={60}>1 min</option>
                      <option value={120}>2 min</option>
                      <option value={300}>5 min</option>
                    </select>
                  )}

                  {lastAutoSave && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      Salvo {new Date(lastAutoSave).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {/* Cloud actions */}
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  <ActionBtn icon="refresh" onClick={fetchCloudBoards}>Atualizar</ActionBtn>
                  <ActionBtn
                    icon={cloudActionLoading === (currentBoardId ? `push-${currentBoardId}` : 'push-current') ? 'sync' : 'cloud_upload'}
                    onClick={handlePushToCloud}
                  >
                    Salvar na nuvem
                  </ActionBtn>
                  <ActionBtn icon="upload" onClick={() => importCloudRef.current?.click()}>Import → Nuvem</ActionBtn>
                </div>

                {/* Cloud error */}
                {cloudError && (
                  <div style={{ margin: '8px 18px', padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Icon name="error" size={14} />
                    {cloudError}
                    <button onClick={clearCloudError} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                )}

                {/* Cloud list */}
                <div style={{ overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                  {cloudBoardsLoading ? (
                    <div style={{ padding: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="sync" size={16} className="spin" /> Carregando...
                    </div>
                  ) : cloudBoards.length === 0 ? (
                    <div style={{ padding: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Nenhuma board na nuvem ainda. Use "Salvar na nuvem" para criar a primeira.
                    </div>
                  ) : (
                    cloudBoards.map((cb) => (
                      <div
                        key={cb.id}
                        style={{ border: '1px solid var(--border-color)', borderRadius: 14, padding: 12, display: 'grid', gap: 8 }}
                      >
                        {/* Name row — clicável para renomear */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          {renamingCloudId === cb.id ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameCloud(cb.id);
                                if (e.key === 'Escape') setRenamingCloudId(null);
                              }}
                              onBlur={() => handleRenameCloud(cb.id)}
                              style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 8px', fontSize: 13, outline: 'none' }}
                            />
                          ) : (
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                title="Clique duplo para renomear"
                                onDoubleClick={() => { setRenamingCloudId(cb.id); setRenameDraft(cb.name); }}
                                style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }}
                              >
                                {cb.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(cb.updated_at).toLocaleString()}</div>
                            </div>
                          )}
                          <Icon name="cloud" size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        </div>

                        {/* Actions row */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <ActionBtn
                            icon={cloudActionLoading === `pull-${cb.id}` ? 'sync' : 'folder_open'}
                            onClick={() => handlePullFromCloud(cb.id, cb.name, cb.local_id)}
                          >
                            Abrir
                          </ActionBtn>
                          <ActionBtn
                            icon={cloudActionLoading === `export-${cb.id}` ? 'sync' : 'download'}
                            onClick={() => handleExportCloud(cb.id, cb.name)}
                          >
                            Export
                          </ActionBtn>
                          <ActionBtn
                            icon={renamingCloudId === cb.id || cloudActionLoading === `rename-${cb.id}` ? 'sync' : 'edit'}
                            onClick={() => { setRenamingCloudId(cb.id); setRenameDraft(cb.name); }}
                          >
                            Rename
                          </ActionBtn>
                          <ActionBtn
                            icon={cloudActionLoading === `del-${cb.id}` ? 'sync' : 'delete'}
                            onClick={() => handleDeleteCloud(cb.id)}
                          >
                            Delete
                          </ActionBtn>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: 'var(--glass-border)',
        margin: '0 2px',
        flexShrink: 0,
      }}
    />
  );
}

function ToolBtn({
  icon,
  active,
  title,
  onClick,
}: {
  icon: string;
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        border: active ? '1px solid color-mix(in srgb, var(--primary) 68%, transparent)' : '1px solid var(--glass-border)',
        background: active ? 'var(--primary)' : hover ? 'color-mix(in srgb, var(--glass-bg) 82%, white)' : 'var(--glass-bg)',
        color: active ? 'var(--primary-contrast)' : 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.16s ease',
        flexShrink: 0,
        boxShadow: active ? '0 10px 24px rgba(15, 23, 42, 0.16)' : 'none',
      }}
    >
      <Icon name={icon} size={19} filled={active} weight={active ? 600 : 400} />
    </button>
  );
}

function IconBtn({
  icon,
  title,
  onClick,
  disabled,
  active,
}: {
  icon: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        borderRadius: 11,
        border: active ? '1px solid color-mix(in srgb, var(--primary) 68%, transparent)' : '1px solid var(--glass-border)',
        background: active ? 'var(--primary)' : hover && !disabled ? 'color-mix(in srgb, var(--glass-bg) 82%, white)' : 'var(--glass-bg)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: disabled ? 'var(--text-muted)' : active ? 'var(--primary-contrast)' : 'var(--text-primary)',
        opacity: disabled ? 0.35 : 1,
        transition: 'all 0.16s ease',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={19} filled={active} />
    </button>
  );
}

function ActionBtn({
  children,
  icon,
  onClick,
}: {
  children: string;
  icon: string;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid var(--glass-border)',
        background: hover ? 'color-mix(in srgb, var(--glass-bg) 84%, white)' : 'var(--glass-bg)',
        color: 'var(--text-primary)',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.16s ease',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name={icon} size={16} />
      {children}
    </button>
  );
}
