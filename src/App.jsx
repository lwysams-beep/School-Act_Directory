// =============================================================================
//  校園資訊 APP - VERSION 4.6 (放學方式修復 + 教職員介面優化版)
// =============================================================================
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, 
  ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, 
  Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, 
  Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, 
  BarChart, History, TrendingUp, Filter, Cloud, UserX, PieChart, Download, 
  Activity, Save as SaveIcon, Layers, Maximize, Palette, ChevronDown, Circle 
} from 'lucide-react';

// =============================================================================
//  FIREBASE IMPORTS & CONFIGURATION
// =============================================================================
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch
} from "firebase/firestore";

// *** 請在此填入你的真實 Firebase Config ***
const firebaseConfig = {
    apiKey: "AIzaSyDXZClMosztnJBd0CK6cpS6PPtJTTpgDkQ",
    authDomain: "school-act-directory.firebaseapp.com",
    projectId: "school-act-directory",
    storageBucket: "school-act-directory.firebasestorage.app",
    messagingSenderId: "351532359820",
    appId: "1:351532359820:web:29a353f54826ac80a41ba9",
    measurementId: "G-K5G20KH0RH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// -----------------------------------------------------------------------------
// 1. MASTER DATA UTILS
// -----------------------------------------------------------------------------
const parseMasterCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  return lines.map(line => {
    const cols = line.split(',');
    if (cols.length < 4) return null; 
    return {
      classCode: cols[0].trim(), 
      classNo: cols[1].trim().padStart(2, '0'), 
      engName: cols[2].trim(), 
      chiName: cols[3].trim(), 
      sex: cols[4] ? cols[4].trim() : '', 
      key: `${cols[0].trim()}-${cols[3].trim()}` 
    };
  }).filter(item => item !== null);
};

// 通用名單解析函式 (支援 "3B 20 温小文 自行回家 91400040" 或 "3B 20 温小文 自 91400040")
const processBulkText = (text, actName, actTime, actLoc, actDateText, dayIds, dates) => {
    const lines = text.trim().split('\n');
    const newItems = [];
    const mixedClassRegex = /([1-6][A-E])\s*(\d{1,2})?/; 
    const phoneRegex = /[569]\d{7}/; 

    lines.forEach((line) => {
        const cleanLine = line.trim().replace(/['"]/g, ''); 
        if(!cleanLine) return;

        // ⭐ 修復 1：更靈活的放學方式識別 (支援：'自'/'自行'/'自行回家' 以及 '家'/'家長'/'家長接送')
        let dismissalMethod = '';
        if (cleanLine.includes('自行回家') || cleanLine.includes('自行') || /\b自\b|\s自\s|\s自$|^自\s/.test(cleanLine)) {
            dismissalMethod = '自';
        } else if (cleanLine.includes('家長接送') || cleanLine.includes('家長') || /\b家\b|\s家\s|\s家$|^家\s/.test(cleanLine)) {
            dismissalMethod = '家';
        }

        // ⭐ 修復 2：先剔除放學關鍵字，避免姓名匹配器把 "自行回家" 誤認為學生名字
        const lineWithoutDismissal = cleanLine.replace(/自行回家|家長接送|自行|家長/g, '');
        const classMatch = cleanLine.match(mixedClassRegex);
        const nameMatch = lineWithoutDismissal.match(/[\u4e00-\u9fa5]{2,}/) || cleanLine.match(/[\u4e00-\u9fa5]{2,}/);
        const phoneMatch = cleanLine.match(phoneRegex);

        if (classMatch && nameMatch) {
            newItems.push({
                id: Date.now() + Math.random(),
                rawName: nameMatch[0],
                rawClass: classMatch[1],
                rawClassNo: classMatch[2] ? classMatch[2].padStart(2, '0') : '00', 
                rawPhone: phoneMatch ? phoneMatch[0] : '', 
                dismissalMethod: dismissalMethod, // 寫入 Firebase 資料庫欄位 ('自' 或 '家')
                activity: actName,
                time: actTime,
                location: actLoc,
                dateText: actDateText,
                dayIds: dayIds || [1], 
                specificDates: dates || [], 
                forceConflict: false 
            });
        }
    });
    return newItems;
};

// -----------------------------------------------------------------------------
// 2. HELPER FUNCTIONS
// -----------------------------------------------------------------------------
const calculateDuration = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes('-')) return 1; 
  try {
    const [start, end] = timeStr.split('-').map(t => t.trim());
    const parseMinutes = (t) => {
      if (!t) return 0;
      const parts = t.split(':');
      if (parts.length < 2) return 0;
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };
    const diff = parseMinutes(end) - parseMinutes(start);
    return diff > 0 ? diff / 60 : 1; 
  } catch (e) { return 1; }
};

const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return alert("沒有資料可匯出");
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(fieldName => {
      const val = row[fieldName] ? row[fieldName].toString().replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(','))
  ].join('\n');
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const CATEGORY_OPTIONS = [
    '體育 (Sports)',
    '音樂 (Music)',
    '視藝 (Visual Arts)',
    '學術/STEM',
    '服務/制服 (Service)',
    '成長/支援 (SEN Service)',
    '其他 (Others)'
];

const detectCategory = (name) => {
    const n = (name || "").toLowerCase();
    if (/足球|籃球|排球|羽毛球|乒乓|田徑|游泳|體育|跆拳|跳繩|sport|ball/.test(n)) return '體育 (Sports)';
    if (/合唱|樂團|小提琴|鋼琴|古箏|笛|音樂|music|choir|band/.test(n)) return '音樂 (Music)';
    if (/視藝|繪畫|素描|陶瓷|手工|畫班|art|draw|paint/.test(n)) return '視藝 (Visual Arts)';
    if (/中|英|數|常|stem|編程|無人機|奧數|辯論|寫作|academic|code|robot/.test(n)) return '學術/STEM';
    if (/童軍|服務|領袖|義工|service|scout/.test(n)) return '服務/制服 (Service)';
    if (/讀樂樂|小組|社交|成長/.test(n)) return '成長/支援 (SEN Service)';
    return '其他 (Others)';
};

const CHART_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#84cc16',
    '#14b8a6', '#d946ef', '#f43f5e', '#eab308', '#22c55e', '#0ea5e9', '#a855f7', '#fb7185', '#fbbf24', '#4ade80'
];

const CATEGORY_COLORS = {
    '體育 (Sports)': '#ef4444',
    '音樂 (Music)': '#f59e0b',
    '視藝 (Visual Arts)': '#ec4899',
    '學術/STEM': '#3b82f6',
    '服務/制服 (Service)': '#10b981',
    '成長/支援 (SEN Service)': '#6A1D8F',
    '其他 (Others)': '#94a3b8'
};

// -----------------------------------------------------------------------------
// 3. STATS VIEW COMPONENT
// -----------------------------------------------------------------------------
const StatsView = ({ masterList, activities, queryLogs, onBack }) => {
    const [statsViewMode, setStatsViewMode] = useState('dashboard');
    const [selectedActs, setSelectedActs] = useState(new Set());
    const [updatingCategory, setUpdatingCategory] = useState(false);

    const toggleSelection = (actName) => { if (!actName) return; const newSet = new Set(selectedActs); if (newSet.has(actName)) newSet.delete(actName); else newSet.add(actName); setSelectedActs(newSet); };
    const clearSelection = () => setSelectedActs(new Set());
    const handleCategoryChange = async (activityName, newCategory) => { if (!window.confirm(`確定要將「${activityName}」的所有記錄分類更改為「${newCategory}」嗎？`)) return; setUpdatingCategory(true); try { const batch = writeBatch(db); const targetDocs = activities.filter(a => a.activity === activityName); targetDocs.forEach(item => { const docRef = doc(db, "activities", item.id); batch.update(docRef, { manualCategory: newCategory }); }); await batch.commit(); alert("分類更新成功！"); } catch (error) { console.error(error); alert("更新失敗，請檢查網絡"); } finally { setUpdatingCategory(false); } };
    const { activityStats, gradeDistribution, categoryStats, studentStats, totalHours } = useMemo(() => { try { if (!masterList || masterList.length === 0 || !activities) { return { activityStats: [], gradeDistribution: [], categoryStats: [], studentStats: [], totalHours: 0 }; } const actStats = {}; const stuStats = {}; const catStats = {}; const gradeMap = { '1': {}, '2': {}, '3': {}, '4': {}, '5': {}, '6': {} }; Object.keys(gradeMap).forEach(g => gradeMap[g] = { totalHours: 0, byActivity: {} }); masterList.forEach(s => { if (s && s.key) stuStats[s.key] = { ...s, count: 0, hours: 0, acts: [] }; }); activities.forEach(item => { const dur = calculateDuration(item.time); const sessionCount = (item.specificDates && item.specificDates.length > 0) ? item.specificDates.length : 1; const totalItemHours = dur * sessionCount; const actName = item.activity || "Unknown"; const category = item.manualCategory || detectCategory(actName); if(!actStats[actName]) actStats[actName] = { name: actName, count: 0, hours: 0, category }; actStats[actName].count += sessionCount; actStats[actName].hours += totalItemHours; actStats[actName].category = category; if(!catStats[category]) catStats[category] = 0; catStats[category] += totalItemHours; const sKey = `${item.verifiedClass}-${item.verifiedName}`; if (stuStats[sKey]) { stuStats[sKey].count += sessionCount; stuStats[sKey].hours += totalItemHours; if(!stuStats[sKey].acts.includes(actName)) stuStats[sKey].acts.push(actName); } const gradeStr = String(item.verifiedClass || ''); if(gradeStr.length >= 2) { const grade = gradeStr.charAt(0); if(gradeMap[grade]) { gradeMap[grade].totalHours += totalItemHours; if(!gradeMap[grade].byActivity[actName]) gradeMap[grade].byActivity[actName] = 0; gradeMap[grade].byActivity[actName] += totalItemHours; } } }); const gradeArr = Object.keys(gradeMap).map(g => ({ grade: `P.${g}`, total: gradeMap[g].totalHours, details: gradeMap[g].byActivity })); const finalActStats = Object.values(actStats).sort((a,b) => b.hours - a.hours); const totalH = finalActStats.reduce((acc, cur) => acc + cur.hours, 0); const finalCatStats = Object.entries(catStats).map(([name, hours]) => ({ name, hours })).sort((a,b) => b.hours - a.hours); return { activityStats: finalActStats, gradeDistribution: gradeArr, categoryStats: finalCatStats, studentStats: Object.values(stuStats).sort((a,b) => a.hours - b.hours), totalHours: totalH }; } catch (e) { console.error("Data Calculation Error:", e); return { activityStats: [], gradeDistribution: [], categoryStats: [], studentStats: [], totalHours: 0 }; } }, [masterList, activities]);
    const filteredActivityList = useMemo(() => { if (selectedActs.size === 0) return activityStats; return activityStats.filter(a => selectedActs.has(a.name)); }, [activityStats, selectedActs]);
    const filteredTotalHours = useMemo(() => { if (selectedActs.size === 0) return totalHours; return filteredActivityList.reduce((acc, cur) => acc + cur.hours, 0); }, [filteredActivityList, totalHours, selectedActs]);
    const getSafeColor = (idx) => CHART_COLORS[idx % CHART_COLORS.length] || '#cbd5e1';
    const ghostPieGradient = useMemo(() => { if (totalHours === 0) return '#e2e8f0 0deg 360deg'; let currentDeg = 0; return activityStats.map((item, idx) => { const deg = (item.hours / (totalHours || 1)) * 360; const isSelected = selectedActs.size === 0 || selectedActs.has(item.name); const color = isSelected ? getSafeColor(idx) : '#f1f5f9'; const str = `${color} ${currentDeg}deg ${currentDeg + deg}deg`; currentDeg += deg; return str; }).join(', '); }, [activityStats, totalHours, selectedActs]);
    const categoryPieGradient = useMemo(() => { if (totalHours === 0) return '#e2e8f0 0deg 360deg'; let currentDeg = 0; return categoryStats.map((item) => { const deg = (item.hours / (totalHours || 1)) * 360; const color = CATEGORY_COLORS[item.name] || '#94a3b8'; const str = `${color} ${currentDeg}deg ${currentDeg + deg}deg`; currentDeg += deg; return str; }).join(', '); }, [categoryStats, totalHours]);
    const filteredStudentList = useMemo(() => { if (selectedActs.size === 0) return studentStats; return studentStats.filter(s => s.acts.some(act => selectedActs.has(act))); }, [studentStats, selectedActs]);
    const exportGradeStats = () => { const rows = []; gradeDistribution.forEach(g => { Object.entries(g.details).forEach(([actName, hours]) => { if (selectedActs.size === 0 || selectedActs.has(actName)) { rows.push({ Grade: g.grade, Activity: actName, Hours: hours.toFixed(2) }); } }); }); exportToCSV(rows, 'Grade_Activity_Distribution'); };
    const exportCategoryStats = () => exportToCSV(categoryStats, 'Category_Distribution_Report');
    const maxGradeHours = useMemo(() => { return Math.max(...gradeDistribution.map(g => g.total)) || 1; }, [gradeDistribution]);
    const getActColorIndex = (name) => { const idx = activityStats.findIndex(x => x.name === name); return idx >= 0 ? idx : 0; };
    return (
        <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600"><ArrowLeft className="mr-2" size={20} /> 返回</button>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center"><BarChart className="mr-2 text-blue-600" /> 校本數據分析中心</h2>
                <div className="w-24"></div>
            </div>
            <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                <button onClick={() => setStatsViewMode('dashboard')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><PieChart size={18} className="mr-2"/> 數據概覽</button>
                <button onClick={() => setStatsViewMode('activities')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'activities' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Activity size={18} className="mr-2"/> 活動列表 ({filteredActivityList.length})</button>
                <button onClick={() => setStatsViewMode('students')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'students' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Users size={18} className="mr-2"/> 學生監測 ({filteredStudentList.length})</button>
                <button onClick={() => setStatsViewMode('logs')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'logs' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><History size={18} className="mr-2"/> 系統紀錄</button>
            </div>
            {selectedActs.size > 0 && (<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center animate-in slide-in-from-top-2"><div className="text-sm text-blue-800"><span className="font-bold flex items-center"><Filter size={16} className="mr-1"/> 關注模式: </span>{Array.from(selectedActs).join(', ')}</div><button onClick={clearSelection} className="text-xs bg-white text-slate-500 border px-2 py-1 rounded hover:bg-red-50 hover:text-red-500 transition">清除篩選 (顯示全校)</button></div>)}
            <div className="flex-1 overflow-y-auto">
                {statsViewMode === 'dashboard' && (<div className="flex flex-col space-y-12 pb-12"><div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center md:items-start relative min-h-[400px]"><div className="absolute top-4 left-4 z-20"><button onClick={() => exportToCSV(filteredActivityList, 'Activity_Hours_Report')} className="text-xs bg-indigo-600 text-white border px-3 py-1.5 rounded flex items-center hover:bg-indigo-700 shadow-md transition"><Download size={14} className="mr-1"/> 匯出 CSV</button></div><div className="flex-1 flex flex-col items-center justify-center p-4 pt-10"><h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><Clock className="mr-2 text-orange-500"/> 活動總時數分佈 (真實比例)</h3><div className="relative w-72 h-72 rounded-full shadow-2xl border-4 border-white transition-all duration-500" style={{ background: `conic-gradient(${ghostPieGradient})` }}><div className="absolute inset-0 m-auto w-36 h-36 bg-slate-50 rounded-full flex flex-col items-center justify-center shadow-inner"><div className="text-xs text-slate-400 mb-1">{selectedActs.size > 0 ? "已選 / 總計" : "總學時"}</div><div className="flex items-baseline">{selectedActs.size > 0 && <span className="text-2xl font-bold text-blue-600 mr-1">{filteredTotalHours.toFixed(0)}</span>}{selectedActs.size > 0 && <span className="text-slate-400">/</span>}<span className={`font-bold text-slate-800 ${selectedActs.size > 0 ? 'text-lg ml-1' : 'text-4xl'}`}>{totalHours.toFixed(0)}</span></div><span className="text-xs text-slate-400">Hours</span></div></div><p className="text-xs text-slate-400 mt-4">點擊右側圖例進行多項對比</p></div><div className="w-full md:w-80 h-96 border-l border-slate-200 pl-0 md:pl-6 overflow-y-auto"><h4 className="text-xs font-bold text-slate-400 uppercase mb-3 sticky top-0 bg-slate-50 py-2 z-10 flex justify-between"><span>圖例 (點選切換)</span>{selectedActs.size > 0 && <span className="text-blue-500">已選 {selectedActs.size} 項</span>}</h4><div className="space-y-1">{activityStats.map((a, i) => { const isSelected = selectedActs.size === 0 || selectedActs.has(a.name); const isDimmed = selectedActs.size > 0 && !isSelected; return (<button key={i} onClick={() => toggleSelection(a.name)} className={`w-full flex items-center justify-between p-2 rounded text-xs transition-all duration-200 ${isSelected ? 'bg-white shadow ring-2 ring-blue-500 scale-[1.02] z-10' : 'hover:bg-white hover:shadow-sm'} ${isDimmed ? 'opacity-40 grayscale' : 'opacity-100'}`}><div className="flex items-center truncate"><span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{backgroundColor: getSafeColor(i)}}></span><span className="truncate max-w-[120px]" title={a.name}>{a.name}</span></div><div className="font-bold text-slate-600">{((a.hours/(totalHours||1))*100).toFixed(1)}%</div></button>) })}</div></div></div><div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center md:items-start relative min-h-[300px]"><div className="absolute top-4 left-4 z-20"><button onClick={exportCategoryStats} className="text-xs bg-indigo-600 text-white border px-3 py-1.5 rounded flex items-center hover:bg-indigo-700 shadow-md transition"><Download size={14} className="mr-1"/> 匯出 CSV</button></div><div className="flex-1 flex flex-col items-center justify-center p-4 pt-10"><h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><Palette className="mr-2 text-purple-500"/> 課程範疇分佈 (可手動修正)</h3><div className="relative w-64 h-64 rounded-full shadow-xl border-4 border-white" style={{ background: `conic-gradient(${categoryPieGradient})` }}><div className="absolute inset-0 m-auto w-32 h-32 bg-slate-50 rounded-full flex flex-col items-center justify-center shadow-inner"><span className="text-lg font-bold text-slate-600">分類統計</span></div></div><p className="text-xs text-slate-400 mt-4">前往「活動列表」即可手動更改分類</p></div><div className="w-full md:w-64 p-4"><h4 className="text-xs font-bold text-slate-400 uppercase mb-3">類別圖例</h4><div className="space-y-2">{categoryStats.map((cat, i) => (<div key={i} className="flex items-center justify-between p-2 bg-white rounded shadow-sm"><div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: CATEGORY_COLORS[cat.name] || '#94a3b8'}}></span><span className="text-xs font-bold">{cat.name}</span></div><div className="text-xs font-mono">{((cat.hours/(totalHours||1))*100).toFixed(1)}%</div></div>))}</div></div></div><div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative flex flex-col h-[600px]"><div className="flex flex-col md:flex-row justify-between items-start mb-6"><div className="flex items-center space-x-4 mb-2 md:mb-0"><button onClick={exportGradeStats} className="text-xs bg-indigo-600 text-white border px-3 py-1.5 rounded flex items-center hover:bg-indigo-700 shadow-md transition"><Download size={14} className="mr-1"/> 匯出 CSV</button></div><div className="text-right"><h3 className="font-bold text-slate-700 text-lg flex items-center justify-end"><TrendingUp className="mr-2 text-green-500"/> 各級總時數分佈 (固定比例)</h3><p className="text-xs text-slate-500 mt-1">{selectedActs.size > 0 ? '灰色: 該級總時數 | 彩色: 所選活動佔比' : '顯示全校所有活動堆疊'}</p></div></div><div className="flex-1 flex items-end justify-between space-x-8 border-b-2 border-slate-300 pb-0 px-4 mx-4 relative">{gradeDistribution.map((g) => { const maxScale = maxGradeHours; const ghostHeightPct = (g.total / (maxScale || 1)) * 100; const activeItems = Object.entries(g.details).filter(([name]) => selectedActs.size === 0 || selectedActs.has(name)).sort((a,b) => b[1] - a[1]); const selectedTotalHours = activeItems.reduce((acc, cur) => acc + cur[1], 0); const activeHeightPct = (selectedTotalHours / (maxScale || 1)) * 100; return (<div key={g.grade} className="flex flex-col items-center flex-1 h-full relative group">{selectedActs.size > 0 && (<div className="w-full absolute bottom-0 bg-slate-200 rounded-t-sm transition-all duration-700 pointer-events-none" style={{height: `${ghostHeightPct}%`}}/>)}<div className={`w-full absolute bottom-0 flex flex-col-reverse rounded-t-sm overflow-hidden transition-all duration-700 ${selectedActs.size > 0 ? 'w-4/5 z-10 shadow-lg left-1/2 -translate-x-1/2' : 'bg-slate-200'}`} style={{height: `${activeHeightPct}%`}}>{activeItems.map(([actName, hrs], idx) => { const colorIdx = getActColorIndex(actName); const color = getSafeColor(colorIdx); const pctOfStack = (hrs / (selectedTotalHours || 1)) * 100; return (<div key={actName} className="w-full relative" style={{height: `${pctOfStack}%`, backgroundColor: color}} />)})}</div><div className="absolute w-full text-center -top-6 transition-all duration-500" style={{bottom: `${Math.max(ghostHeightPct, activeHeightPct) + 2}%`}}><span className="text-xs font-bold text-slate-600 bg-white/80 px-1 rounded">{selectedActs.size > 0 ? selectedTotalHours.toFixed(0) : g.total.toFixed(0)}h</span></div><div className="hidden group-hover:block absolute bottom-1/2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 w-48 pointer-events-none"><div className="font-bold border-b border-slate-600 pb-1 mb-1">{g.grade} 統計詳情</div><div className="flex justify-between mb-1"><span>全級總時數:</span> <span className="font-mono">{g.total.toFixed(1)}h</span></div>{selectedActs.size > 0 && (<div className="flex justify-between text-yellow-400"><span>所選活動:</span> <span className="font-mono">{selectedTotalHours.toFixed(1)}h</span></div>)}</div><div className="absolute -bottom-8 w-full text-center"><div className="text-sm font-bold text-slate-700">{g.grade}</div></div></div>) })}<div className="absolute left-0 top-0 h-full border-l border-dashed border-slate-300 pointer-events-none"><span className="absolute top-0 left-1 text-[10px] text-slate-400 bg-slate-50 px-1">Max: {maxGradeHours.toFixed(0)}h</span></div></div></div></div>)}
                {statsViewMode === 'activities' && (<div className="bg-white border rounded-xl overflow-hidden"><div className="p-4 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold text-slate-700">活動統計列表</h3><button onClick={() => exportToCSV(filteredActivityList, 'Activity_Report')} className="text-sm bg-white border px-3 py-1 rounded hover:bg-slate-50 flex items-center text-blue-600 border-blue-200"><Download size={14} className="mr-1"/> 匯出 CSV</button></div><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500 uppercase"><tr><th className="p-3">活動名稱</th><th className="p-3 w-48">類別 (可手動更改)</th><th className="p-3 text-right">總人次</th><th className="p-3 text-right">總學時</th></tr></thead><tbody className="divide-y">{filteredActivityList.map((a, i) => (<tr key={i} className="hover:bg-slate-50"><td className="p-3 font-medium flex items-center"><span className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: getSafeColor(getActColorIndex(a.name))}}></span>{a.name}</td><td className="p-3"><div className="relative group/cat"><select className="w-full text-xs p-1 border rounded bg-slate-50 hover:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" value={a.category} disabled={updatingCategory} onChange={(e) => handleCategoryChange(a.name, e.target.value)}>{CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>{updatingCategory && <span className="absolute right-0 top-0 text-[8px] text-blue-500">更新中...</span>}</div></td><td className="p-3 text-right">{a.count}</td><td className="p-3 text-right font-bold text-blue-600">{a.hours.toFixed(1)}</td></tr>))}</tbody></table></div>)}
                {statsViewMode === 'logs' && (<div className="bg-white border rounded-xl overflow-hidden"><div className="p-4 bg-slate-50 border-b"><h3 className="font-bold text-slate-700">查詢日誌 (Audit Log)</h3></div><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500"><tr><th className="p-3">日期</th><th className="p-3">時間</th><th className="p-3">查詢班別</th><th className="p-3">學生姓名</th><th className="p-3">結果</th></tr></thead><tbody>{queryLogs.length > 0 ? queryLogs.map((log, i) => (<tr key={i} className="border-b last:border-0 hover:bg-white"><td className="p-3 text-slate-600">{log.dateStr}</td><td className="p-3 font-mono text-slate-500 text-xs">{log.timeStr}</td><td className="p-3 font-bold text-slate-800">{log.class} ({log.classNo})</td><td className="p-3">{log.name}</td><td className="p-3">{log.success ? <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded">成功</span> : <span className="text-red-500 text-xs">無記錄</span>}</td></tr>)) : (<tr><td colSpan="5" className="p-8 text-center text-slate-400">暫無查詢紀錄</td></tr>)}</tbody></table></div>)}
                {statsViewMode === 'students' && (<div className="bg-white border rounded-xl overflow-hidden"><div className="p-4 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center"><AlertTriangle className="mr-2 text-orange-500" size={18}/> 學生參與度監測</h3><button onClick={() => exportToCSV(filteredStudentList, 'Student_Participation')} className="text-sm bg-white border px-3 py-1 rounded hover:bg-slate-50 flex items-center text-blue-600 border-blue-200"><Download size={14} className="mr-1"/> 匯出 CSV</button></div><div className="max-h-[500px] overflow-y-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500 uppercase sticky top-0"><tr><th className="p-3">班別 (學號)</th><th className="p-3">姓名</th><th className="p-3 text-right">參與時數</th><th className="p-3 text-center">狀態</th></tr></thead><tbody className="divide-y">{filteredStudentList.map((s, i) => (<tr key={i} className={`hover:bg-slate-50 ${s.hours === 0 ? 'bg-red-50' : ''}`}><td className="p-3 text-slate-600">{s.classCode} ({s.classNo})</td><td className="p-3 font-bold">{s.chiName}</td><td className="p-3 text-right">{s.hours.toFixed(1)}</td><td className="p-3 text-center">{s.hours === 0 ? <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-bold">關注</span> : <span className="text-xs text-green-600">正常</span>}</td></tr>))}</tbody></table></div></div>)}
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// MAIN APP COMPONENT
// -----------------------------------------------------------------------------
const App = () => {
  const [currentView, setCurrentView] = useState('student'); 
  
  // ==========================================
  // 版本 1.5: 在網頁頁籤 (Tab) 加入 Star Emoji
  useEffect(() => {
    document.title = "⭐ 正覺活動系統";
}, []);
// ==========================================

  // Auth State
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(true); 
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  
  // Data State
  const [masterList, setMasterList] = useState([]); 
  const [activities, setActivities] = useState([]); 
  const [pendingImports, setPendingImports] = useState([]);
  const [queryLogs, setQueryLogs] = useState([]);

  // Loading States
  const [isMasterLoading, setIsMasterLoading] = useState(false);

  // School Year State
  const [schoolYearStart, setSchoolYearStart] = useState(2025); 

  // Import Form State
  const [bulkInput, setBulkInput] = useState('');
  const [importActivity, setImportActivity] = useState('無人機班');
  const [importTime, setImportTime] = useState('15:30-16:30');
  const [importLocation, setImportLocation] = useState('禮堂');
  const [importDayIds, setImportDayIds] = useState([1]);
  const [importDates, setImportDates] = useState([]); 
  const [tempDateInput, setTempDateInput] = useState('');
  const dateInputRef = useRef(null); 

  // Admin UI State
  const [adminTab, setAdminTab] = useState('import'); 
  const [selectedMatchIds, setSelectedMatchIds] = useState(new Set());
  const [csvEncoding, setCsvEncoding] = useState('Big5'); 
  const fileInputRef = useRef(null); 

  // DB Management UI State
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbSelectedIds, setDbSelectedIds] = useState(new Set());
  const [dbBatchMode, setDbBatchMode] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState({ activity: '', time: '', location: '', dateText: '' });

  // 按活動班整體改期 Modal 狀態
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupActivityName, setGroupActivityName] = useState('');
  const [groupTime, setGroupTime] = useState('');
  const [groupLocation, setGroupLocation] = useState('');
  const [groupDates, setGroupDates] = useState([]);
  const [groupTempDateInput, setGroupTempDateInput] = useState('');

  // 新增學生名單 Modal 狀態
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [targetActivityForAdd, setTargetActivityForAdd] = useState(null);
  const [addStudentBulkInput, setAddStudentBulkInput] = useState('');

  // DB Editing State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // ⭐ 修復 3：補全 Staff View 篩選 State，供教職員介面完整過濾與顯示
  const [staffShowAll, setStaffShowAll] = useState(false);
  const [staffUnlocked, setStaffUnlocked] = useState(false);
  const [staffPasswordInput, setStaffPasswordInput] = useState('');
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [staffClassFilter, setStaffClassFilter] = useState('');
  const [staffDismissalFilter, setStaffDismissalFilter] = useState('');
  
  // ==========================================
  // 版本 1.0: 新增活動班篩選 State 及 Firebase 點名更新函式
  const [staffActivityFilter, setStaffActivityFilter] = useState('');
  
  // ==========================================
  // 版本 1.3: 新增日期篩選 State (預設為當天)
  const getTodayString = () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
  };
  const [staffDateFilter, setStaffDateFilter] = useState(getTodayString());
  // ==========================================

  const handleAttendanceChange = async (id, newStatus) => {
      try {
          // 即時更新 Firebase 中的 attendanceStatus 欄位
          await updateDoc(doc(db, "activities", id), { attendanceStatus: newStatus });
      } catch (error) {
          alert("更新點名狀態失敗: " + error.message);
      }
  };
  // ==========================================

  const STAFF_PASSWORD = "staff2627";


  // Search UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date()); 

  // 取得目前所有獨立不重複的活動班名稱
  const uniqueActivities = useMemo(() => {
      const set = new Set(activities.map(a => a.activity).filter(Boolean));
      return Array.from(set);
  }, [activities]);

  // ---------------------------------------------------------------------------
  // FIREBASE LISTENERS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "activities"), orderBy("time")); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const acts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(acts);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchMaster = async () => {
        setIsMasterLoading(true);
        try {
            const docRef = doc(db, "settings", "master_list");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.students) setMasterList(data.students);
                if (data.schoolYearStart) setSchoolYearStart(data.schoolYearStart);
            }
        } catch (error) {
            console.error("Error fetching master list:", error);
        } finally {
            setIsMasterLoading(false);
        }
    };
    fetchMaster();
  }, []);

  useEffect(() => {
      const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
      return () => clearInterval(timer);
  }, []);

  // ---------------------------------------------------------------------------
  // AUTH ACTIONS
  // ---------------------------------------------------------------------------
  const handleLogin = async (e) => {
      e.preventDefault();
      try {
          await signInWithEmailAndPassword(auth, loginEmail, loginPwd);
          setLoginPwd(''); 
      } catch (error) {
          alert("登入失敗: " + error.message);
      }
  };

  const handleLogout = async () => {
      await signOut(auth);
      setUser(null);
      setCurrentView('student');
      setStaffUnlocked(false);
      setStaffPasswordInput('');
  };

  // ---------------------------------------------------------------------------
  // MASTER DATA ACTIONS
  // ---------------------------------------------------------------------------
  const handleMasterUploadTrigger = () => fileInputRef.current.click();

  const handleMasterFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.readAsText(file, csvEncoding);
      reader.onload = async (event) => {
          const text = event.target.result;
          try {
              const newMaster = parseMasterCSV(text);
              if (newMaster.length > 0) {
                  if (window.confirm(`解析成功！共 ${newMaster.length} 筆資料。\n確定要上傳至雲端資料庫嗎？(這將覆蓋舊有名單)`)) {
                      setIsMasterLoading(true);
                      try {
                          await setDoc(doc(db, "settings", "master_list"), {
                              students: newMaster,
                              schoolYearStart: schoolYearStart, 
                              updatedAt: new Date().toISOString(),
                              updatedBy: user.email
                          });
                          setMasterList(newMaster);
                          alert("雲端數據庫更新成功！");
                      } catch (error) {
                          alert("上傳失敗: " + error.message);
                      } finally {
                          setIsMasterLoading(false);
                      }
                  }
              } else {
                  alert("CSV 無法識別。請檢查格式或編碼。");
              }
          } catch (err) {
              alert("解析 CSV 失敗: " + err.message);
          }
      };
  };

  const handleSchoolYearChange = async (e) => {
      const newYear = parseInt(e.target.value);
      setSchoolYearStart(newYear);
      if (user) {
          try {
              await setDoc(doc(db, "settings", "master_list"), {
                  students: masterList,
                  schoolYearStart: newYear,
                  updatedAt: new Date().toISOString(),
                  updatedBy: user.email
              });
          } catch (err) { console.error("Failed to sync year", err); }
      }
  };

  // ---------------------------------------------------------------------------
  // DATA LOGIC (Date & Import)
  // ---------------------------------------------------------------------------
  const handleAddDate = () => {
      if (!tempDateInput) return;
      let dateString = tempDateInput;
      const ddmmRegex = /^(\d{1,2})(\d{2})$/;
      const match = tempDateInput.match(ddmmRegex);

      if (match) {
          const day = parseInt(match[1]);
          const month = parseInt(match[2]);
          if (month < 1 || month > 12) { alert("無效的月份"); return; }
          if (day < 1 || day > 31) { alert("無效的日期"); return; }
          let year = schoolYearStart;
          if (month >= 1 && month <= 8) year = schoolYearStart + 1;
          else if (month >= 9 && month <= 12) year = schoolYearStart;
          const fMonth = String(month).padStart(2, '0');
          const fDay = String(day).padStart(2, '0');
          dateString = `${year}-${fMonth}-${fDay}`;
      } else {
          const d = new Date(tempDateInput);
          if (isNaN(d.getTime())) { alert("日期格式錯誤，請輸入 DDMM (如 0209)"); return; }
      }

      if (!importDates.includes(dateString)) {
          const newDates = [...importDates, dateString].sort();
          setImportDates(newDates);
      }
      setTempDateInput(''); 
      if(dateInputRef.current) dateInputRef.current.focus();
  };

  const handleDateInputKeyDown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleAddDate(); }
  };

  const handleRemoveDate = (d) => setImportDates(prev => prev.filter(x => x !== d));
  const handleClearDates = () => setImportDates([]);
  const formatDisplayDate = (isoDate) => {
      if (!isoDate) return '';
      const parts = isoDate.split('-');
      if (parts.length === 3) return `${parts[1]}/${parts[2]}`; 
      return isoDate;
  };

  const handleBulkImport = () => {
      const dayMap = {1:'一', 2:'二', 3:'三', 4:'四', 5:'五', 6:'六', 0:'日'};
      const currentDayIds = typeof importDayIds !== 'undefined' ? importDayIds : [1];
      
      let finalDateText = currentDayIds.length > 0 ? `逢星期${currentDayIds.map(id => dayMap[id]).join(', ')}` : '未指定星期';
      if (importDates.length > 0) finalDateText = `共${importDates.length}堂 (${importDates[0]}起)`;

      const newItems = processBulkText(
          bulkInput,
          importActivity,
          importTime,
          importLocation,
          finalDateText,
          currentDayIds,
          importDates
      );

      if (newItems.length > 0) {
          setPendingImports(prev => [...prev, ...newItems]);
          setBulkInput('');
          alert(`成功識別 ${newItems.length} 筆資料。`);
      } else {
          alert("無法識別。請確認貼上的名單格式是否正確（例如：3B 20 温小文 自行回家 91400040）。");
      }
  };

  const { matched, conflicts } = useMemo(() => {
    const matched = [];
    const conflicts = [];
    pendingImports.forEach(item => {
      if (item.forceConflict) { conflicts.push({ ...item, status: 'manual_conflict' }); return; }
      let student = masterList.find(s => s.classCode === item.rawClass && s.chiName === item.rawName);
      if (!student && item.rawClassNo !== '00') student = masterList.find(s => s.classCode === item.rawClass && s.classNo === item.rawClassNo);
      if (!student) { const potential = masterList.filter(s => s.chiName === item.rawName); if (potential.length === 1) student = potential[0]; }

      if (student) {
        matched.push({ ...item, verifiedName: student.chiName, verifiedClass: student.classCode, verifiedClassNo: student.classNo, status: 'verified' });
      } else {
        conflicts.push({ ...item, status: 'conflict' });
      }
    });
    return { matched, conflicts };
  }, [pendingImports, masterList]);

  useEffect(() => { setSelectedMatchIds(new Set(matched.map(m => m.id))); }, [matched.length]);
  
  const toggleSelectMatch = (id) => {
      const newSet = new Set(selectedMatchIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedMatchIds(newSet);
  };
  const toggleSelectAll = () => setSelectedMatchIds(selectedMatchIds.size === matched.length ? new Set() : new Set(matched.map(m => m.id)));

  const handlePublish = async () => {
    const toPublish = matched.filter(m => selectedMatchIds.has(m.id));
    if (toPublish.length === 0) return alert("請選擇資料");
    try {
        const batchPromises = toPublish.map(item => {
            const { id, status, forceConflict, ...dataToSave } = item;
            return addDoc(collection(db, "activities"), { ...dataToSave, createdAt: new Date().toISOString() });
        });
        await Promise.all(batchPromises);
        const publishedIds = new Set(toPublish.map(m => m.id));
        setPendingImports(prev => prev.filter(p => !publishedIds.has(p.id)));
        alert(`成功發布 ${toPublish.length} 筆資料到雲端！`);
    } catch (error) {
        alert("發布失敗: " + error.message);
    }
  };

  const handleManualConflict = (id) => setPendingImports(prev => prev.map(i => i.id === id ? { ...i, forceConflict: true } : i));
  const handleResolveConflict = (item, correctStudent) => {
    setPendingImports(prev => prev.map(i => i.id === item.id ? { ...i, rawClass: correctStudent.classCode, rawName: correctStudent.chiName, rawClassNo: correctStudent.classNo, forceConflict: false } : i));
  };
  const handleDeleteImport = (id) => setPendingImports(prev => prev.filter(i => i.id !== id));

  // ---------------------------------------------------------------------------
  // DB MANAGEMENT LOGIC
  // ---------------------------------------------------------------------------
  const filteredDbActivities = useMemo(() => {
      if (!dbSearchTerm) return activities;
      const lower = dbSearchTerm.toLowerCase();
      return activities.filter(a => 
          a.activity?.toLowerCase().includes(lower) || 
          a.verifiedName?.includes(lower) || 
          a.verifiedClass?.includes(lower)
      );
  }, [activities, dbSearchTerm]);

  const toggleDbSelect = (id) => {
      const newSet = new Set(dbSelectedIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setDbSelectedIds(newSet);
  };

  const toggleDbSelectAll = () => {
      if (dbSelectedIds.size === filteredDbActivities.length) {
          setDbSelectedIds(new Set());
      } else {
          setDbSelectedIds(new Set(filteredDbActivities.map(a => a.id)));
      }
  };

  const handleBatchDelete = async () => {
      if (!window.confirm(`確定要刪除選取的 ${dbSelectedIds.size} 筆資料嗎？`)) return;
      const batch = writeBatch(db);
      dbSelectedIds.forEach(id => { const ref = doc(db, "activities", id); batch.delete(ref); });
      try { await batch.commit(); setDbSelectedIds(new Set()); alert("批量刪除成功！"); } catch (e) { alert("批量刪除失敗: " + e.message); }
  };

  const handleBatchEdit = async () => {
      if (!window.confirm(`確定要將選取的 ${dbSelectedIds.size} 筆資料統一修改嗎？`)) return;
      const batch = writeBatch(db);
      const updates = {};
      if (batchEditForm.activity) updates.activity = batchEditForm.activity;
      if (batchEditForm.time) updates.time = batchEditForm.time;
      if (batchEditForm.location) updates.location = batchEditForm.location;
      if (batchEditForm.dateText) updates.dateText = batchEditForm.dateText;
      
      if (batchEditForm.dateText && batchEditForm.dateText.includes('202')) {
          const newDates = batchEditForm.dateText.split(',').map(d => d.trim()).filter(d => d.length === 10);
          if (newDates.length > 0) {
              updates.specificDates = newDates;
              updates.dateText = `共${newDates.length}堂 (${newDates[0]}起)`;
          }
      }

      if (Object.keys(updates).length === 0) return alert("請輸入要修改的內容");
      dbSelectedIds.forEach(id => { const ref = doc(db, "activities", id); batch.update(ref, updates); });
      try { 
          await batch.commit(); 
          setDbSelectedIds(new Set()); 
          setDbBatchMode(false); 
          setBatchEditForm({ activity: '', time: '', location: '', dateText: '' }); 
          alert("活動班批量修改成功！"); 
      } catch (e) { alert("批量修改失敗: " + e.message); }
  };

  const handleDeleteActivity = async (id) => {
      if(window.confirm('確定要刪除這筆紀錄嗎？')) {
          try { await deleteDoc(doc(db, "activities", id)); } catch(e) { alert("刪除失敗:" + e.message) }
      }
  };

  // ---------------------------------------------------------------------------
  // 「按活動班整體改期」模組選單與邏輯
  // ---------------------------------------------------------------------------
  const handleOpenGroupRescheduleModal = () => {
      if (uniqueActivities.length === 0) return alert("資料庫中目前沒有任何活動班資料！");
      
      const initialAct = uniqueActivities[0];
      handleSelectGroupActivity(initialAct);
      setIsGroupModalOpen(true);
  };

  const handleSelectGroupActivity = (actName) => {
      setGroupActivityName(actName);
      const matches = activities.filter(a => a.activity === actName);
      if (matches.length > 0) {
          const sample = matches[0];
          setGroupTime(sample.time || '');
          setGroupLocation(sample.location || '');
          setGroupDates(sample.specificDates ? [...sample.specificDates] : []);
      }
  };

  const handleAddGroupDate = () => {
      if (!groupTempDateInput) return;
      let dateString = groupTempDateInput.trim();
      const ddmmRegex = /^(\d{1,2})(\d{2})$/;
      const match = groupTempDateInput.match(ddmmRegex);

      if (match) {
          const day = parseInt(match[1]);
          const month = parseInt(match[2]);
          if (month < 1 || month > 12 || day < 1 || day > 31) {
              alert("無效的日期，請輸入正確的 DDMM 格式（如 0209）");
              return;
          }
          let year = schoolYearStart;
          if (month >= 1 && month <= 8) year = schoolYearStart + 1;
          else if (month >= 9 && month <= 12) year = schoolYearStart;
          dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
          const d = new Date(groupTempDateInput);
          if (isNaN(d.getTime())) {
              alert("日期格式錯誤，請輸入 DDMM (如 0209) 或 YYYY-MM-DD");
              return;
          }
      }

      if (!groupDates.includes(dateString)) {
          setGroupDates(prev => [...prev, dateString].sort());
      }
      setGroupTempDateInput('');
  };

  const handleRemoveGroupDate = (dateToRemove) => {
      setGroupDates(prev => prev.filter(d => d !== dateToRemove));
  };

  const handleSaveGroupReschedule = async () => {
      if (!groupActivityName) return alert("請先選擇活動班");
      const targetDocs = activities.filter(a => a.activity === groupActivityName);
      if (targetDocs.length === 0) return alert("找不到此活動班的紀錄");

      if (!window.confirm(`確定要為「${groupActivityName}」（共 ${targetDocs.length} 位學生）統一更新資料嗎？`)) return;

      try {
          const batch = writeBatch(db);
          
          let newDateText = targetDocs[0].dateText || '';
          if (groupDates.length > 0) {
              newDateText = `共${groupDates.length}堂 (${groupDates[0]}起)`;
          }

          targetDocs.forEach(item => {
              const docRef = doc(db, "activities", item.id);
              batch.update(docRef, {
                  time: groupTime,
                  location: groupLocation,
                  specificDates: groupDates,
                  dateText: newDateText
              });
          });

          await batch.commit();
          alert(`「${groupActivityName}」更新成功！已同步更新 ${targetDocs.length} 位學生的資料。`);
          setIsGroupModalOpen(false);
      } catch (error) {
          alert("更新失敗：" + error.message);
      }
  };

  // ---------------------------------------------------------------------------
  // 「新增學生名單」Pop-up Window 邏輯
  // ---------------------------------------------------------------------------
  const handleOpenAddStudentModal = (act) => {
      setTargetActivityForAdd(act);
      setAddStudentBulkInput('');
      setIsAddStudentModalOpen(true);
  };

  const handleConfirmAddStudentModal = () => {
      if (!targetActivityForAdd) return;
      
      let finalDateText = targetActivityForAdd.dateText || '';
      if (targetActivityForAdd.specificDates && targetActivityForAdd.specificDates.length > 0) {
          finalDateText = `共${targetActivityForAdd.specificDates.length}堂 (${targetActivityForAdd.specificDates[0]}起)`;
      }

      const newItems = processBulkText(
          addStudentBulkInput,
          targetActivityForAdd.activity,
          targetActivityForAdd.time,
          targetActivityForAdd.location,
          finalDateText,
          targetActivityForAdd.dayIds || [1],
          targetActivityForAdd.specificDates || []
      );

      if (newItems.length > 0) {
          setPendingImports(prev => [...prev, ...newItems]);
          setAddStudentBulkInput('');
          setIsAddStudentModalOpen(false);
          setAdminTab('import');
          alert(`成功識別 ${newItems.length} 筆學生資料，已載入至待發布列表。`);
      } else {
          alert("無法識別。請確認貼上的名單格式（例如：3B 20 温小文 自行回家 91400040）。");
      }
  };

  const startEditActivity = (act) => {
      setEditingId(act.id);
      setEditFormData({ activity: act.activity, time: act.time, location: act.location, dateText: act.dateText });
  };

  const saveEditActivity = async (id) => {
      try {
          await updateDoc(doc(db, "activities", id), editFormData);
          setEditingId(null);
      } catch(e) { alert("更新失敗:" + e.message) }
  };
  const cancelEdit = () => { setEditingId(null); setEditFormData({}); };

  const handleStudentSearch = () => {
    const formattedClassNo = selectedClassNo.padStart(2, '0');
    const student = masterList.find(s => s.classCode === selectedClass && s.classNo === formattedClassNo);
    
    const now = new Date();
    const newLog = { 
        id: Date.now(), 
        dateStr: now.toLocaleDateString('zh-HK'),
        timeStr: now.toLocaleTimeString('zh-HK'),
        class: selectedClass, 
        classNo: formattedClassNo, 
        name: student ? student.chiName : '未知', 
        success: !!student 
    };
    
    setQueryLogs(prev => [newLog, ...prev]);
    const results = activities.filter(item => item.verifiedClass === selectedClass && item.verifiedClassNo === formattedClassNo);
    setStudentResult(results);
    setCurrentView('kiosk_result');
  };

  const handleStaffLogin = () => {
      if (staffPasswordInput === STAFF_PASSWORD) {
          setStaffUnlocked(true);
          setStaffPasswordInput(''); 
      } else {
          alert('密碼錯誤 (Password Incorrect)');
          setStaffPasswordInput('');
      }
  };

  // -------------------------------------------------------------------------
  // VIEWS
  // -------------------------------------------------------------------------
  const renderTopNavBar = () => (
    <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md sticky top-0 z-50">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { setCurrentView('student'); setStaffUnlocked(false); setStaffPasswordInput(''); }}>
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">佛</div>
            <span className="font-bold text-lg tracking-wide hidden sm:block">香海正覺蓮社佛教正覺蓮社學校</span>
        </div>
        
        <div className="hidden md:flex flex-col items-center justify-center text-xs text-slate-400 font-mono">
            <div>{currentDateTime.toLocaleDateString('zh-HK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div className="text-white font-bold text-lg">{currentDateTime.toLocaleTimeString('zh-HK')}</div>
        </div>

        <div className="flex space-x-1">
            <button onClick={() => { setCurrentView('student'); setStaffUnlocked(false); setStaffPasswordInput(''); }} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'student' || currentView === 'kiosk_result' ? 'bg-orange-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><User size={16} className="mr-2" /> 學生</button>
            
            {/* 版本 1.4: 教職員按鈕僅在 user 存在 (Admin 登入後) 顯示 */}
            {user && (
                <button onClick={() => setCurrentView('staff')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'staff' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Users size={16} className="mr-2" /> 教職員查詢</button>
            )}

            <button onClick={() => { setCurrentView('admin'); setStaffUnlocked(false); setStaffPasswordInput(''); }} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'admin' ? 'bg-slate-700 text-white font-bold shadow-lg ring-1 ring-slate-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                {user ? <Shield size={16} className="mr-2 text-green-400" /> : <Lock size={16} className="mr-2" />} {user ? '管理員控制台' : '管理員登入'}
            </button>
        </div>
    </div>
  );


  const renderStudentView = () => {
    const allClasses = [
        '1A', '1B', '1C', '1D', '1E',
        '2A', '2B', '2C', '2D', '2E',
        '3A', '3B', '3C', '3D', '3E',
        '4A', '4B', '4C', '4D', '4E',
        '5A', '5B', '5C', '5D', '5E',
        '6A', '6B', '6C', '6D', '6E'
    ];

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-b from-orange-50 to-white">
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl bg-white p-8 rounded-3xl shadow-xl border border-orange-100">
                    <div className="text-center mb-6"><h1 className="text-2xl font-bold text-slate-800">課外活動查詢</h1><p className="text-slate-500">請輸入你的班別及學號</p></div>
                    
                    <div className="mb-6">
                        <label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">班別 Class</label>
                        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                            {allClasses.map((cls) => (
                                <button key={cls} onClick={() => setSelectedClass(cls)} className={`py-2 rounded-lg font-bold text-lg transition-colors ${selectedClass === cls ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-600 hover:bg-orange-100'}`}>
                                    {cls}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">學號 Class No.</label>
                            <div className="flex items-center justify-center mb-4"><div className="h-20 w-32 bg-slate-100 rounded-2xl flex items-center justify-center text-5xl font-bold tracking-widest text-slate-800 border-2 border-orange-200 shadow-inner">{selectedClassNo || <span className="text-slate-300 text-3xl">--</span>}</div></div>
                            <div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map((num) => (<button key={num} onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + num); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 active:border-orange-500 shadow-sm transition-all">{num}</button>))}<button onClick={() => setSelectedClassNo('')} className="h-14 bg-red-50 text-red-500 rounded-xl font-bold border border-red-100">清除</button><button onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + 0); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 shadow-sm">0</button><button onClick={() => setSelectedClassNo(prev => prev.slice(0, -1))} className="h-14 bg-slate-100 text-slate-500 rounded-xl font-bold">←</button></div>
                        </div>
                        <div className="flex items-center justify-center md:w-1/3">
                            <button onClick={handleStudentSearch} disabled={selectedClassNo.length === 0} className={`w-full py-8 rounded-2xl text-3xl font-bold text-white shadow-xl transition-all flex items-center justify-center ${selectedClassNo.length > 0 ? 'bg-orange-600 hover:bg-orange-700 transform hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}><Search className="mr-3" size={32} strokeWidth={3} /> 查詢</button>
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-center text-xs text-slate-400 font-mono tracking-wider">
                    Version 4.6
                </div>
            </div>
        </div>
    );
  };
  
  // ⭐ 修復 4：整合並修復教職員檢視頁面，讀取 Firebase 的 activities 陣列與放學方式
  const renderStaffView = () => {
    const filteredList = activities.filter(item => {
        const matchesSearch = !staffSearchTerm || 
            item.verifiedName?.includes(staffSearchTerm) || 
            item.rawName?.includes(staffSearchTerm) ||
            item.verifiedClass?.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
            item.rawClass?.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
            item.activity?.includes(staffSearchTerm);
            
        const matchesClass = !staffClassFilter || item.verifiedClass === staffClassFilter || item.rawClass === staffClassFilter;
        
        const matchesDismissal = !staffDismissalFilter || 
        (staffDismissalFilter === '自' && item.dismissalMethod === '自') ||
        (staffDismissalFilter === '家' && item.dismissalMethod === '家');

    // 版本 1.0: 增加活動班篩選條件
    const matchesActivity = !staffActivityFilter || item.activity === staffActivityFilter;
            // ==========================================
            // 版本 1.3: 增加日期篩選條件
            let matchesDate = true;
            if (staffDateFilter) {
                // 如果該活動有設定特定日期 (specificDates)
                if (item.specificDates && item.specificDates.length > 0) {
                    matchesDate = item.specificDates.includes(staffDateFilter);
                } 
                // 否則，檢查該活動的星期幾 (dayIds) 是否符合選擇的日期
                else if (item.dayIds && item.dayIds.length > 0) {
                    const filterDateObj = new Date(staffDateFilter);
                    const filterDayOfWeek = filterDateObj.getDay(); // 0(日) 到 6(六)
                    matchesDate = item.dayIds.includes(filterDayOfWeek);
                }
            }
            
            // 版本 1.3: 將 matchesDate 加入最終 return
            return matchesSearch && matchesClass && matchesDismissal && matchesActivity && matchesDate;
            // ==========================================
        });


    const totalCount = filteredList.length;
    const selfCount = filteredList.filter(i => i.dismissalMethod === '自').length;
    const parentCount = filteredList.filter(i => i.dismissalMethod === '家').length;

    return (
        <div className="space-y-6 p-4 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <span>📋</span> 教職員查詢
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        檢視學生放學活動安排及放學方式統計
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center">
                        <div className="text-xs text-slate-500">總人次</div>
                        <div className="text-lg font-bold text-slate-700">{totalCount}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-center">
                        <div className="text-xs text-emerald-600 font-medium">自行回家 (自)</div>
                        <div className="text-lg font-bold text-emerald-700">{selfCount}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
                        <div className="text-xs text-amber-600 font-medium">家長接送 (家)</div>
                        <div className="text-lg font-bold text-amber-700">{parentCount}</div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input
                            type="text"
                            placeholder="搜尋學生姓名 / 班別 / 活動..."
                            value={staffSearchTerm}
                            onChange={(e) => setStaffSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    </div>

                    <select
                        value={staffClassFilter}
                        onChange={(e) => setStaffClassFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">全部班別</option>
                        {['1A','1B','1C','1D','2A','2B','2C','2D','3A','3B','3C','3D','4A','4B','4C','4D','5A','5B','5C','5D','6A','6B','6C','6D'].map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                    </select>

                    <select
                        value={staffDismissalFilter}
                        onChange={(e) => setStaffDismissalFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                    >
                        <option value="">全部放學方式</option>
                        <option value="自">🚶‍♂️ 自行回家 (自)</option>
                        <option value="家">👨‍👩‍👧 家長接送 (家)</option>
                        </select>

                        <select
                        value={staffActivityFilter}
                        onChange={(e) => setStaffActivityFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                    >
                        <option value="">全部活動班</option>
                        {uniqueActivities.map(act => (
                            <option key={act} value={act}>{act}</option>
                        ))}
                    </select>

                    {/* ========================================================= */}
                    {/* 版本 1.3: 在這裡插入日期篩選器 (在 select 和 div 之間) */}
                    <div className="flex items-center">
                        <input
                            type="date"
                            value={staffDateFilter}
                            onChange={(e) => setStaffDateFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                        />
                        <button 
                            onClick={() => setStaffDateFilter(getTodayString())}
                            className="ml-2 text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1.5 rounded hover:bg-orange-200 transition whitespace-nowrap"
                        >
                            今天
                        </button>
                    </div>
                    {/* ========================================================= */}

                </div> {/* <---- 原本的 </div> 保持在這裡 */}

                {/* 這裡也別忘了在 onClick 裡加上 setStaffDateFilter(''); */}
                {(staffSearchTerm || staffClassFilter || staffDismissalFilter || staffActivityFilter || staffDateFilter) && (
                    <button
                        onClick={() => {
                            setStaffSearchTerm('');
                            setStaffClassFilter('');
                            setStaffDismissalFilter('');
                            setStaffActivityFilter('');
                            setStaffDateFilter(''); // 點擊清除所有篩選時，清空日期
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                        清除所有篩選
                    </button>
                )}


{(staffSearchTerm || staffClassFilter || staffDismissalFilter || staffActivityFilter) && (
<button
    onClick={() => {
        setStaffSearchTerm('');
        setStaffClassFilter('');
        setStaffDismissalFilter('');
        setStaffActivityFilter(''); // 版本 1.0: 清除活動班篩選
    }}
    className="text-xs text-slate-500 hover:text-slate-700 underline"
>
    清除所有篩選
</button>

)}


            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                <th className="p-3.5 font-semibold text-center w-20">班別</th>
                                <th className="p-3.5 font-semibold text-center w-16">座號</th>
                                <th className="p-3.5 font-semibold">學生姓名</th>
                                <th className="p-3.5 font-semibold text-center w-32">實時點名</th>
                                <th className="p-3.5 font-semibold text-center w-32">放學方式</th>
                                <th className="p-3.5 font-semibold">活動名稱</th>
                                <th className="p-3.5 font-semibold">時間 / 日期</th>
                                <th className="p-3.5 font-semibold">地點</th>
                                <th className="p-3.5 font-semibold">聯絡電話</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredList.length > 0 ? (
                                filteredList.map((act, index) => (
                                    <tr 
                                        key={act.id || index} 
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="p-3.5 text-center font-bold text-slate-700">
                                            <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                {act.verifiedClass || act.rawClass || '-'}
                                            </span>
                                        </td>

                                        <td className="p-3.5 text-center text-slate-500 font-mono">
                                            {act.verifiedClassNo || act.rawClassNo || '-'}
                                        </td>
                                        <td className="p-3.5 font-bold text-slate-800">
                                            {act.verifiedName || act.rawName || '未命名'}
                                        </td>

                                          {/* 版本 1.1: 實時點名狀態 (被動式實時讀取 Firebase，並使用英文鍵值) */}
                                         <td className="p-3.5 text-center">
                                            <select
                                                value={act.attendanceStatus || 'unmarked'}
                                                onChange={(e) => handleAttendanceChange(act.id, e.target.value)}
                                                className={`border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer transition-colors ${
                                                    act.attendanceStatus === 'present' ? 'bg-green-100 text-green-800 border-green-300' :
                                                    act.attendanceStatus === 'late' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                                    act.attendanceStatus === 'absent' ? 'bg-red-100 text-red-800 border-red-300' :
                                                    act.attendanceStatus === 'sick' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                                    act.attendanceStatus === 'leave' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                                    act.attendanceStatus === 'unknown' ? 'bg-slate-200 text-slate-800 border-slate-300' :
                                                    'bg-white text-slate-600 border-slate-300'
                                                }`}
                                            >
                                                <option value="unmarked">⚫ 未點名</option>
                                                <option value="present">🟢 出席</option>
                                                <option value="late">🔵 遲到</option>
                                                <option value="absent">🔴 無故缺席</option>
                                                <option value="sick">🟡 病假</option>
                                                <option value="leave">🟣 事假</option>
                                                <option value="unknown">⚪ 未知</option>
                                            </select>
                                        </td>


                                        <td className="p-3.5 text-center">
                                            {act.dismissalMethod === '自' && (
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold">
                                                    <span>🚶‍♂️</span> 自行回家
                                                </span>
                                            )}
                                            {act.dismissalMethod === '家' && (
                                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-300 text-xs px-2.5 py-1 rounded-full font-bold">
                                                    <span>👨‍👩‍👧</span> 家長接送
                                                </span>
                                            )}
                                            {!act.dismissalMethod && (
                                                <span className="text-slate-300 font-bold">-</span>
                                            )}
                                        </td>

                                        <td className="p-3.5 font-medium text-blue-700">
                                            {act.activity || '-'}
                                        </td>

                                        <td className="p-3.5 text-slate-600 text-xs space-y-0.5">
                                            <div>{act.dateText || '-'}</div>
                                            <div className="text-slate-400">{act.time || ''}</div>
                                        </td>

                                        <td className="p-3.5 text-slate-600">
                                            {act.location || '-'}
                                        </td>

                                        <td className="p-3.5 text-slate-600 font-mono text-xs">
                                            {act.rawPhone ? (
                                                <a href={`tel:${act.rawPhone}`} className="text-slate-600 hover:text-blue-600 underline">
                                                    {act.rawPhone}
                                                </a>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="p-12 text-center text-slate-400">
                                        <div className="text-4xl mb-2">🔍</div>
                                        <div className="text-base font-medium">沒有找到符合條件的名單資料</div>
                                        <div className="text-xs text-slate-400 mt-1">請嘗試調整搜尋關鍵字或篩選條件</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center px-4">
                    <span>顯示 {filteredList.length} 筆資料</span>
                    <span>標示說明：<span className="text-emerald-700 font-bold">自</span> = 自行回家 | <span className="text-amber-700 font-bold">家</span> = 家長接送</span>
                </div>
            </div>
        </div>
    );
  };

  const renderKioskResultView = () => {
    const upcomingDays = [];
    const today = new Date();
    const weekDayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDayEnNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 8; i++) { 
        const d = new Date(today); d.setDate(today.getDate() + i);
        const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
        const localDateString = `${year}-${month}-${day}`; const displayDate = `(${day}/${month}/${year})`;
        upcomingDays.push({ dayId: d.getDay(), dateString: localDateString, label: i === 0 ? '今天' : weekDayNames[d.getDay()], fullLabel: `${weekDayNames[d.getDay()]} ${weekDayEnNames[d.getDay()]} ${displayDate}` });
    }
    const currentStudent = masterList.find(s => s.classCode === selectedClass && s.classNo === selectedClassNo.padStart(2, '0'));

    return (
       <div className="flex-1 bg-slate-800 flex flex-col font-sans text-white h-screen overflow-hidden">
           <div className="p-4 flex items-center justify-between bg-slate-900 shadow-md shrink-0"><h2 className="text-xl font-bold text-slate-300">活動日程表</h2><button onClick={() => { setCurrentView('student'); setStudentResult(null); setSelectedClassNo(''); }} className="bg-white/10 px-4 py-2 rounded-full flex items-center text-sm backdrop-blur-md hover:bg-white/20 transition"><ArrowLeft size={20} className="mr-1" /> 返回</button></div>
           <div className="px-8 pt-6 pb-2 shrink-0"><h1 className="text-4xl font-bold">{selectedClass}班 ({selectedClassNo})號 <span className="text-orange-400">{currentStudent ? currentStudent.chiName : ''}</span></h1><p className="text-slate-400 mt-1">未來一週活動概覽</p></div>
           <div className="flex-1 px-8 pb-8 overflow-y-auto"><div className="space-y-6 mt-4">{upcomingDays.map((dayItem) => {
               const dayActivities = studentResult ? studentResult.filter(act => { if (act.specificDates && act.specificDates.length > 0) { return act.specificDates.includes(dayItem.dateString); } return act.dayIds && act.dayIds.includes(dayItem.dayId); }) : [];
               const isToday = dayItem.label === '今天';
               return (<div key={dayItem.dateString} className={`rounded-3xl p-6 transition-all ${isToday ? 'bg-slate-700/80 ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-slate-700/30'}`}><div className="flex items-center mb-4 border-b border-slate-600 pb-2"><div className={`text-2xl font-bold ${isToday ? 'text-green-400' : 'text-slate-200'}`}>{dayItem.fullLabel}</div>{isToday && <span className="ml-3 bg-green-600 text-white text-xs px-2 py-1 rounded-full animate-pulse">Today</span>}</div><div className="space-y-4">{dayActivities.length > 0 ? (dayActivities.map((item, idx) => (<div key={`${item.id}-${idx}`} className="bg-white text-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden"><div className="flex justify-between items-start mb-2"><h3 className="text-2xl font-bold text-slate-900">{item.activity}</h3></div><div className="grid grid-cols-2 gap-4 mt-3"><div className="flex items-center text-slate-600 bg-slate-100 p-2 rounded-lg"><Clock size={20} className="mr-2 text-orange-500" /><span className="font-bold">{item.time}</span></div><div className="flex items-center text-blue-800 bg-blue-50 p-2 rounded-lg"><MapPin size={20} className="mr-2 text-blue-500" /><span className="font-bold">{item.location}</span></div></div></div>))) : (<div className="text-slate-500 text-sm italic py-4 text-center border border-dashed border-slate-600 rounded-xl">沒有安排活動</div>)}</div></div>);
           })}</div>{(!studentResult) && (<div className="flex flex-col items-center justify-center h-40 mt-8 text-slate-400 bg-slate-700/30 rounded-2xl border border-dashed border-slate-600"><Calendar size={48} className="mb-2 opacity-50" /><p className="text-lg">請輸入班別及學號查詢</p></div>)}</div></div>
    );
 }



  const renderLoginView = () => (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-slate-200">
              <div className="text-center mb-8"><div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-white"><Lock size={32} /></div><h2 className="text-2xl font-bold text-slate-800">管理員登入</h2><p className="text-slate-500 text-sm">請使用 Firebase 帳戶登入</p></div>
              <form onSubmit={handleLogin} className="space-y-4">
                  <div><label className="block text-slate-600 text-sm font-bold mb-2">Email</label><input type="email" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="教職員專用" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></div>
                  <div><label className="block text-slate-600 text-sm font-bold mb-2">Password</label><input type="password" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••" value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} /></div>
                  <button type="submit" disabled={authLoading} className="w-full py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition flex items-center justify-center">{authLoading ? '登入中...' : '登入系統'}</button>
              </form>
          </div>
      </div>
  );

  const renderDatabaseManager = () => (
    <div className="bg-white p-6 rounded-xl shadow-md min-h-[500px]">
        <div className="flex justify-between items-center mb-6">
            <button onClick={() => setAdminTab('import')} className="flex items-center text-slate-500 hover:text-blue-600">
                <ArrowLeft className="mr-2" size={20} /> 返回導入介面
            </button>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <Database className="mr-2 text-blue-600" /> 數據庫管理
            </h2>
            <div className="w-24"></div>
        </div>

        <div className="mb-4 space-y-4">
            <div className="flex gap-4 items-center">
                <div className="flex-1 bg-slate-50 border rounded-lg flex items-center px-3 py-2">
                    <Search size={18} className="text-slate-400 mr-2" />
                    <input 
                        type="text" 
                        placeholder="搜尋學生、活動或日期..." 
                        className="bg-transparent outline-none w-full text-sm" 
                        value={dbSearchTerm} 
                        onChange={(e) => setDbSearchTerm(e.target.value)} 
                    />
                </div>

                <button 
                    onClick={handleOpenGroupRescheduleModal} 
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-orange-600 shadow-sm transition"
                >
                    <RefreshCcw size={16} className="mr-2" /> 按活動班整體改期
                </button>

                {dbSelectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setDbBatchMode(!dbBatchMode)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700">
                            <Edit2 size={16} className="mr-2" /> 批量修改 ({dbSelectedIds.size})
                        </button>
                        <button onClick={handleBatchDelete} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-red-100 border border-red-200">
                            <Trash2 size={16} className="mr-2" /> 刪除
                        </button>
                    </div>
                )}
            </div>
            
            {dbBatchMode && dbSelectedIds.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-top-2">
                    <h3 className="font-bold text-blue-800 text-sm mb-3">批量修改選取的 {dbSelectedIds.size} 筆資料 (留空則不修改)</h3>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        <input className="p-2 border rounded text-sm" placeholder="新活動名稱..." value={batchEditForm.activity} onChange={e => setBatchEditForm({...batchEditForm, activity: e.target.value})} />
                        <input className="p-2 border rounded text-sm" placeholder="新時間..." value={batchEditForm.time} onChange={e => setBatchEditForm({...batchEditForm, time: e.target.value})} />
                        <input className="p-2 border rounded text-sm" placeholder="新地點..." value={batchEditForm.location} onChange={e => setBatchEditForm({...batchEditForm, location: e.target.value})} />
                        <input className="p-2 border rounded text-sm" placeholder="新備註/日期..." value={batchEditForm.dateText} onChange={e => setBatchEditForm({...batchEditForm, dateText: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setDbBatchMode(false)} className="px-3 py-1 text-slate-500 hover:text-slate-800 text-sm">取消</button>
                        <button onClick={handleBatchEdit} className="bg-blue-600 text-white px-4 py-1 rounded text-sm font-bold hover:bg-blue-700">確認修改</button>
                    </div>
                </div>
            )}
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 text-slate-600 uppercase">
                    <tr>
                        <th className="p-3 w-10 text-center"><input type="checkbox" checked={filteredDbActivities.length > 0 && dbSelectedIds.size === filteredDbActivities.length} onChange={toggleDbSelectAll} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"/></th>
                        <th className="p-3">學生</th>
                        <th className="p-3">活動名稱</th>
                        <th className="p-3">時間</th>
                        <th className="p-3">地點</th>
                        <th className="p-3">日期/備註</th>
                        <th className="p-3 text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredDbActivities.map(act => (
                        <tr key={act.id} className={`border-b hover:bg-slate-50 ${dbSelectedIds.has(act.id) ? 'bg-blue-50/50' : ''}`}>
                            <td className="p-3 text-center"><input type="checkbox" checked={dbSelectedIds.has(act.id)} onChange={() => toggleDbSelect(act.id)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" /></td>
                            <td className="p-3"><div className="font-bold text-slate-800">{act.verifiedClass} ({act.verifiedClassNo})</div><div className="text-slate-500">{act.verifiedName}</div></td>
                            {editingId === act.id ? (
                                <>
                                    <td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.activity} onChange={e => setEditFormData({...editFormData, activity: e.target.value})} /></td>
                                    <td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.time} onChange={e => setEditFormData({...editFormData, time: e.target.value})} /></td>
                                    <td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} /></td>
                                    <td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.dateText} onChange={e => setEditFormData({...editFormData, dateText: e.target.value})} /></td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => saveEditActivity(act.id)} className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200"><CheckCircle size={18} /></button>
                                            <button onClick={cancelEdit} className="bg-slate-100 text-slate-600 p-1 rounded hover:bg-slate-200"><X size={18} /></button>
                                        </div>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="p-3 font-bold text-blue-700">{act.activity}</td>
                                    <td className="p-3">{act.time}</td>
                                    <td className="p-3">{act.location}</td>
                                    <td className="p-3 text-slate-500">{act.dateText}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button 
                                                title="新增學生名單" 
                                                onClick={() => handleOpenAddStudentModal(act)} 
                                                className="text-green-600 hover:text-green-800 p-1 flex items-center gap-1 text-xs font-bold bg-green-50 hover:bg-green-100 px-2 py-1 rounded transition border border-green-200 mr-1"
                                            >
                                                <PlusCircle size={14} />
                                                <span>新增學生名單</span>
                                            </button>
                                            <button title="編輯" onClick={() => startEditActivity(act)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button>
                                            <button title="刪除" onClick={() => handleDeleteActivity(act.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                    {filteredDbActivities.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">沒有符合搜尋的資料。</td></tr>}
                </tbody>
            </table>
        </div>

        {/* 「新增學生名單」 - Pop-up Window 彈窗 */}
        {isAddStudentModalOpen && targetActivityForAdd && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4 border-b pb-3">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <PlusCircle size={20} className="mr-2 text-green-600" />
                            新增學生名單 - {targetActivityForAdd.activity}
                        </h3>
                        <button onClick={() => setIsAddStudentModalOpen(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 text-slate-600 border">
                            <div><span className="font-bold">時間：</span>{targetActivityForAdd.time || '未定'}</div>
                            <div><span className="font-bold">地點：</span>{targetActivityForAdd.location || '未定'}</div>
                            <div><span className="font-bold">備註/日期：</span>{targetActivityForAdd.dateText || '未定'}</div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase flex justify-between mb-1">
                                <span>貼上學生名單</span>
                                <span className="text-blue-500 flex items-center" title="格式: 3B 20 温小文 自行回家 91400040">
                                    <FileText size={12} className="mr-1"/> 格式範例
                                </span>
                            </label>
                            <textarea 
                                className="w-full h-36 p-2 border rounded-lg bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none" 
                                placeholder={`3B 20 温小文 自行回家 91400040\n4A 05 蔡舒朗 自行回家 91234567`} 
                                value={addStudentBulkInput} 
                                onChange={e => setAddStudentBulkInput(e.target.value)}
                            ></textarea>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-3 border-t">
                        <button 
                            onClick={() => setIsAddStudentModalOpen(false)}
                            className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-bold transition"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleConfirmAddStudentModal}
                            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-md transition"
                        >
                            識別並載入
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* 按活動班整體改期 Modal */}
        {isGroupModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4 border-b pb-3">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <RefreshCcw size={20} className="mr-2 text-orange-500" />
                            按活動班整體改期 (選單模式)
                        </h3>
                        <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">選擇活動班</label>
                            <select 
                                className="w-full p-2.5 border rounded-lg bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                                value={groupActivityName}
                                onChange={(e) => handleSelectGroupActivity(e.target.value)}
                            >
                                {uniqueActivities.map(act => (
                                    <option key={act} value={act}>{act}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">上課時間</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={groupTime}
                                    onChange={(e) => setGroupTime(e.target.value)}
                                    placeholder="例如: 15:30-16:30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">地點</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={groupLocation}
                                    onChange={(e) => setGroupLocation(e.target.value)}
                                    placeholder="例如: 禮堂"
                                />
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                日期管理 (可個別新增或刪除)
                            </label>
                            
                            <div className="flex gap-2 mb-3">
                                <input 
                                    type="text" 
                                    placeholder="DDMM (如 0209) 或 YYYY-MM-DD" 
                                    className="flex-1 p-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-500"
                                    value={groupTempDateInput}
                                    onChange={(e) => setGroupTempDateInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroupDate(); } }}
                                />
                                <button 
                                    onClick={handleAddGroupDate}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center transition shadow-sm"
                                >
                                    <Plus size={16} className="mr-1" /> 新增日期
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-white border border-slate-200 rounded-lg min-h-[60px]">
                                {groupDates.length > 0 ? groupDates.map(d => (
                                    <span key={d} className="bg-orange-100 text-orange-900 border border-orange-200 text-xs px-2.5 py-1 rounded-full flex items-center font-bold shadow-sm">
                                        {formatDisplayDate(d)} ({d})
                                        <button 
                                            onClick={() => handleRemoveGroupDate(d)} 
                                            className="ml-1.5 text-orange-400 hover:text-red-600 transition"
                                            title="刪除此日期"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                )) : (
                                    <div className="w-full text-center text-xs text-slate-400 py-3 italic">尚無設定任何特定日期</div>
                                )}
                            </div>

                            <div className="mt-2 text-xs text-slate-500 font-bold flex justify-between items-center">
                                <span>堂數統計: 共 {groupDates.length} 堂</span>
                                {groupDates.length > 0 && (
                                    <button onClick={() => setGroupDates([])} className="text-red-500 hover:underline">清空所有日期</button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-3 border-t">
                        <button 
                            onClick={() => setIsGroupModalOpen(false)}
                            className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-bold transition"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleSaveGroupReschedule}
                            className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold shadow-md transition"
                        >
                            儲存並同步更新全班
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  const renderAdminView = () => (
      <div className="min-h-screen bg-slate-100 p-6 flex-1">
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-2xl font-bold text-slate-800 flex items-center"><Shield className="mr-2" /> 管理員控制台</h2><p className="text-slate-500 text-sm">數據校對與發布。</p></div>
                <div className="flex items-center space-x-4"><div className="bg-white px-4 py-2 rounded-lg shadow text-sm font-mono text-slate-600 border border-slate-200">Admin: <span className="font-bold text-blue-600">{user.email}</span></div><button onClick={handleLogout} className="bg-red-50 text-red-500 px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200 flex items-center text-sm font-bold"><LogOut size={16} className="mr-2"/> 登出</button></div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleMasterFileChange} />
            {adminTab === 'manage_db' ? renderDatabaseManager() : adminTab === 'stats' ? (
                <StatsView masterList={masterList} activities={activities} queryLogs={queryLogs} onBack={() => setAdminTab('import')} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4"><div className="flex items-center space-x-3"><h3 className="font-bold text-lg text-green-700 flex items-center"><CheckCircle className="mr-2" size={20} /> 等待發布 ({matched.length})</h3><button onClick={toggleSelectAll} className="text-sm text-slate-500 flex items-center hover:text-slate-800">{selectedMatchIds.size === matched.length ? <CheckSquare size={16} className="mr-1"/> : <Square size={16} className="mr-1"/>}全選/取消</button></div>{matched.length > 0 && (<button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center shadow-md active:scale-95 transition"><Save size={18} className="mr-2" /> 發布選取項目 ({selectedMatchIds.size})</button>)}</div>
                        <div className="bg-green-50 rounded-lg border border-green-100 max-h-96 overflow-y-auto"><table className="w-full text-sm"><thead className="bg-green-100/50 text-green-800 sticky top-0 border-b border-green-200"><tr><th className="py-2 px-2 w-8"></th><th className="py-2 px-4 text-left w-1/3">PDF Source</th><th className="py-2 px-4 text-center w-10"></th><th className="py-2 px-4 text-left w-1/3">學生資料</th><th className="py-2 px-4 text-right">操作</th></tr></thead><tbody>
                            {matched.map(m => (<tr key={m.id} className={`border-b border-green-100 last:border-0 hover:bg-green-100/40 transition-colors ${selectedMatchIds.has(m.id) ? 'bg-green-100/20' : 'opacity-50'}`}><td className="py-3 px-2 text-center"><input type="checkbox" checked={selectedMatchIds.has(m.id)} onChange={() => toggleSelectMatch(m.id)} className="w-4 h-4 rounded text-green-600 focus:ring-green-500" /></td><td className="py-3 px-4"><div className="text-slate-500 text-xs uppercase mb-0.5">PDF Source</div><div className="font-medium text-slate-700">{m.rawClass} {m.rawName}</div><div className="text-xs text-red-400 font-mono">{m.rawClassNo === '00' ? '缺學號' : m.rawClassNo}</div>{m.rawPhone && <div className="text-xs text-blue-500 font-mono flex items-center mt-1"><Phone size={10} className="mr-1"/>{m.rawPhone}</div>}</td><td className="py-3 px-2 text-center text-slate-300"><ArrowRight size={16} /></td><td className="py-3 px-4 bg-green-100/30"><div className="text-green-600 text-xs uppercase font-bold flex items-center mb-0.5"><Database size={10} className="mr-1" /> Master Data</div><div className="font-bold text-green-700 text-lg flex items-center"><span className="mr-2">{m.verifiedClass}</span><span className="bg-white text-green-800 border border-green-200 px-1.5 rounded text-sm min-w-[24px] text-center mr-2">{m.verifiedClassNo}</span><span>{m.verifiedName}</span></div></td><td className="py-3 px-4 text-right"><button onClick={() => handleManualConflict(m.id)} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 flex items-center ml-auto"><AlertTriangle size={12} className="mr-1" /> 轉為異常</button><div className="text-xs text-slate-400 mt-1">{m.activity}</div>{m.specificDates && m.specificDates.length > 0 && <div className="text-xs bg-blue-100 text-blue-600 px-1 rounded inline-block mt-1">共 {m.specificDates.length} 堂</div>}</td></tr>))}
                        </tbody></table></div>
                    </div>
                    {conflicts.length > 0 && (<div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500 animate-pulse-border"><h3 className="font-bold text-lg text-red-700 flex items-center mb-4"><AlertTriangle className="mr-2" /> 異常資料需修正 ({conflicts.length})</h3><div className="space-y-3">{conflicts.map(item => (<div key={item.id} className="border border-red-100 rounded-lg p-4 bg-red-50/50 flex flex-col md:flex-row items-center justify-between gap-4"><div className="flex-1"><div className="font-bold text-slate-800">{item.rawClass} {item.rawName}</div><div className="text-xs text-slate-500">{item.activity} {item.rawPhone && `| ${item.rawPhone}`}</div>{item.status === 'manual_conflict' && <div className="text-xs text-red-600 font-bold mt-1">* 人手標記異常</div>}</div><ArrowRight className="text-slate-300 md:rotate-0 rotate-90" /><div className="flex-1 w-full"><select className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm" onChange={(e) => { if(e.target.value) { const student = masterList.find(s => s.key === e.target.value); if(student) handleResolveConflict(item, student); }}} defaultValue=""><option value="" disabled>-- 選擇正確學生 --</option><optgroup label="智能推薦">{masterList.filter(s => s.classCode === item.rawClass || s.chiName.includes(item.rawName[0])).map(s => (<option key={s.key} value={s.key}>{s.classCode} ({s.classNo}) {s.chiName}</option>))}</optgroup><optgroup label="全部名單"><option value="search">...</option></optgroup></select></div><button onClick={() => handleDeleteImport(item.id)} className="p-2 text-red-400 hover:bg-red-100 rounded"><Trash2 size={18} /></button></div>))}</div></div>)}
                </div>
                <div className="space-y-6">
                    <div className="bg-slate-800 text-slate-300 p-6 rounded-xl shadow-md border border-slate-700">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-white flex items-center"><Database className="mr-2" size={16}/> 數據庫狀態</h3></div>
                        <div className="space-y-3"><button onClick={() => setAdminTab('manage_db')} className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg text-sm font-bold flex items-center justify-between transition"><span>管理活動資料庫</span><span className="bg-blue-600 text-xs px-2 py-1 rounded">{activities.length}</span></button><button onClick={() => setAdminTab('stats')} className="w-full bg-purple-700 hover:bg-purple-600 text-white p-3 rounded-lg text-sm font-bold flex items-center justify-center transition shadow-lg"><BarChart className="mr-2" size={16} /> 查看統計報表</button></div>
                        <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500 text-center flex items-center justify-center">
                            {isMasterLoading ? <RefreshCcw className="animate-spin mr-2"/> : null} 學生總數: {masterList.length}
                        </div>
                    </div>
                    <div className="flex justify-end mb-1"><select className="text-xs p-1 border border-slate-300 rounded bg-white text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500" value={csvEncoding} onChange={(e) => setCsvEncoding(e.target.value)}><option value="Big5">CSV 編碼: Big5 (解決 Excel 亂碼)</option><option value="UTF-8">CSV 編碼: UTF-8 (通用格式)</option></select></div>
                    <button onClick={handleMasterUploadTrigger} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl flex items-center justify-center font-bold shadow-md transition"><Cloud className="mr-2" /> 上載年度學生資料</button>
                    <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center"><PlusCircle className="mr-2 text-blue-500" /> 新增活動資料</h3>
                            <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">
                                年度: <select className="bg-transparent font-bold outline-none" value={schoolYearStart} onChange={handleSchoolYearChange}><option value={2024}>24-25</option><option value={2025}>25-26</option><option value={2026}>26-27</option></select>
                            </div>
                        </div>
                        <div className="space-y-3 mb-4">
                            <div><label className="text-xs text-slate-500 font-bold uppercase">活動名稱</label><input type="text" className="w-full p-2 border rounded" value={importActivity} onChange={e => setImportActivity(e.target.value)} /></div>
                            <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-slate-500 font-bold uppercase">時間</label><input type="text" className="w-full p-2 border rounded" value={importTime} onChange={e => setImportTime(e.target.value)} /></div><div><label className="text-xs text-slate-500 font-bold uppercase">地點</label><input type="text" className="w-full p-2 border rounded" value={importLocation} onChange={e => setImportLocation(e.target.value)} /></div></div>
                            <div className="border border-slate-200 rounded p-3 bg-slate-50"><label className="text-xs text-slate-500 font-bold uppercase mb-2 block">選擇日期 (輸入 0209 代表 9月2日)</label><div className="flex gap-2 mb-2"><input type="text" ref={dateInputRef} placeholder="DDMM (如 0209)" className="flex-1 p-2 border rounded text-sm" value={tempDateInput} onChange={(e) => setTempDateInput(e.target.value)} onKeyDown={handleDateInputKeyDown} /><button onClick={handleAddDate} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center"><Plus size={16} /></button></div><div className="flex flex-wrap gap-2 mb-2">{importDates.map(date => (<span key={date} className="bg-white border border-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center shadow-sm">{formatDisplayDate(date)}<button onClick={() => handleRemoveDate(date)} className="ml-1 text-blue-400 hover:text-red-500"><X size={12} /></button></span>))}</div><div className="flex justify-between items-center text-xs"><span className="font-bold text-slate-600">已選: {importDates.length} 天 (共{importDates.length}堂)</span>{importDates.length > 0 && <button onClick={handleClearDates} className="text-red-400 hover:underline">清空</button>}</div></div>
                            
                            <div>
                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">星期 (可多選)</label>
                                <div className="flex gap-2 flex-wrap">
                                    {[{id:1, label:'一'}, {id:2, label:'二'}, {id:3, label:'三'}, {id:4, label:'四'}, {id:5, label:'五'}, {id:6, label:'六'}, {id:0, label:'日'}].map(day => { 
                                        const isSelected = importDayIds.includes(day.id); 
                                        return (
                                            <button 
                                                key={day.id} 
                                                onClick={() => { 
                                                    if (isSelected) { 
                                                        setImportDayIds(importDayIds.filter(d => d !== day.id)); 
                                                    } else { 
                                                        setImportDayIds([...importDayIds, day.id].sort()); 
                                                    } 
                                                }} 
                                                className={`px-3 py-1.5 rounded text-sm font-bold transition ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {day.label}
                                            </button>
                                        ); 
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-xs text-slate-500 font-bold uppercase flex justify-between">
                                <span>貼上名單 (PDF Copy/Paste)</span>
                                <span className="text-blue-500 cursor-pointer flex items-center" title="格式: 3B 20 温小文 自行回家 91400040 或 3B 20 温小文 自 91400040">
                                    <FileText size={12} className="mr-1"/> 說明
                                </span>
                            </label>
                            <textarea 
                                className="w-full h-32 p-2 border rounded bg-slate-50 text-sm font-mono" 
                                placeholder={`3B 20 温小文 自行回家 91400040\n4A 05 蔡舒朗 家長接送 91234567`} 
                                value={bulkInput} 
                                onChange={e => setBulkInput(e.target.value)}
                            ></textarea>
                            <button onClick={handleBulkImport} className="w-full mt-2 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition">識別並處理名單</button>
                        </div>
                    </div>
                </div>
            )
        </div>
            )}
            </div>
      </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      {renderTopNavBar()}
      {currentView === 'student' && renderStudentView()}
      {currentView === 'kiosk_result' && renderKioskResultView()}
      {currentView === 'staff' && (user ? renderStaffView() : renderLoginView())}
      {currentView === 'admin' && (user ? renderAdminView() : renderLoginView())}
    </div>
  );
};

export default App;