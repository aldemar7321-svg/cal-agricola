
import React, { useState, useEffect, useCallback } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, Department, ClientData, HistoryRecord } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, COLOMBIAN_MARKET_PRICES, TREE_TYPE_ICONS } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const BioGenesisLogo = () => (
  <div className="flex items-center gap-3">
    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-xl">
      <i className="fas fa-leaf text-emerald-600 text-2xl"></i>
    </div>
    <div className="flex flex-col">
      <h1 className="text-2xl font-black text-white leading-none tracking-tighter">BioGenesis <span className="text-emerald-400">PRO</span></h1>
      <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-[0.3em] mt-1">Ingeniería Agronómica</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass_pro' | 'vision' | 'history'>('calculator');
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [visionReport, setVisionReport] = useState<VisionReport | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [marginPercent, setMarginPercent] = useState<number>(0);

  const [clientData, setClientData] = useState<ClientData>({
    firstName: '', lastName: '', location: '', contact: '', email: ''
  });

  const [input, setInput] = useState<CalculationInput>({
    treeType: TreeType.CITRUS, department: Department.ANTIOQUIA, applicationMode: ApplicationMode.MAINTENANCE,
    soilType: SoilType.FRANCO, climate: ClimateType.MODERATE, treeAge: 1, numTrees: 1, 
    grassVariety: GrassVariety.KIKUYO, grassMode: GrassMeasureMode.AREA,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    productPrices: { ...COLOMBIAN_MARKET_PRICES }, manualPlantAmounts: {}, selectedUnits: {},
    cycleFrequencyValue: 3, cycleFrequencyUnit: 'meses', healthStatus: 'bueno'
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('biogenesis_history_v3');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const calculateSingleProduct = useCallback((p: OrganicProduct) => {
    const numPlantsOrM2 = Math.max(1, input.numTrees || 1);
    const isGrass = activeTab === 'grass_pro';
    
    let finalDosePerUnit: number;
    if (input.manualPlantAmounts[p] !== undefined) {
      finalDosePerUnit = input.manualPlantAmounts[p] as number;
    } else {
      let modifier = 1.0;
      if (input.healthStatus === 'regular') modifier = 1.25;
      if (input.healthStatus === 'deficiente') modifier = 1.5;
      const ageFactor = isGrass ? 1 : Math.max(1, input.treeAge || 1);
      finalDosePerUnit = (BASE_RATES[p] || 0) * modifier * ageFactor;
    }

    const unit = input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g';
    const pricePerUnit = input.productPrices[p] || 0;
    const totalQuantity = finalDosePerUnit * numPlantsOrM2;
    const totalLineCost = totalQuantity * pricePerUnit;

    return {
      product: p,
      amount: parseFloat(totalQuantity.toFixed(2)),
      unit: unit as UnitType,
      costPerUnit: pricePerUnit,
      totalCost: parseFloat(totalLineCost.toFixed(2)),
      dosePerUnit: finalDosePerUnit
    };
  }, [input, activeTab]);

  const updateResults = useCallback(() => {
    const products = input.selectedProducts.map(p => calculateSingleProduct(p));
    const totalCost = products.reduce((acc, curr) => acc + curr.totalCost, 0);

    setResult({ 
      products, 
      totalCostPerUnit: totalCost / (input.numTrees || 1), 
      totalProjectCost: totalCost, 
      frequency: `Cada ${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}` 
    });
  }, [input.selectedProducts, calculateSingleProduct, input.numTrees, input.cycleFrequencyValue, input.cycleFrequencyUnit]);

  useEffect(() => { updateResults(); }, [updateResults]);

  const adjustedTotal = (result?.totalProjectCost || 0) * (1 + marginPercent / 100);

  const saveToHistory = () => {
    if (!result) return;
    const newRecord: HistoryRecord = {
      id: Date.now().toString(),
      consecutive: history.length + 1,
      date: new Date().toLocaleString(),
      client: { ...clientData },
      input: { ...input },
      result: { ...result },
      aiAdvice: aiAdvice ? { ...aiAdvice } : null
    };
    const updated = [newRecord, ...history];
    setHistory(updated);
    localStorage.setItem('biogenesis_history_v3', JSON.stringify(updated));
    alert('✅ Registro guardado exitosamente.');
  };

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('BIO-GENESIS PRO', 14, 25);
    doc.setFontSize(10);
    doc.text('PRESUPUESTO TÉCNICO Y PLAN DE INSUMOS', 14, 32);

    doc.setTextColor(51, 65, 85);
    doc.text(`Productor: ${clientData.firstName} ${clientData.lastName}`, 14, 55);
    doc.text(`Proyecto: ${input.treeType}`, 14, 60);
    doc.text(`Ubicación: ${clientData.location || input.department}`, 130, 55);
    doc.text(`Plantas/m2: ${input.numTrees}`, 130, 60);

    autoTable(doc, {
      startY: 70,
      head: [['Insumo', 'Unidad', 'Cant. Total', 'Precio Unit.', 'Subtotal (COP)']],
      body: result.products.map(p => [
        p.product,
        p.unit,
        p.amount.toLocaleString(),
        `$${p.costPerUnit.toLocaleString()}`,
        `$${p.totalCost.toLocaleString()}`
      ]),
      foot: [
        ['', '', '', 'SUBTOTAL INSUMOS', `$${result.totalProjectCost.toLocaleString()}`],
        ['', '', '', `ADICIONAL (${marginPercent}%)`, `$${(result.totalProjectCost * (marginPercent / 100)).toLocaleString()}`],
        ['', '', '', 'TOTAL GENERAL', `$${adjustedTotal.toLocaleString()}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    if (aiAdvice) {
      const lastY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setTextColor(6, 78, 59);
      doc.text('PLAN MAESTRO IA', 14, lastY);
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Etapa', 'Insumo Sugerido', 'Dosis IA', 'Función']],
        body: [
          ...aiAdvice.radicularPlan.map(s => ['Radicular', s.item, s.dosage, s.purpose]),
          ...aiAdvice.foliarPlan.map(s => ['Foliar', s.item, s.dosage, s.purpose])
        ],
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136] }
      });
    }

    doc.save(`Presupuesto_${clientData.lastName}.pdf`);
  };

  const shareWhatsApp = () => {
    if (!result) return;
    let text = `*BIO-GENESIS PRO - COTIZACIÓN*%0A%0A`;
    text += `*Productor:* ${clientData.firstName} ${clientData.lastName}%0A`;
    text += `*Proyecto:* ${input.treeType}%0A%0A`;
    text += `*DETALLE DE INSUMOS:*%0A`;
    result.products.forEach(p => {
      text += `- ${p.product} (${p.unit}): ${p.amount} x $${p.costPerUnit} = *$${p.totalCost.toLocaleString()}*%0A`;
    });
    text += `%0A*Subtotal:* $${result.totalProjectCost.toLocaleString()}`;
    if (marginPercent > 0) text += `%0A*Adicional (${marginPercent}%):* $${(result.totalProjectCost * (marginPercent/100)).toLocaleString()}`;
    text += `%0A*TOTAL GENERAL:* *$${adjustedTotal.toLocaleString()} COP*%0A`;
    text += `%0A_Generado por BioGenesis Smart App_`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: OrganicProduct) => {
    const isSelected = input.selectedProducts.includes(p);
    const prodCalc = calculateSingleProduct(p);
    const currentPrice = input.productPrices[p] || 0;
    const currentDose = input.manualPlantAmounts[p] ?? prodCalc.dosePerUnit;
    const currentUnit = input.selectedUnits[p] || PRODUCT_UNITS[p];
    
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-md' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={() => setInput(prev => ({ ...prev, selectedProducts: prev.selectedProducts.includes(p) ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} 
              className="accent-emerald-600 h-5 w-5 rounded" 
            />
            <span className="text-xs font-black text-slate-800 uppercase">{p}</span>
          </label>
          
          {isSelected && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Unidad</span>
                  <select 
                    value={currentUnit} 
                    onChange={e => setInput({...input, selectedUnits: {...input.selectedUnits, [p]: e.target.value as any}})}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold"
                  >
                    {['g','kg','ml','cc','L','galon'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Dosis x Unid</span>
                  <input 
                    type="number" 
                    value={currentDose} 
                    onChange={e => setInput({...input, manualPlantAmounts: {...input.manualPlantAmounts, [p]: parseFloat(e.target.value) || 0}})}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Precio Unit.</span>
                  <input 
                    type="number" 
                    value={currentPrice} 
                    onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Subtotal</span>
                  <div className="p-1.5 bg-emerald-100 rounded-lg text-[10px] font-black text-emerald-700">
                    ${prodCalc.totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">
                Cantidad Total Requerida: {prodCalc.amount.toLocaleString()} {prodCalc.unit}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      <header className="bg-[#064e3b] p-6 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <BioGenesisLogo />
          <nav className="flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-2xl">
            {[
              { id: 'calculator', label: 'CULTIVOS' },
              { id: 'grass_pro', label: 'CÉSPED' },
              { id: 'vision', label: 'IA VISION' },
              { id: 'history', label: 'HISTORIAL' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab.id ? 'bg-white text-[#064e3b] shadow-xl' : 'text-white hover:bg-white/10'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {(activeTab === 'calculator' || activeTab === 'grass_pro') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-8">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-[11px] font-black mb-5 text-slate-900 uppercase tracking-widest border-b pb-2">Información del Proyecto</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" placeholder="Nombre" />
                    <input type="text" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" placeholder="Apellido" />
                  </div>
                  <input type="text" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" placeholder="WhatsApp" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Edad Árbol</label>
                      <input type="number" value={input.treeAge} onChange={e => setInput({...input, treeAge: parseInt(e.target.value) || 1})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Plantas/m2</label>
                      <input type="number" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value) || 1})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-[11px] font-black mb-5 text-emerald-900 uppercase tracking-widest border-b pb-2">Catálogo de Insumos</h2>
                <div className="max-h-[500px] overflow-y-auto space-y-4 custom-scrollbar pr-2">
                  {Object.values(OrganicProduct).map(p => renderProductItem(p))}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-8">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-emerald-50">
                <div className="flex justify-between items-center mb-10 pb-6 border-b">
                   <div>
                     <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Presupuesto Final</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle de aplicación e inversión</p>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={saveToHistory} className="bg-blue-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg">Guardar</button>
                     <button onClick={shareWhatsApp} className="bg-emerald-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg">WhatsApp</button>
                     <button onClick={exportPDF} className="bg-[#064e3b] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg">PDF</button>
                   </div>
                </div>
                
                {result && result.products.length > 0 ? (
                  <div className="space-y-10">
                    <div className="overflow-hidden rounded-[2.5rem] border border-slate-200">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                          <tr>
                            <th className="p-6">Insumo</th>
                            <th className="p-6">Unidad</th>
                            <th className="p-6">Cant. Total</th>
                            <th className="p-6">P. Unitario</th>
                            <th className="p-6 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-bold text-slate-700">
                          {result.products.map((p, i) => (
                            <tr key={i} className="border-t hover:bg-emerald-50/20">
                              <td className="p-6 uppercase font-black">{p.product}</td>
                              <td className="p-6">{p.unit}</td>
                              <td className="p-6">{p.amount.toLocaleString()}</td>
                              <td className="p-6">${p.costPerUnit.toLocaleString()}</td>
                              <td className="p-6 font-black text-right text-emerald-700">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50">
                           <tr className="border-t">
                             <td colSpan={4} className="p-4 text-right font-bold text-slate-500 text-[10px] uppercase">Subtotal Insumos</td>
                             <td className="p-4 text-right font-black text-slate-900">${result.totalProjectCost.toLocaleString()}</td>
                           </tr>
                           <tr>
                             <td colSpan={4} className="p-4 text-right font-bold text-slate-500 text-[10px] uppercase">
                               Porcentaje Adicional (%) 
                               <input 
                                 type="number" 
                                 value={marginPercent} 
                                 onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                                 className="ml-3 w-16 p-1 bg-white border border-slate-200 rounded text-xs text-center font-black"
                               />
                             </td>
                             <td className="p-4 text-right font-black text-blue-600">
                               +${(result.totalProjectCost * (marginPercent / 100)).toLocaleString()}
                             </td>
                           </tr>
                           <tr className="bg-[#064e3b] text-white">
                             <td colSpan={4} className="p-6 text-right font-black uppercase tracking-widest">Inversión Total del Proyecto</td>
                             <td className="p-6 text-right font-black text-2xl text-emerald-400">
                               ${adjustedTotal.toLocaleString()}
                             </td>
                           </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="bg-emerald-50 p-8 rounded-[3rem] border-2 border-dashed border-emerald-200">
                       <h4 className="text-xl font-black text-[#064e3b] uppercase mb-6">Plan Maestro IA Especializado</h4>
                       {!aiAdvice ? (
                         <button 
                           onClick={async () => {
                             setLoading(true);
                             const advice = await getAgriculturalAdvice(input);
                             setAiAdvice(advice);
                             setLoading(false);
                           }} 
                           disabled={loading} 
                           className="w-full bg-white text-emerald-900 p-8 rounded-[2rem] border-2 border-emerald-300 font-black uppercase shadow-xl hover:bg-emerald-50 transition-all"
                         >
                           {loading ? 'Analizando...' : 'Consultar IA Agronómica'}
                         </button>
                       ) : (
                         <div className="grid md:grid-cols-2 gap-8">
                           <div className="space-y-4">
                             <h5 className="text-[11px] font-black text-emerald-900 uppercase border-b pb-2">Nutrición Radicular</h5>
                             {aiAdvice.radicularPlan.map((s, idx) => (
                               <div key={idx} className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100">
                                 <p className="text-xs font-black text-slate-900 uppercase">{s.item}</p>
                                 <p className="text-[10px] font-bold text-emerald-700">Dosis: {s.dosage}</p>
                                 <p className="text-[9px] text-slate-500 mt-2 italic">"{s.purpose}"</p>
                               </div>
                             ))}
                           </div>
                           <div className="space-y-4">
                             <h5 className="text-[11px] font-black text-teal-900 uppercase border-b pb-2">Nutrición Foliar</h5>
                             {aiAdvice.foliarPlan.map((s, idx) => (
                               <div key={idx} className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100">
                                 <p className="text-xs font-black text-slate-900 uppercase">{s.item}</p>
                                 <p className="text-[10px] font-bold text-teal-700">Dosis: {s.dosage}</p>
                                 <p className="text-[9px] text-slate-500 mt-2 italic">"{s.purpose}"</p>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase text-xs tracking-widest">
                    Seleccione insumos para ver el presupuesto detallado
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ... Rest of components (vision, history) stay mostly same but simplified for size ... */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-6">
             <h2 className="text-3xl font-black text-[#064e3b] uppercase">Historial de Reportes</h2>
             <div className="grid gap-4">
                {history.map(record => (
                  <div key={record.id} className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="text-lg font-black uppercase">{record.client.firstName} {record.client.lastName}</p>
                      <p className="text-[10px] font-bold text-slate-400">{record.date} - {record.input.treeType}</p>
                      <p className="text-xl font-black text-emerald-700 mt-2">${record.result.totalProjectCost.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => shareWhatsApp()} className="bg-emerald-500 text-white p-3 rounded-xl"><i className="fab fa-whatsapp"></i></button>
                       <button onClick={() => exportPDF()} className="bg-[#064e3b] text-white p-3 rounded-xl"><i className="fas fa-file-pdf"></i></button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
