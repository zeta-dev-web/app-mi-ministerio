export function isMissingAppearanceColumns(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  const message = value?.message ?? "";
  return (
    value?.code === "P2022" && /appearanceTheme|appearancePalette/i.test(message)
  ) || (
    /PrismaClientValidationError|Unknown field|column .* does not exist/i.test(message) &&
    /appearanceTheme|appearancePalette/i.test(message)
  );
}
