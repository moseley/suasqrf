/**
 * Stroke icons, traced from the design canvas. One style throughout:
 * 24-unit grid, 2.75 stroke, round caps and joins.
 */

type IconProps = {
  size?: number;
  color?: string;
  className?: string;
};

function svgProps({ size = 24, color = "currentColor" }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function ShieldCheck(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function ArrowLeft(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function User(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function Car(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
      <circle cx="6.5" cy="16.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  );
}

export function Utensils(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <path d="M7 2v7a2 2 0 004 0V2M9 2v20M17 2c0 4-2 5-2 5v13" />
    </svg>
  );
}

export function Home(props: IconProps) {
  return (
    <svg {...svgProps(props)} className={props.className}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function Alert({ size = 24, color = "currentColor", className }: IconProps) {
  return (
    <svg {...svgProps({ size, color })} className={className} style={{ flex: "none" }}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r="0.6" fill={color} />
    </svg>
  );
}
