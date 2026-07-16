/**
 * Confluence API 유틸리티 함수
 * 
 * Confluence REST API와 통신하여 페이지를 생성하고 관리합니다.
 */

/**
 * 마크다운을 Confluence Storage Format HTML로 변환
 * @param {string} markdown - 마크다운 텍스트
 * @returns {string} HTML 문자열
 */
export function parseMarkdownToHtml(markdown) {
  if (!markdown) return '';
  let html = markdown;

  // 헤더 변환
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  
  // 인용구 변환
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  
  // 코드 블록 변환
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 볼드 변환
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 구분선 변환
  html = html.replace(/^---$/gm, '<hr>');

  // 마크다운 하이퍼링크 [TEXT](LINK) -> HTML <a> 태그 변환
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #4e88f9; text-decoration: underline; font-weight: 600;">$1</a>');

  // 테이블 파싱
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table>';
      }
      if (line.includes('---')) {
        lines[i] = '';
        continue;
      }
      const isHeader = i > 0 && lines[i - 1].trim().startsWith('|') && !lines[i - 1].includes('---');
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      const tag = isHeader && i === 0 ? 'th' : 'td';
      const row = cells.map(c => `<${tag}>${c}</${tag}>`).join('');
      lines[i] = `<tr>${row}</tr>`;
    } else if (inTable) {
      lines[i] = '</table>' + (line ? `\n${line}` : '');
      inTable = false;
    }
  }
  if (inTable) {
    html = lines.join('\n') + '</table>';
  } else {
    html = lines.join('\n');
  }

  // 리스트 아이템 변환 (단순화: 중첩 미지원)
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);

  // 줄바꿈 변환
  html = html.replace(/\n/g, '<br/>');

  return html;
}

/**
 * Confluence에 페이지 생성
 * @param {Object} params - 페이지 생성 파라미터
 * @param {string} params.confluenceUrl - Confluence URL (예: https://your-domain.atlassian.net)
 * @param {string} params.email - Jira/Confluence 이메일
 * @param {string} params.apiToken - Jira/Confluence API Token
 * @param {string} params.spaceKey - Confluence Space Key
 * @param {string} params.title - 페이지 제목
 * @param {string} params.content - 페이지 내용 (마크다운)
 * @param {string} [params.parentId] - 부모 페이지 ID (선택사항)
 * @returns {Promise<Object>} 생성된 페이지 정보
 */
export async function createConfluencePage({
  confluenceUrl,
  email,
  apiToken,
  spaceKey,
  title,
  content,
  parentId
}) {
  // URL 정리
  let cleanUrl = confluenceUrl.trim();
  try {
    if (cleanUrl.toLowerCase().startsWith('http')) {
      const urlObj = new URL(cleanUrl);
      cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
  } catch (e) {
    throw new Error(`잘못된 Confluence URL 형식: ${e.message}`);
  }

  // 에픽 정보 제거 (마크다운에서)
  const cleanedContent = content.replace(/ \*\(에픽:.*?\)\*/g, '');
  
  // HTML 변환
  const htmlContent = parseMarkdownToHtml(cleanedContent);

  // API 요청 바디 구성
  const requestBody = {
    type: 'page',
    title,
    space: {
      key: spaceKey.toUpperCase()
    },
    body: {
      storage: {
        value: htmlContent,
        representation: 'storage'
      }
    }
  };

  // 부모 페이지 ID가 있으면 추가
  if (parentId && parentId.trim()) {
    requestBody.ancestors = [
      {
        id: parentId.trim()
      }
    ];
  }

  // Basic Auth 인증 헤더 생성
  const credential = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const targetUrl = `${cleanUrl.replace(/\/$/, '')}/wiki/rest/api/content`;

  // Confluence API 호출
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credential}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Confluence API Error Response:', errText);
    throw new Error(`Confluence API 오류 (코드: ${response.status}): ${errText}`);
  }

  const data = await response.json();
  const docLink = `${cleanUrl.replace(/\/$/, '')}/wiki${data._links?.webui || ''}`;

  return {
    id: data.id,
    title: data.title,
    link: docLink,
    data
  };
}
