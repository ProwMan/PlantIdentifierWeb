# Cloud Functions Setup

This directory contains Firebase Cloud Functions for the Plant Identifier application.

## Environment Variables (Never Commit to GitHub)

The `emailWeeklyTopScorers` function requires the following environment variables. **These should never be committed to GitHub.**

### For Local Development

Create a `.env.local` file in the root directory (automatically git-ignored):
```
GMAIL_USER=your-app-account@gmail.com
GMAIL_PASS=your_gmail_app_password
```

**Important**:
- `GMAIL_USER` = Your app's Gmail account (this account sends the emails)
- `GMAIL_PASS` = App password for that Gmail account
- Emails are sent FROM this account TO selvakumarmadhan819@gmail.com

### For Firebase Production Deployment

Set environment variables using Firebase CLI (stored securely in Firebase, not in code):

```bash
firebase functions:config:set gmail.user="your-app-account@gmail.com"
firebase functions:config:set gmail.pass="your_app_password"
```

**Important**: Never put the app password in code files or commit to GitHub.

## Gmail App Password Setup

1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer" (or your device)
3. Generate an app password
4. Use this password in the firebase config above

## Deploy Functions

```bash
npm install
npm run build
firebase deploy --only functions
```

## Scheduled Function

`emailWeeklyTopScorers` - Runs every Monday at 09:00 Singapore Time
- Collects top 10 scorers from the week
- Includes total score, weekly score, and daily activity
- Sends email to selvakumarmadhan819@gmail.com
