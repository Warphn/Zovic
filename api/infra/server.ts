import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "../adapters/http/middlewares/error-handler.ts";
import { openApiDocument } from "../adapters/http/openapi.ts";
import { router } from "./composition-root.ts";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());
app.get("/health", (_req, res) => {
  res.sendStatus(200);
});
app.get("/docs/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use("/api", router);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3333);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
