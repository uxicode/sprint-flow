import { NextResponse } from 'next/server';
import dayjs from 'dayjs';
import {
  JqlQueryBuilder,
  DailyReportStrategy,
  ReportContext,
  getVacationMembers
} from '../../../utils/jira';
import { createConfluencePage } from '../../../utils/confluence';

/**
 * Vercel Cron Job - 일일 Confluence 보고서 자동 등록
 * 
 * 스케줄: 매일 평일(월-금) 오전 9시 (UTC 기준 0시)
 * Path: /api/cron/daily-report
 * 
 * 환경 변수 필요:
 * - JIRA_URL: Jira URL
 * - JIRA_EMAIL: Jira 이메일
 * - JIRA_API_TOKEN: Jira API Token
 * - CONFLUENCE_SPACE: Confluence Space Key
 * - CONFLUENCE_PARENT_ID: Confluence 부모 페이지 ID (선택)
 * - PROJECT_KEY: 프로젝트 키 (예: DI26)
 * - TEAM_MEMBERS: 팀원 이름 (쉼표 구분, 예: 홍길동,김철수,이영희)
 * - CRON_SECRET: Cron Job 보안 키 (선택)
 */

// Jira에서 티켓 조회
async function fetchJiraTickets(jql, jiraUrl, email, apiToken) {
  const searchUrl = `${jiraUrl.replace(/\/$/, '')}/rest/api/3/search`;
  const credential = Buffer.from(`${email}:${apiToken}`).toString('base64');

  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credential}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql,
      maxResults: 1000,
      fields: ['summary', 'status', 'assignee', 'updated', 'created', 'duedate', 'parent']
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Jira API 오류 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  
  return (data.issues || []).map(issue => ({
    key: issue.key,
    summary: issue.fields.summary || '',
    status: issue.fields.status?.name || 'Unknown',
    assignee: issue.fields.assignee?.displayName || 'Unassigned',
    updated: issue.fields.updated ? dayjs(issue.fields.updated).format('YYYY-MM-DD') : '',
    created: issue.fields.created ? dayjs(issue.fields.created).format('YYYY-MM-DD') : '',
    duedate: issue.fields.duedate || '',
    epic: issue.fields.parent ? {
      key: issue.fields.parent.key,
      summary: issue.fields.parent.fields?.summary || ''
    } : null
  }));
}

// Google Calendar에서 연차 정보 조회 (OAuth 2.0)
async function fetchCalendarEvents(calendarId, start, end, accessToken, refreshToken, clientId, clientSecret) {
  if (!calendarId || !accessToken) {
    console.log('[Cron] Calendar 정보 없음 - 연차 조회 스킵');
    return [];
  }

  const timeMin = `${start}T00:00:00.000Z`;
  const timeMax = `${end}T23:59:59.000Z`;

  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'events',
        accessToken,
        refreshToken,
        clientId,
        clientSecret,
        calendarId,
        timeMin,
        timeMax,
      }),
    });

    if (!response.ok) {
      console.warn('[Cron] Calendar API 조회 실패:', response.status);
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (err) {
    console.warn('[Cron] Calendar 조회 중 에러 (무시하고 계속):', err.message);
    return [];
  }
}

export async function GET(request) {
  console.log('[Cron] 일일 보고서 자동 생성 시작:', new Date().toISOString());

  // CRON_SECRET이 설정되어 있으면 보안 검증
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] 인증 실패: 잘못된 Authorization 헤더');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // 환경 변수 검증
  const requiredEnvVars = {
    JIRA_URL: process.env.JIRA_URL,
    JIRA_EMAIL: process.env.JIRA_EMAIL,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
    CONFLUENCE_SPACE: process.env.CONFLUENCE_SPACE,
    PROJECT_KEY: process.env.PROJECT_KEY,
    TEAM_MEMBERS: process.env.TEAM_MEMBERS
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  if (missingVars.length > 0) {
    console.error('[Cron] 환경 변수 누락:', missingVars.join(', '));
    return NextResponse.json(
      { 
        error: '필수 환경 변수가 설정되지 않았습니다',
        missing: missingVars
      },
      { status: 500 }
    );
  }

  try {
    // 오늘 날짜 기준으로 조회 (평일만 실행되므로 오늘 = 업무일)
    const today = dayjs().format('YYYY-MM-DD');
    const startOfWeek = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'); // 월요일
    const endOfWeek = dayjs().endOf('week').subtract(1, 'day').format('YYYY-MM-DD'); // 금요일

    console.log('[Cron] 조회 기간:', today);

    // JQL 쿼리 생성 (오늘 업데이트되었거나 기한인 티켓)
    const jql = new JqlQueryBuilder()
      .setProject(process.env.PROJECT_KEY)
      .setAssignees(process.env.TEAM_MEMBERS)
      .setDateRange(startOfWeek, endOfWeek, 'updated')
      .build();

    console.log('[Cron] JQL:', jql);

    // Jira 티켓 조회
    const tickets = await fetchJiraTickets(
      jql,
      process.env.JIRA_URL,
      process.env.JIRA_EMAIL,
      process.env.JIRA_API_TOKEN
    );

    console.log('[Cron] Jira 티켓 조회 완료:', tickets.length, '건');

    // Calendar 연차 정보 조회 (선택사항)
    let calendarEvents = [];
    if (process.env.CALENDAR_ID && process.env.CALENDAR_ACCESS_TOKEN) {
      calendarEvents = await fetchCalendarEvents(
        process.env.CALENDAR_ID,
        today,
        today,
        process.env.CALENDAR_ACCESS_TOKEN,
        process.env.CALENDAR_REFRESH_TOKEN,
        process.env.CALENDAR_CLIENT_ID,
        process.env.CALENDAR_CLIENT_SECRET
      );
      console.log('[Cron] Calendar 이벤트 조회 완료:', calendarEvents.length, '건');
    }

    // 등록된 팀원 목록
    const teamMembers = process.env.TEAM_MEMBERS.split(',').map(m => m.trim());

    // 일일 보고서 생성
    const reportStrategy = new DailyReportStrategy();
    const reportContext = new ReportContext(reportStrategy);

    const reportParams = {
      currList: tickets,
      nextList: [], // 일일 보고서는 다음 계획 불필요
      start: today,
      end: today,
      proj: process.env.PROJECT_KEY,
      rawEvents: calendarEvents,
      targetRegs: teamMembers,
      jiraUrl: process.env.JIRA_URL
    };

    const reportMarkdown = reportContext.generate(reportParams);
    console.log('[Cron] 일일 보고서 생성 완료');

    // Confluence에 페이지 생성
    const todayStr = dayjs().format('YYYY.MM.DD');
    const reportTitle = `📅 [일일업무] ${todayStr}`;

    const result = await createConfluencePage({
      confluenceUrl: process.env.JIRA_URL, // Jira와 동일한 도메인 사용
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
      spaceKey: process.env.CONFLUENCE_SPACE,
      title: reportTitle,
      content: reportMarkdown,
      parentId: process.env.CONFLUENCE_PARENT_ID
    });

    console.log('[Cron] Confluence 페이지 생성 완료:', result.link);

    return NextResponse.json({
      success: true,
      message: '일일 보고서가 성공적으로 Confluence에 등록되었습니다',
      pageId: result.id,
      pageTitle: result.title,
      pageLink: result.link,
      ticketsProcessed: tickets.length,
      calendarEventsProcessed: calendarEvents.length,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Cron] 일일 보고서 생성 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        executedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Vercel Cron은 GET 요청만 지원하지만, 수동 테스트를 위해 POST도 허용
export async function POST(request) {
  return GET(request);
}
