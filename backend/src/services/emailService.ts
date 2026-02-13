import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

interface StepSummary {
  nodeName: string;
  agentName: string;
  status: string;
  durationMs: number | null;
  error?: string;
}

interface EmailData {
  workflowId: string;
  workflowName: string;
  runId: string;
  status: string;
  durationMs: number;
  steps: StepSummary[];
  recipient: string;
}

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
});

export async function sendRunCompletionEmail(data: EmailData): Promise<void> {
  const statusColor = data.status === 'SUCCESS' ? '#22c55e' : '#ef4444';
  const statusEmoji = data.status === 'SUCCESS' ? '✅' : '❌';

  const stepsHtml = data.steps
    .map(
      (s) => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;">${s.nodeName}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${s.agentName}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">
        <span style="color:${s.status === 'SUCCESS' ? '#22c55e' : s.status === 'FAILED' ? '#ef4444' : '#64748b'}">
          ${s.status}
        </span>
      </td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${s.durationMs ?? '-'}ms</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${s.error || '-'}</td>
    </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
  <h2 style="color:${statusColor}">${statusEmoji} Workflow Run ${data.status}</h2>
  <table style="width:100%;margin:16px 0;">
    <tr><td><strong>Workflow:</strong></td><td>${data.workflowName} (#${data.workflowId.slice(0, 8)})</td></tr>
    <tr><td><strong>Run ID:</strong></td><td>${data.runId.slice(0, 8)}</td></tr>
    <tr><td><strong>Status:</strong></td><td style="color:${statusColor}">${data.status}</td></tr>
    <tr><td><strong>Duration:</strong></td><td>${data.durationMs}ms</td></tr>
  </table>
  <h3>Step Details</h3>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Node</th>
        <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Agent</th>
        <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Status</th>
        <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Duration</th>
        <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Error</th>
      </tr>
    </thead>
    <tbody>${stepsHtml}</tbody>
  </table>
  <p style="margin-top:20px;color:#64748b;font-size:12px;">
    This is an automated notification from the AI Workflow Builder.
  </p>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to: data.recipient,
      subject: `[Workflow #${data.workflowId.slice(0, 8)}] ${data.status} – ${data.durationMs}ms`,
      html,
    });
    logger.info('Completion email sent', { runId: data.runId, recipient: data.recipient });
  } catch (err) {
    logger.error('Failed to send email', { error: (err as Error).message, runId: data.runId });
  }
}
