# 🤖 Confluence 일일 보고서 자동화 가이드

Vercel Cron Jobs를 사용하여 매일 자동으로 Confluence에 일일 업무 보고서를 등록하는 기능입니다.

## 📋 목차

1. [개요](#개요)
2. [스케줄 설정](#스케줄-설정)
3. [환경 변수 설정](#환경-변수-설정)
4. [Vercel 배포](#vercel-배포)
5. [테스트 방법](#테스트-방법)
6. [문제 해결](#문제-해결)

---

## 개요

### 동작 방식

1. **매일 평일 오전 9시** (한국 시간 기준, UTC+9)에 자동 실행
2. Jira API를 통해 오늘의 티켓 데이터 조회
3. Google Calendar에서 연차 정보 조회 (선택사항)
4. 일일 보고서 마크다운 생성
5. Confluence API를 통해 자동으로 페이지 생성

### 주요 특징

- ✅ 서버리스 환경에서 완전 자동 실행
- ✅ 별도 서버나 데이터베이스 불필요
- ✅ Vercel 무료 플랜에서 사용 가능
- ✅ 수동 테스트 엔드포인트 제공
- ✅ 보안 토큰으로 무단 실행 방지 (선택)

---

## 스케줄 설정

### 현재 스케줄

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-report",
      "schedule": "0 9 * * 1-5"
    }
  ]
}
```

### Cron 표현식 설명

- `0 9 * * 1-5`: 매주 월요일~금요일 오전 9시 (UTC 기준)
- **한국 시간 기준**: 오후 6시 (UTC+9)

### 스케줄 변경 예시

원하는 시간으로 변경하려면 `vercel.json`의 `schedule` 값을 수정하세요:

```json
// 매일 오전 8시 (UTC 기준, 한국 시간 오후 5시)
"schedule": "0 8 * * 1-5"

// 매일 정오 12시 (UTC 기준, 한국 시간 오후 9시)
"schedule": "0 12 * * 1-5"

// 매일 오전 10시 (UTC 기준, 한국 시간 오후 7시)
"schedule": "0 10 * * 1-5"

// 매일 자정 (UTC 기준, 한국 시간 오전 9시)
"schedule": "0 0 * * 1-5"
```

**⚠️ 주의**: UTC 시간 기준이므로 한국 시간에서 9시간을 빼야 합니다!

### Cron 표현식 형식

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 요일 (0-6, 0=일요일)
│ │ │ └─── 월 (1-12)
│ │ └───── 일 (1-31)
│ └─────── 시 (0-23)
└───────── 분 (0-59)
```

---

## 환경 변수 설정

### 1. `.env.local` 파일 생성

프로젝트 루트에 `.env.local` 파일을 만들고 다음 내용을 입력하세요:

```bash
# Jira API 설정 (필수)
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...

# Confluence 설정 (필수)
CONFLUENCE_SPACE=PROJ
CONFLUENCE_PARENT_ID=3792306206

# 프로젝트 설정 (필수)
PROJECT_KEY=DI26
TEAM_MEMBERS=홍길동,김철수,이영희

# Google Calendar OAuth 2.0 (선택사항)
CALENDAR_CLIENT_ID=
CALENDAR_CLIENT_SECRET=
CALENDAR_ACCESS_TOKEN=
CALENDAR_REFRESH_TOKEN=
CALENDAR_ID=

# Cron Job 보안 (선택사항, 권장)
CRON_SECRET=your-random-secret-key-here
```

### 2. Jira API Token 발급

1. [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens) 접속
2. "Create API token" 클릭
3. 토큰 이름 입력 (예: "SprintFlow Cron")
4. 생성된 토큰을 복사하여 `JIRA_API_TOKEN`에 입력

### 3. Confluence Space Key 확인

1. Confluence 페이지 접속
2. URL에서 Space Key 확인: `https://your-domain.atlassian.net/wiki/spaces/PROJ/...`
3. `PROJ` 부분이 Space Key입니다

### 4. Confluence 부모 페이지 ID 확인 (선택)

특정 페이지 하위에 보고서를 생성하려면:

1. 부모 페이지의 URL 확인: `https://your-domain.atlassian.net/wiki/spaces/PROJ/pages/3792306206/...`
2. `3792306206` 부분이 페이지 ID입니다
3. 설정하지 않으면 Space의 루트에 페이지가 생성됩니다

### 5. CRON_SECRET 생성 (권장)

무단 실행 방지를 위해 랜덤한 비밀 키를 생성하세요:

```bash
# macOS/Linux
openssl rand -base64 32

# 또는 간단하게
echo "cron-secret-$(date +%s)-$(openssl rand -hex 8)"
```

---

## Vercel 배포

### 1. Vercel 프로젝트 생성

```bash
# Vercel CLI 설치 (처음 한 번만)
npm i -g vercel

# Vercel에 로그인
vercel login

# 프로젝트 배포
vercel
```

### 2. Vercel 대시보드에서 환경 변수 설정

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Settings** → **Environment Variables** 클릭
4. `.env.local`의 모든 변수를 추가:
   - Variable Name: `JIRA_URL`
   - Value: `https://your-domain.atlassian.net`
   - Environment: **Production** 체크
   - "Add" 클릭
5. 모든 환경 변수를 같은 방식으로 추가

### 3. 프로덕션 배포

```bash
vercel --prod
```

### 4. Cron Job 활성화 확인

1. Vercel Dashboard → 프로젝트 선택
2. **Settings** → **Cron Jobs** 클릭
3. 등록된 Cron Job 확인:
   - Path: `/api/cron/daily-report`
   - Schedule: `0 9 * * 1-5`

---

## 테스트 방법

### 1. 로컬 테스트

개발 서버를 실행한 후:

```bash
npm run dev
```

브라우저 또는 curl로 엔드포인트 호출:

```bash
# CRON_SECRET이 없을 때
curl http://localhost:3000/api/cron/daily-report

# CRON_SECRET이 있을 때
curl -H "Authorization: Bearer your-secret-key" \
     http://localhost:3000/api/cron/daily-report
```

### 2. Vercel 프로덕션 테스트

배포 후 실제 URL로 테스트:

```bash
curl -H "Authorization: Bearer your-secret-key" \
     https://your-project.vercel.app/api/cron/daily-report
```

### 3. 응답 예시

**성공 시:**

```json
{
  "success": true,
  "message": "일일 보고서가 성공적으로 Confluence에 등록되었습니다",
  "pageId": "123456789",
  "pageTitle": "📅 [일일업무] 2026.07.16",
  "pageLink": "https://your-domain.atlassian.net/wiki/spaces/PROJ/pages/123456789",
  "ticketsProcessed": 15,
  "calendarEventsProcessed": 2,
  "executedAt": "2026-07-16T00:00:00.000Z"
}
```

**실패 시:**

```json
{
  "success": false,
  "error": "Jira API 오류 (401): Unauthorized",
  "executedAt": "2026-07-16T00:00:00.000Z"
}
```

---

## 문제 해결

### Q1. Cron Job이 실행되지 않아요

**해결 방법:**

1. Vercel Dashboard → 프로젝트 → **Deployments** 탭에서 최신 배포 확인
2. **Functions** 탭에서 Cron 실행 로그 확인
3. `vercel.json`이 프로젝트 루트에 있는지 확인
4. Vercel Pro 플랜인지 확인 (무료 플랜은 Cron 제한 있음)

### Q2. 환경 변수를 찾을 수 없다고 나와요

**해결 방법:**

1. Vercel Dashboard에서 환경 변수가 올바르게 설정되었는지 확인
2. Environment를 **Production**으로 설정했는지 확인
3. 변경 후 다시 배포: `vercel --prod`

### Q3. Confluence 페이지 생성이 실패해요

**해결 방법:**

1. `JIRA_EMAIL`과 `JIRA_API_TOKEN`이 올바른지 확인
2. Confluence Space에 페이지 생성 권한이 있는지 확인
3. `CONFLUENCE_SPACE` 키가 대문자로 정확한지 확인
4. `CONFLUENCE_PARENT_ID`가 존재하고 접근 가능한지 확인

### Q4. 매일 실행되지만 빈 보고서가 생성돼요

**해결 방법:**

1. `PROJECT_KEY`와 `TEAM_MEMBERS`가 올바른지 확인
2. Jira에서 해당 프로젝트와 담당자에게 할당된 티켓이 있는지 확인
3. JQL 쿼리가 너무 제한적이지 않은지 확인

### Q5. 시간대가 맞지 않아요

**해결 방법:**

Vercel Cron은 UTC 기준으로 동작합니다. 한국 시간(UTC+9)으로 변환:

- 원하는 한국 시간에서 **9시간을 빼세요**
- 예: 한국 오후 6시 → UTC 오전 9시 → `0 9 * * 1-5`

### Q6. 수동으로 즉시 실행하고 싶어요

**해결 방법:**

위의 [테스트 방법](#테스트-방법)을 참고하여 API 엔드포인트를 직접 호출하세요.

---

## 추가 자동화 옵션

### GitHub Actions로 대체하기

Vercel Cron 대신 GitHub Actions를 사용할 수도 있습니다:

`.github/workflows/daily-report.yml`:

```yaml
name: Daily Confluence Report

on:
  schedule:
    - cron: '0 0 * * 1-5'  # 매일 평일 오전 9시 (KST)
  workflow_dispatch:  # 수동 실행 허용

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cron Job
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-project.vercel.app/api/cron/daily-report
```

### Zapier/Make.com 연동

GUI 기반 자동화 도구를 선호한다면:

1. Zapier 또는 Make.com에서 새 Workflow 생성
2. Trigger: Schedule (매일 평일 오전 9시)
3. Action: Webhooks → POST Request
   - URL: `https://your-project.vercel.app/api/cron/daily-report`
   - Headers: `Authorization: Bearer your-secret-key`

---

## 로그 확인

### Vercel 대시보드에서 로그 보기

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Functions** 탭 클릭
4. `api/cron/daily-report` 함수 선택
5. 실행 로그 및 에러 확인

### 콘솔 로그 출력

Cron Job은 다음 로그를 출력합니다:

```
[Cron] 일일 보고서 자동 생성 시작: 2026-07-16T00:00:00.000Z
[Cron] 조회 기간: 2026-07-16
[Cron] JQL: project = "DI26" AND assignee in ("홍길동", "김철수") ...
[Cron] Jira 티켓 조회 완료: 15 건
[Cron] Calendar 이벤트 조회 완료: 2 건
[Cron] 일일 보고서 생성 완료
[Cron] Confluence 페이지 생성 완료: https://your-domain.atlassian.net/...
```

---

## 보안 권장 사항

1. ✅ `CRON_SECRET` 반드시 설정
2. ✅ API Token을 절대 코드에 하드코딩하지 말 것
3. ✅ `.env.local` 파일을 `.gitignore`에 추가
4. ✅ Vercel 환경 변수는 Production만 체크
5. ✅ 정기적으로 Jira API Token 갱신

---

## 참고 자료

- [Vercel Cron Jobs 공식 문서](https://vercel.com/docs/cron-jobs)
- [Cron 표현식 생성기](https://crontab.guru/)
- [Jira REST API 문서](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Confluence REST API 문서](https://developer.atlassian.com/cloud/confluence/rest/v1/)

---

## 문의 및 지원

문제가 발생하거나 추가 기능이 필요하면 GitHub Issue를 생성하거나 팀에 문의하세요.

**Happy Automating! 🚀**
