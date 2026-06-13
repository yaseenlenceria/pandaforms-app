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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await db.setting.findUnique({
    where: { shop },
  });

  if (!settings) {
    settings = await db.setting.create({
      data: {
        shop,
        autoApprove: false,
        approvedCustomerTag: "approved",
        wholesaleCustomerTag: "wholesale",
        adminEmailNotifications: true,
        adminEmailAddress: session.email || "",
        enableReCAPTCHA: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
        enableHubSpot: false,
        hubspotApiKey: "",
        saveToCustomerNotes: true,
        customerConfirmationEmail: true,
        customerApprovalEmail: true,
        customerRejectionEmail: true,
        confirmationEmailSubject: "We received your submission!",
        confirmationEmailBody: "Thank you for submitting the form. We are reviewing your application.",
        approvalEmailSubject: "Your account has been approved!",
        approvalEmailBody: "Congratulations! Your account has been approved. You now have full access.",
        rejectionEmailSubject: "Update regarding your application",
        rejectionEmailBody: "Thank you for your interest. Unfortunately, we cannot approve your application at this time.",
      },
    });
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const payload = await request.json();
  const {
    autoApprove,
    approvedCustomerTag,
    wholesaleCustomerTag,
    adminEmailNotifications,
    adminEmailAddress,
    recaptchaSiteKey,
    recaptchaSecretKey,
    hubspotApiKey,
    saveToCustomerNotes,
    customerConfirmationEmail,
    customerApprovalEmail,
    customerRejectionEmail,
    confirmationEmailSubject,
    confirmationEmailBody,
    approvalEmailSubject,
    approvalEmailBody,
    rejectionEmailSubject,
    rejectionEmailBody,
  } = payload;

  const settingsData = {
    autoApprove: !!autoApprove,
    approvedCustomerTag: approvedCustomerTag || "approved",
    wholesaleCustomerTag: wholesaleCustomerTag || "wholesale",
    adminEmailNotifications: !!adminEmailNotifications,
    adminEmailAddress: adminEmailAddress || "",
    enableReCAPTCHA: false,
    recaptchaSiteKey: recaptchaSiteKey || "",
    recaptchaSecretKey: recaptchaSecretKey || "",
    enableHubSpot: false,
    hubspotApiKey: hubspotApiKey || "",
    saveToCustomerNotes: !!saveToCustomerNotes,
    customerConfirmationEmail: !!customerConfirmationEmail,
    customerApprovalEmail: !!customerApprovalEmail,
    customerRejectionEmail: !!customerRejectionEmail,
    confirmationEmailSubject: confirmationEmailSubject || "",
    confirmationEmailBody: confirmationEmailBody || "",
    approvalEmailSubject: approvalEmailSubject || "",
    approvalEmailBody: approvalEmailBody || "",
    rejectionEmailSubject: rejectionEmailSubject || "",
    rejectionEmailBody: rejectionEmailBody || "",
  };

  const settings = await db.setting.upsert({
    where: { shop },
    update: settingsData,
    create: { shop, ...settingsData },
  });

  return json({ success: true, settings });
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [autoApprove, setAutoApprove] = useState(settings.autoApprove);
  const [approvedCustomerTag, setApprovedCustomerTag] = useState(settings.approvedCustomerTag);
  const [wholesaleCustomerTag, setWholesaleCustomerTag] = useState(settings.wholesaleCustomerTag);
  const [adminEmailNotifications, setAdminEmailNotifications] = useState(settings.adminEmailNotifications);
  const [adminEmailAddress, setAdminEmailAddress] = useState(settings.adminEmailAddress || "");
  const [enableReCAPTCHA, setEnableReCAPTCHA] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState(settings.recaptchaSiteKey || "");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState(settings.recaptchaSecretKey || "");
  const [enableHubSpot, setEnableHubSpot] = useState(false);
  const [hubspotApiKey, setHubspotApiKey] = useState(settings.hubspotApiKey || "");
  const [saveToCustomerNotes, setSaveToCustomerNotes] = useState(settings.saveToCustomerNotes);

  const [customerConfirmationEmail, setCustomerConfirmationEmail] = useState(settings.customerConfirmationEmail);
  const [confirmationEmailSubject, setConfirmationEmailSubject] = useState(settings.confirmationEmailSubject || "");
  const [confirmationEmailBody, setConfirmationEmailBody] = useState(settings.confirmationEmailBody || "");

  const [customerApprovalEmail, setCustomerApprovalEmail] = useState(settings.customerApprovalEmail);
  const [approvalEmailSubject, setApprovalEmailSubject] = useState(settings.approvalEmailSubject || "");
  const [approvalEmailBody, setApprovalEmailBody] = useState(settings.approvalEmailBody || "");

  const [customerRejectionEmail, setCustomerRejectionEmail] = useState(settings.customerRejectionEmail);
  const [rejectionEmailSubject, setRejectionEmailSubject] = useState(settings.rejectionEmailSubject || "");
  const [rejectionEmailBody, setRejectionEmailBody] = useState(settings.rejectionEmailBody || "");

  const [toastVisible, setToastVisible] = useState(false);

  const handleSave = () => {
    submit(
      {
        autoApprove,
        approvedCustomerTag,
        wholesaleCustomerTag,
        adminEmailNotifications,
        adminEmailAddress,
        enableReCAPTCHA: false,
        recaptchaSiteKey,
        recaptchaSecretKey,
        enableHubSpot: false,
        hubspotApiKey,
        saveToCustomerNotes,
        customerConfirmationEmail,
        customerApprovalEmail,
        customerRejectionEmail,
        confirmationEmailSubject,
        confirmationEmailBody,
        approvalEmailSubject,
        approvalEmailBody,
        rejectionEmailSubject,
        rejectionEmailBody,
      },
      {
        method: "POST",
        encType: "application/json",
      }
    );
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  };

  return (
    <Page
      title="Settings"
      subtitle="Manage your customer registration workflows, API keys, notifications, and auto-approval criteria."
      primaryAction={{
        content: isSaving ? "Saving..." : "Save Settings",
        onAction: handleSave,
        disabled: isSaving,
      }}
    >
      <BlockStack gap="400">
        {toastVisible && !isSaving && (
          <Banner title="Settings saved successfully!" tone="success" onDismiss={() => setToastVisible(false)} />
        )}

        <Layout>
          {/* Section 1: Customer approval behaviour */}
          <Layout.AnnotatedSection
            id="approval-behavior"
            title="Customer approval behaviour"
            description="Configure the criteria and process for automatically and manually approving customer registrations."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Auto Approve Submissions"
                  helpText="If checked, applications will be automatically marked as Approved and the customer will be tagged/created in Shopify immediately."
                  checked={autoApprove}
                  onChange={setAutoApprove}
                />
                
                <TextField
                  label="Approved Customer Tag"
                  value={approvedCustomerTag}
                  onChange={setApprovedCustomerTag}
                  helpText="This tag will be applied to the customer in Shopify when a submission is approved."
                  autoComplete="off"
                />

                <TextField
                  label="Wholesale Customer Tag"
                  value={wholesaleCustomerTag}
                  onChange={setWholesaleCustomerTag}
                  helpText="This tag will be additionally applied to the customer in Shopify if they apply via a Wholesale template form."
                  autoComplete="off"
                />

                <Checkbox
                  label="Save to Customer Notes"
                  helpText="When enabled, all custom form field submission data is saved inside the Shopify Customer Notes for easy staff view."
                  checked={saveToCustomerNotes}
                  onChange={setSaveToCustomerNotes}
                />
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* Section 2: Admin notification and tagging */}
          <Layout.AnnotatedSection
            id="admin-notifications"
            title="Admin notification and tagging"
            description="Configure staff email notifications, security tools like Google reCAPTCHA, and universal CRM integrations."
          >
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Staff Notifications</Text>
                <Checkbox
                  label="Send Admin Email Notifications"
                  helpText="Notify the administrator by email whenever a new form is submitted."
                  checked={adminEmailNotifications}
                  onChange={setAdminEmailNotifications}
                />

                {adminEmailNotifications && (
                  <TextField
                    label="Admin Notification Email Address"
                    value={adminEmailAddress}
                    onChange={setAdminEmailAddress}
                    placeholder="admin@yourdomain.com"
                    autoComplete="off"
                  />
                )}

                <Divider />

                <Text variant="headingSm" as="h3">Spam Prevention</Text>
                <Checkbox
                  label="Google reCAPTCHA v2 (planned)"
                  helpText="This connector is not active yet and should not be enabled for App Store review."
                  checked={false}
                  disabled
                  onChange={setEnableReCAPTCHA}
                />

                {enableReCAPTCHA && (
                  <BlockStack gap="200">
                    <TextField
                      label="reCAPTCHA Site Key"
                      value={recaptchaSiteKey}
                      onChange={setRecaptchaSiteKey}
                      autoComplete="off"
                    />
                    <TextField
                      label="reCAPTCHA Secret Key"
                      value={recaptchaSecretKey}
                      onChange={setRecaptchaSecretKey}
                      type="password"
                      autoComplete="off"
                    />
                  </BlockStack>
                )}

                <Divider />

                <Text variant="headingSm" as="h3">HubSpot Integration</Text>
                <Checkbox
                  label="HubSpot CRM sync (planned)"
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

          {/* Section 3: Customer notifications */}
          <Layout.AnnotatedSection
            id="customer-notifications"
            title="Customer notifications"
            description="Set up email notification templates to inform customers promptly about their registration status and any updates."
          >
            <Card>
              <BlockStack gap="500">
                
                {/* confirmation email templates */}
                <BlockStack gap="200">
                  <Checkbox
                    label="Send Registration Confirmation Email"
                    helpText="Email sent to customers immediately after they submit the registration form."
                    checked={customerConfirmationEmail}
                    onChange={setCustomerConfirmationEmail}
                  />
                  {customerConfirmationEmail && (
                    <BlockStack gap="200">
                      <TextField
                        label="Confirmation Email Subject"
                        value={confirmationEmailSubject}
                        onChange={setConfirmationEmailSubject}
                        autoComplete="off"
                      />
                      <TextField
                        label="Confirmation Email Body"
                        value={confirmationEmailBody}
                        onChange={setConfirmationEmailBody}
                        multiline={3}
                        autoComplete="off"
                      />
                    </BlockStack>
                  )}
                </BlockStack>

                <Divider />

                {/* approval email templates */}
                <BlockStack gap="200">
                  <Checkbox
                    label="Send Account Approved Email"
                    helpText="Email sent to customers when their registration is approved by an administrator."
                    checked={customerApprovalEmail}
                    onChange={setCustomerApprovalEmail}
                  />
                  {customerApprovalEmail && (
                    <BlockStack gap="200">
                      <TextField
                        label="Approval Email Subject"
                        value={approvalEmailSubject}
                        onChange={setApprovalEmailSubject}
                        autoComplete="off"
                      />
                      <TextField
                        label="Approval Email Body"
                        value={approvalEmailBody}
                        onChange={setApprovalEmailBody}
                        multiline={3}
                        autoComplete="off"
                      />
                    </BlockStack>
                  )}
                </BlockStack>

                <Divider />

                {/* rejection email templates */}
                <BlockStack gap="200">
                  <Checkbox
                    label="Send Account Rejected/Declined Email"
                    helpText="Email sent to customers if their registration is rejected."
                    checked={customerRejectionEmail}
                    onChange={setCustomerRejectionEmail}
                  />
                  {customerRejectionEmail && (
                    <BlockStack gap="200">
                      <TextField
                        label="Rejection Email Subject"
                        value={rejectionEmailSubject}
                        onChange={setRejectionEmailSubject}
                        autoComplete="off"
                      />
                      <TextField
                        label="Rejection Email Body"
                        value={rejectionEmailBody}
                        onChange={setRejectionEmailBody}
                        multiline={3}
                        autoComplete="off"
                      />
                    </BlockStack>
                  )}
                </BlockStack>

              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
