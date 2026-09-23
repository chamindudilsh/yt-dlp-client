const fs = require("fs");
const code = fs.readFileSync("src-tauri/src/main.rs", "utf8");

let inLineComment = false;
let inBlockComment = 0;
let inString = false;
let inChar = false;
let escape = false;

const stack = [];
let line = 1;
let col = 0;

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const next = code[i + 1];
  col++;

  if (c === "\n") {
    line++;
    col = 0;
    inLineComment = false;
    continue;
  }

  if (inLineComment) continue;

  if (inBlockComment > 0) {
    if (c === "*" && next === "/") {
      inBlockComment--;
      i++;
      col++;
    } else if (c === "/" && next === "*") {
      inBlockComment++;
      i++;
      col++;
    }
    continue;
  }

  if (inString) {
    if (escape) {
      escape = false;
    } else if (c === "\\") {
      escape = true;
    } else if (c === '"') {
      inString = false;
    }
    continue;
  }

  if (inChar) {
    if (escape) {
      escape = false;
    } else if (c === "\\") {
      escape = true;
    } else if (c === "'") {
      inChar = false;
    }
    continue;
  }

  // Not in comment/string/char
  if (c === "/" && next === "/") {
    inLineComment = true;
    i++;
    col++;
    continue;
  }
  if (c === "/" && next === "*") {
    inBlockComment = 1;
    i++;
    col++;
    continue;
  }

  if (c === '"') {
    inString = true;
    escape = false;
    continue;
  }

  // Simple char check (e.g. '\'')
  if (c === "'") {
    // Check if it looks like a lifetime e.g. 'a, '_, 'static
    if (next && /[a-zA-Z_]/.test(next) && code[i + 2] !== "'") {
      continue;
    }
    inChar = true;
    escape = false;
    continue;
  }

  if (c === "{" || c === "(" || c === "[") {
    stack.push({ char: c, line, col, idx: i });
  } else if (c === "}" || c === ")" || c === "]") {
    if (stack.length === 0) {
      console.log(`EXTRA CLOSING ${c} at line ${line}:${col}`);
      continue;
    }
    const last = stack.pop();
    const expected = last.char === "{" ? "}" : (last.char === "(" ? ")" : "]");
    if (c !== expected) {
      console.log(`MISMATCH at line ${line}:${col} - found ${c}, expected ${expected} for ${last.char} opened at line ${last.line}:${last.col}`);
      break;
    }
  }
}

if (stack.length > 0) {
  console.log(`UNCLOSED DELIMITERS: ${stack.length}`);
  for (const s of stack.slice(-10)) {
    console.log(`  ${s.char} opened at line ${s.line}:${s.col}`);
  }
} else {
  console.log("All delimiters balanced!");
}
