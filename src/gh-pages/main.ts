import { inflateRaw } from 'pako';
import { FetchCrunchBase } from '../../dist/base';
import { WasmZopfliBase } from '../../dist/wasm-zopfli-base';
import wasmUrl from '../../dist/zopfli-with-dictionary.wasm';

class WasmZopfliBrowser extends WasmZopfliBase {
	protected async _loadWasmBinary(): Promise<Uint8Array> {
		const response = await fetch(wasmUrl);
		if (!response.ok) {
			throw new Error(`Not OK: ${response.status}`);
		}
		return new Uint8Array(await response.arrayBuffer());
	}
}

class FetchCrunchBrowser extends FetchCrunchBase {
	private _compressor?: WasmZopfliBrowser;

	protected _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array {
		return inflateRaw(compressed);
	}
	protected _deflateRawFromBinary(source: Uint8Array, dictionary: Uint8Array): Promise<Uint8Array> {
		this._compressor ??= new WasmZopfliBrowser();
		return this._compressor.deflateRaw(source, dictionary);
	}
}

let fetchCrunch: FetchCrunchBrowser | null = null;

function crunch(payload: string | Uint8Array): Promise<Uint8Array> {
	fetchCrunch ??= new FetchCrunchBrowser();
	return fetchCrunch.crunch(payload);
}

console.log(crunch);
