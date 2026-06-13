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
  Collapsible,
  Box,
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
  InfoIcon,
  ChevronLeftIcon,
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
    case "wholesale_reg":
      title = "Wholesale Registration Form";
      description = "Apply for a wholesale account. Once approved, you will be tagged as a wholesale customer.";
      initialFields = [
        { type: "text", label: "Business Name", required: true, width: "full", name: "business_name", placeholder: "Enter legal business name" },
        { type: "text", label: "Contact Name", required: true, width: "full", name: "contact_name", placeholder: "First and last name" },
        { type: "email", label: "Email Address", required: true, width: "full", name: "customer_email", placeholder: "name@company.com" },
        { type: "phone", label: "Phone Number", required: false, width: "half", name: "customer_phone", placeholder: "+1 (555) 000-0000" },
        { type: "text", label: "Company Website", required: false, width: "half", name: "company_website", placeholder: "https://example.com" },
        { type: "text", label: "VAT / Tax Number", required: false, width: "half", name: "tax_id", placeholder: "Tax Registration ID" },
        { type: "textarea", label: "Message / Application Details", required: false, width: "full", name: "message", placeholder: "Tell us more about your business..." },
      ];
      break;
    case "contact":
      title = "Contact Form";
      description = "For general enquiries and non specific requests.";
      initialFields = [
        { type: "text", label: "Name", required: true, width: "half", name: "full_name", placeholder: "Your name" },
        { type: "email", label: "Email Address", required: true, width: "half", name: "email", placeholder: "name@example.com" },
        { type: "text", label: "Subject", required: false, width: "full", name: "subject", placeholder: "How can we help?" },
        { type: "textarea", label: "Message", required: true, width: "full", name: "message", placeholder: "Write your message here..." },
      ];
      break;
    case "product_enquiry":
      title = "Product Enquiry Form";
      description = "For customers asking about specifications, features or technical product details.";
      initialFields = [
        { type: "text", label: "Name", required: true, width: "half", name: "full_name", placeholder: "Your name" },
        { type: "email", label: "Email Address", required: true, width: "half", name: "email", placeholder: "name@example.com" },
        { type: "text", label: "Product Name or URL", required: true, width: "full", name: "product_details", placeholder: "e.g., Cozy Wool Sweater / url" },
        { 
          type: "select", 
          label: "Enquiry Type", 
          required: true, 
          width: "full", 
          name: "enquiry_type",
          choices: JSON.stringify([
            { label: "Sizing / Fit inquiry", value: "sizing", desc: "", defaultChecked: true },
            { label: "Stock availability", value: "stock", desc: "", defaultChecked: false },
            { label: "Technical specifications", value: "technical", desc: "", defaultChecked: false },
            { label: "Bulk order pricing", value: "bulk", desc: "", defaultChecked: false },
          ])
        },
        { type: "textarea", label: "Message", required: true, width: "full", name: "message", placeholder: "What would you like to know?" },
      ];
      break;
    case "customer_reg":
      title = "Customer Registration Form";
      description = "For individuals who want to sign up for the store.";
      initialFields = [
        { type: "text", label: "First Name", required: true, width: "half", name: "customer_first_name", placeholder: "First name" },
        { type: "text", label: "Last Name", required: true, width: "half", name: "customer_last_name", placeholder: "Last name" },
        { type: "email", label: "Email Address", required: true, width: "full", name: "customer_email", placeholder: "name@example.com" },
        { type: "phone", label: "Phone Number", required: false, width: "full", name: "customer_phone", placeholder: "Optional phone number" },
        { type: "textarea", label: "Optional Message / Notes", required: false, width: "full", name: "notes", placeholder: "Any preferences or requests?" },
      ];
      break;
    case "pos_customer":
      title = "POS Customer Form";
      description = "For customer applications through Shopify POS.";
      initialFields = [
        { type: "text", label: "Customer Name", required: true, width: "full", name: "full_name", placeholder: "Enter customer full name" },
        { type: "email", label: "Email Address", required: true, width: "full", name: "email", placeholder: "customer@example.com" },
        { type: "phone", label: "Phone Number", required: false, width: "full", name: "phone", placeholder: "+1 (555) 000-0000" },
        { type: "textarea", label: "Customer Notes / Preferences", required: false, width: "full", name: "notes", placeholder: "Wholesale tier, styling notes, sizes, etc." },
      ];
      break;
    case "wholesale_app":
      title = "Wholesale Application";
      description = "After logging in, users can apply for wholesale access.";
      initialFields = [
        { type: "text", label: "Business Name", required: true, width: "full", name: "business_name", placeholder: "Registered company name" },
        { type: "email", label: "Email Address", required: true, width: "full", name: "email", placeholder: "wholesale@company.com" },
        { type: "text", label: "Contact Person", required: true, width: "half", name: "contact_name", placeholder: "Contact name" },
        { type: "phone", label: "Phone Number", required: true, width: "half", name: "phone", placeholder: "+1 (555) 000-0000" },
        { type: "text", label: "Tax ID / VAT", required: true, width: "full", name: "tax_id", placeholder: "VAT/Tax ID" },
        { type: "textarea", label: "Comments", required: false, width: "full", name: "comments", placeholder: "Tell us more about your wholesale requirements..." },
      ];
      break;
    case "order_request":
      title = "Order Request Form";
      description = "After placing an order, users can submit additional order requests.";
      initialFields = [
        { type: "text", label: "Order Number", required: true, width: "half", name: "order_number", placeholder: "e.g., #1001" },
        { type: "email", label: "Email Address", required: true, width: "half", name: "email", placeholder: "name@example.com" },
        { 
          type: "select", 
          label: "Reason for Request", 
          required: true, 
          width: "full", 
          name: "request_reason",
          choices: JSON.stringify([
            { label: "Change shipping address", value: "address_change", desc: "", defaultChecked: true },
            { label: "Add gift note / packaging", value: "gift_note", desc: "", defaultChecked: false },
            { label: "Cancel order request", value: "cancel_request", desc: "", defaultChecked: false },
            { label: "Other special request", value: "other", desc: "", defaultChecked: false },
          ])
        },
        { type: "textarea", label: "Detailed Description", required: true, width: "full", name: "description", placeholder: "Describe your request in detail..." },
      ];
      break;
    case "multistep":
      title = "Multi Step Form";
      description = "Uses a step divider field to create a multi step form.";
      initialFields = [
        { type: "step", label: "Step 1: Contact Information", required: false, width: "full" },
        { type: "text", label: "Full Name", required: true, width: "half", name: "full_name", placeholder: "Your name" },
        { type: "email", label: "Email Address", required: true, width: "half", name: "email", placeholder: "name@example.com" },
        { type: "step", label: "Step 2: Business Profile", required: false, width: "full" },
        { type: "text", label: "Company Name", required: true, width: "half", name: "company_name", placeholder: "Your company" },
        { type: "text", label: "Website", required: false, width: "half", name: "website", placeholder: "https://example.com" },
        { type: "step", label: "Step 3: Submit Application", required: false, width: "full" },
        { type: "textarea", label: "Additional Comments", required: false, width: "full", name: "comments", placeholder: "Any extra notes..." },
      ];
      break;
    case "blank":
    default:
      title = "Blank Custom Form";
      description = "Fill out the fields below or customize them in the editor.";
      initialFields = [
        { type: "text", label: "Name", required: true, width: "full", name: "full_name", placeholder: "Your name" },
        { type: "email", label: "Email", required: true, width: "full", name: "email", placeholder: "name@example.com" },
        { type: "textarea", label: "Message", required: true, width: "full", name: "message", placeholder: "Write your message here..." },
      ];
      break;
  }

  const defaultStyles = JSON.stringify({
    themePreset: "default",
    colors: {
      bgColor: "#ffffff",
      fieldBgColor: "#ffffff",
      fieldBorderColor: "#cbd5e1",
      textColor: "#1e293b",
      labelColor: "#334155",
      btnBgColor: "#008060",
      btnTextColor: "#ffffff",
      btnHoverColor: "#005e46",
      errorColor: "#ef4444",
      successColor: "#10b981",
      successBgColor: "#f0fdf4"
    },
    layout: {
      formWidth: "650",
      borderRadius: "4",
      shadow: "subtle",
      inputSize: "medium",
      buttonSize: "medium",
      labelSpacing: "6",
      desktopPadding: "32",
      mobilePadding: "16",
      fieldGap: "16"
    },
    typography: {
      fontFamily: "sans-serif",
      titleSize: "24",
      descSize: "14",
      labelSize: "13",
      inputSize: "14",
      btnSize: "16"
    }
  });

  const form = await db.form.create({
    data: {
      title,
      description,
      shop,
      status: "ACTIVE",
      customStyles: defaultStyles,
      fields: {
        create: initialFields.map((f, idx) => ({
          type: f.type,
          label: f.label,
          required: !!f.required,
          position: idx + 1,
          width: f.width || "full",
          name: f.name || `field_${idx + 1}`,
          choices: f.choices || "",
          placeholder: f.placeholder || "",
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

  // New Wizard States
  const [wizardStep, setWizardStep] = useState<"intent" | "template">("intent");
  const [selectedIntent, setSelectedIntent] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [activeTemplateTab, setActiveTemplateTab] = useState(0);
  const [expandedInfoKey, setExpandedInfoKey] = useState<string | null>(null);

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
    setWizardStep("intent");
    setSelectedIntent("");
    setTemplateSearch("");
    setActiveTemplateTab(0);
    setExpandedInfoKey(null);
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

  const INTENTS = [
    { name: "Lead Generation", desc: "Capture prospective customers and build marketing lists", icon: "📢", badge: "Growth", setupTime: "Ready in 30s" },
    { name: "Contact Form", desc: "Allow shoppers to reach out for help or order requests", icon: "✉️", badge: "Standard", setupTime: "Ready in 10s" },
    { name: "Wholesale Form", desc: "Collect B2B business details and auto-tag wholesale accounts", icon: "💼", badge: "B2B Sync", setupTime: "Ready in 10s" },
    { name: "Customer Registration", desc: "Custom account sign-up forms with sync options", icon: "👤", badge: "Accounts", setupTime: "Ready in 20s" },
    { name: "Product Enquiry", desc: "Product-specific enquiry forms on your product pages", icon: "🔍", badge: "Sales", setupTime: "Ready in 20s" },
    { name: "Multi Step Form", desc: "Split detailed questionnaires into cleaner step panels", icon: "📑", badge: "UX Pro", setupTime: "Ready in 30s" },
    { name: "Blank Form", desc: "Create a custom form from scratch with basic placeholder fields", icon: "📄", badge: "Quick Start", setupTime: "Ready in 5s" },
  ];

  const FORM_TEMPLATES = [
    {
      key: "wholesale_reg",
      name: "Wholesale Registration Form",
      category: "Online Store",
      desc: "For businesses applying for wholesale privileges.",
      info: "Collect business details, tax IDs, and contact info. When submitted, you can review and auto-tag them as wholesale customers in Shopify.",
      setupTime: "Ready in 10 seconds",
      icon: "🏢",
      badge: "Most Popular",
      badgeTone: "success" as const,
      intents: ["Wholesale Form", "Lead Generation"]
    },
    {
      key: "contact",
      name: "Contact Form",
      category: "Online Store",
      desc: "For general enquiries and non specific requests.",
      info: "A clean, basic contact form that allows customers to reach out to you directly from any page on your online store.",
      setupTime: "Ready in 10 seconds",
      icon: "✉️",
      badge: "Recommended",
      badgeTone: "info" as const,
      intents: ["Contact Form", "Lead Generation"]
    },
    {
      key: "product_enquiry",
      name: "Product Enquiry Form",
      category: "Online Store",
      desc: "For customers asking about specifications, features or technical product details.",
      info: "Perfect for high-value items or custom products. Let customers ask questions directly from the product page.",
      setupTime: "Ready in 20 seconds",
      icon: "🔍",
      badge: "",
      badgeTone: "info" as const,
      intents: ["Product Enquiry", "Lead Generation"]
    },
    {
      key: "customer_reg",
      name: "Customer Registration Form",
      category: "Online Store",
      desc: "For individuals who want to sign up for the store.",
      info: "An alternative registration form that allows collecting extra customer data like birthday, sizing, or phone number during signup.",
      setupTime: "Ready in 20 seconds",
      icon: "👤",
      badge: "Recommended",
      badgeTone: "info" as const,
      intents: ["Customer Registration"]
    },
    {
      key: "pos_customer",
      name: "POS Customer Form",
      category: "Shopify POS",
      desc: "For customer applications through Shopify POS.",
      info: "Designed for retail staff to quickly capture customer details and notes on the shop floor or checkouts.",
      setupTime: "Ready in 30 seconds",
      icon: "🛒",
      badge: "",
      badgeTone: "info" as const,
      intents: ["Lead Generation", "Customer Registration"]
    },
    {
      key: "wholesale_app",
      name: "Wholesale Application",
      category: "Customer Accounts",
      desc: "After logging in, users can apply for wholesale access.",
      info: "For stores using Shopify's New Customer Accounts. Logged-in customers can submit this application to request upgraded wholesale pricing status.",
      setupTime: "Ready in 30 seconds",
      icon: "💼",
      badge: "",
      badgeTone: "info" as const,
      intents: ["Wholesale Form"]
    },
    {
      key: "order_request",
      name: "Order Request Form",
      category: "Customer Accounts",
      desc: "After placing an order, users can submit additional order requests.",
      info: "Allows customers to request modifications, delivery instructions, or special requests for their order directly from their account page.",
      setupTime: "Ready in 20 seconds",
      icon: "📦",
      badge: "",
      badgeTone: "info" as const,
      intents: ["Contact Form"]
    },
    {
      key: "multistep",
      name: "Multi Step Form",
      category: "Online Store",
      desc: "Uses a step divider field to create a multi step form.",
      info: "Split long forms into user-friendly steps to improve completion rates. Perfect for wholesale onboarding or detailed questionnaires.",
      setupTime: "Ready in 30 seconds",
      icon: "📑",
      badge: "B2B Choice",
      badgeTone: "attention" as const,
      intents: ["Multi Step Form", "Wholesale Form", "Lead Generation"]
    }
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
                        <BlockStack gap="300">
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

                          {/* Stats and ID Row */}
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Badge tone="info">{views} views</Badge>
                              <Badge tone={_count.submissions > 0 ? "attention" : "subdued"}>
                                {_count.submissions} submissions
                              </Badge>
                              <Badge tone={parseFloat(convRate) > 10 ? "success" : "subdued"}>
                                {convRate}% conversion
                              </Badge>
                            </InlineStack>
                            
                            <InlineStack gap="150" blockAlign="center">
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
                          </InlineStack>

                          {/* Bottom Actions Row */}
                          <InlineStack align="space-between" blockAlign="center">
                            <Text variant="bodyXs" tone="subdued">
                              Created on {new Date(createdAt).toLocaleDateString()}
                            </Text>
                            <InlineStack gap="150" blockAlign="center">
                              <Button
                                onClick={() => navigate(`/app/forms/${id}`)}
                                variant="primary"
                                icon={EditIcon}
                              >
                                Edit Form
                              </Button>
                              <Button
                                onClick={() => navigate(`/app/submissions?formId=${id}`)}
                              >
                                Submissions
                              </Button>
                              
                              <div style={{ borderLeft: "1px solid var(--p-color-border-secondary)", height: "20px", margin: "0 4px" }} />

                              <Tooltip content="Preview Form">
                                <Button
                                  onClick={() => {
                                    setPreviewForm(form);
                                    setPreviewModalOpen(true);
                                  }}
                                  icon={ViewIcon}
                                />
                              </Tooltip>

                              <Tooltip content="Duplicate Form">
                                <Button
                                  onClick={() => handleDuplicate(id)}
                                  icon={DuplicateIcon}
                                />
                              </Tooltip>

                              {isArchived ? (
                                <Tooltip content="Publish Form">
                                  <Button onClick={() => handlePublish(id)} icon={CheckIcon} />
                                </Tooltip>
                              ) : isActive ? (
                                <Tooltip content="Archive Form">
                                  <Button onClick={() => handleArchive(id)} icon={ArchiveIcon} />
                                </Tooltip>
                              ) : (
                                <Tooltip content="Publish Form">
                                  <Button onClick={() => handlePublish(id)} icon={CheckIcon} />
                                </Tooltip>
                              )}

                              <Tooltip content="Delete Form">
                                <Button
                                  onClick={() => handleDeleteForm(id)}
                                  icon={DeleteIcon}
                                  tone="critical"
                                  accessibilityLabel="Delete form"
                                />
                              </Tooltip>
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
        title={wizardStep === "intent" ? "What would you like to create?" : `Select a Template for ${selectedIntent}`}
        size="large"
      >
        <Modal.Section>
          {wizardStep === "intent" ? (
            <BlockStack gap="400">
              <Text variant="bodyMd" as="p">
                Select a form type below to get started. Choose from specialized templates optimized for Shopify or start custom.
              </Text>
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                {INTENTS.map((intent) => (
                  <div key={intent.name} style={{ cursor: "pointer", display: "flex", height: "100%" }} onClick={() => {
                    if (intent.name === "Blank Form") {
                      handleSelectTemplate("blank");
                    } else {
                      setSelectedIntent(intent.name);
                      setWizardStep("template");
                    }
                  }}>
                    <Card>
                      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <div style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "50%",
                              backgroundColor: "#f1f5f9",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              fontSize: "24px"
                            }}>
                              {intent.icon}
                            </div>
                            <Badge tone={intent.name === "Blank Form" ? "info" : "attention"}>{intent.badge}</Badge>
                          </InlineStack>
                          <BlockStack gap="100">
                            <Text variant="headingMd" as="h3">{intent.name}</Text>
                            <Text variant="bodySm" tone="subdued">{intent.desc}</Text>
                          </BlockStack>
                        </BlockStack>
                        <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Text variant="bodyXs" tone="subdued">{intent.setupTime}</Text>
                          <Button variant="plain">
                            {intent.name === "Blank Form" ? "Start →" : "Browse →"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </InlineGrid>
            </BlockStack>
          ) : (
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Button onClick={() => setWizardStep("intent")} icon={ChevronLeftIcon} variant="plain">
                  Back to Intents
                </Button>
                <div style={{ width: "300px" }}>
                  <TextField
                    label="Search templates"
                    labelHidden
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={setTemplateSearch}
                    prefix={<Icon source={SearchIcon} />}
                    autoComplete="off"
                    size="slim"
                  />
                </div>
              </InlineStack>

              <Tabs
                tabs={[
                  { id: "all", content: "Featured Templates" },
                  { id: "online_store", content: "Online Store" },
                  { id: "customer_accounts", content: "Customer Accounts" },
                  { id: "shopify_pos", content: "Shopify POS" },
                ]}
                selected={activeTemplateTab}
                onSelect={(idx) => setActiveTemplateTab(idx)}
              />

              {(() => {
                // Filter matching intent
                let items = FORM_TEMPLATES.filter(t => t.intents.includes(selectedIntent));

                // Filter by tab
                if (activeTemplateTab === 1) {
                  items = items.filter(t => t.category === "Online Store");
                } else if (activeTemplateTab === 2) {
                  items = items.filter(t => t.category === "Customer Accounts");
                } else if (activeTemplateTab === 3) {
                  items = items.filter(t => t.category === "Shopify POS");
                }

                // Filter by search
                if (templateSearch) {
                  items = items.filter(
                    t =>
                      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      t.desc.toLowerCase().includes(templateSearch.toLowerCase())
                  );
                }

                if (items.length === 0) {
                  return (
                    <Box padding="600" textAlign="center">
                      <Text variant="bodyMd" tone="subdued">No templates found. Try resetting the search or category tabs.</Text>
                    </Box>
                  );
                }

                return (
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    {items.map((tmpl) => (
                      <Card key={tmpl.key}>
                        <BlockStack gap="300" style={{ height: "100%", justifyContent: "space-between" }}>
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <InlineStack gap="200" blockAlign="center">
                                <span style={{ fontSize: "20px" }}>{tmpl.icon}</span>
                                <Text variant="headingMd" as="h3">{tmpl.name}</Text>
                              </InlineStack>
                              {tmpl.badge && <Badge tone={tmpl.badgeTone}>{tmpl.badge}</Badge>}
                            </InlineStack>

                            <InlineStack gap="200">
                              <Badge size="small">{tmpl.category}</Badge>
                              <Text variant="bodyXs" tone="subdued">{tmpl.setupTime}</Text>
                            </InlineStack>

                            <Text variant="bodySm" tone="subdued">{tmpl.desc}</Text>

                            <div style={{ marginTop: "4px" }}>
                              <Button
                                onClick={() => setExpandedInfoKey(expandedInfoKey === tmpl.key ? null : tmpl.key)}
                                variant="plain"
                                icon={InfoIcon}
                              >
                                {expandedInfoKey === tmpl.key ? "Hide Details" : "Show Details"}
                              </Button>
                              <Collapsible open={expandedInfoKey === tmpl.key} id={`info-${tmpl.key}`}>
                                <Box paddingBlockStart="200">
                                  <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                    <Text variant="bodySm" tone="subdued">{tmpl.info}</Text>
                                  </div>
                                </Box>
                              </Collapsible>
                            </div>
                          </BlockStack>

                          <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                            <Button onClick={() => handleSelectTemplate(tmpl.key)} variant="primary">
                              Use Template
                            </Button>
                          </div>
                        </BlockStack>
                      </Card>
                    ))}
                  </InlineGrid>
                );
              })()}
            </BlockStack>
          )}
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
