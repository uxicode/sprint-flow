import dayjs from 'dayjs';
import { getStatusCategory, isOtherEpicTicket } from './jira';
import type { Ticket, WeeklyExcelPayload } from '../types';

const AREA_LABEL: Record<string, string> = {
  APP: '앱',
  관리자: '관리자',
  수집데이터: '수집서버',
};

function statusLabel(ticket: Ticket): string {
  const category = getStatusCategory(ticket);
  if (category === 'Done') return '완료';
  if (category === 'In Progress') return '진행 중';
  return '대기 중';
}

function cleanTicketSummary(summary: string): string {
  return (summary || '')
    .replace(/^\s*\[[^\]]+\]\s*/, '')
    .replace(/\((?:BE|FE|MO)\)\s*/gi, '')
    .replace(/^\s*\[[^\]]+\]\s*/, '')
    .trim();
}

function parseEpicTitle(summary: string): { tag: string; rest: string } {
  const match = (summary || '').trim().match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return { tag: '', rest: (summary || '').trim() };
  return { tag: match[1].trim(), rest: (match[2] || '').trim() };
}

function formatDateRangeLabel(start: string, end: string): string {
  const startLabel = `${dayjs(start).month() + 1}/${dayjs(start).date()}`;
  const endLabel = `${dayjs(end).month() + 1}/${dayjs(end).date()}`;
  return `${startLabel}~${endLabel}`;
}

function isQaTicket(ticket: Ticket): boolean {
  return /\bQA\b/i.test(`${ticket.epic?.summary || ''} ${ticket.summary || ''}`);
}

function resolveQaArea(ticket: Ticket): string {
  const { tag, rest } = parseEpicTitle(ticket.epic?.summary || '');
  const fromEpic = rest
    .replace(/QA/gi, '')
    .replace(/솔라시도/g, '')
    .replace(/[>:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return fromEpic || AREA_LABEL[tag] || tag || '기타';
}

function buildQaSummaryLine(tickets: Ticket[]): string {
  const counts = new Map<string, Map<string, number>>();
  tickets.forEach((ticket) => {
    const area = resolveQaArea(ticket);
    const label = statusLabel(ticket);
    const byStatus = counts.get(area) || new Map<string, number>();
    byStatus.set(label, (byStatus.get(label) || 0) + 1);
    counts.set(area, byStatus);
  });

  const parts: string[] = [];
  counts.forEach((byStatus, area) => {
    const statuses = Array.from(byStatus, ([label, count]) => `${count}건(${label})`).join(', ');
    parts.push(`${area} QA ${statuses}`);
  });
  return `[솔라시도 QA]  ${parts.join(', ')}`;
}

function buildGroupedReportText(allTickets: Ticket[]): string {
  const qaTickets = allTickets.filter(isQaTicket);
  const tickets = allTickets.filter((ticket) => !isQaTicket(ticket));
  const groups = new Map<string, Map<string, string[]>>();

  tickets.forEach((ticket) => {
    const epicTitle = ticket.epic?.summary || '기타 업무';
    const { tag, rest } = parseEpicTitle(epicTitle);
    const product = /솔라시도/.test(`${tag} ${rest}`) ? '솔라시도' : (tag || '개발');
    const area = AREA_LABEL[tag] || tag || '기타';
    const groupKey = `[${product}]  ${area}:`;
    const feature = rest
      .replace(/^솔라시도\s*(앱)?\s*>?\s*/i, '')
      .replace(/^솔라시도\s*/, '')
      .trim() || rest || epicTitle;
    const line = `- ${feature}: ${cleanTicketSummary(ticket.summary) || ticket.summary} (${statusLabel(ticket)})`;

    if (!groups.has(groupKey)) groups.set(groupKey, new Map());
    const featureMap = groups.get(groupKey)!;
    const lines = featureMap.get(feature) || [];
    lines.push(line);
    featureMap.set(feature, lines);
  });

  const blocks: string[] = [];
  groups.forEach((featureMap, groupKey) => {
    blocks.push(groupKey);
    featureMap.forEach((lines) => {
      lines.forEach((line) => blocks.push(line));
    });
  });

  if (qaTickets.length > 0) blocks.push(buildQaSummaryLine(qaTickets));

  return blocks.join('\n');
}

export function buildWeeklyExcelPayload(
  tickets: Ticket[],
  nextTickets: Ticket[],
  dateStart: string,
  dateEnd: string,
): WeeklyExcelPayload {
  const standardTickets = tickets.filter(t => !isOtherEpicTicket(t));
  const standardNextTickets = nextTickets.filter(t => !isOtherEpicTicket(t));
  return {
    dateStart,
    dateEnd,
    previousWeekText: buildGroupedReportText(standardTickets),
    nextWeekPlanText: buildGroupedReportText(standardNextTickets),
  };
}

export function formatWeekHeader(prefix: string, start: string, end: string, suffix: string): string {
  return `${prefix}(${formatDateRangeLabel(start, end)}) ${suffix}`;
}
