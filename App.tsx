
import React, { useState, useEffect, useCallback } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, Department, ClientData, HistoryRecord } from './types.ts';
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
  
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<OrganicProduct | null>(null);
  const [additionalPercent, setAdditionalPercent] = useState<number>(0);

  const [clientData, setClientData] = useState<ClientData>({
    firstName: '', lastName: '', location: '', contact: '', email: ''
  });

  const [input, setInput] = useState<CalculationInput & { 
    manualTotalAmounts: Record<string, number | undefined>,
    manualUnitPrices: Record<string, number | undefined>
  }>({
    treeType: TreeType.CITRUS, department: Department.ANTIOQUIA, applicationMode: ApplicationMode.MAINTENANCE,
    soilType: SoilType.FRANCO, 
    soilPercentages: { sand: 40, silt: 40, clay: 20 },
    climate: ClimateType.MODERATE, treeAge: 1, numTrees: 1, 
    grassVariety: GrassVariety.KIKUYO, grassMode: GrassMeasureMode.AREA,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    productPrices: { ...COLOMBIAN_MARKET_PRICES }, manualPlantAmounts: {}, selectedUnits: {},
    cycleFrequencyValue: 3, cycleFrequencyUnit: 'meses', healthStatus: 'bueno',
    manualAmounts: {},
    manualTotalAmounts: {},
    manualUnitPrices: {}
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

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

    return {
      product: p,
      amount: parseFloat(totalAmount.toFixed(2)),
      unit: input.selectedUnits[p] || PRODUCT_UNITS[p] || 'u',
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

  const handleExportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const primaryColor = [6, 78, 59]; // Emerald 900
    const secondaryColor = [16, 185, 129]; // Emerald 500

    // HEADER
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('BIOGENESIS PRO - INFORME TÉCNICO', 14, 25);
    doc.setFontSize(9);
    doc.text('Ingeniería Agronómica y Bio-Insumos Orgánicos de Precisión', 14, 33);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}`, 14, 38);
    doc.text(`N° Reporte: ${Math.floor(Math.random() * 100000)}`, 160, 38);

    // DATOS DEL CLIENTE
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('1. DATOS DEL PROPIETARIO / CLIENTE', 14, 65);
    
    autoTable(doc, {
      startY: 70,
      head: [['Campo', 'Información del Cliente']],
      body: [
        ['Nombre Completo', `${clientData.firstName} ${clientData.lastName}`.trim() || 'No especificado'],
        ['Ubicación de la Finca / Proyecto', clientData.location || 'No especificada'],
        ['Contacto / Teléfono', clientData.contact || 'No especificado'],
        ['Correo Electrónico', clientData.email || 'No especificado'],
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } }
    });

    // INFORMACIÓN TÉCNICA DEL CULTIVO
    doc.text('2. ESPECIFICACIONES TÉCNICAS DEL CULTIVO', 14, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Parámetro Técnico', 'Valor Registrado']],
      body: [
        ['Especie / Variedad', activeTab === 'grass' ? `Césped - ${input.grassVariety}` : input.treeType],
        ['Departamento', input.department],
        ['Modo de Operación', input.applicationMode],
        ['Estado Sanitario Inicial', input.healthStatus.toUpperCase()],
        ['Frecuencia de Nutrición', `Cada ${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}`],
        [activeTab === 'grass' ? `Área/Longitud (${input.grassMode})` : 'Población (N° Plantas)', input.numTrees.toString()],
        ['Textura de Suelo (Granulometría)', `${input.soilType} (Arena: ${input.soilPercentages?.sand}%, Limo: ${input.soilPercentages?.silt}%, Arcilla: ${input.soilPercentages?.clay}%)`],
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
    });

    // PRESUPUESTO DE INSUMOS
    doc.text('3. PRESUPUESTO Y DOSIFICACIÓN GENERAL DE INSUMOS', 14, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Insumo Bio-Orgánico', 'Unidad', 'Cantidad Total', 'V. Unitario', 'Subtotal (COP)']],
      body: result.products.map(p => [
        p.product,
        p.unit,
        p.amount.toLocaleString(),
        `$${p.costPerUnit.toLocaleString()}`,
        `$${p.totalCost.toLocaleString()}`
      ]),
      foot: [
        ['', '', '', 'SUBTOTAL INSUMOS', `$${result.totalProjectCost.toLocaleString()}`],
        ['', '', '', `COSTOS DE GESTIÓN (${additionalPercent}%)`, `$${additionalValue.toLocaleString()}`],
        ['', '', '', 'TOTAL INVERSIÓN', `$${grandTotal.toLocaleString()}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    // PLAN MAESTRO IA (Página 2)
    if (aiAdvice) {
      doc.addPage();
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 25, 'F');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('4. PLAN MAESTRO GENERADO POR BIO-VISION IA', 14, 16);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text('ESTRATEGIA RADICULAR (SUELO):', 14, 40);
      autoTable(doc, {
        startY: 45,
        head: [['Producto Sugerido', 'Dosis por Aplicación', 'Función Técnica']],
        body: aiAdvice.radicularPlan.map(p => [p.item, p.dosage, p.purpose]),
        theme: 'striped',
        headStyles: { fillColor: secondaryColor },
      });

      doc.text('ESTRATEGIA FOLIAR Y MANTENIMIENTO:', 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Producto Sugerido', 'Dosis por Aplicación', 'Función Técnica']],
        body: aiAdvice.foliarPlan.map(p => [p.item, p.dosage, p.purpose]),
        theme: 'striped',
        headStyles: { fillColor: secondaryColor },
      });

      doc.text('MANEJO DE RIEGO Y RECOMENDACIONES:', 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Volumen Sugerido', 'Frecuencia de Riego', 'Método de Aplicación']],
        body: [[
          aiAdvice.waterRequirement.volume,
          aiAdvice.waterRequirement.frequency,
          aiAdvice.waterRequirement.technique
        ]],
        theme: 'grid',
      });

      doc.setFontSize(10);
      doc.text('CONSEJOS DE MANEJO ESTACIONAL:', 14, (doc as any).lastAutoTable.finalY + 15);
      doc.setFontSize(9);
      const tipsText = aiAdvice.tips.join(' | ') + ". " + aiAdvice.seasonalAdvice;
      const splitTips = doc.splitTextToSize(tipsText, 180);
      doc.text(splitTips, 14, (doc as any).lastAutoTable.finalY + 22);

      // Firma
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('________________________________', 140, (doc as any).lastAutoTable.finalY + 60);
      doc.text('Firma Responsable Técnico', 145, (doc as any).lastAutoTable.finalY + 65);
    }

    doc.save(`BioGenesis_Reporte_${clientData.lastName || 'Cliente'}_${new Date().getTime()}.pdf`);
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
              {/* DATOS DEL CLIENTE */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">
                  Información del Cliente
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Nombre" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    <input type="text" placeholder="Apellido" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                  </div>
                  <input type="text" placeholder="Ubicación / Finca" value={clientData.location} onChange={e => setClientData({...clientData, location: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Teléfono" value={clientData.contact} onChange={e => setClientData({...clientData, contact: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    <input type="email" placeholder="Email" value={clientData.email} onChange={e => setClientData({...clientData, email: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                  </div>
                </div>
              </div>

              {/* CONFIGURACIÓN BÁSICA */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">
                  {activeTab === 'grass' ? 'Especificaciones del Césped' : 'Configuración de Cultivo'}
                </h3>
                <div className="space-y-4">
                  {activeTab === 'grass' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Variedad</label>
                        <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as GrassVariety})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                          {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[GrassMeasureMode.AREA, GrassMeasureMode.LINEAR].map(mode => (
                          <button key={mode} onClick={() => setInput({...input, grassMode: mode})} className={`p-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${input.grassMode === mode ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                            {mode === GrassMeasureMode.AREA ? 'Por Área (m²)' : 'Lineal (m)'}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Tipo de Cultivo</label>
                      <select value={input.treeType} onChange={e => setInput({...input, treeType: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                        {Object.values(TreeType).filter(t => t !== TreeType.GRASS).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {activeTab === 'calculator' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Edad (Años)</label>
                        <input type="number" value={input.treeAge} onChange={e => setInput({...input, treeAge: parseInt(e.target.value) || 1})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">{activeTab === 'grass' ? `Cant. ${input.grassMode}` : 'N° Plantas'}</label>
                      <input type="number" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value) || 1})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ANÁLISIS DE SUELO (TRIÁNGULO DE TEXTURAS) */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex justify-between items-center">
                  <span>Análisis de Suelo (%)</span>
                  <i className="fas fa-chart-pie text-emerald-500"></i>
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-amber-700 uppercase">Arena</label>
                      <input type="number" value={input.soilPercentages?.sand} onChange={e => handlePercentageChange('sand', parseInt(e.target.value) || 0)} className="w-full p-2 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-center" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase">Limo</label>
                      <input type="number" value={input.soilPercentages?.silt} onChange={e => handlePercentageChange('silt', parseInt(e.target.value) || 0)} className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-center" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-red-700 uppercase">Arcilla</label>
                      <input type="number" value={input.soilPercentages?.clay} onChange={e => handlePercentageChange('clay', parseInt(e.target.value) || 0)} className="w-full p-2 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-center" />
                    </div>
                  </div>
                  <div className="space-y-1 pt-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Textura Resultante</label>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-black text-emerald-800 uppercase text-center">
                      {input.soilType}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Catálogo Bio-Orgánico</h3>
                <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {Object.values(OrganicProduct).map(p => {
                    const isSelected = input.selectedProducts.includes(p);
                    return (
                      <div key={p} className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/10' : 'bg-slate-50 border-slate-100'}`}>
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input type="checkbox" checked={isSelected} onChange={() => setInput(prev => ({ ...prev, selectedProducts: isSelected ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] }))} className="w-5 h-5 accent-emerald-600 rounded" />
                          <span className="text-[11px] font-black text-slate-800 uppercase leading-none">{p}</span>
                        </label>
                        <button onClick={() => setSelectedProductForDetail(p)} className="text-slate-300 hover:text-emerald-600 transition-colors"><i className="fas fa-info-circle"></i></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 min-h-[600px] flex flex-col">
                <div className="flex justify-between items-center mb-8 pb-4 border-b">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                      {activeTab === 'grass' ? `Proyecto Césped: ${input.grassVariety}` : `Reporte Técnico: ${input.treeType}`}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Generación de informe técnico profesional</p>
                  </div>
                  <button onClick={handleExportPDF} className="bg-[#064e3b] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2">
                    <i className="fas fa-file-pdf"></i>
                    Exportar Informe Maestro
                  </button>
                </div>

                {result && result.products.length > 0 ? (
                  <div className="flex-1 flex flex-col justify-between space-y-10">
                    <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-50/50">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          <tr>
                            <th className="p-5">Insumo</th>
                            <th className="p-5 w-24">Unidad</th>
                            <th className="p-5 w-32 text-center">Cant. Total</th>
                            <th className="p-5 w-32 text-center">V. Unitario</th>
                            <th className="p-5 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-bold text-slate-700">
                          {result.products.map((p, idx) => (
                            <tr key={idx} className="border-t hover:bg-emerald-50/20 transition-colors">
                              <td className="p-5 uppercase font-black text-slate-900 text-xs">{p.product}</td>
                              <td className="p-3">
                                <select value={input.selectedUnits[p.product] || PRODUCT_UNITS[p.product]} onChange={e => setInput({...input, selectedUnits: {...input.selectedUnits, [p.product]: e.target.value as any}})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black shadow-sm">
                                  {['g','kg','ml','cc','L','galon','u'].map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="p-3">
                                <input type="number" value={input.manualTotalAmounts[p.product] ?? p.amount} onChange={e => setInput({...input, manualTotalAmounts: {...input.manualTotalAmounts, [p.product]: parseFloat(e.target.value) || 0}})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-emerald-700 shadow-sm" />
                              </td>
                              <td className="p-3">
                                <input type="number" value={input.manualUnitPrices[p.product] ?? p.costPerUnit} onChange={e => setInput({...input, manualUnitPrices: {...input.manualUnitPrices, [p.product]: parseFloat(e.target.value) || 0}})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-slate-600 shadow-sm" />
                              </td>
                              <td className="p-5 text-right font-black text-emerald-800 text-xs">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100/80 border-t-2 border-slate-200">
                           <tr className="border-b">
                             <td colSpan={4} className="p-4 text-right font-black text-slate-400 text-[10px] uppercase">Subtotal Insumos</td>
                             <td className="p-4 text-right font-black text-slate-900 text-lg">${result.totalProjectCost.toLocaleString()}</td>
                           </tr>
                           <tr className="border-b bg-emerald-50/30">
                             <td colSpan={4} className="p-4 text-right font-black text-slate-400 text-[10px] uppercase flex items-center justify-end gap-4">
                               <span>Utilidad / Gestión (%)</span>
                               <input type="number" value={additionalPercent} onChange={(e) => setAdditionalPercent(parseFloat(e.target.value) || 0)} className="w-24 p-2 bg-white border-2 border-emerald-400 rounded-xl text-center text-xs font-black text-emerald-700 shadow-md focus:ring-2 focus:ring-emerald-600" />
                             </td>
                             <td className="p-4 text-right font-black text-blue-600">+${Math.round(additionalValue).toLocaleString()}</td>
                           </tr>
                           <tr className="bg-[#064e3b] text-white">
                             <td colSpan={4} className="p-8 text-right font-black uppercase text-sm tracking-widest text-emerald-200">Gran Valor de Inversión</td>
                             <td className="p-8 text-right font-black text-3xl text-emerald-400 tracking-tighter">${Math.round(grandTotal).toLocaleString()}</td>
                           </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="bg-emerald-50 p-8 rounded-[3rem] border-2 border-dashed border-emerald-200">
                       <h4 className="text-xl font-black text-[#064e3b] uppercase mb-6 flex items-center gap-3"><i className="fas fa-robot text-emerald-600"></i> Plan Maestro IA</h4>
                       {!aiAdvice ? (
                         <button onClick={async () => { setLoading(true); const advice = await getAgriculturalAdvice(input); setAiAdvice(advice); setLoading(false); }} disabled={loading} className="w-full bg-white text-emerald-900 p-8 rounded-2xl border-2 border-emerald-300 font-black uppercase shadow-md hover:bg-emerald-50 transition-all flex items-center justify-center gap-4">
                           {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                           {loading ? 'Consultando IA...' : `Generar Recomendación para ${activeTab === 'grass' ? 'Césped' : 'Cultivo'}`}
                         </button>
                       ) : (
                         <div className="grid md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-5">
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black text-emerald-900 uppercase border-b border-emerald-200 pb-2">Plan Radicular</h5>
                              {aiAdvice.radicularPlan.map((s, idx) => (
                                <div key={idx} className="p-3 bg-white rounded-xl shadow-sm border border-emerald-100">
                                  <p className="text-[11px] font-black text-slate-900 uppercase">{s.item}</p>
                                  <p className="text-[9px] font-bold text-emerald-600 uppercase mt-1">Dosis: {s.dosage}</p>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black text-teal-900 uppercase border-b border-teal-200 pb-2">Plan Foliar</h5>
                              {aiAdvice.foliarPlan.map((s, idx) => (
                                <div key={idx} className="p-3 bg-white rounded-xl shadow-sm border border-teal-50">
                                  <p className="text-[11px] font-black text-slate-900 uppercase">{s.item}</p>
                                  <p className="text-[9px] font-bold text-teal-600 uppercase mt-1">Dosis: {s.dosage}</p>
                                </div>
                              ))}
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 text-slate-300 font-black uppercase text-sm tracking-widest gap-4">
                    <i className="fas fa-calculator text-5xl opacity-20"></i>
                    <span>Seleccione insumos para comenzar</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'vision' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
            <div className="bg-white p-14 rounded-[4rem] shadow-2xl text-center border-4 border-emerald-50">
              <h2 className="text-5xl font-black text-[#064e3b] mb-4 tracking-tighter uppercase">Bio-Vision IA</h2>
              <p className="text-slate-500 font-medium mb-12">Diagnóstico de plagas y deficiencias mediante imágenes de alta precisión.</p>
              <div className="relative group border-4 border-dashed border-slate-200 rounded-[3rem] p-10 bg-slate-50 transition-all hover:bg-slate-100">
                {visionImage ? (
                  <img src={visionImage} className="aspect-video rounded-[2rem] object-cover mx-auto shadow-2xl border-8 border-white" />
                ) : (
                  <label className="cursor-pointer flex flex-col items-center py-16">
                    <i className="fas fa-camera text-5xl text-emerald-500 mb-6 transition-transform"></i>
                    <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Subir Imagen de Muestra</span>
                    <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setVisionImage(reader.result as string); reader.readAsDataURL(file); } }} className="hidden" />
                  </label>
                )}
              </div>
              {visionImage && (
                <div className="flex justify-center gap-4 mt-10">
                  <button onClick={() => { setVisionImage(null); setVisionReport(null); }} className="px-10 py-4 bg-slate-200 text-slate-700 rounded-xl font-black uppercase">Limpiar</button>
                  <button onClick={async () => { setLoading(true); const report = await getIndependentVisionDiagnosis(visionImage, activeTab === 'grass' ? input.grassVariety || 'Césped' : input.treeType); setVisionReport(report); setLoading(false); }} disabled={loading} className="px-16 py-4 bg-[#064e3b] text-white rounded-xl font-black uppercase shadow-xl flex items-center gap-3">
                    {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-microscope"></i>}
                    {loading ? 'Analizando...' : 'Iniciar Bio-Diagnóstico'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {selectedProductForDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-[#064e3b] p-8 text-white flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">BioGenesis Technical File</span>
                <h2 className="text-3xl font-black uppercase tracking-tighter mt-1">{selectedProductForDetail}</h2>
              </div>
              <button onClick={() => setSelectedProductForDetail(null)} className="h-10 w-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-10 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-[11px] font-black text-emerald-600 uppercase tracking-widest"><i className="fas fa-flask-vial"></i> Composición</h4>
                <p className="text-slate-600 text-sm font-medium leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100">{PRODUCT_DETAILS[selectedProductForDetail]?.properties}</p>
              </div>
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-[11px] font-black text-emerald-600 uppercase tracking-widest"><i className="fas fa-check-double"></i> Beneficios</h4>
                <p className="text-slate-600 text-sm font-medium leading-relaxed">{PRODUCT_DETAILS[selectedProductForDetail]?.benefits}</p>
              </div>
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4">
                <div className="text-amber-500 mt-1"><i className="fas fa-triangle-exclamation text-xl"></i></div>
                <div className="space-y-1">
                  <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-widest">Precauciones</h4>
                  <p className="text-amber-800 text-xs font-bold leading-relaxed">{PRODUCT_DETAILS[selectedProductForDetail]?.precautions}</p>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedProductForDetail(null)} className="bg-[#064e3b] text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
