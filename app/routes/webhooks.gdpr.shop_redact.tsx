import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received GDPR mandatory ${topic} webhook for ${shop}`);

  // Shopify App Store compliance require 200 OK response
  return new Response(null, { status: 200 });
};
