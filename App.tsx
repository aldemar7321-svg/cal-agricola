
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, TREE_TYPE_ICONS, PRODUCT_NUTRIENTS } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass_pro' | 'vision'>('calculator');
  const [input, setInput] = useState<CalculationInput>({
    treeType: TreeType.CITRUS,
    applicationMode: ApplicationMode.MAINTENANCE,
    grassVariety: GrassVariety.KIKUYO,
    soilType: SoilType.LOAMY,
    climate: ClimateType.MODERATE,
    treeAge: 1,
    numTrees: 1,
    grassMode: GrassMeasureMode.AREA,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    productPrices: {},
    manualAmounts: {},
    selectedUnits: {},
    healthStatus: 'bueno'
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [visionReport, setVisionReport] = useState<VisionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  
  const aiSectionRef = useRef<HTMLDivElement>(null);
  const visionFileInputRef = useRef<HTMLInputElement>(null);

  const isGrassTab = activeTab === 'grass_pro';
  const currentType = isGrassTab ? TreeType.GRASS : input.treeType;
  const currentUnitLabel = isGrassTab ? input.grassMode : 'plantas';
  const speciesName = isGrassTab ? `Grama ${input.grassVariety}` : input.treeType;

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
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
        setError("No se pudo obtener la ubicación. Verifica los permisos.");
        setFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    captureLocation();
  }, []);

  const calculateLocalData = useCallback(() => {
    let modifier = 1.0;
    if (input.healthStatus === 'regular') modifier *= 1.25;
    if (input.healthStatus === 'deficiente') modifier *= 1.5;
    if (input.soilType === SoilType.SANDY) modifier *= 1.2;

    const products: ProductResult[] = input.selectedProducts.map(p => {
      const baseMult = (currentType === TreeType.GRASS) ? input.numTrees : (input.treeAge || 1) * input.numTrees;
      const baseAmount = BASE_RATES[p] || 0;
      const amount = input.manualAmounts[p] ?? (baseMult * baseAmount * modifier);
      const unit = input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g';
      const price = input.productPrices[p] || 0;
      
      return {
        product: p,
        amount: parseFloat(amount.toFixed(2)),
        unit: unit as UnitType,
        costPerUnit: price,
        totalCost: parseFloat((amount * price).toFixed(2))
      };
    });

    setResult({
      products,
      totalCostPerUnit: 0,
      totalProjectCost: products.reduce((a, b) => a + b.totalCost, 0),
      frequency: currentType === TreeType.GRASS ? "Mensual" : "Trimestral"
    });
  }, [input, currentType]);

  useEffect(() => { calculateLocalData(); }, [calculateLocalData]);

  const nutrientBalance = useMemo(() => {
    if (!result) return [];
    const totals = { N: 0, P: 0, K: 0, MO: 0 };
    
    result.products.forEach(p => {
      const profile = PRODUCT_NUTRIENTS[p.product];
      // Calculamos la carga real basada en la dosis
      totals.N += (p.amount * profile.N) / 100;
      totals.P += (p.amount * profile.P) / 100;
      totals.K += (p.amount * profile.K) / 100;
      totals.MO += (p.amount * profile.OM) / 100;
    });

    return [
      { name: 'Nitrógeno (N)', value: parseFloat(totals.N.toFixed(2)), color: '#10b981' },
      { name: 'Fósforo (P)', value: parseFloat(totals.P.toFixed(2)), color: '#3b82f6' },
      { name: 'Potasio (K)', value: parseFloat(totals.K.toFixed(2)), color: '#f59e0b' },
      { name: 'Mat. Orgánica (MO)', value: parseFloat(totals.MO.toFixed(2)), color: '#78350f' },
    ];
  }, [result]);

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
        setError("La IA no pudo procesar los datos. Verifique su conexión.");
      }
    } catch (err) {
      setError("Error crítico en el servicio de Inteligencia Artificial.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const report = await getIndependentVisionDiagnosis(base64, isGrassTab ? "Grama/Césped" : input.treeType);
      if (report) {
        setVisionReport(report);
      } else {
        setError("No se pudo realizar el diagnóstico visual.");
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }, [input.treeType, isGrassTab]);

  const generatePDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE AGROVISION CO', 15, 25);
    doc.setFontSize(10);
    doc.text('Ingeniería de Precisión y Bio-Insumos', 15, 35);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('I. INFORMACIÓN TÉCNICA', 15, 65);
    doc.line(15, 68, pageWidth - 15, 68);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const meta = [
      [`Cultivo:`, speciesName],
      [`Cantidad:`, `${input.numTrees} ${currentUnitLabel}`],
      [`Suelo:`, input.soilType],
      [`Clima:`, input.climate],
      [`Ubicación:`, input.location ? `${input.location.lat.toFixed(5)}, ${input.location.lng.toFixed(5)}` : 'No registrada'],
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
      headStyles: { fillColor: [16, 185, 129], textColor: [0, 0, 0] },
      theme: 'grid',
      styles: { textColor: [0, 0, 0] }
    });

    const nutrientY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE DE NUTRIENTES APLICADOS', 15, nutrientY);
    autoTable(doc, {
      startY: nutrientY + 5,
      head: [['Elemento', 'Carga Total (g/ml equiv.)']],
      body: nutrientBalance.map(n => [n.name, n.value.toString()]),
      headStyles: { fillColor: [59, 130, 246], textColor: [0, 0, 0] },
      styles: { textColor: [0, 0, 0] }
    });

    if (aiAdvice) {
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFont('helvetica', 'bold');
      doc.text('II. PROTOCOLO DE APLICACIÓN IA', 15, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Producto', 'Dosis Sugerida', 'Instrucción']],
        body: [
          ...aiAdvice.radicularPlan.map(p => [p.item, p.dosage, p.purpose]),
          ...aiAdvice.foliarPlan.map(p => [p.item, p.dosage, p.purpose])
        ],
        headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255] },
        styles: { textColor: [0, 0, 0] }
      });
    }

    doc.save(`Reporte_AgroVision_${speciesName.replace(/\s+/g, '_')}.pdf`);
  };

  const shareWhatsApp = () => {
    if (!result) return;
    const locationStr = input.location ? `📍 *Ubicación:* https://www.google.com/maps?q=${input.location.lat},${input.location.lng}\n` : '';
    let msg = `🚜 *AGROVISION CO - REPORTE FINAL*\n\n` +
      `📍 *Cultivo:* ${speciesName}\n` +
      locationStr +
      `📦 *Lote:* ${input.numTrees} ${currentUnitLabel}\n` +
      `💰 *Presupuesto:* $${result.totalProjectCost.toLocaleString()} COP\n\n` +
      `*BALANCE NPK+MO:*\n` +
      nutrientBalance.map(n => `• ${n.name}: *${n.value}*`).join('\n') + `\n\n` +
      `*DOSIS RECOMENDADAS:*\n` +
      result.products.map(p => `✅ ${p.product}: *${p.amount} ${p.unit}*`).join('\n') + `\n\n` +
      `_Reporte de Precisión Agrícola_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendEmail = () => {
    if (!result) return;
    const locationStr = input.location ? `UBICACIÓN: https://www.google.com/maps?q=${input.location.lat},${input.location.lng}\n` : '';
    const subject = `Reporte Técnico - ${speciesName}`;
    const body = `Hola,\n\nSe adjunta el reporte de dosificación para ${speciesName}.\n\n` +
      locationStr +
      `BALANCE NPK+MO:\n` +
      nutrientBalance.map(n => `- ${n.name}: ${n.value}`).join('\n') +
      `\n\nCANTIDAD: ${input.numTrees} ${currentUnitLabel}\n\n` +
      `INSUMOS:\n` +
      result.products.map(p => `- ${p.product}: ${p.amount} ${p.unit} ($${p.totalCost.toLocaleString()})`).join('\n') +
      `\n\nTOTAL: $${result.totalProjectCost.toLocaleString()} COP\n\n` +
      `AgroVision CO`;

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const hasNutrientData = useMemo(() => nutrientBalance.some(n => n.value > 0), [nutrientBalance]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] pb-24 text-[#111827]">
      <header className="bg-[#064e3b] text-white p-6 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 h-14 w-14 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl border-2 border-white/20">
              <i className="fas fa-leaf"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none uppercase">AgroVision <span className="text-emerald-400">CO</span></h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1">Calculadora de Precisión</p>
            </div>
          </div>
          <nav className="flex bg-white/10 rounded-full p-1 border border-white/20 backdrop-blur-xl overflow-x-auto max-w-full">
            {[
              { id: 'calculator', label: 'Cultivos', icon: 'fa-tree' },
              { id: 'grass_pro', label: 'Césped', icon: 'fa-align-justify' },
              { id: 'vision', label: 'IA Vision', icon: 'fa-camera' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-[#064e3b] shadow-lg scale-105' : 'text-white hover:bg-white/10'}`}>
                <i className={`fas ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-10">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 font-bold rounded shadow-md flex justify-between items-center animate-in fade-in slide-in-from-top duration-300">
            <span><i className="fas fa-exclamation-triangle mr-2"></i> {error}</span>
            <button onClick={() => setError(null)} className="text-red-900"><i className="fas fa-times"></i></button>
          </div>
        )}

        {activeTab !== 'vision' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6">
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                <h2 className="text-xl font-black mb-6 text-[#064e3b] flex items-center gap-3">
                  <i className="fas fa-map-marker-alt"></i> Ubicación del Predio
                </h2>
                <div className="space-y-4">
                  {input.location ? (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Coordenadas</span>
                        <button onClick={captureLocation} className="text-emerald-700 hover:text-emerald-900 transition-colors">
                          <i className={`fas fa-sync-alt ${fetchingLocation ? 'animate-spin' : ''}`}></i>
                        </button>
                      </div>
                      <p className="text-sm font-black text-[#111827]">{input.location.lat.toFixed(6)}, {input.location.lng.toFixed(6)}</p>
                      <a 
                        href={`https://www.google.com/maps?q=${input.location.lat},${input.location.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-xs font-black text-emerald-700 hover:underline"
                      >
                        <i className="fas fa-external-link-alt"></i> Ver en Google Maps
                      </a>
                    </div>
                  ) : (
                    <button 
                      onClick={captureLocation} 
                      disabled={fetchingLocation}
                      className="w-full p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-black text-xs hover:bg-slate-100 transition-all flex flex-col items-center gap-2"
                    >
                      {fetchingLocation ? (
                        <><i className="fas fa-circle-notch animate-spin text-xl"></i> Obteniendo ubicación...</>
                      ) : (
                        <><i className="fas fa-crosshairs text-xl"></i> Capturar ubicación actual</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                <h2 className="text-xl font-black mb-8 text-[#064e3b] border-b pb-4 flex items-center gap-3">
                  <i className="fas fa-sliders-h"></i> {isGrassTab ? 'Ajustes Grama' : 'Ajustes Cultivo'}
                </h2>
                <div className="space-y-6">
                  {isGrassTab ? (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase text-slate-500">Variedad</label>
                      <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as GrassVariety})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold text-sm text-[#111827]">
                        {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => (
                        <button key={t} onClick={() => setInput({...input, treeType: t})} className={`p-4 rounded-xl border-2 text-[10px] font-black flex flex-col items-center gap-2 transition-all ${input.treeType === t ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md' : 'bg-slate-50 border-slate-100'}`}>
                          <span className="text-xl">{TREE_TYPE_ICONS[t]}</span> {t}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Cantidad</label>
                      <input type="number" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value)||1})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-black outline-none focus:border-emerald-500 text-[#111827]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Unidad</label>
                      {isGrassTab ? (
                        <select value={input.grassMode} onChange={e => setInput({...input, grassMode: e.target.value as GrassMeasureMode})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-black text-[#111827]">
                          <option value={GrassMeasureMode.AREA}>m²</option>
                          <option value={GrassMeasureMode.LINEAR}>m lineal</option>
                        </select>
                      ) : (
                        <div className="p-4 bg-slate-200 border-2 border-slate-300 rounded-xl font-black text-slate-500 text-center uppercase text-xs">Plantas</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Salud</label>
                      <select value={input.healthStatus} onChange={e => setInput({...input, healthStatus: e.target.value as any})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-black text-xs text-[#111827]">
                        <option value="bueno">Excelente/Bueno</option>
                        <option value="regular">Regular/Mantenimiento</option>
                        <option value="deficiente">Deficiente/Crítico</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Suelo</label>
                      <select value={input.soilType} onChange={e => setInput({...input, soilType: e.target.value as SoilType})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-black text-xs text-[#111827]">
                        {Object.values(SoilType).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                <h2 className="text-xl font-black text-[#064e3b] mb-6 flex items-center gap-3"><i className="fas fa-cash-register"></i> Insumos</h2>
                <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  {Object.values(OrganicProduct).map(p => {
                    const selected = input.selectedProducts.includes(p);
                    const unit = PRODUCT_UNITS[p];
                    return (
                      <div key={p} className={`p-4 rounded-xl border-2 transition-all ${selected ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={selected} onChange={() => setInput(prev => ({ ...prev, selectedProducts: selected ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="accent-emerald-600 h-5 w-5" />
                          <span className="text-xs font-black text-[#111827]">{p}</span>
                        </label>
                        {selected && (
                          <div className="mt-3">
                            <input type="number" placeholder={`Precio/${unit}`} onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})} className="w-full p-2.5 text-xs border-2 rounded-lg font-bold bg-white outline-none focus:border-emerald-500 text-[#111827]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleFetchProfessionalAdvice} disabled={loading} className="w-full mt-8 py-5 bg-[#064e3b] text-white font-black rounded-xl shadow-lg hover:bg-emerald-800 disabled:opacity-50 transition-all border-4 border-white/10 uppercase text-xs tracking-widest flex items-center justify-center gap-3">
                  {loading ? (
                    <><i className="fas fa-circle-notch animate-spin"></i> Procesando...</>
                  ) : (
                    "Generar Reporte IA"
                  )}
                </button>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-10">
              {result && result.products.length > 0 ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border-4 border-emerald-50 relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                        <div>
                          <h3 className="text-3xl font-black text-[#111827]">Informe de Dosificación</h3>
                          <p className="text-xs font-bold text-slate-500 uppercase mt-2 tracking-widest">{speciesName} • {input.numTrees} {currentUnitLabel}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={generatePDF} className="bg-slate-900 text-white px-5 py-3.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-md">
                            <i className="fas fa-file-pdf"></i> PDF
                          </button>
                          <button onClick={shareWhatsApp} className="bg-[#25D366] text-white px-5 py-3.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-md">
                            <i className="fab fa-whatsapp"></i> WhatsApp
                          </button>
                          <button onClick={sendEmail} className="bg-[#4285F4] text-white px-5 py-3.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-md">
                            <i className="fas fa-envelope"></i> Email
                          </button>
                        </div>
                      </div>

                      <div className="mb-10 p-8 bg-slate-50 rounded-[2rem] border border-slate-200">
                        <h4 className="text-sm font-black uppercase text-[#111827] mb-6 tracking-widest flex items-center gap-2">
                          <i className="fas fa-chart-bar text-blue-500"></i> Balance Nutricional (Carga Estimada)
                        </h4>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-inner" style={{ height: '300px' }}>
                          {hasNutrientData ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={nutrientBalance} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis 
                                  dataKey="name" 
                                  type="category" 
                                  width={130} 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{ fontSize: 10, fontWeight: 800, fill: '#000000' }} 
                                />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }} 
                                  cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={30}>
                                  {nutrientBalance.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                               <i className="fas fa-chart-area text-4xl"></i>
                               <p className="font-bold italic text-sm">Aún no hay carga nutricional detectada</p>
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-[#111827] mt-4 text-center font-bold italic">
                          * Los valores representan la carga total calculada (g o ml equivalentes) basada en la composición porcentual de los insumos seleccionados.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="bg-emerald-50 p-8 rounded-[1.5rem] border border-emerald-100">
                          <span className="text-[10px] font-black uppercase text-emerald-600 mb-2 block tracking-widest">Inversión Lote</span>
                          <span className="text-4xl font-black text-[#064e3b]">${result.totalProjectCost.toLocaleString()} <small className="text-xs">COP</small></span>
                        </div>
                        <div className="bg-slate-50 p-8 rounded-[1.5rem] border border-slate-100">
                          <span className="text-[10px] font-black uppercase text-[#111827] mb-2 block tracking-widest">Frecuencia Ciclo</span>
                          <span className="text-2xl font-black text-[#111827]">{result.frequency}</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="p-4 text-[10px] font-black uppercase text-[#111827]">Insumo</th>
                              <th className="p-4 text-[10px] font-black uppercase text-[#111827]">Dosis Recomendada</th>
                              <th className="p-4 text-[10px] font-black uppercase text-[#111827]">Costo Estimado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.products.map((p, idx) => (
                              <tr key={idx} className="border-b border-slate-50 hover:bg-emerald-50/20">
                                <td className="p-4 font-bold text-sm text-[#111827]">{p.product}</td>
                                <td className="p-4"><span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg font-black text-xs">{p.amount.toLocaleString()} {p.unit}</span></td>
                                <td className="p-4 font-black text-[#111827] text-sm">${p.totalCost.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {aiAdvice && (
                    <div ref={aiSectionRef} className="animate-in fade-in slide-in-from-bottom duration-1000 space-y-6">
                      <div className="bg-[#064e3b] p-10 rounded-[2rem] text-white shadow-xl relative overflow-hidden border-8 border-white/5">
                        <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Protocolo Agronómico IA</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                          <div className="bg-white/10 p-4 rounded-xl text-center"><span className="text-[8px] block uppercase opacity-60 font-black">Suelo</span><span className="text-sm font-black">{input.soilType}</span></div>
                          <div className="bg-white/10 p-4 rounded-xl text-center"><span className="text-[8px] block uppercase opacity-60 font-black">Clima</span><span className="text-sm font-black">{input.climate}</span></div>
                          <div className="bg-white/10 p-4 rounded-xl text-center"><span className="text-[8px] block uppercase opacity-60 font-black">Bio-Eco</span><span className="text-sm font-black">{aiAdvice.sustainabilityScore}%</span></div>
                          <div className="bg-white/10 p-4 rounded-xl text-center"><span className="text-[8px] block uppercase opacity-60 font-black">Salud</span><span className="text-sm font-black uppercase">{input.healthStatus}</span></div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[2rem] shadow-xl border-t-[8px] border-amber-800">
                          <h3 className="text-xl font-black text-amber-900 mb-6 flex items-center gap-2"><i className="fas fa-mountain"></i> Nutrición Suelo</h3>
                          {aiAdvice.radicularPlan.map((s, i) => (
                            <div key={i} className="mb-5 pb-5 border-b border-slate-50 last:border-0">
                              <h4 className="font-black text-[#111827] uppercase text-[11px] mb-1">{s.item}</h4>
                              <p className="text-emerald-700 font-black text-[10px] mb-2 uppercase">Dosis: {s.dosage}</p>
                              <p className="text-slate-500 text-xs italic leading-relaxed">"{s.purpose}"</p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-white p-8 rounded-[2rem] shadow-xl border-t-[8px] border-emerald-600">
                          <h3 className="text-xl font-black text-emerald-900 mb-6 flex items-center gap-2"><i className="fas fa-spray-can"></i> Refuerzo Foliar</h3>
                          {aiAdvice.foliarPlan.map((s, i) => (
                            <div key={i} className="mb-5 pb-5 border-b border-slate-50 last:border-0">
                              <h4 className="font-black text-[#111827] uppercase text-[11px] mb-1">{s.item}</h4>
                              <p className="text-emerald-700 font-black text-[10px] mb-2 uppercase">Dosis: {s.dosage}</p>
                              <p className="text-slate-500 text-xs italic leading-relaxed">"{s.purpose}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] p-24 text-center border-4 border-dashed border-slate-200 shadow-inner flex flex-col items-center">
                  <div className="h-32 w-32 bg-slate-50 rounded-full flex items-center justify-center mb-8 text-6xl text-slate-200 shadow-inner">
                    <i className="fas fa-seedling"></i>
                  </div>
                  <h3 className="text-4xl font-black text-[#064e3b] mb-4 uppercase tracking-tighter">Panel de Resultados</h3>
                  <p className="text-slate-500 text-lg font-medium max-w-lg leading-relaxed">Seleccione sus insumos y cantidad a la izquierda para ver las dosis recomendadas de precisión.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-10 space-y-8 animate-in fade-in duration-700">
             <div className="bg-white p-16 rounded-[2.5rem] shadow-2xl text-center border border-slate-200">
                <h2 className="text-5xl font-black text-[#111827] mb-6 uppercase tracking-tighter">IA Vision CO</h2>
                <p className="text-slate-600 mb-10 font-bold max-w-lg mx-auto">Tome una fotografía de la muestra afectada para diagnóstico en tiempo real.</p>
                <button onClick={() => visionFileInputRef.current?.click()} className="bg-[#064e3b] text-white px-16 py-6 rounded-2xl text-xl font-black shadow-2xl flex items-center gap-4 border-8 border-emerald-100 mx-auto hover:scale-105 active:scale-95 transition-all">
                    <i className="fas fa-camera"></i> Escanear Hoja
                </button>
                <input type="file" accept="image/*" ref={visionFileInputRef} onChange={handlePhotoUpload} className="hidden" />
             </div>
             {visionReport && (
                <div className="bg-[#111827] p-10 rounded-[2.5rem] text-white shadow-2xl space-y-8 border-8 border-white/5 animate-in slide-in-from-bottom duration-500">
                   <div className="border-b border-white/10 pb-8">
                      <h3 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4">Análisis de Muestra</h3>
                      <p className="text-3xl font-black italic tracking-tight opacity-95">"{visionReport.plantReading}"</p>
                   </div>
                   <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-white/5 p-8 rounded-3xl border border-white/10">
                        <h4 className="text-lg font-black mb-4 text-emerald-400 flex items-center gap-2"><i className="fas fa-bug"></i> Hallazgo</h4>
                        <p className="text-base font-bold mb-2">{visionReport.pestAnalysis.identifiedPest}</p>
                        <p className="text-xs opacity-70 leading-relaxed italic">{visionReport.pestAnalysis.symptoms}</p>
                      </div>
                      <div className="bg-white/5 p-8 rounded-3xl border border-white/10">
                        <h4 className="text-lg font-black mb-4 text-emerald-400 flex items-center gap-2"><i className="fas fa-flask"></i> Solución</h4>
                        <p className="text-xs leading-relaxed opacity-90 italic">"{visionReport.biologicalRemedy.preparation}"</p>
                      </div>
                   </div>
                </div>
             )}
          </div>
        )}
      </main>
      <footer className="mt-40 text-center py-10 border-t border-slate-200 opacity-50">
        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#064e3b]">AgroVision CO • 2024</p>
      </footer>
    </div>
  );
};

export default App;
