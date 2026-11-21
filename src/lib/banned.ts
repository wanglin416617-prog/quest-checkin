import list from "@/content/banned-words.json";

export interface BanScan {
  blocks: string[];
  warns: string[];
}

const NOISE = /[\s·.。,，、！!？?~～"'“”‘’（）()[\]【】\-—_]/g;

function normalize(text: string): string {
  return text.replace(NOISE, "");
}

function stripped(text: string, contexts: readonly string[]): string {
  let value = normalize(text);
  const sorted = [...contexts].sort((a, b) => b.length - a.length);
  for (const context of sorted) {
    const token = normalize(context);
    if (token) value = value.split(token).join("");
  }
  return value;
}

const allow = list.allowContext as Record<string, string[]>;

/** block 阻止保存；warn 只提醒。匹配前去掉空格和常见符号，允许上下文整段豁免。 */
export function scanBanned(text: string): BanScan {
  const blocks = list.block.filter((word) =>
    stripped(text, allow[word] ?? []).includes(normalize(word)),
  );
  const warns = list.warn.filter((word) =>
    stripped(text, allow[word] ?? []).includes(normalize(word)),
  );
  return { blocks, warns };
}
