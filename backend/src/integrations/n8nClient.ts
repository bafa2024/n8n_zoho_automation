import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * n8n Webhook Client
 * Sends event payloads to n8n webhook after Zoho sync
 */

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/zoho-bill-process';
const N8N_AUTH_TOKEN = process.env.N8N_AUTH_TOKEN || '';

/**
 * Trigger n8n webhook with payload
 * @param payload Event payload including runId, vendorId, billId, parsedData
 * @returns Response data from n8n
 */
export async function triggerN8n(payload: {
  runId: string;
  vendorId?: string;
  billId?: string;
  parsedData?: any;
  [key: string]: any;
}): Promise<any> {
  // If webhook URL is not configured, log warning and skip
  if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === '') {
    console.warn('N8N_WEBHOOK_URL not configured, skipping n8n webhook trigger');
    return null;
  }

  try {
    // Create axios instance
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if token is provided
    if (N8N_AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${N8N_AUTH_TOKEN}`;
    }

    const client = axios.create({
      headers,
      timeout: 30000,
    });

    console.log(`Triggering n8n webhook for run ${payload.runId}...`);
    console.log(`Webhook URL: ${N8N_WEBHOOK_URL}`);

    const response = await client.post(N8N_WEBHOOK_URL, payload);

    console.log(`n8n webhook response for run ${payload.runId}:`, {
      status: response.status,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = (axiosError.response?.data as any)?.message || axiosError.message;
      
      // Don't throw - just log the error
      console.error(`n8n webhook error for run ${payload.runId}:`, {
        status,
        message,
        code: axiosError.code,
      });
    } else {
      console.error(`n8n webhook error for run ${payload.runId}:`, error);
    }
    
    // Return null instead of throwing to prevent breaking the main flow
    return null;
  }
}



