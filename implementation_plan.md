# Next.js 프레임워크 전환 계획

기존의 Vanilla HTML/JS 기반 프로젝트를 Next.js(React) 프레임워크로 마이그레이션하여, 별도의 데이터베이스나 로컬 프록시 서버 없이 Vercel/Netlify 등으로 100% 서버리스 배포가 가능한 클라이언트-서버 통합 프로젝트로 재구성합니다.

## User Review Required

> [!IMPORTANT]
> - 기존 Vanilla 소스코드(`index.html`, `style.css`, `app.js`, `proxy.js`)는 `backup-vanilla` 디렉토리로 안전하게 백업한 후 작업을 진행합니다.
> - Next.js의 내장 API 기능(Route Handlers)을 사용하여 기존 `proxy.js`에 존재하던 CORS 우회 프록시 기능을 내장시킵니다.
> - 데이터는 기존과 동일하게 브라우저의 `localStorage`를 사용해 저장하므로, 무상태(Stateless) 서버리스 형태로 구동됩니다.

## Proposed Changes

### 백업 진행
1. 기존 바닐라 소스파일들(`index.html`, `app.js`, `style.css`, `proxy.js`, `README.md`)을 `backup-vanilla/` 폴더로 이동합니다.

### Next.js 프로젝트 생성
- 아래 명령어를 통해 현재 디렉토리에 Next.js 프로젝트를 초기화합니다.
  ```bash
  npx -y create-next-app@latest ./ --yes --js --app --eslint --use-npm --import-alias "@/*" --no-tailwind --no-src-dir
  ```

### 컴포넌트 및 로직 이식

---

#### [NEW] [app/api/jira/route.js](file:///Users/bongcheoljeon/Desktop/private_proj/SprintFlow/app/api/jira/route.js)
- 기존 `proxy.js`에서 수행하던 HTTPS 요청 전달 및 CORS 헤더 적용 로직을 Next.js API Route Handler로 구현합니다.
- `GET`, `OPTIONS` 메소드를 처리하며, `url` 쿼리 파라미터가 가리키는 Jira Endpoint로 요청을 중계합니다.

#### [NEW] [app/globals.css](file:///Users/bongcheoljeon/Desktop/private_proj/SprintFlow/app/globals.css)
- 기존 `style.css`에 구축된 다크모드, Glassmorphism CSS 변수 및 레이아웃 스타일을 Next.js 전역 스타일시트(`app/globals.css`)로 가져와 이식합니다.

#### [NEW] [app/page.js](file:///Users/bongcheoljeon/Desktop/private_proj/SprintFlow/app/page.js)
- 기존 `index.html`과 `app.js`에 분산되어 있던 DOM 엘리먼트 구조와 이벤트 리스너 로직을 단일 React Page 컴포넌트로 재구현합니다.
- **주요 상태 관리(useState, useEffect)**:
  - Jira API 설정값 (URL, Email, Token, API Mode)
  - 등록된 팀원 목록 및 선택 칩 상태
  - 필터 폼 입력값 (Project Key, Start/End Date)
  - 조회 완료된 티켓 데이터 및 탭 활성화 상태
- **Jira 연동**: 브라우저에서 `/api/jira?url=...`로 통신합니다.

#### [NEW] [app/layout.js](file:///Users/bongcheoljeon/Desktop/private_proj/SprintFlow/app/layout.js)
- Next.js의 기본 레이아웃 구성 및 폰트 연동(Plus Jakarta Sans, Outfit)을 적용합니다.

---

## Verification Plan

### Automated Tests
- 없음 (순수 웹 애플리케이션으로 수동 화면 검증 진행)

### Manual Verification
1. `npm run dev` 명령어로 Next.js 개발 서버 구동 (포트 3000)
2. `http://localhost:3000` 접속 시 기존 다크모드 대시보드가 완벽히 표시되는지 확인
3. 팀원 추가/삭제, JQL 빌더, Mock 데이터 자동 생성 기능 확인
4. Jira API 연결 설정을 활성화하고 데이터를 호출하여 Next.js Route Handler 프록시가 연동되는지 검증
