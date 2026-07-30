import { $ } from "bun";

await $`rm -rf dist`;

await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	target: "bun",
	format: "esm",
	sourcemap: "linked",
	external: ["cheerio"],
});

await $`tsc -p tsconfig.build.json`;
