import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useStore } from '../store/useStore';
import type {
  ArrowElement,
  ArrowHead,
  ChartElement,
  ChartType,
  CodeElement,
  ImageElement,
  PenElement,
  ShapeElement,
  StickyElement,
  TextAlign,
  TextElement,
  WhiteboardElement,
} from '../types';
import { Icon } from './Icon';

const FONT_OPTIONS = ['Inter', 'Space Grotesk', 'Poppins', 'DM Sans', 'Merriweather', 'Playfair Display', 'JetBrains Mono', 'Fira Code'];
const COLOR_SWATCHES = ['#000000', '#ffffff', '#6b7280', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#9333ea'];

export function SelectionInspector() {
  const {
    elements,
    selectedIds,
    activeTool,
    toolDefaults,
    updateElement,
    updateElements,
    updateToolDefaults,
    historyPush,
    bringSelectionToFront,
    sendSelectionToBack,
  } = useStore();
  const [flowLayoutBusy, setFlowLayoutBusy] = useState<null | 'RIGHT' | 'DOWN'>(null);
  const [flowLayoutMessage, setFlowLayoutMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) {
    if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'diamond') {
      const fillMode = toolDefaults.shape.fillColor === 'transparent' ? 'empty' : 'solid';
      return (
        <InspectorShell icon="format_shapes" title="Shape Preset">
          <FieldLabel>Fill mode</FieldLabel>
          <SegmentedControl
            value={fillMode}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'empty', label: 'Empty' },
            ]}
            onChange={(value) =>
              updateToolDefaults('shape', {
                fillColor: value === 'empty' ? 'transparent' : toolDefaults.shape.fillColor || '#ffffff',
              })
            }
          />
          <ColorField
            label="Fill"
            value={toolDefaults.shape.fillColor === 'transparent' ? '#ffffff' : toolDefaults.shape.fillColor}
            onChange={(value) => updateToolDefaults('shape', { fillColor: value })}
          />
          <ColorField
            label="Stroke"
            value={toolDefaults.shape.strokeColor}
            onChange={(value) => updateToolDefaults('shape', { strokeColor: value })}
          />
          <TypographySection
            color={toolDefaults.shape.textColor}
            onColorChange={(value) => updateToolDefaults('shape', { textColor: value })}
            fontFamily={toolDefaults.shape.fontFamily}
            onFontFamilyChange={(value) => updateToolDefaults('shape', { fontFamily: value })}
            fontSize={toolDefaults.shape.fontSize}
            onFontSizeChange={(value) => updateToolDefaults('shape', { fontSize: value })}
            fontWeight={toolDefaults.shape.fontWeight}
            onFontWeightChange={(value) => updateToolDefaults('shape', { fontWeight: value })}
            textAlign={toolDefaults.shape.textAlign}
            onTextAlignChange={(value) => updateToolDefaults('shape', { textAlign: value })}
          />
        </InspectorShell>
      );
    }

    if (activeTool === 'sticky') {
      return (
        <InspectorShell icon="sticky_note_2" title="Sticky Preset">
          <ColorField
            label="Note color"
            value={toolDefaults.sticky.color}
            onChange={(value) => updateToolDefaults('sticky', { color: value })}
          />
          <TypographySection
            color={toolDefaults.sticky.textColor}
            onColorChange={(value) => updateToolDefaults('sticky', { textColor: value })}
            fontFamily={toolDefaults.sticky.fontFamily}
            onFontFamilyChange={(value) => updateToolDefaults('sticky', { fontFamily: value })}
            fontSize={toolDefaults.sticky.fontSize}
            onFontSizeChange={(value) => updateToolDefaults('sticky', { fontSize: value })}
            fontWeight="normal"
            onFontWeightChange={() => undefined}
            textAlign={toolDefaults.sticky.textAlign}
            onTextAlignChange={(value) => updateToolDefaults('sticky', { textAlign: value })}
            hideWeight
          />
        </InspectorShell>
      );
    }

    if (activeTool === 'text') {
      return (
        <InspectorShell icon="text_fields" title="Text Preset">
          <TypographySection
            color={toolDefaults.text.color}
            onColorChange={(value) => updateToolDefaults('text', { color: value })}
            fontFamily={toolDefaults.text.fontFamily}
            onFontFamilyChange={(value) => updateToolDefaults('text', { fontFamily: value })}
            fontSize={toolDefaults.text.fontSize}
            onFontSizeChange={(value) => updateToolDefaults('text', { fontSize: value })}
            fontWeight={toolDefaults.text.fontWeight}
            onFontWeightChange={(value) => updateToolDefaults('text', { fontWeight: value })}
            textAlign={toolDefaults.text.textAlign}
            onTextAlignChange={(value) => updateToolDefaults('text', { textAlign: value })}
          />
        </InspectorShell>
      );
    }

    if (activeTool === 'arrow') {
      return (
        <InspectorShell icon="arrow_right_alt" title="Arrow Preset">
          <ColorField
            label="Stroke"
            value={toolDefaults.arrow.color}
            onChange={(value) => updateToolDefaults('arrow', { color: value })}
          />
          <NumberField
            label="Weight"
            min={1}
            max={12}
            step={1}
            value={toolDefaults.arrow.strokeWidth}
            onChange={(value) => updateToolDefaults('arrow', { strokeWidth: value })}
          />
          <FieldLabel>Start Tip</FieldLabel>
          <SegmentedControl
            value={toolDefaults.arrow.startArrowHead}
            options={[
              { value: 'none', label: 'None' },
              { value: 'filled', label: 'Fill' },
              { value: 'open', label: 'Open' },
              { value: 'circle', label: 'Dot' },
            ]}
            onChange={(value) => updateToolDefaults('arrow', { startArrowHead: value as ArrowHead })}
          />
          <FieldLabel>End Tip</FieldLabel>
          <SegmentedControl
            value={toolDefaults.arrow.endArrowHead}
            options={[
              { value: 'none', label: 'None' },
              { value: 'filled', label: 'Fill' },
              { value: 'open', label: 'Open' },
              { value: 'circle', label: 'Dot' },
            ]}
            onChange={(value) => updateToolDefaults('arrow', { endArrowHead: value as ArrowHead })}
          />
          <FieldLabel>Path</FieldLabel>
      <SegmentedControl
        value={toolDefaults.arrow.lineStyle}
        options={[
          { value: 'straight', label: 'Straight' },
          { value: 'curved', label: 'Curved' },
          { value: 'orthogonal', label: 'Square' },
        ]}
        onChange={(value) => updateToolDefaults('arrow', { lineStyle: value as 'straight' | 'curved' | 'orthogonal' })}
      />
          <NumberField
            label="Curve"
            min={0}
            max={120}
            step={2}
            value={toolDefaults.arrow.curveOffset}
            onChange={(value) => updateToolDefaults('arrow', { curveOffset: value })}
          />
        </InspectorShell>
      );
    }

    if (activeTool === 'pen') {
      return (
        <InspectorShell icon="edit" title="Pen Preset">
          <ColorField
            label="Stroke"
            value={toolDefaults.pen.color}
            onChange={(value) => updateToolDefaults('pen', { color: value })}
          />
          <NumberField
            label="Weight"
            min={1}
            max={20}
            step={1}
            value={toolDefaults.pen.strokeWidth}
            onChange={(value) => updateToolDefaults('pen', { strokeWidth: value })}
          />
        </InspectorShell>
      );
    }

    return null;
  }

  if (selectedIds.length > 1) {
    return (
      <InspectorShell icon="filter_none" title="Multiple selection">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Styling is available for one element at a time. Select a single item to change its
          colors, typography, and orientation.
        </div>
        <FlowLayoutControls
          busyDirection={flowLayoutBusy}
          message={flowLayoutMessage}
          onRun={async (direction) => {
            setFlowLayoutBusy(direction);
            setFlowLayoutMessage(null);
            try {
              const result = await runFlowAutoLayout({
                elements,
                selectedIds,
                direction,
                historyPush,
                updateElements,
              });
              setFlowLayoutMessage(result.message);
            } catch {
              setFlowLayoutMessage('Flow layout failed. Try again with connected blocks selected.');
            } finally {
              setFlowLayoutBusy(null);
            }
          }}
        />
        <LayerActions
          onBringToFront={bringSelectionToFront}
          onSendToBack={sendSelectionToBack}
        />
      </InspectorShell>
    );
  }

  const element = elements.find((candidate) => candidate.id === selectedIds[0]);
  if (!element) return null;

  return (
    <InspectorShell icon={iconForElement(element)} title={labelForElement(element)}>
      {element.type === 'shape' && (
        <ShapeInspector element={element} updateElement={updateElement} />
      )}
      {element.type === 'sticky' && (
        <StickyInspector element={element} updateElement={updateElement} />
      )}
      {element.type === 'text' && (
        <TextInspector element={element} updateElement={updateElement} />
      )}
      {element.type === 'arrow' && (
        <ArrowInspector element={element} updateElement={updateElement} />
      )}
      {element.type === 'pen' && (
        <PenInspector element={element} updateElement={updateElement} />
      )}
      {element.type === 'image' && (
        <ImageInspector element={element} updateElement={updateElement} />
      )}
      {element.type === 'code' && (
        <CodeInspector element={element} updateElement={updateElement} />
      )}
      {element.type === 'chart' && (
        <ChartInspector element={element} updateElement={updateElement} />
      )}
      <LayerActions
        onBringToFront={bringSelectionToFront}
        onSendToBack={sendSelectionToBack}
      />
    </InspectorShell>
  );
}

function ShapeInspector({
  element,
  updateElement,
}: {
  element: ShapeElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  const fillMode = (element.properties.fillColor ?? '#ffffff') === 'transparent' ? 'empty' : 'solid';

  return (
    <>
      <FieldLabel>Fill mode</FieldLabel>
      <SegmentedControl
        value={fillMode}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'empty', label: 'Empty' },
        ]}
        onChange={(value) =>
          patchProperties(element, updateElement, {
            fillColor: value === 'empty' ? 'transparent' : element.properties.fillColor ?? '#ffffff',
          })
        }
      />
      <ColorField
        label="Fill"
        value={element.properties.fillColor === 'transparent' ? '#ffffff' : element.properties.fillColor ?? '#ffffff'}
        onChange={(value) => patchProperties(element, updateElement, { fillColor: value })}
      />
      <ColorField
        label="Stroke"
        value={element.properties.strokeColor ?? '#000000'}
        onChange={(value) => patchProperties(element, updateElement, { strokeColor: value })}
      />
      <TypographySection
        color={element.properties.textColor ?? '#000000'}
        onColorChange={(value) => patchProperties(element, updateElement, { textColor: value })}
        fontFamily={element.properties.fontFamily ?? 'Inter'}
        onFontFamilyChange={(value) => patchProperties(element, updateElement, { fontFamily: value })}
        fontSize={element.properties.fontSize ?? 14}
        onFontSizeChange={(value) => patchProperties(element, updateElement, { fontSize: value })}
        fontWeight={element.properties.fontWeight ?? 'normal'}
        onFontWeightChange={(value) => patchProperties(element, updateElement, { fontWeight: value })}
        textAlign={element.properties.textAlign ?? 'center'}
        onTextAlignChange={(value) => patchProperties(element, updateElement, { textAlign: value })}
      />
      <RotationField
        value={element.rotation ?? 0}
        onChange={(value) => updateElement(element.id, { rotation: value })}
      />
      <TextInteractionHint />
    </>
  );
}

function StickyInspector({
  element,
  updateElement,
}: {
  element: StickyElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  return (
    <>
      <ColorField
        label="Note color"
        value={element.properties.color}
        onChange={(value) => patchProperties(element, updateElement, { color: value })}
      />
      <TypographySection
        color={element.properties.textColor ?? '#000000'}
        onColorChange={(value) => patchProperties(element, updateElement, { textColor: value })}
        fontFamily={element.properties.fontFamily ?? 'Inter'}
        onFontFamilyChange={(value) => patchProperties(element, updateElement, { fontFamily: value })}
        fontSize={element.properties.fontSize ?? 14}
        onFontSizeChange={(value) => patchProperties(element, updateElement, { fontSize: value })}
        fontWeight="normal"
        onFontWeightChange={() => undefined}
        textAlign={element.properties.textAlign ?? 'left'}
        onTextAlignChange={(value) => patchProperties(element, updateElement, { textAlign: value })}
        hideWeight
      />
      <RotationField
        value={element.rotation ?? 0}
        onChange={(value) => updateElement(element.id, { rotation: value })}
      />
      <TextInteractionHint />
    </>
  );
}

function TextInspector({
  element,
  updateElement,
}: {
  element: TextElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  return (
    <>
      <TypographySection
        color={element.properties.color ?? '#000000'}
        onColorChange={(value) => patchProperties(element, updateElement, { color: value })}
        fontFamily={element.properties.fontFamily ?? 'Inter'}
        onFontFamilyChange={(value) => patchProperties(element, updateElement, { fontFamily: value })}
        fontSize={element.properties.fontSize}
        onFontSizeChange={(value) => patchProperties(element, updateElement, { fontSize: value })}
        fontWeight={element.properties.fontWeight ?? 'normal'}
        onFontWeightChange={(value) => patchProperties(element, updateElement, { fontWeight: value })}
        textAlign={element.properties.textAlign ?? 'left'}
        onTextAlignChange={(value) => patchProperties(element, updateElement, { textAlign: value })}
      />
      <RotationField
        value={element.rotation ?? 0}
        onChange={(value) => updateElement(element.id, { rotation: value })}
      />
      <TextInteractionHint />
    </>
  );
}

function ArrowInspector({
  element,
  updateElement,
}: {
  element: ArrowElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  return (
    <>
      <FieldLabel>Start Tip</FieldLabel>
      <SegmentedControl
        value={element.properties.startArrowHead ?? 'none'}
        options={[
          { value: 'none', label: 'None' },
          { value: 'filled', label: 'Fill' },
          { value: 'open', label: 'Open' },
          { value: 'circle', label: 'Dot' },
        ]}
        onChange={(value) => patchProperties(element, updateElement, { startArrowHead: value as ArrowHead })}
      />
      <FieldLabel>End Tip</FieldLabel>
      <SegmentedControl
        value={element.properties.endArrowHead ?? element.properties.arrowHead ?? 'filled'}
        options={[
          { value: 'none', label: 'None' },
          { value: 'filled', label: 'Fill' },
          { value: 'open', label: 'Open' },
          { value: 'circle', label: 'Dot' },
        ]}
        onChange={(value) => patchProperties(element, updateElement, { endArrowHead: value as ArrowHead })}
      />
      <FieldLabel>Path</FieldLabel>
      <SegmentedControl
        value={element.properties.lineStyle ?? 'straight'}
        options={[
          { value: 'straight', label: 'Straight' },
          { value: 'curved', label: 'Curved' },
          { value: 'orthogonal', label: 'Square' },
        ]}
        onChange={(value) =>
          patchProperties(element, updateElement, { lineStyle: value as 'straight' | 'curved' | 'orthogonal' })
        }
      />
      <ColorField
        label="Stroke"
        value={element.properties.color ?? '#000000'}
        onChange={(value) => patchProperties(element, updateElement, { color: value })}
      />
      <NumberField
        label="Weight"
        min={1}
        max={12}
        step={1}
        value={element.properties.strokeWidth ?? 2}
        onChange={(value) => patchProperties(element, updateElement, { strokeWidth: value })}
      />
      <NumberField
        label="Curve"
        min={0}
        max={120}
        step={2}
        value={element.properties.curveOffset ?? 36}
        onChange={(value) => patchProperties(element, updateElement, { curveOffset: value })}
      />
      <InfoHint>Arrows stay attached to objects and auto-route in a flowchart style as elements move.</InfoHint>
    </>
  );
}

function PenInspector({
  element,
  updateElement,
}: {
  element: PenElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  return (
    <>
      <ColorField
        label="Stroke"
        value={element.properties.color}
        onChange={(value) => patchProperties(element, updateElement, { color: value })}
      />
      <NumberField
        label="Weight"
        min={1}
        max={20}
        step={1}
        value={element.properties.strokeWidth}
        onChange={(value) => patchProperties(element, updateElement, { strokeWidth: value })}
      />
    </>
  );
}

function ImageInspector({
  element,
  updateElement,
}: {
  element: ImageElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  return (
    <>
      <FieldLabel>Fit</FieldLabel>
      <select
        value={element.properties.objectFit ?? 'contain'}
        onChange={(event) =>
          patchProperties(element, updateElement, {
            objectFit: event.target.value as ImageElement['properties']['objectFit'],
          })
        }
        style={inputStyle}
      >
        <option value="contain">Contain</option>
        <option value="cover">Cover</option>
        <option value="fill">Fill</option>
      </select>
      <RotationField
        value={element.rotation ?? 0}
        onChange={(value) => updateElement(element.id, { rotation: value })}
      />
    </>
  );
}

function CodeInspector({
  element,
  updateElement,
}: {
  element: CodeElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  return (
    <>
      <FieldLabel>Title</FieldLabel>
      <input
        type="text"
        value={element.properties.title ?? ''}
        onChange={(event) => patchProperties(element, updateElement, { title: event.target.value })}
        placeholder="Code block title"
        style={inputStyle}
      />
      <RotationField
        value={element.rotation ?? 0}
        onChange={(value) => updateElement(element.id, { rotation: value })}
      />
    </>
  );
}

function ChartInspector({
  element,
  updateElement,
}: {
  element: ChartElement;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
}) {
  return (
    <>
      <FieldLabel>Chart Type</FieldLabel>
      <SegmentedControl
        value={element.properties.chartType}
        options={[
          { value: 'bar', label: 'Bar' },
          { value: 'line', label: 'Line' },
          { value: 'pie', label: 'Pie' },
        ]}
        onChange={(value) => patchProperties(element, updateElement, { chartType: value as ChartType })}
      />
      <FieldLabel>Title</FieldLabel>
      <input
        type="text"
        value={element.properties.title ?? ''}
        onChange={(event) => patchProperties(element, updateElement, { title: event.target.value })}
        placeholder="Chart title"
        style={inputStyle}
      />
    </>
  );
}

function TypographySection({
  color,
  onColorChange,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  fontWeight,
  onFontWeightChange,
  textAlign,
  onTextAlignChange,
  hideWeight,
}: {
  color: string;
  onColorChange: (value: string) => void;
  fontFamily: string;
  onFontFamilyChange: (value: string) => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  fontWeight: 'normal' | '600' | '700';
  onFontWeightChange: (value: 'normal' | '600' | '700') => void;
  textAlign: TextAlign;
  onTextAlignChange: (value: TextAlign) => void;
  hideWeight?: boolean;
}) {
  return (
    <>
      <ColorField label="Text color" value={color} onChange={onColorChange} />

      <FieldLabel>Font</FieldLabel>
      <select
        value={fontFamily}
        onChange={(event) => onFontFamilyChange(event.target.value)}
        style={inputStyle}
      >
        {FONT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <NumberField
        label="Font size"
        min={10}
        max={64}
        step={1}
        value={fontSize}
        onChange={onFontSizeChange}
      />

      {!hideWeight && (
        <>
          <FieldLabel>Weight</FieldLabel>
          <SegmentedControl
            value={fontWeight}
            options={[
              { value: 'normal', label: 'Regular' },
              { value: '600', label: 'Semi' },
              { value: '700', label: 'Bold' },
            ]}
            onChange={(value) => onFontWeightChange(value as 'normal' | '600' | '700')}
          />
        </>
      )}

      <FieldLabel>Alignment</FieldLabel>
      <SegmentedControl
        value={textAlign}
        options={[
          { value: 'left', icon: 'format_align_left', label: 'Left' },
          { value: 'center', icon: 'format_align_center', label: 'Center' },
          { value: 'right', icon: 'format_align_right', label: 'Right' },
        ]}
        onChange={(value) => onTextAlignChange(value as TextAlign)}
      />
    </>
  );
}

function RotationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <NumberField label="Rotation" min={-180} max={180} step={1} value={value} onChange={onChange} />
      <input
        type="range"
        min={-180}
        max={180}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: 'var(--primary)' }}
      />
    </>
  );
}

function TextInteractionHint() {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'color-mix(in srgb, var(--glass-bg) 88%, white)',
        color: 'var(--text-secondary)',
        fontSize: 11,
        lineHeight: 1.6,
      }}
    >
      Drag to move. Double-click quickly to edit the text.
    </div>
  );
}

function InfoHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'color-mix(in srgb, var(--glass-bg) 88%, white)',
        color: 'var(--text-secondary)',
        fontSize: 11,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

function FlowLayoutControls({
  busyDirection,
  message,
  onRun,
}: {
  busyDirection: null | 'RIGHT' | 'DOWN';
  message: string | null;
  onRun: (direction: 'RIGHT' | 'DOWN') => Promise<void>;
}) {
  return (
    <>
      <FieldLabel>Flowchart</FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        <button
          onClick={() => void onRun('RIGHT')}
          disabled={busyDirection !== null}
          style={{
            ...secondaryActionStyle,
            opacity: busyDirection && busyDirection !== 'RIGHT' ? 0.72 : 1,
            cursor: busyDirection ? 'default' : 'pointer',
          }}
        >
          {busyDirection === 'RIGHT' ? 'Laying out...' : 'Left to Right'}
        </button>
        <button
          onClick={() => void onRun('DOWN')}
          disabled={busyDirection !== null}
          style={{
            ...secondaryActionStyle,
            opacity: busyDirection && busyDirection !== 'DOWN' ? 0.72 : 1,
            cursor: busyDirection ? 'default' : 'pointer',
          }}
        >
          {busyDirection === 'DOWN' ? 'Laying out...' : 'Top to Bottom'}
        </button>
      </div>
      <InfoHint>
        Select connected blocks and run auto layout to reorganize the flow and reroute linked arrows.
      </InfoHint>
      {message && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {message}
        </div>
      )}
    </>
  );
}

function LayerActions({
  onBringToFront,
  onSendToBack,
}: {
  onBringToFront: () => void;
  onSendToBack: () => void;
}) {
  return (
    <>
      <FieldLabel>Layer</FieldLabel>
      <SegmentedControl
        value=""
        options={[
          { value: 'back', label: 'Send Back' },
          { value: 'front', label: 'Bring Front' },
        ]}
        onChange={(value) => {
          if (value === 'front') {
            onBringToFront();
            return;
          }
          onSendToBack();
        }}
      />
    </>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const normalized = normalizeColor(value);

  return (
    <>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={normalized}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: 42,
            height: 36,
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            background: 'transparent',
            cursor: 'pointer',
            padding: 4,
          }}
        />
        <input
          type="text"
          value={normalized}
          readOnly
          style={{ ...inputStyle, color: 'var(--text-secondary)' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            title={swatch}
            onClick={() => onChange(swatch)}
            style={{
              height: 26,
              borderRadius: 8,
              border: normalized === swatch ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
              background: swatch,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </>
  );
}

function NumberField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={inputStyle}
      />
    </>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string; icon?: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: 4,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              height: 30,
              borderRadius: 12,
              border: active ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--primary-contrast)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {option.icon ? <Icon name={option.icon} size={16} /> : option.label}
          </button>
        );
      })}
    </div>
  );
}

function InspectorShell({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        width: 228,
        maxHeight: 'calc(100% - 58px)',
        overflowY: 'auto',
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1001,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px 7px',
          borderBottom: '1px solid var(--glass-border)',
          position: 'sticky',
          top: 0,
          background: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: 'var(--primary)',
            color: 'var(--primary-contrast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={15} filled />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Inspector
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: 10 }}>{children}</div>
    </aside>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </label>
  );
}

function patchProperties<T extends WhiteboardElement>(
  element: T,
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void,
  patch: Partial<T['properties']>
) {
  updateElement(element.id, {
    properties: { ...element.properties, ...patch } as T['properties'],
  } as Partial<WhiteboardElement>);
}

function normalizeColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

let elkConstructorPromise: Promise<any> | null = null;

async function getElkConstructor() {
  if (!elkConstructorPromise) {
    elkConstructorPromise = import('elkjs/lib/elk.bundled.js').then((module) => module.default);
  }
  return elkConstructorPromise;
}

async function runFlowAutoLayout({
  elements,
  selectedIds,
  direction,
  historyPush,
  updateElements,
}: {
  elements: WhiteboardElement[];
  selectedIds: string[];
  direction: 'RIGHT' | 'DOWN';
  historyPush: () => void;
  updateElements: (updates: Array<{ id: string; updates: Partial<WhiteboardElement> }>) => void;
}) {
  const selection = collectFlowLayoutSelection(elements, selectedIds);
  if (selection.nodes.length < 2) {
    return { message: 'Select at least two connected blocks to run flow layout.' };
  }

  const ELK = await getElkConstructor();
  const elk = new ELK();
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.favorStraightEdges': 'true',
      'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.spacing.nodeNode': '36',
      'elk.spacing.edgeNode': '28',
      'elk.spacing.edgeEdge': '16',
      'elk.layered.spacing.nodeNodeBetweenLayers': '84',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: selection.nodes.map((node) => ({
      id: node.id,
      width: Math.max(60, node.width),
      height: Math.max(40, node.height),
    })),
    edges: selection.arrows.map((arrow) => ({
      id: arrow.id,
      sources: [arrow.properties.startElementId!],
      targets: [arrow.properties.endElementId!],
    })),
  };

  const layout = await elk.layout(graph);
  const layoutChildren = Array.isArray(layout.children) ? layout.children : [];
  if (layoutChildren.length === 0) {
    return { message: 'Nothing to layout for the current selection.' };
  }

  const currentBounds = getLayoutBounds(selection.nodes.map((node) => ({
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  })));
  const nextBounds = getLayoutBounds(layoutChildren.map((node: any) => ({
    x: node.x ?? 0,
    y: node.y ?? 0,
    width: node.width ?? 0,
    height: node.height ?? 0,
  })));
  const offsetX = currentBounds.centerX - nextBounds.centerX;
  const offsetY = currentBounds.centerY - nextBounds.centerY;

  const updates: Array<{ id: string; updates: Partial<WhiteboardElement> }> = [];
  for (const child of layoutChildren) {
    updates.push({
      id: child.id,
      updates: {
        x: Math.round((child.x ?? 0) + offsetX),
        y: Math.round((child.y ?? 0) + offsetY),
      },
    });
  }

  const edgeMap = new Map<string, any>(
    (Array.isArray(layout.edges) ? layout.edges : []).map((edge: any) => [edge.id, edge] as const)
  );

  for (const arrow of selection.arrows) {
    const layoutEdge = edgeMap.get(arrow.id);
    const section = layoutEdge?.sections?.[0];
    const nextPoints = section
      ? [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ].map((point: { x: number; y: number }) => ({
          x: Math.round(point.x + offsetX),
          y: Math.round(point.y + offsetY),
        }))
      : arrow.properties.points;

    updates.push({
      id: arrow.id,
      updates: {
        properties: {
          ...arrow.properties,
          points: nextPoints,
          lineStyle: 'orthogonal',
        },
      } as Partial<WhiteboardElement>,
    });
  }

  historyPush();
  updateElements(updates);

  return {
    message: `Flow layout applied to ${selection.nodes.length} block${selection.nodes.length === 1 ? '' : 's'} and ${selection.arrows.length} arrow${selection.arrows.length === 1 ? '' : 's'}.`,
  };
}

function collectFlowLayoutSelection(elements: WhiteboardElement[], selectedIds: string[]) {
  const selectedSet = new Set(selectedIds);
  const nodeIds = new Set(
    elements
      .filter((element) => selectedSet.has(element.id) && isFlowNode(element))
      .map((element) => element.id)
  );

  for (const element of elements) {
    if (
      element.type === 'arrow' &&
      selectedSet.has(element.id) &&
      element.properties.startElementId &&
      element.properties.endElementId &&
      element.properties.startElementId !== element.properties.endElementId
    ) {
      nodeIds.add(element.properties.startElementId);
      nodeIds.add(element.properties.endElementId);
    }
  }

  const nodes = elements.filter((element): element is Exclude<WhiteboardElement, ArrowElement | PenElement> =>
    nodeIds.has(element.id) && isFlowNode(element)
  );
  const arrows = elements.filter((element): element is ArrowElement =>
    element.type === 'arrow' &&
    Boolean(element.properties.startElementId) &&
    Boolean(element.properties.endElementId) &&
    element.properties.startElementId !== element.properties.endElementId &&
    nodeIds.has(element.properties.startElementId!) &&
    nodeIds.has(element.properties.endElementId!)
  );

  return { nodes, arrows };
}

function isFlowNode(element: WhiteboardElement): boolean {
  return element.type !== 'arrow' && element.type !== 'pen';
}

function getLayoutBounds(nodes: Array<{ x: number; y: number; width: number; height: number }>) {
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    left,
    top,
    right,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function iconForElement(element: WhiteboardElement) {
  if (element.type === 'shape') return 'format_shapes';
  if (element.type === 'sticky') return 'sticky_note_2';
  if (element.type === 'text') return 'text_fields';
  if (element.type === 'arrow') return 'arrow_right_alt';
  if (element.type === 'pen') return 'edit';
  if (element.type === 'image') return 'image';
  if (element.type === 'table') return 'table_chart';
  if (element.type === 'chart') return 'bar_chart';
  return 'code';
}

function labelForElement(element: WhiteboardElement) {
  if (element.type === 'shape') return 'Shape';
  if (element.type === 'sticky') return 'Sticky Note';
  if (element.type === 'text') return 'Text';
  if (element.type === 'arrow') return 'Arrow';
  if (element.type === 'pen') return 'Pen';
  if (element.type === 'image') return 'Image';
  if (element.type === 'table') return 'Data Table';
  if (element.type === 'chart') return 'Chart';
  return 'Code Block';
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: 34,
  borderRadius: 12,
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  fontSize: 11,
  outline: 'none',
};

const secondaryActionStyle: CSSProperties = {
  height: 32,
  borderRadius: 12,
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-bg)',
  color: 'var(--text-primary)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};
