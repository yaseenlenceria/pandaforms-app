import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
  Badge,
  Banner,
  InlineGrid,
  Divider,
  Modal,
  TextField,
  Tabs,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import {
  ViewIcon,
  EditIcon,
  PlusIcon,
  DuplicateIcon,
  DeleteIcon,
  CheckIcon,
  ArchiveIcon,
  ClipboardIcon,
  SearchIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const forms = await db.form.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { submissions: true, fields: true },
      },
    },
  });

  return json({ forms });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const formAction = formData.get("formAction");
  const formId = formData.get("formId") as string;

  if (formAction === "toggleStatus" && formId) {
    const form = await db.form.findFirst({ where: { id: formId, shop } });
    if (form) {
      // Toggle ACTIVE -> DRAFT -> ARCHIVED -> ACTIVE
      let newStatus = "ACTIVE";
      if (form.status === "ACTIVE") {
        newStatus = "DRAFT";
      } else if (form.status === "DRAFT") {
        newStatus = "ARCHIVED";
      } else {
        newStatus = "ACTIVE";
      }

      await db.form.update({
        where: { id: formId },
        data: { status: newStatus },
      });
      return json({ success: true });
    }
  }

  if (formAction === "archive" && formId) {
    await db.form.update({
      where: { id: formId, shop },
      data: { status: "ARCHIVED" },
    });
    return json({ success: true });
  }

  if (formAction === "publish" && formId) {
    await db.form.update({
      where: { id: formId, shop },
      data: { status: "ACTIVE" },
    });
    return json({ success: true });
  }

  if (formAction === "delete" && formId) {
    await db.form.deleteMany({
      where: { id: formId, shop },
    });
    return json({ success: true });
  }

  if (formAction === "duplicate" && formId) {
    const sourceForm = await db.form.findFirst({
      where: { id: formId, shop },
      include: { fields: true },
    });

    if (sourceForm) {
      await db.form.create({
        data: {
          title: `Copy of ${sourceForm.title}`,
          description: sourceForm.description,
          successMessage: sourceForm.successMessage,
          redirectUrl: sourceForm.redirectUrl,
          shop,
          status: "DRAFT",
          theme: sourceForm.theme,
          loginLinkPrefix: sourceForm.loginLinkPrefix,
          loginLinkLabel: sourceForm.loginLinkLabel,
          loginLinkPosition: sourceForm.loginLinkPosition,
          emailExistsMessage: sourceForm.emailExistsMessage,
          adminNotificationEmails: sourceForm.adminNotificationEmails,
          disableCountryOptions: sourceForm.disableCountryOptions,
          defaultCountryPhoneCode: sourceForm.defaultCountryPhoneCode,
          integrationHubSpot: sourceForm.integrationHubSpot,
          integrationReCAPTCHA: sourceForm.integrationReCAPTCHA,
          fields: {
            create: sourceForm.fields.map((f) => ({
              type: f.type,
              label: f.label,
              placeholder: f.placeholder || "",
              required: !!f.required,
              choices: f.choices || "",
              position: f.position,
              width: f.width || "full",
              name: f.name || `field_${f.position}`,
              requiredMessage: f.requiredMessage || "This field is required",
              metafieldKey: f.metafieldKey || "",
              isDynamicTag: !!f.isDynamicTag,
              logicRules: f.logicRules || "",
            })),
          },
        },
      });
      return json({ success: true });
    }
  }

  // Create template actions
  const template = (formData.get("template") as string) || "blank";
  let title = "Untitled Form";
  let description = "Customize this form template";
  let initialFields: any[] = [];

  switch (template) {
    case "wholesale":
      title = "Wholesale Registration Form";
      description = "Apply for a wholesale account. Once approved, you will be tagged as a wholesale customer.";
      initialFields = [
        { type: "text", label: "Customer First Name", required: true, width: "half", position: 1, name: "customer_first_name" },
        { type: "text", label: "Customer Last Name", required: true, width: "half", position: 2, name: "customer_last_name" },
        { type: "email", label: "Customer Email", required: true, width: "full", position: 3, name: "customer_email" },
        { type: "phone", label: "Customer Phone Number", required: false, width: "half", position: 4, name: "customer_phone" },
        { type: "text", label: "Company Name", required: false, width: "half", position: 5, name: "company_name" },
        { type: "text", label: "Business Tax ID", required: false, width: "half", position: 6, name: "tax_id" },
        { 
          type: "select", 
          label: "Country and State", 
          required: false, 
          width: "half", 
          position: 7, 
          name: "country_state",
          choices: JSON.stringify([
            { label: "United States", value: "US", desc: "", defaultChecked: true },
            { label: "Canada", value: "CA", desc: "", defaultChecked: false },
            { label: "United Kingdom", value: "UK", desc: "", defaultChecked: false },
            { label: "Australia", value: "AU", desc: "", defaultChecked: false },
          ])
        },
        { type: "checkbox", label: "Subscribe to Wholesale Newsletter", required: false, width: "full", position: 8, name: "subscribe_marketing" },
      ];
      break;
    case "customer_reg":
      title = "Customer Registration Form";
      description = "Create a standard shopper store account.";
      initialFields = [
        { type: "text", label: "Customer First Name", required: true, width: "half", position: 1, name: "customer_first_name" },
        { type: "text", label: "Customer Last Name", required: true, width: "half", position: 2, name: "customer_last_name" },
        { type: "email", label: "Customer Email", required: true, width: "full", position: 3, name: "customer_email" },
        { type: "checkbox", label: "Subscribe to newsletter", required: false, width: "full", position: 4, name: "subscribe_marketing" },
      ];
      break;
    case "enquiry":
      title = "Product Enquiry Form";
      description = "Ask questions or request details about a specific product.";
      initialFields = [
        { type: "text", label: "Full Name", required: true, width: "half", position: 1, name: "full_name" },
        { type: "email", label: "Email Address", required: true, width: "half", position: 2, name: "email" },
        { type: "text", label: "Product Name / SKU", required: true, width: "full", position: 3, name: "product_sku" },
        { type: "textarea", label: "Enquiry Details", required: true, width: "full", position: 4, name: "details" },
      ];
      break;
    case "contact":
      title = "Contact Us Form";
      description = "Let store visitors reach out with general inquiries.";
      initialFields = [
        { type: "text", label: "Full Name", required: true, width: "half", position: 1, name: "full_name" },
        { type: "email", label: "Email Address", required: true, width: "half", position: 2, name: "email" },
        { type: "text", label: "Subject", required: false, width: "full", position: 3, name: "subject" },
        { type: "textarea", label: "Message Details", required: true, width: "full", position: 4, name: "message" },
      ];
      break;
    case "appointment":
      title = "Book an Appointment";
      description = "Schedule consultations, fittings, or product demos.";
      initialFields = [
        { type: "text", label: "Full Name", required: true, width: "half", position: 1, name: "full_name" },
        { type: "email", label: "Email Address", required: true, width: "half", position: 2, name: "email" },
        { type: "date", label: "Preferred Appointment Date", required: true, width: "half", position: 3, name: "appointment_date" },
        { 
          type: "select", 
          label: "Appointment Type", 
          required: true, 
          width: "half", 
          position: 4, 
          name: "appointment_type",
          choices: JSON.stringify([
            { label: "Consultation Call", value: "consultation", desc: "", defaultChecked: true },
            { label: "Sizing / Fitting Session", value: "fitting", desc: "", defaultChecked: false },
            { label: "In-Store Tour & Demo", value: "tour", desc: "", defaultChecked: false },
          ])
        },
        { type: "textarea", label: "Additional Requirements", required: false, width: "full", position: 5, name: "notes" },
      ];
      break;
    case "return":
      title = "Return Request Form";
      description = "Request a product return, exchange, or refund.";
      initialFields = [
        { type: "text", label: "Full Name", required: true, width: "half", position: 1, name: "full_name" },
        { type: "email", label: "Email Address", required: true, width: "half", position: 2, name: "email" },
        { type: "number", label: "Order Number", required: true, width: "half", position: 3, name: "order_number" },
        { 
          type: "select", 
          label: "Reason for Return", 
          required: true, 
          width: "half", 
          position: 4, 
          name: "return_reason",
          choices: JSON.stringify([
            { label: "Defective / Damaged product", value: "defective", desc: "", defaultChecked: true },
            { label: "Incorrect size shipped", value: "wrong_size", desc: "", defaultChecked: false },
            { label: "Item different from pictures", value: "not_matching", desc: "", defaultChecked: false },
            { label: "Changed my mind", value: "changed_mind", desc: "", defaultChecked: false },
          ])
        },
        { type: "textarea", label: "Details / Explanation", required: false, width: "full", position: 5, name: "notes" },
      ];
      break;
    default:
      title = "Untitled Form";
      description = "Customize this form template";
      initialFields = [
        { type: "text", label: "Full Name", required: true, position: 1 },
        { type: "email", label: "Email", required: true, position: 2 },
      ];
  }

  const form = await db.form.create({
    data: {
      title,
      description,
      shop,
      status: "ACTIVE",
      fields: {
        create: initialFields.map((f, idx) => ({
          type: f.type,
          label: f.label,
          required: !!f.required,
          position: idx + 1,
          width: f.width || "full",
          name: f.name || `field_${idx + 1}`,
          choices: f.choices || "",
        })),
      },
    },
  });

  return redirect(`/app/forms/${form.id}`);
};

export default function FormsList() {
  const { forms } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState(0); // 0: All, 1: Active, 2: Draft, 3: Archived
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Preview Form State
  const [previewForm, setPreviewForm] = useState<any>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Tab Filtering Setup
  const tabs = [
    { id: "all", content: "All" },
    { id: "active", content: "Active" },
    { id: "draft", content: "Draft" },
    { id: "archived", content: "Archived" },
  ];

  const filteredForms = useMemo(() => {
    return forms.filter((form) => {
      // 1. Filter by search query
      const matchesSearch =
        form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (form.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Filter by status tab
      if (selectedTab === 1) return form.status === "ACTIVE";
      if (selectedTab === 2) return form.status === "DRAFT";
      if (selectedTab === 3) return form.status === "ARCHIVED";

      return true;
    });
  }, [forms, searchQuery, selectedTab]);

  const totalForms = forms.length;
  const activeForms = forms.filter((f) => f.status === "ACTIVE").length;
  const totalSubmissions = forms.reduce((sum, f) => sum + f._count.submissions, 0);

  const handleCreateForm = () => {
    setTemplateModalOpen(true);
  };

  const handleSelectTemplate = (templateKey: string) => {
    setTemplateModalOpen(false);
    submit({ formAction: "create", template: templateKey }, { method: "POST" });
  };

  const handleToggleStatus = (formId: string) => {
    submit({ formAction: "toggleStatus", formId }, { method: "POST" });
  };

  const handlePublish = (formId: string) => {
    submit({ formAction: "publish", formId }, { method: "POST" });
  };

  const handleArchive = (formId: string) => {
    submit({ formAction: "archive", formId }, { method: "POST" });
  };

  const handleDuplicate = (formId: string) => {
    submit({ formAction: "duplicate", formId }, { method: "POST" });
    setBannerMessage("Form duplicated successfully!");
    setBannerVisible(true);
    setTimeout(() => setBannerVisible(false), 3000);
  };

  const handleDeleteForm = (formId: string) => {
    if (confirm("Are you sure you want to delete this form? This will delete all fields and submissions associated with it.")) {
      submit({ formAction: "delete", formId }, { method: "POST" });
    }
  };

  const copyToClipboard = (text: string, message: string = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    setBannerMessage(message);
    setBannerVisible(true);
    setTimeout(() => setBannerVisible(false), 3000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge tone="success">Active</Badge>;
      case "DRAFT":
        return <Badge tone="attention">Draft</Badge>;
      case "ARCHIVED":
        return <Badge tone="subdued">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const templatesList = [
    { key: "wholesale", title: "Wholesale registration form", desc: "Connects to Shopify Customer API. Auto-tags approved accounts.", badge: "Customer Sync" },
    { key: "customer_reg", title: "Customer registration form", desc: "Standard shopper registration request with customer sync.", badge: "Customer Sync" },
    { key: "enquiry", title: "Product enquiry form", desc: "Allows shoppers to ask questions about product specs directly.", badge: "Theme Page" },
    { key: "contact", title: "Contact form", desc: "Generic contact enquiry form to capture general queries.", badge: "General" },
    { key: "appointment", title: "Book an appointment", desc: "Fittings, consultation requests, or appointment bookings.", badge: "Contact Form" },
    { key: "return", title: "Return request", desc: "Processes return requests with order number and customer notes.", badge: "Service" },
  ];

  return (
    <Page
      title="Forms List"
      primaryAction={{
        content: "Create New Form",
        icon: PlusIcon,
        onAction: handleCreateForm,
        disabled: isLoading,
      }}
    >
      <BlockStack gap="500">
        
        {bannerVisible && (
          <Banner title={bannerMessage} tone="success" onDismiss={() => setBannerVisible(false)} />
        )}

        {/* Aggregate Stats Cards */}
        {forms.length > 0 && (
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <Card>
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3" tone="subdued">Total Forms</Text>
                <Text variant="headingLg" as="p" fontWeight="bold">{totalForms}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3" tone="subdued">Active Live Forms</Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="headingLg" as="p" fontWeight="bold">{activeForms}</Text>
                  <Badge tone="success">Live</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3" tone="subdued">Total Submissions</Text>
                <Text variant="headingLg" as="p" fontWeight="bold">{totalSubmissions}</Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        )}

        <Layout>
          <Layout.Section>
            {forms.length === 0 ? (
              <Card>
                <EmptyState
                  heading="Create your first custom form"
                  action={{
                    content: "Create Form",
                    onAction: handleCreateForm,
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Build custom wholesale applications, product contact forms, or booking schedules in under 2 minutes.</p>
                </EmptyState>
              </Card>
            ) : (
              <BlockStack gap="400">
                
                {/* Search and Filter Row */}
                <Card padding="300">
                  <BlockStack gap="300">
                    <TextField
                      label="Search forms"
                      labelHidden
                      placeholder="Search by Form Title or Description..."
                      value={searchQuery}
                      onChange={setSearchQuery}
                      prefix={<Icon source={SearchIcon} />}
                      autoComplete="off"
                    />
                    <Tabs
                      tabs={tabs}
                      selected={selectedTab}
                      onSelect={(index) => setSelectedTab(index)}
                    />
                  </BlockStack>
                </Card>

                {/* Forms Listings */}
                {filteredForms.length === 0 ? (
                  <Card>
                    <Box padding="600" textAlign="center">
                      <Text variant="headingMd" as="p" tone="subdued">No forms match your search criteria.</Text>
                    </Box>
                  </Card>
                ) : (
                  filteredForms.map((form) => {
                    const { id, title, description, status, _count, views, createdAt } = form;
                    const isActive = status === "ACTIVE";
                    const isDraft = status === "DRAFT";
                    const isArchived = status === "ARCHIVED";

                    // Conversion Rate Calculation
                    const convRate = views > 0 ? ((_count.submissions / views) * 100).toFixed(1) : "0.0";

                    return (
                      <Card key={id}>
                        <BlockStack gap="400">
                          {/* Header Row */}
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="300" blockAlign="center">
                              <span style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                backgroundColor: isActive ? "#10854d" : isDraft ? "#e2a100" : "#8c9196",
                                display: "inline-block",
                                boxShadow: isActive ? "0 0 0 4px rgba(16, 133, 77, 0.2)" : isDraft ? "0 0 0 4px rgba(226, 161, 0, 0.2)" : "none"
                              }} />
                              <BlockStack gap="050">
                                <Text variant="headingMd" as="h3">
                                  {title}
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  {description || "No description provided"}
                                </Text>
                              </BlockStack>
                            </InlineStack>
                            {getStatusBadge(status)}
                          </InlineStack>

                          <Divider />

                          {/* Mid Details Row (Embed info & Quick stats) */}
                          <InlineGrid columns={{ xs: 1, md: 4 }} gap="400">
                            {/* Copy Embed Tags */}
                            <BlockStack gap="100">
                              <Text variant="bodyXs" tone="subdued" fontWeight="bold">Storefront Integration</Text>
                              <InlineStack gap="100" blockAlign="center">
                                <code style={{
                                  fontSize: "11px",
                                  backgroundColor: "#f1f2f4",
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                  fontFamily: "monospace"
                                }}>
                                  ID: {id.substring(0, 8)}...
                                </code>
                                <Tooltip content="Copy Form ID">
                                  <Button onClick={() => copyToClipboard(id, "Form ID copied!")} icon={ClipboardIcon} size="slim" variant="plain" />
                                </Tooltip>
                              </InlineStack>
                              <InlineStack gap="100" blockAlign="center">
                                <code style={{
                                  fontSize: "10px",
                                  backgroundColor: "#f1f2f4",
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                  fontFamily: "monospace"
                                }}>
                                  Liquid Tag
                                </code>
                                <Tooltip content="Copy liquid block tag for themes">
                                  <Button onClick={() => copyToClipboard(`{% render 'pandaforms-widget', form_id: '${id}' %}`, "Liquid block tag copied!")} icon={ClipboardIcon} size="slim" variant="plain" />
                                </Tooltip>
                              </InlineStack>
                            </BlockStack>

                            {/* Views Stat */}
                            <BlockStack gap="100">
                              <Text variant="bodyXs" tone="subdued" fontWeight="bold">Views</Text>
                              <Text variant="headingSm" as="span">{views} views</Text>
                            </BlockStack>

                            {/* Submissions Stat */}
                            <BlockStack gap="100">
                              <Text variant="bodyXs" tone="subdued" fontWeight="bold">Submissions</Text>
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone={_count.submissions > 0 ? "attention" : "subdued"}>
                                  {_count.submissions} Submissions
                                </Badge>
                              </InlineStack>
                            </BlockStack>

                            {/* Conversion Rate */}
                            <BlockStack gap="100">
                              <Text variant="bodyXs" tone="subdued" fontWeight="bold">Conversion Rate</Text>
                              <Text variant="headingSm" as="span" tone={parseFloat(convRate) > 10 ? "success" : "subdued"}>
                                <strong>{convRate}%</strong>
                              </Text>
                            </BlockStack>
                          </InlineGrid>

                          <Divider />

                          {/* Bottom Actions Row */}
                          <InlineStack align="space-between" blockAlign="center">
                            <Text variant="bodyXs" tone="subdued">
                              Created on {new Date(createdAt).toLocaleDateString()}
                            </Text>
                            <InlineStack gap="200">
                              <Button
                                onClick={() => navigate(`/app/forms/${id}`)}
                                variant="primary"
                                icon={EditIcon}
                              >
                                Edit Form
                              </Button>
                              <Button
                                onClick={() => navigate(`/app/submissions?formId=${id}`)}
                                icon={ViewIcon}
                              >
                                Submissions
                              </Button>
                              <Tooltip content="Duplicate form and fields">
                                <Button
                                  onClick={() => handleDuplicate(id)}
                                  icon={DuplicateIcon}
                                />
                              </Tooltip>
                              
                              {/* Preview Action */}
                              <Button
                                onClick={() => {
                                  // Mock preview setup
                                  setPreviewForm(form);
                                  setPreviewModalOpen(true);
                                }}
                              >
                                Preview
                              </Button>

                              {/* Archive/Publish Toggle */}
                              {isArchived ? (
                                <Button onClick={() => handlePublish(id)} icon={CheckIcon}>Publish</Button>
                              ) : isActive ? (
                                <Button onClick={() => handleArchive(id)} icon={ArchiveIcon}>Archive</Button>
                              ) : (
                                <Button onClick={() => handlePublish(id)} icon={CheckIcon}>Publish</Button>
                              )}

                              <Button
                                onClick={() => handleDeleteForm(id)}
                                icon={DeleteIcon}
                                tone="critical"
                                accessibilityLabel="Delete form"
                              />
                            </InlineStack>
                          </InlineStack>
                        </BlockStack>
                      </Card>
                    );
                  })
                )}
              </BlockStack>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Template Chooser Modal */}
      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Create a new storefront form"
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="bodyMd" as="p">
              Select a pre-configured template below to launch instantly. You can fully customize fields, styling, and settings in the builder.
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              {templatesList.map((tmpl) => (
                <Card key={tmpl.key}>
                  <BlockStack gap="300" style={{ height: "100%", justifyContent: "space-between" }}>
                    <BlockStack gap="100">
                      <Badge tone="info">{tmpl.badge}</Badge>
                      <Text variant="headingMd" as="h3">{tmpl.title}</Text>
                      <Text variant="bodySm" tone="subdued">{tmpl.desc}</Text>
                    </BlockStack>
                    <div style={{ marginTop: "12px" }}>
                      <Button onClick={() => handleSelectTemplate(tmpl.key)} variant="primary">
                        Use Template
                      </Button>
                    </div>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Quick Visual Preview Modal */}
      {previewForm && (
        <Modal
          open={previewModalOpen}
          onClose={() => {
            setPreviewForm(null);
            setPreviewModalOpen(false);
          }}
          title={`Storefront Live Preview - ${previewForm.title}`}
          size="large"
        >
          <Modal.Section>
            <div style={{ padding: "20px", background: "#f1f5f9", borderRadius: "8px" }}>
              <div style={{
                background: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "24px",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
              }}>
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                  <Text variant="headingLg" as="h2">{previewForm.title}</Text>
                  {previewForm.description && <Text variant="bodyMd" as="p" tone="subdued">{previewForm.description}</Text>}
                </div>
                <Divider />
                <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <TextField label="Customer Name" value="John Doe" disabled autoComplete="off" />
                  <TextField label="Email Address" value="john@example.com" disabled autoComplete="off" />
                  <div style={{ marginTop: "10px" }}>
                    <Button variant="primary" disabled>{previewForm.title.includes("Wholesale") ? "Apply Wholesale Account" : "Submit Form"}</Button>
                  </div>
                </div>
              </div>
            </div>
          </Modal.Section>
        </Modal>
      )}

    </Page>
  );
}
