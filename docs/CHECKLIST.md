# SparxDeck: seznam funkcí (checklist)

Tento soubor je kompletní seznam toho, co má platforma umět. Slouží jako kontrolní seznam: po dokončení každé položky ji odškrtni (`[x]`) a napiš, ve kterém souboru nebo commitu je hotová. Nic neodškrtávej, dokud to nefunguje a není otestováno.

**Doplňuje:** [CLAUDE.md](../CLAUDE.md) (o čem produkt je), [SPEC.md](SPEC.md) (fáze a datový model) a [ROADMAP.md](ROADMAP.md) (pořadí částí). Seznam je záměrně nezávislý na technologii (Supabase nebo Firebase).

## Jak číst priority

- **P1** = nutné pro první použitelnou verzi (MVP). Bez toho se produkt nedá nasadit u zákazníka.
- **P2** = přijde, jakmile první firmy produkt skutečně používají a řeknou, co chybí.
- **P3** = později, růst, další země a trhy.

**Pravidlo:** dělej P1 celé a řádně, než začneš na P2. Perfektní je produkt, který spolehlivě dělá málo, ne ten, který dělá všechno napůl. Pokud si nejsi jistý, zda je něco P1, zeptej se.

Stav pokrytí na konci: spočítej odškrtnuté P1, P2 a P3 zvlášť a řekni mi to.

---

## A. Účty a přihlášení

- [ ] P1 Registrace e-mailem a heslem
- [ ] P1 Potvrzení e-mailové adresy
- [x] P1 Přihlášení, odhlášení (část 1: `src/app/(auth)/login`, `src/app/(auth)/actions.ts`; ověřeno průchodem v prohlížeči)
- [ ] P1 Obnovení zapomenutého hesla
- [ ] P1 Změna hesla a e-mailu v profilu
- [x] P1 Silná pravidla hesla (minimální délka, kontrola proti běžným heslům) (část 1: `src/lib/password`, `src/lib/validation.ts`; testy `tests/unit.test.ts`)
- [x] P1 Ochrana proti hádání hesel (omezení počtu pokusů) (část 1: limit Supabase Auth (po 31 pokusech za 5 min z jedné IP odmítnuto), přihlášení z prohlížeče kvůli limitu na IP uživatele)
- [ ] P2 Přihlášení odkazem na e-mail (magic link)
- [ ] P2 Přihlášení přes Google
- [ ] P2 Dvoufázové ověření (TOTP) pro admin a owner
- [ ] P2 Seznam aktivních zařízení a odhlášení všude
- [ ] P3 Přihlášení přes Microsoft / SSO pro větší firmy

## B. Organizace, role a členové

- [x] P1 Vytvoření organizace při první registraci (část 1: `supabase/migrations/20261011090000_phase1_organizations.sql` (`create_organization`), `src/app/(auth)/onboarding`)
- [x] P1 Role: owner, admin, technician (oprávnění podle SPEC.md) (část 1: `has_role` v migraci, testy `tests/rls.test.ts`)
- [ ] P1 Pozvání člena e-mailem (odkaz s omezenou platností)
- [ ] P1 Přijetí pozvánky a nastavení hesla
- [x] P1 Změna role člena, odebrání člena (část 1: `supabase/migrations/20261011120000_member_management.sql`, `src/app/(app)/team`)
- [x] P1 Owner nemůže být odebrán, dokud není určen nástupce (část 1: `transfer_ownership` + unikátní index jednoho vlastníka; testy `tests/rls.test.ts`)
- [x] P1 Úplná izolace dat mezi organizacemi (a automatický test, který to dokazuje) (část 1: RLS v migracích, `tests/rls.test.ts` proti databázi)
- [ ] P2 Přidělení techniků ke konkrétním zákazníkům nebo budovám (technik vidí jen své)
- [ ] P2 Jedna osoba ve více organizacích a přepínač organizace
- [ ] P3 Vlastní role a jemná oprávnění

## C. Zákazníci

- [x] P1 Seznam zákazníků (řazení, stránkování) (část 3: `src/app/(app)/customers/page.tsx`, 20 na stránku, řazení podle názvu nebo nejnovější)
- [x] P1 Vyhledávání podle jména, kontaktu, IČO (část 3: `src/components/app/search-input.tsx`, `src/lib/search.ts`; hledání je v adrese, odolné proti speciálním znakům, test v `tests/rls.test.ts`)
- [x] P1 Vytvoření, úprava, měkké smazání zákazníka (část 3: `supabase/migrations/20261011180000_customers_sites.sql`, `src/app/(app)/customers/actions.ts`; tvrdé smazání databáze nepovolí)
- [x] P1 Detail zákazníka: kontakty, budovy, zařízení, poslední revize, otevřené závady (`src/app/(app)/customers/[id]/page.tsx`: kontakty a budovy s počtem zařízení od části 3, otevřené závady od části 8, poslední revize s protokoly od části 9)
- [x] P1 Poznámky ke klientovi (část 3: pole Poznámky ve formuláři a na detailu zákazníka)
- [ ] P2 Více kontaktních osob u jednoho zákazníka
- [ ] P2 Štítky (tagy) pro třídění zákazníků
- [ ] P2 Slučování duplicitních zákazníků
- [ ] P3 Napojení na účetní systém (údaje o zákazníkovi)
- [ ] P3 Doplnění údajů podle IČO z veřejného rejstříku

## D. Budovy a lokace

- [x] P1 Seznam a detail budov (provozoven) u zákazníka (část 3: budovy na detailu zákazníka, `src/app/(app)/sites/[id]/page.tsx`)
- [x] P1 Vytvoření, úprava, měkké smazání budovy (část 3: `src/app/(app)/sites/actions.ts`; smazání zákazníka skryje i jeho budovy a pod smazaného zákazníka nejde budovu přidat)
- [x] P1 Adresa budovy a poznámky k přístupu (klíče, vrátnice, kontakt) (část 3: přístup je na stránce budovy nahoře a zvýrazněný)
- [x] P1 Lokace v budově (patro, místnost, chodba) se seřazením (část 3: `src/app/(app)/sites/[id]/locations.tsx`, přidání, přejmenování, posun nahoru/dolů, smazání s potvrzením; pořadí ukládá funkce `reorder_locations` najednou)
- [ ] P2 Mapa a odkaz do navigace na adresu budovy
- [x] P2 Nahrání půdorysu patra jako obrázku (část 13: obrázek nebo PDF s výběrem strany, převod a zmenšení v prohlížeči, kontrola obsahu na serveru; karta Půdorysy na budově, pořadí, přejmenování, výměna obrázku, smazání; PDF plánu ke stažení; ukázková data mají dva plány)
- [x] P3 Umístění zařízení na půdorysu (značky na plánku) (část 13: umístění klepnutím, přesun tažením i šipkami, přesun na jiný plán, barvy podle termínu; plán na detailu zařízení a v revizi na telefonu podle stavu kontroly)
- [ ] P3 Souřadnice GPS u budovy a zařízení

## E. Typy zařízení a šablony kontrol

- [x] P1 Typ zařízení "Hasicí přístroj" s výchozím intervalem revize (upravitelná hodnota, ne pevná v kódu) (část 4: `supabase/migrations/20261011210000_device_types_templates.sql`, každá firma dostane vlastní upravitelnou kopii; `src/app/(app)/device-types`)
- [x] P1 Šablona kontroly pro hasicí přístroj (ukázková sada položek, označit jako vzorovou k ověření) (část 4: 7 zástupných položek ze SPEC.md, v UI označené "Vzorová, ověřit" do potvrzení revizním technikem)
- [x] P1 Typy položek: ano/ne, číslo, text (část 4: enum `checklist_item_type`, editor v `template-editor.tsx`)
- [x] P1 Povinné položky (část 4)
- [x] P1 Položka, jejíž nesplnění automaticky vytvoří závadu (část 4: příznak `fail_creates_defect`, jen u ano/ne, hlídá databáze; závadu z něj vytváří dokončení revize od části 8)
- [x] P1 Verzování šablon (nová úprava vytvoří novou verzi, staré revize zůstávají vázané na původní) (část 4: funkce `save_checklist_template`, starší verze zůstávají beze změny a jdou zobrazit; beze změn nová verze nevznikne)
- [x] P1 Správa šablon jen pro admin a owner (část 4: RLS a práva sloupců, testy v `tests/rls.test.ts`)
- [x] P2 Vlastní typy zařízení (firma si přidá další) (část 17: `/device-types/new`, stejná práva jako u zákazníků a budov — RLS, ne funkce; technický kód se odvodí z názvu)
- [x] P2 Vlastní atributy podle typu (např. velikost, hasivo, rok výroby) (část 17: `device_types.custom_fields` — pole {klíč, název}, až 8 na typ; klíč se odvodí z názvu při založení a pak už se nemění, aby úprava názvu neztratila uložené hodnoty; `devices.attributes` zůstává stejné jako v části 5, jen podle typu místo pevného seznamu. Dovezené sloupce v CSV importu zatím jen hasivo a velikost, další vlastní pole se doplní ručně po importu)
- [ ] P2 Šablony pro hydranty, nouzové osvětlení, požární klapky a dveře
- [ ] P2 Duplikování a úprava šablony
- [ ] P2 Výběr možností (rozbalovací seznam) jako typ položky
- [x] P2 Foto jako povinná odpověď u vybraných položek (část 17, doplněno 2026-10-24: zaškrtávátko „Povinná fotka“ u položky v editoru šablony, nová verze šablony; kontrolu nejde dokončit, dokud položka nemá fotku (online i odeslanou z telefonu, hlídá `check_answers_complete`), telefon to řekne předem a ukáže, u které položky; „Nelze zkontrolovat“ fotku nepotřebuje; migrace `20261024110000_photo_required.sql`, testy `tests/rls.test.ts`, `tests/inspections.test.ts`, `e2e/part17.mjs`)
- [ ] P3 Knihovna šablon podle země a předpisů
- [ ] P3 Výpočty a podmínky (zobrazit položku jen když…)

## F. Zařízení

- [x] P1 Seznam zařízení s filtry (zákazník, budova, lokace, typ, stav, termín) (část 5: `src/app/(app)/devices/page.tsx`, filtry v adrese `device-filters.tsx`; filtr typu se ukáže, jakmile má firma víc typů)
- [x] P1 Vyhledávání podle čísla štítku, sériového čísla (část 5: „7“, „0007“ i „#7“ najde štítek 0007; výrobní číslo, výrobce, model)
- [x] P1 Vytvoření, úprava, měkké smazání zařízení (část 5: `src/app/(app)/devices/actions.ts`; smazání budovy nebo zákazníka skryje i zařízení, do smazané budovy nejde přidávat)
- [x] P1 Detail zařízení: údaje, QR, historie kontrol, závady, další termín (`src/app/(app)/devices/[id]`: údaje a termín v části 5, QR v části 6, historie kontrol a otevřené závady v části 8)
- [x] P1 Stav zařízení: aktivní, vyřazené z provozu, odstraněné (část 5: vyřazené a odstraněné se v termínech nehlídají)
- [x] P1 Automatické číslování štítků v rámci organizace (část 5: trigger s čítačem `organization_counters`, bez duplicit i při souběžném přidávání, číslo se po smazání znovu nepoužije; test v `tests/rls.test.ts`)
- [x] P1 Hromadné přidání více zařízení najednou (část 5: až 100 najednou se společnými údaji a volitelnými výrobními čísly, štítky jdou za sebou; `src/app/(app)/devices/bulk`)
- [x] P1 Výpočet stavu termínu: v pořádku, brzy, po termínu, bez revize (část 5: `src/lib/due.ts`, příští termín počítá databáze stejně jako aplikace, „dnes“ podle časového pásma firmy; testy `tests/due.test.ts`)
- [x] P2 Import zařízení z CSV s kontrolou chyb po řádcích (část 14: Excel i CSV, chyby a upozornění po řádcích v náhledu)
- [x] P2 Přesun zařízení do jiné budovy nebo lokace s historií (část 17, doplněno 2026-10-24: tlačítko Přesunout na stránce zařízení, funkce `move_device` jen pro vlastníka a administrátora; historie `device_moves` zapisuje každou změnu budovy i lokace (přesun, úprava, hromadná úprava, smazaná lokace) s autorem, časem, poznámkou a názvy lokací v době změny; přesun zruší umístění na půdorysu staré budovy, nejde během rozpracované kontroly zařízení ani mezi ukázkovými a skutečnými daty; migrace `20261024090000_device_moves.sql`, testy `tests/rls.test.ts`, `e2e/part17.mjs`)
- [x] P2 Hromadné úpravy (změna lokace, stavu u vybraných) (část 17: zaškrtávátka v seznamu zařízení, lišta s úpravou se zobrazí po výběru; lokaci jde měnit jen když je seznam filtrovaný na jednu budovu, stav vždy; `bulkUpdateDevices`)
- [x] P2 Fotografie zařízení (část 17: `device_photos`, `<org>/devices/<id>/…` v `org-assets`; přidat smí každý člen, podle vzoru fotek u závad a revizí; `add_device_photo`, `delete_device_photo`)
- [x] P2 Datum výroby a konce životnosti, upozornění na výměnu (rok výroby už od části 5; konec životnosti část 17: `devices.end_of_life_on`, upozornění stejným pravidlem jako u termínu revize — `dueState()`, barva a hláška na stránce zařízení)
- [ ] P3 Dokumenty u zařízení (návod, certifikát)
- [ ] P3 Servisní zásahy a opravy mimo revizi (výměna náplně, tlaková zkouška)

## G. QR štítky

- [x] P1 Každé zařízení má náhodný, neuhádnutelný veřejný token (část 5 a 6: 12 znaků base32 = 60 bitů náhody z `gen_random_bytes`, unikátní, klient ho nezmění; testy v `tests/rls.test.ts`)
- [x] P1 QR kód obsahuje jen odkaz s tokenem, žádné osobní údaje (část 6: `src/lib/qr.ts`, odkaz `/d/<token>`; test čte QR zpět dekodérem)
- [x] P1 Odkaz po naskenování otevře správné zařízení (po přihlášení) (část 6: `src/app/(app)/d/[token]`; e2e přečte QR ze snímku obrazovky a projde přihlášením zpět k zařízení)
- [x] P1 Cizí organizace vidí neutrální "nenalezeno" (část 6: stejná stránka pro cizí, neexistující i smazaný štítek; e2e porovná odpovědi)
- [x] P1 Tisk štítků do PDF: mřížka, QR, číslo, název budovy (část 6: `src/lib/pdf/labels.tsx`, vektorové PDF s vloženým písmem, název firmy dole)
- [x] P1 Výběr zařízení, které se mají tisknout, a počet kopií (část 6: `src/app/(app)/devices/labels`, i začátek na načatém archu a náhled)
- [x] P2 Více velikostí a rozložení štítků (podle běžných archů) (část 6: 6 běžných formátů A4 a vlastní rozměr; poslední volba se pamatuje)
- [ ] P2 Logo firmy na štítku
- [x] P2 Opětovné vygenerování štítku bez změny čísla (část 6: štítek jde kdykoli vytisknout znovu, číslo i odkaz zůstávají)
- [ ] P2 Neskenovatelný štítek: ruční zadání čísla štítku
- [ ] P3 Podpora NFC štítků jako doplněk
- [ ] P3 Tisk na termotiskárny štítků

## H. Skener a provádění kontroly

- [x] P1 Zahájení revize v budově (část 7: z budovy, ze zařízení i z Revizí; v budově běží nejvýš jedna revize a další technik se k ní připojí)
- [x] P1 Přehled revize: seznam zařízení, zkontrolováno / zbývá, počítadlo (část 7: `src/app/(app)/inspections/[id]`, po lokacích v pořadí trasy, záložky Zbývá/Hotovo/Vše)
- [ ] P1 Skener QR kamerou (funguje na iPhonu i Androidu v prohlížeči) (část 7: hotové, nativní BarcodeDetector a jinak jsQR, k tomu „vyfotit štítek“ a ruční číslo; čeká na vyzkoušení na skutečném telefonu přes HTTPS)
- [x] P1 Po naskenování otevření checklistu podle šablony (část 7: e2e přečte QR z fotky štítku a otevře kontrolu)
- [x] P1 Velká tlačítka pro dotykové ovládání (část 7: Vyhovuje/Nevyhovuje 48 px, ostatní prvky 44 px na dotykových displejích)
- [x] P1 Poznámka u každé položky (část 7)
- [x] P1 Foto z fotoaparátu u položky nebo závady, komprese před nahráním (část 7: u položky i celého zařízení, zmenšení na 1600 px JPEG v telefonu; část 8: u závady při nahlášení i v detailu)
- [x] P1 Průběžné ukládání po každé položce (část 7: každá změna nejdřív do telefonu, pak hned na server)
- [x] P1 Ruční výběr zařízení ze seznamu, když nejde naskenovat (část 7)
- [x] P1 Kontrola povinných položek před dokončením (část 7: ukáže chybějící položky; hlídá i databáze)
- [x] P1 Souhrn před dokončením (v pořádku, se závadou, nezkontrolováno) (část 7: `src/app/(app)/inspections/[id]/complete`)
- [x] P1 Dokončení revize přepočítá poslední a příští termín zařízení (část 7: funkce `complete_inspection`, datum kontroly v časovém pásmu firmy; testy proti databázi a e2e)
- [x] P1 Neúspěšná kontrola nenastaví termín jako splněný a vytvoří závadu (část 7: termín se nemění; část 8: závada vznikne při dokončení revize, `complete_inspection`, ověřeno v `tests/rls.test.ts` a `e2e/part8.mjs`)
- [x] P1 Ochrana proti souběžné úpravě stejné kontroly dvěma techniky (část 7: kontrolu drží jeden technik, kolega vidí kdo a může ji převzít, první se to dozví; testy a e2e se dvěma prohlížeči)
- [x] P1 Obnovení rozdělané revize po zavření stránky (část 7: odpovědi v localStorage, fotky v IndexedDB, odešlou se po návratu)
- [x] P2 Označení zařízení "nepřístupné" nebo "nenalezeno" s důvodem (část 15: „Nelze zkontrolovat“ s důvodem a poznámkou, `skip_device_check`; termín se neposune, odpovědi nevytvoří závadu, v protokolu a výsledku revize s důvodem; když se zařízení přece jen zkontroluje, označení se zruší)
- [x] P2 Přidání nového zařízení přímo během revize (naskenování dosud nezaevidovaného štítku) (část 15: „Přidat zařízení“ v revizi i pro technika, `add_inspection_device`; dostane číslo štítku a hned se kontroluje, stejné výrobní číslo v budově odmítne; štítky se tisknou až k založenému zařízení, proto výsledek revize nabídne tisk štítků přidaných zařízení)
- [x] P2 Úprava dokončené revize se záznamem změny (část 18: vlastník nebo administrátor ji otevře k opravě s povinným důvodem, `reopen_inspection`, historie v `inspection_reopenings` (kdo, kdy, proč, kdo opravu dokončil); oprava vrátí termíny, které revize posunula, a nové dokončení je počítá z původní kontroly; datum revize a technik zůstávají původní; během opravy nejde začít novou revizi ani opravu zrušit; vznikne nová verze protokolu)
- [x] P2 Zrušení rozdělané revize (část 15: `cancel_inspection` smí ten, kdo revizi zahájil, vlastník a administrátor; smaže kontroly, odpovědi a fotky, zařízení zůstanou)
- [x] P2 Hlasová diktovačka poznámek (využít funkci telefonu) (část 15: poznámky mají velké písmeno na začátku věty a na dotykovém telefonu nápovědu k mikrofonu na klávesnici; vlastní rozpoznávání řeči záměrně ne, klávesnice telefonu to umí spolehlivěji a česky)
- [ ] P3 Svítilna a ovládání přiblížení u skeneru
- [ ] P3 Opakované kontroly podle plánu (technik dostane úkol na dnes)

## I. Závady

- [x] P1 Automatické vytvoření závady z neúspěšné položky (část 8: při dokončení revize z položek s `fail_creates_defect` nebo se zvolenou závažností; opakované zjištění se připíše k otevřené závadě téže položky místo duplicity; `supabase/migrations/20261014090000_defects.sql`, `20261014100000_defects_repeated.sql`)
- [x] P1 Ruční vytvoření závady (část 8: `/defects/new` podle čísla štítku nebo z detailu zařízení, s fotkami)
- [x] P1 Závažnost: drobná, závažná, kritická (část 8: volba už u nevyhovující položky v telefonu, změna v detailu se zapíše do historie)
- [x] P1 Stav: otevřená, řeší se, vyřešená (část 8: `change_defect_status`, každá změna v historii)
- [x] P1 Detail závady: popis, fotky, zařízení, budova, historie (část 8: `src/app/(app)/defects/[id]`, i fotky z revize; historie `defect_events` ukazuje, kdo co změnil)
- [x] P1 Seznam závad s filtry (část 8: `src/app/(app)/defects`, stav, závažnost, zákazník, budova, hledání popisu i čísla štítku, řazení)
- [x] P1 Uzavření závady s poznámkou o řešení (část 8: poznámka povinná, hlídá i databáze)
- [x] P2 Přiřazení závady konkrétnímu člověku (část 19: karta Řešení na závadě, `assign_defect` jen na člena firmy, změna v historii; filtr „Řeším já“ a sloupec Řeší v seznamu; odebrání člena přiřazení zruší; „Moje práce“ na přehledu)
- [x] P2 Termín na odstranění závady a upozornění (část 19: `set_defect_due`, změna v historii; po termínu červeně a do 7 dnů oranžově na závadě i v seznamu, filtr „Po termínu odstranění“, počet na přehledu v „Moje práce“; upozornění e-mailem přijde s Resend a částí 22)
- [x] P2 Návaznost: další úspěšná kontrola zařízení nabídne uzavření závady (část 15: po vyhovující kontrole dialog s otevřenými závadami zařízení a předvyplněnou poznámkou, uzavře vybrané; zapíše se do historie závady)
- [ ] P3 Nabídka nebo objednávka opravy pro zákazníka

## J. Protokoly (PDF)

- [x] P1 Automatické vytvoření PDF po dokončení revize (část 9: `completeInspection` → `generateProtocol` v `src/lib/protocols.ts`; když se nepovede, výsledek revize nabídne „Vytvořit protokol“)
- [x] P1 Obsah: logo a údaje firmy, zákazník, budova, datum, technik, číslo protokolu, tabulka zařízení s výsledkem, závady, poznámky, patička (část 9: obsah `src/lib/protocol.ts` s testy, rozvržení `src/lib/pdf/protocol.tsx`; u nevyhovujících zařízení i nevyhovující položky, měřené hodnoty a poznámky; místo pro podpisy)
- [x] P1 Číslování protokolů bez mezer a duplicit (i při souběhu) (část 9: `ROK-NNNN` přidělí `complete_inspection` ve stejné transakci, čítač `organization_counters` po firmě a roce; souběh ověřen v `tests/rls.test.ts`)
- [x] P1 Uložení PDF do privátního úložiště, přístup přes podepsané odkazy s časovým omezením (část 9: bucket `protocols`, zapisuje jen server, odkaz platí 60 s: `/inspections/[id]/protocol`)
- [x] P1 Stažení PDF z aplikace (část 9: výsledek revize, seznam revizí, detail budovy a zákazníka; „Otevřít a vytisknout“ otevře PDF v prohlížeči)
- [ ] P1 Odeslání protokolu e-mailem zákazníkovi a záznam o odeslání (část 9: hotové v kódu, PDF jako příloha, odpověď jde firmě, záznam `protocol_emails`; čeká na nastavení Resend, bez něj aplikace řekne, že e-maily nejsou nastavené)
- [x] P1 Čitelnost při tisku (černobílý tisk) (část 9: jen černá a šedá, výsledky slovy, nevyhovující tučně; ověřeno na náhledu)
- [x] P1 Jazyk protokolu podle nastavení (čeština, angličtina) (část 9: výchozí jazyk firmy v okamžiku dokončení, uložený u protokolu; ověřeno v `e2e/part9.mjs`)
- [ ] P2 Vlastní text e-mailu a více příjemců
- [x] P2 Fotografie závad v protokolu (část 18: až dvě fotky u každé závady jako náhledy pod tabulkou závad)
- [x] P2 Opětovné vygenerování protokolu po opravě (nová verze, původní zůstává) (část 18: `reissue_protocol`, stejné číslo, `protocols.version`/`active`; starší verze a jejich PDF beze změny a ke stažení přes `?version=N`; nová verze uvádí, které vydání nahrazuje; odeslané e-maily všech verzí zůstávají vidět)
- [x] P2 Souhrnný protokol za více budov nebo období (část 18: `/inspections/summary`, filtr zákazník, budova a období ve dnech firemního časového pásma; náhled po budovách a PDF s revizemi, čísly protokolů, výsledky a otevřenými závadami; neukládá se)
- [ ] P3 Vlastní vzhled protokolu (barvy, rozložení) (odloženo z části 18: protokol je záměrně černobílý kvůli tisku, počká na přání firem z pilotu)
- [ ] P3 Šablony protokolů podle země a předpisů
- [ ] P3 Elektronický podpis a časové razítko

## K. Termíny a přehled (dashboard)

- [x] P1 Úvodní přehled: počty podle stavu (v pořádku, brzy, po termínu, bez revize) (část 5: karta Termíny revizí na přehledu, každý stav otevře filtrovaný seznam zařízení)
- [x] P1 Seznam "co propadá v příštích 30 / 60 / 90 dnech" (část 10: karta „Co propadá“ na přehledu, budovy s počtem zařízení po termínu a v období, výpočet `src/lib/due-plan.ts` s testy hranic; seznam zařízení má filtr „Do 30/60/90 dní“)
- [x] P1 Seznam zařízení po termínu (část 5: seznam zařízení s filtrem Po termínu, odkaz z přehledu a z budovy)
- [x] P1 Otevřené závady (část 8: karta na přehledu s počty podle závažnosti, každá otevře filtrovaný seznam)
- [x] P1 Filtr podle zákazníka a budovy (část 10: přehled termínů, stavy a otevřené závady na úvodní stránce, filtr v adrese)
- [x] P1 Hranice "brzy" jako nastavení organizace (část 2: `organizations.due_soon_days`, `src/app/(app)/settings`)
- [x] P1 Správné hraniční případy (testy na přechod měsíců, přestupné roky, časová pásma) (část 5: `tests/due.test.ts` a shoda s databází v `tests/rls.test.ts`)
- [x] P2 Kalendářní pohled blížících se revizí (část 19: `/calendar`, měsíc s naplánovanými revizemi a počtem zařízení k revizi po dnech a budovách, filtr zákazníka a technika, klik na den naplánuje revizi; na telefonu seznam dnů; plánované revize `inspection_plans` (budova, den, technik, poznámka), spojí se s revizí při jejím zahájení; migrace `20261024120000_planning.sql`)
- [x] P2 Přehled vytížení techniků (část 19: `/calendar?view=workload`, technici po týdnech na 8 týdnů dopředu, počet revizí a zařízení v jejich budovách, nepřiřazené zvlášť; výpočet `workload()` v `src/lib/calendar.ts` s testy)
- [ ] P2 Export seznamu termínů do CSV
- [ ] P3 Exportní kalendář (ICS) pro Google a Apple kalendář
- [ ] P3 Statistiky (počet kontrol, závad, trendy)

## L. Upozornění a e-maily

- [ ] P1 Týdenní souhrn blížících se termínů e-mailem adminům (část 10: hotové v kódu: úloha `/api/cron/weekly-summary` každé pondělí, `vercel.json`, `CRON_SECRET`, týden se zapíše jen jednou, vypínač a náhled v Nastavení; čeká na nastavení Resend a nasazení)
- [ ] P1 E-mail s pozvánkou, obnovou hesla a protokolem (čitelný, bez chyb v doručování)
- [ ] P2 Připomínky zákazníkům před termínem (jen po zapnutí v nastavení)
- [ ] P2 Nastavení, jaká upozornění chce který uživatel
- [ ] P2 Šablony e-mailů upravitelné firmou
- [ ] P3 Notifikace v aplikaci a push na telefon
- [ ] P3 SMS připomínky

## M. Offline režim

- [x] P2 Stažení dat budovy do telefonu před vstupem (zařízení, šablony) (část 16: otevřením revize s připojením se celá uloží do telefonu: zařízení, stav kontrol, šablony, otevřené závady, půdorysy, stránka i soubory aplikace přes service worker; karta v revizi ukazuje „uložená v telefonu, data z …“)
- [x] P2 Provádění kontrol bez signálu (část 16: stránka revize se otevře bez signálu i po zavření prohlížeče, funguje skener štítků, kontrola s fotkami, vynechání i uzavření závady; dokončení revize a přidání zařízení potřebují připojení a řeknou to)
- [x] P2 Fronta změn a fotek, odeslání po obnovení spojení (část 16: kontrola se odešle celá najednou funkcí `submit_device_check` s časem, kdy byla hotová; fotky z IndexedDB, uzavření závad; při výpadku, vypršení přihlášení i chybě serveru čeká a zkouší znovu; každý požadavek má časový limit, takže slabý signál odesílání nezastaví)
- [x] P2 Viditelný indikátor, že jsi offline a co čeká na odeslání (část 16: karta stavu v revizi (bez signálu, odesílám, co čeká, čeká na rozhodnutí, vše odesláno), u zařízení „čeká na odeslání“, patička kontroly; stránka `/offline` se seznamem revizí v telefonu)
- [x] P2 Řešení konfliktů, když dva technici upraví totéž (část 16: online drží kontrolu jeden technik; kontrola kolegy mezitím je konflikt, technik vidí jeho výsledek a zvolí „Platí moje“ (nahradí ji) nebo „Ponechat kolegovu“; totéž u jiné verze šablony; funkce `claim_device_check`)
- [x] P2 Bezpečné uložení offline dat (smazání po odhlášení) (část 16: odhlášení smaže koncepty, fotky, balíčky i uložené stránky, s varováním, když něco čeká; přihlášení jiného účtu na stejném telefonu data předchozího smaže)
- [x] P2 Testy na přerušení spojení uprostřed kontroly (část 16: `e2e/part16.mjs` vypne síť stránce i service workeru: otevření bez signálu, sken, kontrola s fotkou, vynechání, uzavření závady, obnovení stránky, offline stránka, odeslání s časem kontroly, odstraněné zařízení, slabý signál, konflikt, odhlášení; `e2e/part7.mjs` výpadek uprostřed kontroly)
- [x] P1 Do doby, než offline přijde: srozumitelná hláška při výpadku spojení a nic se neztratí (rozdělané odpovědi zůstanou ve zařízení) (část 7: e2e vypne síť, odpoví, zapne síť a ověří odeslání)

## N. Podpisy a potvrzení

- [x] P2 Podpis zákazníka prstem na displeji (část 18: plátno na stránce dokončení revize, nepovinné; PNG ověří a uloží server do `<org>/signatures/`, v protokolu v poli „Převzal(a) za zákazníka“; při opravě revize zůstává, pokud se zákazník nepodepíše znovu)
- [x] P2 Jméno podepisujícího a čas v protokolu (část 18: jméno a datum podpisu v protokolu i na stránce revize; kresba a jméno se nahrazují jen spolu)
- [ ] P3 Odeslání protokolu zákazníkovi k podpisu na dálku
- [ ] P3 Právně uznatelný elektronický podpis (podle země)

## O. Portál pro majitele budov

- [ ] P2 Přístup majitele budovy jen k vlastním budovám (jen čtení)
- [ ] P2 Přehled stavu zařízení, historie revizí, stažení protokolů
- [ ] P2 Pozvání majitele e-mailem
- [ ] P3 Žádost o servis nebo opravu z portálu
- [ ] P3 Vlastní doména a vzhled portálu servisní firmy

## P. Předplatné a platby

- [ ] P2 Zkušební doba bez platební karty
- [ ] P2 Plány a limity (počet techniků nebo zařízení)
- [ ] P2 Platba kartou a správa předplatného
- [ ] P2 Faktury a daňové doklady ke stažení
- [ ] P2 Zpracování neúspěšných plateb a pozastavení účtu bez smazání dat
- [ ] P2 Zrušení předplatného a export dat při odchodu
- [ ] P3 Roční platba a slevy
- [ ] P3 Platby a faktury podle místních požadavků (Arménie, Gruzie, další)
- [ ] P3 Partnerský a doporučovací program

## Q. Nastavení organizace

- [x] P1 Údaje o firmě (název, IČO, DIČ, adresa, e-mail, telefon) (část 2: `src/app/(app)/settings`, kontrola IČO v `src/lib/validation.ts`)
- [x] P1 Logo a patička protokolu (část 2: `src/app/(app)/settings`, úložiště `org-assets`)
- [x] P1 Výchozí jazyk a časové pásmo (část 2: `organizations.default_locale`, `organizations.timezone` (kontrola v databázi))
- [x] P1 Hranice "brzy" v dnech (část 2: `organizations.due_soon_days` (1–365, výchozí 30))
- [x] P2 Formát číslování protokolů (část 18: Nastavení → Protokoly, `2026-0007`, `2026/0007` nebo `0007/2026`; formát se uloží k protokolu při očíslování, už vydané se nezmění; v názvu souboru bez lomítka)
- [ ] P2 Výchozí text e-mailu zákazníkům
- [ ] P3 Vlastní pole u zákazníků a zařízení

## R. Import a export

- [x] P1 Export zařízení a revizí do CSV (část 11: `/devices/export` se stejnými filtry jako seznam, `/inspections/export` po kontrolách s číslem protokolu a nevyhovujícími položkami; UTF-8 s BOM, středník v češtině, ochrana proti vzorcům, `src/lib/csv.ts` s testy)
- [x] P2 Import zákazníků, budov a zařízení z CSV nebo Excelu s náhledem a chybami (část 14: rozpoznání sloupců, náhled co vznikne a co existuje, import v jedné transakci, opakovaný import bez duplicit podle výrobního čísla, vrácení importu, vzor ke stažení)
- [ ] P2 Úplný export všech dat organizace při odchodu zákazníka
- [ ] P3 Veřejné API a webhooky
- [ ] P3 Napojení na účetnictví a fakturaci

## S. Vyhledávání a použitelnost

- [x] P1 Globální vyhledávání (zákazník, budova, zařízení podle čísla) (část 11: hledání v levé liště a na telefonu v horní liště, Ctrl+K nebo „/“; zákazníci, budovy, zařízení podle čísla štítku i výrobního čísla, závady „Z-12“, protokoly „2026-0001“; `src/components/app/omnibar.tsx`)
- [x] P1 Srozumitelné prázdné stavy ("zatím žádné zařízení, přidej první") (`EmptyState` se vstřícným textem a akcí na všech seznamech od části 3; nově průvodce „Začínáme“ na přehledu)
- [x] P1 Srozumitelné chybové hlášky (ne technické kódy) (chyby jsou kódy z `src/lib/errors.ts` přeložené v `messages`, test hlídá shodu cs/en)
- [x] P1 Potvrzení před smazáním (`DeleteButton`/`ConfirmDialog`: zákazník, budova, lokace, zařízení, člen týmu, logo, ukázková data)
- [ ] P2 Zpět po smazání (obnovení z koše)
- [ ] P2 Zkratky a rychlé akce (nová revize, sken) na úvodní stránce
- [ ] P3 Uložené filtry

## T. Mobil a PWA

- [x] P1 Plně použitelné na telefonu, hlavně přehled revize, sken a checklist (e2e na šířce 390 px v částech 7–11, test hlavního toku v Playwright na emulaci Pixel 7, audit přístupnosti telefonu)
- [x] P1 Dotykové prvky nejméně 44 px (`pointer-coarse:` ve všech ovládacích prvcích, `.touch-link` a odkazy v detailech; `e2e/a11y.mjs` měří 10 stránek telefonu s emulací dotyku)
- [ ] P1 Funguje v mobilním Safari i Chrome (Chrome a Edge ověřené v emulaci telefonu; Safari na iPhonu ověřit po nasazení podle `docs/DEPLOY.md`)
- [x] P1 Instalace na plochu (PWA manifest, ikony) (část 12: `src/app/manifest.ts` se zkratkami Zahájit revizi a Nahlásit závadu, ikony 192/512 i maskable z loga, ikona pro iPhone)
- [ ] P2 Čtení za slunečního světla (dostatečný kontrast, tmavý režim)
- [ ] P2 Ovládání jednou rukou (důležité akce dole na obrazovce)
- [ ] P3 Nativní aplikace pro iOS a Android (až když PWA nestačí)

## U. Jazyky a lokalizace

- [x] P1 Čeština a angličtina kompletní (`messages/cs.json` a `en.json`, test hlídá shodu klíčů; obě verze prošly kontrolou v každé části, protokoly a e-maily v jazyce firmy)
- [x] P1 Žádné texty natvrdo v kódu, vše přes překlady (i PDF, e-maily a CSV; výjimkou je jen záchranná chybová stránka, dvojjazyčná)
- [x] P1 Formát data, čísel a měny podle jazyka (`Intl` s jazykem uživatele, termíny jako kalendářní dny, export CSV v ISO a se středníkem v češtině; ceny v aplikaci zatím nejsou)
- [x] P1 Logické CSS vlastnosti, aby šlo přidat zobrazení zprava doleva (`ps-/pe-/start-/end-`, šipky s `rtl:rotate-180`, `dir` podle jazyka v `layout.tsx`)
- [ ] P3 Arménština a gruzínština
- [ ] P3 Arabština včetně zprava doleva
- [ ] P3 Šablony protokolů a kontrol podle místních předpisů (po konzultaci s místními firmami)

## V. Bezpečnost a soukromí

- [x] P1 Row Level Security (nebo ekvivalent) na každé tabulce, s testem na každou (`tests/rls.test.ts`: 83 testů, každá tabulka a bucket i izolace firem)
- [x] P1 Privátní úložiště souborů, přístup jen přes podepsané odkazy (část 2: bucket `org-assets` (soukromý), `src/lib/storage.ts` (odkazy na 10 minut); testy `tests/rls.test.ts`)
- [x] P1 Validace vstupů na serveru (Zod schémata v `src/lib/validation.ts` v každé serverové akci, kontroly v databázových funkcích a omezeních)
- [x] P1 Omezení typu a velikosti nahrávaných souborů (část 2: limit bucketu (PNG/JPEG/WebP, 2 MB) + kontrola obsahu souboru `sniffImage`; testy)
- [x] P1 Ochrana proti běžným útokům (XSS, CSRF, SQL injection) a bezpečné hlavičky (část 12: CSP s nonce na každý požadavek, HSTS, X-Frame-Options, Permissions-Policy aj. v `src/lib/security-headers.ts` s testy; React escapuje výstup, serverové akce Next.js kontrolují původ, POST štítků jen ze stejného webu; dotazy přes PostgREST a `ilikeAny`, CSV bez vzorců)
- [x] P1 Žádná tajemství v kódu ani v commitech (část 12: prohledaná celá historie gitu na klíče Supabase, Resend, JWT, hesla v adresách a soukromé klíče, nic nenalezeno; `.env*` mimo `.env.example` git ignoruje)
- [x] P1 Data uložena v EU (část 1: Supabase eu-west-1 (Irsko))
- [x] P1 Odkaz na zásady zpracování osobních údajů a podmínky (text doplním, nevymýšlej ho) (část 1: patička přihlášení a menu účtu, `src/lib/site.ts`)
- [ ] P1 Automatické zálohy databáze a ověřené obnovení (připraveno: zálohy databáze dělá Supabase Pro v produkci; soubory zálohuje a obnovuje `scripts/backup-storage.mjs` a `restore-storage.mjs`, vyzkoušeno na vývoji; zkouška obnovení podle `docs/DEPLOY.md` po založení produkce)
- [ ] P2 Omezení počtu požadavků (rate limiting) na přihlášení a API
- [ ] P2 Záznam o změnách (audit log): vytvoření, změna a smazání zařízení, dokončení revize, generování protokolu
- [ ] P2 Právo na výmaz a export osobních údajů (GDPR)
- [ ] P2 Zpracovatelská smlouva pro servisní firmy
- [ ] P3 Bezpečnostní audit a penetrační test před většími zákazníky

## W. Správa pro provozovatele (pro mě jako majitele SaaS)

- [ ] P2 Interní přehled organizací (počet uživatelů, zařízení, poslední aktivita)
- [ ] P2 Možnost pozastavit nebo obnovit účet
- [ ] P2 Bezpečný vstup do účtu zákazníka pro podporu (se záznamem)
- [ ] P3 Metriky: registrace, aktivní firmy, odchody

## X. První dojem a zavedení

- [x] P1 Průvodce po registraci: firma, první zákazník, první budova, první zařízení, první štítek (část 11: karta „Začínáme“ na přehledu pro vlastníka a administrátora, kroky se odškrtnou samy, první tisk štítků se zapíše, lze skrýt)
- [x] P1 Ukázková data, která lze jedním tlačítkem smazat (část 11: `create_sample_data` / `remove_sample_data`, smaže i revize, protokoly, závady a fotky; ukázka má vlastní čísla od 900001, skutečné číslování neovlivní)
- [ ] P2 Nápověda v aplikaci a krátká videa nebo návody
- [ ] P2 Kontaktní formulář a odkaz na podporu
- [ ] P2 Sběr zpětné vazby uvnitř aplikace
- [ ] P3 Znalostní báze

## Y. Kvalita a provoz

- [x] P1 Automatické testy: izolace organizací, výpočet termínů, číslování protokolů (`tests/rls.test.ts`, `tests/due.test.ts`, číslování a souběh od části 9)
- [x] P1 Test hlavního toku od přihlášení po vznik protokolu (část 12: `playwright/main-flow.spec.ts`, `npm run test:flow`, na telefonu i počítači; v CI po zapnutí `RUN_MAIN_FLOW`)
- [ ] P1 Sledování chyb (např. Sentry) (připraveno: `@sentry/nextjs`, chybové stránky s kódem chyby, tunel `/monitoring`; zapne se doplněním `NEXT_PUBLIC_SENTRY_DSN`)
- [x] P1 Zdravotní kontrola aplikace (část 1: `src/app/api/health/route.ts`)
- [x] P1 Nasazení na veřejnou adresu, oddělené testovací a produkční prostředí (portal.sparxdeck.com na Vercelu, produkční Supabase `ellnjenfqupwqelsojjg` oddělená od vývojové `zclhipzzqvhmpqxxaust`, migrace do produkce jen přes `npm run db:push:production`; commity `b5ac007`, `e946fa4`)
- [x] P1 Migrace databáze verzované v repozitáři (část 1: `apps/platform/supabase/migrations`, `npm run db:push`)
- [ ] P2 Výkon: seznamy se stránkováním a indexy na nejčastější dotazy
- [x] P2 Přístupnost podle zásad WCAG (kontrast, popisky, ovládání klávesnicí) (část 12: `e2e/a11y.mjs` s axe-core, WCAG 2.1 A a AA bez vážných nálezů na 26 pohledech včetně telefonu a tmavého režimu; ruční test se čtečkou obrazovky zbývá)
- [ ] P2 Sledování výkonu a dostupnosti (monitoring, upozornění při výpadku)
- [ ] P3 Zátěžové testy

---

## Co zatím nedělat (neodškrtávat a nestavět)

- Žádný vlastní fakturační systém ani účetnictví.
- Žádné automatické tvrzení o souladu s předpisy. Aplikace dokumentuje kontroly, ne zaručuje právní soulad.
- Žádná umělá inteligence a žádné chytré funkce navíc, dokud základní tok nefunguje spolehlivě.
- Žádné další typy zařízení před ověřením u skutečných zákazníků.
- Žádné vymyšlené recenze, počty zákazníků ani čísla úspor na webu nebo v aplikaci.

## Definice "hotovo" pro celou první verzi

První verze je hotová, když technik na telefonu projde skutečnou budovu, naskenuje štítky, zkontroluje zařízení, vyfotí závadu, dokončí revizi, a servisní firma z toho dostane správný PDF protokol a přehled termínů, a to všechno bez toho, aby viděla data jiné firmy. Všechny položky P1 musí být odškrtnuté a otestované.
