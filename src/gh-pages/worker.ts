/// <reference lib="webworker"/>

import { inflateRaw } from 'pako';
import { FetchCrunchBase } from '../../dist/base.js';
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
	private _iterations: number | undefined;
	private _template: string | undefined;

	public constructor(params: { iterations?: number; template?: string}) {
		super();
		this._iterations = params.iterations;
		this._template = params.template;
	}
	protected _htmlTemplate(): string {
		return this._template || super._htmlTemplate();
	}
	protected _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array {
		return inflateRaw(compressed);
	}
	protected _deflateRawFromBinary(source: Uint8Array, dictionary: Uint8Array): Promise<Uint8Array> {
		const compressor = new WasmZopfliBrowser(this._iterations);
		return compressor.deflateRaw(source, dictionary);
	}
}

self.addEventListener('message', async (e: MessageEvent) => {
	try {
		const fetchCrunch = new FetchCrunchBrowser(e.data);
		const result = await fetchCrunch.crunch(e.data.source);
		self.postMessage({ result }, [ result.buffer ]);
	} catch (e) {
		self.postMessage({ errorMessage: (e as Error | null)?.message });
	}
});

