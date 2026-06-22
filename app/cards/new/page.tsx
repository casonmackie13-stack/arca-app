import AddCardClient from "./AddCardClient";

export default async function NewCardPage({ searchParams }: { searchParams: Promise<{ collection?: string | string[] }> }) {
  const query = await searchParams;
  const initialCollectionId = typeof query.collection === "string" ? query.collection : undefined;
  return <AddCardClient initialCollectionId={initialCollectionId}/>;
}
