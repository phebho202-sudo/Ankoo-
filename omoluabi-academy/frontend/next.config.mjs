/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // small production Docker image
  poweredByHeader: false,
  reactStrictMode: true,
};
export default nextConfig;
