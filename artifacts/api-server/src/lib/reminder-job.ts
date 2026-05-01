import { db, ticketsTable, employeesTable, customersTable } from "@workspace/db";
import { eq, and, lte, gte, isNull } from "drizzle-orm";
import { sendTripReminderNotification } from "./email.js";
import { logger } from "./logger.js";

export async function runReminderJob() {
  try {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Define a window for "exactly 24 hours" - e.g., 23.5 to 24.5 hours from now
    // This allows the job to run every hour and catch everyone.
    const startTime = new Date(twentyFourHoursFromNow.getTime() - 30 * 60 * 1000);
    const endTime = new Date(twentyFourHoursFromNow.getTime() + 30 * 60 * 1000);

    const pendingTickets = await db
      .select({
        ticket: ticketsTable,
        employeeEmail: employeesTable.email,
        customerName: customersTable.fullName,
      })
      .from(ticketsTable)
      .innerJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .innerJoin(employeesTable, eq(ticketsTable.employeeId, employeesTable.id))
      .where(
        and(
          gte(ticketsTable.departureDatetime, startTime),
          lte(ticketsTable.departureDatetime, endTime),
          eq(ticketsTable.reminderSent24h, false)
        )
      );

    for (const item of pendingTickets) {
      if (item.employeeEmail) {
        try {
          await sendTripReminderNotification(
            item.employeeEmail,
            item.customerName,
            item.ticket.departureDatetime!.toISOString()
          );
          
          await db
            .update(ticketsTable)
            .set({ reminderSent24h: true })
            .where(eq(ticketsTable.id, item.ticket.id));
            
          logger.info({ msg: "Sent 24h reminder", ticketId: item.ticket.id, to: item.employeeEmail });
        } catch (err) {
          logger.error({ msg: "Failed to send 24h reminder", ticketId: item.ticket.id, error: err });
        }
      }
    }
  } catch (err) {
    logger.error({ msg: "Error in reminder job", error: err });
  }
}

// Start the background job
export function startReminderCron() {
  // Run every 15 minutes to be safe and catch all windows
  setInterval(runReminderJob, 15 * 60 * 1000);
  // Also run once on startup
  runReminderJob();
}
