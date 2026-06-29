import { chromium } from "playwright";
import { randomBytes } from "crypto";
import { logger } from "./logger.js";
import { db, tiktokAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
interface QRSession {
  sessionId: string;
  status: "pending" | "scanned" | "success" | "failed" | "expired";
  qrDataUrl: string | null;
  username: string | null;
  createdAt: number;
  browser?: any;
}

export const qrSessions = new Map<string, QRSession>();

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function startTiktokQRSession(employeeId: number): Promise<{ sessionId: string, qrDataUrl: string }> {
  const sessionId = randomBytes(16).toString("hex");
  
  const session: QRSession = {
    sessionId,
    status: "pending",
    qrDataUrl: null,
    username: null,
    createdAt: Date.now(),
  };
  
  qrSessions.set(sessionId, session);
  
  // Clean up old sessions
  for (const [key, val] of qrSessions.entries()) {
    if (Date.now() - val.createdAt > SESSION_TIMEOUT_MS) {
      if (val.browser) {
        val.browser.close().catch(() => {});
      }
      qrSessions.delete(key);
    }
  }

  // Start browser in background
  (async () => {
    try {
      logger.info({ sessionId }, "Starting TikTok headless browser for QR login");
      const browser = await chromium.launch({
        headless: false, // Show browser to bypass bot detection and allow manual captcha solving
        channel: "msedge", // Use local Edge/Chrome to save disk space
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }).catch(async (e) => {
        logger.warn({ err: e }, "Failed to launch Edge, trying Chrome...");
        return await chromium.launch({
          headless: false,
          channel: "chrome",
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      });
      session.browser = browser;

      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });
      
      const page = await context.newPage();
      
      // Go to the specific QR login page
      await page.goto("https://www.tiktok.com/login/qrcode", { waitUntil: "networkidle" });
      
      // Wait for the QR code canvas to render
      const qrCanvasSelector = 'canvas'; // TikTok typically renders QR inside a canvas element on the login page
      await page.waitForSelector(qrCanvasSelector, { timeout: 15000 });
      
      // Wait a tiny bit to ensure it's fully painted
      await page.waitForTimeout(1000);
      
      // Extract the QR code as base64 data URL
      const qrDataUrl = await page.evaluate((selector) => {
        const canvas = (globalThis as any).document.querySelector(selector) as any;
        return canvas ? canvas.toDataURL() : null;
      }, qrCanvasSelector);
      
      if (!qrDataUrl) {
        throw new Error("Could not extract QR code canvas data");
      }
      
      session.qrDataUrl = qrDataUrl;
      logger.info({ sessionId }, "QR code captured successfully");
      
      // Wait for successful login by polling the URL
      try {
        session.status = "scanned"; // Assume scanned once QR is shown, though they still need to scan
        let isLoggedIn = false;
        
        // Poll for up to 120 seconds (60 attempts * 2 seconds)
        for (let i = 0; i < 60; i++) {
          await page.waitForTimeout(2000);
          
          // Check URL first
          const currentUrl = page.url();
          if (!currentUrl.includes("login/qrcode") && !currentUrl.includes("/login")) {
            isLoggedIn = true;
            break;
          }
          
          // Check cookies safely with a timeout to avoid CDP hangs
          const cookies = await Promise.race([
            context.cookies(),
            new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 3000))
          ]);
          
          const hasSession = cookies.some(c => c.name === "sessionid" || c.name === "tt_webid");
          
          if (hasSession) {
            isLoggedIn = true;
            break;
          }
        }
        
        if (isLoggedIn) {
          logger.info({ sessionId }, "Login successful!");
          
          const cookies = await context.cookies();
          // Save all cookies as a serialized string for API requests later
          const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
          
          // Try to extract username
          let username = "user_" + Math.random().toString(36).substring(7);
          try {
            // Attempt to read the username from the UI or state
            const profileLink = await page.$('a[href^="/@"]');
            if (profileLink) {
              const href = await profileLink.getAttribute("href");
              if (href) {
                username = href.replace("/", "").replace("@", "");
              }
            }
          } catch (e) {
            logger.warn({ err: e }, "Failed to extract exact username, using fallback");
          }
          
          session.username = username;
          session.status = "success";
          
          // Save to database
          await db.insert(tiktokAccountsTable).values({
            employeeId,
            username,
            accessToken: cookieString,
            connectionStatus: "connected",
          }).onConflictDoUpdate({
            target: tiktokAccountsTable.employeeId,
            set: {
              username,
              accessToken: cookieString,
              connectionStatus: "connected",
              updatedAt: new Date(),
            }
          });
          
        } else {
          logger.warn({ sessionId }, "Polling finished but URL did not change");
          session.status = "failed";
        }
        
      } catch (e) {
        logger.warn({ sessionId, err: e }, "QR scan monitoring failed");
        session.status = "expired";
      }
      
    } catch (err) {
      logger.error({ err, sessionId }, "TikTok QR generation failed");
      session.status = "failed";
    } finally {
      // Close browser when done
      if (session.browser) {
        await session.browser.close().catch(() => {});
      }
    }
  })();

  // Poll locally until the QR code is extracted
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (session.qrDataUrl) {
        clearInterval(interval);
        resolve({ sessionId, qrDataUrl: session.qrDataUrl });
      } else if (session.status === "failed" || attempts > 120) { // 60s timeout
        clearInterval(interval);
        reject(new Error("Failed to generate QR code (timeout)"));
      }
    }, 500);
  });
}
