import React from 'react';

interface MathRendererProps {
  content: string;
  formula_latex?: string;
  className?: string;
  isBlock?: boolean;
}

// Repairs common LaTeX commands that were corrupted by JSON.parse treating single backslashes as escape sequences.
function repairCorruptedLatex(str: string): string {
  if (!str) return str;
  let s = str;
  // \f (form feed) -> \f (restores \frac, \footnotesize)
  s = s.replace(/\x0C/g, '\\f');
  // \b (backspace) -> \b (restores \begin, \bar, \beta, \bf)
  s = s.replace(/\x08/g, '\\b');
  // \v (vertical tab) -> \v (restores \vec, \vert)
  s = s.replace(/\x0B/g, '\\v');
  // \t (tab) followed by specific latex endings
  s = s.replace(/\x09imes/g, '\\times');
  s = s.replace(/\x09ext/g, '\\text');
  s = s.replace(/\x09heta/g, '\\theta');
  s = s.replace(/\x09riangle/g, '\\triangle');
  s = s.replace(/\x09o/g, '\\to');
  // \n (newline) followed by specific latex endings
  s = s.replace(/\x0Aabla/g, '\\nabla');
  s = s.replace(/\x0Aeq/g, '\\neq');
  s = s.replace(/\x0Aotin/g, '\\notin');
  s = s.replace(/\x0Au/g, '\\nu');
  s = s.replace(/\x0Aormalsize/g, '\\normalsize');
  // \r (carriage return) followed by specific latex endings
  s = s.replace(/\x0Dight/g, '\\right');
  s = s.replace(/\x0Dho/g, '\\rho');
  s = s.replace(/\x0Dangle/g, '\\rangle');
  s = s.replace(/\x0Dightarrow/g, '\\rightarrow');
  return s;
}

// Token definition for parser
interface Token {
  type: 'command' | 'superscript' | 'subscript' | 'open_brace' | 'close_brace' | 'open_bracket' | 'close_bracket' | 'text';
  value: string;
}

function tokenize(str: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    if (char === '\\') {
      let cmd = '';
      i++; // skip backslash
      while (i < str.length && /[a-zA-Z]/.test(str[i])) {
        cmd += str[i];
        i++;
      }
      if (cmd === '') {
        if (i < str.length) {
          const esc = str[i];
          if (esc === '{' || esc === '}' || esc === '$' || esc === '%' || esc === '&' || esc === '_') {
            tokens.push({ type: 'text', value: esc });
          } else {
            tokens.push({ type: 'text', value: '\\' + esc });
          }
          i++;
        } else {
          tokens.push({ type: 'text', value: '\\' });
        }
      } else {
        tokens.push({ type: 'command', value: cmd });
      }
    } else if (char === '^') {
      tokens.push({ type: 'superscript', value: '^' });
      i++;
    } else if (char === '_') {
      tokens.push({ type: 'subscript', value: '_' });
      i++;
    } else if (char === '{') {
      tokens.push({ type: 'open_brace', value: '{' });
      i++;
    } else if (char === '}') {
      tokens.push({ type: 'close_brace', value: '}' });
      i++;
    } else if (char === '[') {
      tokens.push({ type: 'open_bracket', value: '[' });
      i++;
    } else if (char === ']') {
      tokens.push({ type: 'close_bracket', value: ']' });
      i++;
    } else {
      let text = '';
      while (
        i < str.length &&
        str[i] !== '\\' &&
        str[i] !== '^' &&
        str[i] !== '_' &&
        str[i] !== '{' &&
        str[i] !== '}' &&
        str[i] !== '[' &&
        str[i] !== ']'
      ) {
        text += str[i];
        i++;
      }
      tokens.push({ type: 'text', value: text });
    }
  }
  return tokens;
}

type ASTNode =
  | { type: 'text'; value: string }
  | { type: 'symbol'; symbol: string }
  | { type: 'fraction'; numerator: ASTNode[]; denominator: ASTNode[] }
  | { type: 'root'; index?: ASTNode[]; content: ASTNode[] }
  | { type: 'superscript'; content: ASTNode[] }
  | { type: 'subscript'; content: ASTNode[] }
  | { type: 'group'; content: ASTNode[] }
  | { type: 'styled'; style: 'bold' | 'italic' | 'text' | 'overline'; content: ASTNode[] };

function mapCommandToSymbol(cmd: string): string {
  const map: Record<string, string> = {
    times: ' × ',
    div: ' ÷ ',
    le: ' ≤ ',
    leq: ' ≤ ',
    leqslant: ' ≤ ',
    ge: ' ≥ ',
    geq: ' ≥ ',
    geqslant: ' ≥ ',
    neq: ' ≠ ',
    ne: ' ≠ ',
    approx: ' ≈ ',
    pm: ' ± ',
    infty: ' ∞ ',
    angle: '∠',
    triangle: '△',
    Delta: 'Δ',
    pi: 'π',
    theta: 'θ',
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    sigma: 'σ',
    omega: 'ω',
    lambda: 'λ',
    phi: 'φ',
    degree: '°',
    circ: '°',
    parallel: ' ∥ ',
    perp: ' ⊥ ',
    cong: ' ≅ ',
    sim: ' ~ ',
    therefore: ' ∴ ',
    because: ' ∵ ',
    cdot: ' · ',
    to: ' → ',
    rightarrow: ' → ',
    leftarrow: ' ← ',
    leftrightarrow: ' ↔ ',
    sum: ' ∑ ',
    prod: ' ∏ ',
    int: ' ∫ ',
    partial: ' ∂ ',
    nabla: ' ∇ ',
    dots: '…',
    ldots: '…',
    sin: 'sin',
    cos: 'cos',
    tan: 'tan',
    cosec: 'cosec',
    sec: 'sec',
    cot: 'cot',
    log: 'log',
    ln: 'ln',
  };
  return map[cmd] || `\\${cmd}`;
}

class TokenParser {
  private tokens: Token[];
  private index: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | null {
    return this.index < this.tokens.length ? this.tokens[this.index] : null;
  }

  private next(): Token | null {
    if (this.index >= this.tokens.length) return null;
    return this.tokens[this.index++];
  }

  public parseNodes(stopAtCloseBrace: boolean = false): ASTNode[] {
    const nodes: ASTNode[] = [];
    while (this.index < this.tokens.length) {
      const tok = this.peek();
      if (!tok) break;

      if (tok.type === 'close_brace' && stopAtCloseBrace) {
        break;
      }

      this.next(); // consume

      if (tok.type === 'text') {
        nodes.push({ type: 'text', value: tok.value });
      } else if (tok.type === 'open_brace') {
        const groupNodes = this.parseNodes(true);
        if (this.peek()?.type === 'close_brace') {
          this.next(); // consume '}'
        }
        nodes.push({ type: 'group', content: groupNodes });
      } else if (tok.type === 'superscript') {
        const content = this.parseSingleOrGroup();
        nodes.push({ type: 'superscript', content });
      } else if (tok.type === 'subscript') {
        const content = this.parseSingleOrGroup();
        nodes.push({ type: 'subscript', content });
      } else if (tok.type === 'command') {
        const cmd = tok.value;
        if (cmd === 'frac' || cmd === 'dfrac') {
          const num = this.parseSingleOrGroup();
          const den = this.parseSingleOrGroup();
          nodes.push({ type: 'fraction', numerator: num, denominator: den });
        } else if (cmd === 'sqrt') {
          let index: ASTNode[] | undefined;
          if (this.peek()?.type === 'open_bracket') {
            this.next(); // consume '['
            index = this.parseBracketNodes();
            if (this.peek()?.type === 'close_bracket') {
              this.next(); // consume ']'
            }
          }
          const content = this.parseSingleOrGroup();
          nodes.push({ type: 'root', index, content });
        } else if (cmd === 'text' || cmd === 'mathrm') {
          const content = this.parseSingleOrGroup();
          nodes.push({ type: 'styled', style: 'text', content });
        } else if (cmd === 'mathbf') {
          const content = this.parseSingleOrGroup();
          nodes.push({ type: 'styled', style: 'bold', content });
        } else if (cmd === 'mathit') {
          const content = this.parseSingleOrGroup();
          nodes.push({ type: 'styled', style: 'italic', content });
        } else if (cmd === 'bar') {
          const content = this.parseSingleOrGroup();
          nodes.push({ type: 'styled', style: 'overline', content });
        } else if (cmd === 'left' || cmd === 'right') {
          const nextTok = this.peek();
          if (
            nextTok &&
            (nextTok.type === 'text' ||
              nextTok.type === 'open_brace' ||
              nextTok.type === 'close_brace' ||
              nextTok.type === 'open_bracket' ||
              nextTok.type === 'close_bracket')
          ) {
            this.next();
            nodes.push({ type: 'text', value: nextTok.value });
          }
        } else {
          const mapped = mapCommandToSymbol(cmd);
          nodes.push({ type: 'symbol', symbol: mapped });
        }
      } else {
        nodes.push({ type: 'text', value: tok.value });
      }
    }
    return nodes;
  }

  private parseSingleOrGroup(): ASTNode[] {
    const nextTok = this.peek();
    if (!nextTok) return [];

    if (nextTok.type === 'open_brace') {
      this.next(); // consume '{'
      const nodes = this.parseNodes(true);
      if (this.peek()?.type === 'close_brace') {
        this.next(); // consume '}'
      }
      return nodes;
    }

    this.next();
    if (nextTok.type === 'text') {
      return [{ type: 'text', value: nextTok.value }];
    } else if (nextTok.type === 'command') {
      return [{ type: 'symbol', symbol: mapCommandToSymbol(nextTok.value) }];
    } else {
      return [{ type: 'text', value: nextTok.value }];
    }
  }

  private parseBracketNodes(): ASTNode[] {
    const nodes: ASTNode[] = [];
    while (this.index < this.tokens.length) {
      const tok = this.peek();
      if (!tok || tok.type === 'close_bracket') {
        break;
      }
      this.next();
      if (tok.type === 'text') {
        nodes.push({ type: 'text', value: tok.value });
      } else if (tok.type === 'command') {
        nodes.push({ type: 'symbol', symbol: mapCommandToSymbol(tok.value) });
      } else {
        nodes.push({ type: 'text', value: tok.value });
      }
    }
    return nodes;
  }
}

function toSuperscript(str: string): string {
  const sups: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
    'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
    'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
    'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴲ', 'L': 'ᴸ',
    'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ', 'T': 'ᵀ', 'U': 'ᵁ', 'W': 'ᵂ'
  };
  return str.split('').map(c => sups[c] || c).join('');
}

function toSubscript(str: string): string {
  const subs: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
    'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
  };
  return str.split('').map(c => subs[c] || c).join('');
}

function renderPlainWithSymbols(text: string): React.ReactNode {
  if (!text) return '';

  let s = text;
  s = s.replace(/\\times/g, '×');
  s = s.replace(/\\div/g, '÷');
  s = s.replace(/\\le(q)?/g, '≤');
  s = s.replace(/\\ge(q)?/g, '≥');
  s = s.replace(/\\neq/g, '≠');
  s = s.replace(/\\approx/g, '≈');
  s = s.replace(/\\pm/g, '±');
  s = s.replace(/\\infty/g, '∞');
  s = s.replace(/\\angle/g, '∠');
  s = s.replace(/\\triangle/g, '△');
  s = s.replace(/\\Delta/g, 'Δ');
  s = s.replace(/\\pi/g, 'π');
  s = s.replace(/\\theta/g, 'θ');
  s = s.replace(/\\alpha/g, 'α');
  s = s.replace(/\\beta/g, 'β');
  s = s.replace(/\\gamma/g, 'γ');
  s = s.replace(/\\sigma/g, 'σ');
  s = s.replace(/\\omega/g, 'ω');
  s = s.replace(/\\lambda/g, 'λ');
  s = s.replace(/\\phi/g, 'φ');
  s = s.replace(/\\parallel/g, '∥');
  s = s.replace(/\\perp/g, '⊥');
  s = s.replace(/\\cong/g, '≅');
  s = s.replace(/\\sim/g, '~');
  s = s.replace(/\\therefore/g, '∴');
  s = s.replace(/\\because/g, '∵');
  s = s.replace(/\\cdot/g, '·');
  s = s.replace(/\\dots/g, '…');
  s = s.replace(/\\slug/g, ''); // strip typical template slug if any
  s = s.replace(/\\ldots/g, '…');
  s = s.replace(/\\%/g, '%');
  s = s.replace(/\\\$/g, '$');
  s = s.replace(/\^\\circ/g, '°');
  s = s.replace(/\^\x0Cc/g, '°');
  s = s.replace(/\\\^\\circ/g, '°');
  s = s.replace(/\^o\b/g, '°');

  // Convert standard ^2, ^3 to real superscript unicode if it's not handled
  // e.g., x^{2} or x^2
  s = s.replace(/\^\{([^}]+)\}/g, (_, g) => toSuperscript(g));
  s = s.replace(/\^([0-9a-zA-Z+-=()]+)/g, (_, g) => toSuperscript(g));

  // Same for subscripts: x_{n} or x_n
  s = s.replace(/_\{([^}]+)\}/g, (_, g) => toSubscript(g));
  s = s.replace(/_([0-9aeh-nops-vx+-=()]+)/g, (_, g) => toSubscript(g));

  // Regex to format fractions like 3/4 or 5/8 in stacked layout
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const fractionRegex = /\b(\d+)\/(\d+)\b/g;
  let match;

  while ((match = fractionRegex.exec(s)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(<span key={`text-sub-${lastIndex}`}>{s.substring(lastIndex, matchIndex)}</span>);
    }

    const num = match[1];
    const den = match[2];

    parts.push(
      <span
        key={`frac-sub-${matchIndex}`}
        className="inline-flex flex-col align-middle text-center leading-none mx-1 text-[0.85em] select-all"
      >
        <span className="pb-[1.5px] border-b border-slate-700 font-semibold px-0.5">{num}</span>
        <span className="pt-[1.5px] font-semibold px-0.5">{den}</span>
      </span>
    );

    lastIndex = fractionRegex.lastIndex;
  }

  if (lastIndex < s.length) {
    parts.push(<span key={`text-sub-${lastIndex}`}>{s.substring(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function renderTextWithBold(textStr: string): React.ReactNode {
  const parts = textStr.split('**');
  return (
    <>
      {parts.map((part, idx) => {
        if (idx % 2 === 1) {
          return (
            <strong key={idx} className="font-bold text-slate-900">
              {renderPlainWithSymbols(part)}
            </strong>
          );
        }
        return <span key={idx}>{renderPlainWithSymbols(part)}</span>;
      })}
    </>
  );
}

function renderASTNodes(nodes: ASTNode[]): React.ReactNode {
  return (
    <>
      {nodes.map((node, idx) => {
        switch (node.type) {
          case 'text': {
            let val = node.value;
            val = val.replace(/\*/g, ' × ');
            val = val.replace(/<=/g, ' ≤ ');
            val = val.replace(/>=/g, ' ≥ ');
            val = val.replace(/!=/g, ' ≠ ');
            val = val.replace(/==/g, ' = ');
            return <span key={idx}>{val}</span>;
          }
          case 'symbol': {
            let sym = node.symbol;
            if (sym === '\\circ' || sym === '°' || sym === '\\circ') {
              return <span key={idx}>°</span>;
            }
            return (
              <span key={idx} className="font-semibold text-slate-800">
                {sym}
              </span>
            );
          }
          case 'fraction': {
            return (
              <span
                key={idx}
                className="inline-flex flex-col align-middle text-center leading-none mx-1 text-[0.85em] select-all"
              >
                <span className="pb-[1.5px] border-b border-slate-700 font-semibold px-0.5">
                  {renderASTNodes(node.numerator)}
                </span>
                <span className="pt-[1.5px] font-semibold px-0.5">
                  {renderASTNodes(node.denominator)}
                </span>
              </span>
            );
          }
          case 'root': {
            const hasIndex = node.index && node.index.length > 0;
            return (
              <span key={idx} className="inline-flex items-center mx-0.5 select-all">
                {hasIndex ? (
                  <sup className="text-[0.65em] mr-[-2px] font-bold leading-none align-super">
                    {renderASTNodes(node.index!)}
                  </sup>
                ) : null}
                <span className="font-sans leading-none text-[1.15em] text-slate-800 font-bold mr-[-1px]">
                  {hasIndex && node.index![0].type === 'text' && node.index![0].value === '3' ? '∛' : '√'}
                </span>
                <span className="border-t-2 border-slate-700 pt-[1.5px] leading-tight px-1 font-semibold bg-slate-50/50 rounded-tr-sm">
                  {renderASTNodes(node.content)}
                </span>
              </span>
            );
          }
          case 'superscript': {
            const isCirc =
              node.content.length === 1 &&
              ((node.content[0].type === 'symbol' &&
                (node.content[0].symbol === '°' || node.content[0].symbol === '\\circ')) ||
                (node.content[0].type === 'text' &&
                  (node.content[0].value === 'o' || node.content[0].value === '°')));
            if (isCirc) {
              return <span key={idx}>°</span>;
            }
            return (
              <sup key={idx} className="text-[0.75em] leading-none align-super font-semibold">
                {renderASTNodes(node.content)}
              </sup>
            );
          }
          case 'subscript': {
            return (
              <sub key={idx} className="text-[0.75em] leading-none align-sub font-semibold">
                {renderASTNodes(node.content)}
              </sub>
            );
          }
          case 'group': {
            return <span key={idx}>{renderASTNodes(node.content)}</span>;
          }
          case 'styled': {
            if (node.style === 'bold') {
              return (
                <strong key={idx} className="font-bold">
                  {renderASTNodes(node.content)}
                </strong>
              );
            } else if (node.style === 'italic') {
              return (
                <em key={idx} className="italic">
                  {renderASTNodes(node.content)}
                </em>
              );
            } else if (node.style === 'overline') {
              return (
                <span key={idx} className="overline">
                  {renderASTNodes(node.content)}
                </span>
              );
            } else {
              return (
                <span key={idx} className="font-normal">
                  {renderASTNodes(node.content)}
                </span>
              );
            }
          }
          default:
            return null;
        }
      })}
    </>
  );
}

function parseMixedContent(text: string): React.ReactNode[] {
  if (!text) return [];

  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  const cleanText = repairCorruptedLatex(text);

  while (currentIndex < cleanText.length) {
    const doubleDollarIndex = cleanText.indexOf('$$', currentIndex);
    const singleDollarIndex = cleanText.indexOf('$', currentIndex);

    let foundIndex = -1;
    let isBlock = false;

    if (doubleDollarIndex !== -1 && (singleDollarIndex === -1 || doubleDollarIndex <= singleDollarIndex)) {
      foundIndex = doubleDollarIndex;
      isBlock = true;
    } else if (singleDollarIndex !== -1) {
      foundIndex = singleDollarIndex;
      isBlock = false;
    }

    if (foundIndex === -1) {
      const remaining = cleanText.substring(currentIndex);
      if (remaining) {
        parts.push(<React.Fragment key={`text-${currentIndex}`}>{renderTextWithBold(remaining)}</React.Fragment>);
      }
      break;
    }

    if (foundIndex > currentIndex) {
      const plain = cleanText.substring(currentIndex, foundIndex);
      parts.push(<React.Fragment key={`text-${currentIndex}`}>{renderTextWithBold(plain)}</React.Fragment>);
    }

    const delimiter = isBlock ? '$$' : '$';
    const startIndex = foundIndex + delimiter.length;
    const endIndex = cleanText.indexOf(delimiter, startIndex);

    if (endIndex === -1) {
      const remaining = cleanText.substring(foundIndex);
      parts.push(<React.Fragment key={`text-${foundIndex}`}>{renderTextWithBold(remaining)}</React.Fragment>);
      break;
    }

    const mathFormula = cleanText.substring(startIndex, endIndex);
    const tokens = tokenize(mathFormula);
    const parser = new TokenParser(tokens);
    const ast = parser.parseNodes();
    const parsedMath = renderASTNodes(ast);

    if (isBlock) {
      parts.push(
        <div
          key={`math-${foundIndex}`}
          className="my-3 py-2 bg-slate-50/50 rounded-xl px-4 border border-slate-100 overflow-x-auto text-center select-all"
        >
          <span className="font-sans text-base text-slate-800 font-semibold leading-relaxed">
            {parsedMath}
          </span>
        </div>
      );
    } else {
      parts.push(
        <span
          key={`math-${foundIndex}`}
          className="inline-block mx-0.5 font-sans text-slate-800 font-semibold leading-relaxed select-all"
        >
          {parsedMath}
        </span>
      );
    }

    currentIndex = endIndex + delimiter.length;
  }

  return parts;
}

export default function MathRenderer({
  content,
  formula_latex,
  className = '',
  isBlock = false,
}: MathRendererProps) {
  const repairedContent = React.useMemo(() => repairCorruptedLatex(content || ''), [content]);
  const repairedFormula = React.useMemo(() => repairCorruptedLatex(formula_latex || ''), [formula_latex]);

  const targetContent = React.useMemo(() => {
    if (repairedFormula && repairedFormula.trim()) {
      return isBlock ? `$$${repairedFormula}$$` : `$${repairedFormula}$`;
    }
    return repairedContent;
  }, [repairedContent, repairedFormula, isBlock]);

  if (!targetContent) return null;

  const paragraphs = targetContent.split('\n');

  return (
    <div className={`textbook-math ${className}`}>
      {paragraphs.map((para, idx) => {
        if (!para.trim()) {
          return <div key={idx} className="h-2" />;
        }
        return (
          <p key={idx} className="leading-relaxed my-1">
            {parseMixedContent(para)}
          </p>
        );
      })}
    </div>
  );
}
