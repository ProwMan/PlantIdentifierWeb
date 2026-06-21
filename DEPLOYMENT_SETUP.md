# Deployment & Setup Instructions

## Quick Start

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd PlantIdentifierWeb
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

3. **Set Environment Variables**
   Create a `.env.local` file in the root directory:
   ```
   PLANTNET_API_KEY=your_key_here
   FIREBASE_API_KEY=your_key_here
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_id
   FIREBASE_APP_ID=your_app_id
   ```

4. **Run Locally**
   ```bash
   npm run dev
   ```

## Obtaining Required Keys

### 1. PlantNet API Key

1. Visit https://my.plantnet.org/
2. Register a new account
3. Navigate to API section
4. Create a new project
5. Copy your API key

### 2. Firebase Configuration

1. Go to https://console.firebase.google.com/
2. Create or select your project
3. Click Project Settings (gear icon)
4. Under "Your apps", find your web app
5. Copy the Firebase config:
   ```javascript
   {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   }
   ```

## Deployment Options

### Option 1: Vercel Deployment (Recommended for Frontend)

See [VERCEL_HOSTING_GUIDE.md](./VERCEL_HOSTING_GUIDE.md) for complete steps.

Quick summary:
1. Push code to GitHub
2. Visit https://vercel.com/new
3. Import your repository
4. Add environment variables
5. Deploy

### Option 2: Firebase Hosting + Cloud Functions

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize Firebase**
   ```bash
   firebase init
   ```
   Select: Hosting, Functions, Firestore

3. **Configure Functions Environment Variables** (Secure - Not Committed to GitHub)
   
   Create `.env.local` for local development (automatically git-ignored):
   ```
   GMAIL_USER=your-app-account@gmail.com
   GMAIL_PASS=your_gmail_app_password
   ```
   
   **Important**:
   - `GMAIL_USER` = Your app's Gmail account (sends the emails)
   - `GMAIL_PASS` = App password for that account
   - Emails are sent FROM your app account TO selvakumarmadhan819@gmail.com (recipient)

   For Firebase production, set these securely (not in code/git):
   ```bash
   firebase functions:config:set gmail.user="your-app-account@gmail.com"
   firebase functions:config:set gmail.pass="xxxx xxxx xxxx xxxx"
   ```

   **Security Note**: These values are never committed to GitHub. The `.env.local` file is in `.gitignore`.

4. **Deploy**
   ```bash
   npm run build
   firebase deploy
   ```

### Option 3: Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "run", "preview"]
   ```

2. **Build and Push**
   ```bash
   docker build -t plant-identifier .
   docker run -p 3000:3000 plant-identifier
   ```

## Cloud Functions Setup (Optional)

The project includes a scheduled Cloud Function only for sending weekly email reports.

You do not need Firebase Functions to run the main app. The core app works with Firebase Authentication and Firestore only.

### When Functions Are Required

Use Firebase Functions only if you want:
- automated weekly email reports
- scheduled leaderboard emails sent every Monday

If you do not need email reports, you can skip Functions entirely.

### Schedule

- **When**: Every Monday at 09:00 AM Singapore Time
- **Action**: Sends top 10 scorers with their weekly stats
- **Email**: selvakumarmadhan819@gmail.com

### Required Configuration (Only if you enable Functions)

1. **Gmail Setup**
   - Enable 2-factor authentication on your Gmail account
   - Generate an App Password
   - Store in Firebase config

2. **Firestore Rules**
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

3. **Deploy Functions**
   ```bash
   cd functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions
   ```

## Environment Variables Reference

| Variable | Source | Example |
|----------|--------|---------|
| PLANTNET_API_KEY | PlantNet.org | `abc123...` |
| FIREBASE_API_KEY | Firebase Console | `AIzaSy...` |
| FIREBASE_AUTH_DOMAIN | Firebase Console | `myproject.firebaseapp.com` |
| FIREBASE_PROJECT_ID | Firebase Console | `myproject` |
| FIREBASE_STORAGE_BUCKET | Firebase Console | `myproject.appspot.com` |
| FIREBASE_MESSAGING_SENDER_ID | Firebase Console | `123456789` |
| FIREBASE_APP_ID | Firebase Console | `1:123456:web:abc123` |
| GMAIL_USER | Gmail Account | `your_email@gmail.com` |
| GMAIL_PASS | Gmail App Password | Generated from Google Account |

## Vercel Environment Variables Setup

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add each variable from above
3. Select Production, Preview, and Development as needed
4. Redeploy after adding variables

## Build Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## Firestore Database Structure

Expected collections and documents:

```
firestore/
├── discoveries/
│   ├── {docId}
│   │   ├── userId: string
│   │   ├── student: string
│   │   ├── scientificName: string
│   │   ├── commonName: string
│   │   ├── points: number
│   │   ├── confidence: number
│   │   └── foundAt: timestamp
```

## Features

### Daily Discovery Limits

- Users can make up to 10 new discoveries per day (10 points each)
- Users can make up to 10 rediscoveries per day (1 point each)
- Limits reset every day at midnight
- Total possible: 200 points per day per user
- Prevents daily point farming

### Weekly Email Reports

- Top 10 scorers by total points
- Weekly score breakdown
- Daily activity count
- Sent every Monday at 09:00 AM Singapore Time
- HTML formatted email with styling

## Troubleshooting

### Build Failures

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Firebase Connection Issues

1. Check API keys in `.env.local`
2. Verify Firestore rules allow your app
3. Check Firebase quotas in Console

### Email Not Sending

1. Verify Gmail App Password is correct
2. Ensure 2FA is enabled on Gmail
3. Check Cloud Functions logs: `firebase functions:log`
4. Verify email address in code: `selvakumarmadhan819@gmail.com`

### Vercel Deployment Issues

1. Clear Vercel cache and redeploy
2. Check build logs in Vercel dashboard
3. Verify all environment variables are set
4. Ensure Firebase security rules allow requests

## Security Best Practices

1. Never commit `.env.local` or `.env` files
2. Use Vercel/Firebase secret management
3. Implement rate limiting for API calls
4. Validate all user inputs server-side
5. Use HTTPS only
6. Implement CORS properly

## Monitoring

### Vercel Monitoring
- Go to Vercel Dashboard → Analytics
- Monitor performance, usage, and errors

### Firebase Monitoring
- Go to Firebase Console → Performance
- Check database usage and performance

### Function Logs
```bash
firebase functions:log
```
