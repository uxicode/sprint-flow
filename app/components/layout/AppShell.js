import clsx from 'clsx';
import ChevronIcon from '../icons/ChevronIcon';
import AppSidebar from './AppSidebar';
import DashboardHeader from '../dashboard/DashboardHeader';
import FilterSection from '../dashboard/FilterSection';
import StatsSection from '../dashboard/StatsSection';
import ReportSection from '../dashboard/ReportSection';

export default function AppShell({ app }) {
  const { layout, settings, filter, connectionStatus, stats, reports, schedule } = app;

  return (
    <div className={clsx('app-container', !layout.isSidebarOpen && 'sidebar-collapsed')}>
      <button
        type="button"
        className="sidebar-reveal-btn"
        onClick={() => layout.setIsSidebarOpen(true)}
        aria-label="사이드바 열기"
        title="사이드바 열기"
      >
        <ChevronIcon />
      </button>

      {/* 사이드바 */}
      <AppSidebar
        isOpen={layout.isSidebarOpen}
        onClose={() => layout.setIsSidebarOpen(false)}
        settings={settings}
      />

      <main className="main-content">
        {/* 대시보드 헤더 */}
        <DashboardHeader connectionStatus={connectionStatus} />
        {/* 필터 섹션 */}
        <FilterSection filter={filter} registeredMembers={settings.registeredMembers} />
        {/* 통계 섹션 */}
        <StatsSection stats={stats} />
        {/* 보고서 섹션 */}
        <ReportSection reports={reports} schedule={schedule} />
      </main>
    </div>
  );
}
