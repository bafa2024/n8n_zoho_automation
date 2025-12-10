# How to Get Zoho Books Organization ID (ZB_ORG_ID)

## Method 1: From Zoho Books Settings (Easiest)

### Steps:
1. **Login to Zoho Books**
   - Go to: https://books.zoho.com
   - Sign in with your Zoho account

2. **Navigate to Organization Settings**
   - Click on **Settings** (gear icon) in the top right
   - Or go to: **Settings** → **Organization**

3. **Find Organization ID**
   - The Organization ID is displayed in the organization details
   - It's usually a **15-digit number** (e.g., `123456789012345`)
   - Look for "Organization ID" or "Org ID" field

---

## Method 2: From URL (Quick)

### Steps:
1. **Login to Zoho Books**
   - Go to: https://books.zoho.com

2. **Check the URL**
   - After logging in, look at the browser URL
   - The URL will contain `org_id=` parameter
   - Example: `https://books.zoho.com/app#/settings/organization?org_id=123456789012345`
   - The number after `org_id=` is your Organization ID

---

## Method 3: From API Response

### Steps:
1. **Make an API call to Zoho Books**
   - Use your access token
   - Call: `GET https://www.zohoapis.com/books/v3/organizations`
   - Include header: `Authorization: Zoho-oauthtoken YOUR_TOKEN`

2. **Response will include Organization ID**
   ```json
   {
     "organizations": [
       {
         "organization_id": "123456789012345",
         "name": "Your Organization Name",
         ...
       }
     ]
   }
   ```

---

## Method 4: From Organization List Page

### Steps:
1. **Login to Zoho Books**
   - Go to: https://books.zoho.com

2. **View Organization List**
   - If you have multiple organizations, you'll see a list
   - Each organization card shows the Organization ID
   - Or click on an organization and check the URL

---

## Visual Guide

### In Zoho Books Settings:
```
Settings → Organization
┌─────────────────────────────────┐
│ Organization Details             │
├─────────────────────────────────┤
│ Organization Name: ABC Corp     │
│ Organization ID: 123456789012345│ ← This is your ZB_ORG_ID
│ Currency: USD                    │
│ ...                              │
└─────────────────────────────────┘
```

### In Browser URL:
```
https://books.zoho.com/app#/settings/organization?org_id=123456789012345
                                                      ^^^^^^^^^^^^^^^^^^^
                                                      This is your ZB_ORG_ID
```

---

## Important Notes

1. **Organization ID Format**:
   - Usually 15 digits (e.g., `123456789012345`)
   - Sometimes can be shorter or longer
   - Always numeric

2. **Multiple Organizations**:
   - If you have multiple organizations, each has a unique ID
   - Make sure you use the correct one for your Zoho Books account

3. **Region-Specific**:
   - Organization ID is unique per Zoho Books region
   - US: `https://books.zoho.com`
   - EU: `https://books.zoho.eu`
   - IN: `https://books.zoho.in`
   - AU: `https://books.zoho.com.au`

---

## Quick Test

Once you have your Organization ID, test it:

```bash
# In backend/.env
ZB_ORG_ID=123456789012345  # Replace with your actual ID
ZB_ACCESS_TOKEN=your_token
```

Then check if it works by looking at backend logs when processing a bill.

---

## Still Can't Find It?

1. **Contact Zoho Support**: https://help.zoho.com/portal/en/kb/books
2. **Check Zoho API Console**: https://api-console.zoho.com/
3. **Review Zoho Documentation**: https://www.zoho.com/books/api/v3/

---

## Related Links

- **Zoho Books Login**: https://books.zoho.com
- **Zoho API Console**: https://api-console.zoho.com/
- **Zoho Books API Docs**: https://www.zoho.com/books/api/v3/

---

**Most Common Method**: Method 2 (from URL) is the fastest - just login and check the URL!


