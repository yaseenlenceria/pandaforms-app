# PandaForms Workflow Guide

Use this guide when working on the PandaForms GitHub repo, Northflank deployment, Shopify app extension, and live Shopify testing.

## Deployment Chain

GitHub `main` -> Northflank automatic build -> live app URL -> Shopify installed app and storefront.

Do not push until the user says `push to github`.

## Links

- GitHub: https://github.com/yaseenlenceria/pandaforms-app
- Northflank builds: https://app.northflank.com/t/seenu92s-team/project/pandaform/services/pandaforms-app/builds
- Shopify API health: https://dev.shopify.com/dashboard/130056835/apps/379465400321/monitoring/api_health
- Live app URL: https://p01--pandaforms-app--77wd8gj6rv7k.code.run

## Code Workflow

1. Work locally in the repo.
2. Keep changes scoped to the requested issue.
3. Run build or lint checks when possible.
4. Review `git diff`.
5. Commit only after the user asks.
6. Push only after the user says `push to github`.

## Shopify Extension Workflow

When `extensions/pandaforms-widget` changes, publish the extension to Shopify with:

```powershell
pnpm run deploy -- --allow-updates
```

Use this after code is ready and the user wants the extension update published.

## Styling Workflow

Widget Styling Settings in the app are the master styling source.

The storefront widget and Shopify Theme Editor block must render from the saved `customStyles` JSON returned by the form config API.

Presets should populate all color, layout, shadow, spacing, border, and button settings. Color pickers are only advanced overrides.

## Preset Test Flow

1. Open a form in PandaForms admin.
2. Click a preset.
3. Confirm the live preview changes instantly.
4. Save the form.
5. Test the storefront widget.
6. Confirm the Theme Editor widget shows the same styling.

## Troubleshooting Form Load

If the storefront shows `PandaForms: Form could not load`, check the Form ID first, then confirm Northflank deployed and the live app URL is reachable.
