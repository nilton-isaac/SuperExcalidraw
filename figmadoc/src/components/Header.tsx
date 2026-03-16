import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import type { Tool } from '../types';
import { Icon } from './Icon';

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
    undo,
    redo,
    undoPast,
    undoFuture,
    savedBoards,
    activeBoardId,
    saveCurrentBoard,
    saveBoardAs,
    loadBoard,
    deleteBoard,
    createBoard,
  } = useStore();

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(documentTitle);
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState(documentTitle);

  useEffect(() => {
    setTitleDraft(documentTitle);
    setBoardNameDraft(documentTitle);
    document.title = documentTitle;
  }, [documentTitle]);

  const commitTitle = () => {
    setTitleEditing(false);
    const nextTitle = titleDraft.trim() || 'Code Canvas';
    setDocumentTitle(nextTitle);
  };

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 10,
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', marginRight: 6 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: '1px solid var(--border-strong)',
            background: 'var(--primary)',
            color: 'var(--primary-contrast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="description" size={18} filled />
        </div>

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
              fontSize: 14,
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
          icon={layoutMode === 'horizontal' ? 'view_agenda' : 'view_week'}
          title={layoutMode === 'horizontal' ? 'Vertical split' : 'Horizontal split'}
          onClick={() => setLayoutMode(layoutMode === 'horizontal' ? 'vertical' : 'horizontal')}
        />

        <IconBtn
          icon={theme === 'light' ? 'dark_mode' : 'light_mode'}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          onClick={toggleTheme}
        />

        <Divider />

        <ActionBtn
          icon="save"
          onClick={() => saveCurrentBoard()}
        >
          Save
        </ActionBtn>

        <ActionBtn
          icon="folder_open"
          onClick={() => setBoardsOpen(true)}
        >
          Boards
        </ActionBtn>

        <ActionBtn
          icon="add_box"
          onClick={() => createBoard()}
        >
          New
        </ActionBtn>

        <ActionBtn
          icon="download"
          onClick={() => {
            const { documentTitle: exportedTitle, elements, pages } = useStore.getState();
            const blob = new Blob(
              [JSON.stringify({ documentTitle: exportedTitle, elements, pages, exportedAt: new Date().toISOString() }, null, 2)],
              { type: 'application/json' }
            );
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'code-canvas-export.json';
            link.click();
            URL.revokeObjectURL(link.href);
          }}
        >
          Export
        </ActionBtn>
      </div>

      {boardsOpen && (
        <BoardManager
          activeBoardId={activeBoardId}
          boardNameDraft={boardNameDraft}
          documentTitle={documentTitle}
          savedBoards={savedBoards}
          onBoardNameDraftChange={setBoardNameDraft}
          onClose={() => setBoardsOpen(false)}
          onCreateBoard={() => {
            createBoard();
            setBoardsOpen(false);
          }}
          onDeleteBoard={deleteBoard}
          onLoadBoard={(id) => {
            loadBoard(id);
            setBoardsOpen(false);
          }}
          onSaveAs={() => saveBoardAs(boardNameDraft)}
          onSaveCurrent={() => saveCurrentBoard()}
        />
      )}
    </header>
  );
}

function BoardManager({
  activeBoardId,
  boardNameDraft,
  documentTitle,
  savedBoards,
  onBoardNameDraftChange,
  onClose,
  onCreateBoard,
  onDeleteBoard,
  onLoadBoard,
  onSaveAs,
  onSaveCurrent,
}: {
  activeBoardId: string | null;
  boardNameDraft: string;
  documentTitle: string;
  savedBoards: Array<{ id: string; name: string; updatedAt: string }>;
  onBoardNameDraftChange: (value: string) => void;
  onClose: () => void;
  onCreateBoard: () => void;
  onDeleteBoard: (id: string) => void;
  onLoadBoard: (id: string) => void;
  onSaveAs: () => void;
  onSaveCurrent: () => void;
}) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--backdrop)',
          zIndex: 1200,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: 76,
          right: 16,
          width: 420,
          maxHeight: 'calc(100vh - 92px)',
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
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Whiteboards
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{documentTitle}</div>
          </div>
          <IconBtn icon="close" title="Close" onClick={onClose} />
        </div>

        <div style={{ padding: 18, borderBottom: '1px solid var(--border-color)', display: 'grid', gap: 10 }}>
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
            <ActionBtn icon="save" onClick={onSaveCurrent}>Save Current</ActionBtn>
            <ActionBtn icon="library_add" onClick={onSaveAs}>Save As New</ActionBtn>
            <ActionBtn icon="add_box" onClick={onCreateBoard}>Blank Board</ActionBtn>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
          {savedBoards.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              No saved boards yet. Use `Save Current` to keep different whiteboards inside the browser.
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
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(board.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  {board.id === activeBoardId && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Current
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ActionBtn icon="folder_open" onClick={() => onLoadBoard(board.id)}>Open</ActionBtn>
                  <ActionBtn icon="delete" onClick={() => onDeleteBoard(board.id)}>Delete</ActionBtn>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 22,
        background: 'var(--border-color)',
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
        width: 36,
        height: 36,
        borderRadius: 10,
        border: active ? '1px solid var(--primary)' : '1px solid transparent',
        background: active ? 'var(--primary)' : hover ? 'var(--bg-tertiary)' : 'transparent',
        color: active ? 'var(--primary-contrast)' : 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.12s',
        flexShrink: 0,
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
}: {
  icon: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 34,
        height: 34,
        padding: 0,
        borderRadius: 10,
        border: '1px solid transparent',
        background: hover && !disabled ? 'var(--bg-tertiary)' : 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        opacity: disabled ? 0.35 : 1,
        transition: 'all 0.12s',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={19} />
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
        padding: '6px 12px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        background: hover ? 'var(--bg-tertiary)' : 'transparent',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 0.12s',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name={icon} size={16} />
      {children}
    </button>
  );
}
