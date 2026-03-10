# 🚀 WakyTalky Deployment Guide

Complete guide to deploying WakyTalky to production.

---

## 📋 Prerequisites

Before deploying, you need:
- GitHub account
- Railway account (for backend)
- Vercel account (for frontend)
- MongoDB Atlas account (free tier works)

---

## 1️⃣ MongoDB Atlas Setup

### Create Database

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0 Sandbox)
3. Provider: AWS, Region: Choose closest to you
4. Click **"Create Cluster"**

### Create Database User

1. Security → Database Access
2. Click **"Add New Database User"**
3. Authentication: Password
4. Username: `wakytalky_user`
5. Password: Generate secure password (save it!)
6. Database User Privileges: **"Atlas admin"**
7. Click **"Add User"**

### Whitelist All IPs

1. Security → Network Access
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
4. Confirm

### Get Connection String

1. Databases → Click **"Connect"**
2. Choose **"Connect your application"**
3. Copy the connection string:
   ```
   mongodb+srv://wakytalky_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password
5. **Save this** - you'll need it for Railway

---

## 2️⃣ Backend Deployment (Railway)

### Initial Setup

1. Go to [Railway](https://railway.app)
2. Sign up / Log in with GitHub
3. Click **"New Project"**
4. Click **"Deploy from GitHub repo"**
5. Select your **WakyTalky** repository
6. Railway will detect it as a Node.js app

### Configure Root Directory

1. Click on your service
2. Go to **"Settings"**
3. Find **"Root Directory"**
4. Set to: `backend`
5. Click **"Save"**

### Set Environment Variables

1. Go to **"Variables"** tab
2. Click **"+ New Variable"** for each:

**MONGODB_URI:**
```
mongodb+srv://wakytalky_user:your_password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**JWT_SECRET:** (Generate secure secret)
```bash
# Run this command to generate:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output and paste as JWT_SECRET value

**NODE_ENV:**
```
production
```

**PORT:**
```
3001
```

3. Click **"Deploy"** or wait for auto-deploy

### Get Backend URL

1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Copy your Railway URL (e.g., `https://wakytalky-production.up.railway.app`)
4. **Save this** - you'll need it for Vercel

### Verify Deployment

Check logs for:
```
✅ Security: Helmet enabled
✅ Security: CORS whitelist active
✅ Security: Rate limiting enabled
✅ Connected to MongoDB
🚀 Server running on port 3001
```

---

## 3️⃣ Frontend Deployment (Vercel)

### Initial Setup

1. Go to [Vercel](https://vercel.com)
2. Sign up / Log in with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your **WakyTalky** repository
5. Vercel will detect it as a React app

### Configure Root Directory

1. In **"Build and Output Settings"**
2. Set **Root Directory** to: `frontend`
3. Framework Preset: **Create React App**

### Set Environment Variables

1. Go to **"Environment Variables"**
2. Add these variables:

**REACT_APP_API_URL:**
```
https://your-railway-url.up.railway.app
```
(Use the Railway URL you saved earlier)

**REACT_APP_WS_URL:**
```
wss://your-railway-url.up.railway.app
```
(Same URL but with `wss://` instead of `https://`)

**CI:**
```
false
```
(This prevents build failures from warnings)

3. Click **"Deploy"**

### Get Frontend URL

After deployment completes:
1. Copy your Vercel URL (e.g., `https://wakytalky.vercel.app`)
2. This is your live app URL!

### Update Backend CORS

Go back to Railway and add frontend URL to whitelist:

1. Railway → Your service → **"Variables"**
2. Add new variable:

**FRONTEND_URL:**
```
https://wakytalky.vercel.app
```

3. Redeploy backend

---

## 4️⃣ Mobile App (Android APK) - Optional

### Prerequisites

- Expo account
- EAS CLI installed globally

### Setup

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Update `mobile/app.json`:
```json
{
  "expo": {
    "name": "WakyTalky",
    "slug": "wakytalky",
    "version": "1.0.0",
    "extra": {
      "webUrl": "https://wakytalky.vercel.app"
    }
  }
}
```

### Build APK

1. Navigate to mobile folder:
```bash
cd mobile
npm install
```

2. Configure EAS:
```bash
eas build:configure
```

3. Build Android APK:
```bash
eas build --platform android --profile preview
```

4. Wait for build (10-20 minutes)
5. Download APK from link provided
6. Share APK file for installation

**Note:** WebView auto-updates when you update the website!

---

## 5️⃣ Post-Deployment Verification

### Test Backend

```bash
# Health check
curl https://your-railway-url.up.railway.app/

# Test registration (should fail with validation error)
curl -X POST https://your-railway-url.up.railway.app/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"weak"}'

# Expected: Password validation error
```

### Test Frontend

1. Visit your Vercel URL
2. Try to register with weak password → Should reject
3. Register with strong password (e.g., `TestUser123`)
4. Login
5. Search for another user
6. Send messages
7. Test dark mode (change system theme)

### Test Rate Limiting

Try logging in 6 times with wrong password:
- First 5 attempts: "Invalid credentials"
- 6th attempt: "Too many login attempts"

### Test CORS

Try accessing API from unauthorized domain → Should block

---

## 🔄 Continuous Deployment

Once set up, deployment is automatic:

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push

# Railway auto-deploys backend
# Vercel auto-deploys frontend
# Wait 2-3 minutes
# Changes are live!
```

---

## 🐛 Troubleshooting

### Backend Won't Start

**Problem:** "JWT_SECRET must be set"
**Fix:** Add JWT_SECRET to Railway variables

**Problem:** "Cannot connect to MongoDB"
**Fix:** Check connection string, verify IP whitelist

### Frontend Build Fails

**Problem:** "Treating warnings as errors"
**Fix:** Add `CI=false` to Vercel environment variables

**Problem:** "Cannot reach backend"
**Fix:** Check REACT_APP_API_URL is correct Railway URL

### WebSocket Connection Fails

**Problem:** "WebSocket connection failed"
**Fix:** Ensure REACT_APP_WS_URL uses `wss://` not `https://`

### CORS Errors

**Problem:** "Blocked by CORS policy"
**Fix:** Add FRONTEND_URL to Railway with your Vercel URL

### Rate Limiting Too Strict

**Problem:** Getting blocked too easily
**Fix:** Adjust limits in `backend/server.js`:
```javascript
const loginLimiter = rateLimit({
  max: 10, // Increase from 5
});
```

---

## 💰 Cost Breakdown

**Free Tier (Recommended for learning):**
- MongoDB Atlas: FREE (M0 Sandbox, 512MB)
- Railway: FREE ($5 credit/month, ~550 hours)
- Vercel: FREE (100GB bandwidth/month)
- **Total: $0/month** ✅

**If you exceed free tier:**
- Railway: ~$5-10/month for small app
- MongoDB Atlas: $9/month (M10 cluster)
- Vercel: Still free for most projects
- **Total: ~$5-20/month**

---

## 🔒 Security Checklist

Before going live, verify:

- [ ] JWT_SECRET is set (64+ characters)
- [ ] MongoDB password is strong
- [ ] CORS whitelist is configured
- [ ] Rate limiting is active (check logs)
- [ ] Password policy enforced (8+ chars, etc.)
- [ ] HTTPS enabled (Railway/Vercel handle this)
- [ ] Environment variables are set correctly
- [ ] No secrets in code (use .env)

---

## 📊 Monitoring

### Railway Logs

View in real-time:
1. Railway Dashboard → Your service
2. Click **"View Logs"**
3. Monitor for errors

### Vercel Logs

1. Vercel Dashboard → Your project
2. Click **"Deployments"**
3. Click latest deployment → **"View Function Logs"**

### MongoDB Metrics

1. MongoDB Atlas → Your cluster
2. Click **"Metrics"**
3. Monitor connections, operations

---

## 🔄 Updates

To update your deployed app:

1. **Make changes locally**
2. **Test locally** (optional but recommended)
3. **Commit and push:**
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```
4. **Wait for auto-deploy** (2-3 minutes)
5. **Verify** the changes are live

**Mobile app:** Automatically updates (WebView)!

---

## 🎯 Custom Domain (Optional)

### For Frontend (Vercel)

1. Vercel → Your project → **"Settings"** → **"Domains"**
2. Add your domain (e.g., `wakytalky.com`)
3. Follow DNS configuration instructions
4. Update Railway FRONTEND_URL to new domain

### For Backend (Railway)

1. Railway → Your service → **"Settings"** → **"Networking"**
2. Add custom domain
3. Configure DNS CNAME record
4. Update Vercel environment variables with new backend URL

---

## 📞 Need Help?

**Deployment stuck?**
- Check logs for error messages
- Verify all environment variables are set
- Ensure root directories are correct (`backend` and `frontend`)

**Still having issues?**
- Check Railway/Vercel status pages
- Review this guide step-by-step
- Open an issue on GitHub

---

## ✅ Success Checklist

Deployment is complete when:

- [ ] Backend is running on Railway (green status)
- [ ] Frontend is live on Vercel
- [ ] Can register new account with strong password
- [ ] Can send/receive messages in real-time
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Rate limiting active (test with bad login)
- [ ] CORS configured (only your frontend works)

---

**🎉 Congratulations! Your app is live!**

Share your Vercel URL with friends and start chatting securely! 🔒
