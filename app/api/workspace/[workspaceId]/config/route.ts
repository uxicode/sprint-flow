import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/workspace/[workspaceId]/config
 * 워크스페이스의 Jira/Confluence 설정 조회
 */
export async function GET(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const { workspaceId } = params

    // 워크스페이스 소유권 확인
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: session.user.id
      },
      include: {
        jiraConfig: true
      }
    })

    if (!workspace) {
      return NextResponse.json(
        { error: '워크스페이스를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({ config: workspace.jiraConfig })

  } catch (error: any) {
    console.error('[Config GET Error]', error)
    return NextResponse.json(
      { error: '설정 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workspace/[workspaceId]/config
 * Jira/Confluence 설정 생성 또는 업데이트
 */
export async function POST(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const { workspaceId } = params
    const body = await request.json()

    // 워크스페이스 소유권 확인
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: session.user.id
      }
    })

    if (!workspace) {
      return NextResponse.json(
        { error: '워크스페이스를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 필수 필드 검증
    const {
      jiraUrl,
      jiraEmail,
      jiraToken,
      confluenceSpace,
      confluenceParentId,
      projectKey,
      teamMembers,
      calendarId,
      calendarClientId,
      calendarClientSecret,
      calendarAccessToken,
      calendarRefreshToken,
      calendarTokenExpiry
    } = body

    if (!jiraUrl || !jiraEmail || !jiraToken || !confluenceSpace || !projectKey || !teamMembers) {
      return NextResponse.json(
        { error: 'Jira URL, 이메일, API Token, Confluence Space, 프로젝트 키, 팀원은 필수입니다' },
        { status: 400 }
      )
    }

    // Upsert (없으면 생성, 있으면 업데이트)
    const config = await prisma.jiraConfig.upsert({
      where: {
        workspaceId: workspaceId
      },
      update: {
        jiraUrl,
        jiraEmail,
        jiraToken,
        confluenceSpace,
        confluenceParentId: confluenceParentId || null,
        projectKey,
        teamMembers,
        calendarId: calendarId || null,
        calendarClientId: calendarClientId || null,
        calendarClientSecret: calendarClientSecret || null,
        calendarAccessToken: calendarAccessToken || null,
        calendarRefreshToken: calendarRefreshToken || null,
        calendarTokenExpiry: calendarTokenExpiry ? new Date(calendarTokenExpiry) : null,
      },
      create: {
        workspaceId,
        jiraUrl,
        jiraEmail,
        jiraToken,
        confluenceSpace,
        confluenceParentId: confluenceParentId || null,
        projectKey,
        teamMembers,
        calendarId: calendarId || null,
        calendarClientId: calendarClientId || null,
        calendarClientSecret: calendarClientSecret || null,
        calendarAccessToken: calendarAccessToken || null,
        calendarRefreshToken: calendarRefreshToken || null,
        calendarTokenExpiry: calendarTokenExpiry ? new Date(calendarTokenExpiry) : null,
      }
    })

    return NextResponse.json({
      config,
      message: '설정이 저장되었습니다'
    })

  } catch (error: any) {
    console.error('[Config POST Error]', error)
    return NextResponse.json(
      { error: '설정 저장 실패' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspace/[workspaceId]/config
 * Jira/Confluence 설정 삭제
 */
export async function DELETE(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const { workspaceId } = params

    // 워크스페이스 소유권 확인
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: session.user.id
      }
    })

    if (!workspace) {
      return NextResponse.json(
        { error: '워크스페이스를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    await prisma.jiraConfig.delete({
      where: {
        workspaceId: workspaceId
      }
    })

    return NextResponse.json({
      message: '설정이 삭제되었습니다'
    })

  } catch (error: any) {
    console.error('[Config DELETE Error]', error)
    return NextResponse.json(
      { error: '설정 삭제 실패' },
      { status: 500 }
    )
  }
}
