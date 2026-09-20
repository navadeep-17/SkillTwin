import type { SVGProps } from "react";

export function SkillTwinMark({
  className = "size-9",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="SkillTwin"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="skilltwin-a" x1="10" y1="7" x2="51" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5FC7FF" />
          <stop offset="0.52" stopColor="#5B5CE2" />
          <stop offset="1" stopColor="#3E3ACF" />
        </linearGradient>
        <linearGradient id="skilltwin-b" x1="12" y1="54" x2="53" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B06CFF" />
          <stop offset="0.48" stopColor="#6B4CF2" />
          <stop offset="1" stopColor="#4245D9" />
        </linearGradient>
        <radialGradient id="skilltwin-node" cx="0" cy="0" r="1" gradientTransform="translate(20 44) rotate(-25) scale(11)">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D9DAFF" />
        </radialGradient>
      </defs>
      <path
        d="M15.3 11.8c6.5-5 14.2-6 22-2.7l12.8 5.6c5 2.2 7.1 8.2 4.4 13-2.6 4.6-8.3 6.2-12.8 3.8l-11-5.9c-2.9-1.5-6.3-1.1-8.7 1l-7 6.2c-4.1 3.6-10.4 3.1-13.9-1-3.5-4.2-2.9-10.4 1.3-13.9l12.9-10.1Z"
        fill="url(#skilltwin-a)"
      />
      <path
        d="M48.7 52.2c-6.5 5-14.2 6-22 2.7l-12.8-5.6c-5-2.2-7.1-8.2-4.4-13 2.6-4.6 8.3-6.2 12.8-3.8l11 5.9c2.9 1.5 6.3 1.1 8.7-1l7-6.2c4.1-3.6 10.4-3.1 13.9 1 3.5 4.2 2.9 10.4-1.3 13.9L48.7 52.2Z"
        fill="url(#skilltwin-b)"
      />
      <circle cx="46" cy="20" r="7.4" fill="url(#skilltwin-node)" />
      <circle cx="18" cy="44" r="7.4" fill="url(#skilltwin-node)" />
    </svg>
  );
}

export function SkillTwinLogo({
  compact = false,
  className = ""
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={"inline-flex items-center gap-2.5 " + className}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-white shadow-[0_6px_24px_rgba(91,92,226,0.12)] ring-1 ring-brand-100/80">
        <SkillTwinMark className="size-8" />
      </span>
      {!compact ? (
        <span className="text-[1.08rem] font-semibold tracking-tight text-slate-950">SkillTwin</span>
      ) : null}
    </span>
  );
}
