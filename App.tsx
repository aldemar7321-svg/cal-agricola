
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, Department, HistoryRecord, ClientData } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, COLOMBIAN_MARKET_PRICES, PRODUCT_CATEGORIES, COMPATIBILITY_RULES, CompatibilityRule, TREE_TYPE_ICONS, PRODUCT_DETAILS, COLOMBIAN_REGIONS } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Componente Visual del Triángulo de Texturas
const SoilTriangleVisual: React.FC<{ sand: number, silt: number, clay: number }> = ({ sand, silt, clay }) => {
  const x = (silt + (clay / 2)) * 2; 
  const y = 173.2 - (clay * 1.732);
  return (
    <div className="relative w-full max-w-[250px] aspect-[1/0.866] mx-auto mb-4 bg-white rounded-xl p-2 border border-slate-200">
      <svg viewBox="0 0 200 173.2" className="w-full h-full">
        <polygon points="100,0 200,173.2 0,173.2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M100,0 L140,69 L60,69 Z" fill="#fee2e2" opacity="0.6" />
        <path d="M60,69 L100,69 L120,104 L40,104 Z" fill="#fef3c7" opacity="0.6" />
        <path d="M0,173.2 L40,104 L80,173.2 Z" fill="#e0f2fe" opacity="0.6" />
        <path d="M200,173.2 L160,104 L120,173.2 Z" fill="#ecfdf5" opacity="0.6" />
        <circle cx={x} cy={y} r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
      </svg>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-700 tracking-tighter">ARCILLA</div>
      <div className="absolute bottom-1 left-2 text-[9px] font-bold text-amber-800 tracking-tighter">ARENA</div>
      <div className="absolute bottom-1 right-2 text-[9px] font-bold text-emerald-800 tracking-tighter">LIMO</div>
    </div>
  );
};

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
    <div className={`p-5 rounded-3xl border-2 transition-all ${hasIncompatible ? 'bg-red-50 border-red-200' : hasCaution ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white shadow-lg ${hasIncompatible ? 'bg-red-600' : hasCaution ? 'bg-amber-500' : 'bg-emerald-600'}`}>
          <i className={`fas ${hasIncompatible ? 'fa-circle-xmark' : hasCaution ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase text-slate-600">Compatibilidad</h4>
          <p className={`text-xs font-black uppercase ${hasIncompatible ? 'text-red-700' : hasCaution ? 'text-amber-700' : 'text-emerald-700'}`}>
            {hasIncompatible ? 'Mezcla Peligrosa' : hasCaution ? 'Precaución Requerida' : 'Mezcla Segura'}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {conflicts.map((c, i) => (
          <div key={i} className="p-3 bg-white rounded-xl text-[10px] font-bold text-slate-800 border border-slate-100 shadow-sm">
            <span className="font-black text-slate-900 uppercase underline decoration-emerald-200 decoration-2">{c.p1} + {c.p2}:</span> {c.rule.reason}
          </div>
        ))}
      </div>
    </div>
  );
};

const BioGenesisLogo = () => (
  <div className="flex items-center gap-3">
    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-xl">
      <i className="fas fa-leaf text-emerald-600 text-2xl"></i>
    </div>
    <div className="flex flex-col">
      <h1 className="text-2xl font-black text-white leading-none tracking-tighter">BioGenesis <span className="text-emerald-400">PRO</span></h1>
      <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-[0.3em] mt-1">Smart Precision Agriculture</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass_pro' | 'vision' | 'history'>('calculator');
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [visionReport, setVisionReport] = useState<VisionReport | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [loading, setLoading] = useState(false);

  const [clientData, setClientData] = useState<ClientData>({
    firstName: '',
    lastName: '',
    location: '',
    contact: '',
    email: ''
  });

  const [input, setInput] = useState<CalculationInput>({
    treeType: TreeType.CITRUS, department: Department.ANTIOQUIA, applicationMode: ApplicationMode.MAINTENANCE,
    soilType: SoilType.FRANCO, soilPercentages: { sand: 40, silt: 40, clay: 20 },
    climate: ClimateType.MODERATE, treeAge: 1, numTrees: 1, grassVariety: GrassVariety.KIKUYO, grassMode: GrassMeasureMode.AREA,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    productPrices: { ...COLOMBIAN_MARKET_PRICES }, manualAmounts: {}, manualPlantAmounts: {}, selectedUnits: {},
    cycleFrequencyValue: 3, cycleFrequencyUnit: 'meses', healthStatus: 'bueno'
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('agro_history_v4');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = () => {
    if (!result) return;
    const newRecord: HistoryRecord = {
      id: Math.random().toString(36).substr(2, 9),
      consecutive: history.length + 1,
      date: new Date().toLocaleString(),
      client: { ...clientData, location: input.department },
      input: { ...input },
      result: { ...result }
    };
    const updated = [newRecord, ...history];
    setHistory(updated);
    localStorage.setItem('agro_history_v4', JSON.stringify(updated));
    alert("Cálculo archivado correctamente.");
  };

  const calculateLocalData = useCallback(() => {
    let modifier = 1.0;
    if (input.healthStatus === 'regular') modifier *= 1.25;
    if (input.healthStatus === 'deficiente') modifier *= 1.5;
    const count = Math.max(1, input.numTrees || 1);
    
    const products: ProductResult[] = input.selectedProducts.map(p => {
      const unit = input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g';
      const price = input.productPrices[p] || 0;
      const baseRate = BASE_RATES[p] || 0;
      
      const amountPerUnit = (input.manualPlantAmounts[p] ?? baseRate) * modifier * (activeTab === 'calculator' ? Math.max(1, input.treeAge || 1) : 1);
      const totalAmount = amountPerUnit * count;
      
      return { 
        product: p, 
        amount: parseFloat(totalAmount.toFixed(2)), 
        unit: unit as UnitType, 
        costPerUnit: price, 
        totalCost: parseFloat((totalAmount * price).toFixed(2)) 
      };
    });
    setResult({ 
      products, 
      totalCostPerUnit: products.reduce((a, b) => a + (b.totalCost / count), 0), 
      totalProjectCost: products.reduce((a, b) => a + b.totalCost, 0), 
      frequency: `Cada ${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}` 
    });
  }, [input, activeTab]);

  useEffect(() => { calculateLocalData(); }, [calculateLocalData]);

  const generateAIPlan = async () => {
    setLoading(true);
    const advice = await getAgriculturalAdvice(input);
    setAiAdvice(advice);
    setLoading(false);
  };

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const margin = 14;
    
    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59);
    doc.text('BioGenesis PRO - Informe de Campo', margin, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text('INFORMACIÓN DEL CLIENTE', margin, 32);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 34, 200, 34);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    const clientName = clientData.firstName || clientData.lastName ? `${clientData.firstName} ${clientData.lastName}` : 'No especificado';
    doc.text(`Cliente: ${clientName}`, margin, 39);
    doc.text(`Contacto: ${clientData.contact || 'N/A'}`, margin, 44);
    doc.text(`Email: ${clientData.email || 'N/A'}`, margin, 49);
    doc.text(`Departamento: ${input.department}`, 120, 39);
    doc.text(`Ubicación: ${clientData.location || 'N/A'}`, 120, 44);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 120, 49);

    autoTable(doc, {
      startY: 65,
      head: [['Componente', 'Porcentaje (%)']],
      body: [
        ['Arena', `${input.soilPercentages?.sand.toFixed(1)}%`],
        ['Limo', `${input.soilPercentages?.silt.toFixed(1)}%`],
        ['Arcilla', `${input.soilPercentages?.clay.toFixed(1)}%`],
        ['Textura Identificada', input.soilType]
      ],
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] }
    });

    const nextY = (doc as any).lastAutoTable.finalY + 10;
    autoTable(doc, {
      startY: nextY,
      head: [['Insumo', `Dosis / ${activeTab === 'grass_pro' ? input.grassMode : 'Planta'}`, 'Total', 'Subtotal']],
      body: result.products.map(p => [
        p.product,
        `${(p.amount / input.numTrees).toFixed(2)} ${p.unit}`,
        `${p.amount.toLocaleString()} ${p.unit}`,
        `$${p.totalCost.toLocaleString()}`
      ]),
      foot: [['', '', 'TOTAL PROYECTO', `$${result.totalProjectCost.toLocaleString()} COP`]],
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59] }
    });

    doc.save(`BioGenesis_Reporte_${clientData.lastName || 'Export'}_${Date.now()}.pdf`);
  };

  const handleSoilPercentChange = (key: 'sand' | 'silt' | 'clay', value: number) => {
    if (!input.soilPercentages) return;
    const clamped = Math.min(100, Math.max(0, value));
    const old = input.soilPercentages[key];
    const diff = clamped - old;
    const keys = (['sand', 'silt', 'clay'] as const).filter(k => k !== key);
    let newP = { ...input.soilPercentages, [key]: clamped };
    const sumOthers = input.soilPercentages[keys[0]] + input.soilPercentages[keys[1]];
    if (sumOthers > 0) {
      newP[keys[0]] = Math.max(0, input.soilPercentages[keys[0]] - (diff * (input.soilPercentages[keys[0]] / sumOthers)));
      newP[keys[1]] = Math.max(0, input.soilPercentages[keys[1]] - (diff * (input.soilPercentages[keys[1]] / sumOthers)));
    } else {
      newP[keys[0]] = (100 - clamped) / 2;
      newP[keys[1]] = (100 - clamped) / 2;
    }

    let texture = SoilType.FRANCO;
    if (newP.clay >= 40) texture = SoilType.ARCILLA;
    else if (newP.sand >= 85) texture = SoilType.ARENA;
    else if (newP.silt >= 80) texture = SoilType.LIMO;
    else if (newP.clay >= 20 && newP.clay < 40 && newP.sand > 45) texture = SoilType.FRANCO_ARENOSO;

    setInput(prev => ({ ...prev, soilPercentages: newP, soilType: texture }));
  };

  const updateProductPrice = (p: OrganicProduct, price: number) => {
    setInput(prev => ({
      ...prev,
      productPrices: { ...prev.productPrices, [p]: price }
    }));
  };

  const updateProductDose = (p: OrganicProduct, dose: number) => {
    setInput(prev => ({
      ...prev,
      manualPlantAmounts: { ...prev.manualPlantAmounts, [p]: dose }
    }));
  };

  const updateProductUnit = (p: OrganicProduct, unit: UnitType) => {
    setInput(prev => ({
      ...prev,
      selectedUnits: { ...prev.selectedUnits, [p]: unit }
    }));
  };

  const renderProductItem = (p: OrganicProduct) => {
    const isSelected = input.selectedProducts.includes(p);
    const details = PRODUCT_DETAILS[p];
    const currentPrice = input.productPrices[p] || 0;
    const currentDose = input.manualPlantAmounts[p] ?? BASE_RATES[p];
    const currentUnit = input.selectedUnits[p] || PRODUCT_UNITS[p];
    
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all duration-300 ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-200 ring-offset-2' : 'bg-slate-50 border-slate-100 opacity-80 hover:opacity-100'}`}>
        <label className="flex items-center gap-3 cursor-pointer group mb-2">
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => setInput(prev => ({ ...prev, selectedProducts: prev.selectedProducts.includes(p) ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} 
            className="accent-emerald-600 h-5 w-5 rounded transition-transform group-active:scale-90" 
          />
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{p}</span>
        </label>
        
        {isSelected && (
          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Panel de Ajustes Rápidos */}
            <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-emerald-100">
               <div className="space-y-1">
                 <label className="text-[8px] font-black text-slate-400 uppercase">Precio / {currentUnit}</label>
                 <div className="relative">
                   <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                   <input 
                    type="number" 
                    value={currentPrice} 
                    onChange={e => updateProductPrice(p, parseFloat(e.target.value) || 0)}
                    className="w-full pl-5 p-1.5 bg-slate-50 rounded-lg text-xs font-black border border-slate-100 focus:ring-1 focus:ring-emerald-500 outline-none"
                   />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[8px] font-black text-slate-400 uppercase">Dosis (x planta)</label>
                 <div className="flex gap-1">
                   <input 
                    type="number" 
                    value={currentDose} 
                    onChange={e => updateProductDose(p, parseFloat(e.target.value) || 0)}
                    className="flex-1 p-1.5 bg-slate-50 rounded-lg text-xs font-black border border-slate-100 outline-none"
                   />
                   <select 
                    value={currentUnit} 
                    onChange={e => updateProductUnit(p, e.target.value as UnitType)}
                    className="bg-slate-100 rounded-lg text-[9px] font-black p-1 outline-none"
                   >
                     {['g','kg','ml','cc','L','galon'].map(u => <option key={u} value={u}>{u}</option>)}
                   </select>
                 </div>
               </div>
            </div>

            {/* Ficha Técnica */}
            {details && (
              <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 space-y-2">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-emerald-700 uppercase flex items-center gap-1"><i className="fas fa-microscope"></i> Propiedades</span>
                  <p className="text-[10px] text-slate-600 leading-tight font-medium">{details.properties}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-blue-700 uppercase flex items-center gap-1"><i className="fas fa-check-circle"></i> Beneficios</span>
                  <p className="text-[10px] text-slate-600 leading-tight font-medium">{details.benefits}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-red-600 uppercase flex items-center gap-1"><i className="fas fa-exclamation-triangle"></i> Precauciones</span>
                  <p className="text-[10px] text-slate-600 leading-tight font-medium italic">{details.precautions}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      <header className="bg-[#064e3b] p-6 sticky top-0 z-50 shadow-2xl no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <BioGenesisLogo />
          <nav className="flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-2xl border border-white/10">
            {['calculator', 'grass_pro', 'vision', 'history'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-white text-[#064e3b] shadow-xl' : 'text-white hover:bg-white/10'}`}>
                {tab === 'calculator' ? 'FRUTALES' : tab === 'grass_pro' ? 'CÉSPED' : tab === 'vision' ? 'IA VISION' : 'HISTORIAL'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {(activeTab === 'calculator' || activeTab === 'grass_pro') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <aside className="lg:col-span-4 space-y-8 no-print">
              
              {/* Bloque Datos del Cliente */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-[11px] font-black mb-5 text-slate-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-user-tie"></i> Perfil del Productor
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Nombre" />
                    <input type="text" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Apellido" />
                  </div>
                  <input type="text" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Celular" />
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Departamento (Ubicación Geográfica)</label>
                    <select 
                      value={input.department} 
                      onChange={e => setInput({...input, department: e.target.value as Department})}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {COLOMBIAN_REGIONS.map(region => (
                        <optgroup key={region.name} label={region.name}>
                          {region.departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Perfil Suelo */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-[11px] font-black mb-4 text-emerald-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-mountain"></i> Análisis de Textura
                </h2>
                <SoilTriangleVisual sand={input.soilPercentages!.sand} silt={input.soilPercentages!.silt} clay={input.soilPercentages!.clay} />
                <div className="space-y-5 mt-4">
                  {['sand', 'silt', 'clay'].map(k => (
                    <div key={k} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase text-slate-600 tracking-tight">{k === 'sand' ? 'Arena' : k === 'silt' ? 'Limo' : 'Arcilla'}</span>
                        <div className="flex items-center gap-1">
                           <input type="number" step="0.1" value={input.soilPercentages![k as keyof typeof input.soilPercentages].toFixed(1)} onChange={e => handleSoilPercentChange(k as any, parseFloat(e.target.value))} className="w-14 p-1 border-b border-slate-200 font-black text-right text-xs outline-none focus:border-emerald-500 bg-transparent" />
                           <span className="text-[10px] font-bold text-slate-400">%</span>
                        </div>
                      </div>
                      <input type="range" min="0" max="100" step="0.1" value={input.soilPercentages![k as keyof typeof input.soilPercentages]} onChange={e => handleSoilPercentChange(k as any, parseFloat(e.target.value))} className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${k === 'sand' ? 'accent-amber-600' : k === 'silt' ? 'accent-emerald-600' : 'accent-red-600'} bg-slate-100`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Catálogo */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-[11px] font-black mb-5 text-emerald-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-vial"></i> Catálogo de Insumos
                </h2>
                <div className="max-h-[600px] overflow-y-auto space-y-4 custom-scrollbar pr-2">
                  <h3 className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-50 pb-1">Biológicos & Líquidos</h3>
                  {PRODUCT_CATEGORIES.LIQUIDS.map(p => renderProductItem(p))}
                  <h3 className="text-[9px] font-black text-amber-700 uppercase border-b border-amber-50 pb-1 mt-6">Sólidos & Minerales</h3>
                  {PRODUCT_CATEGORIES.SOLIDS.map(p => renderProductItem(p))}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-8">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-emerald-50/50">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10 border-b border-slate-100 pb-8">
                   <div>
                     <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-3">
                       {activeTab === 'grass_pro' ? `Grama ${input.grassVariety}` : input.treeType}
                     </h3>
                     <div className="flex flex-wrap gap-2">
                        <span className="px-4 py-1.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase shadow-sm">
                          {input.numTrees} {activeTab === 'grass_pro' ? input.grassMode : 'plantas'}
                        </span>
                        <span className="px-4 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full uppercase shadow-sm">
                          {input.department}
                        </span>
                        <span className="px-4 py-1.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase shadow-sm">
                          Salud: {input.healthStatus}
                        </span>
                     </div>
                   </div>
                   <div className="flex gap-3 w-full md:w-auto">
                     <button onClick={saveToHistory} className="flex-1 md:flex-none bg-slate-900 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase hover:bg-black transition-all shadow-xl flex items-center justify-center gap-2">
                       <i className="fas fa-save"></i> Guardar
                     </button>
                     <button onClick={exportPDF} className="flex-1 md:flex-none bg-emerald-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase hover:bg-emerald-700 transition-all shadow-xl flex items-center justify-center gap-2">
                       <i className="fas fa-file-pdf"></i> PDF
                     </button>
                   </div>
                </div>
                
                {result && result.products.length > 0 ? (
                  <div className="space-y-12">
                    <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                          <tr><th className="p-6">Insumo</th><th className="p-6">Dosis / Planta</th><th className="p-6">Cantidad Total</th><th className="p-6">Presupuesto</th></tr>
                        </thead>
                        <tbody className="text-xs font-bold text-slate-700">
                          {result.products.map((p, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-emerald-50/30 transition-colors">
                              <td className="p-6 uppercase text-slate-900 font-black">{p.product}</td>
                              <td className="p-6">
                                <span className="text-emerald-700 font-black text-sm">{(p.amount / input.numTrees).toFixed(2)} {p.unit}</span>
                              </td>
                              <td className="p-6">
                                <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-600 border border-slate-200">{p.amount.toLocaleString()} {p.unit}</span>
                              </td>
                              <td className="p-6 text-slate-900 font-black text-sm">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#064e3b] text-white">
                          <tr>
                            <td colSpan={3} className="p-8 font-black uppercase text-[12px] tracking-widest text-emerald-200">Inversión Estimada Proyecto</td>
                            <td className="p-8 font-black text-3xl text-emerald-400 tracking-tighter">
                              ${result.totalProjectCost.toLocaleString()} <span className="text-[10px] opacity-60 font-medium">COP</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <i className="fas fa-calculator text-4xl text-slate-200 mb-8 mx-auto"></i>
                    <p className="text-slate-500 font-black uppercase text-sm tracking-widest">Inicie seleccionando insumos de la izquierda</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'vision' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
            <div className="bg-white p-14 rounded-[3.5rem] shadow-2xl text-center border-4 border-emerald-50">
              <h2 className="text-4xl font-black text-[#064e3b] mb-4 uppercase tracking-tighter">BioGenesis Vision IA</h2>
              <div className="relative group border-4 border-dashed border-slate-200 rounded-[3.5rem] p-14 bg-slate-50 transition-all hover:border-emerald-300">
                {visionImage ? (
                  <img src={visionImage} className="aspect-video rounded-[2.5rem] object-cover mx-auto" />
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <i className="fas fa-camera text-5xl text-emerald-500 mb-4"></i>
                    <span className="text-xs font-black uppercase text-slate-500">Subir foto de muestra</span>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setVisionImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
            <h2 className="text-4xl font-black text-[#064e3b] uppercase tracking-tighter">Historial de Proyectos</h2>
            {history.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {history.map(record => (
                  <div key={record.id} className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-200 group transition-all hover:border-emerald-500">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-3">{record.date}</span>
                    <h3 className="text-2xl font-black text-slate-900 uppercase mb-2">{record.input.treeType}</h3>
                    <p className="text-[11px] font-bold text-emerald-700 uppercase bg-emerald-50 px-3 py-1 rounded-full w-fit mb-8">
                      Cliente: {record.client.firstName} {record.client.lastName}
                    </p>
                    <div className="flex justify-between items-center pt-8 border-t border-slate-50">
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">${record.result.totalProjectCost.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-48 bg-white rounded-[4rem] border-4 border-dashed border-slate-200 text-slate-300 font-black uppercase">Bitácora Vacía</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
