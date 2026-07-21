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

  filterDock: {
    isDocked: false,
    position: null,
    isAnimating: false,
  },
  statsDock: {
    isDocked: false,
    position: null,
    isAnimating: false,
  },

  setMounted: (mounted) => set({ mounted }),
  setConfigLoaded: (isConfigLoaded) => set({ isConfigLoaded }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setFilterOpen: (isFilterOpen) => set({ isFilterOpen }),
  setStatsJqlOpen: (isStatsJqlOpen) => set({ isStatsJqlOpen }),
  setActiveTab: (activeTab: ActiveTab) => set({ activeTab }),
  setConnectionStatus: (connectionStatus: ConnectionStatus) => set({ connectionStatus }),

  setFilterDock: (dock) =>
    set((state) => ({ filterDock: { ...state.filterDock, ...dock } })),
  setStatsDock: (dock) =>
    set((state) => ({ statsDock: { ...state.statsDock, ...dock } })),

  undockSection: (section) => {
    if (section === 'filter') {
      set((state) => ({
        filterDock: { ...state.filterDock, isAnimating: true },
      }));
      setTimeout(() => {
        set({
          filterDock: { isDocked: false, position: null, isAnimating: false },
        });
      }, 400);
    } else {
      set((state) => ({
        statsDock: { ...state.statsDock, isAnimating: true },
      }));
      setTimeout(() => {
        set({
          statsDock: { isDocked: false, position: null, isAnimating: false },
        });
      }, 400);
    }
  },

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
