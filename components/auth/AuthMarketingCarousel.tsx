"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/Icons";

type MarketingSlide = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
};

const slides: MarketingSlide[] = [
  { title: "Scan & Catalog", description: "Add cards to your vault with a fast, mobile-first cataloging flow.", image: "/arcalogo/firstcard.front.jpg", imageAlt: "Featured collectible card" },
  { title: "Track Value", description: "Follow collection value, favorite cards, and future market movement.", image: "/arcalogo/wemby.front.webp", imageAlt: "Wembanyama collectible card" },
  { title: "Organize Everything", description: "Sort by player, sport, year, brand, set, grade, and collection.", image: "/arcalogo/mj.card.jpg", imageAlt: "Michael Jordan collectible card" },
  { title: "Secure & Private", description: "Keep your personal collection organized inside a private digital vault.", image: "/arcalogo/arca.arch.png", imageAlt: "ARCA arch emblem" },
  { title: "Connect & Trade", description: "Prepare your collection for future sharing, trading, and marketplace tools.", image: "/arcalogo/russ.dt.webp", imageAlt: "Featured collector card" },
];

const features = ["Scan", "Organize", "Track Value", "Secure", "Trade"];

export default function AuthMarketingCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const carouselRef = useRef<HTMLDivElement>(null);
  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (paused) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeIndex, paused]);

  function selectSlide(index: number) {
    setActiveIndex((index + slides.length) % slides.length);
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
  }

  return (
    <section
      className="relative flex min-h-[38rem] flex-col overflow-hidden rounded-[1.5rem] border border-[#3e3523] bg-[#080806] p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,.5)] sm:p-8 lg:min-h-0 lg:p-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={handleBlur}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(201,164,93,.18),transparent_32%),radial-gradient(circle_at_82%_82%,rgba(138,103,51,.13),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a45d]/70 to-transparent" />

      <header className="relative z-10 flex items-center justify-between">
        <div className="relative h-12 w-12 sm:h-14 sm:w-14">
          <Image src="/arcalogo/arca.simple.a.png" alt="ARCA" fill sizes="56px" className="object-contain lg:hidden" />
          <Image src="/arcalogo/arca.logo.a.png" alt="ARCA" fill sizes="56px" className="hidden object-contain lg:block" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c9a45d]">Private collector archive</p>
      </header>

      <div className="relative z-10 mt-8 grid flex-1 items-center gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(230px,.72fr)]">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Your collection. Preserved.</p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,5.4vw,5.3rem)] font-medium leading-[.94] tracking-[-.035em] text-[#f7f2e8]">
            The Ultimate <span className="text-[#c9a45d]">Digital Vault</span> for Collectors
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
            Catalog, organize, and protect your collection with powerful tools built for collectors, by collectors.
          </p>

          <div ref={carouselRef} className="mt-8 border-l border-[#c9a45d]/45 pl-5" aria-roledescription="carousel" aria-label="ARCA features" aria-live={paused ? "polite" : "off"}>
            <div key={activeSlide.title} className="cinematic-enter min-h-28">
              <p className="font-display text-3xl font-medium text-[#f7f2e8]">{activeSlide.title}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/50">{activeSlide.description}</p>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={() => selectSlide(activeIndex - 1)} aria-label="Previous feature" className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-white/15 text-white/65 hover:border-[#c9a45d]/70 hover:text-[#c9a45d]"><ArrowLeftIcon /></button>
              <button type="button" onClick={() => selectSlide(activeIndex + 1)} aria-label="Next feature" className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-white/15 text-white/65 hover:border-[#c9a45d]/70 hover:text-[#c9a45d]"><ArrowRightIcon /></button>
              <span className="ml-1 text-xs font-semibold tabular-nums tracking-[0.16em] text-white/45">{String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
              <div className="ml-auto flex gap-2" aria-label="Choose feature">
                {slides.map((slide, index) => <button key={slide.title} type="button" onClick={() => selectSlide(index)} aria-label={`Show ${slide.title}`} aria-current={index === activeIndex ? "true" : undefined} className="flex h-11 w-5 touch-manipulation items-center justify-center"><span className={`block h-1 rounded-full transition-all ${index === activeIndex ? "w-5 bg-[#c9a45d]" : "w-1 bg-white/25"}`} /></button>)}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto hidden aspect-[2.5/3.5] w-full max-w-[17rem] sm:block">
          <div className="pointer-events-none absolute inset-4 rounded-[2rem] bg-[#c9a45d]/20 blur-3xl" />
          <div key={activeSlide.image} className="image-reveal relative h-full overflow-hidden rounded-[1.4rem] border border-[#c9a45d]/30 bg-[linear-gradient(145deg,#17130d,#070706_65%)] shadow-[0_25px_70px_rgba(0,0,0,.55)]">
            {failedImages.has(activeSlide.image) ? <div className="flex h-full items-center justify-center p-8 text-center"><div><div className="mx-auto h-16 w-16 rounded-full border border-[#c9a45d]/35 bg-[#c9a45d]/10" /><p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#c9a45d]/70">Private archive</p></div></div> : <Image src={activeSlide.image} alt={activeSlide.imageAlt} fill priority={activeIndex === 0} sizes="272px" className="object-contain p-3" onError={() => setFailedImages((current) => new Set(current).add(activeSlide.image))} />}
          </div>
        </div>
      </div>

      <footer className="relative z-10 mt-8 grid grid-cols-5 border-t border-white/10 pt-5">
        {features.map((feature, index) => <div key={feature} className="text-center"><span className="mx-auto block h-1 w-1 rounded-full bg-[#c9a45d]" /><p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/40 sm:text-[9px]">{feature}</p>{index < features.length - 1 && <span className="sr-only">, </span>}</div>)}
      </footer>
    </section>
  );
}
