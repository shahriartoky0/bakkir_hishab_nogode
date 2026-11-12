import { tableCsv } from "@/presentation/routes/downloads";

export async function GET(_request: Request, ctx: RouteContext<"/settings/export/[table]">) {
  const { table } = await ctx.params;
  return tableCsv(table);
}
