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
          "animate-slide-in-top w-full max-w-md border-2 border-[#121212] px-4 py-3 text-sm font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_black]",
          tone === "success"
            ? "bg-[#22c55e] text-white"
            : "bg-[#D02020] text-white",
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
