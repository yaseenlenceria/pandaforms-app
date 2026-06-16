import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { authenticate } from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning, bypass-tunnel-reminder",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  // Try to authenticate via Shopify App Proxy (verifies HMAC signature).
  // If this succeeds we can scope the lookup to the correct shop.
  // If it fails (e.g. direct call, missing sig) we fall back to ID-only lookup
  // — form IDs are UUIDs so they are effectively unguessable.
  let shop: string | null = null;

  try {
    const { session } = await authenticate.public.appProxy(request);
    shop = session?.shop ?? null;
  } catch (_) {
    // Proxy auth failed — allow fallback to ID-only lookup below
    shop = null;
  }

  if (!id && !shop) {
    return json({ error: "Missing form id" }, { status: 400, headers: corsHeaders });
  }

  // Look up the form. If no ID is provided by the app embed, use the
  // shop's latest active form so merchants only need to enable the embed.
  const whereClause = id
    ? shop
      ? { id, shop }
      : { id }
    : { shop: shop as string, status: "ACTIVE" };

  const formRecord = await db.form.findFirst({
    where: whereClause,
    include: {
      fields: {
        orderBy: { position: "asc" },
      },
    },
    orderBy: id ? undefined : { updatedAt: "desc" },
  });

  if (!formRecord) {
    return json(
      { error: "Form not found. Please check your Form ID is correct." },
      { status: 404, headers: corsHeaders }
    );
  }

  // Increment view counter (fire-and-forget)
  db.form.updateMany({
    where: { id: formRecord.id },
    data: { views: { increment: 1 } },
  }).catch(() => {});

  return json(
    { form: { ...formRecord, views: formRecord.views + 1 } },
    { headers: corsHeaders }
  );
};

export const action = () => {
  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};
