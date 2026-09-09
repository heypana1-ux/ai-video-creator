import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nutzungsbedingungen" };

export default function TermsPage() {
  return (
    <>
      <h1>Nutzungsbedingungen</h1>
      <p className="rounded-xl border border-amber-brand/35 bg-amber-brand/10 p-3 text-amber-brand">
        Platzhalter. Diese Seite ist noch kein rechtsgültiger Text und muss vor einem
        produktiven Einsatz ersetzt werden.
      </p>

      <h2>Rechte an hochgeladenen Inhalten</h2>
      <p>
        Du bestätigst beim Upload, dass du über alle erforderlichen Rechte an Musik, Bildern,
        Videos und Marken verfügst. AdReel prüft das nicht und übernimmt keine Haftung für
        fremde Inhalte.
      </p>

      <h2>KI-generierte Inhalte</h2>
      <ul>
        <li>Erzeugte Videos sind als KI-generiert gekennzeichnet.</li>
        <li>
          AdReel erzeugt keine erfundenen Kundenstimmen, Bewertungen, Auszeichnungen oder
          Erfolgszahlen. Testimonial-Formate liefern nur Skript-Gerüste mit Platzhaltern.
        </li>
        <li>
          Aussagen in generierten Videos sind vor Veröffentlichung auf Richtigkeit zu prüfen.
          Irreführende Werbung ist untersagt.
        </li>
      </ul>

      <h2>Verfügbarkeit</h2>
      <p>
        Generierung und Rendering hängen von externen Anbietern ab. Es besteht kein Anspruch
        auf ununterbrochene Verfügbarkeit.
      </p>

      <h2>Credits</h2>
      <p>
        Credits werden vor dem Start einer kostenpflichtigen Aktion reserviert und bei
        Abbruch oder Fehlschlag automatisch zurückgebucht. Im Demo-Modus entstehen keine
        echten Kosten.
      </p>
    </>
  );
}
