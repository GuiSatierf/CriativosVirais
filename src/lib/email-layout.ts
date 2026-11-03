import { authEnv } from "./env";

/** What every message from the app says: a greeting, plain paragraphs, one button and a closing note. */
export type BrandedMessage = {
  /** Inbox preview line, hidden in the body. */
  preview: string;
  greeting: string;
  paragraphs: string[];
  action: { label: string; url: string };
  note: string;
};

// The app's light palette; email clients ignore CSS variables, so the values are written out.
const colors = {
  page: "#efeeea",
  card: "#f8f7f4",
  border: "#dcdad4",
  text: "#1f1e1b",
  muted: "#5b5953",
  brand: "#744de5",
  onBrand: "#ffffff",
};
const font = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

function paragraph(text: string, color = colors.text, size = 16) {
  return `<p style="margin:0 0 16px;font-family:${font};font-size:${size}px;line-height:1.6;color:${color}">${escapeHtml(text)}</p>`;
}

function button({ label, url }: BrandedMessage["action"]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr>
<td style="border-radius:8px;background:${colors.brand}">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-family:${font};font-size:16px;font-weight:600;color:${colors.onBrand};text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Table layout with inline styles, the only form every email client renders the same. */
export function brandedHtml(message: BrandedMessage) {
  const logo = new URL("/brand/logo-email.png", authEnv().BETTER_AUTH_URL).toString();
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${colors.page}">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(message.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.page}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 4px 20px"><img src="${escapeHtml(logo)}" width="200" alt="Criativos Virais" style="display:block;width:200px;height:auto;border:0"></td></tr>
<tr><td style="background:${colors.card};border:1px solid ${colors.border};border-radius:12px;padding:32px 28px">
${paragraph(message.greeting)}
${message.paragraphs.map((text) => paragraph(text)).join("\n")}
${button(message.action)}
${paragraph("Se o botão não abrir, copie e cole este endereço no navegador:", colors.muted, 13)}
<p style="margin:0 0 20px;font-family:${font};font-size:13px;line-height:1.5;color:${colors.muted};word-break:break-all">${escapeHtml(message.action.url)}</p>
${paragraph(message.note, colors.muted, 13)}
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${font};font-size:12px;line-height:1.5;color:${colors.muted}">Criativos Virais · Este é um e-mail automático; não é preciso responder.</td></tr>
</table></td></tr></table>
</body></html>`;
}

/** The same message for clients that show only text. */
export function brandedText(message: BrandedMessage) {
  return [message.greeting, "", ...message.paragraphs, "", `${message.action.label}: ${message.action.url}`, "", message.note].join("\n");
}
