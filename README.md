# SprintFlow 📊

SprintFlow는 Jira 스프린트 데이터 수집, 업무 보고서 자동 생성, 팀원 가용성(Google Calendar 연동) 파악, 프로젝트 진척도 시각화(간트 차트), 그리고 실적 분석 및 예측을 지원하는 클라이언트-서버 통합 Next.js 대시보드 애플리케이션입니다.

기존의 Vanilla HTML/JS 기반 프로젝트를 Next.js(React) 프레임워크로 이식하여, 별도의 데이터베이스 없이 `localStorage`와 서버리스 API Route, 그리고 Vercel Cron을 조합해 100% 서버리스 배포가 가능하도록 설계되었습니다.

---

## 🌟 주요 기능

### 1. Jira 연동 및 대시보드
*   **실시간 티켓 조회**: 프로젝트 키(Project Key)와 작업 기간, 팀원 필터를 바탕으로 Jira API와 실시간 연동해 티켓 정보를 수집합니다.
*   **JQL 자동 빌더**: UI 상에서 선택한 조건에 따라 검색에 최적화된 Jira JQL 쿼리를 자동으로 빌드합니다.
*   **개발/데모 모드 지원**: Jira API 자격 증명이 없거나 연동을 원하지 않을 경우, 자동으로 고품질의 Mock 데이터를 로드하여 기능을 테스트할 수 있습니다.

### 2. 일일/주간 업무 보고서 자동화 및 Confluence 게시
*   **자동 마크다운 리포트**: 수집된 티켓을 분석하여 마케터, 기획자, 개발자 등 직무/담당자별 일일 및 주간 업무 보고서를 마크다운 형식으로 자동 빌드합니다.
*   **Confluence 퍼블리싱**: 대시보드 상에서 작성된 보고서를 클릭 한 번으로 미리 지정한 Confluence Space 및 부모 페이지 하위에 신규 페이지로 즉시 업로드합니다.
*   **파일 다운로드 및 복사**: 생성된 마크다운 보고서를 클립보드에 복사하거나 로컬 마크다운 파일로 다운로드할 수 있습니다.

### 3. 담당자별 실적 분석 및 예측 (Analytics)
*   **시계열 트렌드 차트**: 일별/월별 완료 티켓 추이를 Line 및 Bar 차트로 시각화하여 생산성 변화를 추적합니다.
*   **멤버 실적 비교**: 담당자별 티켓 완료율, 완료 비중(Pie Chart), 작업 상태 분포(Stacked Bar) 등을 Recharts로 동적 렌더링합니다.
*   **인사이트 자동 생성**: 팀 전체의 생산성 변화, MVP 후보 식별, 과도한 진행 중 업무(고 WIP)를 가지고 있는 팀원 경고 등의 인사이트를 자동 도출합니다.
*   **다음 달 실적 예측**: 최근 3개월간의 평균 완료 추이를 바탕으로 다음 달 예상 완료량 및 예측 신뢰도(높음/중간/낮음)를 계산합니다.
*   **체크박스 제외 필터**: 특정 티켓을 분석 결과에서 실시간으로 제외하며 리포트 메트릭을 동적으로 재계산할 수 있습니다.

### 4. 에픽 일정 타임라인 및 간트 차트 (Gantt Chart)
*   **에픽 기준 티켓 그룹화**: Jira 티켓을 연계된 에픽(Epic)별로 묶어 진척 상황을 정리합니다.
*   **직무별 진행률 계산**: 에픽 하위 티켓을 `[BE]`, `[FE]`, `[MO]` 접두어로 자동 구분하여 백엔드, 프론트엔드, 모바일 파트별 진척률을 퍼센티지로 계산하고 프로그레스 바를 렌더링합니다.
*   **타임라인 시각화**: 각 에픽의 하위 티켓 중 최초 생성일과 최신 업데이트일/기한을 계산해 에픽의 가로형 타임라인 막대바를 동적 렌더링합니다.
*   **아코디언 구조**: 간트 차트의 에픽 항목을 확장하면 하위 티켓 목록과 상태를 세부 조회할 수 있습니다.

### 5. Google 캘린더 연동 및 가용성 파악
*   **OAuth 캘린더 연동**: Google OAuth 2.0 흐름을 통해 회사 공유 캘린더에 연동합니다.
*   **연차 및 휴가 자동 파싱**: 지정된 기간 내 팀원들의 연차, 휴가, 대체휴무 등의 일정을 캘린더에서 수집하여 분석에 반영하고, 보고서의 가용성 지표로 자동 반영합니다.

### 6. 일일 보고서 스케줄러 (Vercel Cron) & Slack 알림
* **서버리스 Cron 자동화**: `vercel.json`의 Cron 설정을 통해 평일 17:00 KST에 자동으로 Jira 데이터 수집, 가용성 분석, 보고서 생성을 거쳐 Confluence 페이지를 자동으로 발행합니다.
* **Slack Webhook 연동**: Confluence 페이지 발행 성공 시 직관적인 알림 메시지와 바로가기 링크를 Slack으로 즉시 발송합니다.
* **보안 토큰 인증**: `CRON_SECRET`을 통해 무단 API 호출을 차단하고 안전하게 스케줄을 처리합니다.

### 7. 보안 관리자 로그인 인증
* **Vercel 환경 변수 연동**: `ADMIN_USERNAME` 및 `ADMIN_PASSWORD` 환경 변수로 관리자 계정을 설정하여 대시보드 무단 노출을 방지합니다.
* **보안 세션 쿠키**: 서버 API Route(`/api/auth/login`)를 통해 계정을 검증하고 `httpOnly` 보안 쿠키로 로그인 세션을 안전하게 유지합니다.
* **글래스모피즘 인증 UI**: 대시보드 진입 시 미인증 사용자의 접근을 차단하고 입체적인 모던 글래스모피즘 로그인 화면을 제공합니다.

---

## 🛠️ 기술 스택

### Frontend
*   **Core**: React 19 (React 19.2.4), Next.js 16 (Next.js 16.2.10 - App Router)
*   **State Management**: Zustand (Zustand 5.0.14)
*   **Styling**: CSS Modules, Vanilla CSS (with PostCSS), Tailwind CSS v4
*   **Libraries**: Recharts (시각화 차트), date-fns & dayjs (날짜 연산), lodash (데이터 조작)

### Backend & Infrastructure
*   **Runtime / Proxy**: Next.js Route Handlers (API Routes)
*   **Hosting**: Vercel (Serverless Environment)
*   **Automation**: Vercel Cron Jobs

---

## 📁 프로젝트 폴더 구조

```text
SprintFlow/
├── app/                      # Next.js App Router 디렉토리
│   ├── api/                  # 서버리스 API 엔드포인트
│   │   ├── app-config/       # 서버 환경 변수 및 설정 노출 API
│   │   ├── calendar/         # Google Calendar OAuth 인증 및 이벤트 조회 API
│   │   ├── cron/             # Vercel Cron 일일 자동 보고서 실행 API
│   │   ├── jira/             # 클라이언트 CORS 우회용 Jira API 프록시
│   │   └── proxy/            # 공용 CORS 우회 프록시
│   ├── components/           # UI 컴포넌트
│   │   ├── dashboard/        # 대시보드 탭 전용 컴포넌트 (Header, Filter, Stats, Table)
│   │   ├── layout/           # App 레이아웃 컴포넌트 (AppShell, Sidebar)
│   │   ├── schedule/         # 일정관리 탭 및 간트 차트 컴포넌트
│   │   ├── icons/            # SVG 아이콘 컴포넌트 모음
│   │   └── *.tsx             # 공통 UI 요소 (FormField, TabPanel, Toggle 등)
│   ├── hooks/                # 상태 액션 및 바인딩을 위한 커스텀 훅 모음
│   ├── lib/                  # 외부 라이브러리 설정 및 인스턴스
│   ├── providers/            # React Context 및 전역 Provider
│   ├── stores/               # Zustand 상태 저장소 (Filter, Report, Settings, UI)
│   ├── types/                # TypeScript 공통 인터페이스 및 타입 정의
│   ├── utils/                # 유틸리티 함수 모음
│   │   ├── server/           # 서버 사이드 전용 로직 (Confluence, CronJob 등)
│   │   └── *.ts              # 날짜 연산, 마크다운 파서, Jira 포맷터 등
│   ├── globals.css           # 다크모드, Glassmorphism 테마가 정의된 전역 CSS
│   ├── layout.tsx            # Next.js 루트 레이아웃
│   └── page.tsx              # 앱 엔트리포인트 (부트스트랩 제어)
├── docs/                     # 추가 설계 및 상세 스펙 가이드 문서
├── public/                   # 정적 에셋 (파비콘, 이미지 등)
├── vercel.json               # Vercel Cron 설정 파일
├── package.json              # 프로젝트 의존성 구성 및 빌드 스크립트
├── tsconfig.json             # TypeScript 환경 설정
└── README.md                 # 본 프로젝트 문서
```

---

## ⚙️ 환경 설정 (Environment Variables)

로컬 실행 및 프로덕션 배포(Vercel)를 위해 루트 디렉토리에 `.env.local` 파일을 생성하고 아래 환경 변수를 입력해 주어야 합니다.

```bash
# Vercel Cron 보안용 임의 보안 키 (예: openssl rand -base64 32)
CRON_SECRET=your-random-secret-here

# Jira 자격 증명
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=ATATT3x...

# Confluence 설정
CONFLUENCE_SPACE=PROJ
CONFLUENCE_PARENT_ID=3792306206  # (선택) 보고서가 올라갈 부모 페이지 ID

# 기본 대상 Jira 프로젝트 및 기본 멤버 목록
PROJECT_KEY=DI26
TEAM_MEMBERS=홍길동,김철수,이영희
REGISTERED_MEMBERS=홍길동,김철수,이영희

# Google Calendar (선택)
CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REFRESH_TOKEN=1//...
GOOGLE_ACCESS_TOKEN=

# 시간대 설정
CRON_TIMEZONE=Asia/Seoul
```

> [!NOTE]
> 자세한 Cron 설정 방법과 Vercel 배포 방법은 [CRON_SETUP.md](./CRON_SETUP.md) 문서를 참고해 주시기 바랍니다.

---

## 🚀 로컬 실행 방법

1.  의존성 패키지를 설치합니다.
    ```bash
    npm install
    ```
2.  개발 서버를 구동합니다.
    ```bash
    npm run dev
    ```
3.  브라우저를 열고 `http://localhost:3000`에 접속하여 프로젝트를 확인합니다.
4.  Jira API 연동 모드를 사용하려면 사이드바 하단에서 **"API 모드 활성화"** 토글을 켜고 설정 정보를 저장합니다. 비활성화 시에는 Mock 데이터가 표출됩니다.
