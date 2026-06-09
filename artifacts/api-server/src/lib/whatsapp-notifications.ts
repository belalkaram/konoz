import { db, systemSettingsTable, ticketsTable, customersTable, employeesTable } from "@workspace/db";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { WhatsappService } from "./whatsapp.js";
import { logger } from "./logger.js";

export async function sendWhatsAppNotification(
  type: "customer" | "ticket",
  data: {
    customerId?: number;
    ticketId?: number;
    rawCustomer?: any;
    rawTicket?: any;
    rawBody?: any;
  }
) {
  try {
    // 1. Fetch settings from DB
    const settingsRows = await db
      .select()
      .from(systemSettingsTable);

    const settings: Record<string, string> = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const enabledCustomer = settings["whatsapp_notification_enabled_customer"] === "true";
    const enabledTicket = settings["whatsapp_notification_enabled_ticket"] === "true";
    const recipientType = settings["whatsapp_notification_recipient_type"] || "main";
    const customNumber = settings["whatsapp_notification_custom_number"] || "";
    const monthlyTarget = parseFloat(settings["whatsapp_monthly_profit_target"] || "0");

    // Check if enabled for this type
    if (type === "customer" && !enabledCustomer) return;
    if (type === "ticket" && !enabledTicket) return;

    // 2. Determine main instance name
    const mainInstanceName = settings["MAIN_WHATSAPP_INSTANCE_NAME"];
    if (!mainInstanceName) {
      logger.warn("WhatsApp notification skipped: MAIN_WHATSAPP_INSTANCE_NAME is not set");
      return;
    }

    // 3. Determine recipient phone number
    let recipientPhone = "";
    if (recipientType === "custom") {
      recipientPhone = customNumber.replace(/[^0-9]/g, "");
    } else {
      // Find main instance owner number from Evolution API
      try {
        const instances = await WhatsappService.getInstances();
        const mainInstance = instances?.find((inst: any) => inst.name === mainInstanceName);
        if (mainInstance?.ownerJid) {
          recipientPhone = mainInstance.ownerJid.split("@")[0];
        }
      } catch (err) {
        logger.error({ err }, "Failed to fetch instances from Evolution API to get main instance phone number");
      }
    }

    if (!recipientPhone) {
      logger.warn("WhatsApp notification skipped: No valid recipient phone number found");
      return;
    }

    // 4. Fetch details depending on the type
    let customerName = "";
    let customerPhone = "";
    let customerWhatsapp = "";
    let customerEmail = "";
    let customerNationality = "";
    let customerPassportNumber = "";
    let customerSource = "";
    let customerStatus = "";
    let employeeName = "غير محدد";

    let hasProfit = false;
    let currentProfit = 0;

    let customerId = data.customerId;
    let ticketId = data.ticketId;

    let customerRow = data.rawCustomer;
    let ticketRow = data.rawTicket;

    if (type === "customer") {
      if (!customerRow && customerId) {
        [customerRow] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
      }
      if (customerRow) {
        customerName = customerRow.fullName || "";
        customerPhone = customerRow.phone || "";
        customerWhatsapp = customerRow.whatsapp || "";
        customerEmail = customerRow.email || "";
        customerNationality = customerRow.nationality || "";
        customerPassportNumber = customerRow.passportNumber || "";
        customerSource = customerRow.source || "";
        customerStatus = customerRow.status || "";

        if (customerRow.assignedEmployeeId) {
          const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, customerRow.assignedEmployeeId)).limit(1);
          if (emp) employeeName = emp.name;
        }
      }

      // Check if a ticket was also created in this transaction (e.g. from POST /customers body)
      const { ticketPrice, costPrice, pnr, travelDate } = data.rawBody || {};
      if (ticketPrice || costPrice || pnr || travelDate) {
        const costVal = parseFloat(costPrice || "0");
        const priceVal = parseFloat(ticketPrice || "0");
        currentProfit = priceVal - costVal;
        if (currentProfit > 0) {
          hasProfit = true;
        }
      }
    } else if (type === "ticket") {
      if (!ticketRow && ticketId) {
        [ticketRow] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
      }
      if (ticketRow) {
        customerId = ticketRow.customerId;
        const costVal = parseFloat(ticketRow.costPrice || "0");
        const priceVal = parseFloat(ticketRow.price || "0");
        currentProfit = priceVal - costVal;
        if (currentProfit > 0) {
          hasProfit = true;
        }

        if (ticketRow.employeeId) {
          const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, ticketRow.employeeId)).limit(1);
          if (emp) employeeName = emp.name;
        }
      }

      if (customerId) {
        [customerRow] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
        if (customerRow) {
          customerName = customerRow.fullName || "";
          customerPhone = customerRow.phone || "";
        }
      }
    }

    // 5. Calculate monthly target metrics if there is profit
    let targetSection = "";
    if (hasProfit && monthlyTarget > 0) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Sum profit of active tickets in the current month (status not cancelled or refunded)
      const activeStatuses = ["quoted", "reserved", "confirmed", "paid", "issued"];
      const conditions = [
        gte(ticketsTable.createdAt, startOfMonth),
        lte(ticketsTable.createdAt, endOfMonth),
        inArray(ticketsTable.ticketStatus, activeStatuses as any)
      ];

      // Exclude current ticket from the DB sum to avoid double counting if it's already in DB
      if (ticketId) {
        conditions.push(sql`${ticketsTable.id} != ${ticketId}`);
      }

      const [profitSumResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(COALESCE(${ticketsTable.price}, 0) - COALESCE(${ticketsTable.costPrice}, 0)), 0)::text` })
        .from(ticketsTable)
        .where(and(...conditions));

      const previousProfit = parseFloat(profitSumResult?.total || "0");
      const totalAchieved = previousProfit + currentProfit;
      const achievedPercentage = ((totalAchieved / monthlyTarget) * 100).toFixed(1);
      const remainingTarget = Math.max(0, monthlyTarget - totalAchieved).toFixed(2);

      targetSection = `
📊 *متابعة التارجت الشهري:*
- التارجت المستهدف: ${monthlyTarget} د.ك
- إجمالي المحقق هذا الشهر: ${totalAchieved.toFixed(2)} د.ك
- النسبة المحققة: ${achievedPercentage}%
- المتبقي للوصول للتارجت: ${remainingTarget} د.ك`;
    }

    // 6. Build Message body
    let messageText = "";
    const currentDateTimeStr = new Date().toLocaleString("ar-KW", { timeZone: "Asia/Kuwait" });

    if (type === "customer") {
      messageText = `👤 *عميل جديد تم إضافته* 👤

- الاسم: ${customerName}
- الهاتف: ${customerPhone}
- الواتساب: ${customerWhatsapp || "-"}
- البريد الإلكتروني: ${customerEmail || "-"}
- الجنسية: ${customerNationality || "-"}
- رقم الجواز: ${customerPassportNumber || "-"}
- المصدر: ${customerSource || "-"}
- الحالة: ${customerStatus || "-"}

💼 *الموظف المسؤول:* ${employeeName}
📅 *الوقت والتاريخ:* ${currentDateTimeStr}
`;
    } else {
      const flightRoute = ticketRow?.flightRoute || "-";
      const airline = ticketRow?.airline || "-";
      const flightNumber = ticketRow?.flightNumber || "-";
      const pnr = ticketRow?.pnr || "-";
      const departureDatetime = ticketRow?.departureDatetime
        ? new Date(ticketRow.departureDatetime).toLocaleString("ar-KW", { timeZone: "Asia/Kuwait" })
        : "-";
      const ticketStatus = ticketRow?.ticketStatus || "-";
      const price = ticketRow?.price || "0";
      const costPrice = ticketRow?.costPrice || "0";

      messageText = `🎫 *تذكرة جديدة تم إضافتها* 🎫

👤 *العميل:* ${customerName} (${customerPhone || "-"})

✈️ *تفاصيل الرحلة:*
- مسار الرحلة: ${flightRoute}
- الخطوط الجوية: ${airline}
- رقم الرحلة: ${flightNumber}
- PNR: ${pnr}
- تاريخ السفر: ${departureDatetime}
- تكلفة التذكرة: ${costPrice} KWD
- سعر البيع: ${price} KWD
- الربح الحالي: ${currentProfit.toFixed(2)} KWD
- الحالة: ${ticketStatus}

💼 *الموظف المسؤول:* ${employeeName}
📅 *الوقت والتاريخ:* ${currentDateTimeStr}
`;
    }

    // Append target section if we have one
    if (targetSection) {
      messageText += targetSection;
    }

    // 7. Send the message via main WhatsApp instance
    logger.info({ mainInstanceName, recipientPhone, type }, "Sending WhatsApp notification");
    await WhatsappService.sendTextMessage(mainInstanceName, recipientPhone, messageText.trim());
  } catch (error) {
    logger.error({ error }, "Error sending WhatsApp notification");
  }
}
