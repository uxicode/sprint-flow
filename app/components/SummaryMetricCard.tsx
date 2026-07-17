import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SummaryMetricCardProps {
  label: string;
  value: string;
  variant?: string;
  icon?: ReactNode;
  hint?: string;
}

export default function SummaryMetricCard({ label, value, variant, icon, hint }: SummaryMetricCardProps) {
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
