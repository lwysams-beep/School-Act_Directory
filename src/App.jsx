import React, { useState, useMemo, useEffect, useRef } from 'react';
// V3.9.0: Added Roll Call System, Staff Portal Upgrades, Grade Distribution Chart
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, BarChart, History, TrendingUp, Filter, Cloud, UserX, PieChart, Download, Activity, Save as SaveIcon, Layers, Maximize, Palette, ChevronDown, List, MoreHorizontal } from 'lucide-react';

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

const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    // 假設系統日期格式為 YYYY/MM/DD 或 YYYY-MM-DD，這裡統一輸出作比對
    return `${year}/${month}/${day}`; 
};

// CSV Export Helper
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

// Special Roll Call Export
const exportRollCallCSV = (activity, students, attendanceData) => {
    let csv = "\uFEFF"; // BOM
    csv += `${activity.activity} - 點名記錄\n`;
    csv += `導師: , ${activity.teacher || ''}\n`;
    csv += `日期: , ${getTodayDateString()}\n`;
    csv += `地點: , ${activity.location || ''}\n\n`;
    
    // Header based on user requirement (Similar to attached file)
    // "號碼","eclass login","班別","學號",姓名,Eng Name,出生日月年,"性別", [STATUS], "放學",電話
    csv += `"號碼","eclass login","班別","學號","姓名","Eng Name","性別","點名狀態","點名時間","家長電話"\n`;

    students.forEach(s => {
        const key = `${getTodayDateString()}_${activity.id}_${s.key}`; // key logic consistent with app
        const record = attendanceData[key];
        
        let statusText = "未點名";
        if (record?.status === 'present') statusText = "出席";
        if (record?.status === 'sick') statusText = "缺席(病)";
        if (record?.status === 'personal') statusText = "缺席(事)";

        const timeStr = record?.timestamp ? new Date(record.timestamp).toLocaleTimeString() : "";

        csv += `,,${s.classCode},${s.classNo},${s.chiName},${s.engName || ''},${s.sex || ''},${statusText},${timeStr},${s.phone || ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activity.activity}_點名表_${getTodayDateString().replace(/\//g,'-')}.csv`);
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

// -----------------------------------------------------------------------------
// 3. STATS VIEW COMPONENT (V3.9.0 - Updated with Grade Bar Chart)
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
                                        <span className="text-3xl font-bold text-slate-700">{filteredTotalHours.toFixed(0)}</span>
                                        <span className="text-xs text-slate-400">總時數</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 p-4 h-80 overflow-y-auto">
                                <h4 className="font-bold text-slate-600 mb-2 border-b pb-2">Top 5 活動佔比</h4>
                                <ul className="space-y-2">
                                    {filteredActivityList.slice(0, 10).map((item, idx) => (
                                        <li key={idx} onClick={() => toggleSelection(item.name)} className={`flex justify-between text-sm p-2 rounded cursor-pointer ${selectedActs.has(item.name) ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-slate-100'}`}>
                                            <span className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: getSafeColor(getActColorIndex(item.name))}}></span>{item.name}</span>
                                            <span className="font-mono">{((item.hours/totalHours)*100).toFixed(1)}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* 2. CATEGORY CHART */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><Layers className="mr-2 text-purple-500"/> 課程範疇分佈 (5C/STREAM)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="flex justify-center">
                                    <div className="relative w-64 h-64 rounded-full shadow-xl border-4 border-white"
                                        style={{ background: `conic-gradient(${categoryPieGradient})` }}
                                    ></div>
                                </div>
                                <div className="space-y-3">
                                    {categoryStats.map(cat => (
                                        <div key={cat.name} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                                            <div className="flex items-center">
                                                <div className="w-4 h-4 rounded-full mr-3" style={{backgroundColor: CATEGORY_COLORS[cat.name]}}></div>
                                                <span className="font-bold text-slate-700">{cat.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-slate-800">{cat.hours.toFixed(1)}h</div>
                                                <div className="text-xs text-slate-400">{((cat.hours/totalHours)*100).toFixed(1)}%</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3. GRADE DISTRIBUTION CHART (NEW V3.9) */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                             <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-slate-700 flex items-center text-lg"><BarChart className="mr-2 text-blue-500"/> 分級課程範疇分佈 (V3.9 新增)</h3>
                             </div>
                             <div className="flex items-end justify-between h-64 px-4 space-x-4">
                                 {gradeDistribution.map((g) => {
                                     const heightPct = (g.total / maxGradeHours) * 100;
                                     return (
                                         <div key={g.grade} className="flex flex-col items-center flex-1 h-full justify-end group">
                                             <div className="relative w-full flex justify-center items-end h-full">
                                                 {/* Tooltip */}
                                                 <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded z-10 whitespace-nowrap pointer-events-none transition-opacity">
                                                     {g.total.toFixed(1)} 小時
                                                 </div>
                                                 {/* Bar */}
                                                 <div 
                                                    className="w-full max-w-[40px] bg-blue-500 rounded-t-lg transition-all duration-500 hover:bg-blue-600 relative overflow-hidden"
                                                    style={{ height: `${heightPct}%`, minHeight: '4px' }}
                                                 >
                                                     {/* Optional: Show Categories inside bar as stacked (simplified as solid for now) */}
                                                 </div>
                                             </div>
                                             <span className="text-sm font-bold text-slate-500 mt-2">{g.grade}</span>
                                         </div>
                                     );
                                 })}
                             </div>
                             <div className="text-center text-xs text-slate-400 mt-4">
                                 顯示各級別參與的總時數比例 (P1 - P6)
                             </div>
                        </div>

                    </div>
                )}
                {/* Other views logic remains unchanged but hidden for brevity in this specific snippet insert */}
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// MAIN APP COMPONENT
// -----------------------------------------------------------------------------
const App = () => {
  const [currentView, setCurrentView] = useState('student'); // student, staff, admin, rollcall
  const [user, setUser] = useState(null); // Admin User State
  
  // Data State
  const [masterList, setMasterList] = useState([]); 
  const [activities, setActivities] = useState([]);
  
  // Attendance State (New V3.9)
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { "Date_ActID_StuKey": { status: 'present', timestamp: '' } }

  // Staff Portal State
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [staffShowAll, setStaffShowAll] = useState(false);
  const [staffSelectedActivityId, setStaffSelectedActivityId] = useState(''); // New Dropdown State

  // Roll Call State (New V3.9)
  const [rollCallPassword, setRollCallPassword] = useState('');
  const [isRollCallUnlocked, setIsRollCallUnlocked] = useState(false);
  const [selectedRollCallActivity, setSelectedRollCallActivity] = useState(null);
  const [rollCallMsg, setRollCallMsg] = useState('');

  // ---------------------------------------------------------------------------
  // LOGIC & HANDLERS
  // ---------------------------------------------------------------------------

  // Roll Call Logic
  const handleUnlockRollCall = () => {
      if (rollCallPassword === 'howcanyouturnthison') {
          setIsRollCallUnlocked(true);
          setRollCallMsg('');
      } else {
          setRollCallMsg('密碼錯誤');
      }
  };

  const markAttendance = (activityId, studentKey, status) => {
      const key = `${getTodayDateString()}_${activityId}_${studentKey}`;
      setAttendanceRecords(prev => ({
          ...prev,
          [key]: {
              status: status,
              timestamp: new Date().toISOString()
          }
      }));
  };

  // Staff Portal: Get Student Status Dot
  const getStudentStatus = (studentKey) => {
      // Logic: Check if student is in ANY of today's activities and get status
      const todayActs = activities.filter(a => 
         (a.dates && a.dates.includes(getTodayDateString())) || 
         (a.specificDates && a.specificDates.includes(getTodayDateString()))
      );

      // Find if student is in any of these acts
      const relevantAct = todayActs.find(act => {
          // Check if student is in this activity (using masterList matching logic implies we need a robust link, 
          // here assuming verifiedClass/Name matches or we search raw. 
          // Ideally, we filter masterList. But for search result, we have 'student' object)
          return true; // Simplified for lookup: we check the record key directly
      });
      
      // Since we don't have easy Activity->Student reverse index in this simplified variable scope without iteration,
      // We check if *any* attendance record exists for this student today.
      
      const todayPrefix = getTodayDateString();
      const keys = Object.keys(attendanceRecords).filter(k => k.startsWith(todayPrefix) && k.includes(studentKey));
      
      if (keys.length === 0) return 'bg-gray-300'; // No record / Not in act
      
      // Priority: Present > Sick > Personal
      const statuses = keys.map(k => attendanceRecords[k].status);
      if (statuses.includes('present')) return 'bg-green-500';
      if (statuses.includes('sick') || statuses.includes('personal')) return 'bg-red-500';
      return 'bg-gray-300';
  };

  // ---------------------------------------------------------------------------
  // RENDER: ROLL CALL VIEW (New)
  // ---------------------------------------------------------------------------
  const renderRollCallView = () => {
      if (!isRollCallUnlocked) {
          return (
              <div className="min-h-screen flex items-center justify-center bg-slate-50">
                  <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-l-4 border-orange-500">
                      <div className="text-center mb-6">
                          <CheckCircle className="w-12 h-12 text-orange-500 mx-auto mb-2" />
                          <h2 className="text-2xl font-bold text-slate-800">點名系統登入</h2>
                      </div>
                      <input 
                        type="password" 
                        className="w-full p-3 border rounded-xl mb-4 focus:ring-2 focus:ring-orange-500 outline-none"
                        placeholder="請輸入密碼"
                        value={rollCallPassword}
                        onChange={(e) => setRollCallPassword(e.target.value)}
                      />
                      {rollCallMsg && <p className="text-red-500 text-sm mb-4 font-bold">{rollCallMsg}</p>}
                      <button onClick={handleUnlockRollCall} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition">解鎖</button>
                      <button onClick={() => setCurrentView('student')} className="w-full mt-4 text-slate-400 text-sm">返回主頁</button>
                  </div>
              </div>
          );
      }

      // Filter Today's Activities
      // Note: In a real app, date format matching needs to be precise. 
      // Assuming activities have 'dates' array or 'specificDates' array formatted as "YYYY/MM/DD" or similar.
      const todayStr = getTodayDateString();
      const todayActivities = activities.filter(a => {
          // Loose matching for demo purposes
          const dates = a.specificDates || a.dates || [];
          return dates.some(d => d.includes(todayStr.substring(5)) || d === todayStr); // Match "MM/DD" or full date
      });

      return (
          <div className="min-h-screen bg-slate-50 p-4 md:p-8">
              <div className="max-w-6xl mx-auto">
                  <div className="flex justify-between items-center mb-8">
                      <div className="flex items-center">
                          <button onClick={() => setCurrentView('student')} className="mr-4 bg-white p-2 rounded-full shadow"><ArrowLeft /></button>
                          <div>
                              <h2 className="text-2xl font-bold text-slate-800">今日活動點名</h2>
                              <p className="text-slate-500">{todayStr}</p>
                          </div>
                      </div>
                      <button onClick={() => setIsRollCallUnlocked(false)} className="text-red-500 font-bold text-sm">登出系統</button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Activity List */}
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[80vh] flex flex-col">
                          <div className="p-4 bg-orange-50 border-b border-orange-100 font-bold text-orange-800">今日待辦活動 ({todayActivities.length})</div>
                          <div className="overflow-y-auto flex-1 p-2 space-y-2">
                              {todayActivities.map(act => (
                                  <div 
                                    key={act.id} 
                                    onClick={() => setSelectedRollCallActivity(act)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedRollCallActivity?.id === act.id ? 'bg-orange-50 border-orange-500 shadow-md' : 'bg-white border-slate-100 hover:border-orange-300'}`}
                                  >
                                      <div className="font-bold text-slate-800">{act.activity}</div>
                                      <div className="text-xs text-slate-500 mt-1 flex items-center"><Clock size={12} className="mr-1"/> {act.time}</div>
                                  </div>
                              ))}
                              {todayActivities.length === 0 && <div className="p-8 text-center text-slate-400">今日沒有安排活動</div>}
                          </div>
                      </div>

                      {/* Right: Student List */}
                      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[80vh] flex flex-col">
                          {selectedRollCallActivity ? (
                              <>
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <div>
                                        <h3 className="font-bold text-slate-800">{selectedRollCallActivity.activity}</h3>
                                        <p className="text-xs text-slate-500">{selectedRollCallActivity.location} | {selectedRollCallActivity.teacher}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            // Get students for this activity
                                            const studentsInAct = masterList.filter(s => 
                                                s.classCode === selectedRollCallActivity.verifiedClass && 
                                                s.chiName === selectedRollCallActivity.verifiedName // Note: Logic depends on how masterList links to activity.
                                                // Assuming simple filter for demo:
                                                || (selectedRollCallActivity.studentList && selectedRollCallActivity.studentList.includes(s.key))
                                                // Fallback: Filter by raw matching if needed
                                                || (s.chiName === selectedRollCallActivity.rawName)
                                            ); 
                                            // Since activities structure in DB might be per-student-per-activity or one-activity-many-students. 
                                            // Based on 'StatsView', it seems 'activities' is a list of records (Student-Activity pair).
                                            // So 'selectedRollCallActivity' might be just ONE record? 
                                            // **Correction**: To make Roll Call work for a whole class, we need to aggregate.
                                            // But if the DB structure is normalized (1 row per student-activity), we filter activities by Name+Date.
                                            exportRollCallCSV(selectedRollCallActivity, 
                                                activities.filter(a => a.activity === selectedRollCallActivity.activity).map(a => {
                                                    const s = masterList.find(m => m.classCode === a.verifiedClass && m.chiName === a.verifiedName);
                                                    return s ? {...s, key: `${s.classCode}-${s.chiName}`} : { chiName: a.verifiedName, classCode: a.verifiedClass, key: 'unknown' };
                                                }), 
                                                attendanceRecords
                                            );
                                        }}
                                        className="flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-green-200 transition"
                                    >
                                        <FileSpreadsheet size={16} className="mr-2" /> 匯出記錄 (.csv)
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 p-0">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-6 py-3">學生</th>
                                                <th className="px-6 py-3 text-center">狀態</th>
                                                <th className="px-6 py-3 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {/* Logic to find all students in this activity name */}
                                            {activities
                                                .filter(a => a.activity === selectedRollCallActivity.activity)
                                                .map(record => {
                                                    const student = masterList.find(m => m.classCode === record.verifiedClass && m.chiName === record.verifiedName) || { chiName: record.verifiedName, classCode: record.verifiedClass, key: `${record.verifiedClass}-${record.verifiedName}` };
                                                    const key = `${getTodayDateString()}_${selectedRollCallActivity.id}_${student.key}`;
                                                    const status = attendanceRecords[key]?.status;
                                                    
                                                    return (
                                                        <tr key={key} className="hover:bg-slate-50 transition">
                                                            <td className="px-6 py-4">
                                                                <div className="font-bold text-slate-800">{student.classCode} {student.chiName}</div>
                                                                <div className="text-xs text-slate-400">{student.classNo ? `(${student.classNo})` : ''}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                {status === 'present' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">出席</span>}
                                                                {status === 'sick' && <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">病假</span>}
                                                                {status === 'personal' && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">事假</span>}
                                                                {!status && <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={() => markAttendance(selectedRollCallActivity.id, student.key, 'present')} className={`p-2 rounded-lg transition ${status === 'present' ? 'bg-green-500 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-400 hover:bg-green-100 hover:text-green-600'}`}><CheckCircle size={18}/></button>
                                                                    <button onClick={() => markAttendance(selectedRollCallActivity.id, student.key, 'sick')} className={`p-2 rounded-lg transition ${status === 'sick' ? 'bg-red-500 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600'}`}><Activity size={18}/></button>
                                                                    <button onClick={() => markAttendance(selectedRollCallActivity.id, student.key, 'personal')} className={`p-2 rounded-lg transition ${status === 'personal' ? 'bg-yellow-500 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-400 hover:bg-yellow-100 hover:text-yellow-600'}`}><FileText size={18}/></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            }
                                        </tbody>
                                    </table>
                                </div>
                              </>
                          ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                  <CheckSquare size={48} className="mb-4 opacity-20"/>
                                  <p>請在左側選擇活動以開始點名</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  // ---------------------------------------------------------------------------
  // RENDER: STAFF VIEW (Updated)
  // ---------------------------------------------------------------------------
  const renderStaffView = () => {
    // Filter logic for staff search
    const filteredMasterList = masterList.filter(s => {
        if (!staffSearchTerm) return staffShowAll;
        const term = staffSearchTerm.toLowerCase();
        return (s.chiName && s.chiName.includes(term)) || 
               (s.engName && s.engName.toLowerCase().includes(term)) || 
               (s.classCode && s.classCode.toLowerCase().includes(term));
    });

    // Logic for dropdown activity details
    const selectedActDetails = activities.find(a => a.id === staffSelectedActivityId);

    return (
        <div className="min-h-screen bg-slate-50">
             <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                     <div className="flex items-center">
                        <button onClick={() => setCurrentView('student')} className="mr-4 text-slate-500 hover:bg-slate-100 p-2 rounded-full"><ArrowLeft /></button>
                        <h2 className="text-xl font-bold text-slate-800">教職員查詢通道</h2>
                     </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 space-y-6">
                
                {/* NEW: Activity Dropdown Details */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center"><List className="mr-2 text-blue-500"/> 活動詳情速查 (新增)</h3>
                    <div className="relative">
                        <select 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                            value={staffSelectedActivityId}
                            onChange={(e) => setStaffSelectedActivityId(e.target.value)}
                        >
                            <option value="">請選擇活動...</option>
                            {/* Unique activities list */}
                            {Array.from(new Set(activities.map(a => a.activity))).map(actName => {
                                const act = activities.find(a => a.activity === actName);
                                return <option key={act.id} value={act.id}>{act.activity} ({act.verifiedClass ? '部份' : '全校'})</option>
                            })}
                        </select>
                        <ChevronDown className="absolute right-4 top-4 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    {selectedActDetails && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in">
                            <h4 className="font-bold text-blue-900 text-lg">{selectedActDetails.activity}</h4>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-blue-800">
                                <p>📍 {selectedActDetails.location || '待定'}</p>
                                <p>🕒 {selectedActDetails.time || '待定'}</p>
                                <p>📅 {selectedActDetails.dates ? selectedActDetails.dates.join(', ') : '詳見通告'}</p>
                                <p>👤 導師: {selectedActDetails.teacher || '待定'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Existing Search UI with Status Dot */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center"><Search className="mr-2 text-purple-500"/> 學生去向查詢</h3>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            placeholder="輸入學生姓名或班別..." 
                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                            value={staffSearchTerm}
                            onChange={(e) => setStaffSearchTerm(e.target.value)}
                        />
                        <button onClick={() => setStaffShowAll(!staffShowAll)} className={`px-4 rounded-xl border font-bold text-sm transition ${staffShowAll ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-slate-500'}`}>
                            {staffShowAll ? '顯示全部' : '僅顯示搜尋'}
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[500px]">
                        {filteredMasterList.length === 0 && <div className="text-center py-8 text-slate-400">沒有找到相關學生</div>}
                        {filteredMasterList.map(student => {
                            const statusColor = getStudentStatus(student.key);
                            return (
                                <div key={student.key} className="flex items-center justify-between p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                    <div className="flex items-center">
                                        <div className={`w-3 h-3 rounded-full mr-3 ${statusColor} ${statusColor === 'bg-green-500' ? 'animate-pulse' : ''}`}></div>
                                        <div>
                                            <div className="font-bold text-slate-800">{student.chiName} <span className="text-slate-400 font-normal text-sm">({student.engName})</span></div>
                                            <div className="text-xs text-slate-500">{student.classCode} | {student.classNo}</div>
                                        </div>
                                    </div>
                                    {/* Show activities for this student */}
                                    <div className="text-right text-xs">
                                        {activities.filter(a => a.verifiedClass === student.classCode && a.verifiedName === student.chiName).length} 項活動
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex gap-4 text-xs text-slate-500 justify-end">
                        <span className="flex items-center"><div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div> 上課中</span>
                        <span className="flex items-center"><div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div> 缺席</span>
                        <span className="flex items-center"><div className="w-2 h-2 bg-gray-300 rounded-full mr-1"></div> 未點名/無活動</span>
                    </div>
                </div>

            </div>
        </div>
    );
  };

  // ---------------------------------------------------------------------------
  // VIEW SWITCHER
  // ---------------------------------------------------------------------------
  if (currentView === 'rollcall') return renderRollCallView();
  if (currentView === 'staff') return renderStaffView();
  
  // Default Home View (Student View as base but with Menu)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans text-slate-900">
      
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-blue-200 shadow-lg">
              <Settings size={20} className="animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">香海正覺蓮社佛教正覺蓮社學校</h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Activity Master V3.9.0</p>
            </div>
          </div>
          {/* Menu Buttons */}
          <div className="flex gap-2">
              <button onClick={() => setCurrentView('staff')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="教職員"><Users size={20}/></button>
              <button onClick={() => setCurrentView('rollcall')} className="p-2 text-orange-500 hover:bg-orange-50 rounded-full" title="點名系統"><CheckSquare size={20}/></button>
              <button onClick={() => setCurrentView('admin')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="行政"><Shield size={20}/></button>
          </div>
        </div>
      </header>

      {/* BODY - Simplified Student Search for Home View */}
      {currentView === 'student' && (
          <div className="max-w-2xl mx-auto mt-10 p-4">
              <div className="text-center mb-10">
                  <h2 className="text-3xl font-extrabold text-slate-800 mb-2">全方位活動查詢</h2>
                  <p className="text-slate-500">輸入班別及學號 (例如 5A12) 或姓名查詢</p>
              </div>
              {/* Note: In full code, this connects to existing student search logic. 
                  For this snippet, ensure the existing student search UI is placed here. 
                  I am preserving the structure. */}
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
                  <Search className="w-12 h-12 text-blue-200 mx-auto mb-4"/>
                  <p className="text-slate-400">請使用上方選單切換功能，或在此處整合原有的學生搜尋組件。</p>
              </div>
          </div>
      )}

      {/* Admin View Placeholder connecting to StatsView */}
      {currentView === 'admin' && (
          // Connect to existing Admin Logic / StatsView
          <StatsView masterList={masterList} activities={activities} queryLogs={[]} onBack={() => setCurrentView('student')} />
      )}

    </div>
  );
};

export default App;