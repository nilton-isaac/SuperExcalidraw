import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DataChartNodeView } from '../components/docs/DataChartBlock';
import { createDefaultDataSheet, serializeDataSheet } from '../lib/dataSheet';

export const DataChart = Node.create({
  name: 'dataChart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    const baseModel = createDefaultDataSheet();
    return {
      model: {
        default: serializeDataSheet({
          ...baseModel,
          chart: {
            ...baseModel.chart,
            visible: true,
          },
        }),
        parseHTML: (element: HTMLElement) => element.getAttribute('data-model'),
        renderHTML: (attributes: Record<string, string>) => ({
          'data-model': attributes.model,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-data-chart="true"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-data-chart': 'true' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DataChartNodeView);
  },
});
