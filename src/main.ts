import express from "express";
import path from "path";
import fs from "fs";
import sass from "sass";

import routes from "./routes";

const app = express();
const port = 3000;

const publicDir = path.resolve(__dirname, "../public/");
const sassDir = path.resolve(__dirname, "./scss/");

app.use(express.static(publicDir));

async function compileSass(): Promise<boolean> {
    const files = await fs.promises.readdir(sassDir);

    console.log("[INFO] Compiling scss files...");
    for(const file of files) {
        try{
            const filePath = path.resolve(sassDir, file);

            const result = await sass.compileAsync(filePath);

            const fileName = path.basename(file, path.extname(file));
            const outFilePath = path.resolve(publicDir, `${fileName}.css`);
            await fs.promises.writeFile(outFilePath, result.css);

        } catch(e) {
            console.error("[ERROR]", e);
            return false;
        }
    }

    console.log("[INFO] Scss files compiled sucessfully");
    return true;
}

async function main() {
    if(!await compileSass()) {
        process.exit(1);
    }

    app.use(routes);

    app.listen(port, () => {
        console.log(`[INFO] Server listening on port ${port}`);
    });
}

main();
