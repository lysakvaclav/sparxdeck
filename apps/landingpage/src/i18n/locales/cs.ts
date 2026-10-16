import type { Dictionary } from "../types";
import { SITE } from "@/config/site";
import { locales } from "../config";

const cs: Dictionary = {
  common: {
    backToHome: "Zpět na úvodní stránku",
  },
  header: {
    signIn: "Přihlášení",
    getStarted: "Začít se SparxDeck",
    bookDemo: "Domluvit ukázku",
    company: "Společnost",
    workWithUs: "Přidejte se k nám",
    mission: "Naše mise",
    team: "Tým",
    newsroom: "Novinky",
    careers: "Kariéra",
    megaContactLabel: "Kontakt",
  },
  hero: {
    heading: "Revize požární techniky.\nBez papíru a přepisování.",
    body:
      "SparxDeck je aplikace pro servisní firmy, které dělají revize a kontroly požárně bezpečnostních zařízení. Technik naskenuje QR kód, odklikne kontrolu a protokol odejde zákazníkovi sám. Termíny dalších revizí hlídá systém místo Excelu.",
    primaryCta: "Začít se SparxDeck",
    secondaryCta: "Jak to funguje",
  },
  companies: {
    cards: [
      {
        title: "Evidence zařízení a QR štítky",
        description:
          "Zákazníci, budovy a všechna zařízení přehledně na jednom místě: hasicí přístroje, hydranty, nouzové osvětlení, požární klapky i dveře. SparxDeck vytiskne QR štítky a každé zařízení má vlastní kartu s historií všech kontrol.",
      },
      {
        title: "Kontrola v terénu přes telefon",
        description:
          "Technik naskenuje QR kód a odklikne krátký checklist: tlak, plomba, poškození, platnost. Závadu rovnou vyfotí. Aplikace funguje i bez signálu, třeba ve sklepě nebo v technické místnosti.",
      },
      {
        title: "Protokol hotový ještě na místě",
        description:
          "Zákazník kontrolu podepíše přímo na displeji a PDF protokol s logem vaší firmy mu okamžitě odejde e-mailem. Večerní přepisování z papíru do počítače odpadá.",
      },
      {
        title: "Hlídání termínů revizí",
        description:
          "Přehled toho, co propadá příští měsíc, a upozornění na blížící se revize. Žádný termín neuteče a z každé revize je další zakázka.",
      },
      {
        title: "Závady pod kontrolou",
        description:
          "Nalezená závada se automaticky stane úkolem, který sledujete až do vyřešení. Správce budovy vidí stav svých zařízení v klientském portálu.",
      },
    ],
    headingLine1: "Žádný složitý podnikový systém.",
    headingLine2: "Jen to, co technik opravdu potřebuje.",
    paragraph:
      "SparxDeck je záměrně jednoduchý. Zaučíte se za pár minut, technici ho používají na svém telefonu a vy máte konečně přehled o všech zakázkách, zařízeních a termínech.",
    cardCta: "Zjistit více",
  },
  comparison: {
    title: "Papír a Excel vs. SparxDeck",
    subtitle:
      "Podívejte se, jak se změní každý krok revize, když zápisník, šanony a tabulky nahradí jedna aplikace.",
    oldLabel: "Papír a Excel",
    newLabel: "SparxDeck",
    rows: [
      {
        topic: "Zápis z kontroly",
        old: "Ručně na papír, často nečitelně a s chybami",
        new: "Sken QR kódu a krátký checklist přímo v telefonu",
      },
      {
        topic: "Protokol",
        old: "Večer hodiny přepisování do Wordu nebo Excelu",
        new: "PDF s logem a podpisem zákazníka hotové ještě na místě",
      },
      {
        topic: "Termíny revizí",
        old: "Tabulka, kalendář nebo paměť",
        new: "Automatický přehled a upozornění s předstihem",
      },
      {
        topic: "Závady",
        old: "Poznámka na okraji, která se snadno ztratí",
        new: "Úkol s fotkou, sledovaný až do vyřešení",
      },
      {
        topic: "Historie zařízení",
        old: "Šanony v kanceláři a hledání po složkách",
        new: "Kompletní historie každého zařízení na jedno klepnutí",
      },
      {
        topic: "Zákazník",
        old: "Čeká na protokol a o stavu zařízení nic neví",
        new: "Protokol hned v e-mailu a stav zařízení v klientském portálu",
      },
    ],
  },
  radar: {
    title: "Celá revize v jednom systému",
    subtitle:
      "Od evidence zařízení přes kontrolu v terénu až po podepsaný protokol a další termín. SparxDeck pokrývá celý cyklus, který servisní firmy jinak skládají z papírů, Excelu a e-mailů.",
    labels: ["Evidence", "QR štítky", "Kontrola", "Protokoly", "Termíny", "Závady"],
    keyAreasHeading: "Co SparxDeck pokrývá",
    keyAreas: [
      {
        title: "Evidence",
        description:
          "Zákazníci, budovy a zařízení všech typů s kompletní historií kontrol na jednom místě.",
      },
      {
        title: "QR štítky",
        description:
          "Tisk štítků přímo z aplikace. Jeden sken a technik ví, u jakého zařízení stojí.",
      },
      {
        title: "Kontrola",
        description:
          "Checklist podle typu zařízení, fotka závady jedním klepnutím a plná funkčnost i bez signálu.",
      },
      {
        title: "Protokoly",
        description:
          "PDF protokol s logem vaší firmy a podpisem zákazníka, odeslaný hned po kontrole.",
      },
      {
        title: "Termíny",
        description:
          "Přehled revizí, které propadají příští měsíc, a včasná upozornění.",
      },
      {
        title: "Závady",
        description:
          "Každá závada je úkol se stavem, který se sleduje až do vyřešení.",
      },
    ],
    howItWorksHeading: "Jak probíhá revize se SparxDeck",
    howItWorks: [
      "V kanceláři založíte zákazníka, budovu a zařízení, nebo je naimportujete z dosavadní tabulky.",
      "Vytisknete QR štítky a při první návštěvě je technik nalepí na zařízení.",
      "Při každé další kontrole technik štítek naskenuje a odklikne checklist přímo na telefonu.",
      "Pokud najde závadu, vyfotí ji a v systému automaticky vznikne úkol.",
      "Zákazník podepíše na displeji, protokol mu odejde e-mailem a systém nastaví termín další revize.",
    ],
    resultHeading: "Co tím získáte",
    result: [
      "Večery bez přepisování papírových zápisů do protokolů.",
      "Žádnou zapomenutou revizi, a tím ani ztracenou zakázku.",
      "Opakované zakázky, které si systém hlídá za vás.",
      "Profesionální protokoly a dohledatelnou historii pro případ kontroly nebo události.",
    ],
  },
  faq: {
    headingLine1: "Často kladené otázky",
    headingLine2: "",
    items: [
      {
        id: "who",
        question: "Pro koho je SparxDeck určený?",
        answer:
          "Pro servisní firmy, které jezdí po budovách a dělají revize a kontroly požárně bezpečnostních zařízení, typicky se 3 až 30 lidmi. Technici pracují v terénu na telefonu, kancelář na počítači a správci budov ve svém klientském portálu.",
      },
      {
        id: "equipment",
        question: "Jaká zařízení SparxDeck podporuje?",
        answer:
          "Hasicí přístroje, hydranty, nouzové osvětlení, požární klapky a požární dveře. Každý typ zařízení má vlastní checklist, takže technik kontroluje přesně to, co má.",
      },
      {
        id: "offline",
        question: "Funguje aplikace bez signálu?",
        answer:
          "Ano. Technik může kontrolovat i ve sklepě nebo v technické místnosti bez připojení. Jakmile je telefon znovu online, data se automaticky synchronizují.",
      },
      {
        id: "pricing",
        question: "Kolik SparxDeck stojí?",
        answer:
          "Platíte měsíční předplatné podle počtu techniků nebo zařízení, takže cena roste spolu s vaší firmou. Domluvte si krátkou ukázku a připravíme vám nabídku na míru.",
      },
      {
        id: "protocols",
        question: "Odpovídají protokoly předpisům?",
        answer:
          "Ano. Šablony protokolů vycházejí z požadavků místních předpisů pro kontroly provozuschopnosti v každé zemi, kde SparxDeck působí. Protokol nese logo a údaje vaší firmy a podpis zákazníka.",
      },
      {
        id: "portal",
        question: "Vidí stav zařízení i správce budovy?",
        answer:
          "Ano. Správci a majitelé budov mají vlastní klientský portál, kde vidí stav svých zařízení, otevřené závady a termíny a kde si stáhnou všechny protokoly.",
      },
      {
        id: "onboarding",
        question: "Jak dlouho trvá zaučení?",
        answer:
          "Pár minut. SparxDeck obsahuje jen to nejdůležitější, takže technik zvládne první kontrolu bez školení. Stávající evidenci z Excelu jednoduše naimportujete.",
      },
    ],
  },
  getStarted: {
    primaryCta: "Začít se SparxDeck",
    secondaryCta: "Domluvit ukázku",
  },
  footer: {
    allRightsReserved: "Všechna práva vyhrazena.",
    cookiesSettings: "Cookies",
    termsOfService: "Podmínky používání",
    privacyPolicy: "Zásady ochrany osobních údajů",
    companyHeading: "Společnost",
    mission: "Naše mise",
    team: "Tým",
    newsroom: "Novinky",
    workWithUs: "Přidejte se k nám",
    careers: "Kariéra",
  },
  pages: {
    mission: {
      heading: "Naše mise",
      subheading: "Chceme, aby revizní technik trávil čas u zařízení, ne nad papíry.",
      body: [
        "Revize požárně bezpečnostních zařízení jsou práce, na které závisí bezpečnost lidí v budovách. Přesto se v mnoha servisních firmách dodnes dělají stejně jako před dvaceti lety: technik obejde budovu, zapisuje na papír a večer hodiny přepisuje poznámky do protokolu. Termíny dalších revizí se hlídají v Excelu nebo z hlavy.",
        "To stojí čas, peníze i nervy. Zapomenutá revize znamená ztracenou zakázku, nečitelný zápis znamená chybu v protokolu a při případné události je těžké doložit, co se kdy kontrolovalo.",
        "SparxDeck to mění. Technik naskenuje QR kód, odklikne kontrolu a protokol je hotový. Firma má přehled o všech zařízeních, závadách a termínech a z každé revize jí vzniká další zakázka. Nestavíme další složitý podnikový systém. Děláme nástroj, který se zaučí za pár minut a lidé ho rádi používají.",
      ],
    },
    about: {
      heading: "O SparxDeck",
      subheading: "Software pro servisní firmy v oblasti požární ochrany.",
      body: [
        "SparxDeck je webová a mobilní aplikace pro firmy, které dělají pravidelné revize a kontroly požárně bezpečnostních zařízení: hasicích přístrojů, hydrantů, nouzového osvětlení, požárních klapek a dveří. Nahrazuje papírové zápisy a Excel jedním přehledným systémem.",
        `SparxDeck vznikl v Česku a je navržený pro práci napříč zeměmi. Jádro aplikace je všude stejné, mění se jazyk a šablony protokolů podle místních předpisů. Aplikace je dostupná v ${locales.length} jazycích.`,
        "Produkt vyvíjíme v úzké spolupráci se servisními firmami a techniky z praxe. Pokud máte nápad, co by vám práci ještě usnadnilo, napište nám.",
      ],
    },
    team: {
      heading: "Tým SparxDeck",
      subheading: "Tým, který staví jednoduchý software pro revizní firmy.",
    },
    careers: {
      heading: "Kariéra",
      subheading:
        "Aktuálně nemáme otevřené pozice. Pokud vás láká budovat software pro obor, který potřebuje modernizaci, napište nám.",
    },
    news: {
      heading: "Novinky",
      subheading: "Zatím tu nejsou žádné novinky. Brzy se tu objeví první aktualizace produktu.",
    },
    equipmentRegister: {
      heading: "Evidence zařízení a QR štítky",
      subheading: "Všechny zákazníky, budovy a zařízení máte na jednom místě",
      body: [
        "Ve SparxDeck vedete zákazníky, jejich budovy a jednotlivá zařízení v přehledné struktuře: hasicí přístroje, hydranty, nouzové osvětlení, požární klapky i požární dveře. U každého zařízení vidíte typ, umístění, datum poslední kontroly a celou historii. Žádné hledání v šanonech ani v několika verzích jedné tabulky.",
        "Aplikace pro každé zařízení vytiskne QR štítek. Technik ho při první návštěvě nalepí a od té chvíle stačí jeden sken: hned ví, u jakého zařízení stojí a co ho čeká. Stávající evidenci z Excelu jednoduše naimportujete.",
      ],
    },
    fieldInspections: {
      heading: "Kontrola v terénu přes telefon",
      subheading: "Naskenovat, odkliknout, hotovo",
      body: [
        "Technik naskenuje QR kód na zařízení a projde checklist připravený pro daný typ zařízení, u hasicího přístroje třeba tlak, plombu, poškození a platnost. Každá položka je jednoduché ano/ne, takže kontrola zabere jen chvilku a nic se nezapomene.",
        "Pokud technik najde závadu, vyfotí ji přímo v aplikaci. Aplikace funguje i bez signálu ve sklepě nebo v technické místnosti a data se synchronizují, jakmile je telefon znovu online. Technik nepotřebuje žádné zvláštní vybavení ani dlouhé školení.",
      ],
    },
    inspectionReports: {
      heading: "Protokol hotový ještě na místě",
      subheading: "Podpis na displeji a automatické PDF s logem vaší firmy",
      body: [
        "Po skončení kontroly SparxDeck automaticky vytvoří PDF protokol ze všeho, co technik v terénu zaznamenal. Zákazník ho podepíše přímo na displeji telefonu. Protokol nese logo a údaje vaší firmy a obsahuje seznam zkontrolovaných zařízení, výsledky i nalezené závady.",
        "Protokol okamžitě odejde zákazníkovi e-mailem, uloží se v systému a správce budovy si ho kdykoli stáhne ze svého portálu. Šablony protokolů odpovídají místním předpisům. Vy máte kdykoli dohledatelné, co se kdy u kterého zákazníka kontrolovalo, například při kontrole úřadů nebo při pojistné události.",
      ],
    },
    deadlineTracking: {
      heading: "Hlídání termínů revizí",
      subheading: "Žádný termín neuteče, z každé revize je další zakázka",
      body: [
        "SparxDeck ví, kdy má které zařízení příští kontrolu. Na jednom místě vidíte, co propadá příští měsíc, a systém vás na blížící se revize včas upozorní. Termíny už nemusíte hlídat v Excelu ani z hlavy.",
        "Pro servisní firmu to znamená pravidelný přísun opakovaných zakázek. Můžete plánovat výjezdy dopředu, ozvat se zákazníkovi dřív než konkurence a nepřijít o zakázku jen proto, že se na termín zapomnělo.",
      ],
    },
    defectTracking: {
      heading: "Závady pod kontrolou",
      subheading: "Každá nalezená závada je úkol, který se sleduje do vyřešení",
      body: [
        "Když technik při kontrole najde závadu, SparxDeck z ní automaticky vytvoří úkol včetně fotky a popisu. Závada se tak neztratí v poznámkách a je jasné, kdo ji má na starosti.",
        "U každé závady vidíte stav: nová, v řešení, vyřešená. Správce budovy vidí otevřené závady ve svém klientském portálu, takže má jistotu, že se nalezené problémy opravdu řeší, a vy máte podklad pro další zakázku.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "Podmínky používání webu a aplikace SparxDeck (informativní shrnutí, nenahrazuje právní radu).",
      body: [
        `Tyto podmínky upravují používání webu a aplikace ${SITE.name}, webové a mobilní aplikace pro evidenci a revize požárně bezpečnostních zařízení. Registrací nebo používáním aplikace s nimi souhlasíte. Pokud aplikaci používáte jménem firmy, potvrzujete, že jste k tomu oprávněni.`,
        "Aplikace se poskytuje formou měsíčního předplatného. Cena se řídí aktuálním ceníkem nebo individuální nabídkou a odvíjí se od počtu techniků nebo zařízení. Předplatné můžete kdykoli ukončit ke konci zaplaceného období.",
        "Za přihlašovací údaje a za činnost uživatelů ve vašem účtu odpovídáte vy. Data, která do aplikace vložíte, zejména evidence zákazníků, zařízení, fotografie a protokoly, patří vám. My je zpracováváme jen za účelem poskytování služby a na požádání vám je předáme v exportu.",
        "SparxDeck je nástroj pro evidenci a dokumentaci. Odpovědnost za odborné provedení revizí a kontrol a za správnost údajů v protokolech nese servisní firma a její oprávnění technici.",
        "Usilujeme o nepřetržitou dostupnost a bezpečnost služby, ale nemůžeme zaručit, že bude vždy bez výpadků a chyb. V rozsahu povoleném právními předpisy je naše odpovědnost za škodu omezena na výši předplatného zaplaceného za posledních 12 měsíců.",
        `Software, design a značka ${SITE.name} jsou chráněny autorským právem a dalšími právy duševního vlastnictví. Je zakázáno aplikaci zneužívat, obcházet její zabezpečení nebo ji používat v rozporu s právními předpisy.`,
        `Tyto podmínky se řídí právním řádem České republiky. Můžeme je v čase upravovat. O podstatných změnách vás předem informujeme e-mailem. S dotazy se na nás obraťte na adrese ${SITE.email}.`,
      ],
    },
    privacy: {
      subheading:
        "Jak zpracováváme osobní údaje na webu a v aplikaci SparxDeck (informativní shrnutí, nenahrazuje právní posouzení).",
      body: [
        `Správcem osobních údajů uživatelů a návštěvníků webu je provozovatel služby ${SITE.name}. V záležitostech ochrany osobních údajů nás kontaktujte na adrese ${SITE.email}.`,
        "Zpracováváme údaje o vašem účtu (jméno, e-mail, telefon, firma), fakturační údaje, technické údaje nutné pro bezpečný provoz (IP adresa, typ zařízení, záznamy o přihlášení) a údaje, které nám sami pošlete, například při domluvě ukázky.",
        "Data, která servisní firma vkládá do aplikace o svých zákaznících, budovách, zařízeních a kontrolách, včetně fotografií a podpisů, zpracováváme jako zpracovatel jménem této firmy. Podmínky tohoto zpracování upravuje smlouva o zpracování osobních údajů, která je součástí předplatného.",
        "Údaje zpracováváme za účelem poskytování služby a plnění smlouvy, plnění zákonných povinností (například účetních), z oprávněného zájmu (bezpečnost, prevence zneužití, zlepšování služby) a v případě marketingových sdělení na základě vašeho souhlasu.",
        "Údaje mohou zpracovávat i naši důvěryhodní dodavatelé, například poskytovatelé cloudové infrastruktury, e-mailových a platebních služeb, vždy na základě smluv zajišťujících ochranu podle GDPR. Při předání mimo Evropský hospodářský prostor používáme standardní smluvní doložky Evropské komise. Osobní údaje neprodáváme.",
        "Údaje uchováváme po dobu trvání účtu a poté jen po dobu nutnou ke splnění zákonných povinností nebo k ochraně našich práv. Po ukončení předplatného data vaší firmy na požádání vyexportujeme a následně smažeme.",
        "Máte právo na přístup k osobním údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku. Udělený souhlas můžete kdykoli odvolat. Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů (www.uoou.cz).",
      ],
    },
    cookies: {
      subheading: "Jaké cookies a podobné technologie používá web a aplikace SparxDeck.",
      body: [
        `Web a aplikace ${SITE.name} používají jen cookies, které jsou nezbytné pro jejich fungování. Nepoužíváme reklamní ani sledovací cookies třetích stran a neprodáváme informace o vašem chování.`,
        "Nezbytné cookies v aplikaci udržují vaše přihlášení a chrání účet před zneužitím. Na webu si v prohlížeči ukládáme jen vaši volbu světlého nebo tmavého vzhledu. Jazyk určuje adresa stránky.",
        "Pokud začneme používat analytické nástroje nebo jiné cookies, které nejsou nezbytně nutné, vyžádáme si předem váš souhlas a tuto stránku aktualizujeme.",
        "Cookies můžete kdykoli smazat nebo zablokovat v nastavení svého prohlížeče, obvykle v sekci Soukromí nebo Zabezpečení. Bez nezbytných cookies se ale do aplikace nebudete moci přihlásit.",
        `S dotazy k používání cookies se na nás obraťte na adrese ${SITE.email}.`,
      ],
    },
  },
};

export default cs;
