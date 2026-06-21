# Plant Identifier Web - Complete Setup Guide

## Overview

This is a plant identification and discovery tracking application built with React, Firebase, and Vite. The app allows users to identify plants, track discoveries, compete on a leaderboard, and earn points.

## Recent Enhancements

✅ **Discovery Limit**: Users can only make 10 new discoveries per account (rediscoveries unlimited)
✅ **Weekly Email Reports**: Automated emails sent Mondays with top scorers, scores, and daily activity
✅ **Vercel Integration**: Ready for free tier hosting on Vercel

## Quick Links

### For First-Time Setup
1. **[DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md)** - Complete setup guide for all platforms
2. **[VERCEL_DETAILED_STEPS.md](VERCEL_DETAILED_STEPS.md)** - Step-by-step Vercel deployment (FREE PLAN)
3. **[VERCEL_HOSTING_GUIDE.md](VERCEL_HOSTING_GUIDE.md)** - Comprehensive Vercel guide

### For Understanding Changes
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - What was changed and why
- **[functions/README.md](functions/README.md)** - Cloud Functions setup guide

### For Reference
- **[.env.example](.env.example)** - Environment variables template

## Features

### Core Features
- 🌱 Plant identification using PlantNet API
- 📸 Camera capture for photos
- 🎯 Discovery tracking and collection
- 🏆 Leaderboard system
- 🔐 User authentication with Firebase
- 📍 Location verification (ACS Independent campus)

### New Features Added
- 📊 10 new discoveries limit per user
- 💌 Weekly email reports every Monday
- 📈 Daily activity tracking
- 🏅 Top 10 scorers ranking

## Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

2. **Create Environment File**
   ```bash
   cp .env.example .env.local
   # Fill in your API keys
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   ```
   http://localhost:5173
   ```

### Deploy to Vercel (Recommended)

**Complete step-by-step guide: [VERCEL_DETAILED_STEPS.md](VERCEL_DETAILED_STEPS.md)**

Quick summary:
1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import repository
4. Add 7 environment variables
5. Click Deploy

Takes about 5-10 minutes!

## Environment Variables

Required for the app to function:

```
PLANTNET_API_KEY          # From https://my.plantnet.org
FIREBASE_API_KEY          # From Firebase Console
FIREBASE_AUTH_DOMAIN      # From Firebase Console
FIREBASE_PROJECT_ID       # From Firebase Console
FIREBASE_STORAGE_BUCKET   # From Firebase Console
FIREBASE_MESSAGING_SENDER_ID  # From Firebase Console
FIREBASE_APP_ID           # From Firebase Console
```

Additional for Cloud Functions:

```
GMAIL_USER               # Email address
GMAIL_PASS              # Gmail App Password
```

See [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md#obtaining-required-keys) for how to get each key.

## Daily Discovery Limit Feature

### How It Works

- Each user can make **10 new discoveries per day** (10 points each)
- Each user can make **10 rediscoveries per day** (1 point each)
- Limits reset at midnight
- Total possible per day: 200 points (10 new × 10 + 10 rediscoveries × 1)
- Prevents daily point farming

### Location in Code

[src/routes/index.tsx](src/routes/index.tsx#L385-L415) - `confirmDiscovery` function

## Weekly Email Reports

### What's Included

- **Frequency**: Every Monday at 09:00 AM Singapore Time
- **Recipients**: selvakumarmadhan819@gmail.com
- **Top 10 Scorers** with:
  - Total score accumulated
  - Score earned this week
  - Daily activity count (Monday-Sunday)
  - HTML formatted email

### Cloud Function

Location: [functions/src/index.ts](functions/src/index.ts)

Deploy with:
```bash
firebase deploy --only functions
```

## Build Commands

```bash
npm run dev              # Start development server
npm run dev:host         # Development with network access
npm run build            # Build for production
npm run preview          # Preview production build locally
npm run lint             # Run ESLint checks
npm run format           # Format code with Prettier
```

## Project Structure

```
PlantIdentifierWeb/
├── src/
│   ├── routes/
│   │   ├── __root.tsx      # Root route
│   │   └── index.tsx       # Main app (MODIFIED)
│   ├── components/         # UI components (shadcn)
│   ├── lib/
│   │   ├── firebase.ts     # Firebase config
│   │   ├── api/
│   │   │   └── identify.functions.ts  # PlantNet API
│   │   └── ...
│   ├── styles.css
│   ├── router.tsx
│   └── start.ts
├── functions/             # Cloud Functions (NEW)
│   ├── src/
│   │   └── index.ts      # Email function
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── public/
├── dist/                  # Build output
├── package.json
├── tsconfig.json
├── vite.config.ts
├── firebase.json          # (MODIFIED)
├── vercel.json            # (NEW)
├── .env.example           # (NEW)
├── DEPLOYMENT_SETUP.md    # (NEW)
├── VERCEL_HOSTING_GUIDE.md# (NEW)
├── VERCEL_DETAILED_STEPS.md# (NEW)
└── IMPLEMENTATION_SUMMARY.md# (NEW)
```

## Deployment Options

### Option 1: Vercel (Recommended for Free Plan) ⭐

**Best for**: Frontend-only hosting, automatic deployments, SSL included

- **Cost**: FREE tier available
- **Setup Time**: 5-10 minutes
- **Guide**: [VERCEL_DETAILED_STEPS.md](VERCEL_DETAILED_STEPS.md)

Quotas:
- 100 GB bandwidth/month
- 6,000 build minutes/month
- 12 concurrent serverless functions

### Option 2: Firebase Hosting + Functions

**Best for**: Full Firebase ecosystem integration

- **Cost**: FREE tier available
- **Setup Time**: 10-15 minutes
- **Guide**: [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md#option-2-firebase-hosting--cloud-functions)

### Option 3: Docker

**Best for**: Custom infrastructure, self-hosting

- **Cost**: Varies by hosting provider
- **Setup Time**: 15-20 minutes
- **Guide**: [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md#option-3-docker-deployment)

## Getting API Keys

### PlantNet API Key (30 seconds)
1. Go to https://my.plantnet.org/
2. Register or login
3. Navigate to API section
4. Copy your API key

### Firebase Configuration (2 minutes)
1. Go to https://console.firebase.google.com/
2. Create project (if needed)
3. Go to Settings → Project Settings
4. Select your web app
5. Copy all credentials

### Gmail App Password (1 minute for email reports)
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Generate password
4. Copy the 16-character password

See [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md#obtaining-required-keys) for detailed steps.

## Troubleshooting

### Can't Build Locally
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Vercel Deployment Fails
1. Check [VERCEL_DETAILED_STEPS.md](VERCEL_DETAILED_STEPS.md#troubleshooting)
2. Ensure all environment variables are set
3. Try redeploying via Vercel dashboard

### Firebase Connection Issues
1. Verify API keys in `.env.local`
2. Check Firestore security rules in Firebase Console
3. Ensure Vercel domain is in Firebase authorized domains

### Email Not Sending
1. Verify Gmail App Password is correct
2. Check Cloud Functions deployed: `firebase functions:list`
3. View logs: `firebase functions:log`

More troubleshooting: [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md#troubleshooting)

## Monitoring

### Vercel Monitoring
- Dashboard: https://vercel.com/dashboard
- Analytics: Project → Settings → Analytics
- Logs: Deployments → Click deployment → Logs

### Firebase Monitoring
- Console: https://console.firebase.google.com/
- Firestore usage: Firestore Database → Usage
- Function logs: `firebase functions:log`

## Development

### Tech Stack
- **Frontend**: React 19 + TypeScript
- **Framework**: TanStack Start (React Router 7)
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication)
- **Functions**: Firebase Cloud Functions
- **Build**: Vite
- **Hosting**: Vercel / Firebase

### Key Dependencies
- `@tanstack/react-start` - Full-stack React framework
- `firebase` - Backend & authentication
- `firebase-admin` - Server-side Firebase
- `firebase-functions` - Serverless functions
- `tailwindcss` - Utility-first CSS
- `lucide-react` - Icons
- `zod` - Type validation

### Code Style
- TypeScript strict mode
- ESLint + Prettier configured
- No comments in code (as requested)

## Important Notes

⚠️ **Do not commit `.env.local`** - Add to `.gitignore`

⚠️ **Gmail Setup Required** - Use App Passwords, not your regular password

⚠️ **Firebase Security Rules** - Important for production security

✅ **Free Tier Available** - All services have free tiers

✅ **Auto-Redeploy on Push** - Vercel automatically deploys on git push

## Support & Documentation

- **[VERCEL_DETAILED_STEPS.md](VERCEL_DETAILED_STEPS.md)** - Complete Vercel guide
- **[DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md)** - All deployment options
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - What was changed
- **[functions/README.md](functions/README.md)** - Cloud Functions guide
- **Vercel Docs**: https://vercel.com/docs
- **Firebase Docs**: https://firebase.google.com/docs

## Next Steps

1. **Gather API Keys** - PlantNet, Firebase credentials
2. **Choose Deployment** - Vercel recommended for free tier
3. **Follow Setup Guide** - [VERCEL_DETAILED_STEPS.md](VERCEL_DETAILED_STEPS.md)
4. **Test Locally** - `npm run dev`
5. **Deploy** - Push to GitHub, Vercel auto-deploys
6. **Configure Cloud Functions** - For weekly emails
7. **Monitor** - Check Vercel dashboard

## License

MIT

## Support

For issues or questions:
1. Check [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md#troubleshooting)
2. Check [VERCEL_DETAILED_STEPS.md](VERCEL_DETAILED_STEPS.md#troubleshooting)
3. Check Firebase documentation
4. Check Vercel documentation
