import { Router } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db, whatsappInstancesTable, whatsappMessagesTable, customersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { WhatsappService } from "../lib/whatsapp.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Helper to get instance name for an employee
const getInstanceName = (employeeId: number) => `emp_${employeeId}`;

/**
 * Get the current WhatsApp connection state and QR Code for the logged-in employee
 */
router.get("/whatsapp/instance", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    let [instance] = await db
      .select()
      .from(whatsappInstancesTable)
      .where(eq(whatsappInstancesTable.employeeId, employeeId));

    if (!instance) {
      // First time, create instance in Evolution API
      const evoInstance = await WhatsappService.createInstance(instanceName);
      
      // Save to db
      [instance] = await db.insert(whatsappInstancesTable).values({
        employeeId,
        instanceName,
        connectionStatus: evoInstance.instance?.status || "disconnected",
        qrCode: evoInstance.qrcode?.base64 || null,
      }).returning();
      
      // Set webhook
      const webhookUrl = `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`;
      await WhatsappService.setWebhook(instanceName, webhookUrl).catch(e => {
        logger.error("Failed to set webhook automatically", e);
      });
    }

    // Always fetch latest status from Evolution API
    const state = await WhatsappService.getConnectionState(instanceName);
    const status = state?.instance?.state || "disconnected";
    
    // Update DB if changed
    if (instance.connectionStatus !== status) {
      await db.update(whatsappInstancesTable)
        .set({ connectionStatus: status })
        .where(eq(whatsappInstancesTable.id, instance.id));
    }

    return res.json({
      instanceName,
      status,
      qrCode: instance.qrCode,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting whatsapp instance");
    return res.status(500).json({ error: "server_error", message: "Failed to get WhatsApp instance" });
  }
});

/**
 * Request to connect (generates QR code if disconnected)
 */
router.post("/whatsapp/instance/connect", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    const data = await WhatsappService.connectInstance(instanceName);
    
    if (data.qrcode?.base64) {
      await db.update(whatsappInstancesTable)
        .set({ qrCode: data.qrcode.base64, connectionStatus: "connecting" })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
    }

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error connecting whatsapp instance");
    return res.status(500).json({ error: "server_error", message: "Failed to connect WhatsApp instance" });
  }
});

/**
 * Logout
 */
router.delete("/whatsapp/instance", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    await WhatsappService.logoutInstance(instanceName);
    await db.update(whatsappInstancesTable)
      .set({ connectionStatus: "disconnected", qrCode: null })
      .where(eq(whatsappInstancesTable.employeeId, employeeId));
      
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error logging out whatsapp instance");
    return res.status(500).json({ error: "server_error", message: "Failed to logout WhatsApp instance" });
  }
});

/**
 * Get unique contacts (customers) the employee has chatted with
 */
router.get("/whatsapp/contacts", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;

  try {
    const messages = await db
      .select({
        phone: whatsappMessagesTable.customerPhone,
        lastMessageAt: whatsappMessagesTable.timestamp,
        messageBody: whatsappMessagesTable.messageBody
      })
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.employeeId, employeeId))
      .orderBy(desc(whatsappMessagesTable.timestamp));

    // Group by phone to get the latest message per contact
    const contactsMap = new Map<string, any>();
    for (const msg of messages) {
      if (!contactsMap.has(msg.phone)) {
        contactsMap.set(msg.phone, msg);
      }
    }

    const contacts = Array.from(contactsMap.values());

    return res.json({ contacts });
  } catch (err) {
    req.log.error({ err }, "Error getting contacts");
    return res.status(500).json({ error: "server_error", message: "Failed to get contacts" });
  }
});

/**
 * Get messages for a specific customer
 */
router.get("/whatsapp/messages/:phone", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const phone = req.params.phone as string;

  try {
    const messages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(
        and(
          eq(whatsappMessagesTable.employeeId, employeeId),
          eq(whatsappMessagesTable.customerPhone, phone)
        )
      )
      .orderBy(whatsappMessagesTable.timestamp);

    return res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "Error getting messages");
    return res.status(500).json({ error: "server_error", message: "Failed to get messages" });
  }
});

/**
 * Send a message to a customer
 */
router.post("/whatsapp/messages/:phone", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const phone = req.params.phone as string;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "validation_error", message: "Text is required" });
  }

  const instanceName = getInstanceName(employeeId);

  try {
    const response = await WhatsappService.sendTextMessage(instanceName, phone, text);
    
    // Save to DB
    const [message] = await db.insert(whatsappMessagesTable).values({
      employeeId,
      customerPhone: phone,
      messageId: response.key?.id || null,
      messageBody: text,
      messageType: "text",
      isFromMe: true,
      timestamp: new Date(),
    }).returning();

    return res.json({ message });
  } catch (err) {
    req.log.error({ err }, "Error sending message");
    return res.status(500).json({ error: "server_error", message: "Failed to send message" });
  }
});

/**
 * Webhook handler for Evolution API
 */
router.post("/whatsapp/webhook", async (req, res) => {
  try {
    const { event, instance, data } = req.body as { event: string, instance: string, data: any };
    logger.info(`WhatsApp Webhook received: ${event} for ${instance}`);

    if (!instance || typeof instance !== "string" || !instance.startsWith("emp_")) {
      return res.status(200).send("OK");
    }

    const employeeId = parseInt(instance.replace("emp_", ""));
    if (isNaN(employeeId)) {
      return res.status(200).send("OK");
    }

    // Handle Connection Updates
    if (event === "CONNECTION_UPDATE") {
      const state = data.state; // open, connecting, close
      await db.update(whatsappInstancesTable)
        .set({ connectionStatus: state })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
    }
    
    // Handle QR Code
    if (event === "QRCODE_UPDATED") {
      await db.update(whatsappInstancesTable)
        .set({ qrCode: data.qrcode.base64, connectionStatus: "connecting" })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
    }

    // Handle incoming messages
    if (event === "MESSAGES_UPSERT") {
      const msg = data.message;
      if (!msg) return res.status(200).send("OK");
      
      const remoteJid = msg.key.remoteJid;
      // remoteJid format: 1234567890@s.whatsapp.net
      if (remoteJid && remoteJid.includes("@s.whatsapp.net") && !msg.key.fromMe) {
        const phone = remoteJid.split("@")[0];
        
        let messageText = "";
        if (msg.message?.conversation) {
          messageText = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          messageText = msg.message.extendedTextMessage.text;
        }
        
        if (messageText) {
          await db.insert(whatsappMessagesTable).values({
            employeeId,
            customerPhone: phone,
            messageId: msg.key.id,
            messageBody: messageText,
            messageType: "text",
            isFromMe: false,
            timestamp: new Date(msg.messageTimestamp * 1000),
          });
        }
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    logger.error({ err }, "Error processing webhook");
    return res.status(500).send("Internal Server Error");
  }
});

export default router;
