const path = require("path");

const { expoRouterBabelPlugin } = require("babel-preset-expo/build/expo-router-plugin");

// In this pnpm monorepo, `babel-preset-expo` is hoisted to the workspace root,
// where its internal `hasModule(...)` checks fail (because expo-router /
// react-native-worklets / react-native-reanimated are only installed under the
// mobile artifact's own node_modules). Without those checks succeeding, the
// preset never registers the expo-router and worklets babel plugins — causing:
//   * `process.env.EXPO_ROUTER_APP_ROOT` not inlined → require.context() throws
//   * runtime `[Worklets] Failed to create a worklet` errors
//
// We detect that case and inject the plugins manually. If hoisting ever changes
// and the preset auto-registers them, this branch is skipped to avoid double-running.
let needsManualPlugins = false;
try {
  const presetDir = path.dirname(require.resolve("babel-preset-expo/package.json"));
  require.resolve("react-native-worklets/plugin", { paths: [presetDir] });
} catch {
  needsManualPlugins = true;
}

const manualPlugins = needsManualPlugins
  ? [
      expoRouterBabelPlugin,
      // IMPORTANT: react-native-worklets/plugin MUST be the LAST plugin.
      require.resolve("react-native-worklets/plugin"),
    ]
  : [];

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: manualPlugins,
  };
};
