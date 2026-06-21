# Detailed Vercel Free Plan Hosting Steps

## Phase 1: Preparation (5-10 minutes)

### Step 1.1: Prepare Your Code

Ensure all code is committed to Git:

```bash
cd /Users/madhan/Downloads/PlantIdentifierWeb
git status
```

If you see uncommitted changes:

```bash
git add .
git commit -m "Add discovery limit and email features"
```

### Step 1.2: Create .gitignore Rules

Create or update `.gitignore`:

```
node_modules/
dist/
.env.local
.env.*.local
.DS_Store
*.log
functions/lib/
.firebase/
firebase-debug.log
```

### Step 1.3: Verify Build Works Locally

```bash
npm install
npm run build
```

If build fails, fix errors before proceeding.

### Step 1.4: Push to GitHub

If not already on GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/plant-identifier.git
git push -u origin main
```

## Phase 2: Set Up Vercel Account (5 minutes)

### Step 2.1: Create Vercel Account

1. Go to https://vercel.com/signup
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account
4. Complete profile setup

### Step 2.2: Verify Email

Check your email and verify your Vercel account.

## Phase 3: Deploy Project (10-15 minutes)

### Step 3.1: Import Repository

1. Go to https://vercel.com/dashboard
2. Click "Add New" button (top right)
3. Select "Project"
4. Under "Import Git Repository", find your repository:
   - Search for "plant-identifier" or your repo name
   - Click on the repository to select it
5. Click "Import"

### Step 3.2: Configure Build Settings

Vercel should auto-detect your settings. Verify:

- **Framework Preset**: Vite (or leave blank)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

If not pre-filled, manually enter these values.

### Step 3.3: Add Environment Variables

Under "Environment Variables":

1. Click "Add" for each variable below:

   ```
   PLANTNET_API_KEY
   FIREBASE_API_KEY
   FIREBASE_AUTH_DOMAIN
   FIREBASE_PROJECT_ID
   FIREBASE_STORAGE_BUCKET
   FIREBASE_MESSAGING_SENDER_ID
   FIREBASE_APP_ID
   ```

2. For each variable:
   - Enter the name (e.g., `PLANTNET_API_KEY`)
   - Enter the value
   - Ensure "Production", "Preview", and "Development" are checked
   - Click "Save"

Example for FIREBASE_API_KEY:
- Name: `FIREBASE_API_KEY`
- Value: `AIzaSyD_jKqw...` (your actual key)
- Checkboxes: All checked

### Step 3.4: Obtain Environment Variable Values

Before deploying, gather your keys:

#### PlantNet API Key

1. Go to https://my.plantnet.org/
2. Log in or create account
3. Go to "API" section
4. Create a new project/app
5. Copy the API key

#### Firebase Credentials

1. Go to https://console.firebase.google.com/
2. Select your project
3. Click ⚙️ (Settings icon) → "Project settings"
4. Click on your Web app
5. Copy the config object:

```javascript
apiKey: "FIREBASE_API_KEY"  // Copy this
authDomain: "FIREBASE_AUTH_DOMAIN"  // Copy this
projectId: "FIREBASE_PROJECT_ID"  // Copy this
storageBucket: "FIREBASE_STORAGE_BUCKET"  // Copy this
messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID"  // Copy this
appId: "FIREBASE_APP_ID"  // Copy this
```

### Step 3.5: Paste All Environment Variables

1. Return to Vercel project page
2. Paste each value into the corresponding field
3. Make sure all 7 variables are added:
   - PLANTNET_API_KEY
   - FIREBASE_API_KEY
   - FIREBASE_AUTH_DOMAIN
   - FIREBASE_PROJECT_ID
   - FIREBASE_STORAGE_BUCKET
   - FIREBASE_MESSAGING_SENDER_ID
   - FIREBASE_APP_ID

### Step 3.6: Click Deploy

1. Review all settings
2. Click "Deploy" button
3. Wait for deployment to complete (usually 2-5 minutes)

Watch the progress:
- "Analyzing project..." → Reading your code
- "Installing dependencies..." → Running npm install
- "Building..." → Running npm run build
- "Finalizing..." → Setting up hosting
- "Ready" → Deployment complete!

### Step 3.7: Access Your Site

Once deployment completes:

1. You'll see "Congratulations! Your project is live"
2. Click the URL (e.g., `https://plant-identifier-xyz.vercel.app`)
3. Your app is now live!

## Phase 4: Configure Firebase (10 minutes)

### Step 4.1: Update Firestore Security Rules

1. Go to https://console.firebase.google.com/
2. Select your project
3. Go to "Firestore Database"
4. Click "Rules" tab
5. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /discoveries/{document=**} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.userId;
      allow delete: if request.auth.uid == resource.data.userId;
    }
  }
}
```

6. Click "Publish"

### Step 4.2: Enable CORS in Firebase

1. Go to Firebase Console → Settings → Integrations
2. Ensure your Vercel domain is listed in authorized domains
3. Add Vercel domain if not present:
   - Click "Add domain"
   - Enter `plant-identifier-xyz.vercel.app` (your domain)
   - Click "Add"

## Phase 5: Test Your Deployment (5 minutes)

### Step 5.1: Test Login

1. Open your deployed URL
2. Try logging in with test credentials
3. Verify Firebase connects correctly

### Step 5.2: Test Plant Identification

1. Log in
2. Click "Identify Plant"
3. Take/upload a plant photo
4. Verify identification works
5. Confirm a discovery
6. Check Firestore to see record was saved

### Step 5.3: Test Discovery Limit

1. Confirm 10 new plant discoveries
2. Attempt an 11th new discovery
3. Verify error message appears
4. Confirm you can still log rediscoveries

## Phase 6: Set Up Custom Domain (Optional - 5 minutes)

### Step 6.1: Add Custom Domain

1. Go to Vercel project dashboard
2. Click "Settings" tab
3. Go to "Domains"
4. Click "Add"
5. Enter your domain (e.g., `plant-identifier.com`)
6. Follow DNS configuration instructions

### Step 6.2: Configure DNS

1. Log in to your domain registrar (GoDaddy, Namecheap, etc.)
2. Go to DNS settings
3. Add the CNAME record Vercel provides
4. Wait 24 hours for DNS to propagate

## Phase 7: Cloud Functions Setup (Optional - 15 minutes)

The Cloud Functions setup is only needed if you want automated weekly email reports. If you do not want email reports, skip this entire phase.

### Step 7.1: Set Up Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already enabled
3. Go to https://myaccount.google.com/apppasswords
4. Select "Mail" and "Windows Computer"
5. Click "Generate"
6. Copy the 16-character password

### Step 7.2: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 7.3: Login to Firebase

```bash
firebase login
```

This opens a browser window. Complete the login process.

### Step 7.4: Create `.env.local` for Local Development (Not Committed)

Create a `.env.local` file in the root directory (automatically git-ignored):

```
GMAIL_USER=your-app-account@gmail.com
GMAIL_PASS=xxxx xxxx xxxx xxxx
```

**Important**: 
- `GMAIL_USER` = Your app's Gmail account (this sends the emails)
- `GMAIL_PASS` = App password for your app's Gmail account
- Emails are sent FROM this account TO selvakumarmadhan819@gmail.com
- This file will NOT be committed to GitHub

### Step 7.5: Configure Firebase Functions (Production)

For Firebase production deployment, set environment variables securely using Firebase CLI:

```bash
firebase functions:config:set gmail.user="your-app-account@gmail.com"
firebase functions:config:set gmail.pass="xxxx xxxx xxxx xxxx"
```

These values are stored in Firebase config, not in your code or GitHub.

### Step 7.6: Deploy Functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Wait for deployment to complete. You should see:
```
✔ Deploy complete!
```

### Step 7.7: Verify Functions Deployed

```bash
firebase functions:list
```

You should see `emailWeeklyTopScorers` in the list.

## Phase 8: Set Up Monitoring (5 minutes)

### Step 8.1: Enable Vercel Analytics

1. Go to Vercel Dashboard → Project Settings
2. Click "Analytics"
3. Toggle "Enable Web Analytics"
4. Copy the script ID shown

### Step 8.2: Monitor Function Logs

View Cloud Function logs:

```bash
firebase functions:log
```

Logs will show when your weekly email is sent.

## Phase 9: Maintenance (Ongoing)

### Step 9.1: Deploy Updates

Every time you update code:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Vercel automatically redeploys on push to main branch.

### Step 9.2: Monitor Performance

- Vercel Dashboard → Analytics
- Firebase Console → Firestore Usage
- Check function logs: `firebase functions:log`

### Step 9.3: Update Environment Variables

If you need to change an env var:

1. Go to Vercel Dashboard
2. Click project → Settings → Environment Variables
3. Update the value
4. Click "Save"
5. Redeploy by going to Deployments → Click latest → "Redeploy"

## Vercel Free Plan Quotas

| Feature | Quota |
|---------|-------|
| Concurrent Functions | 12 |
| Bandwidth | 100 GB/month |
| Build Time | 6,000 minutes/month |
| Serverless Functions | Included |
| Deployment Preview | Unlimited |
| Team Members | 1 |
| Custom Domains | 1 |

## Troubleshooting

### Deployment Failed: "Build command failed"

1. Check build log for errors
2. Run locally: `npm run build`
3. Fix any errors shown
4. Commit and push
5. Vercel will redeploy automatically

### Environment Variables Not Working

1. Verify variables are added in Vercel dashboard
2. Go to Deployments
3. Click latest deployment → "Redeploy"
4. Wait for new deployment

### Firebase Connection Failing

1. Check FIREBASE_PROJECT_ID is correct
2. Go to Firebase Console → Settings
3. Copy config again
4. Update in Vercel environment variables
5. Redeploy

### Email Not Sending

1. Check Gmail app password is correct
2. Verify 2FA is enabled on Gmail
3. Check Firebase function logs: `firebase functions:log`
4. Ensure function deployed successfully: `firebase functions:list`

### Domain Not Working

1. Check DNS changes propagated: https://www.whatsmydns.net/
2. Wait up to 48 hours
3. In Vercel settings, verify domain shows "Valid"

## Quick Reference

### URLs to Know

- Vercel Dashboard: https://vercel.com/dashboard
- Firebase Console: https://console.firebase.google.com
- Your Live App: https://plant-identifier-xyz.vercel.app
- PlantNet API: https://my.plantnet.org
- Gmail App Passwords: https://myaccount.google.com/apppasswords

### Essential Commands

```bash
npm run dev                    # Test locally
npm run build                  # Build for production
git push origin main           # Deploy via Vercel
firebase deploy --only functions # Deploy Cloud Functions
firebase functions:log         # View function logs
```

### Important Emails

- Deployment issues: Check Vercel email
- Weekly reports: Sent to selvakumarmadhan819@gmail.com
- Firebase alerts: Check Firebase email

## Support

- Vercel Docs: https://vercel.com/docs
- Firebase Docs: https://firebase.google.com/docs
- Project Repo: Your GitHub repository link
