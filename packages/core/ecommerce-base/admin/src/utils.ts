import { pluginId } from './pluginId';

export function getTrad(id: string) {
  return `${pluginId}.${id}`;
}

export function prefixPluginTranslations(
  translations: Record<string, string>,
  id: string
): Record<string, string> {
  if (!id) return translations;
  const prefix = `${id}.`;
  return Object.keys(translations).reduce<Record<string, string>>((acc, current) => {
    if (current.startsWith(prefix)) return acc;
    acc[`${prefix}${current}`] = translations[current];
    return acc;
  }, {});
}
