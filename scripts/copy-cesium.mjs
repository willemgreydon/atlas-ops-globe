import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules", "cesium", "Build", "Cesium");
const out = join(process.cwd(), "public", "cesium");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  await cp(join(src, name), join(out, name), { recursive: true });
}
console.log("Cesium runtime assets copied to public/cesium");
