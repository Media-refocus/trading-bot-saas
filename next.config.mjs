/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necesario para Docker standalone
  output: 'standalone',
};

export default nextConfig;
