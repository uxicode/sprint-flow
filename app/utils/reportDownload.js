import { getStatusCategory, getMemberVacationDates, getVacationMembers } from './jira';

function groupTicketsByEpic(ticketList) {
  const epicsMap = {};
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

function renderEpicSection(epicsMap, includeStatus = false) {
  let section = '';
  const sortedEpicKeys = Object.keys(epicsMap).sort((a, b) => {
    if (a === 'NO_EPIC') return 1;
    if (b === 'NO_EPIC') return -1;
    return a.localeCompare(b);
  });

  sortedEpicKeys.forEach(epicKey => {
    const epic = epicsMap[epicKey];
    section += epicKey === 'NO_EPIC'
      ? `### 🏷️ ${epic.summary}\n`
      : `### 🏷️ 에픽: ${epic.summary} (${epic.key})\n`;

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
  vacationList,
  dateStart,
  dateEnd,
  registeredMembers,
}) {
  if (!weeklyReportMd) return '';

  const parts = weeklyReportMd.split('## 📋 3. 팀원별 상세 업무 진행 현황');
  const part1 = parts[0] || '';

  let section3 = '## 📋 3. 상세 업무 진행 현황\n\n';
  const activeTickets = tickets.filter(t => getStatusCategory(t.status) !== 'To Do');

  if (activeTickets.length === 0) {
    section3 += '* 조회 기간 내 상세 티켓 내역이 없습니다.\n\n';
  } else {
    section3 += renderEpicSection(groupTicketsByEpic(activeTickets), true);
  }

  const activeWeeklyVacations = Array.isArray(vacationList)
    ? (vacationList.length > 0 && typeof vacationList[0] === 'string'
      ? vacationList
      : getVacationMembers(vacationList, dateStart, dateEnd, registeredMembers))
    : [];

  if (activeWeeklyVacations.length > 0) {
    section3 += '### 🏝️ 휴가 및 연차 현황\n';
    activeWeeklyVacations.forEach(member => {
      const vacDates = getMemberVacationDates(vacationList, member, dateStart, dateEnd);
      section3 += `- ${member}: ${vacDates || '연차'}\n`;
    });
    section3 += '\n';
  }

  let section4 = '## 🚀 4. 다음 주 주요 계획 및 이슈 사항\n\n';
  if (nextTickets.length === 0) {
    section4 += '* **마일스톤 점검**: 다음 주 예정된 지라 티켓이 등록되어 있지 않거나 계획을 불러올 수 없습니다.\n';
    section4 += '* **장애 요인**: 예정된 주요 마일스톤에 지연 요소가 없는지 리스크 사전 점검.\n';
  } else {
    section4 += renderEpicSection(groupTicketsByEpic(nextTickets), false);
  }

  return `${part1.trimEnd()}\n\n${section3.trimEnd()}\n\n${section4.trimEnd()}\n`;
}
