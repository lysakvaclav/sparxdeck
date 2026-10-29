export type HeaderDictionary = {
  /** Label of the Product menu (the feature pages). */
  product: string;
  signIn: string;
  /** Primary header CTA leading to signup */
  getStarted: string;
  /** Header CTA for booking a demo (external) */
  bookDemo: string;
  /** Label for the Company mega-menu toggle and section heading */
  company: string;
  /** Label for the Work with us section heading inside mega-menu */
  workWithUs: string;
  /** Links inside the Company column */
  mission: string;
  team: string;
  newsroom: string;
  careers: string;
  /** Small label in the mega-menu left column */
  megaContactLabel: string;
};

/** The home page (src/app/[locale]/page.tsx), section by section. */
export type HomeDictionary = {
  hero: {
    eyebrow: string;
    title: string;
    /** The second line of the heading, in the muted colour. */
    titleMuted: string;
    body: string;
    primary: string;
    secondary: string;
    note: string;
  };
  /** Short product facts under the hero (no invented numbers). */
  facts: { value: string; label: string }[];
  platform: { eyebrow: string; title: string; body: string; learnMore: string };
  /** In the order of FEATURES in src/components/home/features.ts. */
  features: { label: string; title: string; body: string }[];
  principles: { eyebrow: string; title: string; items: { title: string; body: string }[] };
  steps: { eyebrow: string; title: string; items: string[] };
  comparison: {
    eyebrow: string;
    title: string;
    body: string;
    oldLabel: string;
    newLabel: string;
    rows: { topic: string; old: string; new: string }[];
  };
  faq: {
    eyebrow: string;
    title: string;
    body: string;
    items: { question: string; answer: string }[];
  };
  cta: { title: string; body: string; primary: string; secondary: string };
  /** The tabbed showcase of the platform's screens. */
  showcase: { title: string; body: string };
  /** The coming MCP connection to AI assistants. */
  mcp: { badge: string; title: string; titleRest: string; body: string; cta: string };
  /** Alternative texts of the platform's screenshots. */
  shots: Record<
    "dashboard" | "devices" | "check" | "protocol" | "calendar" | "defects" | "map" | "route" | "today",
    string
  >;
};

type PageWithBody = {
  heading: string;
  subheading: string;
  body: string[];
};

type SimplePage = {
  heading: string;
  subheading: string;
};

export type PagesDictionary = {
  mission: PageWithBody;
  about: PageWithBody;
  team: SimplePage;
  careers: SimplePage;
  news: SimplePage;
  equipmentRegister: PageWithBody;
  fieldInspections: PageWithBody;
  inspectionReports: PageWithBody;
  deadlineTracking: PageWithBody;
  defectTracking: PageWithBody;
};

export type LegalPage = {
  subheading: string;
  body: string[];
};

export type LegalDictionary = {
  terms: LegalPage;
  privacy: LegalPage;
  cookies: LegalPage;
};

export type FooterDictionary = {
  allRightsReserved: string;
  cookiesSettings: string;
  termsOfService: string;
  privacyPolicy: string;
  companyHeading: string;
  mission: string;
  team: string;
  newsroom: string;
  workWithUs: string;
  careers: string;
};

export type CommonDictionary = {
  backToHome: string;
};

export type Dictionary = {
  common: CommonDictionary;
  header: HeaderDictionary;
  home: HomeDictionary;
  footer: FooterDictionary;
  pages: PagesDictionary;
  legal: LegalDictionary;
};
