import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export interface SheetCellUpdate {
  row: number;
  col: number;
  value: string | number | boolean;
}

export interface SheetWriteResult {
  status: 'written' | 'unchanged';
  count: number;
  firstRow: number;
}

const DEFAULT_START_CELL = 'C8';

function parseStartCell(address: string): { row: number; col: number } {
  const match = address.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`GOOGLE_SHEET_START_CELL 형식이 올바르지 않습니다: ${address}`);
  const col = match[1].split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
  return { row: Number(match[2]), col };
}

function anchorToStartCell(config: GoogleSheetsConfig, updates: SheetCellUpdate[]): SheetCellUpdate[] {
  const minRow = Math.min(...updates.map((u) => u.row));
  const minCol = Math.min(...updates.map((u) => u.col));
  return updates.map((u) => ({
    ...u,
    row: config.startRow + (u.row - minRow),
    col: config.startCol + (u.col - minCol),
  }));
}

export interface GoogleSheetsConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  sheetGid: string;
  startRow: number;
  startCol: number;
}

export function readGoogleSheetsConfig(): GoogleSheetsConfig | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim().replace(/^"|"$/g, '');
  const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim();
  const sheetGid = process.env.GOOGLE_SHEET_GID?.trim();
  if (!clientEmail || !privateKey || !spreadsheetId || !sheetGid) return null;
  const start = parseStartCell(process.env.GOOGLE_SHEET_START_CELL || DEFAULT_START_CELL);
  return {
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    spreadsheetId,
    sheetGid,
    startRow: start.row,
    startCol: start.col,
  };
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

async function fetchAccessToken(config: GoogleSheetsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = base64Url(signer.sign(config.privateKey));

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`구글 인증 실패 (${response.status}): ${await response.text()}`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('구글 인증 응답에 access_token이 없습니다.');
  return body.access_token;
}

interface SpreadsheetMetaResponse {
  sheets?: { properties?: { sheetId?: number; title?: string } }[];
}

async function resolveSheetTitle(config: GoogleSheetsConfig, token: string): Promise<string> {
  const response = await fetch(
    `${SHEETS_API}/${config.spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`시트 정보 조회 실패 (${response.status}): ${await response.text()}`);
  }
  const meta = (await response.json()) as SpreadsheetMetaResponse;
  const matched = meta.sheets?.find((sheet) => String(sheet.properties?.sheetId) === config.sheetGid);
  const title = matched?.properties?.title;
  if (!title) throw new Error(`gid=${config.sheetGid} 시트를 찾지 못했습니다.`);
  return title;
}

function toColumnLetters(col: number): string {
  let result = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

async function readSheetGrid(
  config: GoogleSheetsConfig,
  token: string,
  quotedTitle: string,
): Promise<string[][]> {
  const response = await fetch(
    `${SHEETS_API}/${config.spreadsheetId}/values/${encodeURIComponent(quotedTitle)}?valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`시트 내용 조회 실패 (${response.status}): ${await response.text()}`);
  }
  const body = (await response.json()) as { values?: unknown[][] };
  return (body.values ?? []).map((row) => row.map((cell) => String(cell ?? '').trim()));
}

function gridAt(grid: string[][], row: number, col: number): string {
  return grid[row - 1]?.[col - 1] ?? '';
}

function findLastUsedRow(grid: string[][]): number {
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    if (grid[index].some((text) => text !== '')) return index + 1;
  }
  return 0;
}

/**
 * 시트에서 값이 있는 마지막 행 바로 아래에 붙인다(시작 셀의 행보다 위로는 내려가지 않는다).
 * 시트 안에 이미 같은 묶음이 들어 있으면 중복으로 보고 쓰지 않는다.
 */
function resolveAppendOffset(
  grid: string[][],
  updates: SheetCellUpdate[],
  startRow: number,
): { offset: number; alreadySynced: boolean } {
  const lastUsedRow = findLastUsedRow(grid);
  const firstRow = Math.min(...updates.map((u) => u.row));
  const matchesAt = (offset: number): boolean =>
    updates.every((u) => gridAt(grid, u.row + offset, u.col) === String(u.value).trim());

  for (let offset = 0; firstRow + offset <= lastUsedRow; offset += 1) {
    if (matchesAt(offset)) return { offset, alreadySynced: true };
  }
  return { offset: Math.max(startRow, lastUsedRow + 1) - firstRow, alreadySynced: false };
}

export async function writeCellsToSheet(
  config: GoogleSheetsConfig,
  updates: SheetCellUpdate[],
): Promise<SheetWriteResult> {
  if (!updates.length) return { status: 'unchanged', count: 0, firstRow: 0 };
  const anchored = anchorToStartCell(config, updates);
  const token = await fetchAccessToken(config);
  const title = await resolveSheetTitle(config, token);
  const quotedTitle = `'${title.replace(/'/g, "''")}'`;

  const grid = await readSheetGrid(config, token, quotedTitle);
  const { offset, alreadySynced } = resolveAppendOffset(grid, anchored, config.startRow);
  if (alreadySynced) return { status: 'unchanged', count: 0, firstRow: 0 };

  const response = await fetch(`${SHEETS_API}/${config.spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: anchored.map((update) => ({
        range: `${quotedTitle}!${toColumnLetters(update.col)}${update.row + offset}`,
        values: [[update.value]],
      })),
    }),
  });
  if (!response.ok) {
    throw new Error(`시트 쓰기 실패 (${response.status}): ${await response.text()}`);
  }
  return { status: 'written', count: anchored.length, firstRow: Math.min(...anchored.map((u) => u.row)) + offset };
}
