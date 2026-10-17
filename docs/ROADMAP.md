# SparxDeck: plán po částech

Platformu stavíme po částech. Každá část je samostatně použitelná, ověřená a uložená commitem. Na další část se přechází, až majitel řekne „jdeme na další“.

- **Co má platforma umět:** [CHECKLIST.md](CHECKLIST.md) (položky P1, P2, P3)
- **Datový model a pravidla:** [SPEC.md](SPEC.md)
- **O produktu:** [CLAUDE.md](../CLAUDE.md)

Plán pokrývá všechny položky **P1**. Položky P2 a P3 přijdou až po spuštění první verze, podle zpětné vazby od prvních firem.

## Jak probíhá každá část

1. Krátký plán části a otázky, které jsou opravdu potřeba.
2. Databáze (migrace + Row Level Security + test, že cizí firma nic nevidí), pak serverová logika, pak obrazovky.
3. Kontrola: lint, typy, testy, build, projití v prohlížeči na počítači i telefonu, světlý i tmavý režim, čeština i angličtina.
4. Odškrtnutí hotových položek v [CHECKLIST.md](CHECKLIST.md) s odkazem na commit.
5. Commit a shrnutí: co je hotové, co otestovat ručně, co je potřeba rozhodnout.

**Platí pro každou část** (průběžné položky z checklistu, odškrtávají se až na konci celé verze):
srozumitelné prázdné stavy a chybové hlášky, potvrzení před smazáním (S), ovládání na telefonu a dotykové prvky alespoň 44 px (T), všechny texty přes překlady a logické CSS vlastnosti (U), Row Level Security s testem na každé tabulce a validace na serveru (V), design podle landing page.

## Přehled

| # | Část | Hlavní položky checklistu | Stav |
|---|---|---|---|
| 1 | Účty, firma a tým | A, B, L (e-maily) | Skoro hotovo: zbývá nastavit e-maily (Resend) a ručně ověřit odkazy z e-mailů |
| 2 | Nastavení firmy a soubory | Q, V (úložiště) | Hotovo |
| 3 | Zákazníci a budovy | C, D | Hotovo |
| 4 | Typy zařízení a šablony kontrol | E | Hotovo (položky šablony a interval čekají na ověření revizním technikem) |
| 5 | Zařízení a termíny | F, K (výpočet stavů) | Hotovo |
| 6 | QR štítky | G | Hotovo |
| 7 | Revize v terénu (jádro) | H, M | Hotovo, čeká na vyzkoušení na telefonu |
| 8 | Závady | I | Hotovo |
| 9 | Protokoly (PDF a e-mail) | J, L (protokol) | Hotovo, odesílání e-mailem čeká na nastavení Resend |
| 10 | Přehled termínů a týdenní souhrn | K, L (souhrn) | Hotovo, odesílání souhrnu čeká na Resend a nasazení |
| 11 | Hledání, průvodce a export | S (hledání), X, R | Hotovo |
| 12 | Kvalita a spuštění | T (PWA), V, Y | Nasazeno na sparxdeck-app.vercel.app (landing sparxdeck.vercel.app); doména, e-maily a placené plány před prvním zákazníkem |

Pořadí vychází ze závislostí: nastavení firmy (logo, údaje) potřebují protokoly, zařízení potřebují zákazníky a šablony, revize potřebuje zařízení a štítky, protokol potřebuje dokončenou revizi.

---

## Část 1: Účty, firma a tým

**Cíl:** firma se zaregistruje, pozve kolegy a spravuje jejich role. Data firem jsou prokazatelně oddělená.

**Stav (2026-10-11):**

Hotovo a ověřeno (automatické testy proti databázi + průchod v prohlížeči na počítači i telefonu, cs/en, světlý/tmavý režim):
- přihlášení a odhlášení (přihlášení heslem probíhá v prohlížeči, aby Supabase počítal limit pokusů pro každou IP zvlášť; ověřeno: po 31 pokusech za 5 minut odmítnuto),
- založení firmy, pozvánka (odkaz se ukáže v aplikaci, dokud nejsou nastavené e-maily), přijetí pozvánky existujícím účtem,
- správa členů: změna role, odebrání s potvrzením, převod vlastnictví; vlastníka nelze odebrat (hlídá i databáze),
- profil: změna jména a hesla (s ověřením současného hesla), silná hesla (seznam běžných hesel, e-mail v hesle),
- izolace firem: 20 testů v `tests/rls.test.ts`,
- odkazy na zásady ochrany osobních údajů a podmínky, data v EU (Irsko).

Připraveno, čeká na e-maily:
- registrace s potvrzením e-mailu, přihlášení odkazem, obnova hesla, změna e-mailu, odeslání pozvánky e-mailem,
- vlastní šablony e-mailů ve vzhledu SparxDecku (cs/en) v `apps/platform/supabase/templates`.

Zbývá:
- Nastavit v Supabase adresy pro přesměrování a nahrát šablony e-mailů.
- Napojit odesílání e-mailů přes Resend (účet, ověření domény sparxdeck.com, SMTP v Supabase).
- Ručně projít registraci, potvrzení, obnovu hesla a změnu e-mailu se skutečnou e-mailovou schránkou.

**Hotovo, když:** dva uživatelé ve dvou firmách se nevidí (automatický test), vlastník pozve technika, ten se přidá a vlastník mu změní roli i ho odebere, e-maily dorazí a vypadají dobře.

**Od tebe:** projekt v Supabase (viz [README platformy](../apps/platform/README.md)); pro e-maily účet v Resend a ověření domény sparxdeck.com (DNS záznamy).

## Část 2: Nastavení firmy a soubory

**Cíl:** firma vyplní údaje, které se objeví v protokolech.

- Údaje o firmě: název, obchodní název, IČO, DIČ, adresa, e-mail, telefon.
- Logo (nahrání s omezením typu a velikosti), patička protokolu.
- Výchozí jazyk a časové pásmo firmy, hranice „brzy“ ve dnech (výchozí 30).
- Základ pro soubory: privátní úložiště, přístup jen přes krátkodobé podepsané odkazy, kontrola typu a velikosti na serveru.
- Nastavení smí měnit jen vlastník a administrátor.

**Hotovo, když:** změna údajů a loga se uloží, technik je nemůže měnit a logo nejde stáhnout bez podepsaného odkazu.

**Stav (2026-10-11): hotovo.** Stránka Nastavení (údaje firmy s kontrolou IČO, logo, patička protokolu, jazyk protokolů, časové pásmo s posunem vůči UTC, hranice „brzy“). Soubory v soukromém bucketu `org-assets` pod složkou firmy, typ a velikost hlídá bucket i kontrola obsahu souboru. Ověřeno 12 testy proti databázi a průchodem v prohlížeči (vlastník, technik jen pro čtení, telefon, tmavý režim). Logo se do protokolu dostane v části 9.

## Část 3: Zákazníci a budovy

**Cíl:** evidence zákazníků, jejich budov a míst v budovách.

- Zákazníci: seznam s řazením a stránkováním, hledání podle jména, kontaktu a IČO, vytvoření, úprava, měkké smazání, poznámky.
- Detail zákazníka: kontakty a budovy (zařízení, revize a závady se doplní v dalších částech).
- Budovy: seznam a detail, adresa, poznámky k přístupu (klíče, vrátnice, kontakt), měkké smazání.
- Lokace v budově (patro, místnost, chodba) s vlastním pořadím.
- Společné komponenty pro všechny další seznamy: tabulka a karty na telefonu, hledání, stránkování, prázdné stavy, potvrzení smazání.

**Hotovo, když:** lze založit zákazníka, budovu a lokace, vyhledat je a smazat, a jiná firma je nevidí.

**Stav (2026-10-11): hotovo.** Zákazníci (seznam s hledáním podle názvu, kontaktu a IČO, řazením a stránkováním po 20; vytvoření, úprava, měkké smazání; detail s kontakty, fakturačními údaji, poznámkami a budovami). Budovy (vytvoření, úprava, měkké smazání; přístup do budovy zvýrazněný nahoře). Lokace s přidáním, přejmenováním, posunem a smazáním. Technik vše vidí, ale nemůže měnit. Společné komponenty pro další seznamy: hledání v adrese, stránkování, drobečková navigace, prázdné stavy, tlačítko smazat s potvrzením. Ověřeno 8 testy proti databázi (izolace firem, technik jen čte, složené cizí klíče, měkké mazání, pořadí lokací, odolnost hledání) a průchodem v prohlížeči (9 kroků, počítač i telefon). Tabulka/karty na telefonu: seznam je jeden sloupec řádků, který funguje na obou.

**Navíc (2026-10-11), na přání majitele:** celé pracovní prostředí platformy předěláno do hustého pracovního stylu podle předlohy (tmavá ikonová lišta, hlavička s drobečkovou navigací, nástrojové lišty, panely, tabulky, inspektor) a přidána **Mapa vazeb** (`/graph`): zákazníci, budovy a lokace jako propojený graf s nástroji (posun a výběr oblasti, rozložení, zpět/znovu, vyčistit, výběr větve, rozbalit/sbalit, hledání, skrytí, zarovnání, tok, legenda, barvy podle typu nebo zákazníka), stromem objektů, inspektorem (vlastnosti, vazby) a uloženým pohledem. Ověřeno 14 kroky v prohlížeči a 9 unit testy grafu. Další části přidají do mapy zařízení, revize a závady.

**Druhé kolo vzhledu (2026-10-11):** pracovní prostředí věrně podle Palantir Foundry / Blueprint 3: systémové písmo, paleta a tlačítka Blueprint, ikony Blueprint, hlavička s cestou a aplikačními menu, domovská stránka s nedávno upravenými objekty a rychlými akcemi. Mapa vazeb dostala styl uzlů jako ve Foundry (pruhy s ‹ › a odznaky, nebo karty), dvousloupcovou legendu s editorem barev, strom objektů se záložkou Skryté, inspektor se záložkami Vlastnosti/Vazby/Podrobnosti, spodní panel Náhled/Seznam objektů, menu Soubor (export PNG, odkaz), Zobrazení a Nápověda (klávesové zkratky). Ověřeno 17 kroky v prohlížeči.

## Část 4: Typy zařízení a šablony kontrol

**Cíl:** co a jak často se kontroluje, je nastavitelné, ne natvrdo v kódu.

- Typ „Hasicí přístroj“ s výchozím intervalem revize jako upravitelnou hodnotou.
- Ukázková šablona kontroly, viditelně označená „vzorová, ověřit s revizním technikem“.
- Položky: ano/ne, číslo, text; povinné položky; položka, jejíž nesplnění vytvoří závadu.
- Verzování: úprava šablony vytvoří novou verzi, staré revize zůstanou u původní.
- Úpravy šablon jen pro vlastníka a administrátora.

**Hotovo, když:** administrátor upraví šablonu, vznikne nová verze a technik šablony měnit nemůže.

**Od tebe:** ideálně ověřit položky šablony a interval s revizním technikem (do té doby zůstanou označené jako vzorové).

**Stav (2026-10-12): hotovo.** Aplikace Typy a šablony: seznam typů, detail s položkami aktivní verze, historie verzí (starší verze jdou zobrazit), úprava názvu a intervalu (1 až 120 měsíců), editor šablony (ano/ne, číslo, text; povinná; nesplnění = závada jen u ano/ne; pořadí; přidání a odebrání). Uložení vytvoří novou aktivní verzi, beze změn nevznikne nic. Každá nová firma dostane typ Hasicí přístroj (12 měsíců) a vzorovou šablonu se 7 položkami v jazyce zakladatele, označené jako vzorové, dokud je administrátor nepotvrdí. Technik vše vidí, nic nemění. Ověřeno 8 testy proti databázi a 6 kroky v prohlížeči.

## Část 5: Zařízení a termíny

**Cíl:** evidence zařízení v budovách a spolehlivý výpočet termínů.

- Seznam zařízení s filtry (zákazník, budova, lokace, typ, stav, termín) a hledáním podle čísla štítku a sériového čísla.
- Vytvoření, úprava, měkké smazání; stav aktivní / vyřazené / odstraněné.
- Automatické číslování štítků v rámci firmy (bez duplicit i při souběhu).
- Hromadné přidání (např. 20 přístrojů najednou s číslováním).
- Detail zařízení: údaje, další termín (QR, historie a závady se doplní v dalších částech).
- Výpočet stavu termínu: v pořádku, brzy, po termínu, bez revize, s testy na přechody měsíců, přestupné roky a časová pásma.

**Hotovo, když:** v budově lze přidat 20 zařízení najednou, vyhledat je a stavy termínů jsou správně i v hraničních případech (testy).

**Stav (2026-10-12): hotovo.** Nová aplikace Zařízení: seznam se stránkováním po 50, hledáním podle čísla štítku („7“ i „0007“), výrobního čísla, výrobce a modelu, filtry zákazník, budova, lokace, stav a termín v adrese a řazením podle štítku nebo příští revize. Přidání jednoho zařízení, hromadné přidání až 100 zařízení najednou (společné údaje, volitelně výrobní čísla po řádcích, štítky jdou za sebou), úprava, měkké smazání (číslo štítku se znovu nepoužije), stav aktivní / vyřazené / odstraněné. U budovy karta zařízení seřazená podle trasy lokací se souhrnem termínů; u zákazníka počet zařízení v budovách. Detail zařízení se stavem termínu (po termínu, brzy, v pořádku, bez revize), poslední revizí a intervalem. Datum poslední revize lze zadat ručně (např. z papírového protokolu), příští termín dopočítá databáze podle intervalu typu a změna intervalu termíny posune. „Dnes“ se počítá v časovém pásmu firmy, hranice „brzy“ je nastavení firmy. Přehled ukazuje počty zařízení podle stavu termínu. Mapa vazeb má zařízení jako čtvrtou úroveň a nový režim barev Podle termínu (budova a zákazník mají barvu svého nejnaléhavějšího zařízení). Ověřeno 106 automatickými testy (z toho 11 nových proti databázi: izolace firem, číslování při souběhu, zakázané sloupce, výpočet termínu shodný s aplikací) a 13 kroky v prohlížeči; vizuálně na počítači i telefonu, ve světlém i tmavém režimu, česky i anglicky.

## Část 6: QR štítky

**Cíl:** vytištěný štítek po naskenování otevře správné zařízení.

- Náhodný, neuhádnutelný token u každého zařízení; QR obsahuje jen odkaz `/d/<token>`.
- Po naskenování: nepřihlášený jde na přihlášení a zpět, cizí firma vidí neutrální „nenalezeno“.
- Tisk štítků do PDF: mřížka na A4, QR, číslo štítku, název budovy; výběr zařízení a počet kopií.
- Doplnění QR do detailu zařízení.

**Hotovo, když:** vytištěný štítek naskenovaný telefonem otevře správné zařízení a pro cizí firmu nic neprozradí.

**Stav (2026-10-12): hotovo.** Každé zařízení má na detailu kartu Štítek s QR kódem, číslem a odkazem. QR obsahuje jen odkaz `/d/<token>` (náhodný 12znakový kód, úroveň opravy chyb Q, takže přežije i poškrábání). Po naskenování: nepřihlášený projde přihlášením a vrátí se k zařízení; cizí firma, neplatný i smazaný štítek dostanou stejné neutrální „Štítek nenalezen“. Tisk štítků po budovách: výběr zařízení (odstraněná se netisknou), 6 běžných formátů archů A4 i vlastní rozměr, počet kopií, začátek na načatém archu, živý náhled archu a vektorové PDF s vloženým písmem (česká diakritika). Poslední formát si prohlížeč pamatuje. Tisknout může každý člen firmy. Ověřeno 116 automatickými testy (QR se dekóduje zpět, geometrie všech formátů, validace, vykreslení PDF, token najde zařízení jen ve vlastní firmě) a 7 kroky v prohlížeči, ve kterých se QR přečte ze snímku obrazovky jako telefonem a odkaz se otevře nepřihlášeně i jako cizí firma.

**Od tebe:** vytisknout arch na skutečné štítky a naskenovat telefonem. Do nasazení vede odkaz v QR na adresu z `NEXT_PUBLIC_APP_URL` (teď `localhost`), takže ostré štítky tisknout až z app.sparxdeck.com.

## Část 7: Revize v terénu (jádro produktu)

**Cíl:** technik na telefonu projde budovu a zkontroluje zařízení.

- Zahájení revize v budově, přehled zařízení (zkontrolováno / zbývá, počítadlo).
- Skener QR kamerou v prohlížeči (iPhone i Android); ruční výběr ze seznamu, když sken nejde.
- Checklist podle šablony s velkými tlačítky, poznámkou u položky a fotkou z fotoaparátu (komprese před nahráním).
- Průběžné ukládání po každé položce, obnovení rozdělané revize po zavření stránky.
- Při výpadku spojení srozumitelná hláška a rozdělané odpovědi zůstanou v telefonu, dokud se neodešlou.
- Ochrana proti souběžné úpravě stejné kontroly dvěma techniky.
- Kontrola povinných položek, souhrn před dokončením, dokončení přepočítá termíny; neúspěšná kontrola termín nesplní.

**Hotovo, když:** technik na telefonu projde budovu, zkontroluje několik zařízení s fotkou, zavře a znovu otevře stránku bez ztráty dat a dokončí revizi.

**Od tebe:** vyzkoušet na vlastním telefonu (iPhone a/nebo Android).

**Stav (2026-10-13): hotovo, čeká na vyzkoušení na skutečném telefonu.**
- Nová aplikace **Revize** (na telefonu ve spodní liště; Mapa vazeb, Typy, Tým a Nastavení jsou pod „Více“).
- Revize se zahájí v budově, ze zařízení nebo ze seznamu revizí. V budově běží nejvýš jedna a další technik se k ní připojí.
- Přehled revize: přístup do budovy, počítadlo a pruh postupu, zařízení po lokacích v pořadí trasy se stavem (zbývá, rozpracováno, kdo právě kontroluje, vyhovuje, nevyhovuje).
- Skener: fotoaparát s rámečkem (nativní čtečka, jinak jsQR). Když fotoaparát nejde, „vyfotit štítek“ nebo zadat číslo.
- Kontrola zařízení podle verze šablony: velká tlačítka Vyhovuje/Nevyhovuje, číslo s desetinnou čárkou, text, poznámka u položky, fotky u položky i zařízení (zmenšené v telefonu). Opětovné klepnutí odpověď nezruší.
- Každá změna se uloží nejdřív do telefonu a hned odešle. Bez signálu je hláška a změny i fotky počkají v telefonu, dokud se neodešlou; přežijí i zavření stránky.
- Kontrolu drží jeden technik. Kolega vidí, kdo ji dělá, může ji převzít a původnímu se to oznámí.
- Dokončení: chybějící povinné odpovědi se ukážou. Souhrn (vyhovuje / nevyhovuje / nezkontrolováno) a rozpracované kontroly dokončení blokují.
- Dokončení zapíše nezkontrolovaná zařízení a vyhovujícím posune poslední revizi a termín. Nevyhovujícím termín nechá.
- Dokončená revize a každá kontrola jdou číst, ne měnit. Probíhající revize jsou i na přehledu.
- Ověřeno 8 novými testy proti databázi a 10 kroky na telefonu: sken z fotky, obnovení stránky, vypnutá síť, převzetí kolegou ve druhém prohlížeči, blokace nedokončenou kontrolou, dokončení s kontrolou dat.

**Fotoaparát v prohlížeči funguje jen přes HTTPS**, tedy po nasazení. Přes adresu počítače ve Wi-Fi (`http://192.168…`) půjde jen „vyfotit štítek“ a číslo.

## Část 8: Závady

**Cíl:** nalezené závady se sledují až do vyřešení.

- Automatické vytvoření z neúspěšné položky i ruční vytvoření.
- Závažnost (drobná, závažná, kritická), stav (otevřená, řeší se, vyřešená).
- Seznam s filtry, detail s popisem, fotkami, zařízením, budovou a historií změn.
- Uzavření s poznámkou o řešení.
- Doplnění závad do detailu zákazníka a zařízení.

**Hotovo, když:** z neúspěšné kontroly vznikne závada, lze ji dohledat, vyřešit a historie ukazuje, kdo co změnil.

**Stav (2026-10-13): hotovo.**
- Nová aplikace **Závady** (na telefonu ve spodní liště místo Zákazníků, ti jsou pod „Více“). Čísla závad `Z-0001` (anglicky `D-0001`) přiděluje databáze, nevracejí se.
- U nevyhovující položky se v telefonu hned volí závažnost. Položka, která závadu zakládá vždy (příznak v šabloně), nabídne drobnou, závažnou (předvolená) a kritickou. Ostatní nabídnou navíc „Nezapisovat“ (předvolené).
- Závady vzniknou při dokončení revize, ne už při odpovědi: technik může odpověď do dokončení opravit. Před dokončením souhrn řekne, kolik závad vznikne, a po dokončení to oznámí.
- Když na zařízení už je otevřená závada ze stejné položky, nová nevznikne. Opakované zjištění se připíše do její historie. Telefon to u položky řekne a otevřené závady zařízení ukáže nahoře.
- Ruční nahlášení: z detailu zařízení nebo podle čísla štítku, s popisem, závažností a fotkami z telefonu.
- Seznam: výchozí jsou neuzavřené závady. Filtry stav, závažnost, zákazník a budova, hledání v popisu i podle čísla štítku, řazení podle data nebo závažnosti.
- Detail: popis (lze upravit), fotky závady i fotky z revize, historie a poznámky, zařízení, budova, zákazník, revize.
  - Tlačítka Začít řešit, Vyřešit (poznámka o řešení je povinná) a Znovu otevřít.
  - Každá změna stavu, závažnosti a popisu i každá poznámka se zapíše s autorem a časem.
- Závady vidí i řeší každý člen firmy, technik i kancelář.
- Otevřené závady jsou na detailu zařízení, budovy a zákazníka a ve výsledku revize. Na přehledu je karta s počty podle závažnosti a rychlá akce „Nahlásit závadu“.
- Detail zařízení má nově i historii kontrol (dokončené revize s výsledkem a technikem). To byla nedodělaná P1 položka z části 7.
- Ověřeno:
  - 7 novými testy proti databázi: automatické vytvoření, žádné duplicity, závažnost jen u „nevyhovuje“, průběh stavů s historií, izolace mezi firmami, fotky.
  - 8 kroky ve dvou prohlížečích (telefon technika a počítač kanceláře).

## Část 9: Protokoly (PDF a e-mail)

**Cíl:** po revizi vznikne protokol, který jde poslat zákazníkovi a vytisknout.

- Automatické PDF po dokončení revize: logo a údaje firmy, zákazník, budova, datum, technik, číslo protokolu, tabulka zařízení s výsledky, závady, poznámky, patička.
- Číslování `ROK-NNNN` bez mezer a duplicit i při souběhu (s testem).
- Uložení do privátního úložiště, stažení přes podepsaný odkaz.
- Odeslání e-mailem zákazníkovi a záznam o odeslání.
- Čitelné při černobílém tisku, čeština a angličtina podle nastavení.
- Prázdné místo pro budoucí podpis zákazníka.

**Hotovo, když:** po dokončení revize lze protokol stáhnout, poslat e-mailem a vytisknout na černobílé tiskárně.

**Stav (2026-10-13): hotovo, odesílání e-mailem čeká na nastavení Resend.**
- Číslo protokolu `2026-0001` přidělí databáze přímo při dokončení revize, ve stejné transakci. Řada je po firmách a letech, bez mezer a bez duplicit ani při souběhu (ověřeno testem).
- PDF se vytvoří hned po dokončení. Technik ho má na telefonu nahoře ve výsledku revize: „Stáhnout PDF“, „Otevřít a vytisknout“, „Poslat e-mailem“.
- Obsah protokolu:
  - logo a údaje firmy, zákazník, budova, datum revize, kdo revizi provedl, datum vystavení;
  - souhrn a tabulka zařízení v pořadí trasy: štítek, typ, umístění, výrobní číslo, výsledek, příští revize; u nevyhovujících i položky, které nevyhověly;
  - měřené hodnoty a poznámky, zjištěné závady (i opakovaně zjištěné), poznámka k revizi;
  - místo pro podpis technika a zákazníka, patička firmy a číslo strany.
- Tisk: jen černá a šedá, výsledky slovy, nevyhovující tučně. Dlouhé revize pokračují na dalších stranách s opakovanou hlavičkou tabulky.
- Jazyk protokolu je výchozí jazyk firmy (Nastavení → Jazyk a čas), uložený u protokolu. Tím se opravilo i to, že pozvánky do týmu odcházely jazykem odesílatele místo jazyka firmy.
- PDF leží v samostatném soukromém úložišti `protocols`. Zapisuje do něj jen server, takže uložený protokol nikdo v aplikaci nepřepíše. Stahuje se přes odkaz platný 60 s, pod názvem `Protokol-2026-0001.pdf`.
- Když se PDF při dokončení nepovede, výsledek revize nabídne „Vytvořit protokol“. Revize dokončené před touto částí si protokol vytvoří stejně.
- E-mail: PDF v příloze, adresa zákazníka předvyplněná, jako odesílatel se ukáže jméno firmy a odpověď jde na e-mail firmy. Odeslání se zapíše (komu, kdy, kdo). Bez nastaveného Resend dialog řekne, že e-maily nejsou nastavené.
- Protokoly jsou i v seznamu revizí (sloupec Protokol) a v kartě „Protokoly“ na detailu budovy a zákazníka, se stažením.
- Ověřeno:
  - 6 novými testy proti databázi: číslování a jazyk, souběh tří dokončení, opakované vyžádání, zákaz zápisu, záznam odeslání, izolace firem;
  - 6 testy obsahu a vykreslení PDF (i vícestránkového), 5 testy e-mailu (příloha, odesílatel, ochrana hlavičky);
  - 7 kroky na telefonu a počítači, včetně stažení PDF a anglického protokolu.

**Od tebe:** nastavit Resend (doména sparxdeck.com) a poslat si zkušební protokol. Projít jeden protokol s revizním technikem: obsah a názvy (nevymýšlel jsem žádné předpisy ani právní formulace).

## Část 10: Přehled termínů a týdenní souhrn

**Cíl:** úvodní stránka ukazuje, co propadá, a firma o tom dostává e-mail.

- Počty zařízení podle stavu (v pořádku, brzy, po termínu, bez revize).
- Co propadá v příštích 30 / 60 / 90 dnech, zařízení po termínu, otevřené závady.
- Filtr podle zákazníka a budovy.
- Týdenní e-mail adminům se souhrnem blížících se termínů (plánovaná úloha).

**Hotovo, když:** přehled odpovídá termínům zařízení (testy na hranice) a týdenní e-mail dorazí.

**Stav (2026-10-13): hotovo, odesílání souhrnu čeká na Resend a nasazení.**
- Na přehledu je nová sekce „Termíny a závady“ s filtrem podle zákazníka a budovy. Filtr je v adrese a platí pro všechny tři karty:
  - **Co propadá** za 30, 60 nebo 90 dní: budovy, kde je něco po termínu nebo propadá. Řazené tak, že budovy s prošlým termínem jsou první, pak podle nejbližšího data. Počty otevřou seznam zařízení s odpovídajícím filtrem.
  - **Termíny revizí** (po termínu, brzy, v pořádku, bez revize).
  - **Otevřené závady** podle závažnosti.
- Seznam zařízení má ve filtru Termín navíc „Do 30/60/90 dní“.
- Hranice jsou otestované: termín dnes ještě „brzy“, včera „po termínu“, poslední den období ještě v něm, následující už ne. Sedí se stavy zařízení.
- Týdenní souhrn:
  - Každé pondělí v 5:00 UTC (7:00 letního, 6:00 zimního času) jde vlastníkovi a administrátorům e-mail: kolik je po termínu, co propadá v době „brzy“, budovy s nejbližšími termíny, zařízení bez revize a otevřené kritické a závažné závady. Píše se v jazyce firmy.
  - Když nic nehoří, e-mail nepřijde.
  - Týden se zapíše jen jednou: opakovaná nebo zdvojená úloha nepošle nic podruhé. Když odeslání selže, příští běh to zkusí znovu.
  - V Nastavení → Týdenní souhrn ho lze vypnout. Vidíte tam příjemce a náhled toho, co by tento týden dorazilo.
  - Úloha běží na adrese `/api/cron/weekly-summary`, chráněné klíčem `CRON_SECRET`. Plán je ve `vercel.json`.
- Ověřeno: 6 testy hranic přehledu, 5 testy obsahu souhrnu, 2 testy proti databázi a 6 kroky v prohlížeči (přehled, filtry, náhled, vypnutí, úloha s klíčem i bez něj).

**Od tebe:** při nasazení nastavit `CRON_SECRET` a Resend. Pak v pondělí ráno zkontrolovat, že souhrn dorazil.

## Část 11: Hledání, průvodce a export

**Cíl:** nová firma se rychle zorientuje a nic nehledá dlouho.

- Globální hledání: zákazník, budova, zařízení podle čísla štítku.
- Průvodce po registraci: firma, první zákazník, první budova, první zařízení, první štítek.
- Ukázková data, která jdou jedním tlačítkem smazat.
- Export zařízení a revizí do CSV.

**Hotovo, když:** nová firma projde průvodce a do pár minut má vytištěný první štítek.

**Stav (2026-10-13): hotovo.**
- **Hledání odkudkoli:**
  - Lupa v levé liště, na telefonu v horní liště. Na počítači ho otevře i Ctrl+K nebo „/“.
  - Najde zákazníky (název, IČO, e-mail, kontakt), budovy (název, adresa) a zařízení (číslo štítku „12“, výrobní číslo). Najde i závady („Z-12“ nebo text popisu) a protokoly („2026-0001“).
  - Ovládá se šipkami a Enterem. Výsledky jsou jen z vlastní firmy.
- **Průvodce „Začínáme“** na přehledu (vlastník a administrátor):
  - kroky údaje firmy a logo → první zákazník → budova → zařízení → tisk štítků;
  - každý krok má tlačítko přímo na správný formulář, odškrtne se sám, když je hotový (tisk štítků se zapíše), a průvodce jde skrýt.
- **Ukázková data jedním tlačítkem:**
  - Zákazník „Ukázka – Bytové družstvo Lipová“ se dvěma budovami a lokacemi, 9 zařízeními s různými termíny (po termínu, brzy, v pořádku, bez revize, vyřazené) a otevřenou závadou. Je označený štítkem „Ukázka“.
  - Smazání odstraní i všechno, co s ním uživatel zkoušel: revize, protokoly (i PDF), závady a fotky.
  - Ukázka má vlastní čísla od 900001 (štítky, závady i protokoly), takže nespotřebuje ani nepřeskočí žádné skutečné číslo. První skutečný štítek je vždy 0001.
  - Příznak ukázky nejde nastavit ani změnit z aplikace, aby se smazáním nikdy nepřišlo o skutečného zákazníka.
- **Export do CSV:**
  - Zařízení se exportují přesně podle aktuálního hledání, filtrů a řazení seznamu. Revize se exportují po kontrolách, s číslem protokolu, výsledkem, technikem a nevyhovujícími položkami.
  - Soubor se otevře v Excelu se správnou diakritikou a sloupci (středník v češtině, čárka v angličtině) a buňky nejdou spustit jako vzorce.
- Ověřeno:
  - 4 testy čtení hledaného výrazu a 5 testů CSV;
  - 4 nové testy proti databázi: práva, ochrana příznaku ukázky, smazání ukázky i s revizí a protokolem, číslování;
  - 8 kroků v prohlížeči: celý průvodce až po vytištěný štítek 0001, hledání klávesnicí i na telefonu, export a smazání ukázky.

## Část 12: Kvalita a spuštění

**Cíl:** aplikace běží na veřejné adrese a je připravená pro první zákazníky.

- PWA: instalace na plochu, ikony, manifest.
- Bezpečné hlavičky (CSP aj.), kontrola ochrany proti XSS a CSRF.
- Sledování chyb (Sentry), zdravotní kontrola (už existuje `/api/health`).
- Automatický test celého hlavního toku: přihlášení, zákazník, budova, zařízení, revize, protokol.
- Oddělené testovací a produkční prostředí (Vercel + dva projekty Supabase), kontrolované spouštění migrací.
- Zálohy databáze a vyzkoušené obnovení.
- Závěrečná kontrola: kompletní čeština a angličtina, formáty data a čísel, přístupnost, Safari a Chrome na telefonu.
- Spočítání odškrtnutých položek P1, P2 a P3.

**Hotovo, když:** aplikace běží na app.sparxdeck.com a automatický test hlavního toku projde.

**Stav (2026-10-15): všechno v kódu je hotové a ověřené, spuštění čeká na účty.** Postup je v [DEPLOY.md](DEPLOY.md).
- **PWA:** aplikace jde nainstalovat na plochu telefonu i počítače.
  - Manifest s ikonami z loga (včetně „maskable“ pro Android a ikony pro iPhone) a tmavou lištou.
  - Dlouhý stisk ikony nabídne „Zahájit revizi“ a „Nahlásit závadu“.
- **Bezpečnost:**
  - Přísná CSP s jednorázovým klíčem (nonce) na každý požadavek: skripty běží jen naše, spojení jen se Supabase, cizí web aplikaci nevloží do rámu.
  - Dále HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy (kamera jen pro náš web), nosniff.
  - Testy pravidel jsou v `tests/security-headers.test.ts`. Celý e2e řetězec hlídá i porušení CSP.
  - Historie gitu je bez tajemství.
- **Chyby:**
  - Vlastní chybová stránka uvnitř aplikace („Zkusit znovu“, kód chyby pro podporu) a záchranná stránka pro nejhorší případ.
  - Sentry je zapojené (EU, bez osobních údajů, přes vlastní adresu `/monitoring`) a zapne se doplněním DSN.
- **Zdravotní kontrola:** `/api/health` ověřuje i spojení s databází (při výpadku vrací 503), takže je vhodná pro hlídání dostupnosti.
- **Test hlavního toku:** Playwright (`npm run test:flow`), na telefonu i počítači.
  - Prochází přihlášení → firma → zákazník → budova → zařízení → kontrola → protokol a stažení PDF.
  - V GitHub Actions běží lint, typy, testy a build na každé změně; test hlavního toku po zapnutí.
- **Prostředí:**
  - Vývoj a produkce jsou oddělené.
  - `npm run db:push:production` nahrává migrace do produkce jen po opsání reference projektu, s volbou `--dry-run`.
  - PDF písmo se přibalí ke všem trasám (protokoly se vykreslují i v serverových akcích).
- **Zálohy:**
  - Databázi zálohuje Supabase Pro.
  - Soubory (loga, fotky, protokoly) zálohuje a obnovuje dvojice skriptů, vyzkoušená na vývoji.
  - Postup čtvrtletní zkoušky obnovení je v DEPLOY.md.
- **Přístupnost:**
  - Audit axe-core (WCAG 2.1 A a AA) na 26 pohledech včetně telefonu a tmavého režimu je bez vážných nálezů.
  - Opravil se kontrast šesti barev, doplnily se dva chybějící popisky a odkaz uprostřed textu je podtržený.
  - Na telefonu měří i dotykové plochy: všechny ovládací prvky mají aspoň 44 px.
- **TypeScript:** odstraněné zastaralé `baseUrl` v obou aplikacích (aliasy `@/*` fungují dál).
- **Odškrtnuto v checklistu:** P1 104 ze 118, P2 3 z 83, P3 0 ze 41.
  - Zbylých 14 položek P1 čeká jen na e-maily (Resend), nasazení, zálohy v produkci, Sentry DSN a test na skutečném iPhonu.

**Od tebe:** účet Vercel a doména; rozhodnutí o placeném plánu Supabase (bezplatný plán nemá automatické zálohy).

---

## Fáze 2: po MVP (části 13–26)

**Stav na začátku (2026-10-16):** P1 104 ze 118, P2 3 z 83, P3 0 ze 41. Zbylých 14 položek P1 je hotových v kódu a čeká na doménu, e-maily (Resend), placené plány a zkoušku na skutečném telefonu. To se udělá před prvním zákazníkem (viz DEPLOY.md), nezávisle na částech níže.

Pořadí je podle hodnoty pro první firmy. Platí stejná pravidla jako u částí 1–12: vždy jen jedna část, na další se jde po „jdeme na další“. Položky označené ✉ potřebují doménu a e-maily, ty se dodělají, až budou.

| # | Část | Hlavní položky checklistu | Od tebe |
|---|---|---|---|
| 13 | Půdorysy budov | D: půdorys patra (P2), zařízení na půdorysu (P3) | ukázkový plán (obrázek nebo PDF), který firmy běžně dostávají |
| 14 | Import z Excelu | R: import zákazníků, budov a zařízení; F: import zařízení | vzorový Excel od servisní firmy, pokud nějaký seženeš |
| 15 | Revize v terénu 2 | H: nepřístupné/nenalezeno s důvodem, nové zařízení během revize, zrušení rozdělané revize, oprava dokončené revize se záznamem, diktování; I: nabídka uzavření závady po úspěšné kontrole | nic |
| 16 | Offline naplno | M: stažení budovy předem, kontrola bez signálu od začátku, konflikty, smazání dat po odhlášení, testy výpadku | nic |
| 17 | Zařízení a šablony 2 | E: vlastní typy, vlastní údaje podle typu, kopie šablony, výběr z možností, povinná fotka; F: fotky zařízení, rok výroby a konec životnosti, přesun s historií, hromadné úpravy | položky šablon pro další typy jen od revizního technika |
| 18 | Protokol 2 a podpis | N: podpis zákazníka prstem, jméno a čas; J: fotky závad v protokolu, nová verze po opravě, souhrnný protokol; Q: formát číslování | ověřit s technikem, co má podpis v protokolu obsahovat |
| 19 | Plánování a závady 2 | K: kalendář revizí, vytížení techniků; I: přiřazení závady člověku, termín odstranění | nic |
| 20 | Tým a přihlášení 2 | B: technik vidí jen své zákazníky, jedna osoba ve více firmách; A: Google, dvoufázové ověření, aktivní zařízení a odhlášení všude | účet Google Cloud pro přihlášení přes Google |
| 21 | Zákazníci a budovy 2 | C: více kontaktů, štítky, slučování duplicit; D: mapa a navigace; S: koš a obnovení smazaného | nic |
| 22 | Upozornění a e-maily 2 ✉ | L: připomínky zákazníkům, nastavení upozornění, šablony e-mailů; J+Q: vlastní text a více příjemců | doména a Resend |
| 23 | Portál pro správce budov ✉ | O: přístup jen ke svým budovám, stav zařízení, protokoly, pozvání | doména a Resend |
| 24 | Provoz, bezpečnost a GDPR | V: záznam změn (audit log), omezení požadavků, export a výmaz osobních údajů; R: úplný export firmy; W: přehled firem pro provozovatele, pozastavení účtu, vstup podpory se záznamem; Y: hlídání dostupnosti | zpracovatelská smlouva a texty od právníka |
| 25 | Předplatné a platby | P: zkušební doba, plány a limity, platba kartou, faktury, neúspěšné platby, zrušení | cena, plány, účet u platební brány (např. Stripe), fakturační údaje |
| 26 | Nápověda a zpětná vazba | X: nápověda a návody, kontakt na podporu, zpětná vazba v aplikaci | kontaktní e-mail podpory, případně videa |

**P2 hotové v kódu, odškrtnou se po ověření** (v rámci nejbližší části, která se jich týká):
- Přihlášení odkazem v e-mailu (část 1) ✉.
- Ruční zadání čísla štítku při revizi (část 7).
- Fronta změn a fotek v telefonu a hláška „bez spojení, N změn čeká“ (část 7), základ části 16.
- Export seznamu termínů do CSV: export zařízení s filtrem termínu (části 10 a 11).
- Stránkování všech seznamů a indexy na časté dotazy (části 3–11).
- Tmavý režim a kontrast WCAG AA (část 12), spodní lišta na telefonu (část 8), rychlé akce na úvodní stránce (část 10).

**Později (P3):** vlastní role, NFC a termotiskárny, kalendář ICS, statistiky, SMS a push, elektronický podpis s razítkem, další země a jazyky (arménština, gruzínština, arabština), API a napojení na účetnictví, nativní aplikace. Až podle zpětné vazby.

**Záměrně se nestaví** (z CHECKLIST.md): vlastní fakturace a účetnictví, tvrzení o souladu s předpisy, umělá inteligence, další typy zařízení před ověřením u zákazníků, vymyšlené recenze a čísla.

### Část 13: Půdorysy budov

**Cíl:** technik i kancelář vidí, kde v budově zařízení je. Na telefonu během revize ukáže plán, co je zkontrolované a co zbývá.

- Půdorys je obrázek patra nahraný k budově (JPEG, PNG, WebP; PDF plán se převede na obrázek v prohlížeči). Patro má název a pořadí, volitelně vazbu na lokaci.
- Zařízení se na plán umístí tažením značky. Poloha je v poměru k obrázku, takže sedí při jakékoli velikosti obrazovky.
- Značky mají ikonu typu a barvu podle termínu (po termínu, brzy, v pořádku). Klik otevře zařízení.
- Na telefonu přiblížení a posun prsty. Během revize jsou na plánu vidět zkontrolovaná a zbývající zařízení a klik na značku otevře kontrolu.
- Plán s umístěním jde vytisknout nebo stáhnout jako PDF, např. pro správce budovy.
- Soubory v soukromém úložišti pod `<organization_id>/`, ověření typu z obsahu, RLS a test izolace.

**Hotovo, když:** nahraju plán patra, rozmístím na něj zařízení z budovy, na telefonu během revize vidím na plánu, co zbývá, a cizí firma plán nevidí.

**Stav (2026-10-16): hotovo** (zatím jen lokálně, nenasazeno).

- **Nahrání:**
  - Obrázek (JPG, PNG, WebP, i fotka z telefonu) nebo PDF, u vícestránkového PDF s výběrem strany a náhledem.
  - Prohlížeč plán vykreslí (pdf.js, vektorové plány ostře), zmenší na 4096 px a uloží jako WebP pod 2 MB. Server ověří typ i rozměry z obsahu.
  - Název se doplní z patra nebo ze souboru. Plán jde přejmenovat, přiřadit k patru, seřadit, vyměnit mu obrázek (zařízení zůstanou na místě) a smazat i se souborem.
- **Prohlížeč plánu:**
  - Posun tažením, přiblížení kolečkem, dvojklikem a dvěma prsty, klávesnice (+, −, 0, šipky).
  - Značky mají na obrazovce stálou velikost a na dotykovém displeji plochu 44 px. Barva podle termínu: po termínu, brzy, v pořádku, bez revize.
- **Rozmístění** (vlastník a administrátor):
  - Zařízení se vybere v panelu a klepne se na plán. Zařízení z patra plánu jsou v panelu nahoře.
  - Přesun tažením nebo šipkami (Shift = větší krok), přesun na jiný plán budovy, odebrání z plánu.
  - Změny se ukážou hned a ukládají se na pozadí. Technik plány jen prohlíží.
- **Napojení:**
  - Položka Půdorysy v levé liště (na telefonu pod Více): všechny plány firmy po budovách, s hledáním podle plánu, budovy i zákazníka.
  - Karta Půdorysy na budově.
  - Umístění na detailu zařízení (malý plán, nebo odkazy „Umístit“).
  - V revizi přepínač Seznam / Půdorys: barvy podle stavu kontroly, klepnutí na značku otevře kontrolu, volba se pamatuje v telefonu.
- **PDF:** plán se značkami a legendou (A4 na šířku nebo na výšku podle plánu) a tabulka zařízení.
- **Ukázková data:** budova Lipová 12 má plány přízemí a 1. patra s rozmístěnými zařízeními. Smazání ukázky smaže i jejich soubory.
- **Zabezpečení:** RLS a 8 testů izolace v `tests/rls.test.ts`.
  - Cizí firma nic nevidí a nezmění.
  - Zařízení a plán musí být ze stejné budovy.
  - Obrázek musí být ve složce firmy.
  - Budovu plánu ani autora nejde změnit.
- **Ověření:**
  - E2E `e2e/part13.mjs`: 15 kroků na počítači i telefonu, technik, cizí firma, tmavý režim a angličtina.
  - 13 jednotkových testů výpočtů (`tests/floor-plans.test.ts`).
- **Opraveno při tom:**
  - Produkční klíče jsou v `.env.prod.local`. Next.js totiž `.env.production.local` načítá i při lokálním buildu.
  - Ukázková data vybírala budovu podle času založení, který je u obou stejný.

**Od tebe:** vyzkoušet nahrání skutečného plánu (PDF nebo fotky výkresu) a rozmístění na počítači i na telefonu.

---

## Hotové navíc (P2, mimo plán)

- Přihlášení odkazem v e-mailu (magic link) je hotové v kódu v rámci části 1. Odškrtne se po ověření.
