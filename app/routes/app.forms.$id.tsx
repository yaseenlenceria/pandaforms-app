import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Select,
  Checkbox,
  Icon,
  Banner,
  Divider,
  Box,
  InlineGrid,
  Modal,
  Collapsible,
  Badge,
  Tooltip,
} from "@shopify/polaris";
import {
  DeleteIcon,
  PlusIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  DuplicateIcon,
  ChevronRightIcon,
  SettingsIcon,
  CheckIcon,
  InfoIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  const form = await db.form.findFirst({
    where: { id, shop },
    include: {
      fields: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!form) {
    throw new Response("Form not found", { status: 404 });
  }

  return json({ form });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  const existingForm = await db.form.findFirst({ where: { id, shop } });
  if (!existingForm) {
    return json({ error: "Unauthorized or form not found" }, { status: 403 });
  }

  const formData = await request.formData();
  const payloadStr = formData.get("payload") as string;
  const payload = JSON.parse(payloadStr);

  const {
    title,
    description,
    successMessage,
    redirectUrl,
    fields,
    theme,
    loginLinkPrefix,
    loginLinkLabel,
    loginLinkPosition,
    emailExistsMessage,
    adminNotificationEmails,
    disableCountryOptions,
    defaultCountryPhoneCode,
    integrationHubSpot,
    integrationReCAPTCHA,
  } = payload;

  await db.$transaction([
    db.form.update({
      where: { id },
      data: {
        title,
        description,
        successMessage,
        redirectUrl,
        theme,
        loginLinkPrefix,
        loginLinkLabel,
        loginLinkPosition,
        emailExistsMessage,
        adminNotificationEmails,
        disableCountryOptions: !!disableCountryOptions,
        defaultCountryPhoneCode,
        integrationHubSpot: false,
        integrationReCAPTCHA: false,
      },
    }),
    db.formField.deleteMany({
      where: { formId: id },
    }),
    db.formField.createMany({
      data: fields.map((f: any, idx: number) => ({
        formId: id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder || "",
        required: !!f.required,
        choices: typeof f.choices === "string" ? f.choices : JSON.stringify(f.choices || []),
        position: idx + 1,
        width: f.width || "full",
        name: f.name || `field_${idx + 1}`,
        requiredMessage: f.requiredMessage || "This field is required",
        metafieldKey: f.metafieldKey || "",
        isDynamicTag: !!f.isDynamicTag,
        logicRules: f.logicRules || "",
      })),
    }),
  ]);

  return json({ success: true });
};

interface ChoiceOption {
  label: string;
  value: string;
  desc: string;
  defaultChecked: boolean;
}

interface FormFieldItem {
  id?: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  choices: string | ChoiceOption[];
  width: string;
  name: string;
  requiredMessage: string;
  metafieldKey: string;
  isDynamicTag: boolean;
  logicRules: string;
  isOpen?: boolean;
}

export default function FormBuilder() {
  const { form } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  // Dynamic styles based on theme selection
  const getThemeStyles = (selectedTheme: string) => {
    switch (selectedTheme) {
      case "dark":
        return {
          wrapper: { backgroundColor: "#0f172a", color: "#f8fafc" },
          title: { color: "#f8fafc" },
          desc: { color: "#94a3b8" },
          label: { color: "#cbd5e1" },
          input: {
            backgroundColor: "#1e293b",
            border: "1px solid #475569",
            color: "#f8fafc",
            borderRadius: "6px",
          },
          button: {
            backgroundColor: "#10b981",
            color: "#ffffff",
            boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)",
          },
          step: {
            color: "#10b981",
            borderBottom: "2px dashed #10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
          },
          file: {
            border: "2px dashed #475569",
            backgroundColor: "#1e293b",
            textColor: "#10b981",
          }
        };
      case "glassmorphism":
        return {
          wrapper: {
            backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#ffffff",
          },
          innerWrapper: {
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            padding: "24px",
          },
          title: { color: "#ffffff" },
          desc: { color: "rgba(255, 255, 255, 0.8)" },
          label: { color: "#ffffff" },
          input: {
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            color: "#ffffff",
            borderRadius: "10px",
          },
          button: {
            backgroundColor: "#ffffff",
            color: "#764ba2",
            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)",
          },
          step: {
            color: "#ffffff",
            borderBottom: "2px dashed rgba(255, 255, 255, 0.5)",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
          },
          file: {
            border: "2px dashed rgba(255, 255, 255, 0.3)",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            textColor: "#ffffff",
          }
        };
      case "playful":
        return {
          wrapper: { backgroundColor: "#fef08a", color: "#1c1917" },
          title: { color: "#1c1917" },
          desc: { color: "#44403c" },
          label: { color: "#1c1917" },
          input: {
            backgroundColor: "#ffffff",
            border: "3px solid #1c1917",
            color: "#1c1917",
            borderRadius: "0px",
            boxShadow: "4px 4px 0px #1c1917",
          },
          button: {
            backgroundColor: "#f43f5e",
            color: "#ffffff",
            border: "3px solid #1c1917",
            borderRadius: "0px",
            boxShadow: "4px 4px 0px #1c1917",
          },
          step: {
            color: "#1c1917",
            backgroundColor: "#ffffff",
            border: "3px solid #1c1917",
            boxShadow: "4px 4px 0px #1c1917",
          },
          file: {
            border: "3px dashed #1c1917",
            backgroundColor: "#ffffff",
            textColor: "#f43f5e",
          }
        };
      case "classic":
        return {
          wrapper: { backgroundColor: "#f6f6f7", color: "#202223" },
          title: { color: "#202223" },
          desc: { color: "#6d7175" },
          label: { color: "#202223" },
          input: {
            backgroundColor: "#ffffff",
            border: "1px solid #8c9196",
            color: "#202223",
            borderRadius: "4px",
          },
          button: {
            backgroundColor: "#008060",
            color: "#ffffff",
            borderRadius: "4px",
            boxShadow: "none",
          },
          step: {
            color: "#008060",
            borderBottom: "1px solid #8c9196",
            backgroundColor: "#f1f2f3",
          },
          file: {
            border: "1px dashed #8c9196",
            backgroundColor: "#ffffff",
            textColor: "#008060",
          }
        };
      case "minimal":
      default:
        return {
          wrapper: { backgroundColor: "#ffffff", color: "#1e293b" },
          title: { color: "#0f172a" },
          desc: { color: "#64748b" },
          label: { color: "#334155" },
          input: {
            backgroundColor: "#ffffff",
            border: "none",
            borderBottom: "2px solid #cbd5e1",
            color: "#1e293b",
            borderRadius: "0px",
          },
          button: {
            backgroundColor: "#0f172a",
            color: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
          },
          step: {
            color: "#64748b",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "transparent",
          },
          file: {
            border: "2px dashed #cbd5e1",
            backgroundColor: "#f8fafc",
            textColor: "#0f172a",
          }
        };
    }
  };

  // Form states
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description || "");
  const [successMessage, setSuccessMessage] = useState(form.successMessage || "");
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl || "");
  const [fields, setFields] = useState<FormFieldItem[]>(
    (form.fields || []).map((f) => {
      let parsedChoices: any = f.choices || "";
      try {
        if (f.choices && (f.choices.startsWith("[") || f.choices.startsWith("{"))) {
          parsedChoices = JSON.parse(f.choices);
        }
      } catch (e) {
        // Fallback
      }

      return {
        id: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder || "",
        required: !!f.required,
        choices: parsedChoices,
        width: f.width || "full",
        name: f.name || `field_${f.position}`,
        requiredMessage: f.requiredMessage || "This field is required",
        metafieldKey: f.metafieldKey || "",
        isDynamicTag: !!f.isDynamicTag,
        logicRules: f.logicRules || "",
        isOpen: false,
      };
    })
  );

  // Advanced states from image
  const [loginLinkPrefix, setLoginLinkPrefix] = useState(form.loginLinkPrefix || "Already have an account?");
  const [loginLinkLabel, setLoginLinkLabel] = useState(form.loginLinkLabel || "Sign In");
  const [loginLinkPosition, setLoginLinkPosition] = useState(form.loginLinkPosition || "After Submit Button");
  const [emailExistsMessage, setEmailExistsMessage] = useState(
    form.emailExistsMessage || "Email Already Taken! Try a different Email or Login"
  );
  const [adminNotificationEmails, setAdminNotificationEmails] = useState(form.adminNotificationEmails || "");
  const [disableCountryOptions, setDisableCountryOptions] = useState(form.disableCountryOptions || false);
  const [defaultCountryPhoneCode, setDefaultCountryPhoneCode] = useState(form.defaultCountryPhoneCode || "+1 for Us");
  const [integrationHubSpot, setIntegrationHubSpot] = useState(false);
  const [integrationReCAPTCHA, setIntegrationReCAPTCHA] = useState(false);
  const [theme, setTheme] = useState(form.theme || "minimal");

  const [toastVisible, setToastVisible] = useState(false);
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");

  const loginPositionOptions = [
    { label: "After Submit Button", value: "After Submit Button" },
    { label: "Before Submit Button", value: "Before Submit Button" },
    { label: "Disabled", value: "Disabled" },
  ];

  const handleSelectFieldType = (typeKey: string, defaultLabel: string, defaultPlaceholder: string = "") => {
    setPickerModalOpen(false);
    const uniqueSuffix = fields.length + 1;
    
    let initialChoices: ChoiceOption[] | string = "";
    if (typeKey === "select" || typeKey === "radio" || typeKey === "checkbox_list") {
      initialChoices = [
        { label: "Label 1", value: "Value 1", desc: "Description 1", defaultChecked: true },
        { label: "Label 2", value: "Value 2", desc: "Description 2", defaultChecked: false },
        { label: "Label 3", value: "Value 3", desc: "Description 3", defaultChecked: false },
      ];
    }

    setFields([
      ...fields,
      {
        type: typeKey,
        label: defaultLabel,
        placeholder: defaultPlaceholder,
        required: false,
        choices: initialChoices,
        width: "full",
        name: `${typeKey}_field_${uniqueSuffix}`,
        requiredMessage: "This field is required",
        metafieldKey: "",
        isDynamicTag: false,
        logicRules: "",
        isOpen: true,
      },
    ]);
  };

  const clearFields = () => {
    setFields([]);
  };

  const removeField = (index: number) => {
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  const updateFieldProperty = (index: number, key: keyof FormFieldItem, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    if (key === "label") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (slug) {
        updated[index].name = slug;
      }
    }
    setFields(updated);
  };

  const addChoiceOption = (fieldIndex: number) => {
    const updated = [...fields];
    const currentChoices = Array.isArray(updated[fieldIndex].choices) 
      ? (updated[fieldIndex].choices as ChoiceOption[]) 
      : [];
      
    const suffix = currentChoices.length + 1;
    const newChoices = [
      ...currentChoices,
      { label: `Label ${suffix}`, value: `Value ${suffix}`, desc: `Description ${suffix}`, defaultChecked: false }
    ];
    updated[fieldIndex].choices = newChoices;
    setFields(updated);
  };

  const removeChoiceOption = (fieldIndex: number, optionIndex: number) => {
    const updated = [...fields];
    if (Array.isArray(updated[fieldIndex].choices)) {
      const current = [...(updated[fieldIndex].choices as ChoiceOption[])];
      current.splice(optionIndex, 1);
      updated[fieldIndex].choices = current;
      setFields(updated);
    }
  };

  const updateChoiceOptionProperty = (fieldIndex: number, optionIndex: number, key: keyof ChoiceOption, value: any) => {
    const updated = [...fields];
    if (Array.isArray(updated[fieldIndex].choices)) {
      const current = [...(updated[fieldIndex].choices as ChoiceOption[])];
      current[optionIndex] = { ...current[optionIndex], [key]: value };
      updated[fieldIndex].choices = current;
      setFields(updated);
    }
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFields(updated);
  };

  const toggleFieldOpen = (index: number) => {
    const updated = [...fields];
    updated[index].isOpen = !updated[index].isOpen;
    setFields(updated);
  };

  const getFieldBorderColor = (type: string) => {
    if (type.startsWith("customer_") || ["first_name", "last_name", "email", "phone", "address", "country_state", "accepts_marketing"].includes(type)) {
      return "#10854d"; // Shopify green
    }
    if (["title", "description", "step"].includes(type)) {
      return "#8250df"; // Content purple
    }
    return "#006fbb"; // Custom blue
  };

  const getFieldCategoryInfo = (type: string) => {
    if (type.startsWith("customer_") || ["first_name", "last_name", "email", "phone", "address", "country_state", "accepts_marketing"].includes(type)) {
      return { label: "Shopify Customer Field", tone: "success" as const };
    }
    if (["title", "description", "step"].includes(type)) {
      return { label: "Layout Block", tone: "attention" as const };
    }
    return { label: "Custom Field", tone: "info" as const };
  };

  const handleSave = () => {
    submit(
      {
        payload: JSON.stringify({
          title,
          description,
          successMessage,
          redirectUrl,
          fields,
          theme,
          loginLinkPrefix,
          loginLinkLabel,
          loginLinkPosition,
          emailExistsMessage,
          adminNotificationEmails,
          disableCountryOptions,
          defaultCountryPhoneCode,
          integrationHubSpot: false,
          integrationReCAPTCHA: false,
        }),
      },
      {
        method: "POST",
      }
    );
    setToastVisible(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(form.id);
    shopify.toast.show("Form ID copied to clipboard!");
  };

  const fieldTemplates = {
    customer: [
      { key: "text", label: "Customer First Name", desc: "Connects to customer first name.", placeholder: "First Name" },
      { key: "text", label: "Customer Last Name", desc: "Connects to customer last name.", placeholder: "Last Name" },
      { key: "email", label: "Customer Email", desc: "Connects to customer email address.", placeholder: "Email" },
      { key: "checkbox", label: "Subscribe Checkbox", desc: "Customer tags as accepts marketing.", placeholder: "" },
      { key: "phone", label: "Customer Phone Number", desc: "Connects to telephone field.", placeholder: "+1 (555) 000-0000" },
      { key: "textarea", label: "Customer Address", desc: "Captures full address details.", placeholder: "Address" },
      { key: "select", label: "Country and State", desc: "Country/state selection dropdown.", placeholder: "" },
      { key: "step", label: "Step divider", desc: "Separates forms into sections.", placeholder: "" },
    ],
    custom: [
      { key: "text", label: "Text Field", desc: "Accepts names, short notes, labels.", placeholder: "" },
      { key: "number", label: "Numeric Field", desc: "Only accepts numerical inputs.", placeholder: "0" },
      { key: "email", label: "Email Field", desc: "Specifically validates email formats.", placeholder: "email@example.com" },
      { key: "select", label: "Dropdown Menu", desc: "Provides single selectable options list.", placeholder: "" },
      { key: "radio", label: "Radio Buttons", desc: "Select one option out of many.", placeholder: "" },
      { key: "checkbox_list", label: "Checkboxes", desc: "Allows selecting multiple choices.", placeholder: "" },
      { key: "phone", label: "Tel Field", desc: "For telephone phone number details.", placeholder: "" },
      { key: "textarea", label: "Textarea", desc: "Allows multi-line comments.", placeholder: "" },
      { key: "date", label: "Datepicker", desc: "Pick preferred appointment date.", placeholder: "" },
    ],
    content: [
      { key: "title", label: "Extra Title", desc: "For titles inside form blocks.", placeholder: "Section Title" },
      { key: "description", label: "Richtext Description", desc: "Explain specifications.", placeholder: "Details..." },
    ],
  };

  const tStyle = getThemeStyles(theme);

  return (
    <Page
      title={`Edit Form: ${title}`}
      backAction={{ content: "Forms List", url: "/app/forms" }}
      primaryAction={{
        content: isSaving ? "Saving..." : "Save Form",
        onAction: handleSave,
        disabled: isSaving,
      }}
    >
      <BlockStack gap="400">
        {toastVisible && !isSaving && (
          <Banner title="Form saved successfully!" tone="success" onDismiss={() => setToastVisible(false)} />
        )}

        <Layout>
          {/* Main Form Fields Editor */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* Form Title Card */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Form Name & Header
                  </Text>
                  <TextField
                    label="Form Title"
                    labelHidden
                    value={title}
                    onChange={setTitle}
                    placeholder="Enter Form Title (e.g. Wholesale Registration Form)"
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>

              {/* Fields Config Card */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h2">
                      Form Fields
                    </Text>
                    <InlineStack gap="300">
                      <Button onClick={clearFields} variant="plain" tone="critical">
                        — Clear all fields
                      </Button>
                      <Button onClick={() => setPickerModalOpen(true)} variant="primary" icon={PlusIcon}>
                        Add Field
                      </Button>
                    </InlineStack>
                  </InlineStack>

                  {fields.length === 0 ? (
                    <Box padding="600" textAlign="center" background="bg-surface-active" borderRadius="200">
                      <BlockStack gap="200" align="center">
                        <Text variant="bodyLg" as="p" tone="subdued">
                          Your form is empty. Click "+ Add Field" to choose fields and customize.
                        </Text>
                        <Button onClick={() => setPickerModalOpen(true)} variant="secondary">
                          + Choose Field Template
                        </Button>
                      </BlockStack>
                    </Box>
                  ) : (
                    <BlockStack gap="300">
                      {fields.map((field, index) => {
                        const cat = getFieldCategoryInfo(field.type);
                        const leftBorderColor = getFieldBorderColor(field.type);

                        return (
                          <div
                            key={index}
                            style={{
                              borderRadius: "8px",
                              backgroundColor: field.isOpen ? "#ffffff" : "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderLeft: `4px solid ${leftBorderColor}`,
                              boxShadow: field.isOpen ? "0 4px 12px rgba(0,0,0,0.03)" : "none",
                              transition: "all 0.2s ease-in-out",
                            }}
                          >
                            <Box padding="300">
                              <BlockStack gap="200">
                                {/* Header (Clicking expand/collapse makes it super clean) */}
                                <div
                                  onClick={() => toggleFieldOpen(index)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="300" blockAlign="center">
                                      <Icon source={field.isOpen ? ChevronDownIcon : ChevronRightIcon} />
                                      <BlockStack gap="050">
                                        <InlineStack gap="200" blockAlign="center">
                                          <Text variant="headingSm" as="h3">
                                            {field.label || "Untitled Field"}
                                          </Text>
                                          <Badge tone={cat.tone}>{cat.label}</Badge>
                                          {field.required && <Badge tone="critical">Required</Badge>}
                                        </InlineStack>
                                        <Text variant="bodyXs" as="span" tone="subdued">
                                          Unique key: <code>{field.name}</code> | Width: {field.width === "half" ? "50%" : "100%"}
                                        </Text>
                                      </BlockStack>
                                    </InlineStack>
                                    
                                    {/* Action items stop propagation so clicking buttons doesn't trigger collapse */}
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <InlineStack gap="100">
                                        <Button
                                          onClick={() => moveField(index, "up")}
                                          disabled={index === 0}
                                          icon={ChevronUpIcon}
                                          size="slim"
                                        />
                                        <Button
                                          onClick={() => moveField(index, "down")}
                                          disabled={index === fields.length - 1}
                                          icon={ChevronDownIcon}
                                          size="slim"
                                        />
                                        <Tooltip content="Duplicate Field">
                                          <Button
                                            onClick={() => {
                                              const fieldToCopy = fields[index];
                                              const duplicated = {
                                                ...fieldToCopy,
                                                label: `${fieldToCopy.label} (Copy)`,
                                                name: `${fieldToCopy.name}_copy`,
                                                isOpen: true,
                                              };
                                              const updated = [...fields];
                                              updated.splice(index + 1, 0, duplicated);
                                              setFields(updated);
                                            }}
                                            icon={DuplicateIcon}
                                            size="slim"
                                          />
                                        </Tooltip>
                                        <Button onClick={() => removeField(index)} icon={DeleteIcon} tone="critical" size="slim" />
                                      </InlineStack>
                                    </div>
                                  </InlineStack>
                                </div>

                                <Collapsible open={!!field.isOpen} id={`field_collapsible_${index}`}>
                                  <Box paddingBlockStart="300">
                                    <BlockStack gap="400">
                                      <Divider />
                                      
                                      {/* Basic Settings */}
                                      <BlockStack gap="200">
                                        <Text variant="headingSm" as="h4">Basic configurations</Text>
                                        <BlockStack gap="300">
                                          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                                            <Select
                                              label="Field Type"
                                              options={[
                                                { label: "Text Field", value: "text" },
                                                { label: "Numeric Field", value: "number" },
                                                { label: "Email Field", value: "email" },
                                                { label: "Dropdown Menu", value: "select" },
                                                { label: "Radio Buttons", value: "radio" },
                                                { label: "Checkboxes", value: "checkbox_list" },
                                                { label: "Single Checkbox", value: "checkbox" },
                                                { label: "Tel Field", value: "phone" },
                                                { label: "Textarea", value: "textarea" },
                                                { label: "Datepicker", value: "date" },
                                                { label: "Step Divider", value: "step" },
                                                { label: "Extra Title", value: "title" },
                                                { label: "Richtext Description", value: "description" },
                                              ]}
                                              value={field.type}
                                              onChange={(value) => updateFieldProperty(index, "type", value)}
                                            />
                                          </InlineGrid>
                                          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                                            <TextField
                                              label="Field Label (Shown to customer)"
                                              value={field.label}
                                              onChange={(value) => updateFieldProperty(index, "label", value)}
                                              autoComplete="off"
                                            />
                                            <TextField
                                              label={
                                                <InlineStack gap="100" blockAlign="center">
                                                  <span>Field Placeholder</span>
                                                  <Tooltip content="Hint text shown inside empty input fields before a user enters a value.">
                                                    <span style={{ cursor: "pointer", display: "flex", width: "16px", height: "16px" }}>
                                                      <Icon source={InfoIcon} tone="subdued" />
                                                    </span>
                                                  </Tooltip>
                                                </InlineStack>
                                              }
                                              value={field.placeholder}
                                              onChange={(value) => updateFieldProperty(index, "placeholder", value)}
                                              autoComplete="off"
                                            />
                                          </InlineGrid>
                                        </BlockStack>
                                      </BlockStack>

                                      {/* Visual Field Layout / Width Selector */}
                                      <BlockStack gap="200">
                                        <Text variant="headingSm" as="h4">Layout & Sizing</Text>
                                        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                                          <BlockStack gap="100">
                                            <span style={{ fontSize: "13px", color: "#202223" }}>Field Column Width</span>
                                            <InlineStack gap="200">
                                              <Button
                                                pressed={field.width === "half"}
                                                onClick={() => updateFieldProperty(index, "width", "half")}
                                              >
                                                50% (Side-by-Side)
                                              </Button>
                                              <Button
                                                pressed={field.width === "full"}
                                                onClick={() => updateFieldProperty(index, "width", "full")}
                                              >
                                                100% (Full Width)
                                              </Button>
                                            </InlineStack>
                                          </BlockStack>
                                          
                                          <BlockStack gap="200">
                                            <div style={{ paddingTop: "20px" }}>
                                              <Checkbox
                                                label="Mark as Required field"
                                                checked={field.required}
                                                onChange={(value) => updateFieldProperty(index, "required", value)}
                                              />
                                            </div>
                                            {field.required && (
                                              <TextField
                                                label="Validation Error Message"
                                                value={field.requiredMessage}
                                                onChange={(value) => updateFieldProperty(index, "requiredMessage", value)}
                                                autoComplete="off"
                                              />
                                            )}
                                          </BlockStack>
                                        </InlineGrid>
                                      </BlockStack>

                                      {/* Shopify Customer Sync Mapping */}
                                      <Box padding="300" background="bg-surface" borderRadius="100">
                                        <BlockStack gap="200">
                                          <Text variant="headingSm" as="h4">Shopify Sync & Integration Mapping</Text>
                                          <Select
                                            label="Map to Shopify Customer field"
                                            options={[
                                              { label: "None (Save to custom submitted data only)", value: "" },
                                              { label: "First Name", value: "first_name" },
                                              { label: "Last Name", value: "last_name" },
                                              { label: "Email Address", value: "email" },
                                              { label: "Phone Number", value: "phone" },
                                              { label: "Company Name", value: "company" },
                                              { label: "Customer Tags (Comma separated)", value: "tags" },
                                              { label: "Customer Notes", value: "notes" },
                                            ]}
                                            value={field.metafieldKey || ""}
                                            onChange={(value) => updateFieldProperty(index, "metafieldKey", value)}
                                            helpText="PandaForms will automatically map this field's input to the chosen Shopify Customer schema property during sync."
                                          />
                                        </BlockStack>
                                      </Box>

                                      {/* Simple Conditional Logic Panel */}
                                      <Box padding="300" background="bg-surface" borderRadius="100">
                                        <BlockStack gap="200">
                                          <Text variant="headingSm" as="h4">Conditional Visibility Logic</Text>
                                          {(() => {
                                            let logic: any = { enabled: false, dependsOn: "", value: "" };
                                            if (field.logicRules) {
                                              try {
                                                logic = JSON.parse(field.logicRules);
                                              } catch(e) {}
                                            }
                                            const handleLogicChange = (key: string, val: any) => {
                                              const newLogic = { ...logic, [key]: val };
                                              updateFieldProperty(index, "logicRules", JSON.stringify(newLogic));
                                            };

                                            return (
                                              <BlockStack gap="200">
                                                <Checkbox
                                                  label="Enable Conditional Logic rule"
                                                  checked={!!logic.enabled}
                                                  onChange={(val) => handleLogicChange("enabled", val)}
                                                />
                                                {logic.enabled && (
                                                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                                                    <Select
                                                      label="Show this field only if"
                                                      options={[
                                                        { label: "Select Field...", value: "" },
                                                        ...fields
                                                          .filter((_, fIdx) => fIdx !== index)
                                                          .map((f) => ({ label: f.label || f.name, value: f.name }))
                                                      ]}
                                                      value={logic.dependsOn || ""}
                                                      onChange={(val) => handleLogicChange("dependsOn", val)}
                                                    />
                                                    <TextField
                                                      label="Equals value"
                                                      value={logic.value || ""}
                                                      onChange={(val) => handleLogicChange("value", val)}
                                                      autoComplete="off"
                                                      placeholder="Value to trigger"
                                                    />
                                                  </InlineGrid>
                                                )}
                                              </BlockStack>
                                            );
                                          })()}
                                        </BlockStack>
                                      </Box>

                                      {/* Choice Options Manager */}
                                      {(field.type === "select" || field.type === "radio" || field.type === "checkbox_list") && (
                                        <Box padding="300" background="bg-surface" borderRadius="100">
                                          <BlockStack gap="300">
                                            <InlineStack align="space-between" blockAlign="center">
                                              <Text variant="headingSm" as="h4">Radio/Dropdown Options</Text>
                                              <Button onClick={() => addChoiceOption(index)} size="slim" icon={PlusIcon}>Add Option</Button>
                                            </InlineStack>

                                            {Array.isArray(field.choices) && (field.choices as ChoiceOption[]).length > 0 && (
                                              <div style={{ padding: "0 8px", borderBottom: "1px solid #e1e3e5", paddingBottom: "4px" }}>
                                                <InlineGrid columns={{ xs: 1, md: 5 }} gap="200">
                                                  <Text variant="bodyXs" as="span" tone="subdued" fontWeight="bold">Option Label</Text>
                                                  <Text variant="bodyXs" as="span" tone="subdued" fontWeight="bold">Option Value</Text>
                                                  <Text variant="bodyXs" as="span" tone="subdued" fontWeight="bold">Option Description</Text>
                                                  <Text variant="bodyXs" as="span" tone="subdued" fontWeight="bold" textAlign="center">Default Checked</Text>
                                                  <Text variant="bodyXs" as="span" tone="subdued" fontWeight="bold" textAlign="right">Action</Text>
                                                </InlineGrid>
                                              </div>
                                            )}

                                            {Array.isArray(field.choices) && (field.choices as ChoiceOption[]).map((opt, oIdx) => (
                                              <Box key={oIdx} padding="200" background="bg-surface-active" borderRadius="100">
                                                <InlineGrid columns={{ xs: 1, md: 5 }} gap="200" blockAlign="center">
                                                  <TextField
                                                    label="Option Label"
                                                    labelHidden
                                                    value={opt.label}
                                                    onChange={(val) => updateChoiceOptionProperty(index, oIdx, "label", val)}
                                                    autoComplete="off"
                                                    size="slim"
                                                  />
                                                  <TextField
                                                    label="Option Value"
                                                    labelHidden
                                                    value={opt.value}
                                                    onChange={(val) => updateChoiceOptionProperty(index, oIdx, "value", val)}
                                                    autoComplete="off"
                                                    size="slim"
                                                  />
                                                  <TextField
                                                    label="Option Description"
                                                    labelHidden
                                                    value={opt.desc}
                                                    onChange={(val) => updateChoiceOptionProperty(index, oIdx, "desc", val)}
                                                    autoComplete="off"
                                                    size="slim"
                                                  />
                                                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                                                    <Checkbox
                                                      label=""
                                                      labelHidden
                                                      checked={opt.defaultChecked}
                                                      onChange={(val) => updateChoiceOptionProperty(index, oIdx, "defaultChecked", val)}
                                                    />
                                                  </div>
                                                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                                                    <Button onClick={() => removeChoiceOption(index, oIdx)} icon={DeleteIcon} tone="critical" size="slim" />
                                                  </div>
                                                </InlineGrid>
                                              </Box>
                                            ))}
                                          </BlockStack>
                                        </Box>
                                      )}


                                    </BlockStack>
                                  </Box>
                                </Collapsible>
                              </BlockStack>
                            </Box>
                          </div>
                        );
                      })}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

               {/* Live Storefront Form Preview */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <span style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: "#10b981",
                          boxShadow: "0 0 8px 2px rgba(16, 185, 129, 0.6)",
                          display: "inline-block"
                        }} />
                        <Text variant="headingMd" as="h3">
                          Live Storefront Form Preview
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Button pressed={previewViewport === "desktop"} onClick={() => setPreviewViewport("desktop")} size="slim">Desktop Preview</Button>
                        <Button pressed={previewViewport === "mobile"} onClick={() => setPreviewViewport("mobile")} size="slim">Mobile Preview</Button>
                        <Badge tone="success">Storefront Theme Match</Badge>
                      </InlineStack>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      Fill out fields, select choices, or click submit to test the storefront experience. To edit form fields, use the <strong>Form Fields</strong> section above.
                    </Text>
                     <Divider />
                    {/* Mock Browser UI Window */}
                    <div style={{
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                      backgroundColor: "#ffffff",
                      marginTop: "12px",
                      width: previewViewport === "mobile" ? "375px" : "100%",
                      margin: previewViewport === "mobile" ? "12px auto 0 auto" : "12px 0 0 0",
                      transition: "all 0.3s ease"
                    }}>
                      {/* Browser Header Bar */}
                      <div style={{
                        backgroundColor: "#f8fafc",
                        borderBottom: "1px solid #cbd5e1",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px"
                      }}>
                        {/* Window Dots */}
                        <div style={{ display: "flex", gap: "6px" }}>
                          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
                          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#eab308" }} />
                          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
                        </div>
                        {/* Address Bar */}
                        <div style={{
                          flex: 1,
                          backgroundColor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#64748b",
                          padding: "4px 12px",
                          textAlign: "center",
                          fontFamily: "monospace",
                          userSelect: "none",
                          maxWidth: "400px",
                          margin: "0 auto"
                        }}>
                          yourstore.myshopify.com/apps/pandaforms
                        </div>
                      </div>                      {/* Storefront Page Content */}
                      <div style={{ padding: "32px", ...tStyle.wrapper }}>
                        <div style={tStyle.innerWrapper || {}}>
                          <BlockStack gap="500">
                            {/* Title and Description */}
                            <div style={{ textAlign: "center", borderBottom: `1px solid ${theme === "dark" ? "#334155" : theme === "glassmorphism" ? "rgba(255,255,255,0.2)" : "#f1f5f9"}`, paddingBottom: "20px" }}>
                              <h2 style={{ fontSize: "24px", fontWeight: "700", ...tStyle.title, marginBottom: "8px" }}>
                                {title || "Register Your Account"}
                              </h2>
                              {description && (
                                <p style={{ fontSize: "14px", lineHeight: "1.5", maxWidth: "600px", margin: "0 auto", ...tStyle.desc }}>
                                  {description}
                                </p>
                              )}
                            </div>

                            {/* Fields Grid */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                              {fields
                                .filter((f) => f.type !== "hidden")
                                .map((f, idx) => {
                                  const isHalf = f.width === "half";
                                  return (
                                    <div
                                      key={idx}
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "8px",
                                        flex: isHalf ? "1 1 calc(50% - 10px)" : "1 1 100%",
                                        minWidth: isHalf ? "240px" : "100%",
                                        boxSizing: "border-box",
                                      }}
                                    >
                                      {f.type === "step" ? (
                                        <div style={{ padding: "16px 0", width: "100%", margin: "12px 0", ...tStyle.step }}>
                                          <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 8px", borderRadius: "4px" }}>
                                            📍 {f.label || "Step Divider"}
                                          </span>
                                        </div>
                                      ) : f.type === "title" ? (
                                        <div style={{ margin: "12px 0 4px 0" }}>
                                          <h3 style={{ fontSize: "18px", fontWeight: "600", ...tStyle.title }}>
                                            {f.label || "Section Title"}
                                          </h3>
                                        </div>
                                      ) : f.type === "description" ? (
                                        <div style={{ margin: "4px 0 8px 0" }}>
                                          <p style={{ fontSize: "14px", lineHeight: "1.5", ...tStyle.desc }}>
                                            {f.label || "Richtext Description"}
                                          </p>
                                        </div>
                                      ) : (
                                        <>
                                          <label style={{ fontSize: "13px", fontWeight: "600", display: "block", ...tStyle.label }}>
                                            {f.label || "Field Label"}
                                            {f.required && <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>}
                                          </label>

                                          {f.type === "textarea" ? (
                                            <textarea
                                              style={{
                                                width: "100%",
                                                padding: "12px",
                                                minHeight: "100px",
                                                fontSize: "14px",
                                                outline: "none",
                                                boxSizing: "border-box",
                                                fontFamily: "inherit",
                                                ...tStyle.input
                                              }}
                                              placeholder={f.placeholder}
                                            />
                                          ) : f.type === "select" || f.type === "country_state" ? (
                                            <select
                                              style={{
                                                width: "100%",
                                                padding: "12px",
                                                fontSize: "14px",
                                                outline: "none",
                                                boxSizing: "border-box",
                                                height: "46px",
                                                ...tStyle.input
                                              }}
                                            >
                                              {Array.isArray(f.choices) ? (
                                                (f.choices as ChoiceOption[]).map((c, i) => (
                                                  <option key={i} value={c.value}>{c.label}</option>
                                                ))
                                              ) : (
                                                <option>Select Option</option>
                                              )}
                                            </select>
                                          ) : f.type === "radio" ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                                              {Array.isArray(f.choices) &&
                                                (f.choices as ChoiceOption[]).map((c, i) => (
                                                  <label key={i} style={{ fontSize: "14px", display: "inline-flex", gap: "10px", alignItems: "center", cursor: "pointer", ...tStyle.label }}>
                                                    <input type="radio" name={`preview_radio_${idx}`} defaultChecked={c.defaultChecked} style={{ width: "16px", height: "16px", accentColor: "#008060" }} />
                                                    <span>{c.label}</span>
                                                  </label>
                                                ))}
                                            </div>
                                          ) : f.type === "checkbox" || f.type === "checkbox_list" ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                                              {f.type === "checkbox" ? (
                                                <label style={{ fontSize: "14px", display: "inline-flex", gap: "10px", alignItems: "center", cursor: "pointer", ...tStyle.label }}>
                                                  <input type="checkbox" style={{ width: "16px", height: "16px", accentColor: "#008060" }} />
                                                  <span>{f.label || "Confirm / Agree"}</span>
                                                </label>
                                              ) : (
                                                Array.isArray(f.choices) &&
                                                (f.choices as ChoiceOption[]).map((c, i) => (
                                                  <label key={i} style={{ fontSize: "14px", display: "inline-flex", gap: "10px", alignItems: "center", cursor: "pointer", ...tStyle.label }}>
                                                    <input type="checkbox" defaultChecked={c.defaultChecked} style={{ width: "16px", height: "16px", accentColor: "#008060" }} />
                                                    <span>{c.label}</span>
                                                  </label>
                                                ))
                                              )}
                                            </div>
                                          ) : f.type === "file" ? (
                                            <div style={{
                                              padding: "20px",
                                              borderRadius: "6px",
                                              textAlign: "center",
                                              cursor: "pointer",
                                              ...tStyle.file
                                            }}
                                              onClick={() => {
                                                const fileInput = document.getElementById(`preview_file_${idx}`);
                                                if (fileInput) fileInput.click();
                                              }}
                                            >
                                              <input type="file" id={`preview_file_${idx}`} style={{ display: "none" }} onChange={(e) => {
                                                const fileName = e.target.files?.[0]?.name || "No file chosen";
                                                const lbl = document.getElementById(`file_label_${idx}`);
                                                if (lbl) lbl.innerText = fileName;
                                              }} />
                                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "14px", color: tStyle.file.textColor, fontWeight: "600" }}>Upload a file</span>
                                                <span id={`file_label_${idx}`} style={{ fontSize: "12px", opacity: 0.8 }}>PDF, PNG, JPG (Max 10MB)</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <input
                                              type={f.type === "password" ? "password" : f.type === "date" ? "date" : "text"}
                                              style={{
                                                width: "100%",
                                                padding: "12px",
                                                fontSize: "14px",
                                                outline: "none",
                                                boxSizing: "border-box",
                                                height: "46px",
                                                ...tStyle.input
                                              }}
                                              placeholder={f.placeholder}
                                            />
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>

                            {/* Submit Button */}
                            <div style={{ marginTop: "12px" }}>
                              <button
                                type="button"
                                onClick={() => shopify.toast.show("Form submitted successfully (Preview mode)")}
                                style={{
                                  border: "none",
                                  padding: "14px 28px",
                                  fontWeight: "600",
                                  fontSize: "16px",
                                  width: "100%",
                                  cursor: "pointer",
                                  transition: "background-color 0.2s",
                                  ...tStyle.button
                                }}
                              >
                                Submit Form
                              </button>
                            </div>
                          </BlockStack>
                        </div>
                      </div>
                    </div>
                  </BlockStack>
              </Card>

              {/* Form Submission Messages Card */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Submission Success Page & Redirects
                  </Text>
                  <TextField
                    label="Success Message"
                    value={successMessage}
                    onChange={setSuccessMessage}
                    multiline={2}
                    autoComplete="off"
                  />
                  <TextField
                    label="Success Redirect URL (Optional)"
                    value={redirectUrl}
                    onChange={setRedirectUrl}
                    placeholder="Example: /pages/thankyou"
                    helpText="Redirect users to a specific page after the form is successfully submitted."
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Right Sidebar Settings Column */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Form ID Card */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">
                    Form ID
                  </Text>
                  <InlineStack align="space-between" blockAlign="center">
                    <code style={{ fontSize: "14px", fontWeight: "bold", backgroundColor: "#f3f3f3", padding: "4px 8px", borderRadius: "4px" }}>
                      {form.id}
                    </code>
                    <Button onClick={copyToClipboard} icon={DuplicateIcon} size="slim" variant="plain" />
                  </InlineStack>
                  <Text variant="bodySm" as="p" tone="subdued">
                    Use this ID to show the form in the theme widget.
                  </Text>
                </BlockStack>
              </Card>

              {/* Form Design Theme Card */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">
                    Form Style Theme
                  </Text>
                  <Select
                    label="Choose Theme Design"
                    options={[
                      { label: "Minimalist (Clean)", value: "minimal" },
                      { label: "Glassmorphism (Frosted)", value: "glassmorphism" },
                      { label: "Modern Dark (Vibrant Dark)", value: "dark" },
                      { label: "Playful / Bold (Neon Brutalism)", value: "playful" },
                      { label: "Classic Shopify Theme (Polaris Match)", value: "classic" },
                    ]}
                    value={theme}
                    onChange={setTheme}
                  />
                  <Text variant="bodyXs" tone="subdued">
                    Changes will reflect instantly in the live preview window and the live storefront.
                  </Text>
                </BlockStack>
              </Card>

              {/* Additional settings Card */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">
                    Additional settings
                  </Text>
                  <TextField
                    label="Login link label prefix"
                    value={loginLinkPrefix}
                    onChange={setLoginLinkPrefix}
                    autoComplete="off"
                  />
                  <TextField
                    label="Login link label"
                    value={loginLinkLabel}
                    onChange={setLoginLinkLabel}
                    autoComplete="off"
                  />
                  <Select
                    label="Login link position"
                    options={loginPositionOptions}
                    value={loginLinkPosition}
                    onChange={setLoginLinkPosition}
                  />
                  <TextField
                    label="Email is already present"
                    value={emailExistsMessage}
                    onChange={setEmailExistsMessage}
                    autoComplete="off"
                  />
                  <TextField
                    label="Admin notification emails"
                    value={adminNotificationEmails}
                    onChange={setAdminNotificationEmails}
                    multiline={3}
                    helpText="Enter each email address on a new line."
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>

              {/* Country Phone Code Card */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">
                    Country Phone Code
                  </Text>
                  <Checkbox
                    label="Disable Country options"
                    checked={disableCountryOptions}
                    onChange={setDisableCountryOptions}
                  />
                  <TextField
                    label="Default Country"
                    value={defaultCountryPhoneCode}
                    onChange={setDefaultCountryPhoneCode}
                    placeholder="+1 for US"
                    helpText="Enter the default country calling code (e.g., +1 for USA, +91 for India)."
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>

              {/* Integrations Card */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">
                    Integrations
                  </Text>
                  <Checkbox
                    label="HubSpot (planned)"
                    checked={false}
                    disabled
                    onChange={setIntegrationHubSpot}
                  />
                  <Checkbox
                    label="Google reCAPTCHA (planned)"
                    checked={false}
                    disabled
                    onChange={setIntegrationReCAPTCHA}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Field Picker Popup Modal */}
      <Modal
        open={pickerModalOpen}
        onClose={() => setPickerModalOpen(false)}
        title="Select Field to Add"
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Customer Fields Section */}
            <Text variant="headingSm" as="h3">Customer Fields</Text>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
              {fieldTemplates.customer.map((tmpl) => (
                <Box key={tmpl.label} padding="200" background="bg-surface-active" borderRadius="100">
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="strong">{tmpl.label}</Text>
                    <Text variant="bodyXs" as="p" tone="subdued">{tmpl.desc}</Text>
                    <Button onClick={() => handleSelectFieldType(tmpl.key, tmpl.label, tmpl.placeholder)} size="slim" fullWidth>Add</Button>
                  </BlockStack>
                </Box>
              ))}
            </InlineGrid>
            <Divider />

            {/* Custom Fields Section */}
            <Text variant="headingSm" as="h3">Custom Fields</Text>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
              {fieldTemplates.custom.map((tmpl) => (
                <Box key={tmpl.label} padding="200" background="bg-surface-active" borderRadius="100">
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="strong">{tmpl.label}</Text>
                    <Text variant="bodyXs" as="p" tone="subdued">{tmpl.desc}</Text>
                    <Button onClick={() => handleSelectFieldType(tmpl.key, tmpl.label, tmpl.placeholder)} size="slim" fullWidth>Add</Button>
                  </BlockStack>
                </Box>
              ))}
            </InlineGrid>
            <Divider />

            {/* Content Section */}
            <Text variant="headingSm" as="h3">Content Only</Text>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
              {fieldTemplates.content.map((tmpl) => (
                <Box key={tmpl.label} padding="200" background="bg-surface-active" borderRadius="100">
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="strong">{tmpl.label}</Text>
                    <Text variant="bodyXs" as="p" tone="subdued">{tmpl.desc}</Text>
                    <Button onClick={() => handleSelectFieldType(tmpl.key, tmpl.label, tmpl.placeholder)} size="slim" fullWidth>Add</Button>
                  </BlockStack>
                </Box>
              ))}
            </InlineGrid>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
