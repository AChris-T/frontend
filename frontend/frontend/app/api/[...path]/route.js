import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const maxDuration = 60;
export const runtime = 'nodejs';

async function proxy(request, { params }) {
  const backendUrl = getBackendUrl();

  if (process.env.VERCEL && backendUrl.includes('localhost')) {
    return NextResponse.json(
      {
        detail:
          'BACKEND_URL is not configured on Vercel. Set BACKEND_URL to your Railway backend API URL and redeploy.',
      },
      { status: 503 }
    );
  }

  const { path } = await params;
  const target = `${backendUrl}/${path.join('/')}${request.nextUrl.search}`;

  const token = request.cookies.get('token')?.value;
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);

  let body;
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (isMultipart) {
        body = await request.formData();
      } else {
        body = await request.text();
        if (contentType) headers.set('content-type', contentType);
      }
    }

    const backendRes = await fetch(target, {
      method: request.method,
      headers,
      body: body === '' ? undefined : body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(backendRes.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`API proxy failed for ${target}:`, error);
    return NextResponse.json(
      {
        detail: `Could not reach backend at ${backendUrl}. Verify BACKEND_URL on Vercel matches your live Railway backend URL.`,
        target,
        error: error?.message || 'fetch failed',
      },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
