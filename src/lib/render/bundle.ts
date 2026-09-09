import path from "node:path";

import { bundle } from "@remotion/bundler";

/**
 * Bundles the Remotion project once per process.
 *
 * Webpack bundling takes several seconds, so the resulting serve URL is
 * memoised. Concurrent renders share the same in-flight promise.
 */
let bundlePromise: Promise<string> | null = null;

export interface BundleOptions {
  /** Directory served as the bundle's public dir; `staticFile()` resolves here. */
  publicDir: string;
  onProgress?: (progress: number) => void;
}

export function remotionEntryPoint(): string {
  return path.join(process.cwd(), "src", "remotion", "index.ts");
}

export async function getRemotionBundle(options: BundleOptions): Promise<string> {
  if (bundlePromise) return bundlePromise;

  bundlePromise = bundle({
    entryPoint: remotionEntryPoint(),
    publicDir: options.publicDir,
    onProgress: options.onProgress,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias ?? {}),
          // Mirrors the `@/*` path alias from tsconfig.json.
          "@": path.join(process.cwd(), "src"),
        },
      },
    }),
  }).catch((error: unknown) => {
    // A failed bundle must not be cached, otherwise every later render fails.
    bundlePromise = null;
    throw error;
  });

  return bundlePromise;
}

/** Test seam - forces the next call to rebuild. */
export function resetRemotionBundle(): void {
  bundlePromise = null;
}
