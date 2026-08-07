import { readFileSync, writeFileSync } from "fs";
import * as XLSX from "xlsx";

const b64 = readFileSync("./_tmp_b64.txt", "utf8").trim();
const buf = Buffer.from(b64, "base64");
const wb = XLSX.read(buf, { type: "buffer" });
console.log("Sheets:", wb.SheetNames);
for (const name of wb.SheetNames) {
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[name]), null, 2));
}
