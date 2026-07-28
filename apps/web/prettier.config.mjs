import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import("prettier").Config} */
const config = {
  // Resolve from this app folder so IDE Prettier (often CWD = monorepo root) still finds the plugin.
  plugins: [require.resolve("prettier-plugin-tailwindcss")],
  tailwindStylesheet: "./src/index.css",
  tailwindFunctions: ["cn", "cva", "clsx", "twMerge"],
};

export default config;
