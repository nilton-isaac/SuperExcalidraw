import { useEffect, useState } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
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
import { evaluateDataSheet, parseDataSheet, serializeDataSheet, type DataSheetModel } from '../../lib/dataSheet';
import { Icon } from '../Icon';

const CHART_COLORS = ['#5b8cff', '#3ecf8e', '#ff8a65', '#f7c04a', '#a17cff', '#44c5f1', '#ff6b9a', '#22c55e'];

interface DataChartCardProps {
  model: DataSheetModel;
  onChange: (next: DataSheetModel) => void;
  selected?: boolean;
}

function DataChartCard({ model, onChange, selected }: DataChartCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const evaluation = evaluateDataSheet(model);
  const selectableChartColumns = model.columns.filter((column) => column.id !== model.chart.labelColumnId);
  const activeChartSeries = evaluation.chartSeries.filter((series) =>
    model.chart.valueColumnIds.includes(series.id),
  );
  const pieData = evaluation.chartData
    .map((entry) => ({
      name: String(entry.label ?? 'Item'),
      value: activeChartSeries.reduce((sum, series) => sum + toChartNumber(entry[series.id]), 0),
    }))
    .filter((entry) => entry.value > 0);

  useEffect(() => {
    if (!selected) setSettingsOpen(false);
  }, [selected]);

  const patchChart = (patch: Partial<DataSheetModel['chart']>) => {
    onChange({
      ...model,
      chart: {
        ...model.chart,
        ...patch,
      },
    });
  };

  const handleLabelColumnChange = (labelColumnId: string) => {
    patchChart({
      labelColumnId,
      valueColumnIds: model.chart.valueColumnIds.filter((columnId) => columnId !== labelColumnId),
    });
  };

  const toggleChartValueColumn = (columnId: string) => {
    const active = model.chart.valueColumnIds.includes(columnId);
    patchChart({
      valueColumnIds: active
        ? model.chart.valueColumnIds.filter((id) => id !== columnId)
        : [...model.chart.valueColumnIds, columnId],
    });
  };

  const renderEmptyState = (message: string) => (
    <div style={chartEmptyStateStyle}>{message}</div>
  );

  const renderChartPreview = () => {
    if (activeChartSeries.length === 0) {
      return renderEmptyState('Selecione ao menos uma serie numerica para montar o grafico.');
    }

    if (evaluation.chartData.length === 0) {
      return renderEmptyState('Adicione linhas na tabela de origem para gerar o grafico.');
    }

    if (model.chart.type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={evaluation.chartData} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--doc-ink-soft)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--doc-ink-soft)' }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {activeChartSeries.map((series, index) => (
              <Line
                key={series.id}
                type="monotone"
                dataKey={series.id}
                name={series.label}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2.4}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (model.chart.type === 'pie') {
      if (pieData.length === 0) {
        return renderEmptyState('Preencha valores positivos para gerar fatias no grafico.');
      }

      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="78%" labelLine={false} label>
              {pieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={evaluation.chartData} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--doc-ink-soft)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--doc-ink-soft)' }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {activeChartSeries.map((series, index) => (
            <Bar
              key={series.id}
              dataKey={series.id}
              name={series.label}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              radius={[8, 8, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div style={{ position: 'relative', paddingTop: selected ? 42 : 0 }}>
      {selected && (
        <div style={toolbarStyle}>
          <button
            type="button"
            title="Configurar grafico"
            onClick={() => setSettingsOpen((current) => !current)}
            onPointerDown={(event) => event.stopPropagation()}
            style={iconButtonStyle}
          >
            <Icon name="tune" size={16} />
          </button>
        </div>
      )}

      {settingsOpen && (
        <div style={settingsPanelStyle} onPointerDown={(event) => event.stopPropagation()}>
          <div style={settingsTitleStyle}>Grafico</div>

          <input
            value={model.chart.title}
            onChange={(event) => patchChart({ title: event.target.value })}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder="Chart title"
            style={controlStyle}
          />

          <select
            value={model.chart.type}
            onChange={(event) => patchChart({ type: event.target.value as DataSheetModel['chart']['type'] })}
            onPointerDown={(event) => event.stopPropagation()}
            style={controlStyle}
          >
            <option value="bar">Bar chart</option>
            <option value="line">Line chart</option>
            <option value="pie">Pie chart</option>
          </select>

          <select
            value={model.chart.labelColumnId}
            onChange={(event) => handleLabelColumnChange(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            style={controlStyle}
          >
            {model.columns.map((column) => (
              <option key={column.id} value={column.id}>
                Label: {column.label}
              </option>
            ))}
          </select>

          <div style={{ display: 'grid', gap: 8 }}>
            <span style={settingsLabelStyle}>Series</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectableChartColumns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => toggleChartValueColumn(column.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{
                    ...seriesButtonStyle,
                    ...(model.chart.valueColumnIds.includes(column.id) ? activeSeriesButtonStyle : null),
                  }}
                >
                  {column.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={chartSurfaceStyle}>
        {(model.chart.title || model.title) && (
          <div style={chartTitleStyle}>{model.chart.title || model.title}</div>
        )}
        <div style={{ minHeight: 240, height: 280 }}>
          {renderChartPreview()}
        </div>
      </div>
    </div>
  );
}

export function DataChartNodeView(props: NodeViewProps) {
  const model = parseDataSheet(props.node.attrs.model);

  return (
    <NodeViewWrapper
      contentEditable={false}
      data-doc-interactive="true"
      style={{ margin: '24px 0' }}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()}
      onClick={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
    >
      <DataChartCard
        model={model}
        selected={props.selected}
        onChange={(next) => props.updateAttributes({ model: serializeDataSheet(next) })}
      />
    </NodeViewWrapper>
  );
}

function toChartNumber(value: string | number | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const numeric = Number(String(value ?? '').trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

const toolbarStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  zIndex: 3,
};

const iconButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid var(--doc-border)',
  background: 'var(--doc-canvas-bg)',
  color: 'var(--doc-ink)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const settingsPanelStyle: CSSProperties = {
  position: 'absolute',
  top: 42,
  right: 0,
  zIndex: 3,
  width: 'min(320px, 100%)',
  display: 'grid',
  gap: 10,
  padding: 12,
  border: '1px solid var(--doc-border)',
  background: 'var(--doc-canvas-bg)',
};

const settingsTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--doc-ink)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const settingsLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--doc-ink-soft)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const controlStyle: CSSProperties = {
  width: '100%',
  height: 34,
  border: '1px solid var(--doc-border)',
  background: 'transparent',
  color: 'var(--doc-ink)',
  padding: '0 10px',
  fontSize: 12,
  outline: 'none',
};

const seriesButtonStyle: CSSProperties = {
  height: 28,
  padding: '0 10px',
  border: '1px solid var(--doc-border)',
  background: 'transparent',
  color: 'var(--doc-ink-soft)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
};

const activeSeriesButtonStyle: CSSProperties = {
  color: 'var(--doc-ink)',
  borderColor: 'var(--doc-ink)',
};

const chartSurfaceStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minHeight: 280,
  border: '1px solid var(--doc-border)',
  background: 'transparent',
  padding: '10px 8px 8px',
};

const chartTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--doc-ink)',
  padding: '0 4px',
};

const chartEmptyStateStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 24,
  color: 'var(--doc-ink-soft)',
  fontSize: 13,
};
