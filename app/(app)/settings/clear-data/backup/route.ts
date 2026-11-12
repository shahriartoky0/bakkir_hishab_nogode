import { clearBackupJson } from "@/presentation/routes/downloads";

export async function GET(request: Request) {
  return clearBackupJson(request);
}
