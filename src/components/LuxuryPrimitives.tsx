import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';

export function VerbenaEmblem({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="url(#botanicalBg)"
        stroke="url(#botanicalStroke)"
        strokeWidth="1.4"
      />
      <path
        d="M11.5 24.5C11.5 16.5 16.5 11.2 24.8 10.8C24.4 19.2 19.5 24.5 11.5 24.5Z"
        stroke="url(#leafStroke)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 24.5L21 15"
        stroke="#C9E991"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="botanicalBg"
          x1="4"
          y1="4"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#174942" />
          <stop offset="1" stopColor="#071E1B" />
        </linearGradient>
        <linearGradient
          id="botanicalStroke"
          x1="4"
          y1="4"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#D7F2B4" />
          <stop offset="0.55" stopColor="#8DB654" />
          <stop offset="1" stopColor="#3B7A6D" />
        </linearGradient>
        <linearGradient
          id="leafStroke"
          x1="11"
          y1="25"
          x2="25"
          y2="11"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F4FBF6" />
          <stop offset="1" stopColor="#B7DB74" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  glowRim?: boolean;
  onClick?: () => void;
}

/**
 * Frosted botanical emerald glass container with subtle GPU mouse-tracking sunlit sage glow.
 */
export function SpotlightCard({
  children,
  className = '',
  glowRim = false,
  onClick,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, visible: false });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSpot({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true,
    });
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setSpot((s) => ({ ...s, visible: false }))}
      className={`relative overflow-hidden glass-botanical rounded-2xl transition-colors duration-200 hover:border-[#D4F0E0]/40 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: spot.visible ? 1 : 0,
          background: `radial-gradient(380px circle at ${spot.x}px ${spot.y}px, rgba(183, 219, 116, 0.14), transparent 60%)`,
        }}
      />
      {glowRim && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#D4F0E0]/65 to-transparent"
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function GoldHorizonDivider({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`botanical-horizon w-full ${className}`} />;
}

export function BotanicalLeafDivider({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-3 ${className}`}
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D4F0E0]/45 to-[#D4F0E0]/35" />
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="w-4 h-4 text-[#B7DB74] shrink-0"
      >
        <path
          d="M4.5 15.5C4.5 9.8 8.2 5.6 15.5 5C15 11.4 11 15.5 4.5 15.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 15.5L12.2 8.2"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#D4F0E0]/45 to-[#D4F0E0]/35" />
    </div>
  );
}

export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;

export function FadeReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: MOTION_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
