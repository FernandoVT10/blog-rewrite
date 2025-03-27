const chokidar = require("chokidar");
const child_process = require("child_process");
const path = require("path");
const livereload = require("livereload");

const rootDir = path.resolve(__dirname, "..");
const srcDir = path.resolve(rootDir, "./src");
const binDir = path.resolve(rootDir, "./node_modules/.bin");

function spawnTSNode() {
    const severMainFile = path.resolve(srcDir, "main.ts");
    const child = child_process.spawn(path.resolve(binDir, "ts-node"), [
        severMainFile
    ], { stdio: "inherit" });
    return child;
}

function handleServer() {
    console.log("Running ts-node ./src/main.ts");
    let serverChild = spawnTSNode();
    chokidar.watch(srcDir).on("change", () => {
        console.log("Re-running ts-node ./src/main.ts");
        if(!serverChild.killed) serverChild.kill();
        serverChild = spawnTSNode();
    });
}

function buildSass() {
    console.log("Compiling sass...");
    const sassFile = path.resolve(rootDir, "./assets/scss/main.scss");
    const outputFile = path.resolve(rootDir, "./public/build/main.css");
    const child = child_process.spawn(path.resolve(binDir, "sass"), [
        `${sassFile}:${outputFile}`,
        "--style", "compressed",
        "--no-source-map",
    ], { stdio: "inherit" });

    child.on("exit", (code) => {
        if(code === 0) {
            console.log("Sass compiled successfully!");
        }
    });
}

function handleSass() {
    buildSass();

    const sassDir = path.resolve(rootDir, "./assets/scss");
    chokidar.watch(sassDir).on("change", () => {
        buildSass();
    });
}

function runTypeChecking() {
    const tsConfigFile = path.resolve(rootDir, "./assets/tsconfig.json");
    const child = child_process.spawn(path.resolve(binDir, "tsc"), [
        "--noEmit",
        "-p", tsConfigFile,
    ], { stdio: "inherit" });

    return new Promise((resolve) => {
        child.on("exit", (code) => {
            if(code === 0) resolve(true);
            else resolve(false);
        });
    });
}

async function buildScripts() {
    if(!(await runTypeChecking())) return;

    console.log("Running esbuild");
    const inputGlob = path.resolve(rootDir, "./assets/ts/*.ts");
    const outDir = path.resolve(rootDir, "./public/build/js");
    const child = child_process.spawn(path.resolve(binDir, "esbuild"), [
        inputGlob,
        `--outdir=${outDir}`,
        "--bundle",
    ], { stdio: "inherit" });

    child.on("exit", (code) => {
        if(code === 0) {
            console.log("Esbuild exited successfully!");
        }
    });
}

async function handleScripts() {
    await buildScripts();

    const scriptsDir = path.resolve(rootDir, "./assets/ts");
    chokidar.watch(scriptsDir).on("change", async () => {
        await buildScripts();
    });
}

function startLiveReload() {
    const liveServer = livereload.createServer({
        exts: ["css", "js"],
    });
    const publicDir = path.resolve(rootDir, "./public");
    liveServer.watch([publicDir]);
    console.log("Livereload server started");
}

async function main() {
    handleServer();
    handleSass();
    await handleScripts();
    startLiveReload();
}

main();
