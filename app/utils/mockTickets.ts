import dayjs from 'dayjs';
import type { EpicRef, Ticket } from '../types';

export function generateMockTickets(
  projKey: string,
  membersStr: string,
  start: string,
  end: string,
): Ticket[] {
  const dummyTaskPool = [
    '웹 대시보드 UI 컴포넌트 리팩토링 및 다크모드 대응',
    'Jira REST API 연동 및 JQL 파서 유틸리티 스크립트 작성',
    '일일Standup 업무 보고 마크다운 템플릿 렌더러 설계',
    '주간 업무 요약 SVG 대시보드 차트 컴포넌트 마크업',
    'Clipboard API 활용한 마크다운 클립보드 복사 로직 추가',
    '사용자 설정 패널 값 브라우저 localStorage 저장 로직 연동',
    '사용자 가이드(README.md) 및 CORS 프록시 예제 가이드 작성',
    'QA 버그 리포트: 스크롤 영역 잔상 버그 및 layout shift 현상 수정',
    '팀원 다중 선택 필터 UI 및 동적 쿼리 컴포저 성능 고도화',
    '보고서 템플릿 마크다운 텍스트 저장용 파일 Blob 생성기 구현',
    '기획서 기반 주요 기능 체크리스트 작성 및 task 관리 체계 마련',
    'CSS Nesting 최적화 및 CSS custom properties 토큰 설계 적용',
    '반응형 대응을 위한 @container 쿼리 선언 및 모바일 뷰 보완',
  ];

  const projects = projKey.split(',').map(p => p.trim()).filter(p => p.length > 0);
  const mainProjKey = projects.length > 0 ? projects[0] : 'PROJ';

  const statusOptions = ['Done', 'In Progress', 'To Do'];
  const dummyEpics: EpicRef[] = [
    { key: `${mainProjKey}-10`, summary: '웹 대시보드 리팩토링 및 현대화' },
    { key: `${mainProjKey}-20`, summary: 'Jira & Confluence 오픈 API 연동' },
    { key: `${mainProjKey}-30`, summary: 'UI/UX 고도화 및 사용자 경험 개선' },
  ];
  const result: Ticket[] = [];

  const dateArray: string[] = [];
  let curr = dayjs(start);
  const stop = dayjs(end);
  while (curr.isBefore(stop) || curr.isSame(stop, 'day')) {
    dateArray.push(curr.format('YYYY-MM-DD'));
    curr = curr.add(1, 'day');
  }
  if (dateArray.length === 0) dateArray.push(dayjs().format('YYYY-MM-DD'));

  const members = membersStr.split(',').map(m => m.trim()).filter(m => m.length > 0);
  const targetMembers = members.length > 0 ? members : ['홍길동', '김철수', '이영희'];

  let keyCounter = 101;
  targetMembers.forEach((member) => {
    const memberSeed = member.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const isLongRange = dateArray.length > 30;
    const ticketCount = isLongRange ? 20 : 3;

    for (let i = 0; i < ticketCount; i++) {
      const dummySummary = dummyTaskPool[(memberSeed + i) % dummyTaskPool.length];
      const dummyStatus = statusOptions[i % statusOptions.length];
      const dummyEpic = dummyEpics[(memberSeed + i) % dummyEpics.length];
      const dateIndex = isLongRange
        ? Math.floor((i * dateArray.length) / ticketCount)
        : (i % dateArray.length);
      const dummyDate = dateArray[dateIndex];
      const offsetDays = (memberSeed + i) % 3 === 0 ? 0 : 5;
      const dummyDuedate = dayjs(dummyDate).add(offsetDays, 'day').format('YYYY-MM-DD');
      const currentProj = projects[(memberSeed + i) % projects.length] || mainProjKey;

      result.push({
        key: `${currentProj}-${keyCounter++}`,
        summary: dummySummary,
        status: dummyStatus,
        assignee: member,
        updated: dummyDate,
        created: dummyDate,
        duedate: dummyDuedate,
        epic: dummyEpic,
      });
    }
  });

  return result.sort((a, b) => dayjs(b.updated).valueOf() - dayjs(a.updated).valueOf());
}
