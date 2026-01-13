
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
    const saved = localStorage.getItem('biogenesis_history_v2');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Lógica de cálculo corregida: El subtotal debe ser Cantidad * Precio * Plantas
  // Los multiplicadores solo se aplican a la tasa base si no hay entrada manual.
  const calculateSingleProduct = useCallback((p: OrganicProduct) => {
    const isGrass = activeTab === 'grass_pro';
    const numPlantsOrM2 = Math.max(1, input.numTrees || 1);
    
    // Si el usuario ingresó un valor manual, ese es el valor FINAL por planta.
    // Si no, aplicamos multiplicadores a la tasa base de la empresa.
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

    const pricePerUnit = input.productPrices[p] || 0;
    const totalQuantity = finalDosePerUnit * numPlantsOrM2;
    const totalLineCost = totalQuantity * pricePerUnit;

    return {
      product: p,
      amount: parseFloat(totalQuantity.toFixed(2)),
      unit: input.selectedUnits[p] || PRODUCT_UNITS[p] || 'g',
      costPerUnit: pricePerUnit,
      totalCost: parseFloat(totalLineCost.toFixed(2)),
      dosePerUnit: finalDosePerUnit
    };
  }, [input, activeTab]);

  const updateResults = useCallback(() => {
    const products = input.selectedProducts.map(p => calculateSingleProduct(p));
    const totalProjectCost = products.reduce((acc, curr) => acc + curr.totalCost, 0);

    setResult({ 
      products, 
      totalCostPerUnit: totalProjectCost / (input.numTrees || 1), 
      totalProjectCost, 
      frequency: `Cada ${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}` 
    });
  }, [input.selectedProducts, calculateSingleProduct, input.numTrees, input.cycleFrequencyValue, input.cycleFrequencyUnit]);

  useEffect(() => { updateResults(); }, [updateResults]);

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
    localStorage.setItem('biogenesis_history_v2', JSON.stringify(updated));
    alert('✅ Proyecto y Plan Maestro guardados en el historial.');
  };

  const exportPDF = (customResult?: CalculationResult, customInput?: CalculationInput, customAdvice?: AIAdvice | null, customClient?: ClientData) => {
    const activeResult = customResult || result;
    const activeInput = customInput || input;
    const activeAdvice = customAdvice !== undefined ? customAdvice : aiAdvice;
    const activeClient = customClient || clientData;

    if (!activeResult) return;

    const doc = new jsPDF();
    const isGrass = activeInput.treeType === TreeType.GRASS;
    
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('BIO-GENESIS PRO', 14, 25);
    doc.setFontSize(10);
    doc.text('COTIZACIÓN Y PROTOCOLO TÉCNICO DE PRECISIÓN', 14, 32);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text('DATOS GENERALES', 14, 50);
    doc.line(14, 52, 200, 52);
    doc.setFontSize(9);
    doc.text(`Productor: ${activeClient.firstName} ${activeClient.lastName}`, 14, 60);
    doc.text(`Ubicación: ${activeClient.location || activeInput.department}`, 14, 65);
    doc.text(`WhatsApp: ${activeClient.contact}`, 14, 70);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 130, 60);
    doc.text(`Proyecto: ${isGrass ? 'Grama ' + activeInput.grassVariety : activeInput.treeType}`, 130, 65);
    doc.text(`Extensión: ${activeInput.numTrees} ${isGrass ? 'm2' : 'plantas'}`, 130, 70);

    autoTable(doc, {
      startY: 80,
      head: [['Insumo Seleccionado', 'Dosis x Unidad', 'Cant. Total', 'Precio Unit.', 'Subtotal (COP)']],
      body: activeResult.products.map(p => [
        p.product,
        `${(p.amount / activeInput.numTrees).toFixed(2)} ${p.unit}`,
        `${p.amount.toLocaleString()} ${p.unit}`,
        `$${p.costPerUnit.toLocaleString()}`,
        `$${p.totalCost.toLocaleString()}`
      ]),
      foot: [['', '', '', 'TOTAL PRESUPUESTO', `$${activeResult.totalProjectCost.toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    if (activeAdvice) {
      const lastY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setTextColor(6, 78, 59);
      doc.text('PLAN MAESTRO IA - PROTOCOLO DE APLICACIÓN', 14, lastY);
      
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Etapa de Aplicación', 'Producto Recomendado', 'Dosis Sugerida', 'Objetivo Técnico']],
        body: [
          ...activeAdvice.radicularPlan.map(s => ['Radicular (Drench)', s.item, s.dosage, s.purpose]),
          ...activeAdvice.foliarPlan.map(s => ['Foliar (Aspersión)', s.item, s.dosage, s.purpose])
        ],
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136] }
      });

      const nextY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(10);
      doc.text('Análisis Estacional y Manejo Cultural:', 14, nextY);
      doc.setFontSize(9);
      doc.setTextColor(100);
      const splitText = doc.splitTextToSize(activeAdvice.seasonalAdvice, 180);
      doc.text(splitText, 14, nextY + 6);
    }

    doc.save(`Presupuesto_BioGenesis_${activeClient.lastName || 'Export'}.pdf`);
  };

  const shareWhatsApp = (customResult?: CalculationResult, customInput?: CalculationInput, customAdvice?: AIAdvice | null, customClient?: ClientData) => {
    const activeResult = customResult || result;
    const activeInput = customInput || input;
    const activeAdvice = customAdvice !== undefined ? customAdvice : aiAdvice;
    const activeClient = customClient || clientData;

    if (!activeResult) return;
    const isGrass = activeInput.treeType === TreeType.GRASS;
    
    let text = `*BIOGENESIS PRO - PRESUPUESTO AGRÍCOLA*%0A%0A`;
    text += `*Cliente:* ${activeClient.firstName} ${activeClient.lastName}%0A`;
    text += `*Cultivo:* ${isGrass ? 'Grama ' + activeInput.grassVariety : activeInput.treeType}%0A`;
    text += `*Densidad:* ${activeInput.numTrees} ${isGrass ? 'm2' : 'unidades'}%0A%0A`;
    
    text += `*INSUMOS REQUERIDOS:*%0A`;
    activeResult.products.forEach(p => {
      text += `• ${p.product}: ${p.amount}${p.unit} ($${p.totalCost.toLocaleString()})%0A`;
    });
    
    text += `%0A*INVERSIÓN TOTAL:* $${activeResult.totalProjectCost.toLocaleString()} COP%0A%0A`;
    
    if (activeAdvice) {
      text += `*PROTOCOLOS PLAN MAESTRO IA:*%0A`;
      text += `_Nutrición Radicular:_%0A`;
      activeAdvice.radicularPlan.slice(0, 2).forEach(s => text += `- ${s.item}: ${s.dosage}%0A`);
      text += `_Nutrición Foliar:_%0A`;
      activeAdvice.foliarPlan.slice(0, 2).forEach(s => text += `- ${s.item}: ${s.dosage}%0A`);
    }

    text += `%0A_Enviado vía BioGenesis Smart Agriculture_`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: OrganicProduct) => {
    const isSelected = input.selectedProducts.includes(p);
    const prodCalc = calculateSingleProduct(p);
    const currentPrice = input.productPrices[p] || 0;
    const currentDose = input.manualPlantAmounts[p] ?? prodCalc.dosePerUnit;
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
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                  <span className="text-[8px] font-black text-slate-400 uppercase">Dosis (x Unid)</span>
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
              </div>

              {/* Cálculo en tiempo real */}
              <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-emerald-100">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-emerald-800 uppercase leading-none mb-1">Cálculo Subtotal</span>
                  <div className="text-[10px] font-bold text-slate-400">
                    {currentDose} x {currentPrice} x {input.numTrees}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-700">
                    ${prodCalc.totalCost.toLocaleString()}
                  </div>
                  <div className="text-[8px] font-bold text-emerald-600 uppercase">
                    Total: {prodCalc.amount.toLocaleString()} {prodCalc.unit}
                  </div>
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
          <nav className="flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-2xl border border-white/10 overflow-x-auto max-w-full">
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
                <h2 className="text-[11px] font-black mb-5 text-slate-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-id-card"></i> Datos del Proyecto
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Nombre" />
                    <input type="text" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Apellido" />
                  </div>
                  <input type="text" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Celular / WhatsApp" />
                  <input type="text" value={clientData.location} onChange={e => setClientData({...clientData, location: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Ubicación Geográfica" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-emerald-100">
                <h2 className="text-[11px] font-black mb-5 text-emerald-900 uppercase flex items-center gap-2 tracking-widest border-b pb-2">
                  <i className="fas fa-sliders-h"></i> Parámetros Técnicos
                </h2>
                <div className="space-y-4">
                  {activeTab === 'grass_pro' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Especie de Grama</label>
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
                        <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Cultivo</label>
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
                    <label className="text-[9px] font-black text-slate-400 uppercase">Vigor del Tejido</label>
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
                  <i className="fas fa-boxes"></i> Insumos Disponibles
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
                       <p className="text-[10px] font-bold text-slate-400 uppercase">Análisis y Presupuesto de Insumos Orgánicos</p>
                     </div>
                   </div>
                   <div className="flex flex-wrap gap-2 w-full md:w-auto">
                     <button onClick={saveToHistory} className="flex-1 md:flex-none bg-blue-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                       <i className="fas fa-save"></i> Guardar Proyecto
                     </button>
                     <button onClick={() => shareWhatsApp()} className="flex-1 md:flex-none bg-emerald-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-600 shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                       <i className="fab fa-whatsapp"></i> WhatsApp
                     </button>
                     <button onClick={() => exportPDF()} className="flex-1 md:flex-none bg-[#064e3b] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-black shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
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
                            <th className="p-6">Dosis Aplicada</th>
                            <th className="p-6">Cant. Total</th>
                            <th className="p-6 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-bold text-slate-700">
                          {result.products.map((p, i) => (
                            <tr key={i} className="border-t hover:bg-emerald-50/30 transition-colors">
                              <td className="p-6 uppercase font-black text-slate-900">{p.product}</td>
                              <td className="p-6 text-emerald-700">{(p.amount / input.numTrees).toFixed(2)} {p.unit}</td>
                              <td className="p-6">{p.amount.toLocaleString()} {p.unit}</td>
                              <td className="p-6 font-black text-right text-sm text-slate-900">${p.totalCost.toLocaleString()}</td>
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
                           className="w-full bg-emerald-50 text-emerald-900 p-8 rounded-[2rem] border-2 border-dashed border-emerald-300 font-black uppercase hover:bg-emerald-100 transition-all text-sm flex items-center justify-center gap-4"
                         >
                           {loading ? <><i className="fas fa-spinner fa-spin"></i> Generando Protocolo...</> : <><i className="fas fa-wand-sparkles"></i> Consultar IA Agronómica</>}
                         </button>
                       ) : (
                         <div className="space-y-8 animate-in zoom-in duration-500">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                               <h5 className="text-[11px] font-black text-emerald-900 uppercase border-b pb-2 flex items-center gap-2 tracking-widest">
                                 <i className="fas fa-layer-group"></i> Manejo Radicular (Drench)
                               </h5>
                               {aiAdvice.radicularPlan.map((step, idx) => (
                                 <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                   <p className="text-[12px] font-black text-slate-900 uppercase">{step.item}</p>
                                   <p className="text-[10px] font-bold text-emerald-700">Dosis: {step.dosage}</p>
                                   <p className="text-[9px] text-slate-500 mt-2 italic leading-tight">"{step.purpose}"</p>
                                 </div>
                               ))}
                             </div>
                             <div className="space-y-4">
                               <h5 className="text-[11px] font-black text-teal-900 uppercase border-b pb-2 flex items-center gap-2 tracking-widest">
                                 <i className="fas fa-spray-can"></i> Manejo Foliar (Aspersión)
                               </h5>
                               {aiAdvice.foliarPlan.map((step, idx) => (
                                 <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                   <p className="text-[12px] font-black text-slate-900 uppercase">{step.item}</p>
                                   <p className="text-[10px] font-bold text-teal-700">Dosis: {step.dosage}</p>
                                   <p className="text-[9px] text-slate-500 mt-2 italic leading-tight">"{step.purpose}"</p>
                                 </div>
                               ))}
                             </div>
                           </div>
                           
                           <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-200">
                             <h5 className="text-[10px] font-black text-emerald-800 uppercase mb-4 tracking-widest">Análisis Estacional ICA/Agrosavia</h5>
                             <p className="text-sm text-emerald-900 leading-relaxed font-medium">{aiAdvice.seasonalAdvice}</p>
                           </div>
                           
                           <div className="flex flex-wrap gap-4">
                              <button onClick={() => setAiAdvice(null)} className="flex-1 min-w-[150px] bg-slate-200 text-slate-700 py-4 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-300">
                                <i className="fas fa-sync"></i> Re-generar Plan
                              </button>
                              <button onClick={() => shareWhatsApp()} className="flex-1 min-w-[150px] bg-emerald-100 text-emerald-800 py-4 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-200 border border-emerald-300">
                                <i className="fab fa-whatsapp"></i> Compartir Plan Maestro
                              </button>
                           </div>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <i className="fas fa-calculator text-4xl text-slate-200 mb-8 mx-auto"></i>
                    <p className="text-slate-500 font-black uppercase text-sm tracking-widest">Seleccione insumos del catálogo lateral para iniciar</p>
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
              <p className="text-slate-500 font-medium mb-12 max-w-lg mx-auto">Análisis de patógenos y deficiencias mediante reconocimiento visual de tejido.</p>
              <div className="relative group border-4 border-dashed border-slate-200 rounded-[3.5rem] p-10 bg-slate-50 transition-all hover:bg-slate-100">
                {visionImage ? (
                  <img src={visionImage} className="aspect-video rounded-[2.5rem] object-cover mx-auto shadow-2xl" />
                ) : (
                  <label className="cursor-pointer flex flex-col items-center py-10">
                    <i className="fas fa-camera text-6xl text-emerald-500 mb-6"></i>
                    <span className="text-sm font-black uppercase text-slate-500 tracking-widest">Capturar Foto del Cultivo</span>
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
                    {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i> Analizando Muestra...</> : 'Iniciar Diagnóstico Visual'}
                  </button>
                </div>
              )}
            </div>
            {visionReport && (
              <div className="bg-white p-12 rounded-[3rem] shadow-xl border-4 border-teal-100 animate-in slide-in-from-bottom-5 duration-500">
                <h3 className="text-3xl font-black text-slate-900 uppercase mb-8 border-b pb-4">Resultado del Análisis Visual</h3>
                <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-2">Hallazgo Identificado</h4>
                      <p className="text-2xl font-black text-slate-900 leading-tight">{visionReport.pestAnalysis.identifiedPest}</p>
                      <p className="text-xs text-slate-500 font-bold italic mt-1">{visionReport.pestAnalysis.scientificName}</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Sintomatología Detectada</h4>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{visionReport.pestAnalysis.symptoms}"</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="bg-emerald-900 text-white p-8 rounded-[3rem] shadow-xl">
                       <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-6">Manejo de Choque Biológico</h4>
                       <ul className="space-y-4">
                         {visionReport.biologicalRemedy.ingredients.map((ing, i) => (
                           <li key={i} className="flex items-start gap-3 text-sm font-bold">
                             <i className="fas fa-check-circle text-emerald-400 mt-1"></i> {ing}
                           </li>
                         ))}
                       </ul>
                       <div className="mt-8 pt-6 border-t border-white/10">
                          <p className="text-[10px] font-black uppercase text-emerald-400 mb-2 tracking-widest">Preparación del Bio-remedio:</p>
                          <p className="text-xs font-medium text-emerald-100 leading-relaxed">{visionReport.biologicalRemedy.preparation}</p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-4xl font-black text-[#064e3b] uppercase tracking-tighter">Historial de Reportes</h2>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Registros almacenados de cotizaciones y protocolos IA</p>
              </div>
              <button onClick={() => { if(confirm('¿Desea eliminar permanentemente el historial?')) { setHistory([]); localStorage.removeItem('biogenesis_history_v2'); } }} className="px-6 py-3 bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-200 transition-all">
                <i className="fas fa-trash-alt mr-2"></i> Borrar Todo
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {history.length > 0 ? history.map(record => (
                <div key={record.id} className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 hover:border-emerald-500 transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl">
                        {record.input.treeType === TreeType.GRASS ? <i className="fas fa-align-justify"></i> : <i className="fas fa-leaf"></i>}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase leading-none mb-1">{record.client.firstName} {record.client.lastName}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{record.date}</p>
                      </div>
                    </div>
                    <span className="bg-slate-100 px-3 py-1 rounded-full text-[8px] font-black text-slate-500">ID: {record.consecutive}</span>
                  </div>
                  
                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 uppercase text-[9px]">Variedad/Especie:</span>
                      <span className="text-slate-700 uppercase">{record.input.treeType === TreeType.GRASS ? record.input.grassVariety : record.input.treeType}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 uppercase text-[9px]">Localidad:</span>
                      <span className="text-slate-700">{record.client.location || record.input.department}</span>
                    </div>
                    <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-slate-400 uppercase text-[8px] tracking-widest">Inversión Final</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">${record.result.totalProjectCost.toLocaleString()}</span>
                      </div>
                      {record.aiAdvice && (
                        <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-1 rounded-lg uppercase flex items-center gap-1">
                          <i className="fas fa-robot"></i> Plan IA Incluido
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                    <button onClick={() => shareWhatsApp(record.result, record.input, record.aiAdvice, record.client)} className="py-4 bg-emerald-500 text-white rounded-2xl text-[9px] font-black uppercase hover:bg-emerald-600 shadow-md flex items-center justify-center gap-2">
                      <i className="fab fa-whatsapp"></i> WhatsApp
                    </button>
                    <button onClick={() => exportPDF(record.result, record.input, record.aiAdvice, record.client)} className="py-4 bg-[#064e3b] text-white rounded-2xl text-[9px] font-black uppercase hover:bg-black shadow-md flex items-center justify-center gap-2">
                      <i className="fas fa-file-pdf"></i> Generar PDF
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-full text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
                  <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-archive text-3xl text-slate-200"></i>
                  </div>
                  <p className="text-slate-300 font-black uppercase text-sm tracking-[0.2em]">Sin registros almacenados</p>
                  <button onClick={() => setActiveTab('calculator')} className="mt-8 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:scale-105 transition-transform">Iniciar Nueva Cotización</button>
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
