'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function Home() {
  // SSR 하이드레이션 보호용 마운트 상태
  const [mounted, setMounted] = useState(false);

  // Jira API 설정 상태
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [confluenceSpace, setConfluenceSpace] = useState('');
  const [confluenceParentId, setConfluenceParentId] = useState('');
  const [apiMode, setApiMode] = useState(false);

  // 팀원 관리 상태
  const [registeredMembers, setRegisteredMembers] = useState(['홍길동', '김철수', '이영희']);
  const [newMemberName, setNewMemberName] = useState('');

  // 필터 조건 상태
  const [projectKey, setProjectKey] = useState('DI26');
  const [teamMembers, setTeamMembers] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // 대시보드 데이터 및 탭 상태
  const [activeTab, setActiveTab] = useState('tab-daily');
  const [tickets, setTickets] = useState([]);
  const [nextTickets, setNextTickets] = useState([]);
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
  useEffect(() => {
    setMounted(true);

    // 날짜 디폴트 계산: 이번 주 월요일 ~ 이번 주 금요일
    const today = new Date();
    const currentDay = today.getDay();
    
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const distanceToFriday = currentDay === 0 ? -2 : 5 - currentDay;
    const friday = new Date(today);
    friday.setDate(today.getDate() + distanceToFriday);

    const mondayStr = monday.toISOString().split('T')[0];
    const fridayStr = friday.toISOString().split('T')[0];
    setDateStart(mondayStr);
    setDateEnd(fridayStr);

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

    // 1-2. 등록된 팀원 목록 복구
    const savedMembers = localStorage.getItem('workflow_registered_members');
    if (savedMembers) {
      try {
        setRegisteredMembers(JSON.parse(savedMembers));
      } catch (e) {
        console.error('팀원 목록 복구 중 오류 발생:', e);
      }
    } else {
      localStorage.setItem('workflow_registered_members', JSON.stringify(['홍길동', '김철수', '이영희']));
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
      token: activeToken
    });
  }, []);

  // --------------------------------------------------------------------------
  // 2. JQL 빌더 계산 함수
  // --------------------------------------------------------------------------
  const getJql = () => {
    const proj = projectKey.trim() || 'PROJ';
    const members = teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0);
    
    let jql = `project = "${proj}"`;
    if (members.length > 0) {
      const membersQuery = members.map(m => `"${m}"`).join(', ');
      jql += ` AND assignee in (${membersQuery})`;
    }
    jql += ` AND status in ("In Progress", "Done", "Resolved", "To Do")`;
    if (dateStart) jql += ` AND updated >= "${dateStart}"`;
    if (dateEnd) jql += ` AND updated <= "${dateEnd} 23:59"`;
    jql += ` ORDER BY updated DESC`;
    return jql;
  };

  const getNextWeekJql = () => {
    const proj = projectKey.trim() || 'PROJ';
    const members = teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0);
    
    // 다음 주 날짜 범위 계산
    const start = dateStart || new Date().toISOString().split('T')[0];
    const end = dateEnd || new Date().toISOString().split('T')[0];
    const nextStart = new Date(start);
    nextStart.setDate(nextStart.getDate() + 7);
    const nextStartStr = nextStart.toISOString().split('T')[0];
    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 7);
    const nextEndStr = nextEnd.toISOString().split('T')[0];

    let jql = `project = "${proj}"`;
    if (members.length > 0) {
      const membersQuery = members.map(m => `"${m}"`).join(', ');
      jql += ` AND assignee in (${membersQuery})`;
    }
    jql += ` AND status in ("In Progress", "Done", "Resolved", "To Do")`;
    jql += ` AND updated >= "${nextStartStr}"`;
    jql += ` AND updated <= "${nextEndStr} 23:59"`;
    jql += ` ORDER BY updated DESC`;
    return jql;
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
    let startAt = 0;
    let isLastPage = false;
    const limit = 100;

    while (!isLastPage) {
      const targetUrl = `${cleanUrl.replace(/\/$/, '')}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,status,assignee,updated&maxResults=${limit}&startAt=${startAt}`;
      const apiEndpoint = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

      console.log(`[Jira Fetch] Next.js route proxy 호출 starting at ${startAt}...`);
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
      allIssues = allIssues.concat(pageIssues);

      const totalCount = data.total || 0;
      setConnectionStatus({ dot: 'success', text: `티켓 수집 중... (${allIssues.length}/${totalCount}건)` });

      startAt += pageIssues.length;

      if (pageIssues.length === 0 || allIssues.length >= totalCount) {
        isLastPage = true;
      }
    }

    return allIssues.map(issue => ({
      key: issue.key || '',
      summary: issue.fields?.summary || '제목 없음',
      status: issue.fields?.status ? (issue.fields.status.name || 'To Do') : 'To Do',
      assignee: issue.fields?.assignee ? (issue.fields.assignee.displayName || issue.fields.assignee.name || '미지정') : '미지정',
      updated: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : ''
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
      const ticketCount = 3; // 인당 3개 고정 생산

      for (let i = 0; i < ticketCount; i++) {
        const dummySummary = dummyTaskPool[(memberSeed + i) % dummyTaskPool.length];
        const dummyStatus = statusOptions[i % statusOptions.length];
        const dummyDate = dateArray[i % dateArray.length];

        result.push({
          key: `${projKey}-${keyCounter++}`,
          summary: dummySummary,
          status: dummyStatus,
          assignee: member,
          updated: dummyDate
        });
      }
    });

    return result.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  };

  // --------------------------------------------------------------------------
  // 5. 티켓 로드 통합 실행 제어
  // --------------------------------------------------------------------------
  const triggerInitialFetch = async (params) => {
    setIsLoading(true);

    if (params.apiMode) {
      const proj = params.projectKey.trim() || 'PROJ';
      const members = params.teamMembers.split(',').map(m => m.trim()).filter(m => m.length > 0);
      
      let jql = `project = "${proj}"`;
      if (members.length > 0) {
        const membersQuery = members.map(m => `"${m}"`).join(', ');
        jql += ` AND assignee in (${membersQuery})`;
      }
      jql += ` AND status in ("In Progress", "Done", "Resolved", "To Do")`;
      if (params.start) jql += ` AND updated >= "${params.start}"`;
      if (params.end) jql += ` AND updated <= "${params.end} 23:59"`;
      jql += ` ORDER BY updated DESC`;

      const nextStart = new Date(params.start);
      nextStart.setDate(nextStart.getDate() + 7);
      const nextEnd = new Date(params.end);
      nextEnd.setDate(nextEnd.getDate() + 7);
      const nextStartStr = nextStart.toISOString().split('T')[0];
      const nextEndStr = nextEnd.toISOString().split('T')[0];

      let nextJql = `project = "${proj}"`;
      if (members.length > 0) {
        const membersQuery = members.map(m => `"${m}"`).join(', ');
        nextJql += ` AND assignee in (${membersQuery})`;
      }
      nextJql += ` AND status in ("In Progress", "Done", "Resolved", "To Do")`;
      nextJql += ` AND updated >= "${nextStartStr}"`;
      nextJql += ` AND updated <= "${nextEndStr} 23:59"`;
      nextJql += ` ORDER BY updated DESC`;

      try {
        setConnectionStatus({ dot: 'success', text: '초기 로드: 이번 주 데이터 수집 중...' });
        const currentData = await fetchJiraTickets(jql, params.url, params.email, params.token);
        
        setConnectionStatus({ dot: 'success', text: '초기 로드: 다음 주 계획 수집 중...' });
        const nextData = await fetchJiraTickets(nextJql, params.url, params.email, params.token);

        setTickets(currentData);
        setNextTickets(nextData);
        processReportData(currentData, nextData, params.start, params.end, params.projectKey);
        setConnectionStatus({
          dot: 'success',
          text: `Jira API 연동 완료 (이번 주 ${currentData.length}건 / 다음 주 ${nextData.length}건)`
        });
      } catch (err) {
        console.error('초기 로딩 지라 API 에러:', err);
        setConnectionStatus({ dot: 'danger', text: `초기 로드 실패 (${err.message})` });
        
        // 폴백으로 Mock 데이터 제공
        const mock = generateMockTickets(params.projectKey, params.teamMembers, params.start, params.end);
        const nextMock = generateMockTickets(params.projectKey, params.teamMembers, nextStartStr, nextEndStr);
        setTickets(mock);
        setNextTickets(nextMock);
        processReportData(mock, nextMock, params.start, params.end, params.projectKey);
      } finally {
        setIsLoading(false);
      }
    } else {
      setTimeout(() => {
        const mock = generateMockTickets(params.projectKey, params.teamMembers, params.start, params.end);
        
        const nextStart = new Date(params.start);
        nextStart.setDate(nextStart.getDate() + 7);
        const nextEnd = new Date(params.end);
        nextEnd.setDate(nextEnd.getDate() + 7);
        const nextMock = generateMockTickets(params.projectKey, params.teamMembers, nextStart.toISOString().split('T')[0], nextEnd.toISOString().split('T')[0]);
        
        setTickets(mock);
        setNextTickets(nextMock);
        processReportData(mock, nextMock, params.start, params.end, params.projectKey);
        setIsLoading(false);
      }, 400);
    }
  };

  const handleFetchTickets = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    const jql = getJql();
    const nextJql = getNextWeekJql();

    const start = dateStart;
    const end = dateEnd;
    const nextStart = new Date(start);
    nextStart.setDate(nextStart.getDate() + 7);
    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 7);

    if (apiMode) {
      try {
        setConnectionStatus({ dot: 'success', text: '이번 주 데이터 로드 중...' });
        const currentData = await fetchJiraTickets(jql, url, email, token);
        
        setConnectionStatus({ dot: 'success', text: '다음 주 계획 데이터 로드 중...' });
        const nextData = await fetchJiraTickets(nextJql, url, email, token);

        setTickets(currentData);
        setNextTickets(nextData);
        processReportData(currentData, nextData, start, end, projectKey);
        setConnectionStatus({
          dot: 'success',
          text: `Jira API 연동 완료 (이번 주 ${currentData.length}건 / 다음 주 ${nextData.length}건)`
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
        const nextMock = generateMockTickets(projectKey, teamMembers, nextStart.toISOString().split('T')[0], nextEnd.toISOString().split('T')[0]);
        setTickets(mock);
        setNextTickets(nextMock);
        processReportData(mock, nextMock, start, end, projectKey);
        setIsLoading(false);
      }, 500);
    }
  };

  // --------------------------------------------------------------------------
  // 6. 보고서 마크다운 생성기
  // --------------------------------------------------------------------------
  const processReportData = (currList, nextList, start, end, proj) => {
    const getTicketLink = (key) => {
      const baseDomain = url && url.trim() ? url.trim().replace(/\/$/, '') : 'https://ikoobdoc.atlassian.net';
      return `${baseDomain}/browse/${key}`;
    };

    // 티켓 제목 내 대괄호 [ ]를 ( )로 안전하게 변경하여 마크다운 링크 파서 깨짐 현상 예방
    const escapeBrackets = (text) => {
      return (text || '')
        .replace(/\[/g, '(')
        .replace(/\]/g, ')');
    };

    // 6-1. 일일 업무 보고서 빌드
    let dailyMd = `# 📅 일일 업무 STAND-UP 보고서\n\n`;
    dailyMd += `> **보고 기간**: ${start} ~ ${end}\n`;
    dailyMd += `> **생성 일시**: ${new Date().toLocaleString('ko-KR')}\n\n`;

    const members = [...new Set(currList.map(t => t.assignee))];
    if (members.length === 0) {
      dailyMd += `조회 기간 내 진행 중이거나 완료된 티켓이 없습니다.\n`;
    } else {
      members.forEach(member => {
        dailyMd += `## 👤 담당자: ${member}\n\n`;
        const memberTickets = currList.filter(t => t.assignee === member);
        const completed = memberTickets.filter(t => getStatusCategory(t.status) === 'Done');
        const progressing = memberTickets.filter(t => getStatusCategory(t.status) === 'In Progress');

        dailyMd += `### 🟢 오늘 완료한 업무 (Done)\n`;
        if (completed.length === 0) {
          dailyMd += `- 완료된 업무가 없습니다.\n`;
        } else {
          completed.forEach(t => {
            dailyMd += `- [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key)}) (업데이트: ${t.updated})\n`;
          });
        }
        dailyMd += `\n`;

        dailyMd += `### 🔵 현재 진행 중인 업무 (In Progress)\n`;
        if (progressing.length === 0) {
          dailyMd += `- 진행 중인 업무가 없습니다.\n`;
        } else {
          progressing.forEach(t => {
            dailyMd += `- [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key)})\n`;
          });
        }
        dailyMd += `\n---\n\n`;
      });
    }
    setDailyReportMd(dailyMd);

    // 6-2. 주간 업무 보고서 빌드
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
    weeklyMd += `| **완료 (Done/Resolved)** | ${completedCount}건 | ${total > 0 ? Math.round((completedCount/total)*100) : 0}% |\n`;
    weeklyMd += `| **진행 중 (In Progress)** | ${progressingCount}건 | ${total > 0 ? Math.round((progressingCount/total)*100) : 0}% |\n`;
    weeklyMd += `| **대기 중 (To Do)** | ${todoCount}건 | ${total > 0 ? Math.round((todoCount/total)*100) : 0}% |\n`;
    weeklyMd += `| **합계 (Total)** | **${total}건** | **100%** |\n\n`;

    weeklyMd += `## 📋 3. 팀원별 상세 업무 진행 현황\n\n`;
    if (members.length === 0) {
      weeklyMd += `* 조회 기간 내 상세 티켓 내역이 없습니다.\n`;
    } else {
      members.forEach(member => {
        weeklyMd += `### 👤 담당자: ${member}\n`;
        const memberTickets = currList.filter(t => t.assignee === member);
        if (memberTickets.length === 0) {
          weeklyMd += `* 진행한 티켓이 없습니다.\n`;
        } else {
          memberTickets.forEach(t => {
            const cat = getStatusCategory(t.status);
            const statusIndicator = (cat === 'Done') ? '✅' : (cat === 'In Progress') ? '🔄' : '⏱️';
            weeklyMd += `* ${statusIndicator} [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key)}) (\`${t.status}\`, 업데이트: ${t.updated})\n`;
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
          weeklyMd += `* ${stateSymbol} [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key)}) (\`${t.status}\`)\n`;
        });
        weeklyMd += `\n`;
      });
    }

    setWeeklyReportMd(weeklyMd);
  };

  // --------------------------------------------------------------------------
  // 7. 설정 저장 & 로컬스토리지 동기화 핸들러
  // --------------------------------------------------------------------------
  const handleSaveSettings = () => {
    const settings = { url, email, token, confluenceSpace, confluenceParentId, apiMode };
    localStorage.setItem('workflow_jira_settings', JSON.stringify(settings));
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

    const htmlContent = parseMarkdownToHtml(reportText);
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
    navigator.clipboard.writeText(getJql())
      .then(() => alert('JQL 쿼리가 클립보드에 복사되었습니다.'))
      .catch(() => alert('복사 실패'));
  };

  // --------------------------------------------------------------------------
  // 10. 유틸리티 보조 함수 (상태 정규화 & 마크다운 HTML 간이 파서)
  // --------------------------------------------------------------------------
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
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
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
        <section className="filter-section card">
          <div className="section-header">
            <h3>티켓 필터 조건 설정</h3>
          </div>
          <form onSubmit={handleFetchTickets} className="filter-grid">
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
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isLoading ? '불러오는 중...' : '티켓 가져오기'}
              </button>
            </div>
          </form>
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
                    '--p-progress': `${progressPercent}%` 
                  }}
                ></div>
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
              <code>{getJql()}</code>
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
                className={`tab-btn ${activeTab === 'tab-raw' ? 'active' : ''}`}
                onClick={() => setActiveTab('tab-raw')}
              >
                조회된 티켓 목록
              </button>
            </div>
            <div className="tab-actions">
              <button type="button" onClick={handleCopyReport} className="btn btn-secondary btn-sm">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                마크다운 복사
              </button>
              <button type="button" onClick={handleDownloadReport} className="btn btn-primary btn-sm">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                다운로드 (.md)
              </button>
              <button type="button" onClick={handlePublishConfluence} className="btn btn-confluence btn-sm">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
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
          </div>
        </section>
      </main>
    </div>
  );
}
