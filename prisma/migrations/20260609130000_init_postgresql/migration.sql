-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "successMessage" TEXT DEFAULT 'Thank you for your submission!',
    "redirectUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "theme" TEXT NOT NULL DEFAULT 'minimal',
    "views" INTEGER NOT NULL DEFAULT 0,
    "loginLinkPrefix" TEXT DEFAULT 'Already have an account?',
    "loginLinkLabel" TEXT DEFAULT 'Sign In',
    "loginLinkPosition" TEXT DEFAULT 'After Submit Button',
    "emailExistsMessage" TEXT DEFAULT 'Email Already Taken! Try a different Email or Login',
    "adminNotificationEmails" TEXT,
    "disableCountryOptions" BOOLEAN NOT NULL DEFAULT false,
    "defaultCountryPhoneCode" TEXT DEFAULT '+1',
    "integrationHubSpot" BOOLEAN NOT NULL DEFAULT false,
    "integrationReCAPTCHA" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "formId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "choices" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" TEXT NOT NULL DEFAULT 'full',
    "name" TEXT,
    "requiredMessage" TEXT,
    "metafieldKey" TEXT,
    "isDynamicTag" BOOLEAN NOT NULL DEFAULT false,
    "logicRules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "formId" TEXT NOT NULL,
    "customerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedData" TEXT NOT NULL,
    "uploadedFiles" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shop" TEXT NOT NULL,
    "emailStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "emailLog" TEXT DEFAULT '',
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "syncLog" TEXT DEFAULT '',

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "shop" TEXT NOT NULL,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "approvedCustomerTag" TEXT NOT NULL DEFAULT 'approved',
    "wholesaleCustomerTag" TEXT NOT NULL DEFAULT 'wholesale',
    "adminEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "adminEmailAddress" TEXT,
    "smtpHost" TEXT DEFAULT '',
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUser" TEXT DEFAULT '',
    "smtpPass" TEXT DEFAULT '',
    "smtpFrom" TEXT DEFAULT '',
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveDomains" TEXT,
    "autoApproveWholesaleIfCompany" BOOLEAN NOT NULL DEFAULT false,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_shop_key" ON "Setting"("shop");

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
