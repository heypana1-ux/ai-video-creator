/**
 * Deterministic procedural artwork generator.
 *
 * The mock image/video providers use this to produce clean, on-brand abstract
 * visuals instead of shipping binary stock media. Output is an SVG string, so
 * it stays tiny, renders crisply at 1080x1920 and is fully deterministic for a
 * given seed - which makes the demo workflow reproducible in tests.
 *
 * The artwork itself carries no "demo" marking on purpose; demo labelling is
 * applied by the UI and by the renderer's watermark so the visuals stay usable
 * as layout references.
 */

export interface ArtworkOptions {
  seed: number;
  width: number;
  height: number;
  palette: string[];
  /** Free text; only used to pick a variant deterministically. */
  prompt?: string;
}

const FALLBACK_PALETTE = ["#2E1065", "#7E22CE", "#DB2777", "#38BDF8"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

const VARIANTS = ["mesh", "orbs", "bands", "rings", "grid", "particles"] as const;
type Variant = (typeof VARIANTS)[number];

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length];
}

function normalisePalette(palette: string[]): string[] {
  const cleaned = palette.filter((color) => /^#[0-9a-fA-F]{3,8}$/.test(color));
  return cleaned.length >= 2 ? cleaned : FALLBACK_PALETTE;
}

/** Generates an abstract SVG poster. */
export function generateArtworkSvg(options: ArtworkOptions): string {
  const { width, height } = options;
  const palette = normalisePalette(options.palette);
  const random = mulberry32(options.seed ^ hashString(options.prompt ?? ""));
  const variant: Variant = pick(VARIANTS, random);

  const c = (index: number) => palette[index % palette.length];
  const body = renderVariant(variant, { width, height, palette, random, c });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Abstraktes Hintergrundvisual">`,
    "<defs>",
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="${c(0)}"/>`,
    `<stop offset="55%" stop-color="${c(1)}"/>`,
    `<stop offset="100%" stop-color="${c(2)}"/>`,
    "</linearGradient>",
    `<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${Math.round(width * 0.09)}"/></filter>`,
    `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${options.seed % 9973}"/><feColorMatrix type="saturate" values="0"/></filter>`,
    "</defs>",
    `<rect width="${width}" height="${height}" fill="url(#bg)"/>`,
    body,
    `<rect width="${width}" height="${height}" filter="url(#grain)" opacity="0.07"/>`,
    `<rect width="${width}" height="${height}" fill="#000" opacity="0.18"/>`,
    "</svg>",
  ].join("");
}

interface VariantContext {
  width: number;
  height: number;
  palette: string[];
  random: () => number;
  c: (index: number) => string;
}

function renderVariant(variant: Variant, ctx: VariantContext): string {
  switch (variant) {
    case "mesh":
      return meshVariant(ctx);
    case "orbs":
      return orbsVariant(ctx);
    case "bands":
      return bandsVariant(ctx);
    case "rings":
      return ringsVariant(ctx);
    case "grid":
      return gridVariant(ctx);
    case "particles":
      return particlesVariant(ctx);
  }
}

function meshVariant({ width, height, random, c }: VariantContext): string {
  const blobs: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const cx = random() * width;
    const cy = random() * height;
    const r = width * (0.28 + random() * 0.4);
    blobs.push(
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${c(i + 1)}" opacity="0.55" filter="url(#soft)"/>`,
    );
  }
  return blobs.join("");
}

function orbsVariant({ width, height, random, c }: VariantContext): string {
  const parts: string[] = [
    `<rect width="${width}" height="${height}" fill="#000" opacity="0.35"/>`,
  ];
  for (let i = 0; i < 3; i += 1) {
    const cx = width * (0.2 + random() * 0.6);
    const cy = height * (0.18 + random() * 0.64);
    const r = width * (0.16 + random() * 0.2);
    parts.push(
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${c(i + 1)}" opacity="0.75" filter="url(#soft)"/>`,
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(r * 0.62).toFixed(0)}" fill="none" stroke="${c(i + 2)}" stroke-width="${Math.max(2, width * 0.004).toFixed(1)}" opacity="0.5"/>`,
    );
  }
  return parts.join("");
}

function bandsVariant({ width, height, random, c }: VariantContext): string {
  const count = 7 + Math.floor(random() * 5);
  const parts: string[] = [];
  const angle = -18 + random() * 36;
  for (let i = 0; i < count; i += 1) {
    const y = (height / count) * i - height * 0.1;
    const h = (height / count) * (0.35 + random() * 0.5);
    parts.push(
      `<rect x="${-width * 0.2}" y="${y.toFixed(0)}" width="${(width * 1.4).toFixed(0)}" height="${h.toFixed(0)}" fill="${c(i + 1)}" opacity="${(0.16 + random() * 0.32).toFixed(2)}" transform="rotate(${angle.toFixed(1)} ${width / 2} ${height / 2})"/>`,
    );
  }
  return parts.join("");
}

function ringsVariant({ width, height, random, c }: VariantContext): string {
  const cx = width / 2;
  const cy = height * (0.36 + random() * 0.28);
  const parts: string[] = [
    `<circle cx="${cx}" cy="${cy.toFixed(0)}" r="${(width * 0.42).toFixed(0)}" fill="${c(2)}" opacity="0.5" filter="url(#soft)"/>`,
  ];
  for (let i = 1; i <= 9; i += 1) {
    parts.push(
      `<circle cx="${cx}" cy="${cy.toFixed(0)}" r="${(width * 0.06 * i).toFixed(0)}" fill="none" stroke="${c(i)}" stroke-width="${Math.max(1.5, width * 0.0035).toFixed(1)}" opacity="${(0.55 - i * 0.045).toFixed(2)}"/>`,
    );
  }
  return parts.join("");
}

function gridVariant({ width, height, random, c }: VariantContext): string {
  const parts: string[] = [
    `<rect width="${width}" height="${height}" fill="#000" opacity="0.4"/>`,
    `<circle cx="${width / 2}" cy="${(height * 0.3).toFixed(0)}" r="${(width * 0.36).toFixed(0)}" fill="${c(1)}" opacity="0.6" filter="url(#soft)"/>`,
  ];
  const horizon = height * 0.55;
  const stroke = c(3);
  const lineWidth = Math.max(1.5, width * 0.0025).toFixed(1);
  for (let i = -12; i <= 12; i += 1) {
    const x = width / 2 + i * (width * 0.12);
    parts.push(
      `<line x1="${(width / 2 + i * width * 0.02).toFixed(0)}" y1="${horizon.toFixed(0)}" x2="${x.toFixed(0)}" y2="${height}" stroke="${stroke}" stroke-width="${lineWidth}" opacity="0.35"/>`,
    );
  }
  for (let i = 1; i <= 14; i += 1) {
    const y = horizon + (height - horizon) * (i / 14) ** 2.1;
    parts.push(
      `<line x1="0" y1="${y.toFixed(0)}" x2="${width}" y2="${y.toFixed(0)}" stroke="${stroke}" stroke-width="${lineWidth}" opacity="0.3"/>`,
    );
  }
  void random;
  return parts.join("");
}

function particlesVariant({ width, height, random, c }: VariantContext): string {
  const parts: string[] = [
    `<rect width="${width}" height="${height}" fill="#000" opacity="0.45"/>`,
  ];
  const count = 90;
  for (let i = 0; i < count; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = width * (0.002 + random() * 0.012);
    parts.push(
      `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${c(i)}" opacity="${(0.25 + random() * 0.6).toFixed(2)}"/>`,
    );
  }
  parts.push(
    `<circle cx="${(width * 0.5).toFixed(0)}" cy="${(height * 0.42).toFixed(0)}" r="${(width * 0.3).toFixed(0)}" fill="${c(1)}" opacity="0.45" filter="url(#soft)"/>`,
  );
  return parts.join("");
}

export function artworkToBytes(svg: string): Uint8Array {
  return new TextEncoder().encode(svg);
}
