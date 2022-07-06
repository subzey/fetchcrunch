import { inflateRawSync } from "node:zlib";

import Zopfli from 'zopfli.js/bin/zopfli.raw.min.js';

import { FetchCrunchBase } from "./base.js";
import { WasmZopfliNode } from "./wasm-zopfli-node.js";

export class FetchCrunchNode extends FetchCrunchBase {
	protected _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array {
		return inflateRawSync(compressed);
	}

	protected _deflateRawFromBinary(input: Uint8Array, dictionary: Uint8Array): Promise<Uint8Array> {
		const deflater = new WasmZopfliNode(50);
		return deflater.deflateRaw(input, dictionary);
	}
}