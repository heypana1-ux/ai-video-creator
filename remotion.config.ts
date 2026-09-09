import { Config } from "@remotion/cli/config";

/**
 * Only used by `npm run remotion:studio`. Programmatic renders configure
 * themselves in `src/lib/render/remotion.ts`.
 */
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.overrideWebpackConfig((config) => config);
