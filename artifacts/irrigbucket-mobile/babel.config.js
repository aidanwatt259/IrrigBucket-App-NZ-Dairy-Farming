const { expoRouterBabelPlugin } = require("babel-preset-expo/build/expo-router-plugin");

// In this pnpm monorepo, `babel-preset-expo` is hoisted to the workspace root,
// where its internal `hasModule('expo-router')` check fails — so it never
// registers `expoRouterBabelPlugin`, leaving `process.env.EXPO_ROUTER_APP_ROOT`
// un-inlined and breaking the `require.context()` call in expo-router/_ctx.*.js.
// We detect that case and inject the plugin manually. If hoisting ever changes
// and the preset auto-registers it, this branch is skipped to avoid double-running.
let needsManualRouterPlugin = false;
try {
  const presetDir = require.resolve("babel-preset-expo/package.json");
  require.resolve("expo-router", { paths: [require("path").dirname(presetDir)] });
} catch {
  needsManualRouterPlugin = true;
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: needsManualRouterPlugin ? [expoRouterBabelPlugin] : [],
  };
};
