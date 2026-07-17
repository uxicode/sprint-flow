import ProgressFill from './ProgressFill';
import type { ProgressBadge } from '../types';

export interface EpicProgressBadgeProps extends Omit<ProgressBadge, 'progress'> {
  progress: number | null;
}

export default function EpicProgressBadge({ label, progress, doneCount, totalCount, variant }: EpicProgressBadgeProps) {
  if (progress === null) return null;

  return (
    <div className={`stat-badge ${variant}`}>
      <span className="label">{label}</span>
      <span className="value">{progress}% ({doneCount}/{totalCount})</span>
      <div className="mini-progress-bar">
        <ProgressFill progress={progress} />
      </div>
    </div>
  );
}
