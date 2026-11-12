/**
 * Clean Architecture boundaries (spec 3), enforced in `npm run lint`.
 *
 *   domain ← application ← infrastructure
 *                ↑               ↑
 *          presentation → composition (wires infrastructure into use cases)
 *   app/ (thin routes) → presentation
 */
// npm packages resolve to node_modules/<name>/… paths.
const FRAMEWORKS = "(^|/)node_modules/(react|react-dom|next|next-intl|next-themes|@tanstack|react-hook-form)/";
const VENDOR_SDKS = "(^|/)node_modules/(drizzle-orm|drizzle-kit|@neondatabase|ws|better-auth|@better-auth|@aws-sdk)/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment: "domain must not import other layers, frameworks or vendor SDKs",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: [
          "^src/(application|infrastructure|presentation|composition)",
          "^app/",
          FRAMEWORKS,
          VENDOR_SDKS,
        ],
      },
    },
    {
      name: "application-is-framework-free",
      comment: "application may import domain only (plus its own ports/dto)",
      severity: "error",
      from: { path: "^src/application" },
      to: {
        path: ["^src/(infrastructure|presentation|composition)", "^app/", FRAMEWORKS, VENDOR_SDKS],
      },
    },
    {
      name: "infrastructure-not-presentation",
      severity: "error",
      from: { path: "^src/infrastructure" },
      to: { path: ["^src/(presentation|composition)", "^app/"] },
    },
    {
      name: "presentation-no-infrastructure-or-sdks",
      comment: "presentation reaches infrastructure only through src/composition",
      severity: "error",
      from: { path: "^src/presentation" },
      to: { path: ["^src/infrastructure", VENDOR_SDKS] },
    },
    {
      name: "routes-are-thin",
      comment: "app/ routes use presentation (and domain constants), never infrastructure or SDKs",
      severity: "error",
      from: { path: "^app/" },
      to: { path: ["^src/(infrastructure|application|composition)", VENDOR_SDKS] },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Don't exclude node_modules (that would hide SDK imports); just don't descend into it.
    exclude: { path: "(^|/)(\\.next|drizzle|tests)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types", "react-server"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".d.ts"],
    },
  },
};
