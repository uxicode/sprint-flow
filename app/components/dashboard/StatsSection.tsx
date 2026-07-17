import CollapsibleSection from '../CollapsibleSection';
import PerformanceAnalytics from '../PerformanceAnalytics';
import { useStatsActions } from '../../hooks/use-stats-actions';

export default function StatsSection() {
  const {
    isStatsJqlOpen,
    handleToggleStatsSection,
    analyticsTickets,
    analyticsProjectKey,
    setAnalyticsProjectKey,
    analyticsTeamMembers,
    setAnalyticsTeamMembers,
    analyticsDateStart,
    setAnalyticsDateStart,
    analyticsDateEnd,
    setAnalyticsDateEnd,
    handleFetchAnalyticsTickets,
    isAnalyticsLoading,
  } = useStatsActions();

  return (
    <div className="stats-and-jql-grid">
      <CollapsibleSection
        title="티켓 상태 분포"
        isOpen={isStatsJqlOpen}
        onToggle={handleToggleStatsSection}
        headerVariant="plain"
        sectionClassName="stats-section card"
        slideClassName="stats-slide-container"
        toggleClassName="btn-toggle-stats"
      >
        <PerformanceAnalytics
          tickets={analyticsTickets}
          projectKey={analyticsProjectKey}
          setProjectKey={setAnalyticsProjectKey}
          teamMembers={analyticsTeamMembers}
          setTeamMembers={setAnalyticsTeamMembers}
          dateStart={analyticsDateStart}
          dateEnd={analyticsDateEnd}
          setDateStart={setAnalyticsDateStart}
          setDateEnd={setAnalyticsDateEnd}
          onFetch={handleFetchAnalyticsTickets}
          isLoading={isAnalyticsLoading}
        />
      </CollapsibleSection>
    </div>
  );
}
