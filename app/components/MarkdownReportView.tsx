const EMPTY_MESSAGE = '<p class="empty-message">가져온 티켓이 없습니다. 상단에서 필터를 채운 후 티켓 가져오기를 실행해 주세요.</p>';

export interface MarkdownReportViewProps {
  html: string;
}

export default function MarkdownReportView({ html }: MarkdownReportViewProps) {
  return (
    <div className="report-editor-container">
      <div
        className="markdown-preview"
        dangerouslySetInnerHTML={{ __html: html || EMPTY_MESSAGE }}
      ></div>
    </div>
  );
}
