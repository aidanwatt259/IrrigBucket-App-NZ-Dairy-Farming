const { getDefaultConfig } = require("@expo/metro-config");
const { mergeConfig } = require("metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");

/**
 * Metro configuration for pnpm monorepo.
 * watchFolders and nodeModulesPaths let Metro resolve workspace packages.
 * @type {import('@expo/metro-config').MetroConfig}
 */
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
  },
});
