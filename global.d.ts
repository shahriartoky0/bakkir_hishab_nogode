import type bn from "./messages/bn.json";
import type { AppLocale } from "./src/presentation/i18n/config";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof bn;
  }
}
