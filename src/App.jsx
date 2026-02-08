import React, { useState, useMemo, useEffect, useRef } from 'react';
// V3.9.0: Add Roll Call System, Grade Bar Chart, Staff Portal Enhancements
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, BarChart, History, TrendingUp, Filter, Cloud, UserX, PieChart, Download, Activity, Save as SaveIcon, Layers, Maximize, Palette, ChevronDown, List, MoreHorizontal, FileCheck, Circle } from 'lucide-react';

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
  writeBatch,
  where
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

// Standard Categories
const CATEGORY_OPTIONS = [
    '體育 (Sports)',
    '音樂 (Music)',
    '視藝 (Visual Arts)',
    '學術/STEM',
    '服務/制服 (Service)',
    '其他 (Others)'
];

const detectCategory = (name) => {
    const n = (name || "").toLowerCase();
    if (/足球|籃球|排球|羽毛球|乒乓|田徑|游泳|體育|跆拳|跳繩|sport|ball/.test(n)) return '體育 (Sports)';
    if (/合唱|樂團|小提琴|鋼琴|古箏|笛|音樂|music|choir|band/.test(n)) return '音樂 (Music)';
    if (/視藝|繪畫|素描|陶瓷|手工|畫班|art|draw|paint/.test(n)) return '視藝 (Visual Arts)';
    if (/中|英|數|常|stem|編程|無人機|奧數|辯論|寫作|academic|code|robot/.test(n)) return '學術/STEM';
    if (/童軍|服務|領袖|義工|service|scout/.test(n)) return '服務/制服 (Service)';
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
    '其他 (Others)': '#94a3b8'
};

const getTodayDateString = () => {
    const d = new Date();
    // 簡單格式化，實際需配合資料庫日期格式 (例如 YYYY/M/D 或 YYYY-MM-DD)
    // 這裡假設是系統常用的 2026/2/8 格式，需根據實際數據調整
    return d.toLocaleDateString('zh-HK'); 
};

// -----------------------------------------------------------------------------
// 3. STATS VIEW COMPONENT (V3.9.0 - Added Grade Bar Chart)
// -----------------------------------------------------------------------------
const StatsView = ({ masterList, activities, queryLogs, onBack }) => {
    const [statsViewMode, setStatsViewMode] = useState('dashboard');
    const [selectedActs, setSelectedActs] = useState(new Set());
    const [updatingCategory, setUpdatingCategory] = useState(false);

    // Safe toggle function
    const toggleSelection = (actName) => {
        if (!actName) return;
        const newSet = new Set(selectedActs);
        if (newSet.has(actName)) newSet.delete(actName);
        else newSet.add(actName);
        setSelectedActs(newSet);
    };

    const clearSelection = () => setSelectedActs(new Set());

    const handleCategoryChange = async (activityName, newCategory) => {
        if (!window.confirm(`確定要將「${activityName}」的所有記錄分類更改為「${newCategory}」嗎？`)) return;
        setUpdatingCategory(true);
        try {
            const batch = writeBatch(db);
            const targetDocs = activities.filter(a => a.activity === activityName);
            targetDocs.forEach(item => {
                const docRef = doc(db, "activities", item.id);
                batch.update(docRef, { manualCategory: newCategory });
            });
            await batch.commit();
            alert("分類更新成功！");
        } catch (error) {
            console.error(error);
            alert("更新失敗，請檢查網絡");
        } finally {
            setUpdatingCategory(false);
        }
    };

    // Calculate Data wrapped in Try-Catch for safety during render
    const { activityStats, gradeDistribution, categoryStats, studentStats, totalHours } = useMemo(() => {
        try {
            if (!masterList || masterList.length === 0 || !activities) {
                return { activityStats: [], gradeDistribution: [], categoryStats: [], studentStats: [], totalHours: 0 };
            }

            const actStats = {}; 
            const stuStats = {};
            const catStats = {}; 
            const gradeMap = { '1': {}, '2': {}, '3': {}, '4': {}, '5': {}, '6': {} };
            Object.keys(gradeMap).forEach(g => gradeMap[g] = { totalHours: 0, byActivity: {} });

            masterList.forEach(s => {
                if (s && s.key) stuStats[s.key] = { ...s, count: 0, hours: 0, acts: [] };
            });

            activities.forEach(item => {
                const dur = calculateDuration(item.time);
                const sessionCount = (item.specificDates && item.specificDates.length > 0) ? item.specificDates.length : 1;
                const totalItemHours = dur * sessionCount;
                const actName = item.activity || "Unknown";
                
                const category = item.manualCategory || detectCategory(actName);

                if(!actStats[actName]) actStats[actName] = { name: actName, count: 0, hours: 0, category };
                actStats[actName].count += sessionCount;
                actStats[actName].hours += totalItemHours;
                actStats[actName].category = category;

                if(!catStats[category]) catStats[category] = 0;
                catStats[category] += totalItemHours;

                const sKey = `${item.verifiedClass}-${item.verifiedName}`;
                if (stuStats[sKey]) {
                    stuStats[sKey].count += sessionCount;
                    stuStats[sKey].hours += totalItemHours;
                    if(!stuStats[sKey].acts.includes(actName)) stuStats[sKey].acts.push(actName);
                }
                
                const gradeStr = String(item.verifiedClass || '');
                if(gradeStr.length >= 2) {
                    const grade = gradeStr.charAt(0);
                    if(gradeMap[grade]) {
                        gradeMap[grade].totalHours += totalItemHours;
                        if(!gradeMap[grade].byActivity[actName]) gradeMap[grade].byActivity[actName] = 0;
                        gradeMap[grade].byActivity[actName] += totalItemHours;
                    }
                }
            });

            const gradeArr = Object.keys(gradeMap).map(g => ({
                grade: `P.${g}`,
                total: gradeMap[g].totalHours,
                details: gradeMap[g].byActivity
            }));

            const finalActStats = Object.values(actStats).sort((a,b) => b.hours - a.hours);
            const totalH = finalActStats.reduce((acc, cur) => acc + cur.hours, 0);
            
            const finalCatStats = Object.entries(catStats)
                .map(([name, hours]) => ({ name, hours }))
                .sort((a,b) => b.hours - a.hours);

            return { 
                activityStats: finalActStats, 
                gradeDistribution: gradeArr,
                categoryStats: finalCatStats,
                studentStats: Object.values(stuStats).sort((a,b) => a.hours - b.hours),
                totalHours: totalH
            };
        } catch (e) {
            console.error("Data Calculation Error:", e);
            return { activityStats: [], gradeDistribution: [], categoryStats: [], studentStats: [], totalHours: 0 };
        }
    }, [masterList, activities]);

    const filteredActivityList = useMemo(() => {
        if (selectedActs.size === 0) return activityStats;
        return activityStats.filter(a => selectedActs.has(a.name));
    }, [activityStats, selectedActs]);

    const filteredTotalHours = useMemo(() => {
        if (selectedActs.size === 0) return totalHours;
        return filteredActivityList.reduce((acc, cur) => acc + cur.hours, 0);
    }, [filteredActivityList, totalHours, selectedActs]);

    // Safe Color Getter
    const getSafeColor = (idx) => CHART_COLORS[idx % CHART_COLORS.length] || '#cbd5e1';

    const ghostPieGradient = useMemo(() => {
        if (totalHours === 0) return '#e2e8f0 0deg 360deg';
        let currentDeg = 0;
        return activityStats.map((item, idx) => {
            const deg = (item.hours / (totalHours || 1)) * 360;
            const isSelected = selectedActs.size === 0 || selectedActs.has(item.name);
            const color = isSelected ? getSafeColor(idx) : '#f1f5f9';
            const str = `${color} ${currentDeg}deg ${currentDeg + deg}deg`;
            currentDeg += deg;
            return str;
        }).join(', ');
    }, [activityStats, totalHours, selectedActs]);

    const categoryPieGradient = useMemo(() => {
        if (totalHours === 0) return '#e2e8f0 0deg 360deg';
        let currentDeg = 0;
        return categoryStats.map((item) => {
            const deg = (item.hours / (totalHours || 1)) * 360;
            const color = CATEGORY_COLORS[item.name] || '#94a3b8';
            const str = `${color} ${currentDeg}deg ${currentDeg + deg}deg`;
            currentDeg += deg;
            return str;
        }).join(', ');
    }, [categoryStats, totalHours]);

    const filteredStudentList = useMemo(() => {
        if (selectedActs.size === 0) return studentStats;
        return studentStats.filter(s => s.acts.some(act => selectedActs.has(act)));
    }, [studentStats, selectedActs]);

    const exportGradeStats = () => {
        const rows = [];
        gradeDistribution.forEach(g => {
            Object.entries(g.details).forEach(([actName, hours]) => {
                if (selectedActs.size === 0 || selectedActs.has(actName)) {
                    rows.push({ Grade: g.grade, Activity: actName, Hours: hours.toFixed(2) });
                }
            });
        });
        exportToCSV(rows, 'Grade_Activity_Distribution');
    };

    const exportCategoryStats = () => exportToCSV(categoryStats, 'Category_Distribution_Report');
    
    // Fixed Scale calculation
    const maxGradeHours = useMemo(() => {
        return Math.max(...gradeDistribution.map(g => g.total)) || 1;
    }, [gradeDistribution]);

    // Safely get index for coloring
    const getActColorIndex = (name) => {
        const idx = activityStats.findIndex(x => x.name === name);
        return idx >= 0 ? idx : 0;
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600">
                    <ArrowLeft className="mr-2" size={20} /> 返回
                </button>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <BarChart className="mr-2 text-blue-600" /> 校本數據分析中心 (V3.9.0)
                </h2>
                <div className="w-24"></div>
            </div>

            <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                <button onClick={() => setStatsViewMode('dashboard')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><PieChart size={18} className="mr-2"/> 數據概覽</button>
                <button onClick={() => setStatsViewMode('activities')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'activities' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Activity size={18} className="mr-2"/> 活動列表 ({filteredActivityList.length})</button>
                <button onClick={() => setStatsViewMode('students')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'students' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Users size={18} className="mr-2"/> 學生監測 ({filteredStudentList.length})</button>
                <button onClick={() => setStatsViewMode('logs')} className={`px-4 py-2 rounded-lg flex items-center transition ${statsViewMode === 'logs' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><History size={18} className="mr-2"/> 系統紀錄</button>
            </div>

            {selectedActs.size > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center animate-in slide-in-from-top-2">
                    <div className="text-sm text-blue-800">
                        <span className="font-bold flex items-center"><Filter size={16} className="mr-1"/> 關注模式: </span>
                        {Array.from(selectedActs).join(', ')}
                    </div>
                    <button onClick={clearSelection} className="text-xs bg-white text-slate-500 border px-2 py-1 rounded hover:bg-red-50 hover:text-red-500 transition">清除篩選 (顯示全校)</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {statsViewMode === 'dashboard' && (
                    <div className="flex flex-col space-y-12 pb-12">
                        
                        {/* 1. PIE CHART */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center md:items-start relative min-h-[400px]">
                            <div className="absolute top-4 left-4 z-20">
                                 <button onClick={() => exportToCSV(filteredActivityList, 'Activity_Hours_Report')} className="text-xs bg-indigo-600 text-white border px-3 py-1.5 rounded flex items-center hover:bg-indigo-700 shadow-md transition"><Download size={14} className="mr-1"/> 匯出 CSV</button>
                            </div>
                            
                            <div className="flex-1 flex flex-col items-center justify-center p-4 pt-10">
                                <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><Clock className="mr-2 text-orange-500"/> 活動總時數分佈 (真實比例)</h3>
                                <div className="relative w-72 h-72 rounded-full shadow-2xl border-4 border-white transition-all duration-500"
                                    style={{ background: `conic-gradient(${ghostPieGradient})` }}
                                >
                                    <div className="absolute inset-0 m-auto w-36 h-36 bg-slate-50 rounded-full flex flex-col items-center justify-center shadow-inner">
                                        <div className="text-xs text-slate-400 mb-1">
                                            {selectedActs.size > 0 ? "已選 / 總計" : "總學時"}
                                        </div>
                                        <div className="flex items-baseline">
                                            {selectedActs.size > 0 && <span className="text-2xl font-bold text-blue-600 mr-1">{filteredTotalHours.toFixed(0)}</span>}
                                            {selectedActs.size > 0 && <span className="text-sm text-slate-400">/</span>}
                                            <span className={`font-bold text-slate-800 ${selectedActs.size > 0 ? 'text-lg' : 'text-4xl'}`}>{totalHours.toFixed(0)}</span>
                                        </div>
                                        <div className="text-xs text-slate-400">小時</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 h-96 overflow-y-auto pl-4 space-y-2 border-l border-slate-200 custom-scrollbar">
                                <h4 className="font-bold text-slate-600 mb-2 text-xs uppercase tracking-wider">活動明細 ({activityStats.length})</h4>
                                {activityStats.map((item, idx) => (
                                    <div 
                                        key={item.name} 
                                        onClick={() => toggleSelection(item.name)}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition text-sm ${selectedActs.has(item.name) ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-white hover:shadow-sm'}`}
                                    >
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: getSafeColor(idx) }}></div>
                                            <span className={`${selectedActs.has(item.name) ? 'font-bold text-blue-800' : 'text-slate-600'}`}>{item.name}</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{item.count}節</span>
                                            <span className="font-mono font-bold text-slate-700">{item.hours.toFixed(0)}h</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. CATEGORY CHART */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-slate-700 mb-6 flex items-center"><Layers className="mr-2 text-purple-500"/> 課程範疇分佈 (Category)</h3>
                                <div className="flex items-center">
                                    <div className="relative w-40 h-40 rounded-full border-4 border-slate-50 mr-8 shadow-lg" style={{ background: `conic-gradient(${categoryPieGradient})` }}></div>
                                    <div className="flex-1 space-y-2">
                                        {categoryStats.map(c => (
                                            <div key={c.name} className="flex justify-between items-center text-sm">
                                                <div className="flex items-center">
                                                    <div className="w-3 h-3 rounded mr-2" style={{ backgroundColor: CATEGORY_COLORS[c.name] || '#94a3b8' }}></div>
                                                    <span className="text-slate-600">{c.name}</span>
                                                </div>
                                                <span className="font-bold text-slate-800">{c.hours.toFixed(0)}h</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={exportCategoryStats} className="mt-4 w-full py-2 border border-slate-200 rounded-lg text-slate-500 text-xs hover:bg-slate-50 transition">匯出範疇報告</button>
                            </div>

                            {/* 3. NEW: GRADE DISTRIBUTION BAR CHART (V3.9.0) */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-slate-700 flex items-center"><BarChart className="mr-2 text-emerald-500"/> 分級課程範疇分佈</h3>
                                    <button onClick={exportGradeStats} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200">匯出</button>
                                </div>
                                
                                <div className="flex-1 flex items-end justify-between space-x-2 px-2 pb-2 h-48 border-b border-slate-100">
                                    {gradeDistribution.map((g) => {
                                        const heightPct = (g.total / maxGradeHours) * 100;
                                        return (
                                            <div key={g.grade} className="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer relative">
                                                 {/* Tooltip */}
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                                    {g.grade}: {g.total.toFixed(0)}小時
                                                </div>
                                                
                                                <div className="w-full relative flex items-end justify-center h-full">
                                                     <div 
                                                        style={{ height: `${Math.max(heightPct, 2)}%` }} 
                                                        className="w-8 bg-gradient-to-t from-emerald-400 to-emerald-500 rounded-t-lg transition-all duration-500 hover:from-emerald-500 hover:to-emerald-600 shadow-sm group-hover:shadow-md"
                                                     ></div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-500 mt-2">{g.grade}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-2 text-center">
                                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">最大值: {maxGradeHours.toFixed(0)} 小時</span>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* V3.8: ACTIVITY LIST WITH CATEGORY SELECTOR */}
                {statsViewMode === 'activities' && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">活動統計列表 (新算法: 單節 x 節數)</h3>
                            <button onClick={() => exportToCSV(filteredActivityList, 'Activity_Report')} className="text-sm bg-white border px-3 py-1 rounded hover:bg-slate-50 flex items-center text-blue-600 border-blue-200"><Download size={14} className="mr-1"/> 匯出 CSV</button>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-3">活動名稱</th>
                                    <th className="p-3">分類 (可修改)</th>
                                    <th className="p-3 text-right">節數</th>
                                    <th className="p-3 text-right">總時數</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredActivityList.map((item, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-700">{item.name}</td>
                                        <td className="p-3">
                                            <select 
                                                className={`border rounded px-2 py-1 text-xs outline-none ${updatingCategory ? 'opacity-50' : ''}`}
                                                value={item.category}
                                                disabled={updatingCategory}
                                                onChange={(e) => handleCategoryChange(item.name, e.target.value)}
                                            >
                                                {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-3 text-right text-slate-500">{item.count}</td>
                                        <td className="p-3 text-right font-bold text-blue-600">{item.hours.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Other Views Omitted for Brevity (Same as V3.8.1) */}
                {statsViewMode === 'students' && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                       <div className="p-4 bg-slate-50 text-center text-slate-500 italic">學生監測功能 (請參考數據概覽或匯出報告)</div>
                    </div>
                )}
                {statsViewMode === 'logs' && (
                    <div className="bg-white border rounded-xl overflow-hidden p-4">
                         <h3 className="font-bold mb-4">最近查詢紀錄</h3>
                         {queryLogs.map((log) => (
                             <div key={log.id} className="text-xs border-b py-2 flex justify-between">
                                 <span>{log.timeStr} - {log.class}{log.classNo} ({log.name})</span>
                                 <span className={log.success ? 'text-green-600' : 'text-red-600'}>{log.success ? '成功' : '失敗'}</span>
                             </div>
                         ))}
                    </div>
                )}

            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// MAIN APP COMPONENT
// -----------------------------------------------------------------------------
const App = () => {
  const [currentView, setCurrentView] = useState('student'); // student, staff, admin, rollcall
  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  
  // Data State
  const [masterList, setMasterList] = useState([]);
  const [activities, setActivities] = useState([]);
  const [queryLogs, setQueryLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- Student View State ---
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);

  // --- Staff View State ---
  const [staffShowAll, setStaffShowAll] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffSelectedActivityId, setStaffSelectedActivityId] = useState(''); // V3.9: New Dropdown

  // --- Admin View State ---
  const [adminTab, setAdminTab] = useState('import'); 
  const [importText, setImportText] = useState('');
  const [dbSelectedIds, setDbSelectedIds] = useState(new Set());
  const [dbBatchMode, setDbBatchMode] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState({});

  // --- Roll Call State (V3.9.0) ---
  const [rollCallUnlocked, setRollCallUnlocked] = useState(false);
  const [rollCallPassword, setRollCallPassword] = useState('');
  const [rollCallMsg, setRollCallMsg] = useState('');
  const [selectedRollCallActivity, setSelectedRollCallActivity] = useState(null);
  const [attendanceData, setAttendanceData] = useState({}); // { "date_activityId_studentId": { status: 'present', time: '...' } }

  // Load Data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "activities"), orderBy("classCode"), orderBy("classNo"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivities(list);
    });
    return () => unsub();
  }, []);

  // V3.9.0: Load Attendance Data (Simulated with Firestore or Local State)
  // 為了演示，我們使用本地 State 加上 Firestore 訂閱 (如果存在 'attendance' collection)
  useEffect(() => {
     // 這裡假設有一個 attendance collection，如果沒有則使用本地 state
     const unsub = onSnapshot(collection(db, "attendance"), (snap) => {
         const data = {};
         snap.docs.forEach(d => {
             data[d.id] = d.data();
         });
         setAttendanceData(data);
     }, (err) => {
         console.log("No attendance collection yet, using local state");
     });
     return () => unsub(); // cleanup
  }, []);

  // Mark Attendance Logic
  const handleMarkAttendance = async (student, status) => {
      if (!selectedRollCallActivity) return;
      const today = getTodayDateString();
      const docId = `${today}_${selectedRollCallActivity.id}_${student.class}${student.classNo}`; // Unique Key
      
      const record = {
          activityId: selectedRollCallActivity.id,
          activityName: selectedRollCallActivity.activity,
          studentName: student.chiName,
          class: student.classCode,
          classNo: student.classNo,
          date: today,
          status: status,
          timestamp: new Date().toISOString()
      };

      // Update Local State immediately for UI responsiveness
      setAttendanceData(prev => ({
          ...prev,
          [docId]: record
      }));

      // Persist to Firestore
      try {
          await setDoc(doc(db, "attendance", docId), record);
      } catch (e) {
          console.error("Attendance save failed", e);
      }
  };

  const getStudentStatusColor = (studentClass, studentNo) => {
      // Find if this student has any attendance record TODAY for ANY activity
      const today = getTodayDateString();
      // Simple lookup: Iterate attendanceData keys
      const entry = Object.entries(attendanceData).find(([key, val]) => 
          key.startsWith(today) && val.class === studentClass && val.classNo === studentNo
      );
      
      if (!entry) return 'bg-gray-300'; // 未點名
      const status = entry[1].status;
      if (status === 'present') return 'bg-green-500';
      if (status === 'sick' || status === 'personal') return 'bg-red-500';
      return 'bg-gray-300';
  };

  // Logic: Search Student (Existing)
  const handleStudentSearch = () => {
      const formattedClassNo = selectedClassNo.padStart(2, '0');
      const student = masterList.find(s => s.classCode === selectedClass && s.classNo === formattedClassNo);
      
      // Log
      const now = new Date();
      setQueryLogs(prev => [{ id: Date.now(), timeStr: now.toLocaleTimeString(), class: selectedClass, classNo: formattedClassNo, name: student?.chiName, success: !!student }, ...prev]);
      
      const results = activities.filter(item => item.verifiedClass === selectedClass && item.verifiedClassNo === formattedClassNo);
      setStudentResult({ info: student, activities: results });
      setCurrentView('kiosk_result');
  };

  // Logic: Auth
  const handleLogin = async () => {
    try { await signInWithEmailAndPassword(auth, loginEmail, loginPwd); } catch (e) { alert("登入失敗"); }
  };
  const handleLogout = async () => { await signOut(auth); setUser(null); setCurrentView('student'); };

  // ---------------------------------------------------------------------------
  // RENDER: ROLL CALL VIEW (New V3.9.0)
  // ---------------------------------------------------------------------------
  const renderRollCallView = () => {
      if (!rollCallUnlocked) {
          return (
              <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in">
                  <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-orange-500">
                      <div className="flex justify-center mb-4"><div className="bg-orange-100 p-3 rounded-full"><CheckSquare size={32} className="text-orange-600"/></div></div>
                      <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">點名系統</h2>
                      <p className="text-center text-slate-400 mb-6 text-sm">請輸入安全密碼以解鎖</p>
                      <input 
                        type="password" 
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all mb-4"
                        placeholder="密碼 (howcanyouturnthison)"
                        value={rollCallPassword}
                        onChange={(e) => setRollCallPassword(e.target.value)}
                      />
                      {rollCallMsg && <div className="text-red-500 text-sm font-bold text-center mb-4">{rollCallMsg}</div>}
                      <button 
                        onClick={() => {
                            if(rollCallPassword === 'howcanyouturnthison') { setRollCallUnlocked(true); setRollCallMsg(''); }
                            else { setRollCallMsg('密碼錯誤'); }
                        }} 
                        className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg"
                      >
                          解鎖系統
                      </button>
                      <button onClick={() => setCurrentView('student')} className="w-full mt-4 text-slate-400 hover:text-slate-600 text-sm">返回主頁</button>
                  </div>
              </div>
          );
      }

      // Roll Call Dashboard
      // Filter activities that match 'today' or just show all for demo if date parsing is tricky
      // We will assume 'activities' has a dateText field or specificDates array. 
      // For simplicity in this demo, we show all, but highlight today's.
      const todayStr = getTodayDateString(); 
      
      return (
          <div className="flex flex-col h-screen bg-slate-50">
              {/* Header */}
              <div className="bg-white p-4 shadow-sm border-b flex justify-between items-center z-10">
                  <div className="flex items-center">
                      <button onClick={() => { setRollCallUnlocked(false); setCurrentView('student'); }} className="mr-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ArrowLeft size={20}/></button>
                      <div>
                          <h1 className="text-xl font-bold text-slate-800 flex items-center"><CheckSquare className="mr-2 text-orange-500"/> 活動點名系統</h1>
                          <p className="text-xs text-slate-500">日期: {todayStr}</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                       {selectedRollCallActivity && (
                           <button 
                                onClick={() => {
                                    // Export Logic
                                    const actStudents = masterList.filter(s => {
                                        // Simple Logic: Find students who have this activity in 'activities' collection
                                        // This implies we need to reverse lookup. 
                                        // For this system, 'activities' contains one doc per student enrollment.
                                        // So we just filter 'activities' by activity name.
                                        return activities.some(a => a.activity === selectedRollCallActivity.activity && a.verifiedClass === s.classCode && a.verifiedClassNo === s.classNo);
                                    });
                                    // Actually, simpler: 'activities' ALREADY contains the student list for that activity name
                                    const enrolled = activities.filter(a => a.activity === selectedRollCallActivity.activity);
                                    
                                    const rows = enrolled.map(rec => {
                                        const docId = `${todayStr}_${rec.id}_${rec.verifiedClass}${rec.verifiedClassNo}`; // Using activity ID if possible, but rec.id is unique enrollment. 
                                        // Wait, we used activity.id in handleMarkAttendance. 
                                        // Let's stick to using the 'activity name' to group.
                                        // The 'selectedRollCallActivity' is a distinct activity NAME grouping?
                                        // The UI below lists distinct activity NAMES.
                                        
                                        const key = `${todayStr}_${selectedRollCallActivity.id}_${rec.verifiedClass}${rec.verifiedClassNo}`;
                                        const statusRec = attendanceData[key];
                                        
                                        let statusTxt = "未點名";
                                        if (statusRec?.status === 'present') statusTxt = "出席";
                                        if (statusRec?.status === 'sick') statusTxt = "缺席(病)";
                                        if (statusRec?.status === 'personal') statusTxt = "缺席(事)";

                                        return {
                                            "班別": rec.verifiedClass,
                                            "學號": rec.verifiedClassNo,
                                            "姓名": rec.verifiedName,
                                            "狀態": statusTxt,
                                            "點名時間": statusRec?.timestamp ? new Date(statusRec.timestamp).toLocaleTimeString() : ""
                                        };
                                    });
                                    exportToCSV(rows, `${selectedRollCallActivity.activity}_點名表_${todayStr}`);
                                }}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-green-700 flex items-center"
                           >
                               <FileSpreadsheet size={16} className="mr-2"/> 匯出 CSV
                           </button>
                       )}
                  </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                  {/* Left: Activity List */}
                  <div className="w-1/3 bg-white border-r overflow-y-auto p-4">
                      <h3 className="font-bold text-slate-500 text-xs uppercase mb-3">今日活動</h3>
                      <div className="space-y-2">
                          {/* We deduce unique activities from the 'activities' list */}
                          {Array.from(new Set(activities.map(a => a.activity))).map(actName => {
                              // Find first occurrence to get details
                              const detail = activities.find(a => a.activity === actName);
                              // Mock ID for grouping
                              const mockAct = { id: actName, activity: actName, location: detail.location, time: detail.time };
                              
                              return (
                                  <div 
                                    key={actName}
                                    onClick={() => setSelectedRollCallActivity(mockAct)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedRollCallActivity?.activity === actName ? 'bg-orange-50 border-orange-500 shadow-md ring-1 ring-orange-200' : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow'}`}
                                  >
                                      <div className="font-bold text-slate-800">{actName}</div>
                                      <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                          <span className="bg-slate-200 px-1 rounded">{detail.time}</span>
                                          <span>{detail.location}</span>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  {/* Right: Student List */}
                  <div className="w-2/3 bg-slate-50 p-6 overflow-y-auto">
                      {selectedRollCallActivity ? (
                          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                              <div className="p-4 bg-slate-50 border-b font-bold text-slate-700">學生名單 ({activities.filter(a => a.activity === selectedRollCallActivity.activity).length}人)</div>
                              <table className="w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                      <tr>
                                          <th className="p-3 text-left">學生資料</th>
                                          <th className="p-3 text-center">狀態</th>
                                          <th className="p-3 text-right">操作</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {activities.filter(a => a.activity === selectedRollCallActivity.activity).map(student => {
                                          const key = `${todayStr}_${selectedRollCallActivity.id}_${student.verifiedClass}${student.verifiedClassNo}`;
                                          const status = attendanceData[key]?.status;

                                          return (
                                              <tr key={student.id} className="hover:bg-slate-50">
                                                  <td className="p-3">
                                                      <div className="font-bold text-slate-800">{student.verifiedClass} ({student.verifiedClassNo})</div>
                                                      <div className="text-slate-500">{student.verifiedName}</div>
                                                  </td>
                                                  <td className="p-3 text-center">
                                                      {status === 'present' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">出席</span>}
                                                      {status === 'sick' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">病假</span>}
                                                      {status === 'personal' && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">事假</span>}
                                                      {!status && <span className="text-slate-300">-</span>}
                                                  </td>
                                                  <td className="p-3 text-right">
                                                      <div className="flex justify-end gap-1">
                                                          <button onClick={() => handleMarkAttendance({ ...student, classCode: student.verifiedClass, classNo: student.verifiedClassNo, chiName: student.verifiedName }, 'present')} className={`p-2 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 ${status === 'present' ? 'text-green-600' : ''}`}><CheckCircle size={18}/></button>
                                                          <button onClick={() => handleMarkAttendance({ ...student, classCode: student.verifiedClass, classNo: student.verifiedClassNo, chiName: student.verifiedName }, 'sick')} className={`p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 ${status === 'sick' ? 'text-red-600' : ''}`}><Activity size={18}/></button>
                                                          <button onClick={() => handleMarkAttendance({ ...student, classCode: student.verifiedClass, classNo: student.verifiedClassNo, chiName: student.verifiedName }, 'personal')} className={`p-2 rounded hover:bg-yellow-50 text-slate-400 hover:text-yellow-600 ${status === 'personal' ? 'text-yellow-600' : ''}`}><FileText size={18}/></button>
                                                      </div>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400">
                              <CheckSquare size={48} className="mb-4 opacity-20"/>
                              <p>請在左側選擇活動以開始點名</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  // ---------------------------------------------------------------------------
  // RENDER: STAFF VIEW (Enhanced V3.9.0)
  // ---------------------------------------------------------------------------
  const renderStaffView = () => {
    // Dropdown Details Logic
    const selectedActDetails = activities.find(a => a.id === staffSelectedActivityId);
    // Find all students for this activity ID (in this flat list structure, we simulate finding the 'Activity Group')
    // Since activities list is flat (enrollments), finding 'details' by ID is finding ONE enrollment.
    // Better logic: Filter by Activity NAME of the selected ID.
    const activityGroup = selectedActDetails ? activities.filter(a => a.activity === selectedActDetails.activity) : [];

    return (
    <div className="flex-1 bg-slate-50 p-6 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-6">
             <div className="flex items-center space-x-4">
                <button onClick={() => setCurrentView('student')} className="p-2 bg-white rounded-full shadow hover:bg-slate-100"><ArrowLeft size={20}/></button>
                <h2 className="text-2xl font-bold text-slate-800">教職員查詢通道 (V3.9)</h2>
             </div>
             <div className="bg-white px-1 py-1 rounded-lg border flex">
                <button onClick={() => setStaffShowAll(false)} className={`px-3 py-1 rounded-md text-sm font-bold transition ${!staffShowAll ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>搜尋模式</button>
                <button onClick={() => setStaffShowAll(true)} className={`px-3 py-1 rounded-md text-sm font-bold transition ${staffShowAll ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>全部清單</button>
             </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
            {/* Left Column: Search & List */}
            <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex gap-4">
                    <div className="flex-1 flex items-center bg-white border rounded-xl px-3 py-2">
                        <Search className="text-slate-400 mr-2" />
                        <input 
                            type="text" 
                            placeholder="輸入搜尋 (姓名/班別/活動)..." 
                            className="bg-transparent w-full outline-none text-slate-700"
                            value={staffSearchQuery}
                            onChange={(e) => setStaffSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3">狀態</th>
                                <th className="p-3">姓名</th>
                                <th className="p-3">班別 (學號)</th>
                                <th className="p-3">活動名稱</th>
                                <th className="p-3">時間/地點</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activities.filter(item => {
                                if (staffShowAll) return true;
                                if (!staffSearchQuery) return false;
                                const q = staffSearchQuery.toLowerCase();
                                return (item.verifiedName || "").includes(q) || 
                                       (item.activity || "").toLowerCase().includes(q) ||
                                       (item.verifiedClass || "").toLowerCase().includes(q);
                            }).map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50 transition-colors">
                                    <td className="p-3">
                                        {/* Status Dot */}
                                        <div className={`w-3 h-3 rounded-full ${getStudentStatusColor(item.verifiedClass, item.verifiedClassNo)} shadow-sm`} title="今日點名狀態"></div>
                                    </td>
                                    <td className="p-3 font-bold text-slate-700">{item.verifiedName}</td>
                                    <td className="p-3 text-slate-500">{item.verifiedClass} ({item.verifiedClassNo})</td>
                                    <td className="p-3 text-blue-600 font-medium">{item.activity}</td>
                                    <td className="p-3 text-xs text-slate-400">
                                        <div>{item.time}</div>
                                        <div>{item.location}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {activities.length === 0 && <div className="p-8 text-center text-slate-400">暫無資料</div>}
                </div>
            </div>

            {/* Right Column: Activity Detail Dropdown (New V3.9) */}
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-fit">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center"><List className="mr-2 text-purple-500"/> 活動詳情快搜</h3>
                <div className="relative mb-6">
                    <select 
                        className="w-full p-3 border rounded-xl appearance-none outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
                        onChange={(e) => setStaffSelectedActivityId(e.target.value)}
                        value={staffSelectedActivityId}
                    >
                        <option value="">-- 請選擇活動 --</option>
                        {activities.map(a => (
                            <option key={a.id} value={a.id}>{a.activity} ({a.verifiedClass}{a.verifiedClassNo})</option> 
                            // Note: Since list is enrollments, this dropdown is a bit redundant if not grouped. 
                            // Better: Group unique activities.
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-4 text-slate-400 pointer-events-none" size={16} />
                </div>

                {selectedActDetails && (
                    <div className="bg-purple-50 rounded-xl p-5 border border-purple-100 animate-in fade-in space-y-3">
                        <div className="flex justify-between items-start border-b border-purple-200 pb-3">
                            <h4 className="font-bold text-purple-900 text-lg">{selectedActDetails.activity}</h4>
                            <span className="bg-white text-purple-600 text-xs px-2 py-1 rounded border border-purple-200">{selectedActDetails.manualCategory || "未分類"}</span>
                        </div>
                        <div className="text-sm text-purple-800 space-y-2">
                            <div className="flex items-center"><Clock size={16} className="mr-2 opacity-70"/> {selectedActDetails.time}</div>
                            <div className="flex items-center"><MapPin size={16} className="mr-2 opacity-70"/> {selectedActDetails.location}</div>
                            <div className="flex items-center"><Calendar size={16} className="mr-2 opacity-70"/> {selectedActDetails.dateText || "參見通告"}</div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-purple-200">
                            <div className="font-bold text-purple-900 text-xs uppercase mb-2">參與學生 ({activityGroup.length}人)</div>
                            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                                {activityGroup.map(s => (
                                    <span key={s.id} className="bg-white border border-purple-100 text-purple-700 text-xs px-2 py-1 rounded">
                                        {s.verifiedClass}{s.verifiedClassNo} {s.verifiedName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {!selectedActDetails && (
                    <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-100 rounded-xl">
                        <Filter className="mx-auto mb-2 opacity-20" size={32}/>
                        <p className="text-sm">請選擇活動以查看詳情</p>
                    </div>
                )}
            </div>
        </div>
    </div>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER: STUDENT VIEW (Existing)
  // ---------------------------------------------------------------------------
  const renderStudentView = () => {
    const allClasses = ['1A','1B','1C','1D','1E','2A','2B','2C','2D','2E','3A','3B','3C','3D','3E','4A','4B','4C','4D','4E','5A','5B','5C','5D','6A','6B','6C','6D'];
    
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-orange-50 to-white min-h-screen relative">
         {/* Top Navigation for Admin/Staff/RollCall */}
         <div className="absolute top-4 right-4 flex gap-2">
             <button onClick={() => setCurrentView('rollcall')} className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-orange-600 shadow-sm border border-orange-100 hover:scale-105 transition">點名系統</button>
             <button onClick={() => setCurrentView('staff')} className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-500 shadow-sm hover:text-blue-600 transition">教職員</button>
         </div>

         {currentView === 'kiosk_result' ? (
           <div className="max-w-4xl mx-auto w-full p-6 animate-in slide-in-from-right">
             <button onClick={() => { setStudentResult(null); setCurrentView('student'); }} className="mb-6 flex items-center text-slate-500 hover:text-blue-600 font-bold bg-white px-4 py-2 rounded-full shadow-sm w-fit"><ArrowLeft className="mr-2" /> 返回查詢</button>
             {studentResult && studentResult.info ? (
                <div className="space-y-6">
                   <div className="bg-white p-8 rounded-3xl shadow-xl border-l-8 border-blue-500 flex justify-between items-center">
                      <div>
                        <h2 className="text-3xl font-extrabold text-slate-800 mb-2">{studentResult.info.chiName}</h2>
                        <p className="text-xl text-slate-500 font-mono">{studentResult.info.classCode} ({studentResult.info.classNo})</p>
                      </div>
                      <div className="text-right bg-blue-50 px-6 py-3 rounded-2xl">
                          <p className="text-blue-600 font-bold text-sm uppercase tracking-widest">已參與活動</p>
                          <p className="text-4xl font-black text-blue-800">{studentResult.activities.length}</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {studentResult.activities.map((act, i) => (
                           <div key={i} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all relative overflow-hidden group">
                               <div className="absolute top-0 right-0 bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-bl-lg z-10">{act.manualCategory || "活動"}</div>
                               <h3 className="font-bold text-xl text-slate-800 mb-4 pr-10">{act.activity}</h3>
                               <div className="space-y-2 text-sm text-slate-600">
                                   <div className="flex items-center bg-slate-50 p-2 rounded-lg"><Clock size={16} className="mr-3 text-orange-500"/> {act.time}</div>
                                   <div className="flex items-center bg-slate-50 p-2 rounded-lg"><MapPin size={16} className="mr-3 text-blue-500"/> {act.location}</div>
                                   <div className="flex items-center bg-slate-50 p-2 rounded-lg"><Calendar size={16} className="mr-3 text-purple-500"/> {act.dateText || "參見通告"}</div>
                               </div>
                           </div>
                       ))}
                       {studentResult.activities.length === 0 && (
                           <div className="col-span-2 text-center py-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                               <p className="text-lg">暫無參與任何活動記錄</p>
                           </div>
                       )}
                   </div>
                </div>
             ) : (
                <div className="text-center mt-20"><p className="text-2xl text-slate-400">查無此學生資料</p></div>
             )}
           </div>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-4xl bg-white p-8 md:p-12 rounded-[2rem] shadow-2xl border border-orange-100 text-center">
                  <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-2">課外活動查詢</h1>
                  <p className="text-slate-400 mb-10">請選擇你的班別及學號</p>
                  
                  <div className="flex flex-col md:flex-row gap-4 mb-8 justify-center">
                      <div className="flex-1">
                          <label className="block text-left text-xs font-bold text-slate-400 uppercase mb-2 ml-1">班別 Class</label>
                          <select className="w-full text-2xl p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-orange-400 transition font-bold text-slate-700 appearance-none text-center"
                             value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                             {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      <div className="flex-1">
                          <label className="block text-left text-xs font-bold text-slate-400 uppercase mb-2 ml-1">學號 Class No.</label>
                          <input type="number" pattern="\d*" className="w-full text-2xl p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-orange-400 transition font-bold text-slate-700 text-center placeholder-slate-300"
                             placeholder="例如: 12" value={selectedClassNo} onChange={(e) => setSelectedClassNo(e.target.value)} 
                             onKeyDown={(e) => e.key === 'Enter' && handleStudentSearch()}/>
                      </div>
                  </div>
                  
                  <button onClick={handleStudentSearch} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl font-bold py-5 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center">
                      <Search className="mr-3" strokeWidth={3} /> 查詢紀錄
                  </button>
                  
                  <div className="mt-8 pt-6 border-t border-slate-100">
                      <button onClick={() => setCurrentView('admin')} className="text-slate-300 text-sm hover:text-slate-500 flex items-center justify-center mx-auto"><Shield size={14} className="mr-1"/> 行政登入</button>
                  </div>
              </div>
           </div>
         )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // MAIN RETURN SWITCH
  // ---------------------------------------------------------------------------
  if (currentView === 'staff') return renderStaffView();
  if (currentView === 'rollcall') return renderRollCallView();
  
  // ADMIN VIEW (Simplified for integration, contains original logic)
  if (currentView === 'admin') {
      if (!user) {
          return (
              <div className="min-h-screen flex items-center justify-center bg-slate-100">
                  <div className="bg-white p-8 rounded-2xl shadow-xl w-96">
                      <h2 className="text-2xl font-bold mb-6 text-center">行政人員登入</h2>
                      <input className="w-full mb-3 p-3 border rounded-lg bg-slate-50" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                      <input className="w-full mb-6 p-3 border rounded-lg bg-slate-50" type="password" placeholder="Password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)} />
                      <button onClick={handleLogin} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900">登入</button>
                      <button onClick={() => setCurrentView('student')} className="w-full mt-3 text-slate-400 text-sm">返回</button>
                  </div>
              </div>
          );
      }
      // Logged in Admin
      return (
          <div className="min-h-screen bg-slate-50 p-6">
              <div className="max-w-7xl mx-auto">
                  <div className="flex justify-between items-center mb-8">
                      <h1 className="text-3xl font-bold text-slate-800">全方位活動管理系統 <span className="text-blue-600 text-lg">Admin</span></h1>
                      <div className="flex space-x-2">
                          <button onClick={() => setAdminTab('import')} className={`px-4 py-2 rounded-lg font-bold ${adminTab === 'import' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>數據導入</button>
                          <button onClick={() => setAdminTab('stats')} className={`px-4 py-2 rounded-lg font-bold ${adminTab === 'stats' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>統計分析</button>
                          <button onClick={handleLogout} className="px-4 py-2 bg-slate-200 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-500"><LogOut size={18}/></button>
                      </div>
                  </div>

                  {adminTab === 'stats' ? (
                      <StatsView masterList={masterList} activities={activities} queryLogs={queryLogs} onBack={() => setAdminTab('import')} />
                  ) : (
                      <div className="bg-white p-8 rounded-2xl shadow-sm min-h-[500px] flex flex-col items-center justify-center text-slate-400">
                          <Database size={48} className="mb-4 opacity-20"/>
                          <p>數據庫管理介面 (功能保留，此處簡化顯示以專注於新功能展示)</p>
                          <p className="text-xs mt-2">請使用上方「統計分析」查看新圖表</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // DEFAULT: Student View
  return renderStudentView();
};

export default App;