
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, FrequencyUnit, Department, ClientData, HistoryRecord } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, TREE_TYPE_ICONS, PRODUCT_NUTRIENTS, COLOMBIAN_MARKET_PRICES, PRODUCT_CATEGORIES, DEPARTMENT_CLIMATE_MAP, PRODUCT_DETAILS, COMPATIBILITY_RULES, CompatibilityRule } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

// Componente Visual del Triángulo de Texturas (SVG Dinámico)
const SoilTriangleVisual: React.FC<{ sand: number, silt: number, clay: number }> = ({ sand, silt, clay }) => {
  const x = (silt + (clay / 2)) * 2; 
  const y = 173.2 - (clay * 1.732);
  return (
    <div className="relative w-full max-w-[250px] aspect-[1/0.866] mx-auto mb-4 bg-white/50 rounded-xl p-2 border border-slate-100 shadow-inner">
      <svg viewBox="0 0 200 173.2" className="w-full h-full drop-shadow-sm">
        <polygon points="100,0 200,173.2 0,173.2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M100,0 L140,69 L60,69 Z" fill="#fee2e2" stroke="none" opacity="0.6" />
        <path d="M60,69 L100,69 L120,104 L40,104 Z" fill="#fef3c7" stroke="none" opacity="0.6" />
        <path d="M0,173.2 L40,104 L80,173.2 Z" fill="#e0f2fe" stroke="none" opacity="0.6" />
        <path d="M200,173.2 L160,104 L120,173.2 Z" fill="#ecfdf5" stroke="none" opacity="0.6" />
        <circle cx={x} cy={y} r="5" fill="#ef4444" stroke="white" strokeWidth="2" className="transition-all duration-500 ease-out shadow-lg" />
        <circle cx={x} cy={y} r="8" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping opacity-20" />
      </svg>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[7px] font-black text-red-500 uppercase">Arcilla</div>
      <div className="absolute bottom-0 left-2 text-[7px] font-black text-amber-600 uppercase">Arena</div>
      <div className="absolute bottom-0 right-2 text-[7px] font-black text-emerald-600 uppercase">Limo</div>
    </div>
  );
};

// Componente de Verificador de Mezclas
const MixHealthChecker: React.FC<{ selectedProducts: OrganicProduct[] }> = ({ selectedProducts }) => {
  const conflicts = useMemo(() => {
    const list: { p1: string, p2: string, rule: CompatibilityRule }[] = [];
    for (let i = 0; i < selectedProducts.length; i++) {
      for (let j = i + 1; j < selectedProducts.length; j++) {
        const p1 = selectedProducts[i];
        const p2 = selectedProducts[j];
        const rule = COMPATIBILITY_RULES[p1]?.[p2] || COMPATIBILITY_RULES[p2]?.[p1];
        if (rule) list.push({ p1, p2, rule });
      }
    }
    return list;
  }, [selectedProducts]);

  if (selectedProducts.length < 2) return null;

  const hasIncompatible = conflicts.some(c => c.rule.status === 'incompatible');
  const hasCaution = conflicts.some(c => c.rule.status === 'caution');

  return (
    <div className={`p-5 rounded-3xl border-2 transition-all animate-in slide-in-from-top duration-500 ${hasIncompatible ? 'bg-red-50 border-red-200' : hasCaution ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white shadow-lg ${hasIncompatible ? 'bg-red-600' : hasCaution ? 'bg-amber-500' : 'bg-emerald-600'}`}>
          <i className={`fas ${hasIncompatible ? 'fa-circle-xmark' : hasCaution ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estado de la Mezcla</h4>
          <p className={`text-xs font-black uppercase ${hasIncompatible ? 'text-red-700' : hasCaution ? 'text-amber-700' : 'text-emerald-700'}`}>
            {hasIncompatible ? 'Mezcla Peligrosa / Inviable' : hasCaution ? 'Mezcla con Restricciones' : 'Mezcla Segura / Sinergia'}
          </p>
        </div>
      </div>
      
      {conflicts.length > 0 ? (
        <div className="space-y-3">
          {conflicts.map((c, i) => (
            <div key={i} className={`p-3 rounded-xl border ${c.rule.status === 'incompatible' ? 'bg-white border-red-100' : c.rule.status === 'caution' ? 'bg-white border-amber-100' : 'bg-white border-emerald-100'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black text-slate-800 uppercase">{c.p1} + {c.p2}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${c.rule.status === 'incompatible' ? 'bg-red-100 text-red-700' : c.rule.status === 'caution' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.rule.status}</span>
              </div>
              <p className="text-[9px] font-bold text-slate-500 italic leading-tight">{c.rule.reason}</p>
              {c.rule.maxMixRatio && <div className="mt-2 text-[8px] font-black text-emerald-600 border-t pt-1 uppercase">Dosis Máx: {c.rule.maxMixRatio}</div>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] font-bold text-emerald-700 italic">No se detectan antagonismos químicos conocidos para esta combinación.</p>
      )}
    </div>
  );
};

const getCropSuitability = (soil: SoilType) => {
  const recommendations: Record<string, { crops: string[], advice: string, icon: string, color: string }> = {
    [SoilType.ARENA]: { crops: ['Coco', 'Sandía', 'Yuca', 'Piña'], advice: 'Drenaje excesivo. Requiere mucha materia orgánica.', icon: 'fa-umbrella-beach', color: 'text-amber-600' },
    [SoilType.ARENO_FRANCO]: { crops: ['Cítricos', 'Espárragos', 'Maní'], advice: 'Bueno para raíces profundas. Cuidado con lixiviación.', icon: 'fa-sun', color: 'text-orange-500' },
    [SoilType.FRANCO_ARENOSO]: { crops: ['Café', 'Aguacate Hass', 'Maíz'], advice: 'Excelente equilibrio. Común en laderas andinas.', icon: 'fa-mountain', color: 'text-emerald-600' },
    [SoilType.FRANCO]: { crops: ['Hortalizas', 'Flores', 'Frutales EXPO'], advice: 'Suelo Ideal. Retención perfecta de nutrientes.', icon: 'fa-star', color: 'text-emerald-500' },
    [SoilType.FRANCO_LIMOSO]: { crops: ['Caña Panelera', 'Trigo', 'Cebada'], advice: 'Fértil pero propenso a compactación.', icon: 'fa-wheat-awn', color: 'text-yellow-600' },
    [SoilType.LIMO]: { crops: ['Arroz de secano', 'Bosques Nativos'], advice: 'Suelo "jabonoso". Manejar escorrentía.', icon: 'fa-water', color: 'text-blue-500' },
    [SoilType.FRANCO_ARCILLO_ARENOSO]: { crops: ['Plátano', 'Banano', 'Palma'], advice: 'Firme y nutritivo. Ideal para zonas bajas.', icon: 'fa-leaf', color: 'text-green-600' },
    [SoilType.FRANCO_ARCILLOSO]: { crops: ['Cacao', 'Mango', 'Cítricos'], advice: 'Alta fertilidad natural. Vigilar drenajes.', icon: 'fa-seedling', color: 'text-teal-600' },
    [SoilType.ARCILLO_ARENOSO]: { crops: ['Arroz', 'Sorgos', 'Pastos'], advice: 'Suelo pesado. Retiene agua en zonas secas.', icon: 'fa-cow', color: 'text-slate-600' },
    [SoilType.ARCILLA]: { crops: ['Caña de Azúcar', 'Arroz inundado'], advice: 'Extremadamente pesado. Difícil mecanización.', icon: 'fa-tractor', color: 'text-red-700' },
    [SoilType.FRANCO_ARCILLO_LIMOSO]: { crops: ['Mora', 'Uchuva', 'Fresa'], advice: 'Climas fríos. Nutritivo pero lento drenaje.', icon: 'fa-apple-whole', color: 'text-pink-600' },
    [SoilType.ARCILLO_LIMOSO]: { crops: ['Pastos resistentes', 'Caucho'], advice: 'Prefiere especies rústicas. Poco oxígeno.', icon: 'fa-tree', color: 'text-green-800' }
  };
  return recommendations[soil] || { crops: ['Consultar experto'], advice: 'Textura compleja.', icon: 'fa-question', color: 'text-slate-400' };
};

const getRegionalContext = (dept: Department) => {
  const alerts: Record<string, string> = {
    'ANTIOQUIA': 'Región cafetera y lechera. Vigilar acidez por aluminio en zonas de montaña.',
    'VALLE_CAUCA': 'Líder en caña. Suelos con alta materia orgánica pero pesados.',
    'META': 'Suelos de altillanura (Oxisoles). Requieren alta remineralización y fósforo.',
    'CORDOBA': 'Clima seco/cálido. Riesgo de salinización por riego inadecuado.',
    'HUILA': 'Cafés especiales. Suelos volcánicos con alta retención de fósforo.',
    'CUNDINAMARCA': 'Hortalizas y flores. Riesgo de compactación por uso intensivo.'
  };
  return alerts[dept] || 'Zona con alto potencial agrícola. Ajustar fertilización según clima local.';
};

const calculateSoilTexture = (sand: number, silt: number, clay: number): SoilType => {
  if (silt + 1.5 * clay < 15) return SoilType.ARENA;
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return SoilType.ARENO_FRANCO;
  if (clay >= 40) {
    if (sand > 45) return SoilType.ARCILLO_ARENOSO;
    if (silt > 40) return SoilType.ARCILLO_LIMOSO;
    return SoilType.ARCILLA;
  }
  if (clay >= 27 && clay < 40) {
    if (sand > 45) return SoilType.FRANCO_ARCILLO_ARENOSO;
    if (silt > 40) return SoilType.FRANCO_ARCILLO_LIMOSO;
    return SoilType.FRANCO_ARCILLOSO;
  }
  if (clay < 27) {
    if (silt >= 80) return SoilType.LIMO;
    if (silt >= 50) return SoilType.FRANCO_LIMOSO;
    if (sand > 52) return SoilType.FRANCO_ARENOSO;
    return SoilType.FRANCO;
  }
  return SoilType.FRANCO;
};

const BioGenesisLogo = () => (
  <div className="flex flex-col items-center md:items-start group transition-transform duration-300 hover:scale-105">
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
          <path d="M50 10 C 65 30 65 70 50 90 C 35 70 35 30 50 10" fill="url(#leafGradient)" />
          <path d="M50 45 C 75 45 90 65 90 85 C 70 85 50 65 50 45" fill="url(#leafGradient)" className="opacity-80" />
          <path d="M50 45 C 25 45 10 65 10 85 C 30 85 50 65 50 45" fill="url(#leafGradient)" className="opacity-80" />
          <defs>
            <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#34d399', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#2dd4bf', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="flex flex-col">
        <h1 className="text-3xl font-black tracking-tighter leading-none flex items-baseline">
          <span className="text-white">Bio</span>
          <span className="text-teal-400">Genesis</span>
          <span className="text-teal-300 text-xs ml-0.5">.</span>
        </h1>
        <p className="text-[8px] font-bold text-teal-100 uppercase tracking-[0.2em] mt-0.5 opacity-90">
          "Soluciones vivas, resultados extraordinarios"
        </p>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass_pro' | 'vision' | 'history'>('calculator');
  const [resultTab, setResultTab] = useState<'table' | 'analytics'>('table');
  const [showAIPlantPlan, setShowAIPlantPlan] = useState(false);
  const [clientData, setClientData] = useState<ClientData>({ firstName: '', lastName: '', location: '', contact: '', email: '' });
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [input, setInput] = useState<CalculationInput>({
    treeType: TreeType.CITRUS, department: Department.ANTIOQUIA, applicationMode: ApplicationMode.MAINTENANCE,
    soilType: SoilType.FRANCO, soilPercentages: { sand: 40, silt: 40, clay: 20 },
    climate: ClimateType.MODERATE, treeAge: 1, numTrees: 1,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    productPrices: { ...COLOMBIAN_MARKET_PRICES }, manualAmounts: {}, manualPlantAmounts: {}, selectedUnits: {},
    cycleFrequencyValue: 3, cycleFrequencyUnit: 'meses', healthStatus: 'bueno'
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  
  useEffect(() => {
    const savedHistory = localStorage.getItem('agro_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const isGrassTab = activeTab === 'grass_pro';
  const speciesName = isGrassTab ? `Grama ${input.grassVariety}` : input.treeType;
  const currentUnitLabel = isGrassTab ? input.grassMode : 'plantas';

  const calculateLocalData = useCallback(() => {
    let modifier = 1.0;
    if (input.healthStatus === 'regular') modifier *= 1.25;
    if (input.healthStatus === 'deficiente') modifier *= 1.5;
    if (input.soilType.toLowerCase().includes('arena')) modifier *= 1.25;
    if (input.soilType.toLowerCase().includes('arcilla')) modifier *= 0.9;
    const count = Math.max(1, input.numTrees || 1);
    const products: ProductResult[] = input.selectedProducts.map(p => {
      const unit = input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g';
      const price = input.productPrices[p] || 0;
      let amount: number;
      if (input.manualPlantAmounts[p] !== undefined) {
        amount = (input.manualPlantAmounts[p] || 0) * count;
      } else {
        const baseMult = (input.treeType === TreeType.GRASS) ? count : Math.max(1, input.treeAge || 1) * count;
        amount = baseMult * (BASE_RATES[p] || 0) * modifier;
      }
      return { product: p, amount: parseFloat(amount.toFixed(2)) || 0, unit: unit as UnitType, costPerUnit: price, totalCost: parseFloat((amount * price).toFixed(2)) || 0 };
    });
    setResult({ products, totalCostPerUnit: 0, totalProjectCost: products.reduce((a, b) => a + b.totalCost, 0), frequency: `Cada ${input.cycleFrequencyValue || 1} ${input.cycleFrequencyUnit}` });
  }, [input]);

  useEffect(() => { calculateLocalData(); }, [calculateLocalData]);

  const handleSoilPercentChange = (key: 'sand' | 'silt' | 'clay', value: number) => {
    if (!input.soilPercentages) return;
    const clampedValue = Math.min(100, Math.max(0, value));
    const oldVal = input.soilPercentages[key];
    const diff = clampedValue - oldVal;
    const keys = (['sand', 'silt', 'clay'] as const).filter(k => k !== key);
    const sumOthers = input.soilPercentages[keys[0]] + input.soilPercentages[keys[1]];
    let newPercentages = { ...input.soilPercentages, [key]: clampedValue };
    
    if (sumOthers > 0) {
      newPercentages[keys[0]] = Math.max(0, input.soilPercentages[keys[0]] - (diff * (input.soilPercentages[keys[0]] / sumOthers)));
      newPercentages[keys[1]] = Math.max(0, input.soilPercentages[keys[1]] - (diff * (input.soilPercentages[keys[1]] / sumOthers)));
    } else {
      newPercentages[keys[0]] = (100 - clampedValue) / 2;
      newPercentages[keys[1]] = (100 - clampedValue) / 2;
    }

    // Asegurar que la suma sea exactamente 100 debido a errores de punto flotante
    const total = newPercentages.sand + newPercentages.silt + newPercentages.clay;
    if (total !== 100) {
        newPercentages[keys[1]] += (100 - total);
    }

    const newTexture = calculateSoilTexture(newPercentages.sand, newPercentages.silt, newPercentages.clay);
    setInput(prev => ({ ...prev, soilPercentages: newPercentages, soilType: newTexture }));
  };

  const suitability = useMemo(() => getCropSuitability(input.soilType), [input.soilType]);
  const regionalContext = useMemo(() => getRegionalContext(input.department), [input.department]);
  const chartData = useMemo(() => result?.products.map(p => ({ name: p.product, value: p.totalCost })) || [], [result]);

  const renderProductItem = (p: OrganicProduct) => {
    const selected = input.selectedProducts.includes(p);
    const unit = input.selectedUnits[p] || PRODUCT_UNITS[p];
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${selected ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.01]' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
        <label className="flex items-center gap-3 cursor-pointer mb-2">
          <input type="checkbox" checked={selected} onChange={() => setInput(prev => ({ ...prev, selectedProducts: selected ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="accent-emerald-600 h-5 w-5" />
          <span className="text-xs font-black text-black uppercase">{p}</span>
        </label>
        {selected && (
          <div className="space-y-4 mt-3 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-emerald-700 block">Dosis Individual</label>
                <div className="flex gap-1">
                  <input type="number" step="0.01" value={input.manualPlantAmounts[p] ?? ''} onChange={e => setInput({...input, manualPlantAmounts: {...input.manualPlantAmounts, [p]: e.target.value === '' ? undefined : parseFloat(e.target.value)}})} placeholder="0.00" className="flex-1 p-2 text-xs border rounded-lg font-black bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-black" />
                  <select value={unit} onChange={e => setInput({...input, selectedUnits: {...input.selectedUnits, [p]: e.target.value as UnitType}})} className="w-16 p-2 text-[10px] border rounded-lg font-black bg-slate-50 cursor-pointer text-black"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="cc">cc</option><option value="L">L</option></select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-500 block">Precio / {unit}</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">$</span>
                  <input type="number" value={input.productPrices[p] || ''} onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})} className="w-full p-2 pl-5 text-xs border rounded-lg font-black bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-black" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] pb-24 text-[#111827]">
      <header className="bg-gradient-to-r from-[#064e3b] to-[#115e59] text-white p-6 shadow-2xl sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <BioGenesisLogo />
          <nav className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20 shadow-inner">
            {['calculator', 'grass_pro', 'vision', 'history'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-2 rounded-full text-[10px] font-black transition-all duration-300 ${activeTab === tab ? 'bg-white text-[#064e3b] shadow-xl scale-105' : 'text-white hover:bg-white/10 hover:scale-105'}`}>
                {tab === 'calculator' ? 'CULTIVOS' : tab === 'grass_pro' ? 'CÉSPED' : tab === 'vision' ? 'IA VISION' : 'HISTORIAL'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-4 space-y-6 no-print">
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border-4 border-amber-50 relative overflow-hidden group">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-black text-amber-800 flex items-center gap-2"><i className="fas fa-mountain"></i> Análisis de Granulometría</h2>
                <div className="flex items-center gap-1 bg-emerald-100 px-2 py-1 rounded-full">
                    <i className="fas fa-check-circle text-emerald-600 text-[10px]"></i>
                    <span className="text-[9px] font-black text-emerald-800 uppercase">Balance 100%</span>
                </div>
              </div>

              <SoilTriangleVisual sand={input.soilPercentages!.sand} silt={input.soilPercentages!.silt} clay={input.soilPercentages!.clay} />
              
              <div className="space-y-4">
                {['sand', 'silt', 'clay'].map((k) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className={`text-[9px] font-black uppercase ${k === 'sand' ? 'text-amber-700' : k === 'silt' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {k === 'sand' ? 'Arena' : k === 'silt' ? 'Limo' : 'Arcilla'}
                      </label>
                      <div className="relative flex items-center">
                        <input 
                            type="number" 
                            step="0.1"
                            min="0"
                            max="100"
                            value={(input.soilPercentages as any)[k].toFixed(1)} 
                            onChange={e => handleSoilPercentChange(k as any, parseFloat(e.target.value) || 0)}
                            className="w-16 p-1 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <span className="ml-1 text-[10px] font-black text-slate-400">%</span>
                      </div>
                    </div>
                    <input type="range" min="0" max="100" step="0.1" value={(input.soilPercentages as any)[k]} onChange={e => handleSoilPercentChange(k as any, parseFloat(e.target.value))} className={`w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer ${k === 'sand' ? 'accent-amber-600' : k === 'silt' ? 'accent-emerald-600' : 'accent-red-600'}`} />
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-slate-800 text-white shadow-lg flex items-center gap-4 border-2 border-white/20">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl bg-white/10 ${suitability.color}`}><i className={`fas ${suitability.icon}`}></i></div>
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-80 block">Suelo Determinado</span>
                  <span className="text-sm font-black uppercase">{input.soilType}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-xl border-4 border-emerald-50">
              <h2 className="text-sm font-black mb-4 text-emerald-800 flex items-center gap-2"><i className="fas fa-vial-circle-check"></i> Inteligencia de Mezcla</h2>
              <MixHealthChecker selectedProducts={input.selectedProducts} />
              {input.selectedProducts.length < 2 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                   <p className="text-[9px] font-bold text-slate-400 uppercase leading-tight">Seleccione al menos dos productos para analizar compatibilidad biológica.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
              <h2 className="text-sm font-black mb-4 text-[#064e3b] flex items-center gap-2"><i className="fas fa-boxes"></i> Portafolio Orgánico</h2>
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                <h3 className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-100 pb-1">Concentrados Líquidos</h3>
                {PRODUCT_CATEGORIES.LIQUIDS.map(p => renderProductItem(p))}
                <h3 className="text-[9px] font-black text-amber-700 uppercase border-b border-amber-100 pb-1">Sólidos & Minerales</h3>
                {PRODUCT_CATEGORIES.SOLIDS.map(p => renderProductItem(p))}
              </div>
            </div>
          </aside>

          <section className="lg:col-span-8 space-y-8">
            {result && result.products.length > 0 ? (
              <div className="space-y-6 animate-in fade-in zoom-in duration-700">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50 overflow-hidden relative">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                      <h3 className="text-2xl font-black text-[#111827] uppercase leading-tight tracking-tighter">Plan de Nutrición</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{speciesName} • {input.numTrees} {currentUnitLabel}</p>
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-xl border">
                      <button onClick={() => setResultTab('table')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${resultTab === 'table' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}>Listado</button>
                      <button onClick={() => setResultTab('analytics')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${resultTab === 'analytics' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}>Analítica</button>
                    </div>
                  </div>

                  {resultTab === 'table' ? (
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase border-b text-slate-500">
                          <tr><th className="p-5">Insumo</th><th className="p-5">Dosis Total</th><th className="p-5">Costo</th></tr>
                        </thead>
                        <tbody className="text-xs text-black font-medium">
                          {result.products.map((p, idx) => (
                            <tr key={idx} className="border-t hover:bg-emerald-50/20 transition-colors">
                              <td className="p-5 font-bold uppercase text-slate-800">{p.product}</td>
                              <td className="p-5"><span className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm text-black rounded-lg font-black">{p.amount.toLocaleString()} {p.unit}</span></td>
                              <td className="p-5 font-black text-emerald-900 text-sm">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-emerald-900 text-white">
                          <tr>
                            <td colSpan={2} className="p-6 font-black uppercase tracking-widest text-[10px]">Total Inversión</td>
                            <td className="p-6 font-black text-xl text-emerald-300">${result.totalProjectCost.toLocaleString()} COP</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="h-[400px] w-full p-4 flex flex-col items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#064e3b', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'][index % 5]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[3rem] p-24 text-center border-4 border-dashed border-slate-100 shadow-inner flex flex-col items-center">
                <div className="h-32 w-32 bg-slate-50 rounded-full flex items-center justify-center mb-8 text-6xl text-slate-100 shadow-inner relative">
                  <i className="fas fa-tractor"></i>
                </div>
                <h3 className="text-3xl font-black text-[#064e3b] mb-3 uppercase tracking-tighter">Configure su Suelo</h3>
                <p className="text-slate-400 text-sm font-medium max-w-sm mb-8">Ajuste los porcentajes y seleccione insumos para analizar compatibilidad.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
