import TabButton from '../TabButton';
import TabPanel from '../TabPanel';
import ReportTabActions from '../ReportTabActions';
import MarkdownReportView from '../MarkdownReportView';
import TicketTable from './TicketTable';
import ScheduleTab from '../schedule/ScheduleTab';

export default function ReportSection({ reports, schedule }) {
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
  } = reports;

  return (
    <section className="report-section card">
      <div className="report-tabs-header">
        <div className="tabs">
          <TabButton isActive={activeTab === 'tab-daily'} onClick={() => handleTabChange('tab-daily')}>
            일일 업무 보고서
          </TabButton>
          <TabButton isActive={activeTab === 'tab-weekly'} onClick={() => handleTabChange('tab-weekly')}>
            주간 업무 보고서
          </TabButton>
          <TabButton isActive={activeTab === 'tab-raw'} onClick={() => handleTabChange('tab-raw')}>
            조회된 티켓 목록
          </TabButton>
          <TabButton isActive={activeTab === 'tab-schedule'} onClick={() => handleTabChange('tab-schedule')}>
            🗓️ 일정관리
          </TabButton>
        </div>
        <ReportTabActions
          onCopy={handleCopyReport}
          onDownload={handleDownloadReport}
          onPublishConfluence={handlePublishConfluence}
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
          <ScheduleTab schedule={schedule} />
        </TabPanel>
      </div>
    </section>
  );
}
