import { expect, test } from "bun:test";

const NODE_SPECIFIER = /^\s*(?:import|export)\b.*\bfrom\s+["']node:/;

test("core src has no node:* imports (web-standard boundary)", async () => {
	const glob = new Bun.Glob("**/*.ts");
	const offenders: string[] = [];
	for await (const path of glob.scan({ cwd: import.meta.dirname })) {
		const text = await Bun.file(`${import.meta.dirname}/${path}`).text();
		for (const line of text.split("\n")) {
			if (NODE_SPECIFIER.test(line)) offenders.push(`${path}: ${line.trim()}`);
		}
	}
	expect(offenders).toEqual([]);
});
