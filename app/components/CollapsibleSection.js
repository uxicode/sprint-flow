import clsx from 'clsx';
import ToggleButton from './ToggleButton';

/**
 * 콜라프스블 섹션 컴포넌트
 * @param {string} title - 섹션 제목
 * @param {boolean} isOpen - 섹션 열림 여부
 * @param {Function} onToggle - 섹션 열림 여부 변경 핸들러
 * @param {string} headerVariant - 헤더 변경
 * @param {string} sectionClassName - 섹션 클래스
 * @param {string} slideClassName - 슬라이드 클래스
 * @param {string} toggleClassName - 토글 클래스
 * @param {number} toggleSize - 토글 크기
 * @param {ReactNode} children - 섹션 내용
 */
export default function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  headerVariant = 'clickable',
  sectionClassName,
  slideClassName = '',
  toggleClassName = '',
  toggleSize = 20,
  children,
}) {
  return (
    <section className={sectionClassName}>
      <div
        className={clsx(
          'section-header',
          headerVariant === 'clickable' ? 'section-header--clickable' : 'section-header--plain'
        )}
        onClick={onToggle}
      >
        <h3 className="section-header__title">{title}</h3>
        <ToggleButton isCollapsed={!isOpen} className={toggleClassName} size={toggleSize} />
      </div>
      <div className={clsx(slideClassName, 'slide-container', isOpen && 'is-open')}>
        {children}
      </div>
    </section>
  );
}
