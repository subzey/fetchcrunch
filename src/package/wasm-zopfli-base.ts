interface WasmExports {
	memory: WebAssembly.Memory;
	allocBuf(bytes: number): number;
	freeBuf(ptr: number): void;
	compress(
		/* zopfli numiterations parameter */
		numIterations: number,
		/* The (dictionary + input) starts here in the memory */
		inPtr: number,
		/* Start of input (right after the dictionary) */
		inStart: number,
		/* Length of input */
		inSize: number,
		/* The memory location of the bit counter */
		bpPtr: number,
		/* The memory location of the output start will be stored at this address */
		outPtrPtr: number,
		/* The output length will be stored at this address */
		outSizePtr: number
	): void;
}

export interface DeflateRawOptions {
	/**
	 * A dictionary to use.
	 * This data won't be compressed, but the compressor may use it to make backreferences.
	 */
	dictionary?: Uint8Array;
	/**
	 * Number of zopfli iterations
	 */
	numIterations?: number;
}

export abstract class WasmZopfliBase {
	private _wasmExports: Promise<WasmExports>;
	private _outPtrPtr?: number;

	protected abstract _loadWasmBinary(): Promise<Uint8Array>;

	constructor() {
		this._wasmExports = this._loadWasm();
	}

	public async deflateRaw(
		input: Uint8Array,
		{
			dictionary = new Uint8Array(0),
			numIterations = 15,
		}: DeflateRawOptions
	): Promise<Uint8Array> {
		if (input.byteLength === 0) {
			// We don't need zopfli to compress an empty file
			return Uint8Array.of(3, 0);
		}

		const { memory, allocBuf, freeBuf, compress } = await this._wasmExports;
		const outPtrPtr = this._outPtrPtr ??= allocBuf(9); // Never freed
		const outSizePtr = outPtrPtr + 4;
		const bpPtr = outPtrPtr + 8;
		{ // Reset variables
			const dataView = new DataView(memory.buffer);
			// Just in case
			dataView.setUint32(outPtrPtr, 0, true);
			// An in-out variable, should be zeroed out
			dataView.setUint32(outSizePtr, 0, true);
			// An in-out variable, should be zeroed out
			dataView.setUint8(bpPtr, 0);
		}

		const inSize = input.byteLength + dictionary.byteLength;
		const inPtr = allocBuf(inSize);
		{ // Set dictionary + data
			const memorySlice = new Uint8Array(memory.buffer, inPtr, inSize);
			memorySlice.set(dictionary, 0);
			memorySlice.set(input, dictionary.byteLength);
		}

		compress(
			numIterations,
			inPtr, dictionary.byteLength, inSize,
			bpPtr,
			outPtrPtr, outSizePtr
		);
		
		// DO NOT try to reuse the dataView from above.
		// The memory may have been resized (and most probably it was)
		// so the previous memory.buffer value is no longer valid
		const dataView = new DataView(memory.buffer);
		const outPtr = dataView.getUint32(outPtrPtr, true);
		const outSize = dataView.getUint32(outSizePtr, true);

		// Copy result into a separate Uint8Array backed by a separate ArrayBuffer
		// as the values in the wasm memory is about to be free()'d.
		const result = new Uint8Array(memory.buffer, outPtr, outSize).slice();

		this._wakaPatch(result, dataView.getUint8(bpPtr));

		freeBuf(outPtr); // Zopfli expect us to free the buffer it created
		freeBuf(inPtr);
		
		return result;
	}

	// Hacky trick:
	// The final byte may include padding bits that are ignored by the decompressor.
	// We can try to make the final be 0x3E (">") increasing chances of raw DEFLATE
	// bit stream to be a HTML with at least one closed tag.
	protected _wakaPatch(result: Uint8Array, bitCounter: number): void {
		if (bitCounter === 0) {
			return;
		}
		if (bitCounter > 7) {
			throw new Error('Unexpected bit counter value ' + bitCounter);
		}
		const needByteValue = 0x3e;
		// Ex.:
		//     00000010   0x03 byte we have
		// XOR 00111110   0x3E byte we need
		//   = 00111100
		// AND 00000111   ~(~0 << 3)
		//   = 00000100  Meaningful difference
		const meaningfulDifference = (result[result.byteLength - 1] ^ needByteValue) & ~(~0 << bitCounter);
		if (meaningfulDifference === 0) {
			result[result.byteLength - 1] = needByteValue;
		}
	}

	protected async _loadWasm(): Promise<WasmExports> {
		const wa = await WebAssembly.instantiate(
			await this._loadWasmBinary(),
			{
				// Stub WASI functions
				// The implementation is not supposed to read/write anything from FS
				wasi_snapshot_preview1: {
					proc_exit(...args: unknown[]) { throw new Error('proc_exit() is not implemented') },
					fd_close(...args: unknown[]) { throw new Error('fd_close() is not implemented') },
					fd_write(...args: unknown[]) { throw new Error('fd_write() is not implemented') },
					fd_seek(...args: unknown[]) { throw new Error('fd_seek() is not implemented') },
				},
				env: {
					emscripten_notify_memory_growth(...args: unknown[]) {
						// Yeah, whatever
					}
				}
			}
		);

		// Wasm exports cannot be typed in TypeScript
		return wa.instance.exports as unknown as WasmExports;
	}
}