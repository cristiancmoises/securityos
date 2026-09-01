import { config } from "components/apps/Terminal/config";
import type { LocalEcho } from "components/apps/Terminal/types";
import type { WASIBindings } from "wasi-js";

type WASIError = Error & {
  code: number;
};

let bindings: WASIBindings | null;

const loadWapm = async (
  commandArgs: string[],
  localEcho: LocalEcho
): Promise<void> => {
  const { fetchCommandFromWAPM } = await import("@wasmer/wasm-terminal");
  const { lowerI64Imports } = await import("@wasmer/wasm-transformer");
  const { default: WASI } = await import("wasi-js");

  try {
    const wasmBinary = await fetchCommandFromWAPM({ args: commandArgs });

    if (
      wasmBinary.length < 1024 &&
      new TextDecoder().decode(wasmBinary).includes("NoSuchKey")
    ) {
      throw new Error(`command not found ${commandArgs[0]}`);
    }

    const moduleResponse = await lowerI64Imports(wasmBinary);

    if (moduleResponse !== undefined && moduleResponse instanceof Uint8Array) {
      bindings ||= (await import("wasi-js/dist/bindings/browser")).default;

      // TS 5.9 correctly models a transformed view as potentially backed by a
      // SharedArrayBuffer. WebAssembly.compile requires an ordinary, owned
      // ArrayBuffer, so make that ownership explicit instead of casting it.
      const wasmBytes = new Uint8Array(moduleResponse.byteLength);

      wasmBytes.set(moduleResponse);

      const wasmModule = await WebAssembly.compile(wasmBytes);
      const wasi = new WASI({
        args: commandArgs,
        bindings,
        env: {
          COLUMNS: config.cols?.toString(),
          LINES: config.rows?.toString(),
        },
        sendStderr: (buffer: Uint8Array) => localEcho?.print(buffer.toString()),
        sendStdout: (buffer: Uint8Array) => localEcho?.print(buffer.toString()),
      });
      const instance = await WebAssembly.instantiate(
        wasmModule,
        wasi.getImports(wasmModule) as WebAssembly.Imports
      );

      wasi.start(instance);
    }
  } catch (error) {
    const { message } = error as WASIError;

    localEcho?.println(message);
  }
};

export default loadWapm;
