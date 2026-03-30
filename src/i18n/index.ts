import { en } from "@/i18n/en";
import { es } from "@/i18n/es";

export function getDictionary(locale: "en" | "es") {
  return locale === "es" ? es : en;
}

export type Dictionary = ReturnType<typeof getDictionary>;