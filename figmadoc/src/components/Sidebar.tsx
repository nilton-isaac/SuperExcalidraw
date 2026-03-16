import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { EditorContent, type Editor, useEditor } from '@tiptap/react';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import StarterKit from '@tiptap/starter-kit';
import { useStore } from '../store/useStore';
import type { DocPage } from '../types';
import { Icon } from './Icon';

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Space Grotesk', value: 'Space Grotesk' },
  { label: 'Merriweather', value: 'Merriweather' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
];

const TEXT_COLORS = ['#000000', '#ffffff', '#6b7280', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#9333ea'];

export function Sidebar() {
  const { pages, activePageId, setActivePageId, addPage, updatePage, deletePage } = useStore();

  const activePage = findPage(pages, activePageId);

  return (
    <aside
      style={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
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
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Documentation
        </span>

        <div style={{ display: 'flex', gap: 4 }}>
          <SmallBtn icon="add" title="New page" onClick={() => addPage()} />
        </div>
      </div>

      <div
        style={{
          padding: '8px 8px 0',
          flexShrink: 0,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: 8,
        }}
      >
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

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activePage ? (
          <PageEditor
            key={activePage.id}
            page={activePage}
            onTitleChange={(title) => updatePage(activePage.id, { title })}
            onUpdate={(content) => updatePage(activePage.id, { content })}
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
          borderRadius: 10,
          cursor: 'pointer',
          fontSize: 13,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: isActive ? 600 : 500,
          background: isActive ? 'var(--bg-tertiary)' : hover ? 'var(--bg-tertiary)' : 'transparent',
          transition: 'background 0.1s',
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
  onTitleChange,
  onUpdate,
}: {
  page: DocPage;
  onTitleChange: (title: string) => void;
  onUpdate: (content: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content: page.content,
    onUpdate: ({ editor: currentEditor }) => {
      onUpdate(currentEditor.getHTML());
    },
  });

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          padding: '16px 18px 12px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Page Title
        </span>
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
            height: 40,
            borderRadius: 10,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            padding: '0 12px',
            fontSize: 15,
            fontWeight: 700,
            outline: 'none',
          }}
        />
      </div>

      {editor && <FormatBar editor={editor} />}

      <div
        style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px', minWidth: 0 }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function FormatBar({ editor }: { editor: Editor }) {
  const color = editor.getAttributes('textStyle').color ?? '#000000';
  const fontFamily = editor.getAttributes('textStyle').fontFamily ?? 'Space Grotesk';

  const buttons: Array<{
    key: string;
    title: string;
    active: () => boolean;
    run: () => void;
    icon?: string;
    label?: string;
  }> = [
    {
      key: 'bold',
      title: 'Bold',
      active: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
      icon: 'format_bold',
    },
    {
      key: 'italic',
      title: 'Italic',
      active: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
      icon: 'format_italic',
    },
    {
      key: 'strike',
      title: 'Strikethrough',
      active: () => editor.isActive('strike'),
      run: () => editor.chain().focus().toggleStrike().run(),
      icon: 'strikethrough_s',
    },
    {
      key: 'highlight',
      title: 'Highlight',
      active: () => editor.isActive('highlight'),
      run: () => editor.chain().focus().toggleHighlight().run(),
      icon: 'format_color_fill',
    },
    {
      key: 'h1',
      title: 'Heading 1',
      active: () => editor.isActive('heading', { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      label: 'H1',
    },
    {
      key: 'h2',
      title: 'Heading 2',
      active: () => editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      label: 'H2',
    },
    {
      key: 'h3',
      title: 'Heading 3',
      active: () => editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      label: 'H3',
    },
    {
      key: 'bullet',
      title: 'Bullet list',
      active: () => editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
      icon: 'format_list_bulleted',
    },
    {
      key: 'ordered',
      title: 'Ordered list',
      active: () => editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
      icon: 'format_list_numbered',
    },
    {
      key: 'tasks',
      title: 'Task list',
      active: () => editor.isActive('taskList'),
      run: () => editor.chain().focus().toggleTaskList().run(),
      icon: 'checklist',
    },
    {
      key: 'quote',
      title: 'Blockquote',
      active: () => editor.isActive('blockquote'),
      run: () => editor.chain().focus().toggleBlockquote().run(),
      icon: 'format_quote',
    },
    {
      key: 'code',
      title: 'Inline code',
      active: () => editor.isActive('code'),
      run: () => editor.chain().focus().toggleCode().run(),
      icon: 'code',
    },
    {
      key: 'rule',
      title: 'Divider',
      active: () => false,
      run: () => editor.chain().focus().setHorizontalRule().run(),
      icon: 'horizontal_rule',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        alignItems: 'center',
      }}
    >
      {buttons.map((button) => (
        <FormatButton
          key={button.key}
          title={button.title}
          active={button.active()}
          onMouseDown={(event) => {
            event.preventDefault();
            button.run();
          }}
        >
          {button.icon ? <Icon name={button.icon} size={16} /> : button.label}
        </FormatButton>
      ))}

      <ToolbarDivider />

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
        style={controlStyle}
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
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'var(--bg-primary)',
        }}
      >
        <Icon name="format_color_text" size={16} />
        <input
          type="color"
          value={color}
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          title="Text color"
          style={{
            width: 24,
            height: 24,
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
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: color === preset ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
              background: preset,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <ToolbarDivider />

      <div style={{ display: 'flex', gap: 4 }}>
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
          >
            <Icon name={option.icon} size={16} />
          </FormatButton>
        ))}
      </div>
    </div>
  );
}

function FormatButton({
  children,
  title,
  active,
  onMouseDown,
}: {
  children: ReactNode;
  title: string;
  active: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      title={title}
      onMouseDown={onMouseDown}
      style={{
        minWidth: 32,
        height: 32,
        padding: '0 10px',
        borderRadius: 8,
        border: '1px solid transparent',
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'var(--primary-contrast)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.1s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div style={{ width: 1, height: 22, background: 'var(--border-color)' }} />;
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
        borderRadius: 6,
        border: 'none',
        background: hover ? 'var(--bg-tertiary)' : 'transparent',
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

const controlStyle: CSSProperties = {
  height: 32,
  borderRadius: 8,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  fontSize: 12,
  cursor: 'pointer',
};
