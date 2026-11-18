import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import { configs as tseslint } from "typescript-eslint";

// Architecture layers (see CLAUDE.md "Architecture"). Dependencies point inwards:
// interfaces -> workflows -> capabilities -> foundation. Folders may not exist yet.
const INTERFACES = ["./src/cli", "./src/server"];
const WORKFLOWS = ["./src/workflows"];
const CAPABILITIES = ["./src/ai", "./src/integrations", "./src/automation", "./src/reporting"];
const VALIDATION = ["./src/validation"];
const SHARED = ["./src/shared"];

const LAYER_ZONES = [
  {
    target: [...WORKFLOWS, ...CAPABILITIES, ...VALIDATION, ...SHARED],
    from: INTERFACES,
    message: "Only entry points use cli/ and server/; logic must not depend on an interface.",
  },
  { target: "./src/cli", from: "./src/server", message: "Interfaces are independent." },
  { target: "./src/server", from: "./src/cli", message: "Interfaces are independent." },
  {
    target: [...CAPABILITIES, ...VALIDATION, ...SHARED],
    from: WORKFLOWS,
    message: "Workflows orchestrate capabilities; capabilities must not depend on workflows.",
  },
  // Capabilities stay independent of each other; combining them is a workflow's job.
  ...CAPABILITIES.map((capability) => ({
    target: capability,
    from: CAPABILITIES.filter((other) => other !== capability),
    message: "Capabilities must not import each other. Combine them in src/workflows/.",
  })),
  {
    target: [...VALIDATION, ...SHARED],
    from: CAPABILITIES,
    message: "validation/ and shared/ are foundations; they must not depend on capabilities.",
  },
  { target: SHARED, from: VALIDATION, message: "shared/ must not depend on other folders." },
];

const NO_CLASSES = {
  selector: "ClassDeclaration, ClassExpression",
  message: "No classes: export functions and plain data (see CLAUDE.md).",
};
const NO_MUTABLE_MODULE_STATE = {
  selector:
    "Program > VariableDeclaration[kind!='const'], Program > ExportNamedDeclaration > VariableDeclaration[kind!='const']",
  message: "No mutable module state: top-level variables must be `const`.",
};
const NO_COMPUTED_MODULE_VALUES = {
  selector:
    "Program > VariableDeclaration > VariableDeclarator[init.type=/^(CallExpression|NewExpression|AwaitExpression)$/], Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type=/^(CallExpression|NewExpression|AwaitExpression)$/]",
  message:
    "No values computed when the file loads. Wrap it in a function (e.g. `loadConfig()`, `createClient(options)`).",
};
const NO_TOP_LEVEL_CONTROL_FLOW = {
  selector:
    "Program > :matches(IfStatement, ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement, TryStatement, SwitchStatement, BlockStatement, ThrowStatement)",
  message: "No code in a file's body: move it into a function.",
};
// Entry points end with `await main();`; that is the only statement allowed at the top level.
const NO_TOP_LEVEL_STATEMENTS = {
  selector:
    "Program > ExpressionStatement:not([expression.type='AwaitExpression'][expression.argument.type='CallExpression'][expression.argument.callee.name='main'])",
  message:
    "No code in a file's body: move it into a function (entry points end with `await main();`).",
};

const MODULE_STRUCTURE_RULES = [
  NO_CLASSES,
  NO_MUTABLE_MODULE_STATE,
  NO_COMPUTED_MODULE_VALUES,
  NO_TOP_LEVEL_CONTROL_FLOW,
];

export default defineConfig(
  { ignores: ["dist/", "coverage/"] },

  tseslint.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Uses the nearest tsconfig.json for each file, so type-aware rules see the same types as tsc.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      // Resolves `#/*` and `.js` -> `.ts` imports the same way TypeScript does.
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          conditionNames: ["template-source", "types", "import", "node"],
        }),
      ],
    },
    rules: {
      // Import from src/ through the `#/` alias only, so imports read the same from any file
      // and don't break when files move.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.{1,2}(/|$)",
              message: "Use the `#/` alias instead of a relative path (e.g. `#/shared/config.js`).",
            },
          ],
        },
      ],
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "type"],
          pathGroups: [{ pattern: "#/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },

  // Architecture and clean-code rules for application code (see CLAUDE.md).
  {
    files: ["src/**/*.ts"],
    rules: {
      "import-x/no-restricted-paths": ["error", { zones: LAYER_ZONES }],
      "import-x/no-cycle": "error",
      "import-x/no-default-export": "error",
      "no-restricted-syntax": ["error", ...MODULE_STRUCTURE_RULES, NO_TOP_LEVEL_STATEMENTS],

      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      eqeqeq: ["error", "always"],
      "no-param-reassign": "error",

      // Size limits keep functions focused. Split the function instead of raising a limit.
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 3],
      "max-depth": ["error", 3],
      complexity: ["error", 10],

      // Printing is I/O, which belongs to the interfaces; other code returns values or throws.
      "no-console": "error",
    },
  },
  {
    files: ["src/cli/**/*.ts", "src/server/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Test runners register tests with top-level calls (`test(...)`, `describe(...)`).
    files: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...MODULE_STRUCTURE_RULES],
      "max-lines-per-function": "off",
      // node:test handles the promises its registration functions return.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
          ],
        },
      ],
    },
  },

  // Must stay last: turns off rules that conflict with Prettier's formatting.
  prettier,
);
