/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.VERCEL ? {} : {
    turbopack: {
      root: '..',
    },
  }),
};

export default nextConfig;
