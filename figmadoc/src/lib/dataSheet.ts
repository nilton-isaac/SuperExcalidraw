import type { ChartType } from '../types';

export interface DataSheetColumn {
  id: string;
  label: string;
  autoFormula?: string;
}

export interface DataSheetRow {
  id: string;
  cells: string[];
}

export interface DataSheetChartSettings {
  visible: boolean;
  type: ChartType;
  title: string;
  labelColumnId: string;
  valueColumnIds: string[];
}

export interface DataSheetModel {
  title: string;
  columns: DataSheetColumn[];
  rows: DataSheetRow[];
  chart: DataSheetChartSettings;
}

export interface EvaluatedDataSheet {
  displayRows: string[][];
  formulaResults: Record<string, string>;
  errors: Record<string, string>;
  chartData: Array<Record<string, string | number>>;
  chartSeries: Array<{ id: string; label: string }>;
}

const SAFE_EXPRESSION = /^[0-9+\-*/().,\s]+$/;

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDataSheetColumn(label: string): DataSheetColumn {
  return {
    id: makeId('col'),
    label,
    autoFormula: '',
  };
}

export function createDataSheetRow(cellCount: number, cells?: string[]): DataSheetRow {
  return {
    id: makeId('row'),
    cells: Array.from({ length: cellCount }, (_, index) => cells?.[index] ?? ''),
  };
}

export function createDefaultDataSheet(): DataSheetModel {
  const columns = [
    createDataSheetColumn('Name'),
    createDataSheetColumn('Column 1'),
    createDataSheetColumn('Column 2'),
  ];

  return {
    title: 'Untitled Sheet',
    columns,
    rows: [
      createDataSheetRow(columns.length, ['', '', '']),
      createDataSheetRow(columns.length, ['', '', '']),
      createDataSheetRow(columns.length, ['', '', '']),
    ],
    chart: {
      visible: false,
      type: 'bar',
      title: 'Generated chart',
      labelColumnId: columns[0].id,
      valueColumnIds: [columns[1].id],
    },
  };
}

export function serializeDataSheet(model: DataSheetModel) {
  return JSON.stringify(model);
}

export function parseDataSheet(value?: string | null): DataSheetModel {
  const fallback = createDefaultDataSheet();
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as Partial<DataSheetModel>;
    const columns = Array.isArray(parsed.columns) && parsed.columns.length > 0
      ? parsed.columns.map((column, index) => ({
          id: typeof column?.id === 'string' && column.id ? column.id : makeId(`col-${index}`),
          label: typeof column?.label === 'string' && column.label.trim() ? column.label.trim() : `Column ${index + 1}`,
          autoFormula: typeof column?.autoFormula === 'string' ? column.autoFormula : '',
        }))
      : fallback.columns;

    const rows = Array.isArray(parsed.rows) && parsed.rows.length > 0
      ? parsed.rows.map((row, rowIndex) => ({
          id: typeof row?.id === 'string' && row.id ? row.id : makeId(`row-${rowIndex}`),
          cells: Array.from({ length: columns.length }, (_, columnIndex) =>
            typeof row?.cells?.[columnIndex] === 'string' ? row.cells[columnIndex] : ''
          ),
        }))
      : fallback.rows.map((row) => ({
          ...row,
          cells: [...row.cells],
        }));

    const labelColumnId = columns.some((column) => column.id === parsed.chart?.labelColumnId)
      ? parsed.chart!.labelColumnId
      : columns[0].id;

    const valueColumnIds = Array.isArray(parsed.chart?.valueColumnIds)
      ? parsed.chart!.valueColumnIds.filter((columnId): columnId is string =>
          typeof columnId === 'string' && columns.some((column) => column.id === columnId)
        )
      : fallback.chart.valueColumnIds.filter((columnId) => columns.some((column) => column.id === columnId));

    return {
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : fallback.title,
      columns,
      rows,
      chart: {
        visible: typeof parsed.chart?.visible === 'boolean' ? parsed.chart.visible : fallback.chart.visible,
        type: parsed.chart?.type === 'line' || parsed.chart?.type === 'pie' ? parsed.chart.type : 'bar',
        title: typeof parsed.chart?.title === 'string' ? parsed.chart.title : fallback.chart.title,
        labelColumnId,
        valueColumnIds: valueColumnIds.length > 0 ? valueColumnIds : [columns[1]?.id ?? columns[0].id],
      },
    };
  } catch {
    return fallback;
  }
}

export function evaluateDataSheet(model: DataSheetModel): EvaluatedDataSheet {
  const errors: Record<string, string> = {};
  const formulaResults: Record<string, string> = {};
  const cache = new Map<string, string | number>();

  const evaluateCell = (rowIndex: number, columnIndex: number, stack: string[]): string | number => {
    const cacheKey = `${rowIndex}:${columnIndex}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const raw = getResolvedDataSheetCell(model, rowIndex, columnIndex);
    const trimmed = raw.trim();
    if (!trimmed.startsWith('=')) {
      const primitive = inferPrimitiveValue(raw);
      cache.set(cacheKey, primitive);
      return primitive;
    }

    if (stack.includes(cacheKey)) {
      errors[cacheKey] = 'Circular reference';
      cache.set(cacheKey, 0);
      return 0;
    }

    const nextStack = [...stack, cacheKey];
    let expression = trimmed.slice(1);

    expression = expression.replace(
      /\b(SUM|AVG|MIN|MAX|COUNT)\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)/gi,
      (_match, fn: string, startRef: string, endRef: string) => {
        const rangeValues = getRangeValues(model, startRef, endRef, nextStack, evaluateCell);
        if (rangeValues.length === 0) {
          return '0';
        }

        const numeric = rangeValues.map(toNumber);
        const method = fn.toUpperCase();
        if (method === 'SUM') return String(numeric.reduce((sum, value) => sum + value, 0));
        if (method === 'AVG') return String(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
        if (method === 'MIN') return String(Math.min(...numeric));
        if (method === 'MAX') return String(Math.max(...numeric));
        return String(numeric.filter((value) => Number.isFinite(value)).length);
      }
    );

    expression = expression.replace(/\b([A-Z]+\d+)\b/g, (_match, ref: string) => {
      const target = parseCellReference(ref);
      if (!target) return '0';
      return String(toNumber(evaluateCell(target.rowIndex, target.columnIndex, nextStack)));
    });

    const normalizedExpression = expression.replace(/%/g, '/100');
    if (!SAFE_EXPRESSION.test(normalizedExpression)) {
      errors[cacheKey] = 'Unsupported formula';
      cache.set(cacheKey, raw);
      return raw;
    }

    try {
      const result = Function(`"use strict"; return (${normalizedExpression});`)() as number;
      const safeResult = Number.isFinite(result) ? result : 0;
      cache.set(cacheKey, safeResult);
      formulaResults[cacheKey] = formatFormulaValue(safeResult);
      return safeResult;
    } catch {
      errors[cacheKey] = 'Invalid formula';
      cache.set(cacheKey, raw);
      return raw;
    }
  };

  const displayRows = model.rows.map((row, rowIndex) =>
    row.cells.map((_cell, columnIndex) => {
      const value = evaluateCell(rowIndex, columnIndex, []);
      return typeof value === 'number' ? formatFormulaValue(value) : value;
    })
  );

  const labelColumnIndex = model.columns.findIndex((column) => column.id === model.chart.labelColumnId);
  const activeValueColumns = model.chart.valueColumnIds
    .map((columnId) => model.columns.findIndex((column) => column.id === columnId))
    .filter((index) => index >= 0);

  const chartSeries = activeValueColumns.map((columnIndex) => ({
    id: model.columns[columnIndex].id,
    label: model.columns[columnIndex].label,
  }));

  const chartData = model.rows.map((_row, rowIndex) => {
    const labelCell = displayRows[rowIndex]?.[labelColumnIndex] ?? `Row ${rowIndex + 1}`;
    const entry: Record<string, string | number> = {
      label: labelCell,
    };

    activeValueColumns.forEach((columnIndex) => {
      const series = model.columns[columnIndex];
      entry[series.id] = toNumber(evaluateCell(rowIndex, columnIndex, []));
    });

    return entry;
  });

  return {
    displayRows,
    formulaResults,
    errors,
    chartData,
    chartSeries,
  };
}

export function getCellReference(columnIndex: number, rowIndex: number) {
  return `${columnIndexToLabel(columnIndex)}${rowIndex + 1}`;
}

export function getResolvedDataSheetCell(model: DataSheetModel, rowIndex: number, columnIndex: number) {
  const manualValue = model.rows[rowIndex]?.cells[columnIndex] ?? '';
  if (manualValue.trim()) {
    return manualValue;
  }

  const autoFormula = model.columns[columnIndex]?.autoFormula?.trim() ?? '';
  if (!autoFormula) {
    return manualValue;
  }

  return expandAutoFormula(autoFormula, rowIndex);
}

export function isFormulaCell(value: string) {
  return value.trim().startsWith('=');
}

const AUTO_FORMULA_RESERVED = new Set(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT']);

function expandAutoFormula(formula: string, rowIndex: number) {
  const trimmed = formula.trim();
  if (!trimmed) return '';

  const rowNumber = rowIndex + 1;
  let expression = trimmed.startsWith('=') ? trimmed : `=${trimmed}`;

  expression = expression.replace(/\b([A-Z]+)\s*:\s*([A-Z]+)\b(?!\d)/gi, (_match, start: string, end: string) => {
    return `${start.toUpperCase()}${rowNumber}:${end.toUpperCase()}${rowNumber}`;
  });

  expression = expression.replace(/\b([A-Z]+)\b(?!\d)/gi, (_match, token: string) => {
    const upper = token.toUpperCase();
    if (AUTO_FORMULA_RESERVED.has(upper)) {
      return upper;
    }
    return `${upper}${rowNumber}`;
  });

  return expression;
}

function inferPrimitiveValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && trimmed === String(numeric)) {
    return numeric;
  }

  return value;
}

function toNumber(value: string | number) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatFormulaValue(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

function getRangeValues(
  model: DataSheetModel,
  startRef: string,
  endRef: string,
  stack: string[],
  evaluateCell: (rowIndex: number, columnIndex: number, stack: string[]) => string | number
) {
  const start = parseCellReference(startRef);
  const end = parseCellReference(endRef);
  if (!start || !end) return [];

  const rowStart = Math.min(start.rowIndex, end.rowIndex);
  const rowEnd = Math.max(start.rowIndex, end.rowIndex);
  const columnStart = Math.min(start.columnIndex, end.columnIndex);
  const columnEnd = Math.max(start.columnIndex, end.columnIndex);
  const values: Array<string | number> = [];

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    for (let columnIndex = columnStart; columnIndex <= columnEnd; columnIndex += 1) {
      if (!model.rows[rowIndex] || !model.columns[columnIndex]) continue;
      values.push(evaluateCell(rowIndex, columnIndex, stack));
    }
  }

  return values;
}

function parseCellReference(reference: string) {
  const match = /^([A-Z]+)(\d+)$/.exec(reference.trim().toUpperCase());
  if (!match) return null;

  const columnIndex = columnLabelToIndex(match[1]);
  const rowIndex = Number(match[2]) - 1;
  if (columnIndex < 0 || rowIndex < 0) return null;

  return {
    columnIndex,
    rowIndex,
  };
}

function columnIndexToLabel(index: number) {
  let label = '';
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
}

function columnLabelToIndex(label: string) {
  let index = 0;
  for (const char of label) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}
