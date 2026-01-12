
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, FrequencyUnit, Department } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, TREE_TYPE_ICONS, PRODUCT_NUTRIENTS, COLOMBIAN_MARKET_PRICES, PRODUCT_CATEGORIES, DEPARTMENT_CLIMATE_MAP } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass_pro' | 'vision'>('calculator');
  const [showPlantPlan, setShowPlantPlan] = useState(false);
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
  const [fetchingLocation, setFetchingLocation] = useState(false);
  
  const aiSectionRef = useRef<HTMLDivElement>(null);
  const visionFileInputRef = useRef<HTMLInputElement>(null);

  const isGrassTab = activeTab === 'grass_pro';
  const currentType = isGrassTab ? TreeType.GRASS : input.treeType;
  const currentUnitLabel = isGrassTab ? input.grassMode : 'plantas';
  const speciesName = isGrassTab ? `Grama ${input.grassVariety}` : input.treeType;

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setInput(prev => ({
          ...prev,
          location: { lat: position.coords.latitude, lng: position.coords.longitude }
        }));
        setFetchingLocation(false);
      },
      () => setFetchingLocation(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => { captureLocation(); }, [captureLocation]);

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
        setTimeout(() => aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
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

  const generatePDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('REPORTE AGROVISION CO', 15, 25);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const meta = [
      [`Cultivo:`, speciesName],
      [`Ubicación:`, `${input.department}`],
      [`Frecuencia:`, result.frequency],
      [`Total Inversión:`, `$${result.totalProjectCost.toLocaleString()} COP`]
    ];
    let y = 65;
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
      body: result.products.map(p => [p.product, `${p.amount} ${p.unit}`, `$${p.totalCost.toLocaleString()}`]),
      headStyles: { fillColor: [16, 185, 129] }
    });
    doc.save(`AgroVision_${speciesName}.pdf`);
  };

  const renderProductItem = (p: OrganicProduct) => {
    const selected = input.selectedProducts.includes(p);
    const unit = PRODUCT_UNITS[p];
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${selected ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.01]' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
        <label className="flex items-center gap-3 cursor-pointer mb-2">
          <input type="checkbox" checked={selected} onChange={() => setInput(prev => ({ ...prev, selectedProducts: selected ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="accent-emerald-600 h-5 w-5" />
          <span className="text-xs font-black text-[#111827]">{p}</span>
        </label>
        {selected && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-emerald-700">Dosis ({unit})</label>
              <input type="number" step="0.01" value={input.manualPlantAmounts[p] ?? ''} onChange={e => setInput({...input, manualPlantAmounts: {...input.manualPlantAmounts, [p]: e.target.value === '' ? undefined : parseFloat(e.target.value)}})} className="w-full p-2 text-[10px] border rounded-lg font-black bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-500">Precio</label>
              <input type="number" value={input.productPrices[p] || ''} onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})} className="w-full p-2 text-[10px] border rounded-lg font-black bg-white" />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] pb-24 text-[#111827]">
      {showPlantPlan && result && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
            <header className="bg-[#064e3b] p-8 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Ficha Individual</h2>
                <p className="text-xs font-bold text-emerald-300 mt-1 uppercase">Dosis por {currentUnitLabel}</p>
              </div>
              <button onClick={() => setShowPlantPlan(false)} className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20">
                <i className="fas fa-times"></i>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Frecuencia Recom.</span>
                  <span className="text-sm font-black">{result.frequency}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Lote</span>
                  <span className="text-sm font-black">{input.numTrees} {currentUnitLabel}</span>
                </div>
              </div>
              <section className="space-y-3">
                {result.products.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-xl border">
                    <span className="text-xs font-bold text-slate-700">{p.product}</span>
                    <span className="text-sm font-black text-[#064e3b]">{(p.amount / Math.max(1, input.numTrees || 1)).toFixed(2)} {p.unit}</span>
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
            {['calculator', 'grass_pro', 'vision'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-2 rounded-full text-[10px] font-black transition-all ${activeTab === tab ? 'bg-white text-[#064e3b] shadow-lg' : 'text-white hover:bg-white/10'}`}>
                {tab === 'calculator' ? 'CULTIVOS' : tab === 'grass_pro' ? 'CÉSPED' : 'IA VISION'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl flex justify-between items-center animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3"><i className="fas fa-exclamation-circle"></i><p className="text-sm font-bold">{error}</p></div>
            <button onClick={() => setError(null)} className="text-red-900 font-black text-[10px] uppercase">Ok</button>
          </div>
        )}

        {activeTab !== 'vision' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <h2 className="text-sm font-black mb-4 text-[#064e3b] flex items-center gap-2"><i className="fas fa-map-marked-alt"></i> Ubicación Regional</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Departamento</label>
                    <select value={input.department} onChange={e => setInput({...input, department: e.target.value as Department, climate: DEPARTMENT_CLIMATE_MAP[e.target.value as Department]})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs">
                      {Object.values(Department).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Clima de la Zona</label>
                    <select value={input.climate} onChange={e => setInput({...input, climate: e.target.value as ClimateType})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs">
                      {Object.values(ClimateType).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-[#064e3b] p-6 rounded-[2rem] shadow-xl border border-emerald-900">
                <h2 className="text-sm font-black mb-4 text-emerald-400 flex items-center gap-2">
                   <i className="fas fa-calendar-check"></i> Ciclo de Aplicación
                </h2>
                <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                   <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[8px] font-black uppercase text-emerald-200 block mb-1">Cada cuanto aplicar?</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={input.cycleFrequencyValue} 
                          onChange={e => setInput({...input, cycleFrequencyValue: parseInt(e.target.value)||1})} 
                          className="w-full p-3 bg-white text-[#064e3b] border-0 rounded-xl font-black text-xl text-center outline-none focus:ring-4 focus:ring-emerald-400/30" 
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-[8px] font-black uppercase text-emerald-200 block mb-1">Unidad</label>
                        <select 
                          value={input.cycleFrequencyUnit} 
                          onChange={e => setInput({...input, cycleFrequencyUnit: e.target.value as FrequencyUnit})} 
                          className="w-full p-3 bg-emerald-700 text-white border-0 rounded-xl font-black text-xs appearance-none cursor-pointer hover:bg-emerald-600 transition-colors"
                        >
                          <option value="días">Días</option>
                          <option value="meses">Meses</option>
                        </select>
                      </div>
                   </div>
                   <p className="text-[9px] text-emerald-300/60 mt-3 italic font-medium text-center">Configura la periodicidad exacta para el reporte técnico.</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <h2 className="text-sm font-black mb-4 text-[#064e3b] flex items-center gap-2"><i className="fas fa-sliders-h"></i> Parámetros Técnicos</h2>
                <div className="space-y-4">
                  {!isGrassTab ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => (
                        <button key={t} onClick={() => setInput({...input, treeType: t})} className={`p-3 rounded-xl border-2 text-[8px] font-black flex flex-col items-center gap-1 transition-all ${input.treeType === t ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-100'}`}>
                          <span className="text-lg">{TREE_TYPE_ICONS[t]}</span> {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Variedad de Césped</label>
                      <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as GrassVariety})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs">
                        {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Cantidad ({currentUnitLabel})</label>
                      <input type="number" min="1" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value)||1})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Salud General</label>
                      <select value={input.healthStatus} onChange={e => setInput({...input, healthStatus: e.target.value as any})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs">
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
                <button onClick={handleFetchProfessionalAdvice} disabled={loading} className="w-full mt-6 py-4 bg-[#064e3b] text-white font-black rounded-xl shadow-lg uppercase text-[10px] flex items-center justify-center gap-2 disabled:opacity-50 tracking-widest">
                  {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-robot"></i>} Asesoría Técnica IA
                </button>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-8">
              {result && result.products.length > 0 ? (
                <div className="space-y-6 animate-in fade-in duration-700">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                      <div>
                        <h3 className="text-2xl font-black text-[#111827]">Reporte de Dosificación</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-widest">{speciesName} • {input.numTrees} {currentUnitLabel} • {input.department}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowPlantPlan(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase shadow-md">Ficha Individual</button>
                        <button onClick={generatePDF} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase shadow-md">Descargar PDF</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                        <span className="text-[8px] font-black uppercase text-emerald-600 block mb-1">Inversión Lote</span>
                        <span className="text-2xl font-black text-[#064e3b]">${result.totalProjectCost.toLocaleString()} COP</span>
                      </div>
                      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                        <span className="text-[8px] font-black uppercase text-blue-600 block mb-1">Periodicidad</span>
                        <span className="text-xl font-black text-blue-900">{result.frequency}</span>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-500 block mb-1">Estado Salud</span>
                        <span className="text-xl font-black text-[#111827] uppercase">{input.healthStatus}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase">
                          <tr><th className="p-4">Insumo</th><th className="p-4">Dosis Total</th><th className="p-4">Costo Estimado</th></tr>
                        </thead>
                        <tbody className="text-xs">
                          {result.products.map((p, idx) => (
                            <tr key={idx} className="border-t hover:bg-emerald-50/20">
                              <td className="p-4 font-bold">{p.product}</td>
                              <td className="p-4"><span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-black">{p.amount.toLocaleString()} {p.unit}</span></td>
                              <td className="p-4 font-black">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {aiAdvice && (
                    <div ref={aiSectionRef} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50 space-y-8 animate-in slide-in-from-bottom duration-500">
                       <div className="flex items-center gap-3 border-b pb-4"><i className="fas fa-robot text-emerald-500 text-2xl"></i><h3 className="text-xl font-black text-[#064e3b]">Asesoría Gemini 3 Grounding</h3></div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-sm font-black text-slate-800 uppercase">Tips Profesionales</h4>
                            <ul className="space-y-2">{aiAdvice.tips.map((tip, i) => (<li key={i} className="text-xs text-slate-600 flex gap-2"><span className="text-emerald-500">•</span> {tip}</li>))}</ul>
                          </div>
                          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <h4 className="text-sm font-black text-emerald-800 uppercase mb-2">Consejo por Ciclo ({input.cycleFrequencyUnit})</h4>
                            <p className="text-xs text-emerald-700 italic">{aiAdvice.seasonalAdvice}</p>
                          </div>
                       </div>

                       {aiAdvice.sources && aiAdvice.sources.length > 0 && (
                         <div className="pt-6 border-t border-slate-100">
                            <h4 className="text-xs font-black text-black uppercase mb-4 flex items-center gap-2">
                              <i className="fas fa-book-open"></i> Fuentes y Referencias Técnicas
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {aiAdvice.sources.map((src, i) => (
                                 <a 
                                   key={i} 
                                   href={src.uri} 
                                   target="_blank" 
                                   rel="noopener noreferrer" 
                                   className="p-3 bg-slate-50 border rounded-xl flex items-center gap-3 hover:bg-white hover:shadow-md transition-all group"
                                 >
                                    <div className="h-8 w-8 bg-black text-white rounded-lg flex items-center justify-center text-xs flex-shrink-0">
                                      <i className="fas fa-external-link-alt"></i>
                                    </div>
                                    <div className="overflow-hidden">
                                      <p className="text-[10px] font-black text-black truncate uppercase tracking-tight group-hover:text-emerald-600">{src.title}</p>
                                      <p className="text-[8px] text-black opacity-50 truncate">{src.uri}</p>
                                    </div>
                                 </a>
                               ))}
                            </div>
                            <p className="text-[8px] text-black opacity-40 mt-4 font-bold italic">
                              * Información validada mediante búsqueda en tiempo real. Los enlaces dirigen a fuentes externas de agronomía.
                            </p>
                         </div>
                       )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] p-20 text-center border-4 border-dashed border-slate-200 shadow-inner flex flex-col items-center">
                  <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-4xl text-slate-200 shadow-inner"><i className="fas fa-leaf"></i></div>
                  <h3 className="text-2xl font-black text-[#064e3b] mb-2 uppercase">Panel de Dosificación</h3>
                  <p className="text-slate-400 text-sm font-medium">Configura el departamento, la frecuencia y los insumos para generar el plan.</p>
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
                    {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-camera"></i>} {loading ? "Analizando..." : "Escanear Cultivo"}
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
                      <div className="aspect-square bg-slate-100 rounded-3xl mb-6 overflow-hidden">
                        {visionImage && <img src={visionImage} alt="Muestra" className="w-full h-full object-cover" />}
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-2xl">
                         <h4 className="text-[10px] font-black uppercase text-emerald-600 mb-1">Observación</h4>
                         <p className="text-xs font-bold text-emerald-900 leading-relaxed">{visionReport.plantReading}</p>
                      </div>
                    </div>
                    <div className="space-y-8">
                       <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border relative">
                          <div className={`absolute top-0 right-0 p-4 font-black uppercase text-[10px] rounded-bl-3xl ${visionReport.pestAnalysis.severity === 'Crítica' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>{visionReport.pestAnalysis.severity}</div>
                          <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><i className="fas fa-bug text-red-400"></i> Hallazgo</h4>
                          <p className="text-2xl font-black text-[#064e3b] mb-1">{visionReport.pestAnalysis.identifiedPest}</p>
                          <div className="p-4 bg-slate-50 rounded-2xl border mt-4">
                             <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Síntomas</span>
                             <p className="text-xs font-bold text-slate-600">{visionReport.pestAnalysis.symptoms}</p>
                          </div>
                       </div>
                       <div className="bg-[#064e3b] p-8 rounded-[2.5rem] shadow-xl text-white">
                          <h4 className="text-lg font-black mb-6 flex items-center gap-2"><i className="fas fa-mortar-pestle text-emerald-400"></i> Remedio Bio</h4>
                          <div className="space-y-4">
                             <div className="flex flex-wrap gap-2">{visionReport.biologicalRemedy.ingredients.map((ing, i) => (<span key={i} className="px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase">{ing}</span>))}</div>
                             <p className="text-xs leading-relaxed opacity-90"><strong className="text-emerald-400">Preparación:</strong> {visionReport.biologicalRemedy.preparation}</p>
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
