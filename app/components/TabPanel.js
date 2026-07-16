import clsx from 'clsx';

/**
 * 탭 콘텐츠 컴포넌트
 * @param {boolean} isActive - 활성 여부
 * @param {ReactNode} children - 자식 요소
 */
export default function TabPanel({ isActive, children }) {
  return (
    <div className={clsx('tab-content', isActive && 'active')}>
      {children}
    </div>
  );
}
