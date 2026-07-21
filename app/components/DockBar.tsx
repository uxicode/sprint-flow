'use client';

import React from 'react';
import clsx from 'clsx';
import { useUiStore } from '../stores/ui-store';
import type { DockDirection, UiStoreSlice } from '../types';

export default function DockBar() {
  const filterDock = useUiStore((s) => (s as UiStoreSlice).filterDock);
  const statsDock = useUiStore((s) => (s as UiStoreSlice).statsDock);
  const undockSection = useUiStore((s) => (s as UiStoreSlice).undockSection);

  const filterDocked = filterDock.isDocked && !filterDock.isAnimating;
  const statsDocked = statsDock.isDocked && !statsDock.isAnimating;

  if (!filterDocked && !statsDocked) {
    return null;
  }

  const renderDockItem = (
    sectionId: 'filter' | 'stats',
    title: string,
    iconSvg: React.ReactNode,
    position: DockDirection
  ) => {
    return (
      <button
        key={`${sectionId}-${position}`}
        type="button"
        className={clsx('dock-pill', `dock-pill--${position}`)}
        onClick={() => undockSection(sectionId)}
        title={`${title} 복원하기 (Genie Unfold)`}
        aria-label={`${title} 복원하기`}
      >
        <span className="dock-pill-icon">{iconSvg}</span>
        <span className="dock-pill-label">{title}</span>
        <span className="dock-pill-restore-hint">↺ 복원</span>
      </button>
    );
  };

  const positions: DockDirection[] = ['top', 'left', 'right'];

  return (
    <>
      {positions.map((pos) => {
        const hasFilter = filterDocked && filterDock.position === pos;
        const hasStats = statsDocked && statsDock.position === pos;

        if (!hasFilter && !hasStats) return null;

        return (
          <div key={`dock-bar-${pos}`} className={clsx('dock-bar', `dock-bar--${pos}`)}>
            {hasFilter &&
              renderDockItem(
                'filter',
                '티켓 필터 조건',
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>,
                pos
              )}
            {hasStats &&
              renderDockItem(
                'stats',
                '티켓 상태 분포',
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>,
                pos
              )}
          </div>
        );
      })}
    </>
  );
}
