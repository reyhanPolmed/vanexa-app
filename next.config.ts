import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingIncludes: {
    "/api/imports": ["./scripts/pdf-extract.mjs", "./node_modules/pdfjs-dist/legacy/build/**", "./node_modules/@napi-rs/**"],
  },
};

export default nextConfig;
