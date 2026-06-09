import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>PandaForms for Shopify</h1>
        <p className={styles.text}>
          Create storefront forms, collect submissions, and manage customer approval workflows from Shopify admin.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Form builder</strong>. Build wholesale, registration, contact, enquiry, appointment, and return request forms.
          </li>
          <li>
            <strong>Submissions inbox</strong>. Review, approve, reject, export, and track every storefront submission.
          </li>
          <li>
            <strong>Customer sync</strong>. Create or update Shopify customers after merchant approval.
          </li>
        </ul>
      </div>
    </div>
  );
}
