# 🏢 SprintFlow SaaS 아키텍처 문서

## 📋 목차

1. [개요](#개요)
2. [아키텍처 설계](#아키텍처-설계)
3. [데이터베이스 스키마](#데이터베이스-스키마)
4. [API 엔드포인트](#api-엔드포인트)
5. [인증 및 보안](#인증-및-보안)
6. [멀티 테넌트 Cron Job](#멀티-테넌트-cron-job)
7. [배포 가이드](#배포-가이드)
8. [마이그레이션 가이드](#마이그레이션-가이드)

---

## 개요

SprintFlow는 이제 **멀티 테넌트 SaaS 플랫폼**으로 동작합니다. 각 사용자는 독립적인 워크스페이스를 가지며, 자신만의 Jira/Confluence 설정을 관리할 수 있습니다.

### 주요 변경사항

| 이전 (Single Tenant) | 현재 (Multi-Tenant SaaS) |
|---|---|
| 환경 변수에 단일 설정 저장 | 데이터베이스에 사용자별 설정 저장 |
| 모든 사용자가 동일한 Jira 계정 사용 | 각 사용자가 독립적인 Jira 계정 사용 |
| 하나의 Cron Job | 워크스페이스별 독립 Cron Job |
| 인증 없음 | NextAuth.js 기반 인증 |
| 단일 프로젝트 | 무한대 워크스페이스 지원 |

---

## 아키텍처 설계

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│  • 로그인/회원가입 UI                                           │
│  • 워크스페이스 대시보드                                         │
│  • 설정 관리 페이지                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    NextAuth.js (인증)                        │
│  • JWT 세션 관리                                              │
│  • Google OAuth / Email+Password                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (Backend)                      │
│  • /api/auth/* - 인증                                        │
│  • /api/workspace/* - 워크스페이스 관리                        │
│  • /api/jira/[workspaceId] - Jira 프록시                    │
│  • /api/cron/daily-report - 멀티 테넌트 Cron                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Prisma ORM)                         │
│  • users - 사용자 계정                                         │
│  • workspaces - 워크스페이스                                   │
│  • jira_configs - Jira/Confluence 설정                       │
│  • cron_jobs - Cron 스케줄                                   │
│  • cron_executions - 실행 이력                                │
│  • usage - API 사용량 추적                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    외부 API 연동                              │
│  • Jira REST API                                            │
│  • Confluence REST API                                       │
│  • Google Calendar API                                       │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 격리 (Data Isolation)

각 워크스페이스는 **완전히 독립된 설정**을 가집니다:

- ✅ Jira URL, Email, API Token
- ✅ Confluence Space, Parent Page
- ✅ Project Key, Team Members
- ✅ Google Calendar OAuth Tokens
- ✅ Cron Job 스케줄

사용자는 **절대로 다른 사용자의 데이터에 접근할 수 없습니다.**

---

## 데이터베이스 스키마

### 주요 테이블

#### 1. `users` - 사용자 계정

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String    // bcrypt hashed
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  
  workspaces    Workspace[]
}
```

#### 2. `workspaces` - 워크스페이스

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique  // URL-friendly ID
  userId    String   // 소유자
  createdAt DateTime @default(now())
  
  user        User           @relation(fields: [userId])
  jiraConfig  JiraConfig?
  cronJobs    CronJob[]
}
```

#### 3. `jira_configs` - Jira/Confluence 설정

```prisma
model JiraConfig {
  id          String   @id @default(cuid())
  workspaceId String   @unique
  
  jiraUrl     String
  jiraEmail   String
  jiraToken   String   // ⚠️ 프로덕션에서는 암호화 필수
  
  confluenceSpace     String
  confluenceParentId  String?
  
  projectKey  String
  teamMembers String   // 쉼표 구분
  
  // Google Calendar (optional)
  calendarId            String?
  calendarAccessToken   String?
  calendarRefreshToken  String?
  
  workspace Workspace @relation(fields: [workspaceId])
}
```

#### 4. `cron_jobs` - Cron 스케줄

```prisma
model CronJob {
  id          String   @id @default(cuid())
  workspaceId String
  
  name        String
  type        String   // 'daily' | 'weekly'
  schedule    String   // Cron expression
  enabled     Boolean  @default(true)
  timezone    String   @default("Asia/Seoul")
  
  lastRun     DateTime?
  status      String   // 'pending' | 'success' | 'failed'
  
  workspace   Workspace @relation(fields: [workspaceId])
  executions  CronExecution[]
}
```

#### 5. `cron_executions` - 실행 이력

```prisma
model CronExecution {
  id        String   @id @default(cuid())
  cronJobId String
  
  status    String   // 'success' | 'failed'
  startedAt DateTime @default(now())
  duration  Int?     // milliseconds
  
  result    Json?    // 결과 데이터
  error     String?
  
  cronJob   CronJob @relation(fields: [cronJobId])
}
```

#### 6. `usage` - API 사용량 추적

```prisma
model Usage {
  id          String @id @default(cuid())
  workspaceId String
  month       String // 'YYYY-MM'
  
  apiCalls    Int @default(0)
  cronRuns    Int @default(0)
  
  @@unique([workspaceId, month])
}
```

---

## API 엔드포인트

### 인증 (Authentication)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/[...nextauth]` | NextAuth.js (로그인/로그아웃) |

### 워크스페이스 (Workspace)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/workspace` | 사용자의 워크스페이스 목록 조회 |
| POST | `/api/workspace` | 새 워크스페이스 생성 |

### 설정 (Configuration)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/workspace/[workspaceId]/config` | Jira/Confluence 설정 조회 |
| POST | `/api/workspace/[workspaceId]/config` | 설정 생성/업데이트 |
| DELETE | `/api/workspace/[workspaceId]/config` | 설정 삭제 |

### Jira 프록시 (Multi-Tenant)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/jira/[workspaceId]?url=...` | 워크스페이스별 Jira API 프록시 |

### Cron Job (Multi-Tenant)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET/POST | `/api/cron/daily-report` | 모든 활성 워크스페이스의 일일 보고서 생성 |

---

## 인증 및 보안

### 1. NextAuth.js 세션 관리

```typescript
// 모든 보호된 API에서 세션 확인
const session = await getServerSession(authOptions)

if (!session?.user?.id) {
  return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
}
```

### 2. 워크스페이스 소유권 검증

```typescript
// lib/middleware.ts
export async function verifyWorkspaceOwnership(
  workspaceId: string,
  userId: string
) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId: userId  // ✅ 반드시 소유자 확인
    }
  })

  if (!workspace) {
    throw new Error('접근 권한이 없습니다')
  }

  return workspace
}
```

### 3. API 토큰 보안

⚠️ **중요**: 프로덕션 환경에서는 `jiraToken`, `calendarAccessToken` 등을 반드시 암호화해야 합니다!

추천 방법:
- AWS KMS, Google Cloud KMS
- 또는 환경 변수 `ENCRYPTION_KEY`로 AES-256 암호화

```typescript
import crypto from 'crypto'

const algorithm = 'aes-256-cbc'
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(text: string): string {
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = parts.join(':')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

---

## 멀티 테넌트 Cron Job

### 동작 방식

1. Vercel Cron이 `/api/cron/daily-report` 호출
2. 활성화된 모든 `CronJob` 레코드 조회 (`enabled = true`)
3. 각 워크스페이스별로 순회:
   - Jira API 호출 (워크스페이스의 `jiraConfig` 사용)
   - 일일 보고서 생성
   - Confluence에 페이지 등록
   - 실행 결과를 `cron_executions`에 저장
4. 모든 워크스페이스 처리 완료 후 결과 반환

### 예시 응답

```json
{
  "success": true,
  "message": "멀티 테넌트 일일 보고서가 완료되었습니다",
  "totalJobs": 5,
  "successCount": 4,
  "errorCount": 1,
  "results": [
    {
      "workspaceId": "clx123...",
      "workspaceName": "홍길동의 워크스페이스",
      "pageId": "123456789",
      "pageLink": "https://example.atlassian.net/wiki/...",
      "ticketsProcessed": 15
    }
  ],
  "errors": [
    {
      "workspaceId": "clx456...",
      "workspaceName": "김철수의 워크스페이스",
      "error": "Jira API 오류 (401): Unauthorized"
    }
  ]
}
```

---

## 배포 가이드

### 1. 데이터베이스 설정

#### Supabase (추천)

1. [Supabase](https://supabase.com) 프로젝트 생성
2. Database URL 복사:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
3. `.env.local`에 추가:
   ```bash
   DATABASE_URL="postgresql://..."
   ```

#### 로컬 PostgreSQL

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Linux
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# 데이터베이스 생성
createdb sprintflow
```

### 2. Prisma Migration

```bash
# Prisma Client 생성
npx prisma generate

# 데이터베이스 마이그레이션
npx prisma migrate dev --name init

# Prisma Studio로 데이터 확인 (선택)
npx prisma studio
```

### 3. 환경 변수 설정

`.env.local`:

```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth.js
NEXTAUTH_SECRET="랜덤-문자열-32자-이상"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (선택)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Cron Secret
CRON_SECRET="랜덤-비밀키"

# Encryption Key (프로덕션 필수)
ENCRYPTION_KEY="64자리-hex-문자열"
```

### 4. Vercel 배포

```bash
# Vercel에 배포
vercel --prod

# Vercel Dashboard에서 환경 변수 추가
# - DATABASE_URL
# - NEXTAUTH_SECRET
# - NEXTAUTH_URL (프로덕션 URL로 변경)
# - CRON_SECRET
# - ENCRYPTION_KEY
```

### 5. Prisma Migration on Vercel

Vercel에서 자동으로 마이그레이션이 실행되도록 `package.json` 수정:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

---

## 마이그레이션 가이드

기존 Single Tenant 사용자를 SaaS로 마이그레이션하는 방법:

### Step 1: 회원가입

```bash
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password",
    "name": "홍길동"
  }'
```

### Step 2: 로그인

브라우저에서 `/auth/signin` 페이지로 이동하여 로그인

### Step 3: Jira 설정 등록

```bash
curl -X POST https://your-domain.com/api/workspace/[workspaceId]/config \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "jiraUrl": "https://your-domain.atlassian.net",
    "jiraEmail": "user@company.com",
    "jiraToken": "ATATT...",
    "confluenceSpace": "PROJ",
    "confluenceParentId": "123456",
    "projectKey": "DI26",
    "teamMembers": "홍길동,김철수"
  }'
```

### Step 4: Cron Job 생성 (선택)

대시보드 UI에서 "일일 자동 보고서" 활성화

---

## FAQ

### Q1. 기존 환경 변수 기반 코드는 어떻게 되나요?

기존 코드는 `_legacy_backup/` 폴더에 백업되어 있습니다. SaaS 버전은 데이터베이스 기반으로 완전히 재작성되었습니다.

### Q2. 무료 플랜과 유료 플랜을 구분하려면?

`Workspace` 모델에 `plan` 필드를 추가하세요:

```prisma
model Workspace {
  // ...
  plan String @default("free") // 'free' | 'pro' | 'enterprise'
}
```

그리고 API에서 플랜별 제한을 적용:

```typescript
if (workspace.plan === 'free' && usage.apiCalls > 100) {
  return NextResponse.json(
    { error: '무료 플랜 API 한도 초과. 프로 플랜으로 업그레이드하세요.' },
    { status: 429 }
  )
}
```

### Q3. Stripe 결제를 연동하려면?

```bash
npm install stripe
```

그리고 Stripe Webhooks를 설정하여 구독 상태를 동기화하세요.

---

## 다음 단계

- [ ] 프론트엔드 대시보드 UI 구현
- [ ] Cron Job 관리 UI (활성화/비활성화, 스케줄 변경)
- [ ] API 토큰 암호화
- [ ] 플랜별 사용량 제한
- [ ] Stripe 결제 연동
- [ ] 이메일 알림 (보고서 발행 완료 시)
- [ ] Slack/Discord Webhook 연동

---

**SaaS 플랫폼으로 성공적인 전환을 축하합니다! 🎉**
