import { auth } from "./auth.ts";
import { composeApp } from "./composition-root.ts";
import { config } from "./config.ts";

const app = composeApp(auth, config.trustProxy, config.corsOrigins);

app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});
