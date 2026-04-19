
import React, { useState, useEffect, useCallback } from 'react';
import { TreeType, SoilType, OrganicProduct, CalculationInput, CalculationResult, AIAdvice, ProductResult, UnitType, GrassMeasureMode, GrassVariety, ClimateType, VisionReport, ApplicationMode, Department, ClientData, HistoryRecord, SoilAnalysisProfile, ActivityType, ActivityRecord, CustomProduct, EntomologyReport } from './types.ts';
import { BASE_RATES, PRODUCT_UNITS, COLOMBIAN_MARKET_PRICES, TREE_TYPE_ICONS, PRODUCT_DETAILS, COMPATIBILITY_RULES, CompatibilityRule } from './constants.tsx';
import { getAgriculturalAdvice, getIndependentVisionDiagnosis, suggestProductMix, getInsectIdentification } from './services/geminiService.ts';
import ColombiaMap from './components/ColombiaMap.tsx';
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
  const [activeTab, setActiveTab] = useState<'calculator' | 'grass' | 'vision' | 'entomology' | 'activities' | 'history'>('calculator');
  const [insectImage, setInsectImage] = useState<string | null>(null);
  const [insectReport, setInsectReport] = useState<EntomologyReport | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMix, setLoadingMix] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [visionReport, setVisionReport] = useState<VisionReport | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [newActivity, setNewActivity] = useState<Partial<ActivityRecord>>({
    type: ActivityType.OTHER,
    status: 'Pendiente',
    priority: 'Media',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSuggestMix = async () => {
    setLoadingMix(true);
    try {
      const suggested = await suggestProductMix(input);
      if (suggested && suggested.length > 0) {
        setInput(prev => ({ ...prev, selectedProducts: suggested }));
      }
    } catch (error) {
      console.error("Error al sugerir mezcla:", error);
    } finally {
      setLoadingMix(false);
    }
  };
  
  const [additionalPercent, setAdditionalPercent] = useState<number>(0);
  const [showSoilProfile, setShowSoilProfile] = useState(false);

  const [clientData, setClientData] = useState<ClientData>({
    firstName: '', lastName: '', location: '', contact: '', email: '', projectName: ''
  });

  const [input, setInput] = useState<CalculationInput>({
    treeType: TreeType.CITRUS, department: Department.ANTIOQUIA, applicationMode: ApplicationMode.MAINTENANCE,
    soilType: SoilType.FRANCO, 
    soilPercentages: { sand: 40, silt: 40, clay: 20 },
    soilProfile: { ph: 6.5, organicMatter: 3, ec: 1.2 },
    climate: ClimateType.MODERATE, treeAge: 1, numTrees: 1, 
    grassVariety: GrassVariety.KIKUYO, grassMode: GrassMeasureMode.AREA,
    selectedProducts: [OrganicProduct.COMPOST_TERRABONO, OrganicProduct.LIQUID_HUMUS],
    customProducts: [],
    selectedCustomProductIds: [],
    productPrices: { ...COLOMBIAN_MARKET_PRICES }, manualPlantAmounts: {}, selectedUnits: {},
    cycleFrequencyValue: 3, cycleFrequencyUnit: 'meses', healthStatus: 'bueno',
    manualAmounts: {},
    manualTotalAmounts: {},
    manualUnitPrices: {},
    manualUnits: {}
  });

  const [customProductForm, setCustomProductForm] = useState<Partial<CustomProduct>>({
    defaultUnit: 'kg',
    defaultPrice: 0
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('biogenesis_history');
    if (saved) setHistory(JSON.parse(saved));
    const savedActivities = localStorage.getItem('biogenesis_activities');
    if (savedActivities) setActivities(JSON.parse(savedActivities));
    const savedCustomProducts = localStorage.getItem('biogenesis_custom_products');
    if (savedCustomProducts) {
      const parsed = JSON.parse(savedCustomProducts);
      setInput(prev => ({ ...prev, customProducts: parsed }));
    }
  }, []);

  const addCustomProduct = () => {
    if (!customProductForm.name) {
      alert("El nombre del insumo es obligatorio");
      return;
    }
    const newProduct: CustomProduct = {
      id: `custom_${Date.now()}`,
      name: customProductForm.name,
      url: customProductForm.url,
      technicalData: customProductForm.technicalData,
      defaultUnit: customProductForm.defaultUnit || 'kg',
      defaultPrice: customProductForm.defaultPrice || 0
    };
    
    setInput(prev => {
      const updatedProducts = [...prev.customProducts, newProduct];
      localStorage.setItem('biogenesis_custom_products', JSON.stringify(updatedProducts));
      return {
        ...prev,
        customProducts: updatedProducts,
        selectedCustomProductIds: [...prev.selectedCustomProductIds, newProduct.id]
      };
    });

    setCustomProductForm({ defaultUnit: 'kg', defaultPrice: 0 });
    (document.getElementById('custom_product_modal') as any).close();
  };

  const removeCustomProduct = (id: string) => {
    setInput(prev => {
      const updatedProducts = prev.customProducts.filter(p => p.id !== id);
      localStorage.setItem('biogenesis_custom_products', JSON.stringify(updatedProducts));
      return {
        ...prev,
        customProducts: updatedProducts,
        selectedCustomProductIds: prev.selectedCustomProductIds.filter(pid => pid !== id)
      };
    });
  };

  const saveActivity = () => {
    if (!newActivity.description || !newActivity.projectName) {
      alert('Por favor complete el proyecto y la descripción.');
      return;
    }
    const activity: ActivityRecord = {
      id: Date.now().toString(),
      date: newActivity.date || new Date().toISOString().split('T')[0],
      projectName: newActivity.projectName,
      type: newActivity.type as ActivityType,
      description: newActivity.description,
      responsible: newActivity.responsible || 'Propietario',
      status: newActivity.status as any,
      priority: newActivity.priority as any
    };
    const updated = [activity, ...activities];
    setActivities(updated);
    localStorage.setItem('biogenesis_activities', JSON.stringify(updated));
    setNewActivity({
      type: ActivityType.OTHER,
      status: 'Pendiente',
      priority: 'Media',
      date: new Date().toISOString().split('T')[0],
      projectName: newActivity.projectName // Keep project name for convenience
    });
  };

  const deleteActivity = (id: string) => {
    const updated = activities.filter(a => a.id !== id);
    setActivities(updated);
    localStorage.setItem('biogenesis_activities', JSON.stringify(updated));
  };

  const handleSoilProfileChange = (field: keyof SoilAnalysisProfile, value: number) => {
    setInput(prev => ({
      ...prev,
      soilProfile: { ...prev.soilProfile!, [field]: value }
    }));
  };

  const calculateProductRow = useCallback((p: string, isCustom = false) => {
    const quantityBase = input.numTrees || 1;
    let totalAmount: number;
    
    if (input.manualTotalAmounts[p] !== undefined) {
      totalAmount = input.manualTotalAmounts[p] as number;
    } else {
      let dosePerUnit: number;
      if (input.manualPlantAmounts[p] !== undefined) {
        dosePerUnit = input.manualPlantAmounts[p] as number;
      } else {
        if (isCustom) {
          dosePerUnit = 0;
        } else {
          const base = BASE_RATES[p as OrganicProduct] || 0;
          const healthMultiplier = input.healthStatus === 'deficiente' ? 1.3 : (input.healthStatus === 'regular' ? 1.15 : 1);
          const factor = activeTab === 'grass' ? 1 : Math.min(2.5, 1 + (input.treeAge - 1) * 0.1);
          dosePerUnit = base * healthMultiplier * factor;
        }
      }
      totalAmount = dosePerUnit * quantityBase;
    }

    let price = input.manualUnitPrices[p] !== undefined ? (input.manualUnitPrices[p] as number) : (input.productPrices[p] || 0);
    if (isCustom && input.manualUnitPrices[p] === undefined) {
       const custom = input.customProducts.find(cp => cp.id === p);
       if (custom) price = custom.defaultPrice;
    }

    const subtotal = totalAmount * price;
    let unit = input.manualUnits[p] || (isCustom ? '' : PRODUCT_UNITS[p as OrganicProduct]) || 'u';
    if (isCustom && !input.manualUnits[p]) {
       const custom = input.customProducts.find(cp => cp.id === p);
       if (custom) unit = custom.defaultUnit;
    }

    let productName = p;
    if (isCustom) {
      const custom = input.customProducts.find(cp => cp.id === p);
      if (custom) productName = custom.name;
    }

    return {
      product: productName,
      amount: parseFloat(totalAmount.toFixed(2)),
      unit: unit as UnitType,
      costPerUnit: price,
      totalCost: Math.round(subtotal)
    };
  }, [input, activeTab]);

  const updateResults = useCallback(() => {
    const products = input.selectedProducts.map(p => calculateProductRow(p, false));
    const customProds = input.selectedCustomProductIds.map(id => calculateProductRow(id, true));
    const allProducts = [...products, ...customProds];
    
    const subtotalProject = allProducts.reduce((acc, curr) => acc + curr.totalCost, 0);

    setResult({ 
      products: allProducts, 
      totalCostPerUnit: subtotalProject / (input.numTrees || 1), 
      totalProjectCost: subtotalProject, 
      frequency: `Cada ${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}` 
    });
  }, [input.selectedProducts, input.selectedCustomProductIds, calculateProductRow, input.numTrees, input.cycleFrequencyValue, input.cycleFrequencyUnit]);

  useEffect(() => { updateResults(); }, [updateResults]);

  const additionalValue = (result?.totalProjectCost || 0) * (additionalPercent / 100);
  const grandTotal = (result?.totalProjectCost || 0) + additionalValue;
  const grandTotalPerPlant = grandTotal / (input.numTrees || 1);

  const getUnitLabel = () => {
    if (activeTab === 'grass') {
      return input.grassMode === GrassMeasureMode.AREA ? 'm2' : 'm Lineal';
    }
    return 'Planta';
  };

  const getQuantityLabel = () => {
    if (activeTab === 'grass') {
      return input.grassMode === GrassMeasureMode.AREA ? 'Área Total (m2)' : 'Longitud Total (m)';
    }
    return 'Población (Árboles)';
  };

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
    alert('Reporte guardado exitosamente.');
  };

  const handleExportPDF = (onlyAI: boolean = false) => {
    if (!result) return;
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [6, 78, 59];
    const secondaryColor: [number, number, number] = [16, 185, 129];
    const numTrees = input.numTrees || 1;
    const unitLabel = getUnitLabel();

    const drawHeader = (title: string) => {
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 50, 'F');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 14, 25);
      doc.setFontSize(9);
      doc.text('Ingeniería de Precisión y Plan de Manejo Bio-Orgánico', 14, 33);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 14, 38);
      doc.text(`UBICACIÓN: ${clientData.location.toUpperCase() || 'GENERAL'}`, 14, 43);
    };

    if (!onlyAI) {
      drawHeader(clientData.projectName?.toUpperCase() || 'BIOGENESIS PRO - INFORME');
      autoTable(doc, {
        startY: 65,
        head: [['Parámetro', 'Valor']],
        body: [
          ['Propietario', `${clientData.firstName} ${clientData.lastName}`],
          ['Proyecto', clientData.projectName || 'Sin nombre'],
          ['Cultivo', activeTab === 'grass' ? `Césped - ${input.grassVariety}` : input.treeType],
          [`Cant. ${unitLabel}s`, numTrees.toString()],
          ['Costo Total Proyecto', `$${Math.round(grandTotal).toLocaleString()} COP`]
        ],
        theme: 'striped',
        headStyles: { fillColor: primaryColor }
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Insumo', 'Unidad', 'Total Cant', 'Costo Unit', 'Subtotal']],
        body: result.products.map(p => [p.product, p.unit, p.amount, `$${p.costPerUnit}`, `$${p.totalCost}`]),
        theme: 'grid',
        headStyles: { fillColor: primaryColor }
      });
    }

    if (aiAdvice) {
      if (!onlyAI) doc.addPage();
      else drawHeader('PLAN NUTRICIONAL IA');
      
      doc.setTextColor(0,0,0);
      doc.setFontSize(14);
      let pageY = onlyAI ? 65 : 20;
      doc.text('Plan de Fertilización Sugerido:', 14, pageY);
      
      autoTable(doc, {
        startY: pageY + 5,
        head: [['Ítem', 'Dosis', 'Propósito']],
        body: [...aiAdvice.radicularPlan, ...aiAdvice.foliarPlan].map(p => [p.item, p.dosage, p.purpose]),
        theme: 'striped',
        headStyles: { fillColor: secondaryColor }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      const addSection = (title: string, content: string) => {
        const lines = doc.splitTextToSize(content, 180);
        const sectionHeight = 7 + (lines.length * 4.5) + 10;

        if (currentY + sectionHeight > 280) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(title, 14, currentY);
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(lines, 14, currentY + 7);
        currentY += sectionHeight;
      };

      addSection('COMPATIBILIDAD DE MEZCLAS TÉCNICAS:', aiAdvice.mixCompatibility || 'No disponible');
      addSection('OBSERVACIONES TÉCNICAS DE MANEJO:', aiAdvice.technicalObservations || 'No disponible');
      addSection('REQUERIMIENTO HÍDRICO:', `${aiAdvice.waterRequirement.volume} - Frecuencia: ${aiAdvice.waterRequirement.frequency}. Técnica: ${aiAdvice.waterRequirement.technique}`);
      addSection('IMPACTO ORGÁNICO A LARGO PLAZO:', aiAdvice.longTermImpact || 'No disponible');
      addSection('CONSEJOS ESTACIONALES:', aiAdvice.seasonalAdvice);
      addSection('ANÁLISIS DE SUELO:', aiAdvice.soilAnalysis);
      addSection('TIPS DE BIO-SEGURIDAD:', aiAdvice.tips.join(' • '));
    }

    doc.save(`${clientData.projectName || 'Reporte'}_BioGenesis.pdf`);
  };

  const handleExportVisionPDF = () => {
    if (!visionReport || !visionImage) {
      alert("No hay datos de visión para exportar.");
      return;
    }
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [6, 78, 59];
    const secondaryColor: [number, number, number] = [16, 185, 129];
    const projectName = clientData.projectName || 'Investigación Bio-Vision';

    // Página 1: Diagnóstico y Registro
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(projectName.toUpperCase(), 14, 25);
    doc.setFontSize(10);
    doc.text('INFORME TÉCNICO DE BIO-VISION IA', 14, 34);
    doc.text(`Cliente: ${clientData.firstName} ${clientData.lastName} | Fecha: ${new Date().toLocaleDateString()}`, 14, 40);

    let currentY = 65;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('1. REGISTRO FOTOGRÁFICO Y FISIOLOGÍA', 14, currentY);
    
    currentY += 10;
    try {
      doc.addImage(visionImage, 'JPEG', 14, currentY, 80, 80);
    } catch (e) {
      doc.rect(14, currentY, 80, 80);
      doc.text("Muestra Visual", 35, currentY + 40);
    }

    const rightColX = 100;
    let rightY = currentY;
    
    doc.setFontSize(11);
    doc.text('A. VIGOR GENERAL:', rightColX, rightY);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const splitVigor = doc.splitTextToSize(visionReport.plantReading || "N/A", 95);
    doc.text(splitVigor, rightColX, rightY + 7);
    
    rightY += 12 + (splitVigor.length * 4.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(11);
    doc.text('B. ESTADO METABÓLICO:', rightColX, rightY);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const splitMeta = doc.splitTextToSize(visionReport.metabolicState || "N/A", 95);
    doc.text(splitMeta, rightColX, rightY + 7);

    // Ajustamos currentY basado en la columna más larga (imagen o texto derecha)
    const textRightEndHeight = rightY + 7 + (splitMeta.length * 4.5);
    currentY = Math.max(currentY + 85, textRightEndHeight + 10);

    if (currentY > 260) { doc.addPage(); currentY = 20; }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.text('C. CORRELACIÓN INTEGRAL DE LABORATORIO:', 14, currentY);
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    const splitLab = doc.splitTextToSize(visionReport.laboratoryCorrelation || "N/A", 180);
    doc.text(splitLab, 14, currentY + 7);
    
    currentY += 15 + (splitLab.length * 4.5);

    if (currentY > 230) { doc.addPage(); currentY = 20; }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('2. ANÁLISIS PATOLÓGICO DETALLADO', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Categoría', 'Resultado del Análisis']],
      body: [
        ['Identificación de Plaga/Estado', visionReport.pestAnalysis.identifiedPest],
        ['Nombre Científico', visionReport.pestAnalysis.scientificName || 'N/A'],
        ['Nivel de Severidad', visionReport.pestAnalysis.severity.toUpperCase()],
        ['Ciclo de Vida / Etapa', visionReport.pestAnalysis.lifeCycleInfo || 'N/A'],
        ['Sintomatología Detectada', visionReport.pestAnalysis.symptoms]
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      bodyStyles: { fontSize: 8 }
    });

    // Página 2: Protocolo de Remedio
    doc.addPage();
    currentY = 20;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('PROTOCOLO DE CONTROL Y REMEDIO', 14, 13);

    currentY = 35;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('A. INSUMOS Y FORMULACIÓN RECOMENDADA:', 14, currentY);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Ingredientes y Cantidades Sugeridas']],
      body: visionReport.biologicalRemedy.ingredients.map(i => [i]),
      theme: 'striped',
      headStyles: { fillColor: secondaryColor },
      margin: { top: 20 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > 260) { doc.addPage(); currentY = 20; }
    
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.text('B. PREPARACIÓN PASO A PASO:', 14, currentY);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const splitPrep = doc.splitTextToSize(visionReport.biologicalRemedy.preparation, 180);
    doc.text(splitPrep, 14, currentY + 7);

    currentY += 12 + (splitPrep.length * 4.5);
    if (currentY > 260) { doc.addPage(); currentY = 20; }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.text('C. MODO DE APLICACIÓN TÉCNICA:', 14, currentY);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const splitApp = doc.splitTextToSize(visionReport.biologicalRemedy.application, 180);
    doc.text(splitApp, 14, currentY + 7);

    currentY += 15 + (splitApp.length * 4.5);
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('3. RECOMENDACIONES DE MANEJO INTEGRADO', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Acción Recomendada']],
      body: visionReport.recommendations.map(r => [r]),
      theme: 'striped',
      headStyles: { fillColor: primaryColor }
    });

    doc.save(`${projectName.replace(/\s+/g, '_')}_Informe_IA.pdf`);
  };

  const handleExportInsectPDF = () => {
    if (!insectReport || !insectImage) {
      alert("No hay datos de plagas para exportar.");
      return;
    }
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [180, 83, 9]; 
    const secondaryColor: [number, number, number] = [217, 119, 6]; 
    const projectName = clientData.projectName || 'Identificación Entomológica';

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(projectName.toUpperCase(), 14, 25);
    doc.setFontSize(10);
    doc.text('INFORME TÉCNICO DE ENTOMOLOGÍA IA - MIP', 14, 34);
    doc.text(`Cliente: ${clientData.firstName} ${clientData.lastName} | Fecha: ${new Date().toLocaleDateString()}`, 14, 40);

    let currentY = 65;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('1. REGISTRO FOTOGRÁFICO Y TAXONOMÍA', 14, currentY);
    
    currentY += 10;
    try {
      doc.addImage(insectImage, 'JPEG', 14, currentY, 80, 80);
    } catch (e) {
      doc.rect(14, currentY, 80, 80);
      doc.text("Muestra Insecto", 35, currentY + 40);
    }

    const rightColX = 100;
    let rightY = currentY;
    
    doc.setFontSize(11);
    doc.text('A. DESCRIPCIÓN DEL EJEMPLAR:', rightColX, rightY);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const splitDesc = doc.splitTextToSize(insectReport.insectDescription || "N/A", 95);
    doc.text(splitDesc, rightColX, rightY + 7);
    
    rightY += 12 + (splitDesc.length * 4.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(11);
    doc.text('B. MECANISMO DE DAÑO:', rightColX, rightY);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const splitDamage = doc.splitTextToSize(insectReport.damageMechanism || "N/A", 95);
    doc.text(splitDamage, rightColX, rightY + 7);

    currentY = Math.max(currentY + 85, rightY + 15);

    if (currentY > 260) { doc.addPage(); currentY = 20; }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('2. CLASIFICACIÓN TAXONÓMICA', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Categoría', 'Detalle']],
      body: [
        ['Nombre Común', insectReport.taxonomy.commonName],
        ['Nombre Científico', insectReport.taxonomy.scientificName],
        ['Orden', insectReport.taxonomy.order || 'N/A'],
        ['Familia', insectReport.taxonomy.family || 'N/A'],
        ['Nivel de Amenaza', insectReport.threatLevel.toUpperCase()],
        ['Ciclo de Vida', insectReport.lifeCycle]
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      bodyStyles: { fontSize: 8 }
    });

    doc.addPage();
    currentY = 20;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('MANEJO INTEGRADO DE PLAGAS (MIP)', 14, 13);

    currentY = 35;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('A. CONTROL BIOLÓGICO Y BIO-PLAGUICIDAS:', 14, currentY);
    doc.setFontSize(10);
    doc.text(`Agente Principal: ${insectReport.biologicalControl.agent}`, 14, currentY + 8);
    
    autoTable(doc, {
      startY: currentY + 12,
      head: [['Ingredientes / Insumos']],
      body: insectReport.biologicalControl.ingredients.map(i => [i]),
      theme: 'striped',
      headStyles: { fillColor: secondaryColor }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text('B. PREPARACIÓN Y APLICACIÓN:', 14, currentY);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const splitPrep = doc.splitTextToSize(insectReport.biologicalControl.preparation, 180);
    doc.text(splitPrep, 14, currentY + 7);

    currentY += 12 + (splitPrep.length * 4.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('C. ESTRATEGIA PREVENTIVA:', 14, currentY);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const splitMgmt = doc.splitTextToSize(insectReport.integratedManagement.join('. '), 180);
    doc.text(splitMgmt, 14, currentY + 7);

    doc.save(`${projectName.replace(/\s+/g, '_')}_Entomologia_IA.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      <header className="bg-[#064e3b] p-6 sticky top-0 z-50 shadow-xl no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <BioGenesisLogo />
          <nav className="flex bg-white/10 p-1 rounded-2xl backdrop-blur-md max-w-full overflow-x-auto custom-scrollbar">
            {[
              { id: 'calculator', label: 'CULTIVOS', icon: 'fa-seedling' },
              { id: 'grass', label: 'CÉSPED', icon: 'fa-grass' },
              { id: 'vision', label: 'VISION IA', icon: 'fa-eye' },
              { id: 'entomology', label: 'PLAGAS', icon: 'fa-bug' },
              { id: 'activities', label: 'BITÁCORA', icon: 'fa-clipboard-list' },
              { id: 'history', label: 'HISTORIAL', icon: 'fa-history' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'grass') {
                    setInput(prev => ({ ...prev, treeType: TreeType.GRASS }));
                  } else if (tab.id === 'calculator' && input.treeType === TreeType.GRASS) {
                    setInput(prev => ({ ...prev, treeType: TreeType.CITRUS }));
                  }
                }} 
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-[#064e3b] shadow-lg' : 'text-white/70 hover:text-white'}`}
              >
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
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Información General</h3>
                <div className="space-y-3">
                  <input type="text" placeholder="Nombre de la Investigación / Proyecto" value={clientData.projectName} onChange={e => setClientData({...clientData, projectName: e.target.value})} className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-black text-emerald-900 outline-none mb-2" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Nombre" value={clientData.firstName} onChange={e => setClientData({...clientData, firstName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black shadow-none outline-none" />
                    <input type="text" placeholder="Apellido" value={clientData.lastName} onChange={e => setClientData({...clientData, lastName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black shadow-none outline-none" />
                  </div>
                  <input type="text" placeholder="Ubicación" value={clientData.location} onChange={e => setClientData({...clientData, location: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-black shadow-none outline-none" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Configuración de {activeTab === 'grass' ? 'Césped' : 'Cultivo'}</h3>
                <div className="space-y-4">
                  <div className="relative">
                    <button 
                      onClick={() => setShowMap(true)}
                      className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-black text-emerald-900 flex items-center justify-between group hover:bg-emerald-100 transition-all"
                    >
                      <div className="flex flex-col items-start">
                        <span className="text-[8px] opacity-60">DEPARTAMENTO</span>
                        <span>{input.department}</span>
                      </div>
                      <i className="fas fa-map-location-dot text-emerald-600 group-hover:scale-110 transition-all"></i>
                    </button>
                  </div>
                  
                  {activeTab === 'grass' ? (
                    <>
                      <select value={input.grassVariety} onChange={e => setInput({...input, grassVariety: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black outline-none">
                        {Object.values(GrassVariety).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                          onClick={() => setInput({...input, grassMode: GrassMeasureMode.AREA})} 
                          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${input.grassMode === GrassMeasureMode.AREA ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}
                        >
                          Área (m2)
                        </button>
                        <button 
                          onClick={() => setInput({...input, grassMode: GrassMeasureMode.LINEAR})} 
                          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${input.grassMode === GrassMeasureMode.LINEAR ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}
                        >
                          Lineal (m)
                        </button>
                      </div>
                    </>
                  ) : (
                    <select value={input.treeType} onChange={e => setInput({...input, treeType: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black outline-none">
                      {Object.values(TreeType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  
                  <input 
                    type="number" 
                    placeholder={getQuantityLabel()} 
                    value={input.numTrees} 
                    onChange={e => setInput({...input, numTrees: parseInt(e.target.value) || 1})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-black outline-none" 
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex justify-between items-center">
                  <span>Gestión e Insumos</span>
                  <button 
                    onClick={handleSuggestMix}
                    disabled={loadingMix}
                    className="text-[9px] bg-emerald-600 text-white px-3 py-1 rounded-full hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    {loadingMix ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-brain"></i>}
                    Mezcla Inteligente
                  </button>
                </h3>
                <input type="number" placeholder="Gestión %" value={additionalPercent} onChange={e => setAdditionalPercent(parseFloat(e.target.value) || 0)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-emerald-700 outline-none mb-4" />
                <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar mb-4">
                  <div className="flex justify-between items-center px-1 mb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Catálogo Base</span>
                  </div>
                  {Object.values(OrganicProduct).map(p => {
                    const isSelected = input.selectedProducts.includes(p);
                    return (
                      <div key={p} className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all duration-300 ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => setInput(prev => ({ 
                              ...prev, 
                              selectedProducts: prev.selectedProducts.includes(p) ? prev.selectedProducts.filter(x => x !== p) : [...prev.selectedProducts, p] 
                            }))} 
                            className="accent-emerald-600 h-4 w-4" 
                          />
                          <span className="text-[10px] font-black uppercase text-black flex-1">{p}</span>
                        </label>
                        
                        {isSelected && (
                          <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-1 animate-in fade-in slide-in-from-top-1">
                            <div className="col-span-2 flex flex-col gap-1">
                              <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Dosis (x {activeTab === 'grass' ? 'm2' : 'Planta'})</label>
                              <div className="flex bg-white rounded-lg border border-emerald-100 overflow-hidden">
                                <input 
                                  type="number" 
                                  value={input.manualPlantAmounts[p] ?? calculateProductRow(p, false).amount / (input.numTrees || 1)} 
                                  onChange={e => setInput(prev => ({ ...prev, manualPlantAmounts: { ...prev.manualPlantAmounts, [p]: parseFloat(e.target.value) || 0 } }))}
                                  className="flex-1 p-1.5 text-[10px] font-black text-emerald-900 outline-none"
                                />
                                <span className="bg-emerald-100 px-2 flex items-center text-[8px] font-black text-emerald-700">{(input.manualUnits[p] || PRODUCT_UNITS[p] || 'u').toUpperCase()}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Precio Unit $</label>
                              <input 
                                type="number" 
                                value={input.manualUnitPrices[p] ?? input.productPrices[p]} 
                                onChange={e => setInput(prev => ({ ...prev, manualUnitPrices: { ...prev.manualUnitPrices, [p]: parseFloat(e.target.value) || 0 } }))}
                                className="p-1.5 bg-white border border-emerald-100 rounded-lg text-[10px] font-black text-emerald-900 outline-none"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Medida</label>
                              <select 
                                value={input.manualUnits[p] || PRODUCT_UNITS[p] || 'u'}
                                onChange={e => setInput(prev => ({ ...prev, manualUnits: { ...prev.manualUnits, [p]: e.target.value as any } }))}
                                className="p-1.5 bg-white border border-emerald-100 rounded-lg text-[10px] font-black text-emerald-900 outline-none appearance-none"
                              >
                                {['ml','cc','lt','gl','gr','kg','un'].map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(input.customProducts && input.customProducts.length > 0) && (
                    <div className="mt-6 space-y-2">
                       <div className="flex justify-between items-center px-1 mb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Insumos Personalizados</span>
                      </div>
                      {input.customProducts.map(p => {
                         const isSelected = input.selectedCustomProductIds.includes(p.id);
                         return (
                          <div key={p.id} className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all duration-300 ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => setInput(prev => ({ 
                                  ...prev, 
                                  selectedCustomProductIds: isSelected ? prev.selectedCustomProductIds.filter(id => id !== p.id) : [...prev.selectedCustomProductIds, p.id]
                                }))} 
                                className="accent-emerald-600 h-4 w-4" 
                              />
                              <span className="text-[10px] font-black uppercase text-black flex-1">{p.name}</span>
                              <button onClick={() => removeCustomProduct(p.id)} className="text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-trash text-[8px]"></i></button>
                            </div>

                            {isSelected && (
                              <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-1 animate-in fade-in slide-in-from-top-1">
                                <div className="col-span-2 flex flex-col gap-1">
                                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Dosis Recomendada (Manual)</label>
                                  <div className="flex bg-white rounded-lg border border-emerald-100 overflow-hidden">
                                    <input 
                                      type="number" 
                                      value={input.manualPlantAmounts[p.id] || 0} 
                                      onChange={e => setInput(prev => ({ ...prev, manualPlantAmounts: { ...prev.manualPlantAmounts, [p.id]: parseFloat(e.target.value) || 0 } }))}
                                      className="flex-1 p-1.5 text-[10px] font-black text-emerald-900 outline-none"
                                      placeholder="Definir dosis"
                                    />
                                    <span className="bg-emerald-100 px-2 flex items-center text-[8px] font-black text-emerald-700">{(input.manualUnits[p.id] || p.defaultUnit).toUpperCase()}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Precio Unit $</label>
                                  <input 
                                    type="number" 
                                    value={input.manualUnitPrices[p.id] ?? p.defaultPrice} 
                                    onChange={e => setInput(prev => ({ ...prev, manualUnitPrices: { ...prev.manualUnitPrices, [p.id]: parseFloat(e.target.value) || 0 } }))}
                                    className="p-1.5 bg-white border border-emerald-100 rounded-lg text-[10px] font-black text-emerald-900 outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Unidad</label>
                                  <select 
                                    value={input.manualUnits[p.id] || p.defaultUnit}
                                    onChange={e => setInput(prev => ({ ...prev, manualUnits: { ...prev.manualUnits, [p.id]: e.target.value as any } }))}
                                    className="p-1.5 bg-white border border-emerald-100 rounded-lg text-[10px] font-black text-emerald-900 outline-none appearance-none"
                                  >
                                    {['ml','cc','lt','gl','gr','kg','un'].map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                                  </select>
                                </div>
                                {p.url && (
                                  <div className="col-span-2">
                                     <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[7px] font-black text-blue-500 uppercase flex items-center gap-1 hover:underline">
                                       <i className="fas fa-link italic"></i> Ver Ficha Técnica
                                     </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                         );
                      })}
                    </div>
                  )}

                  <button 
                    onClick={() => (document.getElementById('custom_product_modal') as any).showModal()}
                    className="w-full py-3 mt-4 border-2 border-dashed border-slate-200 rounded-2xl text-[9px] font-black text-slate-400 uppercase hover:border-emerald-300 hover:text-emerald-500 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-plus"></i> Añadir Nuevo Insumo
                  </button>
                </div>

                {/* Compatibility Alerts */}
                {(() => {
                  const conflicts: { p1: OrganicProduct, p2: OrganicProduct, rule: CompatibilityRule }[] = [];
                  const selected = input.selectedProducts;
                  for (let i = 0; i < selected.length; i++) {
                    for (let j = i + 1; j < selected.length; j++) {
                      const p1 = selected[i];
                      const p2 = selected[j];
                      const rule1 = COMPATIBILITY_RULES[p1]?.[p2];
                      const rule2 = COMPATIBILITY_RULES[p2]?.[p1];
                      if (rule1 && rule1.status !== 'compatible') conflicts.push({ p1, p2, rule: rule1 });
                      else if (rule2 && rule2.status !== 'compatible') conflicts.push({ p1: p2, p2: p1, rule: rule2 });
                    }
                  }

                  if (conflicts.length > 0) {
                    return (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2">
                          <i className="fas fa-triangle-exclamation text-amber-500 text-xs"></i>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Alertas de Mezcla</span>
                        </div>
                        {conflicts.map((c, i) => (
                          <div key={i} className={`p-3 rounded-xl border flex flex-col gap-1 ${c.rule.status === 'incompatible' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] font-black uppercase text-slate-900">{c.p1} + {c.p2}</span>
                              <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${c.rule.status === 'incompatible' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                                {c.rule.status === 'incompatible' ? 'Prohibido' : 'Precaución'}
                              </span>
                            </div>
                            <p className="text-[8px] font-bold text-slate-600 leading-tight">{c.rule.reason}</p>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 min-h-[500px] flex flex-col">
                <div className="flex justify-between items-center mb-8 pb-4 border-b">
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-black">Cálculo de Inversión</h2>
                  <div className="flex gap-2">
                    <button onClick={saveReportToHistory} className="bg-blue-600 text-white p-3 rounded-xl shadow-md"><i className="fas fa-save"></i></button>
                    <button onClick={() => handleExportPDF(false)} className="bg-[#064e3b] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg flex items-center gap-2">
                      <i className="fas fa-file-pdf"></i> PDF Maestro
                    </button>
                  </div>
                </div>

                {result && result.products.length > 0 ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-600 p-6 rounded-[2rem] text-white">
                        <p className="text-[10px] font-black uppercase opacity-80 mb-1">Inversión/{getUnitLabel()}</p>
                        <h4 className="text-3xl font-black tracking-tighter">${Math.round(grandTotalPerPlant).toLocaleString()}</h4>
                      </div>
                      <div className="bg-slate-800 p-6 rounded-[2rem] text-white">
                        <p className="text-[10px] font-black uppercase opacity-80 mb-1">Total Proyecto</p>
                        <h4 className="text-3xl font-black tracking-tighter">${Math.round(grandTotal).toLocaleString()}</h4>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[2rem] border">
                      <table className="w-full text-left text-[11px] text-black">
                        <thead className="bg-slate-100 font-black uppercase">
                          <tr>
                            <th className="p-4">Insumo</th>
                            <th className="p-4 text-center">Cantidad</th>
                            <th className="p-4 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {result.products.map((p, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-4 uppercase font-bold text-black">{p.product}</td>
                              <td className="p-4 text-center font-bold">{p.amount} {p.unit}</td>
                              <td className="p-4 text-right font-black text-emerald-800">${p.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#064e3b] text-white font-black">
                          <tr>
                            <td colSpan={2} className="p-4 text-right uppercase text-[9px]">Gran Inversión Final</td>
                            <td className="p-4 text-right text-lg text-emerald-400">${Math.round(grandTotal).toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="bg-emerald-50 p-6 rounded-[2rem] border-2 border-dashed border-emerald-200">
                       <h4 className="font-black text-[#064e3b] uppercase mb-4 flex items-center gap-2"><i className="fas fa-wand-magic-sparkles"></i> Plan Maestro IA</h4>
                       {!aiAdvice ? (
                         <button onClick={async () => { setLoading(true); const advice = await getAgriculturalAdvice(input); setAiAdvice(advice); setLoading(false); }} disabled={loading} className="w-full bg-white text-emerald-900 p-6 rounded-2xl font-black uppercase shadow-sm">
                           {loading ? 'Consultando IA...' : 'Generar Plan de Nutrición IA'}
                         </button>
                       ) : (
                         <div className="space-y-4">
                           <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100">
                                <h5 className="text-[9px] font-black text-emerald-800 uppercase border-b mb-2 pb-1">Radicular</h5>
                                {aiAdvice.radicularPlan.map((s, i) => <div key={i} className="text-[10px] mb-1 font-bold"><span className="text-emerald-700">{s.item}:</span> {s.dosage}</div>)}
                              </div>
                              <div className="bg-white p-4 rounded-xl shadow-sm border border-teal-100">
                                <h5 className="text-[9px] font-black text-teal-800 uppercase border-b mb-2 pb-1">Foliar</h5>
                                {aiAdvice.foliarPlan.map((s, i) => <div key={i} className="text-[10px] mb-1 font-bold"><span className="text-teal-700">{s.item}:</span> {s.dosage}</div>)}
                              </div>
                           </div>
                           
                           <div className="space-y-3">
                             {aiAdvice.mixCompatibility && (
                               <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100">
                                 <h5 className="text-[9px] font-black text-amber-800 uppercase border-b mb-2 pb-1 flex items-center gap-2">
                                   <i className="fas fa-vial"></i> Compatibilidad de Mezcla (IA)
                                 </h5>
                                 <p className="text-[10px] font-bold text-slate-700 leading-relaxed italic">{aiAdvice.mixCompatibility}</p>
                               </div>
                             )}
                             {aiAdvice.technicalObservations && (
                               <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
                                 <h5 className="text-[9px] font-black text-blue-800 uppercase border-b mb-2 pb-1 flex items-center gap-2">
                                   <i className="fas fa-clipboard-list"></i> Observaciones Técnicas
                                 </h5>
                                 <p className="text-[10px] font-bold text-slate-700 leading-relaxed">{aiAdvice.technicalObservations}</p>
                               </div>
                             )}
                             {aiAdvice.longTermImpact && (
                               <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100">
                                 <h5 className="text-[9px] font-black text-indigo-800 uppercase border-b mb-2 pb-1 flex items-center gap-2">
                                   <i className="fas fa-chart-line"></i> Impacto a Largo Plazo
                                 </h5>
                                 <p className="text-[10px] font-bold text-slate-700 leading-relaxed">{aiAdvice.longTermImpact}</p>
                               </div>
                             )}
                           </div>

                           <button onClick={() => handleExportPDF(true)} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-md transition-all hover:bg-emerald-700">Exportar Plan IA Detallado a PDF</button>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-slate-400 py-20 uppercase font-black">
                    <i className="fas fa-calculator text-6xl mb-4"></i>
                    <span>Configure datos para iniciar</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Entomología IA Tab */}
        {activeTab === 'entomology' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter text-black flex items-center gap-4">
                  <i className="fas fa-bug text-amber-600 animate-pulse"></i> Entomología IA
                </h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-1 pl-12">Escáner de Insectos y Plagas Pro</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400">Estado Scanner:</span>
                  <div className={`h-2 w-2 rounded-full ${insectReport ? 'bg-amber-500' : 'bg-slate-300'} animate-pulse`}></div>
                </div>
              </div>
            </div>

            {!insectReport ? (
              <div className="bg-white p-14 rounded-[4rem] shadow-2xl text-center border border-slate-100 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-50 rounded-full blur-3xl opacity-50"></div>
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-black">Identificador de Plagas</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">Manejo Integrado de Plagas (MIP)</p>
                
                <div className="border-4 border-dashed border-amber-100 p-12 rounded-[3rem] bg-amber-50/30 mb-10 group transition-all hover:bg-amber-50 relative z-10">
                  {insectImage ? (
                    <div className="relative inline-block">
                      <img src={insectImage} className="mx-auto rounded-3xl max-h-[400px] border-8 border-white shadow-2xl" />
                      <button onClick={() => setInsectImage(null)} className="absolute -top-4 -right-4 bg-red-500 text-white w-10 h-10 rounded-full shadow-lg hover:scale-110 transition-all">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-10">
                      <div className="w-24 h-24 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-xl hover:scale-110 transition-all ring-8 ring-amber-100">
                        <i className="fas fa-camera text-4xl"></i>
                      </div>
                      <p className="font-black uppercase text-sm text-amber-800 tracking-widest mb-2">Escanear Insecto o Daño</p>
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const r = new FileReader();
                          r.onloadend = () => setInsectImage(r.result as string);
                          r.readAsDataURL(f);
                        }
                      }} />
                    </label>
                  )}
                </div>

                {insectImage && (
                  <button 
                    onClick={async () => { 
                      setLoading(true); 
                      const r = await getInsectIdentification(insectImage, input.treeType); 
                      if(r) setInsectReport(r);
                      setLoading(false); 
                    }} 
                    disabled={loading}
                    className="px-16 py-5 bg-amber-600 text-white rounded-3xl font-black uppercase shadow-2xl hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? <i className="fas fa-spinner fa-spin mr-3"></i> : <i className="fas fa-magnifying-glass mr-3"></i>}
                    {loading ? 'Consultando Entomólogo IA...' : 'Identificar Plaga'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <img src={insectImage!} className="w-full rounded-2xl shadow-inner border-4 border-slate-50" />
                    <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <p className="text-[10px] font-black text-amber-800 uppercase mb-1">Análisis Morfológico</p>
                      <p className="text-xs font-bold text-amber-900 italic">"{insectReport.insectDescription}"</p>
                    </div>
                  </div>
                  
                  <button onClick={() => { setInsectReport(null); setInsectImage(null); }} className="w-full py-5 bg-white text-slate-500 border border-slate-200 rounded-[2rem] font-black uppercase text-[10px] shadow-sm flex items-center justify-center gap-2">
                    <i className="fas fa-redo"></i> Escanear Otro Insecto
                  </button>

                  <button onClick={handleExportInsectPDF} className="w-full py-5 bg-amber-700 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-3 hover:bg-amber-800 transition-all ring-4 ring-amber-50">
                    <i className="fas fa-file-export"></i> Informe Entomológico Final
                  </button>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">Diagnóstico Entomológico</p>
                        <h3 className="text-3xl font-black text-black uppercase tracking-tighter">{insectReport.taxonomy.commonName}</h3>
                        <p className="text-lg font-bold text-slate-500 italic">{insectReport.taxonomy.scientificName} ({insectReport.taxonomy.order})</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-white shadow-lg ${insectReport.threatLevel.toLowerCase().includes('crítico') || insectReport.threatLevel.toLowerCase().includes('alto') ? 'bg-red-500' : 'bg-amber-500'}`}>
                          Nivel de Amenaza: {insectReport.threatLevel}
                        </span>
                        <button onClick={handleExportInsectPDF} className="bg-amber-100 text-amber-900 px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-amber-200 transition-all border border-amber-200">
                          <i className="fas fa-file-pdf"></i> Exportar Registro
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Ciclo de Vida / Etología</p>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed">{insectReport.lifeCycle}</p>
                      </div>
                      <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                        <p className="text-[10px] font-black text-amber-800 uppercase mb-2">Mecanismo de Daño</p>
                        <p className="text-xs font-bold text-amber-900 leading-relaxed italic">{insectReport.damageMechanism}</p>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
                      <h4 className="text-xl font-black uppercase flex items-center gap-3 mb-6">
                        <i className="fas fa-shield-halved text-amber-400"></i> Control Bio-Racional (MIP)
                      </h4>
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-3">Agente Recomendado: {insectReport.biologicalControl.agent}</p>
                          <div className="flex flex-wrap gap-2 text-xs font-bold">
                            {insectReport.biologicalControl.ingredients.map((ing, i) => (
                              <span key={i} className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 uppercase tracking-tighter">
                                <i className="fas fa-flask text-amber-400 mr-2"></i>{ing}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-[9px] font-black text-amber-200 uppercase mb-1">Protocolo de Aplicación</p>
                            <p className="text-xs opacity-90 leading-relaxed font-semibold">{insectReport.biologicalControl.application}</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-[9px] font-black text-amber-200 uppercase mb-1">Manejo Integrado</p>
                            <div className="text-[10px] opacity-90 leading-relaxed space-y-1">
                              {insectReport.integratedManagement.map((m, i) => <div key={i}>• {m}</div>)}
                            </div>
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

        {activeTab === 'vision' && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in zoom-in duration-300">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-2 block">Nombre de la Investigación / Muestra</label>
                <input 
                  type="text" 
                  placeholder="Ej: Análisis Finca La Esperanza - Lote 4" 
                  value={clientData.projectName} 
                  onChange={e => setClientData({...clientData, projectName: e.target.value})} 
                  className="w-full p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-sm font-black text-emerald-900 outline-none focus:border-emerald-300 transition-all"
                />
              </div>
              <div className="flex flex-col items-center md:items-end opacity-50">
                <p className="text-[9px] font-black uppercase text-slate-400">Estado de Identificación</p>
                <div className="flex gap-1 mt-1">
                  <div className={`h-2 w-2 rounded-full ${visionReport ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <div className={`h-2 w-2 rounded-full ${visionReport ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <div className={`h-2 w-2 rounded-full ${visionReport ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                </div>
              </div>
            </div>

            {!visionReport ? (
              <div className="bg-white p-14 rounded-[4rem] shadow-2xl text-center border border-slate-100">
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-black">Bio-Vision IA</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">Diagnóstico Patológico Automático</p>
                
                <div className="border-4 border-dashed border-emerald-100 p-12 rounded-[3rem] bg-emerald-50/30 mb-10 group transition-all hover:bg-emerald-50">
                  {visionImage ? (
                    <div className="relative inline-block">
                      <img src={visionImage} className="mx-auto rounded-3xl max-h-[400px] border-8 border-white shadow-2xl" />
                      <button onClick={() => setVisionImage(null)} className="absolute -top-4 -right-4 bg-red-500 text-white w-10 h-10 rounded-full shadow-lg hover:scale-110 transition-all">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-10">
                      <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-xl hover:scale-110 transition-all">
                        <i className="fas fa-camera text-4xl"></i>
                      </div>
                      <p className="font-black uppercase text-sm text-emerald-800 tracking-widest mb-2">Capturar o Subir Muestra</p>
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => {
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
                  <button 
                    onClick={async () => { 
                      setLoading(true); 
                      const r = await getIndependentVisionDiagnosis(visionImage, input.treeType); 
                      if(r) setVisionReport(r);
                      setLoading(false); 
                    }} 
                    disabled={loading}
                    className="px-16 py-5 bg-[#064e3b] text-white rounded-3xl font-black uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? <i className="fas fa-spinner fa-spin mr-3"></i> : <i className="fas fa-microscope mr-3"></i>}
                    {loading ? 'Procesando Muestra...' : 'Iniciar Análisis IA'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <img src={visionImage!} className="w-full rounded-2xl shadow-inner border-4 border-slate-50" />
                    <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-800 uppercase mb-1">Lectura de Vigor</p>
                      <p className="text-xs font-bold text-emerald-900 italic">"{visionReport.plantReading}"</p>
                    </div>
                  </div>
                  
                  <button onClick={handleExportVisionPDF} className="w-full py-5 bg-[#064e3b] text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-3 hover:bg-emerald-900 transition-all ring-4 ring-emerald-50">
                    <i className="fas fa-file-pdf"></i> Informe PDF Completo
                  </button>
                  
                  <button onClick={() => { setVisionReport(null); setVisionImage(null); }} className="w-full py-5 bg-white text-slate-500 border border-slate-200 rounded-[2rem] font-black uppercase text-[10px] shadow-sm">
                    Analizar Otra Muestra
                  </button>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Análisis Técnico</p>
                        <h3 className="text-3xl font-black text-black uppercase tracking-tighter">Resultados de Muestra</h3>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-white shadow-lg ${visionReport.pestAnalysis.severity.toLowerCase().includes('crítica') ? 'bg-red-500' : 'bg-emerald-500'}`}>
                        Severidad: {visionReport.pestAnalysis.severity}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 mb-6">
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Identificación</p>
                        <p className="text-xl font-black text-emerald-900">{visionReport.pestAnalysis.identifiedPest}</p>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Científico</p>
                        <p className="text-xl font-bold text-slate-600 italic">{visionReport.pestAnalysis.scientificName || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                      <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-800 uppercase mb-2 flex items-center gap-2"><i className="fas fa-microchip"></i> Estado Metabólico (Fisiología)</p>
                        <p className="text-xs font-bold text-blue-900 leading-relaxed italic">"{visionReport.metabolicState}"</p>
                      </div>
                      <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                        <p className="text-[10px] font-black text-amber-800 uppercase mb-2 flex items-center gap-2"><i className="fas fa-flask"></i> Correlación Laboratorio</p>
                        <p className="text-xs font-bold text-amber-900 leading-relaxed tracking-tight">"{visionReport.laboratoryCorrelation}"</p>
                      </div>
                    </div>

                    <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-800 uppercase mb-2">Cuadro Clínico (Sintomatología)</p>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">{visionReport.pestAnalysis.symptoms}</p>
                    </div>
                  </div>

                  <div className="bg-[#064e3b] p-10 rounded-[3rem] shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <i className="fas fa-mortar-pestle text-[120px]"></i>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <i className="fas fa-mortar-pestle text-emerald-400"></i> Protocolo Bio-Remedio
                    </h3>
                    <div className="grid md:grid-cols-2 gap-10">
                      <div>
                        <p className="text-[10px] font-black text-emerald-200 uppercase mb-4 tracking-widest">Insumos Críticos</p>
                        <ul className="space-y-2">
                          {visionReport.biologicalRemedy.ingredients.map((ing, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm font-bold">
                              <i className="fas fa-check-circle text-emerald-400 text-[10px]"></i> {ing}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">Hoja de Ruta</p>
                        <div className="space-y-3">
                           <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                             <p className="text-[9px] font-black text-emerald-300 uppercase mb-1">Preparación</p>
                             <p className="text-xs font-semibold leading-relaxed opacity-90">{visionReport.biologicalRemedy.preparation}</p>
                           </div>
                           <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                             <p className="text-[9px] font-black text-emerald-300 uppercase mb-1">Aplicación</p>
                             <p className="text-xs font-semibold leading-relaxed opacity-90">{visionReport.biologicalRemedy.application}</p>
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

        {activeTab === 'activities' && (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4 text-black">
                <i className="fas fa-clipboard-list text-emerald-600"></i> Registro de Actividades
              </h2>
              <button 
                onClick={() => {
                  const modal = document.getElementById('activity_modal') as any;
                  if (modal) modal.showModal();
                }}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <i className="fas fa-plus"></i> Nueva Actividad
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase border-4 border-dashed rounded-[3rem]">No hay actividades registradas</div>
              ) : (
                activities.map(activity => (
                  <div key={activity.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative group overflow-hidden">
                    <div className={`absolute top-0 right-0 w-2 h-full ${activity.priority === 'Alta' ? 'bg-red-500' : (activity.priority === 'Media' ? 'bg-amber-500' : 'bg-emerald-500')}`} />
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase">{activity.date}</span>
                      <button onClick={() => deleteActivity(activity.id)} className="text-slate-200 hover:text-red-500 transition-all"><i className="fas fa-trash"></i></button>
                    </div>
                    <div className="mb-4">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter mb-1">{activity.projectName}</p>
                      <h4 className="text-lg font-black text-black leading-tight uppercase tracking-tighter">{activity.type}</h4>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed mb-6 border-l-4 border-slate-100 pl-4 py-1 italic">"{activity.description}"</p>
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Responsable</span>
                        <span className="text-[10px] font-bold text-black">{activity.responsible}</span>
                      </div>
                      <span className="text-[9px] font-black px-3 py-1 bg-white border border-slate-200 rounded-full uppercase">{activity.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4 text-black">
              <i className="fas fa-history text-emerald-600"></i> Historial de Reportes
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase border-4 border-dashed rounded-[3rem]">No hay investigaciones guardadas</div>
              ) : (
                history.map(record => (
                  <div key={record.id} className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-100 hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">ID: {record.consecutive}</span>
                      <span className="text-[9px] font-bold text-slate-400">{record.date.split(',')[0]}</span>
                    </div>
                    <h3 className="font-black text-emerald-900 uppercase text-xs mb-1 truncate">{record.client.projectName || 'Sin título'}</h3>
                    <h4 className="font-bold text-slate-600 uppercase text-[10px] mb-4">{record.client.firstName} {record.client.lastName}</h4>
                    <div className="flex gap-2">
                      <button onClick={() => { setInput(record.input as any); setResult(record.result); setClientData(record.client); setAiAdvice(record.aiAdvice || null); setActiveTab('calculator'); }} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-200">Cargar</button>
                      <button onClick={() => { setHistory(history.filter(h => h.id !== record.id)); localStorage.setItem('biogenesis_history', JSON.stringify(history.filter(h => h.id !== record.id))); }} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Global Modals */}
        <dialog id="activity_modal" className="modal p-0 rounded-[2.5rem] shadow-2xl backdrop:backdrop-blur-md">
          <div className="bg-white p-8 w-full max-w-md">
            <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
              <i className="fas fa-pen-nib text-emerald-600"></i> Registrar Acción
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Proyecto / Finca</label>
                <input type="text" value={newActivity.projectName || ''} onChange={e => setNewActivity({...newActivity, projectName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="Nombre del proyecto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Fecha</label>
                  <input type="date" value={newActivity.date} onChange={e => setNewActivity({...newActivity, date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Prioridad</label>
                  <select value={newActivity.priority} onChange={e => setNewActivity({...newActivity, priority: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Tipo de Actividad</label>
                <select value={newActivity.type} onChange={e => setNewActivity({...newActivity, type: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                  {Object.values(ActivityType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Responsable</label>
                <input type="text" value={newActivity.responsible || ''} onChange={e => setNewActivity({...newActivity, responsible: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="Nombre completo" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Descripción</label>
                <textarea value={newActivity.description || ''} onChange={e => setNewActivity({...newActivity, description: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold min-h-[100px]" placeholder="¿Qué se realizó?" />
              </div>
              <div className="flex gap-3 pt-4">
                <form method="dialog" className="flex-1">
                  <button className="w-full py-4 text-slate-400 font-black uppercase text-xs">Cancelar</button>
                </form>
                <button 
                  onClick={() => {
                    saveActivity();
                    (document.getElementById('activity_modal') as any).close();
                  }}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg"
                >
                  Guardar Log
                </button>
              </div>
            </div>
          </div>
        </dialog>

        <dialog id="custom_product_modal" className="modal p-0 rounded-[2.5rem] shadow-2xl backdrop:backdrop-blur-md">
          <div className="bg-white p-8 w-full max-w-md">
            <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
              <i className="fas fa-flask text-emerald-600"></i> Nuevo Insumo Personalizado
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Nombre del Producto</label>
                <input type="text" value={customProductForm.name || ''} onChange={e => setCustomProductForm({...customProductForm, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="Eje: Bio-NPK Avanzado" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">URL / Link de Referencia (Para IA)</label>
                <input type="url" value={customProductForm.url || ''} onChange={e => setCustomProductForm({...customProductForm, url: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="https://ejemplo.com/ficha-tecnica" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Unidad Base</label>
                  <select value={customProductForm.defaultUnit} onChange={e => setCustomProductForm({...customProductForm, defaultUnit: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                    {['ml','cc','lt','gl','gr','kg','un'].map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Precio Base</label>
                  <input type="number" value={customProductForm.defaultPrice} onChange={e => setCustomProductForm({...customProductForm, defaultPrice: parseFloat(e.target.value) || 0})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Ficha Técnica / Notas (Para IA)</label>
                <textarea value={customProductForm.technicalData || ''} onChange={e => setCustomProductForm({...customProductForm, technicalData: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold min-h-[100px]" placeholder="Composición química, modo de acción, etc..." />
              </div>
              <div className="flex gap-3 pt-4">
                <form method="dialog" className="flex-1">
                  <button className="w-full py-4 text-slate-400 font-black uppercase text-xs">Cancelar</button>
                </form>
                <button 
                  onClick={addCustomProduct}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg"
                >
                  Añadir Insumo
                </button>
              </div>
            </div>
          </div>
        </dialog>

        {/* Colombia Map Modal */}
        {showMap && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-black">Mapa Agrícola de Colombia</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seleccione su departamento visualmente</p>
                </div>
                <button onClick={() => setShowMap(false)} className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm hover:bg-slate-50 transition-all">
                  <i className="fas fa-times text-slate-400"></i>
                </button>
              </div>
              <div className="p-8">
                <ColombiaMap 
                  selectedDepartment={input.department} 
                  onSelect={(dept) => {
                    setInput({ ...input, department: dept });
                    setShowMap(false);
                  }} 
                />
              </div>
              <div className="p-6 bg-emerald-50 border-t border-emerald-100 text-center">
                <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">
                  <i className="fas fa-info-circle mr-2"></i> La selección ajustará automáticamente los parámetros climáticos regionales
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
