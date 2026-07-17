import clsx from 'clsx';
import dayjs from 'dayjs';
import ProgressFill from '../ProgressFill';
import ScheduleTicketCategory from '../ScheduleTicketCategory';
import ChevronIcon from '../icons/ChevronIcon';
import { getStatusCategory } from '../../utils/jira';
import { useUiStore } from '../../stores/ui-store';
import { useSettingsStore } from '../../stores/settings-store';
import type { GanttData, ProgressBadge, Ticket } from '../../types';
import type { CSSProperties } from 'react';

function buildOtherProgressBadge(tickets: Ticket[]): ProgressBadge | null {
  if (!tickets?.length) return null;
  const doneCount = tickets.filter(t => getStatusCategory(t.status) === 'Done').length;
  const totalCount = tickets.length;
  return {
    label: 'ETC',
    progress: Math.round((doneCount / totalCount) * 100),
    doneCount,
    totalCount,
    variant: 'other',
  };
}

function formatEpicDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const formatted = dayjs(dateStr);
  return formatted.isValid() ? formatted.format('YY.MM.DD') : null;
}

function formatEpicDateRange(startDate: string, endDate: string) {
  const start = formatEpicDate(startDate);
  const end = formatEpicDate(endDate);
  if (start && end) return `${start} ~ ${end}`;
  return start || end;
}

export interface GanttChartProps {
  ganttData: GanttData;
}

interface UiStoreSlice {
  expandedEpics: Record<string, boolean>;
  toggleEpicCollapse: (key: string) => void;
}

interface SettingsStoreSlice {
  url: string;
}

export default function GanttChart({ ganttData }: GanttChartProps) {
  const expandedEpics = useUiStore((s) => (s as UiStoreSlice).expandedEpics);
  const toggleEpicCollapse = useUiStore((s) => (s as UiStoreSlice).toggleEpicCollapse);
  const jiraUrl = useSettingsStore((s) => (s as SettingsStoreSlice).url);

  if (ganttData.epics.length === 0) return null;

  return (
    <div className="gantt-chart-container">
      <h4 className="gantt-title">📅 에픽 일정 타임라인 (간트 차트)</h4>
      <p className="gantt-subtitle">에픽 이름을 클릭하면 하위 티켓 목록이 펼쳐집니다.</p>
      <div className="gantt-timeline-wrapper">
        <div className="gantt-chart">
          <div className="gantt-grid-overlay">
            <div className="gantt-grid-line"></div>
            <div className="gantt-grid-line"></div>
            <div className="gantt-grid-line"></div>
            <div className="gantt-grid-line"></div>
            <div className="gantt-grid-line"></div>
          </div>

          <div className="gantt-header">
            <div className="gantt-header-label">에픽 이름</div>
            <div className="gantt-header-dates">
              {ganttData.dateMarkers.map((marker, idx) => (
                <span key={idx} className="gantt-date-marker">{marker}</span>
              ))}
            </div>
          </div>

          {ganttData.epics.map(epic => {
            const isExpanded = !!expandedEpics[epic.key];
            const startDiff = dayjs(epic.startDate).diff(ganttData.globalStart, 'day');
            const duration = dayjs(epic.endDate).diff(epic.startDate, 'day') + 1;
            const leftPercent = (startDiff / ganttData.totalDays) * 100;
            const widthPercent = Math.max(3, (duration / ganttData.totalDays) * 100);
            const progressValues = [epic.beProgress, epic.feProgress, epic.moProgress].filter(v => v !== null);
            const avgProgress = progressValues.length > 0
              ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
              : 0;
            const dateRangeLabel = formatEpicDateRange(epic.startDate, epic.endDate);

            return (
              <div key={epic.key} className={clsx('gantt-row-group', isExpanded && 'is-expanded')}>
                <div className="gantt-row">
                  <div className="gantt-epic-label">
                    <button
                      type="button"
                      className="gantt-epic-info"
                      onClick={() => toggleEpicCollapse(epic.key)}
                      aria-expanded={isExpanded}
                      aria-label={`${epic.summary} 하위 티켓 ${isExpanded ? '접기' : '펼치기'}`}
                    >
                      <span className={clsx('gantt-epic-chevron', isExpanded && 'is-expanded')}>
                        <ChevronIcon size={14} />
                      </span>
                      <span className="gantt-epic-text">
                        <span className="gantt-epic-meta">
                          <span className="epic-key">{epic.key}</span>
                          {dateRangeLabel && (
                            <span className="epic-due-date-badge" title={`기간: ${dateRangeLabel}`}>
                              {dateRangeLabel}
                            </span>
                          )}
                        </span>
                        <span className="epic-name" title={epic.summary}>{epic.summary}</span>
                      </span>
                    </button>
                  </div>
                  <div className="gantt-lane">
                    <div
                      className="gantt-epic-bar"
                      style={{ '--bar-left': `${leftPercent}%`, '--bar-width': `${widthPercent}%` } as CSSProperties}
                      onClick={() => toggleEpicCollapse(epic.key)}
                      title={`${epic.summary}\n기간: ${epic.startDate} ~ ${epic.endDate}\n진행률: ${avgProgress}%`}
                    >
                      <ProgressFill progress={avgProgress} className="gantt-epic-bar-fill">
                        {avgProgress > 10 && `${avgProgress}%`}
                      </ProgressFill>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="gantt-row-tickets">
                    <ScheduleTicketCategory
                      label="💻 Backend 티켓"
                      tickets={epic.categorizedTickets.BE}
                      jiraUrl={jiraUrl}
                      progressBadge={{
                        label: 'BE',
                        progress: epic.beProgress,
                        doneCount: epic.beDoneCount,
                        totalCount: epic.beCount,
                        variant: 'be',
                      }}
                    />
                    <ScheduleTicketCategory
                      label="🎨 Frontend 티켓"
                      tickets={epic.categorizedTickets.FE}
                      jiraUrl={jiraUrl}
                      progressBadge={{
                        label: 'FE',
                        progress: epic.feProgress,
                        doneCount: epic.feDoneCount,
                        totalCount: epic.feCount,
                        variant: 'fe',
                      }}
                    />
                    <ScheduleTicketCategory
                      label="📱 Mobile 티켓"
                      tickets={epic.categorizedTickets.MO}
                      jiraUrl={jiraUrl}
                      progressBadge={{
                        label: 'MO',
                        progress: epic.moProgress,
                        doneCount: epic.moDoneCount,
                        totalCount: epic.moCount,
                        variant: 'mo',
                      }}
                    />
                    <ScheduleTicketCategory
                      label="📄 기타 티켓"
                      tickets={epic.categorizedTickets.OTHER}
                      jiraUrl={jiraUrl}
                      progressBadge={buildOtherProgressBadge(epic.categorizedTickets.OTHER)}
                    />
                    {epic.tickets.length === 0 && (
                      <p className="gantt-row-tickets-empty">하위 티켓이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
