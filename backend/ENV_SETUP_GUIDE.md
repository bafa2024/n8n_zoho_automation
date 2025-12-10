# Environment Variables Setup Guide

## Quick Start (Windows)

### Method 1: Create .env File (Recommended)

1. **Copy the example file:**
   ```powershell
   cd backend
   copy env.example .env
   ```

2. **Edit `.env` file** with your text editor (Notepad, VS Code, etc.)

3. **Add your Zoho credentials:**
   ```env
   # Zoho Books Configuration
   ZB_BASE_URL=https://www.zohoapis.com
   ZB_ORG_ID=your_organization_id_here
   ZB_ACCESS_TOKEN=your_access_token_here
   
   # Or use the old variable names (both work):
   ZOHO_API_DOMAIN=https://www.zohoapis.com
   ZOHO_ORG_ID=your_organization_id_here
   ZOHO_ACCESS_TOKEN=your_access_token_here
   
   # n8n Configuration (Optional)
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/zoho-bill-process
   N8N_AUTH_TOKEN=your_n8n_token_here
   N8N_DISABLED=false
   ```

4. **Save the file**

5. **Restart your backend server** for changes to take effect

---

### Method 2: Set Environment Variables in PowerShell (Temporary)

**For current session only** (lost when you close terminal):

```powershell
# Zoho Books
$env:ZB_BASE_URL="https://www.zohoapis.com"
$env:ZB_ORG_ID="your_organization_id_here"
$env:ZB_ACCESS_TOKEN="your_access_token_here"

# n8n (Optional)
$env:N8N_WEBHOOK_URL="http://localhost:5678/webhook/zoho-bill-process"
$env:N8N_AUTH_TOKEN="your_n8n_token_here"
```

**Then start your backend:**
```powershell
cd backend
npm run dev
```

---

### Method 3: Set Environment Variables in Command Prompt (Temporary)

**For current session only:**

```cmd
REM Zoho Books
set ZB_BASE_URL=https://www.zohoapis.com
set ZB_ORG_ID=your_organization_id_here
set ZB_ACCESS_TOKEN=your_access_token_here

REM n8n (Optional)
set N8N_WEBHOOK_URL=http://localhost:5678/webhook/zoho-bill-process
set N8N_AUTH_TOKEN=your_n8n_token_here
```

**Then start your backend:**
```cmd
cd backend
npm run dev
```

---

### Method 4: Set System-Wide Environment Variables (Permanent)

**Windows 10/11:**

1. Press `Win + X` and select **"System"**
2. Click **"Advanced system settings"** (on the right)
3. Click **"Environment Variables"** button
4. Under **"User variables"** or **"System variables"**, click **"New"**
5. Add each variable:
   - Variable name: `ZB_BASE_URL`
   - Variable value: `https://www.zohoapis.com`
6. Repeat for all variables
7. Click **"OK"** on all dialogs
8. **Restart your terminal/IDE** for changes to take effect

---

## Complete .env File Template

Create `backend/.env` file with this content:

```env
# Server Configuration
PORT=5050
PUBLIC_BASE_URL=http://localhost:5050
DB_PATH=./data/app.db
UPLOAD_DIR=./uploads
PARSER_URL=http://127.0.0.1:8000

# Zoho Books Configuration
# Use either ZB_* or ZOHO_* variables (both work)
ZB_BASE_URL=https://www.zohoapis.com
ZB_ORG_ID=your_organization_id_here
ZB_ACCESS_TOKEN=your_access_token_here

# Alternative Zoho variable names (for compatibility)
ZOHO_MODE=live
ZOHO_API_DOMAIN=https://www.zohoapis.com
ZOHO_ORG_ID=your_organization_id_here
ZOHO_ACCESS_TOKEN=your_access_token_here

# Zoho OAuth (if using OAuth flow)
ZOHO_CLIENT_ID=your_client_id_here
ZOHO_CLIENT_SECRET=your_client_secret_here
ZOHO_REDIRECT_URI=http://localhost:10000/oauth/zoho/callback

# n8n Configuration (Optional)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/zoho-bill-process
N8N_AUTH_TOKEN=your_n8n_auth_token_here
N8N_DISABLED=false

# Authentication (Optional)
DEMO_AUTH_TOKEN=your_demo_auth_token_here
```

---

## Getting Your Zoho Credentials

### Step 1: Get Organization ID

1. Login to Zoho Books: https://books.zoho.com
2. Go to **Settings** → **Organization**
3. Copy the **Organization ID** from the URL or settings page
   - URL format: `https://books.zoho.com/app#/settings/organization?org_id=123456789`
   - The number after `org_id=` is your Organization ID

### Step 2: Get Access Token

#### Option A: Using OAuth (Recommended for Production)

1. Go to https://api-console.zoho.com/
2. Create a new **Server-based Application**
3. Get your **Client ID** and **Client Secret**
4. Use the OAuth flow (see `PRODUCTION_GUIDE.md` for details)

#### Option B: Generate Token Directly

1. Go to https://accounts.zoho.com/apiauthtoken/create
2. Select scopes: `ZohoBooks.fullaccess.all`
3. Generate token
4. Copy the generated token

### Step 3: Get n8n Webhook URL (Optional)

1. Start n8n: `npx n8n`
2. Create a workflow with a Webhook node
3. Set path: `zoho-bill-process`
4. Copy the webhook URL shown in the node
5. Set `N8N_WEBHOOK_URL` to this URL

---

## Verifying Your Setup

### Test 1: Check Environment Variables are Loaded

Create a test file `backend/test-env.js`:

```javascript
import 'dotenv/config';

console.log('ZB_BASE_URL:', process.env.ZB_BASE_URL || 'NOT SET');
console.log('ZB_ORG_ID:', process.env.ZB_ORG_ID || 'NOT SET');
console.log('ZB_ACCESS_TOKEN:', process.env.ZB_ACCESS_TOKEN ? 'SET (hidden)' : 'NOT SET');
console.log('N8N_WEBHOOK_URL:', process.env.N8N_WEBHOOK_URL || 'NOT SET');
```

Run it:
```powershell
cd backend
node test-env.js
```

### Test 2: Check Backend Logs

Start your backend:
```powershell
cd backend
npm run dev
```

Look for:
- ✅ No errors about missing environment variables
- ✅ Zoho configuration loaded
- ✅ n8n configuration loaded (if set)

---

## Common Issues

### Issue 1: Variables Not Loading

**Problem**: Environment variables not being read

**Solutions**:
- Make sure file is named `.env` (not `env` or `.env.txt`)
- Make sure `.env` is in the `backend/` folder
- Restart your terminal/IDE after creating `.env`
- Check that `dotenv` package is installed: `npm install dotenv`

### Issue 2: Wrong Variable Names

**Problem**: Variables not recognized

**Solution**: Use these exact names:
- `ZB_BASE_URL` or `ZOHO_API_DOMAIN`
- `ZB_ORG_ID` or `ZOHO_ORG_ID`
- `ZB_ACCESS_TOKEN` or `ZOHO_ACCESS_TOKEN`
- `N8N_WEBHOOK_URL`
- `N8N_AUTH_TOKEN`

### Issue 3: Token Expired

**Problem**: Zoho API returns 401 Unauthorized

**Solutions**:
- Generate a new access token
- Use OAuth refresh token flow (see `PRODUCTION_GUIDE.md`)
- Check token hasn't been revoked in Zoho

### Issue 4: Organization ID Wrong

**Problem**: Zoho API returns 404 or wrong data

**Solutions**:
- Double-check Organization ID in Zoho Books settings
- Make sure you're using the correct Zoho region (US, EU, IN, etc.)
- Verify `ZB_BASE_URL` matches your Zoho region

---

## Security Best Practices

1. **Never commit `.env` to git**
   - Add `.env` to `.gitignore`
   - Only commit `env.example` (without real values)

2. **Use different tokens for dev/staging/prod**
   - Don't use production tokens in development

3. **Rotate tokens regularly**
   - Change tokens every 90 days
   - Revoke old tokens when creating new ones

4. **Keep tokens secret**
   - Don't share `.env` files
   - Don't log tokens in console
   - Use secrets management in production

---

## Quick Reference

### Required Variables (Minimum)
```env
ZB_ORG_ID=your_org_id
ZB_ACCESS_TOKEN=your_token
```

### Optional Variables
```env
ZB_BASE_URL=https://www.zohoapis.com  # Default if not set
N8N_WEBHOOK_URL=...                    # Skip n8n if not set
N8N_AUTH_TOKEN=...                     # Optional auth
N8N_DISABLED=true                      # Disable n8n integration
```

---

## Next Steps

After setting up environment variables:

1. ✅ Verify variables are loaded (test script above)
2. ✅ Start backend: `npm run dev`
3. ✅ Test upload: Upload a PDF and check logs
4. ✅ Check Zoho: Verify bill is created in Zoho Books
5. ✅ Check n8n: Verify webhook is triggered (if configured)

For more details, see:
- `PRODUCTION_GUIDE.md` - Production deployment
- `QA_TEST_SCRIPT.md` - Testing guide
- `N8N_SETUP.md` - n8n setup instructions


