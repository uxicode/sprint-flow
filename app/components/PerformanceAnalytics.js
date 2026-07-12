'use client';

import React, { useMemo, useState } from 'react';
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

export default function PerformanceAnalytics({ tickets, projectKey, dateStart, dateEnd }) {
  const [viewMode, setViewMode] = useState('trend'); // 'trend' | 'comparison' | 'insights'
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
  const [timeRange, setTimeRange] = useState(6); // 몇 개월 볼지

  const analysis = useMemo(() => {
    return analyzeMonthlyPerformance(tickets);
  }, [tickets]);

  const timeSeriesData = useMemo(() => {
    return generateTimeSeriesData(tickets, timeRange);
  }, [tickets, timeRange]);

  const insights = useMemo(() => {
    return generateInsights(tickets, analysis);
  }, [tickets, analysis]);

  const predictions = useMemo(() => {
    return predictNextMonth(tickets);
  }, [tickets]);

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

  if (!tickets || tickets.length === 0) {
    return (
      <div className="analytics-empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3>분석할 데이터가 없습니다</h3>
        <p>티켓 데이터를 먼저 불러와주세요.</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* 헤더 & 컨트롤 */}
      <div className="analytics-header">
        <div className="analytics-title">
          <h3>📊 담당자별 실적 분석</h3>
          <p>기간: {dateStart} ~ {dateEnd}</p>
        </div>
        <div className="analytics-controls">
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
              <h4>담당자별 완료 건수</h4>
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
                    outerRadius={80}
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
            <ul className="insights-list">
              {insights.map((insight, idx) => (
                <li key={idx} className="insight-item">{insight}</li>
              ))}
            </ul>
          </div>

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
    </div>
  );
}
