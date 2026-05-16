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
});

export const WhatsappService = {
  /**
   * Create a new WhatsApp instance for an employee.
   * If it already exists, it might just return the existing info.
   */
  async createInstance(instanceName: string) {
    try {
      // The Evolution API endpoint to create an instance
      const response = await apiClient.post(`/instance/create`, {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS", // Default
        webhook_wa_business: "", // Global webhook from .env will be used or we can specify
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
   * Delete an instance
   */
  async deleteInstance(instanceName: string) {
    try {
      const response = await apiClient.delete(`/instance/delete/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error("Error deleting WhatsApp instance:", error?.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Send a text message
   */
  async sendTextMessage(instanceName: string, number: string, text: string) {
    try {
      const response = await apiClient.post(`/message/sendText/${instanceName}`, {
        number,
        text,
        options: {
          delay: 1200,
          presence: "composing",
        },
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
  }
};
