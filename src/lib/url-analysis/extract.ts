/**
 * Very small, dependency-free HTML extraction.
 *
 * It deliberately does not build a DOM: we only need a handful of signals to
 * pre-fill the wizard, and everything extracted is shown to the user for review
 * before it is used, so best-effort parsing is appropriate.
 */

export interface ExtractedPage {
  title: string;
  description: string;
  headings: string[];
  benefits: string[];
  ctas: string[];
  imageUrl: string | null;
  siteName: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function clean(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function collect(html: string, pattern: RegExp, limit: number): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const value = clean(match[1] ?? "");
    const key = value.toLowerCase();
    if (value.length < 2 || value.length > 200 || seen.has(key)) continue;
    seen.add(key);
    results.push(value);
    if (results.length >= limit) break;
  }
  return results;
}

const CTA_WORDS =
  /\b(jetzt|kostenlos|starten|testen|buchen|kaufen|anfragen|demo|registrieren|anmelden|sichern|download|get started|try|book|buy|sign up|start)\b/i;

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  // Strip script/style so their contents never end up in headings or CTAs.
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");

  const title =
    metaContent(body, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    ]) || clean(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

  const description = metaContent(body, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  ]);

  const rawImage = metaContent(body, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ]);

  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      imageUrl = new URL(rawImage, pageUrl).toString();
    } catch {
      imageUrl = null;
    }
  }

  const headings = [
    ...collect(body, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 3),
    ...collect(body, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 8),
  ];

  const benefits = collect(body, /<li[^>]*>([\s\S]*?)<\/li>/gi, 30)
    .filter((item) => item.length >= 12 && item.length <= 120)
    .slice(0, 6);

  const ctas = [
    ...collect(body, /<button[^>]*>([\s\S]*?)<\/button>/gi, 20),
    ...collect(body, /<a[^>]+class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, 20),
  ]
    .filter((item) => item.length <= 40 && CTA_WORDS.test(item))
    .slice(0, 5);

  let siteName = "";
  try {
    siteName = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    siteName = "";
  }

  return { title, description, headings, benefits, ctas, imageUrl, siteName };
}
