import { inflateRawSync } from "node:zlib";

import { FetchCrunchBase } from "./base.js";
import { WasmZopfliNode } from "./wasm-zopfli-node.js";

export class FetchCrunchNode extends FetchCrunchBase {
	private _deflater: WasmZopfliNode | null = null;

	protected _zopfliIterations(): number {
		return 50;
	}

	protected _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array {
		return inflateRawSync(compressed);
	}

	protected _deflateRawFromBinary(input: Uint8Array, dictionary: Uint8Array): Promise<Uint8Array> {
		this._deflater ??= new WasmZopfliNode();
		return this._deflater.deflateRaw(input, { dictionary, numIterations: this._zopfliIterations() });
	}
}