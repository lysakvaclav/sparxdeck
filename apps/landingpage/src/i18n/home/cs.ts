import type { HomeDictionary } from "../types";

// The home page in this language (sections of src/app/[locale]/page.tsx).
const home: HomeDictionary = {
  "hero": {
    "eyebrow": "Software pro revize požárně bezpečnostních zařízení",
    "title": "Revize požární techniky.",
    "titleMuted": "Bez papíru a přepisování.",
    "body": "SparxDeck je aplikace pro servisní firmy, které dělají revize hasicích přístrojů, hydrantů, nouzového osvětlení, požárních klapek a dveří. Technik naskenuje QR štítek, odklikne kontrolu na telefonu a protokol je hotový ještě na místě. Termíny dalších revizí hlídá systém místo Excelu.",
    "primary": "Začít se SparxDeck",
    "secondary": "Domluvit ukázku",
    "note": "Běží v prohlížeči na počítači i telefonu. Bez instalace."
  },
  "facts": [
    {
      "value": "1 sken",
      "label": "a technik má před sebou kartu zařízení i jeho checklist"
    },
    {
      "value": "Bez signálu",
      "label": "kontrola i dnešní plán fungují i ve sklepě nebo v kotelně"
    },
    {
      "value": "PDF na místě",
      "label": "protokol s podpisem zákazníka hned po kontrole"
    },
    {
      "value": "Pár minut",
      "label": "na zaučení technika místo celodenního školení"
    }
  ],
  "platform": {
    "eyebrow": "Platforma",
    "title": "Vše, co revizní firma potřebuje. Nic navíc.",
    "body": "Od evidence zařízení přes kontrolu v terénu až po podepsaný protokol, závady a další termín. Jeden systém pro kancelář i techniky.",
    "learnMore": "Zjistit více"
  },
  "features": [
    {
      "label": "Evidence",
      "title": "Zákazníci, budovy a zařízení na jednom místě",
      "body": "Hasicí přístroje, hydranty, nouzové osvětlení, klapky i dveře s umístěním, výrobním číslem a celou historií kontrol. Stávající tabulku naimportujete z Excelu a QR štítky vytisknete přímo z aplikace."
    },
    {
      "label": "Kontrola v terénu",
      "title": "Naskenovat, odkliknout, hotovo",
      "body": "Technik naskenuje štítek a projde checklist podle typu zařízení. Závadu vyfotí. Když není signál, kontrola počká v telefonu a odešle se, jakmile se spojení vrátí."
    },
    {
      "label": "Protokoly",
      "title": "Protokol hotový ještě na místě",
      "body": "PDF s logem vaší firmy a podpisem zákazníka vznikne hned po kontrole a jedním klepnutím odejde e-mailem. Vzhled protokolu si nastavíte v editoru šablon. Vydaný protokol se už nikdy nezmění."
    },
    {
      "label": "Termíny",
      "title": "Žádná revize neproklouzne",
      "body": "Kalendář ukazuje, co kdy propadá a kdo kam jede. Přehled na 30, 60 a 90 dní a týdenní souhrn e-mailem hlídají termíny za vás."
    },
    {
      "label": "Závady",
      "title": "Závady sledované až do vyřešení",
      "body": "Nevyhovující položka kontroly se sama stane závadou s fotkou, závažností, odpovědnou osobou a termínem odstranění. Každá změna se zapíše do historie."
    },
    {
      "label": "Mapa a trasy",
      "title": "Budovy na mapě, výjezdy seřazené podle vzdálenosti",
      "body": "Mapa ukazuje stav všech budov. Trasa seřadí výjezdy na den a nabídne budovy poblíž, kterým brzy končí revize. Vzdálenosti jsou vzdušnou čarou, nejde o navigaci."
    }
  ],
  "principles": {
    "eyebrow": "Proč SparxDeck",
    "title": "Navržený pro práci v terénu",
    "items": [
      {
        "title": "Jednoduchý",
        "body": "Jen to, co technik opravdu potřebuje. Žádný složitý podnikový systém, žádné dlouhé zaučování."
      },
      {
        "title": "Funguje bez signálu",
        "body": "Kontroly, fotky i dnešní plán čekají v telefonu a odešlou se, jakmile je spojení."
      },
      {
        "title": "Data patří vám",
        "body": "Každá firma vidí jen svá data. Export do CSV kdykoli, vydané protokoly zůstávají beze změny."
      }
    ]
  },
  "steps": {
    "eyebrow": "Jak to funguje",
    "title": "Revize v pěti krocích",
    "items": [
      "Založíte zákazníky, budovy a zařízení, nebo je naimportujete z dosavadní tabulky.",
      "Vytisknete QR štítky a technik je při první návštěvě nalepí na zařízení.",
      "Při kontrole technik štítek naskenuje a odklikne checklist na telefonu.",
      "Nevyhovující položka se zapíše jako závada s fotkou a termínem odstranění.",
      "Zákazník podepíše na displeji, protokol odejde e-mailem a systém nastaví další termín."
    ]
  },
  "comparison": {
    "eyebrow": "Srovnání",
    "title": "Papír a Excel vs. SparxDeck",
    "body": "Jak se změní každý krok revize, když zápisník, šanony a tabulky nahradí jedna aplikace.",
    "oldLabel": "Papír a Excel",
    "newLabel": "SparxDeck",
    "rows": [
      {
        "topic": "Zápis z kontroly",
        "old": "Ručně na papír, často nečitelně",
        "new": "Sken QR štítku a checklist v telefonu"
      },
      {
        "topic": "Protokol",
        "old": "Večer přepisování do Wordu nebo Excelu",
        "new": "PDF s podpisem zákazníka hned na místě"
      },
      {
        "topic": "Termíny revizí",
        "old": "Tabulka, kalendář nebo paměť",
        "new": "Přehled propadajících termínů a týdenní souhrn"
      },
      {
        "topic": "Závady",
        "old": "Poznámka na okraji, která se ztratí",
        "new": "Závada s fotkou, odpovědnou osobou a termínem"
      },
      {
        "topic": "Historie zařízení",
        "old": "Šanony a hledání po složkách",
        "new": "Celá historie zařízení na jedno klepnutí"
      },
      {
        "topic": "Plánování výjezdů",
        "old": "Z hlavy a podle zkušenosti",
        "new": "Kalendář, mapa budov a trasa na den"
      }
    ]
  },
  "faq": {
    "eyebrow": "FAQ",
    "title": "Často kladené otázky",
    "body": "Nenašli jste odpověď? Napište nám, rádi vám SparxDeck ukážeme.",
    "items": [
      {
        "question": "Pro koho je SparxDeck určený?",
        "answer": "Pro servisní firmy, které dělají revize a kontroly požárně bezpečnostních zařízení, typicky se 3 až 30 lidmi. Technici pracují na telefonu v terénu, kancelář na počítači."
      },
      {
        "question": "Jaká zařízení SparxDeck podporuje?",
        "answer": "Hasicí přístroje, hydranty, nouzové osvětlení, požární klapky a dveře. Typy zařízení i jejich kontrolní položky si upravíte podle sebe, takže technik kontroluje přesně to, co má."
      },
      {
        "question": "Funguje aplikace bez signálu?",
        "answer": "Ano. Rozpracovaná revize i dnešní plán se uloží do telefonu. Kontroly, fotky i označení navštívených budov čekají v telefonu a odešlou se, jakmile je spojení."
      },
      {
        "question": "Můžu si protokol upravit podle sebe?",
        "answer": "Ano. V editoru šablon nastavíte bloky, texty, logo, písmo i barvu. Co má protokol obsahovat podle předpisů, určuje vaše firma, aplikace žádné předpisy nevymýšlí. Vydaný protokol se už nezmění."
      },
      {
        "question": "Jak převedu stávající evidenci?",
        "answer": "Zákazníky, budovy a zařízení naimportujete ze souboru Excel nebo CSV. Aplikace rozpozná sloupce, před uložením ukáže náhled a import jde i vrátit."
      },
      {
        "question": "Kolik SparxDeck stojí?",
        "answer": "Cenu domluvíme podle velikosti vaší firmy. Platí se převodem na základě smlouvy. Domluvte si krátkou ukázku a připravíme vám nabídku."
      },
      {
        "question": "Jak dlouho trvá zaučení?",
        "answer": "Pár minut. Technik zvládne první kontrolu bez školení a v aplikaci jsou ukázková data, na kterých si vše vyzkoušíte."
      }
    ]
  },
  "cta": {
    "title": "Vyzkoušejte SparxDeck ve své firmě",
    "body": "Založte účet a projděte si aplikaci na ukázkových datech, nebo si domluvte krátkou ukázku.",
    "primary": "Začít se SparxDeck",
    "secondary": "Domluvit ukázku"
  },
  "shots": {
    "dashboard": "Přehled SparxDeck s termíny, závadami a dnešní trasou",
    "devices": "Seznam zařízení se štítky, umístěním a termíny revizí",
    "check": "Kontrola hasicího přístroje na telefonu",
    "protocol": "Editor šablony protokolu s náhledem PDF",
    "calendar": "Kalendář plánovaných revizí",
    "defects": "Seznam závad se závažností a termínem odstranění",
    "map": "Mapa budov podle stavu termínů",
    "route": "Trasa technika na mapě, seřazená podle vzdálenosti",
    "today": "Dnešní plán technika na telefonu"
  }
};

export default home;
