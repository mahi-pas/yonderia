"use client";

import { useMemo, useState, useEffect } from "react";
import type { TripThemeEffect } from "@/lib/types";

const CONFETTI_COLORS = [
  "#8b5cf6",
  "#ec4899",
  "#22c55e",
  "#f59e0b",
  "#3b82f6",
  "#f43f5e",
];

const PARTICLE_COUNT_DESKTOP = 24;
const PARTICLE_COUNT_MOBILE = 12;

function useParticleCount() {
  const [count, setCount] = useState(PARTICLE_COUNT_DESKTOP);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    queueMicrotask(() =>
      setCount(mq.matches ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP),
    );
    const handler = () => setCount(mq.matches ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return count;
}

const CONFETTI_SWAY = ["confetti-fall", "confetti-fall-sway-m", "confetti-fall-sway-l"] as const;

function ConfettiPieces() {
  const count = useParticleCount();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const isRound = i % 5 === 0;
        const size = 5 + (i % 5);
        return {
          id: i,
          left: `${(i * 7 + 3) % 100}%`,
          delay: `${(i * 0.45) % 7}s`,
          duration: `${7 + (i % 5)}s`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: size,
          height: isRound ? size : size * 1.5,
          borderRadius: isRound ? "50%" : 1,
          sway: CONFETTI_SWAY[i % CONFETTI_SWAY.length],
          rotation: i * 41,
        };
      }),
    [count],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece absolute will-change-transform"
          style={{
            left: p.left,
            top: "-12px",
            width: `${p.width}px`,
            height: `${p.height}px`,
            backgroundColor: p.color,
            borderRadius: p.borderRadius === 50 ? "50%" : `${p.borderRadius}px`,
            boxShadow: `0 0 2px rgba(0,0,0,0.2)`,
            animation: `${p.sway} ${p.duration} linear infinite`,
            animationDelay: p.delay,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </>
  );
}

function SparklePieces() {
  const particleCount = useParticleCount();
  const count = Math.min(18, particleCount);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 11 + 4) % 94}%`,
        top: `${(i * 13 + 6) % 88}%`,
        delay: `${(i * 0.35) % 4}s`,
        duration: `${2.2 + (i % 3) * 0.4}s`,
        size: 2 + (i % 3),
      })),
    [count],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="sparkle-piece absolute rounded-full will-change-[opacity,transform]"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.4))",
            boxShadow:
              "0 0 8px 2px rgba(255,255,255,0.9), 0 0 16px 4px rgba(255,255,255,0.4), 0 0 24px 6px rgba(255,255,255,0.15)",
            animation: `sparkle-twinkle ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </>
  );
}

const SNOW_ANIMATIONS = ["snow-fall", "snow-fall-drift-m", "snow-fall-drift-l"] as const;

function SnowPieces() {
  const count = useParticleCount();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 8 + 2) % 98}%`,
        delay: `${(i * 0.4) % 6}s`,
        duration: `${9 + (i % 4)}s`,
        size: 3 + (i % 4),
        opacity: 0.5 + (i % 5) * 0.12,
        animation: SNOW_ANIMATIONS[i % SNOW_ANIMATIONS.length],
      })),
    [count],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="snow-piece absolute rounded-full will-change-transform"
          style={{
            left: p.left,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.95), rgba(255,255,255,0.5))",
            boxShadow: "0 0 4px 1px rgba(255,255,255,0.3)",
            opacity: p.opacity,
            filter: "blur(0.3px)",
            animation: `${p.animation} ${p.duration} linear infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </>
  );
}

function FireflyPieces() {
  const particleCount = useParticleCount();
  const count = Math.min(12, particleCount);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 14 + 8) % 86}%`,
        top: `${(i * 11 + 18) % 78}%`,
        delay: `${(i * 0.5) % 5}s`,
        duration: `${5.5 + (i % 5)}s`,
        size: 4 + (i % 2),
      })),
    [count],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="firefly-piece absolute rounded-full will-change-[transform,box-shadow,opacity]"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: "#fef08a",
            boxShadow:
              "0 0 6px 2px rgba(254, 240, 138, 0.6), 0 0 14px 4px rgba(254, 240, 138, 0.25), 0 0 24px 8px rgba(254, 240, 138, 0.1)",
            animation: `firefly-float ${p.duration} ease-in-out infinite, firefly-glow ${2.5 + (p.id % 3) * 0.5}s ease-in-out infinite`,
            animationDelay: `${p.delay}, ${(p.id * 0.3) % 2}s`,
          }}
        />
      ))}
    </>
  );
}

type BackgroundEffectsProps = {
  effect: TripThemeEffect;
};

export default function BackgroundEffects({ effect }: BackgroundEffectsProps) {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    queueMicrotask(() =>
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches),
    );
  }, []);

  if (reducedMotion || effect === "none") {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
    >
      {effect === "aurora" ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(135deg, rgba(139,92,246,0.22) 0%, transparent 45%),
                linear-gradient(255deg, rgba(236,72,153,0.18) 0%, transparent 50%),
                linear-gradient(75deg, rgba(59,130,246,0.12) 0%, transparent 55%),
                linear-gradient(300deg, rgba(34,197,94,0.06) 0%, transparent 48%)
              `,
              backgroundSize: "220% 220%, 200% 200%, 240% 240%, 180% 180%",
              animation: "aurora-wave 22s ease-in-out infinite",
            }}
          />
          <div
            className="absolute inset-0 mix-blend-screen pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 50% at 20% 30%, rgba(139,92,246,0.12) 0%, transparent 50%),
                radial-gradient(ellipse 60% 80% at 80% 70%, rgba(236,72,153,0.1) 0%, transparent 50%),
                radial-gradient(ellipse 70% 60% at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 55%)`,
              backgroundSize: "200% 200%",
              animation: "aurora-wave 18s ease-in-out infinite reverse",
            }}
          />
        </>
      ) : null}

      {effect === "confetti" ? (
        <div className="absolute inset-0">
          <ConfettiPieces />
        </div>
      ) : null}

      {effect === "sparkles" ? (
        <div className="absolute inset-0">
          <SparklePieces />
        </div>
      ) : null}

      {effect === "snow" ? (
        <div className="absolute inset-0">
          <SnowPieces />
        </div>
      ) : null}

      {effect === "fireflies" ? (
        <div className="absolute inset-0">
          <FireflyPieces />
        </div>
      ) : null}
    </div>
  );
}
