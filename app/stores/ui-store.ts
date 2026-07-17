import { create } from 'zustand';
import type { ActiveTab, ConnectionStatus, UiStoreSlice } from '../types';

export const useUiStore = create<UiStoreSlice>((set, get) => ({
  mounted: false,
  isConfigLoaded: false,
  isSidebarOpen: true,
  isFilterOpen: true,
  isStatsJqlOpen: true,
  activeTab: 'tab-daily',
  expandedEpics: {},
  connectionStatus: {
    dot: 'accent',
    text: '시뮬레이션 모드 작동 중',
  },

  setMounted: (mounted) => set({ mounted }),
  setConfigLoaded: (isConfigLoaded) => set({ isConfigLoaded }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setFilterOpen: (isFilterOpen) => set({ isFilterOpen }),
  setStatsJqlOpen: (isStatsJqlOpen) => set({ isStatsJqlOpen }),
  setActiveTab: (activeTab: ActiveTab) => set({ activeTab }),
  setConnectionStatus: (connectionStatus: ConnectionStatus) => set({ connectionStatus }),

  toggleEpicCollapse: (epicKey) => {
    const { expandedEpics } = get();
    set({
      expandedEpics: {
        ...expandedEpics,
        [epicKey]: !expandedEpics[epicKey],
      },
    });
  },
}));
