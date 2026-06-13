import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  Modal,
  Box,
  TextField,
  Divider,
  Select,
  useIndexResourceState,
  InlineGrid,
} from "@shopify/polaris";
import { ExportIcon, RefreshIcon, EmailIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendEmail } from "../email.server";
import { escapeHtml, escapeHtmlWithLineBreaks } from "../utils/html";

function isSyncForm(formTitle: string): boolean {
  const title = formTitle.toLowerCase();
  return (
    title.includes("wholesale") ||
    title.includes("registration") ||
    title.includes("b2b") ||
    title.includes("dealer") ||
    title.includes("account") ||
    title.includes("application")
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const formId = url.searchParams.get("formId") || undefined;
  const statusFilter = url.searchParams.get("status") || undefined;

  const submissions = await db.submission.findMany({
    where: {
      shop,
      ...(formId ? { formId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      form: {
        select: { title: true },
      },
    },
  });

  const forms = await db.form.findMany({
    where: { shop },
    select: { id: true, title: true },
  });

  // Calculate Submissions Status Stats
  const totalSubmissions = await db.submission.count({ where: { shop } });
  const pendingSubmissions = await db.submission.count({ where: { shop, status: "PENDING" } });
  const approvedSubmissions = await db.submission.count({ where: { shop, status: "APPROVED" } });
  const rejectedSubmissions = await db.submission.count({ where: { shop, status: "REJECTED" } });

  // Get SMTP Settings config
  const settings = await db.setting.findUnique({ where: { shop } });
  const smtpConfigured = !!(settings?.smtpHost && settings?.smtpUser);

  return json({
    submissions,
    forms,
    formId,
    statusFilter,
    smtpConfigured,
    stats: {
      total: totalSubmissions,
      pending: pendingSubmissions,
      approved: approvedSubmissions,
      rejected: rejectedSubmissions
    },
    shop
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const submissionId = formData.get("submissionId") as string;
  const submissionIdsStr = formData.get("submissionIds") as string; // For bulk actions
  const statusAction = formData.get("statusAction") as string; // APPROVE, REJECT, RETRY_SYNC, RESEND_EMAIL, BULK_APPROVE, BULK_REJECT
  const notes = formData.get("notes") as string;

  if (!statusAction) {
    return json({ error: "Missing required statusAction" }, { status: 400 });
  }

  const settings = await db.setting.findUnique({ where: { shop } });

  // helper function to process Shopify Sync for a single submission
  const syncSubmissionToShopify = async (sub: any) => {
    if (!sub.email) return { success: false, log: "No email address found in submission fields." };

    if (!isSyncForm(sub.form.title)) {
      return { success: true, skipped: true, log: "Skipped: Non-registration form template" };
    }

    try {
      const targetTags = ["Approved", "PandaForms"];
      if (settings?.approvedCustomerTag) {
        targetTags.push(settings.approvedCustomerTag);
      }
      if (sub.form.title.toLowerCase().includes("wholesale")) {
        targetTags.push("Wholesale");
        if (settings?.wholesaleCustomerTag) {
          targetTags.push(settings.wholesaleCustomerTag);
        }
      }
      const finalTags = Array.from(new Set(targetTags.map(t => t.trim()))).filter(Boolean);

      // Search customer
      const searchResponse = await admin.graphql(
        `#graphql
        query findCustomer($query: String!) {
          customers(first: 1, query: $query) {
            edges {
              node {
                id
                tags
              }
            }
          }
        }`,
        { variables: { query: `email:${sub.email}` } }
      );
      const searchJson: any = await searchResponse.json();
      const customerNode = searchJson.data?.customers?.edges?.[0]?.node;

      // Extract details
      let parsedData: Record<string, any> = {};
      try {
        parsedData = JSON.parse(sub.submittedData);
      } catch (e) {}

      const firstName = parsedData["First Name"] || parsedData["customer_first_name"] || sub.customerName?.split(" ")[0] || "";
      const lastName = parsedData["Last Name"] || parsedData["customer_last_name"] || sub.customerName?.split(" ").slice(1).join(" ") || "Customer";
      const phone = sub.phone || parsedData["Phone"] || parsedData["customer_phone"] || undefined;

      // Extra Answers to note
      let fieldsNotes = "";
      for (const [key, val] of Object.entries(parsedData)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("password") || lowerKey.includes("recaptcha") || lowerKey.includes("g-recaptcha")) {
          continue;
        }
        fieldsNotes += `\n${key}: ${val}`;
      }
      const customerNotes = `Submitted Form: ${sub.form.title}\nSubmitted At: ${sub.createdAt.toISOString()}${notes ? `\nAdmin Notes: ${notes}` : ""}\n\nAnswers:${fieldsNotes}`;

      // Metafields Extraction
      const metafields = [];
      const fieldsList = sub.form.fields || [];
      for (const [key, val] of Object.entries(parsedData)) {
        const matchedField = fieldsList.find(
          (f: any) => f.label === key || f.name === key
        );
        if (matchedField?.metafieldKey && val) {
          metafields.push({
            namespace: "pandaforms",
            key: matchedField.metafieldKey,
            value: String(val).trim(),
            type: "single_line_text_field",
          });
        }
      }

      if (customerNode) {
        const existingTags = customerNode.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...finalTags]));
        const updateResponse = await admin.graphql(
          `#graphql
          mutation updateCustomer($input: CustomerInput!) {
            customerUpdate(input: $input) {
              customer { id }
              userErrors { message }
            }
          }`,
          {
            variables: {
              input: {
                id: customerNode.id,
                tags: mergedTags,
                note: customerNotes,
                metafields: metafields.length > 0 ? metafields : undefined,
              },
            },
          }
        );
        const resJson: any = await updateResponse.json();
        const errors = resJson.data?.customerUpdate?.userErrors || [];
        if (errors.length > 0) {
          return { success: false, log: `Shopify Update Error: ${errors.map((e: any) => e.message).join(", ")}` };
        }
        return { success: true, log: `Successfully updated customer tags to ${mergedTags.join(", ")} in Shopify.` };
      } else {
        const createResponse = await admin.graphql(
          `#graphql
          mutation createCustomer($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer { id }
              userErrors { message }
            }
          }`,
          {
            variables: {
              input: {
                firstName,
                lastName,
                email: sub.email,
                phone,
                tags: finalTags,
                note: customerNotes,
                metafields: metafields.length > 0 ? metafields : undefined,
              },
            },
          }
        );
        const resJson: any = await createResponse.json();
        const errors = resJson.data?.customerCreate?.userErrors || [];
        if (errors.length > 0) {
          return { success: false, log: `Shopify Create Error: ${errors.map((e: any) => e.message).join(", ")}` };
        }
        return { success: true, log: `Successfully created customer with tags ${finalTags.join(", ")} in Shopify.` };
      }
    } catch (err: any) {
      return { success: false, log: `Connection Error: ${err.message || err}` };
    }
  };

  // 1. Single Resend Outgoing SMTP Email
  if (statusAction === "RESEND_EMAIL" && submissionId) {
    const sub = await db.submission.findFirst({
      where: { id: submissionId, shop },
      include: { form: true },
    });
    if (!sub) return json({ error: "Submission not found" }, { status: 404 });

    const subject = `PandaForms Resend Notification: ${sub.form.title}`;
    let fieldsHtml = "";
    try {
      const data = JSON.parse(sub.submittedData);
      for (const [key, val] of Object.entries(data)) {
        fieldsHtml += `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</p>`;
      }
    } catch(e) {
      fieldsHtml = `<p>${escapeHtml(sub.submittedData)}</p>`;
    }

    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #4f46e5; border-bottom: 1px solid #eee; padding-bottom: 10px;">Form Submission Details (Resend)</h2>
        <p>Form: <strong>${escapeHtml(sub.form.title)}</strong></p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
          ${fieldsHtml}
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <small style="color: #777;">Sent via PandaForms SMTP server.</small>
      </div>
    `;

    const emailRes = await sendEmail({
      shop,
      to: settings?.adminEmailAddress || sub.email || "",
      subject,
      html: emailHtml,
    });

    await db.submission.update({
      where: { id: submissionId },
      data: {
        emailStatus: emailRes.success ? "SENT" : "FAILED",
        emailLog: `Resent on ${new Date().toLocaleString()} : ${emailRes.log}`,
      },
    });

    return json({ success: true, message: `Email resent. Status: ${emailRes.log}` });
  }

  // 2. Single Retry Shopify Customer Sync
  if (statusAction === "RETRY_SYNC" && submissionId) {
    const sub = await db.submission.findFirst({
      where: { id: submissionId, shop },
      include: {
        form: {
          include: { fields: true }
        }
      },
    });
    if (!sub) return json({ error: "Submission not found" }, { status: 404 });

    const syncRes = await syncSubmissionToShopify(sub);
    await db.submission.update({
      where: { id: submissionId },
      data: {
        syncStatus: syncRes.success ? (syncRes.skipped ? "SKIPPED" : "SUCCESS") : "FAILED",
        syncLog: `Retried on ${new Date().toLocaleString()} : ${syncRes.log}`,
      },
    });

    return json({ success: true, message: `Sync retry executed. Status: ${syncRes.log}` });
  }

  // 3. Single Approve
  if (statusAction === "APPROVE" && submissionId) {
    const sub = await db.submission.findFirst({
      where: { id: submissionId, shop },
      include: {
        form: {
          include: { fields: true }
        }
      },
    });
    if (!sub) return json({ error: "Submission not found" }, { status: 404 });

    // Sync customer
    const syncRes = await syncSubmissionToShopify(sub);

    // Send Account Approved Customer Email
    if (settings?.customerApprovalEmail && sub.email) {
      const subject = settings.approvalEmailSubject || "Your account has been approved!";
      const body = settings.approvalEmailBody || "Congratulations! Your account has been approved. You now have full access.";
      const approvalHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #10b981; border-bottom: 1px solid #eee; padding-bottom: 10px;">Account Approved</h2>
          <p>Hi ${escapeHtml(sub.customerName || "there")},</p>
          <p>${escapeHtmlWithLineBreaks(body)}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #777;">Sent via PandaForms.</small>
        </div>
      `;
      await sendEmail({
        shop,
        to: sub.email,
        subject,
        html: approvalHtml,
      });
    }

    await db.submission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVED",
        notes: notes || sub.notes,
        syncStatus: syncRes.success ? (syncRes.skipped ? "SKIPPED" : "SUCCESS") : "FAILED",
        syncLog: syncRes.log,
      },
    });

    return json({ success: true });
  }

  // 4. Single Reject
  if (statusAction === "REJECT" && submissionId) {
    const sub = await db.submission.findFirst({
      where: { id: submissionId, shop },
      include: { form: true },
    });
    if (!sub) return json({ error: "Submission not found" }, { status: 404 });

    // Send Account Rejected Customer Email
    if (settings?.customerRejectionEmail && sub.email) {
      const subject = settings.rejectionEmailSubject || "Update regarding your application";
      const body = settings.rejectionEmailBody || "Thank you for your interest. Unfortunately, we cannot approve your application at this time.";
      const rejectionHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #ef4444; border-bottom: 1px solid #eee; padding-bottom: 10px;">Update Regarding Application</h2>
          <p>Hi ${escapeHtml(sub.customerName || "there")},</p>
          <p>${escapeHtmlWithLineBreaks(body)}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #777;">Sent via PandaForms.</small>
        </div>
      `;
      await sendEmail({
        shop,
        to: sub.email,
        subject,
        html: rejectionHtml,
      });
    }

    await db.submission.update({
      where: { id: submissionId },
      data: {
        status: "REJECTED",
        notes: notes || sub.notes,
      },
    });

    return json({ success: true });
  }

  // 5. Bulk Actions (Approve / Reject)
  if (submissionIdsStr) {
    const targetIds = submissionIdsStr.split(",").filter((id) => id.trim().length > 0);

    if (statusAction === "BULK_APPROVE") {
      for (const id of targetIds) {
        const sub = await db.submission.findFirst({
          where: { id, shop },
          include: {
            form: {
              include: { fields: true }
            }
          },
        });
        if (sub && sub.status !== "APPROVED") {
          const syncRes = await syncSubmissionToShopify(sub);
          await db.submission.update({
            where: { id },
            data: {
              status: "APPROVED",
              syncStatus: syncRes.success ? (syncRes.skipped ? "SKIPPED" : "SUCCESS") : "FAILED",
              syncLog: `Bulk Sync: ${syncRes.log}`,
            },
          });
        }
      }
      return json({ success: true, message: `Successfully approved & sync'd ${targetIds.length} customer submissions.` });
    }

    if (statusAction === "BULK_REJECT") {
      await db.submission.updateMany({
        where: { id: { in: targetIds }, shop },
        data: { status: "REJECTED" },
      });
      return json({ success: true, message: `Successfully rejected ${targetIds.length} customer submissions.` });
    }
  }

  return json({ error: "Invalid Action" }, { status: 400 });
};

export default function SubmissionsList() {
  const { submissions, forms, formId, statusFilter, smtpConfigured, stats, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isUpdating = navigation.state === "submitting";

  type SubmissionItem = (typeof submissions)[number];
  const [activeSubmission, setActiveSubmission] = useState<SubmissionItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // Polaris Index Table Resource State for Checkbox selection
  const { selectedResources, handleSelectionChange } =
    useIndexResourceState(submissions as any);

  // Trigger Bulk actions
  const handleBulkAction = (actionName: "BULK_APPROVE" | "BULK_REJECT") => {
    if (selectedResources.length === 0) return;
    submit(
      {
        submissionIds: selectedResources.join(","),
        statusAction: actionName,
      },
      { method: "POST" }
    );
    setToastMessage(`Bulk action execution triggered successfully for ${selectedResources.length} forms.`);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 4000);
  };

  const handleResendEmail = (subId: string) => {
    submit({ submissionId: subId, statusAction: "RESEND_EMAIL" }, { method: "POST" });
    setToastMessage("Lead notification resend successfully executed via secure SMTP server!");
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  };

  const handleRetrySync = (subId: string) => {
    submit({ submissionId: subId, statusAction: "RETRY_SYNC" }, { method: "POST" });
    setToastMessage("Shopify Customer tags API sync execution retry triggered!");
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  };

  const handleAction = (subId: string, actionName: "APPROVE" | "REJECT") => {
    submit(
      {
        submissionId: subId,
        statusAction: actionName,
        notes: adminNotes,
      },
      { method: "POST" }
    );
    setModalOpen(false);
  };

  // Client Side CSV Exporter
  const exportToCSV = () => {
    const headers = ["Form Title", "Customer Name", "Email", "Phone", "Approval Status", "Email Delivery", "Shopify Sync Status", "Submitted Date", "Submitted Data"];
    const rows = submissions.map((sub) => {
      let dataText = "";
      try {
        dataText = JSON.stringify(JSON.parse(sub.submittedData));
      } catch (e) {
        dataText = sub.submittedData;
      }
      return [
        sub.form.title,
        sub.customerName || "",
        sub.email || "",
        sub.phone || "",
        sub.status,
        sub.emailStatus,
        sub.syncStatus,
        new Date(sub.createdAt).toLocaleDateString(),
        dataText
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pandaforms_submissions_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage("Submissions log successfully exported to CSV file.");
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge tone="success">Approved</Badge>;
      case "REJECTED":
        return <Badge tone="critical">Rejected</Badge>;
      default:
        return <Badge tone="attention">Pending Review</Badge>;
    }
  };

  const getEmailBadge = (emailStatus: string) => {
    switch (emailStatus) {
      case "SENT":
        return <Badge tone="success">Sent</Badge>;
      case "FAILED":
        return <Badge tone="critical">Delivery Failed</Badge>;
      case "N/A":
        return <Badge tone="subdued">Disabled</Badge>;
      default:
        return <Badge tone="attention">Pending</Badge>;
    }
  };

  const getSyncBadge = (syncStatus: string) => {
    switch (syncStatus) {
      case "SUCCESS":
        return <Badge tone="success">Synced</Badge>;
      case "FAILED":
        return <Badge tone="critical">Sync Failed</Badge>;
      case "SKIPPED":
        return <Badge tone="attention">Skipped</Badge>;
      case "N/A":
        return <Badge tone="subdued">N/A</Badge>;
      default:
        return <Badge tone="attention">Pending</Badge>;
    }
  };

  // Promoted Bulk actions rendered when checkboxes are checked
  const promotedBulkActions = [
    {
      content: "Approve selected",
      onAction: () => handleBulkAction("BULK_APPROVE"),
    },
    {
      content: "Reject selected",
      onAction: () => handleBulkAction("BULK_REJECT"),
      destructive: true,
    },
  ];

  return (
    <Page
      title="Form Submissions"
      subtitle="Review incoming applications, customer profiles, and verify notification delivery status."
      primaryAction={{
        content: "Export to CSV",
        icon: ExportIcon,
        onAction: exportToCSV,
        disabled: submissions.length === 0,
      }}
    >
      
      {toastVisible && (
        <div style={{ marginBottom: "20px" }}>
          <Banner title={toastMessage} tone="success" onDismiss={() => setToastVisible(false)} />
        </div>
      )}

      {/* Aggregate Statistics Cards */}
      <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
        <Card>
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm" tone="subdued">Total Submissions</Text>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" variant="headingLg" fontWeight="bold">{stats?.total || 0}</Text>
              <Badge tone="info">All-time</Badge>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm" tone="subdued">Pending Reviews</Text>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" variant="headingLg" fontWeight="bold">{stats?.pending || 0}</Text>
              <Badge tone="attention">Required</Badge>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm" tone="subdued">Approved Registrations</Text>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" variant="headingLg" fontWeight="bold">{stats?.approved || 0}</Text>
              <Badge tone="success">Synced</Badge>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm" tone="subdued">SMTP Outgoing Mail</Text>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" variant="headingLg" fontWeight="bold">{smtpConfigured ? "Online" : "Offline"}</Text>
              <Badge tone={smtpConfigured ? "success" : "warning"}>
                {smtpConfigured ? "Connected" : "Config Needed"}
              </Badge>
            </InlineStack>
          </BlockStack>
        </Card>
      </InlineGrid>
      <div style={{ marginBottom: "24px" }} />

      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Incoming Submissions Log
                </Text>
                
                {/* Form Filter Dropdown */}
                <div style={{ display: "flex", gap: "10px", minWidth: "300px" }}>
                  <Select
                    label=""
                    labelHidden
                    options={[
                      { label: "All Forms", value: "" },
                      ...forms.map((f) => ({ label: f.title, value: f.id }))
                    ]}
                    value={formId || ""}
                    onChange={(value) => {
                      const params = new URLSearchParams();
                      if (value) params.set("formId", value);
                      if (statusFilter) params.set("status", statusFilter);
                      navigate(params.toString() ? `/app/submissions?${params.toString()}` : "/app/submissions");
                    }}
                  />
                  <Select
                    label=""
                    labelHidden
                    options={[
                      { label: "All Statuses", value: "" },
                      { label: "Pending Review", value: "PENDING" },
                      { label: "Approved", value: "APPROVED" },
                      { label: "Rejected", value: "REJECTED" },
                    ]}
                    value={statusFilter || ""}
                    onChange={(value) => {
                      const params = new URLSearchParams();
                      if (formId) params.set("formId", formId);
                      if (value) params.set("status", value);
                      navigate(params.toString() ? `/app/submissions?${params.toString()}` : "/app/submissions");
                    }}
                  />
                </div>
              </InlineStack>

              {submissions.length === 0 ? (
                <Box padding="400" textAlign="center">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    No submissions found matching the criteria.
                  </Text>
                </Box>
              ) : (
                <IndexTable
                  resourceName={{ singular: "submission", plural: "submissions" }}
                  itemCount={submissions.length}
                  headings={[
                    { title: "Form Name" },
                    { title: "Customer Details" },
                    { title: "Approval Status" },
                    { title: "SMTP Email" },
                    { title: "Shopify Sync" },
                    { title: "Submitted At" },
                    { title: "Actions" },
                  ]}
                  selectedResources={selectedResources}
                  onSelectionChange={handleSelectionChange}
                  promotedBulkActions={promotedBulkActions}
                >
                  {submissions.map((sub, index) => (
                    <IndexTable.Row
                      id={sub.id}
                      key={sub.id}
                      selected={selectedResources.includes(sub.id)}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Text variant="bodyMd" as="strong">
                          {sub.form.title}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <BlockStack gap="050">
                          <Text variant="bodySm" as="strong">{sub.customerName || "N/A"}</Text>
                          <Text variant="bodyXs" tone="subdued">{sub.email || "N/A"}</Text>
                        </BlockStack>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{getStatusBadge(sub.status)}</IndexTable.Cell>
                      <IndexTable.Cell>{getEmailBadge(sub.emailStatus)}</IndexTable.Cell>
                      <IndexTable.Cell>{getSyncBadge(sub.syncStatus)}</IndexTable.Cell>
                      <IndexTable.Cell>{new Date(sub.createdAt).toLocaleDateString()}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Button
                          onClick={() => {
                            setActiveSubmission(sub);
                            setAdminNotes(sub.notes || "");
                            setModalOpen(true);
                          }}
                          size="slim"
                        >
                          Details
                        </Button>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Details & Action Drawer Modal */}
      {activeSubmission && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Submission Detail Log - ${activeSubmission.form.title}`}
          primaryAction={{
            content: isSyncForm(activeSubmission.form.title) ? "Approve & Sync Customer" : "Approve Submission",
            onAction: () => handleAction(activeSubmission.id, "APPROVE"),
            disabled: activeSubmission.status === "APPROVED" || isUpdating,
          }}
          secondaryActions={[
            {
              content: "Reject Application",
              onAction: () => handleAction(activeSubmission.id, "REJECT"),
              destructive: true,
              disabled: activeSubmission.status === "REJECTED" || isUpdating,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {/* Form Data Card */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Submitted Data Fields</Text>
                  <Divider />
                  {Object.entries(
                    (() => {
                      try {
                        return JSON.parse(activeSubmission.submittedData);
                      } catch (e) {
                        return { "Submitted Details": activeSubmission.submittedData };
                      }
                    })()
                  ).map(([key, val]: [string, any]) => (
                    <div key={key} style={{ margin: "6px 0", fontSize: "14px" }}>
                      <strong>{key}:</strong> {String(val ?? "N/A")}
                    </div>
                  ))}
                </BlockStack>
              </Card>

              {/* Uploads Card */}
              {activeSubmission.uploadedFiles && (
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">Uploaded Attachments</Text>
                    <Divider />
                    <a href={activeSubmission.uploadedFiles} target="_blank" rel="noreferrer" style={{ color: "#4f46e5", fontWeight: "bold", textDecoration: "underline" }}>
                      View Uploaded Document / File
                    </a>
                  </BlockStack>
                </Card>
              )}

              {/* SMTP Email health verification log card */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Outgoing SMTP Email Delivery Log</Text>
                  <Divider />
                  <BlockStack gap="100">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" variant="bodyMd">
                        Status: {getEmailBadge(activeSubmission.emailStatus)}
                      </Text>
                      <Button
                        onClick={() => handleResendEmail(activeSubmission.id)}
                        icon={EmailIcon}
                        size="slim"
                        disabled={isUpdating}
                      >
                        Resend Notification Email
                      </Button>
                    </InlineStack>
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #e2e8f0" }}>
                      <strong>Transaction Log:</strong> {activeSubmission.emailLog || "No SMTP notification processed yet."}
                    </div>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Shopify API sync logs verification card */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Shopify Customer Accounts API Sync Log</Text>
                  <Divider />
                  <BlockStack gap="100">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" variant="bodyMd">
                        Status: {getSyncBadge(activeSubmission.syncStatus)}
                      </Text>
                      <InlineStack gap="200">
                        {activeSubmission.syncStatus === "SUCCESS" && activeSubmission.email && (
                          <Button
                            onClick={() => window.open(`https://${shop}/admin/customers?query=${encodeURIComponent(activeSubmission.email || "")}`, "_blank")}
                            size="slim"
                          >
                            View Customer Profile
                          </Button>
                        )}
                        <Button
                          onClick={() => handleRetrySync(activeSubmission.id)}
                          icon={RefreshIcon}
                          size="slim"
                          disabled={isUpdating || !isSyncForm(activeSubmission.form.title)}
                        >
                          Retry Shopify Sync
                        </Button>
                      </InlineStack>
                    </InlineStack>
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #e2e8f0" }}>
                      <strong>Sync Transaction Log:</strong> {activeSubmission.syncLog || "Awaiting admin manual review approval to sync customer profile to Shopify database."}
                    </div>
                  </BlockStack>
                </BlockStack>
              </Card>

              <TextField
                label="Admin/Approval internal Review Notes"
                value={adminNotes}
                onChange={setAdminNotes}
                multiline={3}
                placeholder="Write private notes or explain rejection/approval reasons..."
                autoComplete="off"
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
