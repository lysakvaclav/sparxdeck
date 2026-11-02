import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Przeglądy, terminy i usterki bezpośrednio w Twoim asystencie AI.",
  "intro": "SparxDeck MCP łączy ewidencję Twojej firmy z asystentami AI, takimi jak Claude, ChatGPT czy Gemini, przez otwarty standard Model Context Protocol. Pytasz zwykłym językiem, a asystent odpowiada na podstawie Twoich prawdziwych danych.",
  "connectTitle": "Jak się połączyć",
  "address": "Adres serwera",
  "steps": [
    "Właściciel firmy włącza asystentów AI w aplikacji SparxDeck w sekcji Asystenci AI. Zmiany danych zezwala osobno.",
    "W asystencie dodaj własny konektor (zdalny serwer MCP) z adresem powyżej.",
    "Zaloguj się do SparxDeck, wybierz firmę i zezwól na dostęp. Możesz go w każdej chwili cofnąć."
  ],
  "note": "Asystentów, którzy nie logują się przez OAuth, połączysz osobistym tokenem utworzonym w aplikacji.",
  "toolsTitle": "Co potrafi asystent",
  "readTitle": "Odczyt",
  "readGroups": [
    "Przegląd i terminy",
    "Budynki i klienci",
    "Urządzenia",
    "Przeglądy i podsumowania",
    "Usterki i plan wizyt",
    "Wyszukiwanie i listy"
  ],
  "writeTitle": "Zmiany, tylko gdy właściciel na nie zezwoli",
  "writeBody": "Każda zmiana ma dwa kroki: asystent najpierw pokazuje podgląd i wykonuje ją dopiero po Twoim wyraźnym potwierdzeniu.",
  "writeGroups": [
    "Usterki",
    "Plan wizyt",
    "Notatki"
  ],
  "extras": "Dostępne są też zasoby (firma, typy urządzeń, szczegóły budynku, urządzenia, usterki i przeglądu) oraz gotowe polecenia: plan na najbliższe dni, raport dla klienta, przygotowanie do wizyty w budynku i przegląd otwartych usterek.",
  "securityTitle": "Bezpieczeństwo",
  "security": [
    "Domyślnie wyłączone. Włącza je właściciel firmy, a zmiany zezwala osobno.",
    "Asystent ma te same uprawnienia co członek, który go połączył, i obowiązują te same zasady dostępu co w aplikacji.",
    "Każdą zmianę musisz wyraźnie potwierdzić. Nic nie jest usuwane i nie są wystawiane protokoły.",
    "Lokalizacja techników ani ich miejsca zamieszkania nigdy nie są pokazywane asystentowi.",
    "Teksty z ewidencji asystent otrzymuje oznaczone jako dane, a nie polecenia.",
    "Każde wywołanie jest zapisywane (kto, kiedy, jakie narzędzie), a podsumowanie widzisz w aplikacji.",
    "Liczba wywołań jest ograniczona, tokeny wygasają, a połączenie możesz w każdej chwili cofnąć."
  ],
  "technicalTitle": "Dane techniczne",
  "technical": [
    "Model Context Protocol 2026-07-28 przez Streamable HTTP; obsługiwani są też starsi klienci z 2025 roku.",
    "OAuth 2.1 z PKCE (S256), dynamiczna rejestracja klientów i Client ID Metadata Documents, tokeny powiązane z tym serwerem (RFC 8707).",
    "Zakresy uprawnień sparxdeck:read i sparxdeck:write.",
    "Narzędzia mają opisy, schematy wejścia i wyjścia, adnotacje (tylko odczyt, destrukcyjne, idempotentne) i stronicowanie."
  ]
};

export default mcp;
