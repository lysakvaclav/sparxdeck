import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Pregledi, rokovi i nedostaci direktno u vašem AI asistentu.",
  "intro": "SparxDeck MCP povezuje evidenciju vaše firme s AI asistentima kao što su Claude, ChatGPT ili Gemini preko otvorenog standarda Model Context Protocol. Pitate običnim jezikom, a asistent odgovara iz vaših stvarnih podataka.",
  "connectTitle": "Kako se povezati",
  "address": "Adresa servera",
  "steps": [
    "Vlasnik firme uključuje AI asistente u aplikaciji SparxDeck u dijelu AI asistenti. Izmjene podataka dozvoljava posebno.",
    "U asistentu dodajte sopstveni konektor (udaljeni MCP server) s adresom iznad.",
    "Prijavite se u SparxDeck, izaberite firmu i dozvolite pristup. Možete ga opozvati u svakom trenutku."
  ],
  "note": "Asistente koji se ne prijavljuju preko OAuth-a povezujete ličnim tokenom napravljenim u aplikaciji.",
  "toolsTitle": "Što asistent umije",
  "readTitle": "Čitanje",
  "readGroups": [
    "Pregled i rokovi",
    "Zgrade i klijenti",
    "Uređaji",
    "Pregledi i zbirni izvještaji",
    "Nedostaci i plan posjeta",
    "Pretraga i šifarnici"
  ],
  "writeTitle": "Izmjene, samo ako ih vlasnik dozvoli",
  "writeBody": "Svaka izmjena ima dva koraka: asistent prvo pokaže pregled i izvrši je tek kad je izričito potvrdite.",
  "writeGroups": [
    "Nedostaci",
    "Plan posjeta",
    "Bilješke"
  ],
  "extras": "Dostupni su i resursi (firma, tipovi uređaja, detalji zgrade, uređaja, nedostatka i pregleda) i gotova uputstva: plan za naredne dane, izvještaj za klijenta, priprema za posjetu zgradi i pregled otvorenih nedostataka.",
  "securityTitle": "Bezbjednost",
  "security": [
    "Podrazumijevano je isključeno. Uključuje ga vlasnik firme, a izmjene dozvoljava posebno.",
    "Asistent ima ista prava kao član koji ga je povezao, uz ista pravila pristupa podacima kao u aplikaciji.",
    "Svaku izmjenu morate izričito potvrditi. Ništa se ne briše i ne izdaju se zapisnici.",
    "Lokacija tehničara ni njihovi domovi se asistentu nikad ne prikazuju.",
    "Tekstovi iz evidencije stižu asistentu označeni kao podaci, a ne kao uputstva.",
    "Svaki poziv se bilježi (ko, kad, koji alat), a pregled vidite u aplikaciji.",
    "Broj poziva je ograničen, tokeni ističu, a vezu možete opozvati u svakom trenutku."
  ],
  "technicalTitle": "Tehnički podaci",
  "technical": [
    "Model Context Protocol 2026-07-28 preko Streamable HTTP; podržani su i stariji klijenti iz 2025.",
    "OAuth 2.1 s PKCE (S256), dinamička registracija klijenata i Client ID Metadata Documents, tokeni vezani za ovaj server (RFC 8707).",
    "Opsezi ovlašćenja sparxdeck:read i sparxdeck:write.",
    "Alati imaju opise, ulazne i izlazne šeme, napomene (samo čitanje, destruktivno, idempotentno) i straničenje."
  ]
};

export default mcp;
