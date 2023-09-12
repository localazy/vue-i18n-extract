import path from 'path';
import fs from 'fs';
import glob from 'glob';
import Dot from 'dot-object';
import yaml from 'js-yaml';
import isValidGlob from 'is-valid-glob';
import { SimpleFile, I18NLanguage, I18NItem } from '../types';
import jsonrepair from "jsonrepair"

export function readLanguageFiles (src: string): SimpleFile[] {
  if (!isValidGlob(src)) {
    throw new Error(`languageFiles isn't a valid glob pattern.`);
  }

  const targetFiles = glob.sync(src);

  if (targetFiles.length === 0) {
    throw new Error('languageFiles glob has no files.');
  }

  return targetFiles.map(f => {
    const langPath = path.resolve(process.cwd(), f);
    const currentFolder = langPath.substring(0, langPath.lastIndexOf("/"))
    const localeIndexFile = `${currentFolder}/index.ts`;

    const extension = langPath.substring(langPath.lastIndexOf('.')).toLowerCase();
    const isJSON = extension === '.json';
    const isTS = extension === '.ts';
    const isYAML = extension === '.yaml' || extension === '.yml';

    let langObj;
    if (isJSON) {
      langObj = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    } else if (isYAML) {
      langObj = yaml.load(fs.readFileSync(langPath, 'utf8'));
    } else if (isTS) {
        const content = fs.readFileSync(langPath, 'utf8');
        const indexFile = fs.readFileSync(localeIndexFile, 'utf8');
        const cleanContent = content
            .replace("export default", "")
            .replace(/};/g, "}")
            .replace(/} ;/g, "}")
            .replace(/`/g, '"')
        // const keyPrefixRegex = new RegExp(/"xxa", { "?([@\w]*)"?:/g)
        const keyPrefixRegex = new RegExp(/loadLocalizationFiles\(\s+require.context\(\s+\".",\s+false,\s+\/\.\*\\\.ts\$\/,\s+\),\s+\"([@\w]*)/gm)
        const keyPrefix = keyPrefixRegex.exec(indexFile)
        if (keyPrefix && keyPrefix[1]) {
            langObj = JSON.parse(jsonrepair(cleanContent));
            langObj = {
                [keyPrefix[1]]: langObj
            }
        } else {
            throw new Error("Could not read key prefix from locale index file");
        }
    } else {
        langObj = eval(fs.readFileSync(langPath, 'utf8'));
    }

    const fileName = f.replace(process.cwd(), '.');

    return { path: f, fileName, content: JSON.stringify(langObj) };
  });
}

export function extractI18NLanguageFromLanguageFiles (languageFiles: SimpleFile[], dot: DotObject.Dot = Dot): I18NLanguage {
  return languageFiles.reduce((accumulator, file) => {
    const language = file.fileName.substring(file.fileName.lastIndexOf('/') + 1, file.fileName.lastIndexOf('.'));

    if (!accumulator[language]) {
      accumulator[language] = [];
    }

    const flattenedObject = dot.dot(JSON.parse(file.content));
    Object.keys(flattenedObject).forEach((key) => {
      accumulator[language].push({
        path: key,
        file: file.fileName,
      });
    });

    return accumulator;
  }, {});
}

export function writeMissingToLanguageFiles (parsedLanguageFiles: SimpleFile[], missingKeys: I18NItem[], dot: DotObject.Dot = Dot): void {
  parsedLanguageFiles.forEach(languageFile => {
    const languageFileContent = JSON.parse(languageFile.content);

    missingKeys.forEach(item => {
      if (item.language && languageFile.fileName.includes(item.language) || !item.language) {
        dot.str(item.path, '', languageFileContent);
      }
    });

    writeLanguageFile(languageFile, languageFileContent);
  });
}

export function removeUnusedFromLanguageFiles (parsedLanguageFiles: SimpleFile[], unusedKeys: I18NItem[], dot: DotObject.Dot = Dot): void {
  parsedLanguageFiles.forEach(languageFile => {
    const languageFileContent = JSON.parse(languageFile.content);

    unusedKeys.forEach(item => {
      if (item.language && languageFile.fileName.includes(item.language)) {
        dot.delete(item.path, languageFileContent);
      }
    });

    writeLanguageFile(languageFile, languageFileContent);
  });
}

function writeLanguageFile (languageFile: SimpleFile, newLanguageFileContent: unknown) {
  const fileExtension = languageFile.fileName.substring(languageFile.fileName.lastIndexOf('.') + 1);
    const filePath = languageFile.path;
    const nestedContent = Object.values(newLanguageFileContent as Record<string, Record<string, string>>)[0];
    const stringifiedContent = JSON.stringify(newLanguageFileContent, null, 2);

    if (fileExtension === 'json') {
      fs.writeFileSync(filePath, stringifiedContent);
    } else if (fileExtension === 'js') {
      const jsFile = `module.exports = ${stringifiedContent}; \n`;
      fs.writeFileSync(filePath, jsFile);
    } else if (fileExtension === 'yaml' || fileExtension === 'yml') {
      const yamlFile = yaml.dump(newLanguageFileContent);
      fs.writeFileSync(filePath, yamlFile);
     } else if (fileExtension === 'ts') {
        const nestedStringifiedContent = JSON.stringify(nestedContent, null, 2);
        const unquotedContent = unquotePropertiesFromJSONString(nestedStringifiedContent);
        const tsFile = `export default ${unquotedContent};`;
        fs.writeFileSync(filePath, tsFile);
    } else {
      throw new Error(`Language filetype of ${fileExtension} not supported.`)
    }
}

function unquotePropertiesFromJSONString(stringifiedObject: string) {
  return stringifiedObject.replace(/^[\t ]*"[^:\n\r]+(?<!\\)":/gm, function (match) {
      return match.replace(/"/g, "");
  });
}

// This is a convenience function for users implementing in their own projects, and isn't used internally
export function parselanguageFiles (languageFiles: string, dot: DotObject.Dot = Dot): I18NLanguage {
  return extractI18NLanguageFromLanguageFiles(readLanguageFiles(languageFiles), dot);
}
