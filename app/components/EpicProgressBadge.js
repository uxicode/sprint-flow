import ProgressFill from './ProgressFill';

/**
 * 에픽 진행 바 컴포넌트
 * @param {string} label - 라벨
 * @param {number} progress - 진행 바 진행률
 * @param {number} doneCount - 완료된 티켓 수
 * @param {number} totalCount - 총 티켓 수
 * @param {string} variant - 배지 변경
 */
export default function EpicProgressBadge({ label, progress, doneCount, totalCount, variant }) {
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
