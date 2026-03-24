import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, type Editor, useEditor } from '@tiptap/react';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import json from 'highlight.js/lib/languages/json';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import { DataChart } from '../extensions/DataChart';
import { DataSheet } from '../extensions/DataSheet';
import { createDefaultDataSheet, serializeDataSheet } from '../lib/dataSheet';
import { useStore } from '../store/useStore';
import type { DocPage } from '../types';
import { Icon } from './Icon';

const lowlight = createLowlight();
lowlight.register({ json, javascript, typescript, xml, css, python, sql, bash, yaml });

// Extends CodeBlockLowlight to add data-language on <pre> (used by CSS ::before label)
const CodeBlockWithLabel = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      codeTheme: {
        default: 'graphite',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-code-theme') ?? 'graphite',
        renderHTML: (attributes: Record<string, string>) => ({
          'data-code-theme': attributes.codeTheme ?? 'graphite',
        }),
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      {
        ...HTMLAttributes,
        'data-language': node.attrs.language ?? 'plaintext',
        'data-code-theme': node.attrs.codeTheme ?? 'graphite',
      },
      ['code', { class: node.attrs.language ? `language-${node.attrs.language}` : undefined }, 0],
    ];
  },
});

const CODE_LANGUAGES = [
  { value: 'plaintext', label: 'Plain text' },
  { value: 'json',       label: 'JSON' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml',        label: 'HTML / XML' },
  { value: 'css',        label: 'CSS' },
  { value: 'python',     label: 'Python' },
  { value: 'sql',        label: 'SQL' },
  { value: 'bash',       label: 'Bash' },
  { value: 'yaml',       label: 'YAML' },
];

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Space Grotesk', value: 'Space Grotesk' },
  { label: 'Manrope', value: 'Manrope' },
  { label: 'Sora', value: 'Sora' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
  { label: 'Merriweather', value: 'Merriweather' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Fraunces', value: 'Fraunces' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'Fira Code', value: 'Fira Code' },
];

const TEXT_COLORS = ['#111827', '#ffffff', '#6b7280', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#9333ea', '#14b8a6', '#f43f5e'];

const CODE_THEME_OPTIONS = [
  { value: 'graphite', label: 'Graphite' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'sunset', label: 'Sunset' },
];

export function Sidebar() {
  const {
    pages,
    activePageId,
    panelMode,
    setActivePageId,
    addPage,
    updatePage,
    deletePage,
    docsNavigatorCollapsed,
    docsEditorChromeCollapsed,
    toggleDocsNavigatorCollapsed,
    toggleDocsEditorChromeCollapsed,
    setActiveSurface,
  } = useStore();

  const activePage = findPage(pages, activePageId);
  const totalPages = countPages(pages);
  const docsOnly = panelMode === 'docs-only';

  return (
    <aside
      data-docs-root="true"
      style={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        background: docsOnly ? 'transparent' : 'linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 84%, white), color-mix(in srgb, var(--glass-bg) 68%, transparent))',
        borderRight: panelMode === 'split' ? '1px solid var(--glass-border)' : 'none',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
      onPointerDownCapture={() => setActiveSurface('document')}
      onFocusCapture={() => setActiveSurface('document')}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${docsOnly ? 'var(--doc-border)' : 'var(--border-color)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 12,
            color: docsOnly ? 'var(--doc-ink-soft)' : 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Documentation
        </span>

        <div style={{ display: 'flex', gap: 4 }}>
          <SmallBtn icon="add" title="New page" onClick={() => addPage()} />
          <SmallBtn
            icon={docsEditorChromeCollapsed ? 'fullscreen' : 'fullscreen_exit'}
            title={docsEditorChromeCollapsed ? 'Show editor controls' : 'Hide editor controls'}
            onClick={toggleDocsEditorChromeCollapsed}
          />
          <SmallBtn
            icon={docsNavigatorCollapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
            title={docsNavigatorCollapsed ? 'Expand pages' : 'Collapse pages'}
            onClick={toggleDocsNavigatorCollapsed}
          />
        </div>
      </div>

      {!docsNavigatorCollapsed && (
        <div
          style={{
            padding: '10px 12px',
            flexShrink: 0,
            borderBottom: `1px solid ${docsOnly ? 'var(--doc-border)' : 'var(--border-color)'}`,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: docsOnly ? 'var(--doc-ink-soft)' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Pages
              </div>
              <div style={{ fontSize: 12, color: docsOnly ? 'var(--doc-ink-soft)' : 'var(--text-secondary)' }}>
                {totalPages} {totalPages === 1 ? 'page' : 'pages'}
              </div>
            </div>

            <button
              onClick={toggleDocsNavigatorCollapsed}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 8,
                border: `1px solid ${docsOnly ? 'var(--doc-border)' : 'var(--border-color)'}`,
                background: docsOnly ? 'var(--doc-surface)' : 'var(--bg-secondary)',
                color: docsOnly ? 'var(--doc-ink)' : 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Hide
            </button>
          </div>

          <div style={{ maxHeight: 172, overflowY: 'auto', paddingRight: 4 }}>
            {pages.map((page) => (
              <NavNode
                key={page.id}
                page={page}
                activePageId={activePageId}
                onSelect={setActivePageId}
                onDelete={deletePage}
                onAddChild={(id) => addPage(id)}
                depth={0}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activePage ? (
          <PageEditor
            key={activePage.id}
            page={activePage}
            fullDocumentMode={docsOnly}
            chromeCollapsed={docsEditorChromeCollapsed}
            onToggleChrome={toggleDocsEditorChromeCollapsed}
            onTitleChange={(title) => updatePage(activePage.id, { title })}
            onUpdate={(content, contentJson) => updatePage(activePage.id, { content, contentJson })}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            Select a page to edit
          </div>
        )}
      </div>
    </aside>
  );
}

function NavNode({
  page,
  activePageId,
  onSelect,
  onDelete,
  onAddChild,
  depth,
}: {
  page: DocPage;
  activePageId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [hover, setHover] = useState(false);
  const isActive = page.id === activePageId;
  const hasChildren = (page.children?.length ?? 0) > 0;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          borderRadius: 14,
          cursor: 'pointer',
          fontSize: 13,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: isActive ? 600 : 500,
          background: isActive ? 'color-mix(in srgb, var(--glass-bg) 80%, white)' : hover ? 'rgba(255,255,255,0.06)' : 'transparent',
          transition: 'background 0.12s ease, transform 0.12s ease',
        }}
        onClick={() => onSelect(page.id)}
      >
        {hasChildren ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            style={{
              width: 18,
              height: 18,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={16} />
          </button>
        ) : (
          <span style={{ width: 18, flexShrink: 0 }} />
        )}

        <PageIcon name={page.icon} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {page.title}
        </span>

        {hover && (
          <div style={{ display: 'flex', gap: 2 }} onClick={(event) => event.stopPropagation()}>
            <SmallBtn icon="add" title="Add sub-page" onClick={() => onAddChild(page.id)} />
            <SmallBtn icon="delete" title="Delete" onClick={() => onDelete(page.id)} />
          </div>
        )}
      </div>

      {hasChildren &&
        expanded &&
        page.children?.map((child) => (
          <NavNode
            key={child.id}
            page={child}
            activePageId={activePageId}
            onSelect={onSelect}
            onDelete={onDelete}
            onAddChild={onAddChild}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function PageEditor({
  page,
  fullDocumentMode,
  chromeCollapsed,
  onToggleChrome,
  onTitleChange,
  onUpdate,
}: {
  page: DocPage;
  fullDocumentMode: boolean;
  chromeCollapsed: boolean;
  onToggleChrome: () => void;
  onTitleChange: (title: string) => void;
  onUpdate: (content: string, contentJson: JSONContent) => void;
}) {
  const lastSerializedRef = useRef<{ html: string; json: string } | null>(null);
  const editorExtensions = useMemo(() => [
    StarterKit.configure({ codeBlock: false, link: false, underline: false }),
    CodeBlockWithLabel.configure({ lowlight, defaultLanguage: 'plaintext' }),
    TextStyle,
    Color,
    FontFamily,
    Underline,
    Highlight,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        target: '_blank',
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    DataChart,
    DataSheet,
    Placeholder.configure({ placeholder: 'Start writing...' }),
  ], []);
  const syncSerializedContent = useCallback((currentEditor: Editor | null) => {
    if (!currentEditor) return;

    const html = currentEditor.getHTML();
    const json = currentEditor.getJSON();
    const jsonKey = JSON.stringify(json);
    if (lastSerializedRef.current?.html === html && lastSerializedRef.current?.json === jsonKey) {
      return;
    }

    lastSerializedRef.current = { html, json: jsonKey };
    queueMicrotask(() => onUpdate(html, json));
  }, [onUpdate]);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: editorExtensions,
    content: page.contentJson ?? page.content,
    onUpdate: ({ editor: currentEditor }) => {
      syncSerializedContent(currentEditor);
    },
  });

  useEffect(() => {
    if (!editor) return;

    const nextContent = page.contentJson ?? page.content;
    const currentHtml = editor.getHTML();
    const currentJsonKey = JSON.stringify(editor.getJSON());
    const nextJsonKey = page.contentJson ? JSON.stringify(page.contentJson) : null;
    const matches = nextJsonKey ? currentJsonKey === nextJsonKey : currentHtml === page.content;

    if (matches) {
      lastSerializedRef.current = {
        html: currentHtml,
        json: currentJsonKey,
      };
      return;
    }

    const syncTimer = window.setTimeout(() => {
      if (editor.isDestroyed) return;
      editor.commands.setContent(nextContent, { emitUpdate: false });
      lastSerializedRef.current = {
        html: editor.getHTML(),
        json: JSON.stringify(editor.getJSON()),
      };
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [editor, page.id, page.content, page.contentJson]);

  useEffect(() => () => syncSerializedContent(editor), [editor, syncSerializedContent]);

  const tone = fullDocumentMode ? 'doc' : 'app';
  const shellBorder = fullDocumentMode ? 'var(--doc-border)' : 'var(--border-color)';
  const shellText = fullDocumentMode ? 'var(--doc-ink)' : 'var(--text-primary)';
  const shellTextSoft = fullDocumentMode ? 'var(--doc-ink-soft)' : 'var(--text-secondary)';
  const shellMuted = fullDocumentMode ? 'var(--doc-ink-soft)' : 'var(--text-muted)';
  const chromeSurface = fullDocumentMode ? 'var(--doc-toolbar-bg)' : 'var(--glass-bg)';
  const showTopChrome = !chromeCollapsed && !fullDocumentMode;
  const showSideChrome = !chromeCollapsed && fullDocumentMode;
  const scrollPadding = fullDocumentMode
    ? chromeCollapsed
      ? '18px 20px 48px'
      : '18px 20px 56px'
    : chromeCollapsed
      ? '10px 16px 24px'
      : '12px 16px 32px';

  const focusEditorSurface = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('[data-doc-interactive="true"], input, button, select, textarea, [contenteditable="false"]')
    ) {
      return;
    }

    editor?.commands.focus();
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: fullDocumentMode ? 'var(--doc-canvas-bg)' : 'transparent',
      }}
    >
      {showTopChrome && (
        <>
          <div
            style={{
              padding: '10px 12px 8px',
              borderBottom: `1px solid ${shellBorder}`,
              background: chromeSurface,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: shellMuted,
                }}
              >
                Page Title
              </span>

              <button
                onClick={onToggleChrome}
                style={{
                  height: 26,
                  padding: '0 8px',
                  borderRadius: 999,
                  border: `1px solid ${shellBorder}`,
                  background: 'rgba(255,255,255,0.08)',
                  color: shellTextSoft,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Minimize
              </button>
            </div>
            <input
              value={page.title}
              onChange={(event) => onTitleChange(event.target.value)}
              onBlur={(event) => {
                if (!event.target.value.trim()) {
                  onTitleChange('Untitled');
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
              placeholder="Untitled"
              style={{
                width: '100%',
                height: 34,
                borderRadius: 12,
                border: `1px solid ${shellBorder}`,
                background: 'rgba(255,255,255,0.06)',
                color: shellText,
                padding: '0 12px',
                fontSize: 14,
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          {editor && <FormatBar editor={editor} tone={tone} />}
        </>
      )}

      <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: scrollPadding,
            minWidth: 0,
            background: fullDocumentMode ? 'var(--doc-canvas-bg)' : 'transparent',
          }}
          onClick={focusEditorSurface}
      >
        {chromeCollapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
              padding: '8px 0 10px',
              borderBottom: `1px solid ${shellBorder}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: shellText,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {page.title || 'Untitled'}
              </div>
              <div style={{ fontSize: 11, color: shellMuted }}>
                {fullDocumentMode ? 'Document controls hidden' : 'Editor controls hidden'}
              </div>
            </div>

            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleChrome();
              }}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                border: `1px solid ${shellBorder}`,
                background: chromeSurface,
                color: shellText,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Show controls
            </button>
          </div>
        )}

        <div
          style={{
            maxWidth: fullDocumentMode ? 1320 : 'none',
            margin: fullDocumentMode ? '0 auto' : 0,
            display: fullDocumentMode ? 'grid' : 'block',
            gridTemplateColumns: fullDocumentMode
              ? showSideChrome
                ? '260px minmax(0, 1fr)'
                : 'minmax(0, 1fr)'
              : undefined,
            gap: fullDocumentMode ? 20 : 0,
            alignItems: fullDocumentMode ? 'start' : undefined,
          }}
        >
          {showSideChrome && editor && (
            <DocumentEditorRail
              editor={editor}
              page={page}
              onToggleChrome={onToggleChrome}
              onTitleChange={onTitleChange}
            />
          )}

          <div style={{ minWidth: 0 }}>
            {fullDocumentMode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  margin: '0 auto 12px',
                  padding: '0 12px',
                  color: shellMuted,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <span>{page.title || 'Untitled'}</span>
                <span>Page 1</span>
              </div>
            )}

            <div className={fullDocumentMode ? 'document-sheet' : undefined} style={fullDocumentMode ? undefined : { minWidth: 0 }}>
              <EditorContent editor={editor} />

              {fullDocumentMode && (
                <div className="document-sheet-footer">
                  <span>{page.title || 'Untitled'}</span>
                  <span>Page 1</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentEditorRail({
  editor,
  page,
  onToggleChrome,
  onTitleChange,
}: {
  editor: Editor;
  page: DocPage;
  onToggleChrome: () => void;
  onTitleChange: (title: string) => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        display: 'grid',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 8,
          padding: 12,
          borderRadius: 24,
          border: '1px solid var(--doc-border)',
          background: 'var(--doc-toolbar-bg)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--doc-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Document
            </span>
            <span style={{ fontSize: 12, color: 'var(--doc-ink-soft)' }}>Editing rail</span>
          </div>
          <button
            onClick={onToggleChrome}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 999,
              border: '1px solid var(--doc-border)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--doc-ink)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Hide
          </button>
        </div>

        <input
          value={page.title}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={(event) => {
            if (!event.target.value.trim()) {
              onTitleChange('Untitled');
            }
          }}
          placeholder="Untitled"
          style={{
            width: '100%',
            height: 38,
            borderRadius: 14,
            border: '1px solid var(--doc-border)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--doc-ink)',
            padding: '0 12px',
            fontSize: 14,
            fontWeight: 700,
            outline: 'none',
          }}
        />
      </div>

      <FormatBar editor={editor} tone="doc" variant="panel" />
    </div>
  );
}

function FormatBar({
  editor,
  tone,
  variant = 'bar',
}: {
  editor: Editor;
  tone: 'app' | 'doc';
  variant?: 'bar' | 'panel';
}) {
  const rawColor = editor.getAttributes('textStyle').color ?? '#111827';
  const color = normalizeColorInputValue(rawColor);
  const fontFamily = editor.getAttributes('textStyle').fontFamily ?? 'Space Grotesk';
  const linkHref = editor.getAttributes('link').href ?? '';
  const inputSurface = tone === 'doc' ? 'var(--doc-toolbar-bg)' : 'var(--glass-bg)';
  const border = tone === 'doc' ? 'var(--doc-border)' : 'var(--glass-border)';
  const text = tone === 'doc' ? 'var(--doc-ink)' : 'var(--text-primary)';
  const textSoft = tone === 'doc' ? 'var(--doc-ink-soft)' : 'var(--text-secondary)';
  const isCodeBlock = editor.isActive('codeBlock');
  const codeBlockLang = editor.getAttributes('codeBlock').language ?? 'plaintext';
  const codeBlockTheme = editor.getAttributes('codeBlock').codeTheme ?? 'graphite';

  const buttons: Array<{
    key: string;
    title: string;
    active: boolean;
    icon?: string;
    label?: string;
    run: () => void;
  }> = [
    {
      key: 'bold',
      title: 'Bold',
      active: editor.isActive('bold'),
      icon: 'format_bold',
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      title: 'Italic',
      active: editor.isActive('italic'),
      icon: 'format_italic',
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      title: 'Underline',
      active: editor.isActive('underline'),
      icon: 'format_underlined',
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'strike',
      title: 'Strikethrough',
      active: editor.isActive('strike'),
      icon: 'strikethrough_s',
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      key: 'highlight',
      title: 'Highlight',
      active: editor.isActive('highlight'),
      icon: 'format_color_fill',
      run: () => editor.chain().focus().toggleHighlight().run(),
    },
    {
      key: 'inline-code',
      title: 'Inline code',
      active: editor.isActive('code'),
      icon: 'code',
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      key: 'link',
      title: linkHref ? 'Edit link' : 'Add link',
      active: editor.isActive('link'),
      icon: 'link',
      run: () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run();
          return;
        }
        const nextHref = window.prompt('Paste the link URL');
        if (!nextHref) return;
        editor.chain().focus().extendMarkRange('link').setLink({ href: nextHref }).run();
      },
    },
    {
      key: 'h1',
      title: 'Heading 1',
      active: editor.isActive('heading', { level: 1 }),
      label: 'H1',
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: 'h2',
      title: 'Heading 2',
      active: editor.isActive('heading', { level: 2 }),
      label: 'H2',
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: 'h3',
      title: 'Heading 3',
      active: editor.isActive('heading', { level: 3 }),
      label: 'H3',
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: 'bullet',
      title: 'Bullet list',
      active: editor.isActive('bulletList'),
      icon: 'format_list_bulleted',
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'ordered',
      title: 'Ordered list',
      active: editor.isActive('orderedList'),
      icon: 'format_list_numbered',
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: 'tasks',
      title: 'Task list',
      active: editor.isActive('taskList'),
      icon: 'checklist',
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      key: 'quote',
      title: 'Blockquote',
      active: editor.isActive('blockquote'),
      icon: 'format_quote',
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      key: 'code-block',
      title: 'Code block',
      active: isCodeBlock,
      icon: 'data_object',
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result as string;
        editor.chain().focus().setImage({ src, alt: file.name }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const insertDataSheet = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'dataSheet',
        attrs: { model: serializeDataSheet(createDefaultDataSheet()) },
      })
      .run();
  };

  const insertDataChart = () => {
    let preferredModel: string | null = null;
    let fallbackModel: string | null = null;
    const selectionFrom = editor.state.selection.from;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== 'dataSheet') return;
      const model = typeof node.attrs.model === 'string' ? node.attrs.model : null;
      if (!model) return;
      fallbackModel ??= model;
      if (pos <= selectionFrom) {
        preferredModel = model;
      }
    });

    const chartModel = preferredModel ?? fallbackModel ?? serializeDataSheet(createDefaultDataSheet());

    editor
      .chain()
      .focus()
      .insertContent({
        type: 'dataChart',
        attrs: { model: chartModel },
      })
      .run();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: variant === 'panel' ? '12px' : tone === 'doc' ? '8px 10px' : '8px 12px',
        borderBottom: variant === 'panel' ? 'none' : `1px solid ${border}`,
        border: variant === 'panel' ? `1px solid ${border}` : 'none',
        borderRadius: variant === 'panel' ? 24 : 0,
        background: inputSurface,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        flexShrink: 0,
        alignItems: 'center',
      }}
    >
      {buttons.map((button) => (
        <FormatButton
          key={button.key}
          title={button.title}
          active={button.active}
          onMouseDown={(event) => {
            event.preventDefault();
            button.run();
          }}
          tone={tone}
        >
          {button.icon ? <Icon name={button.icon} size={15} /> : button.label}
        </FormatButton>
      ))}

      <ToolbarDivider tone={tone} />

      <select
        value={fontFamily}
        onChange={(event) => {
          const value = event.target.value;
          if (value === 'default') {
            editor.chain().focus().unsetFontFamily().run();
            return;
          }
          editor.chain().focus().setFontFamily(value).run();
        }}
        style={getControlStyle(tone)}
      >
        <option value="default">Default font</option>
        {FONT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 6px',
          border: `1px solid ${border}`,
          borderRadius: 999,
          background: tone === 'doc' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)',
          color: textSoft,
        }}
      >
        <Icon name="format_color_text" size={15} />
        <input
          type="color"
          value={color}
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          title="Text color"
          style={{
            width: 22,
            height: 22,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {TEXT_COLORS.map((preset) => (
          <button
            key={preset}
            title={preset}
            onMouseDown={(event) => {
              event.preventDefault();
              editor.chain().focus().setColor(preset).run();
            }}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: normalizeColorInputValue(rawColor) === normalizeColorInputValue(preset)
                ? `2px solid ${text}`
                : `1px solid ${border}`,
              background: preset,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <ToolbarDivider tone={tone} />

      {[
        { align: 'left' as const, icon: 'format_align_left', title: 'Align left' },
        { align: 'center' as const, icon: 'format_align_center', title: 'Align center' },
        { align: 'right' as const, icon: 'format_align_right', title: 'Align right' },
      ].map((option) => (
        <FormatButton
          key={option.align}
          title={option.title}
          active={editor.isActive({ textAlign: option.align })}
          onMouseDown={(event) => {
            event.preventDefault();
            editor.chain().focus().setTextAlign(option.align).run();
          }}
          tone={tone}
        >
          <Icon name={option.icon} size={15} />
        </FormatButton>
      ))}

      {isCodeBlock && (
        <>
          <ToolbarDivider tone={tone} />
          <select
            value={codeBlockLang}
            onChange={(event) =>
              editor.chain().focus().updateAttributes('codeBlock', { language: event.target.value }).run()
            }
            title="Code language"
            style={getControlStyle(tone)}
          >
            {CODE_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <select
            value={codeBlockTheme}
            onChange={(event) =>
              editor.chain().focus().updateAttributes('codeBlock', { codeTheme: event.target.value }).run()
            }
            title="Code theme"
            style={getControlStyle(tone)}
          >
            {CODE_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}

      <ToolbarDivider tone={tone} />

      <FormatButton
        title="Insert image"
        active={false}
        tone={tone}
        onMouseDown={(event) => {
          event.preventDefault();
          insertImage();
        }}
      >
        <Icon name="image" size={15} />
      </FormatButton>

      <FormatButton
        title="Insert data sheet"
        active={false}
        tone={tone}
        onMouseDown={(event) => {
          event.preventDefault();
          insertDataSheet();
        }}
      >
        <Icon name="table_chart" size={15} />
      </FormatButton>

      <FormatButton
        title="Insert chart block"
        active={false}
        tone={tone}
        onMouseDown={(event) => {
          event.preventDefault();
          insertDataChart();
        }}
      >
        <Icon name="insert_chart" size={15} />
      </FormatButton>

      <FormatButton
        title="Divider"
        active={false}
        tone={tone}
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setHorizontalRule().run();
        }}
      >
        <Icon name="horizontal_rule" size={15} />
      </FormatButton>
    </div>
  );
}

function FormatButton({
  children,
  title,
  active,
  onMouseDown,
  tone,
}: {
  children: ReactNode;
  title: string;
  active: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
  tone: 'app' | 'doc';
}) {
  const activeBackground = tone === 'doc' ? 'var(--doc-ink)' : 'var(--primary)';
  const activeColor = tone === 'doc' ? 'var(--doc-surface)' : 'var(--primary-contrast)';
  const idleColor = tone === 'doc' ? 'var(--doc-ink-soft)' : 'var(--text-secondary)';

  const btnSize = tone === 'doc' ? 24 : 28;

  return (
    <button
      title={title}
      onMouseDown={onMouseDown}
      style={{
        minWidth: btnSize,
        height: btnSize,
        padding: tone === 'doc' ? '0 6px' : '0 8px',
        borderRadius: 999,
        border: active ? '1px solid transparent' : '1px solid transparent',
        background: active ? activeBackground : 'transparent',
        color: active ? activeColor : idleColor,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider({ tone }: { tone: 'app' | 'doc' }) {
  return <div style={{ width: 1, height: 22, background: tone === 'doc' ? 'var(--doc-border)' : 'var(--border-color)' }} />;
}

function SmallBtn({
  icon,
  title,
  onClick,
}: {
  icon: string;
  title?: string;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        border: 'none',
        background: hover ? 'rgba(255,255,255,0.08)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

function PageIcon({ name }: { name: string }) {
  if (/^[a-z0-9_]+$/i.test(name)) {
    return <Icon name={name} size={18} style={{ color: 'var(--text-secondary)' }} />;
  }

  return (
    <span style={{ fontSize: 14, width: 18, textAlign: 'center', color: 'var(--text-secondary)' }}>
      {name}
    </span>
  );
}

function findPage(pages: DocPage[], id: string | null): DocPage | null {
  if (!id) return null;
  for (const page of pages) {
    if (page.id === id) return page;
    if (page.children) {
      const found = findPage(page.children, id);
      if (found) return found;
    }
  }
  return null;
}

function countPages(pages: DocPage[]): number {
  return pages.reduce((total, page) => total + 1 + countPages(page.children ?? []), 0);
}

function normalizeColorInputValue(value: string | undefined) {
  const fallback = '#111827';
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }

  const rgbMatch = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgbMatch) {
    const toHex = (channel: string) =>
      Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0');
    return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
  }

  return fallback;
}

function getControlStyle(tone: 'app' | 'doc'): CSSProperties {
  return {
    height: 30,
    borderRadius: 999,
    border: `1px solid ${tone === 'doc' ? 'var(--doc-border)' : 'var(--border-color)'}`,
    background: tone === 'doc' ? 'rgba(255,255,255,0.06)' : 'var(--glass-bg)',
    color: tone === 'doc' ? 'var(--doc-ink)' : 'var(--text-primary)',
    padding: '0 10px',
    fontSize: 11,
    cursor: 'pointer',
  };
}
