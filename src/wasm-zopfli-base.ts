import type { WasmExports } from "./zopfli-with-dictionary";

export abstract class WasmZopfliBase {
	private _numIterations: number;
	private _wasmExports: Promise<WasmExports>;
	private _outPtrPtr?: number;
	private _outSizePtr?: number;

	protected abstract _loadWasmBinary(): Promise<Uint8Array>;

	constructor(numIterations=15) {
		this._numIterations = numIterations;
		this._wasmExports = this._loadWasm();
	}

	public async deflateRaw(input: Uint8Array, dictionary = new Uint8Array(0)): Promise<Uint8Array> {
		if (input.byteLength === 0) {
			// We don't need zopfli to compress an empty file
			return Uint8Array.of(3, 0);
		}

		const { memory, allocBuf, freeBuf, compress } = await this._wasmExports;
		const outPtrPtr = this._outPtrPtr ??= allocBuf(4); // Never freed
		const outSizePtr = this._outSizePtr ??= allocBuf(4); // Never freed

		const inSize = input.byteLength + dictionary.byteLength;
		const inPtr = allocBuf(inSize);
		const memorySlice = new Uint8Array(memory.buffer, inPtr, inSize);
		memorySlice.set(dictionary, 0);
		memorySlice.set(input, dictionary.byteLength);
		compress(
			this._numIterations,
			inPtr, dictionary.byteLength, input.byteLength,
			outPtrPtr, outSizePtr
		);
		
		// The memory.buffer may be a new ArrayBuffer after the compress() call.
		// (Wasm modules can resize its memory but ArrayBuffers are not resizable)
		const dataView = new DataView(memory.buffer);
		const outPtr = dataView.getUint32(outPtrPtr, true);
		const outSize = dataView.getUint32(outSizePtr, true);
		// Copy result into a separate Uint8Array backed by a separate ArrayBuffer
		// as the values in the wasm memory is about to be free()'d.
		const result = new Uint8Array(memory.buffer, outPtr, outSize).slice();

		freeBuf(inPtr);
		freeBuf(outPtr); // Zopfli expect us to free the buffer it created

		return result;
	}

	protected async _loadWasm(): Promise<WasmExports> {
		const { instance } = await WebAssembly.instantiate(
			await this._loadWasmBinary(),
			{
				// Stub WASI functions
				// The implementation is not supposed to read/write anything from FS
				wasi_snapshot_preview1: {
					proc_exit() { throw new Error('proc_exit() is not implemented') },
					fd_close() { throw new Error('fd_close() is not implemented') },
					fd_write() { throw new Error('fd_write() is not implemented') },
					fd_seek() { throw new Error('fd_seek() is not implemented') },
				}
			}
		);

		// Wasm exports cannot be typed in TypeScript
		return instance.exports as unknown as WasmExports;
	}
}