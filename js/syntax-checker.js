/**
 * Finds the first syntax error in JSON text and explains it in plain words.
 *
 * Browsers report JSON errors differently, and some give no position at all.
 * This small strict scanner gives every visitor the same precise message.
 * It only checks syntax; it does not build any data.
 */

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const LITERALS = ['true', 'false', 'null'];
const SIMPLE_ESCAPES = '"\\/bfnrt';
const UNICODE_ESCAPE_DIGITS = /^[0-9a-fA-F]{4}$/;
const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD_PATTERN = /[A-Za-z_]\w*/y;
const LETTER_PATTERN = /[A-Za-z_]/;
const BYTE_ORDER_MARK = 0xfeff;

class JsonSyntaxError extends Error {
  constructor(message, position) {
    super(message);
    this.position = position;
  }
}

const isDigit = (character) => character >= '0' && character <= '9';

/**
 * @param {string} text
 * @returns {{ position: number, message: string } | null} null when the syntax is valid
 */
export function findSyntaxError(text) {
  let position = text.charCodeAt(0) === BYTE_ORDER_MARK ? 1 : 0;

  const currentCharacter = () => text[position];

  const fail = (message, errorPosition = position) => {
    throw new JsonSyntaxError(message, errorPosition);
  };

  const describe = (character) => {
    if (character === undefined) return 'the end of the input';
    if (character === '\n') return 'a line break';
    return `"${character}"`;
  };

  const skipWhitespace = () => {
    while (WHITESPACE.has(currentCharacter())) position++;
  };

  function checkValue() {
    skipWhitespace();
    const character = currentCharacter();

    if (character === '{') return checkObject();
    if (character === '[') return checkArray();
    if (character === '"') return checkString();
    if (character === '-' || isDigit(character)) return checkNumber();

    const literal = LITERALS.find((word) => text.startsWith(word, position));
    if (literal) {
      position += literal.length;
      return;
    }
    failOnUnexpectedValue(character);
  }

  function failOnUnexpectedValue(character) {
    if (character === undefined) fail('The input ends where a value was expected.');
    if (character === "'") fail('Strings must use double quotes, not single quotes.');
    if (character === '/') fail('JSON does not allow comments.');
    if (LETTER_PATTERN.test(character)) {
      WORD_PATTERN.lastIndex = position;
      const word = WORD_PATTERN.exec(text)[0];
      fail(`Unexpected word "${word}". Text values need double quotes; literals are true, false and null (lowercase).`);
    }
    fail(`Expected a value but found ${describe(character)}.`);
  }

  function checkObject() {
    position++; // opening {
    skipWhitespace();
    if (currentCharacter() === '}') {
      position++;
      return;
    }

    for (;;) {
      checkKeyAndColon();
      checkValue();
      skipWhitespace();

      const character = currentCharacter();
      if (character === '}') {
        position++;
        return;
      }
      if (character === ',') {
        skipCommaBefore('}');
        continue;
      }
      if (character === undefined) fail('The input ends inside an object. A closing } is missing.');
      if (character === '"') fail('Missing comma between properties.');
      fail(`Expected a comma or } after the value but found ${describe(character)}.`);
    }
  }

  function checkKeyAndColon() {
    skipWhitespace();
    const character = currentCharacter();
    if (character === "'") fail('Keys must use double quotes, not single quotes.');
    if (character === undefined) fail('The input ends inside an object. A closing } is missing.');
    if (character !== '"') fail(`Expected a key in double quotes but found ${describe(character)}.`);

    checkString();
    skipWhitespace();
    if (currentCharacter() !== ':') fail(`Expected a colon after the key but found ${describe(currentCharacter())}.`);
    position++; // colon
  }

  function checkArray() {
    position++; // opening [
    skipWhitespace();
    if (currentCharacter() === ']') {
      position++;
      return;
    }

    for (;;) {
      checkValue();
      skipWhitespace();

      const character = currentCharacter();
      if (character === ']') {
        position++;
        return;
      }
      if (character === ',') {
        skipCommaBefore(']');
        continue;
      }
      if (character === undefined) fail('The input ends inside an array. A closing ] is missing.');
      fail(`Expected a comma or ] after the item but found ${describe(character)}.`);
    }
  }

  /** Moves past a comma and rejects a trailing comma right before the closing bracket. */
  function skipCommaBefore(closingBracket) {
    const commaPosition = position;
    position++;
    skipWhitespace();
    if (currentCharacter() === closingBracket) {
      fail(`Trailing comma: remove the comma before ${closingBracket}.`, commaPosition);
    }
  }

  function checkString() {
    const openingQuotePosition = position;
    position++; // opening quote

    while (position < text.length) {
      const character = currentCharacter();
      if (character === '"') {
        position++;
        return;
      }
      if (character === '\\') {
        checkEscapeSequence();
        continue;
      }
      if (character < ' ') {
        fail(character === '\n'
          ? 'Line break inside a string. Use \\n instead, or close the quote.'
          : 'Control character inside a string.');
      }
      position++;
    }
    fail('This string is never closed. A closing " is missing.', openingQuotePosition);
  }

  function checkEscapeSequence() {
    const escapedCharacter = text[position + 1];
    if (escapedCharacter !== undefined && SIMPLE_ESCAPES.includes(escapedCharacter)) {
      position += 2;
      return;
    }
    if (escapedCharacter === 'u' && UNICODE_ESCAPE_DIGITS.test(text.substr(position + 2, 4))) {
      position += 6;
      return;
    }
    fail('Invalid escape sequence. Allowed: \\" \\\\ \\/ \\b \\f \\n \\r \\t \\uXXXX.');
  }

  function checkNumber() {
    NUMBER_PATTERN.lastIndex = position;
    const match = NUMBER_PATTERN.exec(text);
    if (!match) fail('Invalid number.');

    position += match[0].length;
    if (currentCharacter() === '.' || isDigit(currentCharacter())) {
      fail('Invalid number. Leading zeros and trailing dots are not allowed.');
    }
  }

  try {
    checkValue();
    skipWhitespace();
    if (position < text.length) fail(`Extra content after the JSON value: ${describe(currentCharacter())}.`);
    return null;
  } catch (error) {
    if (error instanceof JsonSyntaxError) return { position: error.position, message: error.message };
    throw error;
  }
}

/** Converts a character position into a 1-based line and column. */
export function getLineAndColumn(text, position) {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(position, text.length);

  for (let index = 0; index < end; index++) {
    if (text[index] === '\n') {
      line++;
      lineStart = index + 1;
    }
  }
  return { line, column: position - lineStart + 1, lineStart };
}
