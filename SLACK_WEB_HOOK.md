🛠️ Slack Incoming Webhook URL 발급 방법 (4단계)

1. Slack API 사이트 접속 및 App 생성 
https://api.slack.com/apps
Slack API 대시보드에 접속 후 로그인합니다.
우측 상단의 Create New App 버튼을 클릭합니다.
팝업창에서 **From scratch**를 선택합니다.
App Name(예: SprintFlow Bot)을 입력하고, 알림을 받을 Development Slack Workspace를 선택한 뒤 **Create App**을 클릭합니다.

2. Incoming Webhooks 기능 활성화
좌측 메뉴의 Features 아래 **Incoming Webhooks**를 클릭합니다.
상단의 Activate Incoming Webhooks 스위치를 **On**으로 켭니다.

3. 알림 채널 선택 및 Webhook URL 생성
페이지 하단의 Add New Webhook to Workspace 버튼을 클릭합니다.
알림 메시지를 수신할 Slack 채널(예: #일일보고서, #general 등)을 선택하고 **Allow (허용)**를 클릭합니다.

4. Webhook URL 복사 및 Vercel 등록
생성된 목록 하단에서 https://hooks.slack.com/services/T.../B.../XXXX... 형태의 Webhook URL을 복사합니다.
Vercel 프로젝트 설정의 Environment Variables에 아래와 같이 등록하시면 됩니다:
Key: SLACK_WEBHOOK_URL
Value: 복사한 Webhook URL 전체