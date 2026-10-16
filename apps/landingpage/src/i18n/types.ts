export type HeaderDictionary = {
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

export type HeroDictionary = {
  heading: string;
  body: string;
  primaryCta: string;
  secondaryCta: string;
};

export type CompaniesDictionary = {
  cards: { title: string; description: string }[];
  headingLine1: string;
  headingLine2: string;
  paragraph: string;
  cardCta: string;
};

export type ComparisonDictionary = {
  title: string;
  subtitle: string;
  /** Column header for the current way of working (paper, Excel) */
  oldLabel: string;
  /** Column header for SparxDeck */
  newLabel: string;
  rows: { topic: string; old: string; new: string }[];
};

export type RadarDictionary = {
  title: string;
  subtitle: string;
  labels: string[];
  keyAreasHeading: string;
  keyAreas: { title: string; description: string }[];
  howItWorksHeading: string;
  howItWorks: string[];
  resultHeading: string;
  result: string[];
};

export type FaqDictionary = {
  headingLine1: string;
  headingLine2: string;
  items: { id: string; question: string; answer: string }[];
};

export type GetStartedDictionary = {
  primaryCta: string;
  secondaryCta: string;
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
  hero: HeroDictionary;
  companies: CompaniesDictionary;
  comparison: ComparisonDictionary;
  radar: RadarDictionary;
  faq: FaqDictionary;
  getStarted: GetStartedDictionary;
  footer: FooterDictionary;
  pages: PagesDictionary;
  legal: LegalDictionary;
};
