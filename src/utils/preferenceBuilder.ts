import { MercadoPagoConfig, Preference } from "mercadopago";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// Solo medios de acreditación inmediata. Efectivo (ticket) y cajero (atm) son
// offline: el cliente puede tardar días en pagar, y ningún hold razonable puede
// bloquear un turno todo ese tiempo.
const OFFLINE_PAYMENT_TYPES = [{ id: "ticket" }, { id: "atm" }];

// Helper para construir la preferencia de pago de la seña con la API de MercadoPago
const buildPreference = async (
  accessToken: string,
  appointmentID: string,
  depositAmount: number,
  serviceName: string,
  businessName: string,
  clientName: string,
  clientEmail: string,
  businessSlug: string,
  holdUntil: Date
) => {
  const client = new MercadoPagoConfig({ accessToken });

  // Todas las back_urls vuelven al perfil público del negocio; la página decide
  // si mostrar el resultado del pago según los parámetros que agrega MP.
  const returnURL = `${process.env.FRONTEND_URL}/${businessSlug}?appointmentID=${appointmentID}`;

  const body = {
    items: [
      {
        id: appointmentID,
        title: `Seña - ${serviceName} en ${businessName}`,
        quantity: 1,
        unit_price: depositAmount,
        currency_id: "ARS",
      },
    ],
    payer: { name: clientName, email: clientEmail },
    back_urls: {
      success: returnURL,
      failure: returnURL,
      pending: returnURL,
    },
    auto_return: "approved",
    payment_methods: { excluded_payment_types: OFFLINE_PAYMENT_TYPES },
    // El checkout vence junto con la reserva temporal del turno. Si MP siguiera
    // aceptando el pago después de liberarse el slot, volvería a existir la
    // posibilidad de que dos clientes paguen el mismo horario.
    expires: true,
    expiration_date_to: dayjs(holdUntil)
      .tz("America/Argentina/Buenos_Aires")
      .format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
    external_reference: appointmentID,
    notification_url:   `${process.env.BACKEND_PROD_URL}/api/mp/deposit/webhook`,
    metadata: { appointmentID },
  };

  const preference = await new Preference(client).create({ body });

  return preference;
};

export default buildPreference;
