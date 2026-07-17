import dayjs from 'dayjs';
import type {
  JiraCredentials,
  JiraSearchIssue,
  JiraSearchResponse,
  Ticket,
} from '../../types';

function normalizeJiraHost(url: string): string {
  let cleanUrl = url.trim();
  try {
    if (cleanUrl.toLowerCase().startsWith('http')) {
      const urlObj = new URL(cleanUrl);
      cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
  } catch {
    /* keep original */
  }
  return cleanUrl.replace(/\/$/, '');
}

function mapIssue(issue: JiraSearchIssue): Ticket {
  return {
    key: issue.key || '',
    summary: issue.fields?.summary || '제목 없음',
    status: issue.fields?.status ? (issue.fields.status.name || 'To Do') : 'To Do',
    assignee: issue.fields?.assignee
      ? (issue.fields.assignee.displayName || issue.fields.assignee.name || '미지정')
      : '미지정',
    updated: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : '',
    created: issue.fields?.created ? issue.fields.created.substring(0, 10) : '',
    duedate: issue.fields?.duedate ? issue.fields.duedate : dayjs().format('YYYY-MM-DD'),
    epic: issue.fields?.parent
      ? {
          key: issue.fields.parent.key || '',
          summary: issue.fields.parent.fields?.summary || '',
        }
      : null,
  };
}

export async function fetchJiraTicketsServer(
  jql: string,
  { url, email, token }: JiraCredentials,
): Promise<Ticket[]> {
  if (!url || !email || !token) {
    throw new Error('Jira API 설정 정보가 누락되었습니다.');
  }

  const cleanUrl = normalizeJiraHost(url);
  const credential = Buffer.from(`${email}:${token}`).toString('base64');

  let allIssues: JiraSearchIssue[] = [];
  const limit = 100;
  let pageCount = 0;
  const maxPages = 20;
  let nextPageToken: string | null = null;

  while (pageCount < maxPages) {
    let targetUrl = `${cleanUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,status,assignee,updated,created,parent,duedate&maxResults=${limit}`;
    if (nextPageToken) {
      targetUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credential}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Jira API HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as JiraSearchResponse;
    const pageIssues = data.issues || [];
    if (pageIssues.length === 0) break;

    allIssues = allIssues.concat(pageIssues);
    pageCount++;

    if (!data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }

  return allIssues.map(mapIssue);
}
