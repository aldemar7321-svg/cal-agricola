
import React, { useState, useEffect, useCallback } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, Department, ClientData } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, COLOMBIAN_MARKET_PRICES, TREE_TYPE_ICONS, PRODUCT_DETAILS } from './constants.tsx';
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
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass_pro' | 'vision'>('calculator');
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [visionReport, setVisionReport] = useState<VisionReport | null>(null);

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

  const calculateData = useCallback(() => {
    const isGrass = activeTab === 'grass_pro';
    const count = Math.max(1, input.numTrees || 1);
    
    let modifier = 1.0;
    if (input.healthStatus === 'regular') modifier *= 1.25;
    if (input.healthStatus === 'deficiente') modifier *= 1.5;

    const products: ProductResult[] = input.selectedProducts.map(p => {
      const unit = input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g';
      const price = input.productPrices[p] || 0;
      const baseRate = BASE_RATES[p] || 0;
      
      const factor = isGrass ? 1 : Math.max(1, input.treeAge || 1);
      const dose = (input.manualPlantAmounts[p] ?? baseRate) * modifier * factor;
      const totalAmount = dose * count;
      
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

  useEffect(() => { calculateData(); }, [calculateData]);

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const margin = 14;
    const isGrass = activeTab === 'grass_pro';
    
    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59);
    doc.text('REPORTE TÉCNICO BIOGENESIS PRO', margin, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text('DATOS DEL CLIENTE', margin, 32);
    doc.line(margin, 34, 200, 34);
    
    doc.setFontSize(9);
    doc.text(`Cliente: ${clientData.firstName} ${clientData.lastName}`, margin, 40);
    doc.text(`Proyecto: ${isGrass ? 'Grama ' + input.grassVariety : input.treeType}`, margin, 45);
    doc.text(`Cantidad: ${input.numTrees} ${isGrass ? input.grassMode : 'plantas'}`, margin, 50);
    doc.text(`Ubicación: ${clientData.location || input.department}`, 120, 40);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 120, 45);

    autoTable(doc, {
      startY: 60,
      head: [['Insumo', 'Dosis / Unidad', 'Cantidad Total', 'Precio Unit.', 'Subtotal (COP)']],
      body: result.products.map(p => [
        p.product,
        `${(p.amount / input.numTrees).toFixed(2)} ${p.unit}`,
        `${p.amount.toLocaleString()} ${p.unit}`,
        `$${p.costPerUnit.toLocaleString()}`,
        `$${p.totalCost.toLocaleString()}`
      ]),
      foot: [['', '', '', 'TOTAL PROYECTO', `$${result.totalProjectCost.toLocaleString()} COP`]],
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59] }
    });

    if (aiAdvice) {
      const lastY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Protocolo IA Sugerido', margin, lastY);
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Etapa', 'Insumo', 'Dosis Sugerida', 'Función']],
        body: [
          ...aiAdvice.radicularPlan.map(s => ['Radicular', s.item, s.dosage, s.purpose]),
          ...aiAdvice.foliarPlan.map(s => ['Foliar', s.item, s.dosage, s.purpose])
        ],
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136] }
      });
    }

    doc.save(`Presupuesto_BioGenesis_${clientData.lastName || 'Agrícola'}.pdf`);
  };

  const shareWhatsApp = () => {
    if (!result) return;
    const isGrass = activeTab === 'grass_pro';
    let text = `*BIOGENESIS PRO - REPORTE AGRÍCOLA*%0A%0A`;
    text += `*Cliente:* ${clientData.firstName} ${clientData.lastName}%0A`;
    text += `*Cultivo:* ${isGrass ? 'Grama ' + input.grassVariety : input.treeType}%0A`;
    text += `*Cantidad:* ${input.numTrees} ${isGrass ? input.grassMode : 'unidades'}%0A%0A`;
    text += `*DESGLOSE DE INSUMOS:*%0A`;
    result.products.forEach(p => {
      text += `- ${p.product}: ${(p.amount / input.numTrees).toFixed(2)}${p.unit}/unid. (Total: ${p.amount}${p.unit}) - $${p.totalCost.toLocaleString()}%0A`;
    });
    text += `%0A*INVERSIÓN TOTAL:* $${result.totalProjectCost.toLocaleString()} COP%0A%0A`;
    if (aiAdvice) text += `*PROTOCOLOS IA ACTIVOS:* Radicular y Foliar recomendados.%0A`;
    text += `%0A_Enviado desde BioGenesis Smart App_`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: OrganicProduct) => {
    const isSelected = input.selectedProducts.includes(p);
    const currentPrice = input.productPrices[p] || 0;
    const currentDose = input.manualPlantAmounts[p] ?? BASE_RATES[p];
    const currentUnit = input.selectedUnits[p] || PRODUCT_UNITS[p];
    
    return (
      <div key={p} className={`p-4 rounded-2xl border-2 transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={() => setInput(prev => ({ ...prev, selectedProducts: prev.selectedProducts.includes(p) ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} 
              className="accent-emerald-600 h-5 w-5 rounded transition-transform group-active:scale-90" 
            />
            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{p}</span>
          </label>
          
          {isSelected && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase">Unidad</span>
                <select 
                  value={currentUnit} 
                  onChange={e => setInput({...input, selectedUnits: {...input.selectedUnits, [p]: e.target.value as any}})}
                  className="p-1.5 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold outline-none"
                >
                  {['g','kg','ml','cc','L','galon'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase">Cantidad/Dosis</span>
                <input 
                  type="number" 
                  value={currentDose} 
                  onChange={e => setInput({...input, manualPlantAmounts: {...input.manualPlantAmounts, [p]: parseFloat(e.target.value) || 0}})}
                  className="p-1.5 bg-white border border-emerald-200 rounded-lg text-[10px] font-black outline-none" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase">Precio Unit.</span>
                <div className="relative">
                  <span className="absolute left-1.5 top-1.5 text-[8px] font-bold text-slate-400">$</span>
                  <input 
                    type="number" 
                    value={currentPrice} 
                    onChange={e => setInput({...input, productPrices: {...input.productPrices, [p]: parseFloat(e.target.value) || 0}})}
                    className="w-full pl-4 p-1.5 bg-white border border-emerald-200 rounded-lg text-[10px] font-black outline-none" 
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase">Subtotal</span>
                <div className="p-1.5 bg-emerald-100/50 rounded-lg text-[10px] font-black text-emerald-700 text-center">
                  ${((input.manualPlantAmounts[p] ?? BASE_RATES[p]) * (input.productPrices[p] || 0) * input.numTrees).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      <header className="bg-[#064e3b] p-6 sticky top-0 z-50 shadow-2xl no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <BioGenesisLogo />
          <nav className="flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-2xl border border-white/10">
            {['calculator', 'grass_pro', 'vision'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-white text-[#064e3b] shadow-xl' : 'text-white hover:bg-white/10'}`}>
                {tab === 'calculator' ? 'FRUTALES / PLANTAS' : tab === 'grass_pro' ? 'CÉSPED PRO' : 'IA VISION'}
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
                <h2 className="text-[11px] font-black mb-5 text-slate-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-user-tie"></i> Datos del Proyecto
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Nombre" />
                    <input type="text" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Apellido" />
                  </div>
                  <input type="text" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="WhatsApp" />
                  <input type="text" value={clientData.location} onChange={e => setClientData({...clientData, location: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Municipio / Vereda" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-emerald-100">
                <h2 className="text-[11px] font-black mb-5 text-emerald-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-cog"></i> Configuración Técnica
                </h2>
                <div className="space-y-4">
                  {activeTab === 'grass_pro' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Variedad de Grama</label>
                        <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as any})} className="w-full p-2.5 bg-emerald-50 rounded-xl text-xs font-black">
                          {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Cantidad ({input.grassMode})</label>
                        <input type="number" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value) || 1})} className="w-full p-2.5 bg-slate-100 rounded-xl text-xs font-black" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Especie / Planta</label>
                        <select value={input.treeType} onChange={e => setInput({...input, treeType: e.target.value as any})} className="w-full p-2.5 bg-emerald-50 rounded-xl text-xs font-black">
                          {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Edad (Años)</label>
                          <input type="number" value={input.treeAge} onChange={e => setInput({...input, treeAge: parseInt(e.target.value) || 1})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">N° Plantas</label>
                          <input type="number" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value) || 1})} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black" />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Estado Fitocanitario</label>
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
                <h2 className="text-[11px] font-black mb-5 text-emerald-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-boxes"></i> Catálogo de Insumos
                </h2>
                <div className="max-h-[500px] overflow-y-auto space-y-4 custom-scrollbar pr-2">
                  {Object.values(OrganicProduct).map(p => renderProductItem(p))}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-8">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-emerald-50/50">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10 border-b border-slate-100 pb-8">
                   <div className="flex items-center gap-4">
                     <div className="h-16 w-16 bg-emerald-100 rounded-3xl flex items-center justify-center text-3xl">
                       {activeTab === 'grass_pro' ? <i className="fas fa-align-justify text-emerald-600"></i> : (TREE_TYPE_ICONS[input.treeType] || <i className="fas fa-leaf text-emerald-600"></i>)}
                     </div>
                     <div>
                       <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">
                         {activeTab === 'grass_pro' ? `Grama ${input.grassVariety}` : input.treeType}
                       </h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase">Presupuesto y Dosificación de Precisión</p>
                     </div>
                   </div>
                   <div className="flex gap-3 w-full md:w-auto">
                     <button onClick={shareWhatsApp} className="flex-1 md:flex-none bg-emerald-500 text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase hover:bg-emerald-600 shadow-xl flex items-center justify-center gap-2">
                       <i className="fab fa-whatsapp"></i> WhatsApp
                     </button>
                     <button onClick={exportPDF} className="flex-1 md:flex-none bg-[#064e3b] text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase hover:bg-black shadow-xl flex items-center justify-center gap-2">
                       <i className="fas fa-file-pdf"></i> PDF
                     </button>
                   </div>
                </div>
                
                {result && result.products.length > 0 ? (
                  <div className="space-y-12">
                    <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b">
                          <tr>
                            <th className="p-6">Insumo</th>
                            <th className="p-6">Dosis/Unid.</th>
                            <th className="p-6">Cantidad Total</th>
                            <th className="p-6 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-bold text-slate-700">
                          {result.products.map((p, i) => (
                            <tr key={i} className="border-t hover:bg-emerald-50/30">
                              <td className="p-6 uppercase font-black text-slate-900">{p.product}</td>
                              <td className="p-6 text-emerald-700">{(p.amount / input.numTrees).toFixed(2)} {p.unit}</td>
                              <td className="p-6">{p.amount.toLocaleString()} {p.unit}</td>
                              <td className="p-6 font-black text-right text-sm">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#064e3b] text-white">
                          <tr>
                            <td colSpan={3} className="p-8 font-black uppercase text-[12px] tracking-widest text-emerald-200">Presupuesto Estimado Total</td>
                            <td className="p-8 font-black text-3xl text-emerald-400 text-right">
                              ${result.totalProjectCost.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] border-2 border-emerald-100 shadow-inner">
                       <h4 className="text-xl font-black text-[#064e3b] uppercase mb-6 flex items-center gap-3">
                         <i className="fas fa-robot text-emerald-600"></i> Protocolo IA Especializado
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
                           className="w-full bg-emerald-50 text-emerald-900 p-8 rounded-[2rem] border-2 border-dashed border-emerald-300 font-black uppercase hover:bg-emerald-100 transition-all text-sm flex items-center justify-center gap-4"
                         >
                           {loading ? <><i className="fas fa-spinner fa-spin"></i> Procesando Biomasa...</> : <><i className="fas fa-wand-sparkles"></i> Generar Plan Maestro con IA</>}
                         </button>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in duration-500">
                           <div className="space-y-4">
                             <h5 className="text-[11px] font-black text-emerald-900 uppercase border-b pb-2 flex items-center gap-2">
                               <i className="fas fa-layer-group"></i> Nutrición Radicular
                             </h5>
                             {aiAdvice.radicularPlan.map((step, idx) => (
                               <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <p className="text-[12px] font-black text-slate-900 uppercase">{step.item}</p>
                                 <p className="text-[10px] font-bold text-emerald-700">Dosis: {step.dosage}</p>
                                 <p className="text-[9px] text-slate-500 mt-2 italic">"{step.purpose}"</p>
                               </div>
                             ))}
                           </div>
                           <div className="space-y-4">
                             <h5 className="text-[11px] font-black text-teal-900 uppercase border-b pb-2 flex items-center gap-2">
                               <i className="fas fa-spray-can"></i> Manejo Foliar
                             </h5>
                             {aiAdvice.foliarPlan.map((step, idx) => (
                               <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <p className="text-[12px] font-black text-slate-900 uppercase">{step.item}</p>
                                 <p className="text-[10px] font-bold text-teal-700">Dosis: {step.dosage}</p>
                                 <p className="text-[9px] text-slate-500 mt-2 italic">"{step.purpose}"</p>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <i className="fas fa-calculator text-4xl text-slate-200 mb-8 mx-auto"></i>
                    <p className="text-slate-500 font-black uppercase text-sm">Seleccione insumos del catálogo lateral para iniciar el cálculo</p>
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
              <p className="text-slate-500 font-medium mb-12 max-w-lg mx-auto">Analice patologías o deficiencias visuales mediante el motor IA especializado.</p>
              <div className="relative group border-4 border-dashed border-slate-200 rounded-[3.5rem] p-10 bg-slate-50">
                {visionImage ? (
                  <img src={visionImage} className="aspect-video rounded-[2.5rem] object-cover mx-auto shadow-2xl" />
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <i className="fas fa-camera text-5xl text-emerald-500 mb-4"></i>
                    <span className="text-xs font-black uppercase text-slate-500">Cargar Imagen de Muestra</span>
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
                <button 
                  onClick={async () => {
                    setLoading(true);
                    const report = await getIndependentVisionDiagnosis(visionImage, input.treeType);
                    setVisionReport(report);
                    setLoading(false);
                  }} 
                  disabled={loading} 
                  className="mt-8 px-12 py-5 bg-[#064e3b] text-white rounded-2xl font-black uppercase shadow-xl hover:bg-black transition-all"
                >
                  {loading ? 'Analizando tejido...' : 'Iniciar Bio-Diagnóstico'}
                </button>
              )}
            </div>
            {visionReport && (
              <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-teal-100">
                <h3 className="text-2xl font-black text-slate-900 uppercase mb-6">Resultado del Análisis</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-emerald-700 uppercase tracking-widest">Hallazgo Principal</h4>
                    <p className="text-xl font-black text-slate-900">{visionReport.pestAnalysis.identifiedPest}</p>
                    <p className="text-sm font-medium text-slate-600 italic">"{visionReport.pestAnalysis.symptoms}"</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl">
                     <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest mb-4">Manejo Biológico</h4>
                     <ul className="space-y-2">
                       {visionReport.biologicalRemedy.ingredients.map((ing, i) => (
                         <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                           <i className="fas fa-check text-emerald-500"></i> {ing}
                         </li>
                       ))}
                     </ul>
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
