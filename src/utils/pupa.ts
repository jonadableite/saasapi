/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
/* eslint-disable prettier/prettier */

import { getHours } from "date-fns";

interface TransformOptions {
  value: any;
  key: string;
}

interface PupaOptions {
  ignoreMissing?: boolean;
  transform?: (options: TransformOptions) => any;
}

const _htmlEscape = (string: string): string =>
  string
    .replace(/&/g, "&amp;") // Must happen first or else it will escape other just-escaped characters.
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const _htmlUnescape = (htmlString: string): string =>
  htmlString
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&"); // Must happen last or else it will unescape other characters in the wrong order.

interface HtmlEscapeOptions {
  strings: TemplateStringsArray | string;
  values: any[];
}

export function htmlEscape(
  strings: HtmlEscapeOptions["strings"],
  ...values: HtmlEscapeOptions["values"]
): string {
  if (typeof strings === "string") {
    return _htmlEscape(strings);
  }

  let output = strings[0];
  for (const [index, value] of values.entries()) {
    output = output + _htmlEscape(String(value)) + strings[index + 1];
  }

  return output;
}

interface HtmlUnescapeOptions {
  strings: TemplateStringsArray | string;
  values: any[];
}

export function htmlUnescape(
  strings: HtmlUnescapeOptions["strings"],
  ...values: HtmlUnescapeOptions["values"]
): string {
  if (typeof strings === "string") {
    return _htmlUnescape(strings);
  }

  let output = strings[0];
  for (const [index, value] of values.entries()) {
    output = output + _htmlUnescape(String(value)) + strings[index + 1];
  }

  return output;
}

export class MissingValueError extends Error {
  key: any;

  constructor(key: string) {
    super(
      `Missing a value for ${key ? `the placeholder: ${key}` : "a placeholder"}`,
    );
    this.name = "MissingValueError";
    this.key = key;
  }
}

interface PupaData {
  [key: string]: any;
}

interface PupaTransformOptions {
  value: any;
  key: string;
}

interface PupaConfig {
  ignoreMissing?: boolean;
  transform?: (options: PupaTransformOptions) => any;
}

type ReplaceFunction = (placeholder: string, key: string) => string;

export const pupa = function pupa(
  template: string,
  data: PupaData,
  {
    ignoreMissing = true,
    transform = ({ value }: PupaTransformOptions) => value,
  }: PupaConfig = {},
): string {
  if (typeof template !== "string") {
    throw new TypeError(
      `Expected a \`string\` in the first argument, got \`${typeof template}\``,
    );
  }

  if (typeof data !== "object") {
    throw new TypeError(
      `Expected an \`object\` or \`Array\` in the second argument, got \`${typeof data}\``,
    );
  }

  const hours = getHours(new Date());
  const getGreeting = (): string => {
    if (hours >= 6 && hours <= 11) {
      return "Bom dia!";
    }
    if (hours > 11 && hours <= 17) {
      return "Boa Tarde!";
    }
    if (hours > 17 && hours <= 23) {
      return "Boa Noite!";
    }
    return "Olá!";
  };

  const modifiedData: { [key: string]: any } = {
    ...data,
    greeting: getGreeting(),
  };

  const replace: ReplaceFunction = (placeholder, key) => {
    let value = modifiedData;
    for (const property of key.split(".")) {
      value = value ? value[property] : undefined;
    }

    const transformedValue = transform({ value, key });
    if (transformedValue === undefined) {
      if (ignoreMissing) {
        return "";
      }

      throw new MissingValueError(key);
    }

    return String(transformedValue);
  };

  const composeHtmlEscape =
    (replacer: ReplaceFunction) =>
    (...args: [string, string]) =>
      htmlEscape(replacer(...args));

  // The regex tries to match either a number inside `{{ }}` or a valid JS identifier or key path.
  const doubleBraceRegex = /{{(\d+|[a-z$_][\w\-$]*?(?:\.[\w\-$]*?)*?)}}/gi;

  let modifiedTemplate = template;
  if (doubleBraceRegex.test(modifiedTemplate)) {
    modifiedTemplate = modifiedTemplate.replace(
      doubleBraceRegex,
      composeHtmlEscape(replace),
    );
  }

  const braceRegex = /{(\d+|[a-z$_][\w\-$]*?(?:\.[\w\-$]*?)*?)}/gi;
  return modifiedTemplate.replace(braceRegex, replace);
};
