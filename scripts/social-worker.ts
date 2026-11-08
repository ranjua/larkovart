import { randomUUID } from "node:crypto";
import { socialRepository } from "../src/lib/social/repository.ts";
import { runSocialTick, scanInventory } from "../src/lib/social/worker.ts";
import { readInventory } from "../src/lib/social/inventory.ts";
import { cleanupSocial } from "../src/lib/social/service.ts";
import { socialConfig } from "../src/lib/social/config.ts";
const config = socialConfig();
if (config.mode !== "local")
  throw new Error(
    "Set SOCIAL_WORKER_MODE=local for the owner-operated worker. No hosted scheduler is created.",
  );
const repo = socialRepository();
let stopping = false,
  cleanupAt = 0;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log(
  "Social local worker starting. Provider writing remains subject to environment gates and exact-post approval.",
);
while (!stopping) {
  try {
    await scanInventory(repo, readInventory);
    const result = await runSocialTick(repo, readInventory, { mode: "local" });
    if (result.processed)
      console.log(
        `Social worker processed ${result.processed} bounded job steps.`,
      );
    if (Date.now() - cleanupAt > 86400000) {
      await cleanupSocial(repo);
      cleanupAt = Date.now();
    }
  } catch {
    console.error(
      "Social worker needs attention. Review Studio Activity; no credential values or provider payloads are logged.",
    );
  }
  if (!stopping)
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        process.off("SIGTERM", finish);
        process.off("SIGINT", finish);
        resolve();
      };
      const timer = setTimeout(finish, 20000);
      process.once("SIGTERM", finish);
      process.once("SIGINT", finish);
    });
}
repo.client.close();
console.log(
  "Social local worker stopped. In-flight provider attempts remain recorded for reconciliation.",
);
