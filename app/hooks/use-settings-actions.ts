'use client';

import { useDashboardData } from './use-dashboard-data';
import {
  useTypedSettingsStore,
  useTypedUiStore,
} from './typed-stores';
import type { CalendarAuthStatus } from '../types';

export function useSettingsActions() {
  const setConnectionStatus = useTypedUiStore((s) => s.setConnectionStatus);
  const { refetchDashboard } = useDashboardData();

  const {
    url,
    email,
    token,
    confluenceSpace,
    confluenceParentId,
    calendarId,
    calendarClientId,
    calendarClientSecret,
    calendarAccessToken,
    calendarRefreshToken,
    calendarAuthStatus,
    calendarErrorMessage,
    apiMode,
    newMemberName,
    registeredMembers,
    setUrl,
    setEmail,
    setToken,
    setConfluenceSpace,
    setConfluenceParentId,
    setCalendarId,
    setCalendarClientId,
    setCalendarClientSecret,
    setCalendarAccessToken,
    setCalendarRefreshToken,
    setCalendarAuthStatus,
    setApiMode,
    setNewMemberName,
    setRegisteredMembers,
  } = useTypedSettingsStore((s) => s);

  const handleSaveSettings = (): void => {
    const settings = { url, email, token, confluenceSpace, confluenceParentId, apiMode };
    localStorage.setItem('workflow_jira_settings', JSON.stringify(settings));
    localStorage.setItem('workflow_calendar_settings', JSON.stringify({ calendarId }));

    const oauthData = {
      clientId: calendarClientId,
      clientSecret: calendarClientSecret,
      accessToken: calendarAccessToken,
      refreshToken: calendarRefreshToken,
      expiresAt: Date.now() + 3600 * 1000,
    };
    localStorage.setItem('workflow_calendar_oauth', JSON.stringify(oauthData));

    alert('설정이 성공적으로 저장되었습니다.');
    if (apiMode) {
      setConnectionStatus({ dot: 'success', text: 'Jira API 대기 중' });
    } else {
      setConnectionStatus({ dot: 'accent', text: '시뮬레이션 모드 작동 중' });
    }
    refetchDashboard();
  };

  const handleApiToggle = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const enabled = e.target.checked;
    setApiMode(enabled);

    const settings = { url, email, token, confluenceSpace, confluenceParentId, apiMode: enabled };
    localStorage.setItem('workflow_jira_settings', JSON.stringify(settings));

    if (enabled) {
      setConnectionStatus({ dot: 'success', text: 'Jira API 대기 중' });
    } else {
      setConnectionStatus({ dot: 'accent', text: '시뮬레이션 모드 작동 중' });
    }

    setTimeout(() => refetchDashboard(), 50);
  };

  const handleAddTeamMember = (): void => {
    const name = newMemberName.trim();
    if (!name) {
      alert('추가할 팀원 이름을 적어주세요.');
      return;
    }
    if (registeredMembers.includes(name)) {
      alert('이미 추가된 팀원입니다.');
      return;
    }
    const newList = [...registeredMembers, name];
    setRegisteredMembers(newList);
    localStorage.setItem('workflow_registered_members', JSON.stringify(newList));
    setNewMemberName('');
  };

  const handleRemoveTeamMember = (name: string): void => {
    const newList = registeredMembers.filter(m => m !== name);
    setRegisteredMembers(newList);
    localStorage.setItem('workflow_registered_members', JSON.stringify(newList));
  };

  const handleGoogleCalendarConnect = async (): Promise<void> => {
    if (!calendarClientId.trim()) {
      alert('OAuth Client ID를 먼저 입력해 주세요.');
      return;
    }
    const oauthData = {
      clientId: calendarClientId,
      clientSecret: calendarClientSecret,
      accessToken: calendarAccessToken,
      refreshToken: calendarRefreshToken,
      authMode: 'oauth',
    };
    localStorage.setItem('workflow_calendar_oauth', JSON.stringify(oauthData));
    localStorage.setItem('workflow_calendar_settings', JSON.stringify({ calendarId }));

    try {
      setCalendarAuthStatus('connecting');
      const response = await fetch('/api/calendar/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: calendarClientId,
          calendarId,
        }),
      });
      const data = await response.json() as { authUrl?: string };
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('인증 URL을 생성하지 못했습니다.');
      }
    } catch (err: unknown) {
      console.error('OAuth 시작 실패:', err);
      setCalendarAuthStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      alert(`OAuth 시작 실패: ${message}`);
    }
  };

  const handleGoogleCalendarDisconnect = (): void => {
    setCalendarAccessToken('');
    setCalendarRefreshToken('');
    setCalendarAuthStatus('disconnected');
    const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
    if (savedOAuth) {
      try {
        const parsed = JSON.parse(savedOAuth) as { accessToken?: string; refreshToken?: string };
        parsed.accessToken = '';
        parsed.refreshToken = '';
        localStorage.setItem('workflow_calendar_oauth', JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
    }
  };

  return {
    url,
    setUrl,
    email,
    setEmail,
    token,
    setToken,
    confluenceSpace,
    setConfluenceSpace,
    confluenceParentId,
    setConfluenceParentId,
    calendarId,
    setCalendarId,
    calendarClientId,
    setCalendarClientId,
    calendarClientSecret,
    setCalendarClientSecret,
    calendarAuthStatus: calendarAuthStatus as CalendarAuthStatus,
    calendarErrorMessage,
    apiMode,
    newMemberName,
    setNewMemberName,
    registeredMembers,
    handleSaveSettings,
    handleApiToggle,
    handleAddTeamMember,
    handleRemoveTeamMember,
    handleGoogleCalendarConnect,
    handleGoogleCalendarDisconnect,
  };
}
