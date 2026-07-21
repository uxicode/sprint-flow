import clsx from 'clsx';
import FormField from '../FormField';
import InputWithAction from '../InputWithAction';
import ToggleSwitch from '../ToggleSwitch';
import CalendarAuthPanel from '../CalendarAuthPanel';
import ChevronIcon from '../icons/ChevronIcon';
import { useUiStore } from '../../stores/ui-store';
import { useSettingsActions } from '../../hooks/use-settings-actions';

interface UiStoreSlice {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface AppSidebarProps {
  onLogout?: () => void;
}

export default function AppSidebar({ onLogout }: AppSidebarProps) {
  const isOpen = useUiStore((s) => (s as UiStoreSlice).isSidebarOpen);
  const setSidebarOpen = useUiStore((s) => (s as UiStoreSlice).setSidebarOpen);
  const settings = useSettingsActions();

  const {
    url, setUrl,
    email, setEmail,
    token, setToken,
    confluenceSpace, setConfluenceSpace,
    confluenceParentId, setConfluenceParentId,
    calendarId, setCalendarId,
    calendarClientId, setCalendarClientId,
    calendarClientSecret, setCalendarClientSecret,
    calendarAuthStatus,
    calendarErrorMessage,
    apiMode,
    newMemberName, setNewMemberName,
    registeredMembers,
    handleSaveSettings,
    handleApiToggle,
    handleAddTeamMember,
    handleRemoveTeamMember,
    handleGoogleCalendarConnect,
    handleGoogleCalendarDisconnect,
  } = settings;

  return (
    <aside className={clsx('sidebar', !isOpen && 'collapsed')}>
      <div className="brand">
        <svg className="brand-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1>SprintFlow</h1>
        <span className="badge">NEXT.JS</span>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="사이드바 닫기"
          title="사이드바 닫기"
        >
          <ChevronIcon />
        </button>
      </div>

      <nav className="settings-panel">
        <h2>Jira API 설정</h2>
        <FormField id="jira-url" label="Jira URL" type="url" placeholder="https://your-domain.atlassian.net" value={url} onChange={(e) => setUrl(e.target.value)} />
        <FormField id="jira-email" label="이메일" type="email" placeholder="user@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormField id="jira-token" label="API Token" type="password" placeholder="ATATT..." value={token} onChange={(e) => setToken(e.target.value)} />
        <FormField id="confluence-space" label="Confluence Space Key" placeholder="PROJ" value={confluenceSpace} onChange={(e) => setConfluenceSpace(e.target.value)} />
        <FormField id="confluence-parent-id" label="Confluence 부모 페이지 ID (선택)" placeholder="3792306206" value={confluenceParentId} onChange={(e) => setConfluenceParentId(e.target.value)} />

        <div className="setting-group-divider"></div>

        <h2 className="settings-panel-subtitle">회사 캘린더 설정</h2>
        <FormField id="calendar-id" label="Calendar ID" placeholder="company.com_xxx@group.calendar.google.com" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} />
        <FormField id="calendar-client-id" label="OAuth Client ID" placeholder="xxxxxxx.apps.googleusercontent.com" value={calendarClientId} onChange={(e) => setCalendarClientId(e.target.value)} />
        <FormField id="calendar-client-secret" label="OAuth Client Secret" type="password" placeholder="GOCSPX-..." value={calendarClientSecret} onChange={(e) => setCalendarClientSecret(e.target.value)} />

        <CalendarAuthPanel
          authStatus={calendarAuthStatus}
          errorMessage={calendarErrorMessage}
          onConnect={handleGoogleCalendarConnect}
          onDisconnect={handleGoogleCalendarDisconnect}
        />

        <ToggleSwitch
          id="mode-toggle"
          label="API 모드 활성화"
          checked={apiMode}
          onChange={handleApiToggle}
          description="비활성화 시 데모용 Mock 데이터가 로드됩니다."
        />
        <button type="button" onClick={handleSaveSettings} className="btn btn-secondary">설정 저장</button>

        <hr className="panel-divider" />

        <h2>팀원 관리</h2>
        <InputWithAction
          id="new-member"
          label="팀원 추가"
          placeholder="이름 또는 ID 입력"
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTeamMember()}
          actionLabel="추가"
          onAction={handleAddTeamMember}
        />
        <FormField variant="setting" as="custom" label="등록된 팀원 목록">
          <ul className="member-list">
            {registeredMembers.map((member: string, idx: number) => (
              <li key={idx} className="member-list-item">
                <span>{member}</span>
                <button type="button" className="btn-remove-member" onClick={() => handleRemoveTeamMember(member)}>&times;</button>
              </li>
            ))}
          </ul>
        </FormField>
      </nav>

      <div className="footer-info">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="btn btn-secondary"
            style={{
              width: '100%',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'rgba(255, 8, 68, 0.12)',
              borderColor: 'rgba(255, 8, 68, 0.3)',
              color: '#ff6b8b',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            관리자 로그아웃
          </button>
        )}
        <p>© 2026 SprintFlow Inc.</p>
        <p>Next.js Integrated</p>
      </div>
    </aside>
  );
}
