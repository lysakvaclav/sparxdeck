import type { HomeDictionary } from "../types";

// The home page in this language (sections of src/app/[locale]/page.tsx).
const home: HomeDictionary = {
  "hero": {
    "eyebrow": "Software für die Prüfung von Brandschutzeinrichtungen",
    "title": "Das Komplettsystem für Brandschutzprüfungen.",
    "body": "Software für Servicefirmen. Anlagenverzeichnis, QR-Etiketten, Planung und Routen der Techniker, Prüfungen auf dem Handy, Protokolle, Mängel und Fristen an einem Ort.",
    "cta": "Demo vereinbaren"
  },
  "facts": [
    {
      "value": "1 Scan",
      "label": "und der Techniker sieht die Gerätekarte samt Checkliste"
    },
    {
      "value": "Ohne Netz",
      "label": "Prüfung und Tagesplan funktionieren auch im Keller oder Heizraum"
    },
    {
      "value": "PDF vor Ort",
      "label": "Protokoll mit Unterschrift des Kunden direkt nach der Prüfung"
    },
    {
      "value": "Wenige Minuten",
      "label": "Einarbeitung statt einer ganztägigen Schulung"
    }
  ],
  "platform": {
    "eyebrow": "Plattform",
    "title": "Alles, was ein Prüfbetrieb braucht. Nicht mehr.",
    "body": "Von der Geräteverwaltung über die Prüfung vor Ort bis zum unterschriebenen Protokoll, zu Mängeln und dem nächsten Termin. Ein System für Büro und Techniker.",
    "learnMore": "Mehr erfahren"
  },
  "features": [
    {
      "label": "Geräteverwaltung",
      "title": "Kunden, Gebäude und Geräte an einem Ort",
      "body": "Feuerlöscher, Hydranten, Notbeleuchtung, Klappen und Türen mit Standort, Seriennummer und kompletter Prüfhistorie. Ihre bisherige Tabelle importieren Sie aus Excel, QR-Etiketten drucken Sie direkt aus der App."
    },
    {
      "label": "Prüfung vor Ort",
      "title": "Scannen, abhaken, fertig",
      "body": "Der Techniker scannt das Etikett und geht die Checkliste für den Gerätetyp durch, Mängel fotografiert er. Ohne Netz wartet die Prüfung im Handy und wird gesendet, sobald die Verbindung zurück ist."
    },
    {
      "label": "Protokolle",
      "title": "Das Protokoll ist fertig, bevor Sie gehen",
      "body": "Ein PDF mit Ihrem Firmenlogo und der Unterschrift des Kunden entsteht direkt nach der Prüfung und geht mit einem Tippen per E-Mail hinaus. Das Aussehen legen Sie im Vorlageneditor fest. Ein ausgestelltes Protokoll ändert sich nie mehr."
    },
    {
      "label": "Termine",
      "title": "Keine Prüfung geht verloren",
      "body": "Der Kalender zeigt, was wann fällig wird und wer wohin fährt. Eine Übersicht für 30, 60 und 90 Tage und eine wöchentliche Zusammenfassung per E-Mail behalten die Termine für Sie im Blick."
    },
    {
      "label": "Mängel",
      "title": "Mängel bis zur Behebung verfolgt",
      "body": "Ein nicht bestandener Prüfpunkt wird zum Mangel mit Foto, Schweregrad, verantwortlicher Person und Frist. Jede Änderung wird im Verlauf festgehalten."
    },
    {
      "label": "Karte und Routen",
      "title": "Gebäude auf der Karte, Einsätze nach Entfernung sortiert",
      "body": "Die Karte zeigt den Zustand aller Gebäude. Eine Route sortiert die Einsätze des Tages und schlägt nahe Gebäude vor, deren Prüfung bald fällig ist. Entfernungen gelten in Luftlinie, es ist keine Navigation."
    }
  ],
  "principles": {
    "eyebrow": "Warum SparxDeck",
    "title": "Gemacht für die Arbeit vor Ort",
    "items": [
      {
        "title": "Einfach",
        "body": "Nur das, was ein Techniker wirklich braucht. Kein komplexes Unternehmenssystem, keine lange Einarbeitung."
      },
      {
        "title": "Funktioniert ohne Netz",
        "body": "Prüfungen, Fotos und der Tagesplan warten im Handy und werden gesendet, sobald eine Verbindung besteht."
      },
      {
        "title": "Ihre Daten bleiben Ihre",
        "body": "Jede Firma sieht nur ihre eigenen Daten. Export als CSV jederzeit, ausgestellte Protokolle bleiben unverändert."
      }
    ]
  },
  "comparison": {
    "eyebrow": "Vergleich",
    "title": "Papier und Excel vs. SparxDeck",
    "body": "Wie sich jeder Schritt einer Prüfung ändert, wenn Notizbuch, Ordner und Tabellen einer App weichen.",
    "oldLabel": "Papier und Excel",
    "newLabel": "SparxDeck",
    "rows": [
      {
        "topic": "Prüfnotiz",
        "old": "Von Hand auf Papier, oft unleserlich",
        "new": "QR-Scan und Checkliste auf dem Handy"
      },
      {
        "topic": "Protokoll",
        "old": "Abends Abtippen in Word oder Excel",
        "new": "PDF mit Unterschrift des Kunden direkt vor Ort"
      },
      {
        "topic": "Prüftermine",
        "old": "Tabelle, Kalender oder Gedächtnis",
        "new": "Übersicht fälliger Termine und wöchentliche Zusammenfassung"
      },
      {
        "topic": "Mängel",
        "old": "Randnotiz, die verloren geht",
        "new": "Mangel mit Foto, verantwortlicher Person und Frist"
      },
      {
        "topic": "Gerätehistorie",
        "old": "Ordner und Suchen in Akten",
        "new": "Komplette Historie jedes Geräts mit einem Tippen"
      },
      {
        "topic": "Einsatzplanung",
        "old": "Aus dem Kopf und nach Erfahrung",
        "new": "Kalender, Gebäudekarte und Tagesroute"
      }
    ]
  },
  "faq": {
    "eyebrow": "FAQ",
    "title": "Häufige Fragen",
    "body": "Keine Antwort gefunden? Schreiben Sie uns, wir zeigen Ihnen SparxDeck gern.",
    "items": [
      {
        "question": "Was kostet SparxDeck?",
        "answer": "Den Preis vereinbaren wir je nach Größe Ihrer Firma. Bezahlt wird per Überweisung auf Grundlage eines Vertrags, Ihre Kunden zahlen nichts. Vereinbaren Sie eine kurze Vorführung, und wir erstellen Ihnen ein Angebot."
      },
      {
        "question": "Welche Vorteile bringt SparxDeck?",
        "answer": "Techniker tippen Prüfungen abends nicht mehr ab: Sie scannen das QR-Etikett, haken die Prüfung auf dem Handy ab, und das Protokoll entsteht direkt aus den erfassten Daten. Fristen und offene Mängel überwacht das System statt Excel, und alle Protokolle haben ein einheitliches Aussehen mit Ihrem Logo. Weniger Papier, weniger Abtippen, weniger Fehler."
      },
      {
        "question": "Auf welchen Geräten läuft SparxDeck?",
        "answer": "Es läuft im Browser auf iPhone, Android und Computer, ohne Installation aus einem App Store. Auf dem Handy legen Sie es wie eine normale App auf den Startbildschirm. Es funktioniert auch ohne Empfang: Eine begonnene Prüfung, Fotos und besuchte Gebäude werden im Handy gespeichert und gesendet, sobald eine Verbindung besteht."
      },
      {
        "question": "Was unterscheidet SparxDeck von Excel oder allgemeinen Systemen?",
        "answer": "Es ist gezielt für die Prüfung von Brandschutzeinrichtungen gebaut und nicht aus einem allgemeinen Servicesystem angepasst. Es bietet QR-Etiketten, Checklisten je Gerätetyp, Mängelverwaltung, Fristen, Grundrisse und eine Gebäudekarte. Angebote und Rechnungen gehören nicht dazu, deshalb bleibt es einfach."
      },
      {
        "question": "Wie übernehme ich meinen Bestand und binde andere Systeme an?",
        "answer": "Kunden, Gebäude und Geräte importieren Sie aus einer Excel- oder CSV-Datei. Die App erkennt die Spalten selbst, zeigt vor dem Speichern eine Vorschau, und der ganze Import lässt sich rückgängig machen. Daten exportieren Sie jederzeit als CSV. Eine direkte Anbindung an Buchhaltungssysteme gibt es noch nicht."
      },
      {
        "question": "Wie schnell können wir starten?",
        "answer": "Sofort. Sie legen das Konto selbst an und probieren alles mit Beispieldaten aus. Den Bestand importieren Sie aus einer Datei, drucken die QR-Etiketten, und ein Techniker schafft die erste Prüfung ohne lange Schulung."
      },
      {
        "question": "Wie schützt SparxDeck die Daten?",
        "answer": "Die Daten jeder Firma sind von allen anderen getrennt, und der Zugriff richtet sich nach Rollen: Inhaber, Administrator und Techniker. Ein ausgestelltes Protokoll wird nie überschrieben; eine Korrektur erzeugt eine neue Version, und das Original bleibt erhalten."
      }
    ]
  },
  "cta": {
    "title": "Testen Sie SparxDeck in Ihrer Firma",
    "body": "Legen Sie ein Konto an und probieren Sie die App mit Beispieldaten aus, oder vereinbaren Sie eine kurze Demo.",
    "primary": "Mit SparxDeck starten",
    "secondary": "Demo vereinbaren"
  },
  "shots": {
    "dashboard": "SparxDeck-Übersicht mit Terminen, Mängeln und der heutigen Route",
    "devices": "Geräteliste mit Etiketten, Standorten und Prüfterminen",
    "check": "Prüfung eines Feuerlöschers auf dem Handy",
    "protocol": "Vorlageneditor für Protokolle mit PDF-Vorschau",
    "calendar": "Kalender der geplanten Prüfungen",
    "defects": "Mängelliste mit Schweregrad und Frist",
    "map": "Gebäudekarte nach Stand der Termine",
    "route": "Route eines Technikers auf der Karte, nach Entfernung sortiert",
    "today": "Tagesplan eines Technikers auf dem Handy"
  },
  "mcp": {
    "title": "SparxDeck MCP.",
    "titleRest": "Ihre Prüfungen im KI-Assistenten.",
    "body": "Verbinden Sie SparxDeck mit ChatGPT, Claude oder Gemini und fragen Sie in normaler Sprache: was nächsten Monat fällig wird, welche Mängel überfällig sind oder wohin ein Techniker morgen fährt. Die Antwort kommt direkt aus Ihren Daten.",
    "question": "Was wird nächsten Monat fällig?",
    "answer": "Im November sind 16 Geräte in 4 Gebäuden zur Prüfung fällig. Als Erstes das Wohnhaus Lipová 12 am 3. November.",
    "cta": "Demo vereinbaren"
  }
};

export default home;
