-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "name" TEXT,
    "requiredMessage" TEXT,
    "metafieldKey" TEXT,
    "isDynamicTag" BOOLEAN NOT NULL DEFAULT false,
    "logicRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FormField" ("choices", "createdAt", "formId", "id", "label", "placeholder", "position", "required", "type", "updatedAt", "width") SELECT "choices", "createdAt", "formId", "id", "label", "placeholder", "position", "required", "type", "updatedAt", "width" FROM "FormField";
DROP TABLE "FormField";
ALTER TABLE "new_FormField" RENAME TO "FormField";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
