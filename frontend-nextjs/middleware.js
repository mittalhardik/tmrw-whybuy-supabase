import { NextResponse } from 'next/server';

export async function middleware(request) {
    // Only handle /api routes
    if (request.nextUrl.pathname.startsWith('/api')) {
        try {
            const backendUrl = process.env.NODE_ENV === 'production'
                ? 'http://127.0.0.1:8081'
                : 'http://localhost:8080';

            // Construct the backend URL
            const url = `${backendUrl}${request.nextUrl.pathname}${request.nextUrl.search}`;

            // Prepare headers
            const headers = new Headers(request.headers);
            headers.delete('host'); // Remove host header to avoid conflicts

            // Prepare fetch options
            const fetchOptions = {
                method: request.method,
                headers: headers,
            };

            // Add body for non-GET requests
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                fetchOptions.body = await request.text();
            }

            // Forward the request to FastAPI
            const response = await fetch(url, fetchOptions);

            // Get response body
            const responseBody = await response.text();

            // Return the response from FastAPI
            return new NextResponse(responseBody, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        } catch (error) {
            console.error('Middleware proxy error:', error);
            return new NextResponse(JSON.stringify({ error: 'Proxy error', details: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
