export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 85;

  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

interface CategoryWithName {
  id: string;
  name: string;
  name_ru?: string;
  name_uk?: string;
}

export function findBestMatch<T extends CategoryWithName>(
  supplierCategory: { name: string; name_ru?: string; name_uk?: string },
  internalCategories: T[]
): { category: T; score: number } | null {
  if (internalCategories.length === 0) return null;

  const searchNames = [
    supplierCategory.name_ru,
    supplierCategory.name_uk,
    supplierCategory.name,
  ].filter(Boolean) as string[];

  let bestMatch: T | null = null;
  let bestScore = 0;

  for (const internalCat of internalCategories) {
    const internalNames = [
      internalCat.name,
      internalCat.name_ru,
      internalCat.name_uk,
    ].filter(Boolean) as string[];

    for (const searchName of searchNames) {
      for (const internalName of internalNames) {
        const score = calculateSimilarity(searchName, internalName);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = internalCat;
        }
      }
    }
  }

  if (bestMatch && bestScore >= 60) {
    return { category: bestMatch, score: bestScore };
  }

  return null;
}
