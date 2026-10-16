import type messages from "../messages/cs.json";
import type { Locale } from "./i18n/config";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    // Czech is the source of truth; en.json is checked against it in tests.
    Messages: typeof messages;
  }
}
