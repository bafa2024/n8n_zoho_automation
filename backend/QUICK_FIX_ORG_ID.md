# Quick Fix: Organization ID Error

## Your Current Setup
✅ `.env` file exists
✅ `ZB_ORG_ID=110001817809` is set

## The Problem
The error "Invalid value passed for organization_id" means Zoho is rejecting the Organization ID. This could be:
1. Server not restarted after setting `.env`
2. Wrong Zoho region (US/EU/IN/AU)
3. Organization ID doesn't match the access token's organization

---

## Solution Steps

### Step 1: Verify Your Organization ID

1. **Login to Zoho Books**: https://books.zoho.com
2. **Check the URL** - Look for `org_id=` in the browser address bar
3. **Or go to**: Settings → Organization
4. **Verify** the number matches `110001817809`

### Step 2: Check Zoho Region

Your Organization ID must match the Zoho region you're using:

- **US**: `https://www.zohoapis.com`
- **EU**: `https://www.zohoapis.eu`  
- **IN**: `https://www.zohoapis.in`
- **AU**: `https://www.zohoapis.com.au`

**Check your `.env` file:**
```env
ZB_BASE_URL=https://www.zohoapis.com  # Make sure this matches your Zoho Books region
```

### Step 3: Restart Backend Server

**IMPORTANT**: After updating `.env`, you MUST restart the server!

1. **Stop the backend** (Press `Ctrl+C` in the terminal where it's running)
2. **Start it again**:
   ```bash
   cd backend
   npm run dev
   ```

### Step 4: Verify Environment Variables Are Loaded

After restarting, check the logs. You should NOT see:
```
Zoho Books not configured: ZB_ORG_ID and ZB_ACCESS_TOKEN required
```

If you see that error, the environment variables aren't being loaded.

---

## Complete `.env` File Example

Make sure your `backend/.env` looks like this:

```env
# Zoho Books Configuration
ZB_ORG_ID=110001817809
ZB_ACCESS_TOKEN=1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96
ZB_BASE_URL=https://www.zohoapis.com

# Parser
PARSER_URL=http://127.0.0.1:8000
```

**Important:**
- ✅ No quotes around values
- ✅ No spaces before/after `=`
- ✅ Just the numbers/values

---

## Alternative: Test with Direct API Call

Test if your Organization ID and Access Token work:

```powershell
# Test in PowerShell
$headers = @{
    "Authorization" = "Zoho-oauthtoken 1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96"
}

$response = Invoke-RestMethod -Uri "https://www.zohoapis.com/books/v3/organizations" -Headers $headers
$response | ConvertTo-Json
```

**Expected**: Should return your organization details

**If 401 error**: Access token is invalid/expired
**If 400 error with org_id**: Organization ID doesn't match the token's organization

---

## Common Issues

### Issue 1: Organization ID Mismatch
- **Cause**: Access token belongs to different organization
- **Fix**: Generate new access token for the correct organization

### Issue 2: Wrong Region
- **Cause**: Using US API but organization is in EU (or vice versa)
- **Fix**: Check which Zoho Books URL you use and set `ZB_BASE_URL` accordingly

### Issue 3: Server Not Restarted
- **Cause**: Updated `.env` but didn't restart server
- **Fix**: Always restart after changing `.env`

---

## Quick Checklist

- [ ] Organization ID matches the one in Zoho Books URL
- [ ] `ZB_BASE_URL` matches your Zoho Books region
- [ ] Access token is valid (not expired)
- [ ] Access token belongs to the same organization
- [ ] Server restarted after updating `.env`
- [ ] No quotes or spaces in `.env` values

---

## Still Not Working?

1. **Double-check Organization ID**:
   - Login to Zoho Books
   - Copy Organization ID directly from URL or Settings
   - Make sure it's exactly `110001817809` (no extra characters)

2. **Verify Access Token**:
   - Generate a fresh token: https://accounts.zoho.com/apiauthtoken/create
   - Make sure you select the correct organization when generating

3. **Check Zoho Books Region**:
   - Which URL do you use to access Zoho Books?
   - Set `ZB_BASE_URL` to match:
     - `https://books.zoho.com` → `https://www.zohoapis.com`
     - `https://books.zoho.eu` → `https://www.zohoapis.eu`
     - `https://books.zoho.in` → `https://www.zohoapis.in`

---

## Expected Success

After fixing, when you upload a PDF, you should see:

```
[BillProcessor] Starting processing for run R-XXXXX
[BillProcessor] Ensuring vendor exists for run R-XXXXX
[BillProcessor] Vendor ID: 1234567890 for run R-XXXXX (created/found)
```

**No more "Invalid value passed for organization_id" error!** ✅


