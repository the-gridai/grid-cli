export type DiagnosticStatus = 'ok' | 'warn' | 'fail';

export interface DiagnosticCheck {
  name: string;
  status: DiagnosticStatus;
  code: string;
  detail: string;
  next_action?: string;
}

export interface DiagnosticsData {
  status: DiagnosticStatus;
  service: string;
  server_time: string;
  checks: DiagnosticCheck[];
  summary: Record<string, unknown>;
}

export interface DiagnosticsResponse {
  data: DiagnosticsData;
}
