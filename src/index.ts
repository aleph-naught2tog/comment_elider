import ts from "typescript";
import fs from "fs";
import path from "path";

const ENCODING: BufferEncoding = "utf8";
const SCRIPT_TARGET: ts.ScriptTarget = ts.ScriptTarget.ES2015;
const LINE_ENDING: ts.NewLineKind = ts.NewLineKind.LineFeed;

const PRINTER_OPTIONS: ts.PrinterOptions = {
  removeComments: true,
  newLine: LINE_ENDING
};

const IGNORE = {
  folders: ["node_modules", ".git"]
};

const OUTPUT_FOLDER = "output";
const COMPILE_JS = false;

/*
  process.argv[0] => shebang/interpreter
  process.argv[1] => name of file being executed (here, index.ts)

  process.argv[2] => actual files
*/
const inputFiles: string[] = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [process.cwd()];

const printer: ts.Printer = ts.createPrinter(PRINTER_OPTIONS);

const shouldContinue = (absolutePath: string): boolean => {
  const basename = path.basename(absolutePath);
  const extname = path.extname(absolutePath);
  const isTsFile = extname === ".ts";
  const isJsFile = extname === ".js";

  const isIgnoredFolder = IGNORE.folders.some(folder => folder === basename);

  if (basename.startsWith(".")) {
    return false;
  }

  if (isIgnoredFolder) {
    return false;
  }

  if (extname === "") {
    // then this is a folder (most likely)
    return true;
  }

  return isTsFile || (COMPILE_JS && isJsFile);
};

const handleFile = (
  maybeFile: fs.Dirent | fs.Stats,
  folderName: string,
  fileAction: (inputFile: string) => void
): void => {
  let absolutePath: string;

  if (maybeFile instanceof fs.Dirent) {
    absolutePath = path.join(folderName, maybeFile.name);
  } else {
    absolutePath = folderName;
  }

  if (!shouldContinue(absolutePath)) {
    console.log("should not continue ", absolutePath);
    return;
  }

  if (maybeFile.isDirectory()) {
    /*
      The type assertion for `options` is because `readdirSync` only accepts
      {withFileTypes: true} -- _not_ the expected `{withFileTypes: boolean}`.
      For typechecking then we need to assert that we 'know' that the value of
      that key can only be `true`.
    */
    const options: { withFileTypes: true } = { withFileTypes: true };
    const files: fs.Dirent[] = fs.readdirSync(absolutePath, options);

    for (const file of files) {
      handleFile(file, absolutePath, fileAction);
    }
  } else {
    fileAction(absolutePath);
  }
};

const getPathTo = (file: string): string => {
  if (path.isAbsolute(file)) {
    return file;
  } else {
    return path.join(process.cwd(), file);
  }
};

const readFile = (file: string): string => {
  const fileData: Buffer = fs.readFileSync(file);
  const stringyData: string = fileData.toString(ENCODING);

  const sourceFile = ts.createSourceFile("", stringyData, SCRIPT_TARGET);
  const result = printer.printNode(
    ts.EmitHint.Unspecified,
    sourceFile,
    sourceFile
  );

  return result;
};

const makeFolderIfNotExists = (outputFolder: string): void => {
  const realPath = getPathTo(outputFolder);

  try {
    fs.statSync(realPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      fs.mkdirSync(outputFolder);
    } else {
      console.error(error);
      process.exit(1);
    }
  }
};

const processFile = (fileName: string): void => {
  const relativeFileName = path.basename(fileName);
  const outputPath = path.join(process.cwd(), OUTPUT_FOLDER, relativeFileName);

  const writableOutput = readFile(fileName);

  fs.writeFileSync(outputPath, writableOutput);
};

const removeComments = (fileList: string[], outputFolder: string): void => {
  makeFolderIfNotExists(outputFolder);

  for (const file of fileList) {
    const contextFile: string = getPathTo(file);
    const fileInfo: fs.Stats = fs.statSync(contextFile);

    handleFile(fileInfo, contextFile, processFile);
  }
};

removeComments(inputFiles, OUTPUT_FOLDER);
