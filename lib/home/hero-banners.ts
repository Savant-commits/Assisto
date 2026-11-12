export type HeroBanner = {
  id: string;
  headline: string;
  support: string;
  cta: string;
  href: string;
  image: string;
  categorySlugs: string[];
  kind: "general" | "category" | "recruit";
};

export const HERO_BANNERS: HeroBanner[] = [
  {
    id: "find-professionals",
    headline: "Find the right professional for your home",
    support: "Browse professionals by service and area and get in touch directly. Free to use.",
    cta: "Explore professionals",
    href: "/discover",
    image: "/images/hero/find-professionals.jpg",
    categorySlugs: [],
    kind: "general",
  },
  {
    id: "build-dream-home",
    headline: "Build your dream home",
    support: "Connect with construction and civil engineering professionals for every stage of your build.",
    cta: "Explore construction",
    href: "/discover?category=construction",
    image: "/images/hero/build-dream-home.jpg",
    categorySlugs: ["construction", "civil-engineering"],
    kind: "category",
  },
  {
    id: "design-your-space",
    headline: "Design your space",
    support: "Find interior professionals to plan, style and finish the rooms you live in.",
    cta: "Explore interiors",
    href: "/discover?category=interior",
    image: "/images/hero/design-your-space.jpg",
    categorySlugs: ["interior"],
    kind: "category",
  },
  {
    id: "everyday-home-services",
    headline: "Everyday home services",
    support: "Repairs, upkeep and renovation work by skilled professionals.",
    cta: "Explore repairs",
    href: "/discover?category=renovation",
    image: "/images/hero/everyday-home-services.jpg",
    categorySlugs: ["renovation"],
    kind: "category",
  },
  {
    id: "home-improvement",
    headline: "Improve your home, inside and out",
    support: "From exterior work to finishing touches, find the right professional for the job.",
    cta: "Explore exterior work",
    href: "/discover?category=exterior",
    image: "/images/hero/home-improvement.jpg",
    categorySlugs: ["exterior"],
    kind: "category",
  },
  {
    id: "join-assisto",
    headline: "Grow your work with Assisto",
    support: "Showcase your projects and connect with customers looking for your skills.",
    cta: "Join Assisto",
    href: "/apply",
    image: "/images/hero/join-assisto.jpg",
    categorySlugs: [],
    kind: "recruit",
  },
];
