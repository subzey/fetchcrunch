declare module 'zopfli.js/bin/zopfli.raw.min.js' {
	namespace Zopfli {
		class RawDeflate {
			constructor(source: Uint8Array, options?: { iterations?: number });
			compress(): Uint8Array;
		}
	}
}