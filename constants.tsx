
import React from 'react';
import { TreeType, OrganicProduct, UnitType } from './types.ts';

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

export const PRODUCT_CATEGORIES = {
  LIQUIDS: [
    OrganicProduct.POTASSIUM_SOAP,
    OrganicProduct.LIQUID_HUMUS,
    OrganicProduct.LIQUID_IRON_OXIDE,
    OrganicProduct.EM,
    OrganicProduct.MOLASSES,
    OrganicProduct.SULFUR_FUNGICIDE,
    OrganicProduct.NEEM_EXTRACT,
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
  ]
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
};

export const PRODUCT_UNITS: Record<OrganicProduct, UnitType> = {
  [OrganicProduct.POTASSIUM_SOAP]: 'ml',
  [OrganicProduct.LIQUID_HUMUS]: 'ml',
  [OrganicProduct.LIQUID_IRON_OXIDE]: 'cc',
  [OrganicProduct.EM]: 'ml',
  [OrganicProduct.MOLASSES]: 'ml',
  [OrganicProduct.SULFUR_FUNGICIDE]: 'cc',
  [OrganicProduct.NEEM_EXTRACT]: 'ml',
  [OrganicProduct.BORON]: 'g',
  [OrganicProduct.ZINC]: 'g',
  [OrganicProduct.COPPER]: 'g',
  [OrganicProduct.COMPOST_TERRABONO]: 'kg',
  [OrganicProduct.SEA_SALT]: 'g',
  [OrganicProduct.ROCK_DUST]: 'kg',
  [OrganicProduct.PHOSPHATE_ROCK]: 'kg',
  [OrganicProduct.CALCIUM_CARBONATE]: 'kg',
  [OrganicProduct.LEONARDITE]: 'kg',
  [OrganicProduct.DIATOMACEOUS_EARTH]: 'g',
  [OrganicProduct.MAGNESITE]: 'g',
};
