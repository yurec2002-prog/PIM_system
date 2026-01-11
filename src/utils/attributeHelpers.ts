export function parseNumericValue(value: string): number | null {
  if (!value || typeof value !== 'string') return null;

  const cleaned = value.trim().replace(/\s/g, '');

  const commaDecimalPattern = /^-?\d+,\d+$/;
  if (commaDecimalPattern.test(cleaned)) {
    const normalized = cleaned.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }

  const dotDecimalPattern = /^-?\d+\.?\d*$/;
  if (dotDecimalPattern.test(cleaned)) {
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  const intPattern = /^-?\d+$/;
  if (intPattern.test(cleaned)) {
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }

  return null;
}

export function detectAndParseNumeric(value: string): { isNumeric: boolean; numericValue: number | null } {
  const numericValue = parseNumericValue(value);
  return {
    isNumeric: numericValue !== null,
    numericValue,
  };
}
