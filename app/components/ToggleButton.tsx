import clsx from 'clsx';
import ChevronIcon from './icons/ChevronIcon';
import type { ButtonHTMLAttributes, MouseEventHandler } from 'react';

export interface ToggleButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  isCollapsed?: boolean;
  className?: string;
  size?: number;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export default function ToggleButton({ isCollapsed, className, size = 20, onClick, ...rest }: ToggleButtonProps) {
  return (
    <button
      type="button"
      className={clsx('btn-toggle', className, isCollapsed && 'is-collapsed')}
      onClick={onClick}
      {...rest}
    >
      <ChevronIcon size={size} />
    </button>
  );
}
