export function parseMarkdownToHtml(markdown) {
  if (!markdown) return '';
  let html = markdown;

  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>');

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

      const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      const tag = tableHtml.includes('<th>') ? 'td' : 'th';

      tableHtml += '<tr>';
      cols.forEach(col => {
        tableHtml += `<${tag}>${col}</${tag}>`;
      });
      tableHtml += '</tr>';
      lines[i] = '';
    } else if (inTable) {
      inTable = false;
      tableHtml += '</table>';
      lines[i] = tableHtml + '\n' + lines[i];
    }
  }
  html = lines.join('\n');

  html = html.replace(/^\*\s+(.+)$/gm, '<ul><li>$1</li></ul>');
  html = html.replace(/^-\s+(.+)$/gm, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed === '') return '';
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<tr') ||
      trimmed.startsWith('<td') ||
      trimmed.startsWith('<th') ||
      trimmed.startsWith('<table') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<blockquote>')
    ) {
      return line;
    }
    return `<p>${line}</p>`;
  }).join('\n');

  return html;
}
