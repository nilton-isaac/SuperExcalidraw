import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartElement } from '../../types';
import { useStore } from '../../store/useStore';

interface Props {
  element: ChartElement;
  selected: boolean;
  zoom?: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

const DEFAULT_COLORS = ['#2563eb', '#16a34a', '#ef4444', '#f59e0b', '#9333ea', '#06b6d4'];

export function ChartElementComponent({ element, selected, onPointerDown }: Props) {
  const { updateElement } = useStore();
  const [editingJson, setEditingJson] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState('');

  const { properties } = element;
  const { chartType, title, labels, datasets } = properties;

  // Build recharts data
  const chartData = labels.map((label, idx) => {
    const entry: Record<string, string | number> = { name: label };
    datasets.forEach((ds) => {
      entry[ds.label] = ds.data[idx] ?? 0;
    });
    return entry;
  });

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setJsonDraft(JSON.stringify({ labels, datasets }, null, 2));
    setJsonError('');
    setEditingJson(true);
  };

  const commitJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as { labels: string[]; datasets: { label: string; data: number[]; color?: string }[] };
      if (!Array.isArray(parsed.labels) || !Array.isArray(parsed.datasets)) {
        setJsonError('Must have "labels" array and "datasets" array.');
        return;
      }
      updateElement(element.id, {
        properties: { ...properties, labels: parsed.labels, datasets: parsed.datasets },
      });
      setEditingJson(false);
    } catch {
      setJsonError('Invalid JSON.');
    }
  };

  const renderChart = () => {
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {datasets.map((ds, idx) => (
              <Bar key={ds.label} dataKey={ds.label} fill={ds.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {datasets.map((ds, idx) => (
              <Line
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stroke={ds.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Pie chart - use first dataset
    const pieData = labels.map((label, idx) => ({
      name: label,
      value: datasets[0]?.data[idx] ?? 0,
    }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {pieData.map((_entry, idx) => (
              <Cell key={idx} fill={datasets[0]?.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        border: selected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
        borderRadius: 12,
        background: 'var(--bg-primary)',
        boxShadow: selected ? 'var(--shadow-md)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'move',
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {title && (
        <div
          style={{
            padding: '6px 10px 2px',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ flex: 1, padding: '4px 4px 4px 0', minHeight: 0 }}>
        {renderChart()}
      </div>

      {/* JSON Editor Modal */}
      {editingJson && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--backdrop)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              padding: 20,
              width: 480,
              maxWidth: '90vw',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Chart Data (JSON)</div>
            <textarea
              value={jsonDraft}
              onChange={(e) => { setJsonDraft(e.target.value); setJsonError(''); }}
              style={{
                width: '100%',
                height: 240,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                padding: 10,
                resize: 'vertical',
                outline: 'none',
              }}
            />
            {jsonError && (
              <div style={{ fontSize: 12, color: '#ef4444' }}>{jsonError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingJson(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={commitJson}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--primary)',
                  background: 'var(--primary)',
                  color: 'var(--primary-contrast)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
