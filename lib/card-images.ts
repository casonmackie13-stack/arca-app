import type { CardImage, CardSummary } from "@/lib/types";

export function imageByType(images: CardImage[] | undefined, type: "front" | "back") {
  return images?.find((image) => image.image_type === type) || null;
}

export function cardFrontImage(card: CardSummary) {
  return card.display_image_url
    || card.front_image_url
    || imageByType(card.card_images, "front")?.image_url
    || card.card_images?.[0]?.image_url
    || null;
}

export function cardBackImage(card: CardSummary) {
  return card.back_image_url || imageByType(card.card_images, "back")?.image_url || null;
}

export function cardImageStoragePath(publicUrl?: string | null) {
  if (!publicUrl) return null;
  const marker = "/storage/v1/object/public/card_images/";
  const index = publicUrl.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(publicUrl.slice(index + marker.length));
}
