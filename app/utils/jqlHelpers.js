import dayjs from 'dayjs';
import { JqlQueryBuilder } from './jira';

export function buildJql(projectKey, teamMembers, dateStart, dateEnd) {
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(teamMembers)
    .setDateRange(dateStart, dateEnd, 'updated')
    .build();
}

export function buildNextWeekJql(projectKey, teamMembers, dateStart, dateEnd) {
  const todayStr = dayjs().format('YYYY-MM-DD');
  const start = dateStart || todayStr;
  const end = dateEnd || todayStr;
  const nextStartStr = dayjs(start).add(7, 'day').format('YYYY-MM-DD');
  const nextEndStr = dayjs(end).add(7, 'day').format('YYYY-MM-DD');

  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(teamMembers)
    .setDateRange(nextStartStr, nextEndStr, 'updated')
    .build();
}

export function buildScheduleJql(projectKey, teamMembers) {
  const thisYear = dayjs().year();
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(teamMembers)
    .setDateRange(`${thisYear}-01-01`, `${thisYear}-12-31`, 'created')
    .build();
}
