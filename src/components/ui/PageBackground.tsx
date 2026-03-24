"use client";

export default function PageBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute -left-24 top-[10%] h-64 w-64 rounded-full bg-[#D02020] opacity-[0.06]"
      />
      <div
        className="absolute -right-16 top-[30%] h-48 w-48 bg-[#1040C0] opacity-[0.05] rotate-45"
      />
      <div
        className="absolute bottom-[15%] left-[40%] h-56 w-56 rounded-full bg-[#F0C020] opacity-[0.06]"
      />
      <div
        className="absolute right-[20%] top-[60%] h-32 w-32 bg-[#D02020] opacity-[0.04] rotate-12"
      />

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(#121212 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
