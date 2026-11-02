import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Kontrollet, afatet dhe defektet drejtpërdrejt në asistentin tuaj të IA-së.",
  "intro": "SparxDeck MCP lidh të dhënat e kompanisë suaj me asistentë të IA-së si Claude, ChatGPT ose Gemini përmes standardit të hapur Model Context Protocol. Pyesni me fjalë të thjeshta dhe asistenti përgjigjet nga të dhënat tuaja të vërteta.",
  "connectTitle": "Si të lidheni",
  "address": "Adresa e serverit",
  "steps": [
    "Pronari i kompanisë aktivizon asistentët e IA-së në aplikacionin SparxDeck, te Asistentët e IA-së. Ndryshimet e të dhënave i lejon veçmas.",
    "Në asistentin tuaj shtoni një lidhës të personalizuar (server MCP në distancë) me adresën më sipër.",
    "Hyni në SparxDeck, zgjidhni kompaninë dhe lejoni qasjen. Mund ta anuloni në çdo kohë."
  ],
  "note": "Asistentët që nuk hyjnë me OAuth i lidhni me një token personal të krijuar në aplikacion.",
  "toolsTitle": "Çfarë mund të bëjë asistenti",
  "readTitle": "Leximi",
  "readGroups": [
    "Përmbledhje dhe afate",
    "Ndërtesa dhe klientë",
    "Pajisje",
    "Kontrolle dhe përmbledhje",
    "Defekte dhe vizita të planifikuara",
    "Kërkim dhe lista"
  ],
  "writeTitle": "Ndryshime, vetëm kur i lejon pronari",
  "writeBody": "Çdo ndryshim ka dy hapa: asistenti së pari tregon një parapamje dhe e kryen vetëm pasi ta konfirmoni shprehimisht.",
  "writeGroups": [
    "Defekte",
    "Plani i vizitave",
    "Shënime"
  ],
  "extras": "Ka edhe burime (kompania, llojet e pajisjeve, detajet e ndërtesës, pajisjes, defektit dhe kontrollit) dhe udhëzime të gatshme: plan për ditët në vijim, raport për klientin, përgatitje për vizitën e një ndërtese dhe përmbledhje e defekteve të hapura.",
  "securityTitle": "Siguria",
  "security": [
    "Si parazgjedhje është i çaktivizuar. E aktivizon pronari i kompanisë dhe ndryshimet i lejon veçmas.",
    "Asistenti ka të njëjtat të drejta si anëtari që e lidhi, me të njëjtat rregulla qasjeje si në aplikacion.",
    "Çdo ndryshim duhet ta konfirmoni shprehimisht. Asgjë nuk fshihet dhe nuk lëshohen raporte.",
    "Vendndodhja e teknikëve dhe shtëpitë e tyre nuk i tregohen kurrë asistentit.",
    "Tekstet nga të dhënat i vijnë asistentit të shënuara si të dhëna, jo si udhëzime.",
    "Çdo thirrje regjistrohet (kush, kur, cili mjet) dhe përmbledhjen e shihni në aplikacion.",
    "Numri i thirrjeve është i kufizuar, tokenët skadojnë dhe lidhjen mund ta anuloni në çdo kohë."
  ],
  "technicalTitle": "Të dhëna teknike",
  "technical": [
    "Model Context Protocol 2026-07-28 përmes Streamable HTTP; mbështeten edhe klientët më të vjetër të vitit 2025.",
    "OAuth 2.1 me PKCE (S256), regjistrim dinamik i klientëve dhe Client ID Metadata Documents, tokenë të lidhur me këtë server (RFC 8707).",
    "Fushëveprimet sparxdeck:read dhe sparxdeck:write.",
    "Mjetet kanë përshkrime, skema hyrëse dhe dalëse, shënime (vetëm lexim, shkatërrues, idempotent) dhe faqosje."
  ]
};

export default mcp;
