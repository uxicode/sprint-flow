const EMPTY_MESSAGE = '<p class="empty-message">가져온 티켓이 없습니다. 상단에서 필터를 채운 후 티켓 가져오기를 실행해 주세요.</p>';

/**
 * 마크다운 보고서 뷰 컴포넌트
 * @param {string} html - 마크다운 HTML
 */
export default function MarkdownReportView({ html }) {
  return (
    <div className="report-editor-container">
      <div
        className="markdown-preview"
        dangerouslySetInnerHTML={{ __html: html || EMPTY_MESSAGE }}
      ></div>
    </div>
  );
}
