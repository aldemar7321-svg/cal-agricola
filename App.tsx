
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
    if (!navigator.geolocation) {
      console.warn("Geolocalización no soportada.");
      return;
    }

    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setInput(prev => ({
          ...prev,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        }));
        setFetchingLocation(false);
      },
      (err) => {
        console.warn("Error capturando ubicación:", err);
        setFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    captureLocation();
  }, [captureLocation]);

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
      } else if (input.manualAmounts[p] !== undefined) {
        amount = input.manualAmounts[p] || 0;
      } else {
        const baseMult = (currentType === TreeType.GRASS) ? count : Math.max(1, input.treeAge || 1) * count;
        const baseAmount = BASE_RATES[p] || 0;
        amount = baseMult * baseAmount * modifier;
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

  useEffect(() => { 
    calculateLocalData(); 
  }, [calculateLocalData]);

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
        setTimeout(() => {
          aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      } else {
        setError("La IA no devolvió un formato válido. Reintente por favor.");
      }
    } catch (err) {
      setError("Error crítico conectando con el servicio de IA.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hasKey = typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey;
    if (hasKey && !(await (window as any).aistudio.hasSelectedApiKey())) {
      await (window as any).aistudio.openSelectKey();
    }

    setLoading(true);
    setError(null);
    setVisionReport(null);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setVisionImage(base64);
      try {
        const report = await getIndependentVisionDiagnosis(base64, isGrassTab ? "Grama/Césped" : input.treeType);
        if (report) {
          setVisionReport(report);
        } else {
          setError("No se pudo generar un diagnóstico. Intente con otra foto más clara.");
        }
      } catch (err) {
        setError("Fallo en el servicio de análisis visual.");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Error al leer el archivo de imagen.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }, [input.treeType, isGrassTab]);

  const generatePDF = () => {
    if (!result) return;
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(6, 78, 59);
      doc.rect(0, 0, pageWidth, 50, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.text('REPORTE AGROVISION CO', 15, 25);
      doc.setFontSize(10);
      doc.text('Ingeniería de Precisión y Bio-Insumos', 15, 35);
      doc.setTextColor(0, 0, 0);
      doc.text('I. INFORMACIÓN TÉCNICA', 15, 65);
      
      const meta = [
        [`Cultivo:`, speciesName],
        [`Ubicación:`, `${input.department} (Colombia)`],
        [`Cantidad:`, `${input.numTrees} ${currentUnitLabel}`],
        [`Frecuencia:`, result.frequency],
        [`Total Inversión:`, `$${result.totalProjectCost.toLocaleString()} COP`]
      ];
      
      let y = 80;
      meta.forEach(([l, v]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(l, 15, y);
        doc.setFont('helvetica', 'normal');
        doc.text(v, 65, y);
        y += 8;
      });
      
      autoTable(doc, {
        startY: y + 10,
        head: [['Insumo', 'Dosis Requerida', 'Costo Estimado']],
        body: result.products.map(p => [p.product, `${p.amount} ${p.unit}`, `$${p.totalCost.toLocaleString()}`]),
        headStyles: { fillColor: [16, 185, 129] }
      });
      
      doc.save(`Reporte_AgroVision_${speciesName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      alert("Error al generar el PDF. Revise los datos.");
    }
  };

  const shareWhatsApp = () => {
    if (!result) return;
    let msg = `🚜 *AGROVISION CO*\n📍 *Ubicación:* ${input.department}\n📍 *Cultivo:* ${speciesName}\n📦 *Lote:* ${input.numTrees} ${currentUnitLabel}\n⏳ *Ciclo:* ${result.frequency}\n💰 *Presupuesto:* $${result.totalProjectCost.toLocaleString()} COP\n\n*DOSIS:*\n` +
      result.products.map(p => `✅ ${p.product}: *${p.amount} ${p.unit}*`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const renderProductItem = (p: OrganicProduct) => {
    const selected = input.selectedProducts.includes(p);
    const unit = PRODUCT_UNITS[p];
    const defaultPlantRate = BASE_RATES[p] || 0;
    
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${selected ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.01]' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
        <label className="flex items-center gap-3 cursor-pointer mb-2">
          <input type="checkbox" checked={selected} onChange={() => setInput(prev => ({ ...prev, selectedProducts: selected ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="accent-emerald-600 h-5 w-5" />
          <span className="text-xs font-black text-[#111827]">{p}</span>
        </label>
        {selected && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-emerald-700">Dosis/Unid ({unit})</label>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                placeholder={defaultPlantRate.toString()} 
                value={input.manualPlantAmounts[p] ?? ''} 
                onChange={e => setInput({...input, manualPlantAmounts: {...input.manualPlantAmounts, [p]: e.target.value === '' ? undefined : parseFloat(e.target.value)}})} 
                className="w-full p-2 text-[10px] border rounded-lg font-black bg-white outline-none focus:border-emerald-600" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-500">Precio/{unit}</label>
              <input 
                type="number" 
                min="0"
                value={input.productPrices[p] || ''} 
                onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})} 
                className="w-full p-2 text-[10px] border rounded-lg font-black bg-white outline-none focus:border-emerald-600" 
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleDepartmentChange = (dept: Department) => {
    const suggestedClimate = DEPARTMENT_CLIMATE_MAP[dept];
    setInput(prev => ({
      ...prev,
      department: dept,
      climate: suggestedClimate || prev.climate
    }));
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] pb-24 text-[#111827]">
      {showPlantPlan && result && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col print-modal-container">
            <header className="bg-[#064e3b] p-8 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Plan Individual</h2>
                <p className="text-xs font-bold text-emerald-300 mt-1 uppercase">Dosis por {currentUnitLabel}</p>
              </div>
              <button onClick={() => setShowPlantPlan(false)} className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 no-print">
                <i className="fas fa-times"></i>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Especie</span>
                  <span className="text-sm font-black">{speciesName}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Región</span>
                  <span className="text-sm font-black">{input.department}</span>
                </div>
              </div>
              <section className="space-y-3">
                <h3 className="text-xs font-black text-[#064e3b] uppercase flex items-center gap-2">
                  <i className="fas fa-flask text-emerald-500"></i> Dosis por Planta
                </h3>
                {result.products.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-xl border">
                    <span className="text-xs font-bold text-slate-700">{p.product}</span>
                    <span className="text-sm font-black text-[#064e3b]">{(p.amount / Math.max(1, input.numTrees || 1)).toFixed(2)} {p.unit}</span>
                  </div>
                ))}
              </section>
            </div>
            <footer className="p-6 bg-slate-50 border-t flex gap-4 no-print">
              <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:scale-[1.02]">
                <i className="fas fa-print mr-2"></i> Imprimir Ficha
              </button>
              <button onClick={() => setShowPlantPlan(false)} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase">
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}

      <header className="bg-[#064e3b] text-white p-6 shadow-2xl sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 h-12 w-12 rounded-xl flex items-center justify-center text-white text-2xl shadow-xl">
              <i className="fas fa-leaf"></i>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">AgroVision <span className="text-emerald-400">CO</span></h1>
              <p className="text-[9px] font-bold uppercase opacity-70">Calculadora de Precisión</p>
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
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl flex justify-between items-center animate-pulse">
            <div className="flex items-center gap-3">
              <i className="fas fa-exclamation-triangle"></i>
              <p className="text-sm font-bold">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-900 font-black text-xs uppercase">Cerrar</button>
          </div>
        )}

        {activeTab !== 'vision' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <h2 className="text-lg font-black mb-6 text-[#064e3b] flex items-center gap-2">
                  <i className="fas fa-map-marked-alt"></i> Ubicación Regional
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Departamento</label>
                    <select 
                      value={input.department} 
                      onChange={e => handleDepartmentChange(e.target.value as Department)} 
                      className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                    >
                      {Object.values(Department).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Clima</label>
                    <select 
                      value={input.climate} 
                      onChange={e => setInput({...input, climate: e.target.value as ClimateType})} 
                      className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                    >
                      {Object.values(ClimateType).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <h2 className="text-lg font-black mb-6 text-[#064e3b] flex items-center gap-2">
                  <i className="fas fa-sliders-h"></i> Parámetros {isGrassTab ? 'Césped' : 'Cultivo'}
                </h2>
                <div className="space-y-5">
                  {!isGrassTab ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => (
                        <button key={t} onClick={() => setInput({...input, treeType: t})} className={`p-3 rounded-xl border-2 text-[9px] font-black flex flex-col items-center gap-1 transition-all ${input.treeType === t ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-100'}`}>
                          <span className="text-lg">{TREE_TYPE_ICONS[t]}</span> {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as GrassVariety})} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm">
                      {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Cantidad</label>
                      <input type="number" min="1" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value)||1})} className="w-full p-3 bg-slate-50 border rounded-xl font-black outline-none focus:border-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Edad (Años)</label>
                      <input type="number" min="1" value={input.treeAge} onChange={e => setInput({...input, treeAge: parseInt(e.target.value)||1})} className="w-full p-3 bg-slate-50 border rounded-xl font-black outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Salud</label>
                      <select value={input.healthStatus} onChange={e => setInput({...input, healthStatus: e.target.value as any})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-[10px]">
                        <option value="bueno">Excelente</option>
                        <option value="regular">Regular</option>
                        <option value="deficiente">Crítico</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Suelo</label>
                      <select value={input.soilType} onChange={e => setInput({...input, soilType: e.target.value as SoilType})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-[10px]">
                        {Object.values(SoilType).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-xl border">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-[#064e3b] flex items-center gap-2"><i className="fas fa-cash-register"></i> Insumos</h2>
                  <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-2 py-1 rounded-full uppercase">COP 2026</span>
                </div>
                
                <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                      <i className="fas fa-tint"></i> Líquidos
                    </h3>
                    <div className="space-y-3">
                      {PRODUCT_CATEGORIES.LIQUIDS.map(p => renderProductItem(p))}
                    </div>
                  </section>
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                      <i className="fas fa-cubes"></i> Sólidos
                    </h3>
                    <div className="space-y-3">
                      {PRODUCT_CATEGORIES.SOLIDS.map(p => renderProductItem(p))}
                    </div>
                  </section>
                </div>

                <button onClick={handleFetchProfessionalAdvice} disabled={loading} className="w-full mt-6 py-4 bg-[#064e3b] text-white font-black rounded-xl shadow-lg hover:bg-emerald-800 disabled:opacity-50 transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                  {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-robot"></i>}
                  Asesoría Técnica IA
                </button>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-8">
              {result && result.products.length > 0 ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50 relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 no-print">
                        <div>
                          <h3 className="text-2xl font-black text-[#111827]">Reporte de Dosificación</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-widest">{speciesName} • {input.numTrees} {currentUnitLabel} • {input.department}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setShowPlantPlan(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:scale-105 transition-all shadow-md">Ficha Individual</button>
                          <button onClick={generatePDF} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:scale-105 transition-all shadow-md">Descargar PDF</button>
                          <button onClick={shareWhatsApp} className="bg-[#25D366] text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:scale-105 transition-all shadow-md">Compartir</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 no-print">
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                          <span className="text-[8px] font-black uppercase text-emerald-600 block mb-1">Inversión Lote</span>
                          <span className="text-2xl font-black text-[#064e3b]">${result.totalProjectCost.toLocaleString()} COP</span>
                        </div>
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                          <span className="text-[8px] font-black uppercase text-blue-600 block mb-1">Frecuencia</span>
                          <span className="text-xl font-black text-blue-900">{result.frequency}</span>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <span className="text-[8px] font-black uppercase text-slate-500 block mb-1">Estado Salud</span>
                          <span className="text-xl font-black text-[#111827] uppercase">{input.healthStatus}</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border no-print">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[9px] font-black uppercase">
                            <tr>
                              <th className="p-4">Insumo</th>
                              <th className="p-4">Dosis Total</th>
                              <th className="p-4">Costo Estimado</th>
                            </tr>
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
                  </div>

                  {aiAdvice && (
                    <div ref={aiSectionRef} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50 space-y-8 animate-in slide-in-from-bottom duration-500">
                        <div className="flex items-center gap-3 border-b pb-4">
                           <i className="fas fa-robot text-emerald-500 text-2xl"></i>
                           <h3 className="text-xl font-black text-[#064e3b]">Asesoría Agronómica Gemini 3</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-4">
                              <h4 className="text-sm font-black text-slate-800 uppercase">Tips de Aplicación</h4>
                              <ul className="space-y-2">
                                {aiAdvice.tips.map((tip, i) => (
                                  <li key={i} className="text-xs text-slate-600 flex gap-2">
                                    <span className="text-emerald-500">•</span> {tip}
                                  </li>
                                ))}
                              </ul>
                           </div>
                           <div className="p-4 bg-emerald-50 rounded-2xl">
                              <h4 className="text-sm font-black text-emerald-800 uppercase mb-2">Consejo Estacional</h4>
                              <p className="text-xs text-emerald-700 italic">{aiAdvice.seasonalAdvice}</p>
                           </div>
                        </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] p-20 text-center border-4 border-dashed border-slate-200 shadow-inner flex flex-col items-center no-print">
                  <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-4xl text-slate-200 shadow-inner">
                    <i className="fas fa-leaf"></i>
                  </div>
                  <h3 className="text-2xl font-black text-[#064e3b] mb-2 uppercase">Panel de Precisión</h3>
                  <p className="text-slate-400 text-sm font-medium">Seleccione los insumos a la izquierda para generar el plan de dosificación.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto py-10 space-y-12 no-print">
             {!visionReport && (
               <div className="bg-white p-16 rounded-[2.5rem] shadow-2xl text-center border">
                  <h2 className="text-4xl font-black text-[#111827] mb-4 uppercase tracking-tighter">IA Vision CO</h2>
                  <p className="text-slate-500 mb-8 font-bold">Diagnóstico fitosanitario regionalizado en tiempo real.</p>
                  <button onClick={() => visionFileInputRef.current?.click()} disabled={loading} className="bg-[#064e3b] text-white px-12 py-5 rounded-2xl text-lg font-black shadow-xl flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 transition-all">
                    {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-camera"></i>} 
                    {loading ? "Analizando muestra..." : "Escanear Muestra"}
                  </button>
                  <input type="file" accept="image/*" ref={visionFileInputRef} onChange={handlePhotoUpload} className="hidden" />
               </div>
             )}

             {visionReport && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-700">
                  <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-lg border">
                    <h3 className="text-2xl font-black text-[#064e3b] uppercase">Reporte Fitosanitario Pro</h3>
                    <button onClick={() => { setVisionReport(null); setVisionImage(null); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors">Nueva Captura</button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border overflow-hidden">
                      <div className="aspect-square bg-slate-100 rounded-3xl mb-6 overflow-hidden border-4 border-slate-50">
                        {visionImage ? <img src={visionImage} alt="Muestra" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-image text-4xl text-slate-300"></i></div>}
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-2xl">
                         <h4 className="text-[10px] font-black uppercase text-emerald-600 mb-1">Estado General</h4>
                         <p className="text-xs font-bold text-emerald-900 leading-relaxed">{visionReport.plantReading}</p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-red-50 relative overflow-hidden">
                         <div className={`absolute top-0 right-0 p-4 font-black uppercase text-[10px] rounded-bl-3xl ${
                           visionReport.pestAnalysis.severity === 'Crítica' ? 'bg-red-500 text-white' : 
                           visionReport.pestAnalysis.severity === 'Moderada' ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'
                         }`}>
                           {visionReport.pestAnalysis.severity}
                         </div>
                         <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                           <i className="fas fa-bug text-red-400"></i> Hallazgo Detectado
                         </h4>
                         <p className="text-2xl font-black text-[#064e3b] mb-1">{visionReport.pestAnalysis.identifiedPest}</p>
                         <p className="text-xs font-bold text-slate-400 italic mb-4">{visionReport.pestAnalysis.scientificName || 'Sin identificación científica'}</p>
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Síntomas Observados</span>
                            <p className="text-xs font-bold text-slate-600">{visionReport.pestAnalysis.symptoms}</p>
                         </div>
                      </div>

                      <div className="bg-[#064e3b] p-8 rounded-[2.5rem] shadow-xl text-white">
                         <h4 className="text-lg font-black mb-6 flex items-center gap-2">
                            <i className="fas fa-mortar-pestle text-emerald-400"></i> Remedio Biológico
                         </h4>
                         <div className="space-y-4">
                            <div className="flex flex-wrap gap-2 mb-4">
                              {visionReport.biologicalRemedy.ingredients.map((ing, i) => (
                                <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase">{ing}</span>
                              ))}
                            </div>
                            <div className="space-y-3">
                               <div>
                                  <span className="text-[10px] font-black uppercase text-emerald-400">Preparación</span>
                                  <p className="text-xs leading-relaxed opacity-90">{visionReport.biologicalRemedy.preparation}</p>
                               </div>
                               <div>
                                  <span className="text-[10px] font-black uppercase text-emerald-400">Aplicación</span>
                                  <p className="text-xs leading-relaxed opacity-90">{visionReport.biologicalRemedy.application}</p>
                               </div>
                            </div>
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
