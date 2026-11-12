import { UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { CustomerFilter } from "@/application/ports/queries";
import { container } from "@/composition/container";
import { PageHeader } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { signPhotos } from "../../lib/server";
import { CustomerForm } from "./customer-form";
import { CustomerList } from "./customer-list";

const FILTERS: CustomerFilter[] = ["all", "has_dues", "overdue", "blocked", "archived"];

export async function CustomersScreen({ filter }: { filter?: string }) {
  const t = await getTranslations("customers.list");
  const initial = FILTERS.includes(filter as CustomerFilter) ? (filter as CustomerFilter) : "all";
  return (
    <section className="space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild className="h-11">
            <Link href="/customers/new">
              <UserPlus className="size-5" aria-hidden /> {t("add")}
            </Link>
          </Button>
        }
      />
      <CustomerList initialFilter={initial} />
    </section>
  );
}

export async function NewCustomerScreen({ phone }: { phone?: string }) {
  const t = await getTranslations("customers.form");
  return (
    <section className="space-y-4">
      <PageHeader title={t("newTitle")} backHref="/customers" />
      <CustomerForm initialPhone={phone} />
    </section>
  );
}

export async function EditCustomerScreen({ id }: { id: string }) {
  const t = await getTranslations("customers.form");
  const profile = await container.queries().customerProfile(id);
  if (!profile) notFound();
  const c = profile.customer;
  const urls = await signPhotos([c.photoThumbKey ?? c.photoKey]);
  return (
    <section className="space-y-4">
      <PageHeader title={t("editTitle")} backHref={`/customers/${id}`} />
      <CustomerForm customer={c} photoUrl={urls[c.photoThumbKey ?? c.photoKey ?? ""] ?? null} />
    </section>
  );
}
