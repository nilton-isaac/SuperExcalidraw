import type { CSSProperties } from 'react';

interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: number;
  grade?: number;
  style?: CSSProperties;
  className?: string;
}

export function Icon({
  name,
  size = 20,
  filled = false,
  weight = 400,
  grade = 0,
  style,
  className,
}: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={['material-symbols-outlined', className].filter(Boolean).join(' ')}
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${Math.max(20, Math.min(48, size))}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
