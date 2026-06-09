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
    "theme" TEXT NOT NULL DEFAULT 'minimal',
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
INSERT INTO "new_Form" ("adminNotificationEmails", "createdAt", "defaultCountryPhoneCode", "description", "disableCountryOptions", "emailExistsMessage", "id", "integrationHubSpot", "integrationReCAPTCHA", "loginLinkLabel", "loginLinkPosition", "loginLinkPrefix", "redirectUrl", "shop", "status", "successMessage", "title", "updatedAt") SELECT "adminNotificationEmails", "createdAt", "defaultCountryPhoneCode", "description", "disableCountryOptions", "emailExistsMessage", "id", "integrationHubSpot", "integrationReCAPTCHA", "loginLinkLabel", "loginLinkPosition", "loginLinkPrefix", "redirectUrl", "shop", "status", "successMessage", "title", "updatedAt" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "approvedCustomerTag" TEXT NOT NULL DEFAULT 'approved',
    "wholesaleCustomerTag" TEXT NOT NULL DEFAULT 'wholesale',
    "adminEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "adminEmailAddress" TEXT,
    "enableReCAPTCHA" BOOLEAN NOT NULL DEFAULT false,
    "recaptchaSiteKey" TEXT DEFAULT '',
    "recaptchaSecretKey" TEXT DEFAULT '',
    "enableHubSpot" BOOLEAN NOT NULL DEFAULT false,
    "hubspotApiKey" TEXT DEFAULT '',
    "saveToCustomerNotes" BOOLEAN NOT NULL DEFAULT true,
    "customerConfirmationEmail" BOOLEAN NOT NULL DEFAULT true,
    "customerApprovalEmail" BOOLEAN NOT NULL DEFAULT true,
    "customerRejectionEmail" BOOLEAN NOT NULL DEFAULT true,
    "confirmationEmailSubject" TEXT DEFAULT 'We received your submission!',
    "confirmationEmailBody" TEXT DEFAULT 'Thank you for submitting the form. We are reviewing your application.',
    "approvalEmailSubject" TEXT DEFAULT 'Your account has been approved!',
    "approvalEmailBody" TEXT DEFAULT 'Congratulations! Your account has been approved. You now have full access.',
    "rejectionEmailSubject" TEXT DEFAULT 'Update regarding your application',
    "rejectionEmailBody" TEXT DEFAULT 'Thank you for your interest. Unfortunately, we cannot approve your application at this time.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Setting" ("adminEmailAddress", "adminEmailNotifications", "approvedCustomerTag", "autoApprove", "createdAt", "id", "shop", "updatedAt", "wholesaleCustomerTag") SELECT "adminEmailAddress", "adminEmailNotifications", "approvedCustomerTag", "autoApprove", "createdAt", "id", "shop", "updatedAt", "wholesaleCustomerTag" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE UNIQUE INDEX "Setting_shop_key" ON "Setting"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
