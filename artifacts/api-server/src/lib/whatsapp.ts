import axios from "axios";
import { logger } from "./logger";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "evol_konooz_super_secret_key";

const apiClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    apikey: EVOLUTION_API_KEY,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

export const WhatsappService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Instance Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new WhatsApp instance for an employee.
   */
  async createInstance(instanceName: string) {
    try {
      const response = await apiClient.post(`/instance/create`, {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error creating WhatsApp instance:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get instance connection state (open, connecting, close)
   */
  async getConnectionState(instanceName: string) {
    try {
      const response = await apiClient.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      logger.error("Error getting connection state:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Connect instance (returns QR code if not connected)
   */
  async connectInstance(instanceName: string) {
    try {
      const response = await apiClient.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error("Error connecting WhatsApp instance:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Logout from an instance
   */
  async logoutInstance(instanceName: string) {
    try {
      const response = await apiClient.delete(`/instance/logout/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error("Error logging out WhatsApp instance:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete an instance — silently ignores errors (including 404)
   */
  async deleteInstance(instanceName: string) {
    try {
      const response = await apiClient.delete(`/instance/delete/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.warn(`deleteInstance ${instanceName}: ${error?.response?.status ?? error.message}`);
      return null;
    }
  },

  /**
   * Restart an instance (loads it back into memory from DB)
   */
  async restartInstance(instanceName: string) {
    try {
      const response = await apiClient.post(`/instance/restart/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error("Error restarting WhatsApp instance:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch all instances from Evolution API
   */
  async getInstances() {
    try {
      const response = await apiClient.get(`/instance/fetchInstances`);
      return response.data;
    } catch (error: any) {
      logger.error("Error fetching WhatsApp instances:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Set presence (online/offline) for an instance
   */
  async setPresence(instanceName: string, presence: "available" | "unavailable") {
    try {
      const response = await apiClient.post(`/instance/setPresence/${instanceName}`, { presence });
      return response.data;
    } catch (error: any) {
      logger.error("Error setting presence:", error?.response?.data || error.message);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Webhook Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Delete a chat remotely from Evolution API
   */
  async deleteChat(instanceName: string, phone: string) {
    try {
      const response = await apiClient.delete(`/chat/deleteChat/${instanceName}`, {
        data: { number: phone }
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error deleting chat from Evolution:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Set webhook for an instance
   */
  async setWebhook(instanceName: string, webhookUrl: string) {
    try {
      const response = await apiClient.post(`/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED"
          ]
        }
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error setting webhook:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get current webhook settings for an instance
   */
  async getWebhook(instanceName: string) {
    try {
      const response = await apiClient.get(`/webhook/find/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error("Error getting webhook:", error?.response?.data || error.message);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Message Sending
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a text message
   */
  async sendTextMessage(instanceName: string, number: string, text: string) {
    try {
      const response = await apiClient.post(`/message/sendText/${instanceName}`, {
        number,
        text,
        delay: 1200
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error sending WhatsApp message:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Send an audio message (Voice Note)
   */
  async sendAudioMessage(instanceName: string, number: string, audioBase64: string) {
    try {
      const response = await apiClient.post(`/message/sendWhatsAppAudio/${instanceName}`, {
        number,
        audio: audioBase64,
        options: {
          delay: 1200,
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error sending WhatsApp audio:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Send a media message (image, video, document, etc.)
   */
  async sendMedia(instanceName: string, number: string, mediaData: {
    mediatype: "image" | "video" | "document";
    media: string; // base64 or URL
    caption?: string;
    fileName?: string;
    mimetype?: string;
  }) {
    try {
      const response = await apiClient.post(`/message/sendMedia/${instanceName}`, {
        number,
        mediatype: mediaData.mediatype,
        media: mediaData.media,
        caption: mediaData.caption || "",
        fileName: mediaData.fileName || "",
        mimetype: mediaData.mimetype || "",
        delay: 1200,
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error sending WhatsApp media:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Send a sticker message
   */
  async sendSticker(instanceName: string, number: string, stickerData: string) {
    try {
      const response = await apiClient.post(`/message/sendSticker/${instanceName}`, {
        number,
        sticker: stickerData,
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error sending sticker:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Send a location message
   */
  async sendLocation(instanceName: string, number: string, lat: number, lng: number, name?: string, address?: string) {
    try {
      const response = await apiClient.post(`/message/sendLocation/${instanceName}`, {
        number,
        latitude: lat,
        longitude: lng,
        name: name || "",
        address: address || "",
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error sending location:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Send a contact card
   */
  async sendContact(instanceName: string, number: string, contactName: string, contactPhone: string) {
    try {
      const response = await apiClient.post(`/message/sendContact/${instanceName}`, {
        number,
        contact: [{
          fullName: contactName,
          wuid: contactPhone,
          phoneNumber: contactPhone,
        }],
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error sending contact:", error?.response?.data || error.message);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Chat & Message Operations
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Mark messages as read
   */
  async markMessageAsRead(instanceName: string, remoteJid: string, messageId: string) {
    try {
      const response = await apiClient.post(`/chat/markMessageAsRead/${instanceName}`, {
        readMessages: [{ remoteJid, id: messageId }],
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error marking message as read:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete a message for everyone
   */
  async deleteMessage(instanceName: string, remoteJid: string, messageId: string) {
    try {
      const response = await apiClient.delete(`/chat/deleteMessageForEveryone/${instanceName}`, {
        data: { id: messageId, remoteJid, fromMe: true },
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error deleting message:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Archive a chat
   */
  async archiveChat(instanceName: string, remoteJid: string, archive: boolean = true) {
    try {
      const response = await apiClient.post(`/chat/archiveChat/${instanceName}`, {
        chat: remoteJid,
        archive,
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error archiving chat:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get base64 media from a message
   */
  async getBase64FromMedia(instanceName: string, messageKey: { remoteJid: string; id: string; fromMe: boolean }) {
    try {
      const response = await apiClient.post(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: { key: messageKey },
        convertToMp4: false,
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error getting media base64:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch messages for a specific chat from Evolution API
   */
  async findMessages(instanceName: string, remoteJid: string, count: number = 50) {
    try {
      const response = await apiClient.post(`/chat/findMessages/${instanceName}`, {
        where: { key: { remoteJid } },
        limit: count,
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error finding messages:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Find a specific chat by remoteJid
   */
  async findChatByJid(instanceName: string, remoteJid: string) {
    try {
      const response = await apiClient.get(`/chat/findChatByRemoteJid/${instanceName}?remoteJid=${encodeURIComponent(remoteJid)}`);
      return response.data;
    } catch (error: any) {
      logger.error("Error finding chat:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch profile picture for a number
   */
  async fetchProfilePicture(instanceName: string, number: string) {
    try {
      const response = await apiClient.post(`/chat/fetchProfilePictureUrl/${instanceName}`, {
        number,
      });
      return response.data;
    } catch (error: any) {
      // Profile picture not available is common and not an error
      if (error?.response?.status === 404 || error?.response?.status === 400) {
        return null;
      }
      logger.error("Error fetching profile picture:", error?.response?.data || error.message);
      return null;
    }
  },

  /**
   * Send presence (typing, recording, etc.)
   */
  async sendPresence(instanceName: string, remoteJid: string, presence: "composing" | "recording" | "paused") {
    try {
      const response = await apiClient.post(`/chat/sendPresence/${instanceName}`, {
        id: remoteJid,
        presence,
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error sending presence:", error?.response?.data || error.message);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Contacts & Chats
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a number is on WhatsApp
   */
  async checkNumber(instanceName: string, numbers: string[]) {
    try {
      const response = await apiClient.post(`/chat/whatsappNumbers/${instanceName}`, {
        numbers
      });
      return response.data;
    } catch (error: any) {
      logger.error("Error checking WhatsApp numbers:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch all groups for an instance
   */
  async getGroups(instanceName: string) {
    try {
      const response = await apiClient.get(`/group/fetchAllGroups/${instanceName}?getParticipants=true`);
      return response.data;
    } catch (error: any) {
      logger.error("Error fetching WhatsApp groups:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch all contacts for an instance
   */
  async getContacts(instanceName: string) {
    try {
      const response = await apiClient.post(`/chat/findContacts/${instanceName}`, {});
      return response.data;
    } catch (error: any) {
      logger.error("Error fetching WhatsApp contacts:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch all open chats for an instance
   */
  async getChats(instanceName: string) {
    try {
      const response = await apiClient.post(`/chat/findChats/${instanceName}`, {});
      return response.data;
    } catch (error: any) {
      logger.error("Error fetching WhatsApp chats:", error?.response?.data || error.message);
      throw error;
    }
  },
};
