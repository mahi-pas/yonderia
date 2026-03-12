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
    setCount(mq.matches ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP);
    const handler = () => setCount(mq.matches ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return count;
}

function ConfettiPieces() {
  const count = useParticleCount();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 7 + 3) % 100}%`,
        delay: `${(i * 0.4) % 6}s`,
        duration: `${6 + (i % 4)}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + (i % 4),
        rotation: i * 37,
      })),
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
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size * 1.4}px`,
            backgroundColor: p.color,
            borderRadius: "1px",
            animation: `confetti-fall ${p.duration} linear infinite`,
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
  const count = Math.min(15, particleCount);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 13 + 5) % 95}%`,
        top: `${(i * 11 + 8) % 90}%`,
        delay: `${(i * 0.5) % 3}s`,
        duration: "2.5s",
        size: 2 + (i % 2),
      })),
    [count],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="sparkle-piece absolute rounded-full bg-white will-change-[opacity,transform]"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            boxShadow: "0 0 6px rgba(255,255,255,0.8)",
            animation: `sparkle-twinkle ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </>
  );
}

function SnowPieces() {
  const count = useParticleCount();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 8 + 2) % 98}%`,
        delay: `${(i * 0.35) % 5}s`,
        duration: `${8 + (i % 3)}s`,
        size: 3 + (i % 3),
        opacity: 0.4 + (i % 4) * 0.15,
      })),
    [count],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="snow-piece absolute rounded-full bg-white will-change-transform"
          style={{
            left: p.left,
            top: "-8px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `snow-fall ${p.duration} linear infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </>
  );
}

function FireflyPieces() {
  const particleCount = useParticleCount();
  const count = Math.min(10, particleCount);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 15 + 10) % 85}%`,
        top: `${(i * 12 + 15) % 80}%`,
        delay: `${(i * 0.6) % 4}s`,
        duration: `${5 + (i % 4)}s`,
      })),
    [count],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="firefly-piece absolute h-1.5 w-1.5 rounded-full will-change-transform"
          style={{
            left: p.left,
            top: p.top,
            backgroundColor: "#fef08a",
            boxShadow: "0 0 8px #fef08a, 0 0 16px rgba(254,240,138,0.4)",
            animation: `firefly-float ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
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
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            background: `
              linear-gradient(120deg, rgba(139,92,246,0.25) 0%, transparent 40%),
              linear-gradient(240deg, rgba(236,72,153,0.2) 0%, transparent 45%),
              linear-gradient(60deg, rgba(59,130,246,0.15) 0%, transparent 50%)
            `,
            backgroundSize: "200% 200%",
            animation: "aurora-wave 18s ease-in-out infinite",
          }}
        />
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
