import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Page, Card, BlockStack, Text, Box } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export default function HelpCenter() {
  const faqs = [
    {
      q: "How can I get notified when someone submits the form?",
      a: "Go to Settings → Admin notification and tagging. Check 'Send Admin Email Notifications' and enter your email address. Save settings.",
    },
    {
      q: "How can I enable Google reCAPTCHA for my custom forms?",
      a: "Go to Settings → Admin notification and tagging. Check 'Enable Google reCAPTCHA v2' and enter your Site Key and Secret Key from Google. This blocks spam bots from submitting forms.",
    },
    {
      q: "How can I enable automatic approval so users get access immediately after submitting?",
      a: "Go to Settings → Customer approval behaviour. Enable 'Auto Approve Submissions'. New submissions will skip manual review and be synced to Shopify immediately with the approved customer tag.",
    },
    {
      q: "How can I change the tag for approved customers?",
      a: "Go to Settings → Customer approval behaviour. Update the 'Approved Customer Tag' or 'Wholesale Customer Tag' field with the tag name you want assigned. Click Save.",
    },
    {
      q: "How can I save form submission data into the Shopify customer's notes?",
      a: "Go to Settings → Customer approval behaviour. Enable 'Save to Customer Notes'. All submitted field values will be automatically written into the Shopify Customer profile's Notes section.",
    },
    {
      q: "How can I enable customer notification email templates?",
      a: "Go to Settings → Customer notifications. Enable any of the three templates — Registration Confirmation, Account Approved, and Account Rejected — and customise the subject and body text for each.",
    },
    {
      q: "How can I integrate HubSpot with my custom form?",
      a: "Go to Settings → Admin notification and tagging → HubSpot Integration. Check 'Enable HubSpot CRM Sync' and paste your HubSpot Access Token. New submissions will automatically create Contacts in HubSpot.",
    },
  ];

  return (
    <Page
      title="Help & FAQs"
      subtitle="Step-by-step guides for notifications, approval workflows, spam prevention, and integrations."
    >
      <BlockStack gap="400">
        {faqs.map((faq, idx) => (
          <Card key={idx}>
            <BlockStack gap="150">
              <Text variant="headingSm" as="h3">
                {faq.q}
              </Text>
              <Box paddingBlockStart="050">
                <Text variant="bodyMd" as="p" tone="subdued">
                  {faq.a}
                </Text>
              </Box>
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </Page>
  );
}
