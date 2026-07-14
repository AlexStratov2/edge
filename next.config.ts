import type { NextConfig } from "next";

// Static export for GitHub Pages. `next dev` still renders dynamically with live
// data locally; `next build` produces a static snapshot in `out/` for Pages.
// The repo name becomes the base path for a project Pages site.
const REPO = "edge";
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isProd ? `/${REPO}` : "",
};

export default nextConfig;
