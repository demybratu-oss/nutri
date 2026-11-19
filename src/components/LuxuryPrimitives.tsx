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
      <path
        d="M18 4C14.5 9.8 14.5 16.5 18 22.5C21.5 16.5 21.5 9.8 18 4Z"
        stroke="url(#verbenaGold)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 22.5C12.2 19.6 8.6 15.2 7 9.5C12.4 10.6 16.1 14.8 18 22.5Z"
        stroke="url(#verbenaGold)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 22.5C23.8 19.6 27.4 15.2 29 9.5C23.6 10.6 19.9 14.8 18 22.5Z"
        stroke="url(#verbenaGold)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 24.5C13 24.5 8.5 22.8 5.5 19.5C7.6 25.4 12.4 28.5 18 28.5C23.6 28.5 28.4 25.4 30.5 19.5C27.5 22.8 23 24.5 18 24.5Z"
        stroke="url(#verbenaGold)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="verbenaGold"
          x1="5.5"
          y1="4"
          x2="30.5"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F5DCAC" />
          <stop offset="0.55" stopColor="#D4A661" />
          <stop offset="1" stopColor="#A97936" />
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
 * Smoked obsidian glass container with subtle GPU mouse-tracking golden ambient spotlight.
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
      className={`relative overflow-hidden glass-obsidian rounded-2xl transition-colors duration-200 hover:border-[#D9AF72]/35 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: spot.visible ? 1 : 0,
          background: `radial-gradient(380px circle at ${spot.x}px ${spot.y}px, rgba(226, 184, 118, 0.12), transparent 60%)`,
        }}
      />
      {glowRim && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#F0D29C]/65 to-transparent"
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function GoldHorizonDivider({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`gold-horizon w-full ${className}`} />;
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
