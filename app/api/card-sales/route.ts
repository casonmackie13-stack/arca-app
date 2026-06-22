import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
export async function POST(request: Request) {
  if (!await authenticatedServerClient(request)) return NextResponse.json({error:"Authentication required."},{status:401});
  const body = await request.json().catch(() => ({})) as {sales_query?:string};
  return NextResponse.json({ available:false, message:"Recent sales lookup is not connected yet.", suggested_query:body.sales_query || "", sales:[] });
}
