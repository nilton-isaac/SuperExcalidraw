import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartElement, PieMode } from '../../types';
import { useStore } from '../../store/useStore';
import { evaluateDataSheet, getResolvedDataSheetCell, parseDataSheet } from '../../lib/dataSheet';
import { Icon } from '../Icon';
import { ElementResizeHandles } from './ElementResizeHandles';

interface Props {
  element: ChartElement;
  selected: boolean;
  zoom?: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

interface ChartColumn {
  id: string;
  label: string;
  index: number;
}

interface RowSeries {
  id: string;
  label: string;
  values: Record<string, number>;
  lineValues: Record<string, number | null>;
}

const DEFAULT_COLORS = ['#5b8cff', '#3ecf8e', '#ff8a65', '#f7c04a', '#a17cff', '#44c5f1', '#ff6b9a', '#22c55e'];

export function ChartElementComponent({ element, selected, zoom = 1, onPointerDown }: Props) {
  const { elements, updateElement } = useStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [modalBounds, setModalBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const tables = elements.filter((candidate) => candidate.type === 'table');
  const sourceTable = tables.find((candidate) => candidate.id === element.properties.sourceTableId) ?? tables[0];
  const sourceModel = sourceTable ? parseDataSheet(sourceTable.properties.model) : null;
  const evaluation = sourceModel ? evaluateDataSheet(sourceModel) : null;
  const fallbackLabelColumnId = sourceModel?.columns[0]?.id;
  const labelColumnId = element.properties.labelColumnId ?? fallbackLabelColumnId;
  const pieMode = element.properties.pieMode ?? 'row-total';

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

  const selectableValueColumns = sourceModel
    ? sourceModel.columns
        .map((column, index) => ({ ...column, index }))
        .filter((column) => column.id !== labelColumnId)
    : [];

  const valueColumnIds = (element.properties.valueColumnIds?.length
    ? element.properties.valueColumnIds
    : selectableValueColumns.map((column) => column.id)
  ).filter((columnId) => selectableValueColumns.some((column) => column.id === columnId));

  const valueColumns = valueColumnIds
    .map((columnId) => selectableValueColumns.find((column) => column.id === columnId))
    .filter((column): column is ChartColumn => Boolean(column));

  const labelColumnIndex = sourceModel
    ? Math.max(0, sourceModel.columns.findIndex((column) => column.id === labelColumnId))
    : 0;

  const rowSeries = sourceModel && evaluation
    ? sourceModel.rows.map((row, rowIndex) => {
        const values = Object.fromEntries(
          valueColumns.map((column) => [column.id, getNumericCellValue(evaluation, rowIndex, column.index)])
        );
        const lineValues = Object.fromEntries(
          valueColumns.map((column) => [column.id, getLineCellValue(sourceModel, evaluation, rowIndex, column.index)])
        );

        return {
          id: row.id,
          label: getRowLabel(evaluation, rowIndex, labelColumnIndex),
          values,
          lineValues,
        };
      })
    : [];

  const visibleLineSeries = rowSeries.filter((row) =>
    Object.values(row.lineValues).some((value) => value != null)
  );

  const linePointColumns = valueColumns.filter((column) =>
    visibleLineSeries.some((row) => row.lineValues[column.id] != null)
  );

  const barData = rowSeries.map((row) => {
    const entry: Record<string, string | number> = { name: row.label };
    valueColumns.forEach((column) => {
      entry[column.id] = row.values[column.id] ?? 0;
    });
    return entry;
  });

  const lineData = linePointColumns.map((column) => {
    const entry: Record<string, string | number | null> = { name: column.label };
    visibleLineSeries.forEach((row) => {
      entry[row.id] = row.lineValues[column.id] ?? null;
    });
    return entry;
  });

  const pieData = buildPieData({
    pieMode,
    rowSeries,
    valueColumns,
  });

  const patchProperties = (patch: Partial<ChartElement['properties']>) => {
    updateElement(element.id, {
      properties: {
        ...element.properties,
        ...patch,
      },
    });
  };

  const handleSourceTableChange = (tableId: string) => {
    const nextTable = tables.find((candidate) => candidate.id === tableId);
    const nextModel = nextTable ? parseDataSheet(nextTable.properties.model) : null;
    const nextLabelColumnId = nextModel?.columns[0]?.id;

    patchProperties({
      sourceTableId: nextTable?.id,
      labelColumnId: nextLabelColumnId,
      valueColumnIds: nextModel?.columns.filter((column) => column.id !== nextLabelColumnId).map((column) => column.id) ?? [],
    });
  };

  const handleLabelColumnChange = (nextLabelColumnId: string) => {
    patchProperties({
      labelColumnId: nextLabelColumnId,
      valueColumnIds: valueColumnIds.filter((columnId) => columnId !== nextLabelColumnId),
    });
  };

  const toggleValueColumn = (columnId: string) => {
    const active = valueColumnIds.includes(columnId);
    patchProperties({
      valueColumnIds: active
        ? valueColumnIds.filter((id) => id !== columnId)
        : [...valueColumnIds, columnId],
    });
  };

  const renderEmptyState = (message: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        fontSize: 13,
        textAlign: 'center',
        padding: 24,
      }}
    >
      {message}
    </div>
  );

  const renderChart = () => {
    if (!sourceModel) {
      return renderEmptyState('Select a table to feed this chart');
    }

    if (valueColumns.length === 0) {
      return renderEmptyState(
        element.properties.chartType === 'line'
          ? 'Select the columns that will become the timeline points'
          : 'Select at least one value column'
      );
    }

    if (element.properties.chartType === 'line') {
      if (visibleLineSeries.length === 0 || linePointColumns.length === 0) {
        return renderEmptyState('Fill the selected columns with numeric values to draw the lines');
      }

      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {visibleLineSeries.map((series, index) => (
              <Line
                key={series.id}
                type="linear"
                dataKey={series.id}
                name={series.label}
                stroke={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                strokeWidth={2.4}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (element.properties.chartType === 'pie') {
      if (pieData.length === 0) {
        return renderEmptyState(
          pieMode === 'column-total'
            ? 'Choose value columns with positive totals to build the pie'
            : 'Add labeled rows and values to build the pie'
        );
      }

      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="72%" labelLine={false} label>
              {pieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (barData.length === 0) {
      return renderEmptyState('Add rows to the table to compare values');
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {valueColumns.map((series, index) => (
            <Bar
              key={series.id}
              dataKey={series.id}
              name={series.label}
              fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              radius={[8, 8, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const chartExplanation = getChartExplanation(element.properties.chartType, pieMode);
  const labelControlLabel =
    element.properties.chartType === 'line'
      ? 'Line name column'
      : element.properties.chartType === 'pie' && pieMode === 'column-total'
        ? ''
        : 'Item label column';
  const metricLabel =
    element.properties.chartType === 'line'
      ? 'Point columns'
      : element.properties.chartType === 'pie'
        ? pieMode === 'column-total'
          ? 'Metric slices'
          : 'Columns summed in each slice'
        : 'Value columns';

  const renderShell = (mode: 'inline' | 'modal') => (
    <div
      style={{
        position: mode === 'modal' ? 'fixed' : 'absolute',
        left: mode === 'modal' ? modalBounds?.left ?? 0 : element.x,
        top: mode === 'modal' ? modalBounds?.top ?? 0 : element.y,
        width: mode === 'modal' ? modalBounds?.width ?? window.innerWidth : element.width,
        height: mode === 'modal' ? modalBounds?.height ?? window.innerHeight : element.height,
        zIndex: mode === 'modal' ? 1201 : element.zIndex,
        border: selected || mode === 'modal' ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
        borderRadius: 24,
        background: 'var(--glass-bg)',
        boxShadow: selected || mode === 'modal' ? 'var(--shadow-lg)' : 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'move',
        userSelect: 'none',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
      }}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('input, button, select')) {
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
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 14px',
          borderBottom: '1px solid var(--glass-border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Icon name="insert_chart" size={16} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {element.properties.title || sourceModel?.title || 'Chart'}
          </span>
        </div>

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

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '180px minmax(0, 1fr)',
        }}
      >
        <div
          style={{
            borderRight: '1px solid var(--glass-border)',
            padding: 12,
            display: 'grid',
            gap: 10,
            alignContent: 'start',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)',
            overflowY: 'auto',
          }}
        >
          <div style={sectionEyebrowStyle}>Chart Source</div>

          <input
            value={element.properties.title ?? ''}
            onChange={(event) => patchProperties({ title: event.target.value })}
            placeholder="Chart title"
            style={controlStyle}
          />

          <select
            value={sourceTable?.id ?? ''}
            onChange={(event) => handleSourceTableChange(event.target.value)}
            style={controlStyle}
          >
            <option value="">Select table</option>
            {tables.map((table) => {
              const tableModel = parseDataSheet(table.properties.model);
              return (
                <option key={table.id} value={table.id}>
                  {tableModel.title || 'Untitled Sheet'}
                </option>
              );
            })}
          </select>

          <select
            value={element.properties.chartType}
            onChange={(event) => patchProperties({ chartType: event.target.value as ChartElement['properties']['chartType'] })}
            style={controlStyle}
          >
            <option value="bar">Bar chart</option>
            <option value="line">Line chart</option>
            <option value="pie">Pie chart</option>
          </select>

          <div style={helperTextStyle}>{chartExplanation}</div>

          {sourceModel && (
            <>
              {element.properties.chartType === 'pie' && (
                <>
                  <div style={fieldLabelStyle}>Pie mode</div>
                  <select
                    value={pieMode}
                    onChange={(event) => patchProperties({ pieMode: event.target.value as PieMode })}
                    style={controlStyle}
                  >
                    <option value="row-total">Slice per item total</option>
                    <option value="column-total">Slice per metric total</option>
                  </select>
                </>
              )}

              {labelControlLabel && (
                <>
                  <div style={fieldLabelStyle}>{labelControlLabel}</div>
                  <select
                    value={labelColumnId ?? ''}
                    onChange={(event) => handleLabelColumnChange(event.target.value)}
                    style={controlStyle}
                  >
                    {sourceModel.columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div style={fieldLabelStyle}>{metricLabel}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {selectableValueColumns.map((column) => {
                  const active = valueColumnIds.includes(column.id);
                  return (
                    <button
                      key={column.id}
                      onClick={() => toggleValueColumn(column.id)}
                      style={{
                        height: 30,
                        borderRadius: 999,
                        border: active ? '1px solid color-mix(in srgb, var(--primary) 65%, transparent)' : '1px solid var(--glass-border)',
                        background: active ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'rgba(255,255,255,0.06)',
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {column.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ minWidth: 0, minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)' }}>
          <div style={{ padding: '12px 14px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {element.properties.title || sourceModel?.title || 'Chart'}
          </div>
          <div style={{ minHeight: 0, padding: 8 }}>{renderChart()}</div>
        </div>
      </div>

      {mode !== 'modal' && selected && (
        <ElementResizeHandles
          element={element}
          zoom={zoom}
          minWidth={420}
          minHeight={260}
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

function getRowLabel(
  evaluation: ReturnType<typeof evaluateDataSheet>,
  rowIndex: number,
  labelColumnIndex: number
) {
  const candidate = String(evaluation.displayRows[rowIndex]?.[labelColumnIndex] ?? '').trim();
  return candidate || `Item ${rowIndex + 1}`;
}

function getNumericCellValue(
  evaluation: ReturnType<typeof evaluateDataSheet>,
  rowIndex: number,
  columnIndex: number
) {
  const candidate = evaluation.displayRows[rowIndex]?.[columnIndex] ?? '';
  return parseChartNumber(candidate);
}

function getLineCellValue(
  model: NonNullable<ReturnType<typeof parseDataSheet>>,
  evaluation: ReturnType<typeof evaluateDataSheet>,
  rowIndex: number,
  columnIndex: number
) {
  const source = getResolvedDataSheetCell(model, rowIndex, columnIndex).trim();
  if (!source) {
    return null;
  }

  const candidate = evaluation.displayRows[rowIndex]?.[columnIndex] ?? '';
  const numeric = parseChartNumber(candidate);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseChartNumber(value: string | number) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = value.trim().replace(/\s+/g, '').replace(/,/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildPieData({
  pieMode,
  rowSeries,
  valueColumns,
}: {
  pieMode: PieMode;
  rowSeries: RowSeries[];
  valueColumns: ChartColumn[];
}) {
  const rawData =
    pieMode === 'column-total'
      ? valueColumns.map((column) => ({
          name: column.label,
          value: rowSeries.reduce((sum, row) => sum + (row.values[column.id] ?? 0), 0),
        }))
      : rowSeries.map((row) => ({
          name: row.label,
          value: valueColumns.reduce((sum, column) => sum + (row.values[column.id] ?? 0), 0),
        }));

  return rawData.filter((entry) => entry.value > 0);
}

function getChartExplanation(chartType: ChartElement['properties']['chartType'], pieMode: PieMode) {
  if (chartType === 'line') {
    return 'Each row becomes one line. The selected columns become the points across the x-axis, so they can represent days, hours, or stages.';
  }

  if (chartType === 'pie') {
    return pieMode === 'column-total'
      ? 'Each slice is one metric column, aggregated across all rows in the source table.'
      : 'Each slice is one item row, using the sum of the selected metric columns.';
  }

  return 'Each row is one item on the x-axis. The selected value columns are compared side by side.';
}

const sectionEyebrowStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
} as const;

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-secondary)',
} as const;

const helperTextStyle = {
  fontSize: 11,
  lineHeight: 1.55,
  color: 'var(--text-muted)',
  padding: '2px 2px 0',
} as const;

const controlStyle = {
  width: '100%',
  height: 34,
  borderRadius: 12,
  border: '1px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  fontSize: 11,
  outline: 'none',
} as const;

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
