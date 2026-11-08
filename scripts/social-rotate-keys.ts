import { socialRepository } from "../src/lib/social/repository.ts";
import { rotateCredentialKeys } from "../src/lib/social/service.ts";
const repo = socialRepository();
console.log(await rotateCredentialKeys(repo));
repo.client.close();
