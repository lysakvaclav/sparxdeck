import type { Dictionary } from "../types";
import { SITE } from "@/config/site";
import { locales } from "../config";

const bs: Dictionary = {
  common: {
    backToHome: "Nazad na početnu stranicu",
  },
  header: {
    signIn: "Prijava",
    getStarted: "Započni",
    bookDemo: "Zakaži demo",
    company: "Kompanija",
    workWithUs: "Radite s nama",
    mission: "Naša misija",
    team: "Tim",
    newsroom: "Novosti",
    careers: "Karijera",
    megaContactLabel: "Kontakt",
  },
  hero: {
    heading: "Kontrole protivpožarne opreme.\nBez papirologije.",
    body:
      "SparxDeck je aplikacija za servisne firme koje kontrolišu opremu za zaštitu od požara. Tehničar skenira QR kod, označi stavke kontrolne liste i zapisnik automatski stiže klijentu. Rokove narednih kontrola prati sistem, a ne Excel tabela.",
    primaryCta: "Započni",
    secondaryCta: "Kako funkcioniše",
  },
  companies: {
    cards: [
      {
        title: "Evidencija opreme i QR naljepnice",
        description:
          "Klijenti, objekti i sva oprema na jednom mjestu: vatrogasni aparati, hidranti, panična rasvjeta, protivpožarne klapne i vrata. SparxDeck štampa QR naljepnice, a svaki uređaj ima svoj karton s kompletnom historijom kontrola.",
      },
      {
        title: "Kontrola na terenu putem telefona",
        description:
          "Tehničar skenira QR kod i prođe kratku kontrolnu listu: pritisak, plomba, oštećenja, rok važenja. Kvar odmah fotografiše. Aplikacija radi i bez signala, u podrumu ili tehničkoj prostoriji.",
      },
      {
        title: "Zapisnik spreman još na licu mjesta",
        description:
          "Klijent potpisuje direktno na ekranu, a PDF zapisnik s logotipom vaše firme odmah mu stiže e-mailom. Nema više večeri provedenih u prepisivanju bilješki.",
      },
      {
        title: "Praćenje rokova kontrola",
        description:
          "Pogledajte šta ističe sljedećeg mjeseca i dobijajte podsjetnike za predstojeće kontrole. Nijedan rok neće promaći, a svaka kontrola donosi sljedeći posao.",
      },
      {
        title: "Kvarovi pod kontrolom",
        description:
          "Svaki pronađeni kvar postaje zadatak koji pratite do otklanjanja. Upravnik zgrade vidi stanje svoje opreme u portalu za klijente.",
      },
    ],
    headingLine1: "Bez komplikovanih korporativnih sistema.",
    headingLine2: "Samo ono što tehničaru zaista treba.",
    paragraph:
      "SparxDeck je namjerno jednostavan. Savlada se za nekoliko minuta, tehničari ga koriste na svojim telefonima, a vi konačno imate jasan pregled svih poslova, opreme i rokova.",
    cardCta: "Saznajte više",
  },
  comparison: {
    title: "Papir i Excel naspram SparxDecka",
    subtitle:
      "Pogledajte kako se mijenja svaki korak kontrole kada bilježnicu, registratore i tabele zamijeni jedna aplikacija.",
    oldLabel: "Papir i Excel",
    newLabel: "SparxDeck",
    rows: [
      {
        topic: "Bilješke s kontrole",
        old: "Ručno na papiru, često nečitko i s greškama",
        new: "Skeniranje QR koda i kratka kontrolna lista direktno u telefonu",
      },
      {
        topic: "Zapisnik",
        old: "Navečer satima prepisivanje u Word ili Excel",
        new: "PDF s logotipom i potpisom klijenta, gotov još na licu mjesta",
      },
      {
        topic: "Rokovi kontrola",
        old: "Tabela, kalendar ili pamćenje",
        new: "Automatski pregled i podsjetnici unaprijed",
      },
      {
        topic: "Kvarovi",
        old: "Bilješka na margini koja se lako izgubi",
        new: "Zadatak s fotografijom koji se prati do rješenja",
      },
      {
        topic: "Historija opreme",
        old: "Registratori u kancelariji i pretraživanje fascikli",
        new: "Kompletna historija svakog uređaja jednim dodirom",
      },
      {
        topic: "Klijent",
        old: "Čeka zapisnik i ne zna u kakvom je stanju oprema",
        new: "Odmah dobija zapisnik e-mailom i vidi stanje u portalu za klijente",
      },
    ],
  },
  radar: {
    title: "Cijeli ciklus kontrole u jednom sistemu",
    subtitle:
      "Od evidencije opreme preko kontrole na terenu do potpisanog zapisnika i sljedećeg roka. SparxDeck pokriva cijeli ciklus koji servisne firme inače slažu od papira, Excela i e-mailova.",
    labels: ["Evidencija", "QR naljepnice", "Kontrola", "Zapisnici", "Rokovi", "Kvarovi"],
    keyAreasHeading: "Šta pokriva SparxDeck",
    keyAreas: [
      {
        title: "Evidencija",
        description:
          "Klijenti, objekti i oprema svih vrsta s kompletnom historijom kontrola na jednom mjestu.",
      },
      {
        title: "QR naljepnice",
        description:
          "Štampanje naljepnica direktno iz aplikacije. Jedno skeniranje i tehničar zna pored kojeg uređaja stoji.",
      },
      {
        title: "Kontrola",
        description:
          "Kontrolna lista za svaku vrstu opreme, fotografija kvara jednim dodirom i pun rad bez signala.",
      },
      {
        title: "Zapisnici",
        description:
          "PDF zapisnik s vašim logotipom i potpisom klijenta, poslan odmah nakon kontrole.",
      },
      {
        title: "Rokovi",
        description: "Pregled kontrola koje dospijevaju sljedećeg mjeseca i podsjetnici na vrijeme.",
      },
      {
        title: "Kvarovi",
        description: "Svaki kvar je zadatak sa statusom koji se prati do rješenja.",
      },
    ],
    howItWorksHeading: "Kako izgleda kontrola uz SparxDeck",
    howItWorks: [
      "U kancelariji unesete klijenta, objekat i opremu ili ih uvezete iz postojeće tabele.",
      "Odštampate QR naljepnice, a tehničar ih prilikom prve posjete zalijepi na opremu.",
      "Pri svakoj sljedećoj kontroli tehničar skenira naljepnicu i označi kontrolnu listu na telefonu.",
      "Ako pronađe kvar, fotografiše ga i u sistemu se automatski kreira zadatak.",
      "Klijent potpisuje na ekranu, zapisnik mu stiže e-mailom, a sistem određuje datum sljedeće kontrole.",
    ],
    resultHeading: "Šta dobijate",
    result: [
      "Večeri bez prepisivanja papirnih bilješki u zapisnike.",
      "Nijednu zaboravljenu kontrolu, a time ni izgubljen posao.",
      "Ponavljajuće poslove koje sistem prati umjesto vas.",
      "Profesionalne zapisnike i sljedivu historiju u slučaju inspekcije ili incidenta.",
    ],
  },
  faq: {
    headingLine1: "Često postavljana pitanja",
    headingLine2: "",
    items: [
      {
        id: "who",
        question: "Za koga je SparxDeck?",
        answer:
          "Za servisne firme koje obilaze objekte i kontrolišu opremu za zaštitu od požara, obično s 3 do 30 zaposlenih. Tehničari rade na terenu putem telefona, kancelarija na računaru, a upravnici zgrada u svom portalu za klijente.",
      },
      {
        id: "equipment",
        question: "Koju opremu podržava SparxDeck?",
        answer:
          "Vatrogasne aparate, hidrante, paničnu rasvjetu, protivpožarne klapne i protivpožarna vrata. Svaka vrsta opreme ima svoju kontrolnu listu, tako da tehničar provjerava tačno ono što treba.",
      },
      {
        id: "offline",
        question: "Da li aplikacija radi bez signala?",
        answer:
          "Da. Tehničar može raditi u podrumu ili tehničkoj prostoriji bez veze. Čim telefon ponovo bude na mreži, podaci se automatski sinhronizuju.",
      },
      {
        id: "pricing",
        question: "Koliko košta SparxDeck?",
        answer:
          "Plaćate mjesečnu pretplatu prema broju tehničara ili uređaja, tako da cijena raste zajedno s vašom firmom. Zakažite kratki demo i pripremit ćemo vam ponudu po mjeri.",
      },
      {
        id: "protocols",
        question: "Da li su zapisnici u skladu s propisima?",
        answer:
          "Da. Šabloni zapisnika zasnivaju se na lokalnim zahtjevima za kontrole u svakoj zemlji u kojoj SparxDeck posluje. Svaki zapisnik sadrži logotip i podatke vaše firme te potpis klijenta.",
      },
      {
        id: "portal",
        question: "Da li upravnik zgrade vidi stanje svoje opreme?",
        answer:
          "Da. Upravnici i vlasnici zgrada imaju svoj portal za klijente, gdje vide stanje opreme, otvorene kvarove i rokove te preuzimaju sve zapisnike.",
      },
      {
        id: "onboarding",
        question: "Koliko traje obuka?",
        answer:
          "Nekoliko minuta. SparxDeck sadrži samo najvažnije, pa tehničar obavi prvu kontrolu bez obuke. Postojeću evidenciju iz Excela uvozite u nekoliko klikova.",
      },
    ],
  },
  getStarted: {
    primaryCta: "Započnite sa SparxDeckom",
    secondaryCta: "Zakažite demo",
  },
  footer: {
    allRightsReserved: "Sva prava zadržana.",
    cookiesSettings: "Kolačići",
    termsOfService: "Uslovi korištenja",
    privacyPolicy: "Politika privatnosti",
    companyHeading: "Kompanija",
    mission: "Naša misija",
    team: "Tim",
    newsroom: "Novosti",
    workWithUs: "Radite s nama",
    careers: "Karijera",
  },
  pages: {
    mission: {
      heading: "Naša misija",
      subheading: "Želimo da tehničar provodi vrijeme uz opremu, a ne nad papirima.",
      body: [
        "Kontrole protivpožarne opreme štite ljude u zgradama. Ipak, u mnogim servisnim firmama i danas se rade kao prije dvadeset godina: tehničar obiđe objekat, sve zapiše na papir, a navečer satima prepisuje bilješke u zapisnik. Rokovi narednih kontrola vode se u Excelu ili napamet.",
        "To košta vremena, novca i živaca. Zaboravljena kontrola znači izgubljen posao, nečitka bilješka znači grešku u zapisniku, a nakon incidenta teško je dokazati šta je i kada provjereno.",
        "SparxDeck to mijenja. Tehničar skenira QR kod, označi kontrolnu listu i zapisnik je gotov. Firma vidi svu opremu, kvarove i rokove, a svaka kontrola postaje sljedeći posao. Ne gradimo još jedan komplikovan korporativni sistem. Pravimo alat koji se savlada za nekoliko minuta i koji ljudi rado koriste.",
      ],
    },
    about: {
      heading: "O SparxDecku",
      subheading: "Softver za servisne firme u oblasti zaštite od požara.",
      body: [
        "SparxDeck je web i mobilna aplikacija za firme koje redovno kontrolišu opremu za zaštitu od požara: vatrogasne aparate, hidrante, paničnu rasvjetu, protivpožarne klapne i vrata. Zamjenjuje papirne bilješke i Excel jednim preglednim sistemom.",
        `SparxDeck je nastao u Češkoj i osmišljen je za rad u više zemalja. Jezgro aplikacije je svugdje isto, mijenjaju se samo jezik i šabloni zapisnika u skladu s lokalnim propisima. Aplikacija je dostupna na ${locales.length} jezika.`,
        "Proizvod razvijamo u bliskoj saradnji sa servisnim firmama i tehničarima iz prakse. Ako imate ideju koja bi vam još više olakšala posao, pišite nam.",
      ],
    },
    team: {
      heading: "SparxDeck tim",
      subheading: "Tim koji pravi jednostavan softver za firme koje obavljaju kontrole.",
    },
    careers: {
      heading: "Karijera",
      subheading:
        "Trenutno nemamo otvorenih pozicija. Ako vas privlači pravljenje softvera za oblast kojoj je potrebna modernizacija, pišite nam.",
    },
    news: {
      heading: "Novosti",
      subheading: "Još nema novosti. Uskoro će se ovdje pojaviti prva ažuriranja proizvoda.",
    },
    equipmentRegister: {
      heading: "Evidencija opreme i QR naljepnice",
      subheading: "Svi klijenti, objekti i oprema na jednom mjestu",
      body: [
        "U SparxDecku vodite klijente, njihove objekte i svaki uređaj u preglednoj strukturi: vatrogasni aparati, hidranti, panična rasvjeta, protivpožarne klapne i vrata. Za svaki uređaj vidite vrstu, lokaciju, datum posljednje kontrole i cijelu historiju. Nema više pretraživanja registratora ili više verzija iste tabele.",
        "Aplikacija štampa QR naljepnicu za svaki uređaj. Tehničar je zalijepi pri prvoj posjeti, a zatim je dovoljno jedno skeniranje da zna pored kojeg uređaja stoji i šta treba uraditi. Postojeću evidenciju iz Excela uvozite u nekoliko klikova.",
      ],
    },
    fieldInspections: {
      heading: "Kontrola na terenu putem telefona",
      subheading: "Skeniraj, označi, gotovo",
      body: [
        "Tehničar skenira QR kod na uređaju i prođe kontrolnu listu pripremljenu za tu vrstu opreme, na primjer kod vatrogasnog aparata: pritisak, plomba, oštećenja i rok važenja. Svaka stavka je jednostavno da/ne, pa kontrola traje trenutak i ništa se ne zaboravi.",
        "Ako tehničar pronađe kvar, fotografiše ga direktno u aplikaciji. Aplikacija radi bez signala u podrumu ili tehničkoj prostoriji, a podaci se sinhronizuju čim telefon ponovo bude na mreži. Nije potrebna posebna oprema ni duga obuka.",
      ],
    },
    inspectionReports: {
      heading: "Zapisnik spreman još na licu mjesta",
      subheading: "Potpis na ekranu i automatski PDF s vašim logotipom",
      body: [
        "Po završetku kontrole SparxDeck automatski pravi PDF zapisnik od svega što je tehničar zabilježio na terenu. Klijent ga potpisuje direktno na ekranu telefona. Zapisnik sadrži logotip i podatke vaše firme, spisak provjerene opreme, rezultate i pronađene kvarove.",
        "Zapisnik odmah stiže klijentu e-mailom, čuva se u sistemu, a upravnik zgrade ga može preuzeti u bilo kojem trenutku iz svog portala. Šabloni zapisnika su u skladu s lokalnim propisima. Uvijek možete provjeriti šta je, kada i kod kojeg klijenta kontrolisano, na primjer tokom inspekcijskog nadzora ili osiguranog slučaja.",
      ],
    },
    deadlineTracking: {
      heading: "Praćenje rokova kontrola",
      subheading: "Nijedan rok neće promaći, a svaka kontrola donosi sljedeći posao",
      body: [
        "SparxDeck zna kada svaki uređaj ima sljedeću kontrolu. Na jednom mjestu vidite šta ističe sljedećeg mjeseca, a sistem vas blagovremeno podsjeća na predstojeće kontrole. Rokove više ne morate voditi u Excelu ili napamet.",
        "Za servisnu firmu to znači stalan priliv ponavljajućih poslova. Možete unaprijed planirati izlaske na teren, javiti se klijentu prije konkurencije i ne izgubiti posao samo zato što je rok zaboravljen.",
      ],
    },
    defectTracking: {
      heading: "Kvarovi pod kontrolom",
      subheading: "Svaki pronađeni kvar postaje zadatak koji se prati do rješenja",
      body: [
        "Kada tehničar tokom kontrole pronađe kvar, SparxDeck ga automatski pretvara u zadatak s fotografijom i opisom. Kvar se ne gubi u bilješkama i jasno je ko je za njega zadužen.",
        "Svaki kvar ima status: nov, u radu, riješen. Upravnik zgrade vidi otvorene kvarove u svom portalu za klijente i siguran je da se problemi zaista rješavaju, a vi imate osnov za sljedeći posao.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "Uslovi korištenja stranice i aplikacije SparxDeck (informativni sažetak, ne predstavlja pravni savjet).",
      body: [
        `Ovi uslovi uređuju korištenje stranice i aplikacije ${SITE.name}, web i mobilne aplikacije za evidenciju i kontrolu opreme za zaštitu od požara. Registracijom ili korištenjem aplikacije prihvatate ove uslove. Ako aplikaciju koristite u ime firme, potvrđujete da ste za to ovlašteni.`,
        "Aplikacija se pruža uz mjesečnu pretplatu. Cijena se određuje prema važećem cjenovniku ili individualnoj ponudi i zavisi od broja tehničara ili uređaja. Pretplatu možete otkazati u bilo kojem trenutku, s djelovanjem na kraju plaćenog perioda.",
        "Odgovorni ste za svoje pristupne podatke i za aktivnosti korisnika na vašem računu. Podaci koje unosite u aplikaciju, naročito evidencija klijenata, oprema, fotografije i zapisnici, pripadaju vama. Obrađujemo ih samo radi pružanja usluge i na zahtjev vam ih predajemo u vidu izvoza.",
        "SparxDeck je alat za evidenciju i dokumentovanje. Odgovornost za stručno obavljanje kontrola i tačnost podataka u zapisnicima snosi servisna firma i njeni ovlašteni tehničari.",
        "Trudimo se da usluga bude stalno dostupna i sigurna, ali ne možemo garantovati da će uvijek raditi bez prekida i grešaka. U mjeri u kojoj to zakon dozvoljava, naša odgovornost je ograničena na iznos pretplate plaćene u posljednjih 12 mjeseci.",
        `Softver, dizajn i brend ${SITE.name} zaštićeni su autorskim pravom i drugim pravima intelektualnog vlasništva. Zabranjeno je zloupotrebljavati aplikaciju, zaobilaziti njenu zaštitu ili je koristiti suprotno zakonu.`,
        `Na ove uslove primjenjuje se pravo Republike Češke. Možemo ih povremeno mijenjati i o bitnim izmjenama obavijestit ćemo vas unaprijed e-mailom. Za pitanja pišite nam na ${SITE.email}.`,
      ],
    },
    privacy: {
      subheading:
        "Kako obrađujemo lične podatke na stranici i u aplikaciji SparxDeck (informativni sažetak, ne predstavlja pravnu procjenu).",
      body: [
        `Kontrolor ličnih podataka korisnika i posjetilaca stranice je operater usluge ${SITE.name}. Za pitanja u vezi sa zaštitom podataka kontaktirajte nas na ${SITE.email}.`,
        "Obrađujemo podatke vašeg računa (ime, e-mail, telefon, firma), podatke za naplatu, tehničke podatke potrebne za siguran rad (IP adresa, vrsta uređaja, evidencija prijava) i informacije koje nam sami pošaljete, na primjer prilikom zakazivanja demoa.",
        "Podatke koje servisna firma unosi u aplikaciju o svojim klijentima, objektima, opremi i kontrolama, uključujući fotografije i potpise, obrađujemo kao obrađivač u ime te firme. Uslovi ove obrade uređeni su ugovorom o obradi podataka, koji je dio pretplate.",
        "Podatke obrađujemo radi pružanja usluge i izvršenja ugovora, ispunjenja zakonskih obaveza (na primjer računovodstvenih), na osnovu legitimnog interesa (sigurnost, sprečavanje zloupotreba, unapređenje usluge), a marketinške poruke na osnovu vašeg pristanka.",
        "Podatke mogu obrađivati i pouzdani dobavljači, kao što su pružaoci cloud infrastrukture, e-mail i platnih usluga, uvijek na osnovu ugovora koji osiguravaju zaštitu u skladu s GDPR-om. Prilikom prijenosa izvan Evropskog ekonomskog prostora primjenjujemo standardne ugovorne klauzule Evropske komisije. Ne prodajemo lične podatke.",
        "Podatke čuvamo dok postoji račun, a zatim samo onoliko koliko je potrebno za ispunjenje zakonskih obaveza ili zaštitu naših prava. Po završetku pretplate, na zahtjev, izvozimo podatke vaše firme, a zatim ih brišemo.",
        "Imate pravo na pristup podacima, njihov ispravak, brisanje, ograničenje obrade, prenosivost i pravo na prigovor. Pristanak možete povući u bilo kojem trenutku. Također imate pravo podnijeti pritužbu nadzornom organu za zaštitu podataka.",
      ],
    },
    cookies: {
      subheading: "Koje kolačiće i slične tehnologije koristi stranica i aplikacija SparxDeck.",
      body: [
        `Stranica i aplikacija ${SITE.name} koriste samo kolačiće koji su neophodni za njihov rad. Ne koristimo reklamne kolačiće niti kolačiće za praćenje trećih strana i ne prodajemo informacije o vašem ponašanju.`,
        "Neophodni kolačići u aplikaciji održavaju vašu prijavu i štite račun od zloupotrebe. Na stranici u vašem pregledniku čuvamo samo vaš izbor svijetle ili tamne teme. Jezik se određuje adresom stranice.",
        "Ako počnemo koristiti analitičke alate ili druge kolačiće koji nisu neophodni, unaprijed ćemo zatražiti vaš pristanak i ažurirati ovu stranicu.",
        "Kolačiće možete u bilo kojem trenutku obrisati ili blokirati u postavkama preglednika, obično u odjeljku Privatnost ili Sigurnost. Bez neophodnih kolačića, međutim, nećete se moći prijaviti u aplikaciju.",
        `Za pitanja o korištenju kolačića pišite nam na ${SITE.email}.`,
      ],
    },
  },
};

export default bs;
