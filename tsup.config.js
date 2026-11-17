import { defineConfig } from "tsup";

export default defineConfig([
	{
		sourcemap: true,
		minify: true,
		entryPoints: ["index.ts"],
		format: ["esm", "cjs"],
		outDir: "lib",
		target: "node16",
		dts: true,
	},
	{
		minify: true,
		entry: { "lumiere-heatmap": "src/standalone/lumiere-heatmap.ts" },
		format: ["iife"],
		outDir: "lib",
		platform: "browser",
		target: "es2022",
		outExtension: () => ({ js: ".js" }),
	},
]);
