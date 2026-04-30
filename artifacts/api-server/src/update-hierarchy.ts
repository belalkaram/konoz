import { db, employeesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

async function run() {
  console.log("Updating Sara to Supervisor...");
  await db.update(employeesTable)
    .set({ role: "Supervisor" })
    .where(eq(employeesTable.username, "sara"));

  const [sara] = await db.select().from(employeesTable).where(eq(employeesTable.username, "sara")).limit(1);
  
  if (sara) {
    console.log(`Sara found with ID: ${sara.id}. Linking Mohamed and Nadia...`);
    await db.update(employeesTable)
      .set({ supervisorId: sara.id })
      .where(inArray(employeesTable.username, ["mohamed", "nadia"]));
    console.log("Hierarchy updated successfully.");
  } else {
    console.log("Sara not found!");
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
