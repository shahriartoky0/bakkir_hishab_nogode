import { CustomerStatement } from "@/presentation/features/print/statement";

export default async function StatementPage({ params, searchParams }: PageProps<"/customers/[id]/statement">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <CustomerStatement id={id} sp={sp} />;
}
