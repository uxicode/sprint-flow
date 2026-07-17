import clsx from 'clsx';
import type { ConnectionStatus as ConnectionStatusType } from '../types';

export interface ConnectionStatusProps extends ConnectionStatusType {}

export default function ConnectionStatus({ dot, text }: ConnectionStatusProps) {
  return (
    <div className="status-indicator">
      <span className={clsx('indicator-dot', `indicator-dot--${dot}`)}></span>
      <span>{text}</span>
    </div>
  );
}
