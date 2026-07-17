'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  getVacationMembers,
  JqlQueryBuilder,
  DailyReportStrategy,
  WeeklyReportStrategy,
  ReportContext,
} from '../utils/jira';
import { fetchJiraTickets } from '../utils/jiraApi';
import { generateMockTickets } from '../utils/mockTickets';
import { fetchCalendarEvents } from '../utils/calendarApi';
import { buildJql, buildNextWeekJql, buildScheduleJql, buildAnalyticsJql } from '../utils/jqlHelpers';
import { parseMarkdownToHtml } from '../utils/markdown';
import { buildEpicScheduleData, buildGanttData } from '../utils/schedule';
import { buildWeeklyDownloadMarkdown } from '../utils/reportDownload';
import { resolveAppSettings } from '../utils/resolveAppSettings';

export function useSprintFlow() {
  // SSR 하이드레이션 보호용 마운트 상태
  const [mounted, setMounted] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Jira API 설정 상태
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [confluenceSpace, setConfluenceSpace] = useState('');
  const [confluenceParentId, setConfluenceParentId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [vacationList, setVacationList] = useState([]);

  // Google Calendar OAuth 2.0 상태
  const [calendarClientId, setCalendarClientId] = useState('');
  const [calendarClientSecret, setCalendarClientSecret] = useState('');
  const [calendarAccessToken, setCalendarAccessToken] = useState('');
  const [calendarRefreshToken, setCalendarRefreshToken] = useState('');
  const [calendarAuthStatus, setCalendarAuthStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [calendarErrorMessage, setCalendarErrorMessage] = useState('');
  const [apiMode, setApiMode] = useState(false);

  // 팀원 관리 상태
  const [registeredMembers, setRegisteredMembers] = useState([]);
  const [newMemberName, setNewMemberName] = useState('');

  // 필터 조건 상태
  const [projectKey, setProjectKey] = useState('DI26');
  const [teamMembers, setTeamMembers] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStatsJqlOpen, setIsStatsJqlOpen] = useState(true);
  const [isAnalyticsLoaded, setIsAnalyticsLoaded] = useState(false);
  const [isScheduleLoaded, setIsScheduleLoaded] = useState(false);
  const [expandedEpics, setExpandedEpics] = useState({});

  const toggleEpicCollapse = (epicKey) => {
    setExpandedEpics(prev => ({
      ...prev,
      [epicKey]: !prev[epicKey]
    }));
  };

  // 실적 분석 별도 필터 및 데이터 상태
  const [analyticsProjectKey, setAnalyticsProjectKey] = useState('DI26');
  const [analyticsTeamMembers, setAnalyticsTeamMembers] = useState('');
  const [analyticsDateStart, setAnalyticsDateStart] = useState('');
  const [analyticsDateEnd, setAnalyticsDateEnd] = useState('');
  const [analyticsTickets, setAnalyticsTickets] = useState([]);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  // 대시보드 데이터 및 탭 상태
  const [activeTab, setActiveTab] = useState('tab-daily');
  const [tickets, setTickets] = useState([]);
  const [nextTickets, setNextTickets] = useState([]);
  const [scheduleTickets, setScheduleTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    dot: 'accent',
    text: '시뮬레이션 모드 작동 중'
  });

  // 복사 및 파일 저장을 위한 마크다운 결과 상태
  const [dailyReportMd, setDailyReportMd] = useState('');
  const [weeklyReportMd, setWeeklyReportMd] = useState('');

  // --------------------------------------------------------------------------
  // 1. 초기 셋팅 & LocalStorage 로드 (Client-Side Only)
  // --------------------------------------------------------------------------
  // OAuth 콜백에서 code를 받아 토큰 교환하는 함수
  const handleOAuthCallback = useCallback(async (code, savedClientId, savedClientSecret) => {
    try {
      setCalendarAuthStatus('connecting');
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exchange',
          code,
          clientId: savedClientId,
          clientSecret: savedClientSecret,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '토큰 교환 실패');
      }

      const tokenData = await response.json();
      setCalendarAccessToken(tokenData.access_token);
      if (tokenData.refresh_token) {
        setCalendarRefreshToken(tokenData.refresh_token);
      }
      setCalendarAuthStatus('connected');

      // 토큰을 localStorage에 저장
      const oauthData = {
        clientId: savedClientId,
        clientSecret: savedClientSecret,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
        authMode: 'oauth',
      };
      localStorage.setItem('workflow_calendar_oauth', JSON.stringify(oauthData));

      console.log('[Calendar OAuth] 토큰 교환 성공');
      return tokenData;
    } catch (err) {
      console.error('[Calendar OAuth] 토큰 교환 실패:', err);
      setCalendarAuthStatus('error');
      alert(`Google Calendar 인증 실패: ${err.message}`);
      return null;
    }
  }, []);

  useEffect(() => {
    setMounted(true);

    const today = dayjs();
    const mondayStr = today.day() === 0 ? today.subtract(6, 'day').format('YYYY-MM-DD') : today.day(1).format('YYYY-MM-DD');
    const fridayStr = today.day() === 0 ? today.subtract(2, 'day').format('YYYY-MM-DD') : today.day(5).format('YYYY-MM-DD');

    setDateStart(mondayStr);
    setDateEnd(fridayStr);
    setAnalyticsDateStart(today.startOf('month').format('YYYY-MM-DD'));
    setAnalyticsDateEnd(today.endOf('month').format('YYYY-MM-DD'));

    let cancelled = false;

    async function bootstrapApp() {
      const localSettings = {
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
          const parsed = JSON.parse(savedSettings);
          localSettings.url = parsed.url || '';
          localSettings.email = parsed.email || '';
          localSettings.token = parsed.token || '';
          localSettings.confluenceSpace = parsed.confluenceSpace || '';
          localSettings.confluenceParentId = parsed.confluenceParentId || '';
          localSettings.apiMode = parsed.apiMode || false;
        } catch (e) {
          console.error('설정을 복구하는 중 오류 발생:', e);
        }
      }

      const savedCalendar = localStorage.getItem('workflow_calendar_settings');
      if (savedCalendar) {
        try {
          const parsed = JSON.parse(savedCalendar);
          localSettings.calendarId = parsed.calendarId || '';
        } catch (e) {
          console.error('캘린더 설정을 복구하는 중 오류 발생:', e);
        }
      }

      const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
      if (savedOAuth) {
        try {
          const parsed = JSON.parse(savedOAuth);
          localSettings.calendarClientId = parsed.clientId || '';
          localSettings.calendarClientSecret = parsed.clientSecret || '';
          localSettings.calendarAccessToken = parsed.accessToken || '';
          localSettings.calendarRefreshToken = parsed.refreshToken || '';
        } catch (e) {
          console.error('OAuth 캘린더 설정 복구 중 오류:', e);
        }
      }

      const savedMembers = localStorage.getItem('workflow_registered_members');
      if (savedMembers) {
        try {
          localSettings.registeredMembers = JSON.parse(savedMembers);
        } catch (e) {
          console.error('팀원 목록 복구 중 오류 발생:', e);
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

      let envConfig = null;
      try {
        const response = await fetch('/api/app-config');
        if (response.ok) {
          envConfig = await response.json();
        }
      } catch (e) {
        console.warn('[AppConfig] 서버 env 설정을 불러오지 못했습니다:', e);
      }

      if (cancelled) return;

      const resolved = resolveAppSettings(localSettings, envConfig);

      setUrl(resolved.url);
      setEmail(resolved.email);
      setToken(resolved.token);
      setConfluenceSpace(resolved.confluenceSpace);
      setConfluenceParentId(resolved.confluenceParentId);
      setCalendarId(resolved.calendarId);
      setCalendarClientId(resolved.calendarClientId);
      setCalendarClientSecret(resolved.calendarClientSecret);
      setCalendarAccessToken(resolved.calendarAccessToken);
      setCalendarRefreshToken(resolved.calendarRefreshToken);
      setProjectKey(resolved.projectKey);
      setTeamMembers(resolved.teamMembers);
      setAnalyticsProjectKey(resolved.projectKey);
      setAnalyticsTeamMembers(resolved.teamMembers);
      setRegisteredMembers(resolved.registeredMembers);
      setApiMode(resolved.apiMode);

      if (resolved.hasCalendarCredentials) {
        setCalendarAuthStatus('connected');
      }

      if (resolved.fromEnv) {
        console.log('[AppConfig] 서버 환경 변수로 설정이 적용되었습니다.');
        setConnectionStatus({ dot: 'success', text: '환경 변수 설정 적용됨 — Jira API 대기 중' });
      } else if (resolved.apiMode) {
        setConnectionStatus({ dot: 'success', text: 'Jira API 대기 중' });
      } else {
        setConnectionStatus({ dot: 'accent', text: '시뮬레이션 모드 작동 중' });
      }

      // OAuth 콜백 처리 (Google 로그인 후 리디렉트)
      const urlParams = new URLSearchParams(window.location.search);
      const calendarAuth = urlParams.get('calendar_auth');
      const calendarCode = urlParams.get('calendar_code');
      const urlCalendarId = urlParams.get('calendar_id');

      if (calendarAuth === 'success' && calendarCode) {
        let activeCalendarId = resolved.calendarId;
        if (urlCalendarId) {
          setCalendarId(urlCalendarId);
          activeCalendarId = urlCalendarId;
          localStorage.setItem('workflow_calendar_settings', JSON.stringify({ calendarId: urlCalendarId }));
        }

        const cleanUrl = new URL(window.location);
        cleanUrl.searchParams.delete('calendar_auth');
        cleanUrl.searchParams.delete('calendar_code');
        cleanUrl.searchParams.delete('calendar_id');
        window.history.replaceState({}, '', cleanUrl);

        const cId = resolved.calendarClientId;
        const cSecret = resolved.calendarClientSecret;
        if (cId && cSecret) {
          handleOAuthCallback(calendarCode, cId, cSecret);
        } else {
          alert('OAuth Client ID / Secret이 저장되어 있지 않습니다. 먼저 설정을 저장해 주세요.');
        }
      } else if (calendarAuth === 'denied') {
        const cleanUrl = new URL(window.location);
        cleanUrl.searchParams.delete('calendar_auth');
        cleanUrl.searchParams.delete('calendar_error');
        window.history.replaceState({}, '', cleanUrl);
        alert('Google Calendar 인증이 거부되었습니다.');
      } else if (calendarAuth === 'error') {
        const calendarError = urlParams.get('calendar_error');
        const cleanUrl = new URL(window.location);
        cleanUrl.searchParams.delete('calendar_auth');
        cleanUrl.searchParams.delete('calendar_error');
        window.history.replaceState({}, '', cleanUrl);
        alert(`Google Calendar 인증 오류: ${calendarError || '알 수 없는 오류'}`);
      }

      setIsConfigLoaded(true);
      setIsAnalyticsLoaded(false);

      triggerInitialFetch({
        apiMode: resolved.apiMode,
        projectKey: resolved.projectKey,
        teamMembers: resolved.teamMembers,
        start: mondayStr,
        end: fridayStr,
        url: resolved.url,
        email: resolved.email,
        token: resolved.token,
        calendarId: resolved.calendarId,
        accessToken: resolved.calendarAccessToken,
        refreshToken: resolved.calendarRefreshToken,
        clientId: resolved.calendarClientId,
        clientSecret: resolved.calendarClientSecret,
        registeredMembers: resolved.registeredMembers,
      });
    }

    bootstrapApp();

    return () => {
      cancelled = true;
    };
  }, []);

  // 실적 분석: 기간·필터 변경 시 재조회
  useEffect(() => {
    if (!mounted || !isConfigLoaded || !isStatsJqlOpen || !analyticsDateStart || !analyticsDateEnd) return;
    lazyLoadAnalyticsTickets();
  }, [
    mounted,
    isConfigLoaded,
    isStatsJqlOpen,
    analyticsDateStart,
    analyticsDateEnd,
    analyticsProjectKey,
    analyticsTeamMembers,
  ]);

  // --------------------------------------------------------------------------
  // 2. JQL 빌더 계산 함수
  // --------------------------------------------------------------------------
  const getJql = () => buildJql(projectKey, teamMembers, dateStart, dateEnd);

  const getNextWeekJql = () => buildNextWeekJql(projectKey, teamMembers, dateStart, dateEnd);

  const getScheduleJql = (proj = projectKey, members = teamMembers) => buildScheduleJql(proj, members);

  const updateConnectionStatus = useCallback((status) => {
    setConnectionStatus(status);
  }, []);

  const loadJiraTickets = useCallback(async (jql, modeUrl, modeEmail, modeToken) => {
    return fetchJiraTickets(jql, modeUrl, modeEmail, modeToken, updateConnectionStatus);
  }, [updateConnectionStatus]);

  const loadCalendarEvents = useCallback(async (calId, start, end, oauthParams = {}) => {
    const result = await fetchCalendarEvents({
      calId,
      start,
      end,
      accessToken: oauthParams.accessToken || calendarAccessToken,
      refreshToken: oauthParams.refreshToken || calendarRefreshToken,
      clientId: oauthParams.clientId || calendarClientId,
      clientSecret: oauthParams.clientSecret || calendarClientSecret,
    });

    if (result.error) {
      setCalendarErrorMessage(result.error);
      if (result.needReauth) {
        setCalendarAuthStatus('error');
      }
      return [];
    }

    setCalendarErrorMessage('');
    if (result.newAccessToken) {
      setCalendarAccessToken(result.newAccessToken);
      const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
      if (savedOAuth) {
        try {
          const parsed = JSON.parse(savedOAuth);
          parsed.accessToken = result.newAccessToken;
          parsed.expiresAt = Date.now() + 3600 * 1000;
          localStorage.setItem('workflow_calendar_oauth', JSON.stringify(parsed));
        } catch (e) {
          /* ignore */
        }
      }
    }

    return result.items;
  }, [calendarAccessToken, calendarRefreshToken, calendarClientId, calendarClientSecret]);

  // --------------------------------------------------------------------------
  // 5. 티켓 로드 통합 실행 제어
  // --------------------------------------------------------------------------
  const triggerInitialFetch = async (params) => {
    setIsLoading(true);
    setIsAnalyticsLoading(false);

    if (params.apiMode) {
      const proj = params.projectKey.trim() || 'PROJ';
      const members = params.teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0);

      const nextStartStr = dayjs(params.start).add(7, 'day').format('YYYY-MM-DD');
      const nextEndStr = dayjs(params.end).add(7, 'day').format('YYYY-MM-DD');

      const jql = new JqlQueryBuilder()
        .setProject(proj)
        .setAssignees(params.teamMembers)
        .setDateRange(params.start, params.end, 'updated')
        .build();

      const nextJql = new JqlQueryBuilder()
        .setProject(proj)
        .setAssignees(params.teamMembers)
        .setDateRange(nextStartStr, nextEndStr, 'updated')
        .build();

      try {
        setConnectionStatus({ dot: 'success', text: '초기 로드: 이번 주 데이터 수집 중...' });
        const currentData = await loadJiraTickets(jql, params.url, params.email, params.token);

        setConnectionStatus({ dot: 'success', text: '초기 로드: 다음 주 계획 수집 중...' });
        const nextData = await loadJiraTickets(nextJql, params.url, params.email, params.token);

        setConnectionStatus({ dot: 'success', text: '초기 로드: 캘린더 연차 데이터 조회 중...' });
        let calEvents = [];
        if (params.calendarId && (params.accessToken || params.refreshToken)) {
          calEvents = await loadCalendarEvents(params.calendarId, params.start, params.end, {
            accessToken: params.accessToken,
            refreshToken: params.refreshToken,
            clientId: params.clientId,
            clientSecret: params.clientSecret
          });
          console.log('[Calendar] calEvents 로드 완료:', calEvents);
        } else {
          console.log('[Calendar] 캘린더 조회 스킵 — calendarId:', params.calendarId, '| 토큰 정보 없음');
        }
        // UI 연차 표시용은 params.start(Monday) ~ params.end(Friday) 전체 범위로 계산
        const activeRegs = params.registeredMembers || registeredMembers;
        const currentVacationList = getVacationMembers(calEvents, params.start, params.end, activeRegs);

        setTickets(currentData);
        setNextTickets(nextData);
        setAnalyticsTickets([]);
        setScheduleTickets([]);
        setIsAnalyticsLoaded(false);
        setIsScheduleLoaded(false);
        // processReportData에는 raw events 배열(calEvents)을 바로 넘김
        setVacationList(calEvents);
        processReportData(currentData, nextData, params.start, params.end, params.projectKey, calEvents, activeRegs);
        setConnectionStatus({
          dot: 'success',
          text: `Jira API 연동 완료 (이번 주 ${currentData.length}건 / 다음 주 ${nextData.length}건 / 연차 ${currentVacationList.length}명)`
        });
      } catch (err) {
        console.error('초기 로딩 지라 API 에러:', err);
        setConnectionStatus({ dot: 'danger', text: `초기 로드 실패 (${err.message})` });

        // 폴백으로 Mock 데이터 제공 (이영희를 임시 연차자로 지정)
        const mock = generateMockTickets(params.projectKey, params.teamMembers, params.start, params.end);
        const nextMock = generateMockTickets(params.projectKey, params.teamMembers, nextStartStr, nextEndStr);
        const currentVacationList = ['이영희'];
        setVacationList(currentVacationList);
        setTickets(mock);
        setNextTickets(nextMock);
        setAnalyticsTickets([]);
        setScheduleTickets([]);
        setIsAnalyticsLoaded(false);
        setIsScheduleLoaded(false);
        processReportData(mock, nextMock, params.start, params.end, params.projectKey, currentVacationList);
      } finally {
        setIsLoading(false);
      }
    } else {
      setTimeout(() => {
        const mock = generateMockTickets(params.projectKey, params.teamMembers, params.start, params.end);

        const nextStartStr = dayjs(params.start).add(7, 'day').format('YYYY-MM-DD');
        const nextEndStr = dayjs(params.end).add(7, 'day').format('YYYY-MM-DD');
        const nextMock = generateMockTickets(params.projectKey, params.teamMembers, nextStartStr, nextEndStr);

        const currentVacationList = ['이영희']; // 시뮬레이터 기본 연차자 설정
        setVacationList(currentVacationList);

        setTickets(mock);
        setNextTickets(nextMock);
        setAnalyticsTickets([]);
        setScheduleTickets([]);
        setIsAnalyticsLoaded(false);
        setIsScheduleLoaded(false);
        processReportData(mock, nextMock, params.start, params.end, params.projectKey, currentVacationList);
        setIsLoading(false);
      }, 400);
    }
  };

  const handleFetchTickets = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setIsAnalyticsLoading(false);

    const start = dateStart;
    const end = dateEnd;
    const nextStartStr = dayjs(start).add(7, 'day').format('YYYY-MM-DD');
    const nextEndStr = dayjs(end).add(7, 'day').format('YYYY-MM-DD');

    const jql = getJql();
    const nextJql = getNextWeekJql();

    if (apiMode) {
      try {
        setConnectionStatus({ dot: 'success', text: '이번 주 데이터 로드 중...' });
        const currentData = await loadJiraTickets(jql, url, email, token);

        setConnectionStatus({ dot: 'success', text: '다음 주 계획 데이터 로드 중...' });
        const nextData = await loadJiraTickets(nextJql, url, email, token);

        setConnectionStatus({ dot: 'success', text: '캘린더 연차 데이터 조회 중...' });
        let calEvents = [];
        if (calendarId && (calendarAccessToken || calendarRefreshToken)) {
          calEvents = await loadCalendarEvents(calendarId, start, end);
          console.log('[Calendar] calEvents 로드 완료:', calEvents);
        } else {
          console.log('[Calendar] 캘린더 조회 스킵 — calendarId:', calendarId, '| 토큰 정보 없음');
        }
        // UI 연차 표시용은 start ~ end 전체 범위로 계산
        const currentVacationList = getVacationMembers(calEvents, start, end, registeredMembers);

        setTickets(currentData);
        setNextTickets(nextData);
        setAnalyticsTickets([]);
        setScheduleTickets([]);
        setIsAnalyticsLoaded(false);
        setIsScheduleLoaded(false);
        // processReportData에는 raw events 배열(calEvents)을 바로 넘김
        setVacationList(calEvents);
        processReportData(currentData, nextData, start, end, projectKey, calEvents, registeredMembers);
        setConnectionStatus({
          dot: 'success',
          text: `Jira API 연동 완료 (이번 주 ${currentData.length}건 / 다음 주 ${nextData.length}건 / 연차 ${currentVacationList.length}명)`
        });
      } catch (err) {
        console.error('Jira API 연동 에러:', err);
        alert(`[Jira API 연동 실패]\n\n오류 내용: ${err.message}\n\n입력하신 도메인, 이메일, 토큰 및 로컬 프록시가 작동 중인지 확인해 주세요.`);
        setConnectionStatus({ dot: 'danger', text: `연동 실패 (${err.message})` });
      } finally {
        setIsLoading(false);
      }
    } else {
      // 시뮬레이터 동작
      setTimeout(() => {
        const mock = generateMockTickets(projectKey, teamMembers, start, end);
        const nextMock = generateMockTickets(projectKey, teamMembers, nextStartStr, nextEndStr);

        const currentVacationList = ['이영희']; // 시뮬레이션 고정 연차자
        setVacationList(currentVacationList);

        setTickets(mock);
        setNextTickets(nextMock);
        setAnalyticsTickets([]);
        setScheduleTickets([]);
        setIsAnalyticsLoaded(false);
        setIsScheduleLoaded(false);
        processReportData(mock, nextMock, start, end, projectKey, currentVacationList);
        setIsLoading(false);
      }, 500);
    }
  };

  const epicScheduleData = useMemo(
    () => buildEpicScheduleData(scheduleTickets),
    [scheduleTickets]
  );

  const ganttData = useMemo(
    () => buildGanttData(epicScheduleData),
    [epicScheduleData]
  );

  // 실적 분석 기간 단독 조회 핸들러
  const handleFetchAnalyticsTickets = async (start, end) => {
    setIsAnalyticsLoading(true);
    setIsAnalyticsLoaded(false);

    const jql = buildAnalyticsJql(analyticsProjectKey, analyticsTeamMembers, start, end);
    console.log('[Analytics] JQL:', jql);

    if (apiMode) {
      try {
        setConnectionStatus({ dot: 'success', text: '실적 분석 데이터 로드 중...' });
        const analyticsData = await loadJiraTickets(jql, url, email, token);
        setAnalyticsTickets(analyticsData);
        setIsAnalyticsLoaded(true);
        setConnectionStatus({
          dot: 'success',
          text: `실적 분석 데이터 수집 완료 (${analyticsData.length}건)`
        });
      } catch (err) {
        console.error('실적 분석 지라 API 에러:', err);
        alert(`[실적 분석 지라 API 에러]\n\n오류 내용: ${err.message}`);
        setConnectionStatus({ dot: 'danger', text: `실적 분석 연동 실패 (${err.message})` });
      } finally {
        setIsAnalyticsLoading(false);
      }
    } else {
      setTimeout(() => {
        const mock = generateMockTickets(analyticsProjectKey, analyticsTeamMembers, start, end);
        setAnalyticsTickets(mock);
        setIsAnalyticsLoaded(true);
        setIsAnalyticsLoading(false);
      }, 500);
    }
  };

  const lazyLoadAnalyticsTickets = async () => {
    setIsAnalyticsLoading(true);
    const jql = buildAnalyticsJql(
      analyticsProjectKey,
      analyticsTeamMembers,
      analyticsDateStart,
      analyticsDateEnd
    );
    console.log('[Analytics] JQL:', jql);

    if (apiMode) {
      try {
        setConnectionStatus({ dot: 'success', text: '실적 분석 데이터 로드 중...' });
        const analyticsData = await loadJiraTickets(jql, url, email, token);
        setAnalyticsTickets(analyticsData);
        setIsAnalyticsLoaded(true);
        setConnectionStatus({
          dot: 'success',
          text: `실적 분석 데이터 수집 완료 (${analyticsData.length}건, ${analyticsDateStart}~${analyticsDateEnd})`
        });
      } catch (err) {
        console.error('실적 분석 지라 API 에러:', err);
        alert(`[실적 분석 지라 API 에러]\n\n오류 내용: ${err.message}`);
        setConnectionStatus({ dot: 'danger', text: `실적 분석 연동 실패 (${err.message})` });
      } finally {
        setIsAnalyticsLoading(false);
      }
    } else {
      setTimeout(() => {
        const mock = generateMockTickets(analyticsProjectKey, analyticsTeamMembers, analyticsDateStart, analyticsDateEnd);
        setAnalyticsTickets(mock);
        setIsAnalyticsLoaded(true);
        setIsAnalyticsLoading(false);
      }, 500);
    }
  };

  const lazyLoadScheduleTickets = async () => {
    if (isScheduleLoaded) return;
    setIsLoading(true);
    if (apiMode) {
      try {
        setConnectionStatus({ dot: 'success', text: '전체 일정 데이터 로드 중...' });
        const scheduleJql = getScheduleJql();
        const scheduleData = await loadJiraTickets(scheduleJql, url, email, token);
        setScheduleTickets(scheduleData);
        setIsScheduleLoaded(true);
        setConnectionStatus({
          dot: 'success',
          text: `전체 일정 데이터 수집 완료 (${scheduleData.length}건)`
        });
      } catch (err) {
        console.error('전체 일정 지라 API 에러:', err);
        alert(`[전체 일정 지라 API 에러]\n\n오류 내용: ${err.message}`);
        setConnectionStatus({ dot: 'danger', text: `전체 일정 연동 실패 (${err.message})` });
      } finally {
        setIsLoading(false);
      }
    } else {
      setTimeout(() => {
        const thisYear = dayjs().year();
        const scheduleMock = generateMockTickets(projectKey, teamMembers, `${thisYear}-01-01`, `${thisYear}-12-31`);
        setScheduleTickets(scheduleMock);
        setIsScheduleLoaded(true);
        setIsLoading(false);
      }, 500);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'tab-schedule') {
      lazyLoadScheduleTickets();
    }
  };

  const handleToggleStatsSection = () => {
    const nextOpen = !isStatsJqlOpen;
    setIsStatsJqlOpen(nextOpen);
    if (nextOpen) lazyLoadAnalyticsTickets();
  };

  // --------------------------------------------------------------------------
  // 6. 보고서 마크다운 생성기
  // --------------------------------------------------------------------------
  const processReportData = (currList, nextList, start, end, proj, customVacations = null, activeRegs = null) => {
    const rawEvents = customVacations !== null ? customVacations : vacationList;
    const targetRegs = activeRegs || registeredMembers;

    const reportParams = {
      currList,
      nextList,
      start,
      end,
      proj,
      rawEvents,
      targetRegs,
      jiraUrl: url
    };

    // Strategy Pattern Context를 이용한 일일 및 주간 보고서 생성
    const dailyContext = new ReportContext(new DailyReportStrategy());
    const dailyMd = dailyContext.generate(reportParams);
    setDailyReportMd(dailyMd);

    const weeklyContext = new ReportContext(new WeeklyReportStrategy());
    const weeklyMd = weeklyContext.generate(reportParams);
    setWeeklyReportMd(weeklyMd);
  };

  // --------------------------------------------------------------------------
  // 7. 설정 저장 & 로컬스토리지 동기화 핸들러
  // --------------------------------------------------------------------------
  const handleSaveSettings = () => {
    const settings = { url, email, token, confluenceSpace, confluenceParentId, apiMode };
    localStorage.setItem('workflow_jira_settings', JSON.stringify(settings));

    const calSettings = { calendarId };
    localStorage.setItem('workflow_calendar_settings', JSON.stringify(calSettings));

    // OAuth 설정도 저장
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
    handleFetchTickets();
  };

  const handleApiToggle = (e) => {
    const enabled = e.target.checked;
    setApiMode(enabled);

    const settings = { url, email, token, confluenceSpace, confluenceParentId, apiMode: enabled };
    localStorage.setItem('workflow_jira_settings', JSON.stringify(settings));

    if (enabled) {
      setConnectionStatus({ dot: 'success', text: 'Jira API 대기 중' });
    } else {
      setConnectionStatus({ dot: 'accent', text: '시뮬레이션 모드 작동 중' });
    }

    // 모드 변경 시 즉시 fetch 재실행
    setTimeout(() => handleFetchTickets(), 50);
  };

  const handleAddTeamMember = () => {
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

  const handleRemoveTeamMember = (name) => {
    const newList = registeredMembers.filter(m => m !== name);
    setRegisteredMembers(newList);
    localStorage.setItem('workflow_registered_members', JSON.stringify(newList));
  };

  const handleToggleMemberChip = (member) => {
    let list = teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0);
    if (list.includes(member)) {
      list = list.filter(m => m !== member);
    } else {
      list.push(member);
    }
    const finalVal = list.join(', ');
    setTeamMembers(finalVal);
    localStorage.setItem('workflow_filter_members', finalVal);
  };

  // --------------------------------------------------------------------------
  // 8. 컨플루언스 등록 REST API 연동
  // --------------------------------------------------------------------------
  const handlePublishConfluence = async () => {
    let reportText = '';
    let reportTitle = '';

    if (activeTab === 'tab-daily') {
      reportText = dailyReportMd;
      const todayStr = dayjs().format('YYYY.MM.DD');
      reportTitle = `📅 [일일업무] ${todayStr}`;
    } else if (activeTab === 'tab-weekly') {
      reportText = weeklyReportMd;
      const displayStart = dayjs(dateStart).format('YYYY.MM.DD');
      const displayEnd = dayjs(dateEnd).format('YYYY.MM.DD');
      reportTitle = `📊 [주간업무] ${displayStart} ~ ${displayEnd}`;
    } else {
      alert('컨플루언스에 등록할 보고서 탭(일일 혹은 주간)을 선택해 주세요.');
      return;
    }

    if (!reportText) {
      alert('등록할 보고서 내용이 없습니다. 먼저 티켓 가져오기를 수행해 주세요.');
      return;
    }

    if (!confluenceSpace.trim()) {
      alert('컨플루언스 등록을 위해 Space Key를 필터 설정창 옆 또는 설정 패널에 입력해 주세요.');
      return;
    }

    // 시뮬레이터 모드일 때
    if (!apiMode) {
      setIsLoading(true);
      setTimeout(() => {
        const fakeBase = url.trim() || 'https://ikoobdoc.atlassian.net';
        const fakeLink = `${fakeBase.replace(/\/$/, '')}/wiki/spaces/${confluenceSpace.toUpperCase()}/pages/${Math.floor(Math.random() * 90000000) + 10000000}`;
        alert(`[컨플루언스 등록 시뮬레이션 성공]\n\n등록 공간: ${confluenceSpace.toUpperCase()}\n문서 제목: ${reportTitle}\n\n등록된 임시 링크 (새 창에서 열기):\n${fakeLink}`);
        window.open(fakeLink, '_blank');
        setIsLoading(false);
      }, 800);
      return;
    }

    setIsLoading(true);
    const credential = btoa(`${email}:${token}`);
    let cleanUrl = url.trim();
    try {
      if (cleanUrl.toLowerCase().startsWith('http')) {
        const urlObj = new URL(cleanUrl);
        cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
    } catch (e) {
      console.warn('Confluence Host 파싱 에러:', e);
    }

    // 컨플루언스 등록 시 에픽 정보(*(에픽: ...)*) 제거 — 에픽 제목에 (APP), (관리자) 등 괄호 포함 대응
    const cleanedReportText = reportText.replace(/ \*\(에픽:.*?\)\*/g, '');
    const htmlContent = parseMarkdownToHtml(cleanedReportText);
    const targetUrl = `${cleanUrl.replace(/\/$/, '')}/wiki/rest/api/content`;
    const proxyEndpoint = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

    const requestBody = {
      type: 'page',
      title: reportTitle,
      space: {
        key: confluenceSpace.toUpperCase()
      },
      body: {
        storage: {
          value: htmlContent,
          representation: 'storage'
        }
      }
    };

    if (confluenceParentId && confluenceParentId.trim()) {
      requestBody.ancestors = [
        {
          id: confluenceParentId.trim()
        }
      ];
    }

    try {
      const response = await fetch(proxyEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credential}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Confluence API Error Response:', errText);
        throw new Error(`컨플루언스 서버 응답 에러 (코드: ${response.status})`);
      }

      const data = await response.json();
      const docLink = `${cleanUrl.replace(/\/$/, '')}/wiki${data._links?.webui || ''}`;

      alert(`[컨플루언스 등록 완료]\n\n문서가 성공적으로 발행되었습니다!\n\n확인 주소:\n${docLink}`);
      window.open(docLink, '_blank');
    } catch (err) {
      alert(`[컨플루언스 등록 실패]\n\n오류: ${err.message}\n\nURL 설정이나 공간(Space) 권한이 올바른지 확인해 주세요.`);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 9. 마크다운 클립보드 복사 & 다운로드 유틸
  // --------------------------------------------------------------------------
  const handleCopyReport = () => {
    let txt = '';
    if (activeTab === 'tab-daily') txt = dailyReportMd;
    else if (activeTab === 'tab-weekly') txt = weeklyReportMd;
    else {
      alert('복사할 마크다운 보고서 탭을 선택해 주세요.');
      return;
    }

    if (!txt) {
      alert('복사할 내용이 없습니다.');
      return;
    }

    navigator.clipboard.writeText(txt)
      .then(() => alert('마크다운 업무 보고서가 클립보드에 복사되었습니다.'))
      .catch(() => alert('클립보드 복사 중 에러가 발생했습니다.'));
  };

  const handleDownloadReport = () => {
    let txt = '';
    let name = '';
    if (activeTab === 'tab-daily') {
      txt = dailyReportMd;
      name = `Daily_Report_${dateStart}_to_${dateEnd}.md`;
    } else if (activeTab === 'tab-weekly') {
      txt = buildWeeklyDownloadMarkdown({
        weeklyReportMd,
        tickets,
        nextTickets,
        vacationList,
        dateStart,
        dateEnd,
        registeredMembers,
      });
      name = `Weekly_Report_${dateStart}_to_${dateEnd}.md`;
    } else {
      alert('다운로드할 보고서 탭을 선택해 주세요.');
      return;
    }

    if (!txt) {
      alert('다운로드할 내용이 없습니다.');
      return;
    }

    const blob = new Blob([txt], { type: 'text/markdown;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', name);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const handleCopyJql = () => {
    const query = getJql();
    navigator.clipboard.writeText(query)
      .then(() => alert('JQL 쿼리가 클립보드에 복사되었습니다.'))
      .catch(() => alert('복사 실패'));
  };

  const handleGoogleCalendarConnect = async () => {
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
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('인증 URL을 생성하지 못했습니다.');
      }
    } catch (err) {
      console.error('OAuth 시작 실패:', err);
      setCalendarAuthStatus('error');
      alert(`OAuth 시작 실패: ${err.message}`);
    }
  };

  const handleGoogleCalendarDisconnect = () => {
    setCalendarAccessToken('');
    setCalendarRefreshToken('');
    setCalendarAuthStatus('disconnected');
    const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
    if (savedOAuth) {
      try {
        const parsed = JSON.parse(savedOAuth);
        parsed.accessToken = '';
        parsed.refreshToken = '';
        localStorage.setItem('workflow_calendar_oauth', JSON.stringify(parsed));
      } catch (e) { /* ignore */ }
    }
  };

  const activeChipsList = useMemo(
    () => teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0),
    [teamMembers]
  );

  return {
    mounted,
    layout: {
      isSidebarOpen,
      setIsSidebarOpen,
    },
    settings: {
      url, // Jira URL
      setUrl, // Jira URL 설정
      email, // Jira 이메일
      setEmail, // Jira 이메일 설정
      token, // Jira API 토큰
      setToken, // Jira API 토큰 설정
      confluenceSpace, // 컨플루언스 스페이스
      setConfluenceSpace, // 컨플루언스 스페이스 설정
      confluenceParentId, // 컨플루언스 부모 ID
      setConfluenceParentId, // 컨플루언스 부모 ID 설정
      calendarId, // 구글 캘린더 ID
      setCalendarId, // 구글 캘린더 ID 설정
      calendarClientId, // 구글 캘린더 클라이언트 ID
      setCalendarClientId, // 구글 캘린더 클라이언트 ID 설정
      calendarClientSecret, // 구글 캘린더 클라이언트 시크릿
      setCalendarClientSecret, // 구글 캘린더 클라이언트 시크릿 설정
      calendarAuthStatus, // 구글 캘린더 인증 상태
      calendarErrorMessage, // 구글 캘린더 인증 에러 메시지
      apiMode, // API 모드
      newMemberName, // 새 팀 멤버 이름
      setNewMemberName, // 새 팀 멤버 이름 설정
      registeredMembers, // 등록된 팀 멤버 목록
      handleSaveSettings, // 설정 저장
      handleApiToggle, // API 모드 토글
      handleAddTeamMember, // 팀 멤버 추가
      handleRemoveTeamMember, // 팀 멤버 제거
      handleGoogleCalendarConnect, // 구글 캘린더 연동
      handleGoogleCalendarDisconnect, // 구글 캘린더 연동 해제
    },
    filter: {
      projectKey, // 프로젝트 키
      setProjectKey, // 프로젝트 키 설정
      teamMembers, // 팀 멤버 데이터
      setTeamMembers, // 팀 멤버 설정
      dateStart, // 시작일
      setDateStart, // 시작일 설정
      dateEnd, // 종료일
      setDateEnd, // 종료일 설정
      isFilterOpen, // 필터 섹션 열림 여부
      setIsFilterOpen, // 필터 섹션 열림 여부 설정
      isLoading, // 로딩 상태
      activeChipsList, // 팀 멤버 칩 목록
      handleFetchTickets, // 티켓 데이터 조회
      handleToggleMemberChip, // 팀 멤버 칩 토글
      getJql, // JQL 조회
      handleCopyJql, // JQL 복사
    },
    connectionStatus,
    stats: {
      isStatsJqlOpen, // 티켓 상태 분포 섹션 열림 여부
      handleToggleStatsSection, // 티켓 상태 분포 섹션 토글
      analyticsTickets, // 티켓 데이터
      analyticsProjectKey, // 프로젝트 키
      setAnalyticsProjectKey, // 프로젝트 키 설정
      analyticsTeamMembers, // 팀 멤버 데이터
      setAnalyticsTeamMembers, // 팀 멤버 설정
      analyticsDateStart, // 시작일
      setAnalyticsDateStart, // 시작일 설정
      analyticsDateEnd, // 종료일
      setAnalyticsDateEnd, // 종료일 설정
      handleFetchAnalyticsTickets, // 티켓 데이터 조회
      isAnalyticsLoading, // 티켓 데이터 로딩 상태  
    },
    reports: {
      activeTab, // 활성 탭
      handleTabChange, // 탭 변경
      dailyReportMd, // 일일 보고서 마크다운
      weeklyReportMd, // 주간 보고서 마크다운
      tickets, // 티켓 데이터
      parseMarkdownToHtml, // 마크다운 파싱
      handleCopyReport, // 마크다운 복사
      handleDownloadReport, // 마크다운 다운로드
      handlePublishConfluence, // 컨플루언스 등록
    },
    schedule: {
      ganttData, // 간트 차트 데이터
      epicScheduleData, // 에픽 스케줄 데이터
      expandedEpics, // 에픽 확장 상태
      toggleEpicCollapse, // 에픽 확장 토글
      url, // 컨플루언스 URL
    },
  };
}
