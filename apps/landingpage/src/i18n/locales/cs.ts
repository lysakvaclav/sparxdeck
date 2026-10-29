import type { Dictionary } from "../types";
import home from "../home/cs";
import { SITE } from "@/config/site";
import { locales } from "../config";

const cs: Dictionary = {
  common: {
    backToHome: "Zpět na úvodní stránku",
  },
  header: {
    product: "Produkt",
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
  home,
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
        `SparxDeck vznikl v Česku a je navržený pro práci napříč zeměmi. Jádro aplikace je všude stejné, mění se jazyk a šablony protokolů. Aplikace je zatím v češtině a angličtině, tento web v ${locales.length} jazycích.`,
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
        "Protokol jedním klepnutím odešlete zákazníkovi e-mailem a zůstane uložený v systému. Vzhled si nastavíte v editoru šablon a vydaný protokol se už nikdy nezmění. Kdykoli dohledáte, co se kdy u kterého zákazníka kontrolovalo, například při kontrole úřadů nebo při pojistné události.",
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
        "U každé závady vidíte stav (otevřená, v řešení, vyřešená), kdo ji řeší a do kdy. Vyřešení vyžaduje poznámku a celá historie změn zůstává dohledatelná. Máte tak jistotu, že se nalezené problémy opravdu řeší, a podklad pro další zakázku.",
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
