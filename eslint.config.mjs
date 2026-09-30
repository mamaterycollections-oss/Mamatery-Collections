import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the database schema (scripts/gen-types.mjs).
    "src/lib/supabase/database.types.ts",
  ]),
  {
    rules: {
      // Loading saved state (cart, wishlist, device settings) after hydration is intentional.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
