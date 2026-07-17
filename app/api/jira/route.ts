import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get('url');

  if (!targetUrlStr) {
    return new NextResponse('Missing "url" query parameter', { status: 400 });
  }

  try {
    const targetUrl = new URL(targetUrlStr);

    // 클라이언트의 헤더 중 인증과 타입 헤더 전달
    const headers = new Headers();
    headers.set('Accept', request.headers.get('accept') || 'application/json');
    headers.set('Content-Type', request.headers.get('content-type') || 'application/json');

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }

    console.log(`[Jira Proxy] Forwarding to: ${targetUrl.href}`);

    const targetResponse = await fetch(targetUrl.href, {
      method: 'GET',
      headers: headers,
    });

    console.log(`[Jira Proxy] Target server responded with status: ${targetResponse.status}`);

    // 응답 헤더 구성 (CORS 허용)
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');

    const contentType = targetResponse.headers.get('content-type') || 'application/json';
    responseHeaders.set('Content-Type', contentType);

    // 응답 바디 추출 및 전송
    const body = await targetResponse.blob();

    return new NextResponse(body, {
      status: targetResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[Jira Proxy] Error forwarding request:', error);
    return new NextResponse(`Proxy request failed: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
}

export async function OPTIONS() {
  const responseHeaders = new Headers();
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  responseHeaders.set('Access-Control-Max-Age', '86400');

  return new NextResponse(null, {
    status: 200,
    headers: responseHeaders,
  });
}
