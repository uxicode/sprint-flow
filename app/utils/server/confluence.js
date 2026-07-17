import { parseMarkdownToHtml } from '../markdown';

function normalizeJiraHost(url) {
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

export async function publishConfluencePage({
  jiraUrl,
  email,
  token,
  spaceKey,
  parentId,
  title,
  markdown,
}) {
  const cleanUrl = normalizeJiraHost(jiraUrl);
  const credential = Buffer.from(`${email}:${token}`).toString('base64');
  const cleanedMarkdown = markdown.replace(/ \*\(에픽:.*?\)\*/g, '');
  const htmlContent = parseMarkdownToHtml(cleanedMarkdown);

  const requestBody = {
    type: 'page',
    title,
    space: { key: spaceKey.toUpperCase() },
    body: {
      storage: {
        value: htmlContent,
        representation: 'storage',
      },
    },
  };

  if (parentId?.trim()) {
    requestBody.ancestors = [{ id: parentId.trim() }];
  }

  const targetUrl = `${cleanUrl}/wiki/rest/api/content`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credential}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Confluence API HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const docLink = `${cleanUrl}/wiki${data._links?.webui || ''}`;

  return {
    pageId: data.id,
    title: data.title,
    url: docLink,
  };
}
