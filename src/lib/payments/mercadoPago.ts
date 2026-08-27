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
  eventSlug: string;
  appUrl: string;
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
      // Sem back_urls o Mercado Pago não sabe pra onde redirecionar o
      // comprador de volta — ele fica parado na própria página do MP
      // mesmo depois do pagamento aprovado. auto_return "approved" faz
      // o redirect acontecer automaticamente assim que aprovar, sem
      // esperar o comprador clicar em algum botão.
      // success/pending vão pra uma página de confirmação dedicada (sem
      // formulário de compra, só a instrução de olhar o e-mail/spam);
      // failure volta pra página do evento, onde dá pra tentar comprar de
      // novo.
      back_urls: {
        success: `${params.appUrl}/e/${params.eventSlug}/confirmacao?status=success`,
        pending: `${params.appUrl}/e/${params.eventSlug}/confirmacao?status=pending`,
        failure: `${params.appUrl}/e/${params.eventSlug}?status=failure`,
      },
      auto_return: "approved",
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
