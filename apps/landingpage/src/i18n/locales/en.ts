import type { Dictionary } from "../types";
import { SITE } from "@/config/site";
import { locales } from "../config";

const en: Dictionary = {
  common: {
    backToHome: "Back to homepage",
  },
  header: {
    signIn: "Sign in",
    getStarted: "Get started",
    bookDemo: "Book a demo",
    company: "Company",
    workWithUs: "Work with us",
    mission: "Our mission",
    team: "Team",
    newsroom: "News",
    careers: "Careers",
    megaContactLabel: "Contact",
  },
  hero: {
    heading: "Fire safety inspections.\nWithout the paperwork.",
    body:
      "SparxDeck is the app for service companies that inspect fire safety equipment. Technicians scan a QR code, tick through the checklist, and the report goes to the customer automatically. Upcoming inspections are tracked by the system, not a spreadsheet.",
    primaryCta: "Get started",
    secondaryCta: "How it works",
  },
  companies: {
    cards: [
      {
        title: "Equipment register and QR labels",
        description:
          "Customers, buildings and every device in one place: fire extinguishers, hydrants, emergency lighting, fire dampers and fire doors. SparxDeck prints QR labels, and every device gets its own record with a full inspection history.",
      },
      {
        title: "Field inspections on your phone",
        description:
          "The technician scans the QR code and ticks through a short checklist: pressure, seal, damage, expiry. Defects are photographed on the spot. The app works even without signal, in basements and plant rooms.",
      },
      {
        title: "Report done before you leave",
        description:
          "The customer signs right on the screen, and a PDF report with your company logo is emailed to them instantly. No more evenings retyping paper notes.",
      },
      {
        title: "Inspection deadline tracking",
        description:
          "See what's due next month and get reminders for upcoming inspections. No deadline slips through, and every inspection leads to the next job.",
      },
      {
        title: "Defects under control",
        description:
          "Every defect found becomes a task you track until it's fixed. Building managers see the status of their equipment in the client portal.",
      },
    ],
    headingLine1: "No bloated enterprise software.",
    headingLine2: "Just what technicians actually need.",
    paragraph:
      "SparxDeck is simple on purpose. You're up and running in minutes, your technicians use it on their own phones, and you finally have a clear view of every job, device and deadline.",
    cardCta: "Learn more",
  },
  comparison: {
    title: "Paper and Excel vs. SparxDeck",
    subtitle:
      "See how every step of an inspection changes when notebooks, binders and spreadsheets are replaced by a single app.",
    oldLabel: "Paper and Excel",
    newLabel: "SparxDeck",
    rows: [
      {
        topic: "Inspection notes",
        old: "Handwritten on paper, often illegible and error-prone",
        new: "Scan a QR code and tick a short checklist on your phone",
      },
      {
        topic: "Report",
        old: "Hours of retyping into Word or Excel in the evening",
        new: "A PDF with your logo and the customer's signature, done on site",
      },
      {
        topic: "Inspection dates",
        old: "A spreadsheet, a calendar or memory",
        new: "An automatic overview with reminders well in advance",
      },
      {
        topic: "Defects",
        old: "A note in the margin that easily gets lost",
        new: "A task with a photo, tracked until it's resolved",
      },
      {
        topic: "Equipment history",
        old: "Binders in the office and digging through folders",
        new: "The full history of every device, one tap away",
      },
      {
        topic: "Customer",
        old: "Waits for the report and knows nothing about their equipment",
        new: "Gets the report by email right away and sees status in the client portal",
      },
    ],
  },
  radar: {
    title: "The whole inspection cycle in one system",
    subtitle:
      "From the equipment register to the field check, the signed report and the next due date. SparxDeck covers the full cycle that service companies otherwise piece together from paper, spreadsheets and email.",
    labels: ["Register", "QR labels", "Inspection", "Reports", "Deadlines", "Defects"],
    keyAreasHeading: "What SparxDeck covers",
    keyAreas: [
      {
        title: "Register",
        description:
          "Customers, buildings and devices of every type, with their complete inspection history in one place.",
      },
      {
        title: "QR labels",
        description:
          "Print labels straight from the app. One scan and the technician knows exactly which device they're at.",
      },
      {
        title: "Inspection",
        description:
          "A checklist for each device type, one-tap defect photos, and full functionality without signal.",
      },
      {
        title: "Reports",
        description:
          "A PDF report with your logo and the customer's signature, sent right after the inspection.",
      },
      {
        title: "Deadlines",
        description: "An overview of inspections due next month, with timely reminders.",
      },
      {
        title: "Defects",
        description: "Every defect is a task with a status, tracked until it's resolved.",
      },
    ],
    howItWorksHeading: "How an inspection works with SparxDeck",
    howItWorks: [
      "In the office, add the customer, building and devices, or import them from your existing spreadsheet.",
      "Print the QR labels; the technician sticks them onto the devices on the first visit.",
      "On every following inspection, the technician scans the label and ticks through the checklist on their phone.",
      "If they find a defect, they take a photo and a task is created automatically.",
      "The customer signs on the screen, the report is emailed to them, and the next inspection date is set.",
    ],
    resultHeading: "What you get",
    result: [
      "Evenings free from retyping paper notes into reports.",
      "No forgotten inspections, and no lost jobs because of them.",
      "Recurring work that the system keeps track of for you.",
      "Professional reports and a traceable history in case of an audit or incident.",
    ],
  },
  faq: {
    headingLine1: "Frequently asked questions",
    headingLine2: "",
    items: [
      {
        id: "who",
        question: "Who is SparxDeck for?",
        answer:
          "For service companies that travel between buildings inspecting fire safety equipment, typically with 3 to 30 people. Technicians work on their phones in the field, the office works on a computer, and building managers use their own client portal.",
      },
      {
        id: "equipment",
        question: "Which equipment does SparxDeck support?",
        answer:
          "Fire extinguishers, hydrants, emergency lighting, fire dampers and fire doors. Each device type has its own checklist, so technicians check exactly what they need to.",
      },
      {
        id: "offline",
        question: "Does the app work without signal?",
        answer:
          "Yes. Technicians can inspect in basements and plant rooms with no connection. As soon as the phone is back online, everything syncs automatically.",
      },
      {
        id: "pricing",
        question: "How much does SparxDeck cost?",
        answer:
          "You pay a monthly subscription based on the number of technicians or devices, so the price grows with your company. Book a short demo and we'll prepare a tailored offer.",
      },
      {
        id: "protocols",
        question: "Do the reports meet local regulations?",
        answer:
          "Yes. Report templates are built around the local inspection requirements in every country where SparxDeck operates. Each report carries your company's logo and details and the customer's signature.",
      },
      {
        id: "portal",
        question: "Can building managers see the status of their equipment?",
        answer:
          "Yes. Building managers and owners have their own client portal where they see the status of their equipment, open defects and upcoming dates, and can download every report.",
      },
      {
        id: "onboarding",
        question: "How long does it take to get started?",
        answer:
          "A few minutes. SparxDeck contains only what matters, so a technician can do their first inspection without any training. Your existing records from Excel can be imported in a few clicks.",
      },
    ],
  },
  getStarted: {
    primaryCta: "Get started with SparxDeck",
    secondaryCta: "Book a demo",
  },
  footer: {
    allRightsReserved: "All rights reserved.",
    cookiesSettings: "Cookies",
    termsOfService: "Terms of use",
    privacyPolicy: "Privacy policy",
    companyHeading: "Company",
    mission: "Our mission",
    team: "Team",
    newsroom: "News",
    workWithUs: "Work with us",
    careers: "Careers",
  },
  pages: {
    mission: {
      heading: "Our mission",
      subheading:
        "We want inspection technicians to spend their time with the equipment, not the paperwork.",
      body: [
        "Fire safety inspections protect the people inside buildings. Yet in many service companies they're still done the way they were twenty years ago: a technician walks the building, writes everything on paper and spends the evening retyping notes into a report. Upcoming inspections are tracked in a spreadsheet or from memory.",
        "That costs time, money and nerves. A forgotten inspection means a lost job, an illegible note means a mistake in the report, and after an incident it's hard to prove what was checked and when.",
        "SparxDeck changes that. The technician scans a QR code, ticks through the checklist, and the report is done. The company sees every device, defect and deadline, and every inspection turns into the next job. We don't build another complex enterprise system. We build a tool people learn in minutes and actually enjoy using.",
      ],
    },
    about: {
      heading: "About SparxDeck",
      subheading: "Software for fire protection service companies.",
      body: [
        "SparxDeck is a web and mobile app for companies that carry out regular inspections of fire safety equipment: fire extinguishers, hydrants, emergency lighting, fire dampers and fire doors. It replaces paper notes and spreadsheets with one clear system.",
        `SparxDeck was founded in the Czech Republic and is designed to work across countries. The core of the app is the same everywhere; only the language and report templates change to match local regulations. The app is available in ${locales.length} languages.`,
        "We build the product in close collaboration with service companies and working technicians. If you have an idea that would make your work even easier, let us know.",
      ],
    },
    team: {
      heading: "The SparxDeck team",
      subheading: "The team building simple software for inspection companies.",
    },
    careers: {
      heading: "Careers",
      subheading:
        "We have no open positions right now. If building software for an industry that needs modernising sounds exciting, drop us a line.",
    },
    news: {
      heading: "News",
      subheading: "No news yet. The first product updates will appear here soon.",
    },
    equipmentRegister: {
      heading: "Equipment register and QR labels",
      subheading: "All your customers, buildings and devices in one place",
      body: [
        "In SparxDeck you keep customers, their buildings and individual devices in a clear structure: fire extinguishers, hydrants, emergency lighting, fire dampers and fire doors. For every device you see its type, location, last inspection date and full history. No more digging through binders or several versions of the same spreadsheet.",
        "The app prints a QR label for every device. The technician sticks it on during the first visit, and from then on a single scan is enough to know exactly which device they're at and what needs doing. Your existing records from Excel can be imported in a few clicks.",
      ],
    },
    fieldInspections: {
      heading: "Field inspections on your phone",
      subheading: "Scan, tick, done",
      body: [
        "The technician scans the QR code on the device and goes through a checklist tailored to that device type; for an extinguisher, for example, pressure, seal, damage and expiry. Every item is a simple yes/no, so an inspection takes moments and nothing gets missed.",
        "If the technician finds a defect, they photograph it right in the app. The app works without signal in basements and plant rooms, and data syncs as soon as the phone is back online. No special hardware or lengthy training required.",
      ],
    },
    inspectionReports: {
      heading: "Report done before you leave",
      subheading: "On-screen signature and an automatic PDF with your logo",
      body: [
        "When the inspection is finished, SparxDeck automatically generates a PDF report from everything the technician recorded in the field. The customer signs it right on the phone screen. The report carries your company's logo and details and lists the inspected devices, results and any defects found.",
        "The report is emailed to the customer instantly, stored in the system, and available to the building manager in their portal at any time. Report templates follow local regulations. You can always look up what was inspected for which customer and when, for example during an authority audit or an insurance claim.",
      ],
    },
    deadlineTracking: {
      heading: "Inspection deadline tracking",
      subheading: "No deadline slips through, and every inspection leads to the next job",
      body: [
        "SparxDeck knows when every device is due for its next inspection. You see what's due next month in one place, and the system reminds you of upcoming inspections in good time. No more tracking dates in Excel or in your head.",
        "For a service company, that means a steady stream of recurring work. You can plan visits ahead, reach out to customers before your competitors do, and never lose a job just because a date was forgotten.",
      ],
    },
    defectTracking: {
      heading: "Defects under control",
      subheading: "Every defect found becomes a task tracked until it's resolved",
      body: [
        "When a technician finds a defect during an inspection, SparxDeck automatically turns it into a task with a photo and description. The defect doesn't get lost in notes, and it's clear who is responsible for it.",
        "Each defect has a status: new, in progress, resolved. Building managers see open defects in their client portal, so they know problems are actually being fixed, and you have the basis for your next job.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "Terms of use for the SparxDeck website and app (informational summary, not legal advice).",
      body: [
        `These terms govern your use of the ${SITE.name} website and app, a web and mobile application for managing and inspecting fire safety equipment. By signing up for or using the app, you agree to these terms. If you use the app on behalf of a company, you confirm that you are authorised to do so.`,
        "The app is provided as a monthly subscription. The price follows the current price list or an individual offer and depends on the number of technicians or devices. You can cancel your subscription at any time, effective at the end of the paid period.",
        "You are responsible for your login credentials and for the activity of users in your account. The data you enter into the app, in particular customer records, equipment, photos and reports, belongs to you. We process it only to provide the service and will hand it over to you as an export on request.",
        "SparxDeck is a tool for record-keeping and documentation. Responsibility for carrying out inspections professionally and for the accuracy of the information in reports lies with the service company and its qualified technicians.",
        "We strive for continuous availability and security of the service, but we cannot guarantee that it will always be free of outages or errors. To the extent permitted by law, our liability for damages is limited to the subscription fees paid in the previous 12 months.",
        `The ${SITE.name} software, design and brand are protected by copyright and other intellectual property rights. You may not misuse the app, circumvent its security, or use it in violation of applicable law.`,
        `These terms are governed by the laws of the Czech Republic. We may update them from time to time and will notify you of material changes by email in advance. If you have any questions, contact us at ${SITE.email}.`,
      ],
    },
    privacy: {
      subheading:
        "How we process personal data on the SparxDeck website and in the app (informational summary, not a full legal assessment).",
      body: [
        `The controller of personal data of users and website visitors is the operator of the ${SITE.name} service. For any privacy-related questions, contact us at ${SITE.email}.`,
        "We process your account details (name, email, phone, company), billing details, technical data needed for secure operation (IP address, device type, login records) and any information you send us yourself, for example when booking a demo.",
        "Data that a service company enters into the app about its customers, buildings, equipment and inspections, including photos and signatures, is processed by us as a processor on behalf of that company. The terms of this processing are set out in a data processing agreement that forms part of the subscription.",
        "We process data to provide the service and perform our contract, to meet legal obligations (such as accounting), on the basis of legitimate interest (security, abuse prevention, improving the service) and, for marketing communications, on the basis of your consent.",
        "Data may also be processed by trusted providers such as cloud infrastructure, email and payment services, always under contracts that ensure protection in line with the GDPR. Where data is transferred outside the European Economic Area, we rely on the European Commission's Standard Contractual Clauses. We do not sell personal data.",
        "We keep data for as long as your account exists and afterwards only as long as needed to meet legal obligations or protect our rights. When your subscription ends, we will export your company's data on request and then delete it.",
        "You have the right to access, rectify and erase your personal data, to restrict processing, to data portability and to object. You can withdraw any consent at any time. You also have the right to lodge a complaint with a data protection authority.",
      ],
    },
    cookies: {
      subheading: "Which cookies and similar technologies the SparxDeck website and app use.",
      body: [
        `The ${SITE.name} website and app use only cookies that are necessary for them to work. We do not use third-party advertising or tracking cookies, and we do not sell information about your behaviour.`,
        "Necessary cookies in the app keep you signed in and protect your account from misuse. On the website, the only thing we store in your browser is your choice of light or dark theme. The language is determined by the page address.",
        "If we start using analytics or other cookies that are not strictly necessary, we will ask for your consent first and update this page.",
        "You can delete or block cookies at any time in your browser settings, usually under Privacy or Security. Without necessary cookies, however, you won't be able to sign in to the app.",
        `If you have questions about our use of cookies, contact us at ${SITE.email}.`,
      ],
    },
  },
};

export default en;
