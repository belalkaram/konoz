import { Router } from "express";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import { db, whatsappInstancesTable, whatsappMessagesTable, customersTable, systemSettingsTable, whatsappRoutingAgentsTable, whatsappRoutingCustomersTable, employeesTable, whatsappContactsTable, whatsappQuickRepliesTable, whatsappActiveFollowupsTable } from "@workspace/db";
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

    const [mainInstanceSetting] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "MAIN_WHATSAPP_INSTANCE_NAME"));
    const isMainInstance = mainInstanceSetting?.value === instanceName;

    if (!instance) {
      // First time: create in Evolution API then save to DB
      const evoInstance = await WhatsappService.createInstance(instanceName);
      [instance] = await db.insert(whatsappInstancesTable).values({
        employeeId,
        instanceName,
        connectionStatus: evoInstance.instance?.status || "disconnected",
        qrCode: evoInstance.qrcode?.base64 || null,
      }).returning();

      const webhookUrl = `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`;
      await WhatsappService.setWebhook(instanceName, webhookUrl).catch(e => {
        logger.error("Failed to set webhook automatically", e);
      });
    }

    // Fetch latest status from Evolution API
    let state = await WhatsappService.getConnectionState(instanceName);

    // Instance missing from Evolution (e.g. after server restart) — recreate it
    if (!state) {
      logger.warn(`Instance ${instanceName} not found in Evolution, recreating…`);
      const evoInstance = await WhatsappService.createInstance(instanceName);
      state = { instance: { state: evoInstance.instance?.status || "disconnected" } };

      // Clear stale QR so the user is prompted to regenerate
      await db.update(whatsappInstancesTable)
        .set({ connectionStatus: "disconnected", qrCode: null })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
      instance.qrCode = null;

      const webhookUrl = `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`;
      await WhatsappService.setWebhook(instanceName, webhookUrl).catch(e => {
        logger.error("Failed to set webhook after recreate", e);
      });
    }

    const status = state?.instance?.state || "disconnected";
    if (instance.connectionStatus !== status) {
      await db.update(whatsappInstancesTable)
        .set({ connectionStatus: status })
        .where(eq(whatsappInstancesTable.id, instance.id));
    }

    return res.json({
      instanceName,
      status,
      qrCode: instance.qrCode,
      isMainInstance,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting whatsapp instance");
    return res.status(500).json({ error: "server_error", message: "Failed to get WhatsApp instance" });
  }
});

/**
 * Request to connect (generates QR code if disconnected).
 * Tries to connect the existing instance first; only creates if missing.
 */
router.post("/whatsapp/instance/connect", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    let qrData: any = null;

    // Step 1: Try connecting the existing instance (returns QR if not yet linked)
    try {
      qrData = await WhatsappService.connectInstance(instanceName);
    } catch (connectErr: any) {
      // 404 = instance not registered in Evolution memory → create it first
      if (connectErr?.response?.status === 404) {
        logger.warn(`Instance ${instanceName} not found on connect, creating…`);

        // Create instance (may fail with 403 if name exists in DB but not memory)
        try {
          const created = await WhatsappService.createInstance(instanceName);
          qrData = created; // createInstance usually includes qrcode
        } catch (createErr: any) {
          // 403 = name exists in Evolution DB. Use restart endpoint to load it into memory.
          if (createErr?.response?.status === 403) {
            logger.warn(`Instance ${instanceName} exists in DB, restarting…`);
            try {
              await WhatsappService.restartInstance(instanceName);
              // Wait a moment for Evolution to load the instance
              await new Promise(r => setTimeout(r, 2000));
              qrData = await WhatsappService.connectInstance(instanceName);
            } catch (restartErr: any) {
              logger.error("Restart also failed:", restartErr?.response?.data || restartErr.message);
              throw restartErr;
            }
          } else {
            throw createErr;
          }
        }

        // Set webhook for the new/restarted instance
        const webhookUrl = `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`;
        await WhatsappService.setWebhook(instanceName, webhookUrl).catch(e => {
          logger.error("Failed to set webhook", e);
        });
      } else {
        throw connectErr;
      }
    }

    // Step 2: Persist QR in our DB
    const qrBase64 = qrData?.qrcode?.base64 ?? null;
    if (qrBase64) {
      await db.update(whatsappInstancesTable)
        .set({ qrCode: qrBase64, connectionStatus: "connecting" })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
    }

    return res.json(qrData || { status: "connecting" });
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
    // Try logging out from Evolution API, but don't fail if the instance is already closed
    await WhatsappService.logoutInstance(instanceName).catch(err => {
      logger.warn(`Evolution API logout failed for ${instanceName}, resetting DB anyway: ${err.message}`);
    });

    // Try deleting the instance from Evolution API to clear any stale records
    await WhatsappService.deleteInstance(instanceName).catch(err => {
      logger.warn(`Evolution API delete failed for ${instanceName}: ${err.message}`);
    });

    // Reset database status
    await db.update(whatsappInstancesTable)
      .set({ connectionStatus: "disconnected", qrCode: null })
      .where(eq(whatsappInstancesTable.employeeId, employeeId));
      
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error force-logging out whatsapp instance");
    return res.status(500).json({ error: "server_error", message: "Failed to logout WhatsApp instance" });
  }
});

import { normalizeWhatsAppNumber } from "../lib/whatsapp-utils";

/**
 * Get unique contacts (customers) the employee has chatted with
 */
router.post("/whatsapp/instance/set-main", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instance = getInstanceName(employeeId);
  try {
    await db
      .insert(systemSettingsTable)
      .values({ key: "MAIN_WHATSAPP_INSTANCE_NAME", employeeId, value: instance, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [systemSettingsTable.key, systemSettingsTable.employeeId],
        set: { value: instance, updatedAt: new Date() },
      });
    return res.json({ success: true, instance });
  } catch (err) {
    logger.error({ err }, "Error setting main instance");
    return res.status(500).json({ error: "server_error" });
  }
});

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

    const uniquePhones = Array.from(contactsMap.keys());
    let syncedContacts: any[] = [];
    
    if (uniquePhones.length > 0) {
      syncedContacts = await db.select()
        .from(whatsappContactsTable)
        .where(
          and(
            eq(whatsappContactsTable.employeeId, employeeId),
            inArray(whatsappContactsTable.phone, uniquePhones)
          )
        );
    }

    const syncedContactsMap = new Map(syncedContacts.map(c => [c.phone, c]));

    const contacts = Array.from(contactsMap.values()).map(c => {
      const synced = syncedContactsMap.get(c.phone);
      return {
        ...c,
        name: synced?.name || c.phone,
        profilePictureUrl: synced?.profilePictureUrl || null,
        pushName: synced?.pushName || null,
        lastSeen: synced?.lastSeen || null,
      };
    });

    return res.json({ contacts });
  } catch (err) {
    req.log.error({ err }, "Error getting contacts");
    return res.status(500).json({ error: "server_error", message: "Failed to get contacts" });
  }
});

/**
 * Manually trigger contact sync from WhatsApp
 */
router.post("/whatsapp/contacts/sync", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    const state = await WhatsappService.getConnectionState(instanceName);
    if (state?.instance?.state !== "open") {
      return res.status(400).json({ success: false, message: "WhatsApp is not connected" });
    }

    const remoteContacts = await WhatsappService.getContacts(instanceName);
    if (!Array.isArray(remoteContacts)) {
      return res.status(500).json({ success: false, message: "Failed to fetch contacts from WhatsApp" });
    }

    let syncedCount = 0;
    
    // We update contacts in DB
    for (const c of remoteContacts) {
       // c looks like: { id: "123@s.whatsapp.net", name: "...", pushName: "..." }
       if (!c.id || !c.id.includes("@s.whatsapp.net")) continue;
       
       const phone = c.id.split("@")[0];
       const name = c.name || null;
       const pushName = c.pushName || c.notify || null;
       
       if (!name && !pushName) continue; // skip if no useful name is found

       // Check if exists
       const [existing] = await db.select().from(whatsappContactsTable).where(
         and(eq(whatsappContactsTable.employeeId, employeeId), eq(whatsappContactsTable.phone, phone))
       );

       if (existing) {
         await db.update(whatsappContactsTable).set({
           name: name || existing.name,
           pushName: pushName || existing.pushName,
           updatedAt: new Date(),
         }).where(eq(whatsappContactsTable.id, existing.id));
       } else {
         await db.insert(whatsappContactsTable).values({
           employeeId,
           phone,
           name,
           pushName,
         });
       }
       syncedCount++;
    }

    return res.json({ success: true, message: `Synced ${syncedCount} contacts` });
  } catch (err) {
    req.log.error({ err }, "Error syncing contacts");
    return res.status(500).json({ success: false, message: "Failed to sync contacts" });
  }
});



/**
 * Get all chats/contacts from Evolution API for Extract
 */
router.get("/whatsapp/contacts/extract", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    const state = await WhatsappService.getConnectionState(instanceName);
    if (state?.instance?.state !== "open") {
      return res.status(400).json({ success: false, message: "WhatsApp is not connected", total: 0, contacts: [], unresolved: [] }); 
    }
    
    try {
      // 1. Fetch from Evolution API (Only chats and contacts)
      const contactsPromise = WhatsappService.getContacts(instanceName).catch(() => []);
      const chatsPromise = WhatsappService.getChats(instanceName).catch(() => []);
      
      // 2. Fetch messages from database history (chats initiated/received in our app)
      const dbMessagesPromise = db
        .select()
        .from(whatsappMessagesTable)
        .where(eq(whatsappMessagesTable.employeeId, employeeId))
        .catch(() => []);

      const [contacts, chats, dbMessages] = await Promise.all([
        contactsPromise,
        chatsPromise,
        dbMessagesPromise
      ]);
      
      const contactsMap = new Map<string, any>();
      const unresolvedList: any[] = [];

      // Helper to add/merge contacts
      const addContact = (phone: string, name: string | null, source: string, rawId: string | null) => {
        const existing = contactsMap.get(phone);
        if (existing) {
          const sources = new Set(existing.source.split(", "));
          sources.add(source);
          contactsMap.set(phone, {
            phone,
            name: name || existing.name,
            source: Array.from(sources).join(", "),
            rawId: rawId || existing.rawId,
            status: "resolved"
          });
        } else {
          contactsMap.set(phone, {
            phone,
            name,
            source,
            rawId,
            status: "resolved"
          });
        }
      };
      
      // Process Evolution contacts
      if (Array.isArray(contacts)) {
        contacts.forEach((c: any) => {
          const norm = normalizeWhatsAppNumber(c);
          const name = c.name || c.pushName || c.notify || null;
          
          if (norm.isResolved && norm.phone) {
            addContact(norm.phone, name, "contact", c.id || c.remoteJid);
          } else {
            unresolvedList.push({
              rawId: c.id || c.remoteJid,
              name: name,
              source: "contact",
              status: "unresolved",
              reason: norm.reason
            });
          }
        });
      }
      
      // Process Evolution chats
      if (Array.isArray(chats)) {
        chats.forEach((c: any) => {
          // Exclude group chats (JIDs ending with @g.us or similar)
          const rawId = c.id || c.remoteJid || "";
          if (rawId.endsWith("@g.us")) {
            return;
          }
          
          const norm = normalizeWhatsAppNumber(c);
          const name = c.name || c.pushName || c.notify || null;
          
          if (norm.isResolved && norm.phone) {
            addContact(norm.phone, name, "chat", rawId);
          } else {
            unresolvedList.push({
              rawId: rawId,
              name: name,
              source: "chat",
              status: "unresolved",
              reason: norm.reason
            });
          }
        });
      }

      // Process Database messages history
      if (Array.isArray(dbMessages)) {
        dbMessages.forEach((msg: any) => {
          if (msg.customerPhone) {
            const norm = normalizeWhatsAppNumber(msg.customerPhone);
            if (norm.isResolved && norm.phone) {
              addContact(norm.phone, null, "app chat history", `db_msg_${msg.id}`);
            }
          }
        });
      }

      const resolvedContacts = Array.from(contactsMap.values());

      return res.json({ 
        success: true, 
        total: resolvedContacts.length, 
        contacts: resolvedContacts,
        unresolved: unresolvedList 
      });
    } catch (apiErr: any) {
      req.log.warn({ err: apiErr }, "Evolution API returned error for contacts extract");
      return res.status(500).json({ success: false, message: "Evolution API error", total: 0, contacts: [], unresolved: [] });
    }
  } catch (err) {
    req.log.error({ err }, "Error extracting contacts");
    return res.status(500).json({ success: false, message: "Failed to extract contacts", total: 0, contacts: [], unresolved: [] });
  }
});

/**
 * Export members for a specific group
 */
router.get("/whatsapp/groups/:groupId/members/export", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);
  const groupId = req.params.groupId;

  try {
    const groups = await WhatsappService.getGroups(instanceName);
    
    if (!Array.isArray(groups)) {
      return res.status(500).json({ success: false, message: "Failed to fetch groups from WhatsApp" });
    }

    const group = groups.find((g: any) => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const participants = group.participants || [];
    const members: any[] = [];
    const unresolved: any[] = [];

    participants.forEach((p: any) => {
      const norm = normalizeWhatsAppNumber(p);
      
      if (norm.isResolved && norm.phone) {
        members.push({
          groupName: group.subject || group.name,
          memberName: p.name || p.pushName || p.notify || null,
          phone: norm.phone,
          role: p.admin ? (p.admin === "superadmin" ? "Super Admin" : "Admin") : "Member",
          status: "resolved",
          rawId: p.id || p.jid || p.participant || null
        });
      } else {
        unresolved.push({
          groupName: group.subject || group.name,
          rawId: p.id || p.jid || p.participant || null,
          role: p.admin ? "Admin" : "Member",
          status: "unresolved",
          reason: norm.reason
        });
      }
    });

    return res.json({
      success: true,
      totalMembers: participants.length,
      resolvedTotal: members.length,
      members,
      unresolved
    });
    
  } catch (err) {
    req.log.error({ err }, "Error exporting group members");
    return res.status(500).json({ success: false, message: "Failed to export group members" });
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

    const [contact] = await db
      .select()
      .from(whatsappContactsTable)
      .where(
        and(
          eq(whatsappContactsTable.employeeId, employeeId),
          eq(whatsappContactsTable.phone, phone)
        )
      );

    return res.json({ 
      messages,
      contact: contact ? {
        name: contact.name,
        profilePictureUrl: contact.profilePictureUrl,
        pushName: contact.pushName,
        lastSeen: contact.lastSeen
      } : null
    });
  } catch (err) {
    req.log.error({ err }, "Error getting messages");
    return res.status(500).json({ error: "server_error", message: "Failed to get messages" });
  }
});

/**
 * Delete a specific chat (local and remote)
 */
router.delete("/whatsapp/chats/:phone", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const phone = req.params.phone as string;
  const instanceName = getInstanceName(employeeId);

  try {
    // 1. Delete from Evolution API (WhatsApp)
    // Evolution API doesn't have a direct "delete chat" but we can try to clear messages or just let it be if not supported.
    // Actually, Evolution API does have a `/chat/deleteChat/:instance` endpoint if configured, or `/chat/deleteMessageForEveryone`
    // Let's call the Evolution API's delete chat or leave it to local DB if not supported by the provider
    // The requirement says: والحذف بيقوم بحذف الشات من السيستم فقط وليس من الواتساب كمان نفسه
    // Evolution API v2: DELETE /chat/deleteChat/:instance
    try {
      await WhatsappService.deleteChat(instanceName, phone);
    } catch (e) {
      req.log.warn({ e }, "Failed to delete chat remotely via Evolution API");
    }

    // 2. Delete local DB messages & contact
    await db.delete(whatsappMessagesTable).where(
      and(
        eq(whatsappMessagesTable.employeeId, employeeId),
        eq(whatsappMessagesTable.customerPhone, phone)
      )
    );
    await db.delete(whatsappContactsTable).where(
      and(
        eq(whatsappContactsTable.employeeId, employeeId),
        eq(whatsappContactsTable.phone, phone)
      )
    );

    return res.json({ success: true, message: "Chat deleted" });
  } catch (err) {
    req.log.error({ err }, "Error deleting chat");
    return res.status(500).json({ error: "server_error", message: "Failed to delete chat" });
  }
});

/**
 * Bulk delete chats (local and remote)
 */
router.post("/whatsapp/chats/delete-bulk", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { phones } = req.body;
  if (!Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: "validation_error", message: "Phones array required" });
  }
  
  const instanceName = getInstanceName(employeeId);

  try {
    for (const phone of phones) {
      try {
        await WhatsappService.deleteChat(instanceName, phone);
      } catch (e) {
        req.log.warn({ e, phone }, "Failed to delete chat remotely");
      }
      
      await db.delete(whatsappMessagesTable).where(
        and(
          eq(whatsappMessagesTable.employeeId, employeeId),
          eq(whatsappMessagesTable.customerPhone, phone)
        )
      );
      await db.delete(whatsappContactsTable).where(
        and(
          eq(whatsappContactsTable.employeeId, employeeId),
          eq(whatsappContactsTable.phone, phone)
        )
      );
    }
    return res.json({ success: true, message: "Chats deleted" });
  } catch (err) {
    req.log.error({ err }, "Error bulk deleting chats");
    return res.status(500).json({ error: "server_error", message: "Failed to bulk delete chats" });
  }
});

/**
 * Delete all chats
 */
router.delete("/whatsapp/chats", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);
  
  try {
    // We fetch all contacts and try to delete remotely
    const contacts = await db.select().from(whatsappContactsTable).where(eq(whatsappContactsTable.employeeId, employeeId));
    
    for (const contact of contacts) {
      try {
        await WhatsappService.deleteChat(instanceName, contact.phone);
      } catch (e) {
        // ignore
      }
    }

    await db.delete(whatsappMessagesTable).where(eq(whatsappMessagesTable.employeeId, employeeId));
    await db.delete(whatsappContactsTable).where(eq(whatsappContactsTable.employeeId, employeeId));
    
    return res.json({ success: true, message: "All chats deleted" });
  } catch (err) {
    req.log.error({ err }, "Error deleting all chats");
    return res.status(500).json({ error: "server_error", message: "Failed to delete all chats" });
  }
});

/**
 * Send a message to a customer
 */
router.post("/whatsapp/messages/:phone", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const phone = req.params.phone as string;
  const { text, audio } = req.body;
  
  req.log.info({ hasText: !!text, hasAudio: !!audio, bodyKeys: Object.keys(req.body) }, "Incoming message payload");

  if (!text && !audio) {
    return res.status(400).json({ error: "validation_error", message: "Text or audio is required" });
  }

  const instanceName = getInstanceName(employeeId);

  try {
    let response;
    let messageBody = "";
    let messageType = "text";

    if (audio) {
      response = await WhatsappService.sendAudioMessage(instanceName, phone, audio);
      messageBody = audio;
      messageType = "audio";
    } else {
      response = await WhatsappService.sendTextMessage(instanceName, phone, text);
      messageBody = text;
      messageType = "text";
    }
    
    // Save to DB
    const [message] = await db.insert(whatsappMessagesTable).values({
      employeeId,
      customerPhone: phone,
      messageId: response.key?.id || null,
      messageBody: messageBody,
      messageType: messageType,
      isFromMe: true,
      timestamp: new Date(),
    }).returning();

    return res.json({ message });
  } catch (err: any) {
    req.log.error({ err }, "Error sending message");
    
    const errMsg = err?.response?.data?.response?.message || err?.message || "";
    if (errMsg.includes("Connection Closed") || errMsg.includes("not_connected")) {
      logger.warn(`Detected closed WhatsApp connection for employee ${employeeId}, resetting status to disconnected`);
      await db.update(whatsappInstancesTable)
        .set({ connectionStatus: "disconnected", qrCode: null })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
      
      return res.status(500).json({ 
        error: "connection_closed", 
        message: "اتصال الواتساب مغلق أو غير مصدق. يرجى إعادة ربط الهاتف من الإعدادات." 
      });
    }

    return res.status(500).json({ error: "server_error", message: "Failed to send message: " + errMsg });
  }
});

/**
 * Send a media message to a customer
 */
router.post("/whatsapp/messages/:phone/media", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const phone = req.params.phone as string;
  const { mediatype, media, caption, fileName, mimetype } = req.body;

  if (!mediatype || !media) {
    return res.status(400).json({ error: "validation_error", message: "mediatype and media are required" });
  }

  const instanceName = getInstanceName(employeeId);

  try {
    const response = await WhatsappService.sendMedia(instanceName, phone, {
      mediatype, media, caption, fileName, mimetype
    });

    const [message] = await db.insert(whatsappMessagesTable).values({
      employeeId,
      customerPhone: phone,
      messageId: response.key?.id || null,
      messageBody: caption || `[${mediatype}]`,
      messageType: mediatype,
      mediaUrl: null,
      mediaBase64: null, // Don't store large base64 in DB unless requested
      mimeType: mimetype,
      fileName: fileName,
      caption: caption,
      isFromMe: true,
      timestamp: new Date(),
    }).returning();

    return res.json({ message });
  } catch (err: any) {
    req.log.error({ err }, "Error sending media message");
    return res.status(500).json({ error: "server_error", message: "Failed to send media" });
  }
});

/**
 * Forward messages
 */
router.post("/whatsapp/messages/forward", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { messageIds, recipientPhones } = req.body;

  if (!recipientPhones || !Array.isArray(recipientPhones) || recipientPhones.length === 0) {
    return res.status(400).json({ error: "validation_error", message: "recipientPhones array is required" });
  }

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: "validation_error", message: "messageIds array is required" });
  }

  const instanceName = getInstanceName(employeeId);
  const results = [];

  // Fetch all messages to forward
  const messagesToForward = await db
    .select()
    .from(whatsappMessagesTable)
    .where(inArray(whatsappMessagesTable.id, messageIds));

  if (messagesToForward.length === 0) {
    return res.status(404).json({ error: "not_found", message: "No messages found to forward" });
  }

  for (const phone of recipientPhones) {
    for (const msg of messagesToForward) {
      try {
        let response;
        if (msg.messageType === "text") {
          response = await WhatsappService.sendTextMessage(instanceName, phone, msg.messageBody);
        } else if (msg.messageType === "image" || msg.messageType === "video" || msg.messageType === "document" || msg.messageType === "audio") {
           if (msg.mediaBase64) {
              response = await WhatsappService.sendMedia(instanceName, phone, {
                 mediatype: msg.messageType,
                 media: msg.mediaBase64,
                 caption: msg.caption || undefined,
                 fileName: msg.fileName || undefined,
              });
           } else {
             // Fallback
             response = await WhatsappService.sendTextMessage(instanceName, phone, `[Forwarded ${msg.messageType}] ${msg.messageBody || msg.caption || ""}`);
           }
        } else {
          response = await WhatsappService.sendTextMessage(instanceName, phone, `[Forwarded] ${msg.messageBody}`);
        }

        await db.insert(whatsappMessagesTable).values({
          employeeId,
          customerPhone: phone,
          messageId: response?.key?.id || null,
          messageBody: msg.messageBody,
          messageType: msg.messageType,
          mediaBase64: msg.mediaBase64,
          mediaUrl: msg.mediaUrl,
          mimeType: msg.mimeType,
          fileName: msg.fileName,
          caption: msg.caption,
          isFromMe: true,
          isForwarded: true,
          timestamp: new Date(),
        });

        results.push({ phone, messageId: msg.id, success: true });
      } catch (err: any) {
        req.log.error({ err, phone, msgId: msg.id }, "Error forwarding message");
        results.push({ phone, messageId: msg.id, success: false, error: err.message });
      }
    }
  }

  return res.json({ results });
});

/**
 * Sync Contacts Manually
 */
router.post("/whatsapp/contacts/sync", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    const contacts = await WhatsappService.getContacts(instanceName);
    
    // Some versions of Evolution API return an array directly, others wrap it.
    const contactsList = Array.isArray(contacts) ? contacts : (contacts?.contacts || contacts?.data || []);
    
    if (contactsList && Array.isArray(contactsList)) {
      for (const contact of contactsList) {
        const jid = contact.id || contact.remoteJid;
        if (jid && jid.endsWith("@s.whatsapp.net")) {
          const phone = jid.split("@")[0];
          const name = contact.name || contact.notify || contact.verifiedName || contact.pushName || null;
          
          if (name) {
            await db.insert(whatsappContactsTable)
              .values({
                employeeId,
                phone,
                name,
                pushName: contact.notify || contact.pushName || null,
                profilePictureUrl: contact.profilePictureUrl || null,
              })
              .onConflictDoUpdate({
                target: [whatsappContactsTable.employeeId, whatsappContactsTable.phone],
                set: {
                  name,
                  pushName: contact.notify || contact.pushName || null,
                  ...(contact.profilePictureUrl ? { profilePictureUrl: contact.profilePictureUrl } : {}),
                  updatedAt: new Date(),
                }
              });
          }
        }
      }
    }
    return res.json({ success: true, message: "Contacts synced successfully" });
  } catch (err) {
    req.log.error({ err }, "Error syncing contacts");
    return res.status(500).json({ error: "server_error", message: "Failed to sync contacts" });
  }
});

/**
 * Get Customer by Phone
 */
router.get("/whatsapp/customers/:phone", requireAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const [customer] = await db.select().from(customersTable).where(or(eq(customersTable.phone, phone as string), eq(customersTable.whatsapp, phone as string)));
    return res.json(customer || null);
  } catch (err) {
    req.log.error({ err }, "Error fetching customer by phone");
    return res.status(500).json({ error: "server_error", message: "Failed to fetch customer" });
  }
});

/**
 * Update Customer Status via Phone
 */
router.put("/whatsapp/customers/status", requireAuth, async (req, res) => {
  const { phone, status } = req.body;
  if (!phone || !status) return res.status(400).json({ error: "validation_error", message: "Phone and status required" });
  
  try {
    const [customer] = await db.select().from(customersTable).where(or(eq(customersTable.phone, phone as string), eq(customersTable.whatsapp, phone as string)));
    if (!customer) {
      return res.status(404).json({ error: "not_found", message: "Customer not found" });
    }
    
    await db.update(customersTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(customersTable.id, customer.id));
      
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error updating customer status from chat");
    return res.status(500).json({ error: "server_error", message: "Failed to update status" });
  }
});

/**
 * Sync status endpoint
 */
router.get("/whatsapp/sync/status", requireAuth, async (req, res) => {
  // Placeholder for real sync status checking from archive table
  return res.json({ status: "idle" });
});

/**
 * Sync start endpoint
 */
router.post("/whatsapp/sync/start", requireAuth, async (req, res) => {
  // Placeholder for archive worker spawn
  return res.json({ success: true, message: "Sync job queued" });
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
    if (event === "CONNECTION_UPDATE" || event === "connection.update") {
      const state = data.state; // open, connecting, close
      await db.update(whatsappInstancesTable)
        .set({ connectionStatus: state })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
    }
    
    // Handle QR Code
    if (event === "QRCODE_UPDATED" || event === "qrcode.updated") {
      await db.update(whatsappInstancesTable)
        .set({ qrCode: data.qrcode.base64, connectionStatus: "connecting" })
        .where(eq(whatsappInstancesTable.employeeId, employeeId));
    }

    // Handle Message Status Updates (Delivered, Read, Failed)
    if (event === "MESSAGES_UPDATE" || event === "messages.update") {
      const updates = Array.isArray(data) ? data : (data?.messages || [data]);
      for (const update of updates) {
        if (!update.key?.id) continue;
        const msgId = update.key.id;
        let status = update.update?.status;
        
        // Convert status enum to string
        if (status === 3) status = "delivered";
        if (status === 4) status = "read";
        if (status === 5) status = "failed"; // Just as an example, actual enums might vary slightly by engine
        
        if (status === "delivered" || status === "read") {
          await db.update(whatsappMessagesTable)
            .set({ status: status })
            .where(eq(whatsappMessagesTable.messageId, msgId));
        }
      }
      return res.status(200).send("OK");
    }

    // Handle Incoming Messages
    if (event === "MESSAGES_UPSERT" || event === "messages.upsert") {
      let msg = data;
      if (data?.messages && Array.isArray(data.messages)) {
        msg = data.messages[0];
      } else if (Array.isArray(data)) {
        msg = data[0];
      }

      if (!msg || !msg.key || !msg.key.remoteJid) {
        return res.status(200).send("OK");
      }
      
      const remoteJid = msg.key.remoteJid;
      // remoteJid format: 1234567890@s.whatsapp.net (ignore group messages for now)
      if (remoteJid && remoteJid.includes("@s.whatsapp.net")) {
        const phone = remoteJid.split("@")[0];
        
        let messageText = "";
        let messageType = "text";
        let mediaUrl = null;
        let mediaBase64 = null;
        let mimeType = null;
        let fileName = null;
        let caption = null;
        let contactInfo = null;
        let locationData = null;
        let quotedMessageId = null;
        
        const m = msg.message;
        if (!m) return res.status(200).send("OK");

        // Extract Quoted Message ID
        const contextInfo = m.extendedTextMessage?.contextInfo || 
                            m.imageMessage?.contextInfo || 
                            m.videoMessage?.contextInfo || 
                            m.documentMessage?.contextInfo;
                            
        if (contextInfo?.stanzaId) {
          quotedMessageId = contextInfo.stanzaId;
        }

        // Parse Message Type and Content
        if (m.conversation) {
          messageText = m.conversation;
        } else if (m.extendedTextMessage?.text) {
          messageText = m.extendedTextMessage.text;
        } else if (m.audioMessage) {
          messageType = "audio";
          mediaUrl = m.audioMessage.url || null;
          mimeType = m.audioMessage.mimetype;
          messageText = m.audioMessage.base64 || mediaUrl || "[Audio]";
          mediaBase64 = m.audioMessage.base64 || null;
        } else if (m.imageMessage) {
          messageType = "image";
          caption = m.imageMessage.caption || null;
          messageText = caption || "[Image]";
          mediaUrl = m.imageMessage.url || null;
          mimeType = m.imageMessage.mimetype;
          mediaBase64 = m.imageMessage.base64 || null;
        } else if (m.videoMessage) {
          messageType = "video";
          caption = m.videoMessage.caption || null;
          messageText = caption || "[Video]";
          mediaUrl = m.videoMessage.url || null;
          mimeType = m.videoMessage.mimetype;
        } else if (m.documentMessage) {
          messageType = "document";
          caption = m.documentMessage.caption || null;
          fileName = m.documentMessage.fileName || m.documentMessage.title || null;
          messageText = caption || fileName || "[Document]";
          mediaUrl = m.documentMessage.url || null;
          mimeType = m.documentMessage.mimetype;
        } else if (m.stickerMessage) {
          messageType = "sticker";
          messageText = "[Sticker]";
          mediaUrl = m.stickerMessage.url || null;
          mimeType = m.stickerMessage.mimetype;
          mediaBase64 = m.stickerMessage.base64 || null;
        } else if (m.contactMessage) {
          messageType = "contact";
          messageText = "[Contact Card]";
          contactInfo = JSON.stringify({
            name: m.contactMessage.displayName,
            vcard: m.contactMessage.vcard
          });
        } else if (m.locationMessage) {
          messageType = "location";
          messageText = "[Location]";
          locationData = JSON.stringify({
            lat: m.locationMessage.degreesLatitude,
            lng: m.locationMessage.degreesLongitude,
            name: m.locationMessage.name,
            address: m.locationMessage.address
          });
        }
        
        if (messageText) {
          await db.insert(whatsappMessagesTable).values({
            employeeId,
            customerPhone: phone,
            messageId: msg.key.id,
            messageBody: messageText,
            messageType: messageType,
            mediaUrl,
            mediaBase64,
            mimeType,
            fileName,
            caption,
            quotedMessageId,
            contactInfo,
            locationData,
            status: "sent",
            isFromMe: msg.key.fromMe || false,
            timestamp: new Date(msg.messageTimestamp * 1000),
          });

          // --- Auto Classification & Active Followup Stop ---
          if (!msg.key.fromMe) {
            // 1. Update Customer Status to "replied"
            const [customer] = await db.select().from(customersTable).where(or(eq(customersTable.phone, phone), eq(customersTable.whatsapp, phone)));
            if (customer) {
              await db.update(customersTable)
                .set({ status: "replied", lastContactedAt: new Date(), updatedAt: new Date() })
                .where(eq(customersTable.id, customer.id));
                
              // 2. Stop any active follow-ups
              await db.update(whatsappActiveFollowupsTable)
                .set({ status: "cancelled", updatedAt: new Date() })
                .where(and(
                  eq(whatsappActiveFollowupsTable.customerId, customer.id),
                  eq(whatsappActiveFollowupsTable.status, "pending")
                ));
            }

            // 3. Smart Quick Replies (Auto-Reply based on Keywords)
            if (messageType === "text" && messageText) {
              const quickReplies = await db.select().from(whatsappQuickRepliesTable).where(and(
                eq(whatsappQuickRepliesTable.employeeId, employeeId),
                eq(whatsappQuickRepliesTable.isActive, true)
              ));
              
              for (const qr of quickReplies) {
                if (qr.keywords) {
                  const keywords = qr.keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
                  const msgLower = messageText.toLowerCase();
                  const isMatch = keywords.some((k: string) => msgLower.includes(k));
                  
                  if (isMatch) {
                    try {
                      let finalMessageBody = qr.messageBody;
                      const custName = customer?.fullName || "عميلنا العزيز";
                      finalMessageBody = finalMessageBody.replace(/\{\{customer_name\}\}/g, custName);
                      finalMessageBody = finalMessageBody.replace(/\{\{phone\}\}/g, phone);
                      
                      await WhatsappService.sendTextMessage(instance, phone, finalMessageBody);
                      
                      await db.update(whatsappQuickRepliesTable)
                        .set({ usageCount: (qr.usageCount || 0) + 1 })
                        .where(eq(whatsappQuickRepliesTable.id, qr.id));
                        
                      if (customer) {
                         await db.update(customersTable).set({ status: "interested" }).where(eq(customersTable.id, customer.id));
                      }
                        
                      break; 
                    } catch (err) {
                      logger.error({ err }, "Failed to send auto-reply");
                    }
                  }
                }
              }
            }
          }

          // --- Round Robin Routing Logic (Only for incoming texts) ---
          if (!msg.key.fromMe && messageType === "text") {
            const [mainInstanceSetting] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "MAIN_WHATSAPP_INSTANCE_NAME"));
            
            if (mainInstanceSetting && mainInstanceSetting.value === instance) {
              const [routedCust] = await db.select().from(whatsappRoutingCustomersTable).where(eq(whatsappRoutingCustomersTable.customerPhone, phone));
              
              let targetAgentPhone: string | null = null;
              
              if (routedCust) {
                const [agent] = await db.select().from(whatsappRoutingAgentsTable).where(eq(whatsappRoutingAgentsTable.id, routedCust.assignedAgentId));
                if (agent && agent.isActive) {
                  targetAgentPhone = agent.agentPhone;
                }
              } else {
                // Find next active agent
                const agents = await db.select().from(whatsappRoutingAgentsTable)
                  .where(eq(whatsappRoutingAgentsTable.isActive, true))
                  .orderBy(whatsappRoutingAgentsTable.lastAssignedAt);
                
                if (agents.length > 0) {
                  const nextAgent = agents[0];
                  targetAgentPhone = nextAgent.agentPhone;
                  
                  await db.insert(whatsappRoutingCustomersTable).values({
                    customerPhone: phone,
                    assignedAgentId: nextAgent.id,
                  });
                  
                  await db.update(whatsappRoutingAgentsTable)
                    .set({ lastAssignedAt: new Date() })
                    .where(eq(whatsappRoutingAgentsTable.id, nextAgent.id));
                }
              }

              if (targetAgentPhone) {
                // Forward message to the agent from the Main WhatsApp
                const forwardText = `*New message from Lead (Phone: ${phone})*\n\n${messageText}`;
                try {
                  await WhatsappService.sendTextMessage(instance, targetAgentPhone, forwardText);
                } catch (fwErr) {
                  logger.error({ fwErr, targetAgentPhone }, "Failed to forward lead message to agent");
                }
              }
            }
          } // end !fromMe
        } // end if (messageText)
      } // end if (remoteJid.includes)
    } // end if (MESSAGES_UPSERT)

    // Handle Contact updates
    if (event === "CONTACTS_UPSERT" || event === "contacts.upsert" || event === "CONTACTS_UPDATE" || event === "contacts.update") {
      const contacts = Array.isArray(data) ? data : [data];
      for (const c of contacts) {
        if (!c.id || !c.id.includes("@s.whatsapp.net")) continue;
        const phone = c.id.split("@")[0];
        const name = c.name || c.notify || c.pushName || null;
        
        if (name) {
          const [existing] = await db.select().from(whatsappContactsTable).where(
            and(eq(whatsappContactsTable.employeeId, employeeId), eq(whatsappContactsTable.phone, phone))
          );
          if (existing) {
             await db.update(whatsappContactsTable).set({
               name: c.name || existing.name,
               pushName: c.notify || existing.pushName,
               updatedAt: new Date()
             }).where(eq(whatsappContactsTable.id, existing.id));
          } else {
             await db.insert(whatsappContactsTable).values({
               employeeId,
               phone,
               name: c.name,
               pushName: c.notify || c.pushName,
             });
          }
        }
      }
      return res.status(200).send("OK");
    }

    // Handle Presence updates
    if (event === "PRESENCE_UPDATE" || event === "presence.update") {
       const { id, presences } = data;
       if (id && id.includes("@s.whatsapp.net")) {
         const phone = id.split("@")[0];
         // presences is like {"user@s.whatsapp.net": {"lastKnownPresence": "available", "lastSeen": 1234567}}
         let lastSeenDate: Date | null = null;
         if (presences && typeof presences === "object") {
            const vals: any = Object.values(presences)[0];
            if (vals?.lastSeen) {
               lastSeenDate = new Date(vals.lastSeen * 1000);
            } else if (vals?.lastKnownPresence === "available") {
               lastSeenDate = new Date();
            }
         }
         if (lastSeenDate) {
            const [existing] = await db.select().from(whatsappContactsTable).where(
              and(eq(whatsappContactsTable.employeeId, employeeId), eq(whatsappContactsTable.phone, phone))
            );
            if (existing) {
               await db.update(whatsappContactsTable).set({
                  lastSeen: lastSeenDate,
                  updatedAt: new Date()
               }).where(eq(whatsappContactsTable.id, existing.id));
            }
         }
       }
       return res.status(200).send("OK");
    }

    return res.status(200).send("OK");
  } catch (err) {
    logger.error({ err }, "Error processing webhook");
    return res.status(500).send("Internal Server Error");
  }
});

export default router;
