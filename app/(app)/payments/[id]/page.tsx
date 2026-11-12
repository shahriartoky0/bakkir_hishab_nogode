import { PaymentReceipt } from "@/presentation/features/print/receipts";

export default async function PaymentPage({ params, searchParams }: PageProps<"/payments/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <PaymentReceipt id={id} sp={sp} />;
}
