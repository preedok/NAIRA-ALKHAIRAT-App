# Auto-Deploy Setup Guide

Panduan untuk setup auto-deployment dari GitHub ke VPS.

## Setiap Ada Perubahan → Auto Deploy

Agar setiap perubahan otomatis ter-deploy ke VPS:

1. **Commit perubahan**
   ```bash
   git add .
   git commit -m "Deskripsi perubahan"
   ```

2. **Push ke master** (memicu auto deploy backend + frontend)
   ```bash
   npm run push
   ```
   atau: `git push origin master`

Setelah push, GitHub Actions akan menjalankan deploy ke VPS (backend: npm ci, migrate, pm2 restart; frontend: npm ci, build). Cek status di tab **Actions** di repository GitHub.

### Jika belum terdeploy (manual deploy)

**Cara 1 – Dari Windows (PowerShell di folder project):**

```powershell
.\deploy\run-deploy-from-windows.ps1
```

Masukkan password SSH ketika diminta. Script akan pull kode terbaru, rebuild backend + frontend di VPS.

**Cara 2 – Langsung di VPS (setelah Anda SSH):**

```bash
cd /var/www/bgg-app
git fetch origin master
git reset --hard origin/master

cd /var/www/bgg-app/backend
npm ci
npm run migrate 2>/dev/null || true
pm2 restart bgg-backend --update-env

cd /var/www/bgg-app/frontend
npm ci
npm run build
```

Atau dari folder project di VPS: `bash deploy/update-vps.sh`

**Trigger manual dari GitHub:** Buka repo → **Actions** → pilih workflow **Deploy to VPS** → **Run workflow** (perlu Secrets sudah diisi).

### Error "missing server host" di GitHub Actions

Artinya **GitHub Secrets** untuk deploy belum diisi. Tambahkan di:

**GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Nama secret   | Nilai | Wajib |
|---------------|--------|-------|
| `VPS_HOST`    | IP VPS (mis. `187.124.90.214`) | ✅ |
| `VPS_USERNAME`| User SSH (mis. `root`) | ✅ |
| `VPS_SSH_KEY` | Isi **seluruh** private key SSH (bisa dari `cat ~/.ssh/id_rsa` di PC atau buat key baru di VPS lalu `cat ~/.ssh/github_actions_deploy` di VPS) | ✅ |
| `VPS_SSH_PORT`| Port SSH, biasanya `22` | ✅ |
| `APP_PATH`    | Path app di VPS, mis. `/var/www/bgg-app` | Opsional |

Setelah semua diisi, jalankan lagi **Actions → Deploy to VPS → Run workflow**.

## Pilihan Deployment

Ada 2 metode yang tersedia:

| Metode | Kelebihan | Kekurangan |
|--------|-----------|------------|
| **GitHub Actions (Recommended)** | Lebih aman, tidak perlu buka port tambahan | Butuh GitHub Secrets |
| **Webhook Server** | Lebih sederhana | Perlu buka port, maintain server terpisah |

---

## Metode 1: GitHub Actions (Recommended)

### Step 1: Setup VPS

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Clone repository di VPS:**
   ```bash
   cd /var/www
   git clone git@github.com:YOUR_USERNAME/BGG_App.git bgg-app
   cd bgg-app/backend
   npm ci --production
   ```

3. **Setup PM2 untuk backend:**
   ```bash
   cd /var/www/bgg-app/backend
   pm2 start src/server.js --name bgg-backend
   pm2 save
   pm2 startup
   ```

### Step 2: Generate SSH Key untuk GitHub Actions

1. **Di VPS, buat SSH key khusus untuk deploy:**
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
   ```

2. **Tambahkan public key ke authorized_keys:**
   ```bash
   cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
   ```

3. **Catat private key untuk GitHub Secrets:**
   ```bash
   cat ~/.ssh/github_actions_deploy
   ```

### Step 3: Setup GitHub Secrets

Buka repository di GitHub → Settings → Secrets and variables → Actions

Tambahkan secrets berikut:

| Secret Name | Nilai | Contoh |
|------------|-------|--------|
| `VPS_HOST` | IP atau domain VPS | `123.456.789.0` atau `vps.example.com` |
| `VPS_USERNAME` | Username SSH | `root` atau `deploy` |
| `VPS_SSH_KEY` | Private key (dari step 2) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_SSH_PORT` | Port SSH (biasanya 22) | `22` |
| `APP_PATH` | Path aplikasi di VPS | `/var/www/bgg-app` |

### Step 4: Test Deployment

1. Push perubahan ke branch `master`:
   ```bash
   git add .
   git commit -m "Test auto-deploy"
   npm run push
   ```

2. Cek status di GitHub → Actions tab

---

## Metode 2: Webhook Server (Alternatif)

### Step 1: Setup VPS

1. **Install dependencies dan clone repo** (sama seperti Metode 1)

2. **Buat deploy script executable:**
   ```bash
   chmod +x /var/www/bgg-app/backend/scripts/deploy.sh
   ```

3. **Set environment variables di `.env`:**
   ```env
   WEBHOOK_PORT=9000
   WEBHOOK_SECRET=your-super-secret-key-here
   ```

4. **Jalankan webhook server:**
   ```bash
   cd /var/www/bgg-app/backend
   pm2 start scripts/webhook-server.js --name bgg-webhook
   pm2 save
   ```

### Step 2: Setup Firewall

Buka port webhook di firewall:
```bash
# UFW
sudo ufw allow 9000/tcp

# atau iptables
sudo iptables -A INPUT -p tcp --dport 9000 -j ACCEPT
```

### Step 3: Setup GitHub Webhook

1. Buka repository di GitHub → Settings → Webhooks → Add webhook

2. Konfigurasi:
   - **Payload URL:** `http://YOUR_VPS_IP:9000/webhook`
   - **Content type:** `application/json`
   - **Secret:** (sama dengan `WEBHOOK_SECRET` di .env)
   - **Which events:** Just the push event
   - **Active:** ✓

3. Klik "Add webhook"

### Step 4: Test Webhook

1. Push perubahan ke branch `main`
2. Cek webhook delivery di GitHub → Settings → Webhooks → Recent Deliveries
3. Cek log di VPS:
   ```bash
   pm2 logs bgg-webhook
   ```

---

## Troubleshooting

### Deployment Gagal

1. **Cek log PM2:**
   ```bash
   pm2 logs bgg-backend --lines 100
   ```

2. **Cek status PM2:**
   ```bash
   pm2 status
   ```

3. **Manual deployment untuk debug:**
   ```bash
   cd /var/www/bgg-app/backend
   ./scripts/deploy.sh
   ```

### SSH Connection Failed (GitHub Actions)

1. **Test SSH manual:**
   ```bash
   ssh -i ~/.ssh/github_actions_deploy -p 22 user@vps-ip
   ```

2. **Cek permission file:**
   ```bash
   chmod 600 ~/.ssh/github_actions_deploy
   chmod 644 ~/.ssh/github_actions_deploy.pub
   chmod 700 ~/.ssh
   ```

3. **Cek sshd config:**
   ```bash
   # /etc/ssh/sshd_config
   PubkeyAuthentication yes
   ```

### Database Migration Gagal

1. **Cek koneksi database:**
   ```bash
   cd /var/www/bgg-app/backend
   node -e "require('./src/models').sequelize.authenticate().then(() => console.log('OK')).catch(console.error)"
   ```

2. **Run migration manual:**
   ```bash
   npm run migrate
   ```

---

## Rollback

Jika deployment bermasalah, rollback manual:

```bash
cd /var/www/bgg-app/backend

# Lihat commit history
git log --oneline -10

# Rollback ke commit tertentu
git reset --hard COMMIT_HASH
npm ci --production
npm run migrate
pm2 restart bgg-backend
```

---

## Security Tips

1. **Gunakan user non-root** untuk deployment
2. **Limit SSH access** dengan firewall rules
3. **Rotate SSH keys** secara berkala
4. **Monitor logs** untuk aktivitas mencurigakan
5. **Backup database** sebelum deployment besar
