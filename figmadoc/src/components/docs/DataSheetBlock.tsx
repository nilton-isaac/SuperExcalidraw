import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  createDataSheetColumn,
  createDataSheetRow,
  evaluateDataSheet,
  getResolvedDataSheetCell,
  isFormulaCell,
  parseDataSheet,
  serializeDataSheet,
  type DataSheetModel,
} from '../../lib/dataSheet';
import { Icon } from '../Icon';

interface DataSheetCardProps {
  model: DataSheetModel;
  onChange: (next: DataSheetModel) => void;
  selected?: boolean;
}

export function DataSheetCard({ model, onChange, selected }: DataSheetCardProps) {
  const evaluation = evaluateDataSheet(model);

  const patchModel = (patch: Partial<DataSheetModel>) => {
    onChange({
      ...model,
      ...patch,
    });
  };

  const patchColumns = (columns: DataSheetModel['columns']) => {
    onChange({
      ...model,
      columns,
      rows: model.rows.map((row) => ({
        ...row,
        cells: Array.from({ length: columns.length }, (_, index) => row.cells[index] ?? ''),
      })),
      chart: {
        ...model.chart,
        labelColumnId: columns.some((column) => column.id === model.chart.labelColumnId)
          ? model.chart.labelColumnId
          : columns[0].id,
        valueColumnIds: model.chart.valueColumnIds.filter((columnId) =>
          columns.some((column) => column.id === columnId)
        ),
      },
    });
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    onChange({
      ...model,
      rows: model.rows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? {
              ...row,
              cells: row.cells.map((cell, currentColumnIndex) =>
                currentColumnIndex === columnIndex ? value : cell
              ),
            }
          : row
      ),
    });
  };

  const addColumn = () => {
    const nextColumn = createDataSheetColumn(`Column ${model.columns.length + 1}`);
    patchColumns([...model.columns, nextColumn]);
  };

  const removeColumn = (columnIndex: number) => {
    if (model.columns.length <= 1) return;
    patchColumns(model.columns.filter((_column, currentIndex) => currentIndex !== columnIndex));
  };

  const addRow = () => {
    patchModel({
      rows: [...model.rows, createDataSheetRow(model.columns.length)],
    });
  };

  const removeRow = (rowIndex: number) => {
    if (model.rows.length <= 1) return;
    patchModel({
      rows: model.rows.filter((_row, currentIndex) => currentIndex !== rowIndex),
    });
  };

  const updateColumnLabel = (columnIndex: number, label: string) => {
    patchColumns(
      model.columns.map((column, currentIndex) =>
        currentIndex === columnIndex
          ? {
              ...column,
              label,
            }
          : column
      )
    );
  };

  const updateColumnAutoFormula = (columnIndex: number, autoFormula: string) => {
    patchColumns(
      model.columns.map((column, currentIndex) =>
        currentIndex === columnIndex
          ? {
              ...column,
              autoFormula,
            }
          : column
      )
    );
  };

  return (
    <div
      style={{
        borderRadius: 24,
        border: selected ? '1px solid color-mix(in srgb, var(--primary) 55%, white)' : '1px solid var(--glass-border)',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 92%, white), color-mix(in srgb, var(--glass-bg) 70%, transparent))',
        boxShadow: selected ? '0 24px 60px rgba(15, 23, 42, 0.18)' : '0 18px 48px rgba(15, 23, 42, 0.1)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '12px 14px 10px',
          borderBottom: '1px solid var(--glass-border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.14), transparent)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 260px' }}>
          <div style={sheetBadgeStyle}>
            <Icon name="table_chart" size={14} />
            Sheet
          </div>
          <div style={{ minWidth: 0, display: 'grid', gap: 2, flex: 1 }}>
            <input
              value={model.title}
              onChange={(event) => patchModel({ title: event.target.value })}
              placeholder="Untitled table"
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                ...sheetTitleInputStyle,
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Primeira linha para colunas. Primeira coluna para nomes. Fórmulas automáticas por coluna: `=B+C` ou `=SUM(B:D)`.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={sheetMetaPillStyle}>{model.rows.length} linhas</span>
          <span style={sheetMetaPillStyle}>{model.columns.length} colunas</span>
          <TinyButton icon="view_column" label="Column" onClick={addColumn} />
          <TinyButton icon="add_row_below" label="Row" onClick={addRow} />
        </div>
      </div>

      <div style={{ overflow: 'auto', padding: 12 }}>
        <table
          style={{
            width: '100%',
            minWidth: Math.max(520, model.columns.length * 160 + 72),
            borderCollapse: 'separate',
            borderSpacing: 0,
            tableLayout: 'fixed',
            border: '1px solid color-mix(in srgb, var(--glass-border) 92%, transparent)',
            borderRadius: 20,
            overflow: 'hidden',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 86%, transparent), color-mix(in srgb, var(--surface-floating) 80%, transparent))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          <thead>
            <tr>
              <th style={cornerHeaderStyle}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
                  <span style={axisHintStyle}>Rows</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>#</span>
                </div>
              </th>
              {model.columns.map((column, columnIndex) => (
                <th key={column.id} style={columnHeaderStyle}>
                  <div style={{ display: 'grid', gap: columnIndex === 0 ? 0 : 8 }}>
                    <div style={columnHeaderInnerStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <span style={columnTagStyle}>{String.fromCharCode(65 + columnIndex)}</span>
                        <input
                          value={column.label}
                          onChange={(event) => updateColumnLabel(columnIndex, event.target.value)}
                          onPointerDown={(event) => event.stopPropagation()}
                          placeholder={columnIndex === 0 ? 'Primary column' : `Column ${columnIndex}`}
                          style={columnHeaderInputStyle}
                        />
                      </div>
                      {model.columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeColumn(columnIndex)}
                          onPointerDown={(event) => event.stopPropagation()}
                          style={ghostIconButtonStyle}
                          title="Remove column"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      )}
                    </div>

                    {columnIndex > 0 && (
                      <div style={autoFormulaRowStyle}>
                        <span style={autoFormulaTagStyle}>fx</span>
                        <input
                          value={column.autoFormula ?? ''}
                          onChange={(event) => updateColumnAutoFormula(columnIndex, event.target.value)}
                          onPointerDown={(event) => event.stopPropagation()}
                          placeholder="=B+C or =SUM(B:D)"
                          style={autoFormulaInputStyle}
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td style={rowHeaderStyle}>
                  <div style={rowHeaderInnerStyle}>
                    <span style={rowIndexPillStyle}>{rowIndex + 1}</span>
                    {model.rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(rowIndex)}
                        onPointerDown={(event) => event.stopPropagation()}
                        style={ghostIconButtonStyle}
                        title="Remove row"
                      >
                        <Icon name="remove" size={14} />
                      </button>
                    )}
                  </div>
                </td>
                {model.columns.map((column, columnIndex) => {
                  const cellKey = `${rowIndex}:${columnIndex}`;
                  const rawValue = row.cells[columnIndex] ?? '';
                  const resolvedValue = getResolvedDataSheetCell(model, rowIndex, columnIndex);
                  const formulaValue = evaluation.formulaResults[cellKey];
                  const error = evaluation.errors[cellKey];
                  const usesAutoFormula = !rawValue.trim() && Boolean(column.autoFormula?.trim());
                  const displayedValue = usesAutoFormula
                    ? evaluation.displayRows[rowIndex]?.[columnIndex] ?? ''
                    : rawValue;
                  const showsFormulaResult = !usesAutoFormula && isFormulaCell(rawValue);

                  return (
                    <td
                      key={`${row.id}-${column.id}`}
                      style={columnIndex === 0 ? primaryCellStyle : cellStyle}
                    >
                      <div style={{ position: 'relative' }}>
                        <input
                          value={displayedValue}
                          onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                          onPointerDown={(event) => event.stopPropagation()}
                          placeholder={columnIndex === 0 ? 'Row label' : ''}
                          style={
                            columnIndex === 0
                              ? primaryCellInputStyle
                              : usesAutoFormula
                                ? autoComputedCellInputStyle
                                : cellInputStyle
                          }
                        />
                        {error && (
                          <div style={{ ...formulaBadgeStyle, color: error ? '#ffb0a8' : 'var(--text-secondary)' }}>
                            {error}
                          </div>
                        )}
                        {!error && usesAutoFormula && isFormulaCell(resolvedValue) && (
                          <div style={formulaBadgeStyle}>
                            Auto
                          </div>
                        )}
                        {!error && showsFormulaResult && (
                          <div style={formulaBadgeStyle}>
                            {formulaValue}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td style={bottomActionLabelCellStyle}>
                <span style={axisHintStyle}>More</span>
              </td>
              <td colSpan={model.columns.length} style={bottomActionCellStyle}>
                <button
                  type="button"
                  onClick={addRow}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={bottomActionButtonStyle}
                >
                  <Icon name="add" size={16} />
                  Add row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}

export function DataSheetNodeView(props: NodeViewProps) {
  const model = parseDataSheet(props.node.attrs.model);

  return (
    <NodeViewWrapper
      style={{
        margin: '24px 0',
      }}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()}
    >
      <DataSheetCard
        model={model}
        selected={props.selected}
        onChange={(next) => props.updateAttributes({ model: serializeDataSheet(next) })}
      />
    </NodeViewWrapper>
  );
}

function TinyButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        borderRadius: 999,
        border: active ? '1px solid color-mix(in srgb, var(--primary) 65%, transparent)' : '1px solid var(--glass-border)',
        background: active ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'rgba(255,255,255,0.05)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: 34,
  borderRadius: 12,
  border: '1px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
  fontSize: 12,
};

const sheetTitleInputStyle: CSSProperties = {
  ...inputStyle,
  height: 28,
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontSize: 15,
  fontWeight: 700,
};

const sheetBadgeStyle: CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--glass-border) 90%, transparent)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
};

const sheetMetaPillStyle: CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--glass-border) 82%, transparent)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 11,
  fontWeight: 600,
};

const axisHintStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

const cornerHeaderStyle: CSSProperties = {
  width: 72,
  minWidth: 72,
  padding: '14px 10px',
  textAlign: 'center',
  verticalAlign: 'middle',
  borderRight: '1px solid color-mix(in srgb, var(--glass-border) 80%, transparent)',
  borderBottom: '1px solid color-mix(in srgb, var(--glass-border) 82%, transparent)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 82%, rgba(255,255,255,0.08)), color-mix(in srgb, var(--surface-elevated) 76%, transparent))',
  position: 'sticky',
  top: 0,
  left: 0,
  zIndex: 4,
};

const rowHeaderStyle: CSSProperties = {
  width: 72,
  minWidth: 72,
  padding: '12px 10px',
  borderRight: '1px solid color-mix(in srgb, var(--glass-border) 80%, transparent)',
  borderBottom: '1px solid color-mix(in srgb, var(--glass-border) 82%, transparent)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 80%, rgba(255,255,255,0.08)), color-mix(in srgb, var(--surface-elevated) 72%, transparent))',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: 'middle',
  position: 'sticky',
  left: 0,
  zIndex: 3,
};

const columnHeaderStyle: CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid color-mix(in srgb, var(--glass-border) 82%, transparent)',
  borderRight: '1px solid color-mix(in srgb, var(--glass-border) 72%, transparent)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 85%, rgba(255,255,255,0.1)), color-mix(in srgb, var(--surface-elevated) 76%, transparent))',
  minWidth: 160,
  textAlign: 'left',
  position: 'sticky',
  top: 0,
  zIndex: 2,
};

const cellStyle: CSSProperties = {
  padding: 0,
  borderBottom: '1px solid color-mix(in srgb, var(--glass-border) 78%, transparent)',
  borderRight: '1px solid color-mix(in srgb, var(--glass-border) 68%, transparent)',
  background: 'color-mix(in srgb, var(--surface-elevated) 74%, transparent)',
  verticalAlign: 'middle',
};

const primaryCellStyle: CSSProperties = {
  ...cellStyle,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 86%, rgba(255,255,255,0.05)), color-mix(in srgb, var(--surface-elevated) 82%, transparent))',
};

const rowHeaderInnerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
};

const rowIndexPillStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.09)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
};

const columnHeaderInnerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const columnTagStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
};

const columnHeaderInputStyle: CSSProperties = {
  ...inputStyle,
  height: 32,
  padding: 0,
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  fontSize: 13,
  fontWeight: 700,
};

const autoFormulaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  paddingTop: 2,
};

const autoFormulaTagStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  flexShrink: 0,
};

const autoFormulaInputStyle: CSSProperties = {
  ...inputStyle,
  height: 28,
  padding: '0 10px',
  fontSize: 11,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
};

const cellInputStyle: CSSProperties = {
  ...inputStyle,
  height: 46,
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  padding: '0 14px',
  fontSize: 13,
  fontWeight: 500,
};

const autoComputedCellInputStyle: CSSProperties = {
  ...cellInputStyle,
  color: 'var(--text-secondary)',
  fontStyle: 'italic',
};

const primaryCellInputStyle: CSSProperties = {
  ...cellInputStyle,
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const formulaBadgeStyle: CSSProperties = {
  position: 'absolute',
  right: 12,
  top: 8,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.02em',
  pointerEvents: 'none',
};

const ghostIconButtonStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const bottomActionLabelCellStyle: CSSProperties = {
  ...rowHeaderStyle,
  borderBottom: 'none',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 76%, rgba(255,255,255,0.06)), color-mix(in srgb, var(--surface-elevated) 72%, transparent))',
};

const bottomActionCellStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: 'none',
  background: 'color-mix(in srgb, var(--surface-elevated) 74%, transparent)',
};

const bottomActionButtonStyle: CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px dashed color-mix(in srgb, var(--glass-border) 92%, transparent)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
};
