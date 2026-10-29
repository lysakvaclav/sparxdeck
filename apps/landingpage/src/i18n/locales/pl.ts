import type { Dictionary } from "../types";
import home from "../home/pl";
import { SITE } from "@/config/site";
import { locales } from "../config";

const pl: Dictionary = {
  common: {
    backToHome: "Powrót do strony głównej",
  },
  header: {
    product: "Produkt",
    signIn: "Zaloguj się",
    getStarted: "Zacznij teraz",
    bookDemo: "Umów prezentację",
    company: "Firma",
    workWithUs: "Dołącz do nas",
    mission: "Nasza misja",
    team: "Zespół",
    newsroom: "Aktualności",
    careers: "Kariera",
    megaContactLabel: "Kontakt",
  },
  home,
  footer: {
    allRightsReserved: "Wszelkie prawa zastrzeżone.",
    cookiesSettings: "Cookies",
    termsOfService: "Warunki korzystania",
    privacyPolicy: "Polityka prywatności",
    companyHeading: "Firma",
    mission: "Nasza misja",
    team: "Zespół",
    newsroom: "Aktualności",
    workWithUs: "Dołącz do nas",
    careers: "Kariera",
  },
  pages: {
    mission: {
      heading: "Nasza misja",
      subheading: "Chcemy, aby technik spędzał czas przy urządzeniach, a nie nad papierami.",
      body: [
        "Przeglądy urządzeń przeciwpożarowych chronią ludzi w budynkach. Mimo to w wielu firmach serwisowych wciąż wykonuje się je tak jak dwadzieścia lat temu: technik obchodzi budynek, zapisuje wszystko na papierze, a wieczorem godzinami przepisuje notatki do protokołu. Terminy kolejnych przeglądów pilnuje się w Excelu albo z pamięci.",
        "To kosztuje czas, pieniądze i nerwy. Zapomniany przegląd oznacza utracone zlecenie, nieczytelna notatka oznacza błąd w protokole, a po zdarzeniu trudno udowodnić, co i kiedy zostało sprawdzone.",
        "SparxDeck to zmienia. Technik skanuje kod QR, odhacza listę kontrolną i protokół jest gotowy. Firma widzi wszystkie urządzenia, usterki i terminy, a każdy przegląd przynosi kolejne zlecenie. Nie budujemy kolejnego skomplikowanego systemu korporacyjnego. Tworzymy narzędzie, które można opanować w kilka minut i z którego ludzie lubią korzystać.",
      ],
    },
    about: {
      heading: "O SparxDeck",
      subheading: "Oprogramowanie dla firm serwisowych z branży ochrony przeciwpożarowej.",
      body: [
        "SparxDeck to aplikacja webowa i mobilna dla firm, które regularnie wykonują przeglądy urządzeń przeciwpożarowych: gaśnic, hydrantów, oświetlenia awaryjnego, klap i drzwi przeciwpożarowych. Zastępuje papierowe notatki i Excela jednym przejrzystym systemem.",
        `SparxDeck powstał w Czechach i jest zaprojektowany do pracy w wielu krajach. Rdzeń aplikacji jest wszędzie taki sam, zmienia się język i szablony protokołów. Aplikacja jest na razie po czesku i angielsku, ta strona w ${locales.length} językach.`,
        "Rozwijamy produkt w ścisłej współpracy z firmami serwisowymi i technikami z praktyki. Jeśli masz pomysł, co jeszcze ułatwiłoby Ci pracę, napisz do nas.",
      ],
    },
    team: {
      heading: "Zespół SparxDeck",
      subheading: "Zespół, który tworzy proste oprogramowanie dla firm serwisowych.",
    },
    careers: {
      heading: "Kariera",
      subheading:
        "Obecnie nie mamy otwartych stanowisk. Jeśli chcesz tworzyć oprogramowanie dla branży, która potrzebuje modernizacji, napisz do nas.",
    },
    news: {
      heading: "Aktualności",
      subheading: "Na razie brak aktualności. Wkrótce pojawią się tu pierwsze informacje o produkcie.",
    },
    equipmentRegister: {
      heading: "Ewidencja urządzeń i etykiety QR",
      subheading: "Wszyscy klienci, budynki i urządzenia w jednym miejscu",
      body: [
        "W SparxDeck prowadzisz klientów, ich budynki i poszczególne urządzenia w przejrzystej strukturze: gaśnice, hydranty, oświetlenie awaryjne, klapy i drzwi przeciwpożarowe. Przy każdym urządzeniu widzisz typ, lokalizację, datę ostatniego przeglądu i całą historię. Koniec z szukaniem w segregatorach czy w kilku wersjach tego samego arkusza.",
        "Aplikacja drukuje etykietę QR dla każdego urządzenia. Technik nakleja ją podczas pierwszej wizyty, a potem wystarczy jedno skanowanie, aby wiedzieć, przy którym urządzeniu stoi i co ma zrobić. Dotychczasową ewidencję z Excela zaimportujesz w kilku kliknięciach.",
      ],
    },
    fieldInspections: {
      heading: "Przegląd w terenie na telefonie",
      subheading: "Zeskanuj, odhacz, gotowe",
      body: [
        "Technik skanuje kod QR na urządzeniu i przechodzi przez listę kontrolną przygotowaną dla danego typu urządzenia, np. przy gaśnicy: ciśnienie, plomba, uszkodzenia i ważność. Każdy punkt to proste tak/nie, więc przegląd trwa chwilę i nic nie zostaje pominięte.",
        "Jeśli technik znajdzie usterkę, fotografuje ją bezpośrednio w aplikacji. Aplikacja działa bez zasięgu w piwnicy lub pomieszczeniu technicznym, a dane synchronizują się, gdy telefon znów jest online. Nie potrzeba specjalnego sprzętu ani długich szkoleń.",
      ],
    },
    inspectionReports: {
      heading: "Protokół gotowy jeszcze na miejscu",
      subheading: "Podpis na ekranie i automatyczny PDF z logo Twojej firmy",
      body: [
        "Po zakończeniu przeglądu SparxDeck automatycznie tworzy protokół PDF ze wszystkiego, co technik zapisał w terenie. Klient podpisuje go bezpośrednio na ekranie telefonu. Protokół zawiera logo i dane Twojej firmy, listę sprawdzonych urządzeń, wyniki i wykryte usterki.",
        "Protokół jednym dotknięciem wyślesz klientowi e-mailem, a pozostanie zapisany w systemie. Wygląd ustawisz w edytorze szablonów, a wydany protokół nigdy się już nie zmienia. W każdej chwili sprawdzisz, co i kiedy kontrolowano u danego klienta, na przykład podczas kontroli urzędu lub przy szkodzie ubezpieczeniowej.",
      ],
    },
    deadlineTracking: {
      heading: "Pilnowanie terminów przeglądów",
      subheading: "Żaden termin nie umknie, a każdy przegląd to kolejne zlecenie",
      body: [
        "SparxDeck wie, kiedy każde urządzenie ma kolejny przegląd. W jednym miejscu widzisz, co wygasa w przyszłym miesiącu, a system z wyprzedzeniem przypomina o zbliżających się przeglądach. Nie musisz już pilnować terminów w Excelu ani w pamięci.",
        "Dla firmy serwisowej oznacza to stały dopływ powtarzalnych zleceń. Możesz planować wyjazdy z wyprzedzeniem, odezwać się do klienta przed konkurencją i nie stracić zlecenia tylko dlatego, że ktoś zapomniał o terminie.",
      ],
    },
    defectTracking: {
      heading: "Usterki pod kontrolą",
      subheading: "Każda wykryta usterka to zadanie śledzone aż do rozwiązania",
      body: [
        "Gdy technik podczas przeglądu znajdzie usterkę, SparxDeck automatycznie tworzy z niej zadanie ze zdjęciem i opisem. Usterka nie ginie w notatkach i wiadomo, kto za nią odpowiada.",
        "Przy każdej usterce widzisz jej status (otwarta, w toku, usunięta), kto się nią zajmuje i do kiedy. Usunięcie wymaga notatki, a cała historia zmian pozostaje dostępna. Masz pewność, że wykryte problemy są naprawdę rozwiązywane, i podstawę do kolejnego zlecenia.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "Warunki korzystania ze strony i aplikacji SparxDeck (podsumowanie informacyjne, nie stanowi porady prawnej).",
      body: [
        `Niniejsze warunki regulują korzystanie ze strony i aplikacji ${SITE.name}, aplikacji webowej i mobilnej do ewidencji i przeglądów urządzeń przeciwpożarowych. Rejestrując się lub korzystając z aplikacji, akceptujesz je. Jeśli korzystasz z aplikacji w imieniu firmy, potwierdzasz, że masz do tego uprawnienia.`,
        "Aplikacja jest udostępniana w formie miesięcznego abonamentu. Cena wynika z aktualnego cennika lub indywidualnej oferty i zależy od liczby techników lub urządzeń. Abonament możesz wypowiedzieć w dowolnym momencie ze skutkiem na koniec opłaconego okresu.",
        "Odpowiadasz za swoje dane logowania i za działania użytkowników na Twoim koncie. Dane, które wprowadzasz do aplikacji, w szczególności ewidencja klientów, urządzenia, zdjęcia i protokoły, należą do Ciebie. Przetwarzamy je wyłącznie w celu świadczenia usługi i na żądanie przekażemy Ci je w formie eksportu.",
        "SparxDeck jest narzędziem do ewidencji i dokumentacji. Odpowiedzialność za fachowe wykonanie przeglądów i poprawność danych w protokołach ponosi firma serwisowa i jej uprawnieni technicy.",
        "Dokładamy starań, aby usługa była stale dostępna i bezpieczna, ale nie możemy zagwarantować, że zawsze będzie wolna od przerw i błędów. W zakresie dozwolonym przez prawo nasza odpowiedzialność jest ograniczona do wysokości opłat abonamentowych zapłaconych w ciągu ostatnich 12 miesięcy.",
        `Oprogramowanie, design i marka ${SITE.name} są chronione prawem autorskim i innymi prawami własności intelektualnej. Zabronione jest nadużywanie aplikacji, obchodzenie jej zabezpieczeń lub korzystanie z niej niezgodnie z prawem.`,
        `Niniejsze warunki podlegają prawu Republiki Czeskiej. Możemy je zmieniać, a o istotnych zmianach poinformujemy Cię z wyprzedzeniem e-mailem. W razie pytań napisz na adres ${SITE.email}.`,
      ],
    },
    privacy: {
      subheading:
        "Jak przetwarzamy dane osobowe na stronie i w aplikacji SparxDeck (podsumowanie informacyjne, nie stanowi oceny prawnej).",
      body: [
        `Administratorem danych osobowych użytkowników i odwiedzających stronę jest operator usługi ${SITE.name}. W sprawach ochrony danych osobowych skontaktuj się z nami pod adresem ${SITE.email}.`,
        "Przetwarzamy dane Twojego konta (imię i nazwisko, e-mail, telefon, firma), dane rozliczeniowe, dane techniczne niezbędne do bezpiecznego działania (adres IP, typ urządzenia, historia logowań) oraz informacje, które sam nam przekazujesz, np. umawiając prezentację.",
        "Dane, które firma serwisowa wprowadza do aplikacji na temat swoich klientów, budynków, urządzeń i przeglądów, w tym zdjęcia i podpisy, przetwarzamy jako podmiot przetwarzający w imieniu tej firmy. Warunki tego przetwarzania określa umowa powierzenia przetwarzania danych, stanowiąca część abonamentu.",
        "Przetwarzamy dane w celu świadczenia usługi i wykonania umowy, wypełnienia obowiązków prawnych (np. księgowych), na podstawie prawnie uzasadnionego interesu (bezpieczeństwo, zapobieganie nadużyciom, ulepszanie usługi), a w przypadku komunikacji marketingowej na podstawie Twojej zgody.",
        "Dane mogą przetwarzać również zaufani dostawcy, np. dostawcy infrastruktury chmurowej, usług e-mail i płatności, zawsze na podstawie umów zapewniających ochronę zgodną z RODO. Przy przekazywaniu danych poza Europejski Obszar Gospodarczy stosujemy standardowe klauzule umowne Komisji Europejskiej. Nie sprzedajemy danych osobowych.",
        "Dane przechowujemy przez czas istnienia konta, a następnie tylko tak długo, jak jest to konieczne do wypełnienia obowiązków prawnych lub ochrony naszych praw. Po zakończeniu abonamentu na żądanie eksportujemy dane Twojej firmy, a następnie je usuwamy.",
        "Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia oraz prawo sprzeciwu. Udzieloną zgodę możesz w każdej chwili wycofać. Masz również prawo wnieść skargę do organu nadzorczego ds. ochrony danych osobowych.",
      ],
    },
    cookies: {
      subheading: "Jakie pliki cookies i podobne technologie wykorzystuje strona i aplikacja SparxDeck.",
      body: [
        `Strona i aplikacja ${SITE.name} wykorzystują wyłącznie pliki cookies niezbędne do ich działania. Nie stosujemy reklamowych ani śledzących plików cookies podmiotów trzecich i nie sprzedajemy informacji o Twoim zachowaniu.`,
        "Niezbędne pliki cookies w aplikacji utrzymują Twoje zalogowanie i chronią konto przed nadużyciami. Na stronie zapisujemy w przeglądarce jedynie Twój wybór jasnego lub ciemnego motywu. Język wynika z adresu strony.",
        "Jeśli zaczniemy korzystać z narzędzi analitycznych lub innych plików cookies, które nie są niezbędne, najpierw poprosimy o Twoją zgodę i zaktualizujemy tę stronę.",
        "Pliki cookies możesz w każdej chwili usunąć lub zablokować w ustawieniach przeglądarki, zwykle w sekcji Prywatność lub Bezpieczeństwo. Bez niezbędnych plików cookies nie zalogujesz się jednak do aplikacji.",
        `Pytania dotyczące plików cookies kieruj na adres ${SITE.email}.`,
      ],
    },
  },
};

export default pl;
