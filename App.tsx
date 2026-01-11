
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, TREE_TYPE_ICONS, PRODUCT_CATEGORIES } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
  
  const aiSectionRef = useRef<HTMLDivElement>(null);
  const visionFileInputRef = useRef<HTMLInputElement>(null);

  const isGrassTab = activeTab === 'grass_pro';
  const currentType = isGrassTab ? TreeType.GRASS : input.treeType;
  const currentUnitLabel = isGrassTab ? input.grassMode : 'plantas';
  const speciesName = isGrassTab ? `Grama ${input.grassVariety}` : input.treeType;

  const calculateLocalData = useCallback(() => {
    let modifier = 1.0;
    if (input.healthStatus === 'regular') modifier *= 1.25;
    if (input.healthStatus === 'deficiente') modifier *= 1.5;
    if (input.soilType === SoilType.SANDY) modifier *= 1.2;

    const products: ProductResult[] = input.selectedProducts.map(p => {
      // Ajuste de cálculo: Para grama se usa área, para árboles se usa edad x cantidad
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

  const handleFetchProfessionalAdvice = async () => {
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
        setTimeout(() => aiSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 400);
      } else {
        setError("El Ingeniero IA no pudo procesar la solicitud. Verifique su conexión.");
      }
    } catch (err) {
      setError("Fallo crítico en el motor de inteligencia artificial.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const report = await getIndependentVisionDiagnosis(base64, isGrassTab ? "Grama/Césped" : input.treeType);
      if (report) setVisionReport(report);
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }, [input.treeType, isGrassTab]);

  const generatePDF = () => {
    if (!result) {
        alert("Seleccione insumos primero.");
        return;
    }
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('AGROVISION CO', 15, 25);
    
    doc.setFontSize(11);
    doc.text('Reporte de Dosificación y Costos', 15, 35);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(14);
    doc.text(`CULTIVO: ${speciesName}`, 15, 55);
    doc.text(`CANTIDAD: ${input.numTrees} ${currentUnitLabel}`, 15, 62);

    // Tabla de Dosis Detallada
    (doc as any).autoTable({
      startY: 70,
      head: [['Insumo', 'Dosis Total Recomendada', 'Precio Unit.', 'Costo Total']],
      body: result.products.map(p => [p.product, `${p.amount} ${p.unit}`, `$${p.costPerUnit}`, `$${p.totalCost.toLocaleString()}`]),
      headStyles: { fillColor: [16, 185, 129] },
      theme: 'striped'
    });

    if (aiAdvice) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('PROTOCOLO IA DE APLICACIÓN', 15, 20);
      
      (doc as any).autoTable({
        startY: 30,
        head: [['Etapa / Producto', 'Dosis Sugerida IA', 'Instrucción']],
        body: [
          ...aiAdvice.radicularPlan.map(p => [p.item, p.dosage, p.purpose]),
          ...aiAdvice.foliarPlan.map(p => [p.item, p.dosage, p.purpose])
        ],
        headStyles: { fillColor: [6, 78, 59] }
      });
    }

    doc.save(`AgroVision_${speciesName}.pdf`);
  };

  const shareWhatsApp = () => {
    if (!result) return;
    let message = `🌱 *AGROVISION CO* 🇨🇴\n\n` +
      `*Cultivo:* ${speciesName}\n` +
      `*Lote:* ${input.numTrees} ${currentUnitLabel}\n\n` +
      `*--- DOSIFICACIÓN RECOMENDADA ---*\n`;
    
    result.products.forEach(p => {
      message += `✅ ${p.product}: *${p.amount} ${p.unit}*\n`;
    });

    message += `\n*Presupuesto Estimado:* $${result.totalProjectCost.toLocaleString()} COP\n`;
    
    if (aiAdvice) {
        message += `\n*Instrucción IA:* ${aiAdvice.tips[0]}`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

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
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1">Calculadora Agrícola de Precisión</p>
            </div>
          </div>
          <nav className="flex bg-white/10 rounded-full p-1.5 border border-white/20 backdrop-blur-xl">
            {[
              { id: 'calculator', label: 'Cultivos', icon: 'fa-tree' },
              { id: 'grass_pro', label: 'Césped Pro', icon: 'fa-align-justify' },
              { id: 'vision', label: 'IA Vision', icon: 'fa-camera' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white text-[#064e3b] shadow-xl scale-105' : 'text-white hover:bg-white/10'}`}>
                <i className={`fas ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-10">
        {activeTab !== 'vision' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-xl font-black mb-8 text-[#064e3b] border-b pb-4 flex items-center gap-3">
                  <i className="fas fa-sliders-h"></i> {isGrassTab ? 'Ajustes de Grama' : 'Ajustes de Cultivo'}
                </h2>
                
                <div className="space-y-8">
                  {isGrassTab ? (
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest block">Variedad de Grama Colombiana</label>
                      <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as GrassVariety})} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-black text-[#111827] focus:border-emerald-500 outline-none appearance-none">
                        {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => (
                        <button key={t} onClick={() => setInput({...input, treeType: t})} className={`p-4 rounded-2xl border-2 text-[10px] font-black flex flex-col items-center gap-2 transition-all ${input.treeType === t ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md scale-105' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                          <span className="text-2xl">{TREE_TYPE_ICONS[t]}</span> {t}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Cantidad</label>
                      <input type="number" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value)||1})} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-black text-[#111827] outline-none focus:border-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Unidad</label>
                      {isGrassTab ? (
                        <select value={input.grassMode} onChange={e => setInput({...input, grassMode: e.target.value as GrassMeasureMode})} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-black text-[#111827] outline-none">
                          <option value={GrassMeasureMode.AREA}>m² (Área)</option>
                          <option value={GrassMeasureMode.LINEAR}>m Lineal</option>
                        </select>
                      ) : (
                        <div className="p-4 bg-slate-200 border-2 border-slate-300 rounded-2xl font-black text-slate-500 text-center uppercase text-xs">Plantas</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Clima</label>
                      <select value={input.climate} onChange={e => setInput({...input, climate: e.target.value as ClimateType})} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-black text-[#111827] text-xs">
                        {Object.values(ClimateType).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Suelo</label>
                      <select value={input.soilType} onChange={e => setInput({...input, soilType: e.target.value as SoilType})} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-black text-[#111827] text-xs">
                        {Object.values(SoilType).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-xl font-black text-[#064e3b] mb-6 flex items-center gap-3"><i className="fas fa-cash-register"></i> Insumos y Costos</h2>
                <div className="max-h-[450px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  {Object.values(OrganicProduct).map(p => {
                    const selected = input.selectedProducts.includes(p);
                    const unit = PRODUCT_UNITS[p];
                    return (
                      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${selected ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-100'}`}>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={selected} onChange={() => setInput(prev => ({ ...prev, selectedProducts: selected ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="accent-emerald-600 h-5 w-5" />
                          <span className="text-sm font-bold text-[#111827]">{p}</span>
                        </label>
                        {selected && (
                          <div className="mt-4 pl-8 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase">Precio por {unit}</span>
                              <input type="number" placeholder="0.00" onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})} className="w-24 p-2 text-xs border-2 rounded-xl font-bold bg-white text-[#111827] text-right" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <button onClick={handleFetchProfessionalAdvice} disabled={loading} className="w-full mt-10 py-6 bg-[#064e3b] text-white font-black rounded-2xl shadow-xl hover:bg-emerald-800 disabled:opacity-50 transition-all flex flex-col items-center justify-center border-4 border-white/10">
                  {loading ? <i className="fas fa-circle-notch animate-spin text-2xl"></i> : <><span className="text-sm tracking-widest uppercase">Generar Protocolo IA</span><span className="text-[9px] font-bold opacity-70 mt-1 uppercase">Analizar Lote y Precios</span></>}
                </button>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-10">
              {result && result.products.length > 0 ? (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom duration-500">
                  {/* TABLA DE DOSIFICACIÓN RECOMENDADA */}
                  <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border-4 border-emerald-50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-[#111827] tracking-tight">Dosis Recomendadas por Insumo</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Cálculo basado en {input.numTrees} {currentUnitLabel}</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={generatePDF} className="bg-slate-100 text-slate-700 p-3 rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all shadow-sm">
                                <i className="fas fa-file-pdf text-xl"></i>
                            </button>
                            <button onClick={shareWhatsApp} className="bg-[#25D366] text-white p-3 rounded-2xl hover:opacity-80 transition-all shadow-md">
                                <i className="fab fa-whatsapp text-xl"></i>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-slate-100">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-5 text-[10px] font-black uppercase text-slate-400">Insumo Seleccionado</th>
                                    <th className="p-5 text-[10px] font-black uppercase text-slate-400">Dosis Total</th>
                                    <th className="p-5 text-[10px] font-black uppercase text-slate-400">Costo Estimado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.products.map((p, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-emerald-50/30 transition-all">
                                        <td className="p-5">
                                            <span className="font-bold text-[#111827]">{p.product}</span>
                                        </td>
                                        <td className="p-5">
                                            <span className="px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-sm">
                                                {p.amount.toLocaleString()} {p.unit}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <span className="font-black text-slate-600">
                                                ${p.totalCost.toLocaleString('es-CO')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50/50">
                                    <td colSpan={2} className="p-5 text-right font-black text-slate-400 uppercase text-xs">Presupuesto Total</td>
                                    <td className="p-5 font-black text-2xl text-emerald-700 tracking-tighter">
                                        ${result.totalProjectCost.toLocaleString('es-CO')}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-rose-50 border-4 border-rose-200 p-8 rounded-[2.5rem] text-rose-800 font-bold flex items-center gap-6 shadow-lg">
                      <i className="fas fa-exclamation-triangle text-4xl text-rose-500"></i>
                      <div><p className="text-lg">Atención:</p><p className="opacity-80">{error}</p></div>
                    </div>
                  )}

                  <div ref={aiSectionRef}>
                    {aiAdvice ? (
                      <div className="space-y-10 animate-in fade-in slide-in-from-bottom duration-1000">
                        {/* HEADER PROTOCOLO IA */}
                        <div className="bg-[#064e3b] p-12 rounded-[4rem] shadow-2xl text-white relative overflow-hidden border-8 border-white/5">
                          <div className="absolute -top-10 -right-10 opacity-5 text-[15rem]"><i className="fas fa-microchip"></i></div>
                          <div className="relative z-10">
                            <h2 className="text-4xl font-black tracking-tight mb-4">Refinamiento Agronómico IA</h2>
                            <p className="opacity-80 font-bold text-sm max-w-lg mb-8">El ingeniero IA ha ajustado estas dosis considerando el clima de {input.climate} y el suelo {input.soilType}.</p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 text-center">
                                <span className="text-[9px] font-black uppercase opacity-60 block mb-1">Puntaje Salud</span>
                                <span className="text-xl font-black uppercase">{input.healthStatus}</span>
                              </div>
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 text-center">
                                <span className="text-[9px] font-black uppercase opacity-60 block mb-1">Especie</span>
                                <span className="text-xl font-black truncate">{speciesName}</span>
                              </div>
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 text-center">
                                <span className="text-[9px] font-black uppercase opacity-60 block mb-1">Sostenibilidad</span>
                                <span className="text-xl font-black">{aiAdvice.sustainabilityScore}%</span>
                              </div>
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 text-center">
                                <span className="text-[9px] font-black uppercase opacity-60 block mb-1">Ciclo Sugerido</span>
                                <span className="text-xl font-black">{result.frequency}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* PLANES IA */}
                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border-t-[12px] border-[#3d2b1f]">
                            <h3 className="text-2xl font-black text-[#3d2b1f] mb-8 flex items-center gap-4"><i className="fas fa-layer-group"></i> Pasos Suelo</h3>
                            <div className="space-y-6">
                              {aiAdvice.radicularPlan.map((step, i) => (
                                <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                  <h4 className="font-black text-[#111827] text-lg leading-tight mb-2 uppercase">{step.item}</h4>
                                  <span className="px-4 py-1 bg-amber-100 text-amber-900 text-[10px] font-black rounded-full uppercase inline-block mb-3">IA Sugiere: {step.dosage}</span>
                                  <p className="text-slate-600 text-sm font-medium leading-relaxed italic">"{step.purpose}"</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border-t-[12px] border-[#064e3b]">
                            <h3 className="text-2xl font-black text-[#064e3b] mb-8 flex items-center gap-4"><i className="fas fa-spray-can"></i> Pasos Foliar</h3>
                            <div className="space-y-6">
                              {aiAdvice.foliarPlan.map((step, i) => (
                                <div key={i} className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                                  <h4 className="font-black text-[#111827] text-lg leading-tight mb-2 uppercase">{step.item}</h4>
                                  <span className="px-4 py-1 bg-emerald-200 text-emerald-900 text-[10px] font-black rounded-full uppercase inline-block mb-3">IA Sugiere: {step.dosage}</span>
                                  <p className="text-emerald-800 text-sm font-medium leading-relaxed italic">"{step.purpose}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-amber-50 p-10 rounded-[3.5rem] border-2 border-amber-200">
                          <h3 className="text-xl font-black text-amber-900 mb-6 flex items-center gap-3"><i className="fas fa-lightbulb"></i> Tips del Ingeniero</h3>
                          <div className="space-y-4">
                            {aiAdvice.tips.map((tip, i) => (
                              <div key={i} className="flex gap-4 items-start bg-white/50 p-4 rounded-2xl">
                                <i className="fas fa-check-circle text-amber-600 mt-1"></i>
                                <p className="font-bold text-sm text-amber-900 leading-relaxed">{tip}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      loading && (
                        <div className="bg-white p-24 rounded-[4rem] shadow-2xl border-4 border-dashed border-emerald-200 flex flex-col items-center justify-center text-center">
                          <div className="relative mb-12">
                            <i className="fas fa-circle-notch animate-spin text-8xl text-emerald-600"></i>
                            <i className="fas fa-robot absolute inset-0 flex items-center justify-center text-3xl text-emerald-700"></i>
                          </div>
                          <h3 className="text-4xl font-black text-[#111827] mb-4 tracking-tighter">Sincronizando con Ingeniero IA...</h3>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[4rem] p-32 text-center border-4 border-dashed border-slate-200 flex flex-col items-center shadow-inner">
                  <div className="h-44 w-44 bg-slate-50 rounded-full flex items-center justify-center mb-10 text-7xl text-slate-200 shadow-inner group hover:scale-110 transition-all duration-500">
                    <i className="fas fa-seedling"></i>
                  </div>
                  <h3 className="text-5xl font-black text-[#064e3b] mb-4 leading-none tracking-tighter uppercase">AgroVision CO</h3>
                  <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto leading-relaxed">Seleccione insumos para ver las dosis recomendadas de inmediato.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-10 py-10 animate-in fade-in duration-700">
             <div className="bg-white p-20 rounded-[4rem] shadow-2xl text-center border border-slate-200">
                <h2 className="text-6xl font-black text-[#111827] mb-6 leading-none tracking-tighter uppercase">Diagnóstico Vision</h2>
                <button onClick={() => visionFileInputRef.current?.click()} className="group bg-[#064e3b] text-white px-20 py-8 rounded-full text-2xl font-black shadow-2xl flex items-center gap-6 border-8 border-emerald-100 mx-auto">
                    <i className="fas fa-camera"></i> Escanear Hoja
                </button>
                <input type="file" accept="image/*" ref={visionFileInputRef} onChange={handlePhotoUpload} className="hidden" />
             </div>
             {visionReport && (
                <div className="bg-[#111827] p-12 rounded-[4.5rem] text-white shadow-2xl space-y-12">
                   <p className="text-5xl font-black italic tracking-tight">"{visionReport.plantReading}"</p>
                </div>
             )}
          </div>
        )}
      </main>
      <footer className="mt-40 text-center py-12 border-t border-slate-200 opacity-60 no-print">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#064e3b]">AgroVision CO • Comunidad de Precisión 2024</p>
      </footer>
    </div>
  );
};

export default App;
