import React from 'react';

export interface FireLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'icon' | 'badge' | 'full';
  styleVariant?: 'glow-badge' | 'flame-only' | 'shield' | 'white-card';
  animated?: boolean;
  textColor?: string;
}

export const FireLogo: React.FC<FireLogoProps> = ({
  className = '',
  size = 38,
  variant = 'full',
  styleVariant = 'glow-badge',
  animated = true,
  textColor = 'text-white',
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 38;

  const renderCameraVisionSvg = ({ isDarkBg = false }: { isDarkBg?: boolean } = {}) => {
    // If rendered directly on dark theme without white background
    const primaryNavy = isDarkBg ? '#FFFFFF' : '#082154';
    const accentBlue = '#0080FF';
    const targetSquare = '#0080FF';

    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm overflow-visible"
      >
        <defs>
          <filter id="faVisGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 3 Viewfinder / Focus Brackets (Cyan/Sky Blue) */}
        {/* Top-Left Bracket */}
        <path
          d="M 37 18 H 18 V 37"
          stroke={accentBlue}
          strokeWidth="5.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* Bottom-Left Bracket */}
        <path
          d="M 18 63 V 82 H 37"
          stroke={accentBlue}
          strokeWidth="5.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* Bottom-Right Bracket */}
        <path
          d="M 63 82 H 82 V 63"
          stroke={accentBlue}
          strokeWidth="5.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* Top-Right Connector Line from Outer Ring to Target Node */}
        <line
          x1="66"
          y1="36"
          x2="77"
          y2="25"
          stroke={primaryNavy}
          strokeWidth="3.5"
          strokeLinecap="square"
        />

        {/* Top-Right Target Node (Solid Blue Square) */}
        <rect
          x="74.5"
          y="19.5"
          width="8"
          height="8"
          fill={targetSquare}
          className={animated ? 'animate-pulse' : ''}
        />

        {/* Center Camera Iris / AI Lens */}
        {/* Outer Ring */}
        <circle
          cx="50"
          cy="52"
          r="22.5"
          stroke={primaryNavy}
          strokeWidth="5.5"
          fill="none"
        />

        {/* Inner Lens Core */}
        <circle
          cx="50"
          cy="52"
          r="15.2"
          fill={primaryNavy}
        />

        {/* Pupil Light Reflection Dot (Bright Blue) */}
        <circle
          cx="44"
          cy="46.5"
          r="4.2"
          fill={accentBlue}
          className={animated ? 'animate-pulse' : ''}
        />
      </svg>
    );
  };

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
          {renderCameraVisionSvg({ isDarkBg: true })}
        </div>
      ) : styleVariant === 'shield' ? (
        <div
          className={`relative flex items-center justify-center rounded-2xl bg-white p-2 shadow-xl ring-2 ring-blue-500/40 transition-all hover:scale-105 hover:ring-blue-400 ${
            animated ? 'group' : ''
          }`}
          style={{ width: numericSize, height: numericSize }}
        >
          <div className="relative z-10 w-full h-full">{renderCameraVisionSvg()}</div>
        </div>
      ) : styleVariant === 'white-card' ? (
        <div
          className={`relative flex items-center justify-center rounded-xl bg-white p-1.5 shadow-md ring-1 ring-slate-200 transition-all hover:scale-105 ${
            animated ? 'group' : ''
          }`}
          style={{ width: numericSize, height: numericSize }}
        >
          <div className="relative z-10 w-full h-full">{renderCameraVisionSvg()}</div>
        </div>
      ) : (
        /* glow-badge (Default) - Clean white card badge with high-tech cyan/blue glow on dark theme */
        <div
          className={`relative flex items-center justify-center rounded-xl bg-white p-1.5 shadow-lg shadow-blue-900/30 ring-1 ring-blue-400/40 transition-all hover:scale-105 hover:shadow-blue-500/40 ${
            animated ? 'group' : ''
          }`}
          style={{ width: numericSize, height: numericSize }}
        >
          <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-tr from-blue-600/30 via-cyan-400/20 to-transparent blur-xs opacity-80 group-hover:opacity-100 transition-opacity -z-10" />
          <div className="relative z-10 w-full h-full">{renderCameraVisionSvg()}</div>
        </div>
      )}

      {/* Typography for 'full' variant */}
      {variant === 'full' && (
        <div className="flex flex-col text-left whitespace-nowrap">
          <div className="flex items-baseline gap-1 leading-none">
            <span className={`font-black tracking-tight text-lg ${textColor}`}>
              FAVIS
            </span>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300 text-base">
              AI
            </span>
          </div>
          <span className="text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase leading-none mt-1 whitespace-nowrap">
            AI VISION & MONITORING
          </span>
        </div>
      )}
    </div>
  );
};
