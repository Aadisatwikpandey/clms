# CLMS – AMC Engineering College Library Management System
## Setup & Deployment Guide

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Git

### 1. Start infrastructure services
```bash
# From the clms/ directory
npm run docker:up
# Starts: PostgreSQL 16, Redis 7, Elasticsearch 8, Nginx
```

### 2. Set up environment
```bash
cp .env.example .env.local
# Edit .env.local — set AUTH_SECRET, SMTP credentials, etc.
```

Generate a secure AUTH_SECRET:
```bash
openssl rand -base64 32
```

### 3. Push database schema
```bash
npm run db:push
```

### 4. Seed initial data
```bash
npm run db:seed
```
This creates:
- Admin user: `admin@amcengineering.edu.in` / `Admin@123`
- Default system config
- Default budget heads for current financial year

### 5. Start the app
```bash
npm run dev
# Open http://localhost:3000
```

---

## Production Deployment (On-Premise Server)

### Server requirements
- Ubuntu 22.04 LTS
- 8 cores, 16 GB RAM, 256 GB SSD
- Docker + Docker Compose installed

### Steps
```bash
# 1. Clone / copy project to server
git clone <repo> /opt/clms
cd /opt/clms/clms

# 2. Copy and configure .env.local
cp .env.example .env.local
# Edit: set AUTH_SECRET, SMTP, etc.
# Update DATABASE_URL to use Docker network hostname (already set in docker-compose.yml)

# 3. Build and start all services
docker compose up -d --build

# 4. Run DB migrations and seed
docker compose exec app npm run db:push
docker compose exec app npm run db:seed

# 5. Access via http://<server-ip>
```

### SSL (HTTPS)
```bash
# Install certbot on host
apt install certbot
certbot certonly --standalone -d your-domain.edu.in

# Copy certs to docker/nginx/ssl/
cp /etc/letsencrypt/live/your-domain.edu.in/fullchain.pem docker/nginx/ssl/
cp /etc/letsencrypt/live/your-domain.edu.in/privkey.pem docker/nginx/ssl/

# Update nginx.conf to enable SSL server block
```

---

## Architecture

```
Browser / Barcode Scanner
        │
   Nginx (port 80/443)
        │
   Next.js 15 App (port 3000)
    ├── API Routes (/api/*)
    ├── Server Components
    └── Client Components
        │
   ┌────┴───────────────────────┐
   │        │           │       │
PostgreSQL  Redis  Elasticsearch  File Storage
  (data)  (cache)   (search)      (uploads)
```

---

## Modules Implemented

| Module | Path | Description |
|--------|------|-------------|
| M-01 Data Migration | `/migration` | CSV/Excel import for books and members |
| M-02 Cataloguing | `/cataloguing` | Add/edit/search books, journals, all material types |
| M-03 Circulation | `/circulation` | Issue, return, renew, reserve, overdues |
| M-04 Serials | `/serials` | Journal subscriptions, issue tracking |
| M-05 Acquisitions | `/acquisitions` | Purchase orders, vendors |
| M-06 Members | `/members` | Member registration, fine tracking |
| M-07 OPAC | `/opac` | Public catalogue search (Elasticsearch-backed) |
| M-08 Digital Library | `/digital-library` | Index and browse digital resources |
| M-09 Reports | `/reports` | Charts: circulation, fines, top books, etc. |
| M-10 Finance | `/finance` | Budget heads, fine collection |
| M-11 Stock Verification | `/stock` | Barcode-scan based stock sessions |
| M-12 Search | Built into OPAC | Elasticsearch full-text + facets |
| M-13 Notifications | Admin panel | Bulk overdue emails, vendor reminders |
| M-14 Admin | `/admin` | User management, system config |

---

## Role-Based Access

| Role | Access |
|------|--------|
| `admin` | Full access to all modules |
| `librarian` | Catalogue, circulation, members, serials, acquisitions |
| `staff` | Circulation, catalogue (read/write), members |
| `member` | OPAC, digital library, own profile |
| `finance` | Finance, reports, fine collection |
| `readonly` | Dashboard and reports only |

---

## Default Credentials (after seed)

| Email | Password | Role |
|-------|----------|------|
| admin@amcengineering.edu.in | Admin@123 | admin |

**Change this password immediately after first login.**

---

## Useful Commands

```bash
# Database
npm run db:push          # Push schema to DB (dev)
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio (DB GUI)
npm run db:seed          # Seed initial data

# Docker
npm run docker:up        # Start all services
npm run docker:down      # Stop all services
npm run docker:logs      # Tail app logs

# Development
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run lint             # Lint code
```

---

## Data Migration (Bulk Import)

### Books from CSV
Required columns: `title, authors, publisher, year, isbn, dewey_no, call_no, language, price, location, copies`

```csv
title,authors,publisher,year,isbn,copies
Introduction to Algorithms,Cormen;Leiserson,MIT Press,2022,9780262046305,3
```

### Members from CSV
Required columns: `name, type, department, course, roll_no, email, phone`

```csv
name,type,department,course,roll_no,email
Ravi Kumar,student,CSE,B.E. CSE,1AM22CS001,ravi@amc.edu
```

Upload via: **Admin → Data Migration**

---

## Barcode Scanner Setup

1. USB HID barcode scanners work plug-and-play — no drivers needed
2. In the Circulation module, click into the barcode input field
3. Scan the barcode — it auto-submits on Enter
4. Multiple books can be issued in one transaction by scanning sequentially

---

## Backup

Automated backups are configured via Docker volume mounts.  
Manual backup:
```bash
docker exec clms_postgres pg_dump -U clms clms_db > backup_$(date +%Y%m%d).sql
```

---

*CLMS v1.0 – AMC Engineering College, Bengaluru*
