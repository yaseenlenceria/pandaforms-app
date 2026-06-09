import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const forms = await prisma.form.findMany();
    console.log("=== FORMS IN DATABASE ===");
    forms.forEach(f => {
      console.log(`- Title: ${f.title}`);
      console.log(`  ID: ${f.id}`);
      console.log(`  Shop: ${f.shop}`);
      console.log(`  Status: ${f.status}`);
    });
  } catch (err) {
    console.error("Failed to query forms:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
