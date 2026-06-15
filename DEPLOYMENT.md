# KH Attendance System — Deployment Guide

Complete guide to deploying the Worker Attendance System for free, generating an Android APK, and configuring notifications.

---

## Architecture

```
┌─────────────────────┐     HTTPS      ┌─────────────────────┐
│   Netlify (FREE)    │ ──────────────→ │  Render.com (FREE)  │
│   Static Frontend   │   API Proxy     │   Node.js Backend   │
│   React + Vite PWA  │ ←────────────── │   Express + SQLite  │
│   *.netlify.app     │                 │   *.onrender.com    │
└─────────────────────┘                 └─────────────────────┘
         │                                       │
    PWA / TWA APK                          Push Notifications
    (via PWABuilder)                      (Web Push / VAPID)
```

---

## Step 1: Deploy Backend to Render.com

### 1.1 Push Code to GitHub
1. Create a new GitHub repository (e.g., `kh-attendance`)
2. Push the entire project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/kh-attendance.git
   git push -u origin main
   ```

### 1.2 Create Render Web Service
1. Go to [render.com](https://render.com) and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `kh-msg-server`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate && npx prisma db push && node prisma/seed.js`
   - **Start Command**: `node src/index.js`
   - **Instance Type**: Free

### 1.3 Set Environment Variables
In Render dashboard → Environment tab, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `file:./prisma/dev.db` |
| `JWT_SECRET` | (generate a random string, e.g., `openssl rand -hex 32`) |
| `REFRESH_SECRET` | (generate a different random string) |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://YOUR-SITE.netlify.app` (update after Netlify deploy) |
| `MANAGER_DEFAULT_PIN` | `123456` |

### 1.4 Add Persistent Disk (Optional but Recommended)
For SQLite persistence:
1. Go to **Disks** tab
2. Add a disk:
   - **Name**: `sqlite-data`
   - **Mount Path**: `/opt/render/project/src/prisma`
   - **Size**: 1 GB

> ⚠️ Without a disk, the SQLite database resets when the server restarts.

### 1.5 Note Your Backend URL
After deployment, note the URL (e.g., `https://kh-msg-server.onrender.com`)

---

## Step 2: Deploy Frontend to Netlify

### 2.1 Update Client Environment
Edit `client/.env.production`:
```
VITE_API_URL=https://kh-msg-server.onrender.com
```

### 2.2 Update Netlify Config
Edit `client/netlify.toml` — replace all instances of `https://kh-msg-server.onrender.com` with your actual Render URL.

### 2.3 Deploy to Netlify
1. Go to [netlify.com](https://netlify.com) and sign up (free)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect your GitHub repo
4. Configure:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
5. Click **Deploy**

### 2.4 Update CORS on Render
Go back to Render → Environment variables → Update:
```
CORS_ORIGIN=https://YOUR-SITE.netlify.app
```

---

## Step 3: Generate Android APK

### Option A: PWABuilder (Easiest — No coding needed)
1. Go to [pwabuilder.com](https://www.pwabuilder.com/)
2. Enter your Netlify URL (e.g., `https://kh-msg.netlify.app`)
3. PWABuilder will analyze your PWA manifest
4. Click **"Package for stores"** → **"Android"**
5. Choose **"Google Play"** (TWA - Trusted Web Activity)
6. Configure:
   - **Package ID**: `com.kh.attendance`
   - **App Name**: `KH Attendance`
   - **Start URL**: `/`
   - **Icon**: Upload the 512x512 icon from `client/public/icons/`
7. Download the APK
8. Install on Android: Transfer the APK and tap to install (enable "Install from unknown sources")

### Option B: Bubblewrap CLI (More control)
```bash
# Install Bubblewrap
npm install -g @nicosalm/nicosalm

# Initialize TWA project
bubblewrap init --manifest https://YOUR-SITE.netlify.app/manifest.webmanifest

# Build APK
bubblewrap build
```

### Digital Asset Links (For Play Store)
After generating your signing key, update `client/public/.well-known/assetlinks.json` with your SHA256 fingerprint:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.kh.attendance",
    "sha256_cert_fingerprints": ["YOUR_SHA256_HERE"]
  }
}]
```

---

## Step 4: Configure Notifications

### How It Works
1. **Master sets the timer**: In the Manager Dashboard → Settings → Notification Timer, set the daily reminder time (e.g., `08:30`)
2. **Workers enable notifications**: When a worker logs in, they see "Enable Daily Reminders" banner → click "Enable"
3. **Automatic reminders**: Every day at the set time, workers who haven't punched in receive a push notification
4. **Test notifications**: Master can click "Send Test Notification" in Settings to verify push is working

### Notification Flow
```
Master sets time (e.g., 08:30)
        │
        ▼
  Cron job runs every minute
        │
  Is it 08:30? ──No──→ Skip
        │
       Yes
        │
        ▼
  Find workers who haven't punched in today
        │
        ▼
  Send push notification to their subscribed devices
        │
        ▼
  Worker phone shows notification: "Please mark your attendance!"
```

---

## Step 5: Using the System

### Default Credentials
| Role | Username/ID | PIN |
|------|------------|-----|
| Manager | `manager` | `123456` |
| Worker (1-50) | `WRK-001` to `WRK-050` | `123456` |

> Workers must change their PIN on first login.

### Master Features
- ✅ Dashboard overview with real-time stats
- ✅ Daily attendance logs with present/absent tracking
- ✅ Worker management (add, edit, delete, activate/deactivate)
- ✅ PIN reset for workers
- ✅ Notification timer configuration
- ✅ Test notification sender
- ✅ CSV export of attendance data
- ✅ Profile management

### Worker Features
- ✅ Daily attendance punch-in with role selection
- ✅ Push notification reminders
- ✅ PIN change on first login
- ✅ PWA — installable as an app on phone

---

## Troubleshooting

### "Server is sleeping" (Render free tier)
- Render free tier puts the server to sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- Solution: Use a free cron service like [cron-job.org](https://cron-job.org) to ping your `/health` endpoint every 14 minutes

### Push notifications not working
1. Make sure the app is served over HTTPS (Netlify provides this)
2. Workers must click "Enable" to allow notifications
3. Check browser DevTools → Application → Service Workers
4. Use the "Send Test Notification" button in Manager Settings

### Cookie/Auth issues in production
- Ensure `CORS_ORIGIN` in Render matches your Netlify URL exactly
- Check that cookies are being set (DevTools → Application → Cookies)

### Database reset on Render
- Add a persistent disk to prevent data loss (see Step 1.4)
- Or upgrade to PostgreSQL: Change `schema.prisma` provider to `postgresql` and use Neon.tech (free)
