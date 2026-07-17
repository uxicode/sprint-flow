import clsx from 'clsx';
import { getStatusCategory } from '../utils/jira';
import type { Ticket } from '../types';

function getStatusPillClass(status: string) {
  const st = (status || '').toLowerCase();
  if (st.includes('done') || st.includes('resolved') || st.includes('완료')) return 'status-pill--done';
  if (st.includes('progress') || st.includes('진행')) return 'status-pill--progress';
  return 'status-pill--todo';
}

export interface InsightsTicketItemProps {
  ticket: Ticket;
  isChecked: boolean;
  checkboxVariant: string;
  onToggle: (ticketKey: string) => void;
}

export default function InsightsTicketItem({ ticket, isChecked, checkboxVariant, onToggle }: InsightsTicketItemProps) {
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
