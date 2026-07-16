import clsx from 'clsx';

const AUTH_STATUS_LABELS = {
  connected: '🟢 Google 계정 연동 완료',
  connecting: '⏳ 연동 중...',
  error: '🔴 연동 실패 — 재인증 필요',
  disconnected: '⚪ 미연동',
};

/**
 * 구글 캘린더 연동 패널 컴포넌트
 * @param {string} authStatus - 연동 상태
 * @param {string} errorMessage - 에러 메시지
 * @param {Function} onConnect - 연동 핸들러
 * @param {Function} onDisconnect - 연동 해제 핸들러
 */
export default function CalendarAuthPanel({
  authStatus,
  errorMessage,
  onConnect,
  onDisconnect,
}) {
  return (
    <>
      <div className={clsx('calendar-auth-status', `calendar-auth-status--${authStatus}`)}>
        <span className="calendar-auth-status__dot"></span>
        <span className="calendar-auth-status__text">
          {AUTH_STATUS_LABELS[authStatus]}
        </span>
      </div>

      {errorMessage && (
        <div className="calendar-auth-error">
          ⚠️ {errorMessage}
        </div>
      )}

      <button
        type="button"
        className={clsx('btn', 'btn-primary', 'btn-google-connect', authStatus === 'connected' && 'btn-google-connect--connected')}
        onClick={onConnect}
        disabled={authStatus === 'connecting'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
        {authStatus === 'connected' ? 'Google 계정 재연동' : 'Google 계정 연동'}
      </button>

      {authStatus === 'connected' && (
        <button
          type="button"
          className="btn btn-secondary btn-full-width-sm"
          onClick={onDisconnect}
        >
          연동 해제
        </button>
      )}
    </>
  );
}
