/**
 * Logo de EscribaHoy: emblema (libro abierto + pluma) en navy/teal + wordmark
 * bicolor "EscribaHoy.com". Componente puro (sin hooks) → usable tanto en
 * server como en client components. Los colores del wordmark salen de los
 * tokens de marca en globals.css (--color-brand-ink / --color-accent).
 */

export function LogoMark({
  size = 32,
  className = "",
  decorative = false,
}: {
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : "EscribaHoy"}
    >
      <defs>
        <linearGradient
          id="eh-badge"
          x1="32"
          y1="2"
          x2="32"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#33566b" />
          <stop offset="1" stopColor="#182d3a" />
        </linearGradient>
      </defs>

      {/* Badge */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#eh-badge)" />

      {/* Puntos tipo ventana (arriba-izquierda) */}
      <circle cx="13" cy="13" r="2.3" fill="#17b9a8" />
      <circle cx="21" cy="13" r="2.3" fill="#17b9a8" />
      <circle cx="29" cy="13" r="2.3" fill="#17b9a8" />

      {/* Libro abierto */}
      <path
        d="M32 31 C26 27.8 17.5 27.8 11.5 30.6 L11.5 49 C17.5 46.2 26 46.2 32 49 Z"
        fill="#ffffff"
      />
      <path
        d="M32 31 C38 27.8 46.5 27.8 52.5 30.6 L52.5 49 C46.5 46.2 38 46.2 32 49 Z"
        fill="#eaf6f4"
      />
      <path
        d="M32 31 L32 49"
        stroke="#0e9d8e"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Renglones de las páginas */}
      <g stroke="#12b3a3" strokeWidth="1.3" strokeLinecap="round" opacity="0.9">
        <path d="M16 35 L27.5 33.4" />
        <path d="M16 39 L27.5 37.4" />
        <path d="M16 43 L27.5 41.4" />
        <path d="M36.5 33.4 L48 35" />
        <path d="M36.5 37.4 L48 39" />
        <path d="M36.5 41.4 L48 43" />
      </g>

      {/* Pluma fuente cruzando el libro */}
      <g transform="translate(40 25) rotate(45)">
        <rect x="-3" y="-17" width="6" height="21" rx="3" fill="#17b9a8" />
        <rect x="-3" y="-17" width="6" height="3.4" rx="1.7" fill="#0e9d8e" />
        <path d="M-3 4 L3 4 L0 14 Z" fill="#0e9d8e" />
        <line
          x1="0"
          y1="6"
          x2="0"
          y2="12"
          stroke="#ffffff"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <circle cx="0" cy="6.4" r="0.9" fill="#ffffff" />
      </g>
    </svg>
  );
}

export function Logo({
  size = 32,
  showWordmark = true,
  showDotCom = true,
  className = "",
  wordmarkClassName = "",
}: {
  size?: number;
  showWordmark?: boolean;
  showDotCom?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  const fontSize = Math.round(size * 0.6);
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} decorative={showWordmark} />
      {showWordmark && (
        <span
          className={`font-bold tracking-tight leading-none whitespace-nowrap ${wordmarkClassName}`}
          style={{ fontSize }}
        >
          <span style={{ color: "var(--color-brand-ink)" }}>Escriba</span>
          <span style={{ color: "var(--color-accent)" }}>Hoy</span>
          {showDotCom && (
            <span
              style={{ color: "var(--color-accent)", fontSize: "0.52em" }}
              className="font-semibold align-baseline"
            >
              .com
            </span>
          )}
        </span>
      )}
    </span>
  );
}
