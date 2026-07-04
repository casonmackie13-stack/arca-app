"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const privateBuckets = ["card_images", "collection_covers"] as const;

function storageObject(src: string) {
  for (const bucket of privateBuckets) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = src.indexOf(marker);
    if (index !== -1) {
      return {
        bucket,
        path: decodeURIComponent(src.slice(index + marker.length)),
      };
    }
  }
  return null;
}

export default function ArcaImage({ src, alt, className = "", sizes = "(max-width: 768px) 100vw, 50vw" }: { src: string; alt: string; className?: string; sizes?: string }) {
  const object = useMemo(() => storageObject(src), [src]);
  const [signed, setSigned] = useState<{ source: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (!object) return;
    const target = object;

    async function signObject() {
      const { data, error } = await supabase.storage
        .from(target.bucket)
        .createSignedUrl(target.path, 60 * 10);

      if (active && !error && data?.signedUrl) {
        setSigned({ source: src, url: data.signedUrl });
      }
    }

    void signObject();
    return () => {
      active = false;
    };
  }, [object, src]);

  return <Image src={object && signed?.source === src ? signed.url : src} alt={alt} fill sizes={sizes} unoptimized className={className}/>;
}
