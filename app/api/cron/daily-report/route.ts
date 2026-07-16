import { NextResponse } from 'next/server'
import dayjs from 'dayjs'
import prisma from '@/lib/prisma'
import {
  JqlQueryBuilder,
  DailyReportStrategy,
  ReportContext
} from '../../../utils/jira'
import { createConfluencePage } from '../../../utils/confluence'

/**
 * Vercel Cron Job - 멀티 테넌트 일일 Confluence 보고서 자동 등록
 * 
 * 스케줄: 모든 활성화된 워크스페이스의 Cron Job 실행
 * Path: /api/cron/daily-report
 * 
 * ⚠️ 중요: 이 엔드포인트는 모든 사용자의 일일 보고서를 순회하며 생성합니다.
 */

// Jira에서 티켓 조회
async function fetchJiraTickets(jql: string, jiraUrl: string, email: string, apiToken: string) {
  const searchUrl = `${jiraUrl.replace(/\/$/, '')}/rest/api/3/search`
  const credential = Buffer.from(`${email}:${apiToken}`).toString('base64')

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
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Jira API 오류 (${response.status}): ${errText}`)
  }

  const data = await response.json()
  
  return (data.issues || []).map((issue: any) => ({
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
  }))
}

// Google Calendar에서 연차 정보 조회
async function fetchCalendarEvents(
  calendarId: string,
  start: string,
  end: string,
  accessToken: string,
  refreshToken: string | null,
  clientId: string | null,
  clientSecret: string | null
) {
  if (!calendarId || !accessToken) {
    return []
  }

  const timeMin = `${start}T00:00:00.000Z`
  const timeMax = `${end}T23:59:59.000Z`

  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

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
    })

    if (!response.ok) {
      console.warn('[Cron] Calendar API 조회 실패:', response.status)
      return []
    }

    const data = await response.json()
    return data.items || []
  } catch (err: any) {
    console.warn('[Cron] Calendar 조회 중 에러 (무시하고 계속):', err.message)
    return []
  }
}

// 단일 워크스페이스의 일일 보고서 생성 및 등록
async function processWorkspaceDailyReport(workspace: any, config: any, cronJob: any) {
  const today = dayjs().format('YYYY-MM-DD')
  const startOfWeek = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD')
  const endOfWeek = dayjs().endOf('week').subtract(1, 'day').format('YYYY-MM-DD')

  console.log(`[Cron] 워크스페이스 처리 시작: ${workspace.name} (${workspace.id})`)

  // JQL 쿼리 생성
  const jql = new JqlQueryBuilder()
    .setProject(config.projectKey)
    .setAssignees(config.teamMembers)
    .setDateRange(startOfWeek, endOfWeek, 'updated')
    .build()

  console.log(`[Cron] JQL: ${jql}`)

  // Jira 티켓 조회
  const tickets = await fetchJiraTickets(
    jql,
    config.jiraUrl,
    config.jiraEmail,
    config.jiraToken
  )

  console.log(`[Cron] Jira 티켓 조회 완료: ${tickets.length}건`)

  // Calendar 연차 정보 조회 (선택사항)
  let calendarEvents: any[] = []
  if (config.calendarId && config.calendarAccessToken) {
    calendarEvents = await fetchCalendarEvents(
      config.calendarId,
      today,
      today,
      config.calendarAccessToken,
      config.calendarRefreshToken,
      config.calendarClientId,
      config.calendarClientSecret
    )
    console.log(`[Cron] Calendar 이벤트 조회 완료: ${calendarEvents.length}건`)
  }

  // 등록된 팀원 목록
  const teamMembers = config.teamMembers.split(',').map((m: string) => m.trim())

  // 일일 보고서 생성
  const reportStrategy = new DailyReportStrategy()
  const reportContext = new ReportContext(reportStrategy)

  const reportParams = {
    currList: tickets,
    nextList: [],
    start: today,
    end: today,
    proj: config.projectKey,
    rawEvents: calendarEvents,
    targetRegs: teamMembers,
    jiraUrl: config.jiraUrl
  }

  const reportMarkdown = reportContext.generate(reportParams)
  console.log(`[Cron] 일일 보고서 생성 완료`)

  // Confluence에 페이지 생성
  const todayStr = dayjs().format('YYYY.MM.DD')
  const reportTitle = `📅 [일일업무] ${todayStr}`

  const result = await createConfluencePage({
    confluenceUrl: config.jiraUrl,
    email: config.jiraEmail,
    apiToken: config.jiraToken,
    spaceKey: config.confluenceSpace,
    title: reportTitle,
    content: reportMarkdown,
    parentId: config.confluenceParentId
  })

  console.log(`[Cron] Confluence 페이지 생성 완료: ${result.link}`)

  // Cron Job 실행 이력 저장
  await prisma.cronExecution.create({
    data: {
      cronJobId: cronJob.id,
      status: 'success',
      finishedAt: new Date(),
      duration: 0, // 필요시 계산
      result: {
        pageId: result.id,
        pageTitle: result.title,
        pageLink: result.link,
        ticketsProcessed: tickets.length,
        calendarEventsProcessed: calendarEvents.length
      }
    }
  })

  // Cron Job 상태 업데이트
  await prisma.cronJob.update({
    where: { id: cronJob.id },
    data: {
      lastRun: new Date(),
      status: 'success',
      lastError: null
    }
  })

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    pageId: result.id,
    pageTitle: result.title,
    pageLink: result.link,
    ticketsProcessed: tickets.length,
    calendarEventsProcessed: calendarEvents.length
  }
}

export async function GET(request: Request) {
  console.log('[Cron] 멀티 테넌트 일일 보고서 자동 생성 시작:', new Date().toISOString())

  // CRON_SECRET이 설정되어 있으면 보안 검증
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] 인증 실패: 잘못된 Authorization 헤더')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    // 활성화된 일일 Cron Job 조회
    const activeCronJobs = await prisma.cronJob.findMany({
      where: {
        enabled: true,
        type: 'daily'
      },
      include: {
        workspace: {
          include: {
            jiraConfig: true
          }
        }
      }
    })

    console.log(`[Cron] 활성화된 일일 Cron Job: ${activeCronJobs.length}개`)

    if (activeCronJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: '실행할 Cron Job이 없습니다',
        executedAt: new Date().toISOString()
      })
    }

    const results: any[] = []
    const errors: any[] = []

    // 각 워크스페이스별로 순회하며 보고서 생성
    for (const cronJob of activeCronJobs) {
      const { workspace } = cronJob

      if (!workspace.jiraConfig) {
        console.warn(`[Cron] 워크스페이스 ${workspace.id}의 Jira 설정이 없습니다. 스킵.`)
        errors.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          error: 'Jira 설정이 없습니다'
        })
        continue
      }

      try {
        const result = await processWorkspaceDailyReport(workspace, workspace.jiraConfig, cronJob)
        results.push(result)
      } catch (error: any) {
        console.error(`[Cron] 워크스페이스 ${workspace.id} 처리 실패:`, error)
        
        // 실패 이력 저장
        await prisma.cronExecution.create({
          data: {
            cronJobId: cronJob.id,
            status: 'failed',
            finishedAt: new Date(),
            error: error.message
          }
        })

        await prisma.cronJob.update({
          where: { id: cronJob.id },
          data: {
            status: 'failed',
            lastError: error.message
          }
        })

        errors.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          error: error.message
        })
      }
    }

    console.log('[Cron] 멀티 테넌트 일일 보고서 생성 완료')

    return NextResponse.json({
      success: true,
      message: '멀티 테넌트 일일 보고서가 완료되었습니다',
      totalJobs: activeCronJobs.length,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
      executedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[Cron] 멀티 테넌트 일일 보고서 생성 실패:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        executedAt: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// 수동 테스트를 위해 POST도 허용
export async function POST(request: Request) {
  return GET(request)
}
