import GanttChart from './GanttChart';
import EpicScheduleCard from './EpicScheduleCard';

export default function ScheduleTab({ schedule }) {
  const {
    ganttData,
    epicScheduleData,
    expandedEpics,
    toggleEpicCollapse,
    url,
  } = schedule;

  return (
    <div className="schedule-management-container">
      <div className="schedule-header-summary">
        <h3>🗓️ 에픽별 프로젝트 개발 일정 및 진행 상황</h3>
        <p className="subtitle">각 에픽 하위 티켓의 제목 태그([BE], [FE], [MO]) 기준 진행율 통계</p>
      </div>

      <GanttChart ganttData={ganttData} onEpicClick={toggleEpicCollapse} />

      <div className="epic-cards-grid">
        {epicScheduleData.length === 0 ? (
          <div className="empty-state empty-state--centered">
            <p>조회된 티켓 데이터가 없습니다. 상단 필터를 입력하고 조회를 먼저 진행해 주세요.</p>
          </div>
        ) : (
          epicScheduleData.map(epic => (
            <EpicScheduleCard
              key={epic.key}
              epic={epic}
              isExpanded={!!expandedEpics[epic.key]}
              jiraUrl={url}
              onToggle={toggleEpicCollapse}
            />
          ))
        )}
      </div>
    </div>
  );
}
