// Host: container. The framework starts its own server, which is what people deploy.
const target = process.env.RB_TARGET ?? "baseline";
const app = await import(`../${target}/app.js`);
const port = Number(process.env.PORT ?? 8080);
await app.listen(port);
console.log(`container/${target} listening on ${port}`);
