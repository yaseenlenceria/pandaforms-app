import { json } from "@remix-run/node";
import db from "../db.server";

export const loader = async () => {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      SHOPIFY_API_KEY_EXISTS: !!process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET_EXISTS: !!process.env.SHOPIFY_API_SECRET,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
      SCOPES: process.env.SCOPES,
      DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
    },
    databaseConnection: "UNKNOWN",
    tables: {},
    error: null,
  };

  if (process.env.DATABASE_URL) {
    try {
      // Clean up connection string for logging (hide password)
      const url = new URL(process.env.DATABASE_URL);
      if (url.password) {
        url.password = "****";
      }
      report.env.DATABASE_URL_CLEAN = url.toString();
    } catch (e) {
      report.env.DATABASE_URL_CLEAN = "Invalid URL format";
    }
  }

  try {
    // 1. Try simple database query
    console.log("Diagnostics: Connecting to database...");
    await db.$connect();
    report.databaseConnection = "SUCCESSFUL";

    // 2. Check each table
    const tableChecks = [
      { name: "Session", check: () => db.session.count() },
      { name: "Form", check: () => db.form.count() },
      { name: "FormField", check: () => db.formField.count() },
      { name: "Submission", check: () => db.submission.count() },
      { name: "Setting", check: () => db.setting.count() },
    ];

    for (const table of tableChecks) {
      try {
        const count = await table.check();
        report.tables[table.name] = { exists: true, count };
      } catch (err: any) {
        report.tables[table.name] = { exists: false, error: err.message || err };
      }
    }
  } catch (err: any) {
    report.databaseConnection = "FAILED";
    report.error = {
      message: err.message || String(err),
      code: err.code,
      meta: err.meta,
    };
  } finally {
    await db.$disconnect();
  }

  return json(report, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export default function Diagnostics() {
  return null;
}
