import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, BarChart, History, TrendingUp, Filter } from 'lucide-react';

// =============================================================================
//  CONFIGURATION: FIREBASE SETUP
// =============================================================================
const USE_FIREBASE = true; 

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

// Mock Auth SDK
const mockAuth = {
    currentUser: null,
    signIn: (email, password) => {
        return new Promise((resolve, reject) => {
            if (password === 'admin123') { 
                resolve({ email: email, uid: 'admin-001' });
            } else {
                reject({ message: '密碼錯誤 (預覽密碼: admin123)' });
            }
        });
    },
    signOut: () => Promise.resolve()
};

// -----------------------------------------------------------------------------
// 1. MASTER DATA
// -----------------------------------------------------------------------------
const RAW_CSV_CONTENT = `
1A,1,CHAN CHIT HIM JAYDON,陳哲謙,M
1A,2,CHAN HAU MAN,陳孝敏,F
1A,3,CHAN KA FAI,陳嘉輝,M
2A,1,CHAN KA YING,陳嘉瑩,F
2A,7,LEUNG MAN NEI,梁嫚妮,F
3C,20,WU MAN LAM,胡曼琳,F
4A,20,CHOI SO LONG,蔡舒朗,M
4A,21,CHUNG PAK YU,鍾柏宇,M
4A,22,HO SZE WING,何思穎,F
4A,23,WONG CHI YIN,黃稚然,M
4A,24,WEI PAK YUI,魏柏叡,M
4A,28,HUI SUM NGA,許心雅,F
4B,25,CHOI YIK YEUNG,蔡翼陽,M
5A,10,LAU CHIU WAN,劉照允,M
5A,11,WONG SZE KI,王詩萁,F
5A,12,CHENG MAN YI,鄭文一,M
5B,15,CHAN YING TUNG,陳映彤,F
6B,13,MAK KA CHUN,麥家臻,M
6D,5,CHU LOK KI,褚樂埼,M
6D,13,LIN HEI CHIT,連希哲,M
`;

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

const INITIAL_MASTER_DB = parseMasterCSV(RAW_CSV_CONTENT);

// -----------------------------------------------------------------------------
// 2. IMPORT DATA
// -----------------------------------------------------------------------------
const PDF_IMPORT_MOCK = []; 

const App = () => {
  const [currentView, setCurrentView] = useState('student'); 
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  
  // Data
  const [masterList, setMasterList] = useState(INITIAL_MASTER_DB);
  const [activities, setActivities] = useState([]); 
  const [pendingImports, setPendingImports] = useState(PDF_IMPORT_MOCK);
  
  // V2.6: Logs Data
  const [queryLogs, setQueryLogs] = useState([]);

  // Import Form State
  const [bulkInput, setBulkInput] = useState('');
  const [importActivity, setImportActivity] = useState('無人機班');
  const [importTime, setImportTime] = useState('15:30-16:30');
  const [importLocation, setImportLocation] = useState('禮堂');
  const [importDayId, setImportDayId] = useState(1);
  const [importDates, setImportDates] = useState([]); 
  const [tempDateInput, setTempDateInput] = useState('');

  // Admin UI State
  const [adminTab, setAdminTab] = useState('import'); // 'import' | 'manage_db' | 'stats'
  const [selectedMatchIds, setSelectedMatchIds] = useState(new Set());
  const [csvEncoding, setCsvEncoding] = useState('Big5'); 
  const fileInputRef = useRef(null); 

  // Stats UI State (V2.6)
  const [statsSort, setStatsSort] = useState('most'); // 'most', 'least'
  const [statsActivityFilter, setStatsActivityFilter] = useState('');

  // DB Editing State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [todayDay, setTodayDay] = useState(new Date().getDay());

  const handleLogin = async (e) => {
      e.preventDefault();
      setAuthLoading(true);
      try {
          const userCred = await mockAuth.signIn(loginEmail, loginPwd);
          setUser(userCred);
          setLoginPwd(''); 
      } catch (error) {
          alert("登入失敗: " + error.message);
      } finally {
          setAuthLoading(false);
      }
  };

  const handleLogout = async () => {
      await mockAuth.signOut();
      setUser(null);
      setCurrentView('student'); 
  };

  // Logic: Master CSV Upload
  const handleMasterUploadTrigger = () => {
      fileInputRef.current.click();
  };

  const handleMasterFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.readAsText(file, csvEncoding);
      reader.onload = (event) => {
          const text = event.target.result;
          try {
              const newMaster = parseMasterCSV(text);
              if (newMaster.length > 0) {
                  setMasterList(newMaster);
                  alert(`成功更新真理數據庫！\n共載入 ${newMaster.length} 筆學生資料。\n(使用編碼: ${csvEncoding})`);
              } else {
                  alert(`無法識別資料。可能是編碼問題 (${csvEncoding}) 或 CSV 格式不符。`);
              }
          } catch (err) {
              alert("解析 CSV 失敗: " + err.message);
          }
      };
  };

  // Logic: Date Management
  const handleAddDate = () => {
      if (tempDateInput && !importDates.includes(tempDateInput)) {
          const newDates = [...importDates, tempDateInput].sort();
          setImportDates(newDates);
          if (newDates.length === 1) {
              const date = new Date(tempDateInput);
              setImportDayId(date.getDay());
          }
      }
      setTempDateInput(''); 
  };

  const handleRemoveDate = (dateToRemove) => {
      setImportDates(prev => prev.filter(d => d !== dateToRemove));
  };

  const handleClearDates = () => {
      setImportDates([]);
  };

  // Logic: Bulk Import
  const handleBulkImport = () => {
      const lines = bulkInput.trim().split('\n');
      const newItems = [];
      const dayMap = {1:'逢星期一', 2:'逢星期二', 3:'逢星期三', 4:'逢星期四', 5:'逢星期五', 6:'逢星期六', 0:'逢星期日'};

      let finalDateText = dayMap[importDayId];
      if (importDates.length > 0) {
          finalDateText = `共${importDates.length}堂 (${importDates[0]}起)`;
      }

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
          alert(`成功識別並載入 ${newItems.length} 筆資料！`);
      } else {
          alert("無法識別資料。");
      }
  };

  // Logic: Reconciliation
  const { matched, conflicts } = useMemo(() => {
    const matched = [];
    const conflicts = [];
    pendingImports.forEach(item => {
      if (item.forceConflict) {
          conflicts.push({ ...item, status: 'manual_conflict' });
          return;
      }
      let student = masterList.find(s => s.classCode === item.rawClass && s.chiName === item.rawName);
      if (!student && item.rawClassNo !== '00') {
          student = masterList.find(s => s.classCode === item.rawClass && s.classNo === item.rawClassNo);
      }
      if (!student) {
        const potential = masterList.filter(s => s.chiName === item.rawName);
        if (potential.length === 1) student = potential[0];
      }
      if (student) {
        matched.push({
          ...item,
          verifiedName: student.chiName,
          verifiedClass: student.classCode,
          verifiedClassNo: student.classNo,
          status: 'verified'
        });
      } else {
        conflicts.push({ ...item, status: 'conflict' });
      }
    });
    return { matched, conflicts };
  }, [pendingImports, masterList]);

  useEffect(() => {
      const allIds = new Set(matched.map(m => m.id));
      setSelectedMatchIds(allIds);
  }, [matched.length]);

  const toggleSelectMatch = (id) => {
      const newSet = new Set(selectedMatchIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedMatchIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedMatchIds.size === matched.length) {
          setSelectedMatchIds(new Set()); 
      } else {
          setSelectedMatchIds(new Set(matched.map(m => m.id)));
      }
  };

  const handlePublish = () => {
    const toPublish = matched.filter(m => selectedMatchIds.has(m.id));
    if (toPublish.length === 0) { alert("請選擇資料"); return; }
    setActivities(prev => {
        const newIds = new Set(toPublish.map(m => m.id));
        const kept = prev.filter(p => !newIds.has(p.id));
        return [...kept, ...toPublish];
    });
    const publishedIds = new Set(toPublish.map(m => m.id));
    setPendingImports(prev => prev.filter(p => !publishedIds.has(p.id)));
    alert(`成功發布 ${toPublish.length} 筆活動資料！`);
  };

  const handleManualConflict = (id) => {
      setPendingImports(prev => prev.map(item => {
          if (item.id === id) return { ...item, forceConflict: true };
          return item;
      }));
  };

  const handleResolveConflict = (item, correctStudent) => {
    const fixedItem = {
      ...item,
      verifiedName: correctStudent.chiName,
      verifiedClass: correctStudent.classCode,
      verifiedClassNo: correctStudent.classNo,
      status: 'verified',
      forceConflict: false 
    };
    setActivities(prev => [...prev, fixedItem]);
    setPendingImports(prev => prev.filter(i => i.id !== item.id));
  };

  const handleDeleteImport = (id) => {
    setPendingImports(prev => prev.filter(i => i.id !== id));
  };

  // Logic: DB Management
  const handleDeleteActivity = (id) => {
      if(window.confirm('確定要刪除這筆紀錄嗎？')) {
          setActivities(prev => prev.filter(a => a.id !== id));
      }
  };

  const startEditActivity = (act) => {
      setEditingId(act.id);
      setEditFormData({
          activity: act.activity,
          time: act.time,
          location: act.location,
          dateText: act.dateText
      });
  };

  const saveEditActivity = (id) => {
      setActivities(prev => prev.map(a => {
          if (a.id === id) return { ...a, ...editFormData };
          return a;
      }));
      setEditingId(null);
  };

  const cancelEdit = () => {
      setEditingId(null);
      setEditFormData({});
  };

  // Logic: Student Search (V2.6 Updated to Log Query)
  const handleStudentSearch = () => {
    const formattedClassNo = selectedClassNo.padStart(2, '0');
    
    // Find Student Name from Master List
    const student = masterList.find(s => s.classCode === selectedClass && s.classNo === formattedClassNo);
    const studentName = student ? student.chiName : '未知學生';

    // 1. Log the query
    const newLog = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('zh-HK'),
        class: selectedClass,
        classNo: formattedClassNo,
        name: studentName,
        success: !!student
    };
    setQueryLogs(prev => [newLog, ...prev]);

    // 2. Perform Search
    const results = activities.filter(item => 
      item.verifiedClass === selectedClass && item.verifiedClassNo === formattedClassNo
    );
    setStudentResult(results);
    setCurrentView('kiosk_result');
  };

  const filteredActivities = activities.filter(item => 
    item.verifiedName?.includes(searchTerm) || 
    item.verifiedClass?.includes(searchTerm) ||
    item.activity?.includes(searchTerm)
  );

  // -------------------------------------------------------------------------
  // Render Functions
  // -------------------------------------------------------------------------

  const renderTopNavBar = () => (
    <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md sticky top-0 z-50">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentView('student')}>
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">佛</div>
            <span className="font-bold text-lg tracking-wide hidden sm:block">佛教正覺蓮社學校</span>
        </div>
        <div className="flex space-x-1">
            <button onClick={() => setCurrentView('student')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'student' || currentView === 'kiosk_result' ? 'bg-orange-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <User size={16} className="mr-2" /> 學生
            </button>
            <button onClick={() => setCurrentView('staff')} className={`px-4 py-2 rounded-lg flex items-center text-sm transition-all ${currentView === 'staff' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <Users size={16} className="mr-2" /> 教職員
            </button>
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
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">課外活動查詢</h1>
                <p className="text-slate-500">請輸入你的班別及學號</p>
            </div>
            <div className="mb-6">
              <label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">班別 Class</label>
              <div className="grid grid-cols-6 gap-2">
                {['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'].map((cls) => (
                  <button key={cls} onClick={() => setSelectedClass(cls)} className={`py-3 rounded-lg font-bold text-lg transition-colors ${selectedClass === cls ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-600 hover:bg-orange-100'}`}>{cls}</button>
                ))}
              </div>
            </div>
            <div className="mb-8">
              <label className="block text-slate-400 text-sm mb-2 font-bold uppercase tracking-wider">學號 Class No.</label>
              <div className="flex items-center justify-center mb-4">
                 <div className="h-20 w-32 bg-slate-100 rounded-2xl flex items-center justify-center text-5xl font-bold tracking-widest text-slate-800 border-2 border-orange-200 shadow-inner">
                   {selectedClassNo || <span className="text-slate-300 text-3xl">--</span>}
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6,7,8,9].map((num) => (
                  <button key={num} onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + num); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 active:border-orange-500 shadow-sm transition-all">{num}</button>
                ))}
                <button onClick={() => setSelectedClassNo('')} className="h-14 bg-red-50 text-red-500 rounded-xl font-bold border border-red-100">清除</button>
                <button onClick={() => { if (selectedClassNo.length < 2) setSelectedClassNo(prev => prev + 0); }} className="h-14 bg-white border border-slate-200 rounded-xl text-2xl font-bold text-slate-700 active:bg-orange-100 shadow-sm">0</button>
                 <button onClick={() => setSelectedClassNo(prev => prev.slice(0, -1))} className="h-14 bg-slate-100 text-slate-500 rounded-xl font-bold">←</button>
              </div>
            </div>
            <button onClick={handleStudentSearch} disabled={selectedClassNo.length === 0} className={`w-full py-5 rounded-2xl text-2xl font-bold text-white shadow-xl transition-all flex items-center justify-center ${selectedClassNo.length > 0 ? 'bg-orange-600 hover:bg-orange-700 transform hover:scale-[1.02]' : 'bg-slate-300 cursor-not-allowed'}`}>
              <Search className="mr-2" strokeWidth={3} /> 查詢
            </button>
          </div>
        </div>
    </div>
  );

  const renderStaffView = () => (
      <div className="min-h-screen bg-slate-50 p-6 flex-1">
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-blue-900 flex items-center"><Users className="mr-2" /> 教職員查詢通道</h2>
                <p className="text-slate-500 text-sm">僅供查閱，資料由管理員維護。</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
              <div className="flex items-center space-x-2 mb-4 bg-slate-100 p-3 rounded-lg">
                <Search className="text-slate-400" />
                <input type="text" placeholder="輸入搜尋..." className="bg-transparent w-full outline-none text-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-slate-600 text-sm uppercase tracking-wider border-b">
                      <th className="p-3">姓名</th>
                      <th className="p-3">班別 (學號)</th>
                      <th className="p-3">活動名稱</th>
                      <th className="p-3">時間</th>
                      <th className="p-3">地點</th>
                      <th className="p-3 text-blue-600">聯絡電話 (內部)</th>
                    </tr>
                  </thead>
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
                      <tr><td colSpan="6" className="p-12 text-center text-slate-400">沒有找到相關資料</td></tr>
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
              <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                      <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">管理員登入</h2>
                  <p className="text-slate-500 text-sm">請輸入帳號密碼以進入後台</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                      <label className="block text-slate-600 text-sm font-bold mb-2">Email</label>
                      <input type="email" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="admin@school.edu.hk" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div>
                      <label className="block text-slate-600 text-sm font-bold mb-2">Password</label>
                      <input type="password" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••" value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} />
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition flex items-center justify-center">{authLoading ? '登入中...' : '登入系統'}</button>
              </form>
               <div className="mt-6 text-center text-xs text-slate-400 bg-slate-50 p-2 rounded">預覽模式密碼: <b>admin123</b></div>
          </div>
      </div>
  );

  // V2.6: Stats View
  const renderStatsView = () => {
      // 1. Calculate Activity Counts per Student
      const studentStats = masterList.map(student => {
          const studentActs = activities.filter(a => 
              a.verifiedClass === student.classCode && 
              a.verifiedClassNo === student.classNo
          );
          
          // Filter by activity name if needed
          const filteredActs = statsActivityFilter 
              ? studentActs.filter(a => a.activity.includes(statsActivityFilter))
              : studentActs;

          return {
              ...student,
              count: filteredActs.length,
              actList: filteredActs.map(a => a.activity)
          };
      });

      // 2. Sort Logic
      const sortedStats = [...studentStats].sort((a, b) => {
          if (statsSort === 'most') return b.count - a.count;
          if (statsSort === 'least') return a.count - b.count;
          return 0;
      });

      // Filter out students with 0 activities if searching by activity
      const displayStats = statsActivityFilter 
          ? sortedStats.filter(s => s.count > 0)
          : sortedStats;

      return (
          <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <button onClick={() => setAdminTab('import')} className="flex items-center text-slate-500 hover:text-blue-600">
                      <ArrowLeft className="mr-2" size={20} /> 返回
                  </button>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                      <BarChart className="mr-2 text-blue-600" /> 數據統計中心
                  </h2>
                  <div className="w-24"></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                  {/* Left: Query Logs */}
                  <div className="flex flex-col h-full">
                      <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center">
                          <History className="mr-2" size={20} /> 最近查詢紀錄
                      </h3>
                      <div className="bg-slate-50 border rounded-xl flex-1 overflow-y-auto max-h-[500px]">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-100 text-slate-500 sticky top-0">
                                  <tr>
                                      <th className="p-3">時間</th>
                                      <th className="p-3">查詢對象</th>
                                      <th className="p-3">狀態</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {queryLogs.length > 0 ? queryLogs.map((log, i) => (
                                      <tr key={i} className="border-b last:border-0 hover:bg-white">
                                          <td className="p-3 text-slate-500 text-xs">{log.timestamp}</td>
                                          <td className="p-3 font-bold text-slate-700">{log.class} ({log.classNo}) {log.name}</td>
                                          <td className="p-3">
                                              {log.success ? <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded">成功</span> : <span className="text-red-500 text-xs">失敗</span>}
                                          </td>
                                      </tr>
                                  )) : (
                                      <tr><td colSpan="3" className="p-8 text-center text-slate-400">暫無查詢紀錄</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* Right: Activity Stats */}
                  <div className="flex flex-col h-full">
                      <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center">
                          <TrendingUp className="mr-2" size={20} /> 全校活動統計
                      </h3>
                      
                      <div className="bg-blue-50 p-4 rounded-xl mb-4 space-y-3">
                          <div className="flex gap-2">
                              <button onClick={() => setStatsSort('most')} className={`flex-1 py-1 text-xs rounded font-bold ${statsSort === 'most' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'}`}>最多活動</button>
                              <button onClick={() => setStatsSort('least')} className={`flex-1 py-1 text-xs rounded font-bold ${statsSort === 'least' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'}`}>最少活動</button>
                          </div>
                          <div className="flex items-center bg-white border border-blue-200 rounded px-2">
                              <Filter size={14} className="text-blue-400 mr-2" />
                              <input 
                                  type="text" 
                                  placeholder="以活動名稱搜尋 (如: 無人機)" 
                                  className="w-full py-2 text-sm outline-none"
                                  value={statsActivityFilter}
                                  onChange={(e) => setStatsActivityFilter(e.target.value)}
                              />
                          </div>
                      </div>

                      <div className="bg-white border rounded-xl flex-1 overflow-y-auto max-h-[400px]">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-100 text-slate-500 sticky top-0">
                                  <tr>
                                      <th className="p-3">排名</th>
                                      <th className="p-3">學生</th>
                                      <th className="p-3 text-center">數量</th>
                                      <th className="p-3">參與活動</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {displayStats.map((s, i) => (
                                      <tr key={s.key} className="border-b hover:bg-slate-50">
                                          <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                                          <td className="p-3">
                                              <div className="font-bold text-slate-700">{s.classCode} ({s.classNo})</div>
                                              <div className="text-xs text-slate-500">{s.chiName}</div>
                                          </td>
                                          <td className="p-3 text-center">
                                              <span className={`inline-block w-8 h-8 leading-8 rounded-full font-bold ${s.count > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                                  {s.count}
                                              </span>
                                          </td>
                                          <td className="p-3 text-xs text-slate-500">
                                              {s.actList.join(', ')}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

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

          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase">
                      <tr>
                          <th className="p-3">學生</th>
                          <th className="p-3">活動名稱</th>
                          <th className="p-3">時間</th>
                          <th className="p-3">地點</th>
                          <th className="p-3">日期/備註</th>
                          <th className="p-3 text-right">操作</th>
                      </tr>
                  </thead>
                  <tbody>
                      {activities.map(act => (
                          <tr key={act.id} className="border-b hover:bg-slate-50">
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
                      {activities.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400">目前沒有資料，請先導入。</td></tr>}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const renderAdminView = () => (
      <div className="min-h-screen bg-slate-100 p-6 flex-1">
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Shield className="mr-2" /> 管理員控制台</h2>
                    <p className="text-slate-500 text-sm">數據校對與發布。</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="bg-white px-4 py-2 rounded-lg shadow text-sm font-mono text-slate-600 border border-slate-200">Admin: <span className="font-bold text-blue-600">{user.email}</span></div>
                    <button onClick={handleLogout} className="bg-red-50 text-red-500 px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200 flex items-center text-sm font-bold"><LogOut size={16} className="mr-2"/> 登出</button>
                </div>
            </div>

            {/* Hidden File Input for Master Data */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv"
                onChange={handleMasterFileChange} 
            />

            {/* Toggle Views */}
            {adminTab === 'manage_db' ? renderDatabaseManager() : 
             adminTab === 'stats' ? renderStatsView() : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Reconcile Action Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Verified Block */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-3">
                                <h3 className="font-bold text-lg text-green-700 flex items-center"><CheckCircle className="mr-2" size={20} /> 等待發布 ({matched.length})</h3>
                                <button onClick={toggleSelectAll} className="text-sm text-slate-500 flex items-center hover:text-slate-800">
                                    {selectedMatchIds.size === matched.length ? <CheckSquare size={16} className="mr-1"/> : <Square size={16} className="mr-1"/>}
                                    全選/取消
                                </button>
                            </div>
                            {matched.length > 0 && (<button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center shadow-md active:scale-95 transition"><Save size={18} className="mr-2" /> 發布選取項目 ({selectedMatchIds.size})</button>)}
                        </div>
                        <div className="bg-green-50 rounded-lg border border-green-100 max-h-96 overflow-y-auto">
                            {matched.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-green-100/50 text-green-800 sticky top-0 border-b border-green-200">
                                        <tr>
                                            <th className="py-2 px-2 w-8"></th>
                                            <th className="py-2 px-4 text-left w-1/3">原始 PDF 資料</th>
                                            <th className="py-2 px-4 text-center w-10"></th>
                                            <th className="py-2 px-4 text-left w-1/3">Master Data (真理)</th>
                                            <th className="py-2 px-4 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matched.map(m => (
                                            <tr key={m.id} className={`border-b border-green-100 last:border-0 hover:bg-green-100/40 transition-colors ${selectedMatchIds.has(m.id) ? 'bg-green-100/20' : 'opacity-50'}`}>
                                                <td className="py-3 px-2 text-center">
                                                    <input type="checkbox" checked={selectedMatchIds.has(m.id)} onChange={() => toggleSelectMatch(m.id)} className="w-4 h-4 rounded text-green-600 focus:ring-green-500" />
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-slate-500 text-xs uppercase mb-0.5">PDF Source</div>
                                                    <div className="font-medium text-slate-700">{m.rawClass} {m.rawName}</div>
                                                    <div className="text-xs text-red-400 font-mono">{m.rawClassNo === '00' ? '缺學號' : m.rawClassNo}</div>
                                                    {m.rawPhone && <div className="text-xs text-blue-500 font-mono flex items-center mt-1"><Phone size={10} className="mr-1"/>{m.rawPhone}</div>}
                                                </td>
                                                <td className="py-3 px-2 text-center text-slate-300"><ArrowRight size={16} /></td>
                                                <td className="py-3 px-4 bg-green-100/30">
                                                    <div className="text-green-600 text-xs uppercase font-bold flex items-center mb-0.5"><Database size={10} className="mr-1" /> Master Data</div>
                                                    <div className="font-bold text-green-700 text-lg flex items-center">
                                                    <span className="mr-2">{m.verifiedClass}</span>
                                                    <span className="bg-white text-green-800 border border-green-200 px-1.5 rounded text-sm min-w-[24px] text-center mr-2">{m.verifiedClassNo}</span>
                                                    <span>{m.verifiedName}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button onClick={() => handleManualConflict(m.id)} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 flex items-center ml-auto">
                                                        <AlertTriangle size={12} className="mr-1" /> 轉為異常
                                                    </button>
                                                    <div className="text-xs text-slate-400 mt-1">{m.activity}</div>
                                                    {m.specificDates && m.specificDates.length > 0 && <div className="text-xs bg-blue-100 text-blue-600 px-1 rounded inline-block mt-1">共 {m.specificDates.length} 堂</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (<div className="text-center text-green-800/50 py-8">暫無自動配對資料</div>)}
                        </div>
                    </div>

                    {/* Conflict Block */}
                    {conflicts.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500 animate-pulse-border">
                            <h3 className="font-bold text-lg text-red-700 flex items-center mb-4"><AlertTriangle className="mr-2" /> 異常資料需修正 ({conflicts.length})</h3>
                            <div className="space-y-3">
                            {conflicts.map(item => (
                                <div key={item.id} className="border border-red-100 rounded-lg p-4 bg-red-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800">{item.rawClass} {item.rawName}</div>
                                        <div className="text-xs text-slate-500">{item.activity} {item.rawPhone && `| ${item.rawPhone}`}</div>
                                        {item.status === 'manual_conflict' && <div className="text-xs text-red-600 font-bold mt-1">* 人手標記異常</div>}
                                    </div>
                                    <ArrowRight className="text-slate-300 md:rotate-0 rotate-90" />
                                    <div className="flex-1 w-full">
                                        <select className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm" onChange={(e) => { if(e.target.value) { const student = masterList.find(s => s.key === e.target.value); if(student) handleResolveConflict(item, student); }}} defaultValue="">
                                            <option value="" disabled>-- 選擇正確學生 --</option>
                                            <optgroup label="智能推薦">
                                                {masterList.filter(s => s.classCode === item.rawClass || s.chiName.includes(item.rawName[0])).map(s => (
                                                    <option key={s.key} value={s.key}>{s.classCode} ({s.classNo}) {s.chiName}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="全部名單"><option value="search">...</option></optgroup>
                                        </select>
                                    </div>
                                    <button onClick={() => handleDeleteImport(item.id)} className="p-2 text-red-400 hover:bg-red-100 rounded"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Import Panel */}
                <div className="space-y-6">
                    <div className="bg-slate-800 text-slate-300 p-6 rounded-xl shadow-md border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white flex items-center"><Database className="mr-2" size={16}/> 數據庫狀態</h3>
                        </div>
                        <div className="space-y-3">
                            {/* DB Management Button */}
                            <button onClick={() => setAdminTab('manage_db')} className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg text-sm font-bold flex items-center justify-between transition">
                                <span>管理活動資料庫</span>
                                <span className="bg-blue-600 text-xs px-2 py-1 rounded">{activities.length}</span>
                            </button>
                            {/* Statistics Button (V2.6) */}
                            <button onClick={() => setAdminTab('stats')} className="w-full bg-purple-700 hover:bg-purple-600 text-white p-3 rounded-lg text-sm font-bold flex items-center justify-center transition shadow-lg">
                                <BarChart className="mr-2" size={16} /> 查看統計報表
                            </button>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500 text-center">
                            學生總數: {masterList.length}
                        </div>
                    </div>

                    {/* V2.2: Encoding Selector */}
                    <div className="flex justify-end mb-1">
                        <select 
                            className="text-xs p-1 border border-slate-300 rounded bg-white text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500"
                            value={csvEncoding}
                            onChange={(e) => setCsvEncoding(e.target.value)}
                        >
                            <option value="Big5">CSV 編碼: Big5 (解決 Excel 亂碼)</option>
                            <option value="UTF-8">CSV 編碼: UTF-8 (通用格式)</option>
                        </select>
                    </div>

                    {/* V2.0: Master CSV Upload Button */}
                    <button 
                        onClick={handleMasterUploadTrigger}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl flex items-center justify-center font-bold shadow-md transition"
                    >
                        <FileSpreadsheet className="mr-2" /> 上載真理 Data (CSV)
                    </button>

                    {/* Import Panel */}
                    <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center">
                            <PlusCircle className="mr-2 text-blue-500" /> 新增活動資料
                        </h3>
                        
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="text-xs text-slate-500 font-bold uppercase">活動名稱</label>
                                <input type="text" className="w-full p-2 border rounded" value={importActivity} onChange={e => setImportActivity(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase">時間</label>
                                    <input type="text" className="w-full p-2 border rounded" value={importTime} onChange={e => setImportTime(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase">地點</label>
                                    <input type="text" className="w-full p-2 border rounded" value={importLocation} onChange={e => setImportLocation(e.target.value)} />
                                </div>
                            </div>
                            
                            {/* Multi-Date Picker */}
                            <div className="border border-slate-200 rounded p-3 bg-slate-50">
                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">選擇日期 (多選)</label>
                                <div className="flex gap-2 mb-2">
                                    <input 
                                        type="date" 
                                        className="flex-1 p-2 border rounded text-sm" 
                                        value={tempDateInput} 
                                        onChange={(e) => setTempDateInput(e.target.value)} 
                                    />
                                    <button onClick={handleAddDate} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center">
                                        <Plus size={16} />
                                    </button>
                                </div>
                                
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {importDates.map(date => (
                                        <span key={date} className="bg-white border border-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center shadow-sm">
                                            {date}
                                            <button onClick={() => handleRemoveDate(date)} className="ml-1 text-blue-400 hover:text-red-500"><X size={12} /></button>
                                        </span>
                                    ))}
                                </div>
                                
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-600">已選: {importDates.length} 天 (共{importDates.length}堂)</span>
                                    {importDates.length > 0 && <button onClick={handleClearDates} className="text-red-400 hover:underline">清空</button>}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 font-bold uppercase">星期 (自動/預設)</label>
                                <select className="w-full p-2 border rounded" value={importDayId} onChange={e => setImportDayId(e.target.value)}>
                                    <option value="1">逢星期一</option>
                                    <option value="2">逢星期二</option>
                                    <option value="3">逢星期三</option>
                                    <option value="4">逢星期四</option>
                                    <option value="5">逢星期五</option>
                                    <option value="6">逢星期六</option>
                                    <option value="0">逢星期日</option>
                                </select>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-xs text-slate-500 font-bold uppercase flex justify-between">
                                <span>貼上名單 (PDF Copy/Paste)</span>
                                <span className="text-blue-500 cursor-pointer flex items-center" title="格式: 4A 蔡舒朗 (可含電話)"><FileText size={12} className="mr-1"/> 說明</span>
                            </label>
                            <textarea 
                                className="w-full h-32 p-2 border rounded bg-slate-50 text-sm font-mono"
                                placeholder={`4A 蔡舒朗 91234567\n2A1 陳嘉瑩`}
                                value={bulkInput}
                                onChange={e => setBulkInput(e.target.value)}
                            ></textarea>
                        </div>

                        <button 
                            onClick={handleBulkImport}
                            className="w-full py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition"
                        >
                            識別並載入
                        </button>
                    </div>
                </div>
                </div>
            )}
        </div>
      </div>
  );

  const renderKioskResultView = () => {
     // V2.4: Generate next 8 days starting from today
     const upcomingDays = [];
     const today = new Date();
     const weekDayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
     // V2.5: Add English names
     const weekDayEnNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

     for (let i = 0; i < 8; i++) { 
         const d = new Date(today);
         d.setDate(today.getDate() + i);
         // Format date carefully to avoid timezone issues
         const year = d.getFullYear();
         const month = String(d.getMonth() + 1).padStart(2, '0');
         const day = String(d.getDate()).padStart(2, '0');
         const localDateString = `${year}-${month}-${day}`;
         // V2.5: Display format DD/MM/YYYY
         const displayDate = `(${day}/${month}/${year})`;
         
         upcomingDays.push({
             dayId: d.getDay(),
             dateString: localDateString,
             // V2.5: Updated label format: 星期X Sat (DD/MM/YYYY)
             label: i === 0 ? '今天' : weekDayNames[d.getDay()],
             fullLabel: `${weekDayNames[d.getDay()]} ${weekDayEnNames[d.getDay()]} ${displayDate}`
         });
     }

     // V2.5: Find student name from Master List
     const currentStudent = masterList.find(s => s.classCode === selectedClass && s.classNo === selectedClassNo.padStart(2, '0'));

     return (
        <div className="flex-1 bg-slate-800 flex flex-col font-sans text-white h-screen overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between bg-slate-900 shadow-md shrink-0">
                <h2 className="text-xl font-bold text-slate-300">活動日程表</h2>
                <button onClick={() => { setCurrentView('student'); setStudentResult(null); setSelectedClassNo(''); }} className="bg-white/10 px-4 py-2 rounded-full flex items-center text-sm backdrop-blur-md hover:bg-white/20 transition">
                    <ArrowLeft size={20} className="mr-1" /> 返回
                </button>
            </div>

            {/* Student Info - V2.5 Updated with Name */}
            <div className="px-8 pt-6 pb-2 shrink-0">
                <h1 className="text-4xl font-bold">
                    {selectedClass}班 ({selectedClassNo})號 <span className="text-orange-400">{currentStudent ? currentStudent.chiName : ''}</span>
                </h1>
                <p className="text-slate-400 mt-1">未來一週活動概覽</p>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 px-8 pb-8 overflow-y-auto">
                <div className="space-y-6 mt-4">
                    {upcomingDays.map((dayItem) => {
                        const dayActivities = studentResult ? studentResult.filter(act => {
                            // Check if activity has specific dates
                            if (act.specificDates && act.specificDates.length > 0) {
                                return act.specificDates.includes(dayItem.dateString);
                            }
                            // Otherwise check recurring day
                            return act.dayIds && act.dayIds.includes(dayItem.dayId);
                        }) : [];

                        const isToday = dayItem.label === '今天';

                        return (
                            <div key={dayItem.dateString} className={`rounded-3xl p-6 transition-all ${isToday ? 'bg-slate-700/80 ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-slate-700/30'}`}>
                                {/* Day Header */}
                                <div className="flex items-center mb-4 border-b border-slate-600 pb-2">
                                    <div className={`text-2xl font-bold ${isToday ? 'text-green-400' : 'text-slate-200'}`}>
                                        {dayItem.fullLabel}
                                    </div>
                                    {isToday && <span className="ml-3 bg-green-600 text-white text-xs px-2 py-1 rounded-full animate-pulse">Today</span>}
                                </div>

                                {/* Activities List for this Day */}
                                <div className="space-y-4">
                                    {dayActivities.length > 0 ? (
                                        dayActivities.map((item, idx) => (
                                            <div key={`${item.id}-${idx}`} className="bg-white text-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="text-2xl font-bold text-slate-900">{item.activity}</h3>
                                                    {/* V2.5: Removed date string from right side since it's in header now */}
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
                                        <div className="text-slate-500 text-sm italic py-4 text-center border border-dashed border-slate-600 rounded-xl">
                                            沒有安排活動
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* Fallback if user not found in master list either */}
                {(!studentResult) && (
                     <div className="flex flex-col items-center justify-center h-40 mt-8 text-slate-400 bg-slate-700/30 rounded-2xl border border-dashed border-slate-600">
                        <Calendar size={48} className="mb-2 opacity-50" />
                        <p className="text-lg">請輸入班別及學號查詢</p>
                    </div>
                )}
            </div>
        </div>
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