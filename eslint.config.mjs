import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off", 
      "no-undef": "off", 
    },
  },
  {

    ignores: ["dist/", "node_modules/", "swagger-output.json", "swagger.js", "swagger.ts"],
  }
);