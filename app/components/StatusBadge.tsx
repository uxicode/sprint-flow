import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';

function getBadgeVariant(status: string) {
  const category = getStatusCategory(status);
  if (category === 'Done') return 'done';
  if (category === 'In Progress') return 'progress';
  return 'todo';
}

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = 'status-badge' }: StatusBadgeProps) {
  return (
    <span className={clsx(className, getBadgeVariant(status))}>
      {status}
    </span>
  );
}
