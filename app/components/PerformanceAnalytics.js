'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  analyzeMonthlyPerformance,
  generateTimeSeriesData,
  generateInsights,
  generatePerformanceReport,
  generateCSV,
  predictNextMonth
} from '../utils/analytics';
import { format } from 'date-fns';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

export default function PerformanceAnalytics({
  tickets,
  projectKey,
  setProjectKey,
  teamMembers,
  setTeamMembers,
  dateStart,
  dateEnd,
  setDateStart,
  setDateEnd,
  onFetch,
  isLoading
}) {
  const [viewMode, setViewMode] = useState('trend'); // 'trend' | 'comparison' | 'insights'
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
  const [timeRange, setTimeRange] = useState(6); // 몇 개월 볼지
  const [excludedTicketKeys, setExcludedTicketKeys] = useState(new Set());

  // 티켓 데이터가 새로 조회되면 제외 목록 초기화
  useEffect(() => {
    setExcludedTicketKeys(new Set());
  }, [tickets]);

  // 체크박스에서 제외된 티켓을 필터링한 활성 티켓 목록
  const activeTickets = useMemo(() => {
    if (!tickets || tickets.length === 0) return [];
    return tickets.filter(t => !excludedTicketKeys.has(t.key));
  }, [tickets, excludedTicketKeys]);

  const analysis = useMemo(() => {
    return analyzeMonthlyPerformance(activeTickets);
  }, [activeTickets]);

  const timeSeriesData = useMemo(() => {
    return generateTimeSeriesData(activeTickets, timeRange, dateStart, dateEnd);
  }, [activeTickets, timeRange, dateStart, dateEnd]);

  const insights = useMemo(() => {
    return generateInsights(activeTickets, analysis);
  }, [activeTickets, analysis]);

  const predictions = useMemo(() => {
    return predictNextMonth(activeTickets);
  }, [activeTickets]);

  const summaryStats = useMemo(() => {
    if (!activeTickets || activeTickets.length === 0) {
      return { total: 0, completed: 0, inProgress: 0, completionRate: 0 };
    }
    const total = activeTickets.length;
    const completed = activeTickets.filter(t => {
      const st = (t.status || '').toLowerCase();
      return st.includes('done') || st.includes('resolved') || st.includes('완료') || st.includes('closed') || st.includes('성공');
    }).length;
    const inProgress = activeTickets.filter(t => {
      const st = (t.status || '').toLowerCase();
      return st.includes('progress') || st.includes('진행') || st.includes('doing') || st.includes('개발') || st.includes('selected') || st.includes('working');
    }).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, completionRate };
  }, [activeTickets]);

  // 원본 티켓 기준으로 MVP 및 고WIP 담당자 식별 (체크박스 목록 렌더링용)
  const { mvpMember, wipMembers } = useMemo(() => {
    if (!tickets || tickets.length === 0) return { mvpMember: null, wipMembers: [] };
    const byAssignee = {};
    tickets.forEach(t => {
      if (!byAssignee[t.assignee]) byAssignee[t.assignee] = { completed: 0, inProgress: 0 };
      const st = (t.status || '').toLowerCase();
      if (st.includes('done') || st.includes('resolved') || st.includes('완료') || st.includes('closed')) {
        byAssignee[t.assignee].completed++;
      } else if (st.includes('progress') || st.includes('진행') || st.includes('doing') || st.includes('개발')) {
        byAssignee[t.assignee].inProgress++;
      }
    });
    let topMember = null;
    let topCompleted = 0;
    const wipList = [];
    Object.keys(byAssignee).forEach(a => {
      if (byAssignee[a].completed > topCompleted) {
        topCompleted = byAssignee[a].completed;
        topMember = a;
      }
      if (byAssignee[a].inProgress > 5) wipList.push(a);
    });
    return { mvpMember: topMember, wipMembers: wipList };
  }, [tickets]);

  const handleToggleTicket = (ticketKey) => {
    setExcludedTicketKeys(prev => {
      const next = new Set(prev);
      if (next.has(ticketKey)) {
        next.delete(ticketKey);
      } else {
        next.add(ticketKey);
      }
      return next;
    });
  };

  const handleDownloadMonthlyReport = () => {
    const report = generatePerformanceReport(tickets, analysis, 'monthly');
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Monthly_Performance_${format(new Date(), 'yyyy-MM')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadYearlyReport = () => {
    const report = generatePerformanceReport(tickets, analysis, 'yearly');
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Yearly_Performance_${format(new Date(), 'yyyy')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV(analysis.summary);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Performance_Data_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = (type) => {
    const report = generatePerformanceReport(tickets, analysis, type);
    navigator.clipboard.writeText(report)
      .then(() => alert(`${type === 'monthly' ? '월별' : '연간'} 실적 보고서가 클립보드에 복사되었습니다.`))
      .catch(() => alert('복사 중 오류가 발생했습니다.'));
  };

  return (
    <div className="analytics-container">
      {/* 헤더 & 컨트롤 */}
      <div className="analytics-header">
        <div className="analytics-title">
          <h3>📊 담당자별 실적 분석</h3>
          <p>프로젝트: {projectKey} | 기간: {dateStart} ~ {dateEnd}</p>
        </div>
        <div className="analytics-controls" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* 프로젝트 키 & 팀원 입력 */}
          <div className="control-group">
            <label htmlFor="analytics-project-key">프로젝트:</label>
            <input
              type="text"
              id="analytics-project-key"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              placeholder="예: DI26"
              className="select-input"
              style={{ width: '80px' }}
            />
          </div>
          <div className="control-group">
            <label htmlFor="analytics-team-members">팀원:</label>
            <input
              type="text"
              id="analytics-team-members"
              value={teamMembers}
              onChange={(e) => setTeamMembers(e.target.value)}
              placeholder="홍길동, 김철수"
              className="select-input"
              style={{ width: '200px' }}
            />
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>

          {/* 기간 입력 */}
          <div className="control-group">
            <label htmlFor="analytics-date-start">시작일:</label>
            <input
              type="date"
              id="analytics-date-start"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="select-input"
            />
          </div>
          <div className="control-group">
            <label htmlFor="analytics-date-end">종료일:</label>
            <input
              type="date"
              id="analytics-date-end"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="select-input"
            />
          </div>
          <button
            onClick={() => onFetch && onFetch(dateStart, dateEnd)}
            disabled={isLoading}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', height: '36px', display: 'flex', alignItems: 'center' }}
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }}></div>

          <div className="control-group">
            <label>보기 모드:</label>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="select-input">
              <option value="trend">시계열 트렌드</option>
              <option value="comparison">담당자 비교</option>
              <option value="insights">인사이트 & 예측</option>
            </select>
          </div>
          {viewMode === 'trend' && (
            <>
              <div className="control-group">
                <label>차트 타입:</label>
                <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="select-input">
                  <option value="line">라인 차트</option>
                  <option value="bar">바 차트</option>
                </select>
              </div>
              <div className="control-group">
                <label>기간:</label>
                <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))} className="select-input">
                  <option value={3}>최근 3개월</option>
                  <option value={6}>최근 6개월</option>
                  <option value={12}>최근 12개월</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="analytics-loading-state">
          <div className="analytics-spinner"></div>
          <p>실적 데이터를 수집하고 있습니다. 잠시만 기다려 주세요...</p>
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <div className="analytics-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3>분석할 데이터가 없습니다</h3>
          <p>상단의 조회 기간을 확인하신 후 '조회' 버튼을 클릭해 주세요.</p>
        </div>
      ) : (
        <>
          {/* 요약 메트릭 카드 */}
          <div className="analytics-summary-cards">
            <div className="summary-card">
              <div className="card-info">
                <span className="label">전체 수집 티켓</span>
                <span className="value">{summaryStats.total}건</span>
              </div>
              <div className="card-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
            </div>
            <div className="summary-card success">
              <div className="card-info">
                <span className="label">완료한 티켓</span>
                <span className="value">{summaryStats.completed}건</span>
              </div>
              <div className="card-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <div className="summary-card accent">
              <div className="card-info">
                <span className="label">진행 중인 업무</span>
                <span className="value">{summaryStats.inProgress}건</span>
              </div>
              <div className="card-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
              </div>
            </div>
            <div className="summary-card warning">
              <div className="card-info">
                <span className="label">팀 전체 완료율</span>
                <span className="value">{summaryStats.completionRate}%</span>
              </div>
              <div className="card-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
            </div>
          </div>

          {/* 다운로드 버튼 */}
          <div className="analytics-actions">
            <button onClick={handleDownloadMonthlyReport} className="btn btn-secondary btn-sm">
              📄 월별 리포트 다운로드
            </button>
            <button onClick={handleDownloadYearlyReport} className="btn btn-secondary btn-sm">
              📅 연간 리포트 다운로드
            </button>
            <button onClick={handleDownloadCSV} className="btn btn-primary btn-sm">
              📊 CSV 내보내기
            </button>
            <button onClick={() => handleCopyReport('monthly')} className="btn btn-secondary btn-sm">
              📋 월별 보고서 복사
            </button>
          </div>

          {/* 메인 컨텐츠 */}
          {viewMode === 'trend' && (
            <div className="analytics-content">
              <div className="chart-section card">
                <h4>월별 완료 티켓 추이</h4>
                <ResponsiveContainer width="100%" height={400}>
                  {chartType === 'line' ? (
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      {analysis.summary.map((member, idx) => (
                        <Line
                          key={member.assignee}
                          type="monotone"
                          dataKey={member.assignee}
                          stroke={COLORS[idx % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      {analysis.summary.map((member, idx) => (
                        <Bar
                          key={member.assignee}
                          dataKey={member.assignee}
                          fill={COLORS[idx % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {viewMode === 'comparison' && (
            <div className="analytics-content">
              <div className="comparison-grid">
                {/* 완료 건수 비교 */}
                <div className="chart-section card">
                  <h4>완료 건수 비교</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analysis.summary} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#888" />
                      <YAxis dataKey="assignee" type="category" stroke="#888" width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Bar dataKey="completed" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 완료율 파이 차트 */}
                <div className="chart-section card">
                  <h4>담당자별 완료 비율</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analysis.summary}
                        dataKey="completed"
                        nameKey="assignee"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        label={(entry) => `${entry.assignee}: ${entry.completed}건`}
                      >
                        {analysis.summary.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 담당자별 티켓 상태 누적 비교 (Stacked Bar Chart) */}
                <div className="chart-section card" style={{ gridColumn: 'span 2' }}>
                  <h4>담당자별 티켓 상태 누적 비교</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analysis.summary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="assignee" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="completed" name="완료 (Done)" fill="#10b981" stackId="a" />
                      <Bar dataKey="inProgress" name="진행 중 (In Progress)" fill="#3b82f6" stackId="a" />
                      <Bar dataKey="todo" name="대기 중 (To Do)" fill="#f59e0b" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 상세 테이블 */}
              <div className="performance-table card">
                <h4>상세 실적 순위</h4>
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>담당자</th>
                      <th>완료</th>
                      <th>진행중</th>
                      <th>대기</th>
                      <th>전체</th>
                      <th>완료율</th>
                      <th>평균완료시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.summary.map((member, idx) => {
                      const rank = idx + 1;
                      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                      return (
                        <tr key={member.assignee}>
                          <td style={{ textAlign: 'center' }}>{medal} {rank}</td>
                          <td><strong>{member.assignee}</strong></td>
                          <td>{member.completed}</td>
                          <td>{member.inProgress}</td>
                          <td>{member.todo}</td>
                          <td>{member.total}</td>
                          <td>
                            <div className="progress-bar-cell">
                              <div className="progress-bar-bg">
                                <div
                                  className="progress-bar-fill"
                                  style={{ width: `${member.completionRate}%` }}
                                ></div>
                              </div>
                              <span>{member.completionRate}%</span>
                            </div>
                          </td>
                          <td>{member.avgCompletionTime || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'insights' && (
            <div className="analytics-content">
              {/* 인사이트 카드 */}
              <div className="insights-section card">
                <h4>🎯 자동 생성 인사이트</h4>
                {excludedTicketKeys.size > 0 && (
                  <p style={{ fontSize: '0.78rem', color: '#f59e0b', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    ⚡ 현재 {excludedTicketKeys.size}건의 티켓이 제외되어 재계산된 결과입니다.
                  </p>
                )}
                <ul className="insights-list">
                  {insights.map((insight, idx) => (
                    <li key={idx} className="insight-item">{insight}</li>
                  ))}
                </ul>
              </div>

              {/* MVP 담당자 전체 티켓 체크리스트 */}
              {mvpMember && tickets && tickets.filter(t => t.assignee === mvpMember).length > 0 && (
                <div className="insights-section card" style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>🏆 MVP 후보: {mvpMember} — 티켓 상세</h4>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: '12px' }}>
                      {tickets.filter(t => t.assignee === mvpMember && !excludedTicketKeys.has(t.key)).length} / {tickets.filter(t => t.assignee === mvpMember).length}건 반영
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 0.75rem' }}>
                    체크 해제 시 해당 티켓이 실적 집계에서 제외되어 인사이트·차트·예측이 즉시 재계산됩니다.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                    {tickets.filter(t => t.assignee === mvpMember).map(t => {
                      const isChecked = !excludedTicketKeys.has(t.key);
                      const st = (t.status || '').toLowerCase();
                      const isDone = st.includes('done') || st.includes('resolved') || st.includes('완료');
                      const isInProg = st.includes('progress') || st.includes('진행');
                      return (
                        <li key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '6px', background: isChecked ? 'rgba(255,255,255,0.04)' : 'transparent', opacity: isChecked ? 1 : 0.4, transition: 'opacity 0.2s ease, background 0.2s ease', cursor: 'pointer' }} onClick={() => handleToggleTicket(t.key)}>
                          <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ accentColor: '#10b981', width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 600, background: isDone ? 'rgba(16,185,129,0.15)' : isInProg ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.08)', color: isDone ? '#10b981' : isInProg ? '#818cf8' : 'rgba(255,255,255,0.6)', flexShrink: 0, minWidth: '65px', textAlign: 'center' }}>{t.status}</span>
                          <span style={{ fontSize: '0.82rem', color: isChecked ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)', flex: 1 }}>
                            <strong>{t.key}</strong>: {t.summary}
                            {t.epic && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginLeft: '0.4rem' }}>({t.epic.key})</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 진행중 티켓이 많은 담당자 전체 티켓 체크리스트 */}
              {wipMembers.filter(m => m !== mvpMember).map(member => {
                const memberTickets = tickets.filter(t => t.assignee === member);
                if (memberTickets.length === 0) return null;
                return (
                  <div key={member} className="insights-section card" style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0 }}>⚠️ 고 WIP 담당자: {member} — 티켓 상세</h4>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(245,158,11,0.1)', padding: '3px 10px', borderRadius: '12px' }}>
                        {memberTickets.filter(t => !excludedTicketKeys.has(t.key)).length} / {memberTickets.length}건 반영
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 0.75rem' }}>
                      체크 해제 시 해당 티켓이 실적 집계에서 제외되어 인사이트·차트·예측이 즉시 재계산됩니다.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                      {memberTickets.map(t => {
                        const isChecked = !excludedTicketKeys.has(t.key);
                        const st = (t.status || '').toLowerCase();
                        const isDone = st.includes('done') || st.includes('resolved') || st.includes('완료');
                        const isInProg = st.includes('progress') || st.includes('진행');
                        return (
                          <li key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '6px', background: isChecked ? 'rgba(255,255,255,0.04)' : 'transparent', opacity: isChecked ? 1 : 0.4, transition: 'opacity 0.2s ease, background 0.2s ease', cursor: 'pointer' }} onClick={() => handleToggleTicket(t.key)}>
                            <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ accentColor: '#f59e0b', width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 600, background: isDone ? 'rgba(16,185,129,0.15)' : isInProg ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.08)', color: isDone ? '#10b981' : isInProg ? '#818cf8' : 'rgba(255,255,255,0.6)', flexShrink: 0, minWidth: '65px', textAlign: 'center' }}>{t.status}</span>
                            <span style={{ fontSize: '0.82rem', color: isChecked ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)', flex: 1 }}>
                              <strong>{t.key}</strong>: {t.summary}
                              {t.epic && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginLeft: '0.4rem' }}>({t.epic.key})</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

              {/* 예측 데이터 */}
              <div className="predictions-section card">
                <h4>🔮 다음 달 예상 실적</h4>
                <p className="prediction-note">* 최근 3개월 평균을 기반으로 한 예측입니다.</p>
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>담당자</th>
                      <th>예상 완료량</th>
                      <th>신뢰도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(predictions).map(assignee => {
                      const pred = predictions[assignee];
                      const confidenceColor = pred.confidence === 'high' ? '#10b981' : pred.confidence === 'medium' ? '#f59e0b' : '#ef4444';
                      const confidenceText = pred.confidence === 'high' ? '높음' : pred.confidence === 'medium' ? '중간' : '낮음';
                      return (
                        <tr key={assignee}>
                          <td><strong>{assignee}</strong></td>
                          <td>약 {pred.predicted}건</td>
                          <td>
                            <span className="confidence-badge" style={{ backgroundColor: confidenceColor }}>
                              {confidenceText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 개선 제안 */}
              <div className="recommendations-section card">
                <h4>💡 개선 제안</h4>
                <div className="recommendation-cards">
                  <div className="recommendation-card">
                    <div className="recommendation-icon">🚀</div>
                    <h5>생산성 향상</h5>
                    <p>WIP(Work In Progress) 제한을 5개 이하로 유지하여 멀티태스킹을 줄이세요.</p>
                  </div>
                  <div className="recommendation-card">
                    <div className="recommendation-icon">⚡</div>
                    <h5>병목 제거</h5>
                    <p>진행 중인 티켓이 오래 머무는 경우 일일 스탠드업에서 블로커를 식별하세요.</p>
                  </div>
                  <div className="recommendation-card">
                    <div className="recommendation-icon">📈</div>
                    <h5>균형 배분</h5>
                    <p>티켓을 팀원 간 균등하게 배분하여 부하를 분산하세요.</p>
                  </div>
                  <div className="recommendation-card">
                    <div className="recommendation-icon">🎯</div>
                    <h5>목표 설정</h5>
                    <p>월별 개인 목표를 설정하고 주간 회고에서 진행 상황을 점검하세요.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
