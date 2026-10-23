import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import type { SheetCellUpdate } from './googleSheets';

const DEV_STATUS_LABEL = /개발\s*현황/;
const EXCLUDED_COLUMN_LABEL = /주요\s*운영\s*사항/;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && !(value instanceof Date) && 'richText' in value) {
    return value.richText.map((part) => part.text).join('');
  }
  if (typeof value === 'object' && !(value instanceof Date) && 'text' in value && typeof value.text === 'string') {
    return value.text;
  }
  return String(value);
}

function isYellowFill(cell: ExcelJS.Cell): boolean {
  const fill = cell.fill;
  if (!fill || fill.type !== 'pattern' || fill.pattern !== 'solid') return false;
  const argb = fill.fgColor?.argb;
  if (!argb || argb.length < 6) return false;
  const rgb = argb.slice(-6);
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return r >= 0xf0 && g >= 0xd8 && b <= 0x99;
}

function readCellValue(cell: ExcelJS.Cell): SheetCellUpdate['value'] | null {
  const value = cell.value;
  if (value == null) return null;
  if (value instanceof Date) return dayjs(value).format('YYYY-MM-DD');
  if (typeof value === 'object' && 'result' in value) {
    const result = value.result;
    if (result == null || typeof result === 'object') return null;
    return result as SheetCellUpdate['value'];
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = cellText(value);
  return text === '' ? null : text;
}

function findDevStatusScope(workbook: ExcelJS.Workbook): { sheet: ExcelJS.Worksheet; startRow: number } {
  const byName = workbook.worksheets.find((sheet) => DEV_STATUS_LABEL.test(sheet.name));
  if (byName) return { sheet: byName, startRow: 1 };

  for (const sheet of workbook.worksheets) {
    let labelRow = 0;
    sheet.eachRow((row, rowNumber) => {
      if (labelRow) return;
      row.eachCell((cell) => {
        if (!labelRow && DEV_STATUS_LABEL.test(cellText(cell.value))) labelRow = rowNumber;
      });
    });
    if (labelRow) return { sheet, startRow: labelRow };
  }
  throw new Error("엑셀에서 '개발 현황' 영역을 찾지 못했습니다.");
}

function columnLettersToNumber(letters: string): number {
  return letters.split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
}

function findExcludedColumns(sheet: ExcelJS.Worksheet): Set<number> {
  const columns = new Set<number>();
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (!EXCLUDED_COLUMN_LABEL.test(cellText(cell.value))) return;
      const master = cell.master ?? cell;
      const mergeRange = sheet.model.merges?.find((range) => range.startsWith(`${master.address}:`));
      const endLetters = mergeRange?.split(':')[1].match(/^[A-Z]+/)?.[0];
      const endCol = endLetters ? columnLettersToNumber(endLetters) : Number(master.col);
      for (let col = Number(master.col); col <= endCol; col += 1) columns.add(col);
    });
  });
  return columns;
}

export async function extractDevStatusYellowCells(
  fileBuffer: ArrayBuffer | Buffer,
): Promise<SheetCellUpdate[]> {
  const workbook = new ExcelJS.Workbook();
  const input = fileBuffer instanceof ArrayBuffer ? Buffer.from(new Uint8Array(fileBuffer)) : Buffer.from(fileBuffer);
  await workbook.xlsx.load(input as unknown as ExcelJS.Buffer);

  const { sheet, startRow } = findDevStatusScope(workbook);
  const excludedColumns = findExcludedColumns(sheet);
  const updates: SheetCellUpdate[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;
    row.eachCell((cell) => {
      if (cell.isMerged && cell.master !== cell) return;
      if (!isYellowFill(cell) || excludedColumns.has(Number(cell.col))) return;
      const value = readCellValue(cell);
      if (value === null) return;
      updates.push({ row: Number(cell.row), col: Number(cell.col), value });
    });
  });
  return updates;
}
