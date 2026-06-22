import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
export async function POST(request: Request) {
  if (!await authenticatedServerClient(request)) return NextResponse.json({error:"Authentication required."},{status:401});
  return NextResponse.json({ available:false, message:"Better image lookup is not connected yet.", suggestions:[] });
}
