import type { Dictionary } from "../types";
import home from "../home/bs";
import { SITE } from "@/config/site";
import { locales } from "../config";

const bs: Dictionary = {
  common: {
    backToHome: "Nazad na početnu stranicu",
  },
  header: {
    product: "Proizvod",
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
  home,
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
        `SparxDeck je nastao u Češkoj i napravljen je za rad u više zemalja. Jezgro aplikacije je svuda isto, mijenjaju se jezik i šabloni zapisnika. Aplikacija je za sada na češkom i engleskom, ova stranica na ${locales.length} jezika.`,
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
        "Zapisnik jednim dodirom pošaljete klijentu e-mailom i ostaje sačuvan u sistemu. Izgled podešavate u uređivaču šablona, a izdat zapisnik se više nikada ne mijenja. U svakom trenutku provjerite šta je i kada pregledano kod kojeg klijenta, na primjer pri inspekcijskom nadzoru ili osiguranom slučaju.",
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
        "Kod svakog kvara vidite stanje (otvoren, u radu, otklonjen), ko ga rješava i do kada. Otklanjanje zahtijeva bilješku, a cijela historija promjena ostaje dostupna. Tako znate da se pronađeni problemi zaista rješavaju i imate osnovu za sljedeći posao.",
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
