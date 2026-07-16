import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/workspace
 * 현재 사용자의 워크스페이스 목록 조회
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        jiraConfig: true,
        cronJobs: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({ workspaces })

  } catch (error: any) {
    console.error('[Workspace GET Error]', error)
    return NextResponse.json(
      { error: '워크스페이스 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workspace
 * 새 워크스페이스 생성
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, slug } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: '워크스페이스 이름과 슬러그는 필수입니다' },
        { status: 400 }
      )
    }

    // 슬러그 중복 확인
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug }
    })

    if (existingWorkspace) {
      return NextResponse.json(
        { error: '이미 사용 중인 슬러그입니다' },
        { status: 400 }
      )
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        userId: session.user.id,
      }
    })

    return NextResponse.json({ workspace }, { status: 201 })

  } catch (error: any) {
    console.error('[Workspace POST Error]', error)
    return NextResponse.json(
      { error: '워크스페이스 생성 실패' },
      { status: 500 }
    )
  }
}
