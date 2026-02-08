import React, { useState, useMemo, useEffect, useRef } from 'react';
// V3.9: Added ClipboardCheck for Attendance
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, BarChart, History, TrendingUp, Filter, Cloud, UserX, PieChart, Download, Activity, Save as SaveIcon, LayoutDashboard, ClipboardCheck, FileOutput } from 'lucide-react';

// =============================================================================
//  FIREBASE IMPORTS & CONFIGURATION (LIVE)
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

// *** 使用你提供的真實設定 ***
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
const auth = getAuth(app);
const db = getFirestore(app);
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// -----------------------------------------------------------------------------
// 1. UTILS
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

// V3.9: Helper to generate attendance key
const getAttendanceKey = (activityId, studentKey, date) => `${activityId}_${studentKey}_${date}`;

// Main Component
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
  const [attendanceRecords, setAttendanceRecords] = useState([]); // V3.9: New Attendance Data
  const [isMasterLoading, setIsMasterLoading] = useState(false);
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
  
  // Stats UI State
  const [statsSubTab, setStatsSubTab] = useState('overview');
  const [expandedActivity, setExpandedActivity] = useState(null);
  const [statsSort, setStatsSort] = useState('most');
  const [statsActivityFilter, setStatsActivityFilter] = useState('');
  const [statsEditingKey, setStatsEditingKey] = useState(null); 
  const [statsEditForm, setStatsEditForm] = useState({});

  // DB Management UI
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbSelectedIds, setDbSelectedIds] = useState(new Set());
  const [dbBatchMode, setDbBatchMode] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState({ activity: '', time: '', location: '', dateText: '' });
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Staff View State
  const [staffShowAll, setStaffShowAll] = useState(false);
  const [staffSelectedActivity, setStaffSelectedActivity] = useState(''); // V3.9: Activity Filter

  // Attendance View State (V3.9)
  const [attendancePwd, setAttendancePwd] = useState('');
  const [isAttendanceUnlocked, setIsAttendanceUnlocked] = useState(false);
  const [selectedAttendanceAct, setSelectedAttendanceAct] = useState(null);

  // Search UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [todayDay, setTodayDay] = useState(new Date().getDay());
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

  // V3.9: Attendance Listener
  useEffect(() => {
    const q = collection(db, "attendance");
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const att = snapshot.docs.map(doc => doc.data());
        setAttendanceRecords(att);
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

  const handleAttendanceLogin = (e) => {
      e.preventDefault();
      if (attendancePwd === 'howcanyouturnthison') {
          setIsAttendanceUnlocked(true);
          setAttendancePwd('');
      } else {
          alert('密碼錯誤');
      }
  };

  // ---------------------------------------------------------------------------
  // DATA ACTIONS
  // ---------------------------------------------------------------------------
  // ... (Master Data Import logic same as V3.5)
  const handleMasterUploadTrigger = () => fileInputRef.current.click();
  const handleMasterFileChange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.readAsText(f, csvEncoding); r.onload = async (ev) => { const t = ev.target.result; try { const n = parseMasterCSV(t); if (n.length > 0) { if (window.confirm(`解析成功！共 ${n.length} 筆資料。上傳?`)) { setIsMasterLoading(true); try { await setDoc(doc(db, "settings", "master_list"), { students: n, schoolYearStart, updatedAt: new Date().toISOString(), updatedBy: user.email }); setMasterList(n); alert("成功！"); } catch (er) { alert("失敗: " + er.message); } finally { setIsMasterLoading(false); } } } else { alert("無法識別"); } } catch (er) { alert("解析失敗"); } }; };
  const handleSchoolYearChange = async (e) => { const y = parseInt(e.target.value); setSchoolYearStart(y); if (user) try { await setDoc(doc(db, "settings", "master_list"), { students: masterList, schoolYearStart: y, updatedAt: new Date().toISOString(), updatedBy: user.email }, { merge: true }); } catch (e) {} };
  const startEditStudent = (s) => { setStatsEditingKey(s.key); setStatsEditForm({ ...s }); };
  const cancelEditStudent = () => { setStatsEditingKey(null); setStatsEditForm({}); };
  const saveEditStudent = async () => { setIsMasterLoading(true); try { const n = masterList.map(s => s.key === statsEditingKey ? { ...statsEditForm, key: `${statsEditForm.classCode}-${statsEditForm.chiName}` } : s); await setDoc(doc(db, "settings", "master_list"), { students: n, schoolYearStart, updatedAt: new Date().toISOString(), updatedBy: user.email }); setMasterList(n); setStatsEditingKey(null); } catch (e) { alert("失敗: " + e.message); } finally { setIsMasterLoading(false); } };
  const handleDeleteStudent = async (s) => { if (!window.confirm("確定移除?")) return; setIsMasterLoading(true); try { const n = masterList.filter(x => x.key !== s.key); await setDoc(doc(db, "settings", "master_list"), { students: n, schoolYearStart, updatedAt: new Date().toISOString(), updatedBy: user.email }); setMasterList(n); } catch (e) { alert("失敗: " + e.message); } finally { setIsMasterLoading(false); } };

  const handleAddDate = () => { if (!tempDateInput) return; let dStr = tempDateInput; const m = tempDateInput.match(/^(\d{1,2})(\d{2})$/); if (m) { const D = parseInt(m[1]), M = parseInt(m[2]); let Y = schoolYearStart; if (M >= 1 && M <= 8) Y++; else if (M < 9) { alert("月份錯誤"); return; } dStr = `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`; } else { const d = new Date(tempDateInput); if (isNaN(d.getTime())) { alert("格式錯誤 DDMM"); return; } } if (!importDates.includes(dStr)) { const n = [...importDates, dStr].sort(); setImportDates(n); if (n.length === 1) setImportDayId(new Date(dStr).getDay()); } setTempDateInput(''); if (dateInputRef.current) dateInputRef.current.focus(); };
  const handleDateInputKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDate(); } };
  const handleRemoveDate = (d) => setImportDates(p => p.filter(x => x !== d));
  const handleClearDates = () => setImportDates([]);
  const formatDisplayDate = (d) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}${p[1]}` : d; };
  const handleBulkImport = () => { const l = bulkInput.trim().split('\n'); const n = []; const dm = {1:'逢星期一',2:'逢星期二',3:'逢星期三',4:'逢星期四',5:'逢星期五',6:'逢星期六',0:'逢星期日'}; let dt = dm[importDayId]; if (importDates.length > 0) dt = `共${importDates.length}堂 (${importDates[0]}起)`; l.forEach(line => { const cl = line.trim().replace(/['"]/g, ''); if (!cl) return; const cm = cl.match(/([1-6][A-E])(\d{0,2})/); const nm = cl.match(/[\u4e00-\u9fa5]{2,}/); const pm = cl.match(/[569]\d{7}/); if (cm && nm) n.push({ id: Date.now() + Math.random(), rawName: nm[0], rawClass: cm[1], rawClassNo: cm[2] ? cm[2].padStart(2, '0') : '00', rawPhone: pm ? pm[0] : '', activity: importActivity, time: importTime, location: importLocation, dateText: dt, dayIds: [parseInt(importDayId)], specificDates: importDates, forceConflict: false }); }); if (n.length > 0) { setPendingImports(p => [...p, ...n]); setBulkInput(''); alert(`識別 ${n.length} 筆`); } else alert("無法識別"); };

  const { matched, conflicts } = useMemo(() => { const m = [], c = []; pendingImports.forEach(i => { if (i.forceConflict) { c.push({ ...i, status: 'manual_conflict' }); return; } let s = masterList.find(x => x.classCode === i.rawClass && x.chiName === i.rawName); if (!s && i.rawClassNo !== '00') s = masterList.find(x => x.classCode === i.rawClass && x.classNo === i.rawClassNo); if (!s) { const p = masterList.filter(x => x.chiName === i.rawName); if (p.length === 1) s = p[0]; } if (s) m.push({ ...i, verifiedName: s.chiName, verifiedClass: s.classCode, verifiedClassNo: s.classNo, status: 'verified' }); else c.push({ ...i, status: 'conflict' }); }); return { matched: m, conflicts: c }; }, [pendingImports, masterList]);
  useEffect(() => setSelectedMatchIds(new Set(matched.map(m => m.id))), [matched.length]);
  const toggleSelectMatch = (id) => { const n = new Set(selectedMatchIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedMatchIds(n); };
  const toggleSelectAll = () => setSelectedMatchIds(selectedMatchIds.size === matched.length ? new Set() : new Set(matched.map(m => m.id)));
  const handlePublish = async () => { const tp = matched.filter(m => selectedMatchIds.has(m.id)); if (tp.length === 0) return alert("請選擇"); try { const bp = tp.map(i => { const { id, status, forceConflict, ...d } = i; return addDoc(collection(db, "activities"), { ...d, createdAt: new Date().toISOString() }); }); await Promise.all(bp); const pid = new Set(tp.map(m => m.id)); setPendingImports(p => p.filter(x => !pid.has(x.id))); alert("發布成功"); } catch (e) { alert(e.message); } };
  const handleManualConflict = (id) => setPendingImports(p => p.map(i => i.id === id ? { ...i, forceConflict: true } : i));
  const handleResolveConflict = (i, s) => setPendingImports(p => p.map(x => x.id === i.id ? { ...x, rawClass: s.classCode, rawName: s.chiName, rawClassNo: s.classNo, forceConflict: false } : x));
  const handleDeleteImport = (id) => setPendingImports(p => p.filter(i => i.id !== id));
  const filteredDbActivities = useMemo(() => { if (!dbSearchTerm) return activities; const l = dbSearchTerm.toLowerCase(); return activities.filter(a => a.activity?.toLowerCase().includes(l) || a.verifiedName?.includes(l) || a.verifiedClass?.includes(l)); }, [activities, dbSearchTerm]);
  const toggleDbSelect = (id) => { const n = new Set(dbSelectedIds); if (n.has(id)) n.delete(id); else n.add(id); setDbSelectedIds(n); };
  const toggleDbSelectAll = () => setDbSelectedIds(dbSelectedIds.size === filteredDbActivities.length ? new Set() : new Set(filteredDbActivities.map(a => a.id)));
  const handleBatchDelete = async () => { if (!window.confirm(`刪除 ${dbSelectedIds.size} 筆?`)) return; const b = writeBatch(db); dbSelectedIds.forEach(id => b.delete(doc(db, "activities", id))); try { await b.commit(); setDbSelectedIds(new Set()); alert("成功"); } catch (e) { alert(e.message); } };
  const handleBatchEdit = async () => { if (!window.confirm(`修改 ${dbSelectedIds.size} 筆?`)) return; const b = writeBatch(db), u = {}; if (batchEditForm.activity) u.activity = batchEditForm.activity; if (batchEditForm.time) u.time = batchEditForm.time; if (batchEditForm.location) u.location = batchEditForm.location; if (batchEditForm.dateText) u.dateText = batchEditForm.dateText; if (Object.keys(u).length === 0) return alert("無內容"); dbSelectedIds.forEach(id => b.update(doc(db, "activities", id), u)); try { await b.commit(); setDbSelectedIds(new Set()); setDbBatchMode(false); setBatchEditForm({ activity: '', time: '', location: '', dateText: '' }); alert("成功"); } catch (e) { alert(e.message); } };
  const handleDeleteActivity = async (id) => { if (window.confirm('刪除?')) try { await deleteDoc(doc(db, "activities", id)); } catch (e) { alert(e.message); } };
  const startEditActivity = (a) => { setEditingId(a.id); setEditFormData({ activity: a.activity, time: a.time, location: a.location, dateText: a.dateText }); };
  const saveEditActivity = async (id) => { try { await updateDoc(doc(db, "activities", id), editFormData); setEditingId(null); } catch (e) { alert(e.message); } };
  const cancelEdit = () => { setEditingId(null); setEditFormData({}); };
  const handleStudentSearch = () => { const no = selectedClassNo.padStart(2, '0'); const s = masterList.find(x => x.classCode === selectedClass && x.classNo === no); const log = { id: Date.now(), timestamp: new Date().toLocaleString('zh-HK'), class: selectedClass, classNo: no, name: s ? s.chiName : '未知', success: !!s }; setQueryLogs(p => [log, ...p]); const r = activities.filter(i => i.verifiedClass === selectedClass && i.verifiedClassNo === no); setStudentResult(r); setCurrentView('kiosk_result'); };
  
  // V3.9: Updated Staff Filter
  const filteredActivities = useMemo(() => {
      let r = activities;
      const d = new Date();
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // 1. First Filter: Show All vs Today (ignored if specific activity selected)
      if (!staffShowAll && !staffSelectedActivity) {
          r = r.filter(a => (a.specificDates && a.specificDates.includes(ds)) || (a.dayIds && a.dayIds.includes(d.getDay())));
      }

      // 2. Second Filter: Specific Activity Dropdown
      if (staffSelectedActivity) {
          r = r.filter(a => a.activity === staffSelectedActivity);
      }

      // 3. Search Term
      if (searchTerm) {
          const l = searchTerm.toLowerCase();
          r = r.filter(i => i.verifiedName?.includes(l) || i.verifiedClass?.includes(l) || i.activity?.includes(l));
      }
      return r;
  }, [activities, searchTerm, staffShowAll, staffSelectedActivity]);

  // V3.9: Analytics Data (Grade Distribution Added)
  const analyticsData = useMemo(() => {
    const studentStats = masterList.map(s => {
      const acts = activities.filter(a => a.verifiedClass === s.classCode && a.verifiedClassNo === s.classNo);
      return { ...s, count: acts.length, acts };
    });
    const activityGroups = {};
    activities.forEach(a => {
        if (!activityGroups[a.activity]) { activityGroups[a.activity] = { name: a.activity, count: 0, students: [] }; }
        activityGroups[a.activity].count += 1;
        activityGroups[a.activity].students.push(a);
    });
    const activityStats = Object.values(activityGroups).sort((a,b) => b.count - a.count);
    
    // Grade Stats (V3.9 New)
    const gradeCounts = {'1':0, '2':0, '3':0, '4':0, '5':0, '6':0};
    let totalActiveStudents = 0;
    studentStats.forEach(s => {
        if (s.count > 0) {
            const grade = s.classCode.charAt(0);
            if (gradeCounts[grade] !== undefined) gradeCounts[grade]++;
            totalActiveStudents++;
        }
    });

    const classGroups = {};
    activities.forEach(a => { if (!classGroups[a.verifiedClass]) classGroups[a.verifiedClass] = 0; classGroups[a.verifiedClass] += 1; });
    const classStats = Object.entries(classGroups).sort((a,b) => b[1] - a[1]);
    
    return { studentStats, activityStats, classStats, gradeCounts, totalActiveStudents };
  }, [activities, masterList]);

  // V3.9: Attendance Actions
  const handleMarkAttendance = async (actId, studentClass, studentNo, status) => {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const uniqueKey = `${actId}_${studentClass}_${studentNo}_${dateKey}`; // Composite Key
      
      try {
          await setDoc(doc(db, "attendance", uniqueKey), {
              activityId: actId,
              class: studentClass,
              classNo: studentNo,
              date: dateKey,
              status: status, // 'present', 'sick', 'personal'
              timestamp: new Date().toISOString()
          });
      } catch (e) { alert("點名失敗"); }
  };

  const getAttendanceStatus = (actId, sClass, sNo) => {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const rec = attendanceRecords.find(r => r.date === dateKey && r.activityId === actId && r.class === sClass && r.classNo === sNo);
      return rec ? rec.status : null;
  };

  const getTodayStatusColor = (status) => {
      if (status === 'present') return 'bg-green-500';
      if (status === 'sick' || status === 'personal') return 'bg-red-500';
      return 'bg-gray-300';
  };

  // V3.9: Download CSV for Attendance
  const downloadAttendanceCSV = (act) => {
     let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
     csvContent += `活動名稱,班別,學號,姓名,狀態,日期\n`;
     
     // Filter records for this activity
     const relevantRecords = attendanceRecords.filter(r => r.activityId === act.id);
     
     // We want to list ALL students in the activity, and their status if available
     const actStudents = activities.filter(a => a.activity === act.name); // Using name to group similar
     
     // Actually, let's just export what we see in the attendance list
     // Find all students for this specific activity ID instance
     const registeredStudents = activities.filter(a => a.id === act.id); // Usually only 1 if ID based, but if logic grouped by name...
     // Let's use the specific act passed in
     
     // Better logic: Find all students registered for this activity NAME
     const allRegistered = activities.filter(a => a.activity === act.activity);
     
     allRegistered.forEach(s => {
         // Find if they have a record for ANY date (or filter by date if needed)
         // For simple export, let's export ALL records for this activity
         const studRecs = attendanceRecords.filter(r => r.activityId === s.id); // Assuming act ID links
         // Since attendance links to specific activity ID in DB list
         
         // Simplified: Export Today's status for the current list
         const d = new Date();
         const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
         const status = getAttendanceStatus(s.id, s.verifiedClass, s.verifiedClassNo);
         
         let statusText = '未點名';
         if (status === 'present') statusText = '出席';
         if (status === 'sick') statusText = '病假';
         if (status === 'personal') statusText = '事假';
         
         csvContent += `${s.activity},${s.verifiedClass},${s.verifiedClassNo},${s.verifiedName},${statusText},${dateKey}\n`;
     });
     
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `${act.activity}_點名紀錄.csv`);
     document.body.appendChild(link);
     link.click();
  };

  // -------------------------------------------------------------------------
  // VIEWS
  // -------------------------------------------------------------------------
  const renderTopNavBar = () => (<div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md sticky top-0 z-50"><div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentView('student')}><div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">佛</div><span className="font-bold text-lg tracking-wide hidden sm:block">佛教正覺蓮社學校</span></div><div className="hidden md:flex flex-col items-center justify-center text-xs text-slate-400 font-mono"><div>{currentDateTime.toLocaleDateString('zh-HK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div><div className="text-white font-bold text-lg">{currentDateTime.toLocaleTimeString('zh-HK')}</div></div><div className="flex space-x-1"><button onClick={() => setCurrentView('student')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'student' || currentView === 'kiosk_result' ? 'bg-orange-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><User size={16} className="mr-2" /> 學生</button><button onClick={() => setCurrentView('staff')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'staff' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Users size={16} className="mr-2" /> 教職員</button><button onClick={() => setCurrentView('attendance')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'attendance' ? 'bg-purple-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><ClipboardCheck size={16} className="mr-2" /> 點名</button><button onClick={() => setCurrentView('admin')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'admin' ? 'bg-slate-700 text-white font-bold shadow-lg ring-1 ring-slate-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{user ? <Shield size={16} className="mr-2 text-green-400" /> : <Lock size={16} className="mr-2" />} 管理員</button></div></div>);
  const renderStudentView = () => { const allClasses = ['1A','1B','1C','1D','1E','2A','2B','2C','2D','2E','3A','3B','3C','3D','3E','4A','4B','4C','4D','4E','5A','5B','5C','5D','6A','6B','6C','6D']; return (<div className="flex-1 flex flex-col bg-gradient-to-b from-orange-50 to-white"><div className="flex-1 flex flex-col items-center justify-center p-4"><div className="w-full max-w-4xl bg-white p-8 rounded-3xl shadow-xl border border-orange-100"><div className="text-center mb-6"><h1 className="text-2xl font-bold text-slate-800">課外活動查詢</h1><p className="text-slate-500">請輸入你的班別及學號</p></div><div className="mb-6"><label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">班別 Class</label><div className="grid grid-cols-5 md:grid-cols-10 gap-2">{allClasses.map((cls) => (<button key={cls} onClick={() => setSelectedClass(cls)} className={`py-2 rounded-lg font-bold text-lg transition-colors ${selectedClass === cls ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-600 hover:bg-orange-100'}`}>{cls}</button>))}</div></div><div className="flex flex-col md:flex-row gap-8"><div className="flex-1"><label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">學號 Class No.</label><div className="flex items-center justify-center mb-4"><div className="h-20 w-32 bg-slate-100 rounded-2xl flex items-center justify-center text-5xl font-bold tracking-widest text-slate-800 border-2 border-orange-200 shadow-inner">{selectedClassNo || <span className="text-slate-300 text-3xl">--</span>}</div></div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map((num) => (<button key={num} onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + num); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 active:border-orange-500 shadow-sm transition-all">{num}</button>))}<button onClick={() => setSelectedClassNo('')} className="h-14 bg-red-50 text-red-500 rounded-xl font-bold border border-red-100">清除</button><button onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + 0); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 shadow-sm">0</button><button onClick={() => setSelectedClassNo(prev => prev.slice(0, -1))} className="h-14 bg-slate-100 text-slate-500 rounded-xl font-bold">←</button></div></div><div className="flex items-center justify-center md:w-1/3"><button onClick={handleStudentSearch} disabled={selectedClassNo.length === 0} className={`w-full py-8 rounded-2xl text-3xl font-bold text-white shadow-xl transition-all flex items-center justify-center ${selectedClassNo.length > 0 ? 'bg-orange-600 hover:bg-orange-700 transform hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}><Search className="mr-3" size={32} strokeWidth={3} /> 查詢</button></div></div></div></div></div>); };
  
  // V3.9: Staff View with Dropdown & Dot Indicators
  const renderStaffView = () => {
      // Get unique activity names for dropdown
      const uniqueActivities = [...new Set(activities.map(a => a.activity))];

      return (
        <div className="min-h-screen bg-slate-50 p-6 flex-1"><div className="max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-end">
                <div><h2 className="text-2xl font-bold text-blue-900 flex items-center"><Users className="mr-2" /> 教職員查詢通道</h2><p className="text-slate-500 text-sm">實時查看學生去向與點名狀態。</p></div>
                {!staffSelectedActivity && (
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1"><button onClick={() => setStaffShowAll(false)} className={`px-4 py-1 text-sm rounded-md font-bold transition ${!staffShowAll ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>今天</button><button onClick={() => setStaffShowAll(true)} className={`px-4 py-1 text-sm rounded-md font-bold transition ${staffShowAll ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>全部</button></div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                  {/* Activity Filter Dropdown */}
                  <div className="flex-1">
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-bold" value={staffSelectedActivity} onChange={(e) => setStaffSelectedActivity(e.target.value)}>
                          <option value="">-- 依活動篩選 (顯示詳情) --</option>
                          {uniqueActivities.map(act => <option key={act} value={act}>{act}</option>)}
                      </select>
                  </div>
                  {/* Search Box */}
                  <div className="flex-1 flex items-center bg-slate-100 p-3 rounded-lg"><Search className="text-slate-400 mr-2" /><input type="text" placeholder="輸入搜尋 (姓名/班別)..." className="bg-transparent w-full outline-none text-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              </div>

              {/* V3.9: Activity Detail Card (If selected) */}
              {staffSelectedActivity && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                      <div>
                          <h3 className="text-xl font-bold text-blue-900">{staffSelectedActivity}</h3>
                          <p className="text-sm text-blue-600 mt-1">共 {filteredActivities.length} 名學生</p>
                      </div>
                      <div className="text-right text-xs text-slate-500 space-y-1">
                          <div><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>出席</div>
                          <div><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>缺席</div>
                          <div><span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1"></span>未點</div>
                      </div>
                  </div>
              )}

              <div className="overflow-x-auto max-h-[600px] overflow-y-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 sticky top-0 z-10"><tr className="text-slate-600 text-sm uppercase tracking-wider border-b"><th className="p-3">狀態</th><th className="p-3">姓名</th><th className="p-3">班別 (學號)</th><th className="p-3">活動名稱</th><th className="p-3">時間</th><th className="p-3">地點</th><th className="p-3 text-blue-600">聯絡電話</th></tr></thead><tbody className="text-slate-700">
                  {filteredActivities.length > 0 ? filteredActivities.map((act) => {
                      const status = getAttendanceStatus(act.id, act.verifiedClass, act.verifiedClassNo);
                      return (
                      <tr key={act.id} className="border-b hover:bg-blue-50 transition-colors">
                          <td className="p-3 text-center"><div className={`w-3 h-3 rounded-full ${getTodayStatusColor(status)}`} title={status || '未點名'}></div></td>
                          <td className="p-3 font-medium">{act.verifiedName}</td><td className="p-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{act.verifiedClass} ({act.verifiedClassNo})</span></td><td className="p-3 font-bold text-slate-800">{act.activity}</td><td className="p-3 text-sm">{act.time}</td><td className="p-3 text-sm flex items-center"><MapPin size={14} className="mr-1 text-red-400"/> {act.location}</td><td className="p-3 text-sm font-mono text-blue-600">{act.rawPhone || '-'}</td>
                      </tr>
                  )}) : (<tr><td colSpan="7" className="p-12 text-center text-slate-400">沒有符合的資料</td></tr>)}
              </tbody></table></div>
            </div>
        </div></div>
      );
  };
  
  // V3.9: Attendance View
  const renderAttendanceView = () => {
      // 1. Lock Screen
      if (!isAttendanceUnlocked) {
          return (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-800 p-6">
                  <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
                      <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white"><ClipboardCheck size={32} /></div>
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">點名系統</h2>
                      <p className="text-slate-500 text-sm mb-6">請輸入活動密碼以繼續</p>
                      <form onSubmit={handleAttendanceLogin} className="space-y-4">
                          <input type="password" className="w-full p-3 border border-slate-300 rounded-lg text-center text-lg tracking-widest" placeholder="Password" value={attendancePwd} onChange={e => setAttendancePwd(e.target.value)} />
                          <button type="submit" className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition">進入點名</button>
                      </form>
                  </div>
              </div>
          );
      }

      // 2. Activity Selector (List Today's Activities)
      if (!selectedAttendanceAct) {
          const d = new Date();
          const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const currentDayId = d.getDay();
          
          const todaysActivities = activities.filter(a => (a.specificDates && a.specificDates.includes(todayStr)) || (a.dayIds && a.dayIds.includes(currentDayId)));
          
          // Group by Activity Name to avoid duplicates if multiple students in list
          const uniqueActs = [...new Set(todaysActivities.map(a => a.activity))];

          return (
              <div className="min-h-screen bg-slate-50 p-6 flex-1"><div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-purple-900">今日活動點名 ({todayStr})</h2><button onClick={() => setIsAttendanceUnlocked(false)} className="text-slate-500 hover:text-red-500">退出</button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uniqueActs.map(actName => {
                          const count = todaysActivities.filter(a => a.activity === actName).length;
                          return (
                              <button key={actName} onClick={() => setSelectedAttendanceAct({ name: actName, id: todaysActivities.find(a=>a.activity===actName).id })} className="bg-white p-6 rounded-xl shadow-sm border hover:border-purple-500 hover:shadow-md transition text-left">
                                  <h3 className="text-xl font-bold text-slate-800">{actName}</h3>
                                  <p className="text-purple-600 font-bold mt-2">{count} 名學生</p>
                              </button>
                          );
                      })}
                      {uniqueActs.length === 0 && <div className="col-span-2 text-center py-10 text-slate-400">今天沒有活動需要點名</div>}
                  </div>
              </div></div>
          );
      }

      // 3. Taking Attendance Interface
      const studentsForAct = activities.filter(a => a.activity === selectedAttendanceAct.name); // Get all students for this activity name
      
      return (
          <div className="min-h-screen bg-white p-6 flex-1"><div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <div>
                      <button onClick={() => setSelectedAttendanceAct(null)} className="flex items-center text-slate-500 hover:text-purple-600 mb-2"><ArrowLeft size={16} className="mr-1"/> 返回列表</button>
                      <h2 className="text-3xl font-bold text-slate-800">{selectedAttendanceAct.name} <span className="text-base font-normal text-slate-500 ml-2">點名表</span></h2>
                  </div>
                  <button onClick={() => downloadAttendanceCSV(selectedAttendanceAct)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-700 shadow"><Download size={16} className="mr-2"/> 下載紀錄 (CSV)</button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {studentsForAct.map(student => {
                      const status = getAttendanceStatus(student.id, student.verifiedClass, student.verifiedClassNo);
                      return (
                          <div key={student.id} className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between transition ${status ? 'bg-slate-50 border-purple-200' : 'bg-white border-slate-200'}`}>
                              <div className="flex items-center mb-3 md:mb-0 w-full md:w-auto">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mr-4 ${status === 'present' ? 'bg-green-100 text-green-700' : status === 'sick' || status === 'personal' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                      {student.verifiedClassNo}
                                  </div>
                                  <div>
                                      <div className="font-bold text-xl text-slate-800">{student.verifiedName}</div>
                                      <div className="text-slate-500">{student.verifiedClass} | {student.rawPhone || '無電話'}</div>
                                  </div>
                              </div>
                              <div className="flex gap-2 w-full md:w-auto">
                                  <button onClick={() => handleMarkAttendance(student.id, student.verifiedClass, student.verifiedClassNo, 'present')} className={`flex-1 md:flex-none px-6 py-3 rounded-lg font-bold transition ${status === 'present' ? 'bg-green-600 text-white shadow-inner' : 'bg-slate-100 text-slate-600 hover:bg-green-100'}`}>出席</button>
                                  <button onClick={() => handleMarkAttendance(student.id, student.verifiedClass, student.verifiedClassNo, 'sick')} className={`flex-1 md:flex-none px-4 py-3 rounded-lg font-bold transition ${status === 'sick' ? 'bg-red-600 text-white shadow-inner' : 'bg-slate-100 text-slate-600 hover:bg-red-100'}`}>病假</button>
                                  <button onClick={() => handleMarkAttendance(student.id, student.verifiedClass, student.verifiedClassNo, 'personal')} className={`flex-1 md:flex-none px-4 py-3 rounded-lg font-bold transition ${status === 'personal' ? 'bg-orange-500 text-white shadow-inner' : 'bg-slate-100 text-slate-600 hover:bg-orange-100'}`}>事假</button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div></div>
      );
  };

  const renderLoginView = () => (<div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-6"><div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-slate-200"><div className="text-center mb-8"><div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-white"><Lock size={32} /></div><h2 className="text-2xl font-bold text-slate-800">管理員登入</h2><p className="text-slate-500 text-sm">請使用 Firebase 帳戶登入</p></div><form onSubmit={handleLogin} className="space-y-4"><div><label className="block text-slate-600 text-sm font-bold mb-2">Email</label><input type="email" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="admin@school.edu.hk" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></div><div><label className="block text-slate-600 text-sm font-bold mb-2">Password</label><input type="password" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••" value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} /></div><button type="submit" disabled={authLoading} className="w-full py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition flex items-center justify-center">{authLoading ? '登入中...' : '登入系統'}</button></form></div></div>);
  
  const renderStatsView = () => {
      const { studentStats, activityStats, classStats, gradeCounts, totalActiveStudents } = analyticsData;
      const sortedStudents = [...studentStats].sort((a, b) => { if (statsSort === 'most') return b.count - a.count; if (statsSort === 'least') return a.count - b.count; return 0; });
      const displayStudents = statsActivityFilter ? sortedStudents.filter(s => s.count > 0) : sortedStudents;
      
      return (
          <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b pb-4"><button onClick={() => setAdminTab('import')} className="flex items-center text-slate-500 hover:text-blue-600"><ArrowLeft className="mr-2" size={20} /> 返回</button><h2 className="text-2xl font-bold text-slate-800 flex items-center"><BarChart className="mr-2 text-blue-600" /> 數據統計中心</h2><div className="w-24"></div></div>
              <div className="flex gap-4 mb-6 border-b border-slate-100 pb-1">{[{id:'overview',icon:LayoutDashboard,label:'概覽'},{id:'students',icon:User,label:'學生統計'},{id:'activities',icon:PieChart,label:'活動統計'},{id:'logs',icon:History,label:'查詢紀錄'}].map(t => (<button key={t.id} onClick={() => setStatsSubTab(t.id)} className={`pb-2 flex items-center font-bold text-sm ${statsSubTab === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><t.icon size={16} className="mr-2"/> {t.label}</button>))}</div>
              <div className="flex-1 overflow-y-auto">
                  {statsSubTab === 'overview' && (<>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><div className="text-blue-500 text-xs font-bold uppercase mb-1">總活動人次</div><div className="text-3xl font-bold text-blue-900">{activities.length}</div></div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100"><div className="text-emerald-500 text-xs font-bold uppercase mb-1">參與學生</div><div className="text-3xl font-bold text-emerald-900">{studentStats.filter(s=>s.count>0).length} / {masterList.length}</div></div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100"><div className="text-purple-500 text-xs font-bold uppercase mb-1">活動項目</div><div className="text-3xl font-bold text-purple-900">{activityStats.length}</div></div>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100"><div className="text-orange-500 text-xs font-bold uppercase mb-1">最熱門</div><div className="text-xl font-bold text-orange-900 truncate">{activityStats[0]?.name || '-'}</div></div>
                    </div>
                    {/* V3.9: Grade Level Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="border rounded-xl p-4">
                            <h3 className="font-bold text-slate-700 mb-4">各級參與比例</h3>
                            <div className="space-y-4">
                                {Object.entries(gradeCounts).map(([grade, count]) => (
                                    <div key={grade} className="flex items-center">
                                        <div className="w-12 font-bold text-slate-600">P{grade}</div>
                                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden flex relative">
                                            <div className="bg-indigo-500 h-full transition-all duration-500" style={{width: `${totalActiveStudents ? (count/totalActiveStudents)*100 : 0}%`}}></div>
                                            <span className="absolute right-2 top-0 bottom-0 flex items-center text-xs text-slate-500">{count}人</span>
                                        </div>
                                        <div className="w-12 text-right text-xs font-bold text-indigo-600">{totalActiveStudents ? Math.round((count/totalActiveStudents)*100) : 0}%</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="border rounded-xl p-4">
                            <h3 className="font-bold text-slate-700 mb-4">各班參與概況</h3>
                            <div className="h-64 overflow-y-auto pr-2 space-y-2">
                                {analyticsData.classStats.map(([cls, count]) => (
                                    <div key={cls} className="flex items-center text-sm">
                                        <div className="w-10 font-bold text-slate-600">{cls}</div>
                                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden mx-2"><div className="bg-blue-500 h-full rounded-full" style={{width: `${(count / Math.max(...analyticsData.classStats.map(c=>c[1]))) * 100}%`}}></div></div>
                                        <div className="w-8 text-right text-slate-500">{count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                  </>)}
                  {statsSubTab === 'activities' && (<div className="bg-white border rounded-xl overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500"><tr><th className="p-3">排名</th><th className="p-3">活動名稱</th><th className="p-3 text-center">參加人數</th><th className="p-3 text-right">操作</th></tr></thead><tbody>{activityStats.map((act, i) => (<React.Fragment key={act.name}><tr className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedActivity(expandedActivity === act.name ? null : act.name)}><td className="p-3 text-slate-400 font-mono w-16">{i+1}</td><td className="p-3 font-bold text-slate-700">{act.name}</td><td className="p-3 text-center"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">{act.count}</span></td><td className="p-3 text-right text-blue-500 text-xs">{expandedActivity === act.name ? '收起' : '查看名單'}</td></tr>{expandedActivity === act.name && (<tr className="bg-slate-50 border-b"><td colSpan="4" className="p-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{act.students.map((s, idx) => (<div key={idx} className="bg-white border p-2 rounded text-xs flex justify-between"><span className="font-bold">{s.verifiedClass} {s.verifiedClassNo}</span><span>{s.verifiedName}</span></div>))}</div></td></tr>)}</React.Fragment>))}</tbody></table></div>)}
                  {statsSubTab === 'logs' && (<div className="bg-slate-50 border rounded-xl overflow-y-auto max-h-[500px]"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500 sticky top-0"><tr><th className="p-3">時間</th><th className="p-3">查詢對象</th><th className="p-3">狀態</th></tr></thead><tbody>{queryLogs.length > 0 ? queryLogs.map((log, i) => (<tr key={i} className="border-b last:border-0 hover:bg-white"><td className="p-3 text-slate-500 text-xs">{log.timestamp}</td><td className="p-3 font-bold text-slate-700">{log.class} ({log.classNo}) {log.name}</td><td className="p-3">{log.success ? <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded">成功</span> : <span className="text-red-500 text-xs">失敗</span>}</td></tr>)) : (<tr><td colSpan="3" className="p-8 text-center text-slate-400">暫無查詢紀錄</td></tr>)}</tbody></table></div>)}
                  {statsSubTab === 'students' && (<div className="h-full flex flex-col"><div className="bg-blue-50 p-4 rounded-xl mb-4 space-y-3"><div className="flex gap-2"><button onClick={() => setStatsSort('most')} className={`flex-1 py-1 text-xs rounded font-bold ${statsSort === 'most' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'}`}>最多活動</button><button onClick={() => setStatsSort('least')} className={`flex-1 py-1 text-xs rounded font-bold ${statsSort === 'least' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'}`}>最少活動</button></div><div className="flex items-center bg-white border border-blue-200 rounded px-2"><Filter size={14} className="text-blue-400 mr-2" /><input type="text" placeholder="以活動名稱搜尋 (如: 無人機)" className="w-full py-2 text-sm outline-none" value={statsActivityFilter} onChange={(e) => setStatsActivityFilter(e.target.value)} /></div></div><div className="bg-white border rounded-xl flex-1 overflow-y-auto max-h-[500px]"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500 sticky top-0"><tr><th className="p-3">排名</th><th className="p-3">學生</th><th className="p-3 text-center">數量</th><th className="p-3">參與活動</th><th className="p-3 text-right">管理</th></tr></thead><tbody>{displayStudents.map((s, i) => (<tr key={s.key} className="border-b hover:bg-slate-50"><td className="p-3 text-slate-400 font-mono">{i + 1}</td>{statsEditingKey === s.key ? (<><td className="p-3" colSpan="2"><div className="flex space-x-1 mb-1"><input className="w-12 p-1 border rounded text-xs" value={statsEditForm.classCode || ''} onChange={e => setStatsEditForm({...statsEditForm, classCode: e.target.value})} placeholder="班" /><input className="w-12 p-1 border rounded text-xs" value={statsEditForm.classNo || ''} onChange={e => setStatsEditForm({...statsEditForm, classNo: e.target.value})} placeholder="號" /></div><div className="flex space-x-1"><input className="w-20 p-1 border rounded text-xs" value={statsEditForm.chiName || ''} onChange={e => setStatsEditForm({...statsEditForm, chiName: e.target.value})} placeholder="中文" /><input className="w-24 p-1 border rounded text-xs" value={statsEditForm.engName || ''} onChange={e => setStatsEditForm({...statsEditForm, engName: e.target.value})} placeholder="Eng" /></div></td><td className="p-3 text-right"><div className="flex justify-end space-x-1"><button onClick={saveEditStudent} className="bg-green-100 text-green-700 p-1 rounded"><CheckCircle size={16}/></button><button onClick={cancelEditStudent} className="bg-slate-100 text-slate-500 p-1 rounded"><X size={16}/></button></div></td></>) : (<><td className="p-3"><div className="font-bold text-slate-700">{s.classCode} ({s.classNo})</div><div className="text-xs text-slate-500">{s.chiName}</div></td><td className="p-3 text-center"><span className={`inline-block w-8 h-8 leading-8 rounded-full font-bold ${s.count > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{s.count}</span></td><td className="p-3 text-xs text-slate-500">{s.actList.join(', ')}</td><td className="p-3 text-right"><div className="flex justify-end space-x-1"><button onClick={() => startEditStudent(s)} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition" title="修改資料"><Edit2 size={16} /></button><button onClick={() => handleDeleteStudent(s)} className="text-red-300 hover:text-red-600 hover:bg-red-50 p-1 rounded transition" title="刪除學生 (離校)"><UserX size={16} /></button></div></td></>)}</tr>))}</tbody></table></div></div>)}
              </div>
          </div>
      );
  };

  const renderDatabaseManager = () => (<div className="bg-white p-6 rounded-xl shadow-md min-h-[500px]"><div className="flex justify-between items-center mb-6"><button onClick={() => setAdminTab('import')} className="flex items-center text-slate-500 hover:text-blue-600"><ArrowLeft className="mr-2" size={20} /> 返回導入介面</button><h2 className="text-2xl font-bold text-slate-800 flex items-center"><Database className="mr-2 text-blue-600" /> 數據庫管理</h2><div className="w-24"></div></div><div className="mb-4 space-y-4"><div className="flex gap-4 items-center"><div className="flex-1 bg-slate-50 border rounded-lg flex items-center px-3 py-2"><Search size={18} className="text-slate-400 mr-2" /><input type="text" placeholder="搜尋學生、活動或日期..." className="bg-transparent outline-none w-full text-sm" value={dbSearchTerm} onChange={(e) => setDbSearchTerm(e.target.value)} /></div>{dbSelectedIds.size > 0 && (<div className="flex items-center gap-2"><button onClick={() => setDbBatchMode(!dbBatchMode)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700"><Edit2 size={16} className="mr-2" /> 批量修改 ({dbSelectedIds.size})</button><button onClick={handleBatchDelete} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-red-100 border border-red-200"><Trash2 size={16} className="mr-2" /> 刪除</button></div>)}</div>{dbBatchMode && dbSelectedIds.size > 0 && (<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-top-2"><h3 className="font-bold text-blue-800 text-sm mb-3">批量修改選取的 {dbSelectedIds.size} 筆資料 (留空則不修改)</h3><div className="grid grid-cols-4 gap-2 mb-3"><input className="p-2 border rounded text-sm" placeholder="新活動名稱..." value={batchEditForm.activity} onChange={e => setBatchEditForm({...batchEditForm, activity: e.target.value})} /><input className="p-2 border rounded text-sm" placeholder="新時間..." value={batchEditForm.time} onChange={e => setBatchEditForm({...batchEditForm, time: e.target.value})} /><input className="p-2 border rounded text-sm" placeholder="新地點..." value={batchEditForm.location} onChange={e => setBatchEditForm({...batchEditForm, location: e.target.value})} /><input className="p-2 border rounded text-sm" placeholder="新備註/日期..." value={batchEditForm.dateText} onChange={e => setBatchEditForm({...batchEditForm, dateText: e.target.value})} /></div><div className="flex justify-end gap-2"><button onClick={() => setDbBatchMode(false)} className="px-3 py-1 text-slate-500 hover:text-slate-800 text-sm">取消</button><button onClick={handleBatchEdit} className="bg-blue-600 text-white px-4 py-1 rounded text-sm font-bold hover:bg-blue-700">確認修改</button></div></div>)}</div><div className="overflow-x-auto"><table className="w-full text-left text-sm border-collapse"><thead className="bg-slate-100 text-slate-600 uppercase"><tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={filteredDbActivities.length > 0 && dbSelectedIds.size === filteredDbActivities.length} onChange={toggleDbSelectAll} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"/></th><th className="p-3">學生</th><th className="p-3">活動名稱</th><th className="p-3">時間</th><th className="p-3">地點</th><th className="p-3">日期/備註</th><th className="p-3 text-right">操作</th></tr></thead><tbody>{filteredDbActivities.map(act => (<tr key={act.id} className={`border-b hover:bg-slate-50 ${dbSelectedIds.has(act.id) ? 'bg-blue-50/50' : ''}`}><td className="p-3 text-center"><input type="checkbox" checked={dbSelectedIds.has(act.id)} onChange={() => toggleDbSelect(act.id)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" /></td><td className="p-3"><div className="font-bold text-slate-800">{act.verifiedClass} ({act.verifiedClassNo})</div><div className="text-slate-500">{act.verifiedName}</div></td>{editingId === act.id ? (<><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.activity} onChange={e => setEditFormData({...editFormData, activity: e.target.value})} /></td><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.time} onChange={e => setEditFormData({...editFormData, time: e.target.value})} /></td><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} /></td><td className="p-3"><input className="w-full p-1 border rounded" value={editFormData.dateText} onChange={e => setEditFormData({...editFormData, dateText: e.target.value})} /></td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => saveEditActivity(act.id)} className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200"><CheckCircle size={18} /></button><button onClick={cancelEdit} className="bg-slate-100 text-slate-600 p-1 rounded hover:bg-slate-200"><X size={18} /></button></div></td></>) : (<><td className="p-3 font-bold text-blue-700">{act.activity}</td><td className="p-3">{act.time}</td><td className="p-3">{act.location}</td><td className="p-3 text-slate-500">{act.dateText}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => startEditActivity(act)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteActivity(act.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button></div></td></>)}</tr>))} {filteredDbActivities.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">沒有符合搜尋的資料。</td></tr>}</tbody></table></div></div>);

  const renderAdminView = () => (
      <div className="min-h-screen bg-slate-100 p-6 flex-1">
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-2xl font-bold text-slate-800 flex items-center"><Shield className="mr-2" /> 管理員控制台</h2><p className="text-slate-500 text-sm">數據校對與發布。</p></div>
                <div className="flex items-center space-x-4"><div className="bg-white px-4 py-2 rounded-lg shadow text-sm font-mono text-slate-600 border border-slate-200">Admin: <span className="font-bold text-blue-600">{user.email}</span></div><button onClick={handleLogout} className="bg-red-50 text-red-500 px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200 flex items-center text-sm font-bold"><LogOut size={16} className="mr-2"/> 登出</button></div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleMasterFileChange} />
            {adminTab === 'manage_db' ? renderDatabaseManager() : adminTab === 'stats' ? renderStatsView() : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4"><div className="flex items-center space-x-3"><h3 className="font-bold text-lg text-green-700 flex items-center"><CheckCircle className="mr-2" size={20} /> 等待發布 ({matched.length})</h3><button onClick={toggleSelectAll} className="text-sm text-slate-500 flex items-center hover:text-slate-800">{selectedMatchIds.size === matched.length ? <CheckSquare size={16} className="mr-1"/> : <Square size={16} className="mr-1"/>}全選/取消</button></div>{matched.length > 0 && (<button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center shadow-md active:scale-95 transition"><Save size={18} className="mr-2" /> 發布選取項目 ({selectedMatchIds.size})</button>)}</div>
                        <div className="bg-green-50 rounded-lg border border-green-100 max-h-96 overflow-y-auto"><table className="w-full text-sm"><thead className="bg-green-100/50 text-green-800 sticky top-0 border-b border-green-200"><tr><th className="py-2 px-2 w-8"></th><th className="py-2 px-4 text-left w-1/3">原始 PDF 資料</th><th className="py-2 px-4 text-center w-10"></th><th className="py-2 px-4 text-left w-1/3">Master Data (真理)</th><th className="py-2 px-4 text-right">操作</th></tr></thead><tbody>
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
                    <button onClick={handleMasterUploadTrigger} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl flex items-center justify-center font-bold shadow-md transition"><Cloud className="mr-2" /> 上載真理 Data (雲端版)</button>
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
                            <div><label className="text-xs text-slate-500 font-bold uppercase">星期 (自動/預設)</label><select className="w-full p-2 border rounded" value={importDayId} onChange={e => setImportDayId(e.target.value)}><option value="1">逢星期一</option><option value="2">逢星期二</option><option value="3">逢星期三</option><option value="4">逢星期四</option><option value="5">逢星期五</option><option value="6">逢星期六</option><option value="0">逢星期日</option></select></div>
                        </div>
                        <div className="mb-4"><label className="text-xs text-slate-500 font-bold uppercase flex justify-between"><span>貼上名單 (PDF Copy/Paste)</span><span className="text-blue-500 cursor-pointer flex items-center" title="格式: 4A 蔡舒朗 (可含電話)"><FileText size={12} className="mr-1"/> 說明</span></label><textarea className="w-full h-32 p-2 border rounded bg-slate-50 text-sm font-mono" placeholder={`4A 蔡舒朗 91234567\n2A1 陳嘉瑩`} value={bulkInput} onChange={e => setBulkInput(e.target.value)}></textarea></div>
                        <button onClick={handleBulkImport} className="w-full py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition">識別並載入</button>
                    </div>
                </div>
                </div>
            )}
        </div>
      </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {renderTopNavBar()}
      {currentView === 'student' && renderStudentView()}
      {currentView === 'staff' && renderStaffView()}
      {currentView === 'attendance' && renderAttendanceView()}
      {currentView === 'admin' && (user ? renderAdminView() : renderLoginView())}
      {currentView === 'kiosk_result' && renderKioskResultView()}
    </div>
  );
};

export default App;