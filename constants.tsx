
import React from 'react';
import { TreeType, OrganicProduct, UnitType } from './types';

export const TREE_TYPE_ICONS: Record<TreeType, React.ReactNode> = {
  [TreeType.CITRUS]: <i className="fas fa-lemon text-yellow-500"></i>,
  [TreeType.PLANTAIN]: <i className="fas fa-leaf text-green-600"></i>,
  [TreeType.BANANA]: <i className="fas fa-leaf text-yellow-400"></i>,
  [TreeType.CASSAVA]: <i className="fas fa-seedling text-amber-700"></i>,
  [TreeType.AVOCADO]: <i className="fas fa-seedling text-green-700"></i>,
  [TreeType.COFFEE]: <i className="fas fa-mug-hot text-amber-900"></i>,
  [TreeType.CACAO]: <i className="fas fa-cookie text-amber-800"></i>,
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
