import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
};

const INPUT_CLASSES =
  "min-h-12 w-full border-2 border-[#121212] bg-white px-4 py-3 text-base text-[#121212] font-medium outline-none transition-all duration-200 placeholder:text-[#888888] focus:ring-2 focus:ring-[#1040C0] focus:ring-offset-2 focus:ring-offset-[#F0F0F0] disabled:cursor-not-allowed disabled:bg-[#E0E0E0] disabled:text-[#888888]";

export function inputClassName(className = ""): string {
  return [INPUT_CLASSES, className].filter(Boolean).join(" ");
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", error, hint, label, ...props },
  ref,
) {
  return (
    <label className="block space-y-2">
      {label ? (
        <span className="block text-sm font-bold uppercase tracking-widest text-[#121212]">
          {label}
        </span>
      ) : null}
      <input ref={ref} className={inputClassName(className)} {...props} />
      {error ? <span className="block text-sm font-medium text-[#D02020]">{error}</span> : null}
      {!error && hint ? <span className="block text-sm text-[#888888]">{hint}</span> : null}
    </label>
  );
});

export default Input;
