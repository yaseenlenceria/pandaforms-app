import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  IndexTable,
  Divider,
  Box,
  InlineGrid,
  Button,
} from "@shopify/polaris";
import { ViewIcon, PersonIcon, CalendarIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Get all forms to calculate aggregates
  const forms = await db.form.findMany({
    where: { shop },
    include: {
      _count: {
        select: { submissions: true },
      },
    },
  });

  // Calculate aggregates
  const totalViews = forms.reduce((sum, f) => sum + f.views, 0);
  const totalSubmissions = forms.reduce((sum, f) => sum + f._count.submissions, 0);
  const averageConversionRate =
    totalViews > 0 ? ((totalSubmissions / totalViews) * 100).toFixed(1) : "0.0";

  // 2. Rank top performing forms by conversion rate
  const formsPerformance = forms.map((f) => {
    const subsCount = f._count.submissions;
    const viewsCount = f.views;
    const rate = viewsCount > 0 ? ((subsCount / viewsCount) * 100).toFixed(1) : "0.0";
    return {
      id: f.id,
      title: f.title,
      views: viewsCount,
      submissions: subsCount,
      conversionRate: parseFloat(rate),
      status: f.status,
    };
  });

  // Sort by conversion rate desc, then submissions desc
  formsPerformance.sort((a, b) => b.conversionRate - a.conversionRate || b.submissions - a.submissions);
  const topForms = formsPerformance.slice(0, 5);

  // 3. Get recent submissions for activity audit
  const recentSubmissions = await db.submission.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      form: {
        select: { title: true },
      },
    },
  });

  return json({
    totalViews,
    totalSubmissions,
    averageConversionRate,
    topForms,
    recentSubmissions,
  });
};

export default function Analytics() {
  const {
    totalViews,
    totalSubmissions,
    averageConversionRate,
    topForms,
    recentSubmissions,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page
      title="Form Analytics"
      subtitle="Analyze storefront views, submissions, and conversion funnel performance across all custom forms."
    >
      <BlockStack gap="500">
        
        {/* Aggregate Cards */}
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <Card>
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">Storefront Form Views</Text>
              <Text variant="headingLg" as="p" fontWeight="bold">{totalViews}</Text>
              <Text variant="bodyXs" tone="subdued">All views captured by storefront widgets.</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">Total Submissions</Text>
              <Text variant="headingLg" as="p" fontWeight="bold">{totalSubmissions}</Text>
              <Text variant="bodyXs" tone="subdued">Completed form submissions recorded.</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">Avg. Conversion Rate</Text>
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingLg" as="p" fontWeight="bold">{averageConversionRate}%</Text>
                <Badge tone={parseFloat(averageConversionRate) > 10 ? "success" : "attention"}>
                  {parseFloat(averageConversionRate) > 10 ? "High Performance" : "Optimize Forms"}
                </Badge>
              </InlineStack>
              <Text variant="bodyXs" tone="subdued">Percentage of views that turn into submissions.</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          
          {/* Top Performing Forms */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Top Performing Forms</Text>
                <Divider />
                {topForms.length === 0 ? (
                  <Box padding="400" textAlign="center">
                    <Text variant="bodyMd" as="p" tone="subdued">Create forms and receive submissions to view performance metrics.</Text>
                  </Box>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "form", plural: "forms" }}
                    itemCount={topForms.length}
                    headings={[
                      { title: "Form Title" },
                      { title: "Views" },
                      { title: "Submissions" },
                      { title: "Conversion Rate" },
                      { title: "Status" },
                      { title: "Action" },
                    ]}
                    selectable={false}
                  >
                    {topForms.map((item, index) => (
                      <IndexTable.Row id={item.id} key={item.id} position={index}>
                        <IndexTable.Cell>
                          <Text variant="bodyMd" as="strong">{item.title}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>{item.views}</IndexTable.Cell>
                        <IndexTable.Cell>{item.submissions}</IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text variant="bodyMd" as="span" tone={item.conversionRate > 10 ? "success" : "subdued"}>
                            <strong>{item.conversionRate}%</strong>
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={item.status === "ACTIVE" ? "success" : item.status === "DRAFT" ? "attention" : "subdued"}>
                            {item.status}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Button size="slim" onClick={() => navigate(`/app/forms/${item.id}`)}>
                            Edit Form
                          </Button>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Recent Submissions Feed */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Recent Submissions Funnel</Text>
                <Divider />
                {recentSubmissions.length === 0 ? (
                  <Box padding="400" textAlign="center">
                    <Text variant="bodyMd" as="p" tone="subdued">No recent submission activity recorded.</Text>
                  </Box>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {recentSubmissions.map((sub) => (
                      <div key={sub.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <div style={{ marginTop: "4px" }}>
                          <span style={{ display: "flex", width: "16px", height: "16px" }}>
                            <Badge tone={sub.status === "APPROVED" ? "success" : sub.status === "REJECTED" ? "critical" : "attention"}>
                              {sub.status === "APPROVED" ? "✓" : sub.status === "REJECTED" ? "✗" : "•"}
                            </Badge>
                          </span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Text variant="bodySm" as="strong" fontWeight="bold">
                            {sub.customerName || sub.email || "Anonymous User"}
                          </Text>
                          <Text variant="bodyXs" tone="subdued">
                            Form: {sub.form.title}
                          </Text>
                          <Text variant="bodyXs" tone="subdued">
                            {new Date(sub.createdAt).toLocaleDateString()} at {new Date(sub.createdAt).toLocaleTimeString()}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

        </Layout>
      </BlockStack>
    </Page>
  );
}
