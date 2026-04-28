import { Router } from "express";
import { requireAdmin } from "../middlewares/auth.js";
import { getAllActiveSessions, deleteSession } from "../lib/sessions.js";

const router = Router();

router.get("/admin/sessions", requireAdmin, async (req, res) => {
  try {
    const sessions = await getAllActiveSessions();
    res.json({ sessions });
  } catch (err) {
    req.log.error({ err }, "Error listing active sessions");
    res.status(500).json({ error: "server_error", message: "Failed to list sessions" });
  }
});

router.delete("/admin/sessions/:token", requireAdmin, async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== "string" || token.length < 10) {
    res.status(400).json({ error: "validation_error", message: "Invalid session token" });
    return;
  }
  try {
    await deleteSession(token);
    req.log.info(
      { event: "security:session_revoked", actorId: req.employee?.employeeId, ip: req.ip },
      "Session revoked by admin"
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error revoking session");
    res.status(500).json({ error: "server_error", message: "Failed to revoke session" });
  }
});

export default router;
