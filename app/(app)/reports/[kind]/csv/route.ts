import { reportCsv } from "@/presentation/routes/downloads";

export async function GET(request: Request, ctx: RouteContext<"/reports/[kind]/csv">) {
  const { kind } = await ctx.params;
  return reportCsv(request, kind);
}
