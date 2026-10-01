import { httpRouter } from "convex/server";

import { auth } from "./auth";

const http = httpRouter();

// Mounts the OAuth callback routes (/api/auth/*) on the deployment's .site domain.
if (process.env.KLIPCODE_MIGRATED !== "true") auth.addHttpRoutes(http);

export default http;
