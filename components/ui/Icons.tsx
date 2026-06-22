import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const HomeIcon = (props: IconProps) => <svg {...base} {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-7h6v7"/></svg>;
export const VaultIcon = (props: IconProps) => <svg {...base} {...props}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 4v5M16 4v5M8 14h8M8 17h5"/></svg>;
export const PlusIcon = (props: IconProps) => <svg {...base} {...props}><path d="M12 5v14M5 12h14"/></svg>;
export const SearchIcon = (props: IconProps) => <svg {...base} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
export const UserIcon = (props: IconProps) => <svg {...base} {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.5-6 8-6s7.2 1.8 8 6"/></svg>;
export const SunIcon = (props: IconProps) => <svg {...base} {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>;
export const MoonIcon = (props: IconProps) => <svg {...base} {...props}><path d="M21 15.2A9 9 0 1 1 8.8 3 7 7 0 0 0 21 15.2Z"/></svg>;
export const ArrowLeftIcon = (props: IconProps) => <svg {...base} {...props}><path d="m15 18-6-6 6-6"/></svg>;
export const ArrowRightIcon = (props: IconProps) => <svg {...base} {...props}><path d="m9 18 6-6-6-6"/></svg>;
export const ImageIcon = (props: IconProps) => <svg {...base} {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>;
export const XIcon = (props: IconProps) => <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>;
export const EyeIcon = (props: IconProps) => <svg {...base} {...props}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
export const MoreIcon = (props: IconProps) => <svg {...base} {...props}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>;
export const SparkIcon = (props: IconProps) => <svg {...base} {...props}><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>;
export const LogoutIcon = (props: IconProps) => <svg {...base} {...props}><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>;

