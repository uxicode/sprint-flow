# Confluence 일일 보고서 자동화 (Vercel Cron)

Vercel Cron Jobs로 평일 자동 실행 → Jira 티켓 수집 → 일일 보고서 생성 → Confluence 페이지 등록.

## 목차

1. [개요](#개요)
2. [동작 원리](#동작-원리)
3. [Vercel 대시보드 설정 (필독)](#vercel-대시보드-설정-필독)
4. [스케줄 설정](#스케줄-설정)
5. [환경 변수 목록](#환경-변수-목록)
6. [로컬 / 프로덕션 테스트](#로컬--프로덕션-테스트)
7. [로그 확인](#로그-확인)
8. [문제 해결](#문제-해결)
9. [보안 권장 사항](#보안-권장-사항)
10. [참고 자료](#참고-자료)

---

## 개요

### 주요 특징

- 서버리스 환경에서 완전 자동 실행
- 별도 서버·DB 불필요
- **웹 UI + Cron 모두 Vercel 환경 변수 사용** (앱 로드 시 `/api/app-config`로 자동 적용)
- 사이드바 localStorage는 env가 없을 때만 보조 수단
- `CRON_SECRET`으로 무단 호출 방지

### Cron 엔드포인트

```
GET|POST /api/cron/daily-report
Authorization: Bearer {CRON_SECRET}
```

---

## 동작 원리

> **중요:** Vercel Cron은 대시보드에서 Cron을 **수동으로 만드는 방식이 아닙니다.**

1. 프로젝트 루트 `vercel.json`에 Cron 정의
2. **Production 배포**
3. Vercel이 Cron을 **자동 등록**
4. 대시보드에서는 **확인·모니터링**만 수행

현재 `vercel.json` 설정:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-report",
      "schedule": "0 8 * * 1-5"
    }
  ]
}
```

| 항목 | 값 |
|---|---|
| Path | `/api/cron/daily-report` |
| Schedule | `0 8 * * 1-5` (월~금 UTC 08:00) |
| 한국 시간 (KST) | **평일 17:00** (UTC+9) |

---

## Vercel 대시보드 설정 (필독)

### 한눈에 보기: 사이트에서 뭘 하면 되나?

| 구분 | 어디서 | 뭘 하나 |
|---|---|---|
| Cron 경로·스케줄 | **코드** (`vercel.json`) | 이미 설정됨. 사이트에서 Cron 새로 만드는 버튼 **없음** |
| API 키·토큰 | **Vercel 사이트** | Settings → Environment Variables |
| Cron 활성화 | **Vercel 사이트** | Deployments → Redeploy (Production) |
| 등록 확인 | **Vercel 사이트** | Settings → Cron Jobs (목록만 확인) |
| 수동 실행 | **터미널** | curl (사이트에 「지금 실행」 버튼 없음) |

**즉, Vercel 사이트에서 Cron Job을 「추가·생성」하는 설정 화면은 없습니다.**  
`vercel.json`을 git push → Production 배포하면 Vercel이 Cron을 **알아서 등록**합니다.  
사이트에서는 **환경 변수 넣기 + 재배포 + 목록 확인**만 하면 됩니다.

---

### Step 1. 프로젝트 연결

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. **Add New… → Project** (이미 연결돼 있으면 생략)
3. Git 저장소에서 **SprintFlow** 선택 → **Import**
4. Framework: Next.js (자동 감지)
5. **Deploy** 로 첫 배포

### Step 2. 환경 변수 등록

1. Dashboard → **SprintFlow** 프로젝트 클릭
2. 상단 **Settings** 탭
3. 왼쪽 메뉴 **Environment Variables** 클릭
4. 아래 변수를 **하나씩** 추가

**각 변수 입력 방법:**

1. **Key** 입력 (예: `CRON_SECRET`)
2. **Value** 입력 (실제 값 붙여넣기)
3. **Environments**: **Production** 체크 (Preview/Development도 쓰면 같이 체크)
4. **Save** 클릭

[환경 변수 전체 목록](#환경-변수-목록) 참고.

### Step 3. CRON_SECRET 생성 및 등록

`CRON_SECRET`은 Vercel이 자동 생성해 주지 **않습니다.** 본인이 만든 랜덤 문자열을 넣으면 됩니다.

```bash
# macOS / Linux
openssl rand -base64 32
```

1. 위 명령으로 생성한 문자열을 복사
2. Vercel **Environment Variables**에 `CRON_SECRET` 으로 등록
3. 로컬 `.env.local`에도 **같은 값**을 넣으면 수동 테스트가 편함 (값이 달라도 Cron 동작에는 문제 없음)

**역할:**

- Cron API 잠금 비밀번호 (만료 없음, 주기적 갱신 불필요)
- Vercel Cron이 스케줄 실행 시 `Authorization: Bearer {CRON_SECRET}` 헤더를 **자동 전송**
- Production에서 미설정 시 Cron 요청은 **401 Unauthorized**

### Step 4. Production 재배포

환경 변수 추가·수정 후 **반드시 재배포**해야 적용됩니다.

**방법 A — Vercel 사이트**

1. **Deployments** 탭
2. 최신 Production 배포 우측 **⋯** → **Redeploy**
3. **Redeploy** 확인

**방법 B — Git push**

```bash
git push origin main
```

**방법 C — Vercel CLI**

```bash
vercel --prod
```

### Step 5. Cron Job 등록 확인

**Settings → Cron Jobs** 화면은 보통 아래 두 가지만 보입니다.

1. **Enabled** 토글 — `Enabled` 로 켜 두면 됨 (끄면 Cron이 실행 안 됨)
2. **Get Started** 튜토리얼 — `vercel.json` / API Route 만드는 **가이드** (설정 폼 아님)

> **Cron 목록·스케줄 입력 UI는 없습니다.**  
> Path·Schedule은 코드의 `vercel.json`에서만 정하고, Production 배포 시 Vercel이 자동 등록합니다.

등록이 됐으면 같은 페이지 **위쪽** 또는 프로젝트 **Cron** 탭에 아래처럼 한 줄이 추가됩니다:

| Path | Schedule |
|---|---|
| `/api/cron/daily-report` | `0 8 * * 1-5` |

**튜토리얼만 보이고 목록이 없으면:**

1. **Deployments** → 맨 위가 **Production** 배포인지 확인 (Preview만 있으면 Cron 미등록)
2. Production 배포 **⋯ → Redeploy** (또는 `git push` 후 자동 배포)
3. 배포 로그에 cron 관련 메시지 있는지 확인
4. **Enabled** 토글이 켜져 있는지 확인

`CRON_SECRET` 입력란은 **이 페이지에 없습니다.**  
**Settings → Environment Variables** 에 따로 등록하세요.

### Step 6. 수동 실행 테스트

Vercel UI에 「지금 실행」 버튼은 없습니다. 터미널에서 직접 호출:

```bash
curl -X POST "https://<프로젝트-도메인>.vercel.app/api/cron/daily-report" \
  -H "Authorization: Bearer <CRON_SECRET_값>"
```

성공 시 JSON 응답에 `"success": true` 와 Confluence 페이지 링크 등이 포함됩니다.

### Step 7. 실행 로그 확인

1. **Deployments** → 최신 Production 배포 클릭
2. **Functions** 또는 **Runtime Logs** 탭
3. `/api/cron/daily-report` 실행 기록·에러 확인

또는 **Settings → Cron Jobs** 에서 실행 이력 확인 (UI는 플랜·버전에 따라 다를 수 있음).

---

## 스케줄 설정

### Cron 표현식 형식

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 요일 (0-6, 0=일요일)
│ │ │ └─── 월 (1-12)
│ │ └───── 일 (1-31)
│ └─────── 시 (0-23, UTC)
└───────── 분 (0-59)
```

### UTC ↔ KST 변환

Vercel Cron은 **UTC 기준**입니다.

**KST = UTC + 9**

| 원하는 KST | UTC schedule |
|---|---|
| 평일 09:00 | `0 0 * * 1-5` |
| 평일 17:00 (현재) | `0 8 * * 1-5` |
| 평일 18:00 | `0 9 * * 1-5` |

스케줄 변경: `vercel.json`의 `schedule` 수정 → 커밋 → Production 재배포.

[crontab.guru](https://crontab.guru) 로 표현식 검증 가능.

---

## 환경 변수 목록

### 필수

| Key | 설명 |
|---|---|
| `CRON_SECRET` | Cron 인증용 랜덤 문자열 (본인 생성) |
| `JIRA_URL` | Jira 인스턴스 URL (예: `https://your-domain.atlassian.net`) |
| `JIRA_EMAIL` | Jira 계정 이메일 |
| `JIRA_API_TOKEN` | [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `CONFLUENCE_SPACE` | Confluence Space Key |
| `TEAM_MEMBERS` | 팀원 이름 (쉼표 구분) |

### 선택

| Key | 설명 |
|---|---|
| `PROJECT_KEY` | Jira 프로젝트 키 (기본: `DI26`) |
| `CONFLUENCE_PARENT_ID` | 보고서를 생성할 부모 페이지 ID |
| `REGISTERED_MEMBERS` | 등록 멤버 필터 (미설정 시 `TEAM_MEMBERS` 사용) |
| `CALENDAR_ID` | Google Calendar ID (연차 조회) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth Refresh Token |
| `GOOGLE_ACCESS_TOKEN` | **비워도 됨** — Cron 실행 시 refresh token으로 자동 발급 |
| `CRON_TIMEZONE` | 시간대 (기본: `Asia/Seoul`) |

### 로컬 `.env.local` 예시

```bash
CRON_SECRET=your-random-secret-here

JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=ATATT3x...

CONFLUENCE_SPACE=PROJ
CONFLUENCE_PARENT_ID=3792306206

PROJECT_KEY=DI26
TEAM_MEMBERS=홍길동,김철수,이영희
REGISTERED_MEMBERS=홍길동,김철수,이영희

CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REFRESH_TOKEN=1//...
GOOGLE_ACCESS_TOKEN=

CRON_TIMEZONE=Asia/Seoul
```

### Jira API Token 발급

1. [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens) 접속
2. **Create API token**
3. 생성된 토큰을 `JIRA_API_TOKEN`에 입력

### Confluence Space Key / 부모 페이지 ID

- Space Key: URL `.../wiki/spaces/PROJ/...` 의 `PROJ` 부분
- 부모 페이지 ID: URL `.../pages/3792306206/...` 의 숫자 부분 (미설정 시 Space 루트에 생성)

### Google Calendar (선택)

1. 앱 UI에서 **Google 계정 연동** 후 refresh token 확보
2. Vercel에 `GOOGLE_REFRESH_TOKEN` 등록
3. OAuth 앱이 **Testing** 상태면 refresh token이 **7일 후 만료**될 수 있음 → **Production** 전환 권장
4. `GOOGLE_ACCESS_TOKEN`은 Vercel env에 **넣지 않아도** Cron이 매 실행마다 자동 갱신

---

## 로컬 / 프로덕션 테스트

### 로컬

```bash
npm run dev
```

```bash
# CRON_SECRET 미설정 (development만 허용)
curl http://localhost:3000/api/cron/daily-report

# CRON_SECRET 설정 시
curl -X POST http://localhost:3000/api/cron/daily-report \
  -H "Authorization: Bearer your-random-secret-here"
```

### 프로덕션

```bash
curl -X POST "https://your-project.vercel.app/api/cron/daily-report" \
  -H "Authorization: Bearer your-random-secret-here"
```

### 응답 예시

**성공:**

```json
{
  "success": true,
  "message": "일일 보고서가 성공적으로 Confluence에 등록되었습니다",
  "pageId": "123456789",
  "pageTitle": "📅 [일일업무] 2026.07.17",
  "pageLink": "https://your-domain.atlassian.net/wiki/spaces/PROJ/pages/123456789",
  "ticketsProcessed": 15,
  "calendarEventsProcessed": 2,
  "executedAt": "2026-07-17T08:00:00.000Z"
}
```

**실패:**

```json
{
  "success": false,
  "error": "Jira API 오류 (401): Unauthorized"
}
```

---

## 로그 확인

Cron Job은 다음 형태의 로그를 출력합니다:

```
[Cron] 일일 보고서 자동 생성 시작: ...
[Cron] Jira 티켓 조회 완료: 15 건
[Cron] Calendar 이벤트 조회 완료: 2 건
[Cron] Confluence 페이지 생성 완료: https://...
```

확인 경로: **Deployments → (Production) → Functions / Runtime Logs**

---

## 문제 해결

### Cron Job 목록에 안 보여요

- `vercel.json`이 repo 루트에 있고 main에 푸시됐는지 확인
- Production 배포가 완료됐는지 확인
- Hobby 플랜 Cron 제한 확인

### Cron이 401 Unauthorized

- Vercel env에 `CRON_SECRET` 등록 여부 확인
- env 변경 후 **재배포** 했는지 확인
- 수동 curl 시 Bearer 값이 env와 **완전히 동일**한지 확인

### 환경 변수를 찾을 수 없다

- Vercel Dashboard → Environment Variables 에 모든 필수 변수 등록
- **Production** 환경 체크 여부 확인
- 등록 후 **Redeploy**

### Confluence 페이지 생성 실패

- `JIRA_EMAIL` + `JIRA_API_TOKEN` 유효성 확인
- Confluence Space 페이지 생성 권한 확인
- `CONFLUENCE_SPACE` 대소문자 정확히 일치하는지 확인
- `CONFLUENCE_PARENT_ID` 존재·접근 가능 여부 확인

### 빈 보고서가 생성돼요

- `PROJECT_KEY`, `TEAM_MEMBERS` 값 확인
- Jira에 해당 조건 티켓이 실제로 있는지 확인

### Google Calendar 조회 실패

- `GOOGLE_REFRESH_TOKEN` 유효성 확인 (Testing 7일 만료, 권한 취소 등)
- OAuth 앱 **Production** 전환 여부 확인
- `GOOGLE_ACCESS_TOKEN` env는 **비워도 됨** — refresh token만 있으면 Cron이 자동 갱신

### 실행 시간이 기대와 달라요

- Vercel Cron은 **UTC** 기준 — KST = UTC + 9 로 `vercel.json` schedule 계산
- 현재: `0 8 * * 1-5` = **KST 평일 17:00**

### Vercel CLI로 처음 배포할 때

```bash
npm i -g vercel
vercel login
vercel          # Preview
vercel --prod   # Production (Cron은 Production에서만 실행)
```

---

## 보안 권장 사항

1. `CRON_SECRET` 반드시 설정 (랜덤 문자열, placeholder 그대로 사용 금지)
2. API Token·OAuth Secret을 코드·저장소에 커밋하지 말 것
3. `.env.local`은 `.gitignore`에 포함 (`.env*` 패턴)
4. Vercel env는 필요한 Environment만 체크
5. Jira API Token은 정기적으로 로테이션

---

## 참고 자료

- [Vercel Cron Jobs 공식 문서](https://vercel.com/docs/cron-jobs)
- [Vercel Cron 사용량·요금](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Cron 표현식 생성기 (crontab.guru)](https://crontab.guru/)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Confluence REST API](https://developer.atlassian.com/cloud/confluence/rest/v1/)
- 프로젝트 내부: [docs/cron-daily-report.md](./docs/cron-daily-report.md)
