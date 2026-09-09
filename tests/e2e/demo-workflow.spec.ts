import { expect, test } from "@playwright/test";

/**
 * End-to-end walk through the first demo workflow from the product brief:
 * landing page -> demo login -> music promo project -> three concepts ->
 * editor -> media generation -> render -> downloadable MP4.
 *
 * It runs against a production build in demo mode, so no API key is needed and
 * the render at the end is a real Remotion render.
 */
test.describe.configure({ mode: "serial" });

test("landing page presents the offer and links into the app", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Aus deiner Idee wird in Minuten/i }),
  ).toBeVisible();
  await expect(page.getByText(/Erstelle automatisch TikToks, Reels und Shorts/i)).toBeVisible();

  // The required landing page sections are all present.
  for (const id of ["kategorien", "so-gehts", "vorlagen", "preise", "faq"]) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await expect(page.getByRole("heading", { name: "Video-Stile" })).toBeVisible();

  await page.getByRole("link", { name: "Kostenlos starten" }).first().click();
  await expect(page).toHaveURL(/\/register$/);
});

test("full demo workflow ends in a downloadable 9:16 MP4", async ({ page, request }) => {
  test.slow();

  // --- sign in through the demo entry point -------------------------------
  await page.goto("/login");
  await page.getByRole("button", { name: /Demo-Modus starten/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Deine Projekte" })).toBeVisible();

  // --- create a music promo project ---------------------------------------
  await page.getByRole("link", { name: /Neues Video erstellen/i }).first().click();
  await expect(page).toHaveURL(/\/projects\/new$/);

  await page.getByRole("button", { name: /^Musik/ }).click();

  await page.getByLabel("Projektname").fill("E2E Midnight Drive");
  await page
    .getByLabel("Kurze Beschreibung")
    .fill("Neue Synthwave-Single über nächtliche Autofahrten durch die Großstadt.");
  await page.getByLabel("Zielgruppe").fill("Synthwave-Hörer zwischen 18 und 34");
  await page.getByLabel("Call-to-Action").fill("Jetzt überall streamen");

  await page.getByLabel("Künstlername").fill("NOVA");
  await page.getByLabel("Songtitel").fill("Midnight Drive");
  await page.getByLabel("Genre").fill("Synthwave");
  await page.getByLabel("Stimmung").fill("melancholisch, treibend");
  await page.getByLabel("Lyrics oder Textausschnitt").fill("Ich fahr durch die Nacht");

  // The rights confirmation is mandatory for the music category.
  await page.getByRole("checkbox", { name: "Rechte bestätigen" }).click();

  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("heading", { name: "Zusammenfassung" })).toBeVisible();
  await page.getByRole("button", { name: /Projekt anlegen/i }).click();

  // --- three concepts are generated ---------------------------------------
  await expect(page).toHaveURL(/\/concepts/, { timeout: 30_000 });
  const conceptCards = page.getByRole("button", { name: /Dieses Konzept wählen/ });
  await expect(conceptCards).toHaveCount(3, { timeout: 90_000 });

  // Concepts must be specific to the brief, not generic filler.
  await expect(page.getByText(/Midnight Drive/).first()).toBeVisible();
  await expect(page.getByText(/Hook · erste 2 Sekunden/).first()).toBeVisible();

  await conceptCards.first().click();

  // --- editor --------------------------------------------------------------
  await expect(page).toHaveURL(/\/editor$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Szenenliste" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Vorschau" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Szeneneigenschaften" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Timeline" })).toBeVisible();

  // --- generate media, voice-over and music -------------------------------
  await page.getByRole("button", { name: /Medien generieren/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Geschätzte Kosten/)).toBeVisible();
  await page.getByRole("button", { name: "Jetzt generieren" }).click();

  await expect(page.getByText(/Medien werden generiert/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Medien werden generiert/)).toBeHidden({ timeout: 120_000 });

  // --- render and download -------------------------------------------------
  await page.getByRole("link", { name: /Export/ }).click();
  await expect(page).toHaveURL(/\/export$/);

  await page.getByRole("button", { name: /Vorschau-Export starten/ }).click();
  await expect(page.getByText(/Video wird gerendert/)).toBeVisible({ timeout: 30_000 });

  const downloadLink = page.getByRole("link", { name: /MP4 herunterladen/ }).first();
  await expect(downloadLink).toBeVisible({ timeout: 180_000 });

  const href = await downloadLink.getAttribute("href");
  expect(href).toMatch(/^\/api\/exports\/.+\/download$/);

  // The file behind the button must be a real MP4, not an empty placeholder.
  const cookies = await page.context().cookies();
  const response = await request.get(href!, {
    headers: {
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("video/mp4");
  expect(response.headers()["content-disposition"]).toContain("attachment");

  const body = await response.body();
  expect(body.byteLength).toBeGreaterThan(10_000);
  // ISO base media file format: bytes 4-8 of an MP4 are "ftyp".
  expect(body.subarray(4, 8).toString("ascii")).toBe("ftyp");
});

test("the project shows up on the dashboard and can be deleted", async ({ page }) => {
  // Each test gets a fresh browser context, so sign in again. The demo login is
  // idempotent and lands in the same shared demo workspace.
  await page.goto("/login");
  await page.getByRole("button", { name: /Demo-Modus starten/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const card = page.getByRole("article").filter({ hasText: "E2E Midnight Drive" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Fertig")).toBeVisible();

  await card.getByRole("button", { name: /Aktionen für/ }).click();
  await page.getByRole("menuitem", { name: "Löschen" }).click();
  await page.getByRole("button", { name: "Endgültig löschen" }).click();

  // Assert on the card itself - the confirmation dialog also mentions the name.
  await expect(card).toHaveCount(0, { timeout: 15_000 });
});
