import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import { HeroPerspective } from "@/components/HeroPerspective";
import { LandingHeader } from "@/components/LandingHeader";
import { LocaleSwitchLink } from "@/components/LocaleSwitchLink";
import { AppCtaLink } from "@/components/AppCtaLink";
import { LandingHeroImage } from "@/components/LandingHeroImage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isLocale, localeHref, type Locale } from "@/lib/locale";
import {
  buildFaqJsonLd,
  buildPageMetadata,
  buildWebApplicationJsonLd,
} from "@/lib/seo";
import { Logo } from "@/ui/Logo";
import { GitHubIcon } from "@/components/Aside/GitHubIcon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc: Locale = isLocale(locale) ? locale : "en";
  const dict = getDictionary(loc);

  return buildPageMetadata({
    locale: loc,
    title: dict.meta.home.title,
    description: dict.meta.home.description,
    markdownAlternate: loc === "en" ? "/index.md" : undefined,
  });
}

/* ── tiny svg icons (inline to avoid extra requests) ──────────────────────── */

function IconBolt() {
  return (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3a2.25 2.25 0 00-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function IconCursorArrows() {
  return (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg aria-hidden="true" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.264.26-2.466.732-3.557" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg aria-hidden="true" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      className="shrink-0 text-muted transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

/* ── small building blocks ─────────────────────────────────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-14 text-center">
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-balance text-muted">{subtitle}</p>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────── */

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc: Locale = isLocale(locale) ? locale : "en";
  const t = getDictionary(loc);
  const l = t.landing;
  const appHref = localeHref(loc, "/app");
  const altLocale: Locale = loc === "es" ? "en" : "es";

  const jsonLd = buildWebApplicationJsonLd({
    locale: loc,
    name: "KlipCode",
    description: t.meta.home.description,
    featureList: [
      l.features.quickSave.title,
      l.features.instantCopy.title,
      l.features.folders.title,
      l.features.dragAndDrop.title,
      l.features.cloudSync.title,
      l.features.editor.title,
    ],
  });
  const faqJsonLd = buildFaqJsonLd(l.faq.items);

  const features = [
    { icon: <IconBolt />, ...l.features.quickSave },
    { icon: <IconClipboard />, ...l.features.instantCopy },
    { icon: <IconFolder />, ...l.features.folders },
    { icon: <IconCursorArrows />, ...l.features.dragAndDrop },
    { icon: <IconCloud />, ...l.features.cloudSync },
    { icon: <IconCode />, ...l.features.editor },
  ];

  const trustItems = [l.trust.anywhere, l.trust.guest, l.trust.openSource];

  const demos = [
    {
      step: "01",
      title: l.demos.create.title,
      description: l.demos.create.description,
      src: "/landing/create-snippet.gif",
      webp: "/landing/create-snippet.webp",
      width: 1200,
      height: 600,
    },
    {
      step: "02",
      title: l.demos.copy.title,
      description: l.demos.copy.description,
      src: "/landing/copy-snippets.gif",
      webp: "/landing/copy-snippets.webp",
      width: 1200,
      height: 800,
    },
    {
      step: "03",
      title: l.demos.move.title,
      description: l.demos.move.description,
      src: "/landing/move-elements.gif",
      webp: "/landing/move-elements.webp",
      width: 450,
      height: 300,
      narrow: true,
    },
  ];

  return (
    <div className="relative min-h-full overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <a href="#main-content" className="klipcode-skip-link">
        {t.common.skipToContent}
      </a>

      {/* ─── Grid background ──────────────────────────────────────────────── */}
      <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0" />

      {/* ─── Navbar ───────────────────────────────────────────────────────── */}
      <LandingHeader>
          <div className="flex items-center gap-8">
            <Link href={localeHref(loc)} className="flex items-center gap-2 text-foreground">
              <Logo className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-tight">KlipCode</span>
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              <a
                href="#features"
                className="text-xs font-medium text-muted transition-colors hover:text-foreground"
              >
                {l.nav.features}
              </a>
              <a
                href="#faq"
                className="text-xs font-medium text-muted transition-colors hover:text-foreground"
              >
                {l.nav.faq}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LocaleSwitchLink
              to={altLocale}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:text-foreground sm:text-xs"
              aria-label={altLocale === "es" ? "Español" : "English"}
            >
              <IconGlobe />
              {altLocale.toUpperCase()}
            </LocaleSwitchLink>

            <ThemeToggle
              toLightLabel={t.preferences.appearance.toLight}
              toDarkLabel={t.preferences.appearance.toDark}
            />

            <AppCtaLink
              href={appHref}
              className="group hidden items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.97] md:flex"
            >
              {l.nav.openApp}
            </AppCtaLink>
          </div>
      </LandingHeader>

      <main id="main-content">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center px-4 pt-24 pb-14 sm:px-5 sm:pt-28 sm:pb-16 md:pt-32 md:pb-24">
        {/* Subtle top gradient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-125 w-200 -translate-x-1/2 rounded-full opacity-[0.07] blur-[120px]"
          style={{ background: "radial-gradient(ellipse, var(--landing-glow) 0%, transparent 70%)" }}
        />

        <span className="landing-fade-in relative inline-flex items-center gap-2 rounded-full border border-ink/10 bg-ink/3 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-muted sm:text-xs">
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          {l.hero.badge}
        </span>

        {/* Explicit two-line structure: line 1 ("The " + highlight) is kept
            together and sized so it always fits, avoiding an orphaned "The". */}
        <h1 className="landing-fade-in relative mt-6 max-w-4xl text-center text-4xl leading-[1.15] font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          <span className="block text-balance">
            {l.hero.titleBefore}
            <span className="relative inline font-mono bg-linear-to-r from-[#8400FF] via-[#00A3FF] to-[#8400FF] bg-size-[200%_auto] animate-gradient bg-clip-text text-transparent md:inline-block">
              {l.hero.titleHighlight}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -bottom-0.5 hidden h-px bg-linear-to-r from-[#8400FF]/0 via-[#4052FF]/60 to-[#8400FF]/0 md:block"
              />
            </span>
          </span>
          <span className="block text-balance">{l.hero.titleAfter}</span>
        </h1>

        <p className="landing-fade-in landing-delay-1 mt-6 max-w-xl text-center text-base leading-relaxed text-muted sm:text-lg">
          {l.hero.subtitle}
        </p>

        <div className="landing-fade-in landing-delay-2 mt-10 flex flex-col items-center gap-3">
          <AppCtaLink
            href={appHref}
            className="group inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-background shadow-[0_0_0_1px_rgba(var(--ink-rgb),0.1),0_2px_20px_rgba(var(--ink-rgb),0.1)] transition-all hover:shadow-[0_0_0_1px_rgba(var(--ink-rgb),0.15),0_2px_30px_rgba(var(--ink-rgb),0.15)] active:scale-[0.97]"
          >
            {l.hero.cta}
          </AppCtaLink>
          <span className="text-xs text-muted">{l.hero.ctaHint}</span>
        </div>

        {/* App preview screenshot */}
        <div className="relative mt-6 w-full max-w-5xl md:mt-8">
          <HeroPerspective>
            <div className="overflow-hidden rounded-xl border border-ink/8 shadow-[0_0_80px_-20px_rgba(var(--ink-rgb),0.06)]">
              <LandingHeroImage
                alt={l.appPreview}
                width={1344}
                height={767}
                className="w-full"
              />
            </div>
          </HeroPerspective>
          {/* Bottom fade */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-1 left-0 h-24 w-full bg-linear-to-t from-background to-transparent"
          />
        </div>

        {/* Trust strip */}
        <ul className="landing-fade-in landing-delay-3 relative mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {trustItems.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-muted sm:text-[13px]">
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-ink/6 text-foreground/80">
                <IconCheck />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-5 md:py-28">
        <SectionHeading
          eyebrow={l.demos.eyebrow}
          title={l.demos.title}
          subtitle={l.demos.subtitle}
        />

        <div className="space-y-20 md:space-y-32">
          {demos.map((demo, i) => {
            const media = (
              <div
                className={
                  demo.narrow
                    ? "mx-auto w-full max-w-xs md:max-w-sm"
                    : "w-full"
                }
              >
                <div className="overflow-hidden rounded-xl border border-ink/8 bg-ink/2">
                  <picture>
                    <source srcSet={demo.webp} type="image/webp" />
                    <Image
                      src={demo.src}
                      alt={demo.title}
                      width={demo.width}
                      height={demo.height}
                      className="w-full"
                      unoptimized
                    />
                  </picture>
                </div>
              </div>
            );

            const text = (
              <div className="flex-1 space-y-4 text-center md:text-left">
                <span className="font-mono text-xs font-medium tracking-[0.25em] text-muted">
                  {demo.step}
                </span>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {demo.title}
                </h3>
                <p className="mx-auto max-w-md text-muted leading-relaxed md:mx-0">
                  {demo.description}
                </p>
              </div>
            );

            // Alternate media side per row for editorial rhythm.
            return i % 2 === 0 ? (
              <div key={demo.step} className="flex flex-col items-center gap-8 md:flex-row md:gap-16">
                {text}
                <div className="flex-1">{media}</div>
              </div>
            ) : (
              <div key={demo.step} className="flex flex-col-reverse items-center gap-8 md:flex-row md:gap-16">
                <div className="flex-1">{media}</div>
                {text}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Features grid ────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-5 md:py-28">
        <SectionHeading
          eyebrow={l.features.eyebrow}
          title={l.features.title}
          subtitle={l.features.subtitle}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-xl border border-ink/6 bg-ink/2 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/12 hover:bg-ink/4"
            >
              {/* Hairline highlight along the top edge, revealed on hover */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-ink/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-ink/6 text-foreground transition-colors duration-300 group-hover:bg-ink/10">
                {f.icon}
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 sm:px-5 md:py-28">
        <SectionHeading
          eyebrow={l.faq.eyebrow}
          title={l.faq.title}
          subtitle={l.faq.subtitle}
        />

        <div className="border-t border-ink/6">
          {l.faq.items.map((item) => (
            <details key={item.q} className="group border-b border-ink/6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[15px] font-medium text-foreground transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <IconPlus />
              </summary>
              <p className="landing-faq-answer -mt-1 max-w-2xl pb-5 text-sm leading-relaxed text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative px-4 py-20 sm:px-5 md:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-100 w-150 rounded-full opacity-[0.05] blur-[100px]"
            style={{ background: "radial-gradient(ellipse, var(--landing-glow) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {l.cta.title}
          </h2>
          <p className="mt-5 text-muted leading-relaxed">{l.cta.subtitle}</p>
          <AppCtaLink
            href={appHref}
            className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-background shadow-[0_0_0_1px_rgba(var(--ink-rgb),0.1),0_2px_20px_rgba(var(--ink-rgb),0.1)] transition-all hover:shadow-[0_0_0_1px_rgba(var(--ink-rgb),0.15),0_2px_30px_rgba(var(--ink-rgb),0.15)] active:scale-[0.97]"
          >
            {l.cta.button}
          </AppCtaLink>
        </div>
      </section>
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-ink/6 px-4 py-12 sm:px-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-sm space-y-3">
              <div className="flex items-center gap-2 text-foreground">
                <Logo className="h-5 w-5" />
                <span className="text-sm font-semibold tracking-tight">KlipCode</span>
              </div>
              <p className="text-sm text-muted">{l.footer.tagline}</p>
              <p className="text-xs leading-relaxed text-muted">{l.footer.description}</p>
            </div>

            <div className="flex gap-16">
              <div className="space-y-3">
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  {l.footer.product}
                </span>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <Link href={appHref} className="text-muted transition-colors hover:text-foreground">
                      {l.nav.openApp}
                    </Link>
                  </li>
                  <li>
                    <a href="#features" className="text-muted transition-colors hover:text-foreground">
                      {l.nav.features}
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="text-muted transition-colors hover:text-foreground">
                      {l.nav.faq}
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/martinezharo/klipcode"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      {l.footer.github}
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  {l.footer.language}
                </span>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <LocaleSwitchLink to="en" className="text-muted transition-colors hover:text-foreground">
                      English
                    </LocaleSwitchLink>
                  </li>
                  <li>
                    <LocaleSwitchLink to="es" className="text-muted transition-colors hover:text-foreground">
                      Español
                    </LocaleSwitchLink>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-ink/6 pt-6 sm:flex-row">
            <span className="text-xs text-muted">
              © {new Date().getFullYear()} KlipCode
            </span>
            <a
              href="https://github.com/martinezharo/klipcode"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex max-w-full items-center justify-center gap-2 rounded-md border border-ink/4 bg-ink/1 px-3 py-2 text-[12px] font-medium text-ink/65 shadow-sm transition-all duration-300 hover:border-ink/10 hover:bg-ink/4 hover:text-ink"
            >
              <GitHubIcon
                size={14}
                className="shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:text-ink"
              />
              <span className="truncate tracking-wide">martinezharo/klipcode</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
