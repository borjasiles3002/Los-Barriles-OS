import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";

export default [
  {languageOptions: { globals: globals.browser }},
  ...tseslint.configs.recommended,
  {
    ...pluginReactConfig,
    settings: {
        react: {
            version: "detect"
        }
    }
},
  {
    rules: {
        "react/react-in-jsx-scope": "off",
        "react/jsx-no-target-blank": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                "vars": "all",
                "args": "after-used",
                "ignoreRestSiblings": true,
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }
        ]
    }
  },
  {
    ignores: ["**/*.cjs", "dist/", "node_modules/", "eslint.config.js"]
  }
];
