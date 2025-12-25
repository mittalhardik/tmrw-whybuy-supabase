/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    // In production (Cloud Run), both Next.js and FastAPI run in the same container
    // FastAPI runs on 127.0.0.1:8081, Next.js on $PORT
    // In development, FastAPI runs on localhost:8080
    const backendUrl = process.env.NODE_ENV === 'production'
      ? 'http://127.0.0.1:8081'
      : 'http://localhost:8080';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
