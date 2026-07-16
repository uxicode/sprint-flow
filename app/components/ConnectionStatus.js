import clsx from 'clsx';

/**
 * 연결 상태 표시 컴포넌트
 * @param {string} dot - 점 상태
 * @param {string} text - 텍스트
 */
export default function ConnectionStatus({ dot, text }) {
  return (
    <div className="status-indicator">
      <span className={clsx('indicator-dot', `indicator-dot--${dot}`)}></span>
      <span>{text}</span>
    </div>
  );
}
