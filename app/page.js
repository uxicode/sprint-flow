'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PerformanceAnalytics from './components/PerformanceAnalytics';

// ============================================================================
// 캘린더 및 티켓 파싱에 필요한 Stateless 공통 유틸리티 함수들
// ============================================================================

// 티켓 제목 내 대괄호 [ ]를 ( )로 안전하게 변경하여 마크다운 링크 파서 깨짐 현상 예방
const escapeBrackets = (text) => {
  return (text || '').replace(/\[/g, '(').replace(/\]/g, ')');
};

// Jira 티켓의 상세 웹 브라우징 링크 생성
const getTicketLink = (key, jiraUrl) => {
  const baseDomain = jiraUrl && jiraUrl.trim() ? jiraUrl.trim().replace(/\/$/, '') : 'https://ikoobdoc.atlassian.net';
  return `${baseDomain}/browse/${key}`;
};

// 캘린더 날짜 필드(date 또는 dateTime)를 YYYY-MM-DD 로컬 시간 문자열로 변환
const getLocalDateStr = (dateObj) => {
  if (!dateObj) return '';
  if (dateObj.date) return dateObj.date; // YYYY-MM-DD
  if (dateObj.dateTime) {
    const d = new Date(dateObj.dateTime);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
};

// Jira 티켓의 상태 카테고리를 Normalization 처리하는 유틸리티
const getStatusCategory = (statusName) => {
  const status = (statusName || '').toLowerCase().trim();
  if (status.includes('done') || status.includes('resolved') || status.includes('완료') || status.includes('closed') || status.includes('성공')) {
    return 'Done';
  }
  if (status.includes('progress') || status.includes('진행') || status.includes('doing') || status.includes('개발') || status.includes('selected') || status.includes('working')) {
    return 'In Progress';
  }
  return 'To Do';
};

// 캘린더 이벤트 요약 내용에서 연차 유형과 신청 팀원 이름을 추출
const parseVacationEvent = (summary) => {
  if (!summary) return { isVacation: false, name: '', matchedWord: '' };

  const bracketMatch = summary.match(/^\[([^\]]+)\]\s*([가-힣a-zA-Z0-9\s]+)/);
  if (bracketMatch) {
    const type = bracketMatch[1];
    const keywords = ['연차', '휴가', '반차', '대체휴무', '건강검진', '반반차', '오후반반차', '오전반반차', '오전반차', '오후반차', '유연근무'];
    const isVacation = keywords.some(k => type.includes(k));
    if (isVacation) {
      return {
        isVacation: true,
        name: bracketMatch[2].trim(),
        matchedWord: type.trim()
      };
    }
  }

  const suffixMatch = summary.match(/^([가-힣a-zA-Z0-9\s]+?)\s*(연차|휴가|반차|대체휴무|건강검진|오후반반차|오전반반차|오전반차|오후반차|유연근무)/);
  if (suffixMatch) {
    return {
      isVacation: true,
      name: suffixMatch[1].trim(),
      matchedWord: suffixMatch[2].trim()
    };
  }

  return { isVacation: false, name: '', matchedWord: '' };
};

// 캘린더 이벤트의 일정과 대상 조회 범위가 중첩되는지 확인
const isEventOverlapping = (evtStart, evtEnd, startRange, endRange) => {
  const eventStartDate = getLocalDateStr(evtStart);
  const eventEndDate = getLocalDateStr(evtEnd);
  if (!eventStartDate) return false;

  const targetEnd = endRange || startRange;
  if (evtStart?.date) {
    return eventStartDate <= targetEnd && eventEndDate > startRange;
  }
  return eventStartDate <= targetEnd && eventEndDate >= startRange;
};

// 특정 팀원의 기간 내 모든 연차 이력을 문자열로 요약
const getMemberVacationDates = (events, member, startRange, endRange) => {
  if (!Array.isArray(events)) return '';
  const vacationStrings = [];
  events.forEach(evt => {
    const summary = evt.summary || '';
    if (isEventOverlapping(evt.start, evt.end, startRange, endRange)) {
      const { isVacation, name, matchedWord } = parseVacationEvent(summary);
      if (isVacation && name === member) {
        const eventStartDate = getLocalDateStr(evt.start);
        let dateStr = '';
        if (evt.start?.date) {
          const d = new Date(evt.end.date);
          d.setDate(d.getDate() - 1);
          const formattedEndDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-\ ${String(d.getDate()).padStart(2, '0')}`.replace(/\s+/g, '');
          dateStr = eventStartDate === formattedEndDate ? eventStartDate : `${eventStartDate} ~ ${formattedEndDate}`;
        } else {
          const eventEndDate = getLocalDateStr(evt.end);
          dateStr = eventStartDate === eventEndDate ? eventStartDate : `${eventStartDate} ~ ${eventEndDate}`;
        }
        vacationStrings.push(`${matchedWord} (${dateStr})`);
      }
    }
  });
  return vacationStrings.join(', ');
};

// 캘린더 연차 대상 목록을 조회하는 유틸리티
const getVacationMembers = (events, startDate, endDate, registered) => {
  console.log('[Calendar] getVacationMembers 시작 - 대상 범위:', startDate, '~', endDate, '| 등록 팀원:', registered);
  if (!events || events.length === 0 || !startDate) {
    console.log('[Calendar] 이벤트 목록이 비어있거나 날짜가 유효하지 않습니다.');
    return [];
  }

  const vacations = [];
  events.forEach(evt => {
    if (isEventOverlapping(evt.start, evt.end, startDate, endDate)) {
      const { isVacation, name } = parseVacationEvent(evt.summary);
      if (isVacation && name) {
        if (registered.includes(name) && !vacations.includes(name)) {
          vacations.push(name);
          console.log(`[Calendar] 연차 매칭 성공: ${name} (${evt.summary})`);
        }
      }
    }
  });

  console.log('[Calendar] 최종 연차자 명단:', vacations);
  return vacations;
};

// ============================================================================
// 디자인 패턴: 1. Builder Pattern - JQL 쿼리 빌더 클래스
// ============================================================================
class JqlQueryBuilder {
  constructor() {
    this.project = 'PROJ';
    this.assignees = [];
    this.statuses = [];
    this.dateField = 'updated';
    this.startDate = '';
    this.endDate = '';
    this.orderByField = 'updated';
    this.orderDirection = 'DESC';
  }

  setProject(project) {
    this.project = project ? project.trim() : 'PROJ';
    return this;
  }

  setAssignees(membersString) {
    if (membersString) {
      this.assignees = membersString
        .split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);
    }
    return this;
  }

  setDateRange(startDate, endDate, dateField = 'updated') {
    this.startDate = startDate;
    this.endDate = endDate;
    this.dateField = dateField;
    this.orderByField = dateField;
    return this;
  }

  build() {
    let jql = `project = "${this.project}"`;
    if (this.assignees.length > 0) {
      const membersQuery = this.assignees.map(m => `"${m}"`).join(', ');
      jql += ` AND assignee in (${membersQuery})`;
    }
    if (this.statuses.length > 0) {
      const statusesQuery = this.statuses.map(s => `"${s}"`).join(', ');
      jql += ` AND status in (${statusesQuery})`;
    }
    // 하위 작업(Sub-task) 제외
    jql += ' AND issuetype not in subTaskIssueTypes()';
    if (this.startDate) {
      jql += ` AND ${this.dateField} >= "${this.startDate}"`;
    }
    if (this.endDate) {
      jql += ` AND ${this.dateField} <= "${this.endDate} 23:59"`;
    }
    jql += ` ORDER BY ${this.orderByField} ${this.orderDirection}`;
    return jql;
  }
}

// ============================================================================
// 디자인 패턴: 2. Strategy Pattern - 업무 보고서 생성 전략 클래스들
// ============================================================================
class ReportStrategy {
  generate(reportParams) {
    throw new Error('generate method must be implemented');
  }
}

class DailyReportStrategy extends ReportStrategy {
  generate(reportParams) {
    const { currList, nextList, start, end, proj, rawEvents, targetRegs, jiraUrl } = reportParams;
    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    const activeDailyVacations = Array.isArray(rawEvents)
      ? (rawEvents.length > 0 && typeof rawEvents[0] === 'string'
          ? rawEvents
          : getVacationMembers(rawEvents, todayStr, todayStr, targetRegs))
      : [];

    let dailyMd = `# 📅 일일 업무 STAND-UP 보고서\n\n`;
    dailyMd += `> **보고 기간**: ${start} ~ ${end}\n`;
    dailyMd += `> **생성 일시**: ${new Date().toLocaleString('ko-KR')}\n\n`;

    const members = [...new Set(currList.map(t => t.assignee))];
    const vacationOnlyMembers = activeDailyVacations.filter(v => !members.includes(v));
    const allDailyMembers = [...members, ...vacationOnlyMembers];

    if (allDailyMembers.length === 0) {
      dailyMd += `조회 기간 내 진행 중이거나 완료된 티켓이 없습니다.\n`;
    } else {
      allDailyMembers.forEach(member => {
        if (activeDailyVacations.includes(member)) {
          dailyMd += `## 👤 담당자: ${member} (🏝️ 당일 연차/휴가)\n\n`;
          dailyMd += `- 🏝️ 금일 연차(휴가) 일정으로 인해 Stand-up 보고 사항이 없습니다.\n\n---\n\n`;
          return;
        }

        dailyMd += `## 👤 담당자: ${member}\n\n`;
        const memberTickets = currList.filter(t => t.assignee === member);
        const completed = memberTickets.filter(t => getStatusCategory(t.status) === 'Done');
        const progressing = memberTickets.filter(t => getStatusCategory(t.status) === 'In Progress');

        dailyMd += `### 🟢 오늘 완료한 업무 (Done)\n`;
        if (completed.length === 0) {
          dailyMd += `- 완료된 업무가 없습니다.\n`;
        } else {
          completed.forEach(t => {
            const epicInfo = t.epic ? ` *(에픽: ${t.epic.key}: ${escapeBrackets(t.epic.summary)})*` : '';
            dailyMd += `- [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key, jiraUrl)}) (업데이트: ${t.updated})${epicInfo}\n`;
          });
        }
        dailyMd += `\n`;

        dailyMd += `### 🔵 현재 진행 중인 업무 (In Progress)\n`;
        if (progressing.length === 0) {
          dailyMd += `- 진행 중인 업무가 없습니다.\n`;
        } else {
          progressing.forEach(t => {
            const epicInfo = t.epic ? ` *(에픽: ${t.epic.key}: ${escapeBrackets(t.epic.summary)})*` : '';
            dailyMd += `- [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key, jiraUrl)})${epicInfo}\n`;
          });
        }
        dailyMd += `\n---\n\n`;
      });
    }
    return dailyMd;
  }
}

class WeeklyReportStrategy extends ReportStrategy {
  generate(reportParams) {
    const { currList, nextList, start, end, proj, rawEvents, targetRegs, jiraUrl } = reportParams;
    const activeWeeklyVacations = Array.isArray(rawEvents)
      ? (rawEvents.length > 0 && typeof rawEvents[0] === 'string'
          ? rawEvents
          : getVacationMembers(rawEvents, start, end, targetRegs))
      : [];

    const total = currList.length;
    const completedCount = currList.filter(t => getStatusCategory(t.status) === 'Done').length;
    const progressingCount = currList.filter(t => getStatusCategory(t.status) === 'In Progress').length;
    const todoCount = total - completedCount - progressingCount;

    let weeklyMd = `# 📊 주간 프로젝트 업무 보고서\n\n`;
    weeklyMd += `## 🗓️ 1. 보고서 요약 개요\n\n`;
    weeklyMd += `* **작성 일자**: ${new Date().toLocaleDateString('ko-KR')}\n`;
    weeklyMd += `* **대상 기간**: ${start} ~ ${end}\n`;
    weeklyMd += `* **프로젝트 코드**: \`${proj}\`\n\n`;

    weeklyMd += `### 📈 2. 이번 주 진행 상태 메트릭스\n\n`;
    weeklyMd += `| 티켓 상태 | 건수 | 완료율 / 비율 |\n`;
    weeklyMd += `| :--- | :---: | :---: |\n`;
    weeklyMd += `| **완료 (Done/Resolved)** | ${completedCount}건 | ${total > 0 ? Math.round((completedCount / total) * 100) : 0}% |\n`;
    weeklyMd += `| **진행 중 (In Progress)** | ${progressingCount}건 | ${total > 0 ? Math.round((progressingCount / total) * 100) : 0}% |\n`;
    weeklyMd += `| **대기 중 (To Do)** | ${todoCount}건 | ${total > 0 ? Math.round((todoCount / total) * 100) : 0}% |\n`;
    weeklyMd += `| **합계 (Total)** | **${total}건** | **100%** |\n\n`;

    weeklyMd += `## 📋 3. 팀원별 상세 업무 진행 현황\n\n`;

    const members = [...new Set(currList.map(t => t.assignee))];
    const weeklyVacationOnly = activeWeeklyVacations.filter(v => !members.includes(v));
    const allWeeklyMembers = [...members, ...weeklyVacationOnly];

    if (allWeeklyMembers.length === 0) {
      weeklyMd += `* 조회 기간 내 상세 티켓 내역이 없습니다.\n`;
    } else {
      allWeeklyMembers.forEach(member => {
        const isOnVacation = activeWeeklyVacations.includes(member);
        weeklyMd += `### 👤 담당자: ${member}\n`;

        if (isOnVacation) {
          const vacDates = getMemberVacationDates(rawEvents, member, start, end);
          weeklyMd += `* ${vacDates || '연차 (일정 확인 불가)'}\n`;
        }

        const memberTickets = currList.filter(t => t.assignee === member);
        if (memberTickets.length === 0) {
          if (!isOnVacation) {
            weeklyMd += `* 진행한 티켓이 없습니다.\n`;
          }
        } else {
          memberTickets.forEach(t => {
            const cat = getStatusCategory(t.status);
            const statusIndicator = (cat === 'Done') ? '✅' : (cat === 'In Progress') ? '🔄' : '⏱️';
            const epicInfo = t.epic ? ` *(에픽: ${t.epic.key}: ${escapeBrackets(t.epic.summary)})*` : '';
            weeklyMd += `* ${statusIndicator} [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key, jiraUrl)}) (\`${t.status}\`, 업데이트: ${t.updated})${epicInfo}\n`;
          });
        }
        weeklyMd += `\n`;
      });
    }

    weeklyMd += `## 🚀 4. 다음 주 주요 계획 및 이슈 사항\n\n`;
    if (nextList.length === 0) {
      weeklyMd += `* **마일스톤 점검**: 다음 주 예정된 지라 티켓이 등록되어 있지 않거나 계획을 불러올 수 없습니다.\n`;
      weeklyMd += `* **장애 요인**: 예정된 주요 마일스톤에 지연 요소가 없는지 리스크 사전 점검.\n`;
    } else {
      const nextMembers = [...new Set(nextList.map(t => t.assignee))];
      nextMembers.forEach(member => {
        weeklyMd += `### 👤 담당자: ${member} 계획\n`;
        const memberNext = nextList.filter(t => t.assignee === member);
        memberNext.forEach(t => {
          const cat = getStatusCategory(t.status);
          const stateSymbol = cat === 'Done' ? '🟢 [완료예정]' : cat === 'In Progress' ? '🔄 [진행예정]' : '⏱️ [할일]';
          const epicInfo = t.epic ? ` *(에픽: ${t.epic.key}: ${escapeBrackets(t.epic.summary)})*` : '';
          weeklyMd += `* ${stateSymbol} [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key, jiraUrl)}) (\`${t.status}\`)${epicInfo}\n`;
        });
        weeklyMd += `\n`;
      });
    }

    return weeklyMd;
  }
}

class ReportContext {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  generate(reportParams) {
    return this.strategy.generate(reportParams);
  }
}

export default function Home() {
  // SSR 하이드레이션 보호용 마운트 상태
  const [mounted, setMounted] = useState(false);

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

    // YYYY-MM-DD 로컬 타임 포맷팅 헬퍼
    const toLocalDateStr = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    // 날짜 디폴트 계산: 이번 주 월요일 ~ 이번 주 금요일
    const today = new Date();
    const currentDay = today.getDay();

    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const distanceToFriday = currentDay === 0 ? -2 : 5 - currentDay;
    const friday = new Date(today);
    friday.setDate(today.getDate() + distanceToFriday);

    const mondayStr = toLocalDateStr(monday);
    const fridayStr = toLocalDateStr(friday);
    setDateStart(mondayStr);
    setDateEnd(fridayStr);

    // 실적 분석 디폴트 기간 설정: 올해 1월 1일 ~ 올해 12월 31일
    const thisYear = new Date().getFullYear();
    setAnalyticsDateStart(`${thisYear}-01-01`);
    setAnalyticsDateEnd(`${thisYear}-12-31`);

    // 1-1. 지라 API 설정 복구
    const savedSettings = localStorage.getItem('workflow_jira_settings');
    let currentApiMode = false;
    let activeUrl = '';
    let activeEmail = '';
    let activeToken = '';
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setUrl(parsed.url || '');
        setEmail(parsed.email || '');
        setToken(parsed.token || '');
        setConfluenceSpace(parsed.confluenceSpace || '');
        setConfluenceParentId(parsed.confluenceParentId || '');
        setApiMode(parsed.apiMode || false);
        currentApiMode = parsed.apiMode || false;
        activeUrl = parsed.url || '';
        activeEmail = parsed.email || '';
        activeToken = parsed.token || '';
      } catch (e) {
        console.error('설정을 복구하는 중 오류 발생:', e);
      }
    }

    // 1-1-B. 구글 캘린더 설정 복구
    const savedCalendar = localStorage.getItem('workflow_calendar_settings');
    let activeCalendarId = '';
    if (savedCalendar) {
      try {
        const parsed = JSON.parse(savedCalendar);
        setCalendarId(parsed.calendarId || '');
        activeCalendarId = parsed.calendarId || '';
      } catch (e) {
        console.error('캘린더 설정을 복구하는 중 오류 발생:', e);
      }
    }

    // 1-1-C. Google Calendar OAuth 설정 복구
    const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
    let activeCalendarClientId = '';
    let activeCalendarClientSecret = '';
    let activeCalendarAccessToken = '';
    let activeCalendarRefreshToken = '';
    if (savedOAuth) {
      try {
        const parsed = JSON.parse(savedOAuth);
        setCalendarClientId(parsed.clientId || '');
        setCalendarClientSecret(parsed.clientSecret || '');
        activeCalendarClientId = parsed.clientId || '';
        activeCalendarClientSecret = parsed.clientSecret || '';
        if (parsed.accessToken) {
          setCalendarAccessToken(parsed.accessToken);
          activeCalendarAccessToken = parsed.accessToken;
        }
        if (parsed.refreshToken) {
          setCalendarRefreshToken(parsed.refreshToken);
          activeCalendarRefreshToken = parsed.refreshToken;
        }
        // 토큰이 존재하면 연동 완료 상태로
        if (parsed.accessToken || parsed.refreshToken) {
          setCalendarAuthStatus('connected');
        }
      } catch (e) {
        console.error('OAuth 캘린더 설정 복구 중 오류:', e);
      }
    }

    // 1-1-D. OAuth 콜백 처리 (Google 로그인 후 리디렉트)
    const urlParams = new URLSearchParams(window.location.search);
    const calendarAuth = urlParams.get('calendar_auth');
    const calendarCode = urlParams.get('calendar_code');
    if (calendarAuth === 'success' && calendarCode) {
      // URL에서 code 파라미터를 제거 (깨끗한 URL 유지)
      const cleanUrl = new URL(window.location);
      cleanUrl.searchParams.delete('calendar_auth');
      cleanUrl.searchParams.delete('calendar_code');
      cleanUrl.searchParams.delete('calendar_id');
      window.history.replaceState({}, '', cleanUrl);

      // 토큰 교환 실행
      const cId = activeCalendarClientId;
      const cSecret = activeCalendarClientSecret;
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

    // 1-2. 등록된 팀원 목록 복구
    const savedMembers = localStorage.getItem('workflow_registered_members');
    let activeRegisteredMembers = [];
    if (savedMembers) {
      try {
        const parsed = JSON.parse(savedMembers);
        setRegisteredMembers(parsed);
        activeRegisteredMembers = parsed;
      } catch (e) {
        console.error('팀원 목록 복구 중 오류 발생:', e);
      }
    } else {
      localStorage.setItem('workflow_registered_members', JSON.stringify([]));
    }

    // 1-3. 대상 팀원 필터 설정값 복구
    const savedFilterMembers = localStorage.getItem('workflow_filter_members');
    let activeFilterMembers = '';
    if (savedFilterMembers !== null) {
      setTeamMembers(savedFilterMembers);
      activeFilterMembers = savedFilterMembers;
    }

    // 1-4. 프로젝트 키 복구
    const savedProjectKey = localStorage.getItem('workflow_project_key');
    let activeProjectKey = 'DI26';
    if (savedProjectKey !== null) {
      setProjectKey(savedProjectKey);
      activeProjectKey = savedProjectKey;
    }

    // 초기 상태 UI 동기화
    if (currentApiMode) {
      setConnectionStatus({ dot: 'success', text: 'Jira API 대기 중' });
    } else {
      setConnectionStatus({ dot: 'accent', text: '시뮬레이션 모드 작동 중' });
    }

    // 첫 실행 시 자동 로드
    // state 업데이트 비동기를 우회하기 위해 로컬 변수로 즉석 전달
    triggerInitialFetch({
      apiMode: currentApiMode,
      projectKey: activeProjectKey,
      teamMembers: activeFilterMembers,
      start: mondayStr,
      end: fridayStr,
      url: activeUrl,
      email: activeEmail,
      token: activeToken,
      calendarId: activeCalendarId,
      accessToken: activeCalendarAccessToken,
      refreshToken: activeCalendarRefreshToken,
      clientId: activeCalendarClientId,
      clientSecret: activeCalendarClientSecret,
      registeredMembers: activeRegisteredMembers
    });
  }, []);

  // --------------------------------------------------------------------------
  // 2. JQL 빌더 계산 함수
  // --------------------------------------------------------------------------
  const getJql = () => {
    return new JqlQueryBuilder()
      .setProject(projectKey)
      .setAssignees(teamMembers)
      .setDateRange(dateStart, dateEnd, 'updated')
      .build();
  };

  const getAnalyticsJql = () => {
    return new JqlQueryBuilder()
      .setProject(analyticsProjectKey)
      .setAssignees(analyticsTeamMembers)
      .setDateRange(analyticsDateStart, analyticsDateEnd, 'created')
      .build();
  };

  const getNextWeekJql = () => {
    const start = dateStart || new Date().toISOString().split('T')[0];
    const end = dateEnd || new Date().toISOString().split('T')[0];
    const nextStart = new Date(start);
    nextStart.setDate(nextStart.getDate() + 7);
    const nextStartStr = nextStart.toISOString().split('T')[0];
    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 7);
    const nextEndStr = nextEnd.toISOString().split('T')[0];

    return new JqlQueryBuilder()
      .setProject(projectKey)
      .setAssignees(teamMembers)
      .setDateRange(nextStartStr, nextEndStr, 'updated')
      .build();
  };

  const getScheduleJql = (proj = projectKey, members = teamMembers) => {
    const thisYear = new Date().getFullYear();
    return new JqlQueryBuilder()
      .setProject(proj)
      .setAssignees(members)
      .setDateRange(`${thisYear}-01-01`, `${thisYear}-12-31`, 'created')
      .build();
  };

  // --------------------------------------------------------------------------
  // 3. 지라 API 연동 함수
  // --------------------------------------------------------------------------
  const fetchJiraTickets = async (jql, modeUrl, modeEmail, modeToken) => {
    if (!modeUrl || !modeEmail || !modeToken) {
      throw new Error('Jira API 설정 정보가 누락되었습니다.');
    }

    const credential = btoa(`${modeEmail}:${modeToken}`);
    let cleanUrl = modeUrl.trim();
    try {
      if (cleanUrl.toLowerCase().startsWith('http')) {
        const urlObj = new URL(cleanUrl);
        cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
    } catch (e) {
      console.warn('URL 호스트 파싱 실패, 원본 유지:', e);
    }

    let allIssues = [];
    const limit = 100;
    let pageCount = 0;
    const maxPages = 20; // 안전 한계 (최대 2000건)
    let nextPageToken = null; // 커서 기반 페이지네이션

    while (pageCount < maxPages) {
      // GET /rest/api/3/search/jql — 커서(nextPageToken) 기반 페이지네이션
      let targetUrl = `${cleanUrl.replace(/\/$/, '')}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,status,assignee,updated,created,parent&maxResults=${limit}`;
      if (nextPageToken) {
        targetUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
      }
      const apiEndpoint = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

      console.log(`[Jira Fetch] GET /search/jql | page ${pageCount + 1}${nextPageToken ? ` | token: ${nextPageToken}` : ''}...`);
      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credential}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP 에러! 상태코드: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Jira 서버가 JSON 대신 올바르지 않은 타입의 문서를 반환했습니다.');
      }

      const data = await response.json();
      const pageIssues = data.issues || [];

      // 가져온 데이터가 없으면 즉시 중단
      if (pageIssues.length === 0) {
        break;
      }

      allIssues = allIssues.concat(pageIssues);
      pageCount++;

      console.log(`[Jira API Fetch] page ${pageCount} | ${pageIssues.length}건 | 누적: ${allIssues.length}건 | nextPageToken: ${data.nextPageToken || '없음(마지막)'}`);
      setConnectionStatus({ dot: 'success', text: `티켓 수집 중... (${allIssues.length}건)` });

      // 다음 페이지 토큰이 없으면 마지막 페이지
      if (!data.nextPageToken) {
        break;
      }
      nextPageToken = data.nextPageToken;
    }

    if (pageCount >= maxPages) {
      console.warn(`[Jira API Fetch] 안전 한계(${maxPages}페이지)에 도달, 수집 종료.`);
    }
    console.log(`[Jira API Fetch] 수집 완료: 총 ${allIssues.length}건 (${pageCount}페이지)`);

    return allIssues.map(issue => ({
      key: issue.key || '',
      summary: issue.fields?.summary || '제목 없음',
      status: issue.fields?.status ? (issue.fields.status.name || 'To Do') : 'To Do',
      assignee: issue.fields?.assignee ? (issue.fields.assignee.displayName || issue.fields.assignee.name || '미지정') : '미지정',
      updated: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : '',
      created: issue.fields?.created ? issue.fields.created.substring(0, 10) : '',
      epic: issue.fields?.parent ? {
        key: issue.fields.parent.key || '',
        summary: issue.fields.parent.fields?.summary || ''
      } : null
    }));
  };

  // --------------------------------------------------------------------------
  // 4. 모의(Mock) 데이터 생성기
  // --------------------------------------------------------------------------
  const generateMockTickets = (projKey, membersStr, start, end) => {
    const dummyTaskPool = [
      '웹 대시보드 UI 컴포넌트 리팩토링 및 다크모드 대응',
      'Jira REST API 연동 및 JQL 파서 유틸리티 스크립트 작성',
      '일일Standup 업무 보고 마크다운 템플릿 렌더러 설계',
      '주간 업무 요약 SVG 대시보드 차트 컴포넌트 마크업',
      'Clipboard API 활용한 마크다운 클립보드 복사 로직 추가',
      '사용자 설정 패널 값 브라우저 localStorage 저장 로직 연동',
      '사용자 가이드(README.md) 및 CORS 프록시 예제 가이드 작성',
      'QA 버그 리포트: 스크롤 영역 잔상 버그 및 layout shift 현상 수정',
      '팀원 다중 선택 필터 UI 및 동적 쿼리 컴포저 성능 고도화',
      '보고서 템플릿 마크다운 텍스트 저장용 파일 Blob 생성기 구현',
      '기획서 기반 주요 기능 체크리스트 작성 및 task 관리 체계 마련',
      'CSS Nesting 최적화 및 CSS custom properties 토큰 설계 적용',
      '반응형 대응을 위한 @container 쿼리 선언 및 모바일 뷰 보완'
    ];

    const statusOptions = ['Done', 'In Progress', 'To Do'];
    const dummyEpics = [
      { key: `${projKey}-10`, summary: '웹 대시보드 리팩토링 및 현대화' },
      { key: `${projKey}-20`, summary: 'Jira & Confluence 오픈 API 연동' },
      { key: `${projKey}-30`, summary: 'UI/UX 고도화 및 사용자 경험 개선' }
    ];
    const result = [];

    const dateArray = [];
    let currentDate = new Date(start);
    const stopDate = new Date(end);
    while (currentDate <= stopDate) {
      dateArray.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    if (dateArray.length === 0) dateArray.push(new Date().toISOString().split('T')[0]);

    const members = membersStr.split(',').map(m => m.trim()).filter(m => m.length > 0);
    const targetMembers = members.length > 0 ? members : ['홍길동', '김철수', '이영희'];

    let keyCounter = 101;
    targetMembers.forEach((member) => {
      // 멤버 고유 씨드값을 이름 문자 코드로 계산하여 고정된 결정적 티켓 데이터 보장
      const memberSeed = member.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

      // 조회 기간의 일 수에 따라 티켓 수를 유연하게 설정 (실적 분석 같이 긴 기간이면 20개, 일반 보고서면 3개)
      const isLongRange = dateArray.length > 30;
      const ticketCount = isLongRange ? 20 : 3;

      for (let i = 0; i < ticketCount; i++) {
        const dummySummary = dummyTaskPool[(memberSeed + i) % dummyTaskPool.length];
        const dummyStatus = statusOptions[i % statusOptions.length];
        const dummyEpic = dummyEpics[(memberSeed + i) % dummyEpics.length];

        // 날짜가 고르게 분포하도록 인덱스 계산
        const dateIndex = isLongRange
          ? Math.floor((i * dateArray.length) / ticketCount)
          : (i % dateArray.length);
        const dummyDate = dateArray[dateIndex];

        result.push({
          key: `${projKey}-${keyCounter++}`,
          summary: dummySummary,
          status: dummyStatus,
          assignee: member,
          updated: dummyDate,
          epic: dummyEpic
        });
      }
    });

    return result.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  };

  // Google Calendar 연차 로더 및 연차자 판별 헬퍼 (OAuth 2.0 전용)
  const fetchCalendarEvents = async (calId, start, end, oauthParams = {}) => {
    const timeMin = `${start}T00:00:00.000Z`;
    const timeMax = `${end}T23:59:59.000Z`;

    if (!calId) return [];

    const accessToken = oauthParams.accessToken || calendarAccessToken;
    const refreshToken = oauthParams.refreshToken || calendarRefreshToken;
    const clientId = oauthParams.clientId || calendarClientId;
    const clientSecret = oauthParams.clientSecret || calendarClientSecret;

    if (!accessToken && !refreshToken) {
      console.warn('[Calendar OAuth] Access Token 또는 Refresh Token이 없습니다.');
      return [];
    }

    try {
      console.log('[Calendar OAuth] 이벤트 조회 중...');
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'events',
          accessToken,
          refreshToken,
          clientId,
          clientSecret,
          calendarId: calId,
          timeMin,
          timeMax,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        if (errData.needReauth) {
          console.warn('[Calendar OAuth] 재인증 필요:', errData.error);
          setCalendarAuthStatus('error');
          return [];
        }
        throw new Error(errData.error || '이벤트 조회 실패');
      }

      const data = await response.json();

      // 새 access_token이 발급된 경우 업데이트
      if (data.newAccessToken) {
        setCalendarAccessToken(data.newAccessToken);
        const savedOAuth = localStorage.getItem('workflow_calendar_oauth');
        if (savedOAuth) {
          try {
            const parsed = JSON.parse(savedOAuth);
            parsed.accessToken = data.newAccessToken;
            parsed.expiresAt = Date.now() + 3600 * 1000;
            localStorage.setItem('workflow_calendar_oauth', JSON.stringify(parsed));
          } catch (e) { /* ignore */ }
        }
      }

      console.log(`[Calendar OAuth] ${(data.items || []).length}건 이벤트 로드 완료`);
      return data.items || [];
    } catch (e) {
      console.error('캘린더 OAuth 연차 로드 에러:', e);
      alert(`[회사 캘린더 연동 실패]\n\n원인: ${e.message}\n\n이 오류는 Google Cloud Console에서 Google Calendar API가 활성화되어 있지 않기 때문일 수 있습니다. 메시지에 포함된 URL에 방문하여 API를 활성화해 주세요.`);
      return [];
    }
  };

  // --------------------------------------------------------------------------
  // 5. 티켓 로드 통합 실행 제어
  // --------------------------------------------------------------------------
  const triggerInitialFetch = async (params) => {
    setIsLoading(true);
    setIsAnalyticsLoading(true);

    const thisYear = new Date().getFullYear();
    const startOfYear = `${thisYear}-01-01`;
    const endOfYear = `${thisYear}-12-31`;

    if (params.apiMode) {
      const proj = params.projectKey.trim() || 'PROJ';
      const members = params.teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0);

      const nextStart = new Date(params.start);
      nextStart.setDate(nextStart.getDate() + 7);
      const nextEnd = new Date(params.end);
      nextEnd.setDate(nextEnd.getDate() + 7);
      const nextStartStr = nextStart.toISOString().split('T')[0];
      const nextEndStr = nextEnd.toISOString().split('T')[0];

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

      const analyticsJql = new JqlQueryBuilder()
        .setProject(proj)
        .setAssignees(params.teamMembers)
        .setDateRange(startOfYear, endOfYear, 'updated')
        .build();

      try {
        setConnectionStatus({ dot: 'success', text: '초기 로드: 이번 주 데이터 수집 중...' });
        const currentData = await fetchJiraTickets(jql, params.url, params.email, params.token);

        setConnectionStatus({ dot: 'success', text: '초기 로드: 다음 주 계획 수집 중...' });
        const nextData = await fetchJiraTickets(nextJql, params.url, params.email, params.token);

        setConnectionStatus({ dot: 'success', text: '초기 로드: 실적 분석 데이터 수집 중...' });
        const analyticsData = await fetchJiraTickets(analyticsJql, params.url, params.email, params.token);

        setConnectionStatus({ dot: 'success', text: '초기 로드: 전체 일정 데이터 수집 중...' });
        const scheduleJql = getScheduleJql(params.projectKey, params.teamMembers);
        const scheduleData = await fetchJiraTickets(scheduleJql, params.url, params.email, params.token);

        setConnectionStatus({ dot: 'success', text: '초기 로드: 캘린더 연차 데이터 조회 중...' });
        let calEvents = [];
        if (params.calendarId && (params.accessToken || params.refreshToken)) {
          calEvents = await fetchCalendarEvents(params.calendarId, params.start, params.end, {
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
        setAnalyticsTickets(analyticsData);
        setScheduleTickets(scheduleData);
        setScheduleTickets(scheduleData);
        // processReportData에는 raw events 배열(calEvents)을 바로 넘김
        setVacationList(calEvents);
        processReportData(currentData, nextData, params.start, params.end, params.projectKey, calEvents, activeRegs);
        setConnectionStatus({
          dot: 'success',
          text: `Jira API 연동 완료 (이번 주 ${currentData.length}건 / 다음 주 ${nextData.length}건 / 실적분석 ${analyticsData.length}건 / 연차 ${currentVacationList.length}명)`
        });
      } catch (err) {
        console.error('초기 로딩 지라 API 에러:', err);
        setConnectionStatus({ dot: 'danger', text: `초기 로드 실패 (${err.message})` });

        // 폴백으로 Mock 데이터 제공 (이영희를 임시 연차자로 지정)
        const mock = generateMockTickets(params.projectKey, params.teamMembers, params.start, params.end);
        const nextMock = generateMockTickets(params.projectKey, params.teamMembers, nextStartStr, nextEndStr);
        const analyticsMock = generateMockTickets(params.projectKey, params.teamMembers, startOfYear, endOfYear);
        const scheduleMock = generateMockTickets(params.projectKey, params.teamMembers, startOfYear, endOfYear);
        const currentVacationList = ['이영희'];
        setVacationList(currentVacationList);
        setTickets(mock);
        setNextTickets(nextMock);
        setAnalyticsTickets(analyticsMock);
        setScheduleTickets(scheduleMock);
        processReportData(mock, nextMock, params.start, params.end, params.projectKey, currentVacationList);
      } finally {
        setIsLoading(false);
        setIsAnalyticsLoading(false);
      }
    } else {
      setTimeout(() => {
        const mock = generateMockTickets(params.projectKey, params.teamMembers, params.start, params.end);

        const nextStart = new Date(params.start);
        nextStart.setDate(nextStart.getDate() + 7);
        const nextEnd = new Date(params.end);
        nextEnd.setDate(nextEnd.getDate() + 7);
        const nextMock = generateMockTickets(params.projectKey, params.teamMembers, nextStart.toISOString().split('T')[0], nextEnd.toISOString().split('T')[0]);
        const analyticsMock = generateMockTickets(params.projectKey, params.teamMembers, startOfYear, endOfYear);
        const scheduleMock = generateMockTickets(params.projectKey, params.teamMembers, startOfYear, endOfYear);

        const currentVacationList = ['이영희']; // 시뮬레이터 기본 연차자 설정
        setVacationList(currentVacationList);

        setTickets(mock);
        setNextTickets(nextMock);
        setAnalyticsTickets(analyticsMock);
        setScheduleTickets(scheduleMock);
        processReportData(mock, nextMock, params.start, params.end, params.projectKey, currentVacationList);
        setIsLoading(false);
        setIsAnalyticsLoading(false);
      }, 400);
    }
  };

  const handleFetchTickets = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setIsAnalyticsLoading(true);

    const start = dateStart;
    const end = dateEnd;
    const nextStart = new Date(start);
    nextStart.setDate(nextStart.getDate() + 7);
    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 7);

    const jql = getJql();
    const nextJql = getNextWeekJql();

    // 실적 분석 JQL 빌드 (실적 분석 전용 프로젝트/팀원 사용)
    const analyticsJql = new JqlQueryBuilder()
      .setProject(analyticsProjectKey)
      .setAssignees(analyticsTeamMembers)
      .setDateRange(analyticsDateStart, analyticsDateEnd, 'created')
      .build();

    if (apiMode) {
      try {
        setConnectionStatus({ dot: 'success', text: '이번 주 데이터 로드 중...' });
        const currentData = await fetchJiraTickets(jql, url, email, token);

        setConnectionStatus({ dot: 'success', text: '다음 주 계획 데이터 로드 중...' });
        const nextData = await fetchJiraTickets(nextJql, url, email, token);

        setConnectionStatus({ dot: 'success', text: '실적 분석 데이터 로드 중...' });
        const analyticsData = await fetchJiraTickets(analyticsJql, url, email, token);

        setConnectionStatus({ dot: 'success', text: '전체 일정 데이터 로드 중...' });
        const scheduleJql = getScheduleJql();
        const scheduleData = await fetchJiraTickets(scheduleJql, url, email, token);

        setConnectionStatus({ dot: 'success', text: '캘린더 연차 데이터 조회 중...' });
        let calEvents = [];
        if (calendarId && (calendarAccessToken || calendarRefreshToken)) {
          calEvents = await fetchCalendarEvents(calendarId, start, end);
          console.log('[Calendar] calEvents 로드 완료:', calEvents);
        } else {
          console.log('[Calendar] 캘린더 조회 스킵 — calendarId:', calendarId, '| 토큰 정보 없음');
        }
        // UI 연차 표시용은 start ~ end 전체 범위로 계산
        const currentVacationList = getVacationMembers(calEvents, start, end, registeredMembers);

        setTickets(currentData);
        setNextTickets(nextData);
        setAnalyticsTickets(analyticsData);
        // processReportData에는 raw events 배열(calEvents)을 바로 넘김
        setVacationList(calEvents);
        processReportData(currentData, nextData, start, end, projectKey, calEvents, registeredMembers);
        setConnectionStatus({
          dot: 'success',
          text: `Jira API 연동 완료 (이번 주 ${currentData.length}건 / 다음 주 ${nextData.length}건 / 실적분석 ${analyticsData.length}건 / 연차 ${currentVacationList.length}명)`
        });
      } catch (err) {
        console.error('Jira API 연동 에러:', err);
        alert(`[Jira API 연동 실패]\n\n오류 내용: ${err.message}\n\n입력하신 도메인, 이메일, 토큰 및 로컬 프록시가 작동 중인지 확인해 주세요.`);
        setConnectionStatus({ dot: 'danger', text: `연동 실패 (${err.message})` });
      } finally {
        setIsLoading(false);
        setIsAnalyticsLoading(false);
      }
    } else {
      // 시뮬레이터 동작
      setTimeout(() => {
        const mock = generateMockTickets(projectKey, teamMembers, start, end);
        const nextMock = generateMockTickets(projectKey, teamMembers, nextStart.toISOString().split('T')[0], nextEnd.toISOString().split('T')[0]);
        const analyticsMock = generateMockTickets(analyticsProjectKey, analyticsTeamMembers, analyticsDateStart, analyticsDateEnd);
        const thisYear = new Date().getFullYear();
        const scheduleMock = generateMockTickets(projectKey, teamMembers, `${thisYear}-01-01`, `${thisYear}-12-31`);

        const currentVacationList = ['이영희']; // 시뮬레이션 고정 연차자
        setVacationList(currentVacationList);

        setTickets(mock);
        setNextTickets(nextMock);
        setAnalyticsTickets(analyticsMock);
        setScheduleTickets(scheduleMock);
        processReportData(mock, nextMock, start, end, projectKey, currentVacationList);
        setIsLoading(false);
        setIsAnalyticsLoading(false);
      }, 500);
    }
  };

  // 에픽별 일정 및 진행률 계산 유틸
  const getEpicScheduleData = () => {
    const allTickets = scheduleTickets;
    const epicsMap = {};

    allTickets.forEach(t => {
      const epicKey = t.epic ? t.epic.key : 'NO_EPIC';
      const epicSummary = t.epic ? t.epic.summary : '에픽 없음 (기타 업무)';

      if (!epicsMap[epicKey]) {
        epicsMap[epicKey] = {
          key: epicKey,
          summary: epicSummary,
          tickets: []
        };
      }
      epicsMap[epicKey].tickets.push(t);
    });

    const epicsList = Object.values(epicsMap).map(epic => {
      const beTickets = epic.tickets.filter(t => (t.summary || '').includes('[BE]'));
      const feTickets = epic.tickets.filter(t => (t.summary || '').includes('[FE]'));
      const moTickets = epic.tickets.filter(t => (t.summary || '').includes('[MO]'));
      const otherTickets = epic.tickets.filter(t => {
        const sum = t.summary || '';
        return !sum.includes('[BE]') && !sum.includes('[FE]') && !sum.includes('[MO]');
      });

      const getProgress = (group) => {
        if (group.length === 0) return null;
        const doneCount = group.filter(t => getStatusCategory(t.status) === 'Done').length;
        return Math.round((doneCount / group.length) * 100);
      };

      return {
        ...epic,
        beProgress: getProgress(beTickets),
        feProgress: getProgress(feTickets),
        moProgress: getProgress(moTickets),
        beCount: beTickets.length,
        feCount: feTickets.length,
        moCount: moTickets.length,
        beDoneCount: beTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
        feDoneCount: feTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
        moDoneCount: moTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
        categorizedTickets: {
          BE: beTickets,
          FE: feTickets,
          MO: moTickets,
          OTHER: otherTickets
        }
      };
    });

    return epicsList.sort((a, b) => {
      if (a.key === 'NO_EPIC') return 1;
      if (b.key === 'NO_EPIC') return -1;
      return a.key.localeCompare(b.key);
    });
  };

  // 실적 분석 기간 단독 조회 핸들러
  const handleFetchAnalyticsTickets = async (start, end) => {
    setIsAnalyticsLoading(true);

    const jql = new JqlQueryBuilder()
      .setProject(analyticsProjectKey)
      .setAssignees(analyticsTeamMembers)
      .setDateRange(start, end, 'created')
      .build();

    if (apiMode) {
      try {
        setConnectionStatus({ dot: 'success', text: '실적 분석 데이터 로드 중...' });
        const analyticsData = await fetchJiraTickets(jql, url, email, token);
        setAnalyticsTickets(analyticsData);
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
        setIsAnalyticsLoading(false);
      }, 500);
    }
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
      const todayStr = new Date().toISOString().split('T')[0];
      reportTitle = `📅 [일일업무] ${todayStr}`;
    } else if (activeTab === 'tab-weekly') {
      reportText = weeklyReportMd;
      reportTitle = `📊 [주간업무] ${dateStart} ~ ${dateEnd}`;
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
      txt = weeklyReportMd;
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
    const query = activeTab === 'tab-analytics' ? getAnalyticsJql() : getJql();
    navigator.clipboard.writeText(query)
      .then(() => alert('JQL 쿼리가 클립보드에 복사되었습니다.'))
      .catch(() => alert('복사 실패'));
  };

  // --------------------------------------------------------------------------
  // 10. 유틸리티 보조 함수 (상태 정규화 & 마크다운 HTML 간이 파서)
  // --------------------------------------------------------------------------
  const parseMarkdownToHtml = (markdown) => {
    if (!markdown) return '';
    let html = markdown;

    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^---$/gm, '<hr>');

    // 마크다운 하이퍼링크 [TEXT](LINK) -> HTML <a> 태그 변환
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline;">$1</a>');

    // 테이블 파싱
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<table>';
        }
        if (line.includes('---')) {
          lines[i] = '';
          continue;
        }

        const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        const tag = tableHtml.includes('<th>') ? 'td' : 'th';

        tableHtml += '<tr>';
        cols.forEach(col => {
          tableHtml += `<${tag}>${col}</${tag}>`;
        });
        tableHtml += '</tr>';
        lines[i] = '';
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</table>';
          lines[i] = tableHtml + '\n' + lines[i];
        }
      }
    }
    html = lines.join('\n');

    html = html.replace(/^\*\s+(.+)$/gm, '<ul><li>$1</li></ul>');
    html = html.replace(/^-\s+(.+)$/gm, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    html = html.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed === '') return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('<tr') || trimmed.startsWith('<td') || trimmed.startsWith('<th') || trimmed.startsWith('<table') || trimmed.startsWith('<hr') || trimmed.startsWith('<blockquote>')) {
        return line;
      }
      return `<p>${line}</p>`;
    }).join('\n');

    return html;
  };

  // SSR 하이드레이션 완료 전에는 안전을 위해 빈 컴포넌트 렌더링
  if (!mounted) return <div style={{ minHeight: '100vh', background: '#05050a' }}></div>;

  // 통계 원형 차트용 비율 변수
  const totalCount = tickets.length;
  const doneCount = tickets.filter(t => getStatusCategory(t.status) === 'Done').length;
  const progressCount = tickets.filter(t => getStatusCategory(t.status) === 'In Progress').length;
  const todoCount = totalCount - doneCount - progressCount;

  const donePercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const progressPercent = totalCount > 0 ? Math.round((progressCount / totalCount) * 100) : 0;
  const todoPercent = totalCount > 0 ? Math.round((todoCount / totalCount) * 100) : 0;

  const activeChipsList = teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0);

  return (
    <div className="app-container">
      {/* 사이드바 / 설정 패널 */}
      <aside className="sidebar">
        <div className="brand">
          <svg className="brand-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1>SprintFlow</h1>
          <span className="badge">NEXT.JS</span>
        </div>

        <nav className="settings-panel">
          <h2>Jira API 설정</h2>
          <div className="setting-group">
            <label htmlFor="jira-url">Jira URL</label>
            <input
              type="url"
              id="jira-url"
              placeholder="https://your-domain.atlassian.net"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="jira-email">이메일</label>
            <input
              type="email"
              id="jira-email"
              placeholder="user@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="jira-token">API Token</label>
            <input
              type="password"
              id="jira-token"
              placeholder="ATATT..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="confluence-space">Confluence Space Key</label>
            <input
              type="text"
              id="confluence-space"
              placeholder="PROJ"
              value={confluenceSpace}
              onChange={(e) => setConfluenceSpace(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="confluence-parent-id">Confluence 부모 페이지 ID (선택)</label>
            <input
              type="text"
              id="confluence-parent-id"
              placeholder="3792306206"
              value={confluenceParentId}
              onChange={(e) => setConfluenceParentId(e.target.value)}
            />
          </div>

          <div className="setting-group-divider" style={{ borderTop: '1px rgba(255,255,255,0.06) dashed', margin: '1rem 0' }}></div>

          <h2 style={{ fontSize: '1rem', marginTop: '1rem', color: 'rgba(255,255,255,0.85)' }}>회사 캘린더 설정</h2>

          <div className="setting-group">
            <label htmlFor="calendar-id">Calendar ID</label>
            <input
              type="text"
              id="calendar-id"
              placeholder="company.com_xxx@group.calendar.google.com"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
            />
          </div>

          <div className="setting-group">
            <label htmlFor="calendar-client-id">OAuth Client ID</label>
            <input
              type="text"
              id="calendar-client-id"
              placeholder="xxxxxxx.apps.googleusercontent.com"
              value={calendarClientId}
              onChange={(e) => setCalendarClientId(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="calendar-client-secret">OAuth Client Secret</label>
            <input
              type="password"
              id="calendar-client-secret"
              placeholder="GOCSPX-..."
              value={calendarClientSecret}
              onChange={(e) => setCalendarClientSecret(e.target.value)}
            />
          </div>

          {/* 연동 상태 표시 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: calendarAuthStatus === 'connected'
              ? 'rgba(34, 197, 94, 0.1)'
              : calendarAuthStatus === 'error'
                ? 'rgba(239, 68, 68, 0.1)'
                : calendarAuthStatus === 'connecting'
                  ? 'rgba(234, 179, 8, 0.1)'
                  : 'rgba(255,255,255,0.03)',
            border: `1px solid ${calendarAuthStatus === 'connected'
              ? 'rgba(34, 197, 94, 0.3)'
              : calendarAuthStatus === 'error'
                ? 'rgba(239, 68, 68, 0.3)'
                : calendarAuthStatus === 'connecting'
                  ? 'rgba(234, 179, 8, 0.3)'
                  : 'rgba(255,255,255,0.06)'
              }`,
            marginBottom: '0.5rem',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: calendarAuthStatus === 'connected'
                ? '#22c55e'
                : calendarAuthStatus === 'error'
                  ? '#ef4444'
                  : calendarAuthStatus === 'connecting'
                    ? '#eab308'
                    : '#6b7280',
              flexShrink: 0,
              animation: calendarAuthStatus === 'connecting' ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}></span>
            <span style={{
              fontSize: '0.75rem',
              color: calendarAuthStatus === 'connected'
                ? '#22c55e'
                : calendarAuthStatus === 'error'
                  ? '#ef4444'
                  : calendarAuthStatus === 'connecting'
                    ? '#eab308'
                    : 'rgba(255,255,255,0.5)',
            }}>
              {calendarAuthStatus === 'connected' && '🟢 Google 계정 연동 완료'}
              {calendarAuthStatus === 'connecting' && '⏳ 연동 중...'}
              {calendarAuthStatus === 'error' && '🔴 연동 실패 — 재인증 필요'}
              {calendarAuthStatus === 'disconnected' && '⚪ 미연동'}
            </span>
          </div>

          {/* Google 계정 연동 버튼 */}
          <button
            type="button"
            className="btn btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              background: calendarAuthStatus === 'connected'
                ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                : 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
            }}
            onClick={async () => {
              if (!calendarClientId.trim()) {
                alert('OAuth Client ID를 먼저 입력해 주세요.');
                return;
              }
              // 먼저 OAuth 설정을 localStorage에 저장 (콜백에서 복구하기 위해)
              const oauthData = {
                clientId: calendarClientId,
                clientSecret: calendarClientSecret,
                accessToken: calendarAccessToken,
                refreshToken: calendarRefreshToken,
                authMode: 'oauth',
              };
              localStorage.setItem('workflow_calendar_oauth', JSON.stringify(oauthData));

              try {
                setCalendarAuthStatus('connecting');
                const response = await fetch('/api/calendar/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    clientId: calendarClientId,
                    calendarId: calendarId,
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
            }}
            disabled={calendarAuthStatus === 'connecting'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {calendarAuthStatus === 'connected' ? 'Google 계정 재연동' : 'Google 계정 연동'}
          </button>
          {calendarAuthStatus === 'connected' && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.75rem', marginBottom: '0.5rem' }}
              onClick={() => {
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
              }}
            >
              연동 해제
            </button>
          )}

          <div className="mode-switch-container">
            <span className="mode-label">API 모드 활성화</span>
            <label className="switch" id="mode-toggle-label">
              <input
                type="checkbox"
                id="mode-toggle"
                checked={apiMode}
                onChange={handleApiToggle}
              />
              <span className="slider"></span>
            </label>
          </div>
          <p className="mode-desc">비활성화 시 데모용 Mock 데이터가 로드됩니다.</p>
          <button type="button" onClick={handleSaveSettings} className="btn btn-secondary">설정 저장</button>

          <hr className="panel-divider" />

          <h2>팀원 관리</h2>
          <div className="setting-group">
            <label htmlFor="new-member">팀원 추가</label>
            <div className="input-with-action">
              <input
                type="text"
                id="new-member"
                placeholder="이름 또는 ID 입력"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTeamMember()}
              />
              <button type="button" onClick={handleAddTeamMember} className="btn btn-primary btn-sm">추가</button>
            </div>
          </div>
          <div className="setting-group">
            <label>등록된 팀원 목록</label>
            <ul className="member-list">
              {registeredMembers.map((member, idx) => (
                <li key={idx} className="member-list-item">
                  <span>{member}</span>
                  <button type="button" className="btn-remove-member" onClick={() => handleRemoveTeamMember(member)}>&times;</button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="footer-info">
          <p>© 2026 SprintFlow Inc.</p>
          <p>Next.js Integrated</p>
        </div>
      </aside>

      {/* 메인 대시보드 영역 */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-title">
            <h2>Dashboard</h2>
            <p>지라 티켓을 분석하고 간편하게 일일/주간 보고서를 생성하세요.</p>
          </div>
          <div className="quick-status">
            <div className="status-indicator">
              <span className={`indicator-dot ${connectionStatus.dot === 'success' ? 'active' : ''}`} style={{ backgroundColor: connectionStatus.dot === 'success' ? 'var(--color-success)' : connectionStatus.dot === 'danger' ? 'var(--color-danger)' : 'var(--color-accent)' }}></span>
              <span>{connectionStatus.text}</span>
            </div>
          </div>
        </header>

        {/* 필터 설정 섹션 */}
        {/* 필터 설정 섹션 */}
        <section className="filter-section card">
          <div
            className="section-header"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              marginBottom: '1rem'
            }}
          >
            <h3 style={{ margin: 0 }}>티켓 필터 조건 설정</h3>
            <button
              type="button"
              className="btn-toggle-filter"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isFilterOpen ? 'rotate(0deg)' : 'rotate(180deg)'
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          </div>

          <div
            className="filter-slide-container"
            style={{
              maxHeight: isFilterOpen ? '500px' : '0px',
              opacity: isFilterOpen ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out'
            }}
          >
            <form onSubmit={handleFetchTickets} className="filter-grid" style={{ paddingTop: '0.5rem' }}>
              <div className="form-group">
                <label htmlFor="project-key">프로젝트 키</label>
                <input
                  type="text"
                  id="project-key"
                  placeholder="예: PROJ, DEVEL"
                  value={projectKey}
                  onChange={(e) => {
                    setProjectKey(e.target.value);
                    localStorage.setItem('workflow_project_key', e.target.value.trim());
                  }}
                />
              </div>
              <div className="form-group team-input-group">
                <label htmlFor="team-members">대상 팀원 (이름/ID)</label>
                <input
                  type="text"
                  id="team-members"
                  placeholder="쉼표(,)로 구분 (예: 김철수, 이영희)"
                  value={teamMembers}
                  onChange={(e) => {
                    setTeamMembers(e.target.value);
                    localStorage.setItem('workflow_filter_members', e.target.value);
                  }}
                />
                <div className="member-chips-wrapper">
                  {registeredMembers.map((member, idx) => (
                    <div
                      key={idx}
                      className={`member-chip ${activeChipsList.includes(member) ? 'active' : ''}`}
                      onClick={() => handleToggleMemberChip(member)}
                    >
                      {member}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="date-start">시작일</label>
                <input
                  type="date"
                  id="date-start"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="date-end">종료일</label>
                <input
                  type="date"
                  id="date-end"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isLoading} className="btn btn-primary">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isLoading ? '불러오는 중...' : '티켓 가져오기'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* 중간 대시보드 통계 및 JQL 프리뷰 */}
        <div className="stats-and-jql-grid">
          {/* 통계 요약 카드 */}
          <section className="stats-section card">
            <div className="section-header">
              <h3>티켓 상태 분포</h3>
            </div>
            <div className="stats-content">
              <div className="chart-container">
                <div
                  className="css-pie"
                  style={{
                    '--p-done': `${donePercent}%`,
                    '--p-progress': `${progressPercent}%`,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    className="pie-center-hole"
                    style={{
                      width: '64%',
                      height: '64%',
                      borderRadius: '50%',
                      background: '#0d0d1e',
                      position: 'absolute',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', transform: 'translateY(1px)' }}>완료율</span>
                    <span style={{ fontSize: '1.05rem', color: '#10b981', fontWeight: '700', marginTop: '0px' }}>{donePercent}%</span>
                  </div>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color done"></span>
                    <span>완료: {donePercent}% ({doneCount}건)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color progress"></span>
                    <span>진행 중: {progressPercent}% ({progressCount}건)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color todo"></span>
                    <span>대기 중: {todoPercent}% ({todoCount}건)</span>
                  </div>
                </div>
              </div>
              <div className="stats-numeric-grid">
                <div className="stat-card done">
                  <span className="stat-label">완료 (Done)</span>
                  <span className="stat-value">{doneCount}</span>
                </div>
                <div className="stat-card in-progress">
                  <span className="stat-label">진행 중 (In Progress)</span>
                  <span className="stat-value">{progressCount}</span>
                </div>
                <div className="stat-card total">
                  <span className="stat-label">전체 티켓</span>
                  <span className="stat-value">{totalCount}</span>
                </div>
              </div>
            </div>
          </section>

          {/* JQL 프리뷰 카드 */}
          <section className="jql-section card">
            <div className="section-header">
              <h3>생성된 Jira JQL 쿼리</h3>
              <button type="button" className="btn-text-copy" onClick={handleCopyJql}>JQL 복사</button>
            </div>
            <div className="jql-body">
              <code>{activeTab === 'tab-analytics' ? getAnalyticsJql() : getJql()}</code>
              <p className="jql-tip">Jira Cloud Advanced Search에 위 쿼리를 그대로 복사해 넣으셔도 조회 가능합니다.</p>
            </div>
          </section>
        </div>

        {/* 리포트 탭 영역 */}
        <section className="report-section card">
          <div className="report-tabs-header">
            <div className="tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'tab-daily' ? 'active' : ''}`}
                onClick={() => setActiveTab('tab-daily')}
              >
                일일 업무 보고서
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'tab-weekly' ? 'active' : ''}`}
                onClick={() => setActiveTab('tab-weekly')}
              >
                주간 업무 보고서
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'tab-analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('tab-analytics')}
              >
                📊 실적 분석
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'tab-raw' ? 'active' : ''}`}
                onClick={() => setActiveTab('tab-raw')}
              >
                조회된 티켓 목록
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'tab-schedule' ? 'active' : ''}`}
                onClick={() => setActiveTab('tab-schedule')}
              >
                🗓️ 일정관리
              </button>
            </div>
            <div className="tab-actions">
              <button type="button" onClick={handleCopyReport} className="btn btn-secondary btn-sm">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                마크다운 복사
              </button>
              <button type="button" onClick={handleDownloadReport} className="btn btn-primary btn-sm">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                다운로드 (.md)
              </button>
              <button type="button" onClick={handlePublishConfluence} className="btn btn-confluence btn-sm">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                컨플루언스 등록
              </button>
            </div>
          </div>

          <div className="tab-content-container">
            {/* 일일 업무 보고 탭 */}
            <div className={`tab-content ${activeTab === 'tab-daily' ? 'active' : ''}`}>
              <div className="report-editor-container">
                <div
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(dailyReportMd) || '<p style="color: var(--text-muted);">가져온 티켓이 없습니다. 상단에서 필터를 채운 후 티켓 가져오기를 실행해 주세요.</p>' }}
                ></div>
              </div>
            </div>

            {/* 주간 업무 보고 탭 */}
            <div className={`tab-content ${activeTab === 'tab-weekly' ? 'active' : ''}`}>
              <div className="report-editor-container">
                <div
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(weeklyReportMd) || '<p style="color: var(--text-muted);">가져온 티켓이 없습니다. 상단에서 필터를 채운 후 티켓 가져오기를 실행해 주세요.</p>' }}
                ></div>
              </div>
            </div>

            {/* 실적 분석 탭 */}
            <div className={`tab-content ${activeTab === 'tab-analytics' ? 'active' : ''}`}>
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
            </div>

            {/* 원시 티켓 목록 탭 */}
            <div className={`tab-content ${activeTab === 'tab-raw' ? 'active' : ''}`}>
              <div className="ticket-list-wrapper">
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>키</th>
                      <th>요약</th>
                      <th>상태</th>
                      <th>담당자</th>
                      <th>업데이트 날짜</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          조건에 맞는 티켓이 존재하지 않습니다.
                        </td>
                      </tr>
                    ) : (
                      tickets.map((ticket, idx) => {
                        const category = getStatusCategory(ticket.status);
                        const statusClass = category === 'Done' ? 'done' : category === 'In Progress' ? 'progress' : 'todo';
                        return (
                          <tr key={idx}>
                            <td><strong>{ticket.key}</strong></td>
                            <td>{ticket.summary}</td>
                            <td><span className={`status-badge ${statusClass}`}>{ticket.status}</span></td>
                            <td>{ticket.assignee}</td>
                            <td>{ticket.updated}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 일정관리 탭 */}
            <div className={`tab-content ${activeTab === 'tab-schedule' ? 'active' : ''}`}>
              <div className="schedule-management-container">
                <div className="schedule-header-summary">
                  <h3>🗓️ 에픽별 프로젝트 개발 일정 및 진행 상황</h3>
                  <p className="subtitle">각 에픽 하위 티켓의 제목 태그([BE], [FE], [MO]) 기준 진행율 통계</p>
                </div>

                <div className="epic-cards-grid">
                  {getEpicScheduleData().length === 0 ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                      <p>조회된 티켓 데이터가 없습니다. 상단 필터를 입력하고 조회를 먼저 진행해 주세요.</p>
                    </div>
                  ) : (
                    getEpicScheduleData().map(epic => (
                      <div key={epic.key} className="epic-schedule-card">
                        <div className="epic-card-header">
                          <div className="epic-title-group">
                            <span className="epic-badge">{epic.key}</span>
                            <h4 className="epic-summary">{epic.summary}</h4>
                          </div>
                          
                          {/* 진행율 통계 요약 */}
                          <div className="epic-stats-row">
                            {epic.beProgress !== null && (
                              <div className="stat-badge be">
                                <span className="label">BE</span>
                                <span className="value">{epic.beProgress}% ({epic.beDoneCount}/{epic.beCount})</span>
                                <div className="mini-progress-bar">
                                  <div className="fill" style={{ width: `${epic.beProgress}%` }}></div>
                                </div>
                              </div>
                            )}
                            {epic.feProgress !== null && (
                              <div className="stat-badge fe">
                                <span className="label">FE</span>
                                <span className="value">{epic.feProgress}% ({epic.feDoneCount}/{epic.feCount})</span>
                                <div className="mini-progress-bar">
                                  <div className="fill" style={{ width: `${epic.feProgress}%` }}></div>
                                </div>
                              </div>
                            )}
                            {epic.moProgress !== null && (
                              <div className="stat-badge mo">
                                <span className="label">MO</span>
                                <span className="value">{epic.moProgress}% ({epic.moDoneCount}/{epic.moCount})</span>
                                <div className="mini-progress-bar">
                                  <div className="fill" style={{ width: `${epic.moProgress}%` }}></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="epic-card-body">
                          {/* BE 티켓 */}
                          {epic.categorizedTickets.BE.length > 0 && (
                            <div className="category-group">
                              <h5>💻 Backend 티켓 ({epic.categorizedTickets.BE.length})</h5>
                              <ul className="schedule-ticket-list">
                                {epic.categorizedTickets.BE.map(t => (
                                  <li key={t.key} className="schedule-ticket-item">
                                    <span className="ticket-key-link" onClick={() => window.open(getTicketLink(t.key, url), '_blank')}>{t.key}</span>
                                    <span className="ticket-summary-text">{t.summary}</span>
                                    <div className="ticket-meta">
                                      <span className="assignee">👤 {t.assignee || '미지정'}</span>
                                      <span className={`status-tag ${getStatusCategory(t.status).toLowerCase().replace(' ', '-')}`}>{t.status}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* FE 티켓 */}
                          {epic.categorizedTickets.FE.length > 0 && (
                            <div className="category-group">
                              <h5>🎨 Frontend 티켓 ({epic.categorizedTickets.FE.length})</h5>
                              <ul className="schedule-ticket-list">
                                {epic.categorizedTickets.FE.map(t => (
                                  <li key={t.key} className="schedule-ticket-item">
                                    <span className="ticket-key-link" onClick={() => window.open(getTicketLink(t.key, url), '_blank')}>{t.key}</span>
                                    <span className="ticket-summary-text">{t.summary}</span>
                                    <div className="ticket-meta">
                                      <span className="assignee">👤 {t.assignee || '미지정'}</span>
                                      <span className={`status-tag ${getStatusCategory(t.status).toLowerCase().replace(' ', '-')}`}>{t.status}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* MO 티켓 */}
                          {epic.categorizedTickets.MO.length > 0 && (
                            <div className="category-group">
                              <h5>📱 Mobile 티켓 ({epic.categorizedTickets.MO.length})</h5>
                              <ul className="schedule-ticket-list">
                                {epic.categorizedTickets.MO.map(t => (
                                  <li key={t.key} className="schedule-ticket-item">
                                    <span className="ticket-key-link" onClick={() => window.open(getTicketLink(t.key, url), '_blank')}>{t.key}</span>
                                    <span className="ticket-summary-text">{t.summary}</span>
                                    <div className="ticket-meta">
                                      <span className="assignee">👤 {t.assignee || '미지정'}</span>
                                      <span className={`status-tag ${getStatusCategory(t.status).toLowerCase().replace(' ', '-')}`}>{t.status}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 기타 티켓 */}
                          {epic.categorizedTickets.OTHER.length > 0 && (
                            <div className="category-group">
                              <h5>📄 기타 티켓 ({epic.categorizedTickets.OTHER.length})</h5>
                              <ul className="schedule-ticket-list">
                                {epic.categorizedTickets.OTHER.map(t => (
                                  <li key={t.key} className="schedule-ticket-item">
                                    <span className="ticket-key-link" onClick={() => window.open(getTicketLink(t.key, url), '_blank')}>{t.key}</span>
                                    <span className="ticket-summary-text">{t.summary}</span>
                                    <div className="ticket-meta">
                                      <span className="assignee">👤 {t.assignee || '미지정'}</span>
                                      <span className={`status-tag ${getStatusCategory(t.status).toLowerCase().replace(' ', '-')}`}>{t.status}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
