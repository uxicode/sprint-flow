import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabPanelProps {
  isActive: boolean;
  children?: ReactNode;
}

export default function TabPanel({ isActive, children }: TabPanelProps) {
  return (
    <div className={clsx('tab-content', isActive && 'active')}>
      {children}
    </div>
  );
}
