
import React, { useState, useEffect, useCallback } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, Department, ClientData, HistoryRecord, SoilAnalysisProfile } from './types.ts';
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
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass' | 'vision' | 'history'>('calculator');
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [visionReport, setVisionReport] = useState<VisionReport | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<OrganicProduct | null>(null);
  const [additionalPercent, setAdditionalPercent] = useState<number>(0);
  const [showSoilProfile, setShowSoilProfile] = useState(false);

  const [clientData, setClientData] = useState<ClientData>({
    firstName: '', lastName: '', location: '', contact: '', email: ''
  });

  const [input, setInput] = useState<CalculationInput & { 
    manualTotalAmounts: Record<string, number | undefined>,
    manualUnitPrices: Record<string, number | undefined>,
    manualUnits: Record<string, UnitType | undefined>
  }>({
    treeType: TreeType.CITRUS, department: Department.ANTIOQUIA, applicationMode: ApplicationMode.MAINTENANCE,
    soilType: SoilType.FRANCO, 
    soilPercentages: { sand: 40, silt: 40, clay: 20 },
    soilProfile: { ph: 6.5, organicMatter: 3, ec: 1.2 },
    climate: ClimateType.MODERATE, treeAge: 1, numTrees: 1, 
    grassVariety: GrassVariety.KIKUYO, grassMode: GrassMeasureMode.AREA,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    productPrices: { ...COLOMBIAN_MARKET_PRICES }, manualPlantAmounts: {}, selectedUnits: {},
    cycleFrequencyValue: 3, cycleFrequencyUnit: 'meses', healthStatus: 'bueno',
    manualAmounts: {},
    manualTotalAmounts: {},
    manualUnitPrices: {},
    manualUnits: {}
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('biogenesis_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const getSoilTypeFromPercentages = (sand: number, silt: number, clay: number): SoilType => {
    if (clay >= 40) {
      if (sand > 45) return SoilType.ARCILLO_ARENOSO;
      if (silt > 40) return SoilType.ARCILLO_LIMOSO;
      return SoilType.ARCILLA;
    }
    if (clay >= 27 && clay < 40) {
      if (sand > 45) return SoilType.FRANCO_ARCILLO_ARENOSO;
      if (silt > 28) return SoilType.FRANCO_ARCILLO_LIMOSO;
      return SoilType.FRANCO_ARCILLOSO;
    }
    if (clay < 27) {
      if (silt >= 80) return SoilType.LIMO;
      if (silt >= 50) return SoilType.FRANCO_LIMOSO;
      if (sand >= 85) return SoilType.ARENA;
      if (sand >= 70) return SoilType.ARENO_FRANCO;
      if (sand >= 50) return SoilType.FRANCO_ARENOSO;
      return SoilType.FRANCO;
    }
    return SoilType.FRANCO;
  };

  const handlePercentageChange = (type: 'sand' | 'silt' | 'clay', value: number) => {
    const newPercentages = { ...input.soilPercentages!, [type]: value };
    const newSoilType = getSoilTypeFromPercentages(newPercentages.sand, newPercentages.silt, newPercentages.clay);
    setInput({ ...input, soilPercentages: newPercentages, soilType: newSoilType });
  };

  const handleSoilProfileChange = (field: keyof SoilAnalysisProfile, value: number) => {
    setInput(prev => ({
      ...prev,
      soilProfile: { ...prev.soilProfile!, [field]: value }
    }));
  };

  const calculateProductRow = useCallback((p: OrganicProduct) => {
    const quantityBase = input.numTrees || 1;
    let totalAmount: number;
    
    if (input.manualTotalAmounts[p] !== undefined) {
      totalAmount = input.manualTotalAmounts[p] as number;
    } else {
      let dosePerUnit: number;
      if (input.manualPlantAmounts[p] !== undefined) {
        dosePerUnit = input.manualPlantAmounts[p] as number;
      } else {
        const base = BASE_RATES[p] || 0;
        const healthMultiplier = input.healthStatus === 'deficiente' ? 1.3 : (input.healthStatus === 'regular' ? 1.15 : 1);
        const factor = activeTab === 'grass' ? 1 : Math.min(2.5, 1 + (input.treeAge - 1) * 0.1);
        dosePerUnit = base * healthMultiplier * factor;
      }
      totalAmount = dosePerUnit * quantityBase;
    }

    const price = input.manualUnitPrices[p] !== undefined ? (input.manualUnitPrices[p] as number) : (input.productPrices[p] || 0);
    const subtotal = totalAmount * price;
    const unit = input.manualUnits[p] || PRODUCT_UNITS[p] || 'u';

    return {
      product: p,
      amount: parseFloat(totalAmount.toFixed(2)),
      unit: unit as UnitType,
      costPerUnit: price,
      totalCost: Math.round(subtotal)
    };
  }, [input, activeTab]);

  const updateResults = useCallback(() => {
    const products = input.selectedProducts.map(p => calculateProductRow(p));
    const subtotalProject = products.reduce((acc, curr) => acc + curr.totalCost, 0);

    setResult({ 
      products, 
      totalCostPerUnit: subtotalProject / (input.numTrees || 1), 
      totalProjectCost: subtotalProject, 
      frequency: `Cada ${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}` 
    });
  }, [input.selectedProducts, calculateProductRow, input.numTrees, input.cycleFrequencyValue, input.cycleFrequencyUnit]);

  useEffect(() => { updateResults(); }, [updateResults]);

  const additionalValue = (result?.totalProjectCost || 0) * (additionalPercent / 100);
  const grandTotal = (result?.totalProjectCost || 0) + additionalValue;
  const grandTotalPerPlant = grandTotal / (input.numTrees || 1);

  const saveReportToHistory = () => {
    if (!result) return;
    const newRecord: HistoryRecord = {
      id: Date.now().toString(),
      consecutive: history.length + 1,
      date: new Date().toLocaleString('es-CO'),
      client: { ...clientData },
      input: { ...input },
      result: { ...result },
      aiAdvice: aiAdvice
    };
    const newHistory = [newRecord, ...history];
    setHistory(newHistory);
    localStorage.setItem('biogenesis_history', JSON.stringify(newHistory));
    alert('Reporte guardado exitosamente en el historial.');
  };

  const shareViaWhatsApp = () => {
    if (!result) return;
    const text = `*BIOGENESIS PRO - REPORTE TÉCNICO*%0A%0A` +
                 `*Cliente:* ${clientData.firstName} ${clientData.lastName}%0A` +
                 `*Ubicación:* ${clientData.location}%0A` +
                 `*Proyecto:* ${activeTab === 'grass' ? 'Césped ' + input.grassVariety : input.treeType}%0A` +
                 `*Inversión por Planta:* $${Math.round(grandTotalPerPlant).toLocaleString()} COP%0A` +
                 `*Total Inversión:* $${Math.round(grandTotal).toLocaleString()} COP%0A%0A` +
                 `Consulte su reporte completo en PDF adjunto.`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleExportPDF = (onlyAI: boolean = false) => {
    if (!result) return;
    const doc = new jsPDF();
    const primaryColor = [6, 78, 59];
    const secondaryColor = [16, 185, 129];
    const numTrees = input.numTrees || 1;

    const drawHeader = (title: string) => {
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 50, 'F');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 14, 25);
      doc.setFontSize(9);
      doc.text('Ingeniería de Precisión y Plan de Manejo Bio-Orgánico', 14, 33);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 14, 38);
      doc.text(`UBICACIÓN: ${clientData.location.toUpperCase() || 'NO REGISTRADA'}`, 14, 43);
    };

    if (!onlyAI) {
      drawHeader('BIOGENESIS PRO - INFORME MAESTRO');
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('1. INFORMACIÓN DEL PROPIETARIO', 14, 65);
      
      autoTable(doc, {
        startY: 70,
        head: [['Campo', 'Detalle']],
        body: [
          ['Nombre Propietario', `${clientData.firstName} ${clientData.lastName}`],
          ['Ubicación Finca / Vereda', clientData.location],
          ['Contacto WhatsApp', clientData.contact],
          ['Correo Electrónico', clientData.email],
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor }
      });

      doc.text('2. ESPECIFICACIONES TÉCNICAS', 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Parámetro', 'Valor']],
        body: [
          ['Variedad/Especie', activeTab === 'grass' ? `Césped - ${input.grassVariety}` : input.treeType],
          ['Cant. Unidades', input.numTrees.toString()],
          ['Textura Suelo', `${input.soilType} (A:${input.soilPercentages?.sand}% L:${input.soilPercentages?.silt}% Ar:${input.soilPercentages?.clay}%)`],
          ['Perfil Químico', input.soilProfile ? `pH: ${input.soilProfile.ph} | MO: ${input.soilProfile.organicMatter}% | EC: ${input.soilProfile.ec} dS/m` : 'No reportado'],
          ['Estado Sanitario Inicial', input.healthStatus.toUpperCase()],
        ],
        theme: 'striped',
        headStyles: { fillColor: primaryColor }
      });

      doc.text('3. DETALLE DE INSUMOS Y COSTOS', 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Insumo', 'Unidad', 'Dosis/Plant', 'Cant. Tot', 'V. Unit', 'Cost/Plant', 'Subtotal (COP)']],
        body: result.products.map(p => [
          p.product, 
          p.unit, 
          (p.amount / numTrees).toFixed(2),
          p.amount.toLocaleString(),
          `$${p.costPerUnit.toLocaleString()}`,
          `$${Math.round(p.totalCost / numTrees).toLocaleString()}`,
          `$${p.totalCost.toLocaleString()}`
        ]),
        foot: [
          ['', '', '', '', '', 'SUBTOTAL PRODUCTOS', `$${result.totalProjectCost.toLocaleString()}`],
          ['', '', '', '', '', `GESTIÓN (${additionalPercent}%)`, `$${additionalValue.toLocaleString()}`],
          ['', '', '', '', '', 'COSTO TOTAL POR PLANTA', `$${Math.round(grandTotalPerPlant).toLocaleString()}`],
          ['', '', '', '', '', 'TOTAL INVERSIÓN', `$${grandTotal.toLocaleString()}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, fontSize: 8 },
        footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8 }
      });
    }

    if (aiAdvice) {
      if (!onlyAI) doc.addPage();
      else drawHeader('BIOGENESIS PRO - PLAN NUTRICIONAL IA');
      
      const startContentY = onlyAI ? 65 : 13;
      if (!onlyAI) {
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('4. PLAN MAESTRO DE NUTRICIÓN (BIO-VISION IA)', 14, startContentY);
      }
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text('ESTRATEGIA RADICULAR:', 14, onlyAI ? 75 : 30);
      autoTable(doc, {
        startY: onlyAI ? 80 : 35,
        head: [['Ítem Sugerido', 'Dosificación por Aplicación', 'Objetivo']],
        body: aiAdvice.radicularPlan.map(p => [p.item, p.dosage, p.purpose]),
        theme: 'striped',
        headStyles: { fillColor: secondaryColor },
        bodyStyles: { textColor: [0, 0, 0] }
      });

      doc.text('ESTRATEGIA FOLIAR:', 14, (doc as any).lastAutoTable.finalY + 12);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 17,
        head: [['Ítem Sugerido', 'Dosificación por Aplicación', 'Objetivo']],
        body: aiAdvice.foliarPlan.map(p => [p.item, p.dosage, p.purpose]),
        theme: 'striped',
        headStyles: { fillColor: secondaryColor },
        bodyStyles: { textColor: [0, 0, 0] }
      });

      if (aiAdvice.sources && aiAdvice.sources.length > 0) {
        const startY = (doc as any).lastAutoTable.finalY + 20;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('FUENTES TÉCNICAS Y REFERENCIAS TÉCNICAS:', 14, startY);
        doc.setFontSize(8);
        aiAdvice.sources.forEach((src, idx) => {
          doc.setTextColor(0, 0, 0);
          doc.text(`- ${src.title}: ${src.uri}`, 14, startY + 7 + (idx * 5));
        });
      }
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('________________________________', 140, 280);
      doc.text('Firma Responsable Técnico', 145, 285);
    }

    const fileName = onlyAI ? `Plan_Maestro_IA_${clientData.lastName}.pdf` : `Reporte_BioGenesis_${clientData.lastName}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      <header className="bg-[#064e3b] p-6 sticky top-0 z-50 shadow-xl no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <BioGenesisLogo />
          <nav className="flex bg-white/10 p-1 rounded-2xl backdrop-blur-md">
            {[
              { id: 'calculator', label: 'CULTIVOS', icon: 'fa-seedling' },
              { id: 'grass', label: 'CÉSPED', icon: 'fa-grass' },
              { id: 'vision', label: 'VISION IA', icon: 'fa-eye' },
              { id: 'history', label: 'HISTORIAL', icon: 'fa-history' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-[#064e3b] shadow-lg' : 'text-white/70 hover:text-white'}`}>
                <i className={`fas ${tab.icon}`}></i>{tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {(activeTab === 'calculator' || activeTab === 'grass') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Datos del Propietario</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Nombre" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black shadow-none outline-none" />
                    <input type="text" placeholder="Apellido" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black shadow-none outline-none" />
                  </div>
                  <input type="text" placeholder="Ubicación / Finca" value={clientData.location} onChange={e => setClientData({...clientData, location: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black shadow-none outline-none" />
                  <input type="text" placeholder="WhatsApp / Teléfono" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black shadow-none outline-none" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Configuración Técnica</h3>
                <div className="space-y-4">
                  {activeTab === 'grass' ? (
                    <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as GrassVariety})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black shadow-none">
                      {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <select value={input.treeType} onChange={e => setInput({...input, treeType: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black shadow-none">
                      {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Población Base</label>
                    <input type="number" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value) || 1})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black shadow-none outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <button 
                  onClick={() => setShowSoilProfile(!showSoilProfile)} 
                  className="w-full flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2"
                >
                  Perfil Analítico Suelo
                  <i className={`fas fa-chevron-${showSoilProfile ? 'up' : 'down'}`}></i>
                </button>
                {showSoilProfile && (
                  <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">pH Suelo (0-14)</label>
                        <input type="number" step="0.1" value={input.soilProfile?.ph} onChange={e => handleSoilProfileChange('ph', parseFloat(e.target.value))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase">MO (%)</label>
                        <input type="number" step="0.1" value={input.soilProfile?.organicMatter} onChange={e => handleSoilProfileChange('organicMatter', parseFloat(e.target.value))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase">Conductividad (dS/m)</label>
                      <input type="number" step="0.1" value={input.soilProfile?.ec} onChange={e => handleSoilProfileChange('ec', parseFloat(e.target.value))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black outline-none" />
                    </div>
                    <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                      <h4 className="text-[9px] font-black text-slate-400 uppercase mb-2">Macro-elementos (ppm)</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" placeholder="N" value={input.soilProfile?.nitrogen} onChange={e => handleSoilProfileChange('nitrogen', parseFloat(e.target.value))} className="p-2 bg-white border border-slate-200 rounded-lg text-center text-[10px] font-bold text-black" />
                        <input type="number" placeholder="P" value={input.soilProfile?.phosphorus} onChange={e => handleSoilProfileChange('phosphorus', parseFloat(e.target.value))} className="p-2 bg-white border border-slate-200 rounded-lg text-center text-[10px] font-bold text-black" />
                        <input type="number" placeholder="K" value={input.soilProfile?.potassium} onChange={e => handleSoilProfileChange('potassium', parseFloat(e.target.value))} className="p-2 bg-white border border-slate-200 rounded-lg text-center text-[10px] font-bold text-black" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Porcentaje de Gestión (%)</h3>
                <input 
                  type="number" 
                  value={additionalPercent} 
                  onChange={(e) => setAdditionalPercent(parseFloat(e.target.value) || 0)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-emerald-700 shadow-none outline-none"
                  placeholder="Ej: 10"
                />
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Insumos Bio-Orgánicos</h3>
                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {Object.values(OrganicProduct).map(p => (
                    <label key={p} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer ${input.selectedProducts.includes(p) ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 shadow-none'}`}>
                      <input type="checkbox" checked={input.selectedProducts.includes(p)} onChange={() => setInput(prev => ({ ...prev, selectedProducts: prev.selectedProducts.includes(p) ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="accent-emerald-600 shadow-none outline-none" />
                      <span className="text-[10px] font-black uppercase text-black">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 min-h-[600px] flex flex-col">
                <div className="flex justify-between items-center mb-8 pb-4 border-b">
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-black">Plan Maestro de Nutrición</h2>
                  <div className="flex gap-2">
                    <button title="Guardar Historial" onClick={saveReportToHistory} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all shadow-md"><i className="fas fa-save"></i></button>
                    <button title="Compartir WhatsApp" onClick={shareViaWhatsApp} className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-700 transition-all shadow-md"><i className="fab fa-whatsapp"></i></button>
                    <button onClick={() => handleExportPDF(false)} className="bg-[#064e3b] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg flex items-center gap-2">
                      <i className="fas fa-file-pdf"></i> Informe PDF
                    </button>
                  </div>
                </div>

                {result && result.products.length > 0 ? (
                  <div className="space-y-8 flex-1">
                    {/* DASHBOARD DE RESUMEN POR PLANTA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
                      <div className="bg-emerald-600 p-6 rounded-[2rem] shadow-lg text-white relative overflow-hidden group">
                        <i className="fas fa-dollar-sign absolute -right-4 -bottom-4 text-8xl opacity-10 group-hover:scale-110 transition-transform"></i>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">Precio Nutrición por Planta</p>
                        <h4 className="text-4xl font-black tracking-tighter">${Math.round(grandTotalPerPlant).toLocaleString()} <span className="text-xs uppercase opacity-70">COP</span></h4>
                        <p className="text-[9px] mt-2 font-bold opacity-60">* Incluye insumos y {additionalPercent}% de gestión</p>
                      </div>
                      <div className="bg-slate-800 p-6 rounded-[2rem] shadow-lg text-white relative overflow-hidden group">
                        <i className="fas fa-chart-line absolute -right-4 -bottom-4 text-8xl opacity-10 group-hover:scale-110 transition-transform"></i>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">Inversión Total del Proyecto</p>
                        <h4 className="text-4xl font-black tracking-tighter">${Math.round(grandTotal).toLocaleString()} <span className="text-xs uppercase opacity-70">COP</span></h4>
                        <p className="text-[9px] mt-2 font-bold opacity-60">* Para {input.numTrees} unidades registradas</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[2rem] border overflow-x-auto">
                      <table className="w-full text-left text-[10px] text-black border-collapse min-w-[700px]">
                        <thead className="bg-slate-100 font-black uppercase text-slate-600">
                          <tr>
                            <th className="p-3">Insumo</th>
                            <th className="p-3 text-center">Unidad</th>
                            <th className="p-3 text-center">Dosis/Planta</th>
                            <th className="p-3 text-center">Cant. Total</th>
                            <th className="p-3 text-center">V. Unit</th>
                            <th className="p-3 text-center">Costo/Planta</th>
                            <th className="p-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {result.products.map((p, i) => (
                            <tr key={i} className="border-t hover:bg-slate-50 transition-colors">
                              <td className="p-3 uppercase font-bold text-black truncate max-w-[150px]">{p.product}</td>
                              <td className="p-3 text-center">
                                <select 
                                  value={input.manualUnits[p.product] ?? p.unit}
                                  onChange={(e) => setInput(prev => ({
                                    ...prev,
                                    manualUnits: { ...prev.manualUnits, [p.product]: e.target.value as UnitType }
                                  }))}
                                  className="w-14 p-1 border border-slate-100 rounded text-center text-black font-semibold bg-white outline-none appearance-none"
                                >
                                  {['gr', 'kg', 'ml', 'cc', 'lt', 'gl'].map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="p-3 text-center text-slate-500 font-bold">
                                {(p.amount / (input.numTrees || 1)).toFixed(2)}
                              </td>
                              <td className="p-3 text-center">
                                <input 
                                  type="number" 
                                  value={input.manualTotalAmounts[p.product] ?? p.amount}
                                  onChange={(e) => setInput(prev => ({
                                    ...prev,
                                    manualTotalAmounts: { ...prev.manualTotalAmounts, [p.product]: parseFloat(e.target.value) || 0 }
                                  }))}
                                  className="w-16 p-1 border border-slate-100 rounded text-center text-black font-semibold bg-white outline-none shadow-none"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input 
                                  type="number" 
                                  value={input.manualUnitPrices[p.product] ?? p.costPerUnit}
                                  onChange={(e) => setInput(prev => ({
                                    ...prev,
                                    manualUnitPrices: { ...prev.manualUnitPrices, [p.product]: parseFloat(e.target.value) || 0 }
                                  }))}
                                  className="w-20 p-1 border border-slate-100 rounded text-center text-black font-semibold bg-white outline-none shadow-none"
                                />
                              </td>
                              <td className="p-3 text-center text-emerald-600 font-bold">
                                ${Math.round(p.totalCost / (input.numTrees || 1)).toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-emerald-800 font-black">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2">
                          <tr className="bg-slate-100 text-slate-800 font-black">
                            <td colSpan={6} className="p-3 text-right uppercase tracking-wider text-[8px]">Subtotal Productos</td>
                            <td className="p-3 text-right text-base">${result.totalProjectCost.toLocaleString()}</td>
                          </tr>
                          <tr className="bg-slate-200 text-emerald-900 font-black">
                            <td colSpan={6} className="p-3 text-right uppercase tracking-wider text-[8px]">Gestión / Adm. ({additionalPercent}%)</td>
                            <td className="p-3 text-right text-base">${Math.round(additionalValue).toLocaleString()}</td>
                          </tr>
                          <tr className="bg-slate-100 text-slate-900 font-black border-y border-slate-300">
                            <td colSpan={6} className="p-3 text-right uppercase tracking-wider text-[8px]">Valor Unitario de Nutrición (Final)</td>
                            <td className="p-3 text-right text-lg text-emerald-700">${Math.round(grandTotalPerPlant).toLocaleString()}</td>
                          </tr>
                          <tr className="bg-[#064e3b] text-white font-black">
                            <td colSpan={6} className="p-4 text-right uppercase tracking-wider text-[9px]">Gran Valor de Inversión Final</td>
                            <td className="p-4 text-right text-xl text-emerald-400 tracking-tighter">${Math.round(grandTotal).toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="bg-emerald-50 p-8 rounded-[2rem] border-2 border-dashed border-emerald-200 relative">
                       <div className="flex justify-between items-start mb-6">
                         <h4 className="font-black text-[#064e3b] uppercase flex items-center gap-3"><i className="fas fa-wand-magic-sparkles"></i> Plan Maestro IA</h4>
                         {aiAdvice && (
                           <button onClick={() => handleExportPDF(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase shadow hover:bg-emerald-700 transition-all flex items-center gap-1.5">
                             <i className="fas fa-file-export"></i> PDF Plan IA
                           </button>
                         )}
                       </div>
                       
                       {!aiAdvice ? (
                         <button onClick={async () => { setLoading(true); const advice = await getAgriculturalAdvice(input); setAiAdvice(advice); setLoading(false); }} disabled={loading} className="w-full bg-white text-emerald-900 p-8 rounded-2xl border font-black uppercase hover:bg-emerald-100 transition-all shadow-sm">
                           {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                           {loading ? 'Consultando IA...' : 'Generar Plan de Nutrición IA'}
                         </button>
                       ) : (
                         <div className="grid md:grid-cols-2 gap-6 animate-in slide-in-from-bottom">
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100">
                              <h5 className="text-[10px] font-black text-emerald-800 uppercase border-b mb-3 pb-2">Estrategia Radicular</h5>
                              {aiAdvice.radicularPlan.map((s, i) => <div key={i} className="text-[10px] mb-2 font-bold uppercase text-black"><span className="text-emerald-700 font-black">{s.item}:</span> {s.dosage}</div>)}
                            </div>
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-teal-100">
                              <h5 className="text-[10px] font-black text-teal-800 uppercase border-b mb-3 pb-2">Estrategia Foliar</h5>
                              {aiAdvice.foliarPlan.map((s, i) => <div key={i} className="text-[10px] mb-2 font-bold uppercase text-black"><span className="text-teal-700 font-black">{s.item}:</span> {s.dosage}</div>)}
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-slate-400 py-20 uppercase font-black tracking-widest">
                    <i className="fas fa-calculator text-6xl mb-4"></i>
                    <span>Configure datos para calcular</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'vision' && (
          <div className="max-w-4xl mx-auto bg-white p-14 rounded-[4rem] shadow-2xl text-center">
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-8 text-black">Bio-Vision IA</h2>
            <div className="border-4 border-dashed border-slate-100 p-10 rounded-[3rem] bg-slate-50 mb-10">
              {visionImage ? <img src={visionImage} className="mx-auto rounded-3xl max-h-[400px] border-8 border-white shadow-xl" /> : (
                <label className="cursor-pointer">
                  <i className="fas fa-camera text-6xl text-emerald-500 mb-4"></i>
                  <p className="font-black uppercase text-xs text-slate-400 tracking-widest">Subir Imagen de Muestra</p>
                  <input type="file" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onloadend = () => setVisionImage(r.result as string);
                      r.readAsDataURL(f);
                    }
                  }} />
                </label>
              )}
            </div>
            {visionImage && (
              <button onClick={async () => { setLoading(true); const r = await getIndependentVisionDiagnosis(visionImage, input.treeType); setVisionReport(r); setLoading(false); }} className="px-12 py-4 bg-[#064e3b] text-white rounded-2xl font-black uppercase shadow-xl">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Analizar Muestra'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4 text-black">
              <i className="fas fa-history text-emerald-600"></i> Historial de Reportes
            </h2>
            {history.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] text-center text-slate-300 font-black uppercase">
                No hay reportes guardados
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map(record => (
                  <div key={record.id} className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-100 hover:shadow-xl transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase">Reporte #{record.consecutive}</p>
                        <h3 className="font-black text-slate-800 uppercase text-sm truncate text-black">{record.client.firstName} {record.client.lastName}</h3>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{record.date.split(',')[0]}</span>
                    </div>
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                        <span>Proyecto:</span>
                        <span className="text-slate-800 text-black">{record.input.treeType}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                        <span>Inversión:</span>
                        <span className="text-emerald-700 font-black">${Math.round(record.result.totalProjectCost).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setInput(record.input as any); setResult(record.result); setClientData(record.client); setAiAdvice(record.aiAdvice || null); setActiveTab('calculator'); }} className="flex-1 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase">Cargar</button>
                      <button onClick={() => { setHistory(history.filter(h => h.id !== record.id)); localStorage.setItem('biogenesis_history', JSON.stringify(history.filter(h => h.id !== record.id))); }} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
