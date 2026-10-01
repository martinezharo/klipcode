// Tells Convex which issuer to trust for identity tokens. `CONVEX_SITE_URL` is
// injected by the deployment and is where `convex/http.ts` serves the auth
// routes, so the deployment validates the tokens it issued itself.
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
