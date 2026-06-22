import Image from "next/image";

export default function ArcaImage({ src, alt, className = "", sizes = "(max-width: 768px) 100vw, 50vw" }: { src: string; alt: string; className?: string; sizes?: string }) {
  return <Image src={src} alt={alt} fill sizes={sizes} unoptimized className={className}/>;
}
