# Production Deployment Guide

## Overview
This guide covers production deployment, security, monitoring, and maintenance for the Zoho Bills Automation system.

---

## Table of Contents
1. [Zoho Token Management](#zoho-token-management)
2. [n8n Webhook Security](#n8n-webhook-security)
3. [Database Migration](#database-migration)
4. [Logging and Monitoring](#logging-and-monitoring)
5. [Systemd Service Setup](#systemd-service-setup)
6. [Security Best Practices](#security-best-practices)
7. [Backup and Recovery](#backup-and-recovery)
8. [Performance Optimization](#performance-optimization)

---

## Zoho Token Management

### Generating Fresh Zoho Token

#### Step 1: Create Zoho API Application
1. Go to https://api-console.zoho.com/
2. Click "Add Client"
3. Select "Server-based Applications"
4. Configure:
   - **Client Name**: Your application name
   - **Homepage URL**: Your application URL
   - **Authorized Redirect URIs**: `http://localhost:10000/oauth/zoho/callback` (dev) or your production URL
   - **Scope**: `ZohoBooks.fullaccess.all`

#### Step 2: Get Authorization Code
1. Open browser:
   ```
   https://accounts.zoho.com/oauth/v2/auth?
     response_type=code&
     client_id=YOUR_CLIENT_ID&
     scope=ZohoBooks.fullaccess.all&
     redirect_uri=YOUR_REDIRECT_URI&
     access_type=offline
   ```
2. Authorize the application
3. Copy the `code` from redirect URL

#### Step 3: Exchange Code for Tokens
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "code=AUTHORIZATION_CODE"
```

Response:
```json
{
  "access_token": "1000.xxx...",
  "refresh_token": "1000.yyy...",
  "expires_in": 3600,
  "api_domain": "https://www.zohoapis.com"
}
```

#### Step 4: Set Environment Variables
```bash
export ZB_BASE_URL=https://www.zohoapis.com
export ZB_ORG_ID=your_organization_id
export ZB_ACCESS_TOKEN=1000.xxx...
```

### Rotating Tokens

#### Automatic Refresh (Recommended)
The system uses `zohoAuth.ts` to automatically refresh tokens:
- Tokens are stored in database
- Refresh happens when token expires
- No manual intervention needed

#### Manual Refresh
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=refresh_token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "refresh_token=YOUR_REFRESH_TOKEN"
```

#### Token Rotation Schedule
- **Access Token**: Expires every 1 hour (auto-refreshed)
- **Refresh Token**: Valid indefinitely (unless revoked)
- **Rotation**: Revoke old refresh token when generating new one

### Getting Organization ID
1. Login to Zoho Books
2. Go to Settings → Organization
3. Copy "Organization ID" from URL or settings page

---

## n8n Webhook Security

### Securing Webhook Endpoint

#### Option 1: Authentication Token (Recommended)
1. Set environment variable:
   ```bash
   export N8N_AUTH_TOKEN=your-secret-token-here
   ```

2. Configure n8n workflow to validate token:
   - Add "IF" node after webhook
   - Check `Authorization` header
   - Only proceed if token matches

#### Option 2: IP Whitelisting
1. Configure n8n to only accept requests from your backend IP
2. Use n8n's IP filtering feature
3. Or use reverse proxy (nginx) with IP restrictions

#### Option 3: Webhook Path Obfuscation
1. Use complex, random webhook path:
   ```
   /webhook/zoho-bill-process-abc123xyz789
   ```
2. Don't expose path in logs or documentation
3. Rotate path periodically

#### Option 4: HTTPS Only
1. Always use HTTPS in production
2. Configure n8n with SSL certificate
3. Verify SSL in backend requests

### n8n Production Deployment

#### Self-Hosted n8n
```bash
# Using Docker
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=secure-password \
  n8nio/n8n
```

#### n8n Cloud
1. Sign up at https://n8n.io/cloud
2. Create workflow
3. Get webhook URL
4. Set `N8N_WEBHOOK_URL` environment variable

---

## Database Migration

### Moving from JSON to SQLite

#### Step 1: Create Migration Script
Create `backend/scripts/migrate-to-sqlite.ts`:

```typescript
import Database from 'better-sqlite3';
import * as dataStore from '../src/dataStore.js';
import * as fs from 'fs';

const db = new Database('./data/app.db');

// Create runs table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    invoice TEXT,
    vendor TEXT,
    status TEXT,
    items INTEGER,
    bill TEXT,
    when TEXT,
    raw TEXT
  );
`);

// Read from JSON
const runs = dataStore.readAllRuns();

// Insert into SQLite
const stmt = db.prepare(`
  INSERT OR REPLACE INTO runs (id, invoice, vendor, status, items, bill, when, raw)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const run of runs) {
  stmt.run(
    run.id,
    run.invoice,
    run.vendor,
    run.status,
    run.items,
    run.bill,
    run.when,
    JSON.stringify(run.raw)
  );
}

console.log(`Migrated ${runs.length} runs to SQLite`);
db.close();
```

#### Step 2: Update dataStore.ts
Modify to use SQLite instead of JSON file.

#### Step 3: Run Migration
```bash
cd backend
tsx scripts/migrate-to-sqlite.ts
```

### Moving to PostgreSQL

#### Step 1: Install PostgreSQL Client
```bash
npm install pg @types/pg
```

#### Step 2: Create Schema
```sql
CREATE TABLE runs (
  id VARCHAR(255) PRIMARY KEY,
  invoice VARCHAR(255),
  vendor VARCHAR(255),
  status VARCHAR(50),
  items INTEGER,
  bill VARCHAR(255),
  when TIMESTAMP,
  raw JSONB
);

CREATE INDEX idx_runs_when ON runs(when DESC);
CREATE INDEX idx_runs_status ON runs(status);
```

#### Step 3: Update dataStore.ts
Replace file operations with PostgreSQL queries.

---

## Logging and Monitoring

### Structured Logging

#### Install Winston
```bash
npm install winston
```

#### Configure Logger
Create `backend/src/logger.ts`:

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Monitoring Endpoints

#### Health Check
```typescript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
```

#### Metrics Endpoint
```typescript
app.get('/api/metrics', (req, res) => {
  const runs = dataStore.readAllRuns();
  res.json({
    totalRuns: runs.length,
    byStatus: {
      parsed: runs.filter(r => r.status === 'parsed').length,
      processing: runs.filter(r => r.status === 'processing').length,
      completed: runs.filter(r => r.status === 'completed').length,
      error: runs.filter(r => r.status === 'error').length,
    },
  });
});
```

### Log Rotation
Use `logrotate` on Linux:
```
/path/to/backend/logs/*.log {
  daily
  rotate 7
  compress
  missingok
  notifempty
}
```

---

## Systemd Service Setup

### Backend Service

Create `/etc/systemd/system/zoho-backend.service`:

```ini
[Unit]
Description=Zoho Bills Automation Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/backend
Environment=NODE_ENV=production
EnvironmentFile=/path/to/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable zoho-backend
sudo systemctl start zoho-backend
sudo systemctl status zoho-backend
```

### Parser Service

Create `/etc/systemd/system/zoho-parser.service`:

```ini
[Unit]
Description=Zoho Bills Automation Parser
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/parser
Environment=PORT=8000
ExecStart=/usr/bin/python3 app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Worker Service

Create `/etc/systemd/system/zoho-worker.service`:

```ini
[Unit]
Description=Zoho Bills Automation Worker
After=network.target zoho-backend.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/backend
Environment=NODE_ENV=production
EnvironmentFile=/path/to/backend/.env
ExecStart=/usr/bin/tsx src/worker.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Viewing Logs
```bash
# Backend logs
sudo journalctl -u zoho-backend -f

# Parser logs
sudo journalctl -u zoho-parser -f

# Worker logs
sudo journalctl -u zoho-worker -f
```

---

## Security Best Practices

### Environment Variables
- Never commit `.env` files to git
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly
- Use different credentials for dev/staging/prod

### API Security
- Enable CORS only for trusted origins
- Use HTTPS in production
- Implement rate limiting
- Add authentication for admin endpoints

### File Upload Security
- Validate file types (only PDF)
- Limit file size (30MB default)
- Scan for malware
- Store uploads outside web root

### Database Security
- Use connection pooling
- Encrypt sensitive data
- Regular backups
- Access control

---

## Backup and Recovery

### Automated Backups

#### Backup Script
Create `backend/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/zoho-automation"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup runs.json
cp backend/data/runs.json "$BACKUP_DIR/runs_$DATE.json"

# Backup database (if using SQLite)
cp backend/data/app.db "$BACKUP_DIR/app_$DATE.db"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.json" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
```

#### Cron Job
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backend/scripts/backup.sh
```

### Recovery Procedure

1. Stop services
2. Restore from backup
3. Verify data integrity
4. Restart services
5. Test functionality

---

## Performance Optimization

### Caching
- Cache Zoho vendor/item lookups
- Use Redis for session storage
- Implement response caching

### Database Optimization
- Add indexes on frequently queried fields
- Use connection pooling
- Regular VACUUM (SQLite) or ANALYZE (PostgreSQL)

### Worker Optimization
- Adjust `SCAN_INTERVAL_MS` based on load
- Increase `MAX_BATCH_SIZE` for high volume
- Use queue system (Bull, RabbitMQ) for production

### Monitoring
- Set up alerts for:
  - High error rates
  - Slow processing times
  - Disk space usage
  - Memory leaks

---

## Troubleshooting

### Common Issues

1. **Tokens Expiring**
   - Check refresh token is valid
   - Verify token refresh logic
   - Check Zoho API status

2. **High Memory Usage**
   - Check for memory leaks
   - Limit concurrent processing
   - Restart services periodically

3. **Slow Processing**
   - Check Zoho API response times
   - Optimize database queries
   - Scale worker instances

4. **Data Loss**
   - Check backup schedule
   - Verify file permissions
   - Check disk space

---

## Support and Maintenance

### Regular Tasks
- [ ] Weekly: Review error logs
- [ ] Monthly: Rotate access tokens
- [ ] Quarterly: Security audit
- [ ] Annually: Full system review

### Contact
For issues or questions, refer to:
- Project documentation
- Issue tracker
- Team chat channel


