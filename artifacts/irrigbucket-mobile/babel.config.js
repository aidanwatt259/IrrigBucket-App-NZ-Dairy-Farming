module.exports = function (api) {
  api.cache(true);
  return {
    // SDK 57 handles Router and Worklets through the Expo preset.
    // Keep import.meta support for shared workspace modules.
    presets: [["babel-preset-expo", { transformImportMeta: true }]],
  };
};
