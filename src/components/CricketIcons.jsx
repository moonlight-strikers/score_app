import React from 'react';

/**
 * CricketBatIcon - Matches the authentic cricket bat styling with vibrant yellow willow blade and white grip handle.
 * Angled at ~30° for striker indicator.
 */
export function CricketBatIcon({ className = "w-4 h-4 flex-shrink-0" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Current Striker Bat"
    >
      {/* Blade (Willow Yellow with rounded toe) */}
      <path
        d="M12.2 6.6L13.5 7.6L14.8 8.8L16.2 9.8L7.4 20.6C6.6 21.6 5.1 21.7 4.2 20.8C3.3 20 3.3 18.5 4.3 17.6L12.2 6.6Z"
        fill="#FACC15"
        stroke="#B45309"
        strokeWidth="0.85"
        strokeLinejoin="round"
      />
      {/* Blade spine highlight */}
      <line
        x1="13.2"
        y1="8.6"
        x2="5.6"
        y2="18.8"
        stroke="#FEF08A"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
      {/* Handle (White Grip) */}
      <path
        d="M13.5 7.6L17.8 2.2L19.2 3.3L14.8 8.8L13.5 7.6Z"
        fill="#FFFFFF"
        stroke="#1E293B"
        strokeWidth="0.85"
        strokeLinejoin="round"
      />
      {/* Grip texture ribbing */}
      <line x1="14.8" y1="7.0" x2="16.2" y2="8.1" stroke="#94A3B8" strokeWidth="0.6" strokeLinecap="round" />
      <line x1="16.2" y1="5.2" x2="17.6" y2="6.3" stroke="#94A3B8" strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * DotBallIcon - Concentric white/currentColor outer ring with solid inner filled circle as seen in reference image.
 */
export function DotBallIcon({ className = "w-5 h-5 flex-shrink-0" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Dot ball"
    >
      {/* Outer concentric ring */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      {/* Center solid dot */}
      <circle
        cx="12"
        cy="12"
        r="4.2"
        fill="currentColor"
      />
    </svg>
  );
}
