import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TableElement as TableEl } from '../../types';
import { useStore } from '../../store/useStore';
import { parseDataSheet, serializeDataSheet } from '../../lib/dataSheet';
import { DataSheetCard } from '../docs/DataSheetBlock';
import { Icon } from '../Icon';
import { ElementResizeHandles } from './ElementResizeHandles';

interface Props {
  element: TableEl;
  selected: boolean;
  zoom: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function TableElementComponent({ element, selected, zoom, onPointerDown }: Props) {
  const { updateElement } = useStore();
  const model = parseDataSheet(element.properties.model);
  const [fullscreen, setFullscreen] = useState(false);
  const [modalBounds, setModalBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const measureModalBounds = useCallback(() => {
    return {
      top: 18,
      left: 18,
      width: Math.max(420, window.innerWidth - 36),
      height: Math.max(320, window.innerHeight - 36),
    };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;

    const updateBounds = () => {
      setModalBounds(measureModalBounds());
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [fullscreen, measureModalBounds]);

  const renderShell = (mode: 'inline' | 'modal') => (
    <div
      style={{
        position: mode === 'modal' ? 'fixed' : 'absolute',
        left: mode === 'modal' ? modalBounds?.left ?? 0 : element.x,
        top: mode === 'modal' ? modalBounds?.top ?? 0 : element.y,
        width: mode === 'modal' ? modalBounds?.width ?? window.innerWidth : element.width,
        height: mode === 'modal' ? modalBounds?.height ?? window.innerHeight : element.height,
        zIndex: mode === 'modal' ? 1201 : element.zIndex,
        borderRadius: 0,
        overflow: 'visible',
        boxShadow: selected && mode !== 'modal' ? '0 0 0 2px var(--primary)' : 'none',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
      }}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('input, button, select, textarea')) {
          event.stopPropagation();
          return;
        }
        if (mode === 'modal') {
          event.stopPropagation();
          return;
        }
        onPointerDown(event);
      }}
      onWheel={(event) => event.stopPropagation()}
    >
      {(selected || mode === 'modal') && (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 12 }}>
          <button
            onClick={(event) => {
              event.stopPropagation();
              if (mode === 'modal') {
                setFullscreen(false);
                return;
              }
              setModalBounds(measureModalBounds());
              setFullscreen(true);
            }}
            style={iconButtonStyle}
            title={mode === 'modal' ? 'Close fullscreen' : 'Open fullscreen'}
          >
            <Icon name={mode === 'modal' ? 'fullscreen_exit' : 'fullscreen'} size={16} />
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <DataSheetCard
          model={model}
          selected={selected}
          variant="whiteboard"
          onChange={(next) =>
            updateElement(element.id, {
              properties: {
                ...element.properties,
                model: serializeDataSheet(next),
              },
            })
          }
        />
      </div>

      {mode !== 'modal' && selected && (
        <ElementResizeHandles
          element={element}
          zoom={zoom}
          minWidth={420}
          minHeight={280}
          onResize={(updates) => updateElement(element.id, updates)}
        />
      )}
    </div>
  );

  return (
    <>
      {!fullscreen && renderShell('inline')}

      {fullscreen &&
        modalBounds &&
        createPortal(
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--backdrop)',
                zIndex: 1200,
              }}
              onPointerDown={() => setFullscreen(false)}
            />
            {renderShell('modal')}
          </>,
          document.body
        )}
    </>
  );
}

const iconButtonStyle = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-bg)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;
