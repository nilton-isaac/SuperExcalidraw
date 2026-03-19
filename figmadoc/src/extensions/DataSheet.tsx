import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DataSheetNodeView } from '../components/docs/DataSheetBlock';
import { createDefaultDataSheet, serializeDataSheet } from '../lib/dataSheet';

export const DataSheet = Node.create({
  name: 'dataSheet',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      model: {
        default: serializeDataSheet(createDefaultDataSheet()),
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
        tag: 'div[data-data-sheet="true"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-data-sheet': 'true' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DataSheetNodeView);
  },
});
