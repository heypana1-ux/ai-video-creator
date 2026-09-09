/**
 * Seeds the local demo store with a demo account, a brand kit and three example
 * projects (music, app, mixing & mastering) including generated concepts.
 *
 * Run with: npm run seed
 * The Supabase store is not touched - use `supabase/seed.sql` for that.
 */
import path from "node:path";

import { JsonTableDriver } from "@/lib/db/json-driver";
import { ALL_TABLES } from "@/lib/db/driver";
import { Repository } from "@/lib/db/repository";
import { composeConcepts } from "@/lib/concepts/composer";
import { layoutConcept } from "@/lib/concepts/layout";
import { DEMO_ACCOUNT } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { DEMO_STARTING_CREDITS } from "@/lib/credits/pricing";
import { defaultBrief } from "@/lib/domain/defaults";
import type { ProjectBrief } from "@/lib/domain/schemas";
import { sequentialIdFactory } from "@/lib/util/id";

const dataDir = process.env.ADREEL_DATA_DIR ?? ".adreel";
const driver = new JsonTableDriver(path.resolve(process.cwd(), dataDir, "db"));
const repo = new Repository(driver);
const nextId = sequentialIdFactory("seed");

function musicBrief(): ProjectBrief {
  const brief = defaultBrief("music");
  return {
    ...brief,
    name: "Midnight Drive – Release-Kampagne",
    description:
      "Neue Synthwave-Single über nächtliche Autofahrten. Erscheint am 14. März auf allen Plattformen.",
    audience: "Synthwave- und Retro-Hörer zwischen 18 und 34",
    goal: "Streams und Playlist-Saves am Release-Tag",
    tone: "emotional",
    durationSeconds: 15,
    callToAction: "Jetzt überall streamen",
    styleId: "music_visualizer",
    details: {
      ...brief.details,
      artistName: "NOVA",
      songTitle: "Midnight Drive",
      genre: "Synthwave",
      mood: "melancholisch, treibend",
      releaseDate: "14. März",
      streamingUrl: "https://open.spotify.com/",
      lyricsExcerpt: "Ich fahr durch die Nacht. Die Stadt schläft schon.",
      rightsConfirmed: true,
    },
  } as ProjectBrief;
}

function appBrief(): ProjectBrief {
  const brief = defaultBrief("app");
  return {
    ...brief,
    name: "Beleg-App Feature-Demo",
    description:
      "App, die Belege fotografiert, automatisch kategorisiert und als Export an die Steuerberatung schickt.",
    audience: "Selbstständige und kleine Teams",
    goal: "Installationen aus dem App Store",
    tone: "professional",
    durationSeconds: 30,
    callToAction: "Kostenlos ausprobieren",
    styleId: "app_demo",
    details: {
      ...brief.details,
      appName: "Belegheld",
      platforms: ["iOS", "Android"],
      problemSolved: "Belege sammeln sich, bis die Steuererklärung zum Wochenendprojekt wird.",
      features: [
        "Beleg fotografieren und automatisch zuordnen",
        "Monatsexport für die Steuerberatung",
        "Erinnerung für fehlende Belege",
      ],
      storeUrl: "https://apps.apple.com/",
    },
  } as ProjectBrief;
}

function mixingBrief(): ProjectBrief {
  const brief = defaultBrief("mixing_mastering");
  return {
    ...brief,
    name: "Mix & Master Angebot",
    description:
      "Mixing- und Mastering-Service für Independent-Artists mit Fokus auf Hip-Hop und Pop.",
    audience: "Independent-Artists mit fertigen Demos",
    goal: "Anfragen über das Buchungsformular",
    tone: "luxurious",
    durationSeconds: 30,
    callToAction: "Jetzt Slot sichern",
    styleId: "before_after",
    details: {
      ...brief.details,
      offerName: "Full Mix & Master",
      genres: ["Hip-Hop", "Pop", "R&B"],
      services: ["Stem-Mixing", "Mastering für Streaming", "2 Revisionen inklusive"],
      price: "ab 249 €",
      turnaround: "3–5 Werktage",
      references: ["Album „Nachtluft“ – 2025"],
      bookingUrl: "https://example.com/booking",
    },
  } as ProjectBrief;
}

async function main() {
  for (const table of ALL_TABLES) {
    await driver.truncate(table);
  }

  const user = await repo.createUser({
    id: nextId(),
    email: DEMO_ACCOUNT.email,
    displayName: DEMO_ACCOUNT.displayName,
    passwordHash: await hashPassword(DEMO_ACCOUNT.password),
    isDemo: true,
  });

  const workspace = await repo.createWorkspace({
    id: nextId(),
    ownerId: user.id,
    name: "AdReel Demo-Studio",
    credits: DEMO_STARTING_CREDITS,
    onboardedAt: new Date().toISOString(),
  });

  await repo.upsertSubscription({
    workspaceId: workspace.id,
    plan: "demo",
    status: "active",
    creditsPerMonth: DEMO_STARTING_CREDITS,
    renewsAt: null,
  });
  await repo.addCreditTransaction({
    workspaceId: workspace.id,
    amount: 0,
    reason: "Demo-Guthaben",
  });

  await repo.createBrandKit({
    id: nextId(),
    workspaceId: workspace.id,
    name: "NOVA Nightdrive",
    primaryColor: "#8B5CF6",
    secondaryColor: "#EC4899",
    accentColor: "#38BDF8",
    fontFamily: "Inter",
    logoAssetId: null,
  });

  for (const brief of [musicBrief(), appBrief(), mixingBrief()]) {
    const project = await repo.createProject({
      id: nextId(),
      workspaceId: workspace.id,
      ownerId: user.id,
      name: brief.name,
      category: brief.category,
      status: "draft",
      brief,
      selectedConceptId: null,
      thumbnailUrl: null,
      durationSeconds: brief.durationSeconds,
      brandKitId: null,
    });

    const concepts = composeConcepts(brief, 3).map((draft) => ({
      ...layoutConcept(draft, {
        brief,
        projectId: project.id,
        makeId: nextId,
      }),
      isDemo: true,
    }));
    await repo.replaceConcepts(workspace.id, project.id, concepts);

    console.log(`seeded "${project.name}" with ${concepts.length} concepts`);
  }

  console.log(
    `\nDemo-Login: ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}\nDaten in: ${path.resolve(process.cwd(), dataDir)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
