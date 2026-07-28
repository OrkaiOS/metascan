import { expect, test } from "bun:test";
import { VERSION } from "./index";

test("@metascan/core smoke: VERSION is a non-empty semver string", () => {
	expect(typeof VERSION).toBe("string");
	expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});
