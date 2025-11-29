# Identifying Your Zoho Token Type

## Your Code Format

```
1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96
```

This format (`1000.xxx.yyy`) is used by Zoho for:
- ✅ **Access Tokens** (what you need)
- ⚠️ **Authorization Codes** (needs exchange)
- ⚠️ **Refresh Tokens** (for renewing access tokens)

---

## How to Identify

### If from Token Generator Page:
- **Source**: https://accounts.zoho.com/apiauthtoken/create
- **Label**: "Generated Code" or "Token"
- **Type**: ✅ **ACCESS TOKEN** - Use directly!

### If from OAuth Redirect URL:
- **Source**: Browser redirect after OAuth authorization
- **URL contains**: `?code=1000.xxx...`
- **Type**: ⚠️ **AUTHORIZATION CODE** - Needs exchange!

---

## Quick Test

### Test 1: Try Using It Directly

Add to `backend/.env`:
```env
ZB_ACCESS_TOKEN=1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96
```

Then test with a simple API call or upload a PDF.

**If it works**: ✅ It's an **ACCESS TOKEN** - You're done!

**If you get 401 error**: ⚠️ It might be an authorization code - needs exchange

---

## If It's an Authorization Code

If the code doesn't work as an access token, you need to exchange it:

### Exchange Authorization Code for Access Token

**Using cURL:**
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "code=1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96"
```

**Using PowerShell:**
```powershell
$body = @{
    grant_type = "authorization_code"
    client_id = "YOUR_CLIENT_ID"
    client_secret = "YOUR_CLIENT_SECRET"
    redirect_uri = "YOUR_REDIRECT_URI"
    code = "1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96"
}

$response = Invoke-RestMethod -Uri "https://accounts.zoho.com/oauth/v2/token" -Method Post -Body $body
$response | ConvertTo-Json
```

**Response will be:**
```json
{
  "access_token": "1000.abc123...",  ← This is your ACCESS TOKEN
  "refresh_token": "1000.xyz789...",
  "expires_in": 3600
}
```

---

## Most Likely Scenario

Based on "Generated Code" label, this is most likely:

✅ **ACCESS TOKEN** from the token generator page

**Action**: Use it directly in your `.env` file!

---

## Next Steps

1. **Add to `.env`**:
   ```env
   ZB_ACCESS_TOKEN=1000.73884c401eef07cdc5dbd3441428c925.61f1356d38f3374fa6fa1cdb7dd6ed96
   ```

2. **Test it**:
   - Start backend: `npm run dev`
   - Upload a test PDF
   - Check logs for any 401 errors

3. **If it works**: ✅ You're all set!

4. **If 401 error**: Exchange it using the method above

---

## Token Expiration

- **Access Tokens**: Expire after 1 hour
- **If expired**: Generate a new one or use refresh token

---

## Security Note

⚠️ **Never share your token publicly!**
- Keep it in `.env` file (already in `.gitignore`)
- Don't commit to git
- Don't share in screenshots or messages


