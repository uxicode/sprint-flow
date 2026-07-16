import dayjs from 'dayjs';
import ProgressFill from '../ProgressFill';

export default function GanttChart({ ganttData, onEpicClick }) {
  if (ganttData.epics.length === 0) return null;

  return (
    <div className="gantt-chart-container">
      <h4 className="gantt-title">📅 에픽 일정 타임라인 (간트 차트)</h4>
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
            const startDiff = dayjs(epic.startDate).diff(ganttData.globalStart, 'day');
            const duration = dayjs(epic.endDate).diff(epic.startDate, 'day') + 1;
            const leftPercent = (startDiff / ganttData.totalDays) * 100;
            const widthPercent = Math.max(3, (duration / ganttData.totalDays) * 100);
            const progressValues = [epic.beProgress, epic.feProgress, epic.moProgress].filter(v => v !== null);
            const avgProgress = progressValues.length > 0
              ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
              : 0;

            return (
              <div key={epic.key} className="gantt-row">
                <div className="gantt-epic-label">
                  <div className="gantt-epic-info" onClick={() => onEpicClick(epic.key)}>
                    <span className="epic-key">{epic.key}</span>
                    <span className="epic-name" title={epic.summary}>{epic.summary}</span>
                  </div>
                </div>
                <div className="gantt-lane">
                  <div
                    className="gantt-epic-bar"
                    style={{ '--bar-left': `${leftPercent}%`, '--bar-width': `${widthPercent}%` }}
                    onClick={() => onEpicClick(epic.key)}
                    title={`${epic.summary}\n기간: ${epic.startDate} ~ ${epic.endDate}\n진행률: ${avgProgress}%`}
                  >
                    <ProgressFill progress={avgProgress} className="gantt-epic-bar-fill">
                      {avgProgress > 10 && `${avgProgress}%`}
                    </ProgressFill>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
