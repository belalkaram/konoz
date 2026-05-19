export function normalizeWhatsAppNumber(value: string | any): { phone: string | null; isResolved: boolean; reason?: string } {
  if (!value) {
    return { phone: null, isResolved: false, reason: "Empty value" };
  }

  let raw = "";

  if (typeof value === "string") {
    raw = value;
  } else if (typeof value === "object" && value !== null) {
    raw = value.remoteJid || value.jid || value.phoneNumber || value.phone || value.number || value.participant || value.id || "";
  }

  if (!raw || typeof raw !== "string") {
    return { phone: null, isResolved: false, reason: "No identifier found" };
  }

  // If it's a group or broadcast, it's not a direct contact
  if (raw.includes("@g.us") || raw.includes("status@broadcast")) {
    return { phone: null, isResolved: false, reason: "Group or Broadcast JID" };
  }

  // Handle @lid (Linked Devices/Phone numbers hidden by WhatsApp)
  if (raw.includes("@lid")) {
    return { phone: null, isResolved: false, reason: "Hidden number (@lid)" };
  }

  // Remove valid suffixes
  const cleaned = raw.replace("@s.whatsapp.net", "").replace("@c.us", "").trim();

  // Validate if it only contains digits (with optional + at the beginning)
  const isPhoneNumber = /^\+?\d+$/.test(cleaned);

  if (isPhoneNumber) {
    return { phone: cleaned, isResolved: true };
  }

  return { phone: null, isResolved: false, reason: "Not a valid phone number" };
}
