"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroBanner } from "@/lib/home/hero-banners";

export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
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
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsTabVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
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
    if (engaged || reducedMotion || !isInView || !isTabVisible || banners.length < 2) return;
    timer.current = window.setInterval(() => scrollTo((activeIndex + 1) % banners.length), 5500);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [activeIndex, banners.length, engaged, isInView, isTabVisible, reducedMotion, scrollTo]);

  const resumeAfterInteraction = () => {
    if (!sectionRef.current?.matches(":hover")) setEngaged(false);
  };
  const resumeAfterTouch = () => {
    if (!sectionRef.current?.contains(document.activeElement)) setEngaged(false);
  };
  const markImageError = (id: string) => setImageErrors((errors) => errors.includes(id) ? errors : [...errors, id]);

  if (!banners.length) return null;
  return (
    <section ref={sectionRef} role="region" aria-label="Featured ways to use Assisto" aria-roledescription="carousel" aria-live="off" className="relative" onMouseEnter={() => setEngaged(true)} onMouseLeave={() => { if (!sectionRef.current?.contains(document.activeElement)) setEngaged(false); }} onFocusCapture={() => setEngaged(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resumeAfterInteraction(); }} onTouchStart={() => setEngaged(true)} onTouchEnd={resumeAfterTouch}>
      <div ref={trackRef} className="scrollbar-none grid grid-flow-col auto-cols-[100%] snap-x snap-mandatory overflow-x-auto rounded-3xl" onPointerDown={(event) => { if (event.pointerType !== "mouse") setEngaged(true); }}>
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
            <button key={banner.id} type="button" aria-label={`Show slide ${index + 1} of ${banners.length}: ${banner.headline}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => scrollTo(index)} className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span aria-hidden="true" className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === activeIndex ? "w-7 bg-primary" : "w-2.5 bg-muted-foreground/50"}`} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {banners.length > 1 && (
            <>
              <button type="button" onClick={() => scrollTo((activeIndex - 1 + banners.length) % banners.length)} aria-label="Previous slide" className="hidden size-11 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"><ChevronLeft aria-hidden="true" /></button>
              <button type="button" onClick={() => scrollTo((activeIndex + 1) % banners.length)} aria-label="Next slide" className="hidden size-11 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"><ChevronRight aria-hidden="true" /></button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
