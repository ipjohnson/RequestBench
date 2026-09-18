// Host: container. The framework starts its own server, which is what people deploy.
import { listening } from "../_shared/host.js";

const target = process.env.RB_TARGET;
if (!target) throw new Error("RB_TARGET is not set");
const app = await import(`../${target}/app.js`);
const port = Number(process.env.PORT ?? 8080);
await app.listen(port);
listening();
console.log(`container/${target} listening on ${port}`);
