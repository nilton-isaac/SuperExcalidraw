export type Tool =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'circle'
  | 'diamond'
  | 'sticky'
  | 'code'
  | 'arrow'
  | 'text'
  | 'image'
  | 'pen'
  | 'eraser'
  | 'chart'
  | 'table';

export type ElementType = 'shape' | 'sticky' | 'code' | 'arrow' | 'text' | 'pen' | 'image' | 'chart' | 'table';
export type TextAlign = 'left' | 'center' | 'right';
export type FontWeight = 'normal' | '600' | '700';
export type CodeRuntime = 'browser' | 'react';

export interface Point { x: number; y: number; }

export interface ShapeProperties {
  shapeType: 'rectangle' | 'circle' | 'diamond';
  text?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: FontWeight;
  textAlign?: TextAlign;
}
export interface StickyProperties {
  text: string;
  color: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: TextAlign;
}
export interface CodeProperties {
  html: string;
  css: string;
  js: string;
  title?: string;
  runtime?: CodeRuntime;
  theme?: 'vscode-dark' | 'vscode-light' | 'one-dark';
}
export type ArrowHead = 'filled' | 'open' | 'circle' | 'none';
export type ArrowLineStyle = 'straight' | 'curved' | 'orthogonal';

export interface ArrowProperties {
  points: Point[];
  color?: string;
  strokeWidth?: number;
  startArrowHead?: ArrowHead;
  endArrowHead?: ArrowHead;
  arrowHead?: ArrowHead;
  lineStyle?: ArrowLineStyle;
  curveOffset?: number;
  startElementId?: string;
  endElementId?: string;
}
export interface TextProperties {
  text: string;
  fontSize: number;
  fontWeight?: FontWeight;
  color?: string;
  fontFamily?: string;
  textAlign?: TextAlign;
}
export interface PenProperties { points: Point[]; color: string; strokeWidth: number; }
export interface ImageProperties { src: string; alt?: string; objectFit?: 'contain' | 'cover' | 'fill'; }
export interface TableProperties { model: string; }

export type ChartType = 'bar' | 'line' | 'pie';
export type PieMode = 'row-total' | 'column-total';
export interface ChartProperties {
  chartType: ChartType;
  title?: string;
  labels: string[];
  datasets: { label: string; data: number[]; color?: string }[];
  sourceTableId?: string;
  labelColumnId?: string;
  valueColumnIds?: string[];
  pieMode?: PieMode;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked?: boolean;
  groupId?: string;
  rotation?: number;
}

export interface ShapeElement extends BaseElement { type: 'shape'; properties: ShapeProperties; }
export interface StickyElement extends BaseElement { type: 'sticky'; properties: StickyProperties; }
export interface CodeElement extends BaseElement { type: 'code'; properties: CodeProperties; }
export interface ArrowElement extends BaseElement { type: 'arrow'; properties: ArrowProperties; }
export interface TextElement extends BaseElement { type: 'text'; properties: TextProperties; }
export interface PenElement extends BaseElement { type: 'pen'; properties: PenProperties; }
export interface ImageElement extends BaseElement { type: 'image'; properties: ImageProperties; }
export interface ChartElement extends BaseElement { type: 'chart'; properties: ChartProperties; }
export interface TableElement extends BaseElement { type: 'table'; properties: TableProperties; }

export type WhiteboardElement =
  | ShapeElement | StickyElement | CodeElement | ArrowElement
  | TextElement | PenElement | ImageElement | ChartElement | TableElement;

export interface DocPage {
  id: string;
  title: string;
  content: string;
  icon: string;
  children?: DocPage[];
}

export interface ViewState { x: number; y: number; zoom: number; }

// Cloud integration
export interface CloudBoardMeta {
  id: string;          // Supabase row UUID
  local_id: string;    // mirrors local SavedBoard.id
  name: string;
  updated_at: string;  // ISO timestamp from Supabase
}
