
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
  DRY = 'Seco / Cálido',
  RAINY = 'Lluvioso / Húmedo',
  MODERATE = 'Templado / Frío'
}

export enum Department {
  AMAZONAS = 'Amazonas',
  ANTIOQUIA = 'Antioquia',
  ARAUCA = 'Arauca',
  ATLANTICO = 'Atlántico',
  BOLIVAR = 'Bolívar',
  BOYACA = 'Boyacá',
  CALDAS = 'Caldas',
  CAQUETA = 'Caquetá',
  CASANARE = 'Casanare',
  CAUCA = 'Cauca',
  CESAR = 'Cesar',
  CHOCO = 'Chocó',
  CORDOBA = 'Córdoba',
  CUNDINAMARCA = 'Cundinamarca',
  GUAINIA = 'Guainía',
  GUAVIARE = 'Guaviare',
  HUILA = 'Huila',
  GUAJIRA = 'La Guajira',
  MAGDALENA = 'Magdalena',
  META = 'Meta',
  NARINO = 'Nariño',
  NORTE_SANTANDER = 'Norte de Santander',
  PUTUMAYO = 'Putumayo',
  QUINDIO = 'Quindío',
  RISARALDA = 'Risaralda',
  SAN_ANDRES = 'San Andrés',
  SANTANDER = 'Santander',
  SUCRE = 'Sucre',
  TOLIMA = 'Tolima',
  VALLE_CAUCA = 'Valle del Cauca',
  VAUPES = 'Vaupés',
  VICHADA = 'Vichada',
  BOGOTA = 'Bogotá D.C.'
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
  ARENA = 'Arena',
  ARENO_FRANCO = 'Areno franco',
  FRANCO_ARENOSO = 'Franco arenoso',
  FRANCO = 'Franco',
  FRANCO_LIMOSO = 'Franco limoso',
  LIMO = 'Limo',
  FRANCO_ARCILLO_ARENOSO = 'Franco arcillo-arenoso',
  FRANCO_ARCILLOSO = 'Franco arcilloso',
  FRANCO_ARCILLO_LIMOSO = 'Franco arcillo-limoso',
  ARCILLO_ARENOSO = 'Arcillo arenoso',
  ARCILLO_LIMOSO = 'Arcillo limoso',
  ARCILLA = 'Arcilla'
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
  BORON = 'Ácido bórico granulado',
  ZINC = 'Sulfato De Zinc granulado',
  COPPER = 'Sulfato de cobre granulado',
  COMPOST_TERRABONO = 'Compost Premium',
  SEA_SALT = 'Sal Marina',
  ROCK_DUST = 'Harina de Roca',
  PHOSPHATE_ROCK = 'Roca Fosfórica',
  CALCIUM_CARBONATE = 'Carbonato de Calcio',
  LEONARDITE = 'Leonardita',
  DIATOMACEOUS_EARTH = 'Tierra de Diatomeas',
  MAGNESITE = 'Magnesita',
  MYCORRHIZA = 'Micorrizas',
  BIO_FLOS = 'Bio Flos - EcoGenesis'
}

export type UnitType = 'g' | 'kg' | 'cc' | 'ml' | 'L';
export type FrequencyUnit = 'días' | 'meses';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ClientData {
  firstName: string;
  lastName: string;
  location: string;
  contact: string;
  email: string;
}

export interface CalculationInput {
  treeType: TreeType;
  department: Department;
  applicationMode: ApplicationMode;
  grassVariety?: GrassVariety;
  soilType: SoilType;
  soilPercentages?: {
    sand: number;
    silt: number;
    clay: number;
  };
  climate: ClimateType;
  treeAge: number;
  numTrees: number;
  grassMode?: GrassMeasureMode;
  selectedProducts: OrganicProduct[];
  productPrices: Record<string, number>;
  manualAmounts: Record<string, number | undefined>;
  manualPlantAmounts: Record<string, number | undefined>;
  selectedUnits: Record<string, UnitType>;
  cycleFrequencyValue: number;
  cycleFrequencyUnit: FrequencyUnit;
  healthStatus: 'bueno' | 'regular' | 'deficiente';
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

export interface HistoryRecord {
  id: string;
  consecutive: number;
  date: string;
  client: ClientData;
  input: CalculationInput;
  result: CalculationResult;
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
  sources?: GroundingSource[];
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
