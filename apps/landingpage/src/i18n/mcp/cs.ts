import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Revize, termíny a závady přímo ve vašem AI asistentovi.",
  "intro": "SparxDeck MCP propojí evidenci vaší firmy s AI asistenty, jako jsou Claude, ChatGPT nebo Gemini, přes otevřený standard Model Context Protocol. Ptáte se běžnou řečí a asistent odpovídá z vašich skutečných dat.",
  "connectTitle": "Jak se připojit",
  "address": "Adresa serveru",
  "steps": [
    "Vlastník firmy zapne AI asistenty v aplikaci SparxDeck v části AI asistenti. Změny dat povoluje zvlášť.",
    "V asistentovi přidejte vlastní konektor (vzdálený MCP server) s adresou výše.",
    "Přihlaste se do SparxDecku, vyberte firmu a povolte přístup. Zrušit ho můžete kdykoli."
  ],
  "note": "Asistenty, které se nepřihlašují přes OAuth, připojíte osobním tokenem vytvořeným v aplikaci.",
  "toolsTitle": "Co asistent umí",
  "readTitle": "Čtení",
  "readGroups": [
    "Přehled a termíny",
    "Budovy a zákazníci",
    "Zařízení",
    "Revize a souhrny",
    "Závady a plán návštěv",
    "Hledání a číselníky"
  ],
  "writeTitle": "Změny, jen když je vlastník povolí",
  "writeBody": "Každá změna má dva kroky: asistent nejdřív ukáže náhled a provede ji, až když ji výslovně potvrdíte.",
  "writeGroups": [
    "Závady",
    "Plán návštěv",
    "Poznámky"
  ],
  "extras": "K dispozici jsou i zdroje (firma, typy zařízení, detail budovy, zařízení, závady a revize) a hotové instrukce: plán na další dny, zpráva pro zákazníka, příprava na návštěvu budovy a přehled otevřených závad.",
  "securityTitle": "Bezpečnost",
  "security": [
    "Ve výchozím stavu je vypnuto. Zapíná ho vlastník firmy a změny povoluje zvlášť.",
    "Asistent má stejná práva jako člen, který ho připojil, a platí stejná pravidla přístupu k datům jako v aplikaci.",
    "Každou změnu musíte výslovně potvrdit. Nic se nemaže a nevydávají se protokoly.",
    "Poloha techniků ani jejich domovy se asistentovi nikdy neukáží.",
    "Texty z evidence dostává asistent označené jako data, ne jako pokyny.",
    "Každé volání se zapisuje (kdo, kdy, jaký nástroj) a přehled vidíte v aplikaci.",
    "Počet volání je omezený, tokeny mají omezenou platnost a připojení můžete kdykoli zrušit."
  ],
  "technicalTitle": "Technické údaje",
  "technical": [
    "Model Context Protocol 2026-07-28 přes Streamable HTTP, podporovaní jsou i starší klienti z roku 2025.",
    "OAuth 2.1 s PKCE (S256), dynamická registrace klientů i Client ID Metadata Documents, tokeny vázané na tento server (RFC 8707).",
    "Rozsahy oprávnění sparxdeck:read a sparxdeck:write.",
    "Nástroje mají popisy, vstupní a výstupní schéma, anotace (jen čtení, destruktivní, idempotentní) a stránkování."
  ]
};

export default mcp;
