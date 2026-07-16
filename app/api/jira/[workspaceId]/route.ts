import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyWorkspaceOwnership, trackApiUsage } from '@/lib/middleware'

/**
 * GET /api/jira/[workspaceId]
 * 워크스페이스별 Jira API 프록시 (멀티 테넌트 지원)
 * 
 * 사용자는 자신이 소유한 워크스페이스의 설정만 사용할 수 있습니다.
 */
export async function GET(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    // 1. 사용자 인증 확인
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    // 2. 워크스페이스 소유권 확인
    const { workspaceId } = params
    const workspace = await verifyWorkspaceOwnership(workspaceId, session.user.id)

    if (!workspace.jiraConfig) {
      return NextResponse.json(
        { error: 'Jira 설정이 없습니다. 먼저 설정을 완료해주세요.' },
        { status: 400 }
      )
    }

    // 3. API 사용량 추적
    await trackApiUsage(workspaceId, 'jira_api_call')

    // 4. Jira API 호출
    const { searchParams } = new URL(request.url)
    const targetUrlStr = searchParams.get('url')

    if (!targetUrlStr) {
      return NextResponse.json(
        { error: 'Missing "url" query parameter' },
        { status: 400 }
      )
    }

    const targetUrl = new URL(targetUrlStr)

    // 워크스페이스의 Jira 인증 정보 사용
    const config = workspace.jiraConfig
    const credential = Buffer.from(`${config.jiraEmail}:${config.jiraToken}`).toString('base64')

    const headers = new Headers()
    headers.set('Accept', 'application/json')
    headers.set('Content-Type', 'application/json')
    headers.set('Authorization', `Basic ${credential}`)

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: headers
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Jira Proxy Error]', response.status, errText)
      return NextResponse.json(
        { error: `Jira API Error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('[Jira Proxy Error]', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
