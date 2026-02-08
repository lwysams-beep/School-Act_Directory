import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Calendar, Clock, MapPin, User, Lock, LogOut, Upload, 
  Database, CheckCircle, X, FileSpreadsheet, Trash2, Edit2, 
  ArrowLeft, PieChart, Download, Menu, Users, ClipboardCheck 
} from 'lucide-react';

// 引入 Firebase SDK
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, getDocs, query, where, 
  deleteDoc, doc, updateDoc, writeBatch 
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

// -------------------------------------------------------------------------
// 1. FIREBASE CONFIGURATION (請填入您的 Firebase 設定)
// -------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -------------------------------------------------------------------------
// 2. MAIN COMPONENT START
// -------------------------------------------------------------------------

export default function App() {
  // --- Auth & View State ---
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('student'); // 'student', 'login', 'admin'
  const [adminTab, setAdminTab] = useState('import'); // 'import', 'database', 'attendance', 'stats'

  // --- Student Kiosk State ---
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [currentView, setCurrentView] = useState('student'); // 'student', 'result'

  // --- Data State ---
  const [dbActivities, setDbActivities] = useState([]); // 從 Firestore 讀取的資料
  const [masterList, setMasterList] = useState([]); // 所有學生名單 (用於查詢匹配)
  const [loadingData, setLoadingData] = useState(false);

  // --- Import State ---
  const [importPreview, setImportPreview] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [activityTime, setActivityTime] = useState('15:30 - 17:00');
  const [activityLocation, setActivityLocation] = useState('學校操場');

  // --- Database Manager State ---
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbSelectedIds, setDbSelectedIds] = useState(new Set());
  const [dbBatchMode, setDbBatchMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [batchEditForm, setBatchEditForm] = useState({ activity: '', time: '', location: '', dateText: '' });

  // --- Attendance State ---
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceActivity, setAttendanceActivity] = useState('');
  const [attendanceList, setAttendanceList] = useState([]); // 當日該活動的學生名單
  const [presentList, setPresentList] = useState(new Set()); // 出席的 ID 集合

  // --- Login Form State ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');

  // -------------------------------------------------------------------------
  // 3. INITIALIZATION & EFFECTS
  // -------------------------------------------------------------------------

  // 監聽登入狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        setView('admin');
        fetchActivities(); // 登入後獲取資料
      } else {
        setView('student');
      }
    });
    return () => unsubscribe();
  }, []);

  // 從 Firestore 獲取所有活動資料
  const fetchActivities = async () => {
    if (!auth.currentUser) return;
    setLoadingData(true);
    try {
      const q = query(collection(db, "activities"));
      const querySnapshot = await getDocs(q);
      const acts = [];
      const studentsMap = new Map(); // 用於建立 Master List

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        acts.push({ id: doc.id, ...data });

        // 收集學生資訊建立 Master List (去重)
        const studentKey = `${data.verifiedClass}-${data.verifiedClassNo}`;
        if (!studentsMap.has(studentKey)) {
          studentsMap.set(studentKey, {
            classCode: data.verifiedClass,
            classNo: data.verifiedClassNo,
            chiName: data.verifiedName,
            engName: data.engName || ''
          });
        }
      });
      
      // 按日期或 ID 排序
      acts.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      
      setDbActivities(acts);
      setMasterList(Array.from(studentsMap.values()));
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("讀取資料失敗: " + error.message);
    } finally {
      setLoadingData(false);
    }
  };

  // -------------------------------------------------------------------------
  // 4. HELPER FUNCTIONS (Date & Auth)
  // -------------------------------------------------------------------------

  // 輔助：解析 Excel 日期 (處理 45312 這種數字格式)
  const parseExcelDate = (excelDate) => {
    if (!excelDate) return null;
    // 如果已經是字串格式 (YYYY-MM-DD)
    if (typeof excelDate === 'string' && excelDate.includes('-')) return excelDate;
    
    // 如果是 Excel 序列號
    const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPwd);
      // onAuthStateChanged 會處理後續跳轉
    } catch (error) {
      alert("登入失敗: " + error.message);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('student');
    setAdminTab('import');
  };

// ... (Part 1 結束，請接 Part 2)
// -------------------------------------------------------------------------
  // 5. DATA HANDLING (Import & Manage)
  // -------------------------------------------------------------------------

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      // 將 Excel 轉為 JSON，header: 1 表示以二維陣列讀取，方便我們定位標題行
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length < 3) {
        alert("檔案格式錯誤：行數不足");
        return;
      }

      // 假設第 3 行 (index 2) 是標題行: "班別", "學號", "姓名" ... "12", "19" (日期)
      const headerRow = data[2]; 
      
      // 找出關鍵欄位的索引
      const colIdx = {
        class: headerRow.findIndex(h => h && h.toString().includes('班')), // "班別"
        no: headerRow.findIndex(h => h && h.toString().includes('學')),   // "學號"
        name: headerRow.findIndex(h => h && (h.toString() === '姓名' || h.toString().includes('Name'))), // "姓名"
      };

      if (colIdx.class === -1 || colIdx.no === -1) {
        alert("無法識別 Excel 欄位。請確保第3行包含 '班別' 和 '學號'。");
        return;
      }

      // 找出日期欄位 (假設標題是數字如 12, 19 或日期格式)
      // 我們將非基本資料的欄位視為潛在的日期
      const dateColumns = [];
      headerRow.forEach((col, index) => {
        if (index !== colIdx.class && index !== colIdx.no && index !== colIdx.name && 
            col && !['eclass', '號碼', 'Eng Name', '性別', '出生', '放學', '電話'].some(k => col.toString().includes(k))) {
          dateColumns.push({ index, label: col }); // label 可能是 "12", "19" 等
        }
      });

      const parsedStudents = [];
      
      // 從第 4 行 (index 3) 開始讀取數據
      for (let i = 3; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[colIdx.class]) continue;

        const rawClass = row[colIdx.class].toString().trim();
        const rawNo = row[colIdx.no] ? row[colIdx.no].toString().trim() : '';
        const rawName = row[colIdx.name] ? row[colIdx.name].toString().trim() : '';

        // 格式化班別 (例如 1A) 和學號 (補零)
        const formattedClass = rawClass.toUpperCase().replace(/[^0-9A-Z]/g, '');
        const formattedNo = rawNo.padStart(2, '0');

        // 檢查該學生是否有被勾選的日期 (如果有日期欄位)
        const studentDates = [];
        dateColumns.forEach(dc => {
           // 如果該格有內容 (不為空)，則視為該日有活動
           if (row[dc.index]) {
             // 嘗試組裝完整日期，假設是當前學年的月份
             // 這裡簡單儲存 Excel 的標頭 (例如 "12")，發布時再統一處理
             studentDates.push(dc.label.toString());
           }
        });

        parsedStudents.push({
          class: formattedClass,
          no: formattedNo,
          name: rawName,
          specificDates: studentDates // 這是該學生特定的上課日 (如果有)
        });
      }

      setImportPreview(parsedStudents);
      // 自動填入檔名中的活動資訊 (簡單猜測)
      const fileName = file.name.replace('.xlsx', '').replace('.csv', '');
      if (fileName.includes('足球')) setActivityName('足球校隊');
      else if (fileName.includes('田徑')) setActivityName('田徑隊');
    };
    reader.readAsBinaryString(file);
  };

  const handlePublish = async () => {
    if (importPreview.length === 0) return;
    if (!activityName) { alert("請輸入活動名稱"); return; }
    
    setIsImporting(true);
    const batch = writeBatch(db);
    const activityRef = collection(db, "activities");

    try {
      // 為了避免單次 Batch 超過 500 筆限制，我們這裡簡單處理 (假設一次不超過 500)
      // 如果量大，建議分批處理。
      
      let count = 0;
      for (const student of importPreview) {
        const docRef = doc(activityRef); // 自動生成 ID
        
        // 構建日期字串
        // 如果 Excel 裡有特定日期 (例如 "12", "19")，我們需要把它們轉成可搜尋的格式
        // 這裡簡化：如果學生有 specificDates，就存這些；否則存通用的 "逢星期X"
        // 為了 kiosk 搜尋方便，我們儲存一個 searchable 的 dateString
        
        const newActivity = {
            verifiedClass: student.class,
            verifiedClassNo: student.no,
            verifiedName: student.name,
            activity: activityName,
            time: activityTime,
            location: activityLocation,
            createdAt: new Date(),
            // 儲存原始日期標籤供參考 (例如 ["12", "19"])
            rawDates: student.specificDates || [], 
            // 搜尋用的文字 (顯示在列表中)
            dateText: student.specificDates && student.specificDates.length > 0 
                      ? student.specificDates.join(', ') + ' (參考Excel標題)' 
                      : '每週固定',
            // 用於 Kiosk 日期匹配的陣列 (需後續進階處理，這裡先存原始值)
            specificDates: [], 
            dayIds: [1,2,3,4,5] // 預設週間，若有特定日期則依賴 specificDates
        };

        batch.set(docRef, newActivity);
        count++;
      }

      await batch.commit();
      alert(`成功匯入 ${count} 筆資料！`);
      setImportPreview([]);
      fetchActivities(); // 重新讀取資料庫
      setAdminTab('database'); // 跳轉到數據庫頁面
    } catch (e) {
      console.error(e);
      alert("匯入失敗: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  // --- Database Management Logic ---

  const handleDeleteActivity = async (id) => {
    if (!confirm("確定刪除此活動紀錄？")) return;
    try {
      await deleteDoc(doc(db, "activities", id));
      setDbActivities(prev => prev.filter(a => a.id !== id));
      setDbSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      alert("刪除失敗");
    }
  };

  const toggleDbSelect = (id) => {
    setDbSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDbSelectAll = () => {
    if (dbSelectedIds.size === filteredDbActivities.length) {
      setDbSelectedIds(new Set());
    } else {
      setDbSelectedIds(new Set(filteredDbActivities.map(a => a.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`確定刪除選取的 ${dbSelectedIds.size} 筆資料？`)) return;
    const batch = writeBatch(db);
    dbSelectedIds.forEach(id => {
      batch.delete(doc(db, "activities", id));
    });
    try {
      await batch.commit();
      setDbActivities(prev => prev.filter(a => !dbSelectedIds.has(a.id)));
      setDbSelectedIds(new Set());
      setDbBatchMode(false);
    } catch (e) {
      alert("批量刪除失敗");
    }
  };

  const handleBatchEdit = async () => {
    if (!confirm(`確定修改選取的 ${dbSelectedIds.size} 筆資料？`)) return;
    const batch = writeBatch(db);
    const updates = {};
    if (batchEditForm.activity) updates.activity = batchEditForm.activity;
    if (batchEditForm.time) updates.time = batchEditForm.time;
    if (batchEditForm.location) updates.location = batchEditForm.location;
    if (batchEditForm.dateText) updates.dateText = batchEditForm.dateText;

    if (Object.keys(updates).length === 0) return;

    dbSelectedIds.forEach(id => {
      batch.update(doc(db, "activities", id), updates);
    });

    try {
      await batch.commit();
      setDbActivities(prev => prev.map(a => dbSelectedIds.has(a.id) ? { ...a, ...updates } : a));
      setDbSelectedIds(new Set());
      setDbBatchMode(false);
      setBatchEditForm({ activity: '', time: '', location: '', dateText: '' });
      alert("批量修改完成");
    } catch (e) {
      alert("批量修改失敗");
    }
  };

  const startEditActivity = (act) => {
    setEditingId(act.id);
    setEditFormData({ ...act });
  };

  const saveEditActivity = async (id) => {
    try {
      await updateDoc(doc(db, "activities", id), editFormData);
      setDbActivities(prev => prev.map(a => a.id === id ? { ...a, ...editFormData } : a));
      setEditingId(null);
    } catch (e) {
      alert("更新失敗");
    }
  };
  
  // 數據庫過濾 (搜尋功能)
  const filteredDbActivities = dbActivities.filter(act => {
    const term = dbSearchTerm.toLowerCase();
    return (
      (act.verifiedName && act.verifiedName.includes(term)) ||
      (act.verifiedClass && act.verifiedClass.toLowerCase().includes(term)) ||
      (act.activity && act.activity.includes(term)) ||
      (act.dateText && act.dateText.includes(term))
    );
  });

// ... (Part 2 結束，請接 Part 3)
// -------------------------------------------------------------------------
  // 6. VIEW RENDERERS (UI Components)
  // -------------------------------------------------------------------------

  const renderLoginView = () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">管理員登入</h2>
          <p className="text-slate-500 text-sm">請使用 Firebase 帳戶登入</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-600 text-sm font-bold mb-2">Email</label>
            <input type="email" required className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="admin@school.edu.hk" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-slate-600 text-sm font-bold mb-2">Password</label>
            <input type="password" required className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="••••••••" value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} />
          </div>
          <button type="submit" disabled={authLoading} className="w-full py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition flex items-center justify-center">
            {authLoading ? '登入中...' : '登入系統'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderStudentView = () => {
    const allClasses = ['1A','1B','1C','1D','1E','2A','2B','2C','2D','2E','3A','3B','3C','3D','3E','4A','4B','4C','4D','4E','5A','5B','5C','5D','6A','6B','6C','6D'];
    
    const handleSearch = () => {
      // 在前端過濾資料 (Production建議後端過濾)
      const targetNo = selectedClassNo.padStart(2, '0');
      const results = dbActivities.filter(act => 
        act.verifiedClass === selectedClass && act.verifiedClassNo === targetNo
      );
      
      // 找出學生姓名 (從第一筆資料或 MasterList 找)
      let studentName = "同學";
      const match = masterList.find(s => s.classCode === selectedClass && s.classNo === targetNo);
      if (match) studentName = match.chiName;
      else if (results.length > 0) studentName = results[0].verifiedName;

      setStudentResult({ name: studentName, activities: results });
      setCurrentView('result');
    };

    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-orange-50 to-white p-4">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-4xl bg-white p-8 rounded-3xl shadow-xl border border-orange-100">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800">課外活動查詢</h1>
              <p className="text-slate-500">請輸入你的班別及學號</p>
            </div>
            
            <div className="mb-6">
              <label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">班別 Class</label>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {allClasses.map((cls) => (
                  <button key={cls} onClick={() => setSelectedClass(cls)} 
                    className={`py-2 rounded-lg font-bold text-lg transition-colors ${selectedClass === cls ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-600 hover:bg-orange-100'}`}>
                    {cls}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">學號 Class No.</label>
                <div className="flex items-center justify-center mb-4">
                  <div className="h-20 w-32 bg-slate-100 rounded-2xl flex items-center justify-center text-5xl font-bold tracking-widest text-slate-800 border-2 border-orange-200 shadow-inner">
                    {selectedClassNo || <span className="text-slate-300 text-3xl">--</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3,4,5,6,7,8,9].map((num) => (
                    <button key={num} onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + num); }} 
                      className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 active:border-orange-500 shadow-sm transition-all">
                      {num}
                    </button>
                  ))}
                  <button onClick={() => setSelectedClassNo('')} className="h-14 bg-red-50 text-red-500 rounded-xl font-bold border border-red-100">清除</button>
                  <button onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + 0); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 shadow-sm">0</button>
                  <button onClick={() => setSelectedClassNo(prev => prev.slice(0, -1))} className="h-14 bg-slate-100 text-slate-500 rounded-xl font-bold">←</button>
                </div>
              </div>
              <div className="flex items-center justify-center md:w-1/3">
                <button onClick={handleSearch} disabled={selectedClassNo.length === 0} 
                  className={`w-full py-8 rounded-2xl text-3xl font-bold text-white shadow-xl transition-all flex items-center justify-center ${selectedClassNo.length > 0 ? 'bg-orange-600 hover:bg-orange-700 transform hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}>
                  <Search className="mr-3" size={32} strokeWidth={3} /> 查詢
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderKioskResultView = () => {
    const upcomingDays = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) { 
      const d = new Date(today); d.setDate(today.getDate() + i);
      upcomingDays.push({ 
        dateObj: d,
        label: i === 0 ? '今天' : `星期${['日','一','二','三','四','五','六'][d.getDay()]}`,
        dateStr: d.toISOString().split('T')[0] // YYYY-MM-DD
      });
    }

    return (
      <div className="flex-1 bg-slate-800 flex flex-col font-sans text-white h-screen overflow-hidden">
        <div className="p-4 flex items-center justify-between bg-slate-900 shadow-md shrink-0">
          <h2 className="text-xl font-bold text-slate-300">活動日程表</h2>
          <button onClick={() => { setCurrentView('student'); setStudentResult(null); setSelectedClassNo(''); }} 
            className="bg-white/10 px-4 py-2 rounded-full flex items-center text-sm backdrop-blur-md hover:bg-white/20 transition">
            <ArrowLeft size={20} className="mr-1" /> 返回
          </button>
        </div>
        
        <div className="px-8 pt-6 pb-2 shrink-0">
          <h1 className="text-4xl font-bold">
            {selectedClass} ({selectedClassNo}) <span className="text-orange-400">{studentResult?.name}</span>
          </h1>
          <p className="text-slate-400 mt-1">未來一週活動概覽</p>
        </div>

        <div className="flex-1 px-8 pb-8 overflow-y-auto">
          <div className="space-y-6 mt-4">
            {upcomingDays.map((dayItem) => {
              // 簡單匹配邏輯：檢查 specificDates 或 星期幾
              const dayActs = studentResult.activities.filter(act => {
                // 優先檢查 specificDates (如果有的話)
                // 這裡簡化：假設 Excel 匯入的 specificDates 是 "12", "19" 這種日 (需配合月份判斷)
                // 或者如果是 "逢星期一" 這種邏輯
                
                // 暫時邏輯：如果 dateText 包含 "逢星期X"，則匹配
                if (act.dateText && act.dateText.includes('逢' + dayItem.label.replace('星期',''))) return true;
                // 如果有 specificDates，需進一步解析 (這裡略過複雜日期比對，視為 Admin 介面處理好)
                return false; 
              });

              const isToday = dayItem.label === '今天';
              
              return (
                <div key={dayItem.dateStr} className={`rounded-3xl p-6 transition-all ${isToday ? 'bg-slate-700/80 ring-2 ring-green-500' : 'bg-slate-700/30'}`}>
                  <div className="flex items-center mb-4 border-b border-slate-600 pb-2">
                    <div className={`text-2xl font-bold ${isToday ? 'text-green-400' : 'text-slate-200'}`}>
                      {dayItem.label} <span className="text-sm opacity-50 ml-2">{dayItem.dateStr.slice(5)}</span>
                    </div>
                    {isToday && <span className="ml-3 bg-green-600 text-white text-xs px-2 py-1 rounded-full animate-pulse">Today</span>}
                  </div>
                  
                  {dayActs.length > 0 ? (
                    dayActs.map((item, idx) => (
                      <div key={idx} className="bg-white text-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden mb-3">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-2xl font-bold text-slate-900">{item.activity}</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div className="flex items-center text-slate-600 bg-slate-100 p-2 rounded-lg">
                            <Clock size={20} className="mr-2 text-orange-500" />
                            <span className="font-bold">{item.time}</span>
                          </div>
                          <div className="flex items-center text-blue-800 bg-blue-50 p-2 rounded-lg">
                            <MapPin size={20} className="mr-2 text-blue-500" />
                            <span className="font-bold">{item.location}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-sm italic py-2">沒有安排活動</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAttendanceView = () => {
    // 1. 密碼鎖定
    if (view !== 'admin' && adminTab !== 'attendance_unlocked') {
       // 用一個簡單的 local state 來控制鎖定畫面，這裡重用 adminTab 狀態
       // 實際上應該用獨立 state，這裡簡化
       return (
         <div className="flex flex-col items-center justify-center h-full min-h-[500px] bg-slate-50">
           <div className="bg-white p-8 rounded-2xl shadow-md text-center max-w-sm w-full">
             <Lock className="mx-auto h-12 w-12 text-slate-400 mb-4"/>
             <h2 className="text-xl font-bold mb-2">點名系統</h2>
             <p className="text-sm text-slate-500 mb-6">請輸入密碼以解鎖今日點名表</p>
             <input type="password" 
               className="w-full border p-3 rounded-lg mb-4 text-center text-lg tracking-widest" 
               placeholder="輸入密碼"
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && e.target.value === 'howcanyouturnthison') {
                   setAdminTab('attendance_unlocked');
                 }
               }}
             />
             <p className="text-xs text-slate-400">提示: howcanyouturnthison</p>
           </div>
         </div>
       )
    }

    // 2. 顯示今日活動列表 (Attendance Dashboard)
    if (!attendanceActivity) {
      // 找出今天有的活動 (Group by Activity Name)
      // 這裡簡化邏輯：顯示所有活動名稱供選擇
      const uniqueActivities = [...new Set(dbActivities.map(a => a.activity))];
      
      return (
        <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px]">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
            <ClipboardCheck className="mr-2 text-green-600"/> 今日活動點名 ({attendanceDate})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueActivities.map(actName => (
              <button key={actName} onClick={() => {
                setAttendanceActivity(actName);
                // 載入該活動名單
                const list = dbActivities.filter(a => a.activity === actName);
                setAttendanceList(list);
                setPresentList(new Set()); // 重置出席
              }} className="p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition text-left group">
                <h3 className="text-lg font-bold text-slate-700 group-hover:text-blue-700">{actName}</h3>
                <div className="mt-2 text-sm text-slate-500 flex items-center">
                  <Users size={14} className="mr-1"/> {dbActivities.filter(a => a.activity === actName).length} 人
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    // 3. 點名介面 (Attendance Taking)
    return (
      <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px] flex flex-col">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <button onClick={() => setAttendanceActivity('')} className="flex items-center text-slate-500 hover:text-blue-600">
            <ArrowLeft size={20} className="mr-1"/> 返回列表
          </button>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-blue-600">{attendanceActivity}</h2>
            <p className="text-sm text-slate-500">{attendanceDate}</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4 bg-blue-50 p-4 rounded-lg">
          <div className="text-blue-800 font-bold">
            出席人數: {presentList.size} / {attendanceList.length}
          </div>
          <button onClick={() => {
             // 匯出 CSV 邏輯
             const rows = attendanceList.map(stu => ({
               班別: stu.verifiedClass,
               學號: stu.verifiedClassNo,
               姓名: stu.verifiedName,
               狀態: presentList.has(stu.id) ? '出席' : '缺席',
               日期: attendanceDate
             }));
             const ws = XLSX.utils.json_to_sheet(rows);
             const wb = XLSX.utils.book_new();
             XLSX.utils.book_append_sheet(wb, ws, "Attendance");
             XLSX.writeFile(wb, `${attendanceActivity}_${attendanceDate}_點名表.csv`);
          }} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-700 shadow-sm">
            <Download size={16} className="mr-2"/> 匯出 CSV
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attendanceList.sort((a,b) => a.verifiedClass.localeCompare(b.verifiedClass)).map(stu => {
              const isPresent = presentList.has(stu.id);
              return (
                <div key={stu.id} 
                  onClick={() => {
                    const newSet = new Set(presentList);
                    if (newSet.has(stu.id)) newSet.delete(stu.id);
                    else newSet.add(stu.id);
                    setPresentList(newSet);
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${isPresent ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 ${isPresent ? 'bg-green-200 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                      {stu.verifiedClass}
                    </div>
                    <div>
                      <h4 className={`font-bold ${isPresent ? 'text-green-800' : 'text-slate-700'}`}>{stu.verifiedName}</h4>
                      <p className="text-xs text-slate-400">學號: {stu.verifiedClassNo}</p>
                    </div>
                  </div>
                  {isPresent ? <CheckCircle className="text-green-500" size={24}/> : <div className="w-6 h-6 rounded-full border-2 border-slate-200"></div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    );
  };

// ... (Part 3 結束，請接 Part 4)
const renderAdminView = () => (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 flex-1">
      <div className="max-w-7xl mx-auto">
        {/* Admin Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              <Shield className="mr-2 text-slate-600" /> 管理員控制台
            </h2>
            <p className="text-slate-500 text-sm">
              {currentUser?.email} | 學生總數: {masterList.length}
            </p>
          </div>
          <button onClick={handleLogout} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 flex items-center shadow-sm">
            <LogOut size={16} className="mr-2" /> 登出
          </button>
        </div>

        <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />

        {/* Admin Content Area */}
        {adminTab === 'stats' ? (
          <StatsView 
            masterList={masterList} 
            activities={dbActivities} 
            queryLogs={queryLogs || []} 
            onBack={() => setAdminTab('import')} 
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-400 text-xs uppercase mb-3">功能選單</h3>
                <button onClick={() => setAdminTab('import')} className={`w-full text-left p-3 rounded-lg mb-2 flex items-center transition ${adminTab === 'import' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                  <Cloud size={18} className="mr-3" /> 資料匯入
                </button>
                <button onClick={() => setAdminTab('database')} className={`w-full text-left p-3 rounded-lg mb-2 flex items-center transition ${adminTab === 'database' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                  <Database size={18} className="mr-3" /> 數據庫管理
                </button>
                <button onClick={() => setAdminTab('stats')} className={`w-full text-left p-3 rounded-lg flex items-center transition ${adminTab === 'stats' ? 'bg-purple-50 text-purple-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                  <BarChart size={18} className="mr-3" /> 統計分析
                </button>
              </div>
            </div>

            {/* Main Panel */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* === IMPORT TAB === */}
              {adminTab === 'import' && (
                <div className="space-y-6">
                  {/* Import Settings Card */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-blue-500">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800">1. 設定活動資訊</h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">活動名稱</label>
                        <input className="w-full p-2 border rounded bg-slate-50 focus:bg-white" value={activityName} onChange={e => setActivityName(e.target.value)} placeholder="例：足球校隊" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">時間</label>
                          <input className="w-full p-2 border rounded bg-slate-50 focus:bg-white" value={activityTime} onChange={e => setActivityTime(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">地點</label>
                          <input className="w-full p-2 border rounded bg-slate-50 focus:bg-white" value={activityLocation} onChange={e => setActivityLocation(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File Upload Card */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800">2. 上傳名單 (Excel/CSV)</h3>
                      {importPreview.length > 0 && <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded">已讀取 {importPreview.length} 人</span>}
                    </div>
                    
                    {importPreview.length === 0 ? (
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer" onClick={() => fileInputRef.current.click()}>
                        <FileSpreadsheet className="mx-auto h-12 w-12 text-slate-400 mb-2" />
                        <p className="text-slate-600 font-bold">點擊上傳檔案</p>
                        <p className="text-xs text-slate-400 mt-1">支援 .xlsx, .csv (需包含 班別, 學號, 姓名)</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="max-h-64 overflow-y-auto border rounded">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 sticky top-0">
                              <tr><th className="p-2">班別</th><th className="p-2">學號</th><th className="p-2">姓名</th><th className="p-2">日期標記</th></tr>
                            </thead>
                            <tbody>
                              {importPreview.slice(0, 100).map((row, idx) => (
                                <tr key={idx} className="border-b hover:bg-slate-50">
                                  <td className="p-2">{row.class}</td>
                                  <td className="p-2">{row.no}</td>
                                  <td className="p-2">{row.name}</td>
                                  <td className="p-2 text-xs text-slate-500">{row.specificDates?.join(', ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importPreview.length > 100 && <div className="p-2 text-center text-xs text-slate-400">...還有 {importPreview.length - 100} 筆資料</div>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handlePublish} disabled={isImporting} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg transition flex items-center justify-center">
                            {isImporting ? <RefreshCcw className="animate-spin mr-2"/> : <Cloud className="mr-2"/>} 確認並發布至雲端
                          </button>
                          <button onClick={() => {setImportPreview([]); setActivityName('')}} className="px-4 border border-slate-300 rounded-lg hover:bg-red-50 text-red-500">取消</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === DATABASE TAB === */}
              {adminTab === 'database' && (
                <div className="bg-white p-6 rounded-xl shadow-sm min-h-[500px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800">資料庫管理 ({filteredDbActivities.length})</h3>
                    <div className="flex gap-2">
                      {dbSelectedIds.size > 0 && (
                        <>
                          <button onClick={handleBatchDelete} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded font-bold hover:bg-red-200">刪除 ({dbSelectedIds.size})</button>
                          <button onClick={() => setDbBatchMode(!dbBatchMode)} className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-200">批量修改</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 flex items-center bg-slate-100 p-2 rounded-lg">
                    <Search size={18} className="text-slate-400 mr-2" />
                    <input type="text" placeholder="搜尋活動、學生..." className="bg-transparent outline-none w-full text-sm" value={dbSearchTerm} onChange={e => setDbSearchTerm(e.target.value)} />
                  </div>

                  {dbBatchMode && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200 animate-in slide-in-from-top-2">
                      <h4 className="text-xs font-bold text-blue-800 mb-2">批量修改選取項目 (留空不改)</h4>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <input className="p-1 border rounded text-xs" placeholder="活動名稱" value={batchEditForm.activity} onChange={e => setBatchEditForm({...batchEditForm, activity: e.target.value})} />
                        <input className="p-1 border rounded text-xs" placeholder="時間" value={batchEditForm.time} onChange={e => setBatchEditForm({...batchEditForm, time: e.target.value})} />
                        <input className="p-1 border rounded text-xs" placeholder="地點" value={batchEditForm.location} onChange={e => setBatchEditForm({...batchEditForm, location: e.target.value})} />
                        <input className="p-1 border rounded text-xs" placeholder="備註" value={batchEditForm.dateText} onChange={e => setBatchEditForm({...batchEditForm, dateText: e.target.value})} />
                      </div>
                      <div className="flex justify-end"><button onClick={handleBatchEdit} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">確認修改</button></div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 uppercase text-xs text-slate-500">
                        <tr>
                          <th className="p-3 w-8"><input type="checkbox" onChange={toggleDbSelectAll} checked={dbSelectedIds.size > 0 && dbSelectedIds.size === filteredDbActivities.length} /></th>
                          <th className="p-3">學生</th>
                          <th className="p-3">活動</th>
                          <th className="p-3">詳情</th>
                          <th className="p-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredDbActivities.slice(0, 100).map(act => (
                          <tr key={act.id} className={`hover:bg-slate-50 ${dbSelectedIds.has(act.id) ? 'bg-blue-50' : ''}`}>
                            <td className="p-3"><input type="checkbox" checked={dbSelectedIds.has(act.id)} onChange={() => toggleDbSelect(act.id)} /></td>
                            <td className="p-3">
                              <div className="font-bold">{act.verifiedClass} ({act.verifiedClassNo})</div>
                              <div className="text-xs text-slate-500">{act.verifiedName}</div>
                            </td>
                            <td className="p-3">
                              {editingId === act.id ? <input className="border rounded p-1 w-full" value={editFormData.activity} onChange={e=>setEditFormData({...editFormData, activity:e.target.value})}/> : <div className="font-bold text-slate-700">{act.activity}</div>}
                            </td>
                            <td className="p-3 text-xs text-slate-500">
                              {editingId === act.id ? (
                                <div className="space-y-1">
                                  <input className="border rounded p-1 w-full" value={editFormData.time} onChange={e=>setEditFormData({...editFormData, time:e.target.value})}/>
                                  <input className="border rounded p-1 w-full" value={editFormData.location} onChange={e=>setEditFormData({...editFormData, location:e.target.value})}/>
                                </div>
                              ) : (
                                <div>{act.time} @ {act.location}<br/>{act.dateText}</div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {editingId === act.id ? (
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => saveEditActivity(act.id)} className="p-1 bg-green-100 text-green-600 rounded"><CheckCircle size={16}/></button>
                                  <button onClick={() => setEditingId(null)} className="p-1 bg-gray-100 text-gray-600 rounded"><X size={16}/></button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => startEditActivity(act)} className="p-1 text-blue-400 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDeleteActivity(act.id)} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredDbActivities.length === 0 && <div className="p-8 text-center text-slate-400">沒有找到資料</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTopNavBar = () => (
    <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md sticky top-0 z-50">
      <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentView('student')}>
        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">佛</div>
        <span className="font-bold text-lg tracking-wide hidden sm:block">佛教正覺蓮社學校</span>
      </div>
      
      <div className="hidden md:flex flex-col items-center justify-center text-xs text-slate-400 font-mono">
        <div>{currentDateTime.toLocaleDateString('zh-HK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div className="text-white font-bold text-lg">{currentDateTime.toLocaleTimeString('zh-HK')}</div>
      </div>

      <div className="flex space-x-1">
        <button onClick={() => setCurrentView('student')} className={`px-3 py-2 rounded-lg flex items-center text-sm transition ${currentView === 'student' || currentView === 'kiosk_result' ? 'bg-orange-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <User size={16} className="mr-2" /><span className="hidden sm:inline">學生</span>
        </button>
        <button onClick={() => setCurrentView('staff')} className={`px-3 py-2 rounded-lg flex items-center text-sm transition ${currentView === 'staff' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <Users size={16} className="mr-2" /><span className="hidden sm:inline">教職員</span>
        </button>
        <button onClick={() => setCurrentView('attendance')} className={`px-3 py-2 rounded-lg flex items-center text-sm transition ${currentView === 'attendance' ? 'bg-emerald-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <FileCheck size={16} className="mr-2" /><span className="hidden sm:inline">點名</span>
        </button>
        <button onClick={() => setCurrentView('admin')} className={`px-3 py-2 rounded-lg flex items-center text-sm transition ${currentView === 'admin' ? 'bg-slate-700 text-white font-bold shadow-lg ring-1 ring-slate-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          {user ? <Shield size={16} className="mr-2 text-green-400" /> : <Lock size={16} className="mr-2" />}<span className="hidden sm:inline">管理</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {renderTopNavBar()}
      
      {/* View Routing */}
      {currentView === 'student' && (studentResult ? renderKioskResultView() : renderStudentView())}
      {currentView === 'kiosk_result' && renderKioskResultView()}
      {currentView === 'staff' && renderStaffView()}
      {currentView === 'attendance' && renderAttendanceView()}
      {currentView === 'admin' && (user ? renderAdminView() : renderLoginView())}
    </div>
  );
};