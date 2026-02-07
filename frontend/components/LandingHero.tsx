"use client";

export default function LandingHero() {
  return (
    <header className="text-center flex flex-col items-center gap-4">
      <h1 className="text-5xl font-bold tracking-tight text-emerald-500 lg:text-6xl animate-pulse">
        Apply With Confidence
      </h1>
      <p className="text-slate-400 text-lg md:text-xl">
        Upload <span className="text-slate-600">·</span> Match <span className="text-slate-600">·</span> Apply
      </p>
    </header>
  );
}
