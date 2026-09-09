import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutz" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Datenschutz</h1>
      <p className="rounded-xl border border-amber-brand/35 bg-amber-brand/10 p-3 text-amber-brand">
        Platzhalter. Diese Seite ist noch kein rechtsgültiger Text und muss vor einem
        produktiven Einsatz durch eine geprüfte Datenschutzerklärung ersetzt werden.
      </p>

      <h2>Welche Daten verarbeitet werden</h2>
      <ul>
        <li>Kontodaten: E-Mail-Adresse und Anzeigename.</li>
        <li>Projektdaten: Briefings, Konzepte, Szenen und erzeugte Videos.</li>
        <li>Hochgeladene Medien: Bilder, Videos und Audiodateien.</li>
        <li>Nutzungsdaten: Credit-Buchungen und Provider-Aufrufe zur Abrechnung.</li>
      </ul>

      <h2>Weitergabe an KI-Anbieter</h2>
      <p>
        Wenn echte KI-Provider konfiguriert sind, werden Briefing-Inhalte und Prompts an
        diese Anbieter übermittelt, um Texte, Bilder, Videos oder Stimmen zu erzeugen. Im
        Demo-Modus verlässt kein Inhalt die eigene Installation.
      </p>

      <h2>Speicherdauer und Löschung</h2>
      <p>
        Projekte und Assets lassen sich jederzeit in der Anwendung löschen. Dabei werden auch
        die zugehörigen Dateien aus dem Speicher entfernt.
      </p>

      <h2>Protokollierung</h2>
      <p>
        Provider-Aufrufe werden ohne Zugangsdaten und ohne vollständige Prompts
        protokolliert. Es werden nur Länge, Anbieter, Dauer und Ergebnis gespeichert.
      </p>
    </>
  );
}
