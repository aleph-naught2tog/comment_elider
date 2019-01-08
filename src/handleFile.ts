import fs from "fs";
import path from "path";

export type UserOptions = {
  compileJavascript: boolean;
  ignore: {
    folders: string[];
  };
  outputFolder: string;
};

const shouldContinue = (ignoreOptions: UserOptions) => (
  absolutePath: string
): boolean => {
  const basename = path.basename(absolutePath);
  const extname = path.extname(absolutePath);
  const isTsFile = extname === ".ts";
  const isJsFile = extname === ".js";

  const isIgnoredFolder = ignoreOptions.ignore.folders.some(
    folder => folder === basename
  );

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

  return isTsFile || (ignoreOptions.compileJavascript && isJsFile);
};

export const handleFile = (userOptions: UserOptions) => (
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

  if (!shouldContinue(userOptions)(absolutePath)) {
    return;
  }

  if (maybeFile.isDirectory()) {
    /*
      The type assertion for `options` is because `readdirSync` only accepts
      {withFileTypes: true} -- _not_ the expected `{withFileTypes: boolean}`.
      For typechecking then we need to assert that we 'know' that the value of
      that key can only be `true`.
    */
    const options: {
      withFileTypes: true;
    } = { withFileTypes: true };

    const files: fs.Dirent[] = fs.readdirSync(absolutePath, options);

    for (const file of files) {
      handleFile(userOptions)(file, absolutePath, fileAction);
    }

  } else {
    fileAction(absolutePath);
  }
};
