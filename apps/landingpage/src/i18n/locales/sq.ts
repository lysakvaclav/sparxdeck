import type { Dictionary } from "../types";
import { SITE } from "@/config/site";
import { locales } from "../config";

const sq: Dictionary = {
  common: {
    backToHome: "Kthehu në faqen kryesore",
  },
  header: {
    signIn: "Hyr",
    getStarted: "Fillo tani",
    bookDemo: "Rezervo një demo",
    company: "Kompania",
    workWithUs: "Puno me ne",
    mission: "Misioni ynë",
    team: "Ekipi",
    newsroom: "Lajme",
    careers: "Karriera",
    megaContactLabel: "Kontakt",
  },
  hero: {
    heading: "Kontrollet kundër zjarrit.\nPa letra.",
    body:
      "SparxDeck është aplikacioni për kompanitë e shërbimit që kontrollojnë pajisjet e sigurisë nga zjarri. Tekniku skanon një kod QR, plotëson listën e kontrollit dhe raporti i dërgohet klientit automatikisht. Afatet e kontrolleve të ardhshme i ndjek sistemi, jo një tabelë Excel.",
    primaryCta: "Fillo tani",
    secondaryCta: "Si funksionon",
  },
  companies: {
    cards: [
      {
        title: "Regjistri i pajisjeve dhe etiketat QR",
        description:
          "Klientët, ndërtesat dhe të gjitha pajisjet në një vend: fikëset, hidrantët, ndriçimi emergjent, valvulat dhe dyert kundër zjarrit. SparxDeck printon etiketat QR dhe çdo pajisje ka kartelën e vet me historikun e plotë të kontrolleve.",
      },
      {
        title: "Kontrolli në terren me telefon",
        description:
          "Tekniku skanon kodin QR dhe plotëson një listë të shkurtër: presioni, plumbçja, dëmtimet, afati i vlefshmërisë. Defektin e fotografon menjëherë. Aplikacioni punon edhe pa sinjal, në bodrum apo në dhomën teknike.",
      },
      {
        title: "Raporti gati para se të largoheni",
        description:
          "Klienti nënshkruan drejtpërdrejt në ekran dhe raporti PDF me logon e kompanisë suaj i dërgohet menjëherë me email. Mbaruan mbrëmjet e rishkrimit të shënimeve.",
      },
      {
        title: "Ndjekja e afateve të kontrolleve",
        description:
          "Shikoni çfarë skadon muajin e ardhshëm dhe merrni kujtesa për kontrollet që po afrohen. Asnjë afat nuk humbet dhe çdo kontroll sjell punën e radhës.",
      },
      {
        title: "Defektet nën kontroll",
        description:
          "Çdo defekt i gjetur bëhet detyrë që e ndiqni deri në zgjidhje. Administratori i ndërtesës e sheh gjendjen e pajisjeve në portalin e klientit.",
      },
    ],
    headingLine1: "Pa sisteme të ndërlikuara korporative.",
    headingLine2: "Vetëm ajo që i duhet vërtet teknikut.",
    paragraph:
      "SparxDeck është qëllimisht i thjeshtë. Mësohet për pak minuta, teknikët e përdorin në telefonin e tyre dhe ju më në fund keni pasqyrë të plotë të të gjitha punëve, pajisjeve dhe afateve.",
    cardCta: "Mëso më shumë",
  },
  comparison: {
    title: "Letra dhe Excel kundrejt SparxDeck",
    subtitle:
      "Shikoni si ndryshon çdo hap i kontrollit kur blloku i shënimeve, dosjet dhe tabelat zëvendësohen nga një aplikacion i vetëm.",
    oldLabel: "Letra dhe Excel",
    newLabel: "SparxDeck",
    rows: [
      {
        topic: "Shënimet e kontrollit",
        old: "Me dorë në letër, shpesh të palexueshme dhe me gabime",
        new: "Skanim i kodit QR dhe listë e shkurtër kontrolli direkt në telefon",
      },
      {
        topic: "Raporti",
        old: "Orë të tëra rishkrimi në Word ose Excel në mbrëmje",
        new: "PDF me logon tuaj dhe nënshkrimin e klientit, gati që në vend",
      },
      {
        topic: "Afatet e kontrolleve",
        old: "Tabelë, kalendar ose kujtesë",
        new: "Pasqyrë automatike dhe kujtesa paraprake",
      },
      {
        topic: "Defektet",
        old: "Një shënim anash që humbet lehtë",
        new: "Detyrë me foto, e ndjekur deri në zgjidhje",
      },
      {
        topic: "Historiku i pajisjeve",
        old: "Dosje në zyrë dhe kërkime nëpër arkiva",
        new: "Historiku i plotë i çdo pajisjeje me një prekje",
      },
      {
        topic: "Klienti",
        old: "Pret raportin dhe nuk di gjendjen e pajisjeve",
        new: "Merr raportin menjëherë me email dhe sheh gjendjen në portalin e klientit",
      },
    ],
  },
  radar: {
    title: "I gjithë cikli i kontrollit në një sistem",
    subtitle:
      "Nga regjistri i pajisjeve te kontrolli në terren, raporti i nënshkruar dhe afati i radhës. SparxDeck mbulon gjithë ciklin që kompanitë e shërbimit përndryshe e ndërtojnë me letra, Excel dhe email.",
    labels: ["Regjistri", "Etiketat QR", "Kontrolli", "Raportet", "Afatet", "Defektet"],
    keyAreasHeading: "Çfarë mbulon SparxDeck",
    keyAreas: [
      {
        title: "Regjistri",
        description:
          "Klientët, ndërtesat dhe pajisjet e të gjitha llojeve me historikun e plotë të kontrolleve në një vend.",
      },
      {
        title: "Etiketat QR",
        description:
          "Printimi i etiketave direkt nga aplikacioni. Një skanim dhe tekniku e di para cilës pajisje ndodhet.",
      },
      {
        title: "Kontrolli",
        description:
          "Listë kontrolli për çdo lloj pajisjeje, foto e defektit me një prekje dhe funksionim i plotë pa sinjal.",
      },
      {
        title: "Raportet",
        description:
          "Raport PDF me logon tuaj dhe nënshkrimin e klientit, i dërguar menjëherë pas kontrollit.",
      },
      {
        title: "Afatet",
        description: "Pasqyrë e kontrolleve që skadojnë muajin e ardhshëm dhe kujtesa në kohë.",
      },
      {
        title: "Defektet",
        description: "Çdo defekt është detyrë me status, e ndjekur deri në zgjidhje.",
      },
    ],
    howItWorksHeading: "Si zhvillohet një kontroll me SparxDeck",
    howItWorks: [
      "Në zyrë krijoni klientin, ndërtesën dhe pajisjet, ose i importoni nga tabela juaj ekzistuese.",
      "Printoni etiketat QR dhe tekniku i ngjit në pajisje gjatë vizitës së parë.",
      "Në çdo kontroll të mëpasshëm tekniku skanon etiketën dhe plotëson listën në telefon.",
      "Nëse gjen defekt, e fotografon dhe në sistem krijohet automatikisht një detyrë.",
      "Klienti nënshkruan në ekran, raporti i dërgohet me email dhe sistemi cakton afatin e kontrollit të radhës.",
    ],
    resultHeading: "Çfarë fitoni",
    result: [
      "Mbrëmje pa rishkrimin e shënimeve në raporte.",
      "Asnjë kontroll të harruar, pra asnjë punë të humbur.",
      "Punë të përsëritura që sistemi i ndjek për ju.",
      "Raporte profesionale dhe historik të gjurmueshëm në rast inspektimi ose incidenti.",
    ],
  },
  faq: {
    headingLine1: "Pyetje të shpeshta",
    headingLine2: "",
    items: [
      {
        id: "who",
        question: "Për kë është SparxDeck?",
        answer:
          "Për kompanitë e shërbimit që lëvizin nëpër ndërtesa dhe kontrollojnë pajisjet e sigurisë nga zjarri, zakonisht me 3 deri në 30 punonjës. Teknikët punojnë në terren me telefon, zyra në kompjuter dhe administratorët e ndërtesave në portalin e tyre të klientit.",
      },
      {
        id: "equipment",
        question: "Cilat pajisje mbështet SparxDeck?",
        answer:
          "Fikëset, hidrantët, ndriçimin emergjent, valvulat kundër zjarrit dhe dyert kundër zjarrit. Çdo lloj pajisjeje ka listën e vet të kontrollit, kështu që tekniku kontrollon saktësisht atë që duhet.",
      },
      {
        id: "offline",
        question: "A funksionon aplikacioni pa sinjal?",
        answer:
          "Po. Tekniku mund të punojë në bodrum ose në dhomën teknike pa lidhje. Sapo telefoni të jetë sërish online, të dhënat sinkronizohen automatikisht.",
      },
      {
        id: "pricing",
        question: "Sa kushton SparxDeck?",
        answer:
          "Paguani një abonim mujor sipas numrit të teknikëve ose pajisjeve, kështu që çmimi rritet bashkë me kompaninë tuaj. Rezervoni një demo të shkurtër dhe do t’ju përgatisim një ofertë të personalizuar.",
      },
      {
        id: "protocols",
        question: "A përputhen raportet me rregulloret?",
        answer:
          "Po. Shabllonet e raporteve bazohen në kërkesat vendore për kontrollet në çdo vend ku vepron SparxDeck. Çdo raport mban logon dhe të dhënat e kompanisë suaj si dhe nënshkrimin e klientit.",
      },
      {
        id: "portal",
        question: "A e sheh administratori i ndërtesës gjendjen e pajisjeve?",
        answer:
          "Po. Administratorët dhe pronarët e ndërtesave kanë portalin e tyre të klientit, ku shohin gjendjen e pajisjeve, defektet e hapura dhe afatet, dhe shkarkojnë të gjitha raportet.",
      },
      {
        id: "onboarding",
        question: "Sa zgjat mësimi i përdorimit?",
        answer:
          "Disa minuta. SparxDeck përmban vetëm thelbësoren, kështu që tekniku e bën kontrollin e parë pa trajnim. Regjistrin ekzistues nga Excel e importoni me disa klikime.",
      },
    ],
  },
  getStarted: {
    primaryCta: "Fillo me SparxDeck",
    secondaryCta: "Rezervo një demo",
  },
  footer: {
    allRightsReserved: "Të gjitha të drejtat e rezervuara.",
    cookiesSettings: "Cookies",
    termsOfService: "Kushtet e përdorimit",
    privacyPolicy: "Politika e privatësisë",
    companyHeading: "Kompania",
    mission: "Misioni ynë",
    team: "Ekipi",
    newsroom: "Lajme",
    workWithUs: "Puno me ne",
    careers: "Karriera",
  },
  pages: {
    mission: {
      heading: "Misioni ynë",
      subheading: "Duam që tekniku ta kalojë kohën pranë pajisjeve, jo mbi letra.",
      body: [
        "Kontrollet e pajisjeve të sigurisë nga zjarri mbrojnë njerëzit në ndërtesa. Megjithatë, në shumë kompani shërbimi ato bëhen ende si njëzet vjet më parë: tekniku e përshkon ndërtesën, shkruan gjithçka në letër dhe në mbrëmje i rishkruan për orë të tëra shënimet në raport. Afatet e kontrolleve të ardhshme mbahen në Excel ose përmendsh.",
        "Kjo kushton kohë, para dhe nerva. Një kontroll i harruar do të thotë punë e humbur, një shënim i palexueshëm do të thotë gabim në raport, dhe pas një incidenti është e vështirë të provohet çfarë u kontrollua dhe kur.",
        "SparxDeck e ndryshon këtë. Tekniku skanon një kod QR, plotëson listën dhe raporti është gati. Kompania sheh të gjitha pajisjet, defektet dhe afatet, dhe çdo kontroll sjell punën e radhës. Ne nuk ndërtojmë një tjetër sistem korporativ të ndërlikuar. Ndërtojmë një mjet që mësohet për pak minuta dhe që njerëzit e përdorin me kënaqësi.",
      ],
    },
    about: {
      heading: "Rreth SparxDeck",
      subheading: "Softuer për kompanitë e shërbimit në mbrojtjen nga zjarri.",
      body: [
        "SparxDeck është aplikacion web dhe celular për kompanitë që kryejnë kontrolle periodike të pajisjeve të sigurisë nga zjarri: fikëseve, hidrantëve, ndriçimit emergjent, valvulave dhe dyerve kundër zjarrit. Ai zëvendëson shënimet në letër dhe Excel me një sistem të qartë.",
        `SparxDeck lindi në Republikën Çeke dhe është projektuar për të punuar në shumë vende. Thelbi i aplikacionit është i njëjtë kudo; ndryshojnë vetëm gjuha dhe shabllonet e raporteve sipas rregulloreve vendore. Aplikacioni është i disponueshëm në ${locales.length} gjuhë.`,
        "E zhvillojmë produktin në bashkëpunim të ngushtë me kompani shërbimi dhe teknikë me përvojë. Nëse keni një ide që do t’jua lehtësonte edhe më shumë punën, na shkruani.",
      ],
    },
    team: {
      heading: "Ekipi i SparxDeck",
      subheading: "Ekipi që ndërton softuer të thjeshtë për kompanitë e kontrollit.",
    },
    careers: {
      heading: "Karriera",
      subheading:
        "Aktualisht nuk kemi pozicione të hapura. Nëse ju tërheq ndërtimi i softuerit për një sektor që ka nevojë për modernizim, na shkruani.",
    },
    news: {
      heading: "Lajme",
      subheading: "Ende nuk ka lajme. Së shpejti këtu do të shfaqen përditësimet e para të produktit.",
    },
    equipmentRegister: {
      heading: "Regjistri i pajisjeve dhe etiketat QR",
      subheading: "Të gjithë klientët, ndërtesat dhe pajisjet në një vend",
      body: [
        "Në SparxDeck menaxhoni klientët, ndërtesat e tyre dhe çdo pajisje në një strukturë të qartë: fikëset, hidrantët, ndriçimi emergjent, valvulat dhe dyert kundër zjarrit. Për çdo pajisje shihni llojin, vendndodhjen, datën e kontrollit të fundit dhe gjithë historikun. Mjaft më me kërkime në dosje apo në disa versione të së njëjtës tabelë.",
        "Aplikacioni printon një etiketë QR për çdo pajisje. Tekniku e ngjit gjatë vizitës së parë dhe më pas mjafton një skanim për të ditur para cilës pajisje ndodhet dhe çfarë duhet bërë. Regjistrin ekzistues nga Excel e importoni me disa klikime.",
      ],
    },
    fieldInspections: {
      heading: "Kontrolli në terren me telefon",
      subheading: "Skano, plotëso, gati",
      body: [
        "Tekniku skanon kodin QR në pajisje dhe kalon nëpër listën e kontrollit të përgatitur për atë lloj pajisjeje, p.sh. te fikësja: presioni, plumbçja, dëmtimet dhe afati. Çdo pikë është një po/jo e thjeshtë, kështu që kontrolli zgjat një çast dhe asgjë nuk harrohet.",
        "Nëse tekniku gjen defekt, e fotografon direkt në aplikacion. Aplikacioni punon pa sinjal në bodrum ose në dhomën teknike dhe të dhënat sinkronizohen sapo telefoni të jetë online. Nuk nevojiten pajisje të veçanta apo trajnime të gjata.",
      ],
    },
    inspectionReports: {
      heading: "Raporti gati para se të largoheni",
      subheading: "Nënshkrim në ekran dhe PDF automatik me logon tuaj",
      body: [
        "Pas përfundimit të kontrollit, SparxDeck krijon automatikisht një raport PDF nga gjithçka që tekniku regjistroi në terren. Klienti e nënshkruan direkt në ekranin e telefonit. Raporti mban logon dhe të dhënat e kompanisë suaj dhe përmban pajisjet e kontrolluara, rezultatet dhe defektet e gjetura.",
        "Raporti i dërgohet menjëherë klientit me email, ruhet në sistem dhe administratori i ndërtesës mund ta shkarkojë kurdo nga portali i tij. Shabllonet e raporteve përputhen me rregulloret vendore. Ju gjithmonë mund të verifikoni çfarë u kontrollua, kur dhe te cili klient, p.sh. gjatë një inspektimi zyrtar ose dëmi të siguruar.",
      ],
    },
    deadlineTracking: {
      heading: "Ndjekja e afateve të kontrolleve",
      subheading: "Asnjë afat nuk humbet dhe çdo kontroll sjell punën e radhës",
      body: [
        "SparxDeck e di kur ka çdo pajisje kontrollin e radhës. Në një vend shihni çfarë skadon muajin e ardhshëm dhe sistemi ju kujton në kohë për kontrollet që po afrohen. Nuk keni më nevojë t’i mbani afatet në Excel apo përmendsh.",
        "Për një kompani shërbimi kjo do të thotë rrjedhë e rregullt punësh të përsëritura. Mund t’i planifikoni vizitat paraprakisht, t’i drejtoheni klientit përpara konkurrencës dhe të mos humbni asnjë punë vetëm sepse u harrua një afat.",
      ],
    },
    defectTracking: {
      heading: "Defektet nën kontroll",
      subheading: "Çdo defekt i gjetur bëhet detyrë e ndjekur deri në zgjidhje",
      body: [
        "Kur tekniku gjen një defekt gjatë kontrollit, SparxDeck e kthen automatikisht në detyrë me foto dhe përshkrim. Defekti nuk humbet mes shënimeve dhe është e qartë kush është përgjegjës.",
        "Çdo defekt ka status: i ri, në proces, i zgjidhur. Administratori i ndërtesës i sheh defektet e hapura në portalin e tij dhe është i sigurt që problemet po zgjidhen vërtet, ndërsa ju keni bazën për punën e radhës.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "Kushtet e përdorimit të faqes dhe aplikacionit SparxDeck (përmbledhje informative, nuk përbën këshillë ligjore).",
      body: [
        `Këto kushte rregullojnë përdorimin e faqes dhe aplikacionit ${SITE.name}, një aplikacion web dhe celular për regjistrimin dhe kontrollin e pajisjeve të sigurisë nga zjarri. Duke u regjistruar ose duke përdorur aplikacionin, ju i pranoni ato. Nëse e përdorni aplikacionin në emër të një kompanie, konfirmoni se jeni i autorizuar për këtë.`,
        "Aplikacioni ofrohet me abonim mujor. Çmimi ndjek listën aktuale të çmimeve ose një ofertë individuale dhe varet nga numri i teknikëve ose pajisjeve. Mund ta anuloni abonimin në çdo kohë, me efekt në fund të periudhës së paguar.",
        "Ju jeni përgjegjës për kredencialet tuaja dhe për veprimtarinë e përdoruesve në llogarinë tuaj. Të dhënat që futni në aplikacion, veçanërisht regjistrat e klientëve, pajisjet, fotot dhe raportet, ju përkasin juve. Ne i përpunojmë vetëm për të ofruar shërbimin dhe jua dorëzojmë si eksport me kërkesë.",
        "SparxDeck është mjet për regjistrim dhe dokumentim. Përgjegjësia për kryerjen profesionale të kontrolleve dhe për saktësinë e të dhënave në raporte i takon kompanisë së shërbimit dhe teknikëve të saj të kualifikuar.",
        "Përpiqemi për disponueshmëri dhe siguri të vazhdueshme të shërbimit, por nuk mund të garantojmë që ai do të jetë gjithmonë pa ndërprerje dhe gabime. Në masën e lejuar nga ligji, përgjegjësia jonë kufizohet në shumën e abonimeve të paguara gjatë 12 muajve të fundit.",
        `Softueri, dizajni dhe marka ${SITE.name} mbrohen nga e drejta e autorit dhe të drejta të tjera të pronësisë intelektuale. Ndalohet keqpërdorimi i aplikacionit, anashkalimi i sigurisë së tij ose përdorimi i tij në kundërshtim me ligjin.`,
        `Këto kushte rregullohen nga ligjet e Republikës Çeke. Mund t’i ndryshojmë herë pas here dhe do t’ju njoftojmë paraprakisht me email për ndryshimet e rëndësishme. Për pyetje na shkruani në ${SITE.email}.`,
      ],
    },
    privacy: {
      subheading:
        "Si i përpunojmë të dhënat personale në faqen dhe aplikacionin SparxDeck (përmbledhje informative, nuk përbën vlerësim ligjor).",
      body: [
        `Kontrollues i të dhënave personale të përdoruesve dhe vizitorëve të faqes është operatori i shërbimit ${SITE.name}. Për çështje të mbrojtjes së të dhënave na kontaktoni në ${SITE.email}.`,
        "Përpunojmë të dhënat e llogarisë suaj (emri, emaili, telefoni, kompania), të dhënat e faturimit, të dhënat teknike të nevojshme për funksionim të sigurt (adresa IP, lloji i pajisjes, regjistrat e hyrjeve) dhe informacionin që na dërgoni vetë, p.sh. kur rezervoni një demo.",
        "Të dhënat që një kompani shërbimi fut në aplikacion për klientët, ndërtesat, pajisjet dhe kontrollet e saj, përfshirë fotot dhe nënshkrimet, i përpunojmë si përpunues në emër të asaj kompanie. Kushtet e këtij përpunimi përcaktohen në një marrëveshje për përpunimin e të dhënave, e cila është pjesë e abonimit.",
        "I përpunojmë të dhënat për të ofruar shërbimin dhe për të përmbushur kontratën, për detyrimet ligjore (p.sh. kontabiliteti), mbi bazën e interesit legjitim (siguria, parandalimi i abuzimeve, përmirësimi i shërbimit) dhe, për komunikimet e marketingut, mbi bazën e pëlqimit tuaj.",
        "Të dhënat mund t’i përpunojnë edhe ofrues të besuar, si ofruesit e infrastrukturës cloud, shërbimeve të emailit dhe pagesave, gjithmonë mbi bazën e kontratave që garantojnë mbrojtjen sipas GDPR. Kur të dhënat transferohen jashtë Zonës Ekonomike Evropiane, përdorim klauzolat standarde kontraktuale të Komisionit Evropian. Ne nuk shesim të dhëna personale.",
        "I ruajmë të dhënat për aq kohë sa ekziston llogaria dhe më pas vetëm për aq sa është e nevojshme për detyrimet ligjore ose mbrojtjen e të drejtave tona. Pas përfundimit të abonimit, me kërkesë eksportojmë të dhënat e kompanisë suaj dhe më pas i fshijmë.",
        "Keni të drejtën e aksesit, korrigjimit, fshirjes, kufizimit të përpunimit, transferueshmërisë dhe kundërshtimit. Mund ta tërhiqni pëlqimin në çdo kohë. Keni gjithashtu të drejtë të paraqisni ankesë pranë autoritetit të mbrojtjes së të dhënave.",
      ],
    },
    cookies: {
      subheading: "Cilat cookies dhe teknologji të ngjashme përdor faqja dhe aplikacioni SparxDeck.",
      body: [
        `Faqja dhe aplikacioni ${SITE.name} përdorin vetëm cookies që janë të domosdoshme për funksionimin e tyre. Nuk përdorim cookies reklamuese ose gjurmuese të palëve të treta dhe nuk shesim informacion për sjelljen tuaj.`,
        "Cookies e domosdoshme në aplikacion ju mbajnë të identifikuar dhe e mbrojnë llogarinë nga keqpërdorimi. Në faqe ruajmë në shfletuesin tuaj vetëm zgjedhjen tuaj të pamjes së çelët ose të errët. Gjuha përcaktohet nga adresa e faqes.",
        "Nëse fillojmë të përdorim mjete analitike ose cookies të tjera jo të domosdoshme, do t’ju kërkojmë paraprakisht pëlqimin dhe do ta përditësojmë këtë faqe.",
        "Cookies mund t’i fshini ose bllokoni në çdo kohë në cilësimet e shfletuesit, zakonisht te Privatësia ose Siguria. Pa cookies e domosdoshme, megjithatë, nuk do të mund të hyni në aplikacion.",
        `Për pyetje rreth përdorimit të cookies na shkruani në ${SITE.email}.`,
      ],
    },
  },
};

export default sq;
