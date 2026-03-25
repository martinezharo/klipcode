import { es } from "@/i18n/es";

export function getDictionary() {
  return es;
}

export type Dictionary = ReturnType<typeof getDictionary>;