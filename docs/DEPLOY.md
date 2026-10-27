# Spuštění platformy (portal.sparxdeck.com)

Postup od účtů po první produkční revizi. Všechno v kódu je připravené; tady jsou kroky v administraci služeb, které musí udělat majitel účtů. Odhad: 2–3 hodiny poprvé.

## 1. Účty a rozhodnutí

| Služba | K čemu | Plán |
|---|---|---|
| **Vercel** | běh aplikace a týdenní úloha | **Pro** (bezplatný plán nesmí sloužit komerčnímu provozu) |
| **Supabase** | databáze, přihlášení, soubory | **Pro** pro produkci: denní zálohy (7 dní), volitelně obnova k libovolnému okamžiku (PITR) |
| **Resend** | e-maily (pozvánky, protokoly, týdenní souhrn, přihlášení) | bezplatný plán stačí na začátek (3 000 e-mailů měsíčně) |
| **Sentry** | hlášení chyb | bezplatný plán; při zakládání zvolit **EU** |
| **GitHub** | kód a automatické kontroly | stávající repozitář |
| Doména | `portal.sparxdeck.com`, odesílací doména e-mailů | stávající `sparxdeck.com` |

Prostředí jsou dvě:
- **Vývoj:** současný projekt Supabase `zclhipzzqvhmpqxxaust`. Používá ho lokální vývoj, náhledy na Vercelu a testy.
- **Produkce:** nový projekt Supabase. Vidí ho jen produkční nasazení a nikdy v něm neběží testy.

## 2. Supabase: produkční projekt

1. Založte nový projekt v regionu **EU** (Frankfurt nebo Irsko). Silné heslo databáze uložte do správce hesel.
2. Do `apps/platform/.env.prod.local` (git ho ignoruje) zapište produkční hodnoty podle `.env.example`. Platí to hlavně pro `SUPABASE_DB_URL`: *Connect → Session pooler*.
3. Nahrajte databázi:
   ```
   cd apps/platform
   npm run db:push:production -- --dry-run   # jen vypíše, co by se nahrálo
   npm run db:push:production                # zeptá se na referenci projektu
   ```
4. *Authentication → URL Configuration:* Site URL `https://portal.sparxdeck.com`, Redirect URLs `https://portal.sparxdeck.com/**`.
5. *Authentication → Email Templates:* vložte soubory ze `supabase/templates/` (předměty jsou v `subjects.json`).
6. *Authentication → SMTP Settings:* Resend (host `smtp.resend.com`, port `465`, uživatel `resend`, heslo = Resend API klíč, odesílatel `noreply@sparxdeck.com`).
7. *Database → Backups:* ověřte, že běží denní zálohy (plán Pro).

## 3. Resend

1. Přidejte doménu `sparxdeck.com` a do DNS vložte záznamy, které Resend ukáže (SPF, DKIM, případně DMARC).
2. Po ověření vytvořte API klíč s právem odesílat. Ten jde do Vercelu (`RESEND_API_KEY`) i do SMTP v Supabase.

## 4. Sentry (volitelné, doporučené)

Založte projekt typu Next.js v **EU** regionu. Do Vercelu patří `NEXT_PUBLIC_SENTRY_DSN`. Pro čitelné chyby přidejte také `SENTRY_ORG`, `SENTRY_PROJECT` a `SENTRY_AUTH_TOKEN` (token s právem nahrávat zdrojové mapy). Bez DSN aplikace nic neposílá.

## 5. Vercel

1. *Add New → Project*, vyberte repozitář. **Root Directory:** `apps/platform`. Framework: Next.js.
2. **Install Command:** `npm ci --prefix . --legacy-peer-deps` (platforma má vlastní `package-lock.json`).
3. *Settings → Functions → Region:* `fra1` (Frankfurt, blízko databáze).
4. Proměnné prostředí (*Settings → Environment Variables*):

   | Proměnná | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_APP_URL` | `https://portal.sparxdeck.com` | adresa náhledu nebo vývojová |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | produkční projekt | vývojový projekt |
   | `RESEND_API_KEY`, `EMAIL_FROM` | ano | nechat prázdné (náhledy e-maily neposílají) |
   | `CRON_SECRET` | dlouhý náhodný řetězec | nechat prázdné |
   | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | ano | volitelně |

5. *Settings → Domains:* přidejte `portal.sparxdeck.com` a u registrátora nastavte CNAME na `cname.vercel-dns.com`.
6. Týdenní souhrn se naplánuje sám podle `vercel.json` (pondělí 5:00 UTC). Vercel posílá `CRON_SECRET` automaticky.

Landing page je samostatný projekt Vercel (Root Directory `apps/landingpage`, doména `sparxdeck.com`).

Landing page: Root Directory `apps/landingpage`, Install Command `npm ci --prefix .`, Next.js zafixovaný na 16.1.1. Adresy nastavují proměnné `NEXT_PUBLIC_SITE_URL` a `NEXT_PUBLIC_APP_URL` (výchozí `sparxdeck.com` a `portal.sparxdeck.com`); platforma odkazuje na landing page přes `NEXT_PUBLIC_MARKETING_URL`.

**Současný stav (2026-10-20):** tým Vercel `sparxdeck`, projekt `sparxdeck` (landing page) na https://sparxdeck.com, projekt `sparxdeck-app` (platforma) na https://portal.sparxdeck.com, produkční Supabase `ellnjenfqupwqelsojjg` s migracemi do části 19 (poslední nasazení 2026-10-25). DNS u Spaceship. Projekty nemají napojený Git: nasazuje se z kořene repozitáře přes `vercel deploy --prod` (platforma s `VERCEL_PROJECT_ID` projektu `sparxdeck-app`). Chybí: Site URL a Redirect URLs v Supabase (bod 4 výše), Resend a Sentry.

**Past při nahrávání migrací:** `supabase db push` posílá příkazy migrace jeden po druhém a při chybě nevrací ty už provedené. Selže-li migrace v polovině, zjistit stav (`supabase db query --db-url …`), doplnit zbytek po jednotlivých příkazech a migraci označit `supabase migration repair --status applied <verze> --db-url …`.

## 6. Kontrola po nasazení

- [ ] `https://portal.sparxdeck.com/api/health` vrátí `{"status":"ok","database":"ok"}`.
- [ ] Registrace nového účtu: potvrzovací e-mail dorazí a odkaz funguje.
- [ ] Založení firmy, pozvánka kolegy: e-mail dorazí.
- [ ] Zákazník, budova, zařízení. **Tisk štítku z produkční adresy:** QR musí vést na `portal.sparxdeck.com`.
- [ ] Naskenování štítku telefonem: otevře se zařízení (fotoaparát funguje jen přes HTTPS, tady poprvé naostro).
- [ ] Revize na telefonu až po protokol, stažení PDF, odeslání protokolu e-mailem sobě.
- [ ] Náhled týdenního souhrnu: `curl -H "Authorization: Bearer <CRON_SECRET>" "https://portal.sparxdeck.com/api/cron/weekly-summary?dry"`.
- [ ] Sentry: v prohlížeči na produkci se vyvolaná chyba objeví v Sentry (volitelné).
- [ ] Hlídání dostupnosti (např. Better Stack nebo UptimeRobot) míří na `/api/health` a upozorní e-mailem.
- [ ] Instalace na plochu: v Chrome na Androidu „Nainstalovat aplikaci“, v Safari na iPhonu „Sdílet → Přidat na plochu“.

## 7. Zálohy a obnovení

**Databáze:** Supabase Pro dělá denní zálohu a drží ji 7 dní (s PITR na libovolný okamžik). Obnovuje se v *Database → Backups*. Obnovení přepíše databázi, proto ho nejdřív zkuste do nového projektu (*Restore to a new project*).

**Soubory** (loga, fotky, PDF protokolů) nejsou v zálohách databáze. Zálohujte je skriptem, jednou týdně a vždy před větším zásahem:
```
cd apps/platform
node --env-file=.env.prod.local scripts/backup-storage.mjs            # do backups/storage-<datum>
node --env-file=.env.prod.local scripts/restore-storage.mjs <složka>  # nahraje zpět
```

**Zkouška obnovení** (jednou za čtvrtletí, poprvé před prvním zákazníkem):
1. Obnovte poslední zálohu databáze do nového dočasného projektu Supabase.
2. Do něj nahrajte soubory skriptem `restore-storage.mjs` (s `.env` dočasného projektu).
3. Spusťte aplikaci lokálně proti dočasnému projektu. Přihlaste se, otevřete zařízení, stáhněte protokol a porovnejte počty firem a zařízení s produkcí.
4. Dočasný projekt smažte a výsledek zapište do `docs/ROADMAP.md` (datum, kdo, výsledek).

## 8. Vydávání změn

1. Změna jde přes pull request. GitHub Actions spustí lint, typy, testy a build (`.github/workflows/platform.yml`).
2. Test celého hlavního toku poběží v CI po nastavení proměnné `RUN_MAIN_FLOW=true` a tajemství `DEV_SUPABASE_URL`, `DEV_SUPABASE_PUBLISHABLE_KEY` a `DEV_SUPABASE_SECRET_KEY` (vývojový projekt). Lokálně stačí `npm run build && npm run test:flow`.
3. Nové migrace se nahrávají do produkce **před** nasazením kódu, který je potřebuje (`npm run db:push:production`). Migrace jsou psané tak, aby starší kód fungoval i po nich.
4. Po sloučení do hlavní větve Vercel nasadí produkci sám. Projděte rychle body z části 6, které se změny týkají.

## 9. Klíče

Klíče z vývoje nikdy nepoužívejte v produkci. Kdyby klíč unikl (např. do commitu nebo e-mailu):
1. V Supabase vygenerujte nový *secret key* (*Settings → API Keys*).
2. Ve Vercelu ho vyměňte a nasaďte znovu.
3. Starý klíč zrušte.

Stejně se mění `CRON_SECRET`, Resend a Sentry token.

## 10. Podkladová mapa pro mapu budov

Mapa budov (část 21) kreslí skutečnou mapu z vlastních souborů. Žádný veřejný server dlaždic ani geokódování se nepoužívá; prohlížeč čte jen z naší adresy (lokálně) nebo ze Supabase Storage (produkce). Bez nastavené složky ukáže obrys Česka (Natural Earth, `src/assets/map/cz-outline.json`) a mřížku.

**Obsah složky** (`NEXT_PUBLIC_MAP_BASE_URL`), asi 920 MB:

| Soubor | Co to je | Velikost |
|---|---|---|
| `world.pmtiles` | celý svět, přiblížení 0–6 (státy, řeky, velká města) | 45 MB |
| `detail.pmtiles` | Česko (obdélník 12,09–18,86 / 48,55–51,06) do přiblížení 14: ulice, budovy, názvy | 875 MB |
| `fonts/Noto Sans {Regular,Medium,Italic}/*.pbf` + `fonts/OFL.txt` | písmo popisků (OFL) | 30 MB |
| `sprites/v4/{light,dark}[@2x].{json,png}` | ikony míst (MIT) | 0,1 MB |

Mimo Česko je při větším přiblížení vidět jen pevnina a voda; další země = další výřez a třetí zdroj v `site-map-canvas.tsx`.

**Příprava souborů** (data OpenStreetMap ve formátu Protomaps, ODbL):

1. Nástroj [`pmtiles`](https://github.com/protomaps/go-pmtiles/releases) (ověřit kontrolní součet SHA256 z vydání).
2. Denní build Protomaps je na `https://build.protomaps.com/YYYYMMDD.pmtiles` (aktuální v `https://build-metadata.protomaps.dev/builds.json`). Celý soubor se nestahuje, `extract` čte jen potřebné části:
   - `pmtiles extract https://build.protomaps.com/<datum>.pmtiles world.pmtiles --maxzoom=6`
   - `pmtiles extract https://build.protomaps.com/<datum>.pmtiles detail.pmtiles --bbox=12.09,48.55,18.86,51.06 --maxzoom=14`
3. Písma a ikony z repozitáře [`protomaps/basemaps-assets`](https://github.com/protomaps/basemaps-assets): složky `fonts/Noto Sans Regular`, `Noto Sans Medium`, `Noto Sans Italic` (+ `OFL.txt`) a `sprites/v4/light*`, `dark*`.

Použitá verze: build 2026-10-27 (tiles v4.15.2), `@protomaps/basemaps` 5.7.2. Styl (`layers()` z `@protomaps/basemaps`) musí odpovídat verzi dlaždic (v4); při přechodu na v5 aktualizovat obojí.

**Lokálně:** soubory do `apps/platform/public/vendor/map/` (ignoruje git i `.vercelignore`) a do `.env.local` `NEXT_PUBLIC_MAP_BASE_URL=/vendor/map`. Proxy na `/vendor/` nepouští (čtení po částech, HTTP Range, nesmí skončit přesměrováním na přihlášení).

**Produkce:**

1. Veřejný bucket `map` v produkčním Supabase (soubory jsou veřejná data OpenStreetMap, nic firemního). Soubor 875 MB vyžaduje placený plán: free plán má limit 50 MB na soubor a 1 GB úložiště. Nahrávat přes resumable upload (TUS), např. Supabase CLI `supabase storage cp -r ./map ss:///map --experimental` nebo v Dashboardu.
2. Ve Vercelu `NEXT_PUBLIC_MAP_BASE_URL=https://<projekt>.supabase.co/storage/v1/object/public/map` a nové nasazení (proměnná se vkládá při buildu). Adresa Supabase už v CSP je; jiný host by se musel přidat do `connect-src` (`src/lib/security-headers.ts`).
3. Ověřit: `curl -r 0-126 <adresa>/world.pmtiles -o /dev/null -w "%{http_code}"` vrací `206`.
4. Přenos: mapa načítá jen dlaždice zobrazeného výřezu (desítky až stovky kB na zobrazení), prohlížeč je drží v cache.

**Licence:** mapa sama ukazuje „© OpenStreetMap, Protomaps“ (ODbL vyžaduje uvedení). Písmo Noto Sans je OFL, ikony MIT.

**Aktualizace:** jednou za čas (nové ulice) stejným postupem a nahrát přes staré soubory.
