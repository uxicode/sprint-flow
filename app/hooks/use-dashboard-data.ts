'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDashboardBundle } from '../lib/jira-fetchers';
import { queryKeys } from '../lib/query-keys';
import {
  getTypedSettingsStore,
  useTypedFilterStore,
  useTypedReportStore,
  useTypedSettingsStore,
  useTypedUiStore,
} from './typed-stores';
import type { CalendarMeta } from '../types';

function applyCalendarMeta(calendarMeta: CalendarMeta | null): void {
  if (!calendarMeta) return;

  const {
    setCalendarAccessToken,
    setCalendarAuthStatus,
    setCalendarErrorMessage,
  } = getTypedSettingsStore();

  if (calendarMeta.error) {
    setCalendarErrorMessage(calendarMeta.error);
    if (calendarMeta.needReauth) {
      setCalendarAuthStatus('error');
    }
    return;
  }

  setCalendarErrorMessage('');
  if (calendarMeta.newAccessToken) {
    setCalendarAccessToken(calendarMeta.newAccessToken);
    const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
    if (savedOAuth) {
      try {
        const parsed = JSON.parse(savedOAuth) as { accessToken?: string; expiresAt?: number };
        parsed.accessToken = calendarMeta.newAccessToken;
        parsed.expiresAt = Date.now() + 3600 * 1000;
        localStorage.setItem('workflow_calendar_oauth', JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
    }
  }
}

export function useDashboardData() {
  const isConfigLoaded = useTypedUiStore((s) => s.isConfigLoaded);
  const setConnectionStatus = useTypedUiStore((s) => s.setConnectionStatus);
  const apiMode = useTypedSettingsStore((s) => s.apiMode);
  const url = useTypedSettingsStore((s) => s.url);
  const email = useTypedSettingsStore((s) => s.email);
  const token = useTypedSettingsStore((s) => s.token);
  const calendarId = useTypedSettingsStore((s) => s.calendarId);
  const calendarClientId = useTypedSettingsStore((s) => s.calendarClientId);
  const calendarClientSecret = useTypedSettingsStore((s) => s.calendarClientSecret);
  const calendarAccessToken = useTypedSettingsStore((s) => s.calendarAccessToken);
  const calendarRefreshToken = useTypedSettingsStore((s) => s.calendarRefreshToken);
  const registeredMembers = useTypedSettingsStore((s) => s.registeredMembers);
  const projectKey = useTypedFilterStore((s) => s.projectKey);
  const teamMembers = useTypedFilterStore((s) => s.teamMembers);
  const dateStart = useTypedFilterStore((s) => s.dateStart);
  const dateEnd = useTypedFilterStore((s) => s.dateEnd);
  const setReports = useTypedReportStore((s) => s.setReports);
  const queryClient = useQueryClient();

  const filter = { projectKey, teamMembers, dateStart, dateEnd };
  const credentials = { url, email, token };
  const calendar = {
    calendarId,
    clientId: calendarClientId,
    clientSecret: calendarClientSecret,
    accessToken: calendarAccessToken,
    refreshToken: calendarRefreshToken,
  };

  const query = useQuery({
    queryKey: queryKeys.dashboard(filter),
    queryFn: () => fetchDashboardBundle({
      apiMode,
      credentials,
      filter,
      calendar,
      registeredMembers,
      onProgress: setConnectionStatus,
    }),
    enabled: isConfigLoaded && !!dateStart && !!dateEnd,
    staleTime: 0,
  });

  useEffect(() => {
    if (!query.data) return;
    applyCalendarMeta(query.data.calendarMeta);
    setReports({
      dailyReportMd: query.data.reports.dailyReportMd,
      weeklyReportMd: query.data.reports.weeklyReportMd,
      calendarEvents: query.data.calendarEvents,
    });
    setConnectionStatus({ dot: 'success', text: query.data.statusText });
  }, [query.data, setReports, setConnectionStatus]);

  useEffect(() => {
    if (!query.error) return;
    console.error('대시보드 데이터 로드 실패:', query.error);
    const message = query.error instanceof Error ? query.error.message : String(query.error);
    setConnectionStatus({ dot: 'danger', text: `연동 실패 (${message})` });
  }, [query.error, setConnectionStatus]);

  const refetchDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: ['jira', 'analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['jira', 'schedule'] });
    return query.refetch();
  };

  return {
    tickets: query.data?.tickets ?? [],
    nextTickets: query.data?.nextTickets ?? [],
    isLoading: query.isFetching,
    refetchDashboard,
  };
}
