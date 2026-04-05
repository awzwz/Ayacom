import { NextRequest, NextResponse } from "next/server";

const ORIGIN = process.env.UTO_API_ORIGIN ?? "http://127.0.0.1:8000";

async function proxy(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const url = `${ORIGIN}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const init: RequestInit = { method: req.method, headers, cache: "no-store" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const res = await fetch(url, init);
  const body = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "application/json";

  return new NextResponse(body, {
    status: res.status,
    statusText: res.statusText,
    headers: { "content-type": contentType },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

/** CORS preflight when the browser calls the proxy cross-origin */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, accept",
      "Access-Control-Max-Age": "86400",
    },
  });
}
