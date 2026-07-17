# Cron (Vercel)

평일(UTC 00:00 = KST 09:00)에 Jira 티켓 수집 → 일일 보고서 생성 → Confluence 자동 등록.

## 엔드포인트

```
GET|POST /api/cron/daily-report
Authorization: Bearer {CRON_SECRET}
```

## Vercel 설정

1. `.env.example` 변수를 Vercel Environment Variables에 등록
2. `CRON_SECRET` 설정 시 Vercel Cron이 자동으로 Bearer 헤더 전송
3. `vercel.json` 스케줄: `0 0 * * 1-5` (월~금 UTC 00:00)

스케줄 변경: [vercel.json](../vercel.json)의 `schedule` 수정 ([crontab.guru](https://crontab.guru))

## 수동 테스트

```bash
curl -X POST "https://your-app.vercel.app/api/cron/daily-report" \
  -H "Authorization: Bearer $CRON_SECRET"
```

로컬:

```bash
CRON_SECRET=dev-secret \
JIRA_URL=... JIRA_EMAIL=... JIRA_API_TOKEN=... \
CONFLUENCE_SPACE=... TEAM_MEMBERS=... \
curl -X POST "http://localhost:3000/api/cron/daily-report" \
  -H "Authorization: Bearer dev-secret"
```

## 처리 흐름

1. KST 기준 이번 주 월~금 JQL로 Jira 티켓 수집 (+ 다음 주)
2. Google Calendar 연차 이벤트 조회 (토큰/env 설정 시)
3. `DailyReportStrategy`로 마크다운 생성
4. Confluence REST API로 페이지 발행

## 주의

- `GOOGLE_ACCESS_TOKEN` 갱신 시 로그에 경고 — refresh 후 env 업데이트 권장
- UI localStorage 설정과 **별개** — Cron은 env만 사용
- `CRON_SECRET` 미설정 시 production에서는 401 반환
