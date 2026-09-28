// The course mark: an SSA φ on a silicon die. index.html inlines the same drawing as the favicon.

const PINS = 'M10 1.5h2.4v4H10zM14.8 1.5h2.4v4h-2.4zM19.6 1.5H22v4h-2.4zM10 26.5h2.4v4H10zM14.8 26.5h2.4v4h-2.4zM19.6 26.5H22v4h-2.4zM1.5 10h4v2.4h-4zM1.5 14.8h4v2.4h-4zM1.5 19.6h4V22h-4zM26.5 10h4v2.4h-4zM26.5 14.8h4v2.4h-4zM26.5 19.6h4V22h-4z';

export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <g fill="#c2410c">
        <rect x="5" y="5" width="22" height="22" rx="4.5" />
        <path d={PINS} />
      </g>
      <g stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round">
        <path d="M16 8.3v15.4" />
        <ellipse cx="16" cy="16" rx="5.4" ry="4.3" />
      </g>
    </svg>
  );
}
