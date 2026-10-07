import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';
import type { StatusCategory } from '../types';

function getTagVariant(status: string, statusCategory?: StatusCategory) {
  const category = getStatusCategory({ status, statusCategory });
  if (category === 'Done') return 'done';
  if (category === 'In Progress') return 'in-progress';
  return 'to-do';
}

export interface StatusTagProps {
  status: string;
  statusCategory?: StatusCategory;
}

export default function StatusTag({ status, statusCategory }: StatusTagProps) {
  return (
    <span className={clsx('status-tag', getTagVariant(status, statusCategory))}>
      {status}
    </span>
  );
}
