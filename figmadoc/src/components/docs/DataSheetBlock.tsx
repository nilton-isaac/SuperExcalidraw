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
  variant?: 'document' | 'whiteboard';
  onInsertChart?: () => void;
}

export function DataSheetCard({
  model,
  onChange,
  selected,
  variant = 'whiteboard',
  onInsertChart,
}: DataSheetCardProps) {
  const evaluation = evaluateDataSheet(model);
  const isPresentation = model.displayMode === 'presentation';
  const isDocument = variant === 'document';
  const usesBareShell = isDocument || variant === 'whiteboard';
  const [sheetControlsOpen, setSheetControlsOpen] = useState(false);
  const [chartControlsOpen, setChartControlsOpen] = useState(false);

  useEffect(() => {
    if (!selected) {
      setSheetControlsOpen(false);
      setChartControlsOpen(false);
    }
  }, [selected]);

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

  const patchChart = (patch: Partial<DataSheetModel['chart']>) => {
    patchModel({
      chart: {
        ...model.chart,
        ...patch,
      },
    });
  };

  const toggleDisplayMode = () => {
    if (!isPresentation) {
      setSheetControlsOpen(false);
      setChartControlsOpen(false);
    }
    patchModel({
      displayMode: isPresentation ? 'editor' : 'presentation',
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

  const selectableChartColumns = model.columns.filter((column) => column.id !== model.chart.labelColumnId);
  const activeChartSeries = evaluation.chartSeries.filter((series) =>
    model.chart.valueColumnIds.includes(series.id)
  );
  const pieData = buildPieChartData(evaluation.chartData, activeChartSeries);
  const showFloatingToolbar = isDocument
    ? Boolean(selected) && !isPresentation
    : Boolean(selected) || sheetControlsOpen || chartControlsOpen;
  const showAdvancedChrome = !isPresentation && sheetControlsOpen;

  const toggleChartVisibility = () => {
    const nextVisible = !model.chart.visible;
    patchChart({ visible: nextVisible });
    setChartControlsOpen(nextVisible);
    if (!nextVisible) {
      setSheetControlsOpen(false);
    }
  };

  const renderChartPreview = () => {
    if (activeChartSeries.length === 0) {
      return <div style={chartEmptyStateStyle}>Selecione ao menos uma coluna numÃ©rica para construir o grÃ¡fico.</div>;
    }

    if (evaluation.chartData.length === 0) {
      return <div style={chartEmptyStateStyle}>Adicione algumas linhas na tabela para gerar a visualizaÃ§Ã£o.</div>;
    }

    if (model.chart.type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={evaluation.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
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
        return <div style={chartEmptyStateStyle}>Preencha valores positivos para gerar fatias no grÃ¡fico.</div>;
      }

      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="72%" labelLine={false} label>
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
        <BarChart data={evaluation.chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
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
    <div
      style={{
        position: 'relative',
        borderRadius: usesBareShell ? 0 : 24,
        border: usesBareShell
          ? 'none'
          : selected ? '1px solid color-mix(in srgb, var(--primary) 55%, white)' : '1px solid var(--glass-border)',
        background: usesBareShell
          ? 'transparent'
          : isPresentation
            ? 'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 98%, white), color-mix(in srgb, var(--surface-elevated) 92%, transparent))'
            : 'linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 96%, white), color-mix(in srgb, var(--surface-elevated) 90%, transparent))',
        boxShadow: usesBareShell
          ? 'none'
          : selected
            ? '0 24px 60px rgba(15, 23, 42, 0.18)'
            : isPresentation
              ? '0 24px 60px rgba(15, 23, 42, 0.12)'
              : '0 18px 48px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'none',
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
            <Icon name={isPresentation ? 'dashboard' : 'table_chart'} size={14} />
            {isPresentation ? 'Present' : 'Sheet'}
          </div>
          <div style={{ minWidth: 0, display: 'grid', gap: 2, flex: 1 }}>
            <input
              value={model.title}
              readOnly={isPresentation}
              onChange={(event) => patchModel({ title: event.target.value })}
              placeholder="Untitled table"
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                ...sheetTitleInputStyle,
                ...(isPresentation ? presentationTitleStyle : null),
                pointerEvents: isPresentation ? 'none' : 'auto',
                fontSize: isPresentation ? 18 : sheetTitleInputStyle.fontSize,
                fontWeight: 700,
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: isPresentation ? 'none' : 'block' }}>
              Primeira linha para colunas. Primeira coluna para nomes. Fórmulas automáticas por coluna: `=B+C` ou `=SUM(B:D)`.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={sheetMetaPillStyle}>{model.rows.length} linhas</span>
          <span style={sheetMetaPillStyle}>{model.columns.length} colunas</span>
          <TinyButton
            icon={isPresentation ? 'edit' : 'slideshow'}
            label={isPresentation ? 'Edit' : 'Present'}
            onClick={toggleDisplayMode}
            active={isPresentation}
          />
          <TinyButton
            icon="bar_chart"
            label={model.chart.visible ? 'Preview' : 'Chart'}
            onClick={() => patchChart({ visible: !model.chart.visible })}
            active={model.chart.visible}
          />
          {!isPresentation && <TinyButton icon="view_column" label="Column" onClick={addColumn} />}
          {!isPresentation && <TinyButton icon="add_row_below" label="Row" onClick={addRow} />}
        </div>
      </div>

      {showFloatingToolbar && (
        <div style={floatingToolbarStyle}>
          {!isPresentation && !isDocument && (
            <FloatingIconButton
              icon="tune"
              title="Configurar tabela"
              active={sheetControlsOpen}
              onClick={() => {
                setSheetControlsOpen((current) => !current);
                setChartControlsOpen(false);
              }}
            />
          )}
          {!isPresentation && isDocument && (
            <>
              <TinyButton icon="add_row_below" label="Linha" onClick={addRow} />
              <TinyButton icon="view_column" label="Coluna" onClick={addColumn} />
            </>
          )}
          {false && !isPresentation && isDocument && onInsertChart && (
            <FloatingIconButton
              icon="insert_chart"
              title="Inserir gráfico separado"
              onClick={() => onInsertChart?.()}
            />
          )}
          {!isPresentation && !isDocument && (
            <FloatingIconButton
              icon={model.chart.visible ? 'bar_chart' : 'insert_chart'}
              title={model.chart.visible ? 'Ocultar gráfico' : 'Mostrar gráfico'}
              active={model.chart.visible}
              onClick={toggleChartVisibility}
            />
          )}
          {!isDocument && !isPresentation && model.chart.visible && (
            <FloatingIconButton
              icon="tune"
              title="Configurar gráfico"
              active={chartControlsOpen}
              onClick={() => {
                setChartControlsOpen((current) => !current);
                setSheetControlsOpen(false);
              }}
            />
          )}
          {!isDocument && (
            <FloatingIconButton
            icon={isPresentation ? 'edit' : 'slideshow'}
            title={isPresentation ? 'Voltar para edição' : 'Modo apresentação'}
            active={isPresentation}
            onClick={toggleDisplayMode}
            />
          )}
        </div>
      )}

      {!isDocument && !isPresentation && sheetControlsOpen && (
        <div
          style={{ ...floatingPanelStyle, top: 52, right: 12 }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div style={floatingPanelTitleStyle}>Tabela</div>
          <input
            value={model.title}
            onChange={(event) => patchModel({ title: event.target.value })}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder="Untitled table"
            style={chartControlInputStyle}
          />
          <div style={floatingPanelMetaStyle}>
            {model.rows.length} linhas · {model.columns.length} colunas
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TinyButton icon="add_row_below" label="Row" onClick={addRow} />
            <TinyButton icon="view_column" label="Column" onClick={addColumn} />
          </div>
          <div style={floatingPanelHintStyle}>
            A tabela fica limpa por padrão. Os controles extras aparecem apenas enquanto este painel estiver aberto.
          </div>
        </div>
      )}

      <div
        style={{
          overflow: 'auto',
          padding: isDocument
            ? showFloatingToolbar
              ? '44px 0 0'
              : '0'
            : '0',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: Math.max(isDocument ? 560 : 520, model.columns.length * 160 + 72),
            borderCollapse: 'separate',
            borderSpacing: 0,
            tableLayout: 'fixed',
            border: isDocument ? '1px solid var(--doc-border)' : '1px solid color-mix(in srgb, var(--glass-border) 92%, transparent)',
            borderRadius: isDocument ? 0 : 20,
            overflow: 'hidden',
            background: isDocument
              ? 'transparent'
              : 'linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 86%, transparent), color-mix(in srgb, var(--surface-floating) 80%, transparent))',
            boxShadow: isDocument ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          <thead>
            <tr>
              <th style={isDocument ? documentCornerHeaderStyle : cornerHeaderStyle}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
                  <span style={axisHintStyle}>Rows</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>#</span>
                </div>
              </th>
              {model.columns.map((column, columnIndex) => (
                <th key={column.id} style={isDocument ? documentColumnHeaderStyle : columnHeaderStyle}>
                  {isPresentation ? (
                    <div style={presentationColumnHeaderStyle}>
                      <span style={columnTagStyle}>{String.fromCharCode(65 + columnIndex)}</span>
                      <span style={presentationColumnLabelStyle}>{column.label}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: showAdvancedChrome && columnIndex > 0 ? 8 : 0 }}>
                      <div style={columnHeaderInnerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={columnTagStyle}>{String.fromCharCode(65 + columnIndex)}</span>
                          <input
                            value={column.label}
                            onChange={(event) => updateColumnLabel(columnIndex, event.target.value)}
                            onPointerDown={(event) => event.stopPropagation()}
                            placeholder={columnIndex === 0 ? 'Primary column' : `Column ${columnIndex}`}
                            style={isDocument ? documentColumnHeaderInputStyle : columnHeaderInputStyle}
                          />
                        </div>
                        {showAdvancedChrome && model.columns.length > 1 && (
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

                      {showAdvancedChrome && columnIndex > 0 && (
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
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td style={isDocument ? documentRowHeaderStyle : rowHeaderStyle}>
                  <div style={rowHeaderInnerStyle}>
                    <span style={rowIndexPillStyle}>{rowIndex + 1}</span>
                    {showAdvancedChrome && model.rows.length > 1 && (
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
                      style={
                        isPresentation
                          ? columnIndex === 0
                            ? presentationPrimaryCellStyle
                            : presentationCellStyle
                          : columnIndex === 0
                            ? isDocument ? documentPrimaryCellStyle : primaryCellStyle
                            : isDocument ? documentCellStyle : cellStyle
                      }
                    >
                      <div style={{ position: 'relative' }}>
                        {isPresentation ? (
                          <div
                            style={
                              columnIndex === 0
                                ? presentationPrimaryCellValueStyle
                                : presentationCellValueStyle
                            }
                          >
                            {displayedValue || '\u2014'}
                          </div>
                        ) : (
                          <input
                            value={displayedValue}
                            onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                            onPointerDown={(event) => event.stopPropagation()}
                            placeholder={columnIndex === 0 ? 'Row label' : ''}
                            style={
                              columnIndex === 0
                                ? isDocument ? documentPrimaryCellInputStyle : primaryCellInputStyle
                                : usesAutoFormula
                                  ? autoComputedCellInputStyle
                                  : isDocument ? documentCellInputStyle : cellInputStyle
                            }
                          />
                        )}
                        {!isPresentation && error && (
                          <div style={{ ...formulaBadgeStyle, color: error ? '#ffb0a8' : 'var(--text-secondary)' }}>
                            {error}
                          </div>
                        )}
                        {!isPresentation && !error && usesAutoFormula && isFormulaCell(resolvedValue) && (
                          <div style={formulaBadgeStyle}>
                            Auto
                          </div>
                        )}
                        {!isPresentation && !error && showsFormulaResult && (
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
            {showAdvancedChrome && (
              <tr>
                <td style={isDocument ? documentBottomActionLabelCellStyle : bottomActionLabelCellStyle}>
                  <span style={axisHintStyle}>More</span>
                </td>
                <td colSpan={model.columns.length} style={isDocument ? documentBottomActionCellStyle : bottomActionCellStyle}>
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
            )}
          </tbody>
        </table>
      </div>

      {!isDocument && model.chart.visible && (
        <div style={chartBuilderWrapStyle}>
          {!isPresentation && (
            <>
              <div style={chartBuilderHeaderStyle}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={axisHintStyle}>Chart builder</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {model.chart.type === 'pie'
                      ? 'Each slice uses the row total across the selected columns.'
                      : 'Use the table as a live chart source inside the document.'}
                  </span>
                </div>
                <TinyButton
                  icon="visibility_off"
                  label="Hide"
                  onClick={() => patchChart({ visible: false })}
                />
              </div>

              <div style={chartControlsGridStyle}>
                <input
                  value={model.chart.title}
                  onChange={(event) => patchChart({ title: event.target.value })}
                  onPointerDown={(event) => event.stopPropagation()}
                  placeholder="Chart title"
                  style={chartControlInputStyle}
                />

                <select
                  value={model.chart.type}
                  onChange={(event) => patchChart({ type: event.target.value as DataSheetModel['chart']['type'] })}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={chartControlInputStyle}
                >
                  <option value="bar">Bar chart</option>
                  <option value="line">Line chart</option>
                  <option value="pie">Pie chart</option>
                </select>

                <select
                  value={model.chart.labelColumnId}
                  onChange={(event) => handleLabelColumnChange(event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={chartControlInputStyle}
                >
                  {model.columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      Label: {column.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <span style={axisHintStyle}>Series</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectableChartColumns.map((column) => (
                    <TinyButton
                      key={column.id}
                      icon="stacked_bar_chart"
                      label={column.label}
                      onClick={() => toggleChartValueColumn(column.id)}
                      active={model.chart.valueColumnIds.includes(column.id)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <div style={isPresentation ? presentationChartCanvasStyle : chartCanvasStyle}>
            <div style={{ padding: '14px 16px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {model.chart.title || model.title || 'Chart preview'}
            </div>
            <div style={{ minHeight: 0, padding: 10 }}>
              {renderChartPreview()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataSheetNodeView(props: NodeViewProps) {
  const model = parseDataSheet(props.node.attrs.model);
  const insertChartBlock = () => {
    if (typeof props.getPos !== 'function') return;
    const currentPos = props.getPos();
    if (typeof currentPos !== 'number') return;
    const position = currentPos + props.node.nodeSize;
    props.editor
      .chain()
      .focus()
      .insertContentAt(position, {
        type: 'dataChart',
        attrs: { model: serializeDataSheet(model) },
      })
      .run();
  };

  return (
    <NodeViewWrapper
      contentEditable={false}
      data-doc-interactive="true"
      style={{
        margin: '24px 0',
      }}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()}
      onClick={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
    >
      <DataSheetCard
        model={model}
        selected={props.selected}
        variant="document"
        onInsertChart={insertChartBlock}
        onChange={(next) => props.updateAttributes({ model: serializeDataSheet(next) })}
      />
    </NodeViewWrapper>
  );
}

function buildPieChartData(
  chartData: Array<Record<string, string | number>>,
  chartSeries: Array<{ id: string; label: string }>
) {
  if (chartSeries.length === 0) {
    return [];
  }

  return chartData
    .map((entry) => ({
      name: String(entry.label ?? 'Item'),
      value: chartSeries.reduce((sum, series) => sum + toChartNumber(entry[series.id]), 0),
    }))
    .filter((entry) => entry.value > 0);
}

function toChartNumber(value: string | number | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const numeric = Number(String(value ?? '').trim());
  return Number.isFinite(numeric) ? numeric : 0;
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

function FloatingIconButton({
  icon,
  title,
  onClick,
  active,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: active ? '1px solid color-mix(in srgb, var(--primary) 65%, transparent)' : '1px solid var(--glass-border)',
        background: active ? 'color-mix(in srgb, var(--primary) 12%, white)' : 'color-mix(in srgb, var(--bg-primary) 90%, white)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

const CHART_COLORS = ['#5b8cff', '#3ecf8e', '#ff8a65', '#f7c04a', '#a17cff', '#44c5f1', '#ff6b9a', '#22c55e'];

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

const floatingToolbarStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const floatingPanelStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 7,
  width: 'min(320px, calc(100% - 24px))',
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--glass-border) 88%, white)',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 96%, white), color-mix(in srgb, var(--surface-floating) 94%, transparent))',
  boxShadow: '0 20px 48px rgba(15, 23, 42, 0.16)',
};

const floatingPanelTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--text-primary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const floatingPanelMetaStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
};

const floatingPanelHintStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.55,
  color: 'var(--text-muted)',
};

const chartBuilderWrapStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 12,
  padding: '0 12px 12px',
};

const chartBuilderHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
};

const chartControlsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
};

const chartControlInputStyle: CSSProperties = {
  ...inputStyle,
  background: 'rgba(255,255,255,0.06)',
};

const chartCanvasStyle: CSSProperties = {
  minHeight: 320,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--glass-border) 86%, transparent)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 85%, rgba(255,255,255,0.08)), color-mix(in srgb, var(--surface-elevated) 76%, transparent))',
};

const chartEmptyStateStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 24,
  color: 'var(--text-muted)',
  fontSize: 13,
};

const presentationTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
};

const presentationColumnHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 44,
};

const presentationColumnLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-primary)',
  lineHeight: 1.4,
};

const presentationCellStyle: CSSProperties = {
  padding: 0,
  borderBottom: '1px solid color-mix(in srgb, var(--glass-border) 78%, transparent)',
  borderRight: '1px solid color-mix(in srgb, var(--glass-border) 68%, transparent)',
  background: 'rgba(255,255,255,0.58)',
  verticalAlign: 'middle',
};

const presentationPrimaryCellStyle: CSSProperties = {
  ...presentationCellStyle,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 92%, rgba(255,255,255,0.08)), color-mix(in srgb, var(--surface-elevated) 84%, transparent))',
};

const presentationCellValueStyle: CSSProperties = {
  minHeight: 52,
  display: 'flex',
  alignItems: 'center',
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--text-secondary)',
  lineHeight: 1.55,
};

const presentationPrimaryCellValueStyle: CSSProperties = {
  ...presentationCellValueStyle,
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const presentationChartCanvasStyle: CSSProperties = {
  ...chartCanvasStyle,
  minHeight: 360,
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 94%, rgba(255,255,255,0.1)), color-mix(in srgb, var(--surface-elevated) 82%, transparent))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
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

const documentCornerHeaderStyle: CSSProperties = {
  ...cornerHeaderStyle,
  background: 'var(--doc-canvas-bg)',
  borderRight: '1px solid var(--doc-border)',
  borderBottom: '1px solid var(--doc-border)',
};

const documentRowHeaderStyle: CSSProperties = {
  ...rowHeaderStyle,
  background: 'var(--doc-canvas-bg)',
  borderRight: '1px solid var(--doc-border)',
  borderBottom: '1px solid var(--doc-border)',
  color: 'var(--doc-ink-soft)',
};

const documentColumnHeaderStyle: CSSProperties = {
  ...columnHeaderStyle,
  background: 'var(--doc-canvas-bg)',
  borderRight: '1px solid var(--doc-border)',
  borderBottom: '1px solid var(--doc-border)',
};

const documentCellStyle: CSSProperties = {
  ...cellStyle,
  background: 'transparent',
  borderRight: '1px solid var(--doc-border)',
  borderBottom: '1px solid var(--doc-border)',
};

const documentPrimaryCellStyle: CSSProperties = {
  ...documentCellStyle,
  background: 'transparent',
};

const documentColumnHeaderInputStyle: CSSProperties = {
  ...columnHeaderInputStyle,
  color: 'var(--doc-ink)',
};

const documentCellInputStyle: CSSProperties = {
  ...cellInputStyle,
  color: 'var(--doc-ink-soft)',
};

const documentPrimaryCellInputStyle: CSSProperties = {
  ...primaryCellInputStyle,
  color: 'var(--doc-ink)',
};

const documentBottomActionLabelCellStyle: CSSProperties = {
  ...bottomActionLabelCellStyle,
  background: 'var(--doc-canvas-bg)',
  borderRight: '1px solid var(--doc-border)',
};

const documentBottomActionCellStyle: CSSProperties = {
  ...bottomActionCellStyle,
  background: 'transparent',
};
