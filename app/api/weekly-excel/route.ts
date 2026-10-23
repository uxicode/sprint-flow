import { NextRequest, NextResponse } from 'next/server';
import { updateWeeklyExcelWorkbook } from '../../utils/server/updateWeeklyExcel';
import { extractDevStatusYellowCells } from '../../utils/server/devStatusCells';
import { readGoogleSheetsConfig, writeCellsToSheet } from '../../utils/server/googleSheets';
import type { WeeklyExcelPayload } from '../../types';

async function syncDevStatusToSheet(buffer: ArrayBuffer): Promise<string> {
  try {
    const config = readGoogleSheetsConfig();
    if (!config) return '구글 시트 환경변수(GOOGLE_SERVICE_ACCOUNT_EMAIL 등)가 설정되지 않아 동기화하지 않았습니다.';
    const updates = await extractDevStatusYellowCells(buffer);
    if (!updates.length) return "'개발 현황' 영역에서 값이 있는 노란색 셀을 찾지 못했습니다.";
    const result = await writeCellsToSheet(config, updates);
    if (result.status === 'unchanged') return '구글 시트에 이미 같은 내용이 있어 변경하지 않았습니다.';
    return `구글 시트에 ${result.count}개 셀을 ${result.firstRow}행부터 동기화했습니다.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[weekly-excel:sheet-sync]', error);
    return `구글 시트 동기화 실패: ${message}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const rawPayload = formData.get('payload');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '엑셀 파일이 필요합니다.' }, { status: 400 });
    }
    if (typeof rawPayload !== 'string') {
      return NextResponse.json({ error: '주간 업무 데이터가 필요합니다.' }, { status: 400 });
    }

    const payload = JSON.parse(rawPayload) as WeeklyExcelPayload;
    const buffer = await file.arrayBuffer();
    const shouldSync = formData.get('syncSheet') === 'true';
    const syncMessage = shouldSync ? await syncDevStatusToSheet(buffer) : '';
    const updated = await updateWeeklyExcelWorkbook(buffer, payload);
    const originalName = file.name.replace(/\.xlsx$/i, '');
    const filename = `${originalName}_updated.xlsx`;

    return new NextResponse(new Uint8Array(updated), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        ...(syncMessage ? { 'X-Sheet-Sync': encodeURIComponent(syncMessage) } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[weekly-excel]', error);
    return NextResponse.json({ error: `엑셀 업데이트 실패: ${message}` }, { status: 500 });
  }
}
