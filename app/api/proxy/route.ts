import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing "url" query parameter', { status: 400 });
  }

  const authHeader = request.headers.get('authorization');
  
  const headers: Record<string, string> = {
    'Accept': request.headers.get('accept') || 'application/json',
    'Content-Type': request.headers.get('content-type') || 'application/json',
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  try {
    console.log(`[Next.js Proxy API] GET Forwarding to: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: headers,
      cache: 'no-store' // 캐싱 방지
    });

    const dataText = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';

    return new NextResponse(dataText, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error(`[Next.js Proxy API] GET Error:`, error);
    return new NextResponse(`Proxy request failed: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing "url" query parameter', { status: 400 });
  }

  const authHeader = request.headers.get('authorization');
  const bodyText = await request.text();
  
  const headers: Record<string, string> = {
    'Accept': request.headers.get('accept') || 'application/json',
    'Content-Type': request.headers.get('content-type') || 'application/json',
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  try {
    console.log(`[Next.js Proxy API] POST Forwarding to: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: headers,
      body: bodyText,
      cache: 'no-store'
    });

    const dataText = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';

    return new NextResponse(dataText, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error(`[Next.js Proxy API] POST Error:`, error);
    return new NextResponse(`Proxy request failed: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    }
  });
}
