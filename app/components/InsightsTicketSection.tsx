import InsightsTicketItem from './InsightsTicketItem';
import type { Ticket } from '../types';

export interface InsightsTicketSectionProps {
  title: string;
  badgeVariant: string;
  includedCount: number;
  totalCount: number;
  tickets: Ticket[];
  excludedTicketKeys: Set<string>;
  checkboxVariant: string;
  onToggleTicket: (ticketKey: string) => void;
}

export default function InsightsTicketSection({
  title,
  badgeVariant,
  includedCount,
  totalCount,
  tickets,
  excludedTicketKeys,
  checkboxVariant,
  onToggleTicket,
}: InsightsTicketSectionProps) {
  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="insights-section card insights-ticket-section">
      <div className="insights-section-header">
        <h4>{title}</h4>
        <span className={`insights-count-badge insights-count-badge--${badgeVariant}`}>
          {includedCount} / {totalCount}건 반영
        </span>
      </div>
      <p className="insights-helper-text">
        체크 해제 시 해당 티켓이 실적 집계에서 제외되어 인사이트·차트·예측이 즉시 재계산됩니다.
      </p>
      <ul className="insights-ticket-list">
        {tickets.map(t => (
          <InsightsTicketItem
            key={t.key}
            ticket={t}
            isChecked={!excludedTicketKeys.has(t.key)}
            checkboxVariant={checkboxVariant}
            onToggle={onToggleTicket}
          />
        ))}
      </ul>
    </div>
  );
}
