import { AdjustmentScreen } from "@/presentation/features/payments/payment-screens";

export default async function AdjustmentPage({ params }: PageProps<"/customers/[id]/adjust">) {
  const { id } = await params;
  return <AdjustmentScreen customerId={id} />;
}
