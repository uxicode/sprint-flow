import { create } from 'zustand';
import type { ReportStoreSlice } from '../types';

export const useReportStore = create<ReportStoreSlice>((set) => ({
  dailyReportMd: '',
  weeklyReportMd: '',
  vacationList: [],

  setReports: ({ dailyReportMd, weeklyReportMd, calendarEvents }) => set({
    dailyReportMd,
    weeklyReportMd,
    vacationList: calendarEvents,
  }),

  resetReports: () => set({
    dailyReportMd: '',
    weeklyReportMd: '',
    vacationList: [],
  }),
}));
