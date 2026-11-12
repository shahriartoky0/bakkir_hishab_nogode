import { SaleReceipt } from "@/presentation/features/print/receipts";

export default async function SaleReceiptPage({ params, searchParams }: PageProps<"/sales/[id]/receipt">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <SaleReceipt id={id} sp={sp} />;
}
