// Food Testing service catalog for Enquiry & Quotation — derived from the
// existing marketing-facing service catalog (lib/industries.ts) rather than
// hardcoded again, per the Module 2 requirement to reuse existing catalog
// data instead of duplicating it.
import { INDUSTRIES } from "@/lib/industries";

export interface CatalogService {
  id: string; // stable id = the subcategory slug, e.g. "vitamin-analysis"
  division: string; // subcategory name, e.g. "Vitamin Analysis"
  methods: string[]; // techniques
  description: string;
}

const FOOD_TESTING = INDUSTRIES.find((i) => i.slug === "food-testing");

export const FOOD_TESTING_SERVICES: CatalogService[] = (FOOD_TESTING?.subcategories ?? []).map((s) => ({
  id: s.slug,
  division: s.name,
  methods: s.techniques,
  description: s.description,
}));

export function findService(id: string): CatalogService | undefined {
  return FOOD_TESTING_SERVICES.find((s) => s.id === id);
}
