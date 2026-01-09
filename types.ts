
export enum TreeType {
  CITRUS = 'Cítricos',
  PLANTAIN = 'Plátano',
  BANANA = 'Banano',
  CASSAVA = 'Yuca',
  AVOCADO = 'Aguacate',
  COFFEE = 'Café',
  CACAO = 'Cacao',
  GARDEN = 'Plantas de Jardín',
  GRASS = 'Césped',
  FOREST = 'Forestales / Ornamentales'
}

export enum OrganicProduct {
  // Líquidos
  POTASSIUM_SOAP = 'Jabón Potásico',
  LIQUID_HUMUS = 'Humus Líquido',
  LIQUID_IRON_OXIDE = 'Óxido de Hierro Líquido',
  EM = 'EM (Microorganismos Eficaces)',
  MOLASSES = 'Melaza',
  SULFUR_FUNGICIDE = 'Fungicida de Azufre',
  NEEM_EXTRACT = 'Extracto de Neem',
  
  // Sólidos
  BORON = 'Boro',
  ZINC = 'Zinc',
  COPPER = 'Cobre',
  COMPOST_TERRABONO = 'Compost (Terrabono)',
  SEA_SALT = 'Sal Marina',
  ROCK_DUST = 'Harina de Roca',
  PHOSPHATE_ROCK = 'Roca Fosfórica',
  CALCIUM_CARBONATE = 'Carbonato de Calcio',
  LEONARDITE = 'Leonardita',
  DIATOMACEOUS_EARTH = 'Tierra de Diatomea',
  MAGNESITE = 'Magnesita'
}

export type UnitType = 'g' | 'kg' | 'cc' | 'ml' | 'L';

export interface CalculationInput {
  treeType: TreeType;
  treeAge: number;
  numTrees: number;
  selectedProducts: OrganicProduct[];
  productPrices: Record<string, number>; // Precio en COP
  manualAmounts: Record<string, number | undefined>; // Dosis por árbol
  selectedUnits: Record<string, UnitType>; // Unidad elegida
  healthStatus: 'bueno' | 'regular' | 'deficiente';
}

export interface ProductResult {
  product: OrganicProduct;
  amount: number;
  unit: UnitType;
  costPerTree: number;
  totalCost: number;
}

export interface CalculationResult {
  products: ProductResult[];
  totalCostPerTree: number;
  totalProjectCost: number;
  frequency: string;
  notes: string;
}

export interface AIAdvice {
  tips: string[];
  seasonalAdvice: string;
  sustainabilityScore: number;
}
