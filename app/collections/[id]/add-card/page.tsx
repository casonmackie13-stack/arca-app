import { redirect } from "next/navigation";

export default async function LegacyAddCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cards/new?collection=${encodeURIComponent(id)}`);
}
