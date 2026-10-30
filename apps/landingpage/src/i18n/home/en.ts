import type { HomeDictionary } from "../types";

// The home page in this language (sections of src/app/[locale]/page.tsx).
const home: HomeDictionary = {
  "hero": {
    "eyebrow": "Software for fire safety equipment inspections",
    "title": "The complete system for fire safety inspections.",
    "body": "Software built for service companies. Equipment records, QR labels, scheduling and technician routes, checks on the phone, reports, defects and due dates in one place.",
    "cta": "Book a demo"
  },
  "facts": [
    {
      "value": "1 scan",
      "label": "brings up the device's record and its checklist"
    },
    {
      "value": "No signal",
      "label": "the check and today's plan work in a basement or a boiler room"
    },
    {
      "value": "PDF on site",
      "label": "a report signed by the customer right after the check"
    },
    {
      "value": "Minutes",
      "label": "to get a technician started instead of a day of training"
    }
  ],
  "platform": {
    "eyebrow": "Platform",
    "title": "Everything an inspection company needs. Nothing more.",
    "body": "From the equipment register and the check on site to the signed report, defects and the next due date. One system for the office and the technicians.",
    "learnMore": "Learn more"
  },
  "features": [
    {
      "label": "Equipment register",
      "title": "Customers, buildings and equipment in one place",
      "body": "Fire extinguishers, hydrants, emergency lighting, dampers and doors with their location, serial number and full inspection history. Import your current spreadsheet from Excel and print QR labels straight from the app."
    },
    {
      "label": "Field inspections",
      "title": "Scan, tick off, done",
      "body": "The technician scans the label and goes through the checklist for that type of equipment, with a photo of any defect. Without a signal the check waits in the phone and is sent as soon as the connection returns."
    },
    {
      "label": "Reports",
      "title": "The report is ready before you leave",
      "body": "A PDF with your company's logo and the customer's signature is created right after the check and sent by email in one tap. You set the report's look in the template editor. An issued report never changes."
    },
    {
      "label": "Due dates",
      "title": "No inspection slips through",
      "body": "The calendar shows what falls due when and who goes where. A 30, 60 and 90 day overview and a weekly summary by email keep track of the dates for you."
    },
    {
      "label": "Defects",
      "title": "Defects followed until they're fixed",
      "body": "A failed checklist item becomes a defect with a photo, severity, a person responsible and a deadline. Every change is recorded in its history."
    },
    {
      "label": "Map and routes",
      "title": "Buildings on a map, visits ordered by distance",
      "body": "The map shows the state of every building. A route orders the day's visits and suggests buildings nearby whose inspection is due soon. Distances are in a straight line; this is not navigation."
    }
  ],
  "principles": {
    "eyebrow": "Why SparxDeck",
    "title": "Designed for work in the field",
    "items": [
      {
        "title": "Simple",
        "body": "Only what a technician really needs. No complex enterprise system, no long training."
      },
      {
        "title": "Works without a signal",
        "body": "Checks, photos and today's plan wait in the phone and are sent once there is a connection."
      },
      {
        "title": "Your data stays yours",
        "body": "Each company sees only its own data. Export to CSV at any time; issued reports stay unchanged."
      }
    ]
  },
  "comparison": {
    "eyebrow": "Comparison",
    "title": "Paper and Excel vs. SparxDeck",
    "body": "How each step of an inspection changes when notebooks, binders and spreadsheets give way to one app.",
    "oldLabel": "Paper and Excel",
    "newLabel": "SparxDeck",
    "rows": [
      {
        "topic": "Recording the check",
        "old": "By hand on paper, often illegible",
        "new": "A QR label scan and a checklist on the phone"
      },
      {
        "topic": "Report",
        "old": "Evenings retyping into Word or Excel",
        "new": "A PDF signed by the customer on site"
      },
      {
        "topic": "Due dates",
        "old": "A spreadsheet, a calendar or memory",
        "new": "An overview of what falls due and a weekly summary"
      },
      {
        "topic": "Defects",
        "old": "A note in the margin that gets lost",
        "new": "A defect with a photo, a person responsible and a deadline"
      },
      {
        "topic": "Equipment history",
        "old": "Binders and searching through folders",
        "new": "The full history of any device in one tap"
      },
      {
        "topic": "Planning visits",
        "old": "From memory and experience",
        "new": "A calendar, a map of buildings and a route for the day"
      }
    ]
  },
  "faq": {
    "eyebrow": "FAQ",
    "title": "Frequently asked questions",
    "body": "Didn't find your answer? Write to us, we'll be happy to show you SparxDeck.",
    "items": [
      {
        "question": "How much does SparxDeck cost?",
        "answer": "We agree on the price based on the size of your company. You pay by bank transfer under a contract, and your customers pay nothing. Book a short demo and we will prepare an offer for you."
      },
      {
        "question": "What are the benefits of SparxDeck?",
        "answer": "Technicians no longer retype inspections in the evening: they scan the QR label, tick off the check on the phone and the report is created straight from the entered data. Due dates and open defects are tracked by the system instead of Excel, and every report has the same look with your logo. Less paperwork, less retyping and fewer mistakes."
      },
      {
        "question": "Which devices does SparxDeck run on?",
        "answer": "It runs in the browser on iPhone, Android and computers, with nothing to install from an app store. On a phone you can add it to the home screen like any other app. It also works without a signal: an unfinished check, photos and visited buildings are saved on the phone and sent as soon as there is a connection."
      },
      {
        "question": "How is SparxDeck different from Excel or general-purpose systems?",
        "answer": "It is built specifically for fire safety equipment inspections, not adapted from a general field service system. It has QR labels, checklists by device type, defect tracking, due dates, floor plans and a building map. It does not do quotes or invoicing, which keeps it simple."
      },
      {
        "question": "How do I bring over my current records and connect other systems?",
        "answer": "Import customers, buildings and devices from an Excel or CSV file. The app recognises the columns itself, shows a preview before saving, and the whole import can be undone. You can export data to CSV at any time. A direct connection to accounting systems is not available yet."
      },
      {
        "question": "How quickly can we get started?",
        "answer": "Right away. You create the account yourself and try everything on sample data. Import your records from a file, print the QR labels, and a technician can do the first check without lengthy training."
      },
      {
        "question": "How does SparxDeck protect data?",
        "answer": "Each company's data is kept separate from all others, and access follows roles: owner, administrator and technician. An issued report is never overwritten; correcting an inspection creates a new version and the original stays on record."
      }
    ]
  },
  "cta": {
    "title": "Try SparxDeck in your company",
    "body": "Create an account and explore the app on sample data, or book a short demo.",
    "primary": "Get started with SparxDeck",
    "secondary": "Book a demo"
  },
  "shots": {
    "dashboard": "SparxDeck overview with due dates, defects and today's route",
    "devices": "List of equipment with labels, locations and inspection dates",
    "check": "A fire extinguisher check on a phone",
    "protocol": "Report template editor with a PDF preview",
    "calendar": "Calendar of planned inspections",
    "defects": "List of defects with severity and deadline",
    "map": "Map of buildings by the state of their due dates",
    "route": "A technician's route on the map, ordered by distance",
    "today": "A technician's plan for today on a phone"
  },
  "mcp": {
    "title": "SparxDeck MCP.",
    "titleRest": "Your inspections in your AI assistant.",
    "body": "Connect SparxDeck to ChatGPT, Claude or Gemini and ask in plain language: what falls due next month, which defects are overdue or where a technician is going tomorrow. The answer comes straight from your records.",
    "question": "What falls due next month?",
    "answer": "In November, 16 devices in 4 buildings are due for inspection. First up: the Lipová 12 apartment building on 3 November.",
    "cta": "Book a demo"
  }
};

export default home;
