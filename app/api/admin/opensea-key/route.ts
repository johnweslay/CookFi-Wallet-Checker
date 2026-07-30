export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// One-time convenience route: gets an OpenSea instant free-tier API key on your behalf
// (server-to-server, so no CORS issues) since the dashboard's "Create key" flow requires
// collection trading volume this project doesn't have. The instant key expires in 30 days —
// fine to start with; swap for a full key later once you qualify or get approved manually.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch("https://api.opensea.io/api/v2/auth/keys", { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: res.status });
  }

  return NextResponse.json(data);
}
