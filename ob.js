const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const sourceDir = path.join(__dirname, "root");
const outputDir = path.join(__dirname, "extension");

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const options = {
    compact: true,
    identifierNamesGenerator: "hexadecimal",
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 1,
    transformObjectKeys: true
};

fs.readdirSync(sourceDir).forEach(file => {

    const sourceFile = path.join(sourceDir, file);
    const outputFile = path.join(outputDir, file);

    // Folder bhi copy kar do
    if (fs.statSync(sourceFile).isDirectory()) {
        fs.cpSync(sourceFile, outputFile, { recursive: true });
        console.log("📁 Copied:", file);
        return;
    }

    // Sirf JS obfuscate
    if (path.extname(file).toLowerCase() === ".js") {

        const code = fs.readFileSync(sourceFile, "utf8");

        const obfuscated = JavaScriptObfuscator
            .obfuscate(code, options)
            .getObfuscatedCode();

        fs.writeFileSync(outputFile, obfuscated);

        console.log("🔒 Obfuscated:", file);

    } else {
        // Baaki sab files same copy
        fs.copyFileSync(sourceFile, outputFile);
        console.log("📄 Copied:", file);
    }

});

console.log("✅ Extension folder ready.");