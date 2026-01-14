
import React from 'react';
import { TreeType, OrganicProduct, UnitType, Department, ClimateType } from './types.ts';

export const TREE_TYPE_ICONS: Record<TreeType, React.ReactNode> = {
  [TreeType.CITRUS]: <i className="fas fa-lemon text-yellow-500"></i>,
  [TreeType.PLANTAIN]: <i className="fas fa-leaf text-green-600"></i>,
  [TreeType.BANANA]: <i className="fas fa-leaf text-yellow-400"></i>,
  [TreeType.CASSAVA]: <i className="fas fa-seedling text-amber-700"></i>,
  [TreeType.AVOCADO]: <i className="fas fa-seedling text-green-700"></i>,
  [TreeType.COFFEE]: <i className="fas fa-mug-hot text-amber-900"></i>,
  [TreeType.CACAO]: <i className="fas fa-cookie text-amber-800"></i>,
  [TreeType.COCONUT]: <i className="fas fa-tree text-amber-600"></i>,
  [TreeType.GARDEN]: <i className="fas fa-spa text-pink-400"></i>,
  [TreeType.GRASS]: <i className="fas fa-align-justify text-emerald-500"></i>,
  [TreeType.FOREST]: <i className="fas fa-tree text-emerald-800"></i>,
};

export const COLOMBIAN_REGIONS = [
  {
    name: "Región Andina",
    departments: [Department.ANTIOQUIA, Department.BOYACA, Department.CALDAS, Department.CUNDINAMARCA, Department.HUILA, Department.NORTE_SANTANDER, Department.QUINDIO, Department.RISARALDA, Department.SANTANDER, Department.TOLIMA, Department.BOGOTA]
  },
  {
    name: "Región Caribe",
    departments: [Department.ATLANTICO, Department.BOLIVAR, Department.CESAR, Department.CORDOBA, Department.GUAJIRA, Department.MAGDALENA, Department.SUCRE]
  },
  {
    name: "Región Pacífica",
    departments: [Department.CAUCA, Department.CHOCO, Department.NARINO, Department.VALLE_CAUCA]
  },
  {
    name: "Región Orinoquía",
    departments: [Department.ARAUCA, Department.CASANARE, Department.META, Department.VICHADA]
  },
  {
    name: "Región Amazonía",
    departments: [Department.AMAZONAS, Department.CAQUETA, Department.GUAINIA, Department.GUAVIARE, Department.PUTUMAYO, Department.VAUPES]
  },
  {
    name: "Región Insular",
    departments: [Department.SAN_ANDRES]
  }
];

// Matriz de Compatibilidad Técnica
export interface CompatibilityRule {
  status: 'compatible' | 'caution' | 'incompatible';
  reason: string;
  maxMixRatio?: string;
}

export const COMPATIBILITY_RULES: Record<string, Record<string, CompatibilityRule>> = {
  [OrganicProduct.COPPER]: {
    [OrganicProduct.EM]: { status: 'incompatible', reason: 'El cobre es bactericida y anula los microorganismos vivos.' },
    [OrganicProduct.MYCORRHIZA]: { status: 'incompatible', reason: 'El cobre inhibe el crecimiento de hongos micorrícicos.' },
    [OrganicProduct.POTASSIUM_SOAP]: { status: 'caution', reason: 'Riesgo de precipitación. Mezclar primero el jabón y diluir mucho el cobre.' }
  },
  [OrganicProduct.SULFUR_FUNGICIDE]: {
    [OrganicProduct.NEEM_EXTRACT]: { status: 'caution', reason: 'Mezcla aceitosa + azufre bajo sol puede causar quemaduras foliares.' },
    [OrganicProduct.POTASSIUM_SOAP]: { status: 'incompatible', reason: 'Reacción alcalina extrema que anula el efecto del azufre.' }
  },
  [OrganicProduct.EM]: {
    [OrganicProduct.MOLASSES]: { status: 'compatible', reason: 'SINERGIA: La melaza alimenta y activa los microorganismos.', maxMixRatio: '1:2 (Melaza:EM)' },
    [OrganicProduct.LIQUID_HUMUS]: { status: 'compatible', reason: 'Mejora la colonización de bacterias en el suelo.' }
  },
  [OrganicProduct.POTASSIUM_SOAP]: {
    [OrganicProduct.NEEM_EXTRACT]: { status: 'compatible', reason: 'SINERGIA: El jabón actúa como surfactante potenciando el Neem.', maxMixRatio: '5ml Jabón + 3ml Neem por Litro' }
  }
};

export const DEPARTMENT_CLIMATE_MAP: Record<Department, ClimateType> = {
  [Department.AMAZONAS]: ClimateType.RAINY,
  [Department.ANTIOQUIA]: ClimateType.MODERATE,
  [Department.ARAUCA]: ClimateType.DRY,
  [Department.ATLANTICO]: ClimateType.DRY,
  [Department.BOLIVAR]: ClimateType.DRY,
  [Department.BOYACA]: ClimateType.MODERATE,
  [Department.CALDAS]: ClimateType.MODERATE,
  [Department.CAQUETA]: ClimateType.RAINY,
  [Department.CASANARE]: ClimateType.DRY,
  [Department.CAUCA]: ClimateType.MODERATE,
  [Department.CESAR]: ClimateType.DRY,
  [Department.CHOCO]: ClimateType.RAINY,
  [Department.CORDOBA]: ClimateType.DRY,
  [Department.CUNDINAMARCA]: ClimateType.MODERATE,
  [Department.GUAINIA]: ClimateType.RAINY,
  [Department.GUAVIARE]: ClimateType.RAINY,
  [Department.HUILA]: ClimateType.DRY,
  [Department.GUAJIRA]: ClimateType.DRY,
  [Department.MAGDALENA]: ClimateType.DRY,
  [Department.META]: ClimateType.MODERATE,
  [Department.NARINO]: ClimateType.MODERATE,
  [Department.NORTE_SANTANDER]: ClimateType.MODERATE,
  [Department.PUTUMAYO]: ClimateType.RAINY,
  [Department.QUINDIO]: ClimateType.MODERATE,
  [Department.RISARALDA]: ClimateType.MODERATE,
  [Department.SAN_ANDRES]: ClimateType.DRY,
  [Department.SANTANDER]: ClimateType.MODERATE,
  [Department.SUCRE]: ClimateType.DRY,
  [Department.TOLIMA]: ClimateType.DRY,
  [Department.VALLE_CAUCA]: ClimateType.MODERATE,
  [Department.VAUPES]: ClimateType.RAINY,
  [Department.VICHADA]: ClimateType.DRY,
  [Department.BOGOTA]: ClimateType.MODERATE,
};

export const PRODUCT_CATEGORIES = {
  LIQUIDS: [
    OrganicProduct.POTASSIUM_SOAP,
    OrganicProduct.LIQUID_HUMUS,
    OrganicProduct.LIQUID_IRON_OXIDE,
    OrganicProduct.EM,
    OrganicProduct.MOLASSES,
    OrganicProduct.SULFUR_FUNGICIDE,
    OrganicProduct.NEEM_EXTRACT,
    OrganicProduct.BIO_FLOS,
  ],
  SOLIDS: [
    OrganicProduct.BORON,
    OrganicProduct.ZINC,
    OrganicProduct.COPPER,
    OrganicProduct.COMPOST_TERRABONO,
    OrganicProduct.SEA_SALT,
    OrganicProduct.ROCK_DUST,
    OrganicProduct.PHOSPHATE_ROCK,
    OrganicProduct.CALCIUM_CARBONATE,
    OrganicProduct.LEONARDITE,
    OrganicProduct.DIATOMACEOUS_EARTH,
    OrganicProduct.MAGNESITE,
    OrganicProduct.MYCORRHIZA,
  ]
};

export const PRODUCT_DETAILS: Record<OrganicProduct, { properties: string, benefits: string, precautions: string }> = {
  [OrganicProduct.POTASSIUM_SOAP]: {
    properties: "Sales de potasio de ácidos grasos, biodegradable, pH alcalino (9-10).",
    benefits: "Insecticida y acaricida de contacto. Limpia melazas y negrilla. Aporte de potasio foliar.",
    precautions: "No aplicar a pleno sol ni con temperaturas >30°C. Incompatible con productos de pH ácido."
  },
  [OrganicProduct.LIQUID_HUMUS]: {
    properties: "Extracto concentrado de ácidos húmicos y fúlvicos extraídos de leonardita o compost.",
    benefits: "Mejora la estructura del suelo, aumenta la capacidad de intercambio catiónico (CIC).",
    precautions: "Agitar bien antes de usar. Almacenar en lugar fresco y oscuro para evitar fermentación."
  },
  [OrganicProduct.LIQUID_IRON_OXIDE]: {
    properties: "Óxido de hierro quelatado o en suspensión fina de alta asimilación.",
    benefits: "Corrige la clorosis férrica. Esencial para la síntesis de clorofila y transporte de electrones.",
    precautions: "Evitar el contacto con la ropa (mancha). Aplicar en horas de baja radiación solar."
  },
  [OrganicProduct.EM]: {
    properties: "Consorcio de bacterias ácido lácticas, levaduras y bacterias fotosintéticas.",
    benefits: "Acelera descomposición orgánica, inhibe patógenos por competencia, mejora sanidad radicular.",
    precautions: "No mezclar con fungicidas ni bactericidas químicos. Sensible a la luz UV directa."
  },
  [OrganicProduct.MOLASSES]: {
    properties: "Subproducto denso de la caña de azúcar, alto contenido de sacarosa y minerales.",
    benefits: "Fuente energética inmediata para la microbiota del suelo. Ayuda a la adherencia de caldos.",
    precautions: "Diluir totalmente para evitar atracción excesiva de hormigas si se aplica foliarmente."
  },
  [OrganicProduct.SULFUR_FUNGICIDE]: {
    properties: "Azufre elemental en suspensión líquida o flujo molido.",
    benefits: "Control eficaz de oídio, ácaros y trips. Efecto repelente y nutricional secundario.",
    precautions: "No aplicar 3 semanas antes o después de aceites. Fitotóxico en temperaturas >30°C."
  },
  [OrganicProduct.NEEM_EXTRACT]: {
    properties: "Extracto de semilla de Azadirachta indica rico en azadiractina.",
    benefits: "Inhibidor de crecimiento y antialimentario. Sistémico de baja persistencia ambiental.",
    precautions: "Uso preferiblemente preventivo. No aplicar si hay presencia masiva de abejas libando."
  },
  [OrganicProduct.BORON]: {
    properties: "Sal de boro (tetraborato de sodio o ácido bórico).",
    benefits: "Crucial para división celular, formación de flores, transporte de azúcares y cuajado.",
    precautions: "Respetar dosis estrictamente; el boro tiene un rango muy estrecho entre déficit y toxicidad."
  },
  [OrganicProduct.ZINC]: {
    properties: "Sulfato de zinc heptahidratado soluble.",
    benefits: "Precursor de auxinas (hormonas de crecimiento). Evita el arrosetamiento y hojas pequeñas.",
    precautions: "Evitar mezclas directas con fosfatos concentrados para prevenir precipitación."
  },
  [OrganicProduct.COPPER]: {
    properties: "Sulfato de cobre pentahidratado o hidróxido cúprico.",
    benefits: "Fungicida y bactericida preventivo. Participa en la síntesis de lignina y metabolismo N.",
    precautions: "Uso limitado por acumulación en suelo. No aplicar durante la floración sensible."
  },
  [OrganicProduct.COMPOST_TERRABONO]: {
    properties: "Materia orgánica estabilizada por compostaje aeróbico termófilo.",
    benefits: "Aporte gradual de NPK, aumenta retención de humedad y vida microbiana edáfica.",
    precautions: "Asegurar que esté maduro (sin olor a amoníaco). Enterrar ligeramente para evitar deshidratación."
  },
  [OrganicProduct.SEA_SALT]: {
    properties: "Sal marina virgen sin flúor ni yodo añadido.",
    benefits: "Aporta más de 60 oligoelementos. En dosis bajas actúa como bioestimulante mineral.",
    precautions: "No exceder dosis para evitar salinización del suelo. Diluir previamente en agua."
  },
  [OrganicProduct.ROCK_DUST]: {
    properties: "Harina de rocas basálticas o graníticas ricas en silicatos y minerales.",
    benefits: "Remineralización profunda del suelo. Aumenta la resistencia mecánica de los tejidos (Silicio).",
    precautions: "Efecto de liberación lenta. Aplicar preferiblemente en la base del hueco de siembra."
  },
  [OrganicProduct.PHOSPHATE_ROCK]: {
    properties: "Mineral de fósforo de origen sedimentario (Apatita).",
    benefits: "Fuente de fósforo de liberación lenta. Ideal para corregir acidez y deficiencias crónicas.",
    precautions: "Funciona mejor en suelos ácidos (pH < 5.5). Aplicar junto a materia orgánica para activar."
  },
  [OrganicProduct.CALCIUM_CARBONATE]: {
    properties: "Piedra caliza molida finamente (Cal agrícola).",
    benefits: "Corrige pH ácido, aporta calcio estructural, mejora disponibilidad de otros nutrientes.",
    precautions: "No mezclar directamente con fertilizantes nitrogenados amoniacales (pérdida de N)."
  },
  [OrganicProduct.LEONARDITE]: {
    properties: "Carbón oxidado naturalmente, fuente máxima de ácidos húmicos.",
    benefits: "Acondicionador de suelos por excelencia. Desbloquea nutrientes fijados en el suelo.",
    precautions: "Producto de muy alta concentración. Efecto duradero, no requiere aplicaciones frecuentes."
  },
  [OrganicProduct.DIATOMACEOUS_EARTH]: {
    properties: "Fósiles de algas microscópicas compuestas por sílice pura.",
    benefits: "Control físico de insectos rastreros (deshidratación). Aporte de silicio asimilable.",
    precautions: "Usar mascarilla al aplicar en seco para evitar inhalación de polvo. Inerte en mojado."
  },
  [OrganicProduct.MAGNESITE]: {
    properties: "Carbonato de magnesio natural.",
    benefits: "Aporte de magnesio, núcleo de la molécula de clorofila. Esencial para la fotosíntesis.",
    precautions: "Equilibrar con las dosis de calcio para evitar antagonismos nutricionales."
  },
  [OrganicProduct.MYCORRHIZA]: {
    properties: "Inoculante de hongos formadores de micorrizas arbusculares (HMA).",
    benefits: "Simbiosis que expande el sistema radicular hasta 100 veces. Facilita absorción de P y agua.",
    precautions: "Aplicar en contacto directo con las raíces. No usar fungicidas sistémicos tras la aplicación."
  },
  [OrganicProduct.BIO_FLOS]: {
    properties: "Complejo orgánico-mineral diseñado para la etapa reproductiva.",
    benefits: "Estimula la inducción floral, mejora el tamaño y peso del fruto. Reduce caída de flores.",
    precautions: "Seguir el calendario de aplicación según el estado fenológico del cultivo."
  }
};

export const PRODUCT_NUTRIENTS: Record<OrganicProduct, { N: number, P: number, K: number, OM: number }> = {
  [OrganicProduct.POTASSIUM_SOAP]: { N: 0, P: 0, K: 40, OM: 5 },
  [OrganicProduct.LIQUID_HUMUS]: { N: 20, P: 15, K: 20, OM: 80 },
  [OrganicProduct.LIQUID_IRON_OXIDE]: { N: 0, P: 0, K: 0, OM: 2 },
  [OrganicProduct.EM]: { N: 10, P: 10, K: 10, OM: 90 },
  [OrganicProduct.MOLASSES]: { N: 5, P: 2, K: 15, OM: 60 },
  [OrganicProduct.SULFUR_FUNGICIDE]: { N: 0, P: 0, K: 0, OM: 0 },
  [OrganicProduct.NEEM_EXTRACT]: { N: 10, P: 0, K: 0, OM: 10 },
  [OrganicProduct.BORON]: { N: 0, P: 0, K: 0, OM: 0 },
  [OrganicProduct.ZINC]: { N: 0, P: 0, K: 0, OM: 0 },
  [OrganicProduct.COPPER]: { N: 0, P: 0, K: 0, OM: 0 },
  [OrganicProduct.COMPOST_TERRABONO]: { N: 15, P: 15, K: 15, OM: 100 },
  [OrganicProduct.SEA_SALT]: { N: 0, P: 0, K: 5, OM: 0 },
  [OrganicProduct.ROCK_DUST]: { N: 0, P: 10, K: 10, OM: 0 },
  [OrganicProduct.PHOSPHATE_ROCK]: { N: 0, P: 80, K: 0, OM: 0 },
  [OrganicProduct.CALCIUM_CARBONATE]: { N: 0, P: 0, K: 0, OM: 0 },
  [OrganicProduct.LEONARDITE]: { N: 5, P: 2, K: 2, OM: 95 },
  [OrganicProduct.DIATOMACEOUS_EARTH]: { N: 0, P: 5, K: 5, OM: 0 },
  [OrganicProduct.MAGNESITE]: { N: 0, P: 0, K: 0, OM: 0 },
  [OrganicProduct.MYCORRHIZA]: { N: 0, P: 20, K: 0, OM: 30 },
  [OrganicProduct.BIO_FLOS]: { N: 8, P: 4, K: 6, OM: 15 },
};

export const BASE_RATES: Record<OrganicProduct, number> = {
  [OrganicProduct.POTASSIUM_SOAP]: 10,
  [OrganicProduct.LIQUID_HUMUS]: 50,
  [OrganicProduct.LIQUID_IRON_OXIDE]: 5,
  [OrganicProduct.EM]: 15,
  [OrganicProduct.MOLASSES]: 20,
  [OrganicProduct.SULFUR_FUNGICIDE]: 5,
  [OrganicProduct.NEEM_EXTRACT]: 3,
  [OrganicProduct.BORON]: 5,
  [OrganicProduct.ZINC]: 5,
  [OrganicProduct.COPPER]: 3,
  [OrganicProduct.COMPOST_TERRABONO]: 1.5,
  [OrganicProduct.SEA_SALT]: 10,
  [OrganicProduct.ROCK_DUST]: 0.3,
  [OrganicProduct.PHOSPHATE_ROCK]: 0.2,
  [OrganicProduct.CALCIUM_CARBONATE]: 0.5,
  [OrganicProduct.LEONARDITE]: 0.1,
  [OrganicProduct.DIATOMACEOUS_EARTH]: 50,
  [OrganicProduct.MAGNESITE]: 15,
  [OrganicProduct.MYCORRHIZA]: 0.05,
  [OrganicProduct.BIO_FLOS]: 5,
};

export const PRODUCT_UNITS: Record<OrganicProduct, UnitType> = {
  [OrganicProduct.POTASSIUM_SOAP]: 'ml',
  [OrganicProduct.LIQUID_HUMUS]: 'ml',
  [OrganicProduct.LIQUID_IRON_OXIDE]: 'cc',
  [OrganicProduct.EM]: 'ml',
  [OrganicProduct.MOLASSES]: 'ml',
  [OrganicProduct.SULFUR_FUNGICIDE]: 'cc',
  [OrganicProduct.NEEM_EXTRACT]: 'ml',
  [OrganicProduct.BORON]: 'gr',
  [OrganicProduct.ZINC]: 'gr',
  [OrganicProduct.COPPER]: 'gr',
  [OrganicProduct.COMPOST_TERRABONO]: 'kg',
  [OrganicProduct.SEA_SALT]: 'gr',
  [OrganicProduct.ROCK_DUST]: 'kg',
  [OrganicProduct.PHOSPHATE_ROCK]: 'kg',
  [OrganicProduct.CALCIUM_CARBONATE]: 'kg',
  [OrganicProduct.LEONARDITE]: 'kg',
  [OrganicProduct.DIATOMACEOUS_EARTH]: 'gr',
  [OrganicProduct.MAGNESITE]: 'gr',
  [OrganicProduct.MYCORRHIZA]: 'kg',
  [OrganicProduct.BIO_FLOS]: 'ml',
};

export const COLOMBIAN_MARKET_PRICES: Record<OrganicProduct, number> = {
  [OrganicProduct.POTASSIUM_SOAP]: 42,
  [OrganicProduct.LIQUID_HUMUS]: 28,
  [OrganicProduct.LIQUID_IRON_OXIDE]: 52,
  [OrganicProduct.EM]: 34,
  [OrganicProduct.MOLASSES]: 6,
  [OrganicProduct.SULFUR_FUNGICIDE]: 38,
  [OrganicProduct.NEEM_EXTRACT]: 78,
  [OrganicProduct.BORON]: 16,
  [OrganicProduct.ZINC]: 19,
  [OrganicProduct.COPPER]: 24,
  [OrganicProduct.COMPOST_TERRABONO]: 1850,
  [OrganicProduct.SEA_SALT]: 3,
  [OrganicProduct.ROCK_DUST]: 1500,
  [OrganicProduct.PHOSPHATE_ROCK]: 1950,
  [OrganicProduct.CALCIUM_CARBONATE]: 1100,
  [OrganicProduct.LEONARDITE]: 5600,
  [OrganicProduct.DIATOMACEOUS_EARTH]: 14,
  [OrganicProduct.MAGNESITE]: 18,
  [OrganicProduct.MYCORRHIZA]: 8500,
  [OrganicProduct.BIO_FLOS]: 45,
};
