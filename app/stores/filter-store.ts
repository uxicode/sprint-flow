import { create } from 'zustand';
import dayjs from 'dayjs';
import type { FilterStoreSlice } from '../types';

function getDefaultWeekRange() {
  const today = dayjs();
  const mondayStr = today.day() === 0
    ? today.subtract(6, 'day').format('YYYY-MM-DD')
    : today.day(1).format('YYYY-MM-DD');
  const fridayStr = today.day() === 0
    ? today.subtract(2, 'day').format('YYYY-MM-DD')
    : today.day(5).format('YYYY-MM-DD');

  return { dateStart: mondayStr, dateEnd: fridayStr };
}

function getDefaultAnalyticsRange() {
  const today = dayjs();
  return {
    analyticsDateStart: today.startOf('month').format('YYYY-MM-DD'),
    analyticsDateEnd: today.endOf('month').format('YYYY-MM-DD'),
  };
}

export const useFilterStore = create<FilterStoreSlice>((set, get) => ({
  projectKey: 'DI26',
  teamMembers: '',
  dateStart: '',
  dateEnd: '',
  analyticsProjectKey: 'DI26',
  analyticsTeamMembers: '',
  analyticsDateStart: '',
  analyticsDateEnd: '',

  initDefaultDates: () => {
    const week = getDefaultWeekRange();
    const analytics = getDefaultAnalyticsRange();
    set({ ...week, ...analytics });
  },

  setProjectKey: (projectKey) => set({ projectKey }),
  setTeamMembers: (teamMembers) => set({ teamMembers }),
  setDateStart: (dateStart) => set({ dateStart }),
  setDateEnd: (dateEnd) => set({ dateEnd }),
  setAnalyticsProjectKey: (analyticsProjectKey) => set({ analyticsProjectKey }),
  setAnalyticsTeamMembers: (analyticsTeamMembers) => set({ analyticsTeamMembers }),
  setAnalyticsDateStart: (analyticsDateStart) => set({ analyticsDateStart }),
  setAnalyticsDateEnd: (analyticsDateEnd) => set({ analyticsDateEnd }),

  syncFromResolvedSettings: ({ projectKey, teamMembers }) => set({
    projectKey,
    teamMembers,
    analyticsProjectKey: projectKey,
    analyticsTeamMembers: teamMembers,
  }),

  getDashboardFilter: () => {
    const state = get();
    return {
      projectKey: state.projectKey,
      teamMembers: state.teamMembers,
      dateStart: state.dateStart,
      dateEnd: state.dateEnd,
    };
  },

  getAnalyticsFilter: () => {
    const state = get();
    return {
      analyticsProjectKey: state.analyticsProjectKey,
      analyticsTeamMembers: state.analyticsTeamMembers,
      analyticsDateStart: state.analyticsDateStart,
      analyticsDateEnd: state.analyticsDateEnd,
    };
  },

  getScheduleFilter: () => {
    const state = get();
    return {
      projectKey: state.projectKey,
      teamMembers: state.teamMembers,
    };
  },

  getActiveMemberChips: () => {
    return get().teamMembers.split(',').map(m => m.trim()).filter(Boolean);
  },
}));
