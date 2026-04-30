import { MercadoPagoConfig, Preference } from "mercadopago";

// Helper para construir la preferencia de pago de la seña con la API de MercadoPago
const buildPreference = async (
  accessToken: string,
  appointmentID: string,
  depositAmount: number,
  serviceName: string,
  businessName: string,
  clientName: string,
  clientEmail: string
) => {
  const client = new MercadoPagoConfig({ accessToken });

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
      success: `${process.env.FRONTEND_URL}/deposit-success?appointmentID=${appointmentID}`,
      failure: `${process.env.FRONTEND_URL}/deposit-failure?appointmentID=${appointmentID}`,
      pending: `${process.env.FRONTEND_URL}/deposit-pending?appointmentID=${appointmentID}`,
    },
    external_reference: appointmentID,
    notification_url:   `${process.env.BACKEND_PROD_URL}/api/mp/deposit/webhook`,
    metadata: { appointmentID },
  };
  //console.log("=== PREFERENCE BODY ===", JSON.stringify(body, null, 2));

  const preference = await new Preference(client).create({ body });
  //console.log("=== PREFERENCE CREATED ===", JSON.stringify({
  //  id: preference.id,
  //  init_point: preference.init_point,
  //}, null, 2));

  return preference;
};

export default buildPreference;