import { expect, test } from "bun:test";
import { APP_NAME, VERSION } from "./index";

test("metascan-server smoke: imports core via workspace link", () => {
	expect(APP_NAME).toBe("metascan-server");
	expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});
