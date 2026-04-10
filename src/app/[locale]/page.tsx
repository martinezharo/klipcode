import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import { HeroPerspective } from "@/components/HeroPerspective";
import { LandingHeader } from "@/components/LandingHeader";
import { Logo } from "@/ui/Logo";

type Locale = "en" | "es";

/* ── tiny svg icons (inline to avoid extra requests) ──────────────────────── */

function IconBolt() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3a2.25 2.25 0 00-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function IconCursorArrows() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.264.26-2.466.732-3.557" />
    </svg>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────── */

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = getDictionary(locale as Locale);
  const l = t.landing;
  const appHref = `/${locale}/app`;
  const altLocale = locale === "es" ? "en" : "es";
  const altHref = `/${altLocale}`;

  const features = [
    { icon: <IconBolt />, ...l.features.quickSave },
    { icon: <IconClipboard />, ...l.features.instantCopy },
    { icon: <IconFolder />, ...l.features.folders },
    { icon: <IconCursorArrows />, ...l.features.dragAndDrop },
    { icon: <IconCloud />, ...l.features.cloudSync },
    { icon: <IconCode />, ...l.features.editor },
  ];

  return (
    <div className="relative min-h-full">
      {/* ─── Grid background ──────────────────────────────────────────────── */}
      <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0" />

      {/* ─── Navbar ───────────────────────────────────────────────────────── */}
      <LandingHeader>
          <Link href={`/${locale}`} className="flex items-center gap-2 text-foreground">
            <Logo className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">KlipCode</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={altHref}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
              aria-label={altLocale === "es" ? "Español" : "English"}
            >
              <IconGlobe />
              {altLocale.toUpperCase()}
            </Link>

            <Link
              href={appHref}
              className="group flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-[#0a0a0a] transition-all hover:bg-white/90 active:scale-[0.97]"
            >
              {l.nav.openApp}
              <IconArrowRight />
            </Link>
          </div>
      </LandingHeader>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center px-5 pt-28 pb-16 md:pt-36 md:pb-24">
        {/* Subtle top gradient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-125 w-200 -translate-x-1/2 rounded-full opacity-[0.07] blur-[120px]"
          style={{ background: "radial-gradient(ellipse, #ffffff 0%, transparent 70%)" }}
        />

        <h1 className="landing-fade-in relative max-w-3xl text-center text-4xl leading-[1.1] font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl whitespace-pre-line">
          {l.hero.titleBefore}
          <span className="relative inline-block font-mono bg-linear-to-r from-[#8400FF] via-[#00A3FF] to-[#8400FF] bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">
            {l.hero.titleHighlight}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px bg-linear-to-r from-[#8400FF]/0 via-[#4052FF]/60 to-[#8400FF]/0"
            />
          </span>
          {l.hero.titleAfter}
        </h1>

        <p className="landing-fade-in landing-delay-1 mt-6 max-w-xl text-center text-base leading-relaxed text-muted sm:text-lg">
          {l.hero.subtitle}
        </p>

        <div className="landing-fade-in landing-delay-2 mt-10 flex flex-col items-center gap-3">
          <Link
            href={appHref}
            className="group inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#0a0a0a] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_20px_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_2px_30px_rgba(255,255,255,0.15)] active:scale-[0.97]"
          >
            {l.hero.cta}
            <IconArrowRight />
          </Link>
          <span className="text-xs text-muted/70">{l.hero.ctaHint}</span>
        </div>

        {/* App preview screenshot */}
        <div className="landing-fade-in landing-delay-3 relative mt-6 w-full max-w-5xl md:mt-8">
          <HeroPerspective>
            <div className="overflow-hidden rounded-xl border border-white/8 shadow-[0_0_80px_-20px_rgba(255,255,255,0.06)]">
              <Image
                src="/landing/ui.webp"
                alt={l.appPreview}
                width={1920}
                height={1080}
                className="w-full"
                priority
              />
            </div>
          </HeroPerspective>
          {/* Bottom fade */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-1 left-0 h-24 w-full bg-linear-to-t from-[#0a0a0a] to-transparent"
          />
        </div>
      </section>

      {/* ─── Demo sections ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl space-y-24 px-5 py-20 md:space-y-32 md:py-28">
        {/* Create snippet */}
        <div className="flex flex-col items-center gap-10 md:flex-row md:gap-16">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {l.demos.create.title}
            </h2>
            <p className="max-w-md text-muted leading-relaxed">
              {l.demos.create.description}
            </p>
          </div>
          <div className="flex-1">
            <div className="overflow-hidden rounded-xl border border-white/8">
              <Image
                src="/landing/create-snippet.gif"
                alt={l.demos.create.title}
                width={1200}
                height={600}
                className="w-full"
                unoptimized
              />
            </div>
          </div>
        </div>

        {/* Copy snippet — reversed */}
        <div className="flex flex-col-reverse items-center gap-10 md:flex-row md:gap-16">
          <div className="flex-1">
            <div className="overflow-hidden rounded-xl border border-white/8">
              <Image
                src="/landing/copy-snippets.gif"
                alt={l.demos.copy.title}
                width={1200}
                height={800}
                className="w-full"
                unoptimized
              />
            </div>
          </div>
          <div className="flex-1 space-y-4 text-center md:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {l.demos.copy.title}
            </h2>
            <p className="max-w-md text-muted leading-relaxed">
              {l.demos.copy.description}
            </p>
          </div>
        </div>

        {/* Move elements */}
        <div className="flex flex-col items-center gap-10 md:flex-row md:gap-16">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {l.demos.move.title}
            </h2>
            <p className="max-w-md text-muted leading-relaxed">
              {l.demos.move.description}
            </p>
          </div>
          <div className="w-full max-w-xs md:flex-1">
            <div className="mx-auto overflow-hidden rounded-xl border border-white/8 md:max-w-sm">
              <Image
                src="/landing/move-elements.gif"
                alt={l.demos.move.title}
                width={450}
                height={300}
                className="w-full"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features grid ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="mb-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {l.features.title}
          </h2>
          <p className="mt-4 text-muted">{l.features.subtitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-white/6 bg-white/2 p-6 transition-colors hover:border-white/10 hover:bg-white/4"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white/6 text-foreground">
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

      {/* ─── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative px-5 py-24 md:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-100 w-150 rounded-full opacity-[0.05] blur-[100px]"
            style={{ background: "radial-gradient(ellipse, #ffffff 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {l.cta.title}
          </h2>
          <p className="mt-5 text-muted leading-relaxed">{l.cta.subtitle}</p>
          <Link
            href={appHref}
            className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0a0a0a] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_20px_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_2px_30px_rgba(255,255,255,0.15)] active:scale-[0.97]"
          >
            {l.cta.button}
            <IconArrowRight />
          </Link>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-muted">
            <Logo className="h-4 w-4" />
            <span className="text-xs">{l.footer.tagline}</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/martinezharo/klipcode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              {l.footer.source}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
