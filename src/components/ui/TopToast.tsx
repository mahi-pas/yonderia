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
          "w-full max-w-md rounded-[1.35rem] px-4 py-3 text-sm font-semibold shadow-[0_18px_45px_rgba(90,40,20,0.18)]",
          tone === "success"
            ? "border border-[#cfe4c7] bg-[#f4fff0] text-[#355722]"
            : "border border-[#efb9a3] bg-[#fff1ea] text-[#8b3f22]",
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
