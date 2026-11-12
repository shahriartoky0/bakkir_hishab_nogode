import { param } from "@/presentation/lib/server";
import { ReceivePaymentScreen } from "@/presentation/features/payments/payment-screens";

export default async function ReceivePaymentPage({ params, searchParams }: PageProps<"/customers/[id]/pay">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <ReceivePaymentScreen customerId={id} saleId={param(sp.sale)} />;
}
