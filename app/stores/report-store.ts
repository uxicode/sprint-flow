import { create } from 'zustand';
import type { ReportStoreSlice } from '../types';

export const useReportStore = create<ReportStoreSlice>((set) => ({
  dailyReportMd: '',
  weeklyReportMd: '',
  etcReportMd: '',
  vacationList: [],

  setReports: ({ dailyReportMd, weeklyReportMd, etcReportMd = '', calendarEvents }) => set({
    dailyReportMd,
    weeklyReportMd,
    etcReportMd,
    vacationList: calendarEvents,
  }),

  resetReports: () => set({
    dailyReportMd: '',
    weeklyReportMd: '',
    etcReportMd: '',
    vacationList: [],
  }),
}));
