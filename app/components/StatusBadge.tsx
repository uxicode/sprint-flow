import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';
import type { StatusCategory } from '../types';

function getBadgeVariant(status: string, statusCategory?: StatusCategory) {
  const category = getStatusCategory({ status, statusCategory });
  if (category === 'Done') return 'done';
  if (category === 'In Progress') return 'progress';
  return 'todo';
}

export interface StatusBadgeProps {
  status: string;
  statusCategory?: StatusCategory;
  className?: string;
}

export default function StatusBadge({ status, statusCategory, className = 'status-badge' }: StatusBadgeProps) {
  return (
    <span className={clsx(className, getBadgeVariant(status, statusCategory))}>
      {status}
    </span>
  );
}
