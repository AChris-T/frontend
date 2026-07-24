import { NextResponse } from 'next/server';

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');

export const maxDuration = 60;

async function proxy(request, { params }) {
  const { path } = await params;
  const target = `${BACKEND_URL}/${path.join('/')}${request.nextUrl.search}`;

  const token = request.cookies.get('token')?.value;
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);

  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (isMultipart) {
      // Rebuild multipart so fetch sets a valid boundary for the backend.
      body = await request.formData();
    } else {
      if (contentType) headers.set('content-type', contentType);
      body = request.body;
    }
  }

  const fetchInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (body !== undefined) {
    fetchInit.body = body;
    if (!(body instanceof FormData)) {
      fetchInit.duplex = 'half';
    }
  }

  const backendRes = await fetch(target, fetchInit);

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
