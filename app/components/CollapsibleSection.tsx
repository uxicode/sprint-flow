import clsx from 'clsx';
import ToggleButton from './ToggleButton';
import type { ReactNode } from 'react';

export interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  headerVariant?: 'clickable' | 'plain';
  sectionClassName?: string;
  slideClassName?: string;
  toggleClassName?: string;
  toggleSize?: number;
  children?: ReactNode;
}

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
}: CollapsibleSectionProps) {
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
