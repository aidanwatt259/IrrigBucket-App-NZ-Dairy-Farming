const { getDefaultConfig } = require("@expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");

/**
 * Metro configuration for pnpm monorepo.
 * watchFolders and nodeModulesPaths let Metro resolve workspace packages.
 * blockList excludes Replit-internal directories that Metro can't watch.
 * @type {import('@expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.blockList = [
  // Exclude Replit agent/skill directories — they contain symlinks and
  // ephemeral paths that Metro's file watcher cannot track.
  new RegExp(`${escapeRegex(workspaceRoot)}/\\.local(/.*)?$`),
  new RegExp(`${escapeRegex(workspaceRoot)}/\\.replit(/.*)?$`),
];

// expo-sqlite's web build (wa-sqlite) statically imports a `.wasm` binary.
// Metro does not treat `.wasm` as an asset by default, so the web bundle fails
// to resolve it. Register it as an asset extension so the web bundle builds.
// (Native bundles never hit this import.)
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

// The workspace TS libs (@workspace/sync, @workspace/api-client-react) are
// ESM with NodeNext-style ".js" import specifiers that actually point at
// ".ts"/".tsx" source files. Metro's default resolver does not rewrite
// ".js" -> ".ts", so when a relative ".js" request fails to resolve, retry
// it against its TypeScript sibling. This is a no-op when default
// resolution already succeeds.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith(".js")) {
      const base = moduleName.slice(0, -3);
      for (const ext of [".ts", ".tsx"]) {
        try {
          return context.resolveRequest(context, base + ext, platform);
        } catch {
          // try the next candidate extension
        }
      }
    }
    throw error;
  }
};

module.exports = config;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
