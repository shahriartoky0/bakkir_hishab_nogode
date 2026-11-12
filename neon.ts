// Neon infrastructure-as-code: `neon deploy` creates these on the linked branch
// and writes the storage credentials (AWS_*) into .env.local.
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  buckets: {
    "baki-photos": {}, // private: photos are only served through short-lived presigned URLs
  },
});
