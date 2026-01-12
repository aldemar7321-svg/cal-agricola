
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, FrequencyUnit, Department, ClientData, HistoryRecord } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, TREE_TYPE_ICONS, PRODUCT_NUTRIENTS, COLOMBIAN_MARKET_PRICES, PRODUCT_CATEGORIES, DEPARTMENT_CLIMATE_MAP } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass_pro' | 'vision' | 'history'>('calculator');
  const [showPlantPlan, setShowPlantPlan] = useState(false);
  const [showAIPlantPlan, setShowAIPlantPlan] = useState(false);
  const [clientData, setClientData] = useState<ClientData>({
    firstName: '',
    lastName: '',
    location: '',
    contact: '',
    email: ''
  });
  
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [input, setInput] = useState<CalculationInput>({
    treeType: TreeType.CITRUS,
    department: Department.ANTIOQUIA,
    applicationMode: ApplicationMode.MAINTENANCE,
    grassVariety: GrassVariety.KIKUYO,
    soilType: SoilType.LOAMY,
    climate: ClimateType.MODERATE,
    treeAge: 1,
    numTrees: 1,
    grassMode: GrassMeasureMode.AREA,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    productPrices: { ...COLOMBIAN_MARKET_PRICES },
    manualAmounts: {},
    manualPlantAmounts: {},
    selectedUnits: {},
    cycleFrequencyValue: 3,
    cycleFrequencyUnit: 'meses',
    healthStatus: 'bueno'
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [visionReport, setVisionReport] = useState<VisionReport | null>(null);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const aiSectionRef = useRef<HTMLDivElement>(null);
  const visionFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('agro_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveToHistory = () => {
    if (!result) return;
    
    const nextConsecutive = history.length > 0 
      ? Math.max(...history.map(h => h.consecutive)) + 1 
      : 1;

    const newRecord: HistoryRecord = {
      id: crypto.randomUUID(),
      consecutive: nextConsecutive,
      date: new Date().toLocaleString(),
      client: { ...clientData },
      input: { ...input },
      result: { ...result }
    };

    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('agro_history', JSON.stringify(updatedHistory));
    alert(`Registro #${nextConsecutive} guardado exitosamente para ${clientData.firstName || 'Cliente'}.`);
  };

  const deleteHistoryRecord = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      const updated = history.filter(h => h.id !== id);
      setHistory(updated);
      localStorage.setItem('agro_history', JSON.stringify(updated));
    }
  };

  const isGrassTab = activeTab === 'grass_pro';
  const currentType = isGrassTab ? TreeType.GRASS : input.treeType;
  const currentUnitLabel = isGrassTab ? input.grassMode : 'plantas';
  const speciesName = isGrassTab ? `Grama ${input.grassVariety}` : input.treeType;

  const calculateLocalData = useCallback(() => {
    let modifier = 1.0;
    if (input.healthStatus === 'regular') modifier *= 1.25;
    if (input.healthStatus === 'deficiente') modifier *= 1.5;
    if (input.soilType === SoilType.SANDY) modifier *= 1.2;

    const count = Math.max(1, input.numTrees || 1);

    const products: ProductResult[] = input.selectedProducts.map(p => {
      const unit = input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g';
      const price = input.productPrices[p] || 0;
      
      let amount: number;
      if (input.manualPlantAmounts[p] !== undefined) {
        amount = (input.manualPlantAmounts[p] || 0) * count;
      } else {
        const baseMult = (currentType === TreeType.GRASS) ? count : Math.max(1, input.treeAge || 1) * count;
        amount = baseMult * (BASE_RATES[p] || 0) * modifier;
      }
      
      return {
        product: p,
        amount: parseFloat(amount.toFixed(2)) || 0,
        unit: unit as UnitType,
        costPerUnit: price,
        totalCost: parseFloat((amount * price).toFixed(2)) || 0
      };
    });

    setResult({
      products,
      totalCostPerUnit: 0,
      totalProjectCost: products.reduce((a, b) => a + b.totalCost, 0),
      frequency: `Cada ${input.cycleFrequencyValue || 1} ${input.cycleFrequencyUnit}`
    });
  }, [input, currentType]);

  useEffect(() => { calculateLocalData(); }, [calculateLocalData]);

  const handleFetchProfessionalAdvice = async () => {
    const hasKey = typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey;
    if (hasKey && !(await (window as any).aistudio.hasSelectedApiKey())) {
      await (window as any).aistudio.openSelectKey();
    }
    setLoading(true);
    setError(null);
    setAiAdvice(null);
    try {
      const advice = await getAgriculturalAdvice({
        ...input,
        treeType: currentType,
        selectedUnits: { ...PRODUCT_UNITS, ...input.selectedUnits }
      });
      if (advice) {
        setAiAdvice(advice);
        setShowAIPlantPlan(true);
      } else {
        setError("La IA no devolvió un formato válido.");
      }
    } catch (err) {
      setError("Error crítico en el servicio de IA.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setVisionReport(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setVisionImage(base64);
      try {
        const report = await getIndependentVisionDiagnosis(base64, isGrassTab ? "Grama" : input.treeType);
        if (report) setVisionReport(report);
        else setError("No se pudo diagnosticar la imagen.");
      } catch (err) {
        setError("Fallo en el servicio visual.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [input.treeType, isGrassTab]);

  const generatePDF = (customRecord?: HistoryRecord) => {
    const targetResult = customRecord ? customRecord.result : result;
    const targetInput = customRecord ? customRecord.input : input;
    const targetClient = customRecord ? customRecord.client : clientData;
    const targetSpecies = customRecord ? (targetInput.treeType === TreeType.GRASS ? `Grama ${targetInput.grassVariety}` : targetInput.treeType) : speciesName;

    if (!targetResult) return;
    const doc = new jsPDF();
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('REPORTE AGROVISION CO', 15, 25);
    doc.setFontSize(10);
    if (customRecord) doc.text(`CONSECUTIVO: #${customRecord.consecutive.toString().padStart(3, '0')}`, 15, 35);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', 15, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${targetClient.firstName} ${targetClient.lastName}`, 15, 68);
    doc.text(`Lugar: ${targetClient.location || targetInput.department}`, 15, 75);
    doc.text(`Contacto: ${targetClient.contact}`, 15, 82);
    doc.text(`Email: ${targetClient.email}`, 15, 89);

    const meta = [
      [`Cultivo:`, targetSpecies],
      [`Ubicación:`, `${targetInput.department}`],
      [`Frecuencia:`, targetResult.frequency],
      [`Total Inversión:`, `$${targetResult.totalProjectCost.toLocaleString()} COP`]
    ];
    let y = 105;
    meta.forEach(([l, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(l, 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(v, 60, y);
      y += 8;
    });
    autoTable(doc, {
      startY: y + 5,
      head: [['Insumo', 'Dosis Total', 'Costo']],
      body: targetResult.products.map(p => [p.product, `${p.amount} ${p.unit}`, `$${p.totalCost.toLocaleString()}`]),
      headStyles: { fillColor: [6, 78, 59] }
    });
    doc.save(`AgroVision_${targetClient.lastName || 'Reporte'}_${targetSpecies}.pdf`);
  };

  const generateAIPDF = () => {
    if (!aiAdvice) return;
    const doc = new jsPDF();
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('GUÍA DE NUTRICIÓN IA - AGROVISION', 15, 20);
    doc.setFontSize(10);
    doc.text(`Protocolo para ${speciesName} en ${input.department}`, 15, 30);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS TÉCNICOS', 15, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${clientData.firstName} ${clientData.lastName}`, 15, 58);
    doc.text(`Ubicación: ${clientData.location || input.department}`, 15, 65);
    doc.text(`Riego: ${aiAdvice.waterRequirement.volume} (${aiAdvice.waterRequirement.frequency})`, 15, 72);
    doc.text(`Suelo: ${aiAdvice.soilAnalysis}`, 15, 79, { maxWidth: 180 });

    doc.setFont('helvetica', 'bold');
    doc.text('PLAN RADICULAR (POR PLANTA)', 15, 95);
    autoTable(doc, {
      startY: 100,
      head: [['Insumo', 'Dosis x Planta', 'Propósito']],
      body: aiAdvice.radicularPlan.map(p => [p.item, p.dosage, p.purpose]),
      headStyles: { fillColor: [6, 78, 59] }
    });

    const nextY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont('helvetica', 'bold');
    doc.text('PLAN FOLIAR (POR PLANTA)', 15, nextY);
    autoTable(doc, {
      startY: nextY + 5,
      head: [['Insumo', 'Dosis x Planta', 'Propósito']],
      body: aiAdvice.foliarPlan.map(p => [p.item, p.dosage, p.purpose]),
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`GuiaIA_AgroVision_${clientData.lastName || 'Cultivo'}.pdf`);
  };

  const sendWhatsAppIA = () => {
    if (!aiAdvice) return;
    const intro = `🌱 *AGROVISION CO - PROTOCOLO IA*%0A%0A`;
    const cliente = `👤 *Cliente:* ${clientData.firstName} ${clientData.lastName}%0A🌾 *Cultivo:* ${speciesName}%0A📍 *Lugar:* ${clientData.location || input.department}%0A%0A`;
    
    let radicular = `🧪 *PLAN RADICULAR (x Planta):*%0A`;
    aiAdvice.radicularPlan.forEach(p => {
      radicular += `• ${p.item}: *${p.dosage}*%0A`;
    });

    let foliar = `%0A🍃 *PLAN FOLIAR (x Planta):*%0A`;
    aiAdvice.foliarPlan.forEach(p => {
      foliar += `• ${p.item}: *${p.dosage}*%0A`;
    });

    const nota = `%0A💡 *Nota:* ${aiAdvice.seasonalAdvice.substring(0, 100)}...`;
    
    const message = `${intro}${cliente}${radicular}${foliar}${nota}`;
    const url = `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  const renderProductItem = (p: OrganicProduct) => {
    const selected = input.selectedProducts.includes(p);
    const unit = input.selectedUnits[p] || PRODUCT_UNITS[p];
    
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${selected ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.01]' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
        <label className="flex items-center gap-3 cursor-pointer mb-2">
          <input type="checkbox" checked={selected} onChange={() => setInput(prev => ({ ...prev, selectedProducts: selected ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="accent-emerald-600 h-5 w-5" />
          <span className="text-xs font-black text-black">{p}</span>
        </label>
        {selected && (
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-emerald-700 block">Dosis Individual</label>
                <div className="flex gap-1">
                  <input 
                    type="number" 
                    step="0.01" 
                    value={input.manualPlantAmounts[p] ?? ''} 
                    onChange={e => setInput({...input, manualPlantAmounts: {...input.manualPlantAmounts, [p]: e.target.value === '' ? undefined : parseFloat(e.target.value)}})} 
                    placeholder="0.00"
                    className="flex-1 p-2 text-xs border rounded-lg font-black bg-white outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                  <select 
                    value={unit} 
                    onChange={e => setInput({...input, selectedUnits: {...input.selectedUnits, [p]: e.target.value as UnitType}})}
                    className="w-16 p-2 text-[10px] border rounded-lg font-black bg-slate-50 cursor-pointer"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="cc">cc</option>
                    <option value="L">L</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-500 block">Precio / {unit}</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">$</span>
                  <input 
                    type="number" 
                    value={input.productPrices[p] || ''} 
                    onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})} 
                    className="w-full p-2 pl-5 text-xs border rounded-lg font-black bg-white outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
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
      {/* MODAL: FICHA INDIVIDUAL (BASE) */}
      {showPlantPlan && result && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
            <header className="bg-[#064e3b] p-8 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Ficha Individual</h2>
                <p className="text-xs font-bold text-emerald-300 mt-1 uppercase">Dosis por {currentUnitLabel}</p>
              </div>
              <button onClick={() => setShowPlantPlan(false)} className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Frecuencia Recom.</span>
                  <span className="text-sm font-black text-black">{result.frequency}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Lote</span>
                  <span className="text-sm font-black text-black">{input.numTrees} {currentUnitLabel}</span>
                </div>
              </div>
              <section className="space-y-3">
                <h3 className="text-[10px] font-black text-emerald-700 uppercase mb-2">Desglose de Aplicación</h3>
                {result.products.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-xl border">
                    <span className="text-xs font-bold text-slate-700">{p.product}</span>
                    <span className="text-sm font-black text-black">{(p.amount / Math.max(1, input.numTrees || 1)).toFixed(2)} {p.unit}</span>
                  </div>
                ))}
              </section>
            </div>
            <footer className="p-6 bg-slate-50 border-t flex gap-4">
               <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-lg">Imprimir</button>
               <button onClick={() => setShowPlantPlan(false)} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase">Cerrar</button>
            </footer>
          </div>
        </div>
      )}

      {/* MODAL: RECOMENDACIÓN IA POR PLANTA */}
      {showAIPlantPlan && aiAdvice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-emerald-950/95 backdrop-blur-md no-print overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col my-auto border-8 border-emerald-50">
            <header className="bg-gradient-to-r from-[#064e3b] to-[#10b981] p-10 text-white relative">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Protocolo de Precisión IA</span>
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Nutrición Técnica por {currentUnitLabel === 'm2' ? 'Metro Cuadrado' : 'Planta'}</h2>
                  <p className="text-sm font-bold text-emerald-100 mt-1">Recomendación optimizada para {speciesName} en {input.department}</p>
                </div>
                <button onClick={() => setShowAIPlantPlan(false)} className="h-12 w-12 bg-black/20 rounded-full flex items-center justify-center hover:bg-black/40 transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                  <i className="fas fa-tint text-blue-500 mb-2"></i>
                  <span className="text-[9px] font-black text-blue-400 uppercase block">Riego Recomendado</span>
                  <p className="text-sm font-black text-blue-900">{aiAdvice.waterRequirement.volume} / {aiAdvice.waterRequirement.frequency}</p>
                </div>
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                  <i className="fas fa-chart-line text-emerald-500 mb-2"></i>
                  <span className="text-[9px] font-black text-emerald-400 uppercase block">Sostenibilidad</span>
                  <p className="text-xl font-black text-emerald-900">{aiAdvice.sustainabilityScore}/100</p>
                </div>
                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                  <i className="fas fa-microscope text-amber-500 mb-2"></i>
                  <span className="text-[9px] font-black text-amber-400 uppercase block">Estado del Suelo</span>
                  <p className="text-xs font-black text-amber-900 line-clamp-2">{aiAdvice.soilAnalysis}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-3">
                    <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white"><i className="fas fa-seedling"></i></div>
                    <h3 className="text-lg font-black text-slate-800 uppercase">Plan Suelo (Radicular)</h3>
                  </div>
                  <div className="space-y-3">
                    {aiAdvice.radicularPlan.map((step, idx) => (
                      <div key={idx} className="p-5 bg-slate-50 rounded-2xl border-2 border-white shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black text-emerald-800 uppercase">{step.item}</span>
                          <span className="px-3 py-1 bg-white border-2 border-emerald-500 rounded-full text-[10px] font-black text-emerald-700 shadow-sm">{step.dosage}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold italic leading-relaxed">Objetivo: {step.purpose}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-3">
                    <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"><i className="fas fa-spray-can"></i></div>
                    <h3 className="text-lg font-black text-slate-800 uppercase">Plan Foliar (Hojas)</h3>
                  </div>
                  <div className="space-y-3">
                    {aiAdvice.foliarPlan.map((step, idx) => (
                      <div key={idx} className="p-5 bg-slate-50 rounded-2xl border-2 border-white shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black text-blue-800 uppercase">{step.item}</span>
                          <span className="px-3 py-1 bg-white border-2 border-blue-500 rounded-full text-[10px] font-black text-blue-700 shadow-sm">{step.dosage}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold italic leading-relaxed">Objetivo: {step.purpose}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-8 bg-[#064e3b] text-white rounded-[2.5rem] shadow-xl border-4 border-emerald-400/20">
                <h4 className="text-sm font-black uppercase mb-3 text-emerald-400 flex items-center gap-2">
                  <i className="fas fa-info-circle"></i> Nota del Agrónomo IA
                </h4>
                <p className="text-sm font-medium leading-relaxed italic opacity-90">{aiAdvice.seasonalAdvice}</p>
              </div>
            </div>

            <footer className="p-8 bg-slate-50 border-t flex flex-wrap gap-4 items-center">
               <div className="hidden md:flex flex-1 items-center gap-3">
                 <div className="h-12 w-12 bg-white rounded-2xl border flex items-center justify-center text-emerald-600 text-xl shadow-sm"><i className="fas fa-boxes"></i></div>
                 <div>
                   <span className="text-[9px] font-black text-slate-400 uppercase block leading-none">Lote</span>
                   <span className="text-sm font-black text-black">{input.numTrees} {currentUnitLabel}</span>
                 </div>
               </div>
               <div className="flex flex-wrap gap-2 w-full md:w-auto">
                 <button onClick={() => window.print()} className="flex-1 md:flex-none px-4 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2"><i className="fas fa-print"></i> Imprimir</button>
                 <button onClick={generateAIPDF} className="flex-1 md:flex-none px-4 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"><i className="fas fa-file-pdf"></i> PDF IA</button>
                 <button onClick={sendWhatsAppIA} className="flex-1 md:flex-none px-4 py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2"><i className="fab fa-whatsapp"></i> WhatsApp</button>
                 <button onClick={() => setShowAIPlantPlan(false)} className="flex-1 md:flex-none px-4 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-50 transition-all">Cerrar</button>
               </div>
            </footer>
          </div>
        </div>
      )}

      <header className="bg-[#064e3b] text-white p-6 shadow-2xl sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 h-12 w-12 rounded-xl flex items-center justify-center text-white text-2xl shadow-xl"><i className="fas fa-leaf"></i></div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">AgroVision <span className="text-emerald-400">CO</span></h1>
              <p className="text-[9px] font-bold uppercase opacity-70 tracking-widest">Tecnología Orgánica de Precisión</p>
            </div>
          </div>
          <nav className="flex bg-white/10 rounded-full p-1 border border-white/20">
            {['calculator', 'grass_pro', 'vision', 'history'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-2 rounded-full text-[10px] font-black transition-all ${activeTab === tab ? 'bg-white text-[#064e3b] shadow-lg' : 'text-white hover:bg-white/10'}`}>
                {tab === 'calculator' ? 'CULTIVOS' : tab === 'grass_pro' ? 'CÉSPED' : tab === 'vision' ? 'IA VISION' : 'HISTORIAL'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {activeTab === 'history' ? (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-[#064e3b] uppercase">Historial de Clientes</h2>
                <p className="text-xs font-bold text-slate-500 uppercase mt-1">Registros guardados.</p>
              </div>
              <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black">
                {history.length}
              </div>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed">
                <i className="fas fa-folder-open text-4xl text-slate-300 mb-4"></i>
                <p className="text-slate-400 font-bold uppercase text-xs">No hay registros aún.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-black border-b">
                    <tr>
                      <th className="p-4">#</th>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Cultivo</th>
                      <th className="p-4">Inversión</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs text-black font-medium">
                    {history.map((h) => (
                      <tr key={h.id} className="border-b hover:bg-emerald-50/20 transition-colors">
                        <td className="p-4 font-black">#{h.consecutive.toString().padStart(3, '0')}</td>
                        <td className="p-4 text-slate-500">{h.date}</td>
                        <td className="p-4">
                          <p className="font-black text-black uppercase">{h.client.firstName} {h.client.lastName}</p>
                          <p className="text-[9px] text-slate-400">{h.client.email}</p>
                        </td>
                        <td className="p-4 uppercase">{h.input.treeType === TreeType.GRASS ? `Grama ${h.input.grassVariety}` : h.input.treeType}</td>
                        <td className="p-4 font-black text-emerald-700">${h.result.totalProjectCost.toLocaleString()}</td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => generatePDF(h)} className="h-8 w-8 bg-slate-900 text-white rounded-lg hover:bg-black transition-colors" title="Exportar PDF"><i className="fas fa-file-pdf"></i></button>
                            <button onClick={() => deleteHistoryRecord(h.id)} className="h-8 w-8 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Eliminar"><i className="fas fa-trash-alt"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab !== 'vision' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-blue-50">
                <h2 className="text-sm font-black mb-4 text-[#064e3b] flex items-center gap-2"><i className="fas fa-user-tie text-blue-500"></i> Datos del Cliente</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400">Nombres</label>
                      <input type="text" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="w-full p-2 text-xs border rounded-lg font-bold bg-slate-50 text-black" placeholder="Ej: Juan" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400">Apellidos</label>
                      <input type="text" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="w-full p-2 text-xs border rounded-lg font-bold bg-slate-50 text-black" placeholder="Ej: Pérez" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400">Lugar / Finca</label>
                    <input type="text" value={clientData.location} onChange={e => setClientData({...clientData, location: e.target.value})} className="w-full p-2 text-xs border rounded-lg font-bold bg-slate-50 text-black" placeholder="Ej: Finca La Esperanza" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400">Celular WhatsApp</label>
                    <input type="text" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="w-full p-2 text-xs border rounded-lg font-bold bg-slate-50 text-black" placeholder="3000000000" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <h2 className="text-sm font-black mb-4 text-[#064e3b] flex items-center gap-2"><i className="fas fa-map-marked-alt"></i> Ubicación Regional</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Departamento</label>
                    <select value={input.department} onChange={e => setInput({...input, department: e.target.value as Department, climate: DEPARTMENT_CLIMATE_MAP[e.target.value as Department]})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs text-black">
                      {Object.values(Department).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-[#064e3b] p-6 rounded-[2rem] shadow-xl border border-emerald-900">
                <h2 className="text-sm font-black mb-4 text-emerald-400 flex items-center gap-2"><i className="fas fa-calendar-check"></i> Ciclo de Aplicación</h2>
                <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                   <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[8px] font-black uppercase text-emerald-200 block mb-1">Frecuencia</label>
                        <input type="number" min="1" value={input.cycleFrequencyValue} onChange={e => setInput({...input, cycleFrequencyValue: parseInt(e.target.value)||1})} className="w-full p-3 bg-white text-[#064e3b] border-0 rounded-xl font-black text-xl text-center outline-none" />
                      </div>
                      <div className="w-24">
                        <label className="text-[8px] font-black uppercase text-emerald-200 block mb-1">Unidad</label>
                        <select value={input.cycleFrequencyUnit} onChange={e => setInput({...input, cycleFrequencyUnit: e.target.value as FrequencyUnit})} className="w-full p-3 bg-emerald-700 text-white border-0 rounded-xl font-black text-xs appearance-none">
                          <option value="días">Días</option>
                          <option value="meses">Meses</option>
                        </select>
                      </div>
                   </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <h2 className="text-sm font-black mb-4 text-[#064e3b] flex items-center gap-2"><i className="fas fa-sliders-h"></i> Parámetros Técnicos</h2>
                <div className="space-y-4">
                  {!isGrassTab ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => (
                        <button key={t} onClick={() => setInput({...input, treeType: t})} className={`p-3 rounded-xl border-2 text-[8px] font-black flex flex-col items-center gap-1 transition-all ${input.treeType === t ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-100 text-black'}`}>
                          <span className="text-lg">{TREE_TYPE_ICONS[t]}</span> {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Variedad de Césped</label>
                      <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as GrassVariety})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs text-black">
                        {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Cantidad ({currentUnitLabel})</label>
                      <input type="number" min="1" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value)||1})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs text-black" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Salud General</label>
                      <select value={input.healthStatus} onChange={e => setInput({...input, healthStatus: e.target.value as any})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs text-black">
                        <option value="bueno">Excelente</option>
                        <option value="regular">Regular</option>
                        <option value="deficiente">Crítico</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <h2 className="text-sm font-black mb-4 text-[#064e3b] flex items-center gap-2"><i className="fas fa-boxes"></i> Insumos Disponibles</h2>
                <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-[9px] font-black text-blue-600 uppercase border-b pb-1">Líquidos</h3>
                    {PRODUCT_CATEGORIES.LIQUIDS.map(p => renderProductItem(p))}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-[9px] font-black text-amber-700 uppercase border-b pb-1">Sólidos</h3>
                    {PRODUCT_CATEGORIES.SOLIDS.map(p => renderProductItem(p))}
                  </div>
                </div>
                <button onClick={handleFetchProfessionalAdvice} disabled={loading} className="w-full mt-6 py-4 bg-[#064e3b] text-white font-black rounded-xl shadow-lg uppercase text-[10px] flex items-center justify-center gap-2 tracking-widest">
                  {loading ? <i className="fas fa-circle-notch animate-spin text-white"></i> : <i className="fas fa-robot text-emerald-400"></i>} Asesoría Técnica IA
                </button>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-8">
              {result && result.products.length > 0 ? (
                <div className="space-y-6 animate-in fade-in duration-700">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                      <div>
                        <h3 className="text-2xl font-black text-[#111827] uppercase leading-none">Cálculo de Insumos</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{speciesName} • {input.numTrees} {currentUnitLabel}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {aiAdvice && (
                          <button onClick={() => setShowAIPlantPlan(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase shadow-md flex items-center gap-2 border-2 border-emerald-400 hover:bg-emerald-700 transition-all"><i className="fas fa-microchip"></i> Plan IA x Planta</button>
                        )}
                        <button onClick={saveToHistory} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase shadow-md flex items-center gap-2 hover:bg-blue-700 transition-all"><i className="fas fa-save"></i> Guardar</button>
                        <button onClick={() => generatePDF()} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase shadow-md flex items-center gap-2 hover:bg-black transition-all"><i className="fas fa-file-pdf"></i> Reporte PDF</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                        <span className="text-[8px] font-black uppercase text-emerald-600 block mb-1">Inversión Lote</span>
                        <span className="text-2xl font-black text-black">${result.totalProjectCost.toLocaleString()} COP</span>
                      </div>
                      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                        <span className="text-[8px] font-black uppercase text-blue-600 block mb-1">Periodicidad</span>
                        <span className="text-xl font-black text-black uppercase">{result.frequency}</span>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <span className="text-[8px] font-black uppercase text-slate-500 block mb-1">Lote de Trabajo</span>
                        <span className="text-xl font-black text-black uppercase">{input.numTrees} {currentUnitLabel}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase border-b text-black">
                          <tr><th className="p-4">Insumo Orgánico</th><th className="p-4">Dosis Total</th><th className="p-4">Costo Estimado</th></tr>
                        </thead>
                        <tbody className="text-xs text-black font-medium">
                          {result.products.map((p, idx) => (
                            <tr key={idx} className="border-t hover:bg-emerald-50/20">
                              <td className="p-4 font-bold uppercase">{p.product}</td>
                              <td className="p-4"><span className="px-2 py-1 bg-white border shadow-sm text-black rounded font-black">{p.amount.toLocaleString()} {p.unit}</span></td>
                              <td className="p-4 font-black text-emerald-900">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {aiAdvice && (
                    <div ref={aiSectionRef} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50 space-y-8 animate-in slide-in-from-bottom duration-500 overflow-hidden relative">
                       <div className="flex items-center gap-3 border-b pb-4"><i className="fas fa-robot text-emerald-500 text-2xl"></i><h3 className="text-xl font-black text-black uppercase">Diagnóstico y Asesoría IA</h3></div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-sm font-black text-black uppercase flex items-center gap-2"><i className="fas fa-check-circle text-emerald-500"></i> Recomendaciones</h4>
                            <ul className="space-y-2">{aiAdvice.tips.map((tip, i) => (<li key={i} className="text-xs text-black font-bold flex gap-2 p-2 bg-slate-50 rounded-lg"><span className="text-emerald-500">•</span> {tip}</li>))}</ul>
                          </div>
                          <div className="space-y-6">
                            <div className="p-4 bg-slate-50 rounded-2xl border shadow-sm text-black">
                              <h4 className="text-sm font-black text-black uppercase mb-2">Análisis Regional</h4>
                              <p className="text-xs italic font-medium leading-relaxed">{aiAdvice.seasonalAdvice}</p>
                            </div>
                            <button onClick={() => setShowAIPlantPlan(true)} className="w-full py-4 bg-emerald-100 text-emerald-700 font-black rounded-2xl border-2 border-emerald-300 uppercase text-xs flex items-center justify-center gap-3 hover:bg-emerald-200 transition-all shadow-md">
                              <i className="fas fa-external-link-alt"></i> Ver Nutrición de Precisión x Planta
                            </button>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] p-20 text-center border-4 border-dashed border-slate-200 shadow-inner flex flex-col items-center">
                  <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-4xl text-slate-200 shadow-inner"><i className="fas fa-leaf"></i></div>
                  <h3 className="text-2xl font-black text-[#064e3b] mb-2 uppercase tracking-tighter">Dosificación Agrotécnica</h3>
                  <p className="text-slate-400 text-sm font-medium">Configure los parámetros técnicos para generar el desglose.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto py-10 space-y-12 no-print">
             {!visionReport && (
               <div className="bg-white p-16 rounded-[2.5rem] shadow-2xl text-center border animate-in zoom-in duration-500">
                  <h2 className="text-4xl font-black text-[#111827] mb-4 uppercase tracking-tighter">IA Vision CO</h2>
                  <p className="text-slate-500 mb-8 font-bold">Diagnóstico fitosanitario regionalizado en tiempo real.</p>
                  <button onClick={() => visionFileInputRef.current?.click()} disabled={loading} className="bg-[#064e3b] text-white px-12 py-5 rounded-2xl text-lg font-black shadow-xl flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 transition-all">
                    {loading ? <i className="fas fa-circle-notch animate-spin text-white"></i> : <i className="fas fa-camera text-emerald-400"></i>} {loading ? "Analizando..." : "Escanear Cultivo"}
                  </button>
                  <input type="file" accept="image/*" ref={visionFileInputRef} onChange={handlePhotoUpload} className="hidden" />
               </div>
             )}

             {visionReport && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-700">
                  <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-lg border">
                    <h3 className="text-2xl font-black text-[#064e3b] uppercase">Diagnóstico Fitosanitario</h3>
                    <button onClick={() => { setVisionReport(null); setVisionImage(null); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500">Reiniciar</button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border">
                      <div className="aspect-square bg-slate-100 rounded-3xl mb-6 overflow-hidden border shadow-inner">
                        {visionImage && <img src={visionImage} alt="Muestra" className="w-full h-full object-cover" />}
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                         <h4 className="text-[10px] font-black uppercase text-emerald-600 mb-1">Observación Visual</h4>
                         <p className="text-xs font-bold text-black leading-relaxed">{visionReport.plantReading}</p>
                      </div>
                    </div>
                    <div className="space-y-8">
                       <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border relative overflow-hidden">
                          <div className={`absolute top-0 right-0 p-4 font-black uppercase text-[10px] rounded-bl-3xl shadow-sm ${visionReport.pestAnalysis.severity === 'Crítica' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>{visionReport.pestAnalysis.severity}</div>
                          <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><i className="fas fa-bug text-red-400"></i> Hallazgo Detectado</h4>
                          <p className="text-2xl font-black text-black mb-1">{visionReport.pestAnalysis.identifiedPest}</p>
                          <div className="p-4 bg-slate-50 rounded-2xl border mt-4">
                             <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Síntomas Reportados</span>
                             <p className="text-xs font-bold text-black leading-relaxed">{visionReport.pestAnalysis.symptoms}</p>
                          </div>
                       </div>
                    </div>
                  </div>
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
