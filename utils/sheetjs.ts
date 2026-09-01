import { loadFiles } from "utils/functions";

type SheetJs = {
  read: (data: Buffer) => unknown;
  write: (
    workbook: unknown,
    options: {
      bookType: string;
      numbers?: string;
      type: "buffer";
    }
  ) => Uint8Array;
};

declare global {
  interface Window {
    XLSX: SheetJs;
    XLSX_ZAHL_PAYLOAD?: string;
  }
}

const getSheetJs = async (): Promise<SheetJs> => {
  if (!window.XLSX) {
    await loadFiles(["/Program Files/SheetJS/xlsx.full.min.js"]);
  }

  return window.XLSX;
};

export const convertSheet = async (
  fileData: Buffer,
  extension: string
): Promise<Uint8Array> => {
  const sheetJs = await getSheetJs();
  let numbers: string | undefined;

  if (extension === "numbers") {
    await loadFiles(["/Program Files/SheetJS/xlsx.zahl.js"]);

    if (!window.XLSX_ZAHL_PAYLOAD) return Buffer.from("");

    numbers = window.XLSX_ZAHL_PAYLOAD;
  }

  return sheetJs.write(sheetJs.read(fileData), {
    bookType: extension,
    numbers,
    type: "buffer",
  });
};
