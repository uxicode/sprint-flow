import type { MouseEventHandler } from 'react';

export interface ChevronIconProps {
  size?: number;
  onClick?: MouseEventHandler<SVGSVGElement>;
}

export default function ChevronIcon({ size = 20, onClick }: ChevronIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      onClick={onClick}
    >
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  );
}
