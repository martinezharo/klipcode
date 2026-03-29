import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LANGUAGES } from "@/lib/constants/languages";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSnippetDisplayName(title: string, language: string, untitledLabel: string): string {
  const extension = LANGUAGES.find((l) => l.id === language)?.extension ?? "";
  const baseName = title || untitledLabel;
  if (!extension || baseName.endsWith(extension)) return baseName;
  return `${baseName}${extension}`;
}
