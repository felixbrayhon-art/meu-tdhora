// Keep each generated reason attached to its original option while invalid and duplicate options are removed.
export const matchWrongReasons = (correct: string, shortCorrect: unknown, options: unknown, reasons: unknown): Array<{ text: string; reason: string }> => {
  if (!Array.isArray(options)) return [];
  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const reasonList = Array.isArray(reasons) ? reasons : [];
  const seen = new Set<string>();
  return options.map((option, index) => ({
    text: typeof option === 'string' ? option.trim() : '',
    reason: typeof reasonList[index] === 'string' ? reasonList[index].trim() : '',
  })).filter(({ text }) => {
    const key = normalize(text);
    if (!key || key === normalize(correct) || key === normalize(typeof shortCorrect === 'string' ? shortCorrect : '') || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
};
