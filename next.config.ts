import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow the local network host in development so RSC/HMR requests succeed
  // when accessing the app via the machine IP (e.g. 10.72.214.140).
  allowedDevOrigins: ["http://10.72.214.140:3000", "http://10.72.214.140"],
};

export default nextConfig;
