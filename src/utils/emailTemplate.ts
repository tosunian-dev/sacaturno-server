// Reusable transactional email builder for SacaTurno (Resend).
// Design "Bloque": orange banner + white card, with the data grid and
// orange button taken from design "Aire". One builder for every email so
// templates stay consistent and are not re-implemented per service.

export type EmailTone = "brand" | "success" | "warning" | "danger";

export interface EmailRow {
  label: string;
  value: string;
}

export interface EmailCallout {
  tone: EmailTone;
  title: string;
  text?: string;
}

export interface EmailCTA {
  label: string;
  url: string;
  style?: "solid" | "outline"; // both orange (design Aire)
}

export interface EmailModel {
  previewText?: string; // hidden preheader shown in the inbox list
  badge?: string; // uppercase pill inside the banner
  bannerTitle: string; // big white heading in the banner
  greeting?: string; // e.g. "Hola Agustín!"
  lead: string; // intro paragraph (may contain <b>)
  rows?: EmailRow[]; // Aire data grid
  extraHtml?: string; // free block after the grid (e.g. address line)
  callouts?: EmailCallout[]; // tinted status boxes (deposit, refund…)
  cta?: EmailCTA;
  afterCtaText?: string; // note paragraph after the CTA (may contain <b>)
}

// Brand font (Montserrat) for clients that load web fonts (Apple Mail, etc.);
// Gmail/Outlook fall back gracefully to the native system UI font.
const FONT =
  "'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

const TONE: Record<EmailTone, { bg: string; bd: string; ink: string }> = {
  brand: { bg: "#fff2ec", bd: "#f6d3c3", ink: "#c23c1b" },
  success: { bg: "#eef8f1", bd: "#bfe6cd", ink: "#1f8a4c" },
  warning: { bg: "#fff5ec", bd: "#f6dcc2", ink: "#b9541f" },
  danger: { bg: "#fdecea", bd: "#f6cfcc", ink: "#b3261e" },
};

const PREHEADER_SPACER =
  "&#8199;&#65279;".repeat(120); // pushes clipping text out of the preview

// Turns a stored AR phone (no country code, e.g. "1123456789") into a correct
// tel: link. Without this, mail apps auto-detect the bare number and guess a
// country code themselves — usually +1 — instead of +54.
export const telLink = (phone: string | number): string => {
  const digits = String(phone).replace(/\D/g, "");
  return `<a href="tel:+54${digits}" style="color:inherit;text-decoration:inherit;">+54 ${phone}</a>`;
};

const buildRows = (rows: EmailRow[]): string => {
  const cells = rows
    .map((r, i) => {
      const border = i === rows.length - 1 ? "" : "border-bottom:1px solid #f1ebe3;";
      return `<tr>
        <td class="st-cell" style="padding:10px 13px;${border}font-family:${FONT};font-size:10px;text-transform:uppercase;letter-spacing:0.09em;color:#a39a8f;font-weight:600;vertical-align:middle;">${r.label}</td>
        <td class="st-cell" style="padding:10px 13px;${border}font-family:${FONT};font-size:13px;color:#1a1714;font-weight:600;letter-spacing:-0.01em;text-align:right;vertical-align:middle;">${r.value}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" border="0" cellPadding="0" cellSpacing="0" style="border:1px solid #eee6dc;border-radius:12px;border-collapse:separate;border-spacing:0;margin:0 0 18px;">
    <tbody>${cells}</tbody>
  </table>`;
};

const buildCallout = (c: EmailCallout): string => {
  const t = TONE[c.tone];
  const text = c.text
    ? `<span style="font-family:${FONT};font-size:11.5px;line-height:1.5;font-weight:500;color:${t.ink};">${c.text}</span>`
    : "";
  return `<div style="background:${t.bg};border:1px solid ${t.bd};border-radius:10px;padding:11px 13px;margin:0 0 18px;">
    <b style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:-0.01em;color:${t.ink};display:block;margin:0 0 2px;">${c.title}</b>${text}
  </div>`;
};

const buildCTA = (cta: EmailCTA): string => {
  const solid = cta.style !== "outline";
  const skin = solid
    ? "background:#dd4924;color:#ffffff;"
    : "background:#ffffff;color:#dd4924;border:1.5px solid #dd4924;";
  return `<div style="margin:4px 0 0;">
    <a href="${cta.url}" target="_blank" style="display:block;text-align:center;text-decoration:none;font-family:${FONT};font-size:12.5px;font-weight:700;letter-spacing:0.01em;padding:12px;border-radius:10px;${skin}">${cta.label}</a>
  </div>`;
};

export const buildEmail = (m: EmailModel): string => {
  const greeting = m.greeting
    ? `<p style="margin:0 0 7px;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:-0.01em;color:#1a1714;">${m.greeting}</p>`
    : "";
  const rows = m.rows && m.rows.length ? buildRows(m.rows) : "";
  const extra = m.extraHtml ?? "";
  const callouts = (m.callouts ?? []).map(buildCallout).join("");
  const cta = m.cta ? buildCTA(m.cta) : "";
  const afterCta = m.afterCtaText
    ? `<p style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;font-weight:500;color:#948b81;">${m.afterCtaText}</p>`
    : "";
  const preheader = m.previewText
    ? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${m.previewText}<div>${PREHEADER_SPACER}</div></div>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="es">
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="format-detection" content="telephone=no" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap');
      body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      @media only screen and (max-width: 480px) {
        .st-outer { padding: 18px 6px 22px !important; }
        .st-banner { padding: 22px 16px 22px !important; }
        .st-body { padding: 20px 16px 22px !important; }
        .st-cell { padding: 9px 10px !important; }
      }
    </style>
  </head>
  <body style="margin:0;background-color:#f4f1ee;font-family:${FONT};">
    ${preheader}
    <table role="presentation" width="100%" border="0" cellPadding="0" cellSpacing="0" style="background-color:#f4f1ee;">
      <tbody><tr><td align="center" class="st-outer" style="padding:22px 10px 28px;">
        <table role="presentation" width="100%" border="0" cellPadding="0" cellSpacing="0" style="max-width:580px;margin:0 auto;">
          <tbody>
            <tr>
              <td background="https://sacaturno.com.ar/email-header-bg.jpg" class="st-banner" style="background-color:#c0421c;background-image:url('https://sacaturno.com.ar/email-header-bg.jpg');background-repeat:no-repeat;background-position:center center;background-size:cover;padding:26px 26px 28px;border-radius:16px 16px 0 0;">
                <img src="https://sacaturno.com.ar/sacaturno-white-email.png" alt="SacaTurno" width="148" height="37" style="display:block;border:0;outline:none;text-decoration:none;width:148px;height:37px;" />
                <h1 style="margin:17px 0 0;font-family:${FONT};color:#ffffff;font-size:23px;line-height:1.15;letter-spacing:-0.015em;font-weight:700;text-shadow:0 1px 2px rgba(90,28,6,0.2);">${m.bannerTitle}</h1>
              </td>
            </tr>
            <tr>
              <td class="st-body" style="background-color:#ffffff;padding:24px 26px 26px;border-radius:0 0 16px 16px;">
                ${greeting}
                <p style="margin:0 0 20px;font-family:${FONT};font-size:13.5px;line-height:1.7;font-weight:500;color:#5c554e;">${m.lead}</p>
                ${rows}
                ${extra}
                ${callouts}
                ${cta}
                ${afterCta}
              </td>
            </tr>
          </tbody>
        </table>
        <table role="presentation" width="100%" border="0" cellPadding="0" cellSpacing="0" style="max-width:580px;margin:0 auto;">
          <tbody><tr><td style="padding:16px 16px;text-align:center;font-family:${FONT};font-size:10.5px;font-weight:500;letter-spacing:0.02em;color:#a89f95;">
            &copy;2026 SacaTurno. Todos los derechos reservados.
          </td></tr></tbody>
        </table>
      </td></tr></tbody>
    </table>
  </body>
</html>`;
};
