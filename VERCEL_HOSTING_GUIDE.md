# Vercel Hosting Guide for Plant Identifier Web

## Prerequisites

1. Node.js 18+ installed
2. Git repository initialized
3. GitHub, GitLab, or Bitbucket account
4. Vercel account (free)

## Step 1: Prepare Your Project

1. Ensure your project is pushed to a Git repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/plant-identifier.git
   git push -u origin main
   ```

2. Remove any local environment files from git:
   ```bash
   echo ".env.local" >> .gitignore
   echo ".env.*.local" >> .gitignore
   git add .gitignore
   git commit -m "Update gitignore"
   git push
   ```

## Step 2: Create Vercel Account

1. Go to https://vercel.com/signup
2. Sign up using GitHub, GitLab, or Bitbucket
3. Verify your email

## Step 3: Connect Repository to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Select your Git provider (GitHub/GitLab/Bitbucket)
4. Search for and select your repository
5. Click "Import"

## Step 4: Configure Project Settings

### Build Settings

The project should auto-detect settings. Verify:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Environment Variables

1. In the "Environment Variables" section, add:

   ```
   PLANTNET_API_KEY=your_plantnet_api_key
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   FIREBASE_APP_ID=your_firebase_app_id
   ```

2. To get Firebase credentials:
   - Go to Firebase Console → Project Settings
   - Under "Your apps", select your web app
   - Copy the config object values

3. To get PlantNet API key:
   - Register at https://my.plantnet.org/
   - Get your API key from settings

### Custom Domain (Optional)

1. After initial deployment, go to "Settings" → "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., plant-identifier.com)
4. Follow DNS configuration instructions

## Step 5: Deploy

1. Click "Deploy"
2. Wait for build to complete (typically 2-5 minutes)
3. Once complete, you'll get a deployment URL like `https://plant-identifier-xxx.vercel.app`

## Step 6: Configure Firebase Security Rules

1. Go to Firebase Console
2. Navigate to Firestore Database → Rules
3. Update with appropriate rules:

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

## Step 7: Set Up Firebase Hosting (Optional)

If using Firebase Hosting instead of Vercel:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login:
   ```bash
   firebase login
   ```

3. Initialize project:
   ```bash
   firebase init
   ```

4. Build and deploy:
   ```bash
   npm run build
   firebase deploy
   ```

## Step 8: Configure Cloud Functions for Email Reports

1. Install Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Set up environment variables for Cloud Functions (use your app's Gmail account):
   ```bash
   firebase functions:config:set gmail.user="your-app-account@gmail.com" gmail.pass="your_gmail_app_password"
   ```
   
   **Note**: This is your app's own Gmail account (not the recipient's). Emails will be sent FROM this account TO selvakumarmadhan819@gmail.com.

4. Deploy functions:
   ```bash
   cd functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions
   ```

5. For Gmail App Password (of your app's Gmail account):
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Generate password and use it above

## Step 9: Enable CORS for API Calls

In Vercel project settings:

1. Add to `vercel.json`:
   ```json
   {
     "headers": [
       {
         "source": "/api/(.*)",
         "headers": [
           { "key": "Access-Control-Allow-Origin", "value": "*" },
           { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
           { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
         ]
       }
     ]
   }
   ```

## Step 10: Monitor Deployments

1. Every git push to main branch automatically deploys
2. View deployment status in Vercel dashboard
3. Check logs: Click deployment → "Logs" tab
4. Rollback if needed: Click previous deployment → "Promote to Production"

## Step 11: Set Up Analytics (Optional)

1. In Vercel dashboard → Settings → Analytics
2. Enable Web Analytics
3. View performance metrics at https://vercel.com/analytics

## Free Plan Limitations

- **Serverless Functions**: 12 concurrent executions
- **Bandwidth**: 100 GB/month
- **Build**: 6,000 build minutes/month
- **Deployments**: Unlimited
- **Team members**: 1 (can add guests)

## Troubleshooting

### Build Fails

```bash
npm run build
```

Run locally to see errors.

### Environment Variables Not Working

1. Verify variables are added in Vercel dashboard
2. Redeploy after adding variables
3. Check that variable names match code exactly

### Firebase Connection Issues

1. Check Firebase security rules allow your domain
2. Verify API key is correct
3. Ensure Firebase project is active

### Performance Issues

1. Optimize images: Use next/image or similar
2. Code splitting: Already handled by Vite
3. Monitor bundle size: https://vercel.com/analytics

## Maintenance

### Regular Updates

```bash
npm update
npm audit
npm run build
git push
```

### Monitor Logs

```bash
firebase functions:log
```

### Check Firestore Usage

Firebase Console → Firestore → Usage tab

## Additional Resources

- Vercel Docs: https://vercel.com/docs
- Firebase Docs: https://firebase.google.com/docs
- React Router Docs: https://tanstack.com/router/latest
- Vite Docs: https://vitejs.dev/
