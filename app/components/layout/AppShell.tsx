import clsx from 'clsx';
import ChevronIcon from '../icons/ChevronIcon';
import AppSidebar from './AppSidebar';
import DashboardHeader from '../dashboard/DashboardHeader';
import FilterSection from '../dashboard/FilterSection';
import StatsSection from '../dashboard/StatsSection';
import ReportSection from '../dashboard/ReportSection';
import DockBar from '../DockBar';
import { useUiStore } from '../../stores/ui-store';

interface UiStoreSlice {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function AppShell() {
  const isSidebarOpen = useUiStore((s) => (s as UiStoreSlice).isSidebarOpen);
  const setSidebarOpen = useUiStore((s) => (s as UiStoreSlice).setSidebarOpen);

  return (
    <div className={clsx('app-container', !isSidebarOpen && 'sidebar-collapsed')}>
      <button
        type="button"
        className="sidebar-reveal-btn"
        onClick={() => setSidebarOpen(true)}
        aria-label="사이드바 열기"
        title="사이드바 열기"
      >
        <ChevronIcon />
      </button>

      <AppSidebar />

      <main className="main-content">
        <DockBar />
        <DashboardHeader />
        <FilterSection />
        <StatsSection />
        <ReportSection />
      </main>
    </div>
  );
}
