export class NodeUsageDetailDto {
  model: string | null;
  latencyMs: number;
  inToken: number;
  outToken: number;
  cacheToken: number;
  totalTokens: number;
  status: string;
  input: Record<string, any>;
  output: Record<string, any>;
  errorMessage?: string | null;
}

export class AiAuditPayloadDto {
  requestId: string;
  conversationId: string;
  companyId: number;
  userId: number;
  userEmail?: string | null;
  userName?: string | null;
  chatMode: string;
  requestType?: string;
  userQuery: string;
  finalResponse?: string | null;
  status: string;
  totalLatencyMs: number;
  inToken: number;
  outToken: number;
  cacheToken: number;
  totalTokens: number;
  nodeWiseUsage: Record<string, NodeUsageDetailDto>;
  errorMessage?: string | null;
}
