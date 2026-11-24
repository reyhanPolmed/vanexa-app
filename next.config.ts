import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.APP_ORIGIN ? [new URL(process.env.APP_ORIGIN).hostname] : [],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingIncludes: {
    "/api/imports": ["./scripts/pdf-extract.mjs", "./node_modules/pdfjs-dist/legacy/build/**", "./node_modules/@napi-rs/**"],
  },
};

export default nextConfig;
