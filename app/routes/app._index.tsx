import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Text,
  Card,
  BlockStack,
  InlineGrid,
  InlineStack,
  Badge,
  Button,
  IndexTable,
  Icon,
  Divider,
  Box,
} from "@shopify/polaris";
import {
  PlusIcon,
  SettingsIcon,
  ViewIcon,
  CheckIcon,
  AlertBubbleIcon,
  CalendarIcon,
  PersonIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get count stats
  const totalForms = await db.form.count({ where: { shop } });
  const totalSubmissions = await db.submission.count({ where: { shop } });
  const pendingSubmissions = await db.submission.count({
    where: { shop, status: "PENDING" },
  });

  // Get latest submissions
  const latestSubmissions = await db.submission.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      form: {
        select: { title: true },
      },
    },
  });

  // Get latest forms
  const latestForms = await db.form.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  // Get settings for health check
  const settings = await db.setting.findUnique({ where: { shop } });

  // Compile Dynamic Activity Feed
  const activities: { id: string; type: string; title: string; subtitle: string; time: Date; tone?: "info" | "success" | "warning" | "attention" }[] = [];

  latestSubmissions.forEach((sub) => {
    activities.push({
      id: `sub-${sub.id}`,
      type: "submission",
      title: `Submission from ${sub.customerName || sub.email || "Anonymous"}`,
      subtitle: `Form: ${sub.form.title} | Status: ${sub.status}`,
      time: new Date(sub.createdAt),
      tone: sub.status === "APPROVED" ? "success" : sub.status === "REJECTED" ? "warning" : "attention",
    });

    if (sub.status === "APPROVED" && sub.syncStatus === "SUCCESS") {
      activities.push({
        id: `sync-${sub.id}`,
        type: "sync",
        title: `Shopify Account Synced`,
        subtitle: `Customer ${sub.email} tagged & verified in Shopify`,
        time: new Date(sub.updatedAt),
        tone: "success",
      });
    }
  });

  latestForms.forEach((form) => {
    activities.push({
      id: `form-${form.id}`,
      type: "form",
      title: `Form Modified: ${form.title}`,
      subtitle: `${form.views} storefront views registered`,
      time: new Date(form.updatedAt),
      tone: "info",
    });
  });

  // Sort activities by date desc, take top 6
  activities.sort((a, b) => b.time.getTime() - a.time.getTime());
  const finalActivities = activities.slice(0, 6);

  // SMTP Connection Check
  const smtpConfigured = !!(settings?.smtpHost && settings?.smtpUser && settings?.smtpPass);
  const reCaptchaConfigured = !!(settings?.enableReCAPTCHA && settings?.recaptchaSiteKey);

  return json({
    totalForms,
    totalSubmissions,
    pendingSubmissions,
    latestSubmissions,
    activities: finalActivities,
    smtpConfigured,
    reCaptchaConfigured,
    shop,
    apiKey: process.env.SHOPIFY_API_KEY || "",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const templateType = formData.get("templateType");

  if (!templateType) {
    return json({ error: "Missing template type" }, { status: 400 });
  }

  let formTitle = "";
  let formDesc = "";
  let successMsg = "Thank you for your submission!";
  let fields: { type: string; label: string; placeholder?: string; required: boolean; position: number; width: string; name: string; choices?: string }[] = [];

  switch (templateType) {
    case "wholesale":
      formTitle = "Wholesale Registration";
      formDesc = "Apply for a wholesale account. Once approved, you will be tagged as a wholesale customer.";
      successMsg = "Thank you for applying. We will review your application and notify you shortly!";
      fields = [
        { type: "text", label: "First Name", placeholder: "John", required: true, position: 1, width: "half", name: "first_name" },
        { type: "text", label: "Last Name", placeholder: "Doe", required: true, position: 2, width: "half", name: "last_name" },
        { type: "email", label: "Business Email", placeholder: "john@company.com", required: true, position: 3, width: "half", name: "email" },
        { type: "phone", label: "Phone Number", placeholder: "+1 (555) 000-0000", required: false, position: 4, width: "half", name: "phone" },
        { type: "text", label: "Company Name", placeholder: "Acme Corp", required: true, position: 5, width: "half", name: "company_name" },
        { type: "text", label: "Tax ID / VAT Number", placeholder: "12-3456789", required: true, position: 6, width: "half", name: "tax_id" },
        { type: "textarea", label: "Business Description & Comments", placeholder: "Tell us about your retail store...", required: false, position: 7, width: "full", name: "comments" },
      ];
      break;
    case "customer_reg":
      formTitle = "Customer Registration";
      formDesc = "Sign up for a new account. Admin approval required to activate.";
      fields = [
        { type: "text", label: "First Name", placeholder: "First Name", required: true, position: 1, width: "half", name: "first_name" },
        { type: "text", label: "Last Name", placeholder: "Last Name", required: true, position: 2, width: "half", name: "last_name" },
        { type: "email", label: "Email Address", placeholder: "email@example.com", required: true, position: 3, width: "full", name: "email" },
        { type: "phone", label: "Phone Number", placeholder: "+1 (555) 000-0000", required: false, position: 4, width: "full", name: "phone" },
      ];
      break;
    case "product_enquiry":
      formTitle = "Product Enquiry";
      formDesc = "Have questions about a product? Ask us here.";
      fields = [
        { type: "text", label: "Full Name", placeholder: "Your Name", required: true, position: 1, width: "half", name: "full_name" },
        { type: "email", label: "Email Address", placeholder: "you@example.com", required: true, position: 2, width: "half", name: "email" },
        { type: "text", label: "Product Name or URL", placeholder: "Product name...", required: true, position: 3, width: "full", name: "product" },
        { type: "textarea", label: "Enquiry Details", placeholder: "What would you like to know?", required: true, position: 4, width: "full", name: "details" },
      ];
      break;
    case "contact":
      formTitle = "Contact Form";
      formDesc = "Get in touch with our support team.";
      fields = [
        { type: "text", label: "Name", placeholder: "Your Name", required: true, position: 1, width: "half", name: "name" },
        { type: "email", label: "Email", placeholder: "you@example.com", required: true, position: 2, width: "half", name: "email" },
        { type: "phone", label: "Phone Number", placeholder: "", required: false, position: 3, width: "full", name: "phone" },
        { type: "textarea", label: "Message", placeholder: "How can we help you?", required: true, position: 4, width: "full", name: "message" },
      ];
      break;
    case "appointment":
      formTitle = "Appointment Request";
      formDesc = "Schedule an appointment with us.";
      fields = [
        { type: "text", label: "Full Name", required: true, position: 1, width: "half", name: "name" },
        { type: "email", label: "Email", required: true, position: 2, width: "half", name: "email" },
        { type: "date", label: "Preferred Date", required: true, position: 3, width: "full", name: "date" },
        { type: "textarea", label: "Details & Comments", required: false, position: 4, width: "full", name: "comments" },
      ];
      break;
    case "return_request":
      formTitle = "Return Request Form";
      formDesc = "Submit a request to return an item from your order.";
      fields = [
        { type: "text", label: "Order Number", placeholder: "#1001", required: true, position: 1, width: "half", name: "order_number" },
        { type: "email", label: "Email Address", placeholder: "you@example.com", required: true, position: 2, width: "half", name: "email" },
        { type: "select", label: "Reason for Return", required: true, position: 3, width: "full", name: "reason", choices: "Defective item,Wrong size,Wrong item received,No longer needed" },
        { type: "textarea", label: "Additional Comments", required: false, position: 4, width: "full", name: "comments" },
      ];
      break;
    default:
      return json({ error: "Invalid template type" }, { status: 400 });
  }

  // Save to database
  const form = await db.form.create({
    data: {
      title: formTitle,
      description: formDesc,
      successMessage: successMsg,
      shop,
      fields: {
        create: fields,
      },
    },
  });

  return redirect(`/app/forms/${form.id}`);
};

export default function Index() {
  const {
    totalForms,
    totalSubmissions,
    pendingSubmissions,
    latestSubmissions,
    activities,
    smtpConfigured,
    reCaptchaConfigured,
    shop,
    apiKey,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const handleCreateTemplate = (templateType: string) => {
    fetcher.submit({ templateType }, { method: "POST" });
  };

  const templates = [
    { id: "wholesale", title: "Wholesale Registration", tag: "Customer Sync" },
    { id: "customer_reg", title: "Customer Registration", tag: "Customer Sync" },
    { id: "product_enquiry", title: "Product Enquiry", tag: "Page Widget" },
    { id: "contact", title: "Contact Form", tag: "General" },
    { id: "appointment", title: "Appointment Booking", tag: "Specialty" },
    { id: "return_request", title: "Return Request", tag: "Service" },
  ];

  return (
    <Page>
      <BlockStack gap="600">
        
        {/* Value Proposition Hero */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
          borderRadius: "16px",
          padding: "48px 40px",
          color: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)"
        }}>
          <div style={{ flex: "1 1 500px" }}>
            <Badge tone="attention">PandaForms Suite</Badge>
            <div style={{ fontSize: "24px", fontWeight: "800", marginTop: "12px", marginBottom: "8px", letterSpacing: "-0.5px" }}>
              B2B & Custom Storefront Forms
            </div>
            <div style={{ fontSize: "16px", opacity: 0.85, maxWidth: "600px", lineHeight: "1.6" }}>
              Design responsive forms, manage wholesale approvals, tag customers, and track SMTP delivery health from Shopify admin.
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button
              onClick={() => handleCreateTemplate("wholesale")}
              variant="primary"
              size="large"
              icon={PlusIcon}
              disabled={fetcher.state !== "idle"}
            >
              {fetcher.state !== "idle" ? "Creating..." : "Create Form"}
            </Button>
            <Button
              onClick={() => navigate("/app/forms")}
              size="large"
            >
              View My Forms
            </Button>
          </div>
        </div>

        {/* Theme Onboarding Guide Card */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">
                  🛠️ Storefront Theme Integration Guide
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  PandaForms supports two ways to display your forms on your storefront. Follow these steps to make them visible:
                </Text>
              </BlockStack>
              <Button
                variant="primary"
                url={`https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/form_widget`}
                target="_blank"
                icon={SettingsIcon}
              >
                Open Theme Editor & Enable Embed
              </Button>
            </InlineStack>

            <Divider />

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="600">
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="success">
                  Option A: Add as a Custom Page Section (Recommended)
                </Text>
                <Text variant="bodyMd" as="p">
                  Best for dedicatng a specific page (e.g. <code>/pages/wholesale</code> or <code>/pages/contact</code>) to a single form.
                </Text>
                <Box padding="300" background="bg-surface-active" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="p"><strong>1. Create a Page:</strong> Go to <strong>Online Store → Pages</strong> in Shopify and add a new page (e.g. "Wholesale Registration").</Text>
                    <Text variant="bodySm" as="p"><strong>2. Customize Theme:</strong> Go to <strong>Online Store → Themes</strong>, and click <strong>Customize</strong> on your active theme.</Text>
                    <Text variant="bodySm" as="p"><strong>3. Go to Page:</strong> Use the top template selector in the Theme Editor to select your newly created page.</Text>
                    <Text variant="bodySm" as="p"><strong>4. Add App Section:</strong> Click <strong>Add section</strong> in the left sidebar, switch to the <strong>Apps</strong> tab, and choose <strong>PandaForms Widget</strong>.</Text>
                    <Text variant="bodySm" as="p"><strong>5. Set Form ID:</strong> Open the block settings on the right, copy your <strong>Form ID</strong> from your Forms list, paste it, and click <strong>Save</strong>.</Text>
                  </BlockStack>
                </Box>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="attention">
                  Option B: Enable App Embed globally
                </Text>
                <Text variant="bodyMd" as="p">
                  Allows you to inject the form widget into the body of your page templates globally.
                </Text>
                <Box padding="300" background="bg-surface-active" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="p"><strong>1. Enable App Embed:</strong> Click the <strong>Open Theme Editor & Enable Embed</strong> button above.</Text>
                    <Text variant="bodySm" as="p"><strong>2. Toggle Switch:</strong> Locate <strong>PandaForms Widget</strong> in the App embeds list on the left side and toggle it to <strong>Enabled</strong>.</Text>
                    <Text variant="bodySm" as="p"><strong>3. Configure Form:</strong> Paste your <strong>Form ID</strong> into the settings card on the right.</Text>
                    <Text variant="bodySm" as="p"><strong>4. Save Changes:</strong> Click <strong>Save</strong> in the top-right corner of the Shopify Theme Editor.</Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* 3 Core Numeric Stats */}
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <Card>
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">Total Forms Created</Text>
              <Text variant="headingLg" as="p" fontWeight="bold">{totalForms}</Text>
              <Button size="slim" variant="plain" onClick={() => navigate("/app/forms")}>
                Manage Forms
              </Button>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">Submissions Captured</Text>
              <Text variant="headingLg" as="p" fontWeight="bold">{totalSubmissions}</Text>
              <Button size="slim" variant="plain" onClick={() => navigate("/app/submissions")}>
                View Submissions
              </Button>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">Pending Approval Queue</Text>
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingLg" as="p" fontWeight="bold" tone={pendingSubmissions > 0 ? "critical" : "success"}>
                  {pendingSubmissions}
                </Text>
                {pendingSubmissions > 0 && <Badge tone="attention">Review Required</Badge>}
              </InlineStack>
              <Button size="slim" variant="plain" onClick={() => navigate("/app/submissions?status=PENDING")}>
                Review Submissions
              </Button>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Mid Section: Recent Activities & Latest Submissions */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          
          {/* Dynamic Recent Activity Audit Log */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Recent App Activity</Text>
              <Divider />
              {activities.length === 0 ? (
                <Box padding="400" textAlign="center">
                  <Text variant="bodyMd" as="p" tone="subdued">No recent events logged. Try creating a form!</Text>
                </Box>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {activities.map((act) => (
                    <div key={act.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ marginTop: "4px" }}>
                        {act.type === "submission" ? (
                          <Icon source={PersonIcon} tone="attention" />
                        ) : act.type === "sync" ? (
                          <Icon source={CheckIcon} tone="success" />
                        ) : (
                          <Icon source={SettingsIcon} tone="info" />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Text variant="bodyMd" as="strong" fontWeight="bold">{act.title}</Text>
                        <Text variant="bodySm" tone="subdued">{act.subtitle}</Text>
                        <Text variant="bodyXs" tone="subdued">
                          {new Date(act.time).toLocaleTimeString()} - {new Date(act.time).toLocaleDateString()}
                        </Text>
                      </div>
                      {act.tone && <Badge tone={act.tone}>{act.type}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </BlockStack>
          </Card>

          {/* Latest Submissions Panel */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Latest Submissions</Text>
              <Divider />
              {latestSubmissions.length === 0 ? (
                <Box padding="400" textAlign="center">
                  <Text variant="bodyMd" as="p" tone="subdued">No submissions received yet.</Text>
                </Box>
              ) : (
                <IndexTable
                  resourceName={{ singular: "submission", plural: "submissions" }}
                  itemCount={latestSubmissions.length}
                  headings={[
                    { title: "Form" },
                    { title: "Customer" },
                    { title: "Status" },
                    { title: "Action" },
                  ]}
                  selectable={false}
                >
                  {latestSubmissions.map((sub, index) => (
                    <IndexTable.Row id={sub.id} key={sub.id} position={index}>
                      <IndexTable.Cell>
                        <Text variant="bodySm" as="strong">{sub.form.title}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodySm">{sub.customerName || sub.email || "N/A"}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={sub.status === "APPROVED" ? "success" : sub.status === "REJECTED" ? "warning" : "attention"}>
                          {sub.status}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Button size="slim" onClick={() => navigate(`/app/submissions`)}>
                          Review
                        </Button>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Quick-Start Templates CTAs */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Quick-start Templates</Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              Click any template to instantly pre-populate and launch a fully functional storefront form.
            </Text>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleCreateTemplate(tmpl.id)}
                  disabled={fetcher.state !== "idle"}
                  style={{
                    background: fetcher.state !== "idle" && fetcher.formData?.get("templateType") === tmpl.id
                      ? "#e0e7ff" : "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "999px",
                    padding: "10px 20px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#334155",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "#e2e8f0"; }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = fetcher.state !== "idle" && fetcher.formData?.get("templateType") === tmpl.id ? "#e0e7ff" : "#f1f5f9"; }}
                >
                  {fetcher.state !== "idle" && fetcher.formData?.get("templateType") === tmpl.id
                    ? "Creating Form..." : tmpl.title}
                  <span style={{ fontSize: "10px", backgroundColor: "#fff", padding: "2px 6px", borderRadius: "999px", color: "#64748b", fontWeight: "bold" }}>
                    {tmpl.tag}
                  </span>
                </button>
              ))}
            </div>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
