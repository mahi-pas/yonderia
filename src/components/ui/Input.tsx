import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
};

const INPUT_CLASSES =
  "min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-3 text-base text-[#fafafa] outline-none transition-all duration-200 placeholder:text-[var(--muted-foreground)] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#8b5cf6]/20 focus:shadow-[0_0_0_1px_rgba(139,92,246,0.3)] disabled:cursor-not-allowed disabled:bg-[var(--background)] disabled:text-[var(--muted-foreground)]";

export function inputClassName(className = ""): string {
  return [INPUT_CLASSES, className].filter(Boolean).join(" ");
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", error, hint, label, ...props },
  ref,
) {
  return (
    <label className="block space-y-2">
      {label ? <span className="block text-sm font-medium text-[#d4d4d8]">{label}</span> : null}
      <input ref={ref} className={inputClassName(className)} {...props} />
      {error ? <span className="block text-sm text-[#f87171]">{error}</span> : null}
      {!error && hint ? <span className="block text-sm text-[var(--muted-foreground)]">{hint}</span> : null}
    </label>
  );
});

export default Input;
