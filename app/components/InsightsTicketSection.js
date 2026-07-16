import InsightsTicketItem from './InsightsTicketItem';

/**
 * 인사이트 티켓 섹션 컴포넌트
 * @param {string} title - 섹션 제목
 * @param {string} badgeVariant - 배지 변경
 * @param {number} includedCount - 포함된 티켓 수
 * @param {number} totalCount - 총 티켓 수
 * @param {Object[]} tickets - 티켓 목록
 * @param {Set} excludedTicketKeys - 제외된 티켓 키 집합
 * @param {string} checkboxVariant - 체크박스 변경
 * @param {Function} onToggleTicket - 티켓 포함 여부 변경 핸들러
 */
export default function InsightsTicketSection({
  title,
  badgeVariant,
  includedCount,
  totalCount,
  tickets,
  excludedTicketKeys,
  checkboxVariant,
  onToggleTicket,
}) {
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
