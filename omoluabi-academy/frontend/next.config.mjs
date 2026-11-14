/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // small production Docker image
  poweredByHeader: false,
  reactStrictMode: true,
  // Licence documents can be up to 10 MB (the backend enforces the real limit).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};
export default nextConfig;
