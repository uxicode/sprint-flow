import type { AnalyticsFilter, DashboardFilter, FetchCalendarEventsParams, ScheduleFilter } from '../types';

export const queryKeys = {
  appConfig: ['app-config'] as const,
  dashboard: (filter: DashboardFilter) => ['jira', 'dashboard', filter] as const,
  analytics: (filter: AnalyticsFilter) => ['jira', 'analytics', filter] as const,
  schedule: (filter: ScheduleFilter) => ['jira', 'schedule', filter] as const,
  calendarEvents: (params: FetchCalendarEventsParams) => ['calendar', 'events', params] as const,
};
