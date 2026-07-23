import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
});

export async function createCheckoutPreference(params: {
  orderId: string;
  eventName: string;
  ticketPriceCents: number;
  quantity: number;
  notificationUrl: string;
}) {
  const preference = new Preference(client);
  const result = await preference.create({
    body: {
      items: [
        {
          id: params.orderId,
          title: params.eventName,
          quantity: params.quantity,
          unit_price: params.ticketPriceCents / 100,
          currency_id: "BRL",
        },
      ],
      external_reference: params.orderId,
      notification_url: params.notificationUrl,
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error(
      "Mercado Pago não retornou id/init_point ao criar a preference",
    );
  }

  return { id: result.id, initPoint: result.init_point };
}

export async function fetchPayment(paymentId: string) {
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
