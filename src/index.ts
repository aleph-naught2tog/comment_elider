import ts from "typescript";
import fs from "fs";
import path from "path";

import { handleFile, UserOptions } from "./handleFile";

const USER_OPTIONS = {
  ignore: {
    folders: ["node_modules", ".git"]
  },
  compileJavascript: false,
  outputFolder: "output"
};

// Compiler options
const ENCODING: BufferEncoding = "utf8";
const SCRIPT_TARGET: ts.ScriptTarget = ts.ScriptTarget.ES2015;
const LINE_ENDING: ts.NewLineKind = ts.NewLineKind.LineFeed;

const PRINTER_OPTIONS: ts.PrinterOptions = {
  removeComments: true,
  newLine: LINE_ENDING
};

/*
  process.argv[0] => shebang/interpreter
  process.argv[1] => name of file being executed (here, index.ts)

  process.argv[2] => actual files
*/
const commandLineArguments = process.argv.slice(2);
const inputFiles: string[] = commandLineArguments.length
  ? commandLineArguments
  : [process.cwd()];

const printer: ts.Printer = ts.createPrinter(PRINTER_OPTIONS);

const getPathTo = (file: string): string => {
  if (path.isAbsolute(file)) {
    return file;
  } else {
    return path.join(process.cwd(), file);
  }
};

const readFile = (encoding: BufferEncoding, scriptTarget: ts.ScriptTarget) => (
  file: string
): string => {
  const fileData: Buffer = fs.readFileSync(file);
  const stringyData: string = fileData.toString(encoding);

  const tsProcessedFile = tsProcessFile(scriptTarget)(stringyData);

  return tsProcessedFile;
};

const tsProcessFile = (scriptTarget: ts.ScriptTarget) => (
  stringyData: string
): string => {
  const sourceFile = ts.createSourceFile("", stringyData, scriptTarget);
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

const processFile = (userOptions: UserOptions) => (
  encoding: BufferEncoding,
  scriptTarget: ts.ScriptTarget
) => (fileName: string): void => {
  const { outputFolder } = userOptions;
  const relativeFileName = path.basename(fileName);
  const outputPath = path.join(process.cwd(), outputFolder, relativeFileName);

  const writableOutput = readFile(encoding, scriptTarget)(fileName);

  fs.writeFileSync(outputPath, writableOutput);
};

const removeComments = (userOptions: UserOptions) => (
  encoding: BufferEncoding,
  scriptTarget: ts.ScriptTarget
) => (fileList: string[]): void => {
  const { outputFolder } = userOptions;

  makeFolderIfNotExists(outputFolder);

  for (const file of fileList) {
    const contextFile: string = getPathTo(file);
    const fileInfo: fs.Stats = fs.statSync(contextFile);
    const fileProcessor = processFile(userOptions)(encoding, scriptTarget);

    handleFile(userOptions)(fileInfo, contextFile, fileProcessor);
  }
};

removeComments(USER_OPTIONS)(ENCODING, SCRIPT_TARGET)(inputFiles);
