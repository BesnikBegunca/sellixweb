# Publikimi i SelliX

## Çka të duhet

Domaini te GoDaddy është vetëm **emri**. Serveri ku punon kodi është gjë tjetër,
dhe mund të jetë kudo — te GoDaddy ose te ndonjë ofrues tjetër.

Ky projekt ka nevojë për:

- **Node.js** që punon vazhdimisht (backend-i)
- **Disk të përhershëm** për fajllin e bazës `server/data/sellix.db`

Prandaj:

| Lloji i hostingit | A punon? |
| --- | --- |
| GoDaddy **cPanel / Web Hosting** (shared) | Jo — është për PHP/WordPress. Disa plane kanë "Setup Node.js App", por `better-sqlite3` kompilohet vështirë aty |
| GoDaddy **VPS** ose çdo VPS tjetër (Hetzner, DigitalOcean, Contabo) | **Po** — kjo është rruga e rekomanduar, ~5 €/muaj |
| Vercel / Netlify (vetëm frontend) | Faqja po, baza jo — disku fshihet në çdo deploy |

Udhëzimi më poshtë është për një VPS me **Ubuntu 22.04/24.04**.

---

## 1. Drejto domainin kah serveri

Në GoDaddy: **My Products → Domain → DNS → Manage Zones**, shto dy rekorde:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | IP-ja e serverit | 600 |
| A | `www` | IP-ja e serverit | 600 |

Nëse ekzistojnë rekorde `A` ose "Parked" nga GoDaddy, ndryshoji këto — mos shto të reja.
Përhapja zgjat nga disa minuta deri në disa orë.

## 2. Përgatit serverin

```bash
ssh root@IP-JA-E-SERVERIT

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt update && apt install -y nodejs nginx git sqlite3

adduser --disabled-password --gecos "" sellix
mkdir -p /var/www/sellix && chown sellix:sellix /var/www/sellix
```

## 3. Vendos kodin

```bash
su - sellix
git clone <adresa-e-repos> /var/www/sellix
# ose ngarko zip-in dhe shpaketoje aty
```

## 4. Backend-i

```bash
cd /var/www/sellix/server
npm ci --omit=dev
cp .env.example .env
nano .env
```

Në `.env` vendos:

```
PORT=4000
JWT_SECRET=<varg i gjatë rastësor>
CLIENT_ORIGIN=https://sellix.software
COOKIE_SECURE=true
TRUST_PROXY=1
SEED_ADMIN_EMAIL=ti@sellix.software
SEED_ADMIN_PASSWORD=<fjalëkalim i përkohshëm>
```

Çelësin gjeneroje me:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Pastaj:

```bash
npm run seed          # krijon adminin e parë dhe përmbajtjen e faqes
```

## 5. Frontend-i

```bash
cd /var/www/sellix/web
npm ci
npm run build         # del në web/dist
```

## 6. Mbaje Node-in gjallë me PM2

```bash
sudo npm install -g pm2
cd /var/www/sellix/server
pm2 start src/index.js --name sellix-api
pm2 save
pm2 startup           # ekzekuto komandën që ta shfaq
```

## 7. nginx

```bash
sudo cp /var/www/sellix/deploy/nginx.conf /etc/nginx/sites-available/sellix
sudo nano /etc/nginx/sites-available/sellix    # ndërro domainin
sudo ln -s /etc/nginx/sites-available/sellix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 8. HTTPS falas

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sellix.software -d www.sellix.software
```

Certifikata rinovohet vetë. Tani:

- Faqja → `https://sellix.software`
- Admini → `https://sellix.software/admin/login`
- Desktop app → `--dart-define=SELLIX_API=https://sellix.software`

---

## Baza e të dhënave

SQLite është **një fajll** në `server/data/sellix.db` — nuk të duhet server i
veçantë baze, as pagesë shtesë. Punon sa kohë që disku është i përhershëm,
çka është rasti në çdo VPS.

**Backup-i është i domosdoshëm** — aty janë bizneset dhe licencat. Cron ditor:

```bash
sudo mkdir -p /var/backups/sellix && sudo chown sellix /var/backups/sellix
crontab -e
```

```
0 3 * * * sqlite3 /var/www/sellix/server/data/sellix.db ".backup '/var/backups/sellix/sellix-$(date +\%F).db'"
5 3 * * * find /var/backups/sellix -name '*.db' -mtime +30 -delete
```

`.backup` e kopjon bazën edhe kur programi po shkruan, ndryshe nga `cp`.
Kopjen shkarkoje herë pas here edhe jashtë serverit.

## Përditësimi i kodit më vonë

```bash
cd /var/www/sellix
git pull
cd server && npm ci --omit=dev
cd ../web && npm ci && npm run build
pm2 restart sellix-api
```

Baza nuk preket — tabelat e reja krijohen vetë kur ndizet serveri.

## Nëse do të mbetesh te GoDaddy shared hosting

Atëherë Node-i dhe SQLite duhen zëvendësuar: faqja statike te `public_html`,
backend-i i rishkruar në PHP dhe baza në MySQL që e jep cPanel. Kjo është
rishkrim i tërë serverit — VPS-i kushton pothuajse njësoj dhe e mban kodin
ashtu siç është.
