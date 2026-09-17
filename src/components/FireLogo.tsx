import React from 'react';

export interface FireLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'icon' | 'badge' | 'full';
  styleVariant?: 'glow-badge' | 'flame-only' | 'shield';
  animated?: boolean;
}

export const FireLogo: React.FC<FireLogoProps> = ({
  className = '',
  size = 38,
  variant = 'full',
  styleVariant = 'glow-badge',
  animated = true,
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 38;

  const renderFlameSvg = () => (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full drop-shadow-[0_2px_10px_rgba(239,68,68,0.65)] overflow-visible"
    >
      <defs>
        {/* Outer Flame Gradient */}
        <linearGradient id="fireOuterGrad" x1="10%" y1="100%" x2="90%" y2="0%">
          <stop offset="0%" stopColor="#B91C1C" />
          <stop offset="35%" stopColor="#EF4444" />
          <stop offset="75%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>

        {/* Inner Core Flame Gradient */}
        <linearGradient id="fireInnerGrad" x1="20%" y1="100%" x2="80%" y2="10%">
          <stop offset="0%" stopColor="#C2410C" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="85%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>

        {/* AI Center Core Spark Gradient */}
        <linearGradient id="fireSparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FEF08A" />
        </linearGradient>

        {/* Glow Filter */}
        <filter id="fireGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Tech Ring Accent Gradient */}
        <linearGradient id="fireTechRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Tech Outer Shield Ring */}
      <path
        d="M50 6 L88 22 V52 C88 74 71 90 50 95 C29 90 12 74 12 52 V22 L50 6 Z"
        fill="none"
        stroke="url(#fireTechRingGrad)"
        strokeWidth="2.5"
        strokeDasharray="6 3"
        className="opacity-50"
      />

      {/* Outer Flame Shadow / Base Aura */}
      <path
        d="M50 12 
           C54 20, 62 26, 69 32 
           C78 40, 84 50, 83 64 
           C81 80, 67 92, 50 92 
           C33 92, 19 80, 17 63 
           C16 48, 24 37, 32 29 
           C37 24, 41 18, 42 12 
           C44 20, 48 23, 50 12 Z"
        fill="#7F1D1D"
        opacity="0.3"
      />

      {/* Main Outer Flame Layer */}
      <path
        d="M50 12 
           C54 21, 62 26, 68 32 
           C77 40, 83 50, 82 63 
           C80 78, 66 90, 50 90 
           C34 90, 20 78, 18 62 
           C17 47, 25 37, 32 30 
           C37 25, 41 19, 42 12 
           C44 19, 48 22, 50 12 Z"
        fill="url(#fireOuterGrad)"
        filter="url(#fireGlowEffect)"
      />

      {/* Left Flame Wing Accent (adds 3D dynamic layer) */}
      <path
        d="M32 42 
           C25 50, 22 59, 25 68 
           C28 76, 36 82, 46 84 
           C35 81, 29 74, 29 65 
           C29 57, 34 50, 38 45 
           C35 45, 33 44, 32 42 Z"
        fill="#991B1B"
        opacity="0.75"
      />

      {/* Right Flame Crest Accent */}
      <path
        d="M68 42 
           C75 50, 78 59, 75 68 
           C72 76, 64 82, 54 84 
           C65 81, 71 74, 71 65 
           C71 57, 66 50, 62 45 
           C65 45, 67 44, 68 42 Z"
        fill="#F97316"
        opacity="0.85"
      />

      {/* Inner Vibrant Flame Layer */}
      <path
        d="M50 30 
           C54 37, 59 41, 64 46 
           C70 52, 73 60, 72 69 
           C70 78, 61 85, 50 85 
           C39 85, 30 78, 28 68 
           C27 58, 34 50, 40 44 
           C43 41, 45 36, 46 30 
           C48 35, 49 37, 50 30 Z"
        fill="url(#fireInnerGrad)"
      />

      {/* Core Hotspot Flame Tip */}
      <path
        d="M50 45 
           C53 49, 56 53, 59 56 
           C63 61, 64 66, 63 71 
           C62 77, 57 81, 50 81 
           C43 81, 38 76, 37 70 
           C36 63, 41 58, 45 53 
           C47 50, 49 48, 50 45 Z"
        fill="#FFFBEB"
      />

      {/* AI Intelligence Star/Diamond Core */}
      <g className={animated ? 'animate-pulse' : ''}>
        <polygon
          points="50,54 53,62 61,62 55,67 57,75 50,70 43,75 45,67 39,62 47,62"
          fill="url(#fireSparkGrad)"
        />
        {/* Core center dot */}
        <circle cx="50" cy="65.5" r="2.5" fill="#EF4444" />
      </g>

      {/* AI Tech Orbit Nodes */}
      <circle cx="50" cy="18" r="2.5" fill="#FDE68A" className="animate-ping" style={{ animationDuration: '3s' }} />
      <circle cx="78" cy="38" r="2" fill="#F87171" />
      <circle cx="22" cy="38" r="2" fill="#F87171" />
      <line x1="50" y1="18" x2="50" y2="28" stroke="#FDE68A" strokeWidth="1" strokeDasharray="1 1" opacity="0.7" />
    </svg>
  );

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Icon Graphic */}
      {styleVariant === 'flame-only' ? (
        <div
          className={`relative flex items-center justify-center transition-transform hover:scale-105 ${
            animated ? 'group' : ''
          }`}
          style={{ width: numericSize, height: numericSize }}
        >
          {renderFlameSvg()}
        </div>
      ) : styleVariant === 'shield' ? (
        <div
          className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-slate-900 to-black p-2 shadow-xl ring-2 ring-red-500/40 transition-all hover:scale-105 hover:ring-red-400 ${
            animated ? 'group' : ''
          }`}
          style={{ width: numericSize, height: numericSize }}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-red-600/40 via-amber-500/20 to-transparent blur-md opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 w-full h-full">{renderFlameSvg()}</div>
        </div>
      ) : (
        /* glow-badge (Default) */
        <div
          className={`relative flex items-center justify-center rounded-xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-2 shadow-lg ring-1 ring-red-500/30 transition-all hover:scale-105 hover:shadow-red-900/30 ${
            animated ? 'group' : ''
          }`}
          style={{ width: numericSize, height: numericSize }}
        >
          <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-red-600/30 via-orange-500/25 to-amber-300/20 blur-sm opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 w-full h-full">{renderFlameSvg()}</div>
        </div>
      )}

      {/* Typography for 'full' variant */}
      {variant === 'full' && (
        <div className="flex flex-col text-left">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="font-black tracking-tight text-slate-900 text-lg">
              FIREGUARD
            </span>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-base">
              AI
            </span>
          </div>
          <span className="text-[9.5px] font-bold tracking-[0.18em] text-slate-400 uppercase leading-none mt-1">
            AI FIRE MONITORING
          </span>
        </div>
      )}
    </div>
  );
};
