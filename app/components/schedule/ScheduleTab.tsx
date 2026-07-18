import GanttChart from './GanttChart';
import { useScheduleData } from '../../hooks/use-schedule-data';

export default function ScheduleTab() {
  const { ganttData, isScheduleLoading } = useScheduleData();

  return (
    <div className="schedule-management-container">
      <div className="schedule-header-summary">
        <h3>🗓️ 에픽별 프로젝트 개발 일정 및 진행 상황</h3>
        <p className="subtitle">각 에픽 하위 티켓의 제목 태그([BE], [FE], [MO]) 기준 진행율 통계</p>
      </div>

      {isScheduleLoading ? (
        <div className="analytics-loading-state">
          <div className="analytics-spinner"></div>
          <p>일정 데이터를 수집하고 있습니다. 잠시만 기다려 주세요...</p>
        </div>
      ) : ganttData.epics.length === 0 ? (
        <div className="empty-state empty-state--centered">
          <p>조회된 티켓 데이터가 없습니다. 상단 필터를 입력하고 조회를 먼저 진행해 주세요.</p>
        </div>
      ) : (
        <GanttChart ganttData={ganttData} />
      )}
    </div>
  );
}
