import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { WasmZopfliBase } from "./wasm-zopfli-base.js";

export class WasmZopfliNode extends WasmZopfliBase {
	protected _loadWasmBinary(): Promise<Uint8Array> {
		return readFile(
			fileURLToPath(new URL('./zopfli-with-dictionary.wasm', import.meta.url))
		);
	}
}