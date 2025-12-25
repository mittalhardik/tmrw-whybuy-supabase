import { NextResponse } from 'next/server';

export async function middleware(request) {
    // Only handle /api routes
    if (request.nextUrl.pathname.startsWith('/api')) {
        const backendUrl = process.env.NODE_ENV === 'production'
            ? 'http://127.0.0.1:8081'
            : 'http://localhost:8080';

        // Construct the backend URL
        const url = new URL(request.nextUrl.pathname + request.nextUrl.search, backendUrl);

        // Forward the request to FastAPI
        const response = await fetch(url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            duplex: 'half',
        });

        // Return the response from FastAPI
        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
