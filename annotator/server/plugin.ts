// A Vite plugin that serves the local data API during `npm run dev`:
//   GET /api/vocabulary          vocab/vocabulary.json
//   GET /api/athletes            the Athlete registry
//   GET /api/annotations         ids of the saved Annotations
//   GET /api/annotations/:id     annotations/<id>.json
//   PUT /api/annotations/:id     save annotations/<id>.json (schema-checked)

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  listAnnotations,
  readAnnotation,
  readRegistry,
  readVocabulary,
  StoreError,
  writeAnnotation,
} from "./annotation-store";

type Handler = (req: IncomingMessage, params: string[]) => Promise<unknown>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new StoreError(400, "The request body isn't JSON.");
  }
}

const routes: Route[] = [
  { method: "GET", pattern: /^\/api\/vocabulary$/, handler: () => readVocabulary() },
  { method: "GET", pattern: /^\/api\/athletes$/, handler: () => readRegistry() },
  { method: "GET", pattern: /^\/api\/annotations$/, handler: () => listAnnotations() },
  {
    method: "GET",
    pattern: /^\/api\/annotations\/([^/]+)$/,
    handler: async (_req, [id]) => JSON.parse(await readAnnotation(id!)),
  },
  {
    method: "PUT",
    pattern: /^\/api\/annotations\/([^/]+)$/,
    handler: async (req, [id]) => {
      await writeAnnotation(id!, await readBody(req));
      return { saved: id };
    },
  },
];

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function annotationApi(): Plugin {
  return {
    name: "bjj-graph-annotation-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0]!;
        if (!path.startsWith("/api/")) return next();
        for (const route of routes) {
          const match = route.pattern.exec(path);
          if (!match || route.method !== req.method) continue;
          try {
            return send(res, 200, await route.handler(req, match.slice(1).map(decodeURIComponent)));
          } catch (error) {
            if (error instanceof StoreError) return send(res, error.status, { error: error.message, details: error.details });
            return send(res, 500, { error: String(error) });
          }
        }
        send(res, 404, { error: `No route for ${req.method} ${path}` });
      });
    },
  };
}
