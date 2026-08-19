import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

interface Discovery {
  id: string;
  student: string;
  scientificName: string;
  commonName: string;
  points: number;
  confidence: number;
  foundAt: string;
  userId: string;
}

interface DailyActivity {
  [day: string]: number;
}

interface StudentWeekly {
  student: string;
  totalScore: number;
  weeklyScore: number;
  activity: DailyActivity;
}

export const emailWeeklyTopScorers = functions.pubsub
  .schedule("every monday 09:00")
  .timeZone("Asia/Singapore")
  .onRun(async () => {
    try {
      const db = admin.firestore();
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const snapshot = await db.collection("discoveries").get();
      const allDiscoveries: Discovery[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Discovery));

      const totalScores: Record<string, number> = {};
      const weeklyScores: Record<string, number> = {};
      const dailyActivity: Record<string, DailyActivity> = {};

      allDiscoveries.forEach((discovery) => {
        const student = discovery.student;
        const discDate = new Date(discovery.foundAt);

        totalScores[student] = (totalScores[student] || 0) + discovery.points;

        if (discDate >= oneWeekAgo) {
          weeklyScores[student] = (weeklyScores[student] || 0) + discovery.points;

          if (!dailyActivity[student]) {
            dailyActivity[student] = {};
          }

          const dayName = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ][discDate.getDay()];

          dailyActivity[student][dayName] =
            (dailyActivity[student][dayName] || 0) + 1;
        }
      });

      const topScorers: StudentWeekly[] = Object.entries(totalScores)
        .map(([student, totalScore]) => ({
          student,
          totalScore,
          weeklyScore: weeklyScores[student] || 0,
          activity: dailyActivity[student] || {},
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);

      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1d1d1f; background: #f5f5f7; }
    .container { max-width: 680px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #00205c 0%, #003d99 100%); padding: 40px; text-align: center; }
    .header h1 { color: #ffc629; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 15px; }
    .content { padding: 32px 40px; }
    .scorer { border-bottom: 1px solid #f0f0f0; padding: 20px 0; display: flex; align-items: center; gap: 16px; }
    .scorer:last-child { border-bottom: none; }
    .rank { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
    .rank-1 { background: linear-gradient(135deg, #ffc629, #e5a500); color: #001030; }
    .rank-2 { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); color: white; }
    .rank-3 { background: linear-gradient(135deg, #cd7f32, #b87333); color: white; }
    .rank-other { background: #f0f0f0; color: #666; }
    .info { flex: 1; min-width: 0; }
    .name { font-weight: 700; font-size: 16px; color: #1d1d1f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .scores { display: flex; gap: 12px; margin-top: 6px; flex-wrap: wrap; }
    .score { font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 8px; }
    .total { background: #fff4e6; color: #916b00; }
    .weekly { background: #e8f5e9; color: #2e7d32; }
    .activity { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .day { font-size: 11px; padding: 3px 8px; background: #f5f5f7; border-radius: 6px; color: #666; }
    .day strong { color: #1d1d1f; }
    .footer { padding: 24px 40px; background: #fafafa; text-align: center; border-top: 1px solid #f0f0f0; }
    .footer p { margin: 0; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🌿 Weekly Plant Spotter Leaderboard</h1>
        <p>Top 10 Scorers for the Week</p>
      </div>
      <div class="content">
`;

      topScorers.forEach((scorer, index) => {
        const days = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ];
        const activityList = days
          .map(
            (day) =>
              `<span class="day"><strong>${day.slice(0, 3)}</strong>: ${scorer.activity[day] || 0}</span>`
          )
          .join("");

        const rankClass = index === 0 ? "rank-1" : index === 1 ? "rank-2" : index === 2 ? "rank-3" : "rank-other";

        htmlContent += `
        <div class="scorer">
          <div class="rank ${rankClass}">${index + 1}</div>
          <div class="info">
            <div class="name">${scorer.student}</div>
            <div class="scores">
              <span class="score total">Total: ${scorer.totalScore} pts</span>
              <span class="score weekly">This Week: ${scorer.weeklyScore} pts</span>
            </div>
            <div class="activity">${activityList}</div>
          </div>
        </div>
`;
      });

      htmlContent += `
      </div>
      <div class="footer">
        <p>Report generated on ${new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}</p>
        <p style="margin-top: 8px; font-size: 12px;">Environment Focus Group • ACS Independent</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: "selvakumarmadhan819@gmail.com",
        subject: `Weekly Plant Spotter Leaderboard - ${new Date().toLocaleDateString()}`,
        html: htmlContent,
      });

      console.log("Weekly email sent successfully");
      return null;
    } catch (error) {
      console.error("Error sending weekly email:", error);
      throw error;
    }
  });