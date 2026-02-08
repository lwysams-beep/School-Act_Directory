import React, { useState, useMemo, useEffect, useRef } from 'react';
// V3.9.3: Import All Required Icons to prevent Crash
import { 
    Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, 
    ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, 
    Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, 
    Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, 
    BarChart, History, TrendingUp, Filter, Cloud, UserX, PieChart, Download, 
    Activity, Layers, Maximize, Palette, ChevronDown 
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

// -----------------------------------------------------------------------------
// 4. ATTENDANCE VIEW COMPONENT (V3.9.2 - Stability Patch: Anti-Crash)
// -----------------------------------------------------------------------------
const AttendanceView = ({ masterList, activities, onBack, db }) => {
    // State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedActivity, setSelectedActivity] = useState('');
    const [attendanceMap, setAttendanceMap] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterMode, setFilterMode] = useState('AUTO'); 

    // 安全獲取活動列表
    const uniqueActivityNames = useMemo(() => {
        if (!activities || !Array.isArray(activities)) return [];
        const names = new Set(activities.map(a => a?.activity || '未命名活動'));
        return Array.from(names).sort();
    }, [activities]);

    // 智能篩選邏輯 (防崩潰版)
    const displayedStudents = useMemo(() => {
        if (!masterList || !Array.isArray(masterList)) return [];
        
        let filtered = masterList.filter(s => s && typeof s === 'object'); // 過濾無效資料

        if (selectedActivity && filterMode === 'AUTO') {
             const activityKey = (selectedActivity || '').trim().toLowerCase();
             filtered = filtered.filter(s => {
                 // 安全轉換字串，避免 null 導致崩潰
                 const rawData = JSON.stringify(s || {}).toLowerCase();
                 return rawData.includes(activityKey);
             });
             // 若無匹配，切換回顯示全部但保持篩選狀態
             if (filtered.length === 0) filtered = masterList.filter(s => s);
        } else if (filterMode !== 'AUTO' && filterMode !== 'ALL') {
            filtered = filtered.filter(s => {
                const code = s.classCode || '';
                return code.toString().startsWith(filterMode);
            });
        };

        // 安全排序
        return filtered.sort((a, b) => {
            const codeA = a.classCode || '';
            const codeB = b.classCode || '';
            if (codeA !== codeB) return codeA.toString().localeCompare(codeB.toString());
            const noA = parseInt(a.classNo || 0);
            const noB = parseInt(b.classNo || 0);
            return noA - noB;
        });
    }, [masterList, filterMode, selectedActivity]);

    // CSV 匯出 (安全版)
    const exportCSV = () => {
        if (displayedStudents.length === 0) return alert("名單為空，無法匯出");
        let csvContent = "\uFEFF日期,活動名稱,班別,學號,中文姓名,英文姓名,出席狀態\n";
        
        displayedStudents.forEach(s => {
            const status = attendanceMap[s.key] || '未記錄';
            let statusTc = '未記錄';
            if (status === 'present') statusTc = '出席';
            if (status === 'absent') statusTc = '缺席';
            if (status === 'late') statusTc = '遲到';
            
            // 安全讀取欄位
            const cCode = s.classCode || '';
            const cNo = s.classNo || '';
            const cName = s.chiName || '';
            const eName = s.engName || '';
            
            csvContent += `${selectedDate},${selectedActivity},${cCode},${cNo},${cName},${eName},${statusTc}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `點名表_${selectedActivity || 'Activity'}_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const markAll = (status) => {
        const newMap = { ...attendanceMap };
        displayedStudents.forEach(s => { if(s.key) newMap[s.key] = status; });
        setAttendanceMap(newMap);
    };

    const handleStatusChange = (key, status) => setAttendanceMap(prev => ({ ...prev, [key]: status }));

    const saveAttendance = async () => {
        if (!selectedActivity) return alert("請選擇活動");
        if (Object.keys(attendanceMap).length === 0) return alert("未有任何記錄");
        if (!db) return alert("系統錯誤：無法連接資料庫 (db undefined)"); // 檢查 DB 是否存在

        if (!window.confirm(`確認提交 ${Object.keys(attendanceMap).length} 筆紀錄？`)) return;

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const timestamp = new Date().toISOString();
            Object.entries(attendanceMap).forEach(([key, status]) => {
                const s = masterList.find(i => i.key === key) || {};
                // 確保 key 存在
                if (!key) return;
                
                const docId = `${selectedDate}_${selectedActivity}_${key}`.replace(/[\s\/]/g, '_'); 
                const docRef = doc(db, "attendance_records", docId);
                
                batch.set(docRef, {
                    date: selectedDate, 
                    activity: selectedActivity, 
                    studentKey: key,
                    studentName: s.chiName || 'Unknown', 
                    classCode: s.classCode || '', 
                    classNo: s.classNo || '',
                    status: status, 
                    updatedAt: timestamp
                });
            });
            await batch.commit();
            alert("成功儲存！");
            setAttendanceMap({});
        } catch (e) { 
            console.error(e); 
            alert("儲存錯誤: " + e.message); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 border-b pb-4">
                <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600 px-2 py-1">
                    <ArrowLeft size={20} className="mr-1"/> 返回
                </button>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center">
                    <CheckSquare className="mr-2 text-green-600"/> 點名系統 V3.9.2
                </h2>
                {/* 使用純文字按鈕代替 Download Icon，避免 Icon 未匯入導致白畫面 */}
                <button onClick={exportCSV} className="flex items-center text-blue-600 hover:bg-blue-50 px-3 py-1 rounded transition border border-blue-200">
                    匯出 CSV
                </button>
            </div>

            {/* Controls */}
            <div className="bg-slate-50 p-4 rounded-xl border mb-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 uppercase">日期</label>
                    <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="w-full p-2 border rounded"/>
                </div>
                <div className="md:col-span-4">
                    <label className="text-xs font-bold text-slate-500 uppercase">活動名稱 (自動篩選)</label>
                    <input list="act-list" type="text" value={selectedActivity} 
                        onChange={e => { setSelectedActivity(e.target.value); setFilterMode('AUTO'); }} 
                        placeholder="選擇活動..." className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500"/>
                    <datalist id="act-list">{uniqueActivityNames.map((n, i)=><option key={i} value={n}/>)}</datalist>
                </div>
                <div className="md:col-span-5 flex gap-1 overflow-x-auto">
                    {['ALL','1','2','3','4','5','6'].map(g => (
                        <button key={g} onClick={()=>setFilterMode(g)} 
                            className={`flex-1 py-2 px-1 text-xs rounded border whitespace-nowrap transition ${filterMode===g?'bg-green-600 text-white':'bg-white text-slate-500'}`}>
                            {g==='ALL'?'全校':`P${g}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-2 text-sm gap-2">
                <span>
                    名單: <b>{displayedStudents.length}</b> 人 
                    {filterMode==='AUTO' && selectedActivity && <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">智能篩選</span>}
                </span>
                <div className="flex gap-2">
                    <button onClick={()=>markAll('present')} className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-bold hover:bg-green-200">全選出席</button>
                    <button onClick={saveAttendance} disabled={isSubmitting} className="px-5 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 shadow flex items-center">
                        {isSubmitting ? '儲存中...' : '提交紀錄'}
                    </button>
                </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-auto border rounded-xl bg-white h-96">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 font-bold z-10 shadow-sm">
                        <tr>
                            <th className="p-3 w-24">班別</th>
                            <th className="p-3">姓名</th>
                            <th className="p-3 text-center w-16">出席</th>
                            <th className="p-3 text-center w-16">缺席</th>
                            <th className="p-3 text-center w-16">遲到</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayedStudents.length > 0 ? displayedStudents.map(s => {
                            if (!s || !s.key) return null; // 最終安全檢查
                            const st = attendanceMap[s.key];
                            return (
                                <tr key={s.key} className={`hover:bg-slate-50 ${st?'bg-blue-50/50':''}`}>
                                    <td className="p-3 font-mono text-slate-500">{s.classCode || '-'} ({s.classNo || '-'})</td>
                                    <td className="p-3 font-bold">
                                        {s.chiName || '無名'} <span className="text-xs text-slate-400 block md:inline">{s.engName}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={()=>handleStatusChange(s.key,'present')} className={`w-8 h-8 rounded-full flex items-center justify-center transition ${st==='present'?'bg-green-500 text-white shadow':'text-slate-300 hover:bg-green-100 hover:text-green-500'}`}>
                                            <CheckCircle size={18}/>
                                        </button>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={()=>handleStatusChange(s.key,'absent')} className={`w-8 h-8 rounded-full flex items-center justify-center transition ${st==='absent'?'bg-red-500 text-white shadow':'text-slate-300 hover:bg-red-100 hover:text-red-500'}`}>
                                            <X size={18}/>
                                        </button>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={()=>handleStatusChange(s.key,'late')} className={`w-8 h-8 rounded-full flex items-center justify-center transition ${st==='late'?'bg-orange-500 text-white shadow':'text-slate-300 hover:bg-orange-100 hover:text-orange-500'}`}>
                                            <Clock size={18}/>
                                        </button>
                                    </td>
                                </tr>
                            )
                        }) : (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">沒有符合的學生資料</td></tr>
                        )}
                    </tbody>
                </table>
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

  // V2.9: School Year State
  const [schoolYearStart, setSchoolYearStart] = useState(2025); 

  // Import Form State
  const [bulkInput, setBulkInput] = useState('');
  const [importActivity, setImportActivity] = useState('無人機班');
  const [importTime, setImportTime] = useState('15:30-16:30');
  const [importLocation, setImportLocation] = useState('禮堂');
  const [importDayId, setImportDayId] = useState(1);
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

  // DB Editing State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Staff View State
  const [staffShowAll, setStaffShowAll] = useState(false); 

  // Search UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date()); 

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
          if (isNaN(d.getTime())) { alert("日期格式錯誤，請輸入 DDMM"); return; }
      }

      if (!importDates.includes(dateString)) {
          const newDates = [...importDates, dateString].sort();
          setImportDates(newDates);
          if (newDates.length === 1) {
              const d = new Date(dateString);
              setImportDayId(d.getDay());
          }
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
      const parts = isoDate.split('-');
      if (parts.length === 3) return `${parts[2]}${parts[1]}`; 
      return isoDate;
  };

  const handleBulkImport = () => {
      const lines = bulkInput.trim().split('\n');
      const newItems = [];
      const dayMap = {1:'逢星期一', 2:'逢星期二', 3:'逢星期三', 4:'逢星期四', 5:'逢星期五', 6:'逢星期六', 0:'逢星期日'};
      let finalDateText = dayMap[importDayId];
      if (importDates.length > 0) finalDateText = `共${importDates.length}堂 (${importDates[0]}起)`;

      lines.forEach((line) => {
          const cleanLine = line.trim().replace(/['"]/g, ''); 
          if(!cleanLine) return;
          const mixedClassRegex = /([1-6][A-E])(\d{0,2})/; 
          const nameRegex = /[\u4e00-\u9fa5]{2,}/; 
          const phoneRegex = /[569]\d{7}/; 
          const classMatch = cleanLine.match(mixedClassRegex);
          const nameMatch = cleanLine.match(nameRegex);
          const phoneMatch = cleanLine.match(phoneRegex);

          if (classMatch && nameMatch) {
              newItems.push({
                  id: Date.now() + Math.random(),
                  rawName: nameMatch[0],
                  rawClass: classMatch[1],
                  rawClassNo: classMatch[2] ? classMatch[2].padStart(2, '0') : '00', 
                  rawPhone: phoneMatch ? phoneMatch[0] : '', 
                  activity: importActivity,
                  time: importTime,
                  location: importLocation,
                  dateText: finalDateText,
                  dayIds: [parseInt(importDayId)], 
                  specificDates: importDates, 
                  forceConflict: false 
              });
          }
      });

      if (newItems.length > 0) {
          setPendingImports(prev => [...prev, ...newItems]);
          setBulkInput('');
          alert(`成功識別 ${newItems.length} 筆。`);
      } else {
          alert("無法識別。");
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
  // DB MANAGEMENT LOGIC (V3.1)
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
      if (Object.keys(updates).length === 0) return alert("請輸入要修改的內容");
      dbSelectedIds.forEach(id => { const ref = doc(db, "activities", id); batch.update(ref, updates); });
      try { await batch.commit(); setDbSelectedIds(new Set()); setDbBatchMode(false); setBatchEditForm({ activity: '', time: '', location: '', dateText: '' }); alert("批量修改成功！"); } catch (e) { alert("批量修改失敗: " + e.message); }
  };

  const handleDeleteActivity = async (id) => {
      if(window.confirm('確定要刪除這筆紀錄嗎？')) {
          try { await deleteDoc(doc(db, "activities", id)); } catch(e) { alert("刪除失敗:" + e.message) }
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

  // Logic: Search (Updated with enhanced logging)
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

  // Staff View Logic
  const filteredActivities = useMemo(() => {
      let result = activities;
      if (!staffShowAll) {
          const d = new Date();
          const todayString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const currentDayId = d.getDay();
          result = result.filter(act => {
              if (act.specificDates && act.specificDates.length > 0) {
                  return act.specificDates.includes(todayString);
              }
              return act.dayIds && act.dayIds.includes(currentDayId);
          });
      }
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          result = result.filter(item => 
            item.verifiedName?.includes(lower) || 
            item.verifiedClass?.includes(lower) || 
            item.activity?.includes(lower)
          );
      }
      return result;
  }, [activities, searchTerm, staffShowAll]);

  // -------------------------------------------------------------------------
  // VIEWS
  // -------------------------------------------------------------------------
  const renderTopNavBar = () => (
    <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md sticky top-0 z-50">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentView('student')}>
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">佛</div>
            <span className="font-bold text-lg tracking-wide hidden sm:block">香海正覺蓮社佛教正覺蓮社學校</span>
        </div>
        
        <div className="hidden md:flex flex-col items-center justify-center text-xs text-slate-400 font-mono">
            <div>{currentDateTime.toLocaleDateString('zh-HK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div className="text-white font-bold text-lg">{currentDateTime.toLocaleTimeString('zh-HK')}</div>
        </div>

        {/* V3.9.1: 首頁點名入口 */}
<button 
    onClick={() => setCurrentView('attendance')}
    className="flex items-center px-4 py-2 bg-white/90 backdrop-blur-sm text-green-800 rounded-lg shadow-sm hover:bg-green-50 transition border border-green-100 font-bold"
>
    <CheckSquare size={18} className="mr-2 text-green-600"/>
    活動點名
</button>

        <div className="flex space-x-1">
            <button onClick={() => setCurrentView('student')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'student' || currentView === 'kiosk_result' ? 'bg-orange-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><User size={16} className="mr-2" /> 學生</button>
            <button onClick={() => setCurrentView('staff')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'staff' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Users size={16} className="mr-2" /> 教職員</button>
            <button onClick={() => setCurrentView('admin')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'admin' ? 'bg-slate-700 text-white font-bold shadow-lg ring-1 ring-slate-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                {user ? <Shield size={16} className="mr-2 text-green-400" /> : <Lock size={16} className="mr-2" />} 管理員
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
        '5A', '5B', '5C', '5D',
        '6A', '6B', '6C', '6D'
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
            </div>
        </div>
    );
  };

  const renderStaffView = () => (
      <div className="min-h-screen bg-slate-50 p-6 flex-1">
        <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-blue-900 flex items-center"><Users className="mr-2" /> 教職員查詢通道</h2>
                    <p className="text-slate-500 text-sm">
                        {staffShowAll ? '顯示所有活動紀錄' : '僅顯示今天 (Today) 的活動，如需查看其他日期請切換。'}
                    </p>
                </div>
                <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                    <button onClick={() => setStaffShowAll(false)} className={`px-4 py-1 text-sm rounded-md font-bold transition ${!staffShowAll ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>今天</button>
                    <button onClick={() => setStaffShowAll(true)} className={`px-4 py-1 text-sm rounded-md font-bold transition ${staffShowAll ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>全部</button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
              <div className="flex items-center space-x-2 mb-4 bg-slate-100 p-3 rounded-lg"><Search className="text-slate-400" /><input type="text" placeholder="輸入搜尋 (姓名/班別/活動)..." className="bg-transparent w-full outline-none text-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10"><tr className="text-slate-600 text-sm uppercase tracking-wider border-b"><th className="p-3">姓名</th><th className="p-3">班別 (學號)</th><th className="p-3">活動名稱</th><th className="p-3">時間</th><th className="p-3">地點</th><th className="p-3 text-blue-600">聯絡電話</th></tr></thead>
                  <tbody className="text-slate-700">
                      {filteredActivities.length > 0 ? filteredActivities.map((act) => (
                          <tr key={act.id} className="border-b hover:bg-blue-50 transition-colors">
                              <td className="p-3 font-medium">{act.verifiedName}</td>
                              <td className="p-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{act.verifiedClass} ({act.verifiedClassNo})</span></td>
                              <td className="p-3 font-bold text-slate-800">{act.activity}</td>
                              <td className="p-3 text-sm">{act.time}</td>
                              <td className="p-3 text-sm flex items-center"><MapPin size={14} className="mr-1 text-red-400"/> {act.location}</td>
                              <td className="p-3 text-sm font-mono text-blue-600">{act.rawPhone || '-'}</td>
                          </tr>
                      )) : (
                          <tr><td colSpan="6" className="p-12 text-center text-slate-400">
                              {staffShowAll ? '沒有找到相關資料' : '今天沒有已安排的活動 (或尚未輸入)'}
                          </td></tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      </div>
  );

  const renderLoginView = () => (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-slate-200">
              <div className="text-center mb-8"><div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-white"><Lock size={32} /></div><h2 className="text-2xl font-bold text-slate-800">管理員登入</h2><p className="text-slate-500 text-sm">請使用 Firebase 帳戶登入</p></div>
              <form onSubmit={handleLogin} className="space-y-4">
                  <div><label className="block text-slate-600 text-sm font-bold mb-2">Email</label><input type="email" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="admin@school.edu.hk" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></div>
                  <div><label className="block text-slate-600 text-sm font-bold mb-2">Password</label><input type="password" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••" value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} /></div>
                  <button type="submit" disabled={authLoading} className="w-full py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition flex items-center justify-center">{authLoading ? '登入中...' : '登入系統'}</button>
              </form>
          </div>
      </div>
  );

  const renderDatabaseManager = () => (
      <div className="bg-white p-6 rounded-xl shadow-md min-h-[500px]">
          <div className="flex justify-between items-center mb-6"><button onClick={() => setAdminTab('import')} className="flex items-center text-slate-500 hover:text-blue-600"><ArrowLeft className="mr-2" size={20} /> 返回導入介面</button><h2 className="text-2xl font-bold text-slate-800 flex items-center"><Database className="mr-2 text-blue-600" /> 數據庫管理</h2><div className="w-24"></div></div>
          <div className="mb-4 space-y-4">
              <div className="flex gap-4 items-center">
                  <div className="flex-1 bg-slate-50 border rounded-lg flex items-center px-3 py-2"><Search size={18} className="text-slate-400 mr-2" /><input type="text" placeholder="搜尋學生、活動或日期..." className="bg-transparent outline-none w-full text-sm" value={dbSearchTerm} onChange={(e) => setDbSearchTerm(e.target.value)} /></div>
                  {dbSelectedIds.size > 0 && (<div className="flex items-center gap-2"><button onClick={() => setDbBatchMode(!dbBatchMode)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700"><Edit2 size={16} className="mr-2" /> 批量修改 ({dbSelectedIds.size})</button><button onClick={handleBatchDelete} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-red-100 border border-red-200"><Trash2 size={16} className="mr-2" /> 刪除</button></div>)}
              </div>
              {dbBatchMode && dbSelectedIds.size > 0 && (<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-top-2"><h3 className="font-bold text-blue-800 text-sm mb-3">批量修改選取的 {dbSelectedIds.size} 筆資料 (留空則不修改)</h3><div className="grid grid-cols-4 gap-2 mb-3"><input className="p-2 border rounded text-sm" placeholder="新活動名稱..." value={batchEditForm.activity} onChange={e => setBatchEditForm({...batchEditForm, activity: e.target.value})} /><input className="p-2 border rounded text-sm" placeholder="新時間..." value={batchEditForm.time} onChange={e => setBatchEditForm({...batchEditForm, time: e.target.value})} /><input className="p-2 border rounded text-sm" placeholder="新地點..." value={batchEditForm.location} onChange={e => setBatchEditForm({...batchEditForm, location: e.target.value})} /><input className="p-2 border rounded text-sm" placeholder="新備註/日期..." value={batchEditForm.dateText} onChange={e => setBatchEditForm({...batchEditForm, dateText: e.target.value})} /></div><div className="flex justify-end gap-2"><button onClick={() => setDbBatchMode(false)} className="px-3 py-1 text-slate-500 hover:text-slate-800 text-sm">取消</button><button onClick={handleBatchEdit} className="bg-blue-600 text-white px-4 py-1 rounded text-sm font-bold hover:bg-blue-700">確認修改</button></div></div>)}
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm border-collapse"><thead className="bg-slate-100 text-slate-600 uppercase"><tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={filteredDbActivities.length > 0 && dbSelectedIds.size === filteredDbActivities.length} onChange={toggleDbSelectAll} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"/></th><th className="p-3">學生</th><th className="p-3">活動名稱</th><th className="p-3">時間</th><th className="p-3">地點</th><th className="p-3">日期/備註</th><th className="p-3 text-right">操作</th></tr></thead><tbody>
              {filteredDbActivities.map(act => (<tr key={act.id} className={`border-b hover:bg-slate-50 ${dbSelectedIds.has(act.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="p-3 text-center"><input type="checkbox" checked={dbSelectedIds.has(act.id)} onChange={() => toggleDbSelect(act.id)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" /></td>
                  <td className="p-3"><div className="font-bold text-slate-800">{act.verifiedClass} ({act.verifiedClassNo})</div><div className="text-slate-500">{act.verifiedName}</div></td>
                  {editingId === act.id ? (<><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.activity} onChange={e => setEditFormData({...editFormData, activity: e.target.value})} /></td><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.time} onChange={e => setEditFormData({...editFormData, time: e.target.value})} /></td><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} /></td><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.dateText} onChange={e => setEditFormData({...editFormData, dateText: e.target.value})} /></td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => saveEditActivity(act.id)} className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200"><CheckCircle size={18} /></button><button onClick={cancelEdit} className="bg-slate-100 text-slate-600 p-1 rounded hover:bg-slate-200"><X size={18} /></button></div></td></>) : (<><td className="p-3 font-bold text-blue-700">{act.activity}</td><td className="p-3">{act.time}</td><td className="p-3">{act.location}</td><td className="p-3 text-slate-500">{act.dateText}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => startEditActivity(act)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteActivity(act.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button></div></td></>)}
              </tr>))}
              {filteredDbActivities.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">沒有符合搜尋的資料。</td></tr>}
          </tbody></table></div>
      </div>
  );

  const renderAdminView = () => (
      <div className="min-h-screen bg-slate-100 p-6 flex-1">
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-2xl font-bold text-slate-800 flex items-center"><Shield className="mr-2" /> 管理員控制台</h2><p className="text-slate-500 text-sm">數據校對與發布。</p></div>
                <div className="flex items-center space-x-4"><div className="bg-white px-4 py-2 rounded-lg shadow text-sm font-mono text-slate-600 border border-slate-200">Admin: <span className="font-bold text-blue-600">{user.email}</span></div><button onClick={handleLogout} className="bg-red-50 text-red-500 px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200 flex items-center text-sm font-bold"><LogOut size={16} className="mr-2"/> 登出</button></div>
            </div>
            {/* 1. 隱藏的檔案上傳輸入框 (重建版) */}
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleMasterFileChange} />

            {/* 2. 管理員介面邏輯 (重建版) */}
            {adminTab === 'manage_db' ? (
                renderDatabaseManager()
            ) : adminTab === 'stats' ? (
                <StatsView 
                  masterList={masterList} 
                  activities={activities} 
                  onBack={() => setAdminTab('dashboard')} 
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* 按鈕: 匯入資料 */}
                  <button onClick={() => document.getElementById('file-upload-input').click()} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-slate-100 hover:border-blue-200 transition-all duration-300 group text-left">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><Upload className="text-blue-600" size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">匯入學生資料</h3><p className="text-slate-500 text-xs">上載 CSV 更新名單</p>
                    <input id="file-upload-input" type="file" className="hidden" accept=".csv" onChange={handleMasterFileChange} />
                  </button>
                  
                  {/* 按鈕: 學校數據 */}
                  <button onClick={() => setAdminTab('stats')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-slate-100 hover:border-orange-200 transition-all duration-300 group text-left">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><BarChart className="text-orange-600" size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">學校數據中心</h3><p className="text-slate-500 text-xs">查看分佈及參與率</p>
                  </button>
                  
                  {/* 按鈕: 資料庫管理 */}
                  <button onClick={() => setAdminTab('manage_db')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-slate-100 hover:border-purple-200 transition-all duration-300 group text-left">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><Database className="text-purple-600" size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">資料庫管理</h3><p className="text-slate-500 text-xs">進階數據操作</p>
                  </button>
                  
                  {/* 按鈕: 活動點名 (V3.9.0) */}
                  <button onClick={() => setCurrentView('attendance')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-slate-100 hover:border-green-200 transition-all duration-300 group text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><CheckSquare size={64} className="text-green-600 transform rotate-12"/></div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><CheckSquare className="text-green-600" size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">活動點名系統</h3><p className="text-slate-500 text-xs">處理出席紀錄</p>
                  </button>
                </div>
            )}
        </div>
    );
};
// -----------------------------------------------------------------------------
// 3. STATS VIEW COMPONENT (V3.9.3 - Emergency Fix: Anti-Crash)
// -----------------------------------------------------------------------------
const StatsView = ({ masterList, activities, onBack }) => {
    // 安全數據處理 (Data Sanitization)
    const safeList = useMemo(() => {
      if (!Array.isArray(masterList)) return [];
      return masterList.filter(s => s && typeof s === 'object'); // 濾除 undefined/null
    }, [masterList]);
  
    const stats = useMemo(() => {
      const data = {
        totalStudents: safeList.length,
        byGrade: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 },
        byHouse: { 'R': 0, 'Y': 0, 'B': 0, 'G': 0, 'Unknown': 0 }, // Red, Yellow, Blue, Green
        totalActivities: Array.isArray(activities) ? activities.length : 0,
        activeStudents: 0 // 參與至少 1 個活動的學生
      };
  
      try {
        safeList.forEach(student => {
          // 1. Grade Stats (安全讀取)
          const grade = student.classCode ? student.classCode.charAt(0) : 'Other';
          if (data.byGrade[grade] !== undefined) {
            data.byGrade[grade]++;
          }
  
          // 2. House Stats (安全讀取 + 大小寫容錯)
          const houseMap = { '紅': 'R', 'Red': 'R', 'R': 'R', '黃': 'Y', 'Yellow': 'Y', 'Y': 'Y', '藍': 'B', 'Blue': 'B', 'B': 'B', '綠': 'G', 'Green': 'G', 'G': 'G' };
          // 假設 house 欄位可能叫 house, houseColor, 或 hidden 屬性
          const h = student.house || student.houseColor || 'Unknown';
          const cleanHouse = houseMap[h] || houseMap[h.toString().trim()] || 'Unknown';
          if (data.byHouse[cleanHouse] !== undefined) {
            data.byHouse[cleanHouse]++;
          } else {
            data.byHouse['Unknown']++;
          }
  
          // 3. Activity Stats (假設有 activities 陣列)
          if (Array.isArray(student.activities) && student.activities.length > 0) {
            data.activeStudents++;
          }
        });
      } catch (err) {
        console.error("Stats Calculation Error:", err);
        // 發生錯誤時保持 data 現狀，避免白畫面
      }
  
      return data;
    }, [safeList, activities]);
  
    // 安全計算百分比 helper
    const getPercent = (val, total) => {
      if (!total || total === 0) return 0;
      return Math.round((val / total) * 100);
    };
  
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg animate-in fade-in duration-300 min-h-[500px]">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600 transition">
            <ArrowLeft className="mr-2" size={20} /> 返回主控台
          </button>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
            <BarChart className="mr-2 text-blue-600" /> 學校數據中心 (V3.9.3)
          </h2>
          <div className="w-24"></div> 
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: 總人數 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-sm border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-600 font-bold uppercase text-xs tracking-wider">總學生人數</span>
              <Users size={20} className="text-blue-400"/>
            </div>
            <div className="text-4xl font-black text-slate-800">{stats.totalStudents}</div>
            <div className="text-xs text-slate-500 mt-2">全校在籍學生</div>
          </div>
  
          {/* Card 2: 活動總數 */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl shadow-sm border border-orange-200">
            <div className="flex items-center justify-between mb-2">
               <span className="text-orange-600 font-bold uppercase text-xs tracking-wider">活動項目</span>
               <Activity size={20} className="text-orange-400"/>
            </div>
            <div className="text-4xl font-black text-slate-800">{stats.totalActivities}</div>
            <div className="text-xs text-slate-500 mt-2">本學年開設項目</div>
          </div>
  
          {/* Card 3: 參與率 */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-sm border border-green-200">
             <div className="flex items-center justify-between mb-2">
               <span className="text-green-600 font-bold uppercase text-xs tracking-wider">參與率 (活躍)</span>
               <TrendingUp size={20} className="text-green-400"/>
            </div>
            <div className="text-4xl font-black text-slate-800">{getPercent(stats.activeStudents, stats.totalStudents)}<span className="text-lg">%</span></div>
            <div className="text-xs text-slate-500 mt-2">{stats.activeStudents} 名學生參與中</div>
          </div>
        </div>
  
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 年級分佈 */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center"><Layers size={18} className="mr-2"/> 年級分佈</h3>
            <div className="space-y-3">
              {['1', '2', '3', '4', '5', '6'].map(g => {
                const count = stats.byGrade[g] || 0;
                const pct = getPercent(count, stats.totalStudents);
                return (
                  <div key={g} className="flex items-center text-sm">
                    <div className="w-12 font-bold text-slate-600">P.{g}</div>
                    <div className="flex-1 bg-white rounded-full h-3 overflow-hidden shadow-inner mx-2">
                      <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{width: `${pct}%`}}></div>
                    </div>
                    <div className="w-16 text-right text-slate-500">{count} 人</div>
                  </div>
                )
              })}
            </div>
          </div>
  
          {/* 社別分佈 */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center"><Shield size={18} className="mr-2"/> 社別分佈</h3>
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-white rounded-xl border-l-4 border-red-500 shadow-sm">
                  <div className="text-red-500 font-bold text-xs uppercase">Red House</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.byHouse['R']}</div>
               </div>
               <div className="p-4 bg-white rounded-xl border-l-4 border-yellow-400 shadow-sm">
                  <div className="text-yellow-600 font-bold text-xs uppercase">Yellow House</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.byHouse['Y']}</div>
               </div>
               <div className="p-4 bg-white rounded-xl border-l-4 border-blue-500 shadow-sm">
                  <div className="text-blue-500 font-bold text-xs uppercase">Blue House</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.byHouse['B']}</div>
               </div>
               <div className="p-4 bg-white rounded-xl border-l-4 border-green-500 shadow-sm">
                  <div className="text-green-500 font-bold text-xs uppercase">Green House</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.byHouse['G']}</div>
               </div>
            </div>
            {stats.byHouse['Unknown'] > 0 && (
              <div className="mt-4 text-xs text-slate-400 text-center">
                * 有 {stats.byHouse['Unknown']} 名學生未分配社別或資料不詳
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
        </div>
      </div>
  );

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

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {renderTopNavBar()}
      {currentView === 'student' && renderStudentView()}
      {currentView === 'staff' && renderStaffView()}
      {currentView === 'admin' && (user ? renderAdminView() : renderLoginView())}
      {currentView === 'kiosk_result' && renderKioskResultView()}
    </div>
  );
};

export default App;