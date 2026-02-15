# 🚀 Deployment Guide

This guide covers deploying your E2E encrypted messaging app to production.

## Table of Contents
1. [Backend Deployment](#backend-deployment)
2. [Web App Deployment](#web-app-deployment)
3. [Mobile App Deployment](#mobile-app-deployment)
4. [Desktop App Deployment](#desktop-app-deployment)
5. [Domain & SSL Setup](#domain--ssl-setup)
6. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Backend Deployment

### Option 1: DigitalOcean / AWS / GCP

#### 1. Provision Server
```bash
# Ubuntu 22.04 LTS recommended
# Minimum: 1 CPU, 2GB RAM
# Recommended: 2 CPU, 4GB RAM for production
```

#### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Install PM2 for process management
sudo npm install -g pm2
```

#### 3. Deploy Application
```bash
# Clone your repository
git clone https://github.com/yourusername/encrypted-messenger.git
cd encrypted-messenger/backend

# Install dependencies
npm install --production

# Create .env file
nano .env
```

**Production .env:**
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://localhost:27017/encrypted-messenger
JWT_SECRET=GENERATE_STRONG_RANDOM_SECRET_HERE
ALLOWED_ORIGINS=https://yourdomain.com
MAX_FILE_SIZE=52428800
```

#### 4. Configure MongoDB Security
```bash
# Create admin user
mongosh

use admin
db.createUser({
  user: "admin",
  pwd: "STRONG_PASSWORD_HERE",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

use encrypted-messenger
db.createUser({
  user: "messenger_app",
  pwd: "ANOTHER_STRONG_PASSWORD",
  roles: [{ role: "readWrite", db: "encrypted-messenger" }]
})
exit

# Enable authentication
sudo nano /etc/mongod.conf
```

Add:
```yaml
security:
  authorization: enabled
```

Update .env:
```env
MONGODB_URI=mongodb://messenger_app:ANOTHER_STRONG_PASSWORD@localhost:27017/encrypted-messenger?authSource=encrypted-messenger
```

#### 5. Start with PM2
```bash
# Start application
pm2 start server.js --name encrypted-messenger

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it shows
```

#### 6. Setup Nginx Reverse Proxy
```bash
sudo apt install nginx

sudo nano /etc/nginx/sites-available/encrypted-messenger
```

**Nginx Configuration:**
```nginx
upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/encrypted-messenger /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 7. Setup SSL with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

#### 8. Setup Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Option 2: Docker Deployment

```bash
# On your server
git clone https://github.com/yourusername/encrypted-messenger.git
cd encrypted-messenger

# Update docker-compose.yml with production settings
nano docker-compose.yml

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option 3: Heroku

```bash
# Install Heroku CLI
# Create Heroku app
heroku create your-app-name

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set JWT_SECRET=your-random-secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Scale dynos
heroku ps:scale web=1
```

---

## Web App Deployment

### Option 1: Vercel (Recommended for React)

```bash
# Install Vercel CLI
npm i -g vercel

cd frontend

# Deploy
vercel

# Production deployment
vercel --prod
```

**vercel.json:**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ],
  "env": {
    "REACT_APP_API_URL": "https://api.yourdomain.com",
    "REACT_APP_WS_URL": "wss://api.yourdomain.com"
  }
}
```

### Option 2: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

cd frontend

# Build
npm run build

# Deploy
netlify deploy --prod --dir=build
```

**netlify.toml:**
```toml
[build]
  command = "npm run build"
  publish = "build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  REACT_APP_API_URL = "https://api.yourdomain.com"
  REACT_APP_WS_URL = "wss://api.yourdomain.com"
```

### Option 3: Self-Hosted with Nginx

```bash
# Build frontend
cd frontend
npm run build

# Copy to server
scp -r build/* user@yourserver:/var/www/encrypted-messenger/
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/encrypted-messenger;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Mobile App Deployment

### iOS (App Store)

#### 1. Build with Expo
```bash
cd mobile

# Build for iOS
eas build --platform ios

# Download .ipa file when complete
```

#### 2. Requirements
- Apple Developer Account ($99/year)
- Mac with Xcode
- App Store Connect account

#### 3. Submit to App Store
1. Create app in App Store Connect
2. Upload build using Xcode or Transporter
3. Fill app information
4. Submit for review

### Android (Google Play)

#### 1. Build with Expo
```bash
cd mobile

# Build for Android
eas build --platform android

# Download .aab file when complete
```

#### 2. Requirements
- Google Play Developer Account ($25 one-time)
- Signing keys configured

#### 3. Submit to Play Store
1. Create app in Play Console
2. Upload .aab file
3. Fill app information
4. Submit for review

### Alternative: Standalone APK (Android)
```bash
# Build APK for direct distribution
eas build --platform android --profile preview

# Share APK file directly (not through Play Store)
```

---

## Desktop App Deployment

### Building for All Platforms

```bash
cd desktop

# Build for current OS
npm run build

# Or build for specific platform:
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### Distribution Methods

#### 1. GitHub Releases
```bash
# Tag version
git tag v1.0.0
git push --tags

# Upload built files to GitHub Releases
# Users download installers directly
```

#### 2. Auto-Update Setup

Install electron-updater:
```bash
npm install electron-updater
```

**main.js:**
```javascript
const { autoUpdater } = require('electron-updater');

app.on('ready', () => {
  createWindow();
  
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();
});
```

**package.json:**
```json
{
  "build": {
    "publish": [{
      "provider": "github",
      "owner": "yourusername",
      "repo": "encrypted-messenger"
    }]
  }
}
```

---

## Domain & SSL Setup

### 1. Purchase Domain
- Namecheap, Google Domains, or Cloudflare

### 2. DNS Configuration
```
A Record:     yourdomain.com       -> YOUR_SERVER_IP
A Record:     api.yourdomain.com   -> YOUR_SERVER_IP
CNAME Record: www.yourdomain.com   -> yourdomain.com
```

### 3. SSL Certificate
- Use Let's Encrypt (free)
- Or use Cloudflare (free SSL + CDN)

### 4. Update App Configurations

**Frontend .env:**
```
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WS_URL=wss://api.yourdomain.com
```

**Mobile app.json:**
```json
{
  "extra": {
    "apiUrl": "https://api.yourdomain.com",
    "wsUrl": "wss://api.yourdomain.com"
  }
}
```

---

## Monitoring & Maintenance

### 1. Server Monitoring

**Install monitoring tools:**
```bash
# PM2 monitoring
pm2 install pm2-logrotate

# Server monitoring with Netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### 2. Application Monitoring

**Add health check endpoint (server.js):**
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});
```

**Use UptimeRobot or Pingdom** to monitor:
- https://api.yourdomain.com/health

### 3. Database Backups

**Automated MongoDB backups:**
```bash
#!/bin/bash
# backup-mongo.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR

mongodump --uri="mongodb://messenger_app:PASSWORD@localhost:27017/encrypted-messenger" \
  --out="$BACKUP_DIR/backup_$DATE"

# Keep only last 7 backups
ls -t $BACKUP_DIR | tail -n +8 | xargs -I {} rm -rf $BACKUP_DIR/{}
```

**Setup cron job:**
```bash
crontab -e

# Daily backup at 2 AM
0 2 * * * /home/user/backup-mongo.sh
```

### 4. Log Management

**Configure log rotation:**
```bash
sudo nano /etc/logrotate.d/encrypted-messenger
```

```
/var/log/encrypted-messenger/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    missingok
    sharedscripts
}
```

### 5. Security Updates

```bash
# Setup automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

**Update dependencies regularly:**
```bash
# Check for outdated packages
npm outdated

# Update with care
npm update
npm audit fix
```

---

## Performance Optimization

### 1. Enable Redis for Session Storage

```bash
# Install Redis
sudo apt install redis-server

# Update backend to use Redis
npm install redis connect-redis
```

### 2. CDN for Static Assets

- Use Cloudflare CDN
- Configure caching headers
- Compress images

### 3. Database Indexing

```javascript
// Add indexes to MongoDB
db.messages.createIndex({ from: 1, to: 1, timestamp: -1 });
db.users.createIndex({ username: 1 }, { unique: true });
```

---

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
pm2 logs encrypted-messenger

# Check MongoDB connection
mongosh
```

### WebSocket Connection Issues
- Ensure firewall allows WebSocket connections
- Check CORS settings
- Verify wss:// (not ws://) in production

### File Upload Failures
- Check disk space
- Verify nginx client_max_body_size
- Check folder permissions

---

## Cost Estimates

### Monthly Costs (Approximate)

**Backend Server:**
- DigitalOcean Droplet: $12-24/month
- AWS EC2 t3.small: $15-20/month
- Heroku Hobby: $7/month

**Database:**
- Self-hosted MongoDB: $0 (included with server)
- MongoDB Atlas: $0-9/month
- Heroku MongoDB addon: $0-9/month

**Frontend:**
- Vercel/Netlify: $0 (free tier sufficient)
- Self-hosted: $0 (same server as backend)

**Domain:**
- $10-15/year

**SSL Certificate:**
- Let's Encrypt: $0 (free)

**Mobile:**
- Apple Developer: $99/year
- Google Play: $25 one-time

**Total Minimum:** ~$20-30/month + one-time fees

---

## Next Steps

1. ✅ Deploy backend to server
2. ✅ Deploy frontend to hosting
3. ✅ Configure domain and SSL
4. ✅ Test all features in production
5. ✅ Setup monitoring and backups
6. ✅ Submit mobile apps to stores
7. ✅ Build and distribute desktop apps
8. ✅ Monitor and maintain

**Congratulations! Your secure messaging platform is live! 🎉**
