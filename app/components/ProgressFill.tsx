import type { CSSProperties, ReactNode } from 'react';

export interface ProgressFillProps {
  progress: number;
  className?: string;
  children?: ReactNode;
}

export default function ProgressFill({ progress, className = 'fill', children }: ProgressFillProps) {
  return (
    <div
      className={className}
      style={{ '--progress': `${progress}%` } as CSSProperties}
    >
      {children}
    </div>
  );
}
