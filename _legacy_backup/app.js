/**
 * Workflow - Jira Report Generator App JavaScript Logic
 * 
 * 주요 기능:
 * 1. 로컬 환경 설정 보존 및 로드 (LocalStorage)
 * 2. Jira Cloud JQL JQL 동적 빌더
 * 3. 고품질 Mock 데이터 시뮬레이터 (API 모드 꺼짐 시 자동 활성화)
 * 4. 실제 Jira Cloud API 연동 (Basic Auth + CORS 주의)
 * 5. 일일 업무 보고(Standup) & 주간 업무 보고 마크다운 컴포저
 * 6. 마크다운 간이 파서 및 클립보드/파일 다운로드 기능
 * 7. 아틀라시안 컨플루언스(Confluence) 자동 문서 등록 & Deep Link 생성
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - 설정 패널
  const jiraUrlInput = document.getElementById('jira-url');
  const jiraEmailInput = document.getElementById('jira-email');
  const jiraTokenInput = document.getElementById('jira-token');
  const confluenceSpaceInput = document.getElementById('confluence-space');
  const modeToggle = document.getElementById('mode-toggle');
  const saveSettingsBtn = document.getElementById('save-settings');
  const connectionStatusDot = document.getElementById('connection-status-dot');
  const connectionStatusText = document.getElementById('connection-status-text');

  // DOM Elements - 팀원 관리
  const newMemberInput = document.getElementById('new-member');
  const btnAddMember = document.getElementById('btn-add-member');
  const registeredMemberList = document.getElementById('registered-member-list');

  // DOM Elements - 필터 폼
  const filterForm = document.getElementById('filter-form');
  const projectKeyInput = document.getElementById('project-key');
  const teamMembersInput = document.getElementById('team-members');
  const teamMemberChips = document.getElementById('team-member-chips');
  const dateStartInput = document.getElementById('date-start');
  const dateEndInput = document.getElementById('date-end');
  const btnFetch = document.getElementById('btn-fetch');

  // DOM Elements - 대시보드 스탯 & JQL
  const chartPie = document.getElementById('chart-pie');
  const chartLegend = document.getElementById('chart-legend');
  const countDone = document.getElementById('count-done');
  const countProgress = document.getElementById('count-progress');
  const countTotal = document.getElementById('count-total');
  const jqlCode = document.getElementById('jql-code');
  const btnCopyJql = document.getElementById('btn-copy-jql');

  // DOM Elements - 리포트 및 액션
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const dailyPreview = document.getElementById('daily-preview');
  const weeklyPreview = document.getElementById('weekly-preview');
  const ticketTableBody = document.getElementById('ticket-table-body');
  const btnCopyReport = document.getElementById('btn-copy-report');
  const btnDownloadReport = document.getElementById('btn-download-report');
  const btnConfluencePublish = document.getElementById('btn-confluence-publish');

  // 전역 상태 객체
  let appState = {
    settings: {
      url: '',
      email: '',
      token: '',
      confluenceSpace: '',
      apiMode: false
    },
    filters: {
      projectKey: 'PROJ',
      teamMembers: [],
      dateStart: '',
      dateEnd: ''
    },
    registeredMembers: [],
    activeTab: 'tab-daily',
    fetchedTickets: [],
    reports: {
      daily: '',
      weekly: ''
    }
  };

  // ==========================================================================
  // 1. 초기 설정 로드 및 날짜 기본값 셋팅
  // ==========================================================================
  
  function init() {
    // 날짜 기본값 설정: 시작일(이번 주 월요일), 종료일(이번 주 금요일)
    const today = new Date();
    const currentDay = today.getDay();
    
    // 이번 주 월요일 계산
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    // 이번 주 금요일 계산
    const distanceToFriday = currentDay === 0 ? -2 : 5 - currentDay;
    const friday = new Date(today);
    friday.setDate(today.getDate() + distanceToFriday);

    dateStartInput.value = monday.toISOString().split('T')[0];
    dateEndInput.value = friday.toISOString().split('T')[0];

    // LocalStorage에서 설정 로드
    const savedSettings = localStorage.getItem('workflow_jira_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        appState.settings = { ...appState.settings, ...parsed };
        
        // UI에 바인딩
        jiraUrlInput.value = appState.settings.url || '';
        jiraEmailInput.value = appState.settings.email || '';
        jiraTokenInput.value = appState.settings.token || '';
        confluenceSpaceInput.value = appState.settings.confluenceSpace || '';
        modeToggle.checked = appState.settings.apiMode || false;
      } catch (e) {
        console.error('설정을 파싱하는 도중 에러가 발생했습니다.', e);
      }
    }

    // LocalStorage에서 등록된 팀원 로드
    const savedMembers = localStorage.getItem('workflow_registered_members');
    if (savedMembers) {
      try {
        appState.registeredMembers = JSON.parse(savedMembers);
      } catch (e) {
        console.error('등록된 팀원 목록을 파싱하는 도중 에러가 발생했습니다.', e);
        appState.registeredMembers = ['홍길동', '김철수', '이영희'];
      }
    } else {
      appState.registeredMembers = ['홍길동', '김철수', '이영희'];
      localStorage.setItem('workflow_registered_members', JSON.stringify(appState.registeredMembers));
    }

    // LocalStorage에서 대상 팀원 필터 설정값 로드
    const savedFilterMembers = localStorage.getItem('workflow_filter_members');
    if (savedFilterMembers !== null) {
      teamMembersInput.value = savedFilterMembers;
    }

    // LocalStorage에서 프로젝트 키 로드
    const savedProjectKey = localStorage.getItem('workflow_project_key');
    if (savedProjectKey !== null) {
      projectKeyInput.value = savedProjectKey;
    } else {
      projectKeyInput.value = 'DI26';
    }

    // UI 렌더링
    renderRegisteredMembers();
    renderMemberChips();

    updateConnectionStatusUI();
    
    // 최초 실행 시 Mock 데이터로 화면 초기 채우기
    triggerFetch();
  }

  // API 활성화 상태에 따른 UI 변경
  function updateConnectionStatusUI() {
    const isApi = modeToggle.checked;
    appState.settings.apiMode = isApi;
    
    if (isApi) {
      connectionStatusDot.classList.add('active');
      connectionStatusDot.style.backgroundColor = 'var(--color-success)';
      connectionStatusText.textContent = 'Jira API 대기 중';
    } else {
      connectionStatusDot.classList.add('active');
      connectionStatusDot.style.backgroundColor = 'var(--color-accent)';
      connectionStatusText.textContent = '시뮬레이션 모드 작동 중';
    }
  }

  // --------------------------------------------------------------------------
  // 팀원 관리 헬퍼 함수 정의 및 UI 바인딩
  // --------------------------------------------------------------------------

  // 등록된 팀원 목록 렌더링
  function renderRegisteredMembers() {
    registeredMemberList.innerHTML = '';
    
    appState.registeredMembers.forEach((member) => {
      const li = document.createElement('li');
      li.className = 'member-list-item';
      li.innerHTML = `
        <span>${member}</span>
        <button type="button" class="btn-remove-member" data-name="${member}">&times;</button>
      `;
      
      // 삭제 버튼 이벤트 바인딩
      li.querySelector('.btn-remove-member').addEventListener('click', (e) => {
        const nameToRemove = e.target.getAttribute('data-name');
        appState.registeredMembers = appState.registeredMembers.filter(m => m !== nameToRemove);
        localStorage.setItem('workflow_registered_members', JSON.stringify(appState.registeredMembers));
        
        renderRegisteredMembers();
        renderMemberChips();
      });
      
      registeredMemberList.appendChild(li);
    });
  }

  // 필터 조건 부분의 팀원 칩 목록 렌더링
  function renderMemberChips() {
    teamMemberChips.innerHTML = '';
    
    // 현재 입력값 파싱
    const rawVal = teamMembersInput.value;
    const activeMembers = rawVal.split(',').map(m => m.trim()).filter(m => m.length > 0);
    
    appState.registeredMembers.forEach((member) => {
      const chip = document.createElement('div');
      chip.className = 'member-chip';
      if (activeMembers.includes(member)) {
        chip.classList.add('active');
      }
      chip.textContent = member;
      
      // 칩 클릭 시 토글
      chip.addEventListener('click', () => {
        const currentVal = teamMembersInput.value;
        let members = currentVal.split(',').map(m => m.trim()).filter(m => m.length > 0);
        
        if (members.includes(member)) {
          // 이미 존재하면 제거
          members = members.filter(m => m !== member);
        } else {
          // 존재하지 않으면 추가
          members.push(member);
        }
        
        teamMembersInput.value = members.join(', ');
        localStorage.setItem('workflow_filter_members', teamMembersInput.value);
        renderMemberChips();
      });
      
      teamMemberChips.appendChild(chip);
    });
  }

  // 팀원 추가 이벤트 리스너
  btnAddMember.addEventListener('click', () => {
    const newName = newMemberInput.value.trim();
    if (!newName) {
      alert('추가할 팀원 이름을 입력해 주세요.');
      return;
    }
    
    if (appState.registeredMembers.includes(newName)) {
      alert('이미 등록된 팀원입니다.');
      return;
    }
    
    appState.registeredMembers.push(newName);
    localStorage.setItem('workflow_registered_members', JSON.stringify(appState.registeredMembers));
    
    newMemberInput.value = '';
    renderRegisteredMembers();
    renderMemberChips();
  });

  // 팀원 추가 엔터 키 바인딩
  newMemberInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddMember.click();
    }
  });

  // 사용자가 수동으로 텍스트 인풋을 입력/수정할 때 칩 상태를 실시간 동기화
  teamMembersInput.addEventListener('input', () => {
    localStorage.setItem('workflow_filter_members', teamMembersInput.value);
    renderMemberChips();
  });

  // ==========================================================================
  // 2. 이벤트 리스너 등록
  // ==========================================================================

  // 설정 저장 버튼
  saveSettingsBtn.addEventListener('click', () => {
    appState.settings.url = jiraUrlInput.value.trim();
    appState.settings.email = jiraEmailInput.value.trim();
    appState.settings.token = jiraTokenInput.value.trim();
    appState.settings.confluenceSpace = confluenceSpaceInput.value.trim();
    appState.settings.apiMode = modeToggle.checked;

    localStorage.setItem('workflow_jira_settings', JSON.stringify(appState.settings));
    alert('설정이 로컬 브라우저에 성공적으로 저장되었습니다.');
    updateConnectionStatusUI();
    triggerFetch();
  });

  // API 모드 토글
  modeToggle.addEventListener('change', () => {
    // 토글 시점의 입력창 최신 값을 상태에 동기화해 줍니다.
    appState.settings.url = jiraUrlInput.value.trim();
    appState.settings.email = jiraEmailInput.value.trim();
    appState.settings.token = jiraTokenInput.value.trim();
    appState.settings.confluenceSpace = confluenceSpaceInput.value.trim();
    appState.settings.apiMode = modeToggle.checked;
    
    // 로컬 스토리지에 현재 설정 즉시 보존
    localStorage.setItem('workflow_jira_settings', JSON.stringify(appState.settings));

    updateConnectionStatusUI();
    triggerFetch();
  });

  // JQL 복사 버튼
  btnCopyJql.addEventListener('click', () => {
    const jql = jqlCode.textContent;
    copyToClipboard(jql, 'JQL 쿼리가 클립보드에 복사되었습니다.');
  });

  // 필터 폼 서브밋 (티켓 가져오기)
  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerFetch();
  });

  // 탭 변경
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.target.getAttribute('data-tab');
      
      // 버튼 활성화 클래스 스위칭
      tabButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // 콘텐츠 영역 스위칭
      tabContents.forEach(content => {
        if (content.id === targetTab) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
      
      appState.activeTab = targetTab;
    });
  });

  // 리포트 마크다운 복사 버튼
  btnCopyReport.addEventListener('click', () => {
    let reportText = '';
    if (appState.activeTab === 'tab-daily') {
      reportText = appState.reports.daily;
    } else if (appState.activeTab === 'tab-weekly') {
      reportText = appState.reports.weekly;
    } else {
      alert('복사할 마크다운 보고서가 없습니다. 일일 또는 주간 탭을 선택해주세요.');
      return;
    }

    if (!reportText) {
      alert('생성된 보고서 내용이 없습니다.');
      return;
    }

    copyToClipboard(reportText, '업무 보고서 마크다운이 클립보드에 복사되었습니다.');
  });

  // 리포트 파일 다운로드 버튼
  btnDownloadReport.addEventListener('click', () => {
    let reportText = '';
    let filename = '';
    
    if (appState.activeTab === 'tab-daily') {
      reportText = appState.reports.daily;
      filename = `Daily_Report_${appState.filters.dateStart}_to_${appState.filters.dateEnd}.md`;
    } else if (appState.activeTab === 'tab-weekly') {
      reportText = appState.reports.weekly;
      filename = `Weekly_Report_${appState.filters.dateStart}_to_${appState.filters.dateEnd}.md`;
    } else {
      alert('다운로드할 업무 보고서가 없습니다. 일일 또는 주간 탭을 선택해주세요.');
      return;
    }

    if (!reportText) {
      alert('다운로드할 내용이 없습니다.');
      return;
    }

    downloadFile(reportText, filename);
  });

  // 컨플루언스 자동 업로드 및 등록 버튼
  btnConfluencePublish.addEventListener('click', async () => {
    let reportText = '';
    let reportTitle = '';
    
    if (appState.activeTab === 'tab-daily') {
      reportText = appState.reports.daily;
      const todayStr = new Date().toISOString().split('T')[0];
      reportTitle = `📅 [일일 업무 보고서] ${todayStr}`;
    } else if (appState.activeTab === 'tab-weekly') {
      reportText = appState.reports.weekly;
      reportTitle = `📊 [주간 프로젝트 보고서] ${appState.filters.dateStart} ~ ${appState.filters.dateEnd}`;
    } else {
      alert('컨플루언스에 등록할 보고서 탭(일일 혹은 주간)을 선택해주세요.');
      return;
    }

    if (!reportText) {
      alert('등록할 보고서가 비어있습니다. 먼저 [티켓 가져오기]를 실행해 주세요.');
      return;
    }

    // 마크다운을 컨플루언스용 HTML 스키마로 파싱
    const htmlContent = parseMarkdownToHtml(reportText);

    btnConfluencePublish.disabled = true;
    const originText = btnConfluencePublish.innerHTML;
    btnConfluencePublish.textContent = '게시 중...';

    try {
      await publishToConfluence(reportTitle, htmlContent);
    } catch (err) {
      console.error('Confluence publish trigger failed:', err);
    } finally {
      btnConfluencePublish.disabled = false;
      btnConfluencePublish.innerHTML = originText;
    }
  });

  // ==========================================================================
  // 3. JQL 빌더 로직 및 데이터 가져오기 실행부
  // ==========================================================================

  // 프로젝트 키 변경 시 즉각 저장
  projectKeyInput.addEventListener('input', () => {
    localStorage.setItem('workflow_project_key', projectKeyInput.value.trim());
  });

  // JQL 빌더 (이번 주 조회용)
  function buildJql() {
    const projectKey = projectKeyInput.value.trim() || 'PROJ';
    const rawMembers = teamMembersInput.value.split(',');
    const members = rawMembers.map(m => m.trim()).filter(m => m.length > 0);
    appState.filters.teamMembers = members;
    
    const start = dateStartInput.value;
    const end = dateEndInput.value;
    
    appState.filters.projectKey = projectKey;
    appState.filters.dateStart = start;
    appState.filters.dateEnd = end;

    let jql = `project = "${projectKey}"`;
    if (members.length > 0) {
      const membersQuery = members.map(m => `"${m}"`).join(', ');
      jql += ` AND assignee in (${membersQuery})`;
    }
    jql += ` AND status in ("In Progress", "Done", "Resolved", "To Do")`;
    if (start) jql += ` AND updated >= "${start}"`;
    if (end) jql += ` AND updated <= "${end} 23:59"`;
    jql += ` ORDER BY updated DESC`;
    
    jqlCode.textContent = jql;
    return jql;
  }

  // JQL 빌더 (다음 주 조회용)
  function buildNextWeekJql() {
    const projectKey = projectKeyInput.value.trim() || 'PROJ';
    const rawMembers = teamMembersInput.value.split(',');
    const members = rawMembers.map(m => m.trim()).filter(m => m.length > 0);
    
    const start = dateStartInput.value;
    const end = dateEndInput.value;
    
    // 다음 주 날짜 범위 계산 (현재 범위 +7일)
    const nextStart = new Date(start);
    nextStart.setDate(nextStart.getDate() + 7);
    const nextStartStr = nextStart.toISOString().split('T')[0];

    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 7);
    const nextEndStr = nextEnd.toISOString().split('T')[0];

    let jql = `project = "${projectKey}"`;
    if (members.length > 0) {
      const membersQuery = members.map(m => `"${m}"`).join(', ');
      jql += ` AND assignee in (${membersQuery})`;
    }
    jql += ` AND status in ("In Progress", "Done", "Resolved", "To Do")`;
    jql += ` AND updated >= "${nextStartStr}"`;
    jql += ` AND updated <= "${nextEndStr} 23:59"`;
    jql += ` ORDER BY updated DESC`;
    
    return jql;
  }

  async function triggerFetch() {
    const jql = buildJql();
    const nextJql = buildNextWeekJql();
    
    btnFetch.disabled = true;
    btnFetch.textContent = '불러오는 중...';

    // 다음 주 날짜 문자열 계산
    const start = dateStartInput.value;
    const end = dateEndInput.value;
    const nextStart = new Date(start);
    nextStart.setDate(nextStart.getDate() + 7);
    const nextStartStr = nextStart.toISOString().split('T')[0];
    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 7);
    const nextEndStr = nextEnd.toISOString().split('T')[0];

    if (appState.settings.apiMode) {
      try {
        connectionStatusText.textContent = '이번 주 데이터 로드 중...';
        const currentTickets = await fetchJiraTickets(jql);
        
        connectionStatusText.textContent = '다음 주 계획 데이터 로드 중...';
        const nextTickets = await fetchJiraTickets(nextJql);
        
        processFetchedData(currentTickets, nextTickets);
        connectionStatusText.textContent = `Jira API 연동 완료 (이번 주 ${currentTickets.length}건 / 다음 주 ${nextTickets.length}건)`;
      } catch (err) {
        console.error('Jira API fetch error:', err);
        alert(`[Jira API 연동 실패]\n서버 응답 오류 혹은 설정값 오류가 발생했습니다.\n\n오류 내용: ${err.message}\n\n입력하신 Jira URL, 이메일, API Token이 정확한지 다시 한번 확인해주세요.`);
        connectionStatusDot.style.backgroundColor = 'var(--color-danger)';
        connectionStatusText.textContent = `연동 실패 (${err.message})`;
      } finally {
        btnFetch.disabled = false;
        btnFetch.textContent = '티켓 가져오기';
      }
    } else {
      // 시뮬레이션 모드 (더미 데이터 생성)
      setTimeout(() => {
        const mockTickets = generateMockTickets(
          appState.filters.projectKey,
          appState.filters.teamMembers,
          appState.filters.dateStart,
          appState.filters.dateEnd
        );
        const nextMockTickets = generateMockTickets(
          appState.filters.projectKey,
          appState.filters.teamMembers,
          nextStartStr,
          nextEndStr
        );
        processFetchedData(mockTickets, nextMockTickets);
        btnFetch.disabled = false;
        btnFetch.textContent = '티켓 가져오기';
      }, 500);
    }
  }

  // ==========================================================================
  // 4. Jira REST API Fetch & CORS 처리 (페이지네이션 지원)
  // ==========================================================================

  async function fetchJiraTickets(jql) {
    const url = appState.settings.url;
    const email = appState.settings.email;
    const token = appState.settings.token;

    if (!url || !email || !token) {
      throw new Error('Jira API 설정 정보가 누락되었습니다.');
    }

    const credential = btoa(`${email}:${token}`);
    
    let cleanUrl = url.trim();
    try {
      if (cleanUrl.toLowerCase().startsWith('http')) {
        const urlObj = new URL(cleanUrl);
        cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
    } catch (e) {
      console.warn('Jira URL 호스트 추출 실패, 원본 유지:', e);
    }
    
    let allIssues = [];
    let startAt = 0;
    let isLastPage = false;
    const limit = 100;
      
    while (!isLastPage) {
      const targetUrl = `${cleanUrl.replace(/\/$/, '')}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,status,assignee,updated&maxResults=${limit}&startAt=${startAt}`;
      const apiEndpoint = `http://localhost:8080/?url=${encodeURIComponent(targetUrl)}`;
      
      console.log(`[Jira Fetch] Fetching page starting at ${startAt}...`);
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
      connectionStatusText.textContent = `티켓 수집 중... (${allIssues.length}/${totalCount}건)`;
      
      startAt += pageIssues.length;
      
      if (pageIssues.length === 0 || allIssues.length >= totalCount) {
        isLastPage = true;
      }
    }

    console.log(`[Jira Fetch] Successfully fetched all ${allIssues.length} tickets.`);

    // 디버깅용: 지라가 돌려준 티켓들의 실제 담당자 프로필 이름 전체 출력
    console.log('--- [Jira 연동 디버깅] 지라 서버가 반환한 실제 담당자(Assignee) 목록 ---');
    allIssues.forEach(issue => {
      const key = issue.key;
      const disp = issue.fields?.assignee?.displayName || '담당자 미지정';
      const name = issue.fields?.assignee?.name || 'name 정보 없음';
      const email = issue.fields?.assignee?.emailAddress || '이메일 없음';
      console.log(`티켓: ${key} | 지라 프로필 실명: "${disp}" | 시스템 ID: "${name}" | 이메일: ${email}`);
    });
    console.log('------------------------------------------------------------------');

    // 수집된 모든 티켓 포맷 가공 및 반환
    return allIssues.map(issue => {
      return {
        key: issue.key || '',
        summary: issue.fields?.summary || '제목 없음',
        status: issue.fields?.status ? (issue.fields.status.name || 'To Do') : 'To Do',
        assignee: issue.fields?.assignee ? (issue.fields.assignee.displayName || issue.fields.assignee.name || '미지정') : '미지정',
        updated: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : ''
      };
    });
  }

  // ==========================================================================
  // 5. Confluence API 연동 페이지 게시 함수
  // ==========================================================================

  async function publishToConfluence(title, htmlContent) {
    const url = appState.settings.url;
    const email = appState.settings.email;
    const token = appState.settings.token;
    const spaceKey = appState.settings.confluenceSpace;

    if (!spaceKey) {
      alert('컨플루언스에 등록하려면 설정 패널에서 "Confluence Space Key"를 반드시 입력하고 저장하셔야 합니다.');
      throw new Error('Confluence Space Key 정보 누락');
    }

    // 1. 시뮬레이션 모드 (데모 기동)
    if (!appState.settings.apiMode) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const fakeBase = url ? url.trim().replace(/\/$/, '') : 'https://ikoobdoc.atlassian.net';
          const fakeLink = `${fakeBase}/wiki/spaces/${spaceKey.toUpperCase()}/pages/${Math.floor(Math.random() * 90000000) + 10000000}`;
          
          alert(`[컨플루언스 등록 시뮬레이션 완료!]\n\n공간(Space): ${spaceKey.toUpperCase()}\n제목: ${title}\n\n등록된 페이지 주소 (클릭 시 이동 가능):\n${fakeLink}`);
          window.open(fakeLink, '_blank');
          resolve({ webLink: fakeLink });
        }, 800);
      });
    }

    // 2. 실제 API 모드 동작
    if (!url || !email || !token) {
      alert('실제 API 모드를 사용하려면 Jira URL, 이메일, API Token 설정을 입력하고 저장해 주세요.');
      throw new Error('API Credentials missing');
    }

    const credential = btoa(`${email}:${token}`);
    
    let cleanUrl = url.trim();
    try {
      if (cleanUrl.toLowerCase().startsWith('http')) {
        const urlObj = new URL(cleanUrl);
        cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
    } catch (e) {
      console.warn('Confluence Host 추출 실패, 원본 유지:', e);
    }

    // Confluence v1 Content API 엔드포인트 조립
    const targetUrl = `${cleanUrl.replace(/\/$/, '')}/wiki/rest/api/content`;
    const proxyEndpoint = `http://localhost:8080/?url=${encodeURIComponent(targetUrl)}`;

    const requestBody = {
      type: 'page',
      title: title,
      space: {
        key: spaceKey.toUpperCase()
      },
      body: {
        storage: {
          value: htmlContent,
          representation: 'storage'
        }
      }
    };

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
        const errBody = await response.text();
        console.error('Confluence Publish Error Body:', errBody);
        throw new Error(`컨플루언스 서버 응답 에러 (상태코드: ${response.status})`);
      }

      const data = await response.json();
      const baseUrl = cleanUrl.replace(/\/$/, '');
      const webui = data._links?.webui || '';
      const docLink = `${baseUrl}/wiki${webui}`;

      alert(`[컨플루언스 등록 성공!]\n\nConfluence에 문서가 성공적으로 발행되었습니다.\n\n확인 주소 (새 창으로 이동):\n${docLink}`);
      window.open(docLink, '_blank');
      return data;
    } catch (err) {
      alert(`[컨플루언스 게시 실패]\nAPI 호출 중 오류가 발생했습니다.\n\n오류: ${err.message}\n\n도메인 주소 설정이나 Space Key가 실제 컨플루언스 공간과 일치하는지 확인해 주세요.`);
      throw err;
    }
  }

  // ==========================================================================
  // 6. Mock 데이터 생성기 (시뮬레이터)
  // ==========================================================================

  function generateMockTickets(projectKey, members, start, end) {
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
    const tickets = [];
    
    // 날짜 배열 계산
    const dateArray = [];
    let currentDate = new Date(start);
    const stopDate = new Date(end);
    while (currentDate <= stopDate) {
      dateArray.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    if (dateArray.length === 0) dateArray.push(new Date().toISOString().split('T')[0]);

    // 멤버가 없는 경우 가상의 멤버 추가
    const targetMembers = members.length > 0 ? members : ['홍길동', '김철수', '이영희'];

    let keyCounter = 101;
    
    // 더미 티켓 대량 생성
    targetMembers.forEach((member) => {
      // 멤버당 2 ~ 4개의 티켓 할당
      const ticketCount = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < ticketCount; i++) {
        const dummySummary = dummyTaskPool[Math.floor(Math.random() * dummyTaskPool.length)];
        const dummyStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];
        const dummyDate = dateArray[Math.floor(Math.random() * dateArray.length)];

        tickets.push({
          key: `${projectKey}-${keyCounter++}`,
          summary: `${member} - ${dummySummary}`,
          status: dummyStatus,
          assignee: member,
          updated: dummyDate
        });
      }
    });

    // 업데이트 날짜 기준 내림차순 정렬
    return tickets.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }

  // ==========================================================================
  // 7. 데이터 분석 및 통계 계산
  // ==========================================================================

  function processFetchedData(tickets, nextTickets = []) {
    appState.fetchedTickets = tickets;

    // 통계 계산
    const total = tickets.length;
    const done = tickets.filter(t => getStatusCategory(t.status) === 'Done').length;
    const progress = tickets.filter(t => getStatusCategory(t.status) === 'In Progress').length;
    const todo = total - done - progress;

    // 스탯 바인딩
    countTotal.textContent = total;
    countDone.textContent = done;
    countProgress.textContent = progress;

    // 원형 차트 비율 계산 및 그리기
    const donePercent = total > 0 ? Math.round((done / total) * 100) : 0;
    const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;
    
    chartPie.style.setProperty('--p-done', `${donePercent}%`);
    chartPie.style.setProperty('--p-progress', `${progressPercent}%`);

    // 차트 범례 동적 생성
    chartLegend.innerHTML = `
      <div class="legend-item">
        <span class="legend-color done"></span>
        <span>완료: ${donePercent}% (${done}건)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color progress"></span>
        <span>진행 중: ${progressPercent}% (${progress}건)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color todo"></span>
        <span>대기 중: ${total > 0 ? Math.round((todo / total) * 100) : 0}% (${todo}건)</span>
      </div>
    `;

    // 1. 원시 티켓 테이블 바인딩
    renderRawTicketTable(tickets);

    // 2. 보고서 템플릿 조립 및 렌더링
    generateDailyStandupReport(tickets);
    generateWeeklyReport(tickets, nextTickets);
  }

  function renderRawTicketTable(tickets) {
    if (tickets.length === 0) {
      ticketTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">조건에 맞는 티켓이 존재하지 않습니다.</td></tr>`;
      return;
    }

    ticketTableBody.innerHTML = tickets.map(ticket => {
      const category = getStatusCategory(ticket.status);
      let statusClass = 'todo';
      if (category === 'Done') statusClass = 'done';
      if (category === 'In Progress') statusClass = 'progress';

      return `
        <tr>
          <td><strong>${ticket.key}</strong></td>
          <td>${ticket.summary}</td>
          <td><span class="status-badge ${statusClass}">${ticket.status}</span></td>
          <td>${ticket.assignee}</td>
          <td>${ticket.updated}</td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // 8. 업무 보고서 컴포저 (Markdown 빌더)
  // ==========================================================================

  // 일일 Standup 보고서 컴포저
  function generateDailyStandupReport(tickets) {
    const start = appState.filters.dateStart;
    const end = appState.filters.dateEnd;

    let md = `# 📅 일일 업무 STAND-UP 보고서\n\n`;
    md += `> **보고 기간**: ${start} ~ ${end}\n`;
    md += `> **생성 일시**: ${new Date().toLocaleString('ko-KR')}\n\n`;
    
    // 담당자별 정렬
    const members = [...new Set(tickets.map(t => t.assignee))];
    
    if (members.length === 0) {
      md += `조회 기간 내 진행 중이거나 완료된 티켓이 없습니다.\n`;
    } else {
      members.forEach(member => {
        md += `## 👤 담당자: ${member}\n\n`;
        
        const memberTickets = tickets.filter(t => t.assignee === member);
        const completed = memberTickets.filter(t => getStatusCategory(t.status) === 'Done');
        const progressing = memberTickets.filter(t => getStatusCategory(t.status) === 'In Progress');
        const todos = memberTickets.filter(t => getStatusCategory(t.status) === 'To Do');

        // 완료 항목
        md += `### 🟢 오늘 완료한 업무 (Done)\n`;
        if (completed.length === 0) {
          md += `- 완료된 업무가 없습니다.\n`;
        } else {
          completed.forEach(t => {
            md += `- [${t.key}] ${t.summary} (업데이트: ${t.updated})\n`;
          });
        }
        md += `\n`;

        // 진행중 항목
        md += `### 🔵 현재 진행 중인 업무 (In Progress)\n`;
        if (progressing.length === 0) {
          md += `- 진행 중인 업무가 없습니다.\n`;
        } else {
          progressing.forEach(t => {
            md += `- [${t.key}] ${t.summary}\n`;
          });
        }
        md += `\n`;

        // 내일 예정 항목
        md += `### 🟡 내일 진행 예정 업무 (To Do)\n`;
        if (todos.length === 0) {
          md += `- 예정된 업무가 없습니다.\n`;
        } else {
          todos.forEach(t => {
            md += `- [${t.key}] ${t.summary}\n`;
          });
        }
        md += `\n---\n\n`;
      });
    }

    appState.reports.daily = md;
    
    // 미리보기에 렌더링
    dailyPreview.innerHTML = parseMarkdownToHtml(md);
  }

  // 주간 업무 보고서 컴포저
  function generateWeeklyReport(tickets, nextTickets = []) {
    const start = appState.filters.dateStart;
    const end = appState.filters.dateEnd;
    const total = tickets.length;
    const completedCount = tickets.filter(t => getStatusCategory(t.status) === 'Done').length;
    const progressingCount = tickets.filter(t => getStatusCategory(t.status) === 'In Progress').length;
    const todoCount = total - completedCount - progressingCount;

    let md = `# 📊 주간 프로젝트 업무 보고서\n\n`;
    md += `## 🗓️ 1. 보고서 요약 개요\n\n`;
    md += `* **작성 일자**: ${new Date().toLocaleDateString('ko-KR')}\n`;
    md += `* **대상 기간**: ${start} ~ ${end}\n`;
    md += `* **프로젝트 코드**: \`${appState.filters.projectKey}\`\n\n`;
    
    md += `### 📈 2. 이번 주 진행 상태 메트릭스\n\n`;
    md += `| 티켓 상태 | 건수 | 완료율 / 비율 |\n`;
    md += `| :--- | :---: | :---: |\n`;
    md += `| **완료 (Done/Resolved)** | ${completedCount}건 | ${total > 0 ? Math.round((completedCount/total)*100) : 0}% |\n`;
    md += `| **진행 중 (In Progress)** | ${progressingCount}건 | ${total > 0 ? Math.round((progressingCount/total)*100) : 0}% |\n`;
    md += `| **대기 중 (To Do)** | ${todoCount}건 | ${total > 0 ? Math.round((todoCount/total)*100) : 0}% |\n`;
    md += `| **합계 (Total)** | **${total}건** | **100%** |\n\n`;

    md += `## 📋 3. 팀원별 상세 업무 진행 현황\n\n`;
    
    const members = [...new Set(tickets.map(t => t.assignee))];
    if (members.length === 0) {
      md += `* 조회 기간 내 상세 티켓 내역이 없습니다.\n`;
    } else {
      members.forEach(member => {
        md += `### 👤 담당자: ${member}\n`;
        const memberTickets = tickets.filter(t => t.assignee === member);
        
        if (memberTickets.length === 0) {
          md += `* 진행한 티켓이 없습니다.\n`;
        } else {
          memberTickets.forEach(t => {
            const cat = getStatusCategory(t.status);
            const statusIndicator = (cat === 'Done') ? '✅' : 
                                    (cat === 'In Progress') ? '🔄' : '⏱️';
            md += `* ${statusIndicator} **[${t.key}]** ${t.summary} (\`${t.status}\`, 업데이트: ${t.updated})\n`;
          });
        }
        md += `\n`;
      });
    }

    md += `## 🚀 4. 다음 주 주요 계획 및 이슈 사항\n\n`;
    
    if (nextTickets.length === 0) {
      md += `* **마일스톤 점검**: 다음 주 예정된 지라 티켓이 등록되어 있지 않거나 계획을 불러올 수 없습니다.\n`;
      md += `* **장애 요인**: 예정된 주요 마일스톤에 지연 요소가 없는지 리스크 사전 점검.\n`;
    } else {
      // 다음 주 티켓을 분석하여 담당자별로 동적인 주간 계획표 완성
      const nextMembers = [...new Set(nextTickets.map(t => t.assignee))];
      nextMembers.forEach(member => {
        md += `### 👤 담당자: ${member} 계획\n`;
        const memberNext = nextTickets.filter(t => t.assignee === member);
        memberNext.forEach(t => {
          const cat = getStatusCategory(t.status);
          const stateSymbol = cat === 'Done' ? '🟢 [완료예정]' : cat === 'In Progress' ? '🔄 [진행예정]' : '⏱️ [할일]';
          md += `* ${stateSymbol} **[${t.key}]** ${t.summary} (\`${t.status}\`)\n`;
        });
        md += `\n`;
      });
    }

    appState.reports.weekly = md;
    
    // 미리보기에 렌더링
    weeklyPreview.innerHTML = parseMarkdownToHtml(md);
  }

  // ==========================================================================
  // 9. 텍스트 마크다운 -> HTML 변환 (보안 및 프리미엄 뷰어용 간이 파서)
  // ==========================================================================

  function parseMarkdownToHtml(markdown) {
    let html = markdown;

    // 1. 헤더 변환 (H1, H2, H3)
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');

    // 2. 인용구 blockquote 변환
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // 3. 인라인 코드 및 백틱 강조
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 4. 볼드체 변환
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 5. 구분선 변환
    html = html.replace(/^---$/gm, '<hr>');

    // 6. 테이블 변환
    // 테이블은 행단위로 분리해서 정렬
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
        
        // 헤더 구분선 무시
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
        
        lines[i] = ''; // 원본 대체
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</table>';
          lines[i] = tableHtml + '\n' + lines[i];
        }
      }
    }
    html = lines.join('\n');

    // 7. 리스트 변환 (순서 없는 리스트)
    html = html.replace(/^\*\s+(.+)$/gm, '<ul><li>$1</li></ul>');
    html = html.replace(/^-\s+(.+)$/gm, '<ul><li>$1</li></ul>');
    // 연속된 <ul> 태그 래핑 정리
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // 8. 줄바꿈 단락 변환 (기존 H나 UL 태그를 제외하고 빈 라인 기준)
    html = html.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed === '') return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('<tr') || trimmed.startsWith('<td') || trimmed.startsWith('<th') || trimmed.startsWith('<table') || trimmed.startsWith('<hr') || trimmed.startsWith('<blockquote>')) {
        return line;
      }
      return `<p>${line}</p>`;
    }).join('\n');

    return html;
  }

  // ==========================================================================
  // 10. 보조 유틸리티 (클립보드 복사 & 다운로드)
  // ==========================================================================

  function copyToClipboard(text, successMessage) {
    if (!navigator.clipboard) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        alert(successMessage);
      } catch (err) {
        alert('클립보드 복사에 실패했습니다.');
      }
      document.body.removeChild(textarea);
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        alert(successMessage);
      })
      .catch(err => {
        console.error('클립보드 복사 실패:', err);
        alert('클립보드 복사 중 오류가 발생했습니다.');
      });
  }

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 지라의 다양한 한글/영문 커스텀 상태를 'Done', 'In Progress', 'To Do' 3대 범주로 표준화하는 헬퍼 함수
  function getStatusCategory(statusName) {
    const status = (statusName || '').toLowerCase().trim();
    if (status.includes('done') || status.includes('resolved') || status.includes('완료') || status.includes('closed') || status.includes('성공')) {
      return 'Done';
    }
    if (status.includes('progress') || status.includes('진행') || status.includes('doing') || status.includes('개발') || status.includes('selected') || status.includes('working')) {
      return 'In Progress';
    }
    return 'To Do';
  }

  // 애플리케이션 시작
  init();
});
