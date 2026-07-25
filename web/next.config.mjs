/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "modernpower.solutions" },
      { protocol: "https", hostname: "smetwfuynkrmdlphqxkm.supabase.co" },
    ],
  },
};

export default nextConfig;
