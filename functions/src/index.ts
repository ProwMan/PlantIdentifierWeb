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
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c5f2d; text-align: center; }
    .scorer-card { 
      border: 1px solid #ddd; 
      padding: 15px; 
      margin-bottom: 15px; 
      border-radius: 8px; 
      background-color: #f9f9f9; 
    }
    .scorer-name { font-size: 18px; font-weight: bold; color: #2c5f2d; }
    .scores { margin: 10px 0; }
    .score-item { margin: 5px 0; }
    .total { color: #d4a574; font-weight: bold; }
    .weekly { color: #667d3e; font-weight: bold; }
    .activity { margin-top: 10px; }
    .day { display: inline-block; margin-right: 10px; }
    .timestamp { font-size: 12px; color: #999; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌿 Weekly Plant Spotter Leaderboard 🌿</h1>
    <p style="text-align: center; color: #666;">Top 10 Scorers for the Week</p>
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
              `<span class="day"><strong>${day}</strong>: ${scorer.activity[day] || 0}</span>`
          )
          .join("");

        htmlContent += `
    <div class="scorer-card">
      <div class="scorer-name">#${index + 1} ${scorer.student}</div>
      <div class="scores">
        <div class="score-item"><span class="total">Total Score: ${scorer.totalScore} pts</span></div>
        <div class="score-item"><span class="weekly">This Week: ${scorer.weeklyScore} pts</span></div>
      </div>
      <div class="activity">
        <strong>Daily Activity:</strong><br/>
        ${activityList}
      </div>
    </div>
`;
      });

      htmlContent += `
    <div class="timestamp">
      Report generated on ${new Date().toLocaleString("en-SG", {
        timeZone: "Asia/Singapore",
      })}
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
