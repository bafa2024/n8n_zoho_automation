# Fix: "Invalid value passed for organization_id" Error

## Error Message
```
Zoho Books vendor API error (400): Invalid value passed for organization_id
```

## Cause
The `ZB_ORG_ID` environment variable is either:
- ❌ Not set in `.env` file
- ❌ Empty or has wrong value
- ❌ Has extra spaces or characters
- ❌ Wrong format (should be numeric)

---

## Solution

### Step 1: Check Your `.env` File

Open `backend/.env` and verify:

```env
ZB_ORG_ID=123456789012345
```

**Common Issues:**
- ❌ `ZB_ORG_ID=` (empty)
- ❌ `ZB_ORG_ID= ` (has space)
- ❌ `ZB_ORG_ID="123456789012345"` (has quotes - remove them)
- ❌ `ZB_ORG_ID=your_organization_id_here` (placeholder not replaced)

### Step 2: Get Your Correct Organization ID

1. **Login to Zoho Books**: https://books.zoho.com
2. **Check URL**: Look for `org_id=` in the URL
   - Example: `https://books.zoho.com/app#/settings/organization?org_id=123456789012345`
3. **Or go to Settings → Organization** and find Organization ID

### Step 3: Update `.env` File

```env
# Make sure these are set correctly:
ZB_ORG_ID=123456789012345  # Replace with YOUR actual Organization ID
ZB_ACCESS_TOKEN=1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96
ZB_BASE_URL=https://www.zohoapis.com
```

**Important:**
- ✅ No quotes around the value
- ✅ No spaces before or after
- ✅ Just the number (e.g., `123456789012345`)

### Step 4: Restart Backend Server

After updating `.env`:

1. **Stop the backend** (Ctrl+C in terminal)
2. **Start it again**:
   ```bash
   cd backend
   npm run dev
   ```

**Why restart?** Environment variables are loaded when the server starts.

### Step 5: Test Again

1. Upload a PDF
2. Check logs - should see:
   ```
   [BillProcessor] Vendor ID: 1234567890 for run R-XXXXX (created/found)
   ```

---

## Quick Verification

### Check if Environment Variable is Loaded

Add this temporary test in your code or check logs:

The backend should log if Zoho is configured. If you see:
```
Zoho Books not configured: ZB_ORG_ID and ZB_ACCESS_TOKEN required
```

Then the environment variable is not being read.

### Verify Format

Organization ID should be:
- ✅ Numeric only (digits)
- ✅ Usually 15 digits (but can vary)
- ✅ No dashes, spaces, or special characters
- ✅ Example: `123456789012345`

---

## Common Mistakes

### ❌ Wrong Format
```env
ZB_ORG_ID="123456789012345"  # Has quotes - WRONG
ZB_ORG_ID= 123456789012345   # Has space - WRONG
ZB_ORG_ID=your_org_id        # Placeholder - WRONG
```

### ✅ Correct Format
```env
ZB_ORG_ID=123456789012345    # Correct - just the number
```

---

## Debug Steps

### 1. Check Current Value

In your backend code, you can temporarily add:
```typescript
console.log('ZB_ORG_ID:', process.env.ZB_ORG_ID);
console.log('ZB_ORG_ID length:', process.env.ZB_ORG_ID?.length);
```

### 2. Verify File Location

Make sure `.env` is in the **backend** folder:
```
backend/
  ├── .env          ← Should be here
  ├── src/
  └── package.json
```

### 3. Check File Encoding

- Make sure `.env` is saved as plain text (not UTF-8 with BOM)
- Use a simple text editor (Notepad, VS Code)

### 4. Check for Hidden Characters

- Open `.env` in a text editor
- Make sure there are no invisible characters
- Re-type the value if needed

---

## Still Not Working?

### Option 1: Set Environment Variable Directly

**Windows PowerShell:**
```powershell
$env:ZB_ORG_ID="123456789012345"
$env:ZB_ACCESS_TOKEN="1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96"
cd backend
npm run dev
```

**Windows CMD:**
```cmd
set ZB_ORG_ID=123456789012345
set ZB_ACCESS_TOKEN=1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96
cd backend
npm run dev
```

### Option 2: Check Zoho Books Region

Make sure you're using the correct API domain:

- **US**: `https://www.zohoapis.com`
- **EU**: `https://www.zohoapis.eu`
- **IN**: `https://www.zohoapis.in`
- **AU**: `https://www.zohoapis.com.au`

Check your `.env`:
```env
ZB_BASE_URL=https://www.zohoapis.com  # Match your Zoho Books region
```

---

## Expected Success Logs

After fixing, you should see:

```
[BillProcessor] Starting processing for run R-XXXXX
[BillProcessor] Ensuring vendor exists for run R-XXXXX
[BillProcessor] Vendor ID: 123456789012345 for run R-XXXXX (created/found)
[BillProcessor] Ensuring items exist for run R-XXXXX
[BillProcessor] Created/found 3 items for run R-XXXXX
[BillProcessor] Creating bill draft for run R-XXXXX
[BillProcessor] Bill created: 9876543210 (BILL-001) for run R-XXXXX
```

---

## Summary

1. ✅ Get your Organization ID from Zoho Books URL or Settings
2. ✅ Add to `.env`: `ZB_ORG_ID=123456789012345` (no quotes, no spaces)
3. ✅ Restart backend server
4. ✅ Test again

The error should be resolved! 🎉


