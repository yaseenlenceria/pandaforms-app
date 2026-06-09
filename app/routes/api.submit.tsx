import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { sendEmail } from "../email.server";

// Handle CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => {
  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};

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

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  // 1. Parse payload
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  const { formId, fields, uploadedFiles } = body;

  if (!formId || !fields) {
    return json({ error: "Missing formId or fields" }, { status: 400, headers: corsHeaders });
  }

  // 2. Fetch the Form
  const form = await db.form.findUnique({
    where: { id: formId },
    include: { fields: true },
  });

  if (!form) {
    return json({ error: "Form not found" }, { status: 404, headers: corsHeaders });
  }

  const shop = form.shop;

  // 3. Extract primary customer fields (Name, Email, Phone, Company)
  let customerName = "";
  let email = "";
  let phone = "";
  let companyName = "";

  for (const [key, val] of Object.entries(fields)) {
    const lowerKey = key.toLowerCase();
    const strVal = String(val).trim();
    if (lowerKey.includes("first name")) {
      customerName = customerName ? `${strVal} ${customerName}` : strVal;
    } else if (lowerKey.includes("last name")) {
      customerName = customerName ? `${customerName} ${strVal}` : strVal;
    } else if (lowerKey.includes("name") && !customerName) {
      customerName = strVal;
    }

    if (lowerKey.includes("email")) {
      email = strVal;
    }
    if (lowerKey.includes("phone")) {
      phone = strVal;
    }
    if (lowerKey.includes("company")) {
      companyName = strVal;
    }
  }

  // 4. Retrieve settings & evaluate Auto-Approval Rules
  const settings = await db.setting.findUnique({ where: { shop } });
  let isAutoApproved = false;

  if (settings?.autoApprove) {
    isAutoApproved = true;

    // Check Auto-Approve Domain rules (if configured)
    if (settings.autoApproveDomains && email) {
      const allowedDomains = settings.autoApproveDomains
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);
      
      if (allowedDomains.length > 0) {
        const emailDomain = email.split("@")[1]?.toLowerCase();
        const matchesDomain = allowedDomains.some(
          (domain) => emailDomain === domain.replace(/^@/, "")
        );
        if (!matchesDomain) {
          isAutoApproved = false;
        }
      }
    }

    // Check Auto-Approve Wholesale company criteria (if configured)
    if (settings.autoApproveWholesaleIfCompany && form.title.toLowerCase().includes("wholesale")) {
      if (!companyName) {
        isAutoApproved = false;
      }
    }
  }

  const status = isAutoApproved ? "APPROVED" : "PENDING";

  // 5. Save submission to DB FIRST (Critical for reliability)
  const isSync = isSyncForm(form.title);
  const submission = await db.submission.create({
    data: {
      formId,
      customerName,
      email,
      phone,
      status,
      submittedData: JSON.stringify(fields),
      uploadedFiles: uploadedFiles || null,
      shop,
      emailStatus: "PENDING",
      emailLog: "Attempting SMTP transmission...",
      syncStatus: isSync ? (isAutoApproved ? "PENDING" : "N/A") : "SKIPPED",
      syncLog: isSync
        ? (isAutoApproved ? "Awaiting Shopify API sync..." : "Pending manual admin approval review.")
        : "Skipped: Non-registration form template",
    },
  });

  // 6. Handle Outgoing Email Notifications via custom SMTP server
  let emailLogs: string[] = [];
  let emailSuccess = true;

  if (settings) {
    // A. Send Admin Email Notification
    if (settings.adminEmailNotifications && settings.adminEmailAddress) {
      const subject = `New Submission: ${form.title}`;
      let fieldsHtml = "";
      for (const [key, val] of Object.entries(fields)) {
        fieldsHtml += `<p><strong>${key}:</strong> ${val}</p>`;
      }
      if (uploadedFiles) {
        fieldsHtml += `<p><strong>Uploaded Files:</strong> <a href="${uploadedFiles}">${uploadedFiles}</a></p>`;
      }
      const adminHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4f46e5; border-bottom: 1px solid #eee; padding-bottom: 10px;">🐼 New Submission Received</h2>
          <p>You received a new submission on your form: <strong>${form.title}</strong></p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            ${fieldsHtml}
          </div>
          <p>Submission ID: <code style="font-family: monospace; font-size: 12px; background: #eef; padding: 2px 4px; border-radius: 3px;">${submission.id}</code></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #777;">Manage this submission in your PandaForms dashboard.</small>
        </div>
      `;

      const res = await sendEmail({
        shop,
        to: settings.adminEmailAddress,
        subject,
        html: adminHtml,
      });

      emailLogs.push(`Admin notification: ${res.log}`);
      if (!res.success) emailSuccess = false;
    }

    // B. Send Customer Confirmation Email
    if (settings.customerConfirmationEmail && email) {
      const subject = settings.confirmationEmailSubject || "We received your submission!";
      const body = settings.confirmationEmailBody || "Thank you for submitting the form. We are reviewing your application.";
      const customerHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4f46e5; border-bottom: 1px solid #eee; padding-bottom: 10px;">Submission Received</h2>
          <p>Hi ${customerName || "there"},</p>
          <p>${body.replace(/\n/g, "<br/>")}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #777;">Sent via PandaForms.</small>
        </div>
      `;

      const res = await sendEmail({
        shop,
        to: email,
        subject,
        html: customerHtml,
      });

      emailLogs.push(`Customer confirmation: ${res.log}`);
      if (!res.success) emailSuccess = false;
    }
  }

  // Update email delivery logs in DB
  const emailStatusText = emailLogs.length === 0 ? "N/A" : emailSuccess ? "SENT" : "FAILED";
  await db.submission.update({
    where: { id: submission.id },
    data: {
      emailStatus: emailStatusText,
      emailLog: emailLogs.join(" | "),
    },
  });

  // 7. Handle Shopify Customer Sync
  if (isSync && isAutoApproved && email) {
    let syncSuccess = false;
    let syncLogText = "";

    try {
      const { admin } = await unauthenticated.admin(shop);

      const targetTags = ["Approved", "PandaForms"];
      if (settings?.approvedCustomerTag) {
        targetTags.push(settings.approvedCustomerTag);
      }
      if (form.title.toLowerCase().includes("wholesale")) {
        targetTags.push("Wholesale");
        if (settings?.wholesaleCustomerTag) {
          targetTags.push(settings.wholesaleCustomerTag);
        }
      }
      const finalTags = Array.from(new Set(targetTags.map(t => t.trim()))).filter(Boolean);

      // Search if customer already exists in Shopify
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
        {
          variables: {
            query: `email:${email}`,
          },
        }
      );

      const searchJson: any = await searchResponse.json();
      const customerNode = searchJson.data?.customers?.edges?.[0]?.node;

      const firstName = fields["First Name"] || fields["customer_first_name"] || customerName.split(" ")[0] || "";
      const lastName = fields["Last Name"] || fields["customer_last_name"] || customerName.split(" ").slice(1).join(" ") || "Customer";

      // Extra Answers to note
      let fieldsNotes = "";
      for (const [key, val] of Object.entries(fields)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("password") || lowerKey.includes("recaptcha") || lowerKey.includes("g-recaptcha")) {
          continue;
        }
        fieldsNotes += `\n${key}: ${val}`;
      }
      const customerNotes = `Submitted Form: ${form.title}\nSubmitted At: ${submission.createdAt.toISOString()}\n\nAnswers:${fieldsNotes}`;

      // Metafields Extraction
      const metafields = [];
      for (const [key, val] of Object.entries(fields)) {
        const matchedField = form.fields.find(
          (f) => f.label === key || f.name === key
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

      let resultJson: any;

      if (customerNode) {
        // Update tags, note, and metafields
        const existingTags = customerNode.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...finalTags]));

        const updateResponse = await admin.graphql(
          `#graphql
          mutation updateCustomer($input: CustomerInput!) {
            customerUpdate(input: $input) {
              customer {
                id
              }
              userErrors {
                field
                message
              }
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
        resultJson = await updateResponse.json();
        const errors = resultJson.data?.customerUpdate?.userErrors || [];
        if (errors.length > 0) {
          syncSuccess = false;
          syncLogText = `Shopify API Error: ${errors.map((e: any) => e.message).join(", ")}`;
        } else {
          syncSuccess = true;
          syncLogText = `Successfully updated customer tags to ${mergedTags.join(", ")} in Shopify.`;
        }
      } else {
        // Create customer
        const createResponse = await admin.graphql(
          `#graphql
          mutation createCustomer($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              input: {
                firstName,
                lastName,
                email,
                phone: phone || undefined,
                tags: finalTags,
                note: customerNotes,
                metafields: metafields.length > 0 ? metafields : undefined,
              },
            },
          }
        );
        resultJson = await createResponse.json();
        const errors = resultJson.data?.customerCreate?.userErrors || [];
        if (errors.length > 0) {
          syncSuccess = false;
          syncLogText = `Shopify API Error: ${errors.map((e: any) => e.message).join(", ")}`;
        } else {
          syncSuccess = true;
          syncLogText = `Successfully created customer with tags ${finalTags.join(", ")} in Shopify.`;
        }
      }
    } catch (err: any) {
      syncSuccess = false;
      syncLogText = `Shopify Connection Error: ${err.message || err}`;
    }

    // Update sync status in DB
    await db.submission.update({
      where: { id: submission.id },
      data: {
        syncStatus: syncSuccess ? "SUCCESS" : "FAILED",
        syncLog: syncLogText,
      },
    });
  }

  // 8. Return response
  return json(
    {
      success: true,
      submissionId: submission.id,
      status,
    },
    { headers: corsHeaders }
  );
};
