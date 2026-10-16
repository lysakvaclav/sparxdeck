# SparxDeck: technická specifikace

> **Poznámka ke stavu (2026-10-11):** pořadí práce určuje [ROADMAP.md](ROADMAP.md) (části 1–12 podle priorit v [CHECKLIST.md](CHECKLIST.md)), ne fáze níže. Datový model, role a pravidla z tohoto dokumentu platí. Skutečně použité technologie a odchylky jsou v [CLAUDE.md](../CLAUDE.md).

Tento dokument popisuje, co se má postavit a v jakém pořadí. Přečti si ho celý, ale **pracuj vždy jen na jedné fázi**. Přečti také CLAUDE.md (popis produktu).

## 0. Pravidla práce (platí pořád)

1. Postupuj po fázích v pořadí. Před každou fází napiš krátký plán a počkej na můj souhlas (režim Plan).
2. Po každé fázi: spusť aplikaci, spusť testy, oprav chyby, udělej git commit se srozumitelnou zprávou a řekni mi, co jsem měl otestovat ručně.
3. Nepřidávej funkce, které ve fázi nejsou. Když něco chybí nebo je nejasné, zeptej se.
4. Žádná tajemství v kódu. Klíče patří do `.env.local` a do `.env.example` (bez hodnot). `.env.local` je v `.gitignore`.
5. Nevymýšlej právní tvrzení ani předpisy. Kontrolní seznamy a intervaly revizí jsou **data v databázi, ne pevný kód**, aby je šlo upravit podle skutečných předpisů a zákazníků. V aplikaci nikde neuváděj čísla zákonů, dokud je neověříme.
6. Každá tabulka patří organizaci (multi-tenancy) a je chráněná Row Level Security. Žádná firma nikdy nesmí vidět data jiné firmy.
7. Piš v TypeScriptu se striktním nastavením. Všechny texty v UI dávej přes překladový systém (viz fáze 10), ne natvrdo.
8. Pro vzhled platí: jednoduché, čisté, použitelné na telefonu. Neřeš dekorace.
9. Poptávka produktu zatím není ověřená. Proto nestav věci navíc. Důležitější než funkce je, aby základní tok (zařízení, sken, kontrola, protokol) fungoval spolehlivě.

## 1. Technologie (doporučení, před začátkem potvrď)

- **Framework:** Next.js (App Router) + TypeScript.
- **Databáze, přihlášení, úložiště souborů:** Supabase (PostgreSQL, Auth, Storage). Region EU (Frankfurt), kvůli GDPR.
- **Styly:** Tailwind CSS. Komponenty: shadcn/ui.
- **Formuláře a validace:** React Hook Form + Zod.
- **Překlady:** next-intl. Výchozí čeština, druhá angličtina.
- **QR kódy (generování):** knihovna `qrcode`.
- **QR kódy (skenování kamerou):** `@yudiel/react-qr-scanner` nebo `html5-qrcode`. Vyber tu, která funguje spolehlivě v mobilním Safari i Chrome.
- **PDF:** `@react-pdf/renderer` (serverové generování).
- **E-maily:** Resend.
- **Hosting:** Vercel (aplikace) + Supabase (data).
- **Testy:** Vitest (jednotkové) a Playwright (základní průchod hlavním tokem).
- **PWA:** web manifest a service worker (zatím jen instalace na plochu; offline až později).

**Úkol před fází 1:** podívej se, v čem je napsaná stávající landing page ve složce projektu. Pokud je to jiný framework, navrhni, zda aplikaci udělat jako samostatný projekt (doporučeno: `app.` poddoména) a landing page nechat beze změny. Nic na landing page nepřepisuj.

## 2. Role a oprávnění

| Role | Co smí |
|---|---|
| `owner` | vše, včetně správy členů a nastavení firmy |
| `admin` | správa zákazníků, budov, zařízení, šablon, protokolů, členů (kromě smazání firmy) |
| `technician` | vidí přidělené zákazníky a budovy, skenuje, provádí kontroly, hlásí závady; nemění šablony ani nastavení |

Uživatel může patřit do více organizací (členství), ale v MVP stačí jedna aktivní organizace najednou.

## 3. Datový model

Všechny tabulky mají `id` (uuid), `created_at`, `updated_at`. Tabulky organizace mají `organization_id`. Mazání je **měkké** (`deleted_at`), kde to dává smysl (zákazníci, budovy, zařízení).

### organizations
`name`, `legal_name`, `company_id` (IČO), `vat_id`, `address`, `email`, `phone`, `logo_path`, `default_locale` (cs/en), `protocol_footer_text`, `settings` (jsonb).

### memberships
`organization_id`, `user_id` (Supabase auth), `role` (owner/admin/technician), `display_name`.

### customers
`organization_id`, `name`, `contact_person`, `email`, `phone`, `billing_address`, `notes`.

### sites (budovy / provozovny)
`organization_id`, `customer_id`, `name`, `address`, `notes`.

### locations (volitelné, patro nebo místnost)
`organization_id`, `site_id`, `name` (např. "2. patro, chodba u výtahu"), `sort_order`.

### device_types
`organization_id` (nebo null pro globální výchozí), `code` (např. `fire_extinguisher`), `name`, `inspection_interval_months` (výchozí hodnota jako **upravitelná hodnota**, ne pevná; ověřit se skutečnou praxí), `active`.
Seed: jeden typ "Hasicí přístroj". Ostatní typy (hydrant, nouzové osvětlení, klapky) jen jako neaktivní zástupné záznamy nebo vůbec ne.

### checklist_templates
`organization_id` (nebo null pro globální), `device_type_id`, `name`, `version`, `active`.

### checklist_template_items
`template_id`, `sort_order`, `label` (klíč překladu nebo text), `item_type` (`pass_fail`, `number`, `text`), `required` (bool), `fail_creates_defect` (bool).
Seed pro hasicí přístroj: pouze **zástupná** sada položek (čitelnost štítku, plomba a pojistka, stav hadice a trysky, stav tlakoměru, viditelné poškození a koroze, přístupnost a umístění). Označ v kódu a v UI jako "ukázková šablona, ověřit se skutečným revizním technikem".

### devices (zařízení)
`organization_id`, `site_id`, `location_id` (nullable), `device_type_id`, `public_token` (náhodný, nenapodobitelný řetězec, např. 12 znaků base32; **ne** pořadové číslo), `label_number` (čitelné číslo štítku v rámci organizace), `serial_number`, `manufacturer`, `model`, `manufacture_year`, `extinguishing_agent` / `size` (volitelná pole podle typu, drž je v jsonb `attributes`), `installed_at`, `status` (`active`, `out_of_service`, `removed`), `last_inspection_at`, `next_due_at`, `notes`.

### inspections (revize / kontrola)
`organization_id`, `site_id`, `performed_by` (user_id), `status` (`draft`, `in_progress`, `completed`), `started_at`, `completed_at`, `customer_signature_path` (zatím null), `notes`.

### inspection_items (kontrola jednoho zařízení v rámci revize)
`inspection_id`, `device_id`, `template_id`, `template_version`, `outcome` (`passed`, `failed`, `not_checked`), `checked_at`, `notes`.

### inspection_item_results (odpovědi na položky šablony)
`inspection_item_id`, `template_item_id`, `value_pass_fail` (bool nullable), `value_number`, `value_text`, `note`.

### defects (závady)
`organization_id`, `device_id`, `inspection_item_id`, `description`, `severity` (`minor`, `major`, `critical`), `status` (`open`, `in_progress`, `resolved`), `resolved_at`, `resolution_note`.

### attachments (fotky)
`organization_id`, `owner_type` (`inspection_item`, `defect`), `owner_id`, `storage_path`, `content_type`, `size_bytes`, `uploaded_by`.

### protocols
`organization_id`, `inspection_id`, `number` (číslo protokolu, např. `2026-0001`, sekvence za organizaci a rok), `pdf_path`, `generated_at`, `sent_to_email`, `sent_at`.

### audit_log
`organization_id`, `user_id`, `action`, `entity_type`, `entity_id`, `diff` (jsonb). Zapisuj vytvoření, změny a smazání zařízení, dokončení revize a generování protokolu.

### Pravidla pro termíny
- Po dokončení revize zařízení s výsledkem `passed` nastav `last_inspection_at` = datum kontroly a `next_due_at` = `last_inspection_at` + `inspection_interval_months` jeho typu.
- Při výsledku `failed` zařízení **nenastavuj** jako splněné a vytvoř závadu.
- Stav pro přehled: `ok` (termín dál než 30 dní), `due_soon` (do 30 dní), `overdue` (po termínu), `never_inspected` (bez revize).
- Hranici 30 dní udělej jako nastavení organizace.

## 4. Fáze

### Fáze 1: základ projektu, přihlášení, organizace
- Inicializace Next.js, TypeScript, Tailwind, shadcn/ui, ESLint, Prettier.
- Supabase projekt (lokální vývoj přes Supabase CLI a migrace v repozitáři).
- Registrace a přihlášení e-mailem a heslem (a magic link), obnova hesla.
- Po první registraci vytvoř organizaci a uživatele jako `owner`.
- Chráněné stránky, middleware, odhlášení.
- RLS: pomocná funkce `is_member(org_id)` a `has_role(org_id, role)`; politiky pro `organizations` a `memberships`.
- Základní layout aplikace: postranní menu na počítači, spodní navigace na telefonu.
- Pozvání člena e-mailem (admin/technik).
- **Hotovo, když:** dva různí uživatelé v různých organizacích se vzájemně nevidí (napiš na to test).

### Fáze 2: zákazníci a budovy
- CRUD zákazníků a budov (seznam, vyhledávání, detail, formulář, měkké smazání).
- Volitelné lokace v budově.
- RLS pro všechny nové tabulky.
- Prázdné stavy a srozumitelné chybové hlášky.
- **Hotovo, když:** lze vytvořit zákazníka, budovu a lokace a vše je izolované po organizacích.

### Fáze 3: typy zařízení, šablony, zařízení
- Seed typu "Hasicí přístroj" a ukázkové šablony.
- Správa šablon (jen admin): zobrazení a úprava položek; verzování (nová úprava = nová verze, staré revize odkazují na původní verzi).
- CRUD zařízení v budově, vyhledávání a filtry (stav, lokace, termín).
- Hromadné přidání zařízení (např. "přidej 20 hasicích přístrojů" s automatickým číslováním štítků).
- Import z CSV (volitelné; ošetři chybné řádky a ukaž přehled chyb).
- **Hotovo, když:** v budově lze vytvořit a vyhledat zařízení a zobrazit jeho detail.

### Fáze 4: QR štítky
- Každé zařízení má `public_token`. QR kód obsahuje URL `https://<app>/d/<public_token>`. **Do QR žádné osobní údaje.**
- Trasa `/d/[token]`: pokud není uživatel přihlášen, přesměruj na přihlášení a poté zpět. Přihlášený člen správné organizace vidí detail zařízení a tlačítko "Spustit kontrolu". Cizí organizaci ukaž neutrální "nenalezeno".
- Tisk štítků: stránka s výběrem zařízení a PDF s mřížkou štítků (QR, číslo štítku, název budovy), nastavitelná velikost štítku. Začni jednou běžnou velikostí A4 mřížky a udělej velikost konfigurovatelnou.
- **Hotovo, když:** vytištěný štítek lze naskenovat telefonem a otevře správné zařízení.

### Fáze 5: kontrola (jádro produktu)
- Spuštění revize v budově: vytvoří `inspection` ve stavu `in_progress`.
- Obrazovka revize: seznam zařízení v budově se stavem (zkontrolováno / nezkontrolováno), počítadlo.
- Skener QR kamerou. Po naskenování otevři checklist zařízení podle šablony.
- Checklist: velká tlačítka ano/ne pro `pass_fail`, číselné a textové pole, poznámka, přiložení fotky z fotoaparátu (komprese na rozumnou velikost před nahráním).
- Uložení po každé položce (průběžné ukládání, ať se nic neztratí při zavření stránky).
- Neúspěšná kontrola s `fail_creates_defect` vytvoří závadu (fáze 6).
- Zařízení, které nebylo naskenováno, lze zkontrolovat i ručním výběrem ze seznamu.
- Dokončení revize: souhrn (kolik zařízení v pořádku, kolik se závadou, kolik nezkontrolováno), potvrzení, přepočet `last_inspection_at` a `next_due_at` podle pravidel výše.
- Nelze dokončit revizi s povinnou položkou bez odpovědi.
- Zamez dvojímu skenování a souběžné úpravě stejné kontroly dvěma techniky (jednoduché zamykání nebo hláška).
- **Hotovo, když:** technik na telefonu projde budovu, zkontroluje několik zařízení s fotkou a dokončí revizi.

### Fáze 6: závady
- Seznam závad s filtry (stav, závažnost, budova, zákazník).
- Detail závady: popis, fotky, historie změn, změna stavu a poznámka k vyřešení.
- Vyřešená závada s následnou úspěšnou kontrolou zařízení uzavře cyklus.
- **Hotovo, když:** z neúspěšné kontroly vznikne závada a lze ji vyřešit.

### Fáze 7: PDF protokol a e-mail
- Po dokončení revize vygeneruj PDF: logo a údaje firmy, údaje zákazníka a budovy, datum, technik, číslo protokolu, tabulka zařízení s výsledkem, seznam závad, poznámky, patička firmy. Čeština a angličtina podle nastavení.
- Číslování protokolů `ROK-NNNN` bez mezer a duplicit (řeš souběh transakcí).
- Odeslání protokolu e-mailem zákazníkovi (Resend) a uložení záznamu o odeslání.
- Stažení PDF z aplikace. PDF uložit do privátního úložiště, přístup jen přes časově omezené podepsané odkazy.
- Prostor pro podpis zákazníka nech v návrhu prázdný (přijde později).
- **Hotovo, když:** po dokončení revize lze stáhnout PDF a odeslat ho e-mailem a vypadá použitelně na tisk.

### Fáze 8: přehled termínů (dashboard)
- Úvodní stránka: počty zařízení podle stavu (ok, brzy, po termínu, bez revize), seznam "co propadá v příštích 30 / 60 / 90 dnech", seznam otevřených závad.
- Filtr podle zákazníka a budovy.
- Plánovaná úloha (cron v Supabase nebo Vercel), která jednou týdně pošle adminům souhrn blížících se termínů e-mailem.
- Volitelně: připomínky přímo zákazníkům (jen po zapnutí v nastavení).
- **Hotovo, když:** dashboard správně ukazuje stavy podle `next_due_at` (napiš test na hranice termínů).

### Fáze 9: nastavení organizace
- Údaje firmy, logo (nahrání, omezení velikosti a typu), patička protokolu, výchozí jazyk, hranice "brzy" (dny).
- Správa členů a rolí.
- Export dat organizace (CSV zařízení a revizí).
- **Hotovo, když:** změna loga a údajů se projeví v dalším vygenerovaném protokolu.

### Fáze 10: překlady, přístupnost, kvalita, nasazení
- Všechny texty přes next-intl; čeština a angličtina kompletní. Připrav strukturu tak, aby šlo později přidat arménštinu, gruzínštinu a arabštinu, včetně možnosti zobrazení zprava doleva (použij logické CSS vlastnosti, např. `margin-inline-start`).
- Datumy, čísla a měny formátovat podle locale.
- PWA: manifest, ikony, instalace na plochu.
- Přístupnost: kontrasty, velikost dotykových prvků (na telefonu minimálně 44 px), štítky formulářů.
- Chyby a logování (např. Sentry), zdravotní kontrola `/api/health`.
- Playwright test hlavního toku: přihlášení, vytvoření zákazníka, budovy, zařízení, kontrola, dokončení revize, vznik protokolu.
- Nasazení: Vercel + produkční Supabase; migrace spouštěj kontrolovaně; zálohy databáze zapnout.
- **Hotovo, když:** aplikace běží na veřejné adrese a hlavní tok projde v testu.

## 5. Později (zatím nestavět)

- Offline režim (IndexedDB, fronta změn a synchronizace). Ve sklepech a garážích není signál, takže je to důležité, ale je to samostatný velký úkol.
- Podpis zákazníka na displeji.
- Další typy zařízení (hydranty, nouzové osvětlení, požární klapky a dveře).
- Portál pro majitele budov.
- Stripe: předplatné, zkušební doba, limity podle plánu.
- Lokalizace do arménštiny, gruzínštiny, arabštiny a šablony protokolů podle místních předpisů (až po konzultaci s místními firmami).
- NFC štítky jako doplněk k QR.

## 6. Bezpečnost a soukromí (průběžně)

- RLS na každé tabulce. Pro každou novou tabulku napiš politiku a test, že cizí organizace nic nevidí.
- Soubory v privátních bucketech, přístup jen přes podepsané odkazy s krátkou platností.
- Validace vstupů na serveru (Zod), ne jen v prohlížeči.
- Omezení velikosti a typu nahrávaných souborů.
- `public_token` je náhodný a neuhádnutelný; trasa `/d/[token]` nikdy neprozradí, zda token existuje v jiné organizaci.
- Data zákazníků patří servisním firmám. V aplikaci připrav odkaz na zásady zpracování osobních údajů (obsah doplníme později, text nevymýšlej).
- Z kódu a z commitů nikdy nevypisuj klíče a hesla.

## 7. Co mi na konci každé fáze řekni

1. Co bylo uděláno (jednou nebo dvěma větami).
2. Co mám ručně otestovat a jak.
3. Co se nepovedlo nebo co je potřeba rozhodnout.
4. Jaká je další fáze.
