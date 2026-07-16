import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';

function getStatusPillClass(status) {
  const st = (status || '').toLowerCase();
  if (st.includes('done') || st.includes('resolved') || st.includes('완료')) return 'status-pill--done';
  if (st.includes('progress') || st.includes('진행')) return 'status-pill--progress';
  return 'status-pill--todo';
}

/**
 * 인사이트 티켓 아이템 컴포넌트
 * @param {Object} ticket - 티켓 정보
 * @param {boolean} isChecked - 티켓 포함 여부
 * @param {string} checkboxVariant - 체크박스 변경
 * @param {Function} onToggle - 티켓 포함 여부 변경 핸들러
 */
export default function InsightsTicketItem({ ticket, isChecked, checkboxVariant, onToggle }) {
  return (
    <li
      className={clsx('insights-ticket-item', isChecked ? 'is-included' : 'is-excluded')}
      onClick={() => onToggle(ticket.key)}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => {}}
        className={clsx('insights-ticket-checkbox', `insights-ticket-checkbox--${checkboxVariant}`)}
      />
      <span className={clsx('status-pill', getStatusPillClass(ticket.status))}>{ticket.status}</span>
      <span className={clsx('insights-ticket-title', isChecked ? 'is-included' : 'is-excluded')}>
        <strong>{ticket.key}</strong>: {ticket.summary}
        {ticket.epic && <span className="insights-ticket-epic">({ticket.epic.key})</span>}
      </span>
    </li>
  );
}
