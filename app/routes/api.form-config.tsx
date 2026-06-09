import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

  // Increment view count
  const form = await db.form.update({
    where: { id },
    data: { views: { increment: 1 } },
    include: {
      fields: {
        orderBy: { position: "asc" },
      },
    },
  }).catch(() => {
    // Fallback if update fails
    return db.form.findUnique({
      where: { id },
      include: {
        fields: {
          orderBy: { position: "asc" },
        },
      },
    });
  });

  if (!form) {
    return json({ error: "Form not found" }, { status: 404, headers: corsHeaders });
  }

  return json({ form }, { headers: corsHeaders });
};

export const action = () => {
  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};
