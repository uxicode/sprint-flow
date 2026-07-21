'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { useUiStore } from '../stores/ui-store';
import type { DockDirection, DockState, UiStoreSlice } from '../types';

interface GenieDockWrapperProps {
  sectionId: 'filter' | 'stats';
  children: React.ReactNode;
}

export default function GenieDockWrapper({ sectionId, children }: GenieDockWrapperProps) {
  const filterDock = useUiStore((s) => (s as UiStoreSlice).filterDock);
  const statsDock = useUiStore((s) => (s as UiStoreSlice).statsDock);
  const setFilterDock = useUiStore((s) => (s as UiStoreSlice).setFilterDock);
  const setStatsDock = useUiStore((s) => (s as UiStoreSlice).setStatsDock);

  const dockState: DockState = sectionId === 'filter' ? filterDock : statsDock;
  const updateDock = useCallback(
    (dock: Partial<DockState>) => {
      if (sectionId === 'filter') setFilterDock(dock);
      else setStatsDock(dock);
    },
    [sectionId, setFilterDock, setStatsDock]
  );

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeZone, setActiveZone] = useState<DockDirection | null>(null);

  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag when clicking drag-handle or header area
    const target = e.target as HTMLElement;
    const isHandle = target.closest('.drag-handle') || target.closest('.section-header');
    if (!isHandle || target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }

    setIsDragging(true);
    hasDraggedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: 0, y: 0 });
    target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    if (Math.hypot(dx, dy) > 5) {
      hasDraggedRef.current = true;
    }

    setDragOffset({ x: dx, y: dy });

    // Determine drop zones based on pointer position in viewport
    const { clientX, clientY } = e;
    const vWidth = window.innerWidth;

    if (clientY < 130) {
      setActiveZone('top');
    } else if (clientX < 380) {
      setActiveZone('left');
    } else if (clientX > vWidth - 250) {
      setActiveZone('right');
    } else {
      setActiveZone(null);
    }
  };

  const [targetVector, setTargetVector] = useState({ x: 0, y: -200 });

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (e.target && 'releasePointerCapture' in (e.target as HTMLElement)) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (activeZone && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const currentCenterX = rect.left + rect.width / 2;
      const currentCenterY = rect.top + rect.height / 2;

      let targetX = 0;
      let targetY = 0;

      const dockEl = document.querySelector(`.dock-bar--${activeZone}`);
      if (dockEl) {
        const dockRect = dockEl.getBoundingClientRect();
        targetX = dockRect.left + dockRect.width / 2 - currentCenterX;
        targetY = dockRect.top + dockRect.height / 2 - currentCenterY;
      } else {
        if (activeZone === 'top') {
          targetX = window.innerWidth / 2 - currentCenterX;
          targetY = 30 - currentCenterY;
        } else if (activeZone === 'left') {
          targetX = 350 - currentCenterX;
          targetY = window.innerHeight / 2 - currentCenterY;
        } else {
          targetX = window.innerWidth - 60 - currentCenterX;
          targetY = window.innerHeight / 2 - currentCenterY;
        }
      }

      setTargetVector({ x: targetX, y: targetY });

      // Trigger Genie docking animation
      updateDock({ position: activeZone, isAnimating: true });
      setTimeout(() => {
        updateDock({ isDocked: true, isAnimating: false });
        setDragOffset({ x: 0, y: 0 });
        setActiveZone(null);
      }, 400);
    } else {
      // Snap back to layout
      setDragOffset({ x: 0, y: 0 });
      setActiveZone(null);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDraggedRef.current = false;
    }
  };

  // Reset drag offset when undocked
  useEffect(() => {
    if (!dockState.isDocked && !dockState.isAnimating) {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [dockState.isDocked, dockState.isAnimating]);

  if (dockState.isDocked && !dockState.isAnimating) {
    return null;
  }

  return (
    <div className="genie-wrapper-relative">
      {/* Drop Zone Indicators while dragging */}
      {isDragging && (
        <div className="genie-drop-overlay">
          <div className={clsx('drop-zone drop-zone--top', activeZone === 'top' && 'active')}>
            <span className="drop-zone-badge">⚡ 상단 보관함 (Genie Drop)</span>
          </div>
          <div className={clsx('drop-zone drop-zone--left', activeZone === 'left' && 'active')}>
            <span className="drop-zone-badge">⚡ 좌측 보관함 (Genie Drop)</span>
          </div>
          <div className={clsx('drop-zone drop-zone--right', activeZone === 'right' && 'active')}>
            <span className="drop-zone-badge">⚡ 우측 보관함 (Genie Drop)</span>
          </div>
        </div>
      )}

      {/* Drag & Genie Animated Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        style={
          {
            transform: isDragging
              ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragOffset.x * 0.02}deg)`
              : undefined,
            transition: isDragging ? 'none' : undefined,
            '--genie-dx': `${targetVector.x}px`,
            '--genie-dy': `${targetVector.y}px`,
          } as React.CSSProperties
        }
        className={clsx(
          'genie-container',
          isDragging && 'is-dragging',
          dockState.isAnimating &&
            (dockState.isDocked
              ? `genie-unfold-${dockState.position || 'top'}`
              : `genie-squeeze-${dockState.position || 'top'}`)
        )}
      >
        {children}
      </div>
    </div>
  );
}
