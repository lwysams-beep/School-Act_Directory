//
import React, { useState, useMemo, useEffect, useRef } from 'react';
// V4.2: Database Date Format Update (Smart Year Logic & MMDD Display)
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, BarChart, History, TrendingUp, Filter, Cloud, UserX, PieChart, Download, Activity, Save as SaveIcon, Layers, Maximize, Palette, ChevronDown } from 'lucide-react';

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

// =============================================================================
// V4.2 DATE HELPERS (Smart Academic Year Logic)
// =============================================================================
const ACADEMIC_YEAR_START = 2025; // Sep 2025
// Logic: Sep-Dec = 2025, Jan-Aug = 2026

const formatDateForDisplay = (dates) => {
    // Input: ['2026-01-01', '2026-02-01']
    // Output: "0101, 0201"
    if (!Array.isArray(dates)) return '';
    return dates.map(d => {
        const parts = d.split('-');
        if (parts.length < 3) return '';
        return `${parts[1]}${parts[2]}`;
    }).join(', ');
};

const parseSmartDateString = (str) => {
    // Input: "0101, 0901"
    // Logic: 0101 -> 2026-01-01, 0901 -> 2025-09-01
    if (!str) return [];
    
    // Split by comma, space, or Chinese comma
    const tokens = str.split(/[,，\s]+/).filter(t => t.trim().length === 4);
    const result = tokens.map(token => {
        const month = parseInt(token.substring(0, 2), 10);
        const day = token.substring(2, 4);
        
        let year = ACADEMIC_YEAR_START + 1; // Default to 2026 (Jan-Aug)
        if (month >= 9) {
            year = ACADEMIC_YEAR_START; // 2025 (Sep-Dec)
        }
        
        return `${year}-${token.substring(0, 2)}-${day}`;
    });
    
    // Sort dates
    return result.sort();
};


// -----------------------------------------------------------------------------
// 3. STATS VIEW COMPONENT (V3.8.1 - Stability Fix)
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
                    <BarChart className="mr-2 text-blue-600" /> 校本數據分析中心 (V3.8.1)
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
                                            {selectedActs.size > 0 && <span className="text-slate-400">/</span>}
                                            <span className={`font-bold text-slate-800 ${selectedActs.size > 0 ? 'text-lg ml-1' : 'text-4xl'}`}>{totalHours.toFixed(0)}</span>
                                        </div>
                                        <span className="text-xs text-slate-400">Hours</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-4">點擊右側圖例進行多項對比</p>
                            </div>

                            <div className="w-full md:w-80 h-96 border-l border-slate-200 pl-0 md:pl-6 overflow-y-auto">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 sticky top-0 bg-slate-50 py-2 z-10 flex justify-between">
                                    <span>圖例 (點選切換)</span>
                                    {selectedActs.size > 0 && <span className="text-blue-500">已選 {selectedActs.size} 項</span>}
                                </h4>
                                <div className="space-y-1">
                                    {activityStats.map((a, i) => {
                                        const isSelected = selectedActs.size === 0 || selectedActs.has(a.name);
                                        const isDimmed = selectedActs.size > 0 && !isSelected;
                                        return (
                                            <button 
                                                key={i} 
                                                onClick={() => toggleSelection(a.name)}
                                                className={`w-full flex items-center justify-between p-2 rounded text-xs transition-all duration-200 
                                                    ${isSelected ? 'bg-white shadow ring-2 ring-blue-500 scale-[1.02] z-10' : 'hover:bg-white hover:shadow-sm'}
                                                    ${isDimmed ? 'opacity-40 grayscale' : 'opacity-100'}
                                                `}
                                            >
                                                <div className="flex items-center truncate">
                                                    <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{backgroundColor: getSafeColor(i)}}></span>
                                                    <span className="truncate max-w-[120px]" title={a.name}>{a.name}</span>
                                                </div>
                                                <div className="font-bold text-slate-600">{((a.hours/(totalHours||1))*100).toFixed(1)}%</div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 2. CATEGORY CHART */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center md:items-start relative min-h-[300px]">
                            <div className="absolute top-4 left-4 z-20">
                                 <button onClick={exportCategoryStats} className="text-xs bg-indigo-600 text-white border px-3 py-1.5 rounded flex items-center hover:bg-indigo-700 shadow-md transition"><Download size={14} className="mr-1"/> 匯出 CSV</button>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center p-4 pt-10">
                                <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><Palette className="mr-2 text-purple-500"/> 課程範疇分佈 (可手動修正)</h3>
                                <div className="relative w-64 h-64 rounded-full shadow-xl border-4 border-white" style={{ background: `conic-gradient(${categoryPieGradient})` }}>
                                    <div className="absolute inset-0 m-auto w-32 h-32 bg-slate-50 rounded-full flex flex-col items-center justify-center shadow-inner">
                                        <span className="text-lg font-bold text-slate-600">分類統計</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-4">前往「活動列表」即可手動更改分類</p>
                            </div>
                            <div className="w-full md:w-64 p-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">類別圖例</h4>
                                <div className="space-y-2">
                                    {categoryStats.map((cat, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 bg-white rounded shadow-sm">
                                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: CATEGORY_COLORS[cat.name] || '#94a3b8'}}></span><span className="text-xs font-bold">{cat.name}</span></div>
                                            <div className="text-xs font-mono">{((cat.hours/(totalHours||1))*100).toFixed(1)}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3. STACKED BAR CHART */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative flex flex-col h-[600px]">
                            <div className="flex flex-col md:flex-row justify-between items-start mb-6">
                                <div className="flex items-center space-x-4 mb-2 md:mb-0">
                                    <button onClick={exportGradeStats} className="text-xs bg-indigo-600 text-white border px-3 py-1.5 rounded flex items-center hover:bg-indigo-700 shadow-md transition"><Download size={14} className="mr-1"/> 匯出 CSV</button>
                                </div>
                                <div className="text-right">
                                    <h3 className="font-bold text-slate-700 text-lg flex items-center justify-end"><TrendingUp className="mr-2 text-green-500"/> 各級總時數分佈 (固定比例)</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {selectedActs.size > 0 ? '灰色: 該級總時數 | 彩色: 所選活動佔比' : '顯示全校所有活動堆疊'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 flex items-end justify-between space-x-8 border-b-2 border-slate-300 pb-0 px-4 mx-4 relative">
                                {gradeDistribution.map((g) => {
                                    const maxScale = maxGradeHours; 
                                    const ghostHeightPct = (g.total / (maxScale || 1)) * 100;

                                    const activeItems = Object.entries(g.details)
                                        .filter(([name]) => selectedActs.size === 0 || selectedActs.has(name))
                                        .sort((a,b) => b[1] - a[1]); 
                                    const selectedTotalHours = activeItems.reduce((acc, cur) => acc + cur[1], 0);
                                    const activeHeightPct = (selectedTotalHours / (maxScale || 1)) * 100;

                                    return (
                                        <div key={g.grade} className="flex flex-col items-center flex-1 h-full relative group">
                                            
                                            {selectedActs.size > 0 && (
                                                <div 
                                                    className="w-full absolute bottom-0 bg-slate-200 rounded-t-sm transition-all duration-700 pointer-events-none" 
                                                    style={{height: `${ghostHeightPct}%`}}
                                                />
                                            )}

                                            <div 
                                                className={`w-full absolute bottom-0 flex flex-col-reverse rounded-t-sm overflow-hidden transition-all duration-700 ${selectedActs.size > 0 ? 'w-4/5 z-10 shadow-lg left-1/2 -translate-x-1/2' : 'bg-slate-200'}`}
                                                style={{height: `${activeHeightPct}%`}}
                                            >
                                                {activeItems.map(([actName, hrs], idx) => {
                                                    const colorIdx = getActColorIndex(actName);
                                                    const color = getSafeColor(colorIdx);
                                                    const pctOfStack = (hrs / (selectedTotalHours || 1)) * 100;
                                                    return (
                                                        <div key={actName} className="w-full relative" style={{height: `${pctOfStack}%`, backgroundColor: color}} />
                                                    );
                                                })}
                                            </div>

                                            <div className="absolute w-full text-center -top-6 transition-all duration-500" style={{bottom: `${Math.max(ghostHeightPct, activeHeightPct) + 2}%`}}>
                                                <span className="text-xs font-bold text-slate-600 bg-white/80 px-1 rounded">
                                                    {selectedActs.size > 0 ? selectedTotalHours.toFixed(0) : g.total.toFixed(0)}h
                                                </span>
                                            </div>

                                            {/* Hover Tooltip */}
                                            <div className="hidden group-hover:block absolute bottom-1/2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 w-48 pointer-events-none">
                                                <div className="font-bold border-b border-slate-600 pb-1 mb-1">{g.grade} 統計詳情</div>
                                                <div className="flex justify-between mb-1"><span>全級總時數:</span> <span className="font-mono">{g.total.toFixed(1)}h</span></div>
                                                {selectedActs.size > 0 && (
                                                    <div className="flex justify-between text-yellow-400"><span>所選活動:</span> <span className="font-mono">{selectedTotalHours.toFixed(1)}h</span></div>
                                                )}
                                            </div>

                                            <div className="absolute -bottom-8 w-full text-center">
                                                <div className="text-sm font-bold text-slate-700">{g.grade}</div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div className="absolute left-0 top-0 h-full border-l border-dashed border-slate-300 pointer-events-none">
                                    <span className="absolute top-0 left-1 text-[10px] text-slate-400 bg-slate-50 px-1">Max: {maxGradeHours.toFixed(0)}h</span>
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
                            <thead className="bg-slate-100 text-slate-500 uppercase"><tr><th className="p-3">活動名稱</th><th className="p-3 w-48">類別 (可手動更改)</th><th className="p-3 text-right">總人次</th><th className="p-3 text-right">總學時</th></tr></thead>
                            <tbody className="divide-y">
                                {filteredActivityList.map((a, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="p-3 font-medium flex items-center">
                                            <span className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: getSafeColor(getActColorIndex(a.name))}}></span>
                                            {a.name}
                                        </td>
                                        <td className="p-3">
                                            <div className="relative group/cat">
                                                <select 
                                                    className="w-full text-xs p-1 border rounded bg-slate-50 hover:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                                                    value={a.category}
                                                    disabled={updatingCategory}
                                                    onChange={(e) => handleCategoryChange(a.name, e.target.value)}
                                                >
                                                    {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                                {updatingCategory && <span className="absolute right-0 top-0 text-[8px] text-blue-500">更新中...</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">{a.count}</td>
                                        <td className="p-3 text-right font-bold text-blue-600">{a.hours.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {statsViewMode === 'logs' && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b"><h3 className="font-bold text-slate-700">查詢日誌 (Audit Log)</h3></div>
                        <table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500"><tr><th className="p-3">日期</th><th className="p-3">時間</th><th className="p-3">查詢班別</th><th className="p-3">學生姓名</th><th className="p-3">結果</th></tr></thead>
                        <tbody>{queryLogs.length > 0 ? queryLogs.map((log, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-white">
                                <td className="p-3 text-slate-600">{log.dateStr}</td>
                                <td className="p-3 font-mono text-slate-500 text-xs">{log.timeStr}</td>
                                <td className="p-3 font-bold text-slate-800">{log.class} ({log.classNo})</td>
                                <td className="p-3">{log.name}</td>
                                <td className="p-3">{log.success ? <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded">成功</span> : <span className="text-red-500 text-xs">無記錄</span>}</td>
                            </tr>)) : (<tr><td colSpan="5" className="p-8 text-center text-slate-400">暫無查詢紀錄</td></tr>)}</tbody>
                        </table>
                    </div>
                )}

                {statsViewMode === 'students' && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center"><AlertTriangle className="mr-2 text-orange-500" size={18}/> 學生參與度監測</h3>
                            <button onClick={() => exportToCSV(filteredStudentList, 'Student_Participation')} className="text-sm bg-white border px-3 py-1 rounded hover:bg-slate-50 flex items-center text-blue-600 border-blue-200"><Download size={14} className="mr-1"/> 匯出 CSV</button>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-500 uppercase sticky top-0"><tr><th className="p-3">班別 (學號)</th><th className="p-3">姓名</th><th className="p-3 text-right">參與時數</th><th className="p-3 text-center">狀態</th></tr></thead>
                                <tbody className="divide-y">
                                    {filteredStudentList.map((s, i) => (
                                        <tr key={i} className={`hover:bg-slate-50 ${s.hours === 0 ? 'bg-red-50' : ''}`}>
                                            <td className="p-3 text-slate-600">{s.classCode} ({s.classNo})</td>
                                            <td className="p-3 font-bold">{s.chiName}</td>
                                            <td className="p-3 text-right">{s.hours.toFixed(1)}</td>
                                            <td className="p-3 text-center">{s.hours === 0 ? <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-bold">關注</span> : <span className="text-xs text-green-600">正常</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
  const [currentView, setCurrentView] = useState('student');
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

  // V4.2: New Edit State for Dates
  const [editingId, setEditingId] = useState(null);
  const [tempDateInput, setTempDateInput] = useState(''); // Stores the "MMDD" string

  // Admin UI State
  const [adminTab, setAdminTab] = useState('database'); // Default to database for checking
  const [selectedMatchIds, setSelectedMatchIds] = useState(new Set());
  
  // Student Search State
  const [searchClass, setSearchClass] = useState('');
  const [searchNo, setSearchNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);

  // Init Data
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });

    const unsubAct = onSnapshot(query(collection(db, "activities"), orderBy("classCode")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivities(data);
    });

    const unsubLogs = onSnapshot(query(collection(db, "query_logs"), orderBy("timestamp", "desc")), (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQueryLogs(logs);
    });

    return () => { unsubAuth(); unsubAct(); unsubLogs(); };
  }, []);

  // Fetch Master List on Login
  useEffect(() => {
    if (user && !isMasterLoading && masterList.length === 0) {
      setIsMasterLoading(true);
      getDoc(doc(db, "settings", "master_list")).then(snap => {
        if (snap.exists() && snap.data().csv) {
          setMasterList(parseMasterCSV(snap.data().csv));
        }
        setIsMasterLoading(false);
      });
    }
  }, [user]);

  // Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, loginEmail, loginPwd); } 
    catch (e) { alert("登入失敗: " + e.message); }
  };

  // Student Search Logic
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchClass || !searchNo) return;
    
    // Log
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-HK');
    const timeStr = now.toLocaleTimeString('zh-HK');
    
    // Normalize Input
    const sClass = searchClass.toUpperCase();
    const sNo = searchNo.padStart(2, '0');
    const sKey = `${sClass}-${sNo}`; // Note: key matching might differ based on master list format
    
    // Find Student Logic (Simplified for this version)
    const studentActs = activities.filter(a => 
      (a.verifiedClass === sClass && a.verifiedClassNo === sNo) ||
      (a.classCode === sClass && a.classNo === sNo)
    );

    // Find Student Name from Master
    const studentInfo = masterList.find(s => s.classCode === sClass && s.classNo === sNo);
    const sName = studentInfo ? studentInfo.chiName : "未知學生";

    // Add Log
    addDoc(collection(db, "query_logs"), {
        timestamp: now,
        dateStr, timeStr,
        class: sClass, classNo: sNo,
        name: sName,
        success: studentActs.length > 0
    });

    setStudentResult({ info: studentInfo, acts: studentActs });
  };

  // V4.2 Date Editing Handlers
  const startEditing = (act) => {
      setEditingId(act.id);
      // Convert stored dates to MMDD display format for editing
      setTempDateInput(formatDateForDisplay(act.specificDates || []));
  };

  const saveDateEdit = async (actId) => {
      // Parse MMDD back to YYYY-MM-DD using smart logic
      const newDates = parseSmartDateString(tempDateInput);
      try {
          await updateDoc(doc(db, "activities", actId), { specificDates: newDates });
          setEditingId(null);
      } catch (e) {
          alert("更新失敗");
          console.error(e);
      }
  };
  
  const cancelEdit = () => {
      setEditingId(null);
      setTempDateInput('');
  };

  // ---------------- RENDER ----------------
  
  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  // 1. ADMIN VIEW
  if (user) {
    if (currentView === 'analysis') {
        return <StatsView masterList={masterList} activities={activities} queryLogs={queryLogs} onBack={() => setCurrentView('admin')} />;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 text-slate-300 flex flex-col">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold text-white flex items-center"><Monitor className="mr-2 text-blue-400"/> 校務系統 V4.2</h1>
            <p className="text-xs text-slate-500 mt-2">Authenticated</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => setAdminTab('database')} className={`w-full text-left p-3 rounded flex items-center ${adminTab === 'database' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                <Database className="mr-3" size={18}/> 數據庫管理
            </button>
            <button onClick={() => setCurrentView('analysis')} className="w-full text-left p-3 rounded flex items-center hover:bg-slate-800">
                <BarChart className="mr-3" size={18}/> 數據分析 (Stats)
            </button>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center p-2 rounded border border-slate-600 hover:bg-slate-800 text-slate-400"><LogOut size={16} className="mr-2"/> 登出</button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {adminTab === 'database' && (
             <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">全校活動數據庫</h2>
                    <div className="text-sm text-slate-500 bg-white px-3 py-1 rounded shadow-sm border">
                        <span className="font-bold text-blue-600">V4.2 更新:</span> 日期輸入支援智能學年判斷 (輸入 0101 自動轉為 2026-01-01)
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow border overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                            <tr>
                                <th className="p-4 border-b">班別/姓名</th>
                                <th className="p-4 border-b">活動名稱</th>
                                <th className="p-4 border-b w-48">日期 (MMDD)</th>
                                <th className="p-4 border-b">時間/地點</th>
                                <th className="p-4 border-b w-24">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {activities.map(act => (
                                <tr key={act.id} className="hover:bg-slate-50 group">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{act.verifiedClass || act.classCode} ({act.verifiedClassNo || act.classNo})</div>
                                        <div className="text-xs text-slate-500">{act.verifiedName || act.engName}</div>
                                    </td>
                                    <td className="p-4 font-medium text-blue-700">{act.activity}</td>
                                    
                                    {/* V4.2: SMART DATE EDITING */}
                                    <td className="p-4">
                                        {editingId === act.id ? (
                                            <div className="flex flex-col space-y-1">
                                                <input 
                                                    type="text" 
                                                    autoFocus
                                                    className="border border-blue-500 rounded p-1 text-sm w-full bg-blue-50 focus:outline-none"
                                                    value={tempDateInput}
                                                    onChange={(e) => setTempDateInput(e.target.value)}
                                                    placeholder="e.g. 0901, 0102"
                                                />
                                                <div className="text-[10px] text-slate-400">
                                                    輸入: 0901=25年, 0101=26年
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="font-mono text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                {formatDateForDisplay(act.specificDates) || '-'}
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-4 text-sm text-slate-500">
                                        <div><Clock size={12} className="inline mr-1"/>{act.time}</div>
                                        <div><MapPin size={12} className="inline mr-1"/>{act.location}</div>
                                    </td>
                                    <td className="p-4">
                                        {editingId === act.id ? (
                                            <div className="flex space-x-2">
                                                <button onClick={() => saveDateEdit(act.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save size={16}/></button>
                                                <button onClick={cancelEdit} className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><X size={16}/></button>
                                            </div>
                                        ) : (
                                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={() => startEditing(act)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="修改日期"><Edit2 size={16}/></button>
                                                <button onClick={() => { if(confirm('刪除此紀錄?')) deleteDoc(doc(db, "activities", act.id)); }} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={16}/></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {activities.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">暫無資料</td></tr>}
                        </tbody>
                    </table>
                </div>
             </div>
          )}
        </div>
      </div>
    );
  }

  // 2. STUDENT SEARCH VIEW (Default)
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-b-[3rem] shadow-2xl z-0"></div>
      
      {/* Header */}
      <div className="relative z-10 px-6 pt-8 pb-2 flex justify-between items-start max-w-md mx-auto w-full">
        <div>
           <h1 className="text-2xl font-bold text-white tracking-wide">課後活動查閱</h1>
           <p className="text-blue-100 text-sm opacity-90">香海正覺蓮社佛教正覺蓮社學校</p>
        </div>
        <button onClick={() => setLoginEmail('') || setLoginPwd('') || alert("請使用管理員帳號登入")} className="bg-white/10 p-2 rounded-full backdrop-blur-sm text-white hover:bg-white/20 transition">
            <Lock size={18} />
        </button>
      </div>

      {/* Login Modal Overlay (Hidden unless needed, simple logic here for prompt) */}
      {!user && loginEmail === 'admin' && ( // Just a trigger for demo, real login via dedicated button usually
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">管理員登入</h3>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl bg-slate-50" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} />
                      <input type="password" placeholder="Password" className="w-full p-3 border rounded-xl bg-slate-50" value={loginPwd} onChange={e=>setLoginPwd(e.target.value)} />
                      <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold shadow-lg shadow-blue-200">登入系統</button>
                      <button type="button" onClick={()=>setLoginEmail('')} className="w-full text-slate-400 p-2">取消</button>
                  </form>
              </div>
          </div>
      )}

      {/* Search Card */}
      <div className="relative z-10 flex-1 px-4 pb-8 max-w-md mx-auto w-full flex flex-col">
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6 animate-in slide-in-from-bottom-4 duration-700">
            <form onSubmit={handleSearch} className="flex space-x-2">
                <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase">班別</label>
                    <input 
                        type="text" 
                        maxLength={2}
                        placeholder="6A" 
                        className="w-full text-center text-2xl font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 uppercase text-slate-800 placeholder:text-slate-200"
                        value={searchClass}
                        onChange={e => setSearchClass(e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase">學號</label>
                    <input 
                        type="text" 
                        maxLength={2}
                        placeholder="01" 
                        className="w-full text-center text-2xl font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 text-slate-800 placeholder:text-slate-200"
                        value={searchNo}
                        onChange={e => setSearchNo(e.target.value)}
                    />
                </div>
                <button type="submit" className="bg-blue-600 text-white rounded-2xl w-16 flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 transition active:scale-95">
                    <Search size={24} />
                </button>
            </form>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-20 no-scrollbar">
            {studentResult ? (
                studentResult.acts.length > 0 ? (
                    studentResult.acts.map((item, idx) => (
                        <div key={idx} className="bg-white text-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-bottom-2" style={{animationDelay: `${idx * 100}ms`}}>
                             <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-slate-900">{item.activity}</h3>
                                <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded-full">{item.manualCategory || '活動'}</span>
                             </div>
                             
                             {/* V4.2 Display in Student View as well */}
                             <div className="mb-3">
                                 <div className="text-xs text-slate-400 mb-1">活動日期</div>
                                 <div className="flex flex-wrap gap-1">
                                     {item.specificDates && item.specificDates.length > 0 ? 
                                        item.specificDates.map(d => (
                                            <span key={d} className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded font-mono border border-slate-200">
                                                {formatDateForDisplay([d])}
                                            </span>
                                        )) : <span className="text-slate-400 text-xs italic">全年活動</span>
                                     }
                                 </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4 mt-3 border-t pt-3 border-slate-100">
                                <div className="flex items-center text-slate-600 bg-slate-50 p-2 rounded-lg">
                                    <Clock size={16} className="mr-2 text-orange-500" />
                                    <span className="font-bold text-sm">{item.time}</span>
                                </div>
                                <div className="flex items-center text-blue-800 bg-blue-50 p-2 rounded-lg">
                                    <MapPin size={16} className="mr-2 text-blue-500" />
                                    <span className="font-bold text-sm">{item.location}</span>
                                </div>
                             </div>
                        </div>
                    ))
                ) : (
                    <div className="text-slate-500 text-sm italic py-8 text-center border-2 border-dashed border-slate-300 rounded-3xl bg-white/50">
                        沒有安排活動
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center h-40 mt-8 text-slate-400 bg-slate-200/50 rounded-3xl border border-dashed border-slate-300">
                    <Calendar size={48} className="mb-2 opacity-50" />
                    <p className="text-lg font-medium">請輸入班別及學號查詢</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;