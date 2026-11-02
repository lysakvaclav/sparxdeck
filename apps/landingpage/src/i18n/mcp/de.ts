import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Prüfungen, Fristen und Mängel direkt in Ihrem KI-Assistenten.",
  "intro": "SparxDeck MCP verbindet die Daten Ihrer Firma über den offenen Standard Model Context Protocol mit KI-Assistenten wie Claude, ChatGPT oder Gemini. Sie fragen in normaler Sprache, und der Assistent antwortet aus Ihren echten Daten.",
  "connectTitle": "So verbinden Sie sich",
  "address": "Serveradresse",
  "steps": [
    "Der Inhaber der Firma schaltet KI-Assistenten in der SparxDeck-App unter KI-Assistenten ein. Änderungen an Daten erlaubt er separat.",
    "Fügen Sie in Ihrem Assistenten einen eigenen Connector (entfernter MCP-Server) mit der Adresse oben hinzu.",
    "Melden Sie sich bei SparxDeck an, wählen Sie die Firma und erlauben Sie den Zugriff. Sie können ihn jederzeit widerrufen."
  ],
  "note": "Assistenten, die sich nicht per OAuth anmelden, verbinden Sie mit einem persönlichen Token aus der App.",
  "toolsTitle": "Was der Assistent kann",
  "readTitle": "Lesen",
  "readGroups": [
    "Überblick und Fristen",
    "Gebäude und Kunden",
    "Geräte",
    "Prüfungen und Zusammenfassungen",
    "Mängel und geplante Besuche",
    "Suche und Listen"
  ],
  "writeTitle": "Änderungen, nur wenn der Inhaber sie erlaubt",
  "writeBody": "Jede Änderung hat zwei Schritte: Der Assistent zeigt zuerst eine Vorschau und führt sie erst aus, wenn Sie ausdrücklich bestätigen.",
  "writeGroups": [
    "Mängel",
    "Besuchsplan",
    "Notizen"
  ],
  "extras": "Außerdem gibt es Ressourcen (Firma, Gerätetypen, Details zu Gebäude, Gerät, Mangel und Prüfung) und fertige Vorlagen: Plan für die nächsten Tage, Bericht für einen Kunden, Vorbereitung eines Gebäudebesuchs und Überblick über offene Mängel.",
  "securityTitle": "Sicherheit",
  "security": [
    "Standardmäßig ausgeschaltet. Der Inhaber schaltet es ein und erlaubt Änderungen separat.",
    "Der Assistent hat dieselben Rechte wie das Mitglied, das ihn verbunden hat, mit denselben Zugriffsregeln wie in der App.",
    "Jede Änderung müssen Sie ausdrücklich bestätigen. Nichts wird gelöscht und keine Protokolle werden ausgestellt.",
    "Standorte und Wohnorte der Techniker sieht der Assistent nie.",
    "Texte aus den Daten erhält der Assistent als Daten gekennzeichnet, nicht als Anweisungen.",
    "Jeder Aufruf wird protokolliert (wer, wann, welches Werkzeug), die Übersicht sehen Sie in der App.",
    "Aufrufe sind begrenzt, Tokens laufen ab und Sie können eine Verbindung jederzeit widerrufen."
  ],
  "technicalTitle": "Technische Angaben",
  "technical": [
    "Model Context Protocol 2026-07-28 über Streamable HTTP; ältere Clients von 2025 werden ebenfalls unterstützt.",
    "OAuth 2.1 mit PKCE (S256), dynamische Client-Registrierung und Client ID Metadata Documents, an diesen Server gebundene Tokens (RFC 8707).",
    "Berechtigungen sparxdeck:read und sparxdeck:write.",
    "Werkzeuge mit Beschreibungen, Ein- und Ausgabeschema, Annotationen (nur lesend, destruktiv, idempotent) und seitenweiser Ausgabe."
  ]
};

export default mcp;
