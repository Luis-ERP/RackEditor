/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // Allow importing CSV files as raw strings (e.g. catalog_lists/*.csv)
    config.module.rules.push({
      test: /\.csv$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
