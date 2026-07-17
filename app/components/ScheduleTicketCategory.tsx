import StatusTag from './StatusTag';
import EpicProgressBadge from './EpicProgressBadge';
import { getTicketLink } from '../utils/jira';
import type { Ticket } from '../types';
import type { EpicProgressBadgeProps } from './EpicProgressBadge';

export interface ScheduleTicketCategoryProps {
  label: string;
  tickets: Ticket[];
  jiraUrl: string;
  progressBadge?: EpicProgressBadgeProps | null;
}

export default function ScheduleTicketCategory({ label, tickets, jiraUrl, progressBadge }: ScheduleTicketCategoryProps) {
  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="category-group">
      <div className="category-group-header">
        <h5>{label} ({tickets.length})</h5>
        {progressBadge && (
          <div className="epic-stats-row epic-stats-row--inline">
            <EpicProgressBadge {...progressBadge} />
          </div>
        )}
      </div>
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
