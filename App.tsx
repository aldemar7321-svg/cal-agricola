
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
    const saved = localStorage.getItem('biogenesis_history_v4');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Función de cálculo única para evitar valores "equivocados"
  const calculateSingleProduct = useCallback((p: OrganicProduct) => {
    const isGrass = activeTab === 'grass_pro';
    const totalUnits = Math.max(1, input.numTrees || 1);
    
    // 1. Determinar dosis unitaria
    let unitDose: number;
    if (input.manualPlantAmounts[p] !== undefined) {
      unitDose = input.manualPlantAmounts[p] as number;
    } else {
      // Factores sugeridos si no hay entrada manual
      let healthMod = 1.0;
      if (input.healthStatus === 'regular') healthMod = 1.25;
      if (input.healthStatus === 'deficiente') healthMod = 1.5;
      
      // La edad no debe ser un multiplicador lineal infinito para evitar los 182M
      // Usamos un factor de escala logarítmica o limitada para la edad
      const ageFactor = isGrass ? 1 : Math.min(5, 1 + (input.treeAge - 1) * 0.5); 
      
      unitDose = (BASE_RATES[p] || 0) * healthMod * ageFactor;
    }

    const price = input.productPrices[p] || 0;
    const totalAmount = unitDose * totalUnits;
    const subtotal = totalAmount * price;

    return {
      product: p,
      amount: parseFloat(totalAmount.toFixed(2)),
      unit: input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g',
      costPerUnit: price,
      totalCost: parseFloat(subtotal.toFixed(2)),
      unitDose: parseFloat(unitDose.toFixed(2))
    };
  }, [input, activeTab]);

  const updateResults = useCallback(() => {
    const products = input.selectedProducts.map(p => calculateSingleProduct(p));
    const total = products.reduce((acc, curr) => acc + curr.totalCost, 0);

    setResult({ 
      products, 
      totalCostPerUnit: total / (input.numTrees || 1), 
      totalProjectCost: total, 
      frequency: `Cada ${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}` 
    });
  }, [input.selectedProducts, calculateSingleProduct, input.numTrees, input.cycleFrequencyValue, input.cycleFrequencyUnit]);

  useEffect(() => { updateResults(); }, [updateResults]);

  const taxAmount = (result?.totalProjectCost || 0) * (marginPercent / 100);
  const finalTotal = (result?.totalProjectCost || 0) + taxAmount;

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
    localStorage.setItem('biogenesis_history_v4', JSON.stringify(updated));
    alert('✅ Proyecto guardado exitosamente.');
  };

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    
    // Header Estilizado
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('BIO-GENESIS PRO', 14, 22);
    doc.setFontSize(9);
    doc.text('REPORTE DE INVERSIÓN Y PLAN DE MANEJO AGRONÓMICO', 14, 30);

    // Datos Cliente
    doc.setTextColor(50);
    doc.setFontSize(10);
    doc.text(`Productor: ${clientData.firstName} ${clientData.lastName}`, 14, 50);
    doc.text(`Proyecto: ${input.treeType} (${input.numTrees} ${activeTab === 'grass_pro' ? 'm2' : 'plantas'})`, 14, 56);
    doc.text(`Ubicación: ${clientData.location || input.department}`, 130, 50);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 130, 56);

    // Tabla de Insumos - Columnas solicitadas
    autoTable(doc, {
      startY: 65,
      head: [['Insumo', 'Unid.', 'Cant. Total', 'Precio Unit.', 'Subtotal (COP)']],
      body: result.products.map(p => [
        p.product,
        p.unit,
        p.amount.toLocaleString(),
        `$${p.costPerUnit.toLocaleString()}`,
        `$${p.totalCost.toLocaleString()}`
      ]),
      foot: [
        ['', '', '', 'SUBTOTAL INSUMOS', `$${result.totalProjectCost.toLocaleString()}`],
        ['', '', '', `ADICIONAL (${marginPercent}%)`, `$${taxAmount.toLocaleString()}`],
        ['', '', '', 'TOTAL GENERAL', `$${finalTotal.toLocaleString()}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59], fontSize: 9 },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' } }
    });

    if (aiAdvice) {
      const lastY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(13);
      doc.setTextColor(6, 78, 59);
      doc.text('PLAN MAESTRO IA ESPECIALIZADO', 14, lastY);
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Etapa', 'Producto IA', 'Dosis Sugerida', 'Objetivo']],
        body: [
          ...aiAdvice.radicularPlan.map(s => ['Radicular', s.item, s.dosage, s.purpose]),
          ...aiAdvice.foliarPlan.map(s => ['Foliar', s.item, s.dosage, s.purpose])
        ],
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136] }
      });
    }

    doc.save(`BioGenesis_${clientData.lastName || 'Cotizacion'}.pdf`);
  };

  const shareWhatsApp = () => {
    if (!result) return;
    let text = `*BIO-GENESIS PRO - COTIZACIÓN*%0A%0A`;
    text += `*Cliente:* ${clientData.firstName} ${clientData.lastName}%0A`;
    text += `*Cultivo:* ${input.treeType}%0A`;
    text += `*Cantidad:* ${input.numTrees}%0A%0A`;
    text += `*DETALLE DE INSUMOS:*%0A`;
    result.products.forEach(p => {
      text += `• ${p.product}: ${p.amount} ${p.unit} x $${p.costPerUnit} = *$${p.totalCost.toLocaleString()}*%0A`;
    });
    text += `%0A*Subtotal:* $${result.totalProjectCost.toLocaleString()}%0A`;
    if (marginPercent > 0) text += `*Adicional (${marginPercent}%):* $${taxAmount.toLocaleString()}%0A`;
    text += `*TOTAL FINAL:* *$${finalTotal.toLocaleString()} COP*%0A`;
    text += `%0A_Generado por BioGenesis Smart Agriculture_`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: OrganicProduct) => {
    const isSelected = input.selectedProducts.includes(p);
    const prodCalc = calculateSingleProduct(p);
    const currentPrice = input.productPrices[p] || 0;
    const currentDose = input.manualPlantAmounts[p] ?? prodCalc.unitDose;
    const currentUnit = input.selectedUnits[p] || PRODUCT_UNITS[p];
    
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={() => setInput(prev => ({ ...prev, selectedProducts: prev.selectedProducts.includes(p) ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} 
              className="accent-emerald-600 h-5 w-5 rounded" 
            />
            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{p}</span>
          </label>
          
          {isSelected && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Unidad</span>
                  <select 
                    value={currentUnit} 
                    onChange={e => setInput({...input, selectedUnits: {...input.selectedUnits, [p]: e.target.value as any}})}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                  >
                    {['g','kg','ml','cc','L','galon'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Dosis/Unid</span>
                  <input 
                    type="number" 
                    value={currentDose} 
                    onChange={e => setInput({...input, manualPlantAmounts: {...input.manualPlantAmounts, [p]: parseFloat(e.target.value) || 0}})}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black outline-none" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Precio Unit.</span>
                  <input 
                    type="number" 
                    value={currentPrice} 
                    onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black outline-none" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Subtotal</span>
                  <div className="p-1.5 bg-emerald-100 rounded-lg text-[10px] font-black text-emerald-700">
                    ${prodCalc.totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                <span>Cant. Total: {prodCalc.amount.toLocaleString()} {prodCalc.unit}</span>
                <span className="text-emerald-600">Dosis actual: {currentDose} {currentUnit} / unidad</span>
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
          <nav className="flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-2xl overflow-x-auto max-w-full">
            {[
              { id: 'calculator', label: 'CULTIVOS' },
              { id: 'grass_pro', label: 'CÉSPED' },
              { id: 'vision', label: 'IA VISION' },
              { id: 'history', label: 'HISTORIAL' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-[#064e3b] shadow-xl' : 'text-white hover:bg-white/10'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {(activeTab === 'calculator' || activeTab === 'grass_pro') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-8 no-print">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200">
                <h2 className="text-[11px] font-black mb-5 text-slate-900 uppercase tracking-widest border-b pb-2">Información Técnica</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Nombre" />
                    <input type="text" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Apellido" />
                  </div>
                  <input type="text" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Número WhatsApp" />
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
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Vigor del Cultivo</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {(['bueno', 'regular', 'deficiente'] as const).map(status => (
                        <button key={status} onClick={() => setInput({...input, healthStatus: status})} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${input.healthStatus === status ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>
                          {status}
                        </button>
                      ))}
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
                     <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Presupuesto Maestro</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Proyección financiera de precisión</p>
                   </div>
                   <div className="flex flex-wrap gap-2">
                     <button onClick={saveToHistory} className="bg-blue-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-blue-600 transition-all">Guardar</button>
                     <button onClick={shareWhatsApp} className="bg-emerald-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-600 transition-all">WhatsApp</button>
                     <button onClick={exportPDF} className="bg-[#064e3b] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all">Generar PDF</button>
                   </div>
                </div>
                
                {result && result.products.length > 0 ? (
                  <div className="space-y-12">
                    <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                          <tr>
                            <th className="p-6">Insumo</th>
                            <th className="p-6">Unidad</th>
                            <th className="p-6">Cant. Total</th>
                            <th className="p-6">Precio Unit.</th>
                            <th className="p-6 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-bold text-slate-700">
                          {result.products.map((p, i) => (
                            <tr key={i} className="border-t hover:bg-emerald-50/20 transition-colors">
                              <td className="p-6 uppercase font-black text-slate-900">{p.product}</td>
                              <td className="p-6">{p.unit}</td>
                              <td className="p-6">{p.amount.toLocaleString()}</td>
                              <td className="p-6">${p.costPerUnit.toLocaleString()}</td>
                              <td className="p-6 font-black text-right text-emerald-700">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50">
                           <tr className="border-t">
                             <td colSpan={4} className="p-4 text-right font-bold text-slate-400 text-[10px] uppercase">Subtotal Insumos</td>
                             <td className="p-4 text-right font-black text-slate-900">${result.totalProjectCost.toLocaleString()}</td>
                           </tr>
                           <tr>
                             <td colSpan={4} className="p-4 text-right font-bold text-slate-400 text-[10px] uppercase">
                               Adicional / Margen (%) 
                               <input 
                                 type="number" 
                                 value={marginPercent} 
                                 onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                                 className="ml-3 w-16 p-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-black outline-none focus:ring-2 focus:ring-emerald-500"
                               />
                             </td>
                             <td className="p-4 text-right font-black text-blue-600">
                               +${taxAmount.toLocaleString()}
                             </td>
                           </tr>
                           <tr className="bg-[#064e3b] text-white">
                             <td colSpan={4} className="p-8 text-right font-black uppercase tracking-widest">Inversión Total Estimada</td>
                             <td className="p-8 text-right font-black text-3xl text-emerald-400">
                               ${finalTotal.toLocaleString()}
                             </td>
                           </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="bg-emerald-50 p-8 rounded-[3rem] border-2 border-dashed border-emerald-200">
                       <h4 className="text-xl font-black text-[#064e3b] uppercase mb-6 flex items-center gap-3">
                         <i className="fas fa-robot text-emerald-600"></i> Plan Maestro IA Especializado
                       </h4>
                       {!aiAdvice ? (
                         <button 
                           onClick={async () => {
                             setLoading(true);
                             const advice = await getAgriculturalAdvice(input);
                             setAiAdvice(advice);
                             setLoading(false);
                           }} 
                           disabled={loading} 
                           className="w-full bg-white text-emerald-900 p-8 rounded-[2rem] border-2 border-emerald-300 font-black uppercase shadow-xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-3"
                         >
                           {loading ? <><i className="fas fa-spinner fa-spin"></i> Analizando Biomasa...</> : <><i className="fas fa-wand-sparkles"></i> Consultar IA Agronómica</>}
                         </button>
                       ) : (
                         <div className="grid md:grid-cols-2 gap-8 animate-in zoom-in duration-300">
                           <div className="space-y-4">
                             <h5 className="text-[11px] font-black text-emerald-900 uppercase border-b pb-2 flex items-center gap-2">
                               <i className="fas fa-layer-group"></i> Manejo Radicular
                             </h5>
                             {aiAdvice.radicularPlan.map((s, idx) => (
                               <div key={idx} className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100">
                                 <p className="text-xs font-black text-slate-900 uppercase">{s.item}</p>
                                 <p className="text-[10px] font-bold text-emerald-700">Dosis: {s.dosage}</p>
                                 <p className="text-[9px] text-slate-500 mt-2 italic leading-tight">"{s.purpose}"</p>
                               </div>
                             ))}
                           </div>
                           <div className="space-y-4">
                             <h5 className="text-[11px] font-black text-teal-900 uppercase border-b pb-2 flex items-center gap-2">
                               <i className="fas fa-spray-can"></i> Manejo Foliar
                             </h5>
                             {aiAdvice.foliarPlan.map((s, idx) => (
                               <div key={idx} className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100">
                                 <p className="text-xs font-black text-slate-900 uppercase">{s.item}</p>
                                 <p className="text-[10px] font-bold text-teal-700">Dosis: {s.dosage}</p>
                                 <p className="text-[9px] text-slate-500 mt-2 italic leading-tight">"{s.purpose}"</p>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase text-xs tracking-widest">
                    <i className="fas fa-calculator text-4xl mb-6 opacity-20"></i><br/>
                    Seleccione insumos para ver el presupuesto detallado
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
              <p className="text-slate-500 font-medium mb-12 max-w-lg mx-auto">Diagnóstico visual instantáneo de patógenos y deficiencias nutricionales.</p>
              <div className="relative group border-4 border-dashed border-slate-200 rounded-[3.5rem] p-10 bg-slate-50 transition-all hover:bg-slate-100">
                {visionImage ? (
                  <img src={visionImage} className="aspect-video rounded-[2.5rem] object-cover mx-auto shadow-2xl" />
                ) : (
                  <label className="cursor-pointer flex flex-col items-center py-10">
                    <i className="fas fa-camera text-6xl text-emerald-500 mb-6"></i>
                    <span className="text-sm font-black uppercase text-slate-500 tracking-widest">Capturar Foto de la Muestra</span>
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
              {visionImage && (
                <div className="flex justify-center gap-4 mt-10">
                  <button onClick={() => { setVisionImage(null); setVisionReport(null); }} className="px-8 py-5 bg-slate-200 text-slate-700 rounded-2xl font-black uppercase hover:bg-slate-300 transition-all">Limpiar</button>
                  <button 
                    onClick={async () => {
                      setLoading(true);
                      const report = await getIndependentVisionDiagnosis(visionImage, input.treeType);
                      setVisionReport(report);
                      setLoading(false);
                    }} 
                    disabled={loading} 
                    className="px-12 py-5 bg-[#064e3b] text-white rounded-2xl font-black uppercase shadow-xl hover:bg-black transition-all"
                  >
                    {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i> Analizando...</> : 'Iniciar Bio-Diagnóstico'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-8">
              <h2 className="text-4xl font-black text-[#064e3b] uppercase tracking-tighter">Historial de Reportes</h2>
              <button onClick={() => { if(confirm('¿Borrar todo el historial?')) { setHistory([]); localStorage.removeItem('biogenesis_history_v4'); } }} className="px-5 py-2 bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-200">Limpiar Historial</button>
            </div>
            <div className="grid gap-6">
                {history.length > 0 ? history.map(record => (
                  <div key={record.id} className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                      <h4 className="text-xl font-black uppercase text-slate-900 leading-none">{record.client.firstName} {record.client.lastName}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{record.date} • {record.input.treeType}</p>
                      <p className="text-2xl font-black text-emerald-700 mt-4 tracking-tighter">${record.result.totalProjectCost.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={() => shareWhatsApp()} className="bg-emerald-500 text-white p-5 rounded-2xl shadow-xl hover:scale-110 transition-transform"><i className="fab fa-whatsapp text-xl"></i></button>
                       <button onClick={() => exportPDF()} className="bg-[#064e3b] text-white p-5 rounded-2xl shadow-xl hover:scale-110 transition-transform"><i className="fas fa-file-pdf text-xl"></i></button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
                    <p className="text-slate-300 font-black uppercase text-sm tracking-widest">No hay registros guardados</p>
                  </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
