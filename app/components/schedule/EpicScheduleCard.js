import clsx from 'clsx';
import EpicProgressBadge from '../EpicProgressBadge';
import ToggleButton from '../ToggleButton';
import ScheduleTicketCategory from '../ScheduleTicketCategory';

export default function EpicScheduleCard({ epic, isExpanded, jiraUrl, onToggle }) {
  const isCollapsed = !isExpanded;

  return (
    <div className="epic-schedule-card">
      <div className="epic-card-header epic-card-header--interactive" onClick={() => onToggle(epic.key)}>
        <div className="epic-title-group">
          <span className="epic-badge">{epic.key}</span>
          <h4 className="epic-summary">{epic.summary}</h4>
          {epic.startDate && epic.endDate && (
            <span className="epic-due-date-badge">
              📅 기간: {epic.startDate} ~ {epic.endDate}
            </span>
          )}
        </div>

        <div className="epic-card-header-actions" onClick={(e) => e.stopPropagation()}>
          <div className="epic-stats-row">
            <EpicProgressBadge label="BE" progress={epic.beProgress} doneCount={epic.beDoneCount} totalCount={epic.beCount} variant="be" />
            <EpicProgressBadge label="FE" progress={epic.feProgress} doneCount={epic.feDoneCount} totalCount={epic.feCount} variant="fe" />
            <EpicProgressBadge label="MO" progress={epic.moProgress} doneCount={epic.moDoneCount} totalCount={epic.moCount} variant="mo" />
          </div>
          <ToggleButton
            isCollapsed={isCollapsed}
            className="btn-toggle-epic"
            size={18}
            onClick={() => onToggle(epic.key)}
          />
        </div>
      </div>

      <div className={clsx('epic-card-slide-container', 'slide-container', !isCollapsed && 'is-open')}>
        <div className="epic-card-body">
          <ScheduleTicketCategory label="💻 Backend 티켓" tickets={epic.categorizedTickets.BE} jiraUrl={jiraUrl} />
          <ScheduleTicketCategory label="🎨 Frontend 티켓" tickets={epic.categorizedTickets.FE} jiraUrl={jiraUrl} />
          <ScheduleTicketCategory label="📱 Mobile 티켓" tickets={epic.categorizedTickets.MO} jiraUrl={jiraUrl} />
          <ScheduleTicketCategory label="📄 기타 티켓" tickets={epic.categorizedTickets.OTHER} jiraUrl={jiraUrl} />
        </div>
      </div>
    </div>
  );
}
