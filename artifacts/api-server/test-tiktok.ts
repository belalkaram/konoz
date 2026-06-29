import { chromium } from 'playwright';
import { db, tiktokAccountsTable } from '@workspace/db';

async function verify() {
  console.log("Fetching account from DB...");
  const accounts = await db.select().from(tiktokAccountsTable).limit(1);
  if (accounts.length === 0) {
    console.log("No TikTok account found in DB!");
    return;
  }

  const account = accounts[0];
  if (!account.accessToken) {
    console.log("No accessToken found!");
    return;
  }
  console.log(`Found account. AccessToken: ${account.accessToken.substring(0, 30)}...`);

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext();

  // Parse cookies
  const cookies = account.accessToken.split(';').map(c => {
    const [name, ...rest] = c.trim().split('=');
    return {
      name,
      value: rest.join('='),
      domain: '.tiktok.com',
      path: '/'
    };
  });

  await context.addCookies(cookies);

  const page = await context.newPage();
  console.log("Navigating to TikTok...");
  await page.goto("https://www.tiktok.com/");

  await page.waitForTimeout(5000); // wait for page to load

  // Take screenshot
  await page.screenshot({ path: "tiktok_test_screenshot.png" });
  console.log("Screenshot saved to tiktok_test_screenshot.png");

  // Try to find if user is logged in
  const isLoggedIn = await page.evaluate(() => {
    return document.cookie.includes('sessionid') ||
      document.querySelector('a[href^="/@"]') !== null ||
      document.body.innerHTML.includes('Inbox') ||
      document.body.innerHTML.includes('Messages');
  });

  console.log(`IS LOGGED IN: ${isLoggedIn}`);

  const html = await page.content();
  if (html.includes('login-button') || html.includes('Log in')) {
    console.log("Page shows 'Log in' button. Session might be invalid or TikTok is showing captcha.");
  }

  await browser.close();
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
