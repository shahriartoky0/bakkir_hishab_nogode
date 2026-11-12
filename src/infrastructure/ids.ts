import { v7 as uuidv7 } from "uuid";
import type { IdGenerator } from "@/application/ports/id-generator";

export const newId = (): string => uuidv7();

export const uuidV7Generator: IdGenerator = { next: newId };
