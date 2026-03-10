import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
};

const INPUT_CLASSES =
  "min-h-12 w-full rounded-[1.35rem] border border-[#e7c4b3] bg-white px-4 py-3 text-base text-[#34180f] outline-none transition placeholder:text-[#b78872] focus:border-[#c86f4a] focus:ring-4 focus:ring-[#ffe1d2] disabled:cursor-not-allowed disabled:bg-[#fff6f0]";

export function inputClassName(className = ""): string {
  return [INPUT_CLASSES, className].filter(Boolean).join(" ");
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", error, hint, label, ...props },
  ref,
) {
  return (
    <label className="block space-y-2">
      {label ? <span className="block text-sm font-semibold text-[#5a2b1c]">{label}</span> : null}
      <input ref={ref} className={inputClassName(className)} {...props} />
      {error ? <span className="block text-sm text-[#9a4424]">{error}</span> : null}
      {!error && hint ? <span className="block text-sm text-[#8b675a]">{hint}</span> : null}
    </label>
  );
});

export default Input;
