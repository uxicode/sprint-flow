import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

/**
 * 미들웨어: API Route 인증 검증
 * 
 * 사용 예시:
 * export const GET = withAuth(async (req, session) => {
 *   // session.user.id로 사용자 식별
 *   return NextResponse.json({ ... })
 * })
 */
export function withAuth(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    return handler(req, session)
  }
}

/**
 * 미들웨어: 워크스페이스 소유권 검증
 * 
 * URL 파라미터에서 workspaceId를 추출하여 현재 사용자가 소유한 워크스페이스인지 확인
 */
export async function verifyWorkspaceOwnership(
  workspaceId: string,
  userId: string
) {
  const prisma = (await import('@/lib/prisma')).default

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId: userId
    },
    include: {
      jiraConfig: true
    }
  })

  if (!workspace) {
    throw new Error('워크스페이스를 찾을 수 없거나 접근 권한이 없습니다')
  }

  return workspace
}

/**
 * 사용자의 API 사용량 추적
 */
export async function trackApiUsage(workspaceId: string, apiType: string = 'api_call') {
  const prisma = (await import('@/lib/prisma')).default
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  await prisma.usage.upsert({
    where: {
      workspaceId_month: {
        workspaceId,
        month: currentMonth
      }
    },
    update: {
      apiCalls: {
        increment: 1
      }
    },
    create: {
      workspaceId,
      month: currentMonth,
      apiCalls: 1
    }
  })
}
