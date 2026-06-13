import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { authenticate } from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return json({ error: "Missing form id" }, { status: 400, headers: corsHeaders });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session?.shop) {
    return json({ error: "Unauthorized app proxy request" }, { status: 401, headers: corsHeaders });
  }

  const formRecord = await db.form.findFirst({
    where: { id, shop: session.shop },
    include: {
      fields: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!formRecord) {
    return json({ error: "Form not found" }, { status: 404, headers: corsHeaders });
  }

  await db.form.updateMany({
    where: { id, shop: session.shop },
    data: { views: { increment: 1 } },
  });

  return json({ form: { ...formRecord, views: formRecord.views + 1 } }, { headers: corsHeaders });
};

export const action = () => {
  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};
