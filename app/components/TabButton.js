import clsx from 'clsx';

/**
 * 탭 버튼 컴포넌트
 * @param {boolean} isActive - 활성 여부
 * @param {Function} onClick - 클릭 핸들러
 * @param {ReactNode} children - 자식 요소
 */
export default function TabButton({ isActive, onClick, children }) {
  return (
    <button
      type="button"
      className={clsx('tab-btn', isActive && 'active')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
