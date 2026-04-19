
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
  ALFOMBRA = 'Alfombra (Axonopus)',
  MACANA = 'Macana / Dulce',
  MANI_FORRAJERO = 'Maní Forrajero',
  JAPONESA = 'Japonesa',
  GATEADORA = 'Gateadora',
  ESMERALDA = 'Esmeralda',
  PASTO_AZUL = 'Pasto Azul / Orchard (Frío)'
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
  BIO_FLOS = 'Bio Flos - EcoGenesis',
  SAND = 'Arena'
}

export type UnitType = 'gr' | 'kg' | 'ml' | 'cc' | 'lt' | 'gl';
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
  projectName?: string;
}

export interface SoilAnalysisProfile {
  ph: number;
  organicMatter: number;
  ec: number; // Conductividad Eléctrica
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
}

export interface CustomProduct {
  id: string;
  name: string;
  url?: string;
  technicalData?: string;
  defaultUnit: UnitType;
  defaultPrice: number;
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
  soilProfile?: SoilAnalysisProfile;
  climate: ClimateType;
  treeAge: number;
  numTrees: number;
  grassMode?: GrassMeasureMode;
  selectedProducts: OrganicProduct[];
  customProducts: CustomProduct[];
  selectedCustomProductIds: string[];
  productPrices: Record<string, number>;
  manualAmounts: Record<string, number | undefined>;
  manualPlantAmounts: Record<string, number | undefined>;
  manualTotalAmounts: Record<string, number | undefined>;
  manualUnitPrices: Record<string, number | undefined>;
  manualUnits: Record<string, UnitType | undefined>;
  selectedUnits: Record<string, UnitType>;
  cycleFrequencyValue: number;
  cycleFrequencyUnit: FrequencyUnit;
  healthStatus: 'bueno' | 'regular' | 'deficiente';
}

export interface ProductResult {
  product: string;
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
  aiAdvice?: AIAdvice | null;
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
  mixCompatibility?: string;
  technicalObservations?: string;
  longTermImpact?: string;
}

export interface VisionReport {
  plantReading: string;
  metabolicState: string;
  laboratoryCorrelation: string;
  pathologyAnalysis?: PestAnalysis; // Opcional para diagnóstico vegetal
  biologicalRemedy: {
    ingredients: string[];
    preparation: string;
    application: string;
  };
  recommendations: string[];
}

export interface EntomologyReport {
  insectDescription: string;
  taxonomy: {
    commonName: string;
    scientificName: string;
    family?: string;
    order?: string;
  };
  threatLevel: 'Leve' | 'Moderado' | 'Crítico';
  lifeCycle: string;
  damageMechanism: string;
  hostCompatibility: string;
  biologicalControl: {
    agent: string;
    ingredients: string[];
    preparation: string;
    application: string;
  };
  integratedManagement: string[];
}

export enum ActivityType {
  FERTILIZATION = 'Fertilización',
  FOLIAR_APPLICATION = 'Aplicación Foliar',
  IRRIGATION = 'Riego',
  PRUNING = 'Poda',
  HARVEST = 'Cosecha',
  DISEASE_CONTROL = 'Control de Plagas',
  WEEDING = 'Deshierbe',
  SOIL_PREP = 'Preparación de Suelo',
  OTHER = 'Otro'
}

export interface ActivityRecord {
  id: string;
  date: string;
  projectName: string;
  type: ActivityType;
  description: string;
  responsible: string;
  status: 'Completado' | 'Pendiente' | 'En Progreso';
  priority: 'Alta' | 'Media' | 'Baja';
}
