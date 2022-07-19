(()=>{"use strict";var e,t,n={680:(e,t,n)=>{var r=n(885);function a(e){const t=[];for(let n=0;n<e.length;n++){const r=e[n];for(let e=0;e<8;e++)t.push(r>>>e&1)}return t}function o(e){const t=new Uint8Array(Math.ceil(e.length/8));for(let n=0;n<e.length;n++)t[n>>>3]|=(1&e[n])<<(7&n);return t}function s(...e){let t=0;for(const n of e)t+=n.length;const n=new Uint8Array(t);t=0;for(const r of e)n.set(r,t),t+=r.length;return n}let i=new TextDecoder;function l(e){return i.decode(e)}let u=new TextEncoder;function c(e){return u.encode(e)}function f(e){const t=e.length,n=new Uint8Array(t);for(let r=0;r<t;r++){const t=e.charCodeAt(r);if(t>255)return null;n[r]=t}return n}function h(e,t,n=3,r=32768){const a=function(e){const t=new Map,n=[];for(const r of e){if("string"==typeof r){n.push(...c(r));continue}let e=t.get(r);void 0===e&&(e=w(r),t.set(r,e)),n.push(e)}for(const e of t.keys()){if(void 0===e.mutuallyExclusiveWith)continue;const n=t.get(e);for(const r of e.mutuallyExclusiveWith){const e=t.get(r);void 0!==e&&(n.mutuallyExclusiveWith??(n.mutuallyExclusiveWith=[]),n.mutuallyExclusiveWith.push(e),e.mutuallyExclusiveWith??(e.mutuallyExclusiveWith=[]),e.mutuallyExclusiveWith.push(n))}}return n}(e);for(;;){let e=null;for(let o=a.length;o-- >0;){const s=a[o];if("number"!=typeof s){if(0===s.size)throw new Error("The template includes a set of zero size");e??(e={replaceWith:Array.from(s)[0],matchedSet:s,size:0});for(const s of d(t,a,o,n,r-a.length+o))s.size>e.size&&(e=s)}}if(null===e)return a;m(a,e.matchedSet,e.replaceWith)}}function*d(e,t,n,r,a){const o=t[n],s=Math.min(e.length-1,a);for(let a=0;a<=s;a++){if(!o.has(e[a]))continue;const i=n-a;let l=1;for(let n=a-1;n>=0&&p(e,n,t,i+n);n--)l++;for(let n=a+1;n<=s&&p(e,n,t,i+n);n++)l++;l<r||(yield{size:l,matchedSet:o,replaceWith:e[a]})}}function p(e,t,n,r){if(t<0||r<0||t>=e.length||r>=n.length)return!1;const a=n[r];return"number"==typeof a?e[t]===a:a.has(e[t])}function m(e,t,n){for(let r=0;r<e.length;r++){let a=e[r];"number"!=typeof a&&(a!==t||(e[r]=n))}if(t.mutuallyExclusiveWith)for(const e of t.mutuallyExclusiveWith)e.delete(n)}function w(e){const t=new Set;for(const n of e){const e=n.charCodeAt(0);if(n.length>1||e>127)throw new Error("The template variant should be a basic ASCII character");t.add(e)}return t}var y=n(829);function g(e,t){let n=-1,r=-1;for(let t=0;t<e.length;t++)-1===n&&("close-waka"!==e[t].kind&&"attr-separator"!==e[t].kind||(n=t)),"close-waka"===e[t].kind&&(r=t);if(-1===n||-1===r)throw new Error("The template should contain at least one closed tag");const a=e.slice(0,n),o=e.slice(n,r),s=e.slice(r);if(a.push({kind:"attr-separator",value:" "}),1!==o.filter((e=>"onload-attr-value"===e.kind)).length)throw new Error('The template should contain one attribute with the value "__bootstrap__"');return{templateHead:k(a),templateMid:k(o,t),templateTail:k(s)}}function v(e){if(b(e,e))return{template:[e],needsSeparator:!0};if(!/['"&]/.test(e)){const t=new Set("\"'");return{template:[t,e,t],needsSeparator:!1}}const t=e.replace(/['"&]/g,(e=>`&#${e.charCodeAt(0)};`)),n=_(`'${t}'`,e),r=_(`"${t}"`,e);if(n.slice(1,n.length-1)===r.slice(1,r.length-1)){const e=new Set("\"'");return{template:[e,n.slice(1,n.length-1),e],needsSeparator:!1}}return{template:[n.length<r.length?n:r],needsSeparator:!1}}function b(e,t){const n=()=>{},r=[];return new y.d2({},{onCharacter:n,onComment:n,onDoctype:n,onEndTag:n,onEof:n,onNullCharacter:n,onWhitespaceCharacter:n,onParseError:n,onStartTag:e=>{r.push(e)}}).write(`<i data-test=${e}>`,!0),1===r.length&&1===r[0].attrs.length&&r[0].attrs[0].value===t}function _(e,t){return e.replace(/&#(\d+);/g,((e,n,r,a)=>{const o=[String.fromCharCode(Number(n))];38===Number(n)&&(o.push("&amp"),o.push("&AMP")),o.push(`&#${n}`);for(const n of o)if(b(a.slice(0,r)+n+a.slice(r+e.length),t))return n;return e}))}function k(e,t){const n=[];let r=!1;for(let a=0;a<e.length;a++){const o=e[a],s=r;if(r=!1,"close-waka"!==o.kind&&"unknown"!==o.kind)if("attr-value"!==o.kind){if("onload-attr-value"===o.kind){const e=new Set("\"'");if(void 0===t)throw new Error("Unexpected onload template insertion point");r=!0,n.push(e,...t,e)}if("tag-name-or-attr-name"!==o.kind)"attr-separator"!==o.kind||s||n.push(new Set(" \n\r\t/"));else for(const e of o.value){const t=new Set([e,e.toUpperCase(),e.toLowerCase()]);n.push(1===t.size?e:t)}}else{const{template:e,needsSeparator:t}=v(o.value);r=!t,n.push(...e)}else n.push(o.value)}return n}function x(e){return S(e,0,"")}function*S(e,t,n){if(t===e.length)return void(yield n);const r=e[t];if("string"!=typeof r)for(const a of r)yield*S(e,t+1,n+a);else yield*S(e,t+1,n+r)}const E=n.p+"zopfli-with-dictionary.wasm";class C extends class{constructor(){this._wasmExports=this._loadWasm()}async deflateRaw(e,{dictionary:t=new Uint8Array(0),numIterations:n=15}){if(0===e.byteLength)return Uint8Array.of(3,0);const{memory:r,allocBuf:a,freeBuf:o,compress:s}=await this._wasmExports,i=this._outPtrPtr??(this._outPtrPtr=a(9)),l=i+4,u=i+8;{const e=new DataView(r.buffer);e.setUint32(i,0,!0),e.setUint32(l,0,!0),e.setUint8(u,0)}const c=e.byteLength+t.byteLength,f=a(c);{const n=new Uint8Array(r.buffer,f,c);n.set(t,0),n.set(e,t.byteLength)}s(n,f,t.byteLength,c,u,i,l);const h=new DataView(r.buffer),d=h.getUint32(i,!0),p=h.getUint32(l,!0),m=new Uint8Array(r.buffer,d,p).slice();return this._wakaPatch(m,h.getUint8(u)),o(d),o(f),m}_wakaPatch(e,t){if(0!==t){if(t>7)throw new Error("Unexpected bit counter value "+t);0==((62^e[e.byteLength-1])&~(-1<<t))&&(e[e.byteLength-1]=62)}}async _loadWasm(){return(await WebAssembly.instantiate(await this._loadWasmBinary(),{wasi_snapshot_preview1:{proc_exit(...e){throw new Error("proc_exit() is not implemented")},fd_close(...e){throw new Error("fd_close() is not implemented")},fd_write(...e){throw new Error("fd_write() is not implemented")},fd_seek(...e){throw new Error("fd_seek() is not implemented")}},env:{emscripten_notify_memory_growth(...e){}}})).instance.exports}}{async _loadWasmBinary(){const e=await fetch(E);if(!e.ok)throw new Error(`Not OK: ${e.status}`);return new Uint8Array(await e.arrayBuffer())}}let L=null;class T extends class{_htmlTemplate(){return'<svg onload="__bootstrap__">'}_onloadAttribute(e,t){const n="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_",r=[new Set("s"+n),new Set("r"+n),new Set("c"+n)];for(const e of r){for(const n of t.reservedIdentifierNames)e.delete(n);for(const t of r)e!==t&&(e.mutuallyExclusiveWith??(e.mutuallyExclusiveWith=[]),e.mutuallyExclusiveWith.push(t))}const[a,o,s]=r;return["(","async ",a,"=>{",...e?["for(",o,"=(await fetch`#`).body.pipeThrough(new DecompressionStream(`deflate-raw`)).getReader();",s,"=(await ",o,".read()).value;",a,"+=String.fromCharCode(...",s,")",");"]:["for(",o,"=(await fetch`#`).body.pipeThrough(new DecompressionStream(`deflate-raw`)).pipeThrough(new TextDecoderStream).getReader();",s,"=(await ",o,".read()).value;",a,"+=",s,");"],"eval(",a,")","}",")`//`"]}_jsNewlines(){return new Set(["\r","\n","\u2028","\u2029"])}_maxCallStackSize(){return 65e3}_generateLeadIn(e){const t=Uint8Array.of(2,0,253,255,170,85);let n=null,r=1/0,i=1/0;for(const l of x(e)){const e=a(c(l));for(const a=[];a.length<=16;a.push(0)){const l=s(o([0,1,0,1,0,0,0,0,...e,...a,1,0,0]),t);if(l.byteLength>i)continue;let u;try{const e=this._binaryFromDeflateRaw(l);if(170!==e[e.byteLength-2]||85!==e[e.byteLength-1])continue;if(u=e.subarray(0,e.byteLength-2),!this._isDecompressedLeadInOkay(u))continue}catch(e){continue}u.byteLength>=r||(n=o([0,1,0,1,0,0,0,0,...e,...a,0,0,0]),i=l.byteLength,r=u.byteLength)}}if(null===n)throw new Error("Could not generate a valid lead-in from this template");return{leadIn:n,leadInDecompressedSize:r}}_isDecompressedLeadInOkay(e){const t=this._jsNewlines(),n=(new TextDecoder).decode(e);for(const e of t)if(n.includes(e))return!1;return!0}async _assemble({leadIn:e,bootstrap:t,tail:n,payload:r,literalIncludesTail:a,literalNewline:o,useCharCodes:i,bestSize:u,leadInDecompressedSize:c}){const f=Uint8Array.of(10),h=l(n);if(!a&&n.length>1)return null;const d=[t];a&&d.push(n),o&&d.push(f);const p=s(...d),m=Uint8Array.of(255&p.byteLength,p.byteLength>>>8,255&~p.byteLength,~p.byteLength>>>8);if(m.includes(62))return null;const w=s(m,p),y=o?r:s(f,r);if(i&&c+p.byteLength+y.byteLength>this._maxCallStackSize())return null;const g=await this._deflateRawFromBinary(y,w);if(w.byteLength+g.byteLength>=u)return null;if(!a&&![39,34,32,13,10,9].includes(w[w.byteLength-1])&&![62,32,13,10,9].includes(g[0]))return null;if(!a){const e=(new TextDecoder).decode(g),t=e.replace(/[^ \t\n\r>]+=("|').*?(\1|$)/g,(e=>"x".repeat(e.length))).indexOf(">");if(-1===t||!e.slice(t).startsWith(h))return null}return s(e,w,g)}async crunch(e){let t,n=null;if("string"==typeof e)t=e;else{if(!(e instanceof Uint8Array))throw new TypeError("crunch() accepts only strings and Uint8Array instances");n=e}const{ir:r,ids:a}=function(e){const t=[],n=new Set;function r(n){if(!n.location)throw new Error("Token should include its location");t.push({kind:"unknown",value:e.slice(n.location.startOffset,n.location.endOffset)})}return new y.d2({sourceCodeLocationInfo:!0},{onCharacter:r,onComment:r,onDoctype:r,onStartTag(e){t.push({kind:"tag-name-or-attr-name",value:"<"+e.tagName});for(const r of e.attrs)"id"===r.name&&r.value&&n.add(r.value),t.push({kind:"attr-separator",value:" "}),"__bootstrap__"===r.value?(t.push({kind:"tag-name-or-attr-name",value:r.name+"="}),t.push({kind:"onload-attr-value",value:r.value})):r.value?(t.push({kind:"tag-name-or-attr-name",value:r.name+"="}),t.push({kind:"attr-value",value:r.value})):t.push({kind:"tag-name-or-attr-name",value:r.name});t.push({kind:"close-waka",value:">"})},onEndTag(e){t.push({kind:"tag-name-or-attr-name",value:"</"+e.tagName}),t.push({kind:"close-waka",value:">"})},onEof(){},onWhitespaceCharacter:r,onNullCharacter:r}).write(e,!0),{ir:t,ids:n}}(this._htmlTemplate());let o=null;for(const e of[!0,!1]){let s=null;if(e){if(t??(t=l(n)),t.length>=this._maxCallStackSize())continue;if(s=f(t),null===s)continue}else n??(n=c(t)),s=n;const i=g(r,this._onloadAttribute(e,{reservedIdentifierNames:a})),{leadIn:u,leadInDecompressedSize:d}=this._generateLeadIn(i.templateHead),p=Uint8Array.from(h(i.templateMid,s)),m=Uint8Array.from(h(i.templateTail,s));for(let t of[!0,!1])for(let n of[!0,!1]){const r=null===o?1/0:o.byteLength;o=await this._assemble({leadIn:u,bootstrap:p,tail:m,payload:s,literalIncludesTail:n,literalNewline:t,useCharCodes:e,leadInDecompressedSize:d,bestSize:r})??o}if(null!==o)return o}throw new Error("Could not generate bootstrap")}}{constructor(e){super(),this._iterations=e.iterations,this._template=e.template}_htmlTemplate(){return this._template||super._htmlTemplate()}_binaryFromDeflateRaw(e){return(0,r.Hq)(e)}_deflateRawFromBinary(e,t){return L??(L=new C),L.deflateRaw(e,{dictionary:t,numIterations:this._iterations})}}self.addEventListener("message",(async e=>{try{const t=new T(e.data),n=await t.crunch(e.data.source);self.postMessage({result:n},[n.buffer])}catch(e){self.postMessage({errorMessage:e?.message})}}))}},r={};function a(e){var t=r[e];if(void 0!==t)return t.exports;var o=r[e]={exports:{}};return n[e](o,o.exports,a),o.exports}a.m=n,a.x=()=>{var e=a.O(void 0,[516],(()=>a(680)));return a.O(e)},e=[],a.O=(t,n,r,o)=>{if(!n){var s=1/0;for(c=0;c<e.length;c++){for(var[n,r,o]=e[c],i=!0,l=0;l<n.length;l++)(!1&o||s>=o)&&Object.keys(a.O).every((e=>a.O[e](n[l])))?n.splice(l--,1):(i=!1,o<s&&(s=o));if(i){e.splice(c--,1);var u=r();void 0!==u&&(t=u)}}return t}o=o||0;for(var c=e.length;c>0&&e[c-1][2]>o;c--)e[c]=e[c-1];e[c]=[n,r,o]},a.d=(e,t)=>{for(var n in t)a.o(t,n)&&!a.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},a.f={},a.e=e=>Promise.all(Object.keys(a.f).reduce(((t,n)=>(a.f[n](e,t),t)),[])),a.u=e=>e+".js",a.miniCssF=e=>{},a.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),a.p="./",(()=>{var e={231:1};a.f.i=(t,n)=>{e[t]||importScripts(a.p+a.u(t))};var t=self.webpackChunk=self.webpackChunk||[],n=t.push.bind(t);t.push=t=>{var[r,o,s]=t;for(var i in o)a.o(o,i)&&(a.m[i]=o[i]);for(s&&s(a);r.length;)e[r.pop()]=1;n(t)}})(),t=a.x,a.x=()=>a.e(516).then(t),a.x()})();