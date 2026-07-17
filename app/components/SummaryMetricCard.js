import clsx from 'clsx';

/**
 * 요약 메트릭 카드 컴포넌트
 * @param {string} label - 라벨
 * @param {string} value - 값
 * @param {string} variant - 변경
 * @param {ReactNode} icon - 아이콘
 */
export default function SummaryMetricCard({ label, value, variant, icon, hint }) {
  return (
    <div className={clsx('summary-card', variant)}>
      <div className="card-info">
        <span className="label">{label}</span>
        <span className="value">{value}</span>
        {hint ? <span className="summary-card-hint">{hint}</span> : null}
      </div>
      <div className="card-icon">{icon}</div>
    </div>
  );
}
