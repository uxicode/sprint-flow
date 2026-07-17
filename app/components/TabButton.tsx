import clsx from 'clsx';
import type { MouseEventHandler, ReactNode } from 'react';

export interface TabButtonProps {
  isActive: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
}

export default function TabButton({ isActive, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      className={clsx('tab-btn', isActive && 'active')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
