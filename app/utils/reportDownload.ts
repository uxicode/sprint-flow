import dayjs from 'dayjs';
import { getStatusCategory, getMemberVacationDates, getVacationMembers } from './jira';
import { buildEpicScheduleData } from './schedule';
import type { CalendarEvent, BuildWeeklyDownloadParams, EpicGroup, EpicScheduleItem, Ticket } from '../types';

function formatEpicDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const formatted = dayjs(dateStr);
  return formatted.isValid() ? formatted.format('YY.MM.DD') : null;
}

function formatEpicDateRange(startDate: string, endDate: string): string | null {
  const start = formatEpicDate(startDate);
  const end = formatEpicDate(endDate);
  if (start && end) return `${start} ~ ${end}`;
  return start || end;
}

export function formatGroupProgressBadge(
  label: 'BE' | 'FE' | 'MO',
  progress: number | null,
  doneCount: number,
  totalCount: number,
): string | null {
  if (progress === null || totalCount === 0) return null;
  return `${label}: ${progress}% (${doneCount}/${totalCount})`;
}

export function formatEpicScheduleMeta(meta: EpicScheduleItem | undefined): string {
  if (!meta) return '';

  const parts: string[] = [];
  const dateRange = formatEpicDateRange(meta.startDate, meta.endDate);
  if (dateRange) parts.push(dateRange);

  const progressParts = [
    formatGroupProgressBadge('BE', meta.beProgress, meta.beDoneCount, meta.beCount),
    formatGroupProgressBadge('FE', meta.feProgress, meta.feDoneCount, meta.feCount),
    formatGroupProgressBadge('MO', meta.moProgress, meta.moDoneCount, meta.moCount),
  ].filter((part): part is string => Boolean(part));

  if (progressParts.length > 0) parts.push(progressParts.join(' | '));
  return parts.length > 0 ? ` — ${parts.join(' | ')}` : '';
}

function groupTicketsByEpic(ticketList: Ticket[]): Record<string, EpicGroup> {
  const epicsMap: Record<string, EpicGroup> = {};
  ticketList.forEach(t => {
    const epicKey = t.epic ? t.epic.key : 'NO_EPIC';
    const epicSummary = t.epic ? t.epic.summary : '에픽 없음 (기타 업무)';
    if (!epicsMap[epicKey]) {
      epicsMap[epicKey] = { key: epicKey, summary: epicSummary, tickets: [] };
    }
    epicsMap[epicKey].tickets.push(t);
  });
  return epicsMap;
}

function renderEpicSection(
  epicsMap: Record<string, EpicGroup>,
  epicScheduleByKey: Map<string, EpicScheduleItem>,
  includeStatus = false,
): string {
  let section = '';
  const sortedEpicKeys = Object.keys(epicsMap).sort((a, b) => {
    if (a === 'NO_EPIC') return 1;
    if (b === 'NO_EPIC') return -1;
    return a.localeCompare(b);
  });

  sortedEpicKeys.forEach(epicKey => {
    const epic = epicsMap[epicKey];
    const epicMeta = formatEpicScheduleMeta(epicScheduleByKey.get(epicKey));
    section += epicKey === 'NO_EPIC'
      ? `### 🏷️ ${epic.summary}${epicMeta}\n`
      : `### 🏷️ 에픽: ${epic.summary} (${epic.key})${epicMeta}\n`;

    epic.tickets.forEach(t => {
      let summary = (t.summary || '').trim();
      summary = summary.replace(/^\s*\([A-Za-z0-9가-힣\/\-]+\)\s*/, '').trim();
      if (includeStatus) {
        const cat = getStatusCategory(t.status);
        const statusLabel = cat === 'Done' ? '완료' : cat === 'In Progress' ? '진행 중' : '대기 중';
        section += `- ${summary} (${statusLabel})\n`;
      } else {
        section += `- ${summary}\n`;
      }
    });
    section += '\n';
  });

  return section;
}

export function buildWeeklyDownloadMarkdown({
  weeklyReportMd,
  tickets,
  nextTickets,
  scheduleTickets,
  vacationList,
  dateStart,
  dateEnd,
  registeredMembers,
}: BuildWeeklyDownloadParams): string {
  if (!weeklyReportMd) return '';

  const parts = weeklyReportMd.split('## 📋 3. 팀원별 상세 업무 진행 현황');
  const part1 = parts[0] || '';

  let section3 = '## 📋 3. 상세 업무 진행 현황\n\n';
  const activeTickets = tickets.filter(t => getStatusCategory(t.status) !== 'To Do');
  const progressSourceTickets = scheduleTickets && scheduleTickets.length > 0
    ? scheduleTickets
    : activeTickets;

  if (activeTickets.length === 0) {
    section3 += '* 조회 기간 내 상세 티켓 내역이 없습니다.\n\n';
  } else {
    const epicScheduleByKey = new Map(
      buildEpicScheduleData(progressSourceTickets).map((epic) => [epic.key, epic]),
    );
    section3 += renderEpicSection(groupTicketsByEpic(activeTickets), epicScheduleByKey, true);
  }

  const activeWeeklyVacations: string[] = Array.isArray(vacationList)
    ? (vacationList.length > 0 && typeof vacationList[0] === 'string'
      ? vacationList as string[]
      : getVacationMembers(vacationList, dateStart, dateEnd, registeredMembers))
    : [];

  if (activeWeeklyVacations.length > 0) {
    section3 += '### 🏝️ 휴가 및 연차 현황\n';
    activeWeeklyVacations.forEach(member => {
      const vacDates = Array.isArray(vacationList) && (vacationList.length === 0 || typeof vacationList[0] !== 'string')
        ? getMemberVacationDates(vacationList as CalendarEvent[], member, dateStart, dateEnd)
        : '';
      section3 += `- ${member}: ${vacDates || '연차'}\n`;
    });
    section3 += '\n';
  }

  let section4 = '## 🚀 4. 다음 주 주요 계획 및 이슈 사항\n\n';
  if (nextTickets.length === 0) {
    section4 += '* **마일스톤 점검**: 다음 주 예정된 지라 티켓이 등록되어 있지 않거나 계획을 불러올 수 없습니다.\n';
    section4 += '* **장애 요인**: 예정된 주요 마일스톤에 지연 요소가 없는지 리스크 사전 점검.\n';
  } else {
    section4 += renderEpicSection(groupTicketsByEpic(nextTickets), new Map(), false);
  }

  return `${part1.trimEnd()}\n\n${section3.trimEnd()}\n\n${section4.trimEnd()}\n`;
}
