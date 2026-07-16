import StatusTag from './StatusTag';
import { getTicketLink } from '../utils/jira';

/**
 * 일정 티켓 카테고리 컴포넌트
 * @param {string} label - 카테고리 라벨
 * @param {Object[]} tickets - 티켓 목록
 * @param {string} jiraUrl - Jira URL
 */
export default function ScheduleTicketCategory({ label, tickets, jiraUrl }) {
  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="category-group">
      <h5>{label} ({tickets.length})</h5>
      <ul className="schedule-ticket-list">
        {tickets.map(t => (
          <li key={t.key} className="schedule-ticket-item">
            <span className="ticket-key-link" onClick={() => window.open(getTicketLink(t.key, jiraUrl), '_blank')}>{t.key}</span>
            <span className="ticket-summary-text">{t.summary}</span>
            <div className="ticket-meta">
              <span className="assignee">👤 {t.assignee || '미지정'}</span>
              <StatusTag status={t.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
