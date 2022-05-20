(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('cac'), require('fs'), require('path'), require('is-valid-glob'), require('glob'), require('dot-object'), require('js-yaml')) :
  typeof define === 'function' && define.amd ? define(['exports', 'cac', 'fs', 'path', 'is-valid-glob', 'glob', 'dot-object', 'js-yaml'], factory) :
  (global = global || self, factory(global.vueI18NExtract = {}, global.cac, global.fs, global.path, global.isValidGlob, global.glob, global.dotObject, global.jsYaml));
})(this, (function (exports, cac, fs, path, isValidGlob, glob, Dot, yaml) {
  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var cac__default = /*#__PURE__*/_interopDefaultLegacy(cac);
  var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
  var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
  var isValidGlob__default = /*#__PURE__*/_interopDefaultLegacy(isValidGlob);
  var glob__default = /*#__PURE__*/_interopDefaultLegacy(glob);
  var Dot__default = /*#__PURE__*/_interopDefaultLegacy(Dot);
  var yaml__default = /*#__PURE__*/_interopDefaultLegacy(yaml);

  function _extends() {
    _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  var defaultConfig = {
    // Options documented in vue-i18n-extract readme.
    vueFiles: './src/**/*.?(js|vue)',
    languageFiles: './lang/**/*.?(json|yaml|yml|js)',
    excludedKeys: [],
    output: false,
    add: false,
    remove: false,
    ci: false,
    separator: '.'
  };

  function initCommand() {
    fs__default["default"].writeFileSync(path__default["default"].resolve(process.cwd(), './vue-i18n-extract.config.js'), `module.exports = ${JSON.stringify(defaultConfig, null, 2)}`);
  }
  function resolveConfig() {
    const argvOptions = cac__default["default"]().parse(process.argv, {
      run: false
    }).options;
    const excluded = argvOptions.exclude;
    argvOptions.exclude = !Array.isArray(excluded) ? [excluded] : excluded;

    try {
      const pathToConfigFile = path__default["default"].resolve(process.cwd(), './vue-i18n-extract.config.js'); // eslint-disable-next-line @typescript-eslint/no-var-requires

      const configFile = require(pathToConfigFile);

      console.info(`\nUsing config file found at ${pathToConfigFile}`);
      return _extends({}, configFile, argvOptions);
    } catch (_unused) {
      return argvOptions;
    }
  }

  function readVueFiles(src) {
    if (!isValidGlob__default["default"](src)) {
      throw new Error(`vueFiles isn't a valid glob pattern.`);
    }

    const targetFiles = glob__default["default"].sync(src);

    if (targetFiles.length === 0) {
      throw new Error('vueFiles glob has no files.');
    }

    return targetFiles.map(f => {
      const fileName = f.replace(process.cwd(), '.');
      return {
        fileName,
        path: f,
        content: fs__default["default"].readFileSync(f, 'utf8')
      };
    });
  }

  function* getMatches(file, regExp, captureGroup = 1) {
    while (true) {
      const match = regExp.exec(file.content);

      if (match === null) {
        break;
      }

      const path = match[captureGroup];
      const pathAtIndex = file.content.indexOf(path);
      const previousCharacter = file.content.charAt(pathAtIndex - 1);
      const nextCharacter = file.content.charAt(pathAtIndex + path.length);
      const line = (file.content.substring(0, match.index).match(/\n/g) || []).length + 1;
      yield {
        path,
        previousCharacter,
        nextCharacter,
        file: file.fileName,
        line
      };
    }
  }
  /**
   * Extracts translation keys from methods such as `$t` and `$tc`.
   *
   * - **regexp pattern**: (?:[$\s.:"'`+\(\[\{]t[cm]?)\(
   *
   *   **description**: Matches the sequence t(, tc( or tm(, optionally with either “$”, SPACE, “.”, “:”, “"”, “'”,
   *   “`”, "+", "(", "[" or "{" in front of it.
   *
   * - **regexp pattern**: (["'`])
   *
   *   **description**: 1. capturing group. Matches either “"”, “'”, or “`”.
   *
   * - **regexp pattern**: ((?:[^\\]|\\.)*?)
   *
   *   **description**: 2. capturing group. Matches anything except a backslash
   *   *or* matches any backslash followed by any character (e.g. “\"”, “\`”, “\t”, etc.)
   *
   * - **regexp pattern**: \1
   *
   *   **description**: matches whatever was matched by capturing group 1 (e.g. the starting string character)
   *
   * @param file a file object
   * @returns a list of translation keys found in `file`.
   */


  function extractMethodMatches(file) {
    const methodRegExp = /(?:[$\s.:"'`+\(\[\{]t[cm]?)\(\s*?(["'`])((?:[^\\]|\\.)*?)\1/g;
    return [...getMatches(file, methodRegExp, 2)];
  }

  function extractComponentMatches(file) {
    const componentRegExp = /(?:(?:<|h\()(?:i18n|Translation))(?:.|\n)*?(?:[^:]path(?:=|: )("|'))((?:[^\\]|\\.)*?)\1/gi;
    return [...getMatches(file, componentRegExp, 2)];
  }

  function extractDirectiveMatches(file) {
    const directiveRegExp = /v-t(?:.*)="'((?:[^\\]|\\.)*?)'"/g;
    return [...getMatches(file, directiveRegExp)];
  }

  function extractI18NItemsFromVueFiles(sourceFiles) {
    return sourceFiles.reduce((accumulator, file) => {
      const methodMatches = extractMethodMatches(file);
      const componentMatches = extractComponentMatches(file);
      const directiveMatches = extractDirectiveMatches(file);
      return [...accumulator, ...methodMatches, ...componentMatches, ...directiveMatches];
    }, []);
  } // This is a convenience function for users implementing in their own projects, and isn't used internally

  function parseVueFiles(vueFiles) {
    return extractI18NItemsFromVueFiles(readVueFiles(vueFiles));
  }

  function JsonRepairError(message, char) {
    if (!(this instanceof JsonRepairError)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    this.message = message + ' (char ' + char + ')';
    this.char = char;
    this.stack = new Error().stack;
  }
  JsonRepairError.prototype = new Error();
  JsonRepairError.prototype.constructor = Error;

  var SINGLE_QUOTES = {
    '\'': true,
    // quote
    "\u2018": true,
    // quote left
    "\u2019": true,
    // quote right
    "`": true,
    // grave accent
    "\xB4": true // acute accent

  };
  var DOUBLE_QUOTES = {
    '"': true,
    "\u201C": true,
    // double quote left
    "\u201D": true // double quote right

  };
  /**
   * Check if the given character contains an alpha character, a-z, A-Z, _
   * @param {string} c
   * @return {boolean}
   */

  function isAlpha(c) {
    return ALPHA_REGEX.test(c);
  }
  var ALPHA_REGEX = /^[a-zA-Z_]$/;
  /**
   * Check if the given character contains a hexadecimal character 0-9, a-f, A-F
   * @param {string} c
   * @return {boolean}
   */

  function isHex(c) {
    return HEX_REGEX.test(c);
  }
  var HEX_REGEX = /^[0-9a-fA-F]$/;
  /**
   * checks if the given char c is a digit
   * @param {string} c
   * @return {boolean}
   */

  function isDigit(c) {
    return DIGIT_REGEX.test(c);
  }
  var DIGIT_REGEX = /^[0-9]$/;
  /**
   * Check if the given character is a whitespace character like space, tab, or
   * newline
   * @param {string} c
   * @return {boolean}
   */

  function isWhitespace(c) {
    return c === ' ' || c === '\t' || c === '\n' || c === '\r';
  }
  /**
   * Check if the given character is a special whitespace character, some
   * unicode variant
   * @param {string} c
   * @return {boolean}
   */

  function isSpecialWhitespace(c) {
    return c === "\xA0" || c >= "\u2000" && c <= "\u200A" || c === "\u202F" || c === "\u205F" || c === "\u3000";
  }
  /**
   * Replace speical whitespace characters with regular spaces
   * @param {string} text
   * @returns {string}
   */

  function normalizeWhitespace(text) {
    var normalized = '';

    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      normalized += isSpecialWhitespace(char) ? ' ' : char;
    }

    return normalized;
  }
  /**
   * Test whether the given character is a quote or double quote character.
   * Also tests for special variants of quotes.
   * @param {string} c
   * @returns {boolean}
   */

  function isQuote(c) {
    return SINGLE_QUOTES[c] === true || DOUBLE_QUOTES[c] === true;
  }
  /**
   * Test whether the given character is a single quote character.
   * Also tests for special variants of single quotes.
   * @param {string} c
   * @returns {boolean}
   */

  function isSingleQuote(c) {
    return SINGLE_QUOTES[c] === true;
  }
  /**
   * Test whether the given character is a double quote character.
   * Also tests for special variants of double quotes.
   * @param {string} c
   * @returns {boolean}
   */

  function isDoubleQuote(c) {
    return DOUBLE_QUOTES[c] === true;
  }
  /**
   * Normalize special double or single quote characters to their regular
   * variant ' or "
   * @param {string} c
   * @returns {string}
   */

  function normalizeQuote(c) {
    if (SINGLE_QUOTES[c] === true) {
      return '\'';
    }

    if (DOUBLE_QUOTES[c] === true) {
      return '"';
    }

    return c;
  }
  /**
   * Strip last occurrence of textToStrip from text
   * @param {string} text
   * @param {string} textToStrip
   * @returns {string}
   */

  function stripLastOccurrence(text, textToStrip) {
    var index = text.lastIndexOf(textToStrip);
    return index !== -1 ? text.substring(0, index) + text.substring(index + 1) : text;
  }
  /**
   * Insert textToInsert into text before the last whitespace in text
   * @param {string} text
   * @param {string} textToInsert
   * @returns {string}
   */

  function insertBeforeLastWhitespace(text, textToInsert) {
    var index = text.length;

    if (!isWhitespace(text[index - 1])) {
      // no trailing whitespaces
      return text + textToInsert;
    }

    while (isWhitespace(text[index - 1])) {
      index--;
    }

    return text.substring(0, index) + textToInsert + text.substring(index);
  }
  /**
   * Insert textToInsert at index in text
   * @param {string} text
   * @param {string} textToInsert
   * @param {number} index
   * @returns {string}
   */

  function insertAtIndex(text, textToInsert, index) {
    return text.substring(0, index) + textToInsert + text.substring(index);
  }

  var DELIMITER = 0;
  var NUMBER = 1;
  var STRING = 2;
  var SYMBOL = 3;
  var WHITESPACE = 4;
  var COMMENT = 5;
  var UNKNOWN = 6;
  /**
   * @typedef {DELIMITER | NUMBER | STRING | SYMBOL | WHITESPACE | COMMENT | UNKNOWN} TokenType
   */
  // map with all delimiters

  var DELIMITERS = {
    '': true,
    '{': true,
    '}': true,
    '[': true,
    ']': true,
    ':': true,
    ',': true,
    // for JSONP and MongoDB data type notation
    '(': true,
    ')': true,
    ';': true,
    // for string concatenation
    '+': true
  }; // map with all escape characters

  var ESCAPE_CHARACTERS = {
    '"': '"',
    '\\': '\\',
    '/': '/',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t' // \u is handled by getToken()

  }; // TODO: can we unify CONTROL_CHARACTERS and ESCAPE_CHARACTERS?

  var CONTROL_CHARACTERS = {
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t'
  };
  var SYMBOLS = {
    null: 'null',
    true: 'true',
    false: 'false'
  };
  var PYTHON_SYMBOLS = {
    None: 'null',
    True: 'true',
    False: 'false'
  };
  var input = ''; // current json text

  var output = ''; // generated output

  var index = 0; // current index in text

  var c = ''; // current token character in text

  var token = ''; // current token

  var tokenType = UNKNOWN; // type of current token

  /**
   * Repair a string containing an invalid JSON document.
   * For example changes JavaScript notation into JSON notation.
   *
   * Example:
   *
   *     jsonrepair('{name: \'John\'}") // '{"name": "John"}'
   *
   * @param {string} text
   * @return {string}
   */

  function jsonrepair(text) {
    // initialize
    input = text;
    output = '';
    index = 0;
    c = input.charAt(0);
    token = '';
    tokenType = UNKNOWN; // get first token

    processNextToken();
    var rootLevelTokenType = tokenType; // parse everything

    parseObject(); // ignore trailing comma

    skipComma();

    if (token === '') {
      // reached the end of the document properly
      return output;
    }

    if (rootLevelTokenType === tokenType && tokenIsStartOfValue()) {
      // start of a new value after end of the root level object: looks like
      // newline delimited JSON -> turn into a root level array
      var stashedOutput = '';

      while (rootLevelTokenType === tokenType && tokenIsStartOfValue()) {
        output = insertBeforeLastWhitespace(output, ',');
        stashedOutput += output;
        output = ''; // parse next newline delimited item

        parseObject(); // ignore trailing comma

        skipComma();
      } // wrap the output in an array


      return "[\n".concat(stashedOutput).concat(output, "\n]");
    }

    throw new JsonRepairError('Unexpected characters', index - token.length);
  }
  /**
   * Get the next character from the expression.
   * The character is stored into the char c. If the end of the expression is
   * reached, the function puts an empty string in c.
   */

  function next() {
    index++;
    c = input.charAt(index); // Note: not using input[index] because that returns undefined when index is out of range
  }
  /**
   * Special version of the function next, used to parse escaped strings
   */


  function nextSkipEscape() {
    next();

    if (c === '\\') {
      next();
    }
  }
  /**
   * check whether the current token is the start of a value:
   * object, array, number, string, or symbol
   * @returns {boolean}
   */


  function tokenIsStartOfValue() {
    return tokenType === DELIMITER && (token === '[' || token === '{') || tokenType === STRING || tokenType === NUMBER || tokenType === SYMBOL;
  }
  /**
   * check whether the current token is the start of a key (or possible key):
   * number, string, or symbol
   * @returns {boolean}
   */


  function tokenIsStartOfKey() {
    return tokenType === STRING || tokenType === NUMBER || tokenType === SYMBOL;
  }
  /**
   * Process the previous token, and get next token in the current text
   */


  function processNextToken() {
    output += token;
    tokenType = UNKNOWN;
    token = '';
    getTokenDelimiter();

    if (tokenType === WHITESPACE) {
      // we leave the whitespace as it is, except replacing special white
      // space character
      token = normalizeWhitespace(token);
      processNextToken();
    }

    if (tokenType === COMMENT) {
      // ignore comments
      tokenType = UNKNOWN;
      token = '';
      processNextToken();
    }
  }

  function skipComma() {
    if (token === ',') {
      token = '';
      tokenType = UNKNOWN;
      processNextToken();
    }
  } // check for delimiters like ':', '{', ']'


  function getTokenDelimiter() {
    if (DELIMITERS[c]) {
      tokenType = DELIMITER;
      token = c;
      next();
      return;
    }

    getTokenNumber();
  } // check for a number like "2.3e+5"


  function getTokenNumber() {
    if (isDigit(c) || c === '-') {
      tokenType = NUMBER;

      if (c === '-') {
        token += c;
        next();

        if (!isDigit(c)) {
          throw new JsonRepairError('Invalid number, digit expected', index);
        }
      } else if (c === '0') {
        token += c;
        next();
      } else ;

      while (isDigit(c)) {
        token += c;
        next();
      }

      if (c === '.') {
        token += c;
        next();

        if (!isDigit(c)) {
          throw new JsonRepairError('Invalid number, digit expected', index);
        }

        while (isDigit(c)) {
          token += c;
          next();
        }
      }

      if (c === 'e' || c === 'E') {
        token += c;
        next();

        if (c === '+' || c === '-') {
          token += c;
          next();
        }

        if (!isDigit(c)) {
          throw new JsonRepairError('Invalid number, digit expected', index);
        }

        while (isDigit(c)) {
          token += c;
          next();
        }
      }

      return;
    }

    getTokenEscapedString();
  } // get a token string like '\"hello world\"'


  function getTokenEscapedString() {
    if (c === '\\' && input.charAt(index + 1) === '"') {
      // an escaped piece of JSON
      next();
      getTokenString(nextSkipEscape);
    } else {
      getTokenString(next);
    }
  } // get a token string like '"hello world"'


  function getTokenString(getNext) {
    if (isQuote(c)) {
      var quote = normalizeQuote(c);
      var isEndQuote = isSingleQuote(c) ? isSingleQuote : isDoubleQuote;
      token += '"'; // output valid double quote

      tokenType = STRING;
      getNext(); // eslint-disable-next-line no-unmodified-loop-condition

      while (c !== '' && !isEndQuote(c)) {
        if (c === '\\') {
          // handle escape characters
          getNext();
          var unescaped = ESCAPE_CHARACTERS[c];

          if (unescaped !== undefined) {
            token += '\\' + c;
            getNext();
          } else if (c === 'u') {
            // parse escaped unicode character, like '\\u260E'
            token += "\\u";
            getNext();

            for (var u = 0; u < 4; u++) {
              if (!isHex(c)) {
                throw new JsonRepairError('Invalid unicode character', index - token.length);
              }

              token += c;
              getNext();
            }
          } else if (c === '\'') {
            // escaped single quote character -> remove the escape character
            token += '\'';
            getNext();
          } else {
            throw new JsonRepairError('Invalid escape character "\\' + c + '"', index);
          }
        } else if (CONTROL_CHARACTERS[c]) {
          // unescaped special character
          // fix by adding an escape character
          token += CONTROL_CHARACTERS[c];
          getNext();
        } else if (c === '"') {
          // unescaped double quote -> escape it
          token += '\\"';
          getNext();
        } else {
          // a regular character
          token += c;
          getNext();
        }
      }

      if (normalizeQuote(c) !== quote) {
        throw new JsonRepairError('End of string expected', index - token.length);
      }

      token += '"'; // output valid double quote

      getNext();
      return;
    }

    getTokenAlpha();
  } // check for symbols (true, false, null)


  function getTokenAlpha() {
    if (isAlpha(c)) {
      tokenType = SYMBOL;

      while (isAlpha(c) || isDigit(c) || c === '$') {
        token += c;
        next();
      }

      return;
    }

    getTokenWhitespace();
  } // get whitespaces: space, tab, newline, and carriage return


  function getTokenWhitespace() {
    if (isWhitespace(c) || isSpecialWhitespace(c)) {
      tokenType = WHITESPACE;

      while (isWhitespace(c) || isSpecialWhitespace(c)) {
        token += c;
        next();
      }

      return;
    }

    getTokenComment();
  }

  function getTokenComment() {
    // find a block comment '/* ... */'
    if (c === '/' && input[index + 1] === '*') {
      tokenType = COMMENT;

      while (c !== '' && (c !== '*' || c === '*' && input[index + 1] !== '/')) {
        token += c;
        next();
      }

      if (c === '*' && input[index + 1] === '/') {
        token += c;
        next();
        token += c;
        next();
      }

      return;
    } // find a comment '// ...'


    if (c === '/' && input[index + 1] === '/') {
      tokenType = COMMENT;

      while (c !== '' && c !== '\n') {
        token += c;
        next();
      }

      return;
    }

    getTokenUnknown();
  } // something unknown is found, wrong characters -> a syntax error


  function getTokenUnknown() {
    tokenType = UNKNOWN;

    while (c !== '') {
      token += c;
      next();
    }

    throw new JsonRepairError('Syntax error in part "' + token + '"', index - token.length);
  }
  /**
   * Parse an object like '{"key": "value"}'
   * @return {*}
   */


  function parseObject() {
    if (tokenType === DELIMITER && token === '{') {
      processNextToken(); // TODO: can we make this redundant?

      if (tokenType === DELIMITER && token === '}') {
        // empty object
        processNextToken();
        return;
      }

      while (true) {
        // parse key
        if (tokenType === SYMBOL || tokenType === NUMBER) {
          // unquoted key -> add quotes around it, change it into a string
          tokenType = STRING;
          token = "\"".concat(token, "\"");
        }

        if (tokenType !== STRING) {
          // TODO: handle ambiguous cases like '[{"a":1,{"b":2}]' which could be an array with two objects or one
          throw new JsonRepairError('Object key expected', index - token.length);
        }

        processNextToken(); // parse colon (key/value separator)

        if (tokenType === DELIMITER && token === ':') {
          processNextToken();
        } else {
          if (tokenIsStartOfValue()) {
            // we expect a colon here, but got the start of a value
            // -> insert a colon before any inserted whitespaces at the end of output
            output = insertBeforeLastWhitespace(output, ':');
          } else {
            throw new JsonRepairError('Colon expected', index - token.length);
          }
        } // parse value


        parseObject(); // parse comma (key/value pair separator)

        if (tokenType === DELIMITER && token === ',') {
          processNextToken();

          if (tokenType === DELIMITER && token === '}') {
            // we've just passed a trailing comma -> remove the trailing comma
            output = stripLastOccurrence(output, ',');
            break;
          }

          if (token === '') {
            // end of json reached, but missing }
            // Strip the missing comma (the closing bracket will be added later)
            output = stripLastOccurrence(output, ',');
            break;
          }
        } else {
          if (tokenIsStartOfKey()) {
            // we expect a comma here, but got the start of a new key
            // -> insert a comma before any inserted whitespaces at the end of output
            output = insertBeforeLastWhitespace(output, ',');
          } else {
            break;
          }
        }
      }

      if (tokenType === DELIMITER && token === '}') {
        processNextToken();
      } else {
        // missing end bracket -> insert the missing bracket
        output = insertBeforeLastWhitespace(output, '}');
      }

      return;
    }

    parseArray();
  }
  /**
   * Parse an object like '["item1", "item2", ...]'
   */


  function parseArray() {
    if (tokenType === DELIMITER && token === '[') {
      processNextToken();

      if (tokenType === DELIMITER && token === ']') {
        // empty array
        processNextToken();
        return;
      }

      while (true) {
        // parse item
        parseObject(); // parse comma (item separator)

        if (tokenType === DELIMITER && token === ',') {
          processNextToken();

          if (tokenType === DELIMITER && token === ']') {
            // we've just passed a trailing comma -> remove the trailing comma
            output = stripLastOccurrence(output, ',');
            break;
          }

          if (token === '') {
            // end of json reached, but missing ]
            // Strip the missing comma (the closing bracket will be added later)
            output = stripLastOccurrence(output, ',');
            break;
          }
        } else {
          if (tokenIsStartOfValue()) {
            // we expect a comma here, but got the start of a new item
            // -> insert a comma before any inserted whitespaces at the end of output
            output = insertBeforeLastWhitespace(output, ',');
          } else {
            break;
          }
        }
      }

      if (tokenType === DELIMITER && token === ']') {
        processNextToken();
      } else {
        // missing end bracket -> insert the missing bracket
        output = insertBeforeLastWhitespace(output, ']');
      }

      return;
    }

    parseString();
  }
  /**
   * Parse a string enclosed by double quotes "...". Can contain escaped quotes
   */


  function parseString() {
    if (tokenType === STRING) {
      processNextToken();

      while (tokenType === DELIMITER && token === '+') {
        // string concatenation like "hello" + "world"
        token = ''; // don't output the concatenation

        processNextToken();

        if (tokenType === STRING) {
          // concatenate with the previous string
          var endIndex = output.lastIndexOf('"');
          output = output.substring(0, endIndex) + token.substring(1);
          token = '';
          processNextToken();
        }
      }

      return;
    }

    parseNumber();
  }
  /**
   * Parse a number
   */


  function parseNumber() {
    if (tokenType === NUMBER) {
      processNextToken();
      return;
    }

    parseSymbol();
  }
  /**
   * Parse constants true, false, null
   */


  function parseSymbol() {
    if (tokenType === SYMBOL) {
      // a supported symbol: true, false, null
      if (SYMBOLS[token]) {
        processNextToken();
        return;
      } // for example replace None with null


      if (PYTHON_SYMBOLS[token]) {
        token = PYTHON_SYMBOLS[token];
        processNextToken();
        return;
      } // make a copy of the symbol, let's see what comes next


      var symbol = token;
      var symbolIndex = output.length;
      token = '';
      processNextToken(); // if (tokenType === DELIMITER && token === '(') {

      if (tokenType === DELIMITER && token === '(') {
        // a MongoDB function call or JSONP call
        // Can be a MongoDB data type like in {"_id": ObjectId("123")}
        // token = '' // do not output the function name
        // processNextToken()
        // next()
        token = ''; // do not output the ( character

        processNextToken(); // process the part inside the brackets

        parseObject(); // skip the closing bracket ")" and ");"

        if (tokenType === DELIMITER && token === ')') {
          token = ''; // do not output the ) character

          processNextToken();

          if (tokenType === DELIMITER && token === ';') {
            token = ''; // do not output the semicolon character

            processNextToken();
          }
        }

        return;
      } // unknown symbol => turn into in a string
      // it is possible that by reading the next token we already inserted
      // extra spaces in the output which should be inside the string,
      // hence the symbolIndex


      output = insertAtIndex(output, "\"".concat(symbol), symbolIndex);

      while (tokenType === SYMBOL || tokenType === NUMBER) {
        processNextToken();
      }

      output += '"';
      return;
    }

    parseEnd();
  }
  /**
   * Evaluated when the expression is not yet ended but expected to end
   */


  function parseEnd() {
    if (token === '') {
      // syntax error or unexpected end of expression
      throw new JsonRepairError('Unexpected end of json string', index - token.length);
    } else {
      throw new JsonRepairError('Value expected', index - token.length);
    }
  }

  function readLanguageFiles(src) {
    if (!isValidGlob__default["default"](src)) {
      throw new Error(`languageFiles isn't a valid glob pattern.`);
    }

    const targetFiles = glob__default["default"].sync(src);

    if (targetFiles.length === 0) {
      throw new Error('languageFiles glob has no files.');
    }

    return targetFiles.map(f => {
      const langPath = path__default["default"].resolve(process.cwd(), f);
      const currentFolder = langPath.substring(0, langPath.lastIndexOf("/"));
      const localeIndexFile = `${currentFolder}/index.ts`;
      const extension = langPath.substring(langPath.lastIndexOf('.')).toLowerCase();
      const isJSON = extension === '.json';
      const isTS = extension === '.ts';
      const isYAML = extension === '.yaml' || extension === '.yml';
      let langObj;

      if (isJSON) {
        langObj = JSON.parse(fs__default["default"].readFileSync(langPath, 'utf8'));
      } else if (isYAML) {
        langObj = yaml__default["default"].load(fs__default["default"].readFileSync(langPath, 'utf8'));
      } else if (isTS) {
        const content = fs__default["default"].readFileSync(langPath, 'utf8');
        const indexFile = fs__default["default"].readFileSync(localeIndexFile, 'utf8');
        const cleanContent = content.replace("export default", "").replace(/};/g, "}").replace(/} ;/g, "}").replace(/`/g, '"');
        const keyPrefixRegex = new RegExp(/"en", { (\w+):/g);
        const keyPrefix = keyPrefixRegex.exec(indexFile);

        if (keyPrefix && keyPrefix[1]) {
          langObj = JSON.parse(jsonrepair(cleanContent));
          langObj = {
            [keyPrefix[1]]: langObj
          };
        } else {
          throw new Error("Could not read key prefix from locale index file");
        }
      } else {
        langObj = eval(fs__default["default"].readFileSync(langPath, 'utf8'));
      }

      const fileName = f.replace(process.cwd(), '.');
      return {
        path: f,
        fileName,
        content: JSON.stringify(langObj)
      };
    });
  }
  function extractI18NLanguageFromLanguageFiles(languageFiles, dot = Dot__default["default"]) {
    return languageFiles.reduce((accumulator, file) => {
      const language = file.fileName.substring(file.fileName.lastIndexOf('/') + 1, file.fileName.lastIndexOf('.'));

      if (!accumulator[language]) {
        accumulator[language] = [];
      }

      const flattenedObject = dot.dot(JSON.parse(file.content));
      Object.keys(flattenedObject).forEach(key => {
        accumulator[language].push({
          path: key,
          file: file.fileName
        });
      });
      return accumulator;
    }, {});
  }
  function writeMissingToLanguageFiles(parsedLanguageFiles, missingKeys, dot = Dot__default["default"]) {
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
  function removeUnusedFromLanguageFiles(parsedLanguageFiles, unusedKeys, dot = Dot__default["default"]) {
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

  function writeLanguageFile(languageFile, newLanguageFileContent) {
    const fileExtension = languageFile.fileName.substring(languageFile.fileName.lastIndexOf('.') + 1);
    const filePath = languageFile.path;
    const nestedContent = Object.values(newLanguageFileContent)[0];
    const stringifiedContent = JSON.stringify(newLanguageFileContent, null, 2);

    if (fileExtension === 'json') {
      fs__default["default"].writeFileSync(filePath, stringifiedContent);
    } else if (fileExtension === 'js') {
      const jsFile = `module.exports = ${stringifiedContent}; \n`;
      fs__default["default"].writeFileSync(filePath, jsFile);
    } else if (fileExtension === 'yaml' || fileExtension === 'yml') {
      const yamlFile = yaml__default["default"].dump(newLanguageFileContent);
      fs__default["default"].writeFileSync(filePath, yamlFile);
    } else if (fileExtension === 'ts') {
      const nestedStringifiedContent = JSON.stringify(nestedContent, null, 2);
      console.log(`export default ${nestedStringifiedContent};`);
      const tsFile = `export default ${nestedStringifiedContent};`; // const tsFile = `export default {\n ${objectAsTypescriptString(nestedContent)} \n}; \n`;
      // console.log(objectAsTypescriptString(nestedContent))

      fs__default["default"].writeFileSync(filePath, tsFile);
    } else {
      throw new Error(`Language filetype of ${fileExtension} not supported.`);
    }
  } // This is a convenience function for users implementing in their own projects, and isn't used internally


  function parselanguageFiles(languageFiles, dot = Dot__default["default"]) {
    return extractI18NLanguageFromLanguageFiles(readLanguageFiles(languageFiles), dot);
  }

  function stripBounding(item) {
    return {
      path: item.path,
      file: item.file,
      line: item.line
    };
  }

  function mightBeDynamic(item) {
    return item.path.includes('${') && !!item.previousCharacter.match(/`/g) && !!item.nextCharacter.match(/`/g);
  } // Looping through the arays multiple times might not be the most effecient, but it's the easiest to read and debug. Which at this scale is an accepted trade-off.


  function extractI18NReport(vueItems, languageFiles) {
    const missingKeys = [];
    const unusedKeys = [];
    const maybeDynamicKeys = vueItems.filter(vueItem => mightBeDynamic(vueItem)).map(vueItem => stripBounding(vueItem));
    Object.keys(languageFiles).forEach(language => {
      const languageItems = languageFiles[language];
      const missingKeysInLanguage = vueItems.filter(vueItem => !mightBeDynamic(vueItem)).filter(vueItem => !languageItems.some(languageItem => vueItem.path === languageItem.path)).map(vueItem => _extends({}, stripBounding(vueItem), {
        language
      }));
      const unusedKeysInLanguage = languageItems.filter(languageItem => !vueItems.some(vueItem => languageItem.path === vueItem.path || languageItem.path.startsWith(vueItem.path + '.'))).map(languageItem => _extends({}, languageItem, {
        language
      }));
      missingKeys.push(...missingKeysInLanguage);
      unusedKeys.push(...unusedKeysInLanguage);
    });
    return {
      missingKeys,
      unusedKeys,
      maybeDynamicKeys
    };
  }
  async function writeReportToFile(report, writePath) {
    const reportString = JSON.stringify(report);
    return new Promise((resolve, reject) => {
      fs__default["default"].writeFile(writePath, reportString, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }

  async function createI18NReport(options) {
    const {
      vueFiles: vueFilesGlob,
      languageFiles: languageFilesGlob,
      output,
      add,
      remove,
      exclude = [],
      ci,
      separator
    } = options;
    if (!vueFilesGlob) throw new Error('Required configuration vueFiles is missing.');
    if (!languageFilesGlob) throw new Error('Required configuration languageFiles is missing.');
    const dot = typeof separator === 'string' ? new Dot__default["default"](separator) : Dot__default["default"];
    const vueFiles = readVueFiles(path__default["default"].resolve(process.cwd(), vueFilesGlob));
    const languageFiles = readLanguageFiles(path__default["default"].resolve(process.cwd(), languageFilesGlob));
    const I18NItems = extractI18NItemsFromVueFiles(vueFiles);
    const I18NLanguage = extractI18NLanguageFromLanguageFiles(languageFiles, dot);
    const report = extractI18NReport(I18NItems, I18NLanguage);
    report.unusedKeys = report.unusedKeys.filter(key => !exclude.filter(excluded => key.path.startsWith(excluded)).length);
    if (report.missingKeys.length) console.info('\nMissing Keys'), console.table(report.missingKeys);
    if (report.unusedKeys.length) console.info('\nUnused Keys'), console.table(report.unusedKeys);
    if (report.maybeDynamicKeys.length) console.warn('\nSuspected Dynamic Keys Found\nvue-i18n-extract does not compile Vue templates and therefore can not infer the correct key for the following keys.'), console.table(report.maybeDynamicKeys);

    if (output) {
      await writeReportToFile(report, path__default["default"].resolve(process.cwd(), output));
      console.info(`\nThe report has been has been saved to ${output}`);
    }

    if (remove && report.unusedKeys.length) {
      removeUnusedFromLanguageFiles(languageFiles, report.unusedKeys, dot);
      console.info('\nThe unused keys have been removed from your language files.');
    }

    if (add && report.missingKeys.length) {
      writeMissingToLanguageFiles(languageFiles, report.missingKeys, dot);
      console.info('\nThe missing keys have been added to your language files.');
    }

    if (ci && report.missingKeys.length) {
      throw new Error(`${report.missingKeys.length} missing keys found.`);
    }

    if (ci && report.unusedKeys.length) {
      throw new Error(`${report.unusedKeys.length} unused keys found.`);
    }

    return report;
  }

  process.on('uncaughtException', err => {
    console.error('[vue-i18n-extract]', err);
    process.exit(1);
  });
  process.on('unhandledRejection', err => {
    console.error('[vue-i18n-extract]', err);
    process.exit(1);
  });

  exports.createI18NReport = createI18NReport;
  exports.extractI18NItemsFromVueFiles = extractI18NItemsFromVueFiles;
  exports.extractI18NLanguageFromLanguageFiles = extractI18NLanguageFromLanguageFiles;
  exports.extractI18NReport = extractI18NReport;
  exports.initCommand = initCommand;
  exports.parseVueFiles = parseVueFiles;
  exports.parselanguageFiles = parselanguageFiles;
  exports.readLanguageFiles = readLanguageFiles;
  exports.readVueFiles = readVueFiles;
  exports.removeUnusedFromLanguageFiles = removeUnusedFromLanguageFiles;
  exports.resolveConfig = resolveConfig;
  exports.writeMissingToLanguageFiles = writeMissingToLanguageFiles;
  exports.writeReportToFile = writeReportToFile;

}));
//# sourceMappingURL=vue-i18n-extract.umd.js.map
