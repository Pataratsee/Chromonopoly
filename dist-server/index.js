import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { websocketMask, websocketUnmask } = __require("http");
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask) {
      module.exports.mask = function(source, mask, output, offset, length) {
        if (length < 24) _mask(source, mask, output, offset, length);
        else websocketMask(source, mask, output, offset, length);
      };
      module.exports.unmask = function(buffer, mask) {
        if (buffer.length < 24) _unmask(buffer, mask);
        else websocketUnmask(buffer, mask);
      };
    } else if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) {
          return dataLength ? [target, data] : [target];
        }
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (!dataLength) return [target];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http = __require("http");
    var net = __require("net");
    var tls = __require("tls");
    var { randomBytes, createHash } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const i = opts.path.indexOf(":");
        if (i === -1) {
          opts.socketPath = opts.path;
          opts.path = "";
        } else {
          opts.socketPath = opts.path.slice(0, i);
          opts.path = opts.path.slice(i + 1);
        }
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http = __require("http");
    var { Duplex } = __require("stream");
    var { createHash } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server2 = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server2.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server2, map) {
      for (const event of Object.keys(map)) server2.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server2.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server2) {
      server2._state = CLOSED;
      server2.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server2, req, socket, code, message, headers) {
      if (server2.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server2.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// server/index.ts
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path2 from "node:path";

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// server/world.ts
import { randomInt } from "node:crypto";

// src/game/board.json
var board_default = {
  version: 3,
  currency: "USD",
  goSalary: 200,
  spaces: [
    { index: 0, name: "GO", type: "go", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "corner", label: "Collect $200" },
    { index: 1, name: "Mediterranean Ave", type: "property", group: "brown", price: 60, rents: [2, 10, 30, 90, 160, 250], buildCost: 50, mortgage: 30, icon: "dot" },
    { index: 2, name: "Community Chest", type: "chest", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "chest" },
    { index: 3, name: "Baltic Ave", type: "property", group: "brown", price: 60, rents: [4, 20, 60, 180, 320, 450], buildCost: 50, mortgage: 30, icon: "dot" },
    { index: 4, name: "Income Tax", type: "tax", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, tax: 200, icon: "tax" },
    { index: 5, name: "Reading Railroad", type: "railroad", group: "railroad", price: 200, rents: [25, 50, 100, 200], buildCost: 0, mortgage: 100, icon: "rail" },
    { index: 6, name: "Oriental Ave", type: "property", group: "lightblue", price: 100, rents: [6, 30, 90, 270, 400, 550], buildCost: 50, mortgage: 50, icon: "diamond" },
    { index: 7, name: "Chance", type: "chance", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "chance" },
    { index: 8, name: "Vermont Ave", type: "property", group: "lightblue", price: 100, rents: [6, 30, 90, 270, 400, 550], buildCost: 50, mortgage: 50, icon: "diamond" },
    { index: 9, name: "Connecticut Ave", type: "property", group: "lightblue", price: 120, rents: [8, 40, 100, 300, 450, 600], buildCost: 50, mortgage: 60, icon: "diamond" },
    { index: 10, name: "Jail / Just Visiting", type: "jail", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "jail", label: "Just Visiting" },
    { index: 11, name: "St. Charles Place", type: "property", group: "pink", price: 140, rents: [10, 50, 150, 450, 625, 750], buildCost: 100, mortgage: 70, icon: "triangle" },
    { index: 12, name: "Electric Company", type: "utility", group: "utility", price: 150, rents: [4, 10], buildCost: 0, mortgage: 75, icon: "bolt" },
    { index: 13, name: "States Ave", type: "property", group: "pink", price: 140, rents: [10, 50, 150, 450, 625, 750], buildCost: 100, mortgage: 70, icon: "triangle" },
    { index: 14, name: "Virginia Ave", type: "property", group: "pink", price: 160, rents: [12, 60, 180, 500, 700, 900], buildCost: 100, mortgage: 80, icon: "triangle" },
    { index: 15, name: "Pennsylvania RR", type: "railroad", group: "railroad", price: 200, rents: [25, 50, 100, 200], buildCost: 0, mortgage: 100, icon: "rail" },
    { index: 16, name: "St. James Place", type: "property", group: "orange", price: 180, rents: [14, 70, 200, 550, 750, 950], buildCost: 100, mortgage: 90, icon: "hex" },
    { index: 17, name: "Community Chest", type: "chest", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "chest" },
    { index: 18, name: "Tennessee Ave", type: "property", group: "orange", price: 180, rents: [14, 70, 200, 550, 750, 950], buildCost: 100, mortgage: 90, icon: "hex" },
    { index: 19, name: "New York Ave", type: "property", group: "orange", price: 200, rents: [16, 80, 220, 600, 800, 1e3], buildCost: 100, mortgage: 100, icon: "hex" },
    { index: 20, name: "Free Parking", type: "free", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "free", label: "Rest here" },
    { index: 21, name: "Kentucky Ave", type: "property", group: "red", price: 220, rents: [18, 90, 250, 700, 875, 1050], buildCost: 150, mortgage: 110, icon: "square" },
    { index: 22, name: "Chance", type: "chance", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "chance" },
    { index: 23, name: "Indiana Ave", type: "property", group: "red", price: 220, rents: [18, 90, 250, 700, 875, 1050], buildCost: 150, mortgage: 110, icon: "square" },
    { index: 24, name: "Illinois Ave", type: "property", group: "red", price: 240, rents: [20, 100, 300, 750, 925, 1100], buildCost: 150, mortgage: 120, icon: "square" },
    { index: 25, name: "B. & O. Railroad", type: "railroad", group: "railroad", price: 200, rents: [25, 50, 100, 200], buildCost: 0, mortgage: 100, icon: "rail" },
    { index: 26, name: "Atlantic Ave", type: "property", group: "yellow", price: 260, rents: [22, 110, 330, 800, 975, 1150], buildCost: 150, mortgage: 130, icon: "star" },
    { index: 27, name: "Ventnor Ave", type: "property", group: "yellow", price: 260, rents: [22, 110, 330, 800, 975, 1150], buildCost: 150, mortgage: 130, icon: "star" },
    { index: 28, name: "Water Works", type: "utility", group: "utility", price: 150, rents: [4, 10], buildCost: 0, mortgage: 75, icon: "water" },
    { index: 29, name: "Marvin Gardens", type: "property", group: "yellow", price: 280, rents: [24, 120, 360, 850, 1025, 1200], buildCost: 150, mortgage: 140, icon: "star" },
    { index: 30, name: "Go To Jail", type: "gotojail", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "gojail", label: "Go directly to jail" },
    { index: 31, name: "Pacific Ave", type: "property", group: "green", price: 300, rents: [26, 130, 390, 900, 1100, 1275], buildCost: 200, mortgage: 150, icon: "pentagon" },
    { index: 32, name: "North Carolina Ave", type: "property", group: "green", price: 300, rents: [26, 130, 390, 900, 1100, 1275], buildCost: 200, mortgage: 150, icon: "pentagon" },
    { index: 33, name: "Community Chest", type: "chest", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "chest" },
    { index: 34, name: "Pennsylvania Ave", type: "property", group: "green", price: 320, rents: [28, 150, 450, 1e3, 1200, 1400], buildCost: 200, mortgage: 160, icon: "pentagon" },
    { index: 35, name: "Short Line RR", type: "railroad", group: "railroad", price: 200, rents: [25, 50, 100, 200], buildCost: 0, mortgage: 100, icon: "rail" },
    { index: 36, name: "Chance", type: "chance", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, icon: "chance" },
    { index: 37, name: "Park Place", type: "property", group: "darkblue", price: 350, rents: [35, 175, 500, 1100, 1300, 1500], buildCost: 200, mortgage: 175, icon: "cross" },
    { index: 38, name: "Luxury Tax", type: "tax", group: null, price: 0, rents: [], buildCost: 0, mortgage: 0, tax: 100, icon: "tax" },
    { index: 39, name: "Boardwalk", type: "property", group: "darkblue", price: 400, rents: [50, 200, 600, 1400, 1700, 2e3], buildCost: 200, mortgage: 200, icon: "cross" }
  ]
};

// src/game/board.ts
var BOARD_DATA = board_default;
var SPACES = BOARD_DATA.spaces;
var GO_SALARY = BOARD_DATA.goSalary;
function spaceAt(index) {
  const s = SPACES[index];
  if (!s) throw new Error(`No space at ${index}`);
  return s;
}
function advanceTile(from, steps) {
  return ((from + steps) % SPACES.length + SPACES.length) % SPACES.length;
}
function groupMembers(group) {
  return SPACES.filter((s) => s.group === group && s.type === "property");
}

// src/game/rules.ts
var RULES = {
  goSalary: 200,
  mortgageRate: 0.5,
  unmortgagePremium: 0.1,
  sellRefund: 0.5,
  loanInterest: 0.02,
  loanMaxMultiple: 3,
  stockStartMultiple: 2,
  stockDrift: 0.02,
  stockNoise: 0.015,
  stockFloor: 0.2,
  stockCeiling: 8,
  externalMax: 0.5,
  bankTheftBase: 0.45,
  bankTheftRepStep: 0.05,
  bankTheftMin: 150,
  bankTheftMax: 600,
  playerTheftBase: 0.55,
  playerTheftCap: 800,
  jailAllChance: 0.25,
  jailSomeChance: 0.4,
  murderChance: 0.01,
  murderCaughtChance: 0.7,
  murderFine: 1e3,
  murderAttemptRep: 15,
  murderSuccessRep: 45,
  murderCaughtRep: 25,
  hospitalTurns: 3,
  murderCooldownMs: 3e4,
  theftRepLoss: 25,
  theftAttemptRep: 15,
  evadeBase: 0.6,
  evadePerBuilding: 0.15,
  evadePenalty: 0.2,
  evadeSuccessRep: 5,
  evadeCaughtRep: 10,
  payRentRep: 1,
  detectiveFee: 1e4,
  detectiveChance: 0.6,
  evidencePerFinding: 2,
  evidenceCap: 10,
  suitBaseChance: 0.35,
  suitPerStrength: 0.05,
  suitChanceCap: 0.85,
  suitFees: 200,
  suitLoss: 150,
  suitLossRep: 10,
  suitWinRep: 5,
  settleMultiple: 1.5,
  maxBuildings: 60,
  jailTurns: 3,
  jailRepOnEntry: 0
};
var BUILDING_TYPES = [
  "house",
  "apartments",
  "shop",
  "restaurant",
  "office",
  "hotel",
  "landmark"
];
var BUILDING_META = {
  house: { name: "House", costMultiple: 1, rentLabel: "1\u20132 house rent", blurb: "Small pitched-roof home" },
  apartments: { name: "Apartments", costMultiple: 2, rentLabel: "3x base rent", blurb: "Three-storey block" },
  shop: { name: "Corner Shop", costMultiple: 1.5, rentLabel: "2x base rent, +10% synergy", blurb: "Awning shopfront" },
  restaurant: { name: "Restaurant", costMultiple: 2, rentLabel: "2.5x base rent, +15% synergy", blurb: "Cafe with seating" },
  office: { name: "Office", costMultiple: 2.5, rentLabel: "3.5x base rent", blurb: "Glass mid-rise" },
  hotel: { name: "Hotel", costMultiple: 5, rentLabel: "Hotel rent", blurb: "Large landmark building" },
  landmark: { name: "Landmark", costMultiple: 8, rentLabel: "1.25x hotel rent", blurb: "Unique tall silhouette" }
};
function buildingCost(space, type) {
  if (space.buildCost <= 0) throw new Error(`${space.name} cannot be built on`);
  return Math.round(space.buildCost * BUILDING_META[type].costMultiple);
}
function emptyTile() {
  return { ownerId: null, mortgaged: false, building: null, shares: {}, lockedBy: null };
}
function ownsGroup(group, ownerId, tiles) {
  if (!group) return false;
  const members = groupMembers(group);
  return members.length > 0 && members.every((s) => tiles[s.index]?.ownerId === ownerId);
}
function hasTypeSynergy(tile, type, tiles) {
  const space = spaceAt(tile);
  const ownerId = tiles[tile]?.ownerId;
  if (!space.group || !ownerId) return false;
  const members = groupMembers(space.group);
  return members.every((s) => tiles[s.index]?.ownerId === ownerId && tiles[s.index]?.building === type);
}
function baseRent(space, ownerId, tiles) {
  if (!space.rents.length) return 0;
  const base = space.rents[0] ?? 0;
  if (ownerId && ownsGroup(space.group, ownerId, tiles) && !tiles[space.index]?.building) {
    return base * 2;
  }
  return base;
}
function buildingRent(space, type, tiles) {
  const base = space.rents[0] ?? 0;
  const hotel = space.rents[5] ?? 0;
  switch (type) {
    case "house":
      return space.rents[1] ?? base;
    case "apartments":
      return base * 3;
    case "shop":
      return Math.round(base * 2 * (hasTypeSynergy(space.index, type, tiles) ? 1.1 : 1));
    case "restaurant":
      return Math.round(base * 2.5 * (hasTypeSynergy(space.index, type, tiles) ? 1.15 : 1));
    case "office":
      return Math.round(base * 3.5);
    case "hotel":
      return hotel;
    case "landmark":
      return Math.round(hotel * 1.25);
  }
}
function rentFor(tile, tiles, dice, ownerId = tiles[tile]?.ownerId ?? null) {
  const space = spaceAt(tile);
  const state = tiles[tile];
  if (!state || !ownerId || state.mortgaged) return 0;
  if (space.type === "railroad") {
    const count = SPACES.filter((s) => s.type === "railroad" && tiles[s.index]?.ownerId === ownerId).length;
    return space.rents[Math.max(0, Math.min(3, count - 1))] ?? 0;
  }
  if (space.type === "utility") {
    const count = SPACES.filter((s) => s.type === "utility" && tiles[s.index]?.ownerId === ownerId).length;
    const multiple = count >= 2 ? 10 : 4;
    return (dice ?? 0) * multiple;
  }
  if (space.type !== "property") return 0;
  if (state.building) return buildingRent(space, state.building, tiles);
  return baseRent(space, ownerId, tiles);
}
function groupBuildingCount(tiles) {
  return Object.values(tiles).filter((t) => t.building).length;
}
function canBuild(tile, tiles, ownerId, totalBuildings) {
  const space = spaceAt(tile);
  const state = tiles[tile];
  if (!state || state.ownerId !== ownerId) return { ok: false, reason: "You do not own this property." };
  if (space.type !== "property") return { ok: false, reason: "Only streets can be built on." };
  if (state.mortgaged) return { ok: false, reason: "Unmortgage this property first." };
  if (!ownsGroup(space.group, ownerId, tiles)) return { ok: false, reason: "You need the full colour group." };
  const mortgagedInGroup = groupMembers(space.group).some((s) => tiles[s.index]?.mortgaged);
  if (mortgagedInGroup) return { ok: false, reason: "A property in this group is mortgaged." };
  if (state.lockedBy) return { ok: false, reason: "This property is locked by a pending deal." };
  if (totalBuildings >= RULES.maxBuildings) {
    return { ok: false, reason: `The city is full \u2014 all ${RULES.maxBuildings} building plots are taken.` };
  }
  return { ok: true };
}
function mortgageValue(space) {
  return Math.round(space.price * RULES.mortgageRate);
}
function unmortgageCost(space) {
  return Math.round(mortgageValue(space) * (1 + RULES.unmortgagePremium));
}
function netWorth(player, tiles, prices) {
  let total = player.cash;
  for (const [idx, t] of Object.entries(tiles)) {
    if (t.ownerId !== player.id) continue;
    const space = spaceAt(Number(idx));
    total += t.mortgaged ? mortgageValue(space) : space.price;
    if (t.building) total += Math.round(buildingCost(space, t.building) * RULES.sellRefund);
  }
  for (const [idx, shares] of Object.entries(player.holdings ?? {})) {
    total += shares / 1e3 * (prices[Number(idx)] ?? 0);
  }
  return Math.max(0, Math.round(total));
}
function loanCap(net) {
  return Math.floor(net * RULES.loanMaxMultiple / 50) * 50;
}
function loanInterest(principal) {
  return Math.ceil(principal * RULES.loanInterest);
}
function fundamental(tile, tiles) {
  const space = spaceAt(tile);
  if (space.price === 0) return 0;
  const state = tiles[tile];
  const yieldFactor = (space.rents[0] ?? 0) / space.price;
  const level = state?.building ? BUILDING_TYPES.indexOf(state.building) + 1 : 0;
  const group = state?.ownerId && ownsGroup(space.group, state.ownerId, tiles) ? 1 : 0;
  return space.price * (1.1 + yieldFactor * 9 + level * 0.22 + group * 0.18);
}
function clampPrice(price, fund) {
  return Math.min(fund * RULES.stockCeiling, Math.max(fund * RULES.stockFloor, price));
}
function dividendSplit(rent, shares) {
  const totalExternal = Math.min(RULES.externalMax, Object.values(shares).reduce((a, b) => a + b, 0));
  const holders = {};
  if (totalExternal <= 0) return { owner: rent, holders };
  const scale = totalExternal / Object.values(shares).reduce((a, b) => a + b, 0);
  let paid = 0;
  for (const [id, share] of Object.entries(shares)) {
    const amount = Math.floor(rent * share * scale);
    holders[id] = amount;
    paid += amount;
  }
  return { owner: rent - paid, holders };
}
function evadeChance(buildingsOnTile) {
  return Math.max(0.05, RULES.evadeBase - RULES.evadePerBuilding * buildingsOnTile);
}
function bankTheftChance(reputation) {
  const below = Math.max(0, (50 - reputation) / 10);
  return Math.min(0.95, RULES.bankTheftBase + RULES.bankTheftRepStep * below);
}
function playerTheftChance() {
  return RULES.playerTheftBase;
}
function theftAmount(rng) {
  return Math.round((RULES.bankTheftMin + rng() * (RULES.bankTheftMax - RULES.bankTheftMin)) / 10) * 10;
}
function evidenceStrength(unpaidRent, findings) {
  return Math.min(RULES.evidenceCap, Math.floor(unpaidRent / 100) + findings * RULES.evidencePerFinding);
}
function maxClaim(strength) {
  return Math.max(100, strength * 500);
}
function suitChance(strength) {
  return Math.min(RULES.suitChanceCap, RULES.suitBaseChance + RULES.suitPerStrength * strength);
}
function applyReputation(reputation, delta) {
  return Math.max(0, Math.min(100, reputation + delta));
}
var CARDS = [
  { id: "ch1", deck: "chance", text: "Advance to GO. Collect $200.", effect: { kind: "move", to: 0, collectGo: true } },
  { id: "ch2", deck: "chance", text: "Bank pays you a dividend of $50.", effect: { kind: "cash", amount: 50 } },
  { id: "ch3", deck: "chance", text: "Go directly to Jail. Do not pass GO.", effect: { kind: "jail" } },
  { id: "ch4", deck: "chance", text: "Your building loan matures. Collect $150.", effect: { kind: "cash", amount: 150 } },
  { id: "ch5", deck: "chance", text: "Advance to Boardwalk.", effect: { kind: "move", to: 39, collectGo: false } },
  { id: "ch6", deck: "chance", text: "Take a trip to Reading Railroad.", effect: { kind: "move", to: 5, collectGo: false } },
  { id: "ch7", deck: "chance", text: "The bank pays you $25 for services rendered.", effect: { kind: "cash", amount: 25 } },
  { id: "ch8", deck: "chance", text: "Speeding fine. Pay $15.", effect: { kind: "cash", amount: -15 } },
  { id: "ch9", deck: "chance", text: "You have won a crossword competition. Collect $100.", effect: { kind: "cash", amount: 100 } },
  { id: "ch10", deck: "chance", text: "Advance to the nearest railroad and pay double rent.", effect: { kind: "advanceNearestRail", doubleRent: true } },
  { id: "ch11", deck: "chance", text: "Make general repairs: $25 per building.", effect: { kind: "repair", perBuilding: 25 } },
  { id: "ch12", deck: "chance", text: "Get out of Jail free. Keep this card.", effect: { kind: "jailFree" } },
  { id: "cc1", deck: "chest", text: "Advance to GO. Collect $200.", effect: { kind: "move", to: 0, collectGo: true } },
  { id: "cc2", deck: "chest", text: "Bank error in your favour. Collect $200.", effect: { kind: "cash", amount: 200 } },
  { id: "cc3", deck: "chest", text: "Doctor's fee. Pay $50.", effect: { kind: "cash", amount: -50 } },
  { id: "cc4", deck: "chest", text: "From sale of stock you get $50.", effect: { kind: "cash", amount: 50 } },
  { id: "cc5", deck: "chest", text: "Go directly to Jail. Do not pass GO.", effect: { kind: "jail" } },
  { id: "cc6", deck: "chest", text: "Holiday fund matures. Receive $100.", effect: { kind: "cash", amount: 100 } },
  { id: "cc7", deck: "chest", text: "Income tax refund. Collect $20.", effect: { kind: "cash", amount: 20 } },
  { id: "cc8", deck: "chest", text: "Life insurance matures. Collect $100.", effect: { kind: "cash", amount: 100 } },
  { id: "cc9", deck: "chest", text: "Pay hospital fees of $100.", effect: { kind: "cash", amount: -100 } },
  { id: "cc10", deck: "chest", text: "Receive $25 consultancy fee.", effect: { kind: "cash", amount: 25 } },
  { id: "cc11", deck: "chest", text: "You inherit $100.", effect: { kind: "cash", amount: 100 } },
  { id: "cc12", deck: "chest", text: "Get out of Jail free. Keep this card.", effect: { kind: "jailFree" } }
];

// server/world.ts
var TOKEN_COLORS = ["#E23B3B", "#2F6FD0", "#37B36B", "#F79A3E", "#8A5A3B", "#E85C9E", "#6C7A89", "#F7D64A"];
var BOT_NAMES = ["Ada Tycoon", "Mr. Ledger", "Penny Sharp", "Count Deed", "Vera Vault"];
var idCounter = 0;
function uid(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}
var World = class {
  players = /* @__PURE__ */ new Map();
  tiles = {};
  prices = {};
  log = [];
  suits = /* @__PURE__ */ new Map();
  trades = /* @__PURE__ */ new Map();
  seq = 0;
  logSeq = 0;
  suitSeq = 0;
  buildingCount = 0;
  gameOver = null;
  dirty = false;
  mode;
  activePlayerId = null;
  turnNumber = 0;
  volumes = {};
  lastBotAt = 0;
  turnStartedAt = 0;
  baseRng;
  rng;
  testRoll = null;
  now;
  onEvent;
  tickTimer = 0;
  botTradeAt = /* @__PURE__ */ new Map();
  constructor(opts = {}) {
    this.mode = opts.mode ?? "multi";
    this.baseRng = opts.rng ?? (() => randomInt(0, 1e9) / 1e9);
    this.rng = this.baseRng;
    this.now = opts.now ?? (() => Date.now());
    this.onEvent = opts.onEvent ?? (() => void 0);
    for (const s of SPACES) {
      this.tiles[s.index] = emptyTile();
      this.prices[s.index] = s.price ? s.price * RULES.stockStartMultiple : 0;
    }
  }
  // ---------------------------------------------------------------- players
  join(name, tokenId, session) {
    if (session) {
      for (const p of this.players.values()) {
        if (p.session === session) {
          p.lastSeen = this.now();
          if (tokenId && p.tokenId !== tokenId) p.tokenId = tokenId;
          return { player: p, session };
        }
      }
    }
    const id = uid("p");
    const player = {
      id,
      name: name.slice(0, 24) || "Tycoon",
      tokenId: tokenId || "cat",
      color: TOKEN_COLORS[this.players.size % TOKEN_COLORS.length],
      cash: 1500,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailReleaseCost: 0,
      jailCause: null,
      jailOutcome: null,
      jailSold: [],
      inHospital: false,
      hospitalTurns: 0,
      bankrupt: false,
      jailRecord: [],
      lastSeen: this.now(),
      isBot: false,
      reputation: 50,
      dossier: {},
      acts: [],
      loan: 0,
      holdings: {},
      costBasis: {},
      realizedPnl: 0,
      unpaidRent: 0,
      consecutiveDoubles: 0,
      pending: null,
      jailFree: 0,
      lastRollAt: 0,
      lastTheftAt: 0,
      murderReadyAt: 0,
      extraRoll: false,
      intents: /* @__PURE__ */ new Map(),
      findings: {},
      prefs: {},
      session: uid("s")
    };
    this.players.set(id, player);
    if (this.mode === "solo" && !this.activePlayerId) {
      this.activePlayerId = player.id;
      this.turnNumber = 1;
      this.turnStartedAt = this.now();
    }
    this.logLine(`${player.name} joins the board.`, "info");
    this.dirty = true;
    return { player, session: player.session };
  }
  addBot(tokenIds, difficulty = 0.7) {
    if (this.mode !== "solo") throw new Error("Bots cannot join a multiplayer board.");
    const name = BOT_NAMES[this.players.size % BOT_NAMES.length];
    const { player } = this.join(name, tokenIds[this.players.size % tokenIds.length] ?? "cat");
    player.isBot = true;
    player.reputation = 40 + Math.floor(this.rng() * 30);
    player.lastRollAt = this.now() + 800 + this.rng() * difficulty * 1600;
    return player;
  }
  // ------------------------------------------------------------------ state
  publicState() {
    const players = {};
    for (const p of this.players.values()) {
      players[p.id] = {
        id: p.id,
        name: p.name,
        tokenId: p.tokenId,
        color: p.color,
        cash: p.cash,
        position: p.position,
        inJail: p.inJail,
        jailTurns: p.jailTurns,
        jailReleaseCost: this.jailReleaseCost(p),
        jailCause: p.jailCause,
        jailOutcome: p.jailOutcome,
        jailSold: p.jailSold,
        inHospital: p.inHospital,
        hospitalTurns: p.hospitalTurns,
        bankrupt: p.bankrupt,
        jailRecord: p.jailRecord,
        lastSeen: p.lastSeen,
        isBot: p.isBot
      };
    }
    return {
      seq: this.seq,
      serverTime: this.now(),
      mode: this.mode,
      activePlayerId: this.activePlayerId,
      turnNumber: this.turnNumber,
      players,
      tiles: this.tiles,
      prices: this.prices,
      log: this.log.slice(-60),
      buildingCount: this.buildingCount,
      gameOver: this.gameOver
    };
  }
  privateState(playerId) {
    const p = this.players.get(playerId);
    if (!p) throw new Error("unknown player");
    const pub = this.publicState().players[playerId];
    const privatePlayer = {
      ...pub,
      reputation: p.reputation,
      dossier: p.dossier,
      acts: p.acts,
      loan: p.loan,
      holdings: p.holdings,
      costBasis: p.costBasis,
      realizedPnl: p.realizedPnl ?? 0,
      unpaidRent: p.unpaidRent
    };
    const suits = [...this.suits.values()].filter(
      (s) => s.plaintiffId === playerId || s.defendantId === playerId
    );
    const offers = suits.filter((s) => s.defendantId === playerId && s.status === "pending").map((s) => ({
      id: s.id,
      kind: "settle",
      fromId: s.plaintiffId,
      toId: s.defendantId,
      suitId: s.id,
      claim: s.claim
    }));
    const trades = [...this.trades.values()].filter((t) => t.fromId === playerId || t.toId === playerId).slice(-24);
    const net = netWorth(privatePlayer, this.tiles, this.prices);
    return {
      you: privatePlayer,
      offers,
      suits,
      trades,
      pending: p.pending,
      netWorth: net,
      loanCap: loanCap(net)
    };
  }
  // ----------------------------------------------------------------- intents
  intent(playerId, intent) {
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: "Unknown player." };
    if (p.bankrupt) return { ok: false, reason: "You are bankrupt." };
    p.lastSeen = this.now();
    if (this.mode === "solo" && this.activePlayerId && this.activePlayerId !== p.id) {
      return { ok: false, reason: "Wait for your turn." };
    }
    if ("key" in intent && intent.key) {
      const prior = p.intents.get(intent.key);
      if (prior) return prior;
    }
    const result = this.apply(p, intent);
    if ("key" in intent && intent.key) {
      p.intents.set(intent.key, result);
      if (p.intents.size > 200) {
        const first = p.intents.keys().next().value;
        if (first) p.intents.delete(first);
      }
    }
    if (result.ok) this.dirty = true;
    return result;
  }
  apply(p, intent) {
    switch (intent.t) {
      case "hello":
        return { ok: true };
      case "roll":
        return this.roll(p);
      case "buy":
        return this.buy(p, intent.tile);
      case "decline":
        if (p.pending?.kind !== "buy") return { ok: false, reason: "Nothing to decline." };
        p.pending = null;
        this.finishTurn(p);
        return { ok: true };
      case "payRent":
        return this.payPendingRent(p);
      case "evade":
        return this.evade(p);
      case "build":
        return this.build(p, intent.tile, intent.type);
      case "sellBuilding":
        return this.sellBuilding(p, intent.tile);
      case "mortgage":
        return this.mortgage(p, intent.tile);
      case "unmortgage":
        return this.unmortgage(p, intent.tile);
      case "loan":
        return this.takeLoan(p, intent.amount);
      case "repayLoan":
        return this.repayLoan(p, intent.amount);
      case "stock":
        return this.tradeStock(p, intent.tile, intent.qty);
      case "theft":
        return this.theft(p, intent.target);
      case "murder":
        return this.murder(p, intent.target);
      case "hireDetective":
        return this.hireDetective(p, intent.target);
      case "sue":
        return this.sue(p, intent.target, intent.claim);
      case "settle":
        return this.settle(p, intent.suitId);
      case "court":
        return this.court(p, intent.suitId);
      case "jailPay":
        return this.payJail(p);
      case "selectToken":
        p.tokenId = intent.tokenId.slice(0, 24);
        return { ok: true };
      case "tradeOffer":
        return this.offerTrade(p, intent.targetId, intent.giveCash, intent.giveTiles, intent.wantCash, intent.wantTiles);
      case "tradeAccept":
        return this.acceptTrade(p, intent.tradeId);
      case "tradeDecline":
        return this.declineTrade(p, intent.tradeId);
      case "tradeCounter":
        return this.counterTrade(p, intent.tradeId, intent.giveCash, intent.giveTiles, intent.wantCash, intent.wantTiles);
      default:
        return { ok: false, reason: "Unknown action." };
    }
  }
  // ------------------------------------------------------------------- roll
  roll(p) {
    if (this.gameOver) return { ok: false, reason: "This game is over." };
    if (this.mode === "solo" && this.activePlayerId !== p.id) return { ok: false, reason: "Wait for your turn." };
    const now = this.now();
    if (now - p.lastRollAt < 700) return { ok: false, reason: "Easy \u2014 the dice are still rolling." };
    p.lastRollAt = now;
    if (p.pending) return { ok: false, reason: "Resolve the open offer first." };
    if (p.inHospital) {
      p.hospitalTurns = Math.max(0, p.hospitalTurns - 1);
      if (p.hospitalTurns === 0) p.inHospital = false;
      this.logLine(`${p.name} ${p.inHospital ? `recovers (${p.hospitalTurns} turns left)` : "leaves the hospital"}.`, "crime");
      this.emit({ kind: "hospital", playerId: p.id, text: p.inHospital ? `${p.hospitalTurns} turns left` : "discharged" });
      this.seq += 1;
      this.endTurn(p);
      return { ok: true };
    }
    if (p.loan > 0) {
      const interest = loanInterest(p.loan);
      if (p.cash < interest) {
        if (!this.raiseCash(p, interest)) {
          this.bankrupt(p, null);
          return { ok: true };
        }
      }
      p.cash -= interest;
      this.logLine(`${p.name} pays ${interest} loan interest.`, "money");
      this.emit({ kind: "cash", playerId: p.id, amount: -interest });
    }
    if (p.inJail) {
      p.jailTurns -= 1;
      if (p.jailTurns <= 0) {
        p.inJail = false;
        p.jailTurns = 0;
        this.logLine(`${p.name} has served their term and is released.`, "crime");
        this.emit({ kind: "jail", playerId: p.id, text: "released" });
      } else {
        this.emit({ kind: "jail", playerId: p.id, text: `${p.jailTurns} turns left` });
        this.logLine(`${p.name} waits in jail (${p.jailTurns} left).`, "crime");
      }
      this.endTurn(p);
      return { ok: true };
    }
    const d1 = 1 + Math.floor(this.rng() * 6);
    const d2 = 1 + Math.floor(this.rng() * 6);
    const dice = [d1, d2];
    this.emit({ kind: "roll", playerId: p.id, dice });
    this.logLine(`${p.name} rolls ${d1} + ${d2}.`, "info");
    if (d1 === d2) {
      p.consecutiveDoubles += 1;
      if (p.consecutiveDoubles >= 3) {
        p.consecutiveDoubles = 0;
        this.sendToJail(p, "three doubles in a row");
        this.finishTurn(p);
        this.seq += 1;
        return { ok: true };
      }
    } else p.consecutiveDoubles = 0;
    const from = p.position;
    const next = advanceTile(from, d1 + d2);
    if (next < from) {
      p.cash += RULES.goSalary;
      this.logLine(`${p.name} passes GO and collects ${RULES.goSalary}.`, "money");
      this.emit({ kind: "cash", playerId: p.id, amount: RULES.goSalary });
    }
    p.position = next;
    this.emit({ kind: "move", playerId: p.id, tile: next });
    this.resolveLanding(p, next, d1 + d2);
    p.extraRoll = d1 === d2;
    if (this.mode === "solo" && !p.pending) this.finishTurn(p);
    this.seq += 1;
    return { ok: true };
  }
  /** Advances a solo table after the active player's roll and any offer. */
  finishTurn(p) {
    if (this.mode !== "solo" || this.activePlayerId !== p.id || p.pending) return;
    if (p.extraRoll) {
      p.extraRoll = false;
      this.emit({ kind: "turn", playerId: p.id, text: "doubles \u2014 roll again" });
      this.seq += 1;
      return;
    }
    this.endTurn(p);
  }
  endTurn(p) {
    if (this.mode !== "solo") return;
    p.extraRoll = false;
    if (this.gameOver) return;
    const alive = [...this.players.values()].filter((q) => !q.bankrupt);
    if (!alive.length) return;
    const index = alive.findIndex((q) => q.id === p.id);
    const next = alive[(index + 1) % alive.length];
    this.activePlayerId = next.id;
    this.turnNumber += 1;
    this.turnStartedAt = this.now();
    this.logLine(`${next.name}'s turn.`, "info");
    this.emit({ kind: "turn", playerId: next.id, text: `${next.name}'s turn` });
    this.seq += 1;
  }
  resolveLanding(p, tile, dice) {
    const space = spaceAt(tile);
    const state = this.tiles[tile];
    switch (space.type) {
      case "property":
      case "railroad":
      case "utility": {
        if (!state.ownerId) {
          p.pending = { kind: "buy", tile, amount: space.price, expiresAt: this.now() + 25e3 };
          this.emit({ kind: "purchase", playerId: p.id, tile, text: "offer" });
          return;
        }
        if (state.ownerId === p.id || state.mortgaged) return;
        const rent = rentFor(tile, this.tiles, dice);
        p.pending = {
          kind: "rent",
          tile,
          amount: rent,
          ownerId: state.ownerId,
          expiresAt: this.now() + 25e3
        };
        this.emit({ kind: "rent", playerId: p.id, tile, amount: rent });
        return;
      }
      case "tax": {
        const amount = space.tax ?? 0;
        this.charge(p, amount, null);
        this.logLine(`${p.name} pays ${space.name} of ${amount}.`, "money");
        return;
      }
      case "chance":
      case "chest": {
        this.drawCard(p, space.type === "chance" ? "chance" : "chest");
        return;
      }
      case "gotojail":
        this.sendToJail(p, "Go To Jail");
        return;
      case "go":
        p.cash += RULES.goSalary;
        this.logLine(`${p.name} lands on GO and collects ${RULES.goSalary}.`, "money");
        return;
      default:
        return;
    }
  }
  drawCard(p, deck) {
    const pool = CARDS.filter((c) => c.deck === deck);
    const card = pool[Math.floor(this.rng() * pool.length)];
    this.logLine(`${p.name} draws "${card.text}"`, "info");
    this.emit({ kind: "card", playerId: p.id, text: card.text, deck });
    const effect = card.effect;
    switch (effect.kind) {
      case "cash":
        if (effect.amount >= 0) p.cash += effect.amount;
        else this.charge(p, -effect.amount, null);
        break;
      case "move": {
        const wrapped = effect.to < p.position;
        p.position = effect.to;
        if (wrapped && effect.collectGo) p.cash += RULES.goSalary;
        this.resolveLanding(p, effect.to, 7);
        break;
      }
      case "jail":
        this.sendToJail(p, "a card");
        break;
      case "jailFree":
        p.jailFree += 1;
        break;
      case "advanceNearestRail": {
        const rails = SPACES.filter((s) => s.type === "railroad").map((s) => s.index);
        const target = rails.find((i) => i > p.position) ?? rails[0];
        p.position = target;
        const st = this.tiles[target];
        if (st.ownerId && st.ownerId !== p.id && !st.mortgaged) {
          const rent = rentFor(target, this.tiles, 7) * 2;
          this.charge(p, rent, st.ownerId);
        } else this.resolveLanding(p, target, 7);
        break;
      }
      case "repair": {
        const owned = Object.values(this.tiles).filter((t) => t.ownerId === p.id && t.building).length;
        this.charge(p, owned * effect.perBuilding, null);
        break;
      }
    }
  }
  sendToJail(p, reason) {
    this.cancelTradesFor(p.id);
    let refund = 0;
    for (const [idx, t] of Object.entries(this.tiles)) {
      if (t.ownerId !== p.id || !t.building) continue;
      refund += Math.round(buildingCost(spaceAt(Number(idx)), t.building) * RULES.sellRefund);
      t.building = null;
      this.buildingCount = Math.max(0, this.buildingCount - 1);
    }
    p.cash += refund;
    const owned = Object.entries(this.tiles).filter(([idx, t]) => t.ownerId === p.id && spaceAt(Number(idx)).price > 0).map(([idx]) => Number(idx));
    const rollPercent = this.rng() * 100;
    let outcome = "none";
    let sold = [];
    if (owned.length && rollPercent < 25) outcome = "all";
    else if (owned.length && rollPercent < 65) outcome = "some";
    if (outcome === "all") sold = owned;
    else if (outcome === "some") {
      const shuffled = [...owned].sort(() => this.rng() - 0.5);
      const count = Math.max(1, Math.min(owned.length - 1, Math.round(owned.length / 2)));
      sold = shuffled.slice(0, count);
    }
    for (const idx of owned) {
      const t = this.tiles[idx];
      if (sold.includes(idx)) {
        t.ownerId = null;
        t.mortgaged = false;
        t.building = null;
        t.shares = {};
        t.lockedBy = null;
      } else if (!t.mortgaged) {
        t.mortgaged = true;
        p.cash += mortgageValue(spaceAt(idx));
      }
    }
    p.position = 10;
    p.inJail = true;
    p.jailTurns = RULES.jailTurns;
    p.jailCause = reason;
    p.jailOutcome = outcome;
    p.jailSold = sold;
    p.jailReleaseCost = this.jailReleaseCost(p);
    p.pending = null;
    p.extraRoll = false;
    const soldLabel = outcome === "all" ? "all deeds sold" : outcome === "some" ? `${sold.length} deed${sold.length === 1 ? "" : "s"} sold` : "deeds mortgaged";
    const chance = {
      label: "Jail property sale",
      percent: 100,
      success: outcome !== "none",
      rollPercent,
      result: outcome === "none" ? "None sold \u2014 deeds mortgaged" : outcome === "all" ? "All properties sold" : `Some sold (${sold.length})`,
      zones: [
        { key: "all", label: "All sold", percent: 25 },
        { key: "some", label: "Some sold", percent: 40 },
        { key: "none", label: "None sold", percent: 35 }
      ]
    };
    this.logLine(`${p.name} is jailed for ${reason}. Sale outcome: ${soldLabel}.`, "crime");
    this.emit({ kind: "jail", playerId: p.id, text: `${reason} \xB7 ${soldLabel}`, chance });
    this.seq += 1;
  }
  jailReleaseCost(p) {
    let total = 0;
    for (const [idx, t] of Object.entries(this.tiles)) {
      if (t.ownerId === p.id && t.mortgaged) total += unmortgageCost(spaceAt(Number(idx)));
    }
    return total;
  }
  // --------------------------------------------------------------- purchases
  buy(p, tile) {
    if (p.pending?.kind !== "buy" || p.pending.tile !== tile) return { ok: false, reason: "No purchase offer for that property." };
    if (p.inJail) return { ok: false, reason: "You cannot buy while jailed." };
    const space = spaceAt(tile);
    const state = this.tiles[tile];
    if (state.ownerId) {
      p.pending = null;
      this.finishTurn(p);
      return { ok: false, reason: "already_owned" };
    }
    if (p.cash < space.price) return { ok: false, reason: "Not enough cash." };
    p.cash -= space.price;
    state.ownerId = p.id;
    p.pending = null;
    this.logLine(`${p.name} buys ${space.name} for ${space.price}.`, "money");
    this.emit({ kind: "purchase", playerId: p.id, tile, amount: space.price });
    this.finishTurn(p);
    this.seq += 1;
    return { ok: true };
  }
  payPendingRent(p) {
    if (p.pending?.kind !== "rent") return { ok: false, reason: "No rent is due." };
    const { tile, amount, ownerId } = p.pending;
    p.pending = null;
    this.payRent(p, tile, amount, ownerId ?? null, false);
    this.finishTurn(p);
    return { ok: true };
  }
  evade(p) {
    if (p.pending?.kind !== "rent") return { ok: false, reason: "No rent is due." };
    const { tile, amount, ownerId } = p.pending;
    p.pending = null;
    const buildings = this.tiles[tile]?.building ? 1 : 0;
    const percent = evadeChance(buildings);
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent * 100;
    const chance = {
      label: "Rent evasion",
      percent: Math.round(percent * 100),
      success,
      rollPercent,
      result: success ? "Slipped away" : "Caught"
    };
    if (success) {
      p.reputation = applyReputation(p.reputation, -RULES.evadeSuccessRep);
      p.unpaidRent += amount;
      p.jailRecord.push({ tile, amount, at: this.now() });
      this.recordAct(p, `Evaded rent at ${spaceAt(tile).name} (${amount}).`);
      this.logLine(`${p.name} slips away without paying rent at ${spaceAt(tile).name}.`, "crime");
      this.emit({ kind: "rent", playerId: p.id, tile, amount: 0, text: "evaded", chance });
    } else {
      const owed = Math.round(amount * (1 + RULES.evadePenalty));
      p.reputation = applyReputation(p.reputation, -RULES.evadeCaughtRep);
      this.recordAct(p, `Caught evading rent at ${spaceAt(tile).name}.`);
      this.payRent(p, tile, owed, ownerId ?? null, false);
      this.logLine(`${p.name} is caught evading and pays ${owed}.`, "crime");
      this.emit({ kind: "rent", playerId: p.id, tile, amount: owed, text: "caught", chance });
    }
    this.finishTurn(p);
    this.seq += 1;
    return { ok: true };
  }
  payRent(p, tile, amount, ownerId, _penalty) {
    this.charge(p, amount, ownerId);
    const state = this.tiles[tile];
    if (!ownerId || state.mortgaged) return;
    const ownerPlayer = this.players.get(ownerId);
    const { holders } = dividendSplit(amount, state.shares);
    if (ownerPlayer) {
      for (const [id, share] of Object.entries(holders)) {
        const holder = this.players.get(id);
        if (!holder || holder.bankrupt || holder.id === ownerId) continue;
        const paid = Math.min(ownerPlayer.cash, share);
        ownerPlayer.cash -= paid;
        holder.cash += paid;
        this.emit({ kind: "cash", playerId: id, amount: paid });
      }
      if (ownerPlayer.id !== p.id) {
        ownerPlayer.reputation = applyReputation(ownerPlayer.reputation, RULES.payRentRep);
      }
    }
    this.emit({ kind: "cash", playerId: p.id, amount: -amount });
    this.seq += 1;
  }
  /** Deducts cash, auto-mortgaging then bankrupting as the brief requires. */
  charge(p, amount, creditorId) {
    if (amount <= 0) return;
    if (p.cash >= amount) {
      p.cash -= amount;
      if (creditorId) {
        const c = this.players.get(creditorId);
        if (c) c.cash += amount;
      }
      return;
    }
    const shortfall = amount - p.cash;
    if (!this.raiseCash(p, shortfall)) {
      const paid = p.cash;
      p.cash = 0;
      if (creditorId) {
        const c = this.players.get(creditorId);
        if (c) c.cash += paid;
      }
      this.bankrupt(p, creditorId);
      return;
    }
    p.cash -= amount;
    if (creditorId) {
      const c = this.players.get(creditorId);
      if (c) c.cash += amount;
    }
  }
  /** Mortgages the lowest-value properties until `need` is covered. */
  raiseCash(p, need) {
    const owned = Object.entries(this.tiles).filter(([, t]) => t.ownerId === p.id && !t.mortgaged).map(([idx]) => spaceAt(Number(idx))).sort((a, b) => a.price - b.price);
    for (const space of owned) {
      if (p.cash >= need) return true;
      const t = this.tiles[space.index];
      t.mortgaged = true;
      p.cash += mortgageValue(space);
      this.logLine(`${p.name} auto-mortgages ${space.name} for ${mortgageValue(space)}.`, "money");
    }
    return p.cash >= need;
  }
  bankrupt(p, creditorId) {
    p.bankrupt = true;
    this.cancelTradesFor(p.id);
    for (const t of Object.values(this.tiles)) {
      if (t.ownerId !== p.id) continue;
      if (t.building) this.buildingCount = Math.max(0, this.buildingCount - 1);
      t.ownerId = creditorId;
      t.building = null;
      t.mortgaged = false;
      t.lockedBy = null;
    }
    p.pending = null;
    this.logLine(`${p.name} is bankrupt.`, "money");
    this.emit({ kind: "cash", playerId: p.id, amount: -1 });
    const alive = [...this.players.values()].filter((player) => !player.bankrupt);
    if (this.players.size >= 2 && alive.length <= 1 && !this.gameOver) {
      this.gameOver = { winnerId: alive[0]?.id ?? "", at: this.now() };
      this.logLine(`${alive[0]?.name ?? "Nobody"} owns the board.`, "money");
      this.emit({ kind: "win", playerId: alive[0]?.id });
    }
  }
  // ------------------------------------------------------------------ build
  build(p, tile, type) {
    const check = canBuild(tile, this.tiles, p.id, this.buildingCount);
    if (!check.ok) return check;
    const space = spaceAt(tile);
    const state = this.tiles[tile];
    if (state.building) return { ok: false, reason: "Sell the current building first." };
    if (state.lockedBy) return { ok: false, reason: "This property is locked by a pending deal." };
    const cost = buildingCost(space, type);
    if (p.cash < cost) return { ok: false, reason: `You need ${cost} to build a ${BUILDING_META[type].name}.` };
    p.cash -= cost;
    state.building = type;
    this.buildingCount += 1;
    this.logLine(`${p.name} builds a ${BUILDING_META[type].name} on ${space.name}.`, "build");
    this.emit({ kind: "build", playerId: p.id, tile });
    this.seq += 1;
    return { ok: true };
  }
  sellBuilding(p, tile) {
    const state = this.tiles[tile];
    if (state.ownerId !== p.id || !state.building) return { ok: false, reason: "No building of yours here." };
    if (state.lockedBy) return { ok: false, reason: "This property is locked by a pending deal." };
    const space = spaceAt(tile);
    const refund = Math.round(buildingCost(space, state.building) * RULES.sellRefund);
    p.cash += refund;
    state.building = null;
    this.buildingCount = Math.max(0, this.buildingCount - 1);
    this.logLine(`${p.name} sells a building on ${space.name} for ${refund}.`, "build");
    this.seq += 1;
    return { ok: true };
  }
  mortgage(p, tile) {
    const space = spaceAt(tile);
    const state = this.tiles[tile];
    if (state.ownerId !== p.id) return { ok: false, reason: "You do not own this property." };
    if (state.mortgaged) return { ok: false, reason: "Already mortgaged." };
    if (state.building) return { ok: false, reason: "Sell the building first." };
    if (state.lockedBy) return { ok: false, reason: "This property is locked by a pending deal." };
    state.mortgaged = true;
    p.cash += mortgageValue(space);
    this.logLine(`${p.name} mortgages ${space.name} for ${mortgageValue(space)}.`, "money");
    this.seq += 1;
    return { ok: true };
  }
  unmortgage(p, tile) {
    const space = spaceAt(tile);
    const state = this.tiles[tile];
    if (state.ownerId !== p.id) return { ok: false, reason: "You do not own this property." };
    if (!state.mortgaged) return { ok: false, reason: "Not mortgaged." };
    if (state.lockedBy) return { ok: false, reason: "This property is locked by a pending deal." };
    const cost = unmortgageCost(space);
    if (p.cash < cost) return { ok: false, reason: `You need ${cost}.` };
    p.cash -= cost;
    state.mortgaged = false;
    this.logLine(`${p.name} unmortgages ${space.name} for ${cost}.`, "money");
    this.seq += 1;
    return { ok: true };
  }
  // ------------------------------------------------------------------ trades
  tradeValue(side) {
    let total = Math.max(0, Math.round(side.cash));
    for (const tile of side.properties) {
      const state = this.tiles[tile];
      if (!state) continue;
      const space = spaceAt(tile);
      total += state.mortgaged ? Math.round(space.price * 0.5) : space.price;
      if (state.building) total += Math.round(buildingCost(space, state.building) * 0.5);
    }
    return total;
  }
  cleanTradeSide(ownerId, cash, properties, allowLock) {
    if (!Number.isFinite(cash) || cash < 0 || !Number.isInteger(cash)) {
      return { ok: false, reason: "Trade cash must be a whole number of dollars." };
    }
    if (!Array.isArray(properties) || properties.length > 12) {
      return { ok: false, reason: "A trade can include up to 12 properties per side." };
    }
    if (new Set(properties).size !== properties.length) {
      return { ok: false, reason: "A property can only appear once in a trade." };
    }
    for (const tile of properties) {
      if (!Number.isInteger(tile) || !this.tiles[tile]) return { ok: false, reason: "That property is not on the board." };
      const state = this.tiles[tile];
      if (!spaceAt(tile).price) return { ok: false, reason: `${spaceAt(tile).name} cannot be traded.` };
      if (state.ownerId !== ownerId) return { ok: false, reason: `You do not own ${spaceAt(tile).name}.` };
      if (state.lockedBy && state.lockedBy !== allowLock) return { ok: false, reason: `${spaceAt(tile).name} is locked by another deal.` };
    }
    if (cash === 0 && properties.length === 0) return { ok: false, reason: "A trade needs something from each side." };
    return { ok: true, side: { cash, properties: [...properties].sort((a, b) => a - b) } };
  }
  releaseTrade(trade, status) {
    trade.status = status;
    for (const tile of [...trade.give.properties, ...trade.want.properties]) {
      const state = this.tiles[tile];
      if (state?.lockedBy === `trade:${trade.id}`) state.lockedBy = null;
    }
    this.botTradeAt.delete(trade.id);
    this.seq += 1;
    this.dirty = true;
  }
  makeTrade(from, to, give, want) {
    const id = uid("trade");
    const trade = {
      id,
      fromId: from.id,
      toId: to.id,
      give,
      want,
      status: "pending",
      createdAt: this.now(),
      expiresAt: this.now() + 12e4
    };
    this.trades.set(id, trade);
    for (const tile of [...give.properties, ...want.properties]) this.tiles[tile].lockedBy = `trade:${id}`;
    if (to.isBot) this.botTradeAt.set(id, this.now() + 1300);
    this.logLine(`${from.name} offers ${to.name} a trade.`, "info");
    this.emit({ kind: "trade", playerId: from.id, targetId: to.id, audience: [from.id, to.id], text: "offer", amount: give.cash + want.cash });
    this.seq += 1;
    this.dirty = true;
    return trade;
  }
  offerTrade(p, targetId, giveCash, giveTiles, wantCash, wantTiles) {
    const target = this.players.get(targetId);
    if (!target || target.bankrupt || target.id === p.id) return { ok: false, reason: "Pick another player to trade with." };
    if (p.cash < giveCash) return { ok: false, reason: "You do not have that much cash." };
    if (target.cash < wantCash) return { ok: false, reason: `${target.name} does not have that much cash.` };
    const give = this.cleanTradeSide(p.id, giveCash, giveTiles);
    if (!give.ok) return give;
    const want = this.cleanTradeSide(target.id, wantCash, wantTiles);
    if (!want.ok) return want;
    const pending = [...this.trades.values()].filter((t) => t.status === "pending" && (t.fromId === p.id || t.toId === p.id));
    if (pending.length >= 6) return { ok: false, reason: "Resolve an open trade before starting another." };
    this.makeTrade(p, target, give.side, want.side);
    return { ok: true };
  }
  acceptTrade(p, tradeId) {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== "pending") return { ok: false, reason: "That offer is no longer open." };
    if (trade.toId !== p.id) return { ok: false, reason: "Only the recipient can accept this offer." };
    if (this.now() > trade.expiresAt) {
      this.releaseTrade(trade, "expired");
      return { ok: false, reason: "That offer has expired." };
    }
    const from = this.players.get(trade.fromId);
    if (!from || from.bankrupt) return { ok: false, reason: "The other player has left the board." };
    if (from.cash < trade.give.cash || p.cash < trade.want.cash) {
      return { ok: false, reason: "Cash changed while the offer was open. Adjust the trade." };
    }
    for (const tile of trade.give.properties) {
      const state = this.tiles[tile];
      if (state.ownerId !== from.id || state.lockedBy !== `trade:${trade.id}`) {
        return { ok: false, reason: `The deal is stale: ${spaceAt(tile).name} changed hands.` };
      }
    }
    for (const tile of trade.want.properties) {
      const state = this.tiles[tile];
      if (state.ownerId !== p.id || state.lockedBy !== `trade:${trade.id}`) {
        return { ok: false, reason: `The deal is stale: ${spaceAt(tile).name} changed hands.` };
      }
    }
    from.cash -= trade.give.cash;
    p.cash += trade.give.cash;
    p.cash -= trade.want.cash;
    from.cash += trade.want.cash;
    for (const tile of trade.give.properties) this.tiles[tile].ownerId = p.id;
    for (const tile of trade.want.properties) this.tiles[tile].ownerId = from.id;
    trade.status = "accepted";
    this.botTradeAt.delete(trade.id);
    for (const tile of [...trade.give.properties, ...trade.want.properties]) this.tiles[tile].lockedBy = null;
    this.logLine(`${p.name} accepts a trade with ${from.name}.`, "money");
    this.emit({ kind: "trade", playerId: p.id, targetId: from.id, audience: [from.id, p.id], text: "accepted", amount: trade.give.cash + trade.want.cash });
    this.seq += 1;
    this.dirty = true;
    return { ok: true };
  }
  declineTrade(p, tradeId) {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== "pending") return { ok: false, reason: "That offer is no longer open." };
    if (trade.fromId !== p.id && trade.toId !== p.id) return { ok: false, reason: "That is not your offer." };
    this.releaseTrade(trade, "declined");
    this.emit({ kind: "trade", playerId: p.id, targetId: trade.fromId === p.id ? trade.toId : trade.fromId, audience: [trade.fromId, trade.toId], text: "declined" });
    return { ok: true };
  }
  counterTrade(p, tradeId, giveCash, giveTiles, wantCash, wantTiles) {
    const old = this.trades.get(tradeId);
    if (!old || old.status !== "pending") return { ok: false, reason: "That offer is no longer open." };
    if (old.toId !== p.id) return { ok: false, reason: "Only the recipient can counter this offer." };
    const other = this.players.get(old.fromId);
    if (!other || other.bankrupt) return { ok: false, reason: "The other player has left the board." };
    if (p.cash < giveCash) return { ok: false, reason: "You do not have that much cash." };
    if (other.cash < wantCash) return { ok: false, reason: `${other.name} does not have that much cash.` };
    const give = this.cleanTradeSide(p.id, giveCash, giveTiles, `trade:${old.id}`);
    if (!give.ok) return give;
    const want = this.cleanTradeSide(other.id, wantCash, wantTiles, `trade:${old.id}`);
    if (!want.ok) return want;
    for (const tile of [...old.give.properties, ...old.want.properties]) {
      const state = this.tiles[tile];
      if (state?.lockedBy === `trade:${old.id}`) state.lockedBy = null;
    }
    old.status = "countered";
    this.botTradeAt.delete(old.id);
    this.makeTrade(p, other, give.side, want.side);
    this.emit({ kind: "trade", playerId: p.id, targetId: other.id, audience: [p.id, other.id], text: "countered" });
    return { ok: true };
  }
  expireTrades() {
    for (const trade of this.trades.values()) {
      if (trade.status !== "pending" || this.now() <= trade.expiresAt) continue;
      this.releaseTrade(trade, "expired");
      this.emit({ kind: "trade", playerId: trade.fromId, targetId: trade.toId, audience: [trade.fromId, trade.toId], text: "expired" });
    }
  }
  decideBotTrades(now) {
    for (const trade of [...this.trades.values()]) {
      if (trade.status !== "pending") continue;
      const bot = this.players.get(trade.toId);
      if (!bot?.isBot) continue;
      const at = this.botTradeAt.get(trade.id) ?? now;
      if (now < at) continue;
      const giveValue = this.tradeValue(trade.give);
      const wantValue = this.tradeValue(trade.want);
      if (giveValue >= wantValue * 0.9) this.acceptTrade(bot, trade.id);
      else this.declineTrade(bot, trade.id);
    }
  }
  cancelTradesFor(playerId) {
    for (const trade of this.trades.values()) {
      if (trade.status !== "pending" || trade.fromId !== playerId && trade.toId !== playerId) continue;
      trade.status = "cancelled";
      for (const tile of [...trade.give.properties, ...trade.want.properties]) {
        const state = this.tiles[tile];
        if (state?.lockedBy === `trade:${trade.id}`) state.lockedBy = null;
      }
      this.botTradeAt.delete(trade.id);
    }
  }
  /** Removes any legacy bot seats and returns their deeds to the bank. */
  purgeBots() {
    for (const p of [...this.players.values()]) {
      if (!p.isBot) continue;
      this.cancelTradesFor(p.id);
      for (const t of Object.values(this.tiles)) {
        if (t.ownerId !== p.id) continue;
        if (t.building) this.buildingCount = Math.max(0, this.buildingCount - 1);
        t.ownerId = null;
        t.building = null;
        t.mortgaged = false;
        t.shares = {};
        t.lockedBy = null;
      }
      this.players.delete(p.id);
    }
    if (this.activePlayerId && !this.players.has(this.activePlayerId)) {
      this.activePlayerId = [...this.players.values()].find((p) => !p.isBot)?.id ?? null;
    }
  }
  // ------------------------------------------------------------------- loans
  takeLoan(p, amount) {
    const privatePlayer = this.privateState(p.id).you;
    const cap = loanCap(netWorth(privatePlayer, this.tiles, this.prices));
    if (amount < 200) return { ok: false, reason: "Minimum loan is $200." };
    if (p.loan + amount > cap) return { ok: false, reason: `Your loan limit is ${cap}.` };
    p.loan += amount;
    p.cash += amount;
    this.logLine(`${p.name} borrows ${amount} from the bank.`, "money");
    this.emit({ kind: "loan", playerId: p.id, amount });
    this.seq += 1;
    return { ok: true };
  }
  repayLoan(p, amount) {
    const pay = Math.min(amount, p.loan, p.cash);
    if (pay <= 0) return { ok: false, reason: "Nothing to repay." };
    p.cash -= pay;
    p.loan -= pay;
    this.logLine(`${p.name} repays ${pay} of their loan.`, "money");
    this.seq += 1;
    return { ok: true };
  }
  // ------------------------------------------------------------------ stocks
  tradeStock(p, tile, qty) {
    if (!Number.isInteger(qty) || qty === 0) return { ok: false, reason: "Choose a whole number of shares." };
    const space = spaceAt(tile);
    if (!space.price) return { ok: false, reason: "That space has no stock." };
    const price = this.prices[tile];
    const state = this.tiles[tile];
    const key = String(tile);
    const held = p.holdings[key] ?? 0;
    const purchase = qty > 0;
    const cost = Math.abs(qty) * price;
    if (purchase) {
      if (p.cash < cost) return { ok: false, reason: `You need ${Math.round(cost)}.` };
      if (state.ownerId !== p.id) {
        const external = Object.entries(state.shares).filter(([id]) => id !== state.ownerId).reduce((a, [, v]) => a + v, 0);
        if (external + qty / 1e3 > RULES.externalMax) return { ok: false, reason: "External ownership is capped at 50%." };
      }
      p.cash -= cost;
      state.shares[p.id] = (state.shares[p.id] ?? 0) + qty / 1e3;
      p.holdings[key] = held + qty;
      p.costBasis[key] = (p.costBasis[key] ?? 0) + cost;
      this.volumes[tile] = (this.volumes[tile] ?? 0) + qty;
    } else {
      const sell = -qty;
      if (sell > held) return { ok: false, reason: `You only hold ${held} shares.` };
      const basis = p.costBasis[key] ?? 0;
      const average = held > 0 ? basis / held : price;
      p.cash += sell * price;
      p.realizedPnl += (price - average) * sell;
      state.shares[p.id] = Math.max(0, (state.shares[p.id] ?? 0) - sell / 1e3);
      p.holdings[key] = held - sell;
      p.costBasis[key] = Math.max(0, basis - average * sell);
      if (p.holdings[key] === 0) {
        delete p.holdings[key];
        delete p.costBasis[key];
      }
      this.volumes[tile] = (this.volumes[tile] ?? 0) - sell;
    }
    const fund = fundamental(tile, this.tiles);
    const impact = Math.max(-0.04, Math.min(0.04, qty / 2500));
    this.prices[tile] = clampPrice(this.prices[tile] * (1 + impact), fund);
    this.emit({ kind: "stock", playerId: p.id, tile, amount: qty });
    this.seq += 1;
    return { ok: true };
  }
  // ------------------------------------------------------------------- crime
  theft(p, target) {
    if (this.now() - p.lastTheftAt < 4e3) return { ok: false, reason: "The heat is still on \u2014 wait a moment." };
    p.lastTheftAt = this.now();
    p.reputation = applyReputation(p.reputation, -RULES.theftAttemptRep);
    if (target === "bank") {
      const percent2 = bankTheftChance(p.reputation) * 100;
      const rollPercent2 = (this.rollTest() ?? this.rng()) * 100;
      const success2 = rollPercent2 < percent2;
      const chance2 = {
        label: "Bank heist",
        percent: Math.round(percent2),
        success: success2,
        rollPercent: rollPercent2,
        result: success2 ? "Score" : "Caught"
      };
      if (success2) {
        const amount = theftAmount(this.rng);
        p.cash += amount;
        this.recordAct(p, `Robbed the bank for ${amount}.`);
        this.logLine(`${p.name} robs the bank for ${amount}.`, "crime");
        this.emit({ kind: "theft", playerId: p.id, amount, text: "bank success", chance: chance2 });
      } else {
        p.reputation = applyReputation(p.reputation, -RULES.theftRepLoss);
        this.recordAct(p, "Failed bank heist and was jailed.");
        this.emit({ kind: "theft", playerId: p.id, amount: 0, text: "bank fail", chance: chance2 });
        this.sendToJail(p, "a failed bank heist");
      }
      return { ok: true };
    }
    const victim = this.players.get(target);
    if (!victim || victim.bankrupt) return { ok: false, reason: "That player is not on the board." };
    const percent = playerTheftChance() * 100;
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent;
    const chance = {
      label: `Rob ${victim.name}`,
      percent: Math.round(percent),
      success,
      rollPercent,
      result: success ? "Clean getaway" : "Caught"
    };
    if (success) {
      const amount = Math.min(RULES.playerTheftCap, Math.floor(victim.cash * 0.25));
      victim.cash -= amount;
      p.cash += amount;
      p.reputation = applyReputation(p.reputation, -Math.round(amount / 100));
      this.recordAct(p, `Stole ${amount} from ${victim.name}.`);
      this.logLine(`${p.name} steals ${amount} from ${victim.name}.`, "crime");
      this.emit({ kind: "theft", playerId: p.id, amount, text: "player success", chance });
      this.emit({ kind: "cash", playerId: victim.id, amount: -amount });
    } else {
      p.reputation = applyReputation(p.reputation, -RULES.theftRepLoss);
      this.recordAct(p, `Failed robbery of ${victim.name} and was jailed.`);
      this.logLine(`${p.name} fails to rob ${victim.name} and is jailed.`, "crime");
      this.emit({ kind: "theft", playerId: p.id, amount: 0, text: "attempted", chance });
      this.sendToJail(p, "a failed robbery");
    }
    this.seq += 1;
    return { ok: true };
  }
  hireDetective(p, target) {
    const victim = this.players.get(target);
    if (!victim || victim.bankrupt || victim.id === p.id) return { ok: false, reason: "Pick another player." };
    if (p.cash < RULES.detectiveFee) return { ok: false, reason: `A detective costs ${RULES.detectiveFee}.` };
    p.cash -= RULES.detectiveFee;
    const percent = RULES.detectiveChance * 100;
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent;
    const chance = {
      label: `Detective on ${victim.name}`,
      percent: Math.round(percent),
      success,
      rollPercent,
      result: success ? "Record revealed" : "Nothing found"
    };
    if (success) {
      p.findings[target] = (p.findings[target] ?? 0) + 1;
      p.dossier[target] = {
        reputation: victim.reputation,
        evidence: evidenceStrength(victim.unpaidRent, p.findings[target] ?? 1),
        at: this.now(),
        record: victim.jailRecord.slice(-20),
        acts: victim.acts.slice(-20)
      };
      this.logLine(`${p.name} hires a detective.`, "crime");
      this.emit({ kind: "detective", playerId: p.id, audience: [p.id], text: "success", chance });
    } else {
      this.emit({ kind: "detective", playerId: p.id, audience: [p.id], text: "investigated", chance });
    }
    this.seq += 1;
    return { ok: true };
  }
  murder(p, target) {
    const victim = this.players.get(target);
    if (victim) this.cancelTradesFor(victim.id);
    if (!victim || victim.bankrupt || victim.id === p.id) return { ok: false, reason: "Pick another player." };
    if (this.now() < p.murderReadyAt) return { ok: false, reason: "The heat is too high. Wait before another attempt." };
    p.murderReadyAt = this.now() + RULES.murderCooldownMs;
    p.reputation = applyReputation(p.reputation, -RULES.murderAttemptRep);
    const percent = RULES.murderChance * 100;
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent;
    const chance = {
      label: `Murder attempt on ${victim.name}`,
      percent: Math.round(percent),
      success,
      rollPercent,
      result: success ? "Target hospitalized" : "Attempt failed"
    };
    if (success) {
      p.reputation = applyReputation(p.reputation, -RULES.murderSuccessRep);
      this.recordAct(p, `Murdered ${victim.name}.`);
      for (const [idx, t] of Object.entries(this.tiles)) {
        if (t.ownerId !== victim.id) continue;
        if (t.building) this.buildingCount = Math.max(0, this.buildingCount - 1);
        t.ownerId = null;
        t.building = null;
        t.mortgaged = false;
        t.shares = {};
        t.lockedBy = null;
        void idx;
      }
      victim.cash = 0;
      victim.position = 0;
      victim.inHospital = true;
      victim.hospitalTurns = RULES.hospitalTurns;
      victim.inJail = false;
      victim.jailTurns = 0;
      victim.jailReleaseCost = 0;
      victim.jailCause = null;
      victim.jailOutcome = null;
      victim.jailSold = [];
      victim.pending = null;
      victim.loan = 0;
      victim.holdings = {};
      victim.costBasis = {};
      victim.extraRoll = false;
      this.logLine(`${victim.name} is hospitalized.`, "crime");
      this.emit({ kind: "murder", playerId: p.id, targetId: victim.id, audience: [p.id, victim.id], text: "success", chance });
      this.emit({ kind: "hospital", playerId: victim.id, audience: [p.id, victim.id], text: "You wake in the hospital. Your portfolio is gone." });
      this.seq += 1;
      return { ok: true };
    }
    const caught = this.rng() < RULES.murderCaughtChance;
    p.reputation = applyReputation(p.reputation, -(caught ? RULES.murderCaughtRep : 5));
    this.recordAct(p, `Failed murder attempt on ${victim.name}${caught ? " and was caught" : ""}.`);
    if (caught) {
      const fine = Math.min(p.cash, RULES.murderFine);
      p.cash -= fine;
      this.logLine(`${p.name} is caught attempting murder and fined ${fine}.`, "crime");
      this.emit({ kind: "murder", playerId: p.id, targetId: victim.id, audience: [p.id], text: `caught \xB7 fine ${fine}`, amount: -fine, chance });
      this.sendToJail(p, "a failed murder attempt");
    } else {
      this.emit({ kind: "murder", playerId: p.id, targetId: victim.id, audience: [p.id], text: "failed \xB7 escaped notice", chance });
    }
    this.seq += 1;
    return { ok: true };
  }
  recordAct(p, text) {
    p.acts.push({ at: this.now(), text });
    if (p.acts.length > 60) p.acts = p.acts.slice(-40);
  }
  // -------------------------------------------------------------------- court
  sue(p, target, claim) {
    const victim = this.players.get(target);
    if (!victim || victim.bankrupt || victim.id === p.id) return { ok: false, reason: "Pick another player." };
    const findings = p.findings[target] ?? 0;
    const strength = evidenceStrength(victim.unpaidRent, findings);
    if (strength < 1) return { ok: false, reason: "You need evidence strength of at least 1. Hire a detective." };
    const max = maxClaim(strength);
    if (claim < 100 || claim > max) return { ok: false, reason: `Claim must be between 100 and ${max}.` };
    const id = uid("suit");
    const suit = {
      id,
      plaintiffId: p.id,
      defendantId: victim.id,
      claim: Math.round(claim),
      evidence: strength,
      filedAt: this.now(),
      status: "pending"
    };
    this.suits.set(id, suit);
    this.lockAssets(p.id, id, true);
    this.lockAssets(victim.id, id, true);
    this.logLine(`${p.name} sues ${victim.name} for ${claim} (evidence ${strength}).`, "court");
    this.seq += 1;
    return { ok: true };
  }
  lockAssets(playerId, suitId, lock) {
    for (const t of Object.values(this.tiles)) {
      if (t.ownerId !== playerId) continue;
      if (lock) t.lockedBy = suitId;
      else if (t.lockedBy === suitId) t.lockedBy = null;
    }
  }
  settle(p, suitId) {
    const suit = this.suits.get(suitId);
    if (!suit || suit.status !== "pending") return { ok: false, reason: "No open suit." };
    if (suit.defendantId !== p.id) return { ok: false, reason: "Only the defendant can settle." };
    const amount = Math.round(suit.claim * RULES.settleMultiple);
    if (p.cash < amount) return { ok: false, reason: `Settling costs ${amount}.` };
    p.cash -= amount;
    const plaintiff = this.players.get(suit.plaintiffId);
    if (plaintiff) plaintiff.cash += amount;
    suit.status = "closed";
    this.lockAssets(suit.plaintiffId, suit.id, false);
    this.lockAssets(suit.defendantId, suit.id, false);
    this.logLine(`${p.name} settles with ${plaintiff?.name ?? "the plaintiff"} for ${amount}.`, "court");
    this.emit({ kind: "verdict", playerId: p.id, amount });
    this.seq += 1;
    return { ok: true };
  }
  court(p, suitId) {
    const suit = this.suits.get(suitId);
    if (!suit || suit.status !== "pending") return { ok: false, reason: "No open suit." };
    if (suit.plaintiffId !== p.id && suit.defendantId !== p.id) return { ok: false, reason: "Not your case." };
    const chanceValue = suitChance(suit.evidence);
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const plaintiffWins = rollPercent < chanceValue * 100;
    const chance = {
      label: "Court verdict",
      percent: Math.round(chanceValue * 100),
      success: plaintiffWins,
      rollPercent,
      result: plaintiffWins ? "Plaintiff wins" : "Defendant wins"
    };
    const plaintiff = this.players.get(suit.plaintiffId);
    const defendant = this.players.get(suit.defendantId);
    if (!plaintiff || !defendant) return { ok: false, reason: "A party has left the board." };
    if (plaintiffWins) {
      this.charge(defendant, suit.claim + RULES.suitFees, plaintiff.id);
      plaintiff.reputation = applyReputation(plaintiff.reputation, RULES.suitWinRep);
      defendant.reputation = applyReputation(defendant.reputation, -RULES.suitLossRep);
      this.logLine(`Verdict: ${plaintiff.name} wins ${suit.claim + RULES.suitFees} from ${defendant.name}.`, "court");
    } else {
      this.charge(plaintiff, RULES.suitLoss, defendant.id);
      plaintiff.reputation = applyReputation(plaintiff.reputation, -RULES.suitLossRep);
      this.logLine(`Verdict: ${plaintiff.name} loses and pays ${RULES.suitLoss}. Frivolous suit.`, "court");
    }
    suit.status = "closed";
    this.lockAssets(suit.plaintiffId, suit.id, false);
    this.lockAssets(suit.defendantId, suit.id, false);
    this.emit({
      kind: "verdict",
      playerId: plaintiffWins ? plaintiff.id : defendant.id,
      targetId: plaintiffWins ? defendant.id : plaintiff.id,
      amount: suit.claim,
      chance,
      audience: [plaintiff.id, defendant.id]
    });
    this.seq += 1;
    return { ok: true };
  }
  payJail(p) {
    if (!p.inJail) return { ok: false, reason: "You are not in jail." };
    const cost = this.jailReleaseCost(p);
    if (p.cash < cost) return { ok: false, reason: `You need ${cost} to restore your properties.` };
    p.cash -= cost;
    for (const t of Object.values(this.tiles)) {
      if (t.ownerId === p.id) t.mortgaged = false;
    }
    p.inJail = false;
    p.jailTurns = 0;
    p.jailReleaseCost = 0;
    this.logLine(`${p.name} pays ${cost} and walks free.`, "crime");
    this.seq += 1;
    return { ok: true };
  }
  // --------------------------------------------------------------------- tick
  /** Stock prices evolve even while everyone is offline. */
  tick(dtMs) {
    this.tickTimer += dtMs;
    if (this.tickTimer < 5e3) return;
    this.tickTimer = 0;
    for (const space of SPACES) {
      if (!space.price) continue;
      const fund = fundamental(space.index, this.tiles);
      const next = clampPrice(
        this.prices[space.index] * (1 + (fund - this.prices[space.index]) / Math.max(1, fund) * 0.02 * 6 + (this.rng() * 2 - 1) * 0.015 + Math.max(-0.04, Math.min(0.04, (this.volumes[space.index] ?? 0) / 400))),
        fund
      );
      this.prices[space.index] = next;
      this.volumes[space.index] = 0;
    }
    this.seq += 1;
    this.dirty = true;
  }
  expirePending() {
    const now = this.now();
    this.expireTrades();
    for (const p of this.players.values()) {
      if (p.pending && p.pending.expiresAt < now) {
        if (p.pending.kind === "rent") {
          const { tile, amount, ownerId } = p.pending;
          p.pending = null;
          this.payRent(p, tile, amount, ownerId ?? null, false);
          this.finishTurn(p);
        } else {
          p.pending = null;
          this.finishTurn(p);
        }
        this.seq += 1;
      }
    }
  }
  botTakeTurn(p, now) {
    if (p.pending) {
      if (p.pending.kind === "buy") {
        const price = p.pending.amount;
        if (p.cash > price * 1.8) this.intent(p.id, { t: "buy", tile: p.pending.tile, key: `bot-buy-${p.pending.tile}-${now}` });
        else this.intent(p.id, { t: "decline", tile: p.pending.tile, key: `bot-dec-${now}` });
      } else {
        this.intent(p.id, { t: "payRent", tile: p.pending.tile, key: `bot-rent-${now}` });
      }
      return;
    }
    if (p.inJail && p.cash > this.jailReleaseCost(p) * 1.4) {
      this.intent(p.id, { t: "jailPay", key: `bot-jail-${now}` });
      return;
    }
    for (const space of SPACES) {
      const state = this.tiles[space.index];
      if (state.ownerId !== p.id || state.building || !space.buildCost) continue;
      if (!ownsGroup(space.group, p.id, this.tiles)) continue;
      if (p.cash > buildingCost(space, "house") * 2.4) {
        this.intent(p.id, { t: "build", tile: space.index, type: "house", key: `bot-build-${space.index}-${now}` });
        return;
      }
    }
    this.intent(p.id, { t: "roll", key: `bot-roll-${now}` });
  }
  runBots() {
    const now = this.now();
    if (this.mode === "solo") {
      this.decideBotTrades(now);
      const active = this.activePlayerId ? this.players.get(this.activePlayerId) : null;
      if (!active || !active.isBot || active.bankrupt) return;
      if (now - this.lastBotAt < 900 || now - this.turnStartedAt < 500) return;
      this.lastBotAt = now;
      this.botTakeTurn(active, now);
      return;
    }
    for (const p of this.players.values()) {
      if (!p.isBot || p.bankrupt) continue;
      if (now - p.lastRollAt < 2600) continue;
      this.botTakeTurn(p, now);
    }
  }
  /** Test-only setup used by the loopback scenario endpoint. */
  testSetup(session, setup) {
    const players = [...this.players.values()];
    const actor = players.find((p) => p.session === session);
    if (!actor) return { ok: false, reason: "Unknown session." };
    const target = setup.targetSession ? players.find((p) => p.session === setup.targetSession) : void 0;
    const tile = setup.tile ?? 1;
    if (setup.roll !== void 0) this.testRoll = setup.roll;
    switch (setup.kind) {
      case "cash":
        if (setup.cash !== void 0) actor.cash = setup.cash;
        if (setup.reputation !== void 0) actor.reputation = setup.reputation;
        break;
      case "rent": {
        const owner = setup.ownerSession ? players.find((p) => p.session === setup.ownerSession) : players.find((p) => p.id !== actor.id);
        if (!owner) return { ok: false, reason: "A second player is needed as owner." };
        if (!spaceAt(tile).price) return { ok: false, reason: "That space cannot be owned." };
        const state = this.tiles[tile];
        state.ownerId = owner.id;
        state.mortgaged = false;
        state.lockedBy = null;
        state.building = setup.building ?? null;
        if (setup.cash !== void 0) actor.cash = setup.cash;
        actor.position = tile;
        actor.pending = {
          kind: "rent",
          tile,
          amount: rentFor(tile, this.tiles, 7),
          ownerId: owner.id,
          expiresAt: this.now() + 12e4
        };
        break;
      }
      case "jail": {
        if (!spaceAt(tile).price) return { ok: false, reason: "That space cannot be owned." };
        const state = this.tiles[tile];
        state.ownerId = actor.id;
        state.mortgaged = false;
        state.lockedBy = null;
        state.building = "house";
        actor.cash = setup.cash ?? 5e3;
        actor.pending = null;
        actor.unpaidRent += setup.unpaid ?? 300;
        actor.jailRecord.push({ tile, amount: setup.unpaid ?? 300, at: this.now() });
        this.sendToJail(actor, "the test scenario");
        actor.cash = setup.cash ?? 5e3;
        actor.jailReleaseCost = this.jailReleaseCost(actor);
        break;
      }
      case "evidence":
        if (!target) return { ok: false, reason: "A target is needed." };
        actor.cash = setup.cash ?? 12e3;
        actor.findings[target.id] = setup.findings ?? 1;
        target.unpaidRent = setup.unpaid ?? 300;
        target.jailRecord = [{ tile, amount: target.unpaidRent, at: this.now() }];
        break;
      case "suit": {
        if (!target) return { ok: false, reason: "A defendant is needed." };
        actor.findings[target.id] = setup.findings ?? 2;
        target.unpaidRent = setup.unpaid ?? 300;
        if (setup.cash !== void 0) actor.cash = setup.cash;
        const result = this.sue(actor, target.id, setup.claim ?? 500);
        if (!result.ok) return result;
        break;
      }
      case "build": {
        const space = spaceAt(tile);
        if (!space.group) return { ok: false, reason: "That space has no colour group." };
        for (const member of groupMembers(space.group)) {
          const state = this.tiles[member.index];
          state.ownerId = actor.id;
          state.mortgaged = false;
          state.lockedBy = null;
          state.building = null;
        }
        actor.cash = setup.cash ?? 5e3;
        break;
      }
      case "theft":
        actor.cash = setup.cash ?? 1500;
        actor.reputation = setup.reputation ?? 50;
        actor.lastTheftAt = 0;
        break;
      case "offer": {
        if (!spaceAt(tile).price) return { ok: false, reason: "That space cannot be bought." };
        actor.position = tile;
        actor.pending = { kind: "buy", tile, amount: spaceAt(tile).price, expiresAt: this.now() + 12e4 };
        break;
      }
      case "card":
        actor.pending = null;
        this.drawCard(actor, setup.deck ?? "chance");
        break;
      case "endgame":
        this.gameOver = { winnerId: actor.id, at: this.now() };
        break;
    }
    this.buildingCount = groupBuildingCount(this.tiles);
    this.seq += 1;
    this.dirty = true;
    return { ok: true, playerId: actor.id };
  }
  rollTest() {
    if (this.testRoll === null) return null;
    const value = this.testRoll;
    this.testRoll = null;
    return value;
  }
  logLine(text, kind) {
    this.logSeq += 1;
    this.log.push({ id: this.logSeq, at: this.now(), text, kind });
    if (this.log.length > 400) this.log = this.log.slice(-200);
  }
  emit(event) {
    this.onEvent({ ...event, at: this.now() });
  }
  snapshot() {
    return {
      seq: this.seq,
      players: [...this.players.values()].map((p) => ({ ...p, intents: /* @__PURE__ */ new Map() })),
      tiles: this.tiles,
      prices: this.prices,
      log: this.log,
      suitSeq: this.suitSeq,
      logSeq: this.logSeq,
      activePlayerId: this.activePlayerId,
      turnNumber: this.turnNumber,
      trades: [...this.trades.values()]
    };
  }
  restore(snap) {
    this.seq = snap.seq ?? 0;
    this.tiles = snap.tiles;
    this.prices = snap.prices;
    this.log = snap.log ?? [];
    this.logSeq = snap.logSeq ?? this.log.length;
    this.suitSeq = snap.suitSeq ?? 0;
    this.activePlayerId = snap.activePlayerId ?? null;
    this.turnNumber = snap.turnNumber ?? 0;
    this.trades = new Map((snap.trades ?? []).map((t) => [t.id, t]));
    this.buildingCount = groupBuildingCount(this.tiles);
    for (const raw of snap.players) {
      const p = raw;
      this.players.set(p.id, {
        ...p,
        acts: p.acts ?? [],
        costBasis: p.costBasis ?? {},
        realizedPnl: p.realizedPnl ?? 0,
        inHospital: p.inHospital ?? false,
        hospitalTurns: p.hospitalTurns ?? 0,
        jailCause: p.jailCause ?? null,
        jailOutcome: p.jailOutcome ?? null,
        jailSold: p.jailSold ?? [],
        murderReadyAt: p.murderReadyAt ?? 0,
        extraRoll: false,
        intents: new Map(p.intents ?? []),
        pending: null
      });
    }
  }
};

// server/db.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
var DATA_DIR = path.resolve(import.meta.dirname, "..", "data");
var DB_PATH = process.env.CHROMONOPOLY_DB ?? path.join(DATA_DIR, "chromonopoly.db");
var Store = class {
  db;
  lastSave = 0;
  constructor(file = DB_PATH) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        token_id TEXT NOT NULL,
        session TEXT NOT NULL UNIQUE,
        cash INTEGER NOT NULL,
        position INTEGER NOT NULL,
        reputation INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        snapshot TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }
  saveWorld(snapshot, force = false) {
    const now = Date.now();
    if (!force && now - this.lastSave < 1500) return;
    this.lastSave = now;
    const json = JSON.stringify(snapshot, (_k, v) => v instanceof Map ? [...v.entries()] : v);
    this.db.prepare(
      `INSERT INTO world (id, snapshot, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at`
    ).run(json, now);
  }
  loadWorld() {
    const row = this.db.prepare("SELECT snapshot FROM world WHERE id = 1").get();
    if (!row?.snapshot) return null;
    try {
      return JSON.parse(row.snapshot);
    } catch {
      return null;
    }
  }
  upsertAccount(a) {
    this.db.prepare(
      `INSERT INTO accounts (id, name, token_id, session, cash, position, reputation, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, token_id = excluded.token_id, session = excluded.session,
           cash = excluded.cash, position = excluded.position,
           reputation = excluded.reputation, updated_at = excluded.updated_at`
    ).run(a.id, a.name, a.token_id, a.session, a.cash, a.position, a.reputation, a.updated_at);
  }
  topAccounts(limit = 10) {
    return this.db.prepare("SELECT * FROM accounts ORDER BY cash DESC LIMIT ?").all(limit);
  }
  close() {
    this.db.close();
  }
};

// server/index.ts
var PORT = Number(process.env.CHROMONOPOLY_PORT ?? 8787) || 8787;
var ROOT = path2.resolve(import.meta.dirname, "..");
var DIST = path2.join(ROOT, "dist");
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".wasm": "application/wasm"
};
var store = new Store();
var clients = /* @__PURE__ */ new Map();
var events = [];
var soloWorlds = /* @__PURE__ */ new Map();
function clientsIn(world) {
  return [...clients.values()].filter((c) => c.world === world);
}
function broadcastWorld(world, message) {
  const payload = JSON.stringify(message);
  for (const client of clientsIn(world)) {
    if (message.type === "event" && message.event?.audience?.length) {
      if (!message.event.audience.includes(client.playerId)) continue;
    }
    if (client.ws.readyState === import_websocket.default.OPEN) client.ws.send(payload);
  }
}
function newWorld(mode) {
  let self;
  self = new World({
    mode,
    onEvent: (event) => {
      events.push(event);
      if (events.length > 160) events.shift();
      broadcastWorld(self, { type: "event", event });
    }
  });
  return self;
}
var publicWorld = newWorld("multi");
var saved = store.loadWorld();
if (saved) {
  publicWorld.restore(saved);
  publicWorld.purgeBots();
  console.log(`restored public world with ${publicWorld.players.size} real players, seq ${publicWorld.seq}`);
}
var BOT_TOKENS = ["dog", "taxi", "penguin", "chest", "locomotive", "panda"];
function fillSoloBots(world) {
  while ([...world.players.values()].filter((p) => p.isBot).length < 3) {
    world.addBot(BOT_TOKENS);
  }
}
function send(ws, message) {
  if (ws.readyState === import_websocket.default.OPEN) ws.send(JSON.stringify(message));
}
var server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname === "/api/health") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({
      ok: true,
      players: publicWorld.players.size,
      seq: publicWorld.seq,
      soloTables: soloWorlds.size,
      uptime: process.uptime()
    }));
    return;
  }
  if (url.pathname === "/api/leaderboard") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(store.topAccounts(10)));
    return;
  }
  if (url.pathname === "/api/test/reset") {
    const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
    if (process.env.CHROMONOPOLY_TEST !== "1" || !loopback || req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }
    for (const ws of clients.keys()) ws.close(1001, "test reset");
    clients.clear();
    soloWorlds.clear();
    events.length = 0;
    publicWorld = newWorld("multi");
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === "/api/test/scenario") {
    const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
    if (process.env.CHROMONOPOLY_TEST !== "1" || !loopback || req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      const body = JSON.parse(raw);
      if (!body.session || !body.setup) throw new Error("session and setup are required");
      const targetWorld = body.mode === "solo" ? soloWorlds.get(body.session)?.world : publicWorld;
      if (!targetWorld) throw new Error("no world for that session");
      const result = targetWorld.testSetup(body.session, body.setup);
      res.writeHead(result.ok ? 200 : 400, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : "bad request" }));
    }
    return;
  }
  let filePath = path2.join(DIST, decodeURIComponent(url.pathname));
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path2.join(filePath, "index.html");
  } catch {
    filePath = path2.join(DIST, "index.html");
  }
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path2.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=604800",
      "x-content-type-options": "nosniff"
    });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
var wss = new import_websocket_server.default({ server, path: "/ws" });
wss.on("connection", (ws) => {
  let client = null;
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "rejected", reason: "Malformed message." });
      return;
    }
    if (msg.type === "hello") {
      const mode = msg.mode === "solo" ? "solo" : "multi";
      const name = String(msg.name ?? "").trim() || "Tycoon";
      const tokenId = String(msg.tokenId ?? "cat");
      let world = publicWorld;
      let known;
      if (mode === "solo") {
        known = msg.session ? soloWorlds.get(msg.session) : void 0;
        if (known) {
          world = known.world;
          known.touched = Date.now();
        } else {
          world = newWorld("solo");
        }
      }
      const { player, session } = world.join(name, tokenId, msg.session);
      if (mode === "solo") {
        if (!known) fillSoloBots(world);
        const entry = soloWorlds.get(session) ?? { world, touched: Date.now() };
        entry.world = world;
        entry.touched = Date.now();
        soloWorlds.set(session, entry);
      }
      client = { ws, playerId: player.id, world, mode };
      clients.set(ws, client);
      send(ws, { type: "welcome", playerId: player.id, session, mode });
      send(ws, { type: "state", state: world.publicState() });
      send(ws, { type: "private", private: world.privateState(player.id) });
      return;
    }
    if (!client) {
      send(ws, { type: "rejected", reason: "Join the board first." });
      return;
    }
    if (msg.type === "resync") {
      send(ws, { type: "resync", state: client.world.publicState(), private: client.world.privateState(client.playerId) });
      return;
    }
    if (msg.type === "intent" && msg.intent) {
      const intent = msg.intent;
      if ("key" in intent && !intent.key) {
        send(ws, { type: "rejected", reason: "Missing idempotency key." });
        return;
      }
      const result = client.world.intent(client.playerId, intent);
      if (!result.ok) {
        send(ws, { type: "rejected", reason: result.reason ?? "Action refused.", key: "key" in intent ? intent.key : void 0 });
      } else {
        send(ws, { type: "private", private: client.world.privateState(client.playerId) });
      }
    }
  });
  ws.on("close", () => {
    if (!client) return;
    clients.delete(ws);
    client = null;
  });
});
var lastBroadcast = /* @__PURE__ */ new Map();
var lastPrivate = /* @__PURE__ */ new Map();
setInterval(() => {
  const worlds = [publicWorld, ...[...soloWorlds.values()].map((s) => s.world)];
  for (const world of worlds) {
    world.tick(100);
    world.expirePending();
    world.runBots();
    if (world.seq !== (lastBroadcast.get(world) ?? -1)) {
      lastBroadcast.set(world, world.seq);
      broadcastWorld(world, { type: "state", state: world.publicState() });
    }
    if (world.seq !== (lastPrivate.get(world) ?? -1)) {
      lastPrivate.set(world, world.seq);
      for (const c of clientsIn(world)) {
        try {
          send(c.ws, { type: "private", private: world.privateState(c.playerId) });
        } catch {
        }
      }
    }
  }
  if (publicWorld.dirty) {
    publicWorld.dirty = false;
    store.saveWorld(publicWorld.snapshot());
    for (const p of publicWorld.players.values()) {
      store.upsertAccount({
        id: p.id,
        name: p.name,
        token_id: p.tokenId,
        session: p.session,
        cash: p.cash,
        position: p.position,
        reputation: p.reputation,
        updated_at: Date.now()
      });
    }
  }
}, 80);
server.listen(PORT, () => {
  console.log(`Chromonopoly server on http://localhost:${PORT}  (ws://localhost:${PORT}/ws)`);
});
function shutdown() {
  store.saveWorld(publicWorld.snapshot(), true);
  store.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1200);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
