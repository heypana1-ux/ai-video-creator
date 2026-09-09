import type { ProjectCategory } from "./enums";
import type { ProjectBrief } from "./schemas";

/** Empty-but-valid detail objects, used to seed the wizard per category. */
export function defaultDetails(category: ProjectCategory): ProjectBrief["details"] {
  switch (category) {
    case "music":
      return {
        artistName: "",
        songTitle: "",
        genre: "",
        mood: "",
        releaseDate: "",
        streamingUrl: "",
        audioAssetId: null,
        coverAssetId: null,
        lyricsExcerpt: "",
        songSectionStart: 0,
        songSectionEnd: 30,
        rightsConfirmed: false,
      };
    case "website":
      return {
        url: "",
        coreMessage: "",
        benefits: [],
        siteGoal: "",
        desiredCta: "",
        importedTitle: "",
        importedDescription: "",
        importedHeadings: [],
        importReviewed: false,
      };
    case "app":
      return {
        appName: "",
        platforms: [],
        problemSolved: "",
        features: [],
        storeUrl: "",
        screenshotAssetIds: [],
        screenRecordingAssetIds: [],
      };
    case "mixing_mastering":
      return {
        offerName: "",
        genres: [],
        services: [],
        price: "",
        priceOnRequest: false,
        turnaround: "",
        references: [],
        beforeAudioAssetId: null,
        afterAudioAssetId: null,
        bookingUrl: "",
      };
    case "product":
      return { productName: "", keyBenefits: [], price: "", shopUrl: "", usp: "" };
    case "service":
      return {
        serviceName: "",
        problemSolved: "",
        deliverables: [],
        price: "",
        bookingUrl: "",
        serviceArea: "",
      };
    case "event":
      return { eventName: "", eventDate: "", venue: "", lineup: [], ticketUrl: "", ticketPrice: "" };
    case "custom":
      return { offerName: "", highlights: [], proofPoints: [] };
  }
}

/** A complete, valid-by-construction brief for a fresh project. */
export function defaultBrief(category: ProjectCategory): ProjectBrief {
  return {
    category,
    name: "",
    description: "",
    audience: "",
    goal: "",
    platform: "tiktok",
    language: "de",
    tone: "professional",
    durationSeconds: 15,
    callToAction: "",
    targetUrl: "",
    logoAssetId: null,
    brandColors: [],
    mediaAssetIds: [],
    styleId: "viral_ugc",
    extraPrompt: "",
    details: defaultDetails(category),
  } as ProjectBrief;
}
