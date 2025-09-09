import { TokensRepo } from '../storage/tokensRepo.js';

export async function getValidToken(): Promise<string> {
  // Get stored token data
  const tokenData = TokensRepo.get('zoho');
  
  if (!tokenData) {
    throw new Error('Zoho not connected');
  }
  
  // Check if token is still valid (not expired)
  const now = Date.now();
  if (tokenData.expires_at > now) {
    return tokenData.access_token;
  }
  
  // Token is expired, refresh it
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Zoho OAuth not configured');
  }
  
  try {
    const refreshResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      })
    });
    
    if (!refreshResponse.ok) {
      throw new Error(`Token refresh failed: ${refreshResponse.status}`);
    }
    
    const refreshData = await refreshResponse.json();
    
    // Save updated token with new access_token and expires_at
    // Keep the same refresh_token
    const newExpiresAt = Date.now() + (refreshData.expires_in * 1000);
    TokensRepo.save('zoho', refreshData.access_token, tokenData.refresh_token, newExpiresAt);
    
    return refreshData.access_token;
    
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new Error('Failed to refresh Zoho token');
  }
}
