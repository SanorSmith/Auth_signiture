export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 text-base" : "h-8 w-8 text-xs";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${box} inline-flex items-center justify-center rounded-lg bg-accent font-bold tracking-tight text-accent-ink`}>AS</span>
      <span className={`${size === "lg" ? "text-xl" : "hidden text-sm sm:inline"} font-semibold tracking-tight`}>Auth Signature</span>
    </span>
  );
}
