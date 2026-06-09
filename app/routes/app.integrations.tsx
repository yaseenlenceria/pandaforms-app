import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  TextField,
  BlockStack,
  Checkbox,
  Text,
  Banner,
  Divider,
  Button,
  InlineStack,
  Box,
  InlineGrid,
  Badge,
} from "@shopify/polaris";
import { SettingsIcon, EmailIcon, AlertBubbleIcon, CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { testSMTPConnection } from "../email.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await db.setting.findUnique({ where: { shop } });

  if (!settings) {
    settings = await db.setting.create({
      data: {
        shop,
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPass: "",
        smtpFrom: "",
        smtpSecure: true,
        enableReCAPTCHA: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
        enableHubSpot: false,
        hubspotApiKey: "",
      },
    });
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const payload = await request.json();
  const { actionType } = payload;

  if (actionType === "testSMTP") {
    const { testEmail } = payload;
    if (!testEmail) {
      return json({ success: false, log: "Test email address is required." });
    }
    const res = await testSMTPConnection(shop, testEmail);
    return json({ success: res.success, log: res.log, isTestResult: true });
  }

  const {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
    enableReCAPTCHA,
    recaptchaSiteKey,
    recaptchaSecretKey,
    enableHubSpot,
    hubspotApiKey,
  } = payload;

  const updatedSettings = await db.setting.upsert({
    where: { shop },
    update: {
      smtpHost: smtpHost || "",
      smtpPort: parseInt(smtpPort) || 587,
      smtpUser: smtpUser || "",
      smtpPass: smtpPass || "",
      smtpFrom: smtpFrom || "",
      smtpSecure: !!smtpSecure,
      enableReCAPTCHA: false,
      recaptchaSiteKey: recaptchaSiteKey || "",
      recaptchaSecretKey: recaptchaSecretKey || "",
      enableHubSpot: false,
      hubspotApiKey: hubspotApiKey || "",
    },
    create: {
      shop,
      smtpHost: smtpHost || "",
      smtpPort: parseInt(smtpPort) || 587,
      smtpUser: smtpUser || "",
      smtpPass: smtpPass || "",
      smtpFrom: smtpFrom || "",
      smtpSecure: !!smtpSecure,
      enableReCAPTCHA: false,
      recaptchaSiteKey: recaptchaSiteKey || "",
      recaptchaSecretKey: recaptchaSecretKey || "",
      enableHubSpot: false,
      hubspotApiKey: hubspotApiKey || "",
    },
  });

  return json({ success: true, settings: updatedSettings });
};

export default function Integrations() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  // SMTP States
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(String(settings.smtpPort || 587));
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState(settings.smtpPass || "");
  const [smtpFrom, setSmtpFrom] = useState(settings.smtpFrom || "");
  const [smtpSecure, setSmtpSecure] = useState(settings.smtpSecure ?? true);

  // reCAPTCHA States
  const [enableReCAPTCHA, setEnableReCAPTCHA] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState(settings.recaptchaSiteKey || "");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState(settings.recaptchaSecretKey || "");

  // HubSpot States
  const [enableHubSpot, setEnableHubSpot] = useState(false);
  const [hubspotApiKey, setHubspotApiKey] = useState(settings.hubspotApiKey || "");

  // Test Connection SMTP state
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; log: string } | null>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);

  const handleSave = () => {
    submit(
      {
        actionType: "save",
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpFrom,
        smtpSecure,
        enableReCAPTCHA: false,
        recaptchaSiteKey,
        recaptchaSecretKey,
        enableHubSpot: false,
        hubspotApiKey,
      },
      {
        method: "POST",
        encType: "application/json",
      }
    );
    setToastVisible(true);
    setTestResult(null);
    setTimeout(() => setToastVisible(false), 5000);
  };

  const handleRunSMTPTest = async () => {
    if (!testEmail) return alert("Please enter a valid test email address.");
    setIsRunningTest(true);
    setTestResult(null);

    // Use fetcher / fetch to call action endpoint directly for test
    try {
      const response = await fetch("/app/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "testSMTP", testEmail }),
      });
      const data = await response.json();
      setTestResult({ success: data.success, log: data.log });
    } catch (err: any) {
      setTestResult({ success: false, log: err.message || "Failed to contact test runner endpoint." });
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <Page
      title="Integrations Hub"
      subtitle="Connect secure SMTP servers, spam protection APIs, CRM systems, and marketing lists."
      primaryAction={{
        content: isSaving ? "Saving..." : "Save Config",
        onAction: handleSave,
        disabled: isSaving,
      }}
    >
      <BlockStack gap="400">
        
        {toastVisible && !isSaving && (
          <Banner title="Integrations saved successfully!" tone="success" onDismiss={() => setToastVisible(false)} />
        )}

        <Layout>
          
          {/* SMTP Integration Setup */}
          <Layout.AnnotatedSection
            id="smtp-setup"
            title="Custom SMTP Server (Email Delivery)"
            description="Configure your own mail server to send form confirmations and B2B approval notifications from your own custom domain. (e.g. support@yourdomain.com)"
          >
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">SMTP Mail Connection Details</Text>
                
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField
                    label="SMTP Host"
                    placeholder="mail.yourdomain.com"
                    value={smtpHost}
                    onChange={setSmtpHost}
                    autoComplete="off"
                  />
                  <TextField
                    label="SMTP Port"
                    placeholder="587"
                    value={smtpPort}
                    onChange={setSmtpPort}
                    autoComplete="off"
                  />
                </InlineGrid>

                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField
                    label="SMTP Username"
                    placeholder="user@yourdomain.com"
                    value={smtpUser}
                    onChange={setSmtpUser}
                    autoComplete="off"
                  />
                  <TextField
                    label="SMTP Password"
                    value={smtpPass}
                    onChange={setSmtpPass}
                    type="password"
                    autoComplete="off"
                  />
                </InlineGrid>

                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField
                    label="SMTP Sender Email (From Address)"
                    placeholder="support@yourdomain.com"
                    value={smtpFrom}
                    onChange={setSmtpFrom}
                    autoComplete="off"
                  />
                  <div style={{ paddingTop: "24px" }}>
                    <Checkbox
                      label="Use Secure TLS Connection (Recommended)"
                      checked={smtpSecure}
                      onChange={setSmtpSecure}
                    />
                  </div>
                </InlineGrid>

                <Divider />

                {/* SMTP Connection Test Runner */}
                <Text variant="headingSm" as="h3">SMTP Connection test runner</Text>
                <InlineStack gap="300" blockAlign="end">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Test Email Destination"
                      placeholder="you@domain.com"
                      value={testEmail}
                      onChange={setTestEmail}
                      autoComplete="off"
                      helpText="PandaForms will send a secure test email to verify your SMTP authentication configuration."
                    />
                  </div>
                  <Button
                    onClick={handleRunSMTPTest}
                    loading={isRunningTest}
                    disabled={!smtpHost || !smtpUser}
                  >
                    Send Test Email
                  </Button>
                </InlineStack>

                {testResult && (
                  <Banner
                    title={testResult.success ? "SMTP connection test successful!" : "SMTP connection test failed"}
                    tone={testResult.success ? "success" : "critical"}
                  >
                    <p>{testResult.log}</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* Spam Prevention reCAPTCHA */}
          <Layout.AnnotatedSection
            id="spam-prevention"
            title="Google reCAPTCHA v2"
            description="Add Google reCAPTCHA challenge badges to your storefront forms to block spam bots from sending submissions."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Google reCAPTCHA v2 spam filter (planned)"
                  helpText="This connector is not active yet and should not be enabled for App Store review."
                  checked={false}
                  disabled
                  onChange={setEnableReCAPTCHA}
                />
                
                {enableReCAPTCHA && (
                  <BlockStack gap="300">
                    <TextField
                      label="Google reCAPTCHA Site Key"
                      value={recaptchaSiteKey}
                      onChange={setRecaptchaSiteKey}
                      autoComplete="off"
                    />
                    <TextField
                      label="Google reCAPTCHA Secret Key"
                      value={recaptchaSecretKey}
                      onChange={setRecaptchaSecretKey}
                      type="password"
                      autoComplete="off"
                    />
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* HubSpot Integration */}
          <Layout.AnnotatedSection
            id="crm-hubspot"
            title="HubSpot CRM Sync"
            description="Automatically create a new Contact inside your HubSpot account whenever a customer submits a storefront registration form."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="HubSpot CRM contact synchronization (planned)"
                  helpText="This connector is not active yet and should not be enabled for App Store review."
                  checked={false}
                  disabled
                  onChange={setEnableHubSpot}
                />
                
                {enableHubSpot && (
                  <TextField
                    label="HubSpot Access Token / API Key"
                    value={hubspotApiKey}
                    onChange={setHubspotApiKey}
                    type="password"
                    autoComplete="off"
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* Planned connectors */}
          <Layout.AnnotatedSection
            id="premium-integrations"
            title="Planned integrations"
            description="Upcoming connector options for email marketing platforms and automation tools."
          >
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              {[
                { name: "Klaviyo", desc: "Planned connector for Klaviyo marketing lists.", badge: "Planned" },
                { name: "Mailchimp", desc: "Planned connector for Mailchimp audiences.", badge: "Planned" },
                { name: "Google Sheets", desc: "Planned connector for spreadsheet exports.", badge: "Planned" },
                { name: "Zapier", desc: "Planned connector for automation webhooks.", badge: "Planned" },
              ].map((item) => (
                <Card key={item.name}>
                  <BlockStack gap="200" style={{ height: "100%", justifyContent: "space-between" }}>
                    <BlockStack gap="100">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingSm" as="h4">{item.name}</Text>
                        <Badge tone="attention">{item.badge}</Badge>
                      </InlineStack>
                      <Text variant="bodyXs" tone="subdued">{item.desc}</Text>
                    </BlockStack>
                    <div style={{ marginTop: "12px" }}>
                      <Button size="slim" disabled>Connect {item.name}</Button>
                    </div>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          </Layout.AnnotatedSection>

        </Layout>
      </BlockStack>
    </Page>
  );
}
