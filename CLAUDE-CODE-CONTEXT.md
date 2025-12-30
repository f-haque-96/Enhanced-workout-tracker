# HIT Tracker Pro - Claude Code Deployment Context

## 🎯 OBJECTIVE
Deploy the HIT Tracker Pro fitness dashboard to my Raspberry Pi 5, replacing an old failed project. The dashboard integrates Hevy (workout tracking) with Apple Health (HR, calories, conditioning).

---

## 🔔 HEVY WEBHOOK - INSTANT SYNC!

**GREAT NEWS:** Hevy supports webhooks! This means workouts sync INSTANTLY when you finish them.

### How It Works:
```
You finish workout in Hevy app
        ↓ (INSTANT - within seconds!)
Hevy sends POST to your Pi5
        ↓
Backend receives webhook
        ↓
Dashboard updates automatically 🎉
```

### Webhook Setup (After Deployment):
1. Go to Hevy app → Settings → Developer
2. In "Url you want to get notified on", enter:
   ```
   http://100.80.30.43:8080/api/hevy/webhook
   ```
3. In "Your authorization header", enter:
   ```
   Bearer hit-tracker-webhook-secret-2024
   ```
4. Click **Subscribe**

### Backup Auto-Sync:
Even without webhook, the backend syncs every 15 minutes automatically.

---

## 📍 CURRENT SITUATION

### My Setup:
- **Pi5 IP (Local):** 192.168.1.73
- **Pi5 Username:** pi
- **Pi5 Tailscale IP:** 100.80.30.43
- **Target Port:** 8080 (frontend), 3001 (backend)
- **GitHub Repo:** https://github.com/f-haque-96/Enhanced-workout-tracker.git
- **Hevy API Key:** 63d8a8e8-e4b5-408b-bf03-aa06ea80a5f1

### What's on the Pi5 Currently:
- An OLD failed workout tracker project (needs complete removal)
- Docker is installed
- Tailscale is installed and connected
- The old project may have Docker containers/images/volumes still running

### What I Want:
1. **Clean removal** of the old project (containers, images, volumes, folders)
2. **Fresh deployment** of HIT Tracker Pro with Docker
3. **Accessible via Tailscale** from all my devices (iPhone, iPad, Mac)
4. **Working Hevy integration** for workout data (sets, reps, weights)
5. **Working Apple Health integration** for HR, calories, conditioning sessions

---

## 📁 PROJECT STRUCTURE NEEDED

```
hit-tracker-pro/
├── docker-compose.yml        # Orchestrates frontend + backend
├── Dockerfile.frontend       # Builds React app with nginx
├── nginx.conf               # Proxies /api to backend
├── package.json             # Frontend dependencies
├── vite.config.js           # Vite config
├── tailwind.config.js       # Tailwind CSS
├── postcss.config.js        # PostCSS
├── index.html               # Entry HTML
├── src/
│   ├── App.jsx              # Main React component (2000+ lines)
│   ├── main.jsx             # React entry point
│   └── index.css            # Tailwind imports
├── backend/
│   ├── Dockerfile           # Backend container
│   ├── package.json         # Backend dependencies
│   └── server.js            # Express API server
└── scripts/
    ├── cleanup-old-project.sh
    └── deploy.sh
```

---

## 🔑 KEY FEATURES OF THE DASHBOARD

### My 5 Key Lifts (with Hevy name mapping):
1. **Incline Bench Press** - Maps to "Incline Bench Press (Barbell)", "Incline Bench Press (Dumbbell)", etc.
2. **Shoulder Press** - Maps to "Shoulder Press (Dumbbell)", "Overhead Press (Barbell)", etc.
3. **Squat** - Maps to "Squat (Barbell)", "Back Squat (Barbell)", etc.
4. **Lat Pulldown** - Maps to "Lat Pulldown (Cable)", "Wide Grip Lat Pulldown", etc.
5. **Deadlift** - Maps to "Deadlift (Barbell)", "Conventional Deadlift", etc. (NOT Romanian DL)

### Data Source Integration:
- **Hevy** → Sets, Reps, Weight, RPE (for Push/Pull/Legs strength workouts)
- **Apple Health (Strength)** → Duration, HR, Calories for "Traditional Strength Training"
- **Apple Health (Conditioning)** → ALL data for Swimming, Walking, Running, Cycling, HIIT

### Set Types:
- **Warmup (W)** - Yellow - Prepare muscles
- **Working (S)** - Blue - Main training volume  
- **Failure (F)** - Red - RPE 10 (HIT methodology)

### Tooltips with Strength Standards:
Each key lift shows BW ratio, vs average %, and standards (Beginner → Elite)

### Achievement Panel:
Milestones for strength (1x BW Incline, 1.5x BW Squat, etc.), consistency, and conditioning

---

## 🚀 DEPLOYMENT STEPS NEEDED

### Step 1: Clean Up Pi5
SSH into pi@192.168.1.73 and:
```bash
# Stop all Docker containers
docker stop $(docker ps -q) 2>/dev/null

# Remove all containers
docker rm $(docker ps -a -q) 2>/dev/null

# Remove all images
docker image prune -a -f

# Remove old volumes
docker volume prune -f

# Remove old project directories
rm -rf ~/Enhanced-workout-tracker
rm -rf ~/workout-tracker  
rm -rf ~/fitness-dashboard
rm -rf ~/hit-tracker-pro
```

### Step 2: Prepare Local Project
On my local machine:
- Ensure all project files are ready
- The project should be in a folder ready to push to GitHub

### Step 3: Push to GitHub
```bash
cd [project-folder]
rm -rf .git
git init
git add .
git commit -m "HIT Tracker Pro v2.0 - Clean deployment"
git remote add origin https://github.com/f-haque-96/Enhanced-workout-tracker.git
git branch -M main
git push -f origin main
```

### Step 4: Deploy on Pi5
SSH into Pi5 and:
```bash
cd ~
git clone https://github.com/f-haque-96/Enhanced-workout-tracker.git hit-tracker-pro
cd hit-tracker-pro
docker-compose up -d --build
```

### Step 5: Verify Deployment
- Check containers are running: `docker ps`
- Test frontend: `curl http://localhost:8080`
- Test backend: `curl http://localhost:3001/api/health`

---

## ⚠️ IMPORTANT NOTES

1. **SSH Access:** Use `ssh pi@192.168.1.73` - I'll provide the password if needed
2. **Docker:** Already installed on Pi5
3. **Tailscale:** Already running on Pi5, IP is 100.80.30.43
4. **Port 8080:** Should be free after cleanup (old project used it)
5. **Hevy API:** Key is already in the code, ready to use
6. **Apple Health:** Users upload XML export via the dashboard

---

## 📋 CHECKLIST FOR SUCCESS

- [ ] Old Docker containers stopped and removed
- [ ] Old Docker images removed
- [ ] Old project folders deleted
- [ ] New code pushed to GitHub
- [ ] Code cloned to Pi5
- [ ] Docker containers built and running
- [ ] Frontend accessible on port 8080
- [ ] Backend API responding on port 3001
- [ ] Accessible via Tailscale IP (100.80.30.43:8080)

---

## 🆘 IF SOMETHING GOES WRONG

### View logs:
```bash
docker-compose logs -f
```

### Restart containers:
```bash
docker-compose down
docker-compose up -d
```

### Check disk space:
```bash
df -h
```

### Check Docker status:
```bash
systemctl status docker
```

---

## 💬 CONTEXT FOR CLAUDE CODE

I'm a beginner with deployment/DevOps. Please:
1. Explain what you're doing at each step
2. Wait for confirmation before destructive operations
3. Show me the output of commands so I know what's happening
4. If something fails, explain why and how to fix it

The goal is a working dashboard at http://100.80.30.43:8080 that I can access from my iPhone, iPad, and Mac via Tailscale.
