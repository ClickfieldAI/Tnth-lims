import {
  Pill, Apple, Droplets, Sparkles, Leaf, Wheat, Recycle, type LucideIcon,
} from "lucide-react";

// The operational test-type codes the rest of the LIMS actually runs on
// (worksheets, dashboards, testing/[discipline] pages). The catalog below has
// far more service lines than the lab currently models as distinct disciplines,
// so each subcategory maps onto its closest real operational type — this is
// what makes "Register sample" from a hub page produce a test that shows up
// correctly in the worksheet/QA pipeline instead of an orphaned, type-less record.
export type OperationalTestType = "ASSAY" | "DISSOLUTION" | "IMPURITY" | "HPLC" | "GC" | "MICROBIOLOGY" | "STABILITY";

export interface Subcategory {
  slug: string;
  name: string;
  description: string;
  techniques: string[];
  testType: OperationalTestType;
}

export interface Industry {
  slug: string;
  name: string;
  clientIndustry: string;
  icon: LucideIcon;
  tagline: string;
  image: string;
  subcategories: Subcategory[];
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "pharmaceuticals",
    name: "Pharmaceuticals",
    clientIndustry: "Pharmaceuticals",
    icon: Pill,
    tagline: "Pharmacopoeial testing based on USP, BP, EP or IP for raw materials and finished products.",
    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1000&q=80&auto=format&fit=crop",
    subcategories: [
      { slug: "raw-material-analysis", name: "Raw Material Analysis", description: "Identification, purity and quality testing of active pharmaceutical ingredients and excipients before formulation.", techniques: ["HPLC", "GC", "FTIR", "UV/Visible Spectroscopy", "Karl Fischer Titration"], testType: "HPLC" },
      { slug: "finished-products", name: "Finished Products", description: "Assay, dissolution and specification testing of the final dosage form prior to batch release.", techniques: ["HPLC Assay", "Dissolution (USP I/II)", "Disintegration Testing", "Content Uniformity"], testType: "ASSAY" },
      { slug: "micro-biology", name: "Micro Biology", description: "Microbial limit testing and sterility assurance for pharmaceutical products and environments.", techniques: ["Total Viable Count", "Pathogen Screening", "Sterility Testing", "Viable Air Sampling"], testType: "MICROBIOLOGY" },
      { slug: "medical-device-testing", name: "Medical Device Testing", description: "Physicochemical and microbiological evaluation of medical devices for regulatory submission.", techniques: ["Extractables & Leachables", "Sterility", "Biocompatibility Support"], testType: "MICROBIOLOGY" },
      { slug: "method-development-validation", name: "Method Development & Validation", description: "Development and validation of analytical methods for raw materials, APIs and finished products.", techniques: ["Method Validation (ICH Q2)", "Process & Cleaning Validation", "Stability-Indicating Methods"], testType: "HPLC" },
      { slug: "nmr-spectroscopy", name: "NMR Spectroscopy", description: "Structural confirmation and purity assessment of pharmaceutical compounds.", techniques: ["H-1 NMR", "P-31 NMR"], testType: "HPLC" },
      { slug: "trace-metal-analysis", name: "Trace Metal Analysis", description: "Elemental impurity testing per ICH Q3D for raw materials and finished products.", techniques: ["ICP-MS", "Atomic Absorption Spectroscopy"], testType: "IMPURITY" },
      { slug: "residual-solvent-analysis", name: "Residual Solvent Analysis", description: "Detection and quantification of residual processing solvents per ICH Q3C.", techniques: ["GC", "GC/MS Headspace"], testType: "GC" },
      { slug: "asbestos-analysis", name: "Asbestos Analysis", description: "Screening of talc and mineral-derived excipients for asbestos contamination.", techniques: ["Polarized Light Microscopy", "FTIR"], testType: "IMPURITY" },
    ],
  },
  {
    slug: "food-testing",
    name: "Food Testing",
    clientIndustry: "Food Testing",
    icon: Apple,
    tagline: "NABL-accredited food testing for product launch, label approvals and export shipments.",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1000&q=80&auto=format&fit=crop",
    subcategories: [
      { slug: "vitamin-analysis", name: "Vitamin Analysis", description: "Measures water-soluble (Vitamin C, B-complex) and fat-soluble (A, D, E, K) vitamin content.", techniques: ["HPLC", "UV-Vis Spectroscopy", "LC-MS/MS"], testType: "HPLC" },
      { slug: "nutritional-labeling", name: "Nutritional Labeling", description: "Verifies food label declarations for FSSAI and export compliance — fats, proteins, carbohydrates, calories.", techniques: ["Water Content", "Total Protein", "Total Mineral Content", "Fat Content", "Fiber Content"], testType: "ASSAY" },
      { slug: "quality-analysis", name: "Quality Analysis", description: "Physical, chemical and sensory characterization to confirm compliance and consumer satisfaction.", techniques: ["pH Analysis", "Color Analysis", "Moisture Content", "Viscosity", "Refractive Index"], testType: "ASSAY" },
      { slug: "contaminants-residues", name: "Contaminants & Residues", description: "Detects pesticide residues, veterinary residues, environmental pollutants and heavy metals.", techniques: ["GC-MS", "LC-MS/MS", "ICP-MS", "AAS", "HPLC"], testType: "GC" },
      { slug: "microbial-analysis", name: "Microbial Analysis", description: "Biochemical, molecular and microscopic testing to detect microorganisms affecting safety and shelf life.", techniques: ["Indicator Microorganisms", "Pathogens & Toxins", "Total Plate Count", "PCR", "ELFA"], testType: "MICROBIOLOGY" },
      { slug: "authenticity-testing", name: "Authenticity Testing", description: "Protects against fraudulent supply and mislabeling of food products and brand claims.", techniques: ["DNA-Based Testing", "LC-MS / GC-MS", "IRMS", "NMR", "Protein Profiling"], testType: "HPLC" },
      { slug: "allergen-control", name: "Allergen Control", description: "Detects allergenic substances to ensure labeling compliance and protect sensitive consumers.", techniques: ["LC-MS/MS", "PCR Detection"], testType: "HPLC" },
      { slug: "food-borne-virus-detection", name: "Food Borne Virus Detection", description: "Identifies viral contamination risk in food products and processing environments.", techniques: ["RT-PCR", "Molecular Screening"], testType: "MICROBIOLOGY" },
      { slug: "ingredients-additives", name: "Ingredients & Additives", description: "Quantification and identity confirmation of functional ingredients and food additives.", techniques: ["HPLC", "LC-MS/MS"], testType: "HPLC" },
      { slug: "flavor-fragrance", name: "Flavor & Fragrance", description: "Profiling of flavour and fragrance compounds for quality and authenticity.", techniques: ["GC-MS", "HS-GC"], testType: "GC" },
      { slug: "food-contact-material", name: "Food Contact Material", description: "Migration testing of packaging materials that come into contact with food.", techniques: ["GC-MS", "LC-MS/MS", "Migration Testing"], testType: "GC" },
    ],
  },
  {
    slug: "water-environment",
    name: "Water & Environment",
    clientIndustry: "Water & Environment",
    icon: Droplets,
    tagline: "NABL-standard testing across drinking, process, waste and environmental water matrices.",
    image: "https://images.unsplash.com/photo-1616118132534-381148898bb4?w=1000&q=80&auto=format&fit=crop",
    subcategories: [
      { slug: "water-analysis", name: "Water Analysis", description: "Testing of packaged drinking water, natural mineral water, and surface/ground water per IS standards.", techniques: ["IS 14543 (Packaged Drinking Water)", "IS 10500 (Surface/Ground Water)", "IS 13428 (Mineral Water)"], testType: "MICROBIOLOGY" },
      { slug: "process-water-analysis", name: "Process Water Analysis", description: "Grade-specific testing for biomedical, electronics, food and industrial process water.", techniques: ["ASTM D5196", "ASTM D5127", "IS 4251", "Trace Metal Analysis"], testType: "IMPURITY" },
      { slug: "waste-water", name: "Waste Water", description: "Analysis of waste water discharge into inland surface water, sewers or land for irrigation.", techniques: ["MOEF Guidelines", "BIS Specifications", "State PCB Norms"], testType: "IMPURITY" },
      { slug: "commercial-testing", name: "Commercial Testing", description: "Testing services for water treatment professionals, well drillers and public water systems.", techniques: ["Physico-chemical Panel", "Microbiological Panel"], testType: "MICROBIOLOGY" },
      { slug: "residential-testing", name: "Residential Testing", description: "Drinking water safety testing for homeowners, apartments and commercial establishments.", techniques: ["Physical Parameters", "Chemical Parameters", "Microbiological Parameters"], testType: "MICROBIOLOGY" },
    ],
  },
  {
    slug: "personal-care-cosmetics",
    name: "Personal Care & Cosmetics",
    clientIndustry: "Personal Care & Cosmetics",
    icon: Sparkles,
    tagline: "COS-23 & FORM-37 licensed testing ensuring cosmetic products are safe, effective and label-compliant.",
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=1000&q=80&auto=format&fit=crop",
    subcategories: [
      { slug: "skin-care", name: "Skin Care", description: "Testing of skin creams, gels, powders and face packs against BIS product standards.", techniques: ["IS 6608 (Skin Cream)", "IS 18429 (Skin Gel)", "IS 3959 (Skin Powder)", "IS 15153 (Face Pack)"], testType: "ASSAY" },
      { slug: "hair-care", name: "Hair Care", description: "Testing of hair oils, shampoos, hair dyes and hair creams for compliance and safety.", techniques: ["IS 7123 (Hair Oil)", "IS 7884 (Shampoo)", "IS 8481 (Oxidation Hair Dye)", "IS 7679 (Hair Cream)"], testType: "ASSAY" },
      { slug: "oral-care", name: "Oral Care", description: "Testing of tooth powders and toothpaste for composition and safety.", techniques: ["IS 5383 (Tooth Powder)", "IS 6356 (Tooth Paste)"], testType: "ASSAY" },
      { slug: "soap-products", name: "Soap Products", description: "Testing of toilet, shaving, bathing and liquid soaps against BIS standards.", techniques: ["IS 2888 (Toilet Soap)", "IS 5784 (Shaving Soap)", "IS 13498 (Bathing Bar)", "IS 4199 (Liquid Toilet Soap)"], testType: "ASSAY" },
      { slug: "color-cosmetics", name: "Color Cosmetics", description: "Testing of lipsticks, nail polish, kajal and other decorative cosmetics.", techniques: ["IS 9875 (Lipstick)", "IS 9245 (Nail Polish)", "IS 15154 (Kajal)", "IS 14318 (Liquid Foundation)"], testType: "IMPURITY" },
      { slug: "spf-testing", name: "SPF / Sunscreen Testing", description: "In vitro and in vivo SPF, UVA protection and water-resistance testing for sunscreen creams.", techniques: ["In Vitro SPF", "UVA Protection Factor", "Water Resistance Study"], testType: "ASSAY" },
      { slug: "microbiology", name: "Microbiology", description: "Microbial analysis and preservative efficacy testing of cosmetic products.", techniques: ["Microbial Contamination", "Preservative Efficacy Study", "Shelf Life Study"], testType: "MICROBIOLOGY" },
      { slug: "heavy-metals", name: "Heavy Metals", description: "Heavy metal contamination screening per IS 16913 and international limits.", techniques: ["ICP-MS", "IS 16913"], testType: "IMPURITY" },
    ],
  },
  {
    slug: "ayush-testing",
    name: "Ayush Testing",
    clientIndustry: "Ayush Testing",
    icon: Leaf,
    tagline: "FORM-48 approved testing for Ayurvedic, Siddha and Unani drugs and raw materials.",
    image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=1000&q=80&auto=format&fit=crop",
    subcategories: [
      { slug: "stability-studies", name: "Stability Studies", description: "Determines how temperature, humidity and light affect AYUSH product safety, efficacy and shelf life.", techniques: ["Long-Term Stability", "Accelerated Stability"], testType: "STABILITY" },
      { slug: "hptlc-fingerprinting", name: "HPTLC Fingerprinting & Quantification", description: "Identification and quantification of marker compounds; checks for adulteration and purity.", techniques: ["HPTLC", "Marker Compound Quantification"], testType: "HPLC" },
      { slug: "herbal-cosmetics-analysis", name: "Herbal Cosmetics Analysis", description: "Quality and safety testing of herbal-based cosmetic formulations.", techniques: ["HPTLC", "Microbiology", "Heavy Metals"], testType: "MICROBIOLOGY" },
      { slug: "pesticide-residue-analysis", name: "Pesticide Residue Analysis", description: "Screens organochlorine, organophosphorus and pyrethroid pesticide residues in herbal raw materials.", techniques: ["GC-MS", "LC-MS/MS"], testType: "GC" },
      { slug: "aflatoxin-detection", name: "Aflatoxin Detection", description: "Detects fungal toxin contamination in herbal raw materials and finished products.", techniques: ["HPLC", "LC-MS/MS"], testType: "HPLC" },
      { slug: "residual-solvent-testing", name: "Residual Solvent Testing", description: "Quantifies residual extraction solvents in herbal extracts and formulations.", techniques: ["GC Headspace"], testType: "GC" },
      { slug: "microbiological-testing", name: "Microbiological Testing", description: "Microbial limit testing of AYUSH raw materials and finished products.", techniques: ["Total Viable Count", "Pathogen Screening"], testType: "MICROBIOLOGY" },
      { slug: "herb-plant-extract-id", name: "Herb & Plant Extract Identification", description: "Botanical identification and fingerprinting of herb and plant extracts.", techniques: ["HPTLC", "Microscopy"], testType: "HPLC" },
      { slug: "heavy-metal-analysis", name: "Heavy Metal Analysis", description: "Elemental contamination screening of herbal raw materials and products.", techniques: ["ICP-MS", "AAS"], testType: "IMPURITY" },
      { slug: "physio-chemical-analysis", name: "Physio-Chemical Analysis", description: "General physicochemical characterization of AYUSH raw materials and formulations.", techniques: ["pH", "Moisture", "Ash Value", "Extractive Value"], testType: "ASSAY" },
    ],
  },
  {
    slug: "agriculture",
    name: "Agriculture",
    clientIndustry: "Agriculture",
    icon: Wheat,
    tagline: "NABL-accredited soil, water, plant and manure analysis for farmers and agribusinesses.",
    image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1000&q=80&auto=format&fit=crop",
    subcategories: [
      { slug: "soil-testing", name: "Soil Testing", description: "Comprehensive soil nutrient profiling and pH balance analysis to optimize crop yield and fertilizer use.", techniques: ["Nutrient Profiling", "pH Balance Analysis"], testType: "IMPURITY" },
      { slug: "nematode-testing", name: "Nematode Testing", description: "Detection of harmful nematodes in soil to prevent crop damage and yield loss.", techniques: ["Microscopic Identification", "Soil Extraction"], testType: "MICROBIOLOGY" },
      { slug: "water-analysis-agri", name: "Water Analysis", description: "Testing irrigation water for contaminants, PFAS, pesticide residues and microbial safety.", techniques: ["ICP-MS", "GC-MS", "Microbiology"], testType: "MICROBIOLOGY" },
      { slug: "fertilizer-testing", name: "Fertilizer Testing", description: "Quality and composition checks for fertilizers to prevent overuse and ensure balanced nutrition.", techniques: ["Nutrient Composition", "Heavy Metal Screening"], testType: "IMPURITY" },
      { slug: "feed-analysis", name: "Feed Analysis", description: "Detailed nutritional profiling of animal feed to support livestock health and productivity.", techniques: ["Proximate Analysis", "Mycotoxin Screening"], testType: "ASSAY" },
      { slug: "pesticide-testing", name: "Pesticide Testing", description: "Residue analysis of crops and food products to detect harmful pesticide levels.", techniques: ["GC-MS", "LC-MS/MS"], testType: "GC" },
    ],
  },
  {
    slug: "polymer-testing",
    name: "Polymer Testing",
    clientIndustry: "Polymer Testing",
    icon: Recycle,
    tagline: "Physical, thermal, rheological and optical characterization of polymers and plastics.",
    image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1000&q=80&auto=format&fit=crop",
    subcategories: [
      { slug: "physical-mechanical", name: "Physical & Mechanical Characterization", description: "Measures the mechanical strength and hardness properties of polymer materials.", techniques: ["Tensile Testing", "Compression Testing", "Hardness Testing", "Flex Modulus", "Young's Modulus"], testType: "STABILITY" },
      { slug: "thermal-characterization", name: "Thermal Characterization", description: "Evaluates thermal transitions, decomposition and melt behaviour of polymers.", techniques: ["DSC", "TGA", "Melt Flow Indexer (MFI)"], testType: "STABILITY" },
      { slug: "surface-composition", name: "Surface & Composition Analysis", description: "Identifies surface morphology, elemental composition and filler content.", techniques: ["FT-IR", "ATR", "SEM", "Energy Dispersive X-Ray", "Filler Content & ID"], testType: "IMPURITY" },
      { slug: "barrier-rheological", name: "Barrier & Rheological Properties", description: "Measures gas/vapour barrier performance and flow behaviour of polymer materials.", techniques: ["Viscosity", "WVTR", "OTR", "Real-Time X-Ray", "Particle Cleanliness"], testType: "STABILITY" },
    ],
  },
];

export function getIndustry(slug: string) {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export function getSubcategory(industrySlug: string, subSlug: string) {
  const industry = getIndustry(industrySlug);
  const sub = industry?.subcategories.find((s) => s.slug === subSlug);
  return industry && sub ? { industry, sub } : null;
}
