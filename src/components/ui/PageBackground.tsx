"use client";

const STREAKS = Array.from({ length: 20 }, (_, i) => ({
  left: `${3 + i * 4.8}%`,
  height: `${50 + (i % 4) * 30}px`,
  opacity: 0.12 + (i % 3) * 0.06,
  glow: 3 + (i % 3) * 2,
  glowOpacity: 0.04 + (i % 3) * 0.03,
  duration: `${7 + (i % 6) * 1.8}s`,
  delay: `${i * 0.55}s`,
}));

export default function PageBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute -left-20 top-1/4 h-[500px] w-[500px] rounded-full blur-[120px]"
        style={{
          background: "rgba(139, 92, 246, 0.08)",
          animation: "glow-float 14s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-20 top-[5%] h-[400px] w-[400px] rounded-full blur-[100px]"
        style={{
          background: "rgba(236, 72, 153, 0.06)",
          animation: "glow-float 18s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute bottom-[-10%] left-[30%] h-[450px] w-[450px] rounded-full blur-[130px]"
        style={{
          background: "rgba(139, 92, 246, 0.05)",
          animation: "glow-float 16s ease-in-out infinite",
        }}
      />

      {STREAKS.map((s, i) => (
        <span
          key={i}
          className="absolute block w-px"
          style={{
            left: s.left,
            height: s.height,
            background: `linear-gradient(180deg, transparent, rgba(139, 92, 246, ${s.opacity}), transparent)`,
            boxShadow: `0 0 ${s.glow}px rgba(139, 92, 246, ${s.glowOpacity})`,
            animation: `streak-fall ${s.duration} linear infinite`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
