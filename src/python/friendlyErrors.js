// Turns Python errors into messages a brand-new programmer can act on.
//
// explainError(error, source) takes the error report from ams_runner.py and
// the student's code, and returns:
//   { headline, details, example, line }
// headline is the big "Oops!" sentence; details and example are optional.

const TYPE_NAMES = {
  str: "text (a string)",
  int: "a whole number (an int)",
  float: "a decimal number (a float)",
  bool: "True/False (a bool)",
  list: "a list",
  dict: "a dictionary",
  tuple: "a tuple",
  NoneType: "None (nothing)",
  function: "a function",
  builtin_function_or_method: "a function",
  range: "a range",
};

const CLOSERS = { "(": ")", "[": "]", "{": "}" };
const BRACKET_NAMES = {
  "(": "parenthesis (",
  ")": "parenthesis )",
  "[": "square bracket [",
  "]": "square bracket ]",
  "{": "curly bracket {",
  "}": "curly bracket }",
};

const BLOCK_STARTERS = /^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b/;

function typeName(t) {
  return TYPE_NAMES[t] || `a ${t}`;
}

function onLine(line) {
  return line ? ` on line ${line}` : "";
}

function lineText(source, line) {
  if (!line) return "";
  return source.split("\n")[line - 1] ?? "";
}

// Counts quote characters outside of the other kind of quote. Good enough to
// spot a missing quote on a single line.
function hasUnbalancedQuote(text) {
  let open = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "#" && !open) break;
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (!open) open = ch;
      else if (open === ch) open = null;
    }
  }
  return open !== null;
}

const KEYWORDS = ["if", "elif", "else", "for", "while", "def", "return", "import", "from", "print", "break", "continue", "class", "try", "except", "True", "False", "None", "and", "not", "in"];

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// "whille True:" -> while. Only checks the first word on the line.
function misspelledKeyword(text) {
  const word = (text.match(/^\s*([A-Za-z_]\w*)\s+\S/) || [])[1];
  if (!word || word.length < 3 || KEYWORDS.includes(word)) return null;
  for (const keyword of KEYWORDS) {
    if (keyword.length >= 3 && editDistance(word.toLowerCase(), keyword.toLowerCase()) <= (keyword.length > 4 ? 2 : 1)) {
      return { word, keyword };
    }
  }
  return null;
}

function explainSyntaxError(err, source) {
  const msg = err.message || "";
  const line = err.line;
  const text = err.text ?? lineText(source, line);
  const trimmed = text.trim();
  let m;

  if (err.type === "TabError" || /inconsistent use of tabs and spaces/.test(msg)) {
    return {
      headline: `Oops! Line ${line} mixes tabs and spaces for indenting.`,
      details: "Python wants every indent to be made the same way. Delete the spaces at the start of this line and indent it again with the Tab key.",
      line,
    };
  }

  if ((m = msg.match(/expected an indented block after (?:'(\w+)' statement|function definition|class definition)[^0-9]*on line (\d+)/))) {
    const after = Number(m[2]);
    const kind = m[1] ? `'${m[1]}'` : "def";
    return {
      headline: `Oops! The line after line ${after} needs to be indented.`,
      details: `Line ${after} starts a block (${kind}) and ends with a colon. The line under it must be pushed in with 4 spaces so Python knows it belongs inside.`,
      example: "if score > 10:\n    print(\"You win!\")",
      line: line || after + 1,
    };
  }

  if (/unexpected indent/.test(msg)) {
    return {
      headline: `Oops! Line ${line} is indented, but it shouldn't be.`,
      details: "Only lines inside an if, for, while, or def should be pushed in. Move this line back so it lines up with the line above it.",
      line,
    };
  }

  if (/unindent does not match any outer indentation level/.test(msg)) {
    return {
      headline: `Oops! The indenting on line ${line} doesn't line up.`,
      details: "This line needs to line up exactly with a line above it. Use 4 spaces for each level of indenting.",
      line,
    };
  }

  if (/unterminated triple-quoted string/.test(msg)) {
    return {
      headline: `Oops! The text that starts on line ${line} with """ never ends.`,
      details: 'Text that starts with three quotes (""") needs three quotes at the end too.',
      line,
    };
  }

  if (/unterminated string literal|EOL while scanning/.test(msg)) {
    return {
      headline: `Oops! Looks like you forgot a closing quote on line ${line}.`,
      details: "Text needs a quote at the start AND at the end. Make sure every \" or ' on this line has a partner.",
      example: 'print("Hello, world!")',
      line,
    };
  }

  if ((m = msg.match(/'([([{])' was never closed/))) {
    return {
      headline: `Oops! Looks like you forgot a closing ${CLOSERS[m[1]]} on line ${line}.`,
      details: `Every opening ${BRACKET_NAMES[m[1]]} needs a matching ${CLOSERS[m[1]]} to close it.`,
      line,
    };
  }

  if ((m = msg.match(/closing parenthesis '(.)' does not match opening parenthesis '(.)'/))) {
    return {
      headline: `Oops! The brackets on line ${line} don't match.`,
      details: `You opened with ${m[2]} but closed with ${m[1]}. A ${m[2]} must be closed with ${CLOSERS[m[2]]}.`,
      line,
    };
  }

  if ((m = msg.match(/unmatched '(.)'/))) {
    return {
      headline: `Oops! There's an extra ${m[1]} on line ${line}.`,
      details: `This ${BRACKET_NAMES[m[1]]} doesn't have an opening partner. Remove it, or add the missing opening bracket.`,
      line,
    };
  }

  if ((m = msg.match(/invalid character '(.)'/))) {
    if (/[“”‘’]/.test(m[1])) {
      return {
        headline: `Oops! Line ${line} has a curly quote (${m[1]}).`,
        details: "Python only understands straight quotes: \" or '. Delete the curly quote and type it again in the editor.",
        line,
      };
    }
    return {
      headline: `Oops! Line ${line} has a character Python doesn't understand: ${m[1]}`,
      details: "Delete that character and try again.",
      line,
    };
  }

  if (/Missing parentheses in call to 'print'/.test(msg)) {
    return {
      headline: `Oops! print needs parentheses on line ${line}.`,
      details: "Put what you want to print inside ( and ).",
      example: 'print("Hello")',
      line,
    };
  }

  if (/cannot assign to (function call|literal|expression)/.test(msg) && !/^\s*(if|elif|while)\b/.test(text)) {
    return {
      headline: `Oops! Line ${line} tries to store a value in something that isn't a variable.`,
      details: "The variable name goes on the LEFT of the = and the value goes on the right.",
      example: "score = 10",
      line,
    };
  }

  if (/Maybe you meant '==' or ':=' instead of '='|cannot assign to .* here\. Maybe you meant '=='/.test(msg)) {
    return {
      headline: `Oops! On line ${line}, it looks like you used = when you meant ==.`,
      details: "One = stores a value in a variable. Two == check whether two things are equal.",
      example: 'if answer == 42:\n    print("Correct!")',
      line,
    };
  }

  // Misspelled keyword, e.g. "whille" -> Python 3.14 says "Did you mean 'while'?"
  if ((m = msg.match(/Did you mean '([^']+)'\?/))) {
    return {
      headline: `Oops! Python doesn't understand line ${line}. Did you mean ${m[1]}?`,
      details: "Check the spelling of the words on this line.",
      line,
    };
  }

  const typo = misspelledKeyword(text);
  if (typo && /invalid syntax/.test(msg)) {
    return {
      headline: `Oops! Did you mean ${typo.keyword} on line ${line}?`,
      details: `Python doesn't know the word "${typo.word}". Check the spelling.`,
      line,
    };
  }

  if (/expected ':'/.test(msg) || (BLOCK_STARTERS.test(text) && !trimmed.endsWith(":") && /invalid syntax/.test(msg))) {
    return {
      headline: `Oops! Looks like you forgot a colon (:) at the end of line ${line}.`,
      details: "Lines that start with if, elif, else, for, while, or def need a : at the end.",
      example: "for i in range(5):\n    print(i)",
      line,
    };
  }

  if (/Perhaps you forgot a comma/.test(msg)) {
    return {
      headline: `Oops! Looks like you might be missing a comma on line ${line}.`,
      details: "When you put several things inside ( ) or [ ], separate them with commas.",
      example: 'print("Your score is", score)',
      line,
    };
  }

  if (/invalid decimal literal/.test(msg)) {
    return {
      headline: `Oops! Line ${line} has a number stuck to letters.`,
      details: "Variable names can't start with a number. If you meant to multiply, use * (for example 2 * x, not 2x).",
      line,
    };
  }

  if (/cannot assign to (function call|literal|expression)/.test(msg)) {
    return {
      headline: `Oops! Line ${line} tries to store a value in something that isn't a variable.`,
      details: "The variable name goes on the LEFT of the = and the value goes on the right.",
      example: "score = 10",
      line,
    };
  }

  if (/'return' outside function/.test(msg)) {
    return {
      headline: `Oops! return on line ${line} isn't inside a function.`,
      details: "return can only be used inside a def. Check that the line is indented under the function.",
      line,
    };
  }

  if (/'break' outside loop|'continue' (not properly in|outside) loop/.test(msg)) {
    return {
      headline: `Oops! Line ${line} uses break or continue outside of a loop.`,
      details: "break and continue only work inside a for or while loop. Check the indenting.",
      line,
    };
  }

  if (/incomplete input|unexpected EOF/.test(msg)) {
    return {
      headline: "Oops! Your code ends before something is finished.",
      details: "Python reached the end of your code while still waiting for something, like a closing ), ], or quote.",
      line,
    };
  }

  // Generic "invalid syntax": look at the line for common causes.
  if (hasUnbalancedQuote(text)) {
    return {
      headline: `Oops! Looks like you forgot a quote on line ${line}.`,
      details: "Text needs a quote at the start AND at the end.",
      line,
    };
  }
  if (/^\s*(if|elif|while)\b[^=!<>]*[^=!<>]=[^=]/.test(text)) {
    return {
      headline: `Oops! On line ${line}, it looks like you used = when you meant ==.`,
      details: "One = stores a value in a variable. Two == check whether two things are equal.",
      line,
    };
  }
  return {
    headline: `Oops! Python got confused by line ${line}.`,
    details: "Check this line (and the line just above it) for a missing quote, colon, bracket, or comma, or a misspelled word.",
    line,
  };
}

function explainRuntimeError(err, source) {
  const msg = err.message || "";
  const line = err.line;
  const at = onLine(line);
  const text = lineText(source, line);
  let m;

  switch (err.type) {
    case "NameError":
    case "UnboundLocalError": {
      const name = err.name || (msg.match(/'([^']+)'/) || [])[1] || "that name";
      if (err.type === "UnboundLocalError" || /referenced before assignment|cannot access local variable/.test(msg)) {
        return {
          headline: `Oops! ${name} is used${at} before it has a value.`,
          details: `Inside a function, give ${name} a value before you use it.`,
          line,
        };
      }
      if (err.suggestion) {
        return {
          headline: `Oops! Python doesn't know what ${name} means${at}. Did you mean ${err.suggestion}?`,
          details: "Python cares about spelling and capital letters.",
          line,
        };
      }
      const looksLikeWord = new RegExp(`print\\s*\\([^"']*\\b${name}\\b`).test(text);
      return {
        headline: `Oops! Python doesn't know what ${name} means${at}.`,
        details: looksLikeWord
          ? `If you meant the word "${name}" as text, put quotes around it. If it's a variable, give it a value first (for example ${name} = 5).`
          : `Check the spelling. If ${name} is a variable, make sure you give it a value (with =) before this line.`,
        example: looksLikeWord ? `print("${name}")` : undefined,
        line,
      };
    }

    case "TypeError": {
      if ((m = msg.match(/can only concatenate str \(not "(\w+)"\) to str/))) {
        return {
          headline: `Oops! On line ${line} you tried to join text and ${typeName(m[1])} with +.`,
          details: /input\(/.test(source)
            ? "+ can only join text to text, or add numbers to numbers. If you meant to do math with something from input(), wrap it in int() first. If you meant to join text, turn the number into text with str()."
            : "+ can only join text to text. Turn the number into text with str(), or use a comma in print instead.",
          example: /input\(/.test(source)
            ? 'age = int(input("How old are you? "))\nprint(age + 1)'
            : 'print("Your age is " + str(age))\nprint("Your age is", age)',
          line,
        };
      }
      if ((m = msg.match(/unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/))) {
        const [, op, a, b] = m;
        if (a === "str" || b === "str") {
          return {
            headline: `Oops! On line ${line} you tried to do math (${op}) with text.`,
            details: "Something here is text, not a number. If it came from input(), wrap it in int() to turn it into a number.",
            example: 'age = int(input("How old are you? "))',
            line,
          };
        }
        if (a === "NoneType" || b === "NoneType") {
          return {
            headline: `Oops! On line ${line} one of the values is None (nothing).`,
            details: "This often happens when a function doesn't return anything. Check that your function has a return line.",
            line,
          };
        }
        return {
          headline: `Oops! On line ${line} you can't use ${op} with ${typeName(a)} and ${typeName(b)}.`,
          line,
        };
      }
      if ((m = msg.match(/'([<>]=?)' not supported between instances of '(\w+)' and '(\w+)'/))) {
        return {
          headline: `Oops! On line ${line} you compared ${typeName(m[2])} with ${typeName(m[3])}.`,
          details: "Python can't tell if text is bigger or smaller than a number. If the value came from input(), wrap it in int().",
          example: 'guess = int(input("Guess a number: "))',
          line,
        };
      }
      if ((m = msg.match(/can't multiply sequence by non-int of type '(\w+)'/))) {
        return {
          headline: `Oops! On line ${line} you tried to multiply text.`,
          details: "One of these values is text, not a number. If it came from input(), wrap it in int() or float().",
          example: 'price = float(input("Price: "))',
          line,
        };
      }
      if ((m = msg.match(/'(\w+)' object is not callable/))) {
        return {
          headline: `Oops! On line ${line} you used ( ) after something that isn't a function.`,
          details: `It's ${typeName(m[1])}. Did you name a variable the same as a function (like print = ... or input = ...)? Or forget a * when multiplying, like 2(x + 1)?`,
          line,
        };
      }
      if ((m = msg.match(/^(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:were|was) given/))) {
        return {
          headline: `Oops! On line ${line}, ${m[1]}() got ${m[3]} value(s) but it needs ${m[2]}.`,
          details: "Check how many values you put inside the ( ) when calling the function.",
          line,
        };
      }
      if ((m = msg.match(/^(\w+)\(\) missing (\d+) required positional arguments?: (.+)/))) {
        return {
          headline: `Oops! On line ${line}, ${m[1]}() is missing ${m[2] === "1" ? "a value" : `${m[2]} values`}: ${m[3]}.`,
          details: "Put the missing value(s) inside the ( ) when you call the function.",
          line,
        };
      }
      if ((m = msg.match(/'(\w+)' object is not iterable/))) {
        return {
          headline: `Oops! On line ${line} you tried to loop over ${typeName(m[1])}.`,
          details: m[1] === "int" ? "To repeat something a number of times, use range()." : "You can loop over lists, strings, and range().",
          example: m[1] === "int" ? "for i in range(5):\n    print(i)" : undefined,
          line,
        };
      }
      if ((m = msg.match(/'(\w+)' object is not subscriptable/))) {
        return {
          headline: `Oops! On line ${line} you used [ ] on ${typeName(m[1])}.`,
          details: "Square brackets [ ] only work on things like lists, strings, and dictionaries.",
          line,
        };
      }
      if ((m = msg.match(/object of type '(\w+)' has no len\(\)/))) {
        return {
          headline: `Oops! On line ${line} you asked for the len() of ${typeName(m[1])}.`,
          details: "len() works on text, lists, and other collections, but not on numbers.",
          line,
        };
      }
      break;
    }

    case "ValueError": {
      if ((m = msg.match(/invalid literal for int\(\) with base 10: (.*)/))) {
        const got = m[1];
        if (got === "''") {
          return {
            headline: `Oops! On line ${line}, int() got nothing to turn into a number.`,
            details: "It looks like Enter was pressed without typing a number.",
            line,
          };
        }
        if (/^'\s*-?\d+\.\d*\s*'$/.test(got)) {
          return {
            headline: `Oops! On line ${line}, int() can't handle the decimal number ${got}.`,
            details: "int() only works with whole numbers. Use float() for decimals.",
            example: 'price = float(input("Price: "))',
            line,
          };
        }
        return {
          headline: `Oops! On line ${line}, int() couldn't turn ${got} into a number.`,
          details: "int() only works on text that looks like a whole number, like \"42\".",
          line,
        };
      }
      if ((m = msg.match(/could not convert string to float: (.*)/))) {
        return {
          headline: `Oops! On line ${line}, float() couldn't turn ${m[1]} into a number.`,
          details: "float() only works on text that looks like a number, like \"3.5\".",
          line,
        };
      }
      break;
    }

    case "ZeroDivisionError":
      return {
        headline: `Oops! On line ${line} your code tried to divide by zero.`,
        details: "Math doesn't allow dividing by 0. Check the number on the right side of the / (or // or %).",
        line,
      };

    case "IndexError":
      if (/out of range/.test(msg)) {
        const what = /string/.test(msg) ? "text" : "list";
        return {
          headline: `Oops! On line ${line} you asked for a position that isn't in the ${what}.`,
          details: `Positions start at 0, so a ${what} with 3 items has positions 0, 1, and 2. Check the number inside the [ ].`,
          line,
        };
      }
      break;

    case "KeyError":
      return {
        headline: `Oops! On line ${line} the dictionary doesn't have the key ${msg}.`,
        details: "Check the spelling (and capital letters) of the key, or add it to the dictionary first.",
        line,
      };

    case "AttributeError": {
      const kind = err.objType ? typeName(err.objType) : "this value";
      return {
        headline: err.suggestion
          ? `Oops! On line ${line}, ${kind} doesn't have .${err.name}. Did you mean .${err.suggestion}?`
          : `Oops! On line ${line}, ${kind} doesn't have .${err.name || "that"}.`,
        details: err.objType === "NoneType"
          ? "The value is None (nothing). This often means a function didn't return anything."
          : "Check the spelling of the word after the dot.",
        line,
      };
    }

    case "ModuleNotFoundError":
    case "ImportError": {
      const name = err.name || "";
      if (/^(turtle|tkinter|_tkinter)$/.test(name)) {
        return {
          headline: "Turtle drawing isn't available yet.",
          details: "It's coming in a later version. For now, try programs that print text.",
          line,
        };
      }
      return {
        headline: `Oops! Python can't find a module called ${name || "that"}${at}.`,
        details: "Check the spelling after import.",
        line,
      };
    }

    case "RecursionError":
      return {
        headline: `Oops! A function keeps calling itself forever${at}.`,
        details: "Make sure your function has a way to stop calling itself.",
        line,
      };

    case "OverflowError":
      return {
        headline: `Oops! A number got too big for Python to handle${at}.`,
        line,
      };

    case "MemoryError":
      return {
        headline: "Oops! Your program used up all the memory.",
        details: "Check for a loop that keeps adding to a list forever.",
        line,
      };
  }

  return {
    headline: `Oops! Something went wrong${at}.`,
    details: `Python says: ${err.type}${msg ? `: ${msg}` : ""}`,
    line,
  };
}

export function explainError(err, source = "") {
  const isSyntax = ["SyntaxError", "IndentationError", "TabError"].includes(err.type);
  const explanation = isSyntax ? explainSyntaxError(err, source) : explainRuntimeError(err, source);
  return { ...explanation, line: explanation.line || err.line || null };
}
