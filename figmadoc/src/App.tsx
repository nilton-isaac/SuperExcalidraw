import { useEffect, useCallback, useRef } from 'react';
import { useStore } from './store/useStore';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Whiteboard } from './components/Whiteboard';
import './index.css';

export default function App() {
  const { theme, layoutMode, splitRatio, setSplitRatio } = useStore();

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
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
        {/* Docs panel */}
        <div
          style={{
            [isH ? 'width' : 'height']: sidebarSize,
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Sidebar />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onSplitMouseDown}
          title="Drag to resize"
          style={{
            [isH ? 'width' : 'height']: 4,
            [isH ? 'height' : 'width']: '100%',
            flexShrink: 0,
            background: 'var(--border-color)',
            cursor: isH ? 'col-resize' : 'row-resize',
            transition: 'background 0.15s',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--border-color)';
          }}
        />

        {/* Whiteboard panel */}
        <div
          style={{
            [isH ? 'width' : 'height']: whiteboardSize,
            flex: 1,
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
