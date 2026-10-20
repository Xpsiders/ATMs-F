function channelValue(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Expected a six-digit hex color, received "${hex}".`);
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (
    0.2126 * channelValue(red) +
    0.7152 * channelValue(green) +
    0.0722 * channelValue(blue)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const light = luminance(foreground);
  const dark = luminance(background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

export function meetsBodyContrast(
  foreground: string,
  background: string,
): boolean {
  return contrastRatio(foreground, background) >= 4.5;
}
