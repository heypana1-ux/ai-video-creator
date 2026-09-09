"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { apiSend, errorMessage } from "@/lib/client/api";

const HIGHLIGHTS = [
  {
    title: "Briefing statt Blattkante",
    copy: "Du beschreibst dein Angebot in ein paar Feldern – AdReel entwickelt daraus Hook, Skript und Storyboard.",
  },
  {
    title: "Drei Konzepte zur Auswahl",
    copy: "Jedes Konzept hat einen eigenen dramaturgischen Ansatz, eine Begründung und fertige Captions.",
  },
  {
    title: "Editor und Export",
    copy: "Szenen anpassen, Vorschau abspielen und ein 9:16-MP4 mit eingebrannten Untertiteln herunterladen.",
  },
];

export function OnboardingFlow({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const [name, setName] = React.useState(workspaceName);
  const [pending, setPending] = React.useState(false);

  async function finish() {
    setPending(true);
    try {
      await apiSend("/api/onboarding", "POST", { workspaceName: name });
      router.push("/projects/new");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-8 text-center">
        <span className="inline-grid size-12 place-items-center rounded-2xl bg-linear-to-br from-violet-brand to-magenta-brand text-white">
          <Sparkles className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Willkommen bei AdReel AI</h1>
        <p className="mt-2 text-chalk-faint">
          In drei Schritten vom Briefing zum fertigen Werbevideo.
        </p>
      </div>

      <div className="space-y-3">
        {HIGHLIGHTS.map((item, index) => (
          <Card key={item.title}>
            <CardContent className="flex gap-4 pt-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-700 text-sm font-bold text-violet-brand">
                {index + 1}
              </span>
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm text-chalk-faint">{item.copy}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-4 pt-5">
          <Field label="Wie soll dein Workspace heißen?" htmlFor="workspaceName">
            <Input
              id="workspaceName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mein Studio"
            />
          </Field>
          <Button className="w-full" onClick={finish} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Erstes Video erstellen <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
