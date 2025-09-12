/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // if something asks under _next/static/.../ifc/*, serve from /ifc/*
      {
        source: "/_next/static/chunks/app/ifc/:path*",
        destination: "/ifc/:path*",
      },
      { source: "/_next/static/ifc/:path*", destination: "/ifc/:path*" },
    ];
  },
};

export default nextConfig;
