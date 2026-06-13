# PandaForms Live Development Workflow

This repo is the live PandaForms Shopify app. Code is hosted on GitHub, Northflank deploys from GitHub, and final testing happens inside the installed Shopify app and storefront.

## Rule For Deploying

Do not push changes until the user says: `push to github`.

When code is pushed to `main`, Northflank automatically builds and deploys the app. After that, test in Shopify.

## Main Links

- GitHub repo: https://github.com/yaseenlenceria/pandaforms-app
- Northflank builds: https://app.northflank.com/t/seenu92s-team/project/pandaform/services/pandaforms-app/builds
- Shopify API health: https://dev.shopify.com/dashboard/130056835/apps/379465400321/monitoring/api_health
- Live app URL: https://p01--pandaforms-app--77wd8gj6rv7k.code.run

## Normal Work Loop

1. Pull or clone the GitHub repo.
2. Make focused code changes.
3. Run local validation when possible.
4. Show the changed files and summary.
5. Wait for the user to say `push to github`.
6. Push to `main`.
7. Watch the Northflank build.
8. Test the live Shopify installed app and storefront.

## Shopify Extension Deploy

Some changes under `extensions/` also need a Shopify CLI app deploy so the app extension version is published to Shopify.

Use:

```powershell
pnpm run deploy -- --allow-updates
```

Only run this when extension files changed and the user wants the Shopify extension published.

## Widget Styling Rule

Widget Styling Settings inside PandaForms are the master styling system.

Priority:

1. Selected preset in PandaForms admin.
2. Custom color/layout overrides in PandaForms admin.
3. Storefront widget rendering.

The Shopify Theme Editor block should stay simple:

- Form ID
- App URL
- Use PandaForms app styling
- Top and bottom spacing
- Optional width override

Theme Editor color controls should not be added because they create a second styling system.

## Testing Checklist

- Pick each preset: Shopify Default, Minimal, Modern, Premium, Dark Mode.
- Confirm Live Storefront Form Preview updates immediately.
- Save the form.
- Confirm `customStyles` is returned by `/api/form-config?id=<FORM_ID>`.
- Confirm storefront widget matches the saved preview.
- Confirm Theme Editor block does not expose conflicting color controls.
- Confirm submit still posts successfully.

## Common Live Error

`PandaForms: Form could not load. Please check Form ID and app URL.`

Check:

- The Form ID exactly matches a saved form.
- The live app URL is correct.
- Northflank deployed successfully.
- Shopify app proxy routes `/apps/pandaforms/form-config` and `/apps/pandaforms/submit` are working.
- Direct fallback routes `/api/form-config` and `/api/submit` are reachable from the storefront.
