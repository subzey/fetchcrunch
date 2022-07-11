import { inflateRawSync } from "node:zlib";

import { FetchCrunchBase } from "./base.js";
import { WasmZopfliNode } from "./wasm-zopfli-node.js";

export class FetchCrunchNode extends FetchCrunchBase {
	protected _zopfliIterations(): number {
		return 50;
	}

	protected _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array {
		return inflateRawSync(compressed);
	}

	protected _deflateRawFromBinary(input: Uint8Array, dictionary: Uint8Array): Promise<Uint8Array> {
		// TODO: Make reusable
		// Current implementation asserts in AddLZ77Data: ll_length[litlen] > 0 if called twice
		const deflater = new WasmZopfliNode(this._zopfliIterations());
		return deflater.deflateRaw(input, dictionary);
	}
}