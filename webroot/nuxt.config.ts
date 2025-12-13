// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },

  nitro: {
    routeRules: {
      "/index.html": { redirect: "/" },
    },
  },

  vite: {
    build: {
      minify: "terser",
      sourcemap: false,
      terserOptions: {
        ecma: 2020,
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ["console.log", "console.info", "console.debug"],
          sequences: true,
          dead_code: true,
          conditionals: true,
          booleans: true,
          unused: true,
          if_return: true,
          join_vars: true,
          hoist_funs: true,
          hoist_vars: true,
          reduce_vars: true,
        },
        mangle: true,
        format: {
          comments: false,
        },
        keep_classnames: false,
        keep_fnames: false,
      },
    },
  },
});
