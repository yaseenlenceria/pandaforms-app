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
INSERT INTO "new_Form" ("createdAt", "description", "id", "redirectUrl", "shop", "successMessage", "title", "updatedAt") SELECT "createdAt", "description", "id", "redirectUrl", "shop", "successMessage", "title", "updatedAt" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
CREATE TABLE "new_FormField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "choices" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" TEXT NOT NULL DEFAULT 'full',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FormField" ("choices", "createdAt", "formId", "id", "label", "placeholder", "position", "required", "type", "updatedAt") SELECT "choices", "createdAt", "formId", "id", "label", "placeholder", "position", "required", "type", "updatedAt" FROM "FormField";
DROP TABLE "FormField";
ALTER TABLE "new_FormField" RENAME TO "FormField";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
