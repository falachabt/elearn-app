// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // Le typage est le premier filet contre les crashs natifs : pas de ts-expect-error / ts-ignore hors tests.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: { "@typescript-eslint/ban-ts-comment": "error" },
  },
]);
