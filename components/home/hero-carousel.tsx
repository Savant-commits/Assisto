"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { HeroBanner } from "@/lib/home/hero-banners";

export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const manualPause = useRef(false);
  const resumeOnVisible = useRef(false);
  const timer = useRef<number | null>(null);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    const slide = track?.children.item(index) as HTMLElement | null;
    if (!track || !slide) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reducedMotion ? "instant" : "smooth" });
    setActiveIndex(index);
  }, [reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReducedMotion(media.matches);
      setPaused(media.matches);
    };
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const slideWidth = track.clientWidth;
        if (slideWidth > 0) setActiveIndex(Math.min(banners.length - 1, Math.round(track.scrollLeft / slideWidth)));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener("scroll", onScroll);
    };
  }, [banners.length]);

  useEffect(() => {
    if (paused || engaged || reducedMotion || banners.length < 2 || document.hidden) return;
    timer.current = window.setInterval(() => scrollTo((activeIndex + 1) % banners.length), 5500);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [activeIndex, banners.length, engaged, paused, reducedMotion, scrollTo]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        resumeOnVisible.current = !paused && !manualPause.current;
        if (!paused) setPaused(true);
      } else if (resumeOnVisible.current) {
        resumeOnVisible.current = false;
        setPaused(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [paused]);

  const toggleAutoplay = () => setPaused((value) => {
    const next = !value;
    manualPause.current = !next;
    return next;
  });
  const pauseForInteraction = () => setPaused(true);
  const resumeAfterInteraction = () => {
    if (!manualPause.current && !reducedMotion) setPaused(false);
  };
  const markImageError = (id: string) => setImageErrors((errors) => errors.includes(id) ? errors : [...errors, id]);

  if (!banners.length) return null;
  return (
    <section ref={sectionRef} role="region" aria-label="Featured ways to use Assisto" aria-roledescription="carousel" aria-live={paused ? "polite" : "off"} className="relative" onMouseEnter={() => { setEngaged(true); pauseForInteraction(); }} onMouseLeave={() => { setEngaged(false); if (!sectionRef.current?.contains(document.activeElement)) resumeAfterInteraction(); }} onFocusCapture={() => { setEngaged(true); pauseForInteraction(); }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setEngaged(false); resumeAfterInteraction(); } }}>
      <div ref={trackRef} className="scrollbar-none grid grid-flow-col auto-cols-[100%] snap-x snap-mandatory overflow-x-auto rounded-3xl" onTouchStart={pauseForInteraction} onPointerDown={(event) => { if (event.pointerType !== "mouse") pauseForInteraction(); }}>
        {banners.map((banner, index) => (
          <article key={banner.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${banners.length}`} className="relative isolate aspect-[4/5] snap-start overflow-hidden rounded-3xl bg-forest md:aspect-[16/9]">
            {!imageErrors.includes(banner.id) && (
              <Image
                src={banner.image}
                alt=""
                fill
                priority={index === 0}
                loading={index === 0 ? undefined : "lazy"}
                sizes="(min-width: 1184px) 1120px, calc(100vw - 2rem)"
                className="-z-10 object-cover"
                onError={() => markImageError(banner.id)}
              />
            )}
            <div aria-hidden="true" className="image-scrim absolute inset-0 -z-0" />
            <div className="relative z-10 flex h-full max-w-3xl flex-col justify-end p-6 text-white sm:p-10 md:p-14">
              <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">{banner.headline}</h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white sm:text-lg">{banner.support}</p>
              <Link href={banner.href} className="mt-6 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-full bg-background px-5 font-semibold text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest">
                {banner.cta}<span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <div className="flex items-center gap-1" aria-label="Choose a featured slide">
          {banners.map((banner, index) => (
            <button key={banner.id} type="button" aria-label={`Show slide ${index + 1} of ${banners.length}: ${banner.headline}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => { pauseForInteraction(); scrollTo(index); }} className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span aria-hidden="true" className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === activeIndex ? "w-7 bg-primary" : "w-2.5 bg-muted-foreground/50"}`} />
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live={paused ? "polite" : "off"}>{`Slide ${activeIndex + 1} of ${banners.length}: ${banners[activeIndex]?.headline}`}</p>
        <div className="flex items-center gap-2">
          {banners.length > 1 && (
            <>
              <button type="button" onClick={() => { pauseForInteraction(); scrollTo((activeIndex - 1 + banners.length) % banners.length); }} aria-label="Previous slide" className="hidden size-11 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"><ChevronLeft aria-hidden="true" /></button>
              <button type="button" onClick={() => { pauseForInteraction(); scrollTo((activeIndex + 1) % banners.length); }} aria-label="Next slide" className="hidden size-11 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"><ChevronRight aria-hidden="true" /></button>
            </>
          )}
          {banners.length > 1 && !reducedMotion && (
            <button type="button" onClick={toggleAutoplay} aria-label={paused ? "Play carousel" : "Pause carousel"} aria-pressed={!paused} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
              {paused ? "Play" : "Pause"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
