import dayjs from 'dayjs';
import { getStatusCategory } from './jira';
import type { EpicScheduleItem, GanttData, Ticket } from '../types';

interface EpicAccumulator {
  key: string;
  summary: string;
  tickets: Ticket[];
}

export function buildEpicScheduleData(scheduleTickets: Ticket[]): EpicScheduleItem[] {
  const epicsMap: Record<string, EpicAccumulator> = {};

  scheduleTickets.forEach(t => {
    const epicKey = t.epic ? t.epic.key : 'NO_EPIC';
    const epicSummary = t.epic ? t.epic.summary : '에픽 없음 (기타 업무)';

    if (!epicsMap[epicKey]) {
      epicsMap[epicKey] = {
        key: epicKey,
        summary: epicSummary,
        tickets: [],
      };
    }
    epicsMap[epicKey].tickets.push(t);
  });

  const epicsList = Object.values(epicsMap).map(epic => {
    const beTickets = epic.tickets.filter(t => (t.summary || '').includes('[BE]'));
    const feTickets = epic.tickets.filter(t => (t.summary || '').includes('[FE]'));
    const moTickets = epic.tickets.filter(t => (t.summary || '').includes('[MO]'));
    const otherTickets = epic.tickets.filter(t => {
      const sum = t.summary || '';
      return !sum.includes('[BE]') && !sum.includes('[FE]') && !sum.includes('[MO]');
    });

    const getProgress = (group: Ticket[]): number | null => {
      if (group.length === 0) return null;
      const doneCount = group.filter(t => getStatusCategory(t.status) === 'Done').length;
      return Math.round((doneCount / group.length) * 100);
    };

    const createdDates = epic.tickets.map(t => t.created).filter(Boolean);
    const epicStartDate = createdDates.length > 0 ? createdDates.sort()[0] : '';

    const dueDates = epic.tickets.map(t => t.duedate).filter(Boolean);
    const fallbackDates = epic.tickets.map(t => t.updated).filter(Boolean);
    const epicEndDate = dueDates.length > 0
      ? dueDates.sort().reverse()[0]
      : (fallbackDates.length > 0 ? fallbackDates.sort().reverse()[0] : '');

    return {
      ...epic,
      startDate: epicStartDate,
      endDate: epicEndDate,
      beProgress: getProgress(beTickets),
      feProgress: getProgress(feTickets),
      moProgress: getProgress(moTickets),
      beCount: beTickets.length,
      feCount: feTickets.length,
      moCount: moTickets.length,
      beDoneCount: beTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
      feDoneCount: feTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
      moDoneCount: moTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
      categorizedTickets: {
        BE: beTickets,
        FE: feTickets,
        MO: moTickets,
        OTHER: otherTickets,
      },
    };
  });

  const getLatestUpdate = (epicTickets: Ticket[]): number => {
    if (!epicTickets || epicTickets.length === 0) return 0;
    const dates = epicTickets.map(t => dayjs(t.updated || 0).valueOf());
    return Math.max(...dates);
  };

  return epicsList.sort((a, b) => {
    if (a.key === 'NO_EPIC') return 1;
    if (b.key === 'NO_EPIC') return -1;
    const aLatest = getLatestUpdate(a.tickets);
    const bLatest = getLatestUpdate(b.tickets);
    if (bLatest !== aLatest) return bLatest - aLatest;
    return a.key.localeCompare(b.key);
  });
}

export function buildGanttData(epicScheduleData: EpicScheduleItem[]): GanttData {
  if (epicScheduleData.length === 0) {
    return { epics: [], globalStart: null, globalEnd: null, totalDays: 0, dateMarkers: [] };
  }

  const validEpics = epicScheduleData.filter(e => {
    if (!e.startDate || !e.endDate) return false;
    const summary = (e.summary || '').toLowerCase();
    const key = (e.key || '').toLowerCase();
    return !summary.includes('hotfix') && !summary.includes('핫픽스') && !key.includes('hotfix');
  });

  if (validEpics.length === 0) {
    return { epics: [], globalStart: null, globalEnd: null, totalDays: 0, dateMarkers: [] };
  }

  const startValues = validEpics.map(e => dayjs(e.startDate).valueOf());
  const endValues = validEpics.map(e => dayjs(e.endDate).valueOf());
  const minStart = dayjs(Math.min(...startValues)).subtract(2, 'day');
  const maxEnd = dayjs(Math.max(...endValues)).add(2, 'day');
  const totalDays = maxEnd.diff(minStart, 'day') + 1;

  const dateMarkers: string[] = [];
  const step = Math.max(1, Math.floor(totalDays / 4));
  for (let i = 0; i < 5; i++) {
    dateMarkers.push(minStart.add(i * step, 'day').format('MM.DD'));
  }

  return {
    epics: validEpics,
    globalStart: minStart,
    globalEnd: maxEnd,
    totalDays,
    dateMarkers,
  };
}
