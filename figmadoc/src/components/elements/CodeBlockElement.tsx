import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CodeElement } from '../../types';
import { useStore } from '../../store/useStore';
import { createSandboxIframe } from '../../lib/sandbox';
import { Icon } from '../Icon';
import { ElementResizeHandles } from './ElementResizeHandles';

type Tab = 'html' | 'css' | 'js' | 'preview';

interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info' | 'ready';
  msg?: string;
}

interface Props {
  element: CodeElement;
  selected: boolean;
  zoom: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function CodeBlockElement({ element, selected, zoom, onPointerDown }: Props) {
  const { updateElement } = useStore();
  const { html, css, js, title = 'Code Block' } = element.properties;
  const runtime = element.properties.runtime ?? inferRuntime(js, html);
  const tabs = runtime === 'react' ? (['js', 'preview'] as Tab[]) : (['html', 'css', 'js', 'preview'] as Tab[]);
  const [tab, setTab] = useState<Tab>(runtime === 'react' ? 'js' : 'html');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenBounds, setFullscreenBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const previousFullscreenRef = useRef(false);

  const update = (field: 'html' | 'css' | 'js', value: string) =>
    updateElement(element.id, {
      properties: {
        ...element.properties,
        [field]: value,
      },
    });

  const updateRuntime = (value: 'browser' | 'react') => {
    setTab(value === 'react' ? 'js' : 'html');
    updateElement(element.id, {
      properties: {
        ...element.properties,
        runtime: value,
        html:
          value === 'react' && !/\bid\s*=\s*["']root["']/.test(element.properties.html)
            ? '<div id="root"></div>'
            : element.properties.html,
      },
    });
  };

  const run = useCallback(() => {
    if (!previewRef.current) return;
    setRunning(true);
    setLogs([]);
    setTab('preview');
    cleanupRef.current?.();
    cleanupRef.current = createSandboxIframe(
      previewRef.current,
      element.properties.html,
      element.properties.css,
      element.properties.js,
      (message) => {
        setRunning(false);
        if (message.type !== 'ready') {
          setLogs((previous) => [
            ...previous,
            { type: message.type as LogEntry['type'], msg: message.msg },
          ]);
        }
      },
      runtime === 'react' ? 15000 : 5000,
      runtime
    );
  }, [element.properties, runtime]);

  useEffect(() => {
    if (runtime === 'react' && tab !== 'js' && tab !== 'preview') {
      setTab('js');
    }
  }, [runtime, tab]);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (previousFullscreenRef.current !== fullscreen && tab === 'preview') {
      requestAnimationFrame(() => run());
    }
    previousFullscreenRef.current = fullscreen;
  }, [fullscreen, run, tab]);

  useEffect(() => {
    if (!fullscreen) {
      setFullscreenBounds(null);
      return;
    }

    let observer: ResizeObserver | null = null;

    const updateBounds = () => {
      const whiteboardRoot = previewRef.current?.closest('[data-whiteboard-root="true"]') as HTMLElement | null;
      if (!whiteboardRoot) return;
      const rect = whiteboardRoot.getBoundingClientRect();
      setFullscreenBounds({
        top: rect.top + 12,
        left: rect.left + 12,
        width: Math.max(320, rect.width - 24),
        height: Math.max(240, rect.height - 24),
      });
    };

    updateBounds();
    const whiteboardRoot = previewRef.current?.closest('[data-whiteboard-root="true"]') as HTMLElement | null;
    if (whiteboardRoot && 'ResizeObserver' in window) {
      observer = new ResizeObserver(updateBounds);
      observer.observe(whiteboardRoot);
    }
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
    };
  }, [fullscreen]);

  const inlineBox: CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    transform: `rotate(${element.rotation ?? 0}deg)`,
    transformOrigin: 'center center',
  };

  const modalBox: CSSProperties = {
    position: 'fixed',
    top: (fullscreenBounds?.top ?? 0) + 16,
    left: (fullscreenBounds?.left ?? 0) + 16,
    width: Math.max(320, (fullscreenBounds?.width ?? window.innerWidth) - 32),
    height: Math.max(240, (fullscreenBounds?.height ?? window.innerHeight) - 32),
    zIndex: 10000,
    borderRadius: 20,
  };

  const renderPanel = (mode: 'inline' | 'modal') => (
      <div
        style={{
          ...(mode === 'modal' ? modalBox : inlineBox),
          background: 'var(--code-bg)',
          color: 'var(--code-fg)',
          border: '1px solid rgba(255,255,255,0.12)',
          overflow: 'hidden',
          boxShadow: selected || mode === 'modal'
            ? '0 0 0 2px var(--primary), 0 16px 40px rgba(0,0,0,0.35)'
            : '0 12px 28px rgba(0,0,0,0.24)',
          display: 'flex',
          flexDirection: 'column',
          cursor: mode === 'modal' ? 'default' : 'move',
          userSelect: 'none',
          transition: mode === 'modal' ? 'none' : undefined,
        }}
        onPointerDown={mode === 'modal' ? (event) => event.stopPropagation() : onPointerDown}
        onWheel={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.35)',
                  }}
                />
              ))}
            </div>

            <span
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'JetBrains Mono',
              }}
            >
              {title}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select
              value={runtime}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => updateRuntime(event.target.value as 'browser' | 'react')}
              title="Preview runtime"
              style={{
                height: 28,
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.82)',
                padding: '0 8px',
                fontSize: 10.5,
                fontFamily: 'JetBrains Mono',
                textTransform: 'uppercase',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="browser" style={{ color: '#000' }}>Browser</option>
              <option value="react" style={{ color: '#000' }}>React JSX</option>
            </select>

            {tabs.map((currentTab) => (
              <button
                key={currentTab}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTab(currentTab)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid transparent',
                  fontSize: 10.5,
                  fontFamily: 'JetBrains Mono',
                  cursor: 'pointer',
                  background: tab === currentTab ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                  color: tab === currentTab ? 'var(--primary-contrast)' : 'rgba(255,255,255,0.72)',
                  fontWeight: tab === currentTab ? 700 : 500,
                  transition: 'all 0.12s',
                  textTransform: 'uppercase',
                }}
              >
                {currentTab === 'js' ? (runtime === 'react' ? 'jsx' : 'js') : currentTab}
              </button>
            ))}

            <button
              onPointerDown={(event) => event.stopPropagation()}
              onClick={run}
              disabled={running}
              title="Run code"
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--primary)',
                color: 'var(--primary-contrast)',
                fontSize: 12,
                fontWeight: 700,
                cursor: running ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name={running ? 'sync' : 'play_arrow'} size={15} className={running ? 'spin' : undefined} />
              {running ? 'Running' : 'Run'}
            </button>

            <button
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setFullscreen((value) => !value)}
              title={mode === 'modal' ? 'Close modal' : 'Open modal'}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.72)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={mode === 'modal' ? 'fullscreen_exit' : 'fullscreen'} size={16} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tab !== 'preview' && (
            <textarea
              value={tab === 'html' ? html : tab === 'css' ? css : js}
              onChange={(event) => update(tab as 'html' | 'css' | 'js', event.target.value)}
              spellCheck={false}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Tab') {
                  event.preventDefault();
                  const target = event.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const value = target.value.substring(0, start) + '  ' + target.value.substring(end);
                  const field = tab as 'html' | 'css' | 'js';
                  update(field, value);
                  requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + 2;
                  });
                }
              }}
              onWheel={(event) => event.stopPropagation()}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                resize: 'none',
                outline: 'none',
                padding: '14px 16px',
                fontFamily: 'JetBrains Mono',
                fontSize: 12.5,
                lineHeight: 1.65,
                color: 'var(--code-fg)',
                userSelect: 'text',
                cursor: 'text',
                minHeight: 0,
              }}
            />
          )}

          <div
            ref={previewRef}
            style={{
              flex: tab === 'preview' ? 1 : 0,
              display: tab === 'preview' ? 'block' : 'none',
              background: '#ffffff',
              overflow: 'hidden',
            }}
            onWheel={(event) => event.stopPropagation()}
          />

          {logs.length > 0 && (
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                maxHeight: mode === 'modal' ? 220 : 120,
                overflowY: 'auto',
                padding: '8px 12px',
                flexShrink: 0,
              }}
              onWheel={(event) => event.stopPropagation()}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Console
              </div>
              {logs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'JetBrains Mono',
                    color: 'rgba(255,255,255,0.88)',
                    marginBottom: 4,
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                  }}
                >
                  <Icon
                    name={log.type === 'error' ? 'error' : log.type === 'warn' ? 'warning' : 'info'}
                    size={14}
                    style={{ marginTop: 1, opacity: 0.7 }}
                  />
                  <span>{log.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {mode !== 'modal' && selected && (
          <ElementResizeHandles
            element={element}
            zoom={zoom}
            minWidth={280}
            minHeight={180}
            onResize={(updates) => updateElement(element.id, updates)}
          />
        )}
      </div>
  );

  return (
    <>
      {!fullscreen && renderPanel('inline')}

      {fullscreen && fullscreenBounds && createPortal(
        <>
          <div
            style={{
              position: 'fixed',
              top: fullscreenBounds.top,
              left: fullscreenBounds.left,
              width: fullscreenBounds.width,
              height: fullscreenBounds.height,
              background: 'var(--backdrop)',
              borderRadius: 18,
              zIndex: 9998,
            }}
            onPointerDown={() => setFullscreen(false)}
          />
          {renderPanel('modal')}
        </>,
        document.body
      )}
    </>
  );
}

function inferRuntime(js: string, html: string): 'browser' | 'react' {
  if (
    /^\s*import\s/m.test(js) ||
    /\bexport\s+default\b/.test(js) ||
    /\bclassName=/.test(js) ||
    /\bReact\b/.test(js) ||
    /\bid\s*=\s*["']root["']/.test(html)
  ) {
    return 'react';
  }

  return 'browser';
}
