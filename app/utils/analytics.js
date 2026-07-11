import { groupBy, sumBy, meanBy, orderBy } from 'lodash';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, differenceInDays, parseISO } from 'date-fns';

/**
 * 담당자별 월별 실적 집계
 * @param {Array} tickets - Jira 티켓 배열
 * @returns {Object} 월별 담당자별 집계 데이터
 */
export function analyzeMonthlyPerformance(tickets) {
  if (!tickets || tickets.length === 0) {
    return {
      byMonth: {},
      byAssignee: {},
      summary: []
    };
  }

  // 날짜별로 그룹화
  const ticketsByMonth = groupBy(tickets, (ticket) => {
    if (!ticket.updated) return 'unknown';
    return format(parseISO(ticket.updated), 'yyyy-MM');
  });

  // 담당자별로 그룹화
  const ticketsByAssignee = groupBy(tickets, 'assignee');

  // 월별 담당자별 상세 데이터 구축
  const byMonth = {};
  Object.keys(ticketsByMonth).forEach(month => {
    if (month === 'unknown') return;
    
    const monthTickets = ticketsByMonth[month];
    const assigneeGroups = groupBy(monthTickets, 'assignee');
    
    byMonth[month] = Object.keys(assigneeGroups).map(assignee => {
      const assigneeTickets = assigneeGroups[assignee];
      const completed = assigneeTickets.filter(t => getStatusCategory(t.status) === 'Done').length;
      const inProgress = assigneeTickets.filter(t => getStatusCategory(t.status) === 'In Progress').length;
      const todo = assigneeTickets.length - completed - inProgress;
      
      return {
        assignee,
        total: assigneeTickets.length,
        completed,
        inProgress,
        todo,
        completionRate: assigneeTickets.length > 0 ? Math.round((completed / assigneeTickets.length) * 100) : 0
      };
    });
  });

  // 담당자별 전체 통계
  const byAssignee = {};
  Object.keys(ticketsByAssignee).forEach(assignee => {
    const assigneeTickets = ticketsByAssignee[assignee];
    const completed = assigneeTickets.filter(t => getStatusCategory(t.status) === 'Done').length;
    const inProgress = assigneeTickets.filter(t => getStatusCategory(t.status) === 'In Progress').length;
    
    byAssignee[assignee] = {
      total: assigneeTickets.length,
      completed,
      inProgress,
      todo: assigneeTickets.length - completed - inProgress,
      completionRate: assigneeTickets.length > 0 ? Math.round((completed / assigneeTickets.length) * 100) : 0,
      avgCompletionTime: calculateAvgCompletionTime(assigneeTickets)
    };
  });

  // 요약 통계 (정렬된 순위)
  const summary = Object.keys(byAssignee).map(assignee => ({
    assignee,
    ...byAssignee[assignee]
  }));

  return {
    byMonth,
    byAssignee,
    summary: orderBy(summary, ['completed'], ['desc'])
  };
}

/**
 * 시계열 차트용 데이터 생성
 * @param {Array} tickets - Jira 티켓 배열
 * @param {number} monthsBack - 조회할 과거 월 수
 * @returns {Array} 차트용 데이터
 */
export function generateTimeSeriesData(tickets, monthsBack = 6) {
  if (!tickets || tickets.length === 0) return [];

  const endDate = new Date();
  const startDate = subMonths(endDate, monthsBack - 1);
  
  const months = eachMonthOfInterval({ start: startOfMonth(startDate), end: endOfMonth(endDate) });
  
  // 모든 담당자 추출
  const allAssignees = [...new Set(tickets.map(t => t.assignee))];
  
  return months.map(month => {
    const monthKey = format(month, 'yyyy-MM');
    const monthStr = format(month, 'yyyy년 MM월');
    
    const dataPoint = {
      month: monthStr,
      monthKey,
      total: 0
    };
    
    allAssignees.forEach(assignee => {
      const assigneeTickets = tickets.filter(t => {
        if (!t.updated) return false;
        const ticketMonth = format(parseISO(t.updated), 'yyyy-MM');
        return ticketMonth === monthKey && t.assignee === assignee;
      });
      
      const completed = assigneeTickets.filter(t => getStatusCategory(t.status) === 'Done').length;
      dataPoint[assignee] = completed;
      dataPoint.total += completed;
    });
    
    return dataPoint;
  });
}

/**
 * 다음 달 예측 (간단한 이동평균 기반)
 * @param {Array} tickets - Jira 티켓 배열
 * @returns {Object} 담당자별 예측 데이터
 */
export function predictNextMonth(tickets) {
  if (!tickets || tickets.length === 0) return {};

  const last3Months = subMonths(new Date(), 3);
  const recentTickets = tickets.filter(t => {
    if (!t.updated) return false;
    const ticketDate = parseISO(t.updated);
    return ticketDate >= last3Months;
  });

  const byAssignee = groupBy(recentTickets, 'assignee');
  const predictions = {};

  Object.keys(byAssignee).forEach(assignee => {
    const assigneeTickets = byAssignee[assignee];
    const completedTickets = assigneeTickets.filter(t => getStatusCategory(t.status) === 'Done');
    
    // 3개월 평균
    const avgPerMonth = Math.round(completedTickets.length / 3);
    
    predictions[assignee] = {
      predicted: avgPerMonth,
      confidence: completedTickets.length >= 5 ? 'high' : completedTickets.length >= 2 ? 'medium' : 'low'
    };
  });

  return predictions;
}

/**
 * 자동 인사이트 생성
 * @param {Array} tickets - Jira 티켓 배열
 * @param {Object} analysis - 분석 결과
 * @returns {Array} 인사이트 문자열 배열
 */
export function generateInsights(tickets, analysis) {
  const insights = [];

  if (!tickets || tickets.length === 0 || !analysis.summary || analysis.summary.length === 0) {
    insights.push('📊 티켓 데이터를 불러와 분석을 시작하세요.');
    return insights;
  }

  // MVP 찾기
  const topPerformer = analysis.summary[0];
  if (topPerformer) {
    insights.push(`🏆 이번 기간 MVP는 ${topPerformer.assignee}님입니다! (완료: ${topPerformer.completed}건, 완료율: ${topPerformer.completionRate}%)`);
  }

  // 팀 전체 완료율
  const totalCompleted = sumBy(analysis.summary, 'completed');
  const totalTickets = sumBy(analysis.summary, 'total');
  const teamCompletionRate = totalTickets > 0 ? Math.round((totalCompleted / totalTickets) * 100) : 0;
  insights.push(`📈 팀 전체 완료율: ${teamCompletionRate}% (완료 ${totalCompleted}건 / 전체 ${totalTickets}건)`);

  // 평균 대비 높은 성과자
  const avgCompleted = meanBy(analysis.summary, 'completed');
  const highPerformers = analysis.summary.filter(s => s.completed > avgCompleted * 1.2);
  if (highPerformers.length > 0) {
    const names = highPerformers.map(p => p.assignee).join(', ');
    insights.push(`⭐ 팀 평균 대비 20% 이상 높은 성과: ${names}`);
  }

  // 진행중인 티켓이 많은 경우 경고
  const highWipMembers = analysis.summary.filter(s => s.inProgress > 5);
  if (highWipMembers.length > 0) {
    const names = highWipMembers.map(p => `${p.assignee}(${p.inProgress}건)`).join(', ');
    insights.push(`⚠️ 진행중인 티켓이 많습니다: ${names} - WIP 제한을 고려하세요.`);
  }

  // 완료율이 낮은 경우
  const lowCompletionMembers = analysis.summary.filter(s => s.completionRate < 30 && s.total >= 3);
  if (lowCompletionMembers.length > 0) {
    const names = lowCompletionMembers.map(p => p.assignee).join(', ');
    insights.push(`💡 완료율 개선이 필요합니다: ${names} - 블로커 확인을 권장합니다.`);
  }

  // 예측 데이터 추가
  const predictions = predictNextMonth(tickets);
  const totalPredicted = sumBy(Object.values(predictions), 'predicted');
  if (totalPredicted > 0) {
    insights.push(`🔮 다음 달 예상 완료량: 약 ${totalPredicted}건 (최근 3개월 평균 기반)`);
  }

  return insights;
}

/**
 * 월별/연간 리포트 마크다운 생성
 * @param {Array} tickets - Jira 티켓 배열
 * @param {Object} analysis - 분석 결과
 * @param {string} reportType - 'monthly' | 'yearly'
 * @returns {string} 마크다운 문자열
 */
export function generatePerformanceReport(tickets, analysis, reportType = 'monthly') {
  const now = new Date();
  const dateStr = format(now, 'yyyy-MM-dd HH:mm:ss');
  
  let md = '';
  
  if (reportType === 'monthly') {
    const monthStr = format(now, 'yyyy년 MM월');
    md += `# 📊 ${monthStr} 담당자별 실적 보고서\n\n`;
    md += `> **생성 일시**: ${dateStr}\n\n`;
  } else {
    const yearStr = format(now, 'yyyy년');
    md += `# 📅 ${yearStr} 연간 담당자별 실적 보고서\n\n`;
    md += `> **생성 일시**: ${dateStr}\n\n`;
  }

  // 인사이트 섹션
  const insights = generateInsights(tickets, analysis);
  md += `## 🎯 주요 인사이트\n\n`;
  insights.forEach(insight => {
    md += `- ${insight}\n`;
  });
  md += `\n`;

  // 담당자별 상세 실적
  md += `## 👥 담당자별 상세 실적\n\n`;
  md += `| 순위 | 담당자 | 완료 | 진행중 | 대기 | 전체 | 완료율 | 평균완료시간 |\n`;
  md += `|:----:|:-------|-----:|-------:|-----:|-----:|-------:|-------------:|\n`;
  
  analysis.summary.forEach((member, index) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}위`;
    md += `| ${medal} | **${member.assignee}** | ${member.completed} | ${member.inProgress} | ${member.todo} | ${member.total} | ${member.completionRate}% | ${member.avgCompletionTime || 'N/A'} |\n`;
  });
  md += `\n`;

  // 월별 트렌드 (연간 보고서의 경우)
  if (reportType === 'yearly' && analysis.byMonth) {
    md += `## 📈 월별 실적 트렌드\n\n`;
    const sortedMonths = Object.keys(analysis.byMonth).sort();
    
    sortedMonths.forEach(month => {
      const monthData = analysis.byMonth[month];
      const totalCompleted = sumBy(monthData, 'completed');
      md += `### ${month}\n`;
      md += `- 총 완료: ${totalCompleted}건\n`;
      monthData.forEach(m => {
        md += `  - ${m.assignee}: ${m.completed}건 완료\n`;
      });
      md += `\n`;
    });
  }

  // 다음 달 예측
  const predictions = predictNextMonth(tickets);
  if (Object.keys(predictions).length > 0) {
    md += `## 🔮 다음 달 예상 실적\n\n`;
    md += `*(최근 3개월 평균 기반 예측)*\n\n`;
    md += `| 담당자 | 예상 완료량 | 신뢰도 |\n`;
    md += `|:-------|------------:|:------:|\n`;
    Object.keys(predictions).forEach(assignee => {
      const pred = predictions[assignee];
      const confidenceEmoji = pred.confidence === 'high' ? '🟢' : pred.confidence === 'medium' ? '🟡' : '🔴';
      md += `| ${assignee} | 약 ${pred.predicted}건 | ${confidenceEmoji} ${pred.confidence} |\n`;
    });
    md += `\n`;
  }

  return md;
}

/**
 * CSV 내보내기용 데이터 생성
 * @param {Array} summary - 분석 요약 데이터
 * @returns {string} CSV 문자열
 */
export function generateCSV(summary) {
  if (!summary || summary.length === 0) return '';

  let csv = '순위,담당자,완료,진행중,대기,전체,완료율(%),평균완료시간\n';
  
  summary.forEach((member, index) => {
    csv += `${index + 1},${member.assignee},${member.completed},${member.inProgress},${member.todo},${member.total},${member.completionRate},${member.avgCompletionTime || 'N/A'}\n`;
  });

  return csv;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

function getStatusCategory(statusName) {
  const status = (statusName || '').toLowerCase().trim();
  if (status.includes('done') || status.includes('resolved') || status.includes('완료') || status.includes('closed') || status.includes('성공')) {
    return 'Done';
  }
  if (status.includes('progress') || status.includes('진행') || status.includes('doing') || status.includes('개발') || status.includes('selected') || status.includes('working')) {
    return 'In Progress';
  }
  return 'To Do';
}

function calculateAvgCompletionTime(tickets) {
  const completedTickets = tickets.filter(t => getStatusCategory(t.status) === 'Done' && t.updated);
  
  if (completedTickets.length === 0) return null;

  // created 필드가 없으므로 updated 기준으로 대략적인 시간 계산
  // 실제로는 created 필드가 있어야 정확한 계산 가능
  // 여기서는 평균적으로 티켓당 소요 시간을 추정
  const dates = completedTickets.map(t => parseISO(t.updated));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const daysDiff = differenceInDays(maxDate, minDate);
  
  if (daysDiff === 0 || completedTickets.length <= 1) return '< 1일';
  
  const avgDays = Math.round(daysDiff / completedTickets.length);
  return `${avgDays}일`;
}
