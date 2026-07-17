'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { resolveAppSettings } from '../utils/resolveAppSettings';
import { exchangeCalendarOAuthCode, fetchAppConfig } from '../lib/jira-fetchers';
import {
  getTypedFilterStore,
  getTypedSettingsStore,
  getTypedUiStore,
  useTypedUiStore,
} from './typed-stores';
import type { AppConfig, LocalSettings } from '../types';

function readLocalSettings(): LocalSettings {
  const localSettings: LocalSettings = {
    url: '',
    email: '',
    token: '',
    confluenceSpace: '',
    confluenceParentId: '',
    apiMode: false,
    calendarId: '',
    calendarClientId: '',
    calendarClientSecret: '',
    calendarAccessToken: '',
    calendarRefreshToken: '',
    projectKey: 'DI26',
    teamMembers: '',
    registeredMembers: [],
  };

  const savedSettings = localStorage.getItem('workflow_jira_settings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings) as Partial<LocalSettings>;
      localSettings.url = parsed.url || '';
      localSettings.email = parsed.email || '';
      localSettings.token = parsed.token || '';
      localSettings.confluenceSpace = parsed.confluenceSpace || '';
      localSettings.confluenceParentId = parsed.confluenceParentId || '';
      localSettings.apiMode = parsed.apiMode || false;
    } catch (err: unknown) {
      console.error('설정을 복구하는 중 오류 발생:', err);
    }
  }

  const savedCalendar = localStorage.getItem('workflow_calendar_settings');
  if (savedCalendar) {
    try {
      const parsed = JSON.parse(savedCalendar) as { calendarId?: string };
      localSettings.calendarId = parsed.calendarId || '';
    } catch (err: unknown) {
      console.error('캘린더 설정을 복구하는 중 오류 발생:', err);
    }
  }

  const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
  if (savedOAuth) {
    try {
      const parsed = JSON.parse(savedOAuth) as {
        clientId?: string;
        clientSecret?: string;
        accessToken?: string;
        refreshToken?: string;
      };
      localSettings.calendarClientId = parsed.clientId || '';
      localSettings.calendarClientSecret = parsed.clientSecret || '';
      localSettings.calendarAccessToken = parsed.accessToken || '';
      localSettings.calendarRefreshToken = parsed.refreshToken || '';
    } catch (err: unknown) {
      console.error('OAuth 캘린더 설정 복구 중 오류:', err);
    }
  }

  const savedMembers = localStorage.getItem('workflow_registered_members');
  if (savedMembers) {
    try {
      localSettings.registeredMembers = JSON.parse(savedMembers) as string[];
    } catch (err: unknown) {
      console.error('팀원 목록 복구 중 오류 발생:', err);
    }
  } else {
    localStorage.setItem('workflow_registered_members', JSON.stringify([]));
  }

  const savedFilterMembers = localStorage.getItem('workflow_filter_members');
  if (savedFilterMembers !== null) {
    localSettings.teamMembers = savedFilterMembers;
  }

  const savedProjectKey = localStorage.getItem('workflow_project_key');
  if (savedProjectKey !== null) {
    localSettings.projectKey = savedProjectKey;
  }

  return localSettings;
}

function cleanOAuthUrlParams(): void {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('calendar_auth');
  cleanUrl.searchParams.delete('calendar_code');
  cleanUrl.searchParams.delete('calendar_error');
  cleanUrl.searchParams.delete('calendar_id');
  window.history.replaceState({}, '', cleanUrl);
}

async function handleOAuthCallback(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  const {
    setCalendarAccessToken,
    setCalendarRefreshToken,
    setCalendarAuthStatus,
  } = getTypedSettingsStore();

  try {
    setCalendarAuthStatus('connecting');
    const tokenData = await exchangeCalendarOAuthCode({ code, clientId, clientSecret });
    setCalendarAccessToken(tokenData.access_token);
    if (tokenData.refresh_token) {
      setCalendarRefreshToken(tokenData.refresh_token);
    }
    setCalendarAuthStatus('connected');

    const oauthData = {
      clientId,
      clientSecret,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      authMode: 'oauth',
    };
    localStorage.setItem('workflow_calendar_oauth', JSON.stringify(oauthData));
    console.log('[Calendar OAuth] 토큰 교환 성공');
  } catch (err: unknown) {
    console.error('[Calendar OAuth] 토큰 교환 실패:', err);
    setCalendarAuthStatus('error');
    const message = err instanceof Error ? err.message : String(err);
    alert(`Google Calendar 인증 실패: ${message}`);
  }
}

export function useAppBootstrap(): { mounted: boolean; isConfigLoaded: boolean } {
  const mounted = useTypedUiStore((s) => s.mounted);
  const isConfigLoaded = useTypedUiStore((s) => s.isConfigLoaded);
  const queryClient = useQueryClient();

  useEffect(() => {
    getTypedUiStore().setMounted(true);
    getTypedFilterStore().initDefaultDates();

    let cancelled = false;

    async function bootstrap(): Promise<void> {
      const localSettings = readLocalSettings();
      let envConfig: AppConfig | null = null;

      try {
        envConfig = await fetchAppConfig();
      } catch (err: unknown) {
        console.warn('[AppConfig] 서버 env 설정을 불러오지 못했습니다:', err);
      }

      if (cancelled) return;

      const resolved = resolveAppSettings(localSettings, envConfig);
      getTypedSettingsStore().applyResolvedSettings(resolved);
      getTypedFilterStore().syncFromResolvedSettings({
        projectKey: resolved.projectKey,
        teamMembers: resolved.teamMembers,
      });

      const { setConnectionStatus, setConfigLoaded } = getTypedUiStore();
      if (resolved.fromEnv) {
        console.log('[AppConfig] 서버 환경 변수로 설정이 적용되었습니다.');
        setConnectionStatus({ dot: 'success', text: '환경 변수 설정 적용됨 — Jira API 대기 중' });
      } else if (resolved.apiMode) {
        setConnectionStatus({ dot: 'success', text: 'Jira API 대기 중' });
      } else {
        setConnectionStatus({ dot: 'accent', text: '시뮬레이션 모드 작동 중' });
      }

      const urlParams = new URLSearchParams(window.location.search);
      const calendarAuth = urlParams.get('calendar_auth');
      const calendarCode = urlParams.get('calendar_code');
      const urlCalendarId = urlParams.get('calendar_id');

      if (calendarAuth === 'success' && calendarCode) {
        if (urlCalendarId) {
          getTypedSettingsStore().setCalendarId(urlCalendarId);
          localStorage.setItem('workflow_calendar_settings', JSON.stringify({ calendarId: urlCalendarId }));
        }
        cleanOAuthUrlParams();
        if (resolved.calendarClientId && resolved.calendarClientSecret) {
          await handleOAuthCallback(calendarCode, resolved.calendarClientId, resolved.calendarClientSecret);
        } else {
          alert('OAuth Client ID / Secret이 저장되어 있지 않습니다. 먼저 설정을 저장해 주세요.');
        }
      } else if (calendarAuth === 'denied') {
        cleanOAuthUrlParams();
        alert('Google Calendar 인증이 거부되었습니다.');
      } else if (calendarAuth === 'error') {
        const calendarError = urlParams.get('calendar_error');
        cleanOAuthUrlParams();
        alert(`Google Calendar 인증 오류: ${calendarError || '알 수 없는 오류'}`);
      }

      setConfigLoaded(true);
      queryClient.invalidateQueries({ queryKey: ['jira', 'dashboard'] });
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return { mounted, isConfigLoaded };
}
