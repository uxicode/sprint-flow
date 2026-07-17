# 🚀 SprintFlow - Jira & Confluence 연동 프로젝트 관리 대시보드

Next.js 기반의 Jira 티켓 조회 및 Confluence 자동 보고서 생성 시스템입니다.

## ✨ 주요 기능

- 📊 **Jira 연동**: JQL 쿼리로 티켓 실시간 조회
- 📝 **자동 보고서 생성**: 일일/주간 업무 보고서 마크다운 자동 생성
- 📅 **Google Calendar 연동**: OAuth 2.0 기반 연차 정보 조회
- 🤖 **Confluence 자동 등록**: Vercel Cron으로 매일 자동 보고서 발행
- 📈 **실적 분석**: Recharts 기반 담당자별 실적 시각화
- 🗓️ **스케줄 관리**: 에픽별 간트 차트 및 진행률 추적
- 🌙 **다크 모드**: Glassmorphism UI 디자인

## 🎯 자동화 기능 (신규!)

**Vercel Cron Jobs**를 통해 매일 평일 오전 9시에 자동으로 Confluence에 일일 보고서를 등록합니다.

상세 설정 가이드: [📖 CRON_SETUP.md](./CRON_SETUP.md)

## 🚀 빠른 시작

### 1. 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# Jira API 설정
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=ATATT...

# Confluence 설정
CONFLUENCE_SPACE=PROJ
CONFLUENCE_PARENT_ID=3792306206

# 프로젝트 설정
PROJECT_KEY=DI26
TEAM_MEMBERS=홍길동,김철수,이영희

# Cron Job 보안 (선택)
CRON_SECRET=your-random-secret
```

자세한 환경 변수 설정은 [.env.example](./.env.example)을 참고하세요.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📦 주요 의존성

- **Next.js 16** - React 프레임워크
- **React 19** - UI 라이브러리
- **Recharts** - 차트 시각화
- **Day.js** - 날짜 처리
- **Lodash** - 유틸리티

## 📂 프로젝트 구조

```
/workspace
├── app/
│   ├── api/
│   │   ├── jira/          # Jira CORS 프록시
│   │   ├── calendar/      # Google Calendar OAuth
│   │   └── cron/
│   │       └── daily-report/  # 자동 보고서 Cron Job
│   ├── components/
│   │   └── PerformanceAnalytics.js  # 실적 분석 컴포넌트
│   ├── utils/
│   │   ├── jira.js        # Jira 유틸리티
│   │   ├── analytics.js   # 분석 로직
│   │   └── confluence.js  # Confluence API (신규)
│   ├── layout.js
│   ├── page.js            # 메인 페이지
│   └── globals.css
├── vercel.json            # Vercel Cron 설정 (신규)
├── .env.example           # 환경 변수 템플릿
├── CRON_SETUP.md          # Cron 자동화 가이드 (신규)
└── package.json
```

## 🤖 자동화 설정

### Vercel Cron Jobs

매일 자동으로 Confluence에 보고서를 등록하려면:

1. 환경 변수를 Vercel Dashboard에 등록
2. `vercel --prod`로 배포
3. Cron Job이 자동으로 활성화됨

자세한 설정: [📖 CRON_SETUP.md](./CRON_SETUP.md)

### 수동 테스트

```bash
# 로컬 테스트
curl http://localhost:3000/api/cron/daily-report

# 프로덕션 테스트
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-project.vercel.app/api/cron/daily-report
```

## 🔐 보안

- API Token은 절대 코드에 하드코딩하지 마세요
- `.env.local` 파일은 Git에 커밋되지 않습니다
- Cron Job에는 `CRON_SECRET`으로 보호하세요

## 📚 문서

- [Cron 자동화 설정](./CRON_SETUP.md)
- [구현 계획](./implementation_plan.md)

## 🚀 배포

### Vercel (권장)

```bash
npm i -g vercel
vercel login
vercel --prod
```

배포 후 Vercel Dashboard에서 환경 변수를 설정하세요.

### 기타 플랫폼

Netlify, AWS Amplify 등 Next.js를 지원하는 플랫폼에 배포 가능합니다.

## 🛠️ 개발

### 빌드

```bash
npm run build
```

### 프로덕션 실행

```bash
npm start
```

### Lint

```bash
npm run lint
```

## 📝 라이선스

MIT License

## 🤝 기여

이슈 및 PR은 언제나 환영합니다!

---

**Made with ❤️ using Next.js**
