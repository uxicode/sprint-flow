# 🚀 SprintFlow - Multi-Tenant SaaS Platform

**Jira & Confluence 연동 프로젝트 관리 대시보드 (멀티 테넌트 SaaS)**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![NextAuth.js](https://img.shields.io/badge/NextAuth.js-4.24-purple?style=flat)](https://next-auth.js.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-316192?style=flat&logo=postgresql)](https://www.postgresql.org/)

## ✨ 주요 기능

- 🏢 **멀티 테넌트 SaaS**: 각 사용자가 독립적인 워크스페이스와 설정을 가짐
- 🔐 **인증 시스템**: NextAuth.js (Google OAuth + Email/Password)
- 📊 **Jira 연동**: 사용자별 Jira 계정으로 티켓 실시간 조회
- 📝 **자동 보고서 생성**: 일일/주간 업무 보고서 마크다운 자동 생성
- 📅 **Google Calendar 연동**: OAuth 2.0 기반 연차 정보 조회
- 🤖 **Confluence 자동 등록**: Vercel Cron으로 워크스페이스별 자동 보고서 발행
- 📈 **실적 분석**: Recharts 기반 담당자별 실적 시각화
- 🗓️ **스케줄 관리**: 에픽별 간트 차트 및 진행률 추적
- 🌙 **다크 모드**: Glassmorphism UI 디자인
- 📊 **사용량 추적**: API 호출 횟수 및 Cron 실행 이력 로깅

## 🏗️ 아키텍처

### Single Tenant → Multi-Tenant SaaS 전환

| 이전 | 현재 |
|------|------|
| 환경 변수 기반 단일 설정 | PostgreSQL 기반 사용자별 설정 |
| 1개 프로젝트 | 무한대 워크스페이스 |
| 인증 없음 | NextAuth.js 기반 JWT 인증 |
| 단일 Cron Job | 멀티 테넌트 Cron Job |

### 기술 스택

- **Frontend**: React 19, Next.js 16 (App Router)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js
- **Charts**: Recharts
- **Deployment**: Vercel (Serverless)

## 🚀 빠른 시작

### 1. 설치

```bash
git clone https://github.com/uxicode/SprintFlow.git
cd SprintFlow
npm install
```

### 2. 데이터베이스 설정

#### Supabase (추천)

1. [Supabase](https://supabase.com) 프로젝트 생성
2. Database URL 복사

#### 로컬 PostgreSQL

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Linux
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

createdb sprintflow
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# Database (필수)
DATABASE_URL="postgresql://user:password@localhost:5432/sprintflow"

# NextAuth.js (필수)
NEXTAUTH_SECRET="랜덤-문자열-32자-이상"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (선택)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Cron 보안 (필수)
CRON_SECRET="랜덤-비밀키"
```

자세한 환경 변수 설정은 [.env.example.saas](./.env.example.saas)를 참고하세요.

### 4. Prisma Migration

```bash
# Prisma Client 생성
npx prisma generate

# 데이터베이스 마이그레이션
npx prisma migrate dev --name init

# (선택) Prisma Studio로 데이터 확인
npx prisma studio
```

### 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📦 주요 의존성

- **Next.js 16** - React 프레임워크
- **Prisma 7.8** - ORM
- **NextAuth.js 4.24** - 인증
- **Recharts** - 차트 시각화
- **Day.js** - 날짜 처리
- **bcryptjs** - 비밀번호 해싱

## 📂 프로젝트 구조

```
/workspace
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/  # NextAuth.js
│   │   │   └── register/        # 회원가입
│   │   ├── workspace/           # 워크스페이스 관리
│   │   │   └── [workspaceId]/
│   │   │       └── config/      # Jira/Confluence 설정
│   │   ├── jira/
│   │   │   └── [workspaceId]/   # 멀티 테넌트 Jira 프록시
│   │   ├── calendar/            # Google Calendar OAuth
│   │   └── cron/
│   │       └── daily-report/    # 멀티 테넌트 Cron Job
│   ├── components/
│   │   └── PerformanceAnalytics.js
│   ├── utils/
│   │   ├── jira.js
│   │   ├── analytics.js
│   │   └── confluence.js
│   ├── layout.js
│   ├── page.js
│   └── globals.css
├── lib/
│   ├── prisma.ts         # Prisma Client
│   ├── auth.ts           # NextAuth 설정
│   └── middleware.ts     # 인증 미들웨어
├── prisma/
│   └── schema.prisma     # 데이터베이스 스키마
├── types/
│   └── next-auth.d.ts
├── vercel.json           # Vercel Cron 설정
├── SAAS_ARCHITECTURE.md  # 아키텍처 가이드
├── CRON_SETUP.md
└── package.json
```

## 🗄️ 데이터베이스 스키마

### 주요 테이블

- **users** - 사용자 계정
- **workspaces** - 워크스페이스 (사용자별)
- **jira_configs** - Jira/Confluence 설정 (워크스페이스별)
- **cron_jobs** - Cron 스케줄 (워크스페이스별)
- **cron_executions** - 실행 이력 & 로깅
- **usage** - API 사용량 추적

자세한 스키마는 [prisma/schema.prisma](./prisma/schema.prisma)를 참고하세요.

## 🤖 멀티 테넌트 Cron Job

매일 평일 오전 9시(UTC)에 **모든 활성 워크스페이스**의 일일 보고서를 자동으로 생성합니다.

### 동작 방식

1. Vercel Cron이 `/api/cron/daily-report` 호출
2. `enabled=true`인 모든 `CronJob` 레코드 조회
3. 각 워크스페이스별로 순회:
   - 워크스페이스의 `jiraConfig` 사용
   - Jira API 호출 → 티켓 조회
   - 일일 보고서 생성
   - Confluence에 자동 등록
   - 실행 이력을 `cron_executions`에 저장
4. 모든 워크스페이스 처리 완료

자세한 설정: [CRON_SETUP.md](./CRON_SETUP.md)

## 🔐 보안

- ✅ NextAuth.js JWT 세션 (30일 유효)
- ✅ 워크스페이스 소유권 검증
- ✅ API Route 인증 미들웨어
- ✅ bcrypt 비밀번호 해싱
- ⚠️ **프로덕션 배포 시**: API Token 암호화 필수

## 📚 문서

- [SaaS 아키텍처 가이드](./SAAS_ARCHITECTURE.md) - 전체 시스템 설계
- [Cron 자동화 설정](./CRON_SETUP.md) - Vercel Cron Jobs 가이드
- [구현 계획](./implementation_plan.md) - 초기 마이그레이션 계획

## 🚀 배포

### Vercel (권장)

```bash
npm i -g vercel
vercel login
vercel --prod
```

배포 후 Vercel Dashboard에서 환경 변수를 설정하세요:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (프로덕션 URL)
- `CRON_SECRET`

### 데이터베이스 Migration

Vercel에서 자동으로 마이그레이션이 실행되도록 `package.json`에 설정되어 있습니다:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

## 🛠️ 개발

### 빌드

```bash
npm run build
```

### 프로덕션 실행

```bash
npm start
```

### Prisma Studio

```bash
npm run db:studio
```

### Lint

```bash
npm run lint
```

## 📊 API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/[...nextauth]` - 로그인/로그아웃

### 워크스페이스
- `GET /api/workspace` - 워크스페이스 목록 조회
- `POST /api/workspace` - 새 워크스페이스 생성

### 설정
- `GET /api/workspace/[workspaceId]/config` - 설정 조회
- `POST /api/workspace/[workspaceId]/config` - 설정 저장
- `DELETE /api/workspace/[workspaceId]/config` - 설정 삭제

### Jira 프록시 (멀티 테넌트)
- `GET /api/jira/[workspaceId]?url=...` - Jira API 프록시

### Cron
- `GET /api/cron/daily-report` - 멀티 테넌트 일일 보고서

## 🎯 로드맵

- [x] 멀티 테넌트 아키텍처
- [x] NextAuth.js 인증
- [x] 워크스페이스별 설정 관리
- [x] 멀티 테넌트 Cron Job
- [ ] 프론트엔드 대시보드 UI
- [ ] Cron Job 관리 UI
- [ ] API Token 암호화
- [ ] 플랜별 사용량 제한
- [ ] Stripe 결제 연동
- [ ] 이메일 알림
- [ ] Slack/Discord Webhook

## 📝 라이선스

MIT License

## 🤝 기여

이슈 및 PR은 언제나 환영합니다!

---

**Made with ❤️ using Next.js + Prisma + NextAuth.js**
