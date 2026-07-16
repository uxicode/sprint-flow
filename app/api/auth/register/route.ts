import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

/**
 * POST /api/auth/register
 * 신규 사용자 회원가입
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호는 필수입니다' },
        { status: 400 }
      )
    }

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다' },
        { status: 400 }
      )
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 12)

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    })

    // 기본 Workspace 자동 생성
    const workspace = await prisma.workspace.create({
      data: {
        name: `${user.name}의 워크스페이스`,
        slug: `${user.id}-default`,
        userId: user.id,
      }
    })

    return NextResponse.json({
      user,
      workspace,
      message: '회원가입이 완료되었습니다'
    }, { status: 201 })

  } catch (error: any) {
    console.error('[Register Error]', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
