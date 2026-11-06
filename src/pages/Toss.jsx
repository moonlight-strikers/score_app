import React, { useState, useRef, useEffect } from 'react';
import {
  Coins,
  RotateCw,
  RefreshCw,
  Volume2,
  VolumeX
} from 'lucide-react';

/* Procedural Web Audio Sound Synthesizers for Coin Toss */
function playCoinWhoosh() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.45);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);
  } catch (e) {
    // Ignore audio errors on unsupported environments
  }
}

function playCoinCatch() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // High metallic ping (chime fundamental)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2489, now); // D#7 note

    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.9);

    // Overtone shimmer
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(4978, now); // harmonic

    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Ignore audio errors
  }
}

/* =====================================================================
   HEADS COIN FACE: Ultra-Realistic 24K Minted Gold Cricket Medallion
   ===================================================================== */
function HeadsCoinFace() {
  return (
    <svg viewBox="0 0 260 260" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Radial 24K Gold Base */}
        <radialGradient id="headsBaseGold" cx="35%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="10%" stopColor="#fef08a" />
          <stop offset="28%" stopColor="#facc15" />
          <stop offset="55%" stopColor="#ca8a04" />
          <stop offset="82%" stopColor="#854d0e" />
          <stop offset="100%" stopColor="#3d1702" />
        </radialGradient>

        {/* Polished Rim Gold Gradient */}
        <linearGradient id="headsRimGold" x1="15%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="20%" stopColor="#ca8a04" />
          <stop offset="45%" stopColor="#fef08a" />
          <stop offset="70%" stopColor="#854d0e" />
          <stop offset="90%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>

        {/* Recessed Center Satin Medallion */}
        <radialGradient id="headsMedallion" cx="48%" cy="44%" r="62%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="45%" stopColor="#b45309" />
          <stop offset="80%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#451a03" />
        </radialGradient>

        {/* Cricket Leather Ball Gradient */}
        <radialGradient id="headsBallGrad" cx="34%" cy="32%" r="66%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="25%" stopColor="#dc2626" />
          <stop offset="70%" stopColor="#991b1b" />
          <stop offset="100%" stopColor="#3f0808" />
        </radialGradient>

        {/* 3D Gold Ribbon Gradient */}
        <linearGradient id="headsRibbonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5c2606" />
          <stop offset="30%" stopColor="#3d1702" />
          <stop offset="75%" stopColor="#260e02" />
          <stop offset="100%" stopColor="#140600" />
        </linearGradient>

        {/* 3D Embossed Gold Text Gradient */}
        <linearGradient id="headsGoldText" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>

        {/* Curved Specular Glint */}
        <linearGradient id="headsSpecularSweep" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Soft Drop Shadow for Minted Relief */}
        <filter id="headsReliefFilter" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.75" />
        </filter>

        {/* Circular Engraving Paths */}
        <path id="headsTopArc" d="M 38,130 A 92,92 0 0,1 222,130" fill="none" />
        <path id="headsBottomArc" d="M 222,130 A 92,92 0 0,1 38,130" fill="none" />
        <path id="headsBannerArc" d="M 68,175 Q 130,188 192,175" fill="none" />
      </defs>

      {/* 1. Outer Coin Rim with Bevel */}
      <circle cx="130" cy="130" r="128" fill="url(#headsRimGold)" stroke="#3d1702" strokeWidth="1.5" />

      {/* 2. Milled Outer Serrations (Alternating highlight and shadow notches) */}
      <circle cx="130" cy="130" r="124" fill="none" stroke="#fef08a" strokeWidth="4" strokeDasharray="2.5 3.75" />
      <circle cx="130" cy="130" r="124" fill="none" stroke="#3d1702" strokeWidth="4" strokeDasharray="1.5 4.75" strokeDashoffset="1.8" />

      {/* 3. Outer Raised Mirror Bezel */}
      <circle cx="130" cy="130" r="120" fill="url(#headsBaseGold)" stroke="#fef08a" strokeWidth="2" />

      {/* 4. Raised Dental Pearl Ring (48 classic numismatic beads) */}
      <circle cx="130" cy="130" r="108" fill="none" stroke="#3d1702" strokeWidth="3" />
      <circle cx="130" cy="130" r="108" fill="none" stroke="#fef08a" strokeWidth="2.8" strokeDasharray="1.2 11.2" strokeLinecap="round" />

      {/* 5. Circular Engraved Legends */}
      <text fill="#260e02" fontSize="9" fontWeight="900" letterSpacing="2.8" filter="url(#headsReliefFilter)">
        <textPath href="#headsTopArc" startOffset="50%" textAnchor="middle">
          ★ MOONLIGHT STRIKERS ★
        </textPath>
      </text>

      <text fill="#260e02" fontSize="8" fontWeight="800" letterSpacing="2.2" filter="url(#headsReliefFilter)">
        <textPath href="#headsBottomArc" startOffset="50%" textAnchor="middle">
          ★ OFFICIAL MATCH TOSS • 2024 ★
        </textPath>
      </text>

      {/* 6. Recessed Center Medallion Field */}
      <circle cx="130" cy="130" r="76" fill="url(#headsMedallion)" stroke="#fef08a" strokeWidth="2" filter="url(#headsReliefFilter)" />

      {/* Concentric Engine-Turned Guilloché Rings */}
      <circle cx="130" cy="130" r="68" fill="none" stroke="#fef08a" strokeWidth="0.6" strokeOpacity="0.35" />
      <circle cx="130" cy="130" r="60" fill="none" stroke="#fef08a" strokeWidth="0.6" strokeOpacity="0.35" />
      <circle cx="130" cy="130" r="52" fill="none" stroke="#fef08a" strokeWidth="0.6" strokeOpacity="0.35" />
      <circle cx="130" cy="130" r="44" fill="none" stroke="#fef08a" strokeWidth="0.6" strokeOpacity="0.35" />

      {/* 7. Center Emblem: Crossed Willow Bats, Red Ball & Laurels */}
      <g filter="url(#headsReliefFilter)">
        {/* Golden Victory Laurels */}
        <g stroke="#fef08a" fill="none" strokeWidth="1.5" strokeLinecap="round">
          {/* Left Laurel */}
          <path d="M 76,134 C 70,105 82,82 96,72" />
          <path d="M 77,126 C 72,122 73,116 78,118" fill="#fef08a" />
          <path d="M 79,112 C 74,108 76,102 82,105" fill="#fef08a" />
          <path d="M 85,98 C 81,94 84,89 89,92" fill="#fef08a" />
          <path d="M 93,86 C 89,82 93,77 98,80" fill="#fef08a" />

          {/* Right Laurel */}
          <path d="M 184,134 C 190,105 178,82 164,72" />
          <path d="M 183,126 C 188,122 187,116 182,118" fill="#fef08a" />
          <path d="M 181,112 C 186,108 184,102 178,105" fill="#fef08a" />
          <path d="M 175,98 C 179,94 176,89 171,92" fill="#fef08a" />
          <path d="M 167,86 C 171,82 167,77 162,80" fill="#fef08a" />
        </g>

        {/* Bat 1 (Angled -36deg) */}
        <g transform="rotate(-36 130 114)">
          {/* Handle */}
          <rect x="127" y="66" width="6" height="24" rx="2" fill="#1c1917" stroke="#fef08a" strokeWidth="0.6" />
          <line x1="127" y1="72" x2="133" y2="72" stroke="#fef08a" strokeWidth="0.5" />
          <line x1="127" y1="78" x2="133" y2="78" stroke="#fef08a" strokeWidth="0.5" />
          <line x1="127" y1="84" x2="133" y2="84" stroke="#fef08a" strokeWidth="0.5" />
          {/* Blade */}
          <path d="M 124,90 L 136,90 L 134,134 L 126,134 Z" fill="#ca8a04" stroke="#fef08a" strokeWidth="1" />
          <line x1="130" y1="91" x2="130" y2="133" stroke="#78350f" strokeWidth="1" />
        </g>

        {/* Bat 2 (Angled +36deg) */}
        <g transform="rotate(36 130 114)">
          {/* Handle */}
          <rect x="127" y="66" width="6" height="24" rx="2" fill="#1c1917" stroke="#fef08a" strokeWidth="0.6" />
          <line x1="127" y1="72" x2="133" y2="72" stroke="#fef08a" strokeWidth="0.5" />
          <line x1="127" y1="78" x2="133" y2="78" stroke="#fef08a" strokeWidth="0.5" />
          <line x1="127" y1="84" x2="133" y2="84" stroke="#fef08a" strokeWidth="0.5" />
          {/* Blade */}
          <path d="M 124,90 L 136,90 L 134,134 L 126,134 Z" fill="#ca8a04" stroke="#fef08a" strokeWidth="1" />
          <line x1="130" y1="91" x2="130" y2="133" stroke="#78350f" strokeWidth="1" />
        </g>

        {/* Cricket Ball in Center */}
        <circle cx="130" cy="114" r="16" fill="url(#headsBallGrad)" stroke="#fef08a" strokeWidth="1.8" />
        {/* Ball Specular Highlight */}
        <ellipse cx="125" cy="108" rx="4" ry="2.5" fill="#ffffff" fillOpacity="0.55" transform="rotate(-25 125 108)" />
        {/* Raised White Stitching Seams */}
        <path d="M 116,114 Q 130,102 144,114" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeDasharray="1.8 2.2" strokeLinecap="round" />
        <path d="M 116,114 Q 130,126 144,114" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeDasharray="1.8 2.2" strokeLinecap="round" />

        {/* Decorative Top Star */}
        <polygon
          points="130,64 133,71 140,71 134,75 137,82 130,78 123,82 126,75 120,71 127,71"
          fill="#fef08a"
          stroke="#ca8a04"
          strokeWidth="0.6"
        />
      </g>

      {/* 8. Curved Heraldic Ribbon Banner for "HEADS" */}
      <g filter="url(#headsReliefFilter)">
        {/* Ribbon Swallowtail Ends */}
        <path d="M 64,166 L 50,158 L 56,174 L 68,180 Z" fill="#260e02" stroke="#ca8a04" strokeWidth="1" />
        <path d="M 196,166 L 210,158 L 204,174 L 192,180 Z" fill="#260e02" stroke="#ca8a04" strokeWidth="1" />

        {/* Main Ribbon Body (Graceful curve following coin contour) */}
        <path
          d="M 62,164 Q 130,180 198,164 L 194,190 Q 130,206 66,190 Z"
          fill="url(#headsRibbonGrad)"
          stroke="#fef08a"
          strokeWidth="2"
        />

        {/* Curved Embossed "HEADS" Text */}
        <text
          fill="url(#headsGoldText)"
          fontSize="17.5"
          fontWeight="900"
          letterSpacing="4"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          <textPath href="#headsBannerArc" startOffset="50%" textAnchor="middle">
            HEADS
          </textPath>
        </text>
      </g>

      {/* 9. Glass Specular Sweep Highlight */}
      <path
        d="M 28 95 Q 130 18 232 95 A 128 128 0 0 0 28 95 Z"
        fill="url(#headsSpecularSweep)"
        pointerEvents="none"
      />
    </svg>
  );
}

/* =====================================================================
   TAILS COIN FACE: Ultra-Realistic Platinum & Sapphire Cricket Medallion
   ===================================================================== */
function TailsCoinFace() {
  return (
    <svg viewBox="0 0 260 260" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Radial Platinum Base with Cyan Undertones */}
        <radialGradient id="tailsBaseSilver" cx="35%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="12%" stopColor="#f8fafc" />
          <stop offset="30%" stopColor="#cbd5e1" />
          <stop offset="60%" stopColor="#64748b" />
          <stop offset="85%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#090d16" />
        </radialGradient>

        {/* Polished Rim Chrome/Cyan Gradient */}
        <linearGradient id="tailsRimSilver" x1="15%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="22%" stopColor="#0891b2" />
          <stop offset="48%" stopColor="#ffffff" />
          <stop offset="72%" stopColor="#0369a1" />
          <stop offset="90%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Recessed Center Sapphire Medallion */}
        <radialGradient id="tailsMedallion" cx="48%" cy="44%" r="62%">
          <stop offset="0%" stopColor="#0e7490" />
          <stop offset="45%" stopColor="#155e75" />
          <stop offset="80%" stopColor="#082f49" />
          <stop offset="100%" stopColor="#021422" />
        </radialGradient>

        {/* 3D Chrome Ribbon Gradient */}
        <linearGradient id="tailsRibbonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#082f49" />
          <stop offset="35%" stopColor="#0c4a6e" />
          <stop offset="75%" stopColor="#082f49" />
          <stop offset="100%" stopColor="#021422" />
        </linearGradient>

        {/* 3D Embossed Chrome Text Gradient */}
        <linearGradient id="tailsChromeText" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="28%" stopColor="#e0f2fe" />
          <stop offset="65%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Curved Specular Glint */}
        <linearGradient id="tailsSpecularSweep" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Soft Drop Shadow for Minted Relief */}
        <filter id="tailsReliefFilter" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.75" />
        </filter>

        {/* Circular Engraving Paths */}
        <path id="tailsTopArc" d="M 38,130 A 92,92 0 0,1 222,130" fill="none" />
        <path id="tailsBottomArc" d="M 222,130 A 92,92 0 0,1 38,130" fill="none" />
        <path id="tailsBannerArc" d="M 68,175 Q 130,188 192,175" fill="none" />
      </defs>

      {/* 1. Outer Coin Rim with Bevel */}
      <circle cx="130" cy="130" r="128" fill="url(#tailsRimSilver)" stroke="#090d16" strokeWidth="1.5" />

      {/* 2. Milled Outer Serrations (Alternating silver highlight and steel shadow notches) */}
      <circle cx="130" cy="130" r="124" fill="none" stroke="#ffffff" strokeWidth="4" strokeDasharray="2.5 3.75" />
      <circle cx="130" cy="130" r="124" fill="none" stroke="#090d16" strokeWidth="4" strokeDasharray="1.5 4.75" strokeDashoffset="1.8" />

      {/* 3. Outer Raised Mirror Bezel */}
      <circle cx="130" cy="130" r="120" fill="url(#tailsBaseSilver)" stroke="#38bdf8" strokeWidth="2" />

      {/* 4. Raised Dental Pearl Ring with Cyan Pearls */}
      <circle cx="130" cy="130" r="108" fill="none" stroke="#082f49" strokeWidth="3" />
      <circle cx="130" cy="130" r="108" fill="none" stroke="#22d3ee" strokeWidth="2.8" strokeDasharray="1.2 11.2" strokeLinecap="round" />

      {/* 5. Circular Engraved Legends */}
      <text fill="#021422" fontSize="9" fontWeight="900" letterSpacing="2.8" filter="url(#tailsReliefFilter)">
        <textPath href="#tailsTopArc" startOffset="50%" textAnchor="middle">
          ★ MOONLIGHT STRIKERS ★
        </textPath>
      </text>

      <text fill="#021422" fontSize="8" fontWeight="800" letterSpacing="2.2" filter="url(#tailsReliefFilter)">
        <textPath href="#tailsBottomArc" startOffset="50%" textAnchor="middle">
          ★ SPIRIT OF CRICKET • 2024 ★
        </textPath>
      </text>

      {/* 6. Recessed Center Medallion Field */}
      <circle cx="130" cy="130" r="76" fill="url(#tailsMedallion)" stroke="#38bdf8" strokeWidth="2" filter="url(#tailsReliefFilter)" />

      {/* Concentric Engine-Turned Guilloché Rings */}
      <circle cx="130" cy="130" r="68" fill="none" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.35" />
      <circle cx="130" cy="130" r="60" fill="none" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.35" />
      <circle cx="130" cy="130" r="52" fill="none" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.35" />
      <circle cx="130" cy="130" r="44" fill="none" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.35" />

      {/* 7. Center Emblem: Stumps, Exploding Flying Bails & Laurels */}
      <g filter="url(#tailsReliefFilter)">
        {/* Silver Laurels */}
        <g stroke="#38bdf8" fill="none" strokeWidth="1.5" strokeLinecap="round">
          {/* Left Laurel */}
          <path d="M 76,134 C 70,105 82,82 96,72" />
          <path d="M 77,126 C 72,122 73,116 78,118" fill="#38bdf8" />
          <path d="M 79,112 C 74,108 76,102 82,105" fill="#38bdf8" />
          <path d="M 85,98 C 81,94 84,89 89,92" fill="#38bdf8" />
          <path d="M 93,86 C 89,82 93,77 98,80" fill="#38bdf8" />

          {/* Right Laurel */}
          <path d="M 184,134 C 190,105 178,82 164,72" />
          <path d="M 183,126 C 188,122 187,116 182,118" fill="#38bdf8" />
          <path d="M 181,112 C 186,108 184,102 178,105" fill="#38bdf8" />
          <path d="M 175,98 C 179,94 176,89 171,92" fill="#38bdf8" />
          <path d="M 167,86 C 171,82 167,77 162,80" fill="#38bdf8" />
        </g>

        {/* 3 Stumps */}
        {/* Left Stump */}
        <rect x="109" y="86" width="7" height="48" rx="2.5" fill="#f8fafc" stroke="#0284c7" strokeWidth="1" />
        {/* Middle Stump */}
        <rect x="126.5" y="82" width="7" height="52" rx="2.5" fill="#f8fafc" stroke="#0284c7" strokeWidth="1" />
        {/* Right Stump */}
        <rect x="144" y="86" width="7" height="48" rx="2.5" fill="#f8fafc" stroke="#0284c7" strokeWidth="1" />

        {/* Flying Bails Bursting in Air */}
        <rect
          x="108"
          y="74"
          width="16"
          height="4.5"
          rx="2"
          fill="#38bdf8"
          stroke="#ffffff"
          strokeWidth="0.8"
          transform="rotate(-26 116 76)"
        />
        <rect
          x="136"
          y="72"
          width="16"
          height="4.5"
          rx="2"
          fill="#38bdf8"
          stroke="#ffffff"
          strokeWidth="0.8"
          transform="rotate(28 144 74)"
        />

        {/* Flying Cricket Ball */}
        <circle cx="86" cy="88" r="9" fill="url(#tailsRimSilver)" stroke="#ffffff" strokeWidth="1.5" />
        {/* Motion Speed Dashes */}
        <path d="M 72,94 Q 79,91 86,88" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="1.5 2" />

        {/* Decorative Top Star */}
        <polygon
          points="130,64 133,71 140,71 134,75 137,82 130,78 123,82 126,75 120,71 127,71"
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth="0.6"
        />
      </g>

      {/* 8. Curved Heraldic Ribbon Banner for "TAILS" */}
      <g filter="url(#tailsReliefFilter)">
        {/* Ribbon Swallowtail Ends */}
        <path d="M 64,166 L 50,158 L 56,174 L 68,180 Z" fill="#021422" stroke="#0284c7" strokeWidth="1" />
        <path d="M 196,166 L 210,158 L 204,174 L 192,180 Z" fill="#021422" stroke="#0284c7" strokeWidth="1" />

        {/* Main Ribbon Body */}
        <path
          d="M 62,164 Q 130,180 198,164 L 194,190 Q 130,206 66,190 Z"
          fill="url(#tailsRibbonGrad)"
          stroke="#38bdf8"
          strokeWidth="2"
        />

        {/* Curved Embossed "TAILS" Text */}
        <text
          fill="url(#tailsChromeText)"
          fontSize="17.5"
          fontWeight="900"
          letterSpacing="4"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          <textPath href="#tailsBannerArc" startOffset="50%" textAnchor="middle">
            TAILS
          </textPath>
        </text>
      </g>

      {/* 9. Glass Specular Sweep Highlight */}
      <path
        d="M 28 95 Q 130 18 232 95 A 128 128 0 0 0 28 95 Z"
        fill="url(#tailsSpecularSweep)"
        pointerEvents="none"
      />
    </svg>
  );
}

/* =====================================================================
   MAIN TOSS PAGE COMPONENT
   ===================================================================== */
export default function Toss() {
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState(null); // 'Heads' | 'Tails' | null
  const [rotationY, setRotationY] = useState(0);
  const [flipCount, setFlipCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Match captain context (in-memory component state only, never persisted)
  const [teamA, setTeamA] = useState('Team A');
  const [teamB, setTeamB] = useState('Team B');
  const [callingTeam, setCallingTeam] = useState('teamA');
  const [calledSide, setCalledSide] = useState('Heads'); // 'Heads' | 'Tails'
  const [electedDecision, setElectedDecision] = useState(null); // 'bat' | 'bowl' | null

  const flipTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

  const handleFlip = () => {
    if (isFlipping) return;

    setIsFlipping(true);
    setResult(null);

    if (soundEnabled) {
      playCoinWhoosh();
    }

    // Random outcome: fair 50/50 probability
    const outcome = Math.random() < 0.5 ? 'Heads' : 'Tails';

    // Calculate rotation: 8 full spins (2880 deg)
    // Heads ends at 0 deg modulo 360
    // Tails ends at 180 deg modulo 360
    const baseSpins = 8 * 360;
    const currentBase = Math.floor(rotationY / 360) * 360;
    const targetOffset = outcome === 'Heads' ? 0 : 180;
    const nextRotation = currentBase + baseSpins + targetOffset;

    setRotationY(nextRotation);

    // Animation completion (2400ms duration)
    flipTimerRef.current = setTimeout(() => {
      setResult(outcome);
      setIsFlipping(false);
      setFlipCount((prev) => prev + 1);
      if (soundEnabled) {
        playCoinCatch();
      }
    }, 2400);
  };

  const handleReset = () => {
    if (isFlipping) return;
    setResult(null);
    setRotationY(0);
  };

  return (
    <div className="ms-page min-h-[calc(100dvh-120px)] flex flex-col justify-between w-full pb-2 overflow-visible">
      {/* Page Header */}
      <div className="flex items-center justify-between py-2 mb-1 w-full border-b border-ms-border flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-ms-cyan-subtle border border-ms-cyan/30 flex items-center justify-center text-ms-cyan shadow-sm flex-shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-ms-text-primary tracking-tight">
              Toss
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2 rounded-full border border-ms-border bg-ms-bg-card hover:bg-ms-bg-elevated text-slate-800 dark:text-white transition-all cursor-pointer"
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-slate-900 dark:text-white" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )}
          </button>

          {flipCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isFlipping}
              className="ms-btn ms-btn-outline ms-btn-sm"
              title="Reset Coin"
            >
              <RefreshCw />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Toss Card - Enlarged & Centered with plenty of headroom */}
      <div className="w-full my-auto py-3 flex flex-col items-center justify-center overflow-visible">
        <div className="ms-card !overflow-visible min-h-[480px] sm:min-h-[520px] pt-14 pb-8 px-6 sm:pt-16 sm:pb-10 sm:px-8 bg-gradient-to-b from-ms-bg-card via-ms-bg-card to-ms-bg-elevated border-ms-border-light shadow-2xl text-center flex flex-col items-center justify-between w-full box-border relative">
          {/* 3D Coin Stage with Dynamic Atmosphere Aura */}
          <div className="ms-coin-stage relative my-auto flex flex-col items-center justify-center overflow-visible">
            {/* Ambient stadium floodlight glow */}
            <div
              className={`absolute w-72 h-72 rounded-full blur-3xl pointer-events-none -z-10 transition-all duration-700 ${
                result === 'Heads'
                  ? 'bg-amber-500/25'
                  : result === 'Tails'
                  ? 'bg-cyan-500/25'
                  : isFlipping
                  ? 'bg-gradient-to-tr from-amber-500/30 via-cyan-500/30 to-amber-400/20 animate-pulse'
                  : 'bg-gradient-to-tr from-amber-500/15 via-cyan-500/15 to-transparent'
              }`}
            />

            {/* Coin Flight Container (Handles Vertical Arc) */}
            <div className={`ms-coin-flight-box overflow-visible ${isFlipping ? 'ms-coin-flight-active' : ''}`}>
              {/* The 3D Physical Coin (Spins 3D Degrees & Clickable to Flip) */}
              <div
                className="ms-coin cursor-pointer group"
                onClick={handleFlip}
                style={{
                  transform: `rotateY(${rotationY}deg)`
                }}
                title={isFlipping ? 'Coin is in the air...' : 'Tap Coin to Flip!'}
              >
                {/* 3D Physical Extruded Rim (11 Depth Layers for Genuine Solid Metallic Thickness) */}
                {[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((z) => (
                  <div
                    key={z}
                    className="ms-coin-rim-layer"
                    style={{ transform: `translateZ(${z}px)` }}
                  />
                ))}

                {/* HEADS FACE: 24K Minted Gold Cricket Medallion */}
                <div className="ms-coin-face ms-coin-front overflow-hidden">
                  <HeadsCoinFace />
                  <div className="ms-coin-sheen" />
                </div>

                {/* TAILS FACE: Platinum & Sapphire Cyan Cricket Medallion */}
                <div className="ms-coin-face ms-coin-back overflow-hidden">
                  <TailsCoinFace />
                  <div className="ms-coin-sheen" />
                </div>
              </div>
            </div>

            {/* 3D Dynamic Contact Ground Shadow */}
            <div
              className={`w-40 h-4 rounded-full bg-black/70 blur-xs mt-6 transition-all duration-300 ${
                isFlipping ? 'ms-shadow-flipping' : ''
              }`}
            />

            {!isFlipping && !result && (
              <span className="text-[12px] font-medium text-ms-text-muted mt-3 tracking-wide flex items-center gap-1">
                <span>Tap coin or button to flip</span>
              </span>
            )}
          </div>

          {/* Primary Action Button: Flip Coin */}
          <div className="mt-4 mb-1">
            <button
              type="button"
              onClick={handleFlip}
              disabled={isFlipping}
              className={`ms-btn ms-btn-primary ms-btn-lg px-10 text-base font-bold shadow-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                isFlipping ? 'opacity-80 cursor-not-allowed scale-95' : 'hover:scale-105 active:scale-95 shadow-cyan-500/20'
              }`}
            >
              <RotateCw className={isFlipping ? 'animate-spin' : ''} />
              <span>{isFlipping ? 'Flipping Coin...' : result ? 'Flip Again' : 'Flip Coin'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


