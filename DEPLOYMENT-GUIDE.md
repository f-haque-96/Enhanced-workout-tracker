# 🏋️ HIT Tracker Pro - Deployment Guide

## What You'll Do (Overview)
1. Clean up the old project on your Pi5
2. Upload the new project to GitHub
3. Download it to your Pi5
4. Start the dashboard with Docker
5. Access it from any device via Tailscale

---

## 📋 Prerequisites Checklist
Before starting, make sure you have:
- [ ] Your Pi5 is powered on and connected to your network
- [ ] You can access your Pi5 (we'll use Terminal/SSH)
- [ ] Docker is installed on your Pi5 (we'll check this)
- [ ] Tailscale is installed and connected
- [ ] Your GitHub account is ready

---

## Step 1: Connect to Your Pi5

### On Mac:
1. Open **Terminal** (search for it in Spotlight with Cmd+Space)
2. Type this command and press Enter:
   ```
   ssh pi@192.168.1.73
   ```
3. Enter your password when asked (you won't see it as you type - that's normal!)

### On Windows:
1. Open **PowerShell** or **Command Prompt**
2. Type this command and press Enter:
   ```
   ssh pi@192.168.1.73
   ```
3. Enter your password when asked

### On iPhone/iPad:
1. Download **Termius** app from App Store
2. Add new host: 192.168.1.73, username: pi
3. Connect and enter your password

---

## Step 2: Clean Up the Old Project

Now that you're connected to your Pi5, let's remove the old project.

Copy and paste these commands ONE BY ONE, pressing Enter after each:

```bash
# Stop any running Docker containers
docker stop $(docker ps -q) 2>/dev/null

# Remove old containers
docker rm $(docker ps -a -q) 2>/dev/null

# Remove old images (this frees up space)
docker image prune -a -f

# Remove old project folder (if it exists)
rm -rf ~/Enhanced-workout-tracker
rm -rf ~/workout-tracker
rm -rf ~/fitness-dashboard
```

✅ **Done!** Your Pi5 is now clean.

---

## Step 3: Upload New Project to GitHub

### On Your Computer (not the Pi5):

1. **Download the project files** from Claude (the fitness-dashboard folder)

2. **Open Terminal/Command Prompt** on your computer

3. **Navigate to the downloaded folder:**
   ```bash
   cd ~/Downloads/fitness-dashboard
   ```
   (adjust path if you saved it elsewhere)

4. **Initialize Git and push to your repo:**
   ```bash
   # Remove old git history if any
   rm -rf .git
   
   # Initialize fresh repo
   git init
   git add .
   git commit -m "HIT Tracker Pro v2.0 - Enhanced Dashboard"
   
   # Connect to your GitHub repo
   git remote add origin https://github.com/f-haque-96/Enhanced-workout-tracker.git
   
   # Push (force to overwrite old code)
   git push -f origin main
   ```

   **If asked for credentials:**
   - Username: your GitHub username
   - Password: use a Personal Access Token (not your password)
     - Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new token

✅ **Done!** Your code is now on GitHub.

---

## Step 4: Download to Your Pi5

Go back to your Pi5 terminal (from Step 1) and run:

```bash
# Go to home directory
cd ~

# Download the project from GitHub
git clone https://github.com/f-haque-96/Enhanced-workout-tracker.git hit-tracker-pro

# Go into the project folder
cd hit-tracker-pro

# Make the scripts executable
chmod +x scripts/*.sh
```

✅ **Done!** The project is now on your Pi5.

---

## Step 5: Start the Dashboard

Still in your Pi5 terminal, run:

```bash
# Build and start the dashboard
docker-compose up -d --build
```

⏳ **This will take 5-10 minutes** the first time (it's downloading and building everything).

You'll see lots of text scrolling - that's normal!

### Check if it's working:
```bash
# See running containers
docker ps
```

You should see two containers:
- `hit-tracker-frontend`
- `hit-tracker-backend`

---

## Step 6: Access Your Dashboard! 🎉

### From your home network:
Open a browser and go to:
```
http://192.168.1.73:8080
```

### From anywhere (via Tailscale):
First, get your Tailscale IP:
```bash
tailscale ip -4
```

Then open a browser and go to:
```
http://[YOUR-TAILSCALE-IP]:8080
```

For example: `http://100.80.30.43:8080`

---

## 🔄 Syncing Your Data

### Sync with Hevy:
1. In the dashboard, click the **⋮ menu** (top right)
2. Click **"Hevy Export (JSON)"**
3. Upload your Hevy export file

**To export from Hevy:**
1. Open Hevy app → Settings → Export Data
2. Choose JSON format
3. Save the file
4. Upload to HIT Tracker Pro

### Sync with Apple Health:
1. On your iPhone, go to **Health app**
2. Tap your profile picture → **Export All Health Data**
3. This creates a zip file
4. Transfer to your computer
5. Upload via the dashboard menu

---

## 📱 Access from All Your Devices

**With Tailscale installed on each device:**

| Device | How to Access |
|--------|--------------|
| iPhone | Safari → `http://100.80.30.43:8080` |
| iPad | Safari → `http://100.80.30.43:8080` |
| Mac | Any browser → `http://100.80.30.43:8080` |
| Windows | Any browser → `http://100.80.30.43:8080` |

**Pro tip:** Add it to your home screen on iPhone:
1. Open the URL in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Now it looks like a real app!

---

## 🛠️ Troubleshooting

### "Cannot connect to Pi5"
- Make sure your Pi5 is on
- Try: `ping 192.168.1.73` from your computer
- If using Tailscale, make sure both devices are connected

### "Page won't load"
Check if Docker is running:
```bash
docker ps
```

If containers aren't running, restart them:
```bash
cd ~/hit-tracker-pro
docker-compose down
docker-compose up -d
```

### "Docker command not found"
Install Docker:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker pi
```
Then log out and back in.

### View logs for debugging:
```bash
docker-compose logs -f
```
Press Ctrl+C to exit logs.

---

## 🔁 Useful Commands

| What you want to do | Command |
|---------------------|---------|
| Start the dashboard | `docker-compose up -d` |
| Stop the dashboard | `docker-compose down` |
| Restart everything | `docker-compose restart` |
| View logs | `docker-compose logs -f` |
| Update from GitHub | `git pull && docker-compose up -d --build` |
| Check what's running | `docker ps` |
| Free up disk space | `docker system prune -f` |

---

## 🎉 You Did It!

Your HIT Tracker Pro dashboard is now:
- ✅ Running on your Pi5
- ✅ Accessible from any device via Tailscale
- ✅ Syncing with Hevy for workout data
- ✅ Syncing with Apple Health for HR, calories, conditioning

**Questions?** Just ask! I'm here to help.
