import { useEffect } from 'react';
import TabButton from '../TabButton';
import TabPanel from '../TabPanel';
import ReportTabActions from '../ReportTabActions';
import MarkdownReportView from '../MarkdownReportView';
import TicketTable from './TicketTable';
import ScheduleTab from '../schedule/ScheduleTab';
import { useReportActions } from '../../hooks/use-report-actions';

export default function ReportSection() {
  const {
    activeTab,
    handleTabChange,
    dailyReportMd,
    weeklyReportMd,
    tickets,
    parseMarkdownToHtml,
    handleCopyReport,
    handleDownloadReport,
    handlePublishConfluence,
    isDownloading,
  } = useReportActions();

  useEffect(() => {
    if (!isDownloading) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDownloading]);

  return (
    <section className="report-section card">
      {isDownloading && (
        <div
          className="report-download-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-live="polite"
          aria-label="주간 업무 보고서 다운로드 중"
        >
          <div className="report-download-overlay__panel card">
            <div className="analytics-spinner" />
            <p className="report-download-overlay__message">
              주간 업무 보고서를 생성하는 중입니다...
            </p>
            <p className="report-download-overlay__hint">
              일정 데이터를 불러와 에픽 진행률을 계산하고 있습니다. 잠시만 기다려 주세요.
            </p>
            <div className="report-download-progress" aria-hidden="true">
              <div className="report-download-progress__bar" />
            </div>
          </div>
        </div>
      )}

      <div className="report-tabs-header">
        <div className="tabs">
          <TabButton isActive={activeTab === 'tab-daily'} onClick={() => handleTabChange('tab-daily')} disabled={isDownloading}>
            일일 업무 보고서
          </TabButton>
          <TabButton isActive={activeTab === 'tab-weekly'} onClick={() => handleTabChange('tab-weekly')} disabled={isDownloading}>
            주간 업무 보고서
          </TabButton>
          <TabButton isActive={activeTab === 'tab-raw'} onClick={() => handleTabChange('tab-raw')} disabled={isDownloading}>
            조회된 티켓 목록
          </TabButton>
          <TabButton isActive={activeTab === 'tab-schedule'} onClick={() => handleTabChange('tab-schedule')} disabled={isDownloading}>
            🗓️ 일정관리
          </TabButton>
        </div>
        <ReportTabActions
          onCopy={handleCopyReport}
          onDownload={handleDownloadReport}
          onPublishConfluence={handlePublishConfluence}
          disabled={isDownloading}
        />
      </div>

      <div className="tab-content-container">
        <TabPanel isActive={activeTab === 'tab-daily'}>
          <MarkdownReportView html={parseMarkdownToHtml(dailyReportMd)} />
        </TabPanel>
        <TabPanel isActive={activeTab === 'tab-weekly'}>
          <MarkdownReportView html={parseMarkdownToHtml(weeklyReportMd)} />
        </TabPanel>
        <TabPanel isActive={activeTab === 'tab-raw'}>
          <TicketTable tickets={tickets} />
        </TabPanel>
        <TabPanel isActive={activeTab === 'tab-schedule'}>
          <ScheduleTab />
        </TabPanel>
      </div>
    </section>
  );
}
