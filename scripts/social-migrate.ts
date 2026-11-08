import { socialRepository } from "../src/lib/social/repository.ts";
const repo = socialRepository();
await repo.init();
console.log(
  "Additive social migrations applied. Commerce initialization and provider calls were not run.",
);
repo.client.close();
