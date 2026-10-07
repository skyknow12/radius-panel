import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';
    const targetUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, backendUrl);

    const headers = new Headers(request.headers);
    headers.set('host', targetUrl.host);

    return NextResponse.rewrite(targetUrl, {
      request: {
        headers,
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
