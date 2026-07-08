"use client";

import { useState, useEffect, useMemo } from "react";

export default function Home() {
  // 1. 상태 선언
  const [mounted, setMounted] = useState(false);
  const [jiraUrl, setJiraUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [apiMode, setApiMode] = useState(false);

  const [newMember, setNewMember] = useState("");
  const [registeredMembers, setRegisteredMembers] = useState([]);

  const [projectKey, setProjectKey] = useState("DI26");
  const [teamMembersFilter, setTeamMembersFilter] = useState("홍길동, 김철수, 이영희");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [fetchedTickets, setFetchedTickets] = useState([]);
  const [activeTab, setActiveTab] = useState("tab-daily");
  
  const [connectionStatusText, setConnectionStatusText] = useState("시뮬레이션 모드 작동 중");
  const [connectionStatus, setConnectionStatus] = useState("simulated"); // 'simulated', 'connecting', 'success', 'error'

  // 날짜 포맷 헬퍼
  const formatDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 2. 컴포넌트 마운트 시 초기값 세팅 (localStorage 연동 & 기본 날짜 계산)
  useEffect(() => {
    setMounted(true);

    // Jira API 설정 로드
    const savedSettings = localStorage.getItem("workflow_jira_settings");
    let loadedApiMode = false;
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setJiraUrl(parsed.url || "");
        setJiraEmail(parsed.email || "");
        setJiraToken(parsed.token || "");
        setApiMode(parsed.apiMode || false);
        loadedApiMode = parsed.apiMode || false;
      } catch (e) {
        console.error("설정을 파싱하는 도중 에러가 발생했습니다.", e);
      }
    }

    // 팀원 설정 로드
    let loadedRegistered = ["홍길동", "김철수", "이영희"];
    const savedMembers = localStorage.getItem("workflow_registered_members");
    if (savedMembers) {
      try {
        loadedRegistered = JSON.parse(savedMembers);
        setRegisteredMembers(loadedRegistered);
      } catch (e) {
        console.error("등록된 팀원 목록을 파싱하는 도중 에러가 발생했습니다.", e);
        setRegisteredMembers(loadedRegistered);
      }
    } else {
      setRegisteredMembers(loadedRegistered);
      localStorage.setItem("workflow_registered_members", JSON.stringify(loadedRegistered));
    }

    // 필터 데이터 로드
    let loadedFilterMembers = "홍길동, 김철수, 이영희";
    const savedFilterMembers = localStorage.getItem("workflow_filter_members");
    if (savedFilterMembers !== null) {
      setTeamMembersFilter(savedFilterMembers);
      loadedFilterMembers = savedFilterMembers;
    }

    let loadedProjectKey = "DI26";
    const savedProjectKey = localStorage.getItem("workflow_project_key");
    if (savedProjectKey !== null) {
      setProjectKey(savedProjectKey);
      loadedProjectKey = savedProjectKey;
    }

    // 기본 날짜 구하기 (월요일 ~ 금요일)
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const distanceToFriday = currentDay === 0 ? -2 : 5 - currentDay;
    const friday = new Date(today);
    friday.setDate(today.getDate() + distanceToFriday);

    const startD = formatDateStr(monday);
    const endD = formatDateStr(friday);
    setDateStart(startD);
    setDateEnd(endD);

    // 연결 상태 텍스트 초기화
    if (loadedApiMode) {
      setConnectionStatus("success");
      setConnectionStatusText("Jira API 대기 중");
    } else {
      setConnectionStatus("simulated");
      setConnectionStatusText("시뮬레이션 모드 작동 중");
    }

    // 초기 Mock 데이터 생성
    if (!loadedApiMode) {
      const initialMembers = loadedFilterMembers.split(",").map(m => m.trim()).filter(m => m.length > 0);
      const mockTickets = generateMockTickets(loadedProjectKey, initialMembers, startD, endD);
      setFetchedTickets(mockTickets);
    }
  }, []);

  // 3. 상태 표준화 헬퍼 함수
  const getStatusCategory = (statusName) => {
    const status = (statusName || "").toLowerCase().trim();
    if (status.includes("done") || status.includes("resolved") || status.includes("완료") || status.includes("closed") || status.includes("성공")) {
      return "Done";
    }
    if (status.includes("progress") || status.includes("진행") || status.includes("doing") || status.includes("개발") || status.includes("selected") || status.includes("working")) {
      return "In Progress";
    }
    return "To Do";
  };

  // 4. 동적 JQL 빌더
  const jql = useMemo(() => {
    const members = teamMembersFilter.split(",").map(m => m.trim()).filter(m => m.length > 0);
    let query = `project = "${projectKey || "PROJ"}"`;
    
    if (members.length > 0) {
      const membersQuery = members.map(m => `"${m}"`).join(', ');
      query += ` AND assignee in (${membersQuery})`;
    }
    
    query += ` AND status in ("In Progress", "Done", "Resolved", "To Do")`;
    
    if (dateStart) {
      query += ` AND updated >= "${dateStart}"`;
    }
    if (dateEnd) {
      query += ` AND updated <= "${dateEnd} 23:59"`;
    }
    
    query += ` ORDER BY updated DESC`;
    return query;
  }, [projectKey, teamMembersFilter, dateStart, dateEnd]);

  // 5. 통계 및 분포 계산
  const stats = useMemo(() => {
    const total = fetchedTickets.length;
    const done = fetchedTickets.filter(t => getStatusCategory(t.status) === "Done").length;
    const progress = fetchedTickets.filter(t => getStatusCategory(t.status) === "In Progress").length;
    const todo = total - done - progress;

    const donePercent = total > 0 ? Math.round((done / total) * 100) : 0;
    const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;
    const todoPercent = total > 0 ? Math.round((todo / total) * 100) : 0;

    return { total, done, progress, todo, donePercent, progressPercent, todoPercent };
  }, [fetchedTickets]);

  // 6. 팀원 관리 비즈니스 로직
  const handleAddMember = () => {
    const name = newMember.trim();
    if (!name) {
      alert("추가할 팀원 이름을 입력해 주세요.");
      return;
    }
    if (registeredMembers.includes(name)) {
      alert("이미 등록된 팀원입니다.");
      return;
    }
    const updated = [...registeredMembers, name];
    setRegisteredMembers(updated);
    localStorage.setItem("workflow_registered_members", JSON.stringify(updated));
    setNewMember("");
  };

  const handleRemoveMember = (nameToRemove) => {
    const updated = registeredMembers.filter(m => m !== nameToRemove);
    setRegisteredMembers(updated);
    localStorage.setItem("workflow_registered_members", JSON.stringify(updated));
    
    // 필터 선택 항목에서도 제거 처리
    let activeMembers = teamMembersFilter.split(",").map(m => m.trim()).filter(m => m.length > 0);
    activeMembers = activeMembers.filter(m => m !== nameToRemove);
    const newFilterString = activeMembers.join(", ");
    setTeamMembersFilter(newFilterString);
    localStorage.setItem("workflow_filter_members", newFilterString);
  };

  const handleToggleChip = (name) => {
    let activeMembers = teamMembersFilter.split(",").map(m => m.trim()).filter(m => m.length > 0);
    if (activeMembers.includes(name)) {
      activeMembers = activeMembers.filter(m => m !== name);
    } else {
      activeMembers.push(name);
    }
    const newFilterString = activeMembers.join(", ");
    setTeamMembersFilter(newFilterString);
    localStorage.setItem("workflow_filter_members", newFilterString);
  };

  // 7. 설정 저장
  const handleSaveSettings = () => {
    const settings = {
      url: jiraUrl.trim(),
      email: jiraEmail.trim(),
      token: jiraToken.trim(),
      apiMode
    };
    localStorage.setItem("workflow_jira_settings", JSON.stringify(settings));
    alert("설정이 로컬 브라우저에 성공적으로 저장되었습니다.");
    
    if (apiMode) {
      setConnectionStatus("success");
      setConnectionStatusText("Jira API 대기 중");
    } else {
      setConnectionStatus("simulated");
      setConnectionStatusText("시뮬레이션 모드 작동 중");
    }
  };

  const handleApiModeChange = (e) => {
    const val = e.target.checked;
    setApiMode(val);
    const settings = {
      url: jiraUrl.trim(),
      email: jiraEmail.trim(),
      token: jiraToken.trim(),
      apiMode: val
    };
    localStorage.setItem("workflow_jira_settings", JSON.stringify(settings));
    
    if (val) {
      setConnectionStatus("success");
      setConnectionStatusText("Jira API 대기 중");
    } else {
      setConnectionStatus("simulated");
      setConnectionStatusText("시뮬레이션 모드 작동 중");
    }
  };

  // 8. Mock 데이터 생성기
  const generateMockTickets = (projKey, members, start, end) => {
    const dummyTaskPool = [
      "웹 대시보드 UI 컴포넌트 리팩토링 및 다크모드 대응",
      "Jira REST API 연동 및 JQL 파서 유틸리티 스크립트 작성",
      "일일Standup 업무 보고 마크다운 템플릿 렌더러 설계",
      "주간 업무 요약 SVG 대시보드 차트 컴포넌트 마크업",
      "Clipboard API 활용한 마크다운 클립보드 복사 로직 추가",
      "사용자 설정 패널 값 브라우저 localStorage 저장 로직 연동",
      "사용자 가이드(README.md) 및 CORS 프록시 예제 가이드 작성",
      "QA 버그 리포트: 스크롤 영역 잔상 버그 및 layout shift 현상 수정",
      "팀원 다중 선택 필터 UI 및 동적 쿼리 컴포저 성능 고도화",
      "보고서 템플릿 마크다운 텍스트 저장용 파일 Blob 생성기 구현",
      "기획서 기반 주요 기능 체크리스트 작성 및 task 관리 체계 마련",
      "CSS Nesting 최적화 및 CSS custom properties 토큰 설계 적용",
      "반응형 대응을 위한 @container 쿼리 선언 및 모바일 뷰 보완"
    ];

    const statusOptions = ["Done", "In Progress", "To Do"];
    const tickets = [];
    
    // 날짜 범위 리스트 생성
    const dateArray = [];
    let currentDate = new Date(start || new Date());
    const stopDate = new Date(end || new Date());
    while (currentDate <= stopDate) {
      dateArray.push(new Date(currentDate).toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    if (dateArray.length === 0) dateArray.push(new Date().toISOString().split("T")[0]);

    const targetMembers = members.length > 0 ? members : ["홍길동", "김철수", "이영희"];
    let keyCounter = 101;
    
    targetMembers.forEach((member) => {
      const ticketCount = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < ticketCount; i++) {
        const dummySummary = dummyTaskPool[Math.floor(Math.random() * dummyTaskPool.length)];
        const dummyStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];
        const dummyDate = dateArray[Math.floor(Math.random() * dateArray.length)];

        tickets.push({
          key: `${projKey || "PROJ"}-${keyCounter++}`,
          summary: `${member} - ${dummySummary}`,
          status: dummyStatus,
          assignee: member,
          updated: dummyDate
        });
      }
    });

    return tickets.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  };

  // 9. Jira API 호출 함수 (Next.js API route 프록시 호출)
  const fetchJiraTickets = async (jqlStr) => {
    if (!jiraUrl || !jiraEmail || !jiraToken) {
      alert("실제 API 모드를 사용하려면 Jira URL, 이메일, API Token 설정을 저장하셔야 합니다.\n현재 설정을 확인해주세요.");
      setApiMode(false);
      return;
    }

    setIsLoading(true);
    setConnectionStatus("connecting");
    setConnectionStatusText("Jira 연결 중...");

    const credential = btoa(`${jiraEmail}:${jiraToken}`);
    let cleanUrl = jiraUrl.trim();
    try {
      if (cleanUrl.toLowerCase().startsWith("http")) {
        const urlObj = new URL(cleanUrl);
        cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
    } catch (e) {
      console.warn("Jira URL 호스트 추출 실패, 원본 유지:", e);
    }

    let allIssues = [];
    let startAt = 0;
    let isLastPage = false;
    const limit = 100;

    try {
      while (!isLastPage) {
        const targetUrl = `${cleanUrl.replace(/\/$/, "")}/rest/api/3/search/jql?jql=${encodeURIComponent(jqlStr)}&fields=key,summary,status,assignee,updated&maxResults=${limit}&startAt=${startAt}`;
        // Next.js Route Handler로 요청 우회
        const apiEndpoint = `/api/jira?url=${encodeURIComponent(targetUrl)}`;
        
        console.log(`[Jira Fetch] Fetching page starting at ${startAt}...`);
        const response = await fetch(apiEndpoint, {
          method: "GET",
          headers: {
            "Authorization": `Basic ${credential}`,
            "Accept": "application/json",
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP 에러! 상태코드: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const textError = await response.text();
          console.warn("비JSON 응답 감지:", textError.substring(0, 300));
          throw new Error("Jira 서버가 JSON 대신 HTML 페이지를 반환했습니다. 이메일/토큰 정보가 잘못되었거나 URL 주소 형식이 올바르지 않습니다.");
        }

        const data = await response.json();
        const pageIssues = data.issues || [];
        allIssues = allIssues.concat(pageIssues);
        
        const totalCount = data.total || 0;
        setConnectionStatusText(`티켓 로드 중... (${allIssues.length}/${totalCount}건 완료)`);
        
        startAt += pageIssues.length;
        if (pageIssues.length === 0 || allIssues.length >= totalCount) {
          isLastPage = true;
        }
      }

      const tickets = allIssues.map(issue => ({
        key: issue.key || "",
        summary: issue.fields?.summary || "제목 없음",
        status: issue.fields?.status ? (issue.fields.status.name || "To Do") : "To Do",
        assignee: issue.fields?.assignee ? (issue.fields.assignee.displayName || issue.fields.assignee.name || "미정") : "미정",
        updated: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : ""
      }));

      setFetchedTickets(tickets);
      setConnectionStatus("success");
      setConnectionStatusText(`Jira API 연동 완료 (총 ${tickets.length}건)`);
    } catch (err) {
      console.error("Jira API fetch error:", err);
      alert(`[Jira API 연동 실패]\n서버 응답 오류 혹은 설정값 오류가 발생했습니다.\n\n오류 내용: ${err.message}\n\n입력하신 Jira URL, 이메일, API Token이 정확한지 다시 한번 확인해주세요.`);
      setConnectionStatus("error");
      setConnectionStatusText(`연동 실패 (${err.message})`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchTickets = (e) => {
    if (e) e.preventDefault();
    
    // 로컬 스토리지에 프로젝트 키 및 멤버 필터 값 저장
    localStorage.setItem("workflow_project_key", projectKey);
    localStorage.setItem("workflow_filter_members", teamMembersFilter);

    const members = teamMembersFilter.split(",").map(m => m.trim()).filter(m => m.length > 0);

    if (apiMode) {
      fetchJiraTickets(jql);
    } else {
      setIsLoading(true);
      setConnectionStatus("simulated");
      setConnectionStatusText("시뮬레이션 데이터 생성 중...");
      
      setTimeout(() => {
        const mockTickets = generateMockTickets(projectKey, members, dateStart, dateEnd);
        setFetchedTickets(mockTickets);
        setIsLoading(false);
        setConnectionStatusText(`시뮬레이션 모드 작동 중 (총 ${mockTickets.length}건)`);
      }, 500);
    }
  };

  // 10. 마크다운 생성기 & 간이 파서
  const dailyReportMarkdown = useMemo(() => {
    if (fetchedTickets.length === 0) return "조건에 맞는 티켓이 존재하지 않습니다.";

    let md = `# 📅 일일 업무 STAND-UP 보고서\n\n`;
    md += `> **보고 기간**: ${dateStart} ~ ${dateEnd}\n`;
    md += `> **생성 일시**: ${new Date().toLocaleString("ko-KR")}\n\n`;
    
    const assignees = [...new Set(fetchedTickets.map(t => t.assignee))];
    
    assignees.forEach(member => {
      md += `## 👤 담당자: ${member}\n\n`;
      
      const memberTickets = fetchedTickets.filter(t => t.assignee === member);
      const completed = memberTickets.filter(t => getStatusCategory(t.status) === "Done");
      const progressing = memberTickets.filter(t => getStatusCategory(t.status) === "In Progress");
      const todos = memberTickets.filter(t => getStatusCategory(t.status) === "To Do");

      md += `### 🟢 오늘 완료한 업무 (Done)\n`;
      if (completed.length === 0) {
        md += `- 완료된 업무가 없습니다.\n`;
      } else {
        completed.forEach(t => {
          md += `- [${t.key}] ${t.summary} (업데이트: ${t.updated})\n`;
        });
      }
      md += `\n`;

      md += `### 🔵 현재 진행 중인 업무 (In Progress)\n`;
      if (progressing.length === 0) {
        md += `- 진행 중인 업무가 없습니다.\n`;
      } else {
        progressing.forEach(t => {
          md += `- [${t.key}] ${t.summary}\n`;
        });
      }
      md += `\n`;

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

    return md;
  }, [fetchedTickets, dateStart, dateEnd]);

  const weeklyReportMarkdown = useMemo(() => {
    if (fetchedTickets.length === 0) return "조건에 맞는 티켓이 존재하지 않습니다.";

    const total = fetchedTickets.length;
    const completedCount = fetchedTickets.filter(t => getStatusCategory(t.status) === "Done").length;
    const progressingCount = fetchedTickets.filter(t => getStatusCategory(t.status) === "In Progress").length;
    const todoCount = total - completedCount - progressingCount;

    let md = `# 📊 주간 프로젝트 업무 보고서\n\n`;
    md += `## 🗓️ 1. 보고서 요약 개요\n\n`;
    md += `* **작성 일자**: ${new Date().toLocaleDateString("ko-KR")}\n`;
    md += `* **대상 기간**: ${dateStart} ~ ${dateEnd}\n`;
    md += `* **프로젝트 코드**: \`${projectKey}\`\n\n`;
    
    md += `### 📈 2. 이번 주 진행 상태 메트릭스\n\n`;
    md += `| 티켓 상태 | 건수 | 완료율 / 비율 |\n`;
    md += `| :--- | :---: | :---: |\n`;
    md += `| **완료 (Done/Resolved)** | ${completedCount}건 | ${total > 0 ? Math.round((completedCount/total)*100) : 0}% |\n`;
    md += `| **진행 중 (In Progress)** | ${progressingCount}건 | ${total > 0 ? Math.round((progressingCount/total)*100) : 0}% |\n`;
    md += `| **대기 중 (To Do)** | ${todoCount}건 | ${total > 0 ? Math.round((todoCount/total)*100) : 0}% |\n`;
    md += `| **합계 (Total)** | **${total}건** | **100%** |\n\n`;

    md += `## 📋 3. 팀원별 상세 업무 진행 현황\n\n`;
    
    const assignees = [...new Set(fetchedTickets.map(t => t.assignee))];
    assignees.forEach(member => {
      md += `### 👤 담당자: ${member}\n`;
      const memberTickets = fetchedTickets.filter(t => t.assignee === member);
      
      if (memberTickets.length === 0) {
        md += `* 진행한 티켓이 없습니다.\n`;
      } else {
        memberTickets.forEach(t => {
          const cat = getStatusCategory(t.status);
          const statusIndicator = (cat === "Done") ? "✅" : 
                                  (cat === "In Progress") ? "🔄" : "⏱️";
          md += `* ${statusIndicator} **[${t.key}]** ${t.summary} (\`${t.status}\`, 업데이트: ${t.updated})\n`;
        });
      }
      md += `\n`;
    });

    md += `## 🚀 4. 다음 주 주요 계획 및 이슈 사항\n\n`;
    md += `* **마일스톤 점검**: 예정된 티켓 중 우선순위가 높은 이슈에 대한 우선 개발 진행.\n`;
    md += `* **장애 요인**: 시뮬레이션 및 API 연결 환경 설정 시 CORS 발생 우려에 대비해 로컬 노드 프록시 준비 권장.\n`;

    return md;
  }, [fetchedTickets, dateStart, dateEnd, projectKey]);

  // 간이 마크다운 파서
  const parseMarkdownToHtml = (markdown) => {
    if (!markdown) return "";
    let html = markdown;

    // 1. 헤더 변환 (H1, H2, H3)
    html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");

    // 2. 인용구 blockquote 변환
    html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");

    // 3. 인라인 코드 및 백틱 강조
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 4. 볼드체 변환
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // 5. 구분선 변환
    html = html.replace(/^---$/gm, "<hr>");

    // 6. 테이블 변환
    const lines = html.split("\n");
    let inTable = false;
    let tableHtml = "";
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("|") && line.endsWith("|")) {
        if (!inTable) {
          inTable = true;
          tableHtml = "<table>";
        }
        
        // 헤더 구분선 무시
        if (line.includes("---")) {
          lines[i] = "";
          continue;
        }

        const cols = line.split("|").map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        const tag = tableHtml.includes("<th>") ? "td" : "th";
        
        tableHtml += "<tr>";
        cols.forEach(col => {
          tableHtml += `<${tag}>${col}</${tag}>`;
        });
        tableHtml += "</tr>";
        
        lines[i] = "";
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += "</table>";
          lines[i] = tableHtml + "\n" + lines[i];
        }
      }
    }
    html = lines.join("\n");

    // 7. 리스트 변환 (순서 없는 리스트)
    html = html.replace(/^\*\s+(.+)$/gm, "<ul><li>$1</li></ul>");
    html = html.replace(/^-\s+(.+)$/gm, "<ul><li>$1</li></ul>");
    // 연속된 <ul> 태그 래핑 정리
    html = html.replace(/<\/ul>\s*<ul>/g, "");

    // 8. 줄바꿈 단락 변환
    html = html.split("\n").map(line => {
      const trimmed = line.trim();
      if (trimmed === "") return "";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<li") || trimmed.startsWith("<tr") || trimmed.startsWith("<td") || trimmed.startsWith("<th") || trimmed.startsWith("<table") || trimmed.startsWith("<hr") || trimmed.startsWith("<blockquote>")) {
        return line;
      }
      return `<p>${line}</p>`;
    }).join("\n");

    return html;
  };

  const dailyReportHtml = useMemo(() => parseMarkdownToHtml(dailyReportMarkdown), [dailyReportMarkdown]);
  const weeklyReportHtml = useMemo(() => parseMarkdownToHtml(weeklyReportMarkdown), [weeklyReportMarkdown]);

  // 11. 클립보드 복사 및 다운로드 액션
  const handleCopyReport = () => {
    let reportText = "";
    if (activeTab === "tab-daily") {
      reportText = dailyReportMarkdown;
    } else if (activeTab === "tab-weekly") {
      reportText = weeklyReportMarkdown;
    } else {
      alert("복사할 마크다운 보고서가 없습니다. 일일 또는 주간 탭을 선택해주세요.");
      return;
    }

    if (!reportText || fetchedTickets.length === 0) {
      alert("생성된 보고서 내용이 없습니다.");
      return;
    }

    navigator.clipboard.writeText(reportText)
      .then(() => {
        alert("업무 보고서 마크다운이 클립보드에 복사되었습니다.");
      })
      .catch(err => {
        console.error("클립보드 복사 실패:", err);
        alert("클립보드 복사 중 오류가 발생했습니다.");
      });
  };

  const handleDownloadReport = () => {
    let reportText = "";
    let filename = "";
    
    if (activeTab === "tab-daily") {
      reportText = dailyReportMarkdown;
      filename = `Daily_Report_${dateStart}_to_${dateEnd}.md`;
    } else if (activeTab === "tab-weekly") {
      reportText = weeklyReportMarkdown;
      filename = `Weekly_Report_${dateStart}_to_${dateEnd}.md`;
    } else {
      alert("다운로드할 업무 보고서가 없습니다. 일일 또는 주간 탭을 선택해주세요.");
      return;
    }

    if (!reportText || fetchedTickets.length === 0) {
      alert("다운로드할 내용이 없습니다.");
      return;
    }

    const blob = new Blob([reportText], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.href = url;
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyJql = () => {
    navigator.clipboard.writeText(jql)
      .then(() => {
        alert("JQL 쿼리가 클립보드에 복사되었습니다.");
      })
      .catch(err => {
        alert("클립보드 복사에 실패했습니다.");
      });
  };

  // SSR 방지
  if (!mounted) {
    return null;
  }

  return (
    <div className="app-container">
      {/* 사이드바 / 설정 패널 */}
      <aside className="sidebar">
        <div className="brand">
          <svg className="brand-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h1>Workflow</h1>
          <span className="badge">NEXT.JS SaaS</span>
        </div>

        <nav className="settings-panel">
          <h2>Jira API 설정</h2>
          <div className="setting-group">
            <label htmlFor="jira-url">Jira URL</label>
            <input 
              type="url" 
              id="jira-url" 
              placeholder="https://your-domain.atlassian.net" 
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="jira-email">이메일</label>
            <input 
              type="email" 
              id="jira-email" 
              placeholder="user@company.com" 
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label htmlFor="jira-token">API Token</label>
            <input 
              type="password" 
              id="jira-token" 
              placeholder="ATATT..." 
              value={jiraToken}
              onChange={(e) => setJiraToken(e.target.value)}
            />
          </div>

          <div className="mode-switch-container">
            <span className="mode-label">API 모드 활성화</span>
            <label className="switch" id="mode-toggle-label">
              <input 
                type="checkbox" 
                id="mode-toggle"
                checked={apiMode}
                onChange={handleApiModeChange}
              />
              <span className="slider"></span>
            </label>
          </div>
          <p className="mode-desc">비활성화 시 데모용 Mock 데이터가 로드됩니다.</p>
          <button type="button" id="save-settings" className="btn btn-secondary" onClick={handleSaveSettings}>설정 저장</button>
          
          <hr className="panel-divider" />
          
          <h2>팀원 관리</h2>
          <div className="setting-group">
            <label htmlFor="new-member">팀원 추가</label>
            <div className="input-with-action">
              <input 
                type="text" 
                id="new-member" 
                placeholder="이름 또는 ID 입력"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddMember()}
              />
              <button type="button" id="btn-add-member" className="btn btn-primary btn-sm" onClick={handleAddMember}>추가</button>
            </div>
          </div>
          <div className="setting-group">
            <label>등록된 팀원 목록</label>
            <ul id="registered-member-list" className="member-list">
              {registeredMembers.map((member) => (
                <li className="member-list-item" key={member}>
                  <span>{member}</span>
                  <button type="button" className="btn-remove-member" onClick={() => handleRemoveMember(member)}>&times;</button>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        
        <div className="footer-info">
          <p>© 2026 Workflow Inc.</p>
          <p>Jira Report Generator (Next.js)</p>
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
              <span 
                className="indicator-dot active" 
                id="connection-status-dot"
                style={{ 
                  backgroundColor: connectionStatus === "success" ? "var(--color-success)" :
                                   connectionStatus === "connecting" ? "var(--color-warning)" :
                                   connectionStatus === "error" ? "var(--color-danger)" : "var(--color-accent)"
                }}
              ></span>
              <span id="connection-status-text">{connectionStatusText}</span>
            </div>
          </div>
        </header>

        {/* 필터 설정 섹션 */}
        <section className="filter-section card">
          <div className="section-header">
            <h3>티켓 필터 조건 설정</h3>
          </div>
          <form id="filter-form" className="filter-grid" onSubmit={handleFetchTickets}>
            <div className="form-group">
              <label htmlFor="project-key">프로젝트 키</label>
              <input 
                type="text" 
                id="project-key" 
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                placeholder="예: PROJ, DEVEL"
              />
            </div>
            <div className="form-group team-input-group">
              <label htmlFor="team-members">대상 팀원 (이름/ID)</label>
              <input 
                type="text" 
                id="team-members" 
                value={teamMembersFilter}
                onChange={(e) => setTeamMembersFilter(e.target.value)}
                placeholder="쉼표(,)로 구분 (예: 김철수, 이영희)"
              />
              <div id="team-member-chips" className="member-chips-wrapper">
                {registeredMembers.map(member => {
                  const isActive = teamMembersFilter.split(",").map(m => m.trim()).includes(member);
                  return (
                    <div 
                      key={member}
                      className={`member-chip ${isActive ? "active" : ""}`}
                      onClick={() => handleToggleChip(member)}
                    >
                      {member}
                    </div>
                  );
                })}
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
              <button type="submit" id="btn-fetch" className="btn btn-primary" disabled={isLoading}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isLoading ? "불러오는 중..." : "티켓 가져오기"}
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
                  id="chart-pie" 
                  style={{
                    "--p-done": `${stats.donePercent}%`,
                    "--p-progress": `${stats.progressPercent}%`
                  }}
                ></div>
                <div className="chart-legend" id="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color done"></span>
                    <span>완료: {stats.donePercent}% ({stats.done}건)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color progress"></span>
                    <span>진행 중: {stats.progressPercent}% ({stats.progress}건)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color todo"></span>
                    <span>대기 중: {stats.todoPercent}% ({stats.todo}건)</span>
                  </div>
                </div>
              </div>
              <div className="stats-numeric-grid">
                <div className="stat-card done">
                  <span className="stat-label">완료 (Done)</span>
                  <span className="stat-value" id="count-done">{stats.done}</span>
                </div>
                <div className="stat-card in-progress">
                  <span className="stat-label">진행 중 (In Progress)</span>
                  <span className="stat-value" id="count-progress">{stats.progress}</span>
                </div>
                <div className="stat-card total">
                  <span className="stat-label">전체 티켓</span>
                  <span className="stat-value" id="count-total">{stats.total}</span>
                </div>
              </div>
            </div>
          </section>

          {/* JQL 프리뷰 카드 */}
          <section className="jql-section card">
            <div className="section-header">
              <h3>생성된 Jira JQL 쿼리</h3>
              <button type="button" className="btn-text-copy" id="btn-copy-jql" onClick={handleCopyJql}>JQL 복사</button>
            </div>
            <div className="jql-body">
              <code id="jql-code">{jql}</code>
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
                className={`tab-btn ${activeTab === "tab-daily" ? "active" : ""}`} 
                onClick={() => setActiveTab("tab-daily")}
              >
                일일 업무 보고서
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === "tab-weekly" ? "active" : ""}`} 
                onClick={() => setActiveTab("tab-weekly")}
              >
                주간 업무 보고서
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === "tab-raw" ? "active" : ""}`} 
                onClick={() => setActiveTab("tab-raw")}
              >
                조회된 티켓 목록
              </button>
            </div>
            <div className="tab-actions">
              <button type="button" className="btn btn-secondary btn-sm" id="btn-copy-report" onClick={handleCopyReport}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                마크다운 복사
              </button>
              <button type="button" className="btn btn-primary btn-sm" id="btn-download-report" onClick={handleDownloadReport}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                다운로드 (.md)
              </button>
            </div>
          </div>

          <div className="tab-content-container">
            {/* 일일 업무 보고 탭 */}
            <div className={`tab-content ${activeTab === "tab-daily" ? "active" : ""}`} id="tab-daily">
              <div className="report-editor-container">
                <div 
                  className="markdown-preview" 
                  id="daily-preview"
                  dangerouslySetInnerHTML={{ __html: dailyReportHtml }}
                ></div>
              </div>
            </div>

            {/* 주간 업무 보고 탭 */}
            <div className={`tab-content ${activeTab === "tab-weekly" ? "active" : ""}`} id="tab-weekly">
              <div className="report-editor-container">
                <div 
                  className="markdown-preview" 
                  id="weekly-preview"
                  dangerouslySetInnerHTML={{ __html: weeklyReportHtml }}
                ></div>
              </div>
            </div>

            {/* 원시 티켓 목록 탭 */}
            <div className={`tab-content ${activeTab === "tab-raw" ? "active" : ""}`} id="tab-raw">
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
                  <tbody id="ticket-table-body">
                    {fetchedTickets.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          조건에 맞는 티켓이 존재하지 않습니다.
                        </td>
                      </tr>
                    ) : (
                      fetchedTickets.map(ticket => {
                        const category = getStatusCategory(ticket.status);
                        let statusClass = "todo";
                        if (category === "Done") statusClass = "done";
                        if (category === "In Progress") statusClass = "progress";

                        return (
                          <tr key={ticket.key}>
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
