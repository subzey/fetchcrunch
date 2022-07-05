import { inflateRawSync } from "node:zlib";

import Zopfli from 'zopfli.js/bin/zopfli.raw.min.js';

import { FetchCrunchBase } from "./index.js";

export class FetchCrunchNode extends FetchCrunchBase {
	protected _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array {
		return inflateRawSync(compressed);
	}

	protected _deflateRawFromBinary(source: Uint8Array, dictionary: Uint8Array): Uint8Array {
		const deflater = new Zopfli.Zopfli.RawDeflate(Buffer.from(source), { iterations: 50 });
		// TODO: The compression may benefit for using the bootstrap data as a dictionary
		// Unfortunately, there's apparently no way to do it.
		// It's time to write a custom deflate compressor :D
		return deflater.compress();
	}
}