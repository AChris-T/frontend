import { NextResponse } from 'next/server';

const BACKEND_URL = 'https://frontend-production-9e60.up.railway.app';

async function proxy(request, { params }) {
  const { path } = await params;
  const target = `${BACKEND_URL}/${path.join('/')}${request.nextUrl.search}`;

  const token = request.cookies.get('token')?.value;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const hasBody = !['GET', 'HEAD'].includes(request.method);

  const backendRes = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(backendRes.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
