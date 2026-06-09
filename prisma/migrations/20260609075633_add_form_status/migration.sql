-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "successMessage" TEXT DEFAULT 'Thank you for your submission!',
    "redirectUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "loginLinkPrefix" TEXT DEFAULT 'Already have an account?',
    "loginLinkLabel" TEXT DEFAULT 'Sign In',
    "loginLinkPosition" TEXT DEFAULT 'After Submit Button',
    "emailExistsMessage" TEXT DEFAULT 'Email Already Taken! Try a different Email or Login',
    "adminNotificationEmails" TEXT,
    "disableCountryOptions" BOOLEAN NOT NULL DEFAULT false,
    "defaultCountryPhoneCode" TEXT DEFAULT '+1',
    "integrationHubSpot" BOOLEAN NOT NULL DEFAULT false,
    "integrationReCAPTCHA" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Form" ("adminNotificationEmails", "createdAt", "defaultCountryPhoneCode", "description", "disableCountryOptions", "emailExistsMessage", "id", "integrationHubSpot", "integrationReCAPTCHA", "loginLinkLabel", "loginLinkPosition", "loginLinkPrefix", "redirectUrl", "shop", "successMessage", "title", "updatedAt") SELECT "adminNotificationEmails", "createdAt", "defaultCountryPhoneCode", "description", "disableCountryOptions", "emailExistsMessage", "id", "integrationHubSpot", "integrationReCAPTCHA", "loginLinkLabel", "loginLinkPosition", "loginLinkPrefix", "redirectUrl", "shop", "successMessage", "title", "updatedAt" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
