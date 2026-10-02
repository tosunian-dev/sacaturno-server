import { Resend } from "resend";

// TLDs reservados por RFC 2606/6761: nunca son casillas reales. El seed carga
// clientes @mail.test y cuentas @sacaturno.test en la base principal, y sin este
// filtro los crons (recordatorios, vencimientos) les mandaban mails y consumían
// la cuota de Resend.
const RESERVED_TLDS = [".test", ".example", ".invalid", ".localhost"];

export const isUndeliverableEmail = (email: string) => {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return !domain || RESERVED_TLDS.some((tld) => domain.endsWith(tld));
};

const toList = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

// Usar siempre en lugar de `new Resend(...)`.
export const createMailer = () => {
  const resend = new Resend(process.env.RESEND_KEY);
  const send = resend.emails.send.bind(resend.emails);

  resend.emails.send = async (payload, options) => {
    const to = toList(payload.to).filter((e) => !isUndeliverableEmail(e));
    if (to.length === 0) return { data: null, error: null };

    const cc = toList(payload.cc).filter((e) => !isUndeliverableEmail(e));
    const bcc = toList(payload.bcc).filter((e) => !isUndeliverableEmail(e));
    return send(
      {
        ...payload,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
      },
      options
    );
  };

  return resend;
};
