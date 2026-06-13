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
  Modal,
} from "@shopify/polaris";
import {
  PlusIcon,
  SettingsIcon,
  CheckIcon,
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

  const formsSummary = await db.form.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      _count: {
        select: {
          submissions: true,
          fields: true,
        },
      },
    },
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
    formsSummary,
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
    formsSummary,
    activities,
    shop,
    apiKey,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleCreateTemplate = (templateType: string) => {
    fetcher.submit({ templateType }, { method: "POST" });
  };

  const templates = [
    { id: "wholesale", title: "Wholesale Registration", tag: "B2B", description: "Approve business customers and sync wholesale tags." },
    { id: "customer_reg", title: "Customer Registration", tag: "Customer", description: "Collect customer details before account approval." },
    { id: "product_enquiry", title: "Product Enquiry", tag: "Sales", description: "Let shoppers ask questions from product or landing pages." },
    { id: "contact", title: "Contact Form", tag: "Support", description: "Simple support form for general store messages." },
    { id: "appointment", title: "Appointment Booking", tag: "Booking", description: "Capture appointment requests with preferred dates." },
    { id: "return_request", title: "Return Request", tag: "Service", description: "Collect order numbers and return reasons cleanly." },
  ];

  const isCreating = fetcher.state !== "idle";
  const creatingTemplateType = fetcher.formData?.get("templateType");

  return (
    <Page>
      <BlockStack gap="600">
        
        {/* Dashboard Header */}
        <div style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "36px 32px",
          color: "#111827",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)"
        }}>
          <div style={{ flex: "1 1 500px" }}>
            <Badge tone="info">Merchant dashboard</Badge>
            <div style={{ fontSize: "24px", fontWeight: "800", marginTop: "12px", marginBottom: "8px", letterSpacing: "-0.5px" }}>
              Manage forms, submissions, and storefront setup
            </div>
            <div style={{ fontSize: "16px", opacity: 0.85, maxWidth: "600px", lineHeight: "1.6" }}>
              Create a form from a guided template, review every submission, and see which forms are working from one page.
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button
              onClick={() => setCreateModalOpen(true)}
              variant="primary"
              size="large"
              icon={PlusIcon}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create form"}
            </Button>
            <Button onClick={() => navigate("/app/forms")} size="large">
              Manage forms
            </Button>
            <Button onClick={() => navigate("/app/submissions")} size="large">
              View submissions
            </Button>
          </div>
        </div>

        {/* Theme Onboarding Guide Card */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">
                  Storefront setup
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Add PandaForms to the theme once, then paste the form ID for the form you want to show.
                </Text>
              </BlockStack>
              <Button
                variant="primary"
                url={`https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/form_widget`}
                target="_blank"
                icon={SettingsIcon}
              >
                Open theme editor
              </Button>
            </InlineStack>

            <Divider />

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="600">
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="success">
                  Best option: add PandaForms Widget to a page
                </Text>
                <Text variant="bodyMd" as="p">
                  Use this for pages like <code>/pages/wholesale</code>, <code>/pages/contact</code>, or <code>/pages/returns</code>.
                </Text>
                <Box padding="300" background="bg-surface-active" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="p"><strong>1.</strong> Create or open the Shopify page where the form should appear.</Text>
                    <Text variant="bodySm" as="p"><strong>2.</strong> In theme customize, add the <strong>PandaForms Widget</strong> app section.</Text>
                    <Text variant="bodySm" as="p"><strong>3.</strong> Paste the <strong>Form ID</strong>, choose theme styling, and save.</Text>
                  </BlockStack>
                </Box>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="attention">
                  Alternative: enable the app embed
                </Text>
                <Text variant="bodyMd" as="p">
                  Use this only when you want one configured form injected globally through the theme app embed.
                </Text>
                <Box padding="300" background="bg-surface-active" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="p"><strong>1.</strong> Open the theme editor and enable <strong>PandaForms Widget</strong> in app embeds.</Text>
                    <Text variant="bodySm" as="p"><strong>2.</strong> Paste the form ID in the embed settings.</Text>
                    <Text variant="bodySm" as="p"><strong>3.</strong> Save the theme and test the storefront page.</Text>
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

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">Submissions by form</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  See which form is collecting submissions, how many fields it has, and where to review entries.
                </Text>
              </BlockStack>
              <Button onClick={() => navigate("/app/forms")}>Manage all forms</Button>
            </InlineStack>
            <Divider />
            {formsSummary.length === 0 ? (
              <Box padding="400" textAlign="center">
                <BlockStack gap="200" align="center">
                  <Text variant="bodyMd" as="p" tone="subdued">No forms yet. Start with a template and publish it to your theme.</Text>
                  <Button variant="primary" icon={PlusIcon} onClick={() => setCreateModalOpen(true)}>
                    Create first form
                  </Button>
                </BlockStack>
              </Box>
            ) : (
              <IndexTable
                resourceName={{ singular: "form", plural: "forms" }}
                itemCount={formsSummary.length}
                headings={[
                  { title: "Form" },
                  { title: "Status" },
                  { title: "Submissions" },
                  { title: "Views" },
                  { title: "Action" },
                ]}
                selectable={false}
              >
                {formsSummary.map((form, index) => (
                  <IndexTable.Row id={form.id} key={form.id} position={index}>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text variant="bodyMd" as="strong" fontWeight="bold">{form.title}</Text>
                        <Text variant="bodySm" as="p" tone="subdued">{form._count.fields} fields</Text>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={form.status === "ACTIVE" ? "success" : form.status === "ARCHIVED" ? "warning" : "info"}>
                        {form.status}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" as="p" fontWeight="bold">{form._count.submissions}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" as="p">{form.views}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="200">
                        <Button size="slim" onClick={() => navigate(`/app/submissions?formId=${form.id}`)}>
                          Review
                        </Button>
                        <Button size="slim" variant="plain" onClick={() => navigate(`/app/forms/${form.id}`)}>
                          Edit
                        </Button>
                      </InlineStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </BlockStack>
        </Card>

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
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">Create from a template</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Open a guided popup with every form type. Merchants choose once, then edit only what they need.
                </Text>
              </BlockStack>
              <Button variant="primary" icon={PlusIcon} onClick={() => setCreateModalOpen(true)} disabled={isCreating}>
                {isCreating ? "Creating..." : "Choose template"}
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="What would you like to create?"
          size="large"
          primaryAction={{
            content: "Close",
            onAction: () => setCreateModalOpen(false),
          }}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="bodyMd" as="p" tone="subdued">
                Select a form type below. PandaForms will create the form with sensible Shopify fields, labels, and submission settings.
              </Text>
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setCreateModalOpen(false);
                      handleCreateTemplate(tmpl.id);
                    }}
                    disabled={isCreating}
                    style={{
                      textAlign: "left",
                      background: creatingTemplateType === tmpl.id ? "#eef2ff" : "#ffffff",
                      border: "1px solid #dbe3ef",
                      borderRadius: "14px",
                      padding: "18px",
                      minHeight: "148px",
                      cursor: isCreating ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "12px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{tmpl.title}</span>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#4f46e5",
                        background: "#eef2ff",
                        borderRadius: "999px",
                        padding: "2px 8px",
                        whiteSpace: "nowrap",
                      }}>
                        {tmpl.tag}
                      </span>
                    </div>
                    <Text variant="bodySm" as="p" tone="subdued">{tmpl.description}</Text>
                    <div style={{ marginTop: "14px", fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
                      {creatingTemplateType === tmpl.id ? "Creating..." : "Use this template"}
                    </div>
                  </button>
                ))}
              </InlineGrid>
            </BlockStack>
          </Modal.Section>
        </Modal>

      </BlockStack>
    </Page>
  );
}
