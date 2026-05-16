export const defaultCategories = [
  "sales",
  "professional fees",
  "software",
  "travel",
  "meals",
  "rent",
  "utilities",
  "contractor payments",
  "bank charges",
  "GST payable",
  "GST input"
] as const;

export type DefaultCategory = (typeof defaultCategories)[number];

export function suggestCategory(description: string): DefaultCategory | "uncategorized" {
  const value = description.toLowerCase();
  if (/aws|cloud|hosting|saas|software|github|notion|figma/.test(value)) return "software";
  if (/uber|ola|flight|hotel|travel/.test(value)) return "travel";
  if (/rent|lease/.test(value)) return "rent";
  if (/electricity|internet|utility|water/.test(value)) return "utilities";
  if (/contractor|freelancer|consultant/.test(value)) return "contractor payments";
  if (/bank charge|imps|neft|fee/.test(value)) return "bank charges";
  if (/invoice|retainer|professional fee|consulting/.test(value)) return "professional fees";
  return "uncategorized";
}
