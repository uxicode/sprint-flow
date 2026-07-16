/**
 * 진행 바 채우기 컴포넌트
 * @param {number} progress - 진행률
 * @param {string} className - 클래스 이름
 * @param {ReactNode} children - 자식 요소
 */
export default function ProgressFill({ progress, className = 'fill', children }) {
  return (
    <div className={className} style={{ '--progress': `${progress}%` }}>
      {children}
    </div>
  );
}
