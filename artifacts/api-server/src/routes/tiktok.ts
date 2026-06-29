import { Router } from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import { db, tiktokAccountsTable, tiktokMessagesTable, tiktokCommentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";
import { startTiktokQRSession, qrSessions } from "../lib/tiktok-browser.js";
const router = Router();

// ==========================================
// TIKTOK ACCOUNT CONNECTION
// ==========================================

/**
 * POST /api/tiktok/auth/qr/start
 * Starts a headless browser to generate the TikTok QR code.
 */
router.post("/tiktok/auth/qr/start", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const result = await startTiktokQRSession(employeeId);
    res.status(200).json(result); // { sessionId, qrDataUrl }
  } catch (err) {
    req.log.error({ err }, "Error starting TikTok QR session");
    res.status(500).json({ error: "server_error", message: "Failed to generate QR code. TikTok may be blocking the request." });
  }
});

/**
 * POST /api/tiktok/auth/session
 * Manually connect using a session ID cookie value.
 */
router.post("/tiktok/auth/session", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { sessionId } = req.body;
  
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "validation_error", message: "sessionId is required" });
  }
  
  try {
    // Format as a proper cookie string
    const cookieString = sessionId.includes("sessionid=") ? sessionId : `sessionid=${sessionId}`;
    
    // Validate the session ID by making a quick request to TikTok
    const tiktokRes: any = await fetch("https://www.tiktok.com/passport/web/account/info/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Cookie": cookieString,
        "Accept": "application/json, text/plain, */*"
      }
    });
    
    const text = await tiktokRes.text();
    let username = "manual_user_" + Math.random().toString(36).substring(7);
    let isValid = false;
    let tiktokUserId: string | undefined;
    let secUserIdVal: string | undefined;
    
    try {
      const data = JSON.parse(text);
      if (data.data && data.data.user_id) {
        isValid = true;
        if (data.data.username) {
          username = data.data.username;
        }
        tiktokUserId = data.data.user_id_str || String(data.data.user_id);
        secUserIdVal = data.data.sec_user_id;
      }
    } catch (e) {
      req.log.error({ err: e, text }, "Failed to parse TikTok validation response");
    }
    
    if (!isValid) {
      return res.status(400).json({ 
        error: "invalid_session", 
        message: "Invalid or expired Session ID. Please check and try again." 
      });
    }
    
    await db.insert(tiktokAccountsTable).values({
      employeeId,
      username,
      tiktokUserId: tiktokUserId ?? null,
      refreshToken: secUserIdVal ?? null, // Store secUid in refreshToken field for now
      accessToken: cookieString,
      connectionStatus: "connected",
    }).onConflictDoUpdate({
      target: tiktokAccountsTable.employeeId,
      set: {
        username,
        tiktokUserId: tiktokUserId ?? null,
        refreshToken: secUserIdVal ?? null,
        accessToken: cookieString,
        connectionStatus: "connected",
        updatedAt: new Date(),
      }
    });
    
    return res.status(200).json({ success: true, username });
  } catch (err) {
    req.log.error({ err }, "Error saving manual TikTok session");
    return res.status(500).json({ error: "server_error", message: "Failed to save session ID" });
  }
});

/**
 * GET /api/tiktok/auth/qr/status
 * Poll this endpoint to check if the QR has been scanned successfully.
 */
router.get("/tiktok/auth/qr/status", requireAuth, (req, res) => {
  const sessionId = req.query.sessionId as string;
  
  if (!sessionId) {
    return res.status(400).json({ error: "validation_error", message: "sessionId is required" });
  }
  
  const session = qrSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: "not_found", message: "Session expired or not found" });
  }
  
  return res.json({
    sessionId: session.sessionId,
    status: session.status,
    username: session.username,
  });
});

/**
 * GET /api/tiktok/status
 * Gets the current TikTok account status.
 */
router.get("/tiktok/status", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const [account] = await db
      .select()
      .from(tiktokAccountsTable)
      .where(eq(tiktokAccountsTable.employeeId, employeeId));
      
    if (!account) {
      return res.json({ connectionStatus: "disconnected" });
    }
    
    return res.json(account);
  } catch (err) {
    req.log.error({ err }, "Error getting TikTok status");
    return res.status(500).json({ error: "server_error", message: "Failed to get TikTok status" });
  }
});

/**
 * POST /api/tiktok/auth/unlink
 * Unlinks the TikTok account.
 */
router.post("/tiktok/auth/unlink", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    await db.delete(tiktokAccountsTable).where(eq(tiktokAccountsTable.employeeId, employeeId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error unlinking TikTok account");
    res.status(500).json({ error: "server_error", message: "Failed to unlink TikTok account" });
  }
});

// ==========================================
// TIKTOK DIRECT MESSAGES
// ==========================================

/**
 * GET /api/tiktok/messages
 * Retrieves DM conversations.
 */
router.get("/tiktok/messages", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const [account] = await db
      .select()
      .from(tiktokAccountsTable)
      .where(eq(tiktokAccountsTable.employeeId, employeeId));
      
    if (!account) return res.status(404).json({ error: "not_found", message: "TikTok account not linked" });
    if (!account.accessToken) return res.status(400).json({ error: "no_token", message: "No access token" });
    
    // Return local messages from DB for now (DMs require WebSocket which is not feasible via simple fetch)
    const messages = await db
      .select()
      .from(tiktokMessagesTable)
      .where(eq(tiktokMessagesTable.accountId, account.id))
      .orderBy(desc(tiktokMessagesTable.timestamp))
      .limit(100);
      
    return res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Error fetching TikTok messages");
    return res.status(500).json({ error: "server_error", message: "Failed to fetch TikTok messages" });
  }
});

/**
 * POST /api/tiktok/messages
 * Sends a DM.
 */
router.post("/tiktok/messages", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { receiverId, content } = req.body;
  
  if (!receiverId || !content) return res.status(400).json({ error: "validation_error", message: "receiverId and content are required" });
  
  try {
    const [account] = await db
      .select()
      .from(tiktokAccountsTable)
      .where(eq(tiktokAccountsTable.employeeId, employeeId));
      
    if (!account) return res.status(404).json({ error: "not_found", message: "TikTok account not linked" });
    
    // MOCK: Sending message via TikTok API would go here
    
    const [message] = await db.insert(tiktokMessagesTable).values({
      accountId: account.id,
      senderId: account.tiktokUserId || account.username || "me",
      receiverId,
      content,
      isFromMe: true,
      status: "sent",
    }).returning();
    
    return res.json(message);
  } catch (err) {
    req.log.error({ err }, "Error sending TikTok message");
    return res.status(500).json({ error: "server_error", message: "Failed to send TikTok message" });
  }
});

// ==========================================
// TIKTOK VIDEOS (from live TikTok API)
// ==========================================

/**
 * GET /api/tiktok/videos
 * Fetches user's videos directly from TikTok.
 */
router.get("/tiktok/videos", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const [account] = await db
      .select()
      .from(tiktokAccountsTable)
      .where(eq(tiktokAccountsTable.employeeId, employeeId));
      
    if (!account) return res.status(404).json({ error: "not_found", message: "TikTok account not linked" });
    if (!account.accessToken) return res.json([]);
    
    const secUid = account.refreshToken;
    if (!secUid) return res.json([]);
    
    const tiktokHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Cookie": account.accessToken,
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.tiktok.com/",
    };
    
    const videosRes: any = await fetch(
      `https://www.tiktok.com/api/post/item_list/?aid=1988&count=20&secUid=${encodeURIComponent(secUid)}&cursor=0`,
      { headers: tiktokHeaders }
    );
    const videosData = (await videosRes.json()) as any;
    
    if (!videosData || !videosData.itemList || videosData.itemList.length === 0) {
      return res.json([]);
    }
    
    const videos = videosData.itemList.map((v: any) => ({
      id: v.id,
      desc: v.desc || "",
      createTime: new Date((v.createTime || 0) * 1000).toISOString(),
      stats: v.stats || {},
      cover: v.video?.cover || "",
      author: v.author?.uniqueId || account.username,
    }));
    
    return res.json(videos);
  } catch (err) {
    req.log.error({ err }, "Error fetching TikTok videos");
    return res.status(500).json({ error: "server_error", message: "Failed to fetch TikTok videos" });
  }
});

// ==========================================
// TIKTOK COMMENTS
// ==========================================

/**
 * GET /api/tiktok/comments
 * Retrieves comments.
 */
router.get("/tiktok/comments", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const [account] = await db
      .select()
      .from(tiktokAccountsTable)
      .where(eq(tiktokAccountsTable.employeeId, employeeId));
      
    if (!account) return res.status(404).json({ error: "not_found", message: "TikTok account not linked" });
    if (!account.accessToken) return res.json([]);
    
    const secUid = account.refreshToken; // We stored secUid in refreshToken
    if (!secUid) return res.json([]);
    
    const tiktokHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Cookie": account.accessToken,
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.tiktok.com/",
    };
    
    // 1. Fetch user's videos
    const videosRes: any = await fetch(
      `https://www.tiktok.com/api/post/item_list/?aid=1988&count=10&secUid=${encodeURIComponent(secUid)}&cursor=0`,
      { headers: tiktokHeaders }
    );
    const videosData = (await videosRes.json()) as any;
    
    if (!videosData || !videosData.itemList || videosData.itemList.length === 0) {
      return res.json([]);
    }
    
    // 2. Fetch comments for each video (up to first 5 videos)
    const allComments: any[] = [];
    for (const video of videosData.itemList.slice(0, 5)) {
      if ((video.stats?.commentCount ?? 0) === 0) continue;
      
      try {
        const commRes: any = await fetch(
          `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${video.id}&count=20&cursor=0&app_name=tiktok_web`,
          { headers: tiktokHeaders }
        );
        const commData = (await commRes.json()) as any;
        
        if (commData && commData.comments && commData.comments.length > 0) {
          for (const c of commData.comments) {
            allComments.push({
              id: c.cid,
              videoId: video.id,
              videoDesc: video.desc || "Video",
              authorId: c.user?.uid || c.user?.unique_id || "unknown",
              authorName: c.user?.nickname || c.user?.unique_id || "Unknown",
              authorAvatar: c.user?.avatar_thumb?.url_list?.[0] || "",
              content: c.text,
              likes: c.digg_count || 0,
              timestamp: new Date((c.create_time || 0) * 1000).toISOString(),
              isFromMe: false,
            });
          }
        }
      } catch (e) {
        req.log.warn({ err: e, videoId: video.id }, "Failed to fetch comments for video");
      }
    }
    
    return res.json(allComments);
  } catch (err) {
    req.log.error({ err }, "Error fetching TikTok comments");
    return res.status(500).json({ error: "server_error", message: "Failed to fetch TikTok comments" });
  }
});

/**
 * POST /api/tiktok/comments/reply
 * Sends a reply to a comment.
 */
router.post("/tiktok/comments/reply", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { videoId, repliedToCommentId, content } = req.body;
  
  if (!videoId || !repliedToCommentId || !content) {
    return res.status(400).json({ error: "validation_error", message: "videoId, repliedToCommentId and content are required" });
  }
  
  try {
    const [account] = await db
      .select()
      .from(tiktokAccountsTable)
      .where(eq(tiktokAccountsTable.employeeId, employeeId));
      
    if (!account) return res.status(404).json({ error: "not_found", message: "TikTok account not linked" });
    
    // MOCK: Sending reply via TikTok API would go here
    
    const [reply] = await db.insert(tiktokCommentsTable).values({
      accountId: account.id,
      videoId,
      authorId: account.tiktokUserId || account.username || "me",
      authorName: account.username || "me",
      content,
      repliedToCommentId,
      isFromMe: true,
    }).returning();
    
    return res.json(reply);
  } catch (err) {
    req.log.error({ err }, "Error replying to TikTok comment");
    return res.status(500).json({ error: "server_error", message: "Failed to reply to TikTok comment" });
  }
});

// ==========================================
// TIKTOK WEBHOOK
// ==========================================
router.post("/tiktok/webhook", async (req, res) => {
  // TikTok sends webhooks here. Verify signature and process incoming events.
  // For now, this is a mock endpoint.
  res.json({ success: true });
});

export default router;
