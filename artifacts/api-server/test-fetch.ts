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
  const cookieString = account.accessToken;
  
  console.log(`Testing fetch with cookie...`);
  
  try {
    const res = await fetch("https://www.tiktok.com/passport/web/account/info/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Cookie": cookieString,
        "Accept": "application/json, text/plain, */*"
      }
    });
    
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text.substring(0, 500)}...`);
    
    const data = JSON.parse(text);
    if (data.data && data.data.user_id) {
       console.log("VALID! User ID:", data.data.user_id);
    } else {
       console.log("INVALID or missing user_id");
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
  
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
