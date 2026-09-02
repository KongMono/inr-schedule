import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // timestamp ตอน build — client ใช้เทียบว่ามีเวอร์ชันใหม่กว่าที่เคยเห็นไหม
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
};

export default nextConfig;
