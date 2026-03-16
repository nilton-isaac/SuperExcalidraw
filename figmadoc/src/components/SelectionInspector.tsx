import type { CSSProperties, ReactNode } from 'react';
import { useStore } from '../store/useStore';
import type {
  ArrowElement,
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

const FONT_OPTIONS = ['Inter', 'Space Grotesk', 'Merriweather', 'JetBrains Mono'];
const COLOR_SWATCHES = ['#000000', '#ffffff', '#6b7280', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#9333ea'];

export function SelectionInspector() {
  const { elements, selectedIds, updateElement } = useStore();

  if (selectedIds.length === 0) return null;

  if (selectedIds.length > 1) {
    return (
      <InspectorShell icon="filter_none" title="Multiple selection">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Styling is available for one element at a time. Select a single item to change its
          colors, typography, and orientation.
        </div>
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
        gap: 6,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              height: 34,
              borderRadius: 10,
              border: active ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--primary-contrast)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              fontSize: 11,
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
        top: 16,
        right: 16,
        width: 280,
        maxHeight: 'calc(100% - 58px)',
        overflowY: 'auto',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
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
          padding: '14px 14px 12px',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-elevated)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'var(--primary)',
            color: 'var(--primary-contrast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={18} filled />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Inspector
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, padding: 14 }}>{children}</div>
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

function iconForElement(element: WhiteboardElement) {
  if (element.type === 'shape') return 'format_shapes';
  if (element.type === 'sticky') return 'sticky_note_2';
  if (element.type === 'text') return 'text_fields';
  if (element.type === 'arrow') return 'arrow_right_alt';
  if (element.type === 'pen') return 'edit';
  if (element.type === 'image') return 'image';
  return 'code';
}

function labelForElement(element: WhiteboardElement) {
  if (element.type === 'shape') return 'Shape';
  if (element.type === 'sticky') return 'Sticky Note';
  if (element.type === 'text') return 'Text';
  if (element.type === 'arrow') return 'Arrow';
  if (element.type === 'pen') return 'Pen';
  if (element.type === 'image') return 'Image';
  return 'Code Block';
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: 36,
  borderRadius: 10,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  fontSize: 12,
  outline: 'none',
};
