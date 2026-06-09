import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type PrivacyPayload = {
  shop_domain?: string;
  customer?: {
    email?: string;
    phone?: string;
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const privacyPayload = payload as PrivacyPayload;
  const shopDomain = privacyPayload.shop_domain || shop;

  if (topic === "customers/redact") {
    const filters = [
      privacyPayload.customer?.email ? { email: privacyPayload.customer.email } : null,
      privacyPayload.customer?.phone ? { phone: privacyPayload.customer.phone } : null,
    ].filter(Boolean) as Array<{ email: string } | { phone: string }>;

    if (filters.length > 0) {
      await db.submission.deleteMany({
        where: {
          shop: shopDomain,
          OR: filters,
        },
      });
    }
  }

  if (topic === "shop/redact") {
    await db.submission.deleteMany({ where: { shop: shopDomain } });
    await db.form.deleteMany({ where: { shop: shopDomain } });
    await db.setting.deleteMany({ where: { shop: shopDomain } });
    await db.session.deleteMany({ where: { shop: shopDomain } });
  }

  console.log(`Processed GDPR mandatory ${topic} webhook for ${shopDomain}`);
  return new Response(null, { status: 200 });
};
