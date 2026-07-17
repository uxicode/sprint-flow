import type { MouseEventHandler } from 'react';

export interface ReportTabActionsProps {
  onCopy: MouseEventHandler<HTMLButtonElement>;
  onDownload: MouseEventHandler<HTMLButtonElement>;
  onPublishConfluence: MouseEventHandler<HTMLButtonElement>;
}

export default function ReportTabActions({ onCopy, onDownload, onPublishConfluence }: ReportTabActionsProps) {
  return (
    <div className="tab-actions">
      <button type="button" onClick={onCopy} className="btn btn-secondary btn-sm">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        마크다운 복사
      </button>
      <button type="button" onClick={onDownload} className="btn btn-primary btn-sm">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        다운로드 (.md)
      </button>
      <button type="button" onClick={onPublishConfluence} className="btn btn-confluence btn-sm">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        컨플루언스 등록
      </button>
    </div>
  );
}
