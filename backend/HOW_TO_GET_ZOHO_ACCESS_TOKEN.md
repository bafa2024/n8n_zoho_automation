# How to Get Zoho Books Access Token (ZB_ACCESS_TOKEN)

## Overview

There are two main methods to get a Zoho Books Access Token:
1. **OAuth Flow** (Recommended for production) - More secure, supports refresh tokens
2. **Direct Token Generation** (Quick for testing) - Simple but tokens expire

---

## Method 1: Direct Token Generation (Quick & Easy)

### ⚡ Fastest Method for Testing

### Steps:

1. **Go to Zoho Token Generator**
   - Direct link: https://accounts.zoho.com/apiauthtoken/create
   - Or: Login to Zoho → Go to API → Generate Token

2. **Select Scopes**
   - Check: **`ZohoBooks.fullaccess.all`**
   - This gives full access to Zoho Books API

3. **Generate Token**
   - Click "Generate" button
   - Copy the generated token (starts with `1000.`)

4. **Use Token**
   - Token format: `1000.abc123def456...`
   - Add to `.env`: `ZB_ACCESS_TOKEN=1000.abc123def456...`

### ⚠️ Important Notes:
- **Token expires**: Usually expires after 1 hour
- **No refresh**: You'll need to generate a new token when it expires
- **Use for**: Testing and development only
- **Not recommended**: For production use

---

## Method 2: OAuth Flow (Recommended for Production)

### 🔒 Secure Method with Refresh Tokens

### Step 1: Create Zoho API Application

1. **Go to Zoho API Console**
   - Link: https://api-console.zoho.com/
   - Login with your Zoho account

2. **Add Client**
   - Click **"Add Client"** button
   - Select **"Server-based Applications"**

3. **Configure Application**
   - **Client Name**: "Zoho Bills Automation" (or any name)
   - **Homepage URL**: `http://localhost:10000` (or your app URL)
   - **Authorized Redirect URIs**: 
     - `http://localhost:10000/oauth/zoho/callback`
     - Or your production callback URL
   - **Scope**: Select `ZohoBooks.fullaccess.all`

4. **Save and Get Credentials**
   - Click "Create"
   - **Copy these values**:
     - **Client ID**: `1000.ABC123...`
     - **Client Secret**: `abc123def456...`

### Step 2: Get Authorization Code

1. **Build Authorization URL**
   ```
   https://accounts.zoho.com/oauth/v2/auth?
     response_type=code&
     client_id=YOUR_CLIENT_ID&
     scope=ZohoBooks.fullaccess.all&
     redirect_uri=YOUR_REDIRECT_URI&
     access_type=offline
   ```

2. **Replace Values**
   - `YOUR_CLIENT_ID`: Your Client ID from Step 1
   - `YOUR_REDIRECT_URI`: Your redirect URI (e.g., `http://localhost:10000/oauth/zoho/callback`)

3. **Open URL in Browser**
   - Copy the complete URL and paste in browser
   - Login to Zoho if prompted
   - Authorize the application

4. **Get Authorization Code**
   - After authorization, you'll be redirected to your callback URL
   - The URL will contain `code=` parameter
   - Example: `http://localhost:10000/oauth/zoho/callback?code=1000.abc123...`
   - **Copy the code value** (everything after `code=`)

### Step 3: Exchange Code for Tokens

#### Option A: Using cURL (Command Line)

```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "code=AUTHORIZATION_CODE"
```

#### Option B: Using PowerShell

```powershell
$body = @{
    grant_type = "authorization_code"
    client_id = "YOUR_CLIENT_ID"
    client_secret = "YOUR_CLIENT_SECRET"
    redirect_uri = "YOUR_REDIRECT_URI"
    code = "AUTHORIZATION_CODE"
}

$response = Invoke-RestMethod -Uri "https://accounts.zoho.com/oauth/v2/token" -Method Post -Body $body
$response | ConvertTo-Json
```

#### Option C: Using Browser/Postman

1. **URL**: `https://accounts.zoho.com/oauth/v2/token`
2. **Method**: POST
3. **Body** (form-data):
   - `grant_type`: `authorization_code`
   - `client_id`: Your Client ID
   - `client_secret`: Your Client Secret
   - `redirect_uri`: Your redirect URI
   - `code`: Authorization code from Step 2

### Step 4: Get Tokens from Response

**Response will look like:**
```json
{
  "access_token": "1000.abc123def456...",
  "refresh_token": "1000.xyz789...",
  "expires_in": 3600,
  "api_domain": "https://www.zohoapis.com"
}
```

**Copy these values:**
- **`access_token`**: This is your `ZB_ACCESS_TOKEN`
- **`refresh_token`**: Use this to refresh the access token when it expires
- **`api_domain`**: Your Zoho API domain (US/EU/IN/AU)

### Step 5: Use Access Token

Add to `backend/.env`:
```env
ZB_ACCESS_TOKEN=1000.abc123def456...
ZB_BASE_URL=https://www.zohoapis.com  # From api_domain in response
```

---

## Method 3: Using Backend OAuth Endpoint (If Implemented)

If your backend has OAuth integration:

1. **Start Backend Server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Visit OAuth URL**
   - Go to: `http://localhost:10000/oauth/zoho`
   - This will redirect you through the OAuth flow

3. **Authorize Application**
   - Login and authorize
   - You'll be redirected back with tokens

4. **Check Backend Logs**
   - Tokens will be logged or stored
   - Copy the access token

---

## Token Refresh (For OAuth Tokens)

### When Access Token Expires

Access tokens expire after 1 hour. Use refresh token to get a new one:

```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=refresh_token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "refresh_token=YOUR_REFRESH_TOKEN"
```

**Response:**
```json
{
  "access_token": "1000.new_token...",
  "expires_in": 3600
}
```

---

## Quick Reference

### Direct Token Generation (Testing)
- **Link**: https://accounts.zoho.com/apiauthtoken/create
- **Scope**: `ZohoBooks.fullaccess.all`
- **Expires**: 1 hour
- **Use**: Quick testing

### OAuth Flow (Production)
- **API Console**: https://api-console.zoho.com/
- **Auth URL**: `https://accounts.zoho.com/oauth/v2/auth`
- **Token URL**: `https://accounts.zoho.com/oauth/v2/token`
- **Expires**: 1 hour (but can refresh)
- **Use**: Production applications

---

## Troubleshooting

### Issue: Token Expired

**Symptoms**: API calls return 401 Unauthorized

**Solution**:
- If using direct token: Generate new token
- If using OAuth: Refresh token using refresh_token

### Issue: Invalid Token

**Symptoms**: API calls return 401 or 403

**Solutions**:
1. Verify token is copied correctly (no extra spaces)
2. Check token hasn't expired
3. Verify scope includes `ZohoBooks.fullaccess.all`
4. Check you're using correct API domain (US/EU/IN/AU)

### Issue: Token Not Working

**Check**:
1. Token format: Should start with `1000.`
2. Organization ID matches token's organization
3. API domain matches your Zoho Books region
4. Token has required permissions

---

## Security Best Practices

1. **Never Commit Tokens**
   - Don't add tokens to git
   - Use `.env` file (already in `.gitignore`)

2. **Use OAuth for Production**
   - Direct tokens are for testing only
   - OAuth supports refresh tokens

3. **Rotate Tokens Regularly**
   - Change tokens every 90 days
   - Revoke old tokens when creating new ones

4. **Store Securely**
   - Use environment variables
   - Don't log tokens in console
   - Use secrets management in production

---

## Environment Variables Setup

### In `backend/.env`:

```env
# Zoho Books Configuration
ZB_ORG_ID=123456789012345
ZB_ACCESS_TOKEN=1000.abc123def456...
ZB_BASE_URL=https://www.zohoapis.com

# For OAuth (if using OAuth flow)
ZOHO_CLIENT_ID=1000.ABC123...
ZOHO_CLIENT_SECRET=abc123def456...
ZOHO_REDIRECT_URI=http://localhost:10000/oauth/zoho/callback
```

---

## Testing Your Token

### Quick Test:

```bash
# Test token with a simple API call
curl -X GET "https://www.zohoapis.com/books/v3/organizations" \
  -H "Authorization: Zoho-oauthtoken YOUR_ACCESS_TOKEN"
```

**Expected**: Returns your organization details

---

## Related Links

- **Zoho API Console**: https://api-console.zoho.com/
- **Token Generator**: https://accounts.zoho.com/apiauthtoken/create
- **Zoho Books API Docs**: https://www.zoho.com/books/api/v3/
- **OAuth Documentation**: https://www.zoho.com/books/api/v3/#oauth

---

## Summary

### For Quick Testing:
1. Go to: https://accounts.zoho.com/apiauthtoken/create
2. Select scope: `ZohoBooks.fullaccess.all`
3. Generate token
4. Copy to `ZB_ACCESS_TOKEN` in `.env`

### For Production:
1. Create app in: https://api-console.zoho.com/
2. Get Client ID and Secret
3. Complete OAuth flow
4. Get access_token and refresh_token
5. Use refresh_token to get new tokens when expired

---

**Recommended for Testing**: Method 1 (Direct Token Generation) - Fastest and easiest!


