import ConnectionStatus from '../ConnectionStatus';

export default function DashboardHeader({ connectionStatus }) {
  return (
    <header className="main-header">
      <div className="header-title">
        <h2>Dashboard</h2>
        <p>지라 티켓을 분석하고 간편하게 일일/주간 보고서를 생성하세요.</p>
      </div>
      <div className="quick-status">
        <ConnectionStatus dot={connectionStatus.dot} text={connectionStatus.text} />
      </div>
    </header>
  );
}
