import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv } from './env';

declare global {
  var __ewarsMailer: Transporter | undefined;
}

function getTransporter(): Transporter {
  if (!globalThis.__ewarsMailer) {
    const env = getEnv();
    globalThis.__ewarsMailer = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return globalThis.__ewarsMailer;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
}

/** Gửi email qua SMTP nội bộ (dev: MailHog). Không đưa dữ liệu nhạy cảm vào nội dung. */
export async function sendMail({ to, subject, text }: MailInput): Promise<void> {
  await getTransporter().sendMail({ from: getEnv().SMTP_FROM, to, subject, text });
}
