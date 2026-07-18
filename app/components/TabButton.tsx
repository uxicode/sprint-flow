import clsx from 'clsx';
import type { MouseEventHandler, ReactNode } from 'react';

export interface TabButtonProps {
  isActive: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  children?: ReactNode;
}

export default function TabButton({ isActive, onClick, disabled = false, children }: TabButtonProps) {
  return (
    <button
      type="button"
      className={clsx('tab-btn', isActive && 'active')}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
