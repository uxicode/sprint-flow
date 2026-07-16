import clsx from 'clsx';
import ChevronIcon from './icons/ChevronIcon';

/**
 * 토글 버튼 컴포넌트
 * @param {boolean} isCollapsed - 콜라프스블 여부
 * @param {string} className - 클래스 이름
 * @param {number} size - 크기
 * @param {Function} onClick - 클릭 핸들러
 * @param {Object} rest - 나머지 속성
 */
export default function ToggleButton({ isCollapsed, className, size = 20, onClick, ...rest }) {
  return (
    <button
      type="button"
      className={clsx('btn-toggle', className, isCollapsed && 'is-collapsed')}
      onClick={onClick}
      {...rest}
    >
      <ChevronIcon size={size} />
    </button>
  );
}
