import type { MouseEventHandler } from 'react';

export interface JqlPreviewProps {
  query: string;
  onCopy: MouseEventHandler<HTMLButtonElement>;
}

export default function JqlPreview({ query, onCopy }: JqlPreviewProps) {
  return (
    <div className="filter-jql-block">
      <div className="filter-jql-header">
        <h4>생성된 Jira JQL 쿼리</h4>
        <button type="button" className="btn-text-copy" onClick={onCopy}>JQL 복사</button>
      </div>
      <div className="jql-body">
        <code>{query}</code>
        <p className="jql-tip">Jira Cloud Advanced Search에 위 쿼리를 그대로 복사해 넣으셔도 조회 가능합니다.</p>
      </div>
    </div>
  );
}
