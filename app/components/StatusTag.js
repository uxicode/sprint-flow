import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';

/**
 * 상태 태그 변경 함수
 * @param {string} status - 상태
 * @returns {string} - 태그 변경
 */
function getTagVariant(status) {
  const category = getStatusCategory(status);
  if (category === 'Done') return 'done';
  if (category === 'In Progress') return 'in-progress';
  return 'to-do';
}

/**
 * 상태 태그 컴포넌트
 * @param {string} status - 상태
 */ 
export default function StatusTag({ status }) {
  return (
    <span className={clsx('status-tag', getTagVariant(status))}>
      {status}
    </span>
  );
}
