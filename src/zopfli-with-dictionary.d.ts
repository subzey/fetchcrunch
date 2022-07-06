export interface WasmExports {
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
		/* The memory location of the output start will be stored at this address */
		outPtrPtr: number,
		/* The output length will be stored at this address */
		outSizePtr: number
	): void;
}