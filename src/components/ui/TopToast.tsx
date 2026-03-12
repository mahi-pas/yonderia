"use client";

type TopToastProps = {
  message: string;
  tone: "error" | "success";
};

export default function TopToast({ message, tone }: TopToastProps) {
  return (
    <div className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex justify-center sm:top-4">
      <div
        className={[
          "animate-slide-in-top w-full max-w-md rounded-full px-4 py-3 text-sm font-semibold shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm",
          tone === "success"
            ? "border border-[#22c55e]/30 bg-[#052e16]/90 text-[#86efac]"
            : "border border-[#ef4444]/30 bg-[#450a0a]/90 text-[#fca5a5]",
        ]
          .filter(Boolean)
          .join(" ")}
        role="status"
      >
        {message}
      </div>
    </div>
  );
}
