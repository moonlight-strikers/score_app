import React, { useState, useEffect } from 'react';

export default function SplashScreen({ onFinish }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Respect reduced-motion preferences
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const holdTime = prefersReducedMotion ? 250 : 2100;
    const fadeDuration = prefersReducedMotion ? 60 : 450;

    const timer = setTimeout(() => {
      setFadingOut(true);
      const exitTimer = setTimeout(() => {
        if (onFinish) onFinish();
      }, fadeDuration);
      return () => clearTimeout(exitTimer);
    }, holdTime);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      id="ms-splash-screen"
      role="status"
      aria-live="polite"
      aria-label="MoonLight Strikers Loading"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#060b18] select-none transition-opacity duration-500 ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient glowing backdrop */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none animate-pulse" />

      {/* Centered Composition: Logo & Team Name */}
      <div className="relative flex flex-col items-center justify-center px-4 z-10">
        {/* Stage 1 & 2: Center Logo with Smooth Zoom & Subtle Cyan Glow */}
        <div className="ms-splash-logo relative w-32 h-32 sm:w-40 sm:h-40 rounded-full p-1 bg-gradient-to-b from-cyan-400/40 via-cyan-500/20 to-blue-600/30 border-2 border-cyan-400/60 flex items-center justify-center shadow-2xl">
          <img
            src="/logo.png"
            alt="MoonLight Strikers Logo"
            className="w-full h-full object-contain rounded-full drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]"
          />
        </div>

        {/* Stage 3: Team Name Popup */}
        <div className="ms-splash-title mt-5 text-center">
          <h1 className="text-2xl sm:text-3xl font-black tracking-widest uppercase font-mono flex items-center justify-center gap-2 drop-shadow-md">
            <span className="text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.25)]">MOONLIGHT</span>
            <span className="text-cyan-400 drop-shadow-[0_0_18px_rgba(6,182,212,0.7)]">STRIKERS</span>
          </h1>

          <div className="ms-splash-tag mt-2 flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold tracking-[0.25em] text-cyan-300/80 uppercase">
            <span className="w-6 h-[1.5px] bg-gradient-to-r from-transparent to-cyan-400" />
            <span>CRICKET SCORING</span>
            <span className="w-6 h-[1.5px] bg-gradient-to-l from-transparent to-cyan-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
