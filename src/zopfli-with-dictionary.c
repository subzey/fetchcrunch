#include "emscripten.h"
#include "../zopfli/src/zopfli/zopfli.h"
#include "../zopfli/src/zopfli/deflate.h"

EMSCRIPTEN_KEEPALIVE
void* allocBuf(int len) {
	return malloc(len * sizeof(unsigned char));
}

EMSCRIPTEN_KEEPALIVE
void freeBuf(void* ptr) {
	free(ptr);
}

EMSCRIPTEN_KEEPALIVE
void compress(
	int numiterations,
	const unsigned char* in, size_t instart, size_t insize,
	unsigned char* bp,
	unsigned char** out, size_t* outsize
) {
	ZopfliOptions options;
	ZopfliInitOptions(&options);
	options.numiterations = numiterations;

	ZopfliDeflatePart(
		&options,
		2, // btype: try all
		1, // final
		in, instart, insize,
		bp,
		out, outsize
	);
}
