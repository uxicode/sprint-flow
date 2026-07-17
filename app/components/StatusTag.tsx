import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';

function getTagVariant(status: string) {
  const category = getStatusCategory(status);
  if (category === 'Done') return 'done';
  if (category === 'In Progress') return 'in-progress';
  return 'to-do';
}

export interface StatusTagProps {
  status: string;
}

export default function StatusTag({ status }: StatusTagProps) {
  return (
    <span className={clsx('status-tag', getTagVariant(status))}>
      {status}
    </span>
  );
}
