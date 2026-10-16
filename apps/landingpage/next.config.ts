import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Some dependencies resolve from the monorepo root's node_modules, so Turbopack's
  // root is the repository root. Setting it explicitly silences the warning about
  // multiple lockfiles.
  turbopack: { root: path.join(process.cwd(), "..", "..") },
};

export default nextConfig;
