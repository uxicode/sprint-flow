'use client';

import { useAnalyticsData } from './use-analytics-data';
import { useTypedFilterStore, useTypedUiStore } from './typed-stores';

export function useStatsActions() {
  const isStatsJqlOpen = useTypedUiStore((s) => s.isStatsJqlOpen);
  const setStatsJqlOpen = useTypedUiStore((s) => s.setStatsJqlOpen);
  const analyticsProjectKey = useTypedFilterStore((s) => s.analyticsProjectKey);
  const analyticsTeamMembers = useTypedFilterStore((s) => s.analyticsTeamMembers);
  const analyticsDateStart = useTypedFilterStore((s) => s.analyticsDateStart);
  const analyticsDateEnd = useTypedFilterStore((s) => s.analyticsDateEnd);
  const setAnalyticsProjectKey = useTypedFilterStore((s) => s.setAnalyticsProjectKey);
  const setAnalyticsTeamMembers = useTypedFilterStore((s) => s.setAnalyticsTeamMembers);
  const setAnalyticsDateStart = useTypedFilterStore((s) => s.setAnalyticsDateStart);
  const setAnalyticsDateEnd = useTypedFilterStore((s) => s.setAnalyticsDateEnd);
  const { analyticsTickets, isAnalyticsLoading, refetchAnalytics } = useAnalyticsData();

  const handleToggleStatsSection = (): void => {
    setStatsJqlOpen(!isStatsJqlOpen);
  };

  return {
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
    handleFetchAnalyticsTickets: refetchAnalytics,
    isAnalyticsLoading,
  };
}
