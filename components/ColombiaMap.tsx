
import React, { useState } from 'react';
import { Department } from '../types.ts';
import { COLOMBIAN_REGIONS } from '../constants.tsx';

interface ColombiaMapProps {
  selectedDepartment: Department;
  onSelect: (dept: Department) => void;
}

const ColombiaMap: React.FC<ColombiaMapProps> = ({ selectedDepartment, onSelect }) => {
  const [hoveredDept, setHoveredDept] = useState<Department | null>(null);

  // Simplified SVG paths for Colombian Departments (Approximated for visual representation)
  // In a real app, these would be precise GeoJSON-derived paths.
  const departments = [
    { id: Department.AMAZONAS, name: 'Amazonas', path: 'M 180,350 L 220,350 L 240,380 L 200,400 L 160,380 Z' },
    { id: Department.ANTIOQUIA, name: 'Antioquia', path: 'M 80,120 L 100,120 L 110,150 L 90,170 L 70,150 Z' },
    { id: Department.ARAUCA, name: 'Arauca', path: 'M 160,130 L 190,130 L 190,150 L 160,150 Z' },
    { id: Department.ATLANTICO, name: 'Atlántico', path: 'M 85,40 L 95,40 L 95,50 L 85,50 Z' },
    { id: Department.BOLIVAR, name: 'Bolívar', path: 'M 90,60 L 110,60 L 100,100 L 80,100 Z' },
    { id: Department.BOYACA, name: 'Boyacá', path: 'M 120,150 L 140,140 L 150,160 L 130,180 Z' },
    { id: Department.CALDAS, name: 'Caldas', path: 'M 95,175 L 105,175 L 105,185 L 95,185 Z' },
    { id: Department.CAQUETA, name: 'Caquetá', path: 'M 120,280 L 160,280 L 180,320 L 130,340 Z' },
    { id: Department.CASANARE, name: 'Casanare', path: 'M 150,160 L 180,160 L 190,200 L 160,210 Z' },
    { id: Department.CAUCA, name: 'Cauca', path: 'M 60,230 L 80,230 L 90,260 L 70,270 Z' },
    { id: Department.CESAR, name: 'Cesar', path: 'M 110,50 L 130,50 L 120,90 L 105,90 Z' },
    { id: Department.CHOCO, name: 'Chocó', path: 'M 50,100 L 70,100 L 80,180 L 60,180 Z' },
    { id: Department.CORDOBA, name: 'Córdoba', path: 'M 75,70 L 90,70 L 85,100 L 70,100 Z' },
    { id: Department.CUNDINAMARCA, name: 'Cundinamarca', path: 'M 110,180 L 130,180 L 130,210 L 110,210 Z' },
    { id: Department.GUAINIA, name: 'Guainía', path: 'M 220,200 L 260,200 L 260,250 L 220,250 Z' },
    { id: Department.GUAVIARE, name: 'Guaviare', path: 'M 170,230 L 210,230 L 220,270 L 180,280 Z' },
    { id: Department.HUILA, name: 'Huila', path: 'M 95,230 L 115,230 L 115,270 L 95,270 Z' },
    { id: Department.GUAJIRA, name: 'La Guajira', path: 'M 120,10 L 150,10 L 140,50 L 110,40 Z' },
    { id: Department.MAGDALENA, name: 'Magdalena', path: 'M 100,40 L 120,40 L 115,80 L 95,80 Z' },
    { id: Department.META, name: 'Meta', path: 'M 130,210 L 180,210 L 170,260 L 120,260 Z' },
    { id: Department.NARINO, name: 'Nariño', path: 'M 40,270 L 70,270 L 80,300 L 50,310 Z' },
    { id: Department.NORTE_SANTANDER, name: 'Norte de Santander', path: 'M 130,100 L 150,100 L 150,130 L 130,130 Z' },
    { id: Department.PUTUMAYO, name: 'Putumayo', path: 'M 80,300 L 120,300 L 130,330 L 90,340 Z' },
    { id: Department.QUINDIO, name: 'Quindío', path: 'M 90,195 L 100,195 L 100,205 L 90,205 Z' },
    { id: Department.RISARALDA, name: 'Risaralda', path: 'M 85,185 L 95,185 L 95,195 L 85,195 Z' },
    { id: Department.SAN_ANDRES, name: 'San Andrés', path: 'M 20,20 L 30,20 L 30,30 L 20,30 Z' },
    { id: Department.SANTANDER, name: 'Santander', path: 'M 115,110 L 140,110 L 140,140 L 115,140 Z' },
    { id: Department.SUCRE, name: 'Sucre', path: 'M 85,65 L 95,65 L 95,85 L 85,85 Z' },
    { id: Department.TOLIMA, name: 'Tolima', path: 'M 100,190 L 120,190 L 115,230 L 95,230 Z' },
    { id: Department.VALLE_CAUCA, name: 'Valle del Cauca', path: 'M 70,190 L 90,190 L 90,230 L 60,230 Z' },
    { id: Department.VAUPES, name: 'Vaupés', path: 'M 210,260 L 250,260 L 250,320 L 210,320 Z' },
    { id: Department.VICHADA, name: 'Vichada', path: 'M 190,140 L 250,140 L 250,200 L 190,200 Z' },
    { id: Department.BOGOTA, name: 'Bogotá D.C.', path: 'M 122,195 L 128,195 L 128,201 L 122,201 Z' },
  ];

  const getRegionColor = (dept: Department) => {
    const region = COLOMBIAN_REGIONS.find(r => r.departments.includes(dept));
    if (!region) return '#cbd5e1'; // slate-300
    
    switch (region.name) {
      case 'Región Andina': return '#10b981'; // emerald-500
      case 'Región Caribe': return '#f59e0b'; // amber-500
      case 'Región Pacífica': return '#3b82f6'; // blue-500
      case 'Región Orinoquía': return '#ef4444'; // red-500
      case 'Región Amazonía': return '#8b5cf6'; // violet-500
      case 'Región Insular': return '#ec4899'; // pink-500
      default: return '#cbd5e1';
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-full max-w-[400px] aspect-[4/5] bg-slate-50 rounded-3xl border border-slate-200 shadow-inner p-4">
        <svg
          viewBox="0 0 300 420"
          className="w-full h-full drop-shadow-md"
          style={{ cursor: 'pointer' }}
        >
          {departments.map((dept) => {
            const isSelected = selectedDepartment === dept.id;
            const isHovered = hoveredDept === dept.id;
            const color = getRegionColor(dept.id);

            return (
              <path
                key={dept.id}
                d={dept.path}
                fill={isSelected ? color : (isHovered ? `${color}cc` : `${color}66`)}
                stroke={isSelected ? '#000' : '#fff'}
                strokeWidth={isSelected ? 2 : 1}
                onMouseEnter={() => setHoveredDept(dept.id)}
                onMouseLeave={() => setHoveredDept(null)}
                onClick={() => onSelect(dept.id)}
                className="transition-all duration-200"
              />
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1">
          {COLOMBIAN_REGIONS.map(region => (
            <div key={region.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getRegionColor(region.departments[0]) }}></div>
              <span className="text-[8px] font-black uppercase text-slate-500">{region.name}</span>
            </div>
          ))}
        </div>

        {/* Hover Info */}
        {hoveredDept && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
            <p className="text-[10px] font-black uppercase text-emerald-800">{hoveredDept}</p>
            <p className="text-[8px] font-bold text-slate-500 uppercase">
              {COLOMBIAN_REGIONS.find(r => r.departments.includes(hoveredDept))?.name}
            </p>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Departamento Seleccionado</p>
        <p className="text-xl font-black text-emerald-900 uppercase tracking-tighter">{selectedDepartment}</p>
      </div>
    </div>
  );
};

export default ColombiaMap;
