
export enum TreeType {
  CITRUS = 'Cítricos',
  PLANTAIN = 'Plátano',
  BANANA = 'Banano',
  CASSAVA = 'Yuca',
  AVOCADO = 'Aguacate',
  COFFEE = 'Café',
  CACAO = 'Cacao',
  COCONUT = 'Coco',
  GARDEN = 'Plantas de Jardín',
  GRASS = 'Césped',
  FOREST = 'Forestales'
}

export enum ApplicationMode {
  PLANTING = 'Siembra / Instalación',
  MAINTENANCE = 'Mantenimiento / Producción'
}

export enum ClimateType {
  DRY = 'Seco / Verano',
  RAINY = 'Lluvioso / Invierno',
  MODERATE = 'Templado / Neutro'
}

export enum GrassVariety {
  KIKUYO = 'Kikuyo',
  SAN_AGUSTIN = 'San Agustín',
  BERMUDA = 'Bermuda',
  BERMUDA_419 = 'Bermuda 419',
  TRENZA = 'Trenza',
  MACANA = 'Macana / Dulce',
  MANI_FORRAJERO = 'Maní Forrajero',
  JAPONESA = 'Japonesa',
  GATEADORA = 'Gateadora',
  ESMERALDA = 'Esmeralda'
}

export enum SoilType {
  SANDY = 'Arenoso',
  SILTY = 'Limoso',
  CLAYEY = 'Arcilloso',
  LOAMY = 'Franco'
}

export enum GrassMeasureMode {
  AREA = 'm2',
  LINEAR = 'm lineal'
}

export enum OrganicProduct {
  POTASSIUM_SOAP = 'Jabón Potásico',
  LIQUID_HUMUS = 'Humus Líquido',
  LIQUID_IRON_OXIDE = 'Hierro Líquido',
  EM = 'EM (Microorganismos)',
  MOLASSES = 'Melaza',
  SULFUR_FUNGICIDE = 'Azufre Líquido',
  NEEM_EXTRACT = 'Extracto de Neem',
  BORON = 'Boro',
  ZINC = 'Zinc',
  COPPER = 'Cobre',
  COMPOST_TERRABONO = 'Compost Premium',
  SEA_SALT = 'Sal Marina',
  ROCK_DUST = 'Harina de Roca',
  PHOSPHATE_ROCK = 'Roca Fosfórica',
  CALCIUM_CARBONATE = 'Carbonato de Calcio',
  LEONARDITE = 'Leonardita',
  DIATOMACEOUS_EARTH = 'Tierra de Diatomeas',
  MAGNESITE = 'Magnesita'
}

export type UnitType = 'g' | 'kg' | 'cc' | 'ml' | 'L';

export interface CalculationInput {
  treeType: TreeType;
  applicationMode: ApplicationMode;
  grassVariety?: GrassVariety;
  soilType: SoilType;
  climate: ClimateType;
  treeAge: number;
  numTrees: number;
  grassMode?: GrassMeasureMode;
  selectedProducts: OrganicProduct[];
  productPrices: Record<string, number>;
  manualAmounts: Record<string, number | undefined>;
  selectedUnits: Record<string, UnitType>;
  healthStatus: 'bueno' | 'regular' | 'deficiente';
  healthPhoto?: string; // base64
}

export interface ProductResult {
  product: OrganicProduct;
  amount: number;
  unit: UnitType;
  costPerUnit: number;
  totalCost: number;
}

export interface CalculationResult {
  products: ProductResult[];
  totalCostPerUnit: number;
  totalProjectCost: number;
  frequency: string;
}

export interface NutritionStep {
  item: string;
  dosage: string;
  purpose: string;
}

export interface ElementalTarget {
  element: string;
  relevance: string;
  priority: 'Alta' | 'Media' | 'Baja';
  requirementLevel: number;
}

export interface PestAnalysis {
  identifiedPest: string;
  scientificName: string;
  symptoms: string;
  prevention: string;
  organicTreatment: string;
  controlCycle: string;
  severity: 'Leve' | 'Moderada' | 'Crítica';
  lifeCycleInfo: string;
}

export interface AIAdvice {
  tips: string[];
  seasonalAdvice: string;
  sustainabilityScore: number;
  radicularPlan: NutritionStep[];
  foliarPlan: NutritionStep[];
  soilAnalysis: string;
  elementalFormulation: ElementalTarget[];
  visualDiagnosis?: string;
  pestAnalysis?: PestAnalysis;
  waterRequirement: {
    volume: string;
    frequency: string;
    technique: string;
  };
}

export interface VisionReport {
  plantReading: string;
  pestAnalysis: PestAnalysis;
  biologicalRemedy: {
    ingredients: string[];
    preparation: string;
    application: string;
  };
  recommendations: string[];
}

export interface PlantingFormulaItem {
  product: string;
  suggestedAmount: number;
  totalAmount: number;
  unit: string;
  reason: string;
}

export interface PlantingFormulaRecommendation {
  explanation: string;
  items: PlantingFormulaItem[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  treeType: TreeType;
  grassVariety?: GrassVariety;
  numTrees: number;
  unitLabel: string;
  totalCost: number;
  result: CalculationResult | null;
  aiAdvice: AIAdvice | null;
  visionReport: VisionReport | null;
  location?: {
    lat: number;
    lng: number;
  };
  imagePreview?: string;
}
