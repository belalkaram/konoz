import { db, whatsappCampaignsTable, whatsappCampaignRecipientsTable } from "./src/index.js";
import { inArray } from "drizzle-orm";

async function run() {
  const campaigns = await db.select().from(whatsappCampaignsTable).where(inArray(whatsappCampaignsTable.employeeId, [1, 7]));
  console.log("Campaigns:", JSON.stringify(campaigns, null, 2));

  if (campaigns.length > 0) {
    const recipients = await db.select().from(whatsappCampaignRecipientsTable).where(inArray(whatsappCampaignRecipientsTable.campaignId, campaigns.map(c => c.id)));
    console.log("Recipients:", JSON.stringify(recipients.slice(0, 10), null, 2));
  }
  
  process.exit(0);
}

run().catch(console.error);
