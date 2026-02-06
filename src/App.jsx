import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, BarChart, History, TrendingUp, Filter, Cloud, UserX, Save as SaveIcon, MoreHorizontal } from 'lucide-react';

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
// A=Class(0), B=No(1), C=EngName(2), D=ChiName(3), E=Sex(4)
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
  const [schoolYearStart, setSchoolYearStart] = useState(2025); // Default start year

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
  const [statsSort, setStatsSort] = useState('most');
  const [statsActivityFilter, setStatsActivityFilter] = useState('');
  const [statsEditingKey, setStatsEditingKey] = useState(null); 
  const [statsEditForm, setStatsEditForm] = useState({});

  // DB Management UI State (V3.1)
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbSelectedIds, setDbSelectedIds] = useState(new Set());
  const [dbBatchMode, setDbBatchMode] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState({ activity: '', time: '', location: '', dateText: '' });

  // DB Editing State (Single Row)
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Search UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [todayDay, setTodayDay] = useState(new Date().getDay());

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

  const startEditStudent = (student) => {
      setStatsEditingKey(student.key);
      setStatsEditForm({ ...student });
  };

  const cancelEditStudent = () => {
      setStatsEditingKey(null);
      setStatsEditForm({});
  };

  const saveEditStudent = async () => {
      setIsMasterLoading(true);
      try {
          const newMasterList = masterList.map(s => 
              s.key === statsEditingKey ? { ...statsEditForm, key: `${statsEditForm.classCode}-${statsEditForm.chiName}` } : s 
          );
          await setDoc(doc(db, "settings", "master_list"), {
              students: newMasterList,
              schoolYearStart: schoolYearStart,
              updatedAt: new Date().toISOString(),
              updatedBy: user.email
          });
          setMasterList(newMasterList);
          setStatsEditingKey(null);
      } catch (error) {
          alert("更新失敗: " + error.message);
      } finally {
          setIsMasterLoading(false);
      }
  };

  const handleDeleteStudent = async (studentToDelete) => {
      if (!window.confirm(`確定要將學生移除嗎？\n\n${studentToDelete.classCode} (${studentToDelete.classNo}) ${studentToDelete.chiName}\n\n注意：這將會從「真理數據庫」中永久刪除此學生。`)) return;
      setIsMasterLoading(true);
      try {
          const newMasterList = masterList.filter(s => s.key !== studentToDelete.key);
          await setDoc(doc(db, "settings", "master_list"), {
              students: newMasterList,
              schoolYearStart: schoolYearStart,
              updatedAt: new Date().toISOString(),
              updatedBy: user.email
          });
          setMasterList(newMasterList);
      } catch (error) {
          alert("刪除失敗: " + error.message);
      } finally {
          setIsMasterLoading(false);
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
  // DB MANAGEMENT LOGIC (V3.1 Upgraded)
  // ---------------------------------------------------------------------------
  
  // Filter activities based on search
  const filteredDbActivities = useMemo(() => {
      if (!dbSearchTerm) return activities;
      const lower = dbSearchTerm.toLowerCase();
      return activities.filter(a => 
          a.activity?.toLowerCase().includes(lower) || 
          a.verifiedName?.includes(lower) || 
          a.verifiedClass?.includes(lower)
      );
  }, [activities, dbSearchTerm]);

  // Handle DB Selection
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

  // Batch Delete
  const handleBatchDelete = async () => {
      if (!window.confirm(`確定要刪除選取的 ${dbSelectedIds.size} 筆資料嗎？`)) return;
      
      const batch = writeBatch(db);
      dbSelectedIds.forEach(id => {
          const ref = doc(db, "activities", id);
          batch.delete(ref);
      });

      try {
          await batch.commit();
          setDbSelectedIds(new Set());
          alert("批量刪除成功！");
      } catch (e) {
          alert("批量刪除失敗: " + e.message);
      }
  };

  // Batch Edit
  const handleBatchEdit = async () => {
      if (!window.confirm(`確定要將選取的 ${dbSelectedIds.size} 筆資料統一修改嗎？`)) return;

      const batch = writeBatch(db);
      const updates = {};
      if (batchEditForm.activity) updates.activity = batchEditForm.activity;
      if (batchEditForm.time) updates.time = batchEditForm.time;
      if (batchEditForm.location) updates.location = batchEditForm.location;
      if (batchEditForm.dateText) updates.dateText = batchEditForm.dateText;

      if (Object.keys(updates).length === 0) return alert("請輸入要修改的內容");

      dbSelectedIds.forEach(id => {
          const ref = doc(db, "activities", id);
          batch.update(ref, updates);
      });

      try {
          await batch.commit();
          setDbSelectedIds(new Set());
          setDbBatchMode(false);
          setBatchEditForm({ activity: '', time: '', location: '', dateText: '' });
          alert("批量修改成功！");
      } catch (e) {
          alert("批量修改失敗: " + e.message);
      }
  };

  // Single Delete
  const handleDeleteActivity = async (id) => {
      if(window.confirm('確定要刪除這筆紀錄嗎？')) {
          try { await deleteDoc(doc(db, "activities", id)); } catch(e) { alert("刪除失敗:" + e.message) }
      }
  };

  // Single Edit
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

  // Logic: Search
  const handleStudentSearch = () => {
    const formattedClassNo = selectedClassNo.padStart(2, '0');
    const student = masterList.find(s => s.classCode === selectedClass && s.classNo === formattedClassNo);
    const newLog = { id: Date.now(), timestamp: new Date().toLocaleString('zh-HK'), class: selectedClass, classNo: formattedClassNo, name: student ? student.chiName : '未知', success: !!student };
    setQueryLogs(prev => [newLog, ...prev]);
    const results = activities.filter(item => item.verifiedClass === selectedClass && item.verifiedClassNo === formattedClassNo);
    setStudentResult(results);
    setCurrentView('kiosk_result');
  };

  const filteredActivities = activities.filter(item => 
    item.verifiedName?.includes(searchTerm) || item.verifiedClass?.includes(searchTerm) || item.activity?.includes(searchTerm)
  );

  // -------------------------------------------------------------------------
  // VIEWS
  // -------------------------------------------------------------------------
  const renderTopNavBar = () => (
    <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md sticky top-0 z-50">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentView('student')}>
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">佛</div>
            <span className="font-bold text-lg tracking-wide hidden sm:block">佛教正覺蓮社學校</span>
        </div>
        <div className="flex space-x-1">
            <button onClick={() => setCurrentView('student')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'student' || currentView === 'kiosk_result' ? 'bg-orange-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><User size={16} className="mr-2" /> 學生</button>
            <button onClick={() => setCurrentView('staff')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'staff' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Users size={16} className="mr-2" /> 教職員</button>
            <button onClick={() => setCurrentView('admin')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'admin' ? 'bg-slate-700 text-white font-bold shadow-lg ring-1 ring-slate-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                {user ? <Shield size={16} className="mr-2 text-green-400" /> : <Lock size={16} className="mr-2" />} 管理員
            </button>
        </div>
    </div>
  );

  const renderStudentView = () => (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-orange-50 to-white">
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-xl border border-orange-100">
            <div className="text-center mb-6"><h1 className="text-2xl font-bold text-slate-800">課外活動查詢</h1><p className="text-slate-500">請輸入你的班別及學號</p></div>
            <div className="mb-6"><label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">班別 Class</label><div className="grid grid-cols-6 gap-2">{['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'].map((cls) => (<button key={cls} onClick={() => setSelectedClass(cls)} className={`py-3 rounded-lg font-bold text-lg transition-colors ${selectedClass === cls ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-600 hover:bg-orange-100'}`}>{cls}</button>))}</div></div>
            <div className="mb-8"><label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">學號 Class No.</label><div className="flex items-center justify-center mb-4"><div className="h-20 w-32 bg-slate-100 rounded-2xl flex items-center justify-center text-5xl font-bold tracking-widest text-slate-800 border-2 border-orange-200 shadow-inner">{selectedClassNo || <span className="text-slate-300 text-3xl">--</span>}</div></div><div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map((num) => (<button key={num} onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + num); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 active:border-orange-500 shadow-sm transition-all">{num}</button>))}<button onClick={() => setSelectedClassNo('')} className="h-14 bg-red-50 text-red-500 rounded-xl font-bold border border-red-100">清除</button><button onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + 0); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 shadow-sm">0</button><button onClick={() => setSelectedClassNo(prev => prev.slice(0, -1))} className="h-14 bg-slate-100 text-slate-500 rounded-xl font-bold">←</button></div></div>
            <button onClick={handleStudentSearch} disabled={selectedClassNo.length === 0} className={`w-full py-5 rounded-2xl text-2xl font-bold text-white shadow-xl transition-all flex items-center justify-center ${selectedClassNo.length > 0 ? 'bg-orange-600 hover:bg-orange-700 transform hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}><Search className="mr-2" strokeWidth={3} /> 查詢</button>
          </div>
        </div>
    </div>
  );

  const renderStaffView = () => (
      <div className="min-h-screen bg-slate-50 p-6 flex-1">
        <div className="max-w-5xl mx-auto">
            <div className="mb-6"><h2 className="text-2xl font-bold text-blue-900 flex items-center"><Users className="mr-2" /> 教職員查詢通道</h2><p className="text-slate-500 text-sm">僅供查閱，資料由管理員維護。</p></div>
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
              <div className="flex items-center space-x-2 mb-4 bg-slate-100 p-3 rounded-lg"><Search className="text-slate-400" /><input type="text" placeholder="輸入搜尋..." className="bg-transparent w-full outline-none text-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10"><tr className="text-slate-600 text-sm uppercase tracking-wider border-b"><th className="p-3">姓名</th><th className="p-3">班別 (學號)</th><th className="p-3">活動名稱</th><th className="p-3">時間</th><th className="p-3">地點</th><th className="p-3 text-blue-600">聯絡電話</th></tr></thead>
                  <tbody className="text-slate-700">{filteredActivities.length > 0 ? filteredActivities.map((act) => (<tr key={act.id} className="border-b hover:bg-blue-50 transition-colors"><td className="p-3 font-medium">{act.verifiedName}</td><td className="p-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{act.verifiedClass} ({act.verifiedClassNo})</span></td><td className="p-3 font-bold text-slate-800">{act.activity}</td><td className="p-3 text-sm">{act.time}</td><td className="p-3 text-sm flex items-center"><MapPin size={14} className="mr-1 text-red-400"/> {act.location}</td><td className="p-3 text-sm font-mono text-blue-600">{act.rawPhone || '-'}</td></tr>)) : (<tr><td colSpan="6" className="p-12 text-center text-slate-400">沒有找到相關資料</td></tr>)}</tbody>
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

  // V3.1: Enhanced Database Manager with Batch Ops & Filtering
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

          {/* V3.1: Filter & Batch Actions */}
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

              {/* Batch Edit Panel */}
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

          <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase">
                      <tr>
                          <th className="p-3 w-10 text-center">
                              <input 
                                  type="checkbox" 
                                  checked={filteredDbActivities.length > 0 && dbSelectedIds.size === filteredDbActivities.length}
                                  onChange={toggleDbSelectAll}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                          </th>
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
                              <td className="p-3 text-center">
                                  <input 
                                      type="checkbox" 
                                      checked={dbSelectedIds.has(act.id)}
                                      onChange={() => toggleDbSelect(act.id)}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                              </td>
                              <td className="p-3">
                                  <div className="font-bold text-slate-800">{act.verifiedClass} ({act.verifiedClassNo})</div>
                                  <div className="text-slate-500">{act.verifiedName}</div>
                              </td>
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
                                          <div className="flex justify-end gap-2">
                                              <button onClick={() => startEditActivity(act)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button>
                                              <button onClick={() => handleDeleteActivity(act.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
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
      </div>
  );

  const renderStatsView = () => {
      const studentStats = masterList.map(student => {
          const studentActs = activities.filter(a => a.verifiedClass === student.classCode && a.verifiedClassNo === student.classNo);
          const filteredActs = statsActivityFilter ? studentActs.filter(a => a.activity.includes(statsActivityFilter)) : studentActs;
          return { ...student, count: filteredActs.length, actList: filteredActs.map(a => a.activity) };
      });
      const sortedStats = [...studentStats].sort((a, b) => { if (statsSort === 'most') return b.count - a.count; if (statsSort === 'least') return a.count - b.count; return 0; });
      const displayStats = statsActivityFilter ? sortedStats.filter(s => s.count > 0) : sortedStats;

      return (
          <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b pb-4"><button onClick={() => setAdminTab('import')} className="flex items-center text-slate-500 hover:text-blue-600"><ArrowLeft className="mr-2" size={20} /> 返回</button><h2 className="text-2xl font-bold text-slate-800 flex items-center"><BarChart className="mr-2 text-blue-600" /> 數據統計中心</h2><div className="w-24"></div></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                  <div className="flex flex-col h-full"><h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center"><History className="mr-2" size={20} /> 最近查詢紀錄 (暫存)</h3><div className="bg-slate-50 border rounded-xl flex-1 overflow-y-auto max-h-[500px]"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500 sticky top-0"><tr><th className="p-3">時間</th><th className="p-3">查詢對象</th><th className="p-3">狀態</th></tr></thead><tbody>{queryLogs.length > 0 ? queryLogs.map((log, i) => (<tr key={i} className="border-b last:border-0 hover:bg-white"><td className="p-3 text-slate-500 text-xs">{log.timestamp}</td><td className="p-3 font-bold text-slate-700">{log.class} ({log.classNo}) {log.name}</td><td className="p-3">{log.success ? <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded">成功</span> : <span className="text-red-500 text-xs">失敗</span>}</td></tr>)) : (<tr><td colSpan="3" className="p-8 text-center text-slate-400">暫無查詢紀錄</td></tr>)}</tbody></table></div></div>
                  <div className="flex flex-col h-full"><h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center"><TrendingUp className="mr-2" size={20} /> 全校活動統計</h3>
                  <div className="bg-blue-50 p-4 rounded-xl mb-4 space-y-3"><div className="flex gap-2"><button onClick={() => setStatsSort('most')} className={`flex-1 py-1 text-xs rounded font-bold ${statsSort === 'most' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'}`}>最多活動</button><button onClick={() => setStatsSort('least')} className={`flex-1 py-1 text-xs rounded font-bold ${statsSort === 'least' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'}`}>最少活動</button></div><div className="flex items-center bg-white border border-blue-200 rounded px-2"><Filter size={14} className="text-blue-400 mr-2" /><input type="text" placeholder="以活動名稱搜尋 (如: 無人機)" className="w-full py-2 text-sm outline-none" value={statsActivityFilter} onChange={(e) => setStatsActivityFilter(e.target.value)} /></div></div>
                  <div className="bg-white border rounded-xl flex-1 overflow-y-auto max-h-[400px]"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-500 sticky top-0"><tr><th className="p-3">排名</th><th className="p-3">學生</th><th className="p-3 text-center">數量</th><th className="p-3">參與活動</th><th className="p-3 text-right">管理</th></tr></thead><tbody>{displayStats.map((s, i) => (
                      <tr key={s.key} className="border-b hover:bg-slate-50">
                          <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                          {statsEditingKey === s.key ? (
                              <>
                                <td className="p-3" colSpan="2">
                                    <div className="flex space-x-1 mb-1">
                                        <input className="w-12 p-1 border rounded text-xs" value={statsEditForm.classCode} onChange={e => setStatsEditForm({...statsEditForm, classCode: e.target.value})} placeholder="班" />
                                        <input className="w-12 p-1 border rounded text-xs" value={statsEditForm.classNo} onChange={e => setStatsEditForm({...statsEditForm, classNo: e.target.value})} placeholder="號" />
                                    </div>
                                    <div className="flex space-x-1">
                                        <input className="w-20 p-1 border rounded text-xs" value={statsEditForm.chiName} onChange={e => setStatsEditForm({...statsEditForm, chiName: e.target.value})} placeholder="中文" />
                                        <input className="w-24 p-1 border rounded text-xs" value={statsEditForm.engName} onChange={e => setStatsEditForm({...statsEditForm, engName: e.target.value})} placeholder="Eng" />
                                    </div>
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex justify-end space-x-1">
                                        <button onClick={saveEditStudent} className="bg-green-100 text-green-700 p-1 rounded"><CheckCircle size={16}/></button>
                                        <button onClick={cancelEditStudent} className="bg-slate-100 text-slate-500 p-1 rounded"><X size={16}/></button>
                                    </div>
                                </td>
                              </>
                          ) : (
                              <>
                                <td className="p-3"><div className="font-bold text-slate-700">{s.classCode} ({s.classNo})</div><div className="text-xs text-slate-500">{s.chiName}</div></td>
                                <td className="p-3 text-center"><span className={`inline-block w-8 h-8 leading-8 rounded-full font-bold ${s.count > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{s.count}</span></td>
                                <td className="p-3 text-xs text-slate-500">{s.actList.join(', ')}</td>
                                <td className="p-3 text-right">
                                    <div className="flex justify-end space-x-1">
                                        <button onClick={() => startEditStudent(s)} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition" title="修改資料"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteStudent(s)} className="text-red-300 hover:text-red-600 hover:bg-red-50 p-1 rounded transition" title="刪除學生 (離校)"><UserX size={16} /></button>
                                    </div>
                                </td>
                              </>
                          )}
                      </tr>
                  ))}</tbody></table></div></div>
              </div>
          </div>
      );
  };

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