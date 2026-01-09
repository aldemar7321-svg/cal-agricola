
import React, { useState, useEffect, useCallback } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, PlantingFormulaRecommendation } from './types';
import { BASE_RATES, PRODUCT_UNITS, TREE_TYPE_ICONS, PRODUCT_CATEGORIES } from './constants';
import { getAgriculturalAdvice, getPlantingFormula } from './services/geminiService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const App: React.FC = () => {
  const [input, setInput] = useState<CalculationInput>({
    treeType: TreeType.CITRUS,
    soilType: SoilType.LOAMY,
    treeAge: 1,
    numTrees: 1,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO],
    productPrices: Object.values(OrganicProduct).reduce((acc, curr) => ({ ...acc, [curr]: 0 }), {}),
    manualAmounts: {},
    selectedUnits: Object.values(OrganicProduct).reduce((acc, curr) => ({ ...acc, [curr]: PRODUCT_UNITS[curr] }), {}),
    healthStatus: 'bueno'
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFormula, setLoadingFormula] = useState(false);
  const [formulaRec, setFormulaRec] = useState<PlantingFormulaRecommendation | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  const calculateDose = useCallback(() => {
    let healthModifier = 1.0;
    if (input.healthStatus === 'regular') healthModifier = 1.25;
    if (input.healthStatus === 'deficiente') healthModifier = 1.5;

    let soilModifier = 1.0;
    if (input.soilType === SoilType.SANDY) soilModifier = 1.15;
    if (input.soilType === SoilType.CLAYEY) soilModifier = 0.90;
    if (input.soilType === SoilType.SILTY) soilModifier = 1.0;
    if (input.soilType === SoilType.LOAMY) soilModifier = 1.0;

    const totalModifier = healthModifier * soilModifier;

    const productResults: ProductResult[] = input.selectedProducts.map(product => {
      const baseRate = BASE_RATES[product];
      const defaultUnit = PRODUCT_UNITS[product];
      const selectedUnit = input.selectedUnits[product] || defaultUnit;
      const pricePerUnit = input.productPrices[product] || 0;
      const manualAmount = input.manualAmounts[product];
      
      let perTreeAmount: number;
      
      if (manualAmount !== undefined) {
        perTreeAmount = manualAmount;
      } else {
        const rawPerTree = input.treeAge * baseRate * totalModifier;
        if (selectedUnit === 'kg' || selectedUnit === 'L') {
          perTreeAmount = Math.min(rawPerTree, 30);
        } else {
          perTreeAmount = rawPerTree;
        }
      }

      const costPerTree = perTreeAmount * pricePerUnit;
      const totalCost = costPerTree * input.numTrees;

      return {
        product,
        amount: parseFloat(perTreeAmount.toFixed(2)),
        unit: selectedUnit,
        costPerTree: parseFloat(costPerTree.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2))
      };
    });

    let frequency = "Cada 30-45 días (Mantenimiento)";
    const hasBioprotectants = input.selectedProducts.some(p => 
      [OrganicProduct.POTASSIUM_SOAP, OrganicProduct.NEEM_EXTRACT, OrganicProduct.SULFUR_FUNGICIDE, OrganicProduct.EM].includes(p)
    );
    const hasHeavyEnmiendas = input.selectedProducts.some(p => 
      [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.ROCK_DUST, OrganicProduct.PHOSPHATE_ROCK, OrganicProduct.CALCIUM_CARBONATE].includes(p)
    );

    if (hasBioprotectants && input.healthStatus !== 'bueno') {
      frequency = "Cada 15 días (Control Intensivo)";
    } else if (hasHeavyEnmiendas && !hasBioprotectants) {
      frequency = "Cada 4-6 meses (Enmienda de Suelo)";
    } else if (input.treeType === TreeType.GRASS) {
      frequency = "Cada 30 días o después de cada poda";
    }

    const totalCostPerTree = productResults.reduce((acc, curr) => acc + curr.costPerTree, 0);
    const totalProjectCost = totalCostPerTree * input.numTrees;

    setResult({
      products: productResults,
      totalCostPerTree: parseFloat(totalCostPerTree.toFixed(2)),
      totalProjectCost: parseFloat(totalProjectCost.toFixed(2)),
      frequency: frequency,
      notes: `Mezcla para ${input.numTrees} plantas/árboles en suelo ${input.soilType}. Precios en Pesos Colombianos (COP).`
    });
  }, [input]);

  const handleFetchAI = async () => {
    if (input.selectedProducts.length === 0) return;
    setLoading(true);
    const advice = await getAgriculturalAdvice(input);
    setAiAdvice(advice);
    setLoading(false);
  };

  const handleGetFormula = async () => {
    setLoadingFormula(true);
    const rec = await getPlantingFormula(input.treeType, input.soilType, input.numTrees);
    setFormulaRec(rec);
    setLoadingFormula(false);
  };

  const applyFormula = () => {
    if (!formulaRec) return;
    
    const selectedProducts: OrganicProduct[] = [];
    const manualAmounts: Record<string, number> = {};
    const selectedUnits: Record<string, UnitType> = { ...input.selectedUnits };

    formulaRec.items.forEach(item => {
      selectedProducts.push(item.product);
      manualAmounts[item.product] = item.suggestedAmount;
      selectedUnits[item.product] = item.unit;
    });

    setInput(prev => ({
      ...prev,
      selectedProducts,
      manualAmounts,
      selectedUnits,
      treeAge: 1, // Reset to planting age
      healthStatus: 'bueno'
    }));
    
    setFormulaRec(null); // Clear recommendation panel after applying
  };

  const generatePDF = () => {
    if (!result) return;
    const doc = new jsPDF();

    // Estilo de Cabecera
    doc.setFillColor(6, 78, 59); // Emerald 900
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('AgroCalculadora PRO CO', 15, 25);
    doc.setFontSize(10);
    doc.text('REPORTE TÉCNICO DE NUTRICIÓN REGENERATIVA', 15, 33);

    // Info del Lote
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('Información del Lote', 15, 55);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 57, 195, 57);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Cultivo: ${input.treeType}`, 15, 65);
    doc.text(`Suelo: ${input.soilType}`, 15, 72);
    doc.text(`Vigor General: ${input.healthStatus.toUpperCase()}`, 15, 79);

    doc.text(`Edad/Etapa: ${input.treeAge} años`, 105, 65);
    doc.text(`Nº de Plantas: ${input.numTrees}`, 105, 72);
    doc.setFont("helvetica", "bold");
    doc.text(`Frecuencia: ${result.frequency}`, 105, 79);

    // Tabla de Productos
    const tableData = result.products.map(p => [
      p.product,
      `${p.amount} ${p.unit}`,
      `$ ${p.costPerTree.toLocaleString('es-CO')}`,
      `$ ${p.totalCost.toLocaleString('es-CO')}`
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['Producto', 'Dosis / Planta', 'Costo / Planta', 'Subtotal Lote']],
      body: tableData,
      headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      foot: [['', 'TOTALES', `$ ${result.totalCostPerTree.toLocaleString('es-CO')}`, `$ ${result.totalProjectCost.toLocaleString('es-CO')}`]],
      footStyles: { fillColor: [240, 253, 244], textColor: [6, 78, 59], fontStyle: 'bold' },
      theme: 'striped'
    });

    // Consejos de IA
    if (aiAdvice) {
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text('Recomendación de Inteligencia Agrícola', 15, finalY);
      doc.line(15, finalY + 2, 195, finalY + 2);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      let yPos = finalY + 10;
      aiAdvice.tips.forEach((tip, i) => {
        const splitTip = doc.splitTextToSize(`${i + 1}. ${tip}`, 170);
        doc.text(splitTip, 15, yPos);
        yPos += (splitTip.length * 5) + 2;
      });

      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.text('Momento Ideal:', 15, yPos);
      doc.setFont("helvetica", "italic");
      const splitAdvice = doc.splitTextToSize(aiAdvice.seasonalAdvice, 170);
      doc.text(splitAdvice, 45, yPos);
      
      yPos += (splitAdvice.length * 5) + 5;
      doc.setFont("helvetica", "bold");
      doc.text(`Puntaje de Sostenibilidad: ${aiAdvice.sustainabilityScore}/10`, 15, yPos);
    }

    doc.save(`Reporte_Agro_${input.treeType}_${new Date().toLocaleDateString()}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleProduct = (product: OrganicProduct) => {
    setInput(prev => {
      const isSelected = prev.selectedProducts.includes(product);
      return {
        ...prev,
        selectedProducts: isSelected 
          ? prev.selectedProducts.filter(p => p !== product)
          : [...prev.selectedProducts, product]
      };
    });
  };

  const handlePriceChange = (product: OrganicProduct, price: number) => {
    setInput(prev => ({
      ...prev,
      productPrices: { ...prev.productPrices, [product]: price }
    }));
  };

  const handleManualAmountChange = (product: OrganicProduct, amount: number | undefined) => {
    setInput(prev => ({
      ...prev,
      manualAmounts: { ...prev.manualAmounts, [product]: amount }
    }));
  };

  const handleUnitChange = (product: OrganicProduct, unit: UnitType) => {
    setInput(prev => ({
      ...prev,
      selectedUnits: { ...prev.selectedUnits, [product]: unit }
    }));
  };

  useEffect(() => {
    calculateDose();
  }, [calculateDose]);

  const renderProductGroup = (title: string, products: OrganicProduct[], icon: string) => (
    <div className="mb-6">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
        <i className={`fas ${icon} text-emerald-500`}></i> {title}
      </h3>
      <div className="space-y-3">
        {products.map(product => {
          const isSelected = input.selectedProducts.includes(product);
          const currentUnit = input.selectedUnits[product];
          return (
            <div key={product} className={`p-4 rounded-2xl border transition-all ${isSelected ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-70 hover:opacity-100'}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleProduct(product)} className="w-5 h-5 accent-emerald-600 cursor-pointer" />
                  <span className={`text-sm font-bold ${isSelected ? 'text-emerald-900' : 'text-slate-600'}`}>{product}</span>
                </div>
                {isSelected && (
                  <select 
                    value={currentUnit} 
                    onChange={(e) => handleUnitChange(product, e.target.value as UnitType)}
                    className="text-[10px] font-bold bg-white border border-slate-200 text-emerald-700 px-2 py-1 rounded-md uppercase outline-none"
                  >
                    <option value="g">gramos</option>
                    <option value="kg">kilogramos</option>
                    <option value="cc">cc</option>
                    <option value="ml">ml</option>
                    <option value="L">litros</option>
                  </select>
                )}
              </div>
              {isSelected && (
                <div className="grid grid-cols-2 gap-3 pl-8 animate-in fade-in duration-300">
                  <div>
                    <label className="text-[9px] font-bold text-emerald-700 uppercase mb-1 block">Dosis ({currentUnit})</label>
                    <input type="number" placeholder="Auto" value={input.manualAmounts[product] ?? ''} onChange={e => handleManualAmountChange(product, e.target.value === '' ? undefined : parseFloat(e.target.value))} className="w-full p-2 rounded-lg bg-white border border-emerald-100 text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-emerald-700 uppercase mb-1 block">Precio ({currentUnit})</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-400 text-xs">$</span>
                      <input type="number" value={input.productPrices[product]} onChange={e => handlePriceChange(product, parseFloat(e.target.value) || 0)} className="w-full p-2 pl-5 rounded-lg bg-white border border-emerald-100 text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12 font-sans">
      <nav className="bg-emerald-900 text-white p-5 shadow-xl sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500 p-2 rounded-lg shadow-lg">
              <i className="fas fa-seedling text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter">AgroCalculadora <span className="text-emerald-400">CO</span></h1>
              <p className="text-[10px] text-emerald-400/60 uppercase font-bold tracking-widest">Precisión Colombiana</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-black bg-emerald-800 px-3 py-1 rounded-full border border-emerald-700">MODO: REGENERATIVO</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5 space-y-6 no-print">
          <div className="bg-white rounded-[2rem] shadow-sm p-8 border border-slate-200/60">
            <h2 className="text-lg font-black mb-6 text-slate-800 flex items-center gap-2">
              <i className="fas fa-map-marker-alt text-emerald-600"></i> Lote y Cultivo
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Tipo de Cultivo</label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {Object.values(TreeType).map((type) => (
                    <button
                      key={type}
                      onClick={() => setInput({ ...input, treeType: type })}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-xs font-bold ${
                        input.treeType === type 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-emerald-200'
                      }`}
                    >
                      {TREE_TYPE_ICONS[type]}
                      <span className="truncate">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Textura del Suelo</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(SoilType).map((soil) => (
                    <button
                      key={soil}
                      onClick={() => setInput({ ...input, soilType: soil })}
                      className={`flex items-center justify-center p-3 rounded-2xl border-2 transition-all text-xs font-bold ${
                        input.soilType === soil 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-emerald-200'
                      }`}
                    >
                      <i className={`fas fa-layer-group mr-2 ${input.soilType === soil ? 'text-emerald-600' : 'text-slate-300'}`}></i>
                      {soil}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Edad / Etapa</label>
                  <input type="number" min="1" value={input.treeAge} onChange={e => setInput({...input, treeAge: parseInt(e.target.value) || 1})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-black text-lg" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Cantidad Plantas</label>
                  <input type="number" min="1" value={input.numTrees} onChange={e => setInput({...input, numTrees: parseInt(e.target.value) || 1})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-black text-lg" />
                </div>
              </div>

              <button 
                onClick={handleGetFormula}
                disabled={loadingFormula}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-all uppercase tracking-widest text-[10px]"
              >
                {loadingFormula ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : <i className="fas fa-wand-magic-sparkles"></i>}
                {loadingFormula ? 'Calculando Insumos...' : `Obtener Fórmula para ${input.numTrees} Plantas`}
              </button>

              {formulaRec && (
                <div className="bg-slate-900 text-white p-6 rounded-[1.5rem] border border-emerald-500/30 animate-in slide-in-from-top duration-500">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                      Fórmula para {input.numTrees} {input.numTrees === 1 ? 'Planta' : 'Plantas'}
                    </h3>
                    <button onClick={() => setFormulaRec(null)} className="text-slate-500 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-4 italic leading-relaxed">"{formulaRec.explanation}"</p>
                  <div className="space-y-4 mb-6">
                    {formulaRec.items.map((item, idx) => (
                      <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[11px] font-bold text-emerald-100">{item.product}</span>
                          <div className="text-right">
                            <span className="text-[11px] font-black text-emerald-400 block">{item.totalAmount}{item.unit} (Total Lote)</span>
                            <span className="text-[9px] text-emerald-400/40 block">{item.suggestedAmount}{item.unit} / planta</span>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-500 leading-tight block mt-1">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={applyFormula}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors shadow-lg"
                  >
                    Cargar esta mezcla al presupuesto
                  </button>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Vigor General</label>
                <div className="flex bg-slate-100 rounded-2xl p-1.5">
                  {(['bueno', 'regular', 'deficiente'] as const).map(status => (
                    <button key={status} onClick={() => setInput({...input, healthStatus: status})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${input.healthStatus === status ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-400'}`}>{status}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-sm p-8 border border-slate-200/60">
            <h2 className="text-lg font-black mb-2 text-slate-800 flex items-center gap-2">
              <i className="fas fa-layer-group text-emerald-600"></i> Portafolio de Insumos
            </h2>
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-6 tracking-tight">Separados por estado físico</p>
            
            <div className="max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
              {renderProductGroup("Insumos Líquidos", PRODUCT_CATEGORIES.LIQUIDS, "fa-tint")}
              <div className="h-px bg-slate-100 my-8"></div>
              {renderProductGroup("Enmiendas Sólidas", PRODUCT_CATEGORIES.SOLIDS, "fa-mountain")}
            </div>

            <button onClick={handleFetchAI} disabled={loading || input.selectedProducts.length === 0} className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 transition-all uppercase tracking-widest text-xs">
              {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : <i className="fas fa-brain"></i>}
              {loading ? 'Analizando...' : 'Consultar Agrónomo IA'}
            </button>
          </div>
        </section>

        <section className="lg:col-span-7 space-y-6">
          {result && result.products.length > 0 ? (
            <div className="space-y-6">
              <div className="flex gap-4 no-print">
                <button 
                  onClick={generatePDF}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px]"
                >
                  <i className="fas fa-file-pdf text-lg"></i> Exportar PDF
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px]"
                >
                  <i className="fas fa-print text-lg"></i> Imprimir Reporte
                </button>
              </div>

              <div id="results-panel" className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-200/50 print:border-none print:shadow-none">
                <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 p-10 text-white flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-10 no-print">
                    <i className="fas fa-file-invoice-dollar text-9xl"></i>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-2 flex items-center gap-3">
                      Presupuesto Técnico
                    </h3>
                    <div className="flex flex-col gap-2">
                      <div className="bg-emerald-500/20 inline-block px-3 py-1 rounded-lg border border-emerald-500/30 w-fit">
                        <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest">Plan para {input.numTrees} plantas de {input.treeType}</p>
                      </div>
                      <div className="bg-white/10 inline-block px-3 py-1 rounded-lg border border-white/20 w-fit">
                        <p className="text-[10px] uppercase font-bold text-emerald-100 tracking-widest">Frecuencia: {result.frequency}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right relative z-10 flex flex-col items-end">
                    <p className="text-[10px] uppercase font-black text-emerald-400/60 block mb-1">Inversión Total (COP)</p>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-black tabular-nums">${result.totalProjectCost.toLocaleString('es-CO')}</span>
                      <button 
                        onClick={() => copyToClipboard(result.totalProjectCost.toString(), 'totalProject')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors no-print group relative"
                        title="Copiar valor"
                      >
                        <i className={`fas ${copiedKey === 'totalProject' ? 'fa-check text-emerald-400' : 'fa-copy text-white/50 group-hover:text-white'}`}></i>
                        {copiedKey === 'totalProject' && (
                          <span className="absolute -top-8 right-0 bg-emerald-500 text-white text-[9px] px-2 py-1 rounded font-bold whitespace-nowrap animate-bounce">¡Copiado!</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-10">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                          <th className="pb-6">Insumo Nutricional</th>
                          <th className="pb-6 text-center">Dosis</th>
                          <th className="pb-6 text-right">Vr. Planta</th>
                          <th className="pb-6 text-right">Subtotal</th>
                          <th className="pb-6 text-center no-print">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {result.products.map(item => (
                          <tr key={item.product} className="group hover:bg-slate-50/50 transition-all">
                            <td className="py-6">
                              <span className="text-sm font-black text-slate-800 block">{item.product}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                {PRODUCT_CATEGORIES.LIQUIDS.includes(item.product) ? 'Estado Líquido' : 'Estado Sólido'}
                              </span>
                            </td>
                            <td className="py-6 text-center">
                              <span className="text-lg font-black text-emerald-600 tabular-nums">{item.amount}</span>
                              <span className="text-[10px] ml-1.5 font-bold text-slate-400 uppercase">{item.unit}</span>
                            </td>
                            <td className="py-6 text-right">
                              <span className="text-sm font-bold text-slate-600 tabular-nums">${item.costPerTree.toLocaleString('es-CO')}</span>
                            </td>
                            <td className="py-6 text-right">
                              <span className="text-sm font-black text-emerald-900 tabular-nums">${item.totalCost.toLocaleString('es-CO')}</span>
                            </td>
                            <td className="py-6 text-center no-print">
                              <a 
                                href={`https://agromercado.example/comprar/${encodeURIComponent(item.product.toLowerCase().replace(/ /g, '-'))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2"
                              >
                                <i className="fas fa-shopping-cart"></i>
                                Comprar
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50/80">
                          <td colSpan={2} className="py-6 px-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Unitario por Planta</td>
                          <td className="py-6 text-right px-10" colSpan={3}>
                            <div className="flex items-center justify-end gap-3">
                              <span className="text-3xl font-black text-emerald-900 tabular-nums">${result.totalCostPerTree.toLocaleString('es-CO')}</span>
                              <span className="text-[10px] font-black text-emerald-600/60">COP</span>
                              <button 
                                onClick={() => copyToClipboard(result.totalCostPerTree.toString(), 'unitCost')}
                                className="p-2 hover:bg-emerald-100 rounded-lg transition-colors no-print group relative"
                                title="Copiar valor"
                              >
                                <i className={`fas ${copiedKey === 'unitCost' ? 'fa-check text-emerald-600' : 'fa-copy text-slate-300 group-hover:text-emerald-500'}`}></i>
                                {copiedKey === 'unitCost' && (
                                  <span className="absolute -top-8 right-0 bg-emerald-600 text-white text-[9px] px-2 py-1 rounded font-bold whitespace-nowrap animate-bounce">¡Copiado!</span>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] p-24 text-center border-2 border-dashed border-slate-200 flex flex-col items-center justify-center space-y-6 no-print">
              <div className="bg-slate-50 h-32 w-32 rounded-full flex items-center justify-center shadow-inner">
                <i className="fas fa-calculator text-5xl text-slate-200"></i>
              </div>
              <div className="max-w-xs">
                <h3 className="text-slate-400 font-black text-xl mb-3">Calculadora Lista</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">Selecciona tus insumos orgánicos y configura los precios en Pesos Colombianos para iniciar el plan.</p>
              </div>
            </div>
          )}

          {aiAdvice && (
            <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl p-12 text-white animate-in zoom-in duration-700 relative overflow-hidden border border-white/5 print:bg-white print:text-slate-900 print:shadow-none print:border-slate-200">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-emerald-500/10 rounded-full blur-[100px] no-print"></div>
              
              <div className="flex items-center justify-between mb-12 relative z-10">
                <div>
                  <h3 className="text-3xl font-black flex items-center gap-4">
                    <i className="fas fa-microscope text-emerald-400"></i> Inteligencia Agrícola
                  </h3>
                  <p className="text-emerald-400/40 text-xs font-bold uppercase tracking-[0.2em] mt-2 print:text-slate-400">Recomendación Regenerativa</p>
                </div>
                <div className="bg-white/5 px-6 py-3 rounded-3xl border border-white/10 text-center backdrop-blur-xl print:bg-slate-100 print:border-slate-200">
                  <span className="text-[10px] uppercase font-black text-white/30 block mb-1 print:text-slate-400">Eco-Sinergia</span>
                  <span className="text-3xl font-black text-emerald-400">{aiAdvice.sustainabilityScore}<span className="text-sm text-white/20 print:text-slate-300">/10</span></span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                <div className="space-y-6">
                  <h4 className="text-[10px] uppercase font-black tracking-[0.3em] text-emerald-400 border-b border-emerald-400/20 pb-4 print:text-emerald-700 print:border-emerald-100">Protocolo de Aplicación</h4>
                  {aiAdvice.tips.map((tip, idx) => (
                    <div key={idx} className="flex gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all group print:bg-slate-50 print:border-slate-100">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 flex-shrink-0 group-hover:scale-110 transition-transform print:bg-emerald-100">
                        <span className="text-emerald-400 font-black text-sm print:text-emerald-700">{idx+1}</span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed font-medium print:text-slate-700">{tip}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-8">
                  <div className="p-8 bg-emerald-500/10 rounded-[2.5rem] border border-emerald-500/20 backdrop-blur-md print:bg-slate-50 print:border-slate-100">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-emerald-400 mb-5 flex items-center gap-3 print:text-emerald-700">
                      <i className="fas fa-clock"></i> Momento Sugerido
                    </h4>
                    <p className="text-base italic text-emerald-50 leading-relaxed font-light print:text-slate-600">"{aiAdvice.seasonalAdvice}"</p>
                  </div>
                  <div className="p-8 bg-blue-500/10 rounded-[2.5rem] border border-blue-500/20 flex items-center gap-6 no-print">
                    <div className="bg-blue-400/20 p-4 rounded-2xl">
                      <i className="fas fa-info-circle text-blue-400 text-2xl"></i>
                    </div>
                    <p className="text-xs text-blue-100/60 font-bold leading-relaxed uppercase tracking-wider">Asegura la calidad del agua antes de mezclar insumos líquidos como el jabón potásico y EM.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 mt-20 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.4em] pb-10 no-print">
        <p>© 2024 AgroCalculadora PRO - Optimización Orgánica Colombiana</p>
        <div className="flex justify-center gap-8 mt-6 opacity-20">
          <i className="fas fa-leaf text-2xl"></i>
          <i className="fas fa-water text-2xl"></i>
          <i className="fas fa-sun text-2xl"></i>
        </div>
      </footer>
    </div>
  );
};

export default App;
