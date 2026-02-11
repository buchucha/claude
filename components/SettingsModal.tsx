
import React, { useState, useEffect, useMemo } from 'react';
import { ClinicSettings, Veterinarian, ServiceCatalogItem, ServiceCategory } from '../types';
import { supabase } from '../services/supabaseClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vets: Veterinarian[];
  clinicSettings: ClinicSettings;
  onUpdateClinicSettings: (settings: ClinicSettings) => void;
  onAddVet: (vet: Partial<Veterinarian> & { email: string }) => Promise<void>;
  onRemoveVet: (id: string) => Promise<void>;
}

const ALL_CATEGORIES: ServiceCategory[] = [
  'CONSULTATION', 'IMAGING', 'LABORATORY', 'PROCEDURE', 
  'PHARMACY', 'PREVENTION', 'FOOD', 'SUPPLIES', 'HOSPITALIZATION'
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  vets, 
  clinicSettings,
  onUpdateClinicSettings,
  onAddVet, 
  onRemoveVet 
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'catalog'>('general');

  // General Settings State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [isSubmittingVet, setIsSubmittingVet] = useState(false);

  // Catalog Settings State
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [catalogFilter, setCatalogFilter] = useState<ServiceCategory>('CONSULTATION');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '', sku: '' });
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'catalog') {
      fetchCatalog();
    }
  }, [isOpen, activeTab]);

  const fetchCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      if (data) setCatalogItems(data);
    } catch (err: any) {
      console.error("Failed to fetch catalog:", err.message);
    }
  };

  const handleAddVet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingVet) return;
    
    if (!newName.trim()) { alert('성함을 입력해주세요.'); return; }
    if (!newEmail.trim() || !newEmail.includes('@')) { alert('올바른 구글 이메일을 입력해주세요.'); return; }
    if (!newSpecialty.trim()) { alert('전공(또는 직함)을 입력해주세요.'); return; }

    if (vets.some(v => v.email?.toLowerCase() === newEmail.trim().toLowerCase())) {
      alert('이미 등록된 이메일입니다.');
      return;
    }

    setIsSubmittingVet(true);
    try {
      await onAddVet({ 
        email: newEmail.trim().toLowerCase(), 
        name: newName.trim(),
        specialty: newSpecialty.trim(),
        avatar: `https://i.pravatar.cc/150?u=${newName}_${Date.now()}`
      });
      setNewEmail('');
      setNewName('');
      setNewSpecialty('');
    } finally {
      setIsSubmittingVet(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.price) return;
    setIsAddingItem(true);
    
    try {
      const finalSku = newItem.sku.trim().toUpperCase();
      const { error } = await supabase.from('service_catalog').insert([{
        category: catalogFilter,
        name: newItem.name,
        default_price: parseFloat(newItem.price),
        sku_code: finalSku || null,
        is_active: true
      }]);

      if (error) {
        if (error.code === '23505') throw new Error('이미 존재하는 코드(SKU)입니다.');
        else throw error;
      }
      
      await fetchCatalog();
      setNewItem({ name: '', price: '', sku: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { data: deleteData, error } = await supabase
        .from('service_catalog')
        .delete()
        .eq('id', itemToDelete)
        .select();

      if (error) {
        const { data: updateData, error: updateError } = await supabase
          .from('service_catalog')
          .update({ is_active: false })
          .eq('id', itemToDelete)
          .select();
        
        if (updateError) throw updateError;
        alert("이미 사용 중인 항목이므로 '비활성화' 처리되었습니다.");
      }
      await fetchCatalog();
    } catch (err: any) {
      alert("삭제 중 오류가 발생했습니다: " + (err.message || "Unknown Error"));
    } finally {
      setItemToDelete(null);
    }
  };

  const filteredCatalog = useMemo(() => {
    const search = catalogSearch.toLowerCase();
    return catalogItems.filter(i => {
      const isCategoryMatch = i.category === catalogFilter;
      const isNameMatch = i.name.toLowerCase().includes(search);
      const isSkuMatch = (i.sku_code || '').toLowerCase().includes(search);
      return isCategoryMatch && (isNameMatch || isSkuMatch);
    });
  }, [catalogItems, catalogFilter, catalogSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6 animate-in fade-in duration-200">
      {itemToDelete && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-rose-600"></i>
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Delete Item</h3>
            </div>
            <p className="text-xs text-slate-600 mb-6">
              정말로 이 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setItemToDelete(null)} className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-xs uppercase tracking-wide transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs uppercase tracking-wide transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl w-full max-w-6xl h-[85vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex text-xs font-sans border border-slate-200">
        {/* Sidebar */}
        <div className="w-48 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 flex-shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <i className="fas fa-cog text-xs"></i>
            </div>
            <span className="font-bold text-white tracking-tight text-sm">Admin</span>
          </div>
          <div className="px-2 space-y-1">
            <button onClick={() => setActiveTab('general')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-all text-[11px] font-bold uppercase tracking-wide ${activeTab === 'general' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
              <i className="fas fa-sliders-h w-4 text-center"></i> General
            </button>
            <button onClick={() => setActiveTab('catalog')} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-all text-[11px] font-bold uppercase tracking-wide ${activeTab === 'catalog' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
              <i className="fas fa-tags w-4 text-center"></i> Catalog
            </button>
          </div>
          <div className="mt-auto p-4 border-t border-slate-800">
             <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">VETPULSE v1.9.5</div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
          <div className="h-12 border-b border-slate-200 bg-white px-5 flex items-center justify-between flex-shrink-0 shadow-sm z-20">
            <div>
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                 {activeTab === 'general' ? <i className="fas fa-sliders-h text-slate-400"></i> : <i className="fas fa-tags text-slate-400"></i>}
                 {activeTab === 'general' ? 'Clinic Settings' : 'Service Catalog Management'}
              </h2>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all flex items-center justify-center">
              <i className="fas fa-times text-sm"></i>
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'general' && (
              <div className="h-full overflow-y-auto custom-scrollbar p-5">
                <div className="grid grid-cols-12 gap-6">
                   <div className="col-span-4 space-y-6">
                      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                         <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Operation Hours</h3>
                            <button onClick={() => onUpdateClinicSettings({ ...clinicSettings, isLunchEnabled: !clinicSettings.isLunchEnabled })} className={`w-8 h-4 rounded-full transition-all relative ${clinicSettings.isLunchEnabled ? 'bg-blue-500' : 'bg-slate-200'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${clinicSettings.isLunchEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
                            </button>
                         </div>
                         <div className={`space-y-3 transition-opacity ${clinicSettings.isLunchEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="grid grid-cols-2 gap-2">
                               <div>
                                  <label className="text-[9px] font-bold text-slate-400 block mb-1">Lunch Start</label>
                                  <input type="time" value={clinicSettings.lunchStartTime} onChange={(e) => onUpdateClinicSettings({ ...clinicSettings, lunchStartTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500" />
                               </div>
                               <div>
                                  <label className="text-[9px] font-bold text-slate-400 block mb-1">Lunch End</label>
                                  <input type="time" value={clinicSettings.lunchEndTime} onChange={(e) => onUpdateClinicSettings({ ...clinicSettings, lunchEndTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500" />
                               </div>
                            </div>
                         </div>
                      </div>

                      {/* NEW: Local Image Server Config */}
                      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                         <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wide mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <i className="fas fa-server text-blue-500"></i> Local Image Server
                         </h3>
                         <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-400 block">Server URL (HTTPS Required for Camera)</label>
                            <input 
                              type="text" 
                              value={clinicSettings.imageServerUrl || ''} 
                              onChange={(e) => onUpdateClinicSettings({ ...clinicSettings, imageServerUrl: e.target.value })} 
                              placeholder="https://192.168.0.x:3000" 
                              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-mono font-medium text-slate-900 outline-none focus:border-blue-500 placeholder:text-slate-300" 
                            />
                            <p className="text-[9px] text-slate-400 leading-relaxed">
                              * Enter the URL of your local hospital PC running the image server script.
                              <br/>
                              * If using self-signed certs, install profile on iPad.
                            </p>
                         </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                         <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wide mb-3 border-b border-slate-100 pb-2">Register Practitioner</h3>
                         <form onSubmit={handleAddVet} className="space-y-3">
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (e.g. Dr. Kim)" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500" />
                            <input type="text" value={newSpecialty} onChange={(e) => setNewSpecialty(e.target.value)} placeholder="Specialty (e.g. Surgery)" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500" />
                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Google Email" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500" />
                            <button type="submit" disabled={isSubmittingVet} className="w-full py-2 bg-slate-900 text-white rounded font-black text-[10px] uppercase tracking-widest hover:bg-black disabled:opacity-50">
                               {isSubmittingVet ? 'Processing...' : 'Register Staff'}
                            </button>
                         </form>
                      </div>
                   </div>

                   <div className="col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                         <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Active Staff List</h3>
                         <span className="text-[10px] font-bold text-slate-400">{vets.length} Members</span>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                         <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                               <tr>
                                  <th className="px-4 py-2 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-wider">Profile</th>
                                  <th className="px-4 py-2 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-wider">Specialty</th>
                                  <th className="px-4 py-2 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-wider">Contact (Email)</th>
                                  <th className="px-4 py-2 border-b border-slate-200 w-10"></th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                               {vets.map(vet => (
                                  <tr key={vet.id} className="hover:bg-blue-50/50 group transition-colors">
                                     <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-3">
                                           <img src={vet.avatar} className="w-8 h-8 rounded-lg object-cover border border-slate-200" alt="" />
                                           <span className="text-xs font-bold text-slate-800">{vet.name}</span>
                                        </div>
                                     </td>
                                     <td className="px-4 py-2.5">
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{vet.specialty}</span>
                                     </td>
                                     <td className="px-4 py-2.5">
                                        <span className="text-[11px] font-medium text-slate-500 font-mono">{vet.email}</span>
                                     </td>
                                     <td className="px-4 py-2.5 text-center">
                                        <button onClick={() => onRemoveVet(vet.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <i className="fas fa-trash-alt"></i>
                                        </button>
                                     </td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </div>
              </div>
            )}
            
            {/* Catalog Tab Content (unchanged logic) */}
            {activeTab === 'catalog' && (
              <div className="flex h-full">
                <div className="w-72 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-10">
                   <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <i className="fas fa-plus-circle text-blue-500"></i> Add New Item
                      </h3>
                      <form onSubmit={handleAddItem} className="space-y-2">
                         <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400">Category</label>
                            <select value={catalogFilter} onChange={(e) => setCatalogFilter(e.target.value as ServiceCategory)} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500">
                               {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400">Item Name</label>
                            <input required type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 placeholder:text-slate-300" placeholder="e.g. Basic Exam" />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                               <label className="text-[9px] font-bold text-slate-400">Price (₩)</label>
                               <input required type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 placeholder:text-slate-300 text-right" placeholder="0" />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-bold text-slate-400">SKU</label>
                               <input type="text" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value.toUpperCase()})} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 placeholder:text-slate-300 uppercase" placeholder="CODE" />
                            </div>
                         </div>
                         <button disabled={isAddingItem} type="submit" className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all disabled:opacity-50">
                            {isAddingItem ? 'Saving...' : 'Add Item'}
                         </button>
                      </form>
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                      <h3 className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter By Category</h3>
                      <div className="space-y-0.5">
                         {ALL_CATEGORIES.map(cat => (
                            <button key={cat} onClick={() => setCatalogFilter(cat)} className={`w-full flex justify-between items-center px-3 py-2 rounded text-[10px] font-bold uppercase transition-all ${catalogFilter === cat ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'}`}>
                               <span>{cat}</span><span className={`px-1.5 py-0.5 rounded text-[9px] ${catalogFilter === cat ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-400'}`}>{catalogItems.filter(i => i.category === cat).length}</span>
                            </button>
                         ))}
                      </div>
                   </div>
                </div>
                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                   <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {catalogFilter}
                      </h3>
                      <div className="relative w-64">
                         <input type="text" placeholder="Search in category..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all" />
                         <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {filteredCatalog.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <i className="fas fa-box-open text-4xl mb-3 text-slate-300"></i><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Items Found</p>
                         </div>
                      ) : (
                         <div className="divide-y divide-slate-50">
                            {filteredCatalog.map(item => (
                               <div key={item.id} className="grid grid-cols-12 px-5 py-2 items-center hover:bg-blue-50/50 group transition-colors">
                                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                                     <span className="text-[11px] font-bold text-slate-700 truncate">{item.name}</span>
                                     {item.sku_code && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200 uppercase">{item.sku_code}</span>}
                                  </div>
                                  <div className="col-span-4 text-right">
                                     <span className="text-[11px] font-bold text-slate-600 font-mono">₩{item.default_price.toLocaleString()}</span>
                                  </div>
                                  <div className="col-span-2 text-center">
                                     <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all flex items-center justify-center mx-auto border border-transparent hover:border-rose-100"><i className="fas fa-trash-alt text-[11px]"></i></button>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
