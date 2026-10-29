import type { HomeDictionary } from "../types";

// The home page in this language (sections of src/app/[locale]/page.tsx).
const home: HomeDictionary = {
  "hero": {
    "eyebrow": "Software für die Prüfung von Brandschutzeinrichtungen",
    "title": "Brandschutzprüfungen.",
    "titleMuted": "Ohne Papier und Abtippen.",
    "body": "SparxDeck ist eine App für Servicefirmen, die Feuerlöscher, Hydranten, Notbeleuchtung, Brandschutzklappen und Brandschutztüren prüfen. Der Techniker scannt ein QR-Etikett, hakt die Prüfung auf dem Handy ab und das Protokoll ist noch vor Ort fertig. Die nächsten Prüftermine überwacht das System statt einer Excel-Tabelle.",
    "primary": "Mit SparxDeck starten",
    "secondary": "Demo vereinbaren",
    "note": "Läuft im Browser auf Computer und Handy. Ohne Installation."
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
  "steps": {
    "eyebrow": "So funktioniert es",
    "title": "Eine Prüfung in fünf Schritten",
    "items": [
      "Sie legen Kunden, Gebäude und Geräte an oder importieren sie aus Ihrer bisherigen Tabelle.",
      "Sie drucken die QR-Etiketten, der Techniker klebt sie beim ersten Besuch auf die Geräte.",
      "Bei jeder Prüfung scannt der Techniker das Etikett und hakt die Checkliste auf dem Handy ab.",
      "Ein nicht bestandener Punkt wird als Mangel mit Foto und Frist erfasst.",
      "Der Kunde unterschreibt auf dem Display, das Protokoll geht per E-Mail hinaus und der nächste Termin wird gesetzt."
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
        "question": "Für wen ist SparxDeck gedacht?",
        "answer": "Für Servicefirmen, die Brandschutzeinrichtungen prüfen und warten, typischerweise mit 3 bis 30 Mitarbeitenden. Techniker arbeiten vor Ort auf dem Handy, das Büro am Computer."
      },
      {
        "question": "Welche Geräte unterstützt SparxDeck?",
        "answer": "Feuerlöscher, Hydranten, Notbeleuchtung, Brandschutzklappen und Brandschutztüren. Gerätetypen und ihre Prüfpunkte passen Sie selbst an, damit der Techniker genau das prüft, was er soll."
      },
      {
        "question": "Funktioniert die App ohne Netz?",
        "answer": "Ja. Eine laufende Prüfung und der Tagesplan werden im Handy gespeichert. Prüfungen, Fotos und besuchte Gebäude warten dort und werden gesendet, sobald eine Verbindung besteht."
      },
      {
        "question": "Kann ich das Protokoll anpassen?",
        "answer": "Ja. Im Vorlageneditor legen Sie Blöcke, Texte, Logo, Schrift und Farbe fest. Was ein Protokoll nach den Vorschriften enthalten muss, bestimmt Ihre Firma; die App erfindet keine Vorschriften. Ein ausgestelltes Protokoll ändert sich nicht mehr."
      },
      {
        "question": "Wie übernehme ich meine bisherigen Daten?",
        "answer": "Kunden, Gebäude und Geräte importieren Sie aus einer Excel- oder CSV-Datei. Die App erkennt die Spalten, zeigt vor dem Speichern eine Vorschau und ein Import lässt sich rückgängig machen."
      },
      {
        "question": "Was kostet SparxDeck?",
        "answer": "Den Preis vereinbaren wir nach der Größe Ihrer Firma, bezahlt wird per Überweisung auf Grundlage eines Vertrags. Vereinbaren Sie eine kurze Demo und wir erstellen Ihnen ein Angebot."
      },
      {
        "question": "Wie lange dauert die Einarbeitung?",
        "answer": "Wenige Minuten. Ein Techniker schafft die erste Prüfung ohne Schulung, und in der App gibt es Beispieldaten zum Ausprobieren."
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
  }
};

export default home;
