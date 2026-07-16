import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';

/**
 * 상태 배지 변경 함수
 * @param {string} status - 상태
 * @returns {string} - 배지 변경
 */
function getBadgeVariant(status) {
  const category = getStatusCategory(status);
  if (category === 'Done') return 'done';
  if (category === 'In Progress') return 'progress';
  return 'todo';
}

/**
 * 상태 배지 컴포넌트
 * @param {string} status - 상태
 * @param {string} className - 클래스 이름
 */
export default function StatusBadge({ status, className = 'status-badge' }) {
  return (
    <span className={clsx(className, getBadgeVariant(status))}>
      {status}
    </span>
  );
}
