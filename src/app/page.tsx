import { redirect } from "next/navigation";
import { headers } from "next/headers";

function detectLocale(acceptLanguage: string | null): "en" | "es" {
  if (!acceptLanguage) return "en";
  const langs = acceptLanguage.split(",").map((l) => l.split(";")[0].trim().toLowerCase());
  for (const lang of langs) {
    const code = lang.split("-")[0];
    if (code === "es") return "es";
    if (code === "en") return "en";
  }
  return "en";
}

export default async function Home() {
  const headersList = await headers();
  const locale = detectLocale(headersList.get("accept-language"));
  redirect(`/${locale}`);
}
