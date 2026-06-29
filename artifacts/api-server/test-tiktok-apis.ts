import { db, tiktokAccountsTable } from '@workspace/db';

async function testAPIs() {
  const accounts = await db.select().from(tiktokAccountsTable).limit(1);
  if (accounts.length === 0 || !accounts[0].accessToken) {
    console.log("No account found!");
    process.exit(1);
  }

  const cookie = accounts[0].accessToken;
  const secUid = "MS4wLjABAAAAbQKB7LdBXqb829mwMUU7j3nku6BkeB_d0qYjtxuLceo_3O9SpX5Y8WZYDuiVVA0X";
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Cookie": cookie,
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.tiktok.com/",
  };

  // 1. Get videos with full stats
  console.log("=== Getting Videos with Full Item Data ===");
  const videosRes = await fetch(`https://www.tiktok.com/api/post/item_list/?aid=1988&count=5&secUid=${encodeURIComponent(secUid)}&cursor=0`, { headers });
  const videosData = await videosRes.json();
  
  if (!videosData.itemList || videosData.itemList.length === 0) {
    console.log("No videos found!");
    process.exit(0);
  }

  // Print full first video item to see all fields
  const firstVideo = videosData.itemList[0];
  console.log("First video full keys:", Object.keys(firstVideo));
  console.log("Stats:", JSON.stringify(firstVideo.stats));
  console.log("Statistics:", JSON.stringify(firstVideo.statistics));
  console.log("CommentCount from stats:", firstVideo.stats?.commentCount);

  // 2. Try comment API with different parameters (status_code 5 means signature/token issue)
  console.log("\n=== Comment API with different approaches ===");
  
  // Try with msToken  
  const urls = [
    `https://www.tiktok.com/api/comment/list/?WebIdLastTime=1&aid=1988&app_language=en&app_name=tiktok_web&aweme_id=${firstVideo.id}&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=122&count=20&cursor=0`,
    `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${firstVideo.id}&count=20&cursor=0&app_name=tiktok_web`,
  ];
  
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      console.log(`Status code: ${data.status_code}`);
      if (data.comments) {
        console.log(`Found ${data.comments.length} comments!`);
        for (const c of data.comments.slice(0, 3)) {
          console.log(`  @${c.user?.nickname}: ${c.text}`);
        }
      } else {
        console.log(`No comments. Msg: ${data.status_msg}`);
      }
    } catch (e) { console.error("Error:", e); }
  }

  // 3. Try the old TikTok profile page to get public video data
  console.log("\n=== Profile Page API ===");
  try {
    const res = await fetch(`https://www.tiktok.com/api/user/detail/?secUid=${encodeURIComponent(secUid)}&uniqueId=belalkaram8`, { headers });
    const data = await res.json();
    console.log("Status:", data.status_code);
    if (data.userInfo) {
      console.log("Username:", data.userInfo.user?.uniqueId);
      console.log("Followers:", data.userInfo.stats?.followerCount);
      console.log("Following:", data.userInfo.stats?.followingCount);
      console.log("Hearts:", data.userInfo.stats?.heartCount);
      console.log("Videos:", data.userInfo.stats?.videoCount);
    }
  } catch (e) { console.error("Error:", e); }

  process.exit(0);
}

testAPIs().catch(err => {
  console.error(err);
  process.exit(1);
});
