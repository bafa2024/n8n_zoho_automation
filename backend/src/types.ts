// Run status type
export type RunStatus = "parsed" | "processing" | "zoho_synced" | "completed" | "error";

// Simplified Run interface for dashboard
export interface Run {
  id: string;
  invoice: string | null;
  vendor: string | null;
  status: RunStatus;
  items: number;
  bill: string | null;
  when: string;
  raw?: any;
}



