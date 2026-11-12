import { CustomerProfileScreen } from "@/presentation/features/customers/customer-profile";

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  return <CustomerProfileScreen id={id} />;
}
