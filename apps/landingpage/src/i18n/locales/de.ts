import type { Dictionary } from "../types";
import { SITE } from "@/config/site";
import { locales } from "../config";

const de: Dictionary = {
  common: {
    backToHome: "Zurück zur Startseite",
  },
  header: {
    signIn: "Anmelden",
    getStarted: "Jetzt starten",
    bookDemo: "Demo vereinbaren",
    company: "Unternehmen",
    workWithUs: "Arbeiten bei uns",
    mission: "Unsere Mission",
    team: "Team",
    newsroom: "Neuigkeiten",
    careers: "Karriere",
    megaContactLabel: "Kontakt",
  },
  hero: {
    heading: "Brandschutzprüfungen.\nOhne Papierkram.",
    body:
      "SparxDeck ist die App für Servicebetriebe, die Brandschutzeinrichtungen prüfen. Der Techniker scannt einen QR-Code, hakt die Checkliste ab und das Prüfprotokoll geht automatisch an den Kunden. Anstehende Prüftermine überwacht das System statt einer Excel-Tabelle.",
    primaryCta: "Jetzt starten",
    secondaryCta: "So funktioniert's",
  },
  companies: {
    cards: [
      {
        title: "Geräteverwaltung und QR-Etiketten",
        description:
          "Kunden, Gebäude und alle Geräte übersichtlich an einem Ort: Feuerlöscher, Hydranten, Notbeleuchtung, Brandschutzklappen und Brandschutztüren. SparxDeck druckt QR-Etiketten, und jedes Gerät hat eine eigene Akte mit allen bisherigen Prüfungen.",
      },
      {
        title: "Prüfung vor Ort per Smartphone",
        description:
          "Der Techniker scannt den QR-Code und hakt eine kurze Checkliste ab: Druck, Plombe, Beschädigung, Prüffrist. Mängel werden direkt fotografiert. Die App funktioniert auch ohne Empfang, etwa im Keller oder im Technikraum.",
      },
      {
        title: "Protokoll fertig, bevor Sie gehen",
        description:
          "Der Kunde unterschreibt direkt auf dem Display, und das PDF-Protokoll mit Ihrem Firmenlogo geht sofort per E-Mail an ihn. Das abendliche Abtippen von Papiernotizen entfällt.",
      },
      {
        title: "Prüftermine im Blick",
        description:
          "Sehen Sie, was nächsten Monat fällig wird, und erhalten Sie Erinnerungen an anstehende Prüfungen. Kein Termin geht verloren, und aus jeder Prüfung wird der nächste Auftrag.",
      },
      {
        title: "Mängel unter Kontrolle",
        description:
          "Jeder gefundene Mangel wird zu einer Aufgabe, die Sie bis zur Behebung verfolgen. Gebäudeverwalter sehen den Zustand ihrer Geräte im Kundenportal.",
      },
    ],
    headingLine1: "Keine überladene Unternehmenssoftware.",
    headingLine2: "Nur das, was Techniker wirklich brauchen.",
    paragraph:
      "SparxDeck ist bewusst einfach gehalten. Die Einarbeitung dauert nur wenige Minuten, Ihre Techniker nutzen die App auf dem eigenen Smartphone und Sie haben endlich den Überblick über alle Aufträge, Geräte und Termine.",
    cardCta: "Mehr erfahren",
  },
  comparison: {
    title: "Papier und Excel vs. SparxDeck",
    subtitle:
      "So verändert sich jeder Schritt der Prüfung, wenn Notizblock, Ordner und Tabellen durch eine einzige App ersetzt werden.",
    oldLabel: "Papier und Excel",
    newLabel: "SparxDeck",
    rows: [
      {
        topic: "Prüfnotizen",
        old: "Handschriftlich auf Papier, oft unleserlich und fehlerhaft",
        new: "QR-Code scannen und kurze Checkliste auf dem Smartphone abhaken",
      },
      {
        topic: "Prüfprotokoll",
        old: "Abends stundenlanges Abtippen in Word oder Excel",
        new: "PDF mit Ihrem Logo und der Unterschrift des Kunden, noch vor Ort fertig",
      },
      {
        topic: "Prüftermine",
        old: "Tabelle, Kalender oder Gedächtnis",
        new: "Automatische Übersicht und Erinnerungen mit Vorlauf",
      },
      {
        topic: "Mängel",
        old: "Eine Randnotiz, die leicht verloren geht",
        new: "Eine Aufgabe mit Foto, verfolgt bis zur Behebung",
      },
      {
        topic: "Gerätehistorie",
        old: "Ordner im Büro und Suchen in Akten",
        new: "Die vollständige Historie jedes Geräts mit einem Tippen",
      },
      {
        topic: "Kunde",
        old: "Wartet auf das Protokoll und kennt den Zustand seiner Geräte nicht",
        new: "Erhält das Protokoll sofort per E-Mail und sieht den Status im Kundenportal",
      },
    ],
  },
  radar: {
    title: "Der gesamte Prüfzyklus in einem System",
    subtitle:
      "Von der Geräteverwaltung über die Prüfung vor Ort bis zum unterschriebenen Protokoll und zum nächsten Termin. SparxDeck deckt den ganzen Ablauf ab, den Servicebetriebe sonst aus Papier, Excel und E-Mails zusammensetzen.",
    labels: ["Verwaltung", "QR-Etiketten", "Prüfung", "Protokolle", "Termine", "Mängel"],
    keyAreasHeading: "Was SparxDeck abdeckt",
    keyAreas: [
      {
        title: "Verwaltung",
        description:
          "Kunden, Gebäude und Geräte aller Art mit vollständiger Prüfhistorie an einem Ort.",
      },
      {
        title: "QR-Etiketten",
        description:
          "Etiketten direkt aus der App drucken. Ein Scan, und der Techniker weiß, vor welchem Gerät er steht.",
      },
      {
        title: "Prüfung",
        description:
          "Checkliste je Gerätetyp, Mängelfoto mit einem Tippen und volle Funktion auch ohne Empfang.",
      },
      {
        title: "Protokolle",
        description:
          "PDF-Protokoll mit Ihrem Logo und der Unterschrift des Kunden, direkt nach der Prüfung versendet.",
      },
      {
        title: "Termine",
        description:
          "Übersicht der Prüfungen, die nächsten Monat fällig werden, mit rechtzeitigen Erinnerungen.",
      },
      {
        title: "Mängel",
        description: "Jeder Mangel ist eine Aufgabe mit Status, die bis zur Behebung verfolgt wird.",
      },
    ],
    howItWorksHeading: "So läuft eine Prüfung mit SparxDeck ab",
    howItWorks: [
      "Im Büro legen Sie Kunde, Gebäude und Geräte an oder importieren sie aus Ihrer bisherigen Tabelle.",
      "Sie drucken die QR-Etiketten, und der Techniker klebt sie beim ersten Besuch auf die Geräte.",
      "Bei jeder weiteren Prüfung scannt der Techniker das Etikett und hakt die Checkliste auf dem Smartphone ab.",
      "Findet er einen Mangel, fotografiert er ihn und im System entsteht automatisch eine Aufgabe.",
      "Der Kunde unterschreibt auf dem Display, das Protokoll geht per E-Mail an ihn und der nächste Prüftermin wird festgelegt.",
    ],
    resultHeading: "Ihr Nutzen",
    result: [
      "Feierabend ohne Abtippen von Papiernotizen.",
      "Keine vergessene Prüfung und damit kein verlorener Auftrag.",
      "Wiederkehrende Aufträge, die das System für Sie im Blick behält.",
      "Professionelle Protokolle und nachvollziehbare Historie für Behördenprüfungen oder Schadensfälle.",
    ],
  },
  faq: {
    headingLine1: "Häufig gestellte Fragen",
    headingLine2: "",
    items: [
      {
        id: "who",
        question: "Für wen ist SparxDeck gedacht?",
        answer:
          "Für Servicebetriebe, die von Gebäude zu Gebäude fahren und Brandschutzeinrichtungen prüfen, typischerweise mit 3 bis 30 Mitarbeitenden. Techniker arbeiten unterwegs auf dem Smartphone, das Büro am Computer und Gebäudeverwalter in ihrem eigenen Kundenportal.",
      },
      {
        id: "equipment",
        question: "Welche Geräte unterstützt SparxDeck?",
        answer:
          "Feuerlöscher, Hydranten, Notbeleuchtung, Brandschutzklappen und Brandschutztüren. Jeder Gerätetyp hat eine eigene Checkliste, sodass der Techniker genau das prüft, was nötig ist.",
      },
      {
        id: "offline",
        question: "Funktioniert die App ohne Empfang?",
        answer:
          "Ja. Techniker können auch im Keller oder im Technikraum ohne Verbindung prüfen. Sobald das Smartphone wieder online ist, werden die Daten automatisch synchronisiert.",
      },
      {
        id: "pricing",
        question: "Was kostet SparxDeck?",
        answer:
          "Sie zahlen ein monatliches Abonnement abhängig von der Anzahl der Techniker oder Geräte, sodass der Preis mit Ihrem Betrieb wächst. Vereinbaren Sie eine kurze Demo, und wir erstellen Ihnen ein individuelles Angebot.",
      },
      {
        id: "protocols",
        question: "Entsprechen die Protokolle den Vorschriften?",
        answer:
          "Ja. Die Protokollvorlagen basieren auf den lokalen Prüfvorschriften in jedem Land, in dem SparxDeck tätig ist. Jedes Protokoll trägt das Logo und die Angaben Ihres Unternehmens sowie die Unterschrift des Kunden.",
      },
      {
        id: "portal",
        question: "Sehen auch Gebäudeverwalter den Zustand ihrer Geräte?",
        answer:
          "Ja. Gebäudeverwalter und Eigentümer haben ein eigenes Kundenportal, in dem sie den Zustand ihrer Geräte, offene Mängel und anstehende Termine sehen und alle Protokolle herunterladen können.",
      },
      {
        id: "onboarding",
        question: "Wie lange dauert die Einarbeitung?",
        answer:
          "Wenige Minuten. SparxDeck enthält nur das Wesentliche, sodass ein Techniker die erste Prüfung ohne Schulung durchführen kann. Ihre bisherigen Daten aus Excel importieren Sie mit wenigen Klicks.",
      },
    ],
  },
  getStarted: {
    primaryCta: "Mit SparxDeck starten",
    secondaryCta: "Demo vereinbaren",
  },
  footer: {
    allRightsReserved: "Alle Rechte vorbehalten.",
    cookiesSettings: "Cookies",
    termsOfService: "Nutzungsbedingungen",
    privacyPolicy: "Datenschutzerklärung",
    companyHeading: "Unternehmen",
    mission: "Unsere Mission",
    team: "Team",
    newsroom: "Neuigkeiten",
    workWithUs: "Arbeiten bei uns",
    careers: "Karriere",
  },
  pages: {
    mission: {
      heading: "Unsere Mission",
      subheading: "Prüftechniker sollen ihre Zeit an den Geräten verbringen, nicht mit Papierkram.",
      body: [
        "Brandschutzprüfungen schützen die Menschen in Gebäuden. Trotzdem werden sie in vielen Servicebetrieben noch so durchgeführt wie vor zwanzig Jahren: Der Techniker geht durch das Gebäude, schreibt alles auf Papier und tippt die Notizen abends stundenlang in ein Protokoll ab. Anstehende Prüfungen werden in Excel oder im Kopf verwaltet.",
        "Das kostet Zeit, Geld und Nerven. Eine vergessene Prüfung bedeutet einen verlorenen Auftrag, eine unleserliche Notiz einen Fehler im Protokoll, und nach einem Schadensfall ist schwer nachzuweisen, was wann geprüft wurde.",
        "SparxDeck ändert das. Der Techniker scannt einen QR-Code, hakt die Checkliste ab, und das Protokoll ist fertig. Der Betrieb hat alle Geräte, Mängel und Termine im Blick, und aus jeder Prüfung entsteht der nächste Auftrag. Wir bauen kein weiteres komplexes Unternehmenssystem, sondern ein Werkzeug, das man in Minuten versteht und gerne benutzt.",
      ],
    },
    about: {
      heading: "Über SparxDeck",
      subheading: "Software für Servicebetriebe im Brandschutz.",
      body: [
        "SparxDeck ist eine Web- und Mobile-App für Betriebe, die regelmäßig Brandschutzeinrichtungen prüfen: Feuerlöscher, Hydranten, Notbeleuchtung, Brandschutzklappen und Brandschutztüren. Sie ersetzt Papiernotizen und Excel durch ein übersichtliches System.",
        `SparxDeck wurde in Tschechien gegründet und ist für den Einsatz in mehreren Ländern ausgelegt. Der Kern der App ist überall gleich; nur Sprache und Protokollvorlagen werden an die lokalen Vorschriften angepasst. Die App ist in ${locales.length} Sprachen verfügbar.`,
        "Wir entwickeln das Produkt in enger Zusammenarbeit mit Servicebetrieben und Technikern aus der Praxis. Wenn Sie eine Idee haben, die Ihnen die Arbeit noch leichter machen würde, schreiben Sie uns.",
      ],
    },
    team: {
      heading: "Das SparxDeck-Team",
      subheading: "Das Team, das einfache Software für Prüfbetriebe baut.",
    },
    careers: {
      heading: "Karriere",
      subheading:
        "Derzeit haben wir keine offenen Stellen. Wenn Sie Lust haben, Software für eine Branche zu bauen, die Modernisierung braucht, schreiben Sie uns.",
    },
    news: {
      heading: "Neuigkeiten",
      subheading: "Noch keine Neuigkeiten. Die ersten Produkt-Updates erscheinen bald hier.",
    },
    equipmentRegister: {
      heading: "Geräteverwaltung und QR-Etiketten",
      subheading: "Alle Kunden, Gebäude und Geräte an einem Ort",
      body: [
        "In SparxDeck verwalten Sie Kunden, ihre Gebäude und einzelne Geräte in einer klaren Struktur: Feuerlöscher, Hydranten, Notbeleuchtung, Brandschutzklappen und Brandschutztüren. Zu jedem Gerät sehen Sie Typ, Standort, Datum der letzten Prüfung und die gesamte Historie. Kein Suchen mehr in Ordnern oder in mehreren Versionen derselben Tabelle.",
        "Die App druckt für jedes Gerät ein QR-Etikett. Der Techniker klebt es beim ersten Besuch auf, und ab dann genügt ein Scan, um zu wissen, vor welchem Gerät er steht und was zu tun ist. Ihre bisherigen Daten aus Excel importieren Sie mit wenigen Klicks.",
      ],
    },
    fieldInspections: {
      heading: "Prüfung vor Ort per Smartphone",
      subheading: "Scannen, abhaken, fertig",
      body: [
        "Der Techniker scannt den QR-Code am Gerät und geht die Checkliste für diesen Gerätetyp durch, beim Feuerlöscher etwa Druck, Plombe, Beschädigung und Prüffrist. Jeder Punkt ist ein einfaches Ja/Nein, sodass die Prüfung nur einen Moment dauert und nichts vergessen wird.",
        "Findet der Techniker einen Mangel, fotografiert er ihn direkt in der App. Die App funktioniert ohne Empfang im Keller oder Technikraum, und die Daten werden synchronisiert, sobald das Smartphone wieder online ist. Spezialgeräte oder lange Schulungen sind nicht nötig.",
      ],
    },
    inspectionReports: {
      heading: "Protokoll fertig, bevor Sie gehen",
      subheading: "Unterschrift auf dem Display und automatisches PDF mit Ihrem Logo",
      body: [
        "Nach Abschluss der Prüfung erstellt SparxDeck automatisch ein PDF-Protokoll aus allem, was der Techniker vor Ort erfasst hat. Der Kunde unterschreibt direkt auf dem Smartphone-Display. Das Protokoll trägt das Logo und die Angaben Ihres Unternehmens und enthält die geprüften Geräte, die Ergebnisse und gefundene Mängel.",
        "Das Protokoll geht sofort per E-Mail an den Kunden, wird im System gespeichert und steht dem Gebäudeverwalter jederzeit in seinem Portal zur Verfügung. Die Protokollvorlagen entsprechen den lokalen Vorschriften. Sie können jederzeit nachsehen, was wann bei welchem Kunden geprüft wurde, etwa bei einer Behördenprüfung oder einem Versicherungsfall.",
      ],
    },
    deadlineTracking: {
      heading: "Prüftermine im Blick",
      subheading: "Kein Termin geht verloren, und aus jeder Prüfung wird der nächste Auftrag",
      body: [
        "SparxDeck weiß, wann jedes Gerät zur nächsten Prüfung fällig ist. Sie sehen an einem Ort, was nächsten Monat ansteht, und das System erinnert Sie rechtzeitig an kommende Prüfungen. Termine müssen nicht mehr in Excel oder im Kopf verwaltet werden.",
        "Für einen Servicebetrieb bedeutet das einen stetigen Strom wiederkehrender Aufträge. Sie können Einsätze vorausplanen, sich vor der Konkurrenz beim Kunden melden und verlieren keinen Auftrag mehr, nur weil ein Termin vergessen wurde.",
      ],
    },
    defectTracking: {
      heading: "Mängel unter Kontrolle",
      subheading: "Jeder gefundene Mangel wird zur Aufgabe, die bis zur Behebung verfolgt wird",
      body: [
        "Findet ein Techniker bei der Prüfung einen Mangel, macht SparxDeck daraus automatisch eine Aufgabe mit Foto und Beschreibung. Der Mangel geht nicht in Notizen verloren, und es ist klar, wer zuständig ist.",
        "Jeder Mangel hat einen Status: neu, in Bearbeitung, behoben. Gebäudeverwalter sehen offene Mängel in ihrem Kundenportal und wissen, dass Probleme tatsächlich behoben werden, und Sie haben die Grundlage für den nächsten Auftrag.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "Nutzungsbedingungen für die Website und App von SparxDeck (zusammenfassende Hinweise, keine Rechtsberatung).",
      body: [
        `Diese Bedingungen regeln die Nutzung der Website und App von ${SITE.name}, einer Web- und Mobile-Anwendung zur Verwaltung und Prüfung von Brandschutzeinrichtungen. Mit der Registrierung oder Nutzung der App stimmen Sie ihnen zu. Wenn Sie die App im Namen eines Unternehmens nutzen, bestätigen Sie, dass Sie dazu berechtigt sind.`,
        "Die App wird als monatliches Abonnement angeboten. Der Preis richtet sich nach der aktuellen Preisliste oder einem individuellen Angebot und hängt von der Anzahl der Techniker oder Geräte ab. Sie können Ihr Abonnement jederzeit zum Ende des bezahlten Zeitraums kündigen.",
        "Sie sind für Ihre Zugangsdaten und für die Aktivitäten der Nutzer in Ihrem Konto verantwortlich. Die Daten, die Sie in die App eingeben, insbesondere Kundendaten, Geräte, Fotos und Protokolle, gehören Ihnen. Wir verarbeiten sie nur zur Erbringung des Dienstes und stellen sie Ihnen auf Anfrage als Export bereit.",
        "SparxDeck ist ein Werkzeug zur Verwaltung und Dokumentation. Die Verantwortung für die fachgerechte Durchführung der Prüfungen und die Richtigkeit der Angaben in den Protokollen trägt der Servicebetrieb mit seinen befähigten Technikern.",
        "Wir bemühen uns um eine durchgehende Verfügbarkeit und Sicherheit des Dienstes, können aber nicht garantieren, dass er stets frei von Ausfällen und Fehlern ist. Soweit gesetzlich zulässig, ist unsere Haftung auf die in den letzten 12 Monaten gezahlten Abonnementgebühren beschränkt.",
        `Software, Design und Marke von ${SITE.name} sind urheberrechtlich und durch weitere Rechte des geistigen Eigentums geschützt. Es ist untersagt, die App zu missbrauchen, ihre Sicherheitsmaßnahmen zu umgehen oder sie rechtswidrig zu nutzen.`,
        `Diese Bedingungen unterliegen dem Recht der Tschechischen Republik. Wir können sie von Zeit zu Zeit anpassen und informieren Sie über wesentliche Änderungen vorab per E-Mail. Bei Fragen erreichen Sie uns unter ${SITE.email}.`,
      ],
    },
    privacy: {
      subheading:
        "Wie wir personenbezogene Daten auf der Website und in der App von SparxDeck verarbeiten (zusammenfassende Hinweise, keine rechtliche Bewertung).",
      body: [
        `Verantwortlicher für die personenbezogenen Daten von Nutzern und Website-Besuchern ist der Betreiber des Dienstes ${SITE.name}. Bei Fragen zum Datenschutz erreichen Sie uns unter ${SITE.email}.`,
        "Wir verarbeiten Ihre Kontodaten (Name, E-Mail, Telefon, Unternehmen), Rechnungsdaten, technische Daten für den sicheren Betrieb (IP-Adresse, Gerätetyp, Anmeldeprotokolle) sowie Angaben, die Sie uns selbst senden, etwa bei der Vereinbarung einer Demo.",
        "Daten, die ein Servicebetrieb über seine Kunden, Gebäude, Geräte und Prüfungen in die App eingibt, einschließlich Fotos und Unterschriften, verarbeiten wir als Auftragsverarbeiter im Namen dieses Betriebs. Die Bedingungen dieser Verarbeitung regelt ein Auftragsverarbeitungsvertrag, der Bestandteil des Abonnements ist.",
        "Wir verarbeiten Daten zur Erbringung des Dienstes und Erfüllung des Vertrags, zur Erfüllung gesetzlicher Pflichten (z. B. Buchhaltung), aufgrund berechtigter Interessen (Sicherheit, Missbrauchsverhinderung, Verbesserung des Dienstes) und für Marketingmitteilungen auf Grundlage Ihrer Einwilligung.",
        "Die Daten können auch von sorgfältig ausgewählten Dienstleistern verarbeitet werden, etwa Anbietern von Cloud-Infrastruktur, E-Mail- und Zahlungsdiensten, stets auf Grundlage von Verträgen, die den Datenschutz nach DSGVO sicherstellen. Bei Übermittlungen außerhalb des Europäischen Wirtschaftsraums verwenden wir die Standardvertragsklauseln der EU-Kommission. Wir verkaufen keine personenbezogenen Daten.",
        "Wir speichern Daten für die Dauer Ihres Kontos und danach nur so lange, wie es zur Erfüllung gesetzlicher Pflichten oder zum Schutz unserer Rechte erforderlich ist. Nach Ende des Abonnements exportieren wir die Daten Ihres Unternehmens auf Anfrage und löschen sie anschließend.",
        "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine erteilte Einwilligung können Sie jederzeit widerrufen. Außerdem können Sie sich bei einer Datenschutzaufsichtsbehörde beschweren.",
      ],
    },
    cookies: {
      subheading: "Welche Cookies und ähnlichen Technologien die Website und App von SparxDeck verwenden.",
      body: [
        `Die Website und App von ${SITE.name} verwenden nur Cookies, die für ihren Betrieb notwendig sind. Wir setzen keine Werbe- oder Tracking-Cookies von Drittanbietern ein und verkaufen keine Informationen über Ihr Verhalten.`,
        "Notwendige Cookies in der App halten Sie angemeldet und schützen Ihr Konto vor Missbrauch. Auf der Website speichern wir in Ihrem Browser lediglich Ihre Wahl zwischen hellem und dunklem Design. Die Sprache ergibt sich aus der Adresse der Seite.",
        "Sollten wir Analysewerkzeuge oder andere nicht unbedingt erforderliche Cookies einsetzen, holen wir vorab Ihre Einwilligung ein und aktualisieren diese Seite.",
        "Sie können Cookies jederzeit in den Einstellungen Ihres Browsers löschen oder blockieren, meist im Bereich Datenschutz oder Sicherheit. Ohne notwendige Cookies können Sie sich allerdings nicht in der App anmelden.",
        `Bei Fragen zur Verwendung von Cookies erreichen Sie uns unter ${SITE.email}.`,
      ],
    },
  },
};

export default de;
