import React, { useState, useMemo, useEffect } from 'react';
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key } from 'lucide-react';

// =============================================================================
//  CONFIGURATION: FIREBASE SETUP
// =============================================================================
const USE_FIREBASE = false; 

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123",
  appId: "1:123:web:123"
};

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
// 1. MASTER DATA (更新自 student_list.csv)
// -----------------------------------------------------------------------------
const RAW_CSV_CONTENT = `
1A,1,S9900448,CHAN CHIT HIM JAYDON,陳哲謙,M
1A,2,N0417791,CHAN HAU MAN,陳孝敏,F
1A,3,N0101050,CHAN KA FAI,陳嘉輝,M
1A,4,S9866797,CHAN SUM YUET ASHLEY,陳芯月,F
1A,5,N0281040,CHENG YU KIU,鄭羽喬,F
1A,6,N0120675,CHEUNG HOI KI,張凱琪,F
1A,7,N0075084,DINH YAT LONG,丁一朗,M
1A,8,N001641A,FUNG SAN HOI,馮薪凱,M
1A,9,N008198A,HO TSZ KAI,何子鍇,M
1A,10,42064116,HUANG ZHIXIN,黃芷昕,F
2A,1,S1234567,CHAN KA YING,陳嘉瑩,F
2A,7,S1234568,LEUNG MAN NEI,梁嫚妮,F
3C,20,S1234569,WU MAN LAM,胡曼琳,F
4A,20,S2222222,CHOI SO LONG,蔡舒朗,M
4A,21,S2222223,CHUNG PAK YU,鍾柏宇,M
4A,22,S2222224,HO SZE WING,何思穎,F
4A,23,S2222225,WONG CHI YIN,黃稚然,M
4A,24,S2222226,WEI PAK YUI,魏柏叡,M
4A,28,S0000001,HUI SUM NGA,許心雅,F
4B,25,S2222227,CHOI YIK YEUNG,蔡翼陽,M
5A,10,S3333333,LAU CHIU WAN,劉照允,M
5A,11,S3333334,WONG SZE KI,王詩萁,F
5A,12,S3333335,CHENG MAN YI,鄭文一,M
5B,15,S3333336,CHAN YING TUNG,陳映彤,F
6B,13,S6666666,MAK KA CHUN,麥家臻,M
6D,5,S686629A,CHU LOK KI,褚樂埼,M
6D,13,S686016A,LIN HEI CHIT,連希哲,M
`;

const parseMasterCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  return lines.map(line => {
    const cols = line.split(',');
    if (cols.length < 5) return null;
    return {
      classCode: cols[0].trim(),
      classNo: cols[1].trim().padStart(2, '0'),
      engName: cols[3].trim(),
      chiName: cols[4].trim(),
      key: `${cols[0].trim()}-${cols[4].trim()}` 
    };
  }).filter(item => item !== null);
};

const MASTER_DB = parseMasterCSV(RAW_CSV_CONTENT);

// -----------------------------------------------------------------------------
// 2. MOCK IMPORT DATA
// -----------------------------------------------------------------------------
const PDF_IMPORT_MOCK = [
  { id: 101, rawName: '蔡舒朗', rawClass: '4A', rawClassNo: '00', activity: '無人機培訓班', time: '15:45-16:45', location: '特別室', dateText: '逢星期一', dayIds: [1] },
  { id: 301, rawName: '陳嘉瑩', rawClass: '2A', rawClassNo: '01', activity: '初級壁球訓練班', time: '16:00-17:30', location: '和興體育館', dateText: '逢星期四', dayIds: [4] },
  { id: 303, rawName: '胡曼琳', rawClass: '3C', rawClassNo: '20', activity: '初級壁球訓練班', time: '16:00-17:30', location: '和興體育館', dateText: '逢星期四', dayIds: [4] },
  { id: 304, rawName: '許心雅', rawClass: '4A', rawClassNo: '28', activity: '初級壁球訓練班', time: '16:00-17:30', location: '和興體育館', dateText: '逢星期四', dayIds: [4] },
  { id: 305, rawName: '麥家臻', rawClass: '6B', rawClassNo: '13', activity: '初級壁球訓練班', time: '16:00-17:30', location: '和興體育館', dateText: '逢星期四', dayIds: [4] },
  { id: 401, rawName: '何沛津', rawClass: '4A', rawClassNo: '00', activity: 'e-樂團', time: '15:30-16:30', location: '學校音樂室', dateText: '逢星期一', dayIds: [1] },
  { id: 999, rawName: '張大文', rawClass: '1A', rawClassNo: '00', activity: '足球班', time: '15:00-16:00', location: '球場', dateText: '逢星期五', dayIds: [5] },
];

const App = () => {
  const [currentView, setCurrentView] = useState('student'); 
  
  // Auth
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  
  // Data
  const [masterList, setMasterList] = useState(MASTER_DB);
  const [activities, setActivities] = useState([]); 
  const [pendingImports, setPendingImports] = useState(PDF_IMPORT_MOCK);
  
  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('1A');
  const [selectedClassNo, setSelectedClassNo] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [todayDay, setTodayDay] = useState(new Date().getDay());

  // Logic: Auth
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

  // Logic: Reconciliation
  const { matched, conflicts } = useMemo(() => {
    const matched = [];
    const conflicts = [];
    pendingImports.forEach(item => {
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

  const handlePublish = () => {
    setActivities(prev => {
        const newIds = new Set(matched.map(m => m.id));
        const kept = prev.filter(p => !newIds.has(p.id));
        return [...kept, ...matched];
    });
    setPendingImports(conflicts); 
    alert(`成功發布 ${matched.length} 筆活動資料！`);
  };

  const handleResolveConflict = (item, correctStudent) => {
    const fixedItem = {
      ...item,
      verifiedName: correctStudent.chiName,
      verifiedClass: correctStudent.classCode,
      verifiedClassNo: correctStudent.classNo,
      status: 'verified'
    };
    setActivities(prev => [...prev, fixedItem]);
    setPendingImports(prev => prev.filter(i => i.id !== item.id));
  };

  const handleDeleteImport = (id) => {
    setPendingImports(prev => prev.filter(i => i.id !== id));
  };

  const handleStudentSearch = () => {
    const formattedClassNo = selectedClassNo.padStart(2, '0');
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
  // Render Functions (Fix: Changed from Components to Render Functions to avoid re-mount)
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
                      </tr>
                    )) : (
                      <tr><td colSpan="5" className="p-12 text-center text-slate-400">沒有找到相關資料</td></tr>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-2 space-y-6">
                  {/* Verified Block */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-green-700 flex items-center"><CheckCircle className="mr-2" size={20} /> 等待發布 ({matched.length})</h3>
                        {matched.length > 0 && (<button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center shadow-md active:scale-95 transition"><Save size={18} className="mr-2" /> 立即發布</button>)}
                     </div>
                     <div className="bg-green-50 rounded-lg border border-green-100 max-h-96 overflow-y-auto">
                        {matched.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead className="bg-green-100/50 text-green-800 sticky top-0 border-b border-green-200">
                                    <tr>
                                        <th className="py-2 px-4 text-left w-1/3">原始 PDF 資料</th>
                                        <th className="py-2 px-4 text-center w-10"></th>
                                        <th className="py-2 px-4 text-left w-1/3">Master Data (真理)</th>
                                        <th className="py-2 px-4 text-right">活動</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matched.map(m => (
                                        <tr key={m.id} className="border-b border-green-100 last:border-0 hover:bg-green-100/40 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="text-slate-500 text-xs uppercase mb-0.5">PDF Source</div>
                                                <div className="font-medium text-slate-700">{m.rawClass} {m.rawName}</div>
                                                <div className="text-xs text-red-400 font-mono">{m.rawClassNo === '00' ? '缺學號' : m.rawClassNo}</div>
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
                                                <div className="font-bold text-slate-700">{m.activity}</div>
                                                <div className="text-xs text-slate-500">{m.dateText}</div>
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
                                    <div className="text-xs text-slate-500">{item.activity}</div>
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

               <div className="bg-slate-800 text-slate-300 p-6 rounded-xl shadow-md h-fit">
                  <h3 className="font-bold text-white mb-4 flex items-center"><Database className="mr-2" size={16}/> 數據庫狀態</h3>
                  <div className="space-y-4">
                      <div className="bg-slate-700 p-3 rounded-lg flex justify-between items-center">
                          <div className="text-xs text-slate-400 uppercase">已發布活動</div>
                          <div className="text-2xl font-bold text-white">{activities.length}</div>
                      </div>
                      <div className="bg-slate-700 p-3 rounded-lg flex justify-between items-center">
                          <div className="text-xs text-slate-400 uppercase">學生總數</div>
                          <div className="text-2xl font-bold text-white">{masterList.length}</div>
                      </div>
                  </div>
               </div>
            </div>
        </div>
      </div>
  );

  const renderKioskResultView = () => {
     const days = [ { id: 1, label: '一' }, { id: 2, label: '二' }, { id: 3, label: '三' }, { id: 4, label: '四' }, { id: 5, label: '五' } ];
     return (
        <div className="flex-1 bg-slate-800 flex flex-col font-sans text-white">
            <div className="p-4 flex items-center justify-between bg-slate-900 shadow-md">
                <h2 className="text-xl font-bold text-slate-300">活動日程表</h2>
                <button onClick={() => { setCurrentView('student'); setStudentResult(null); setSelectedClassNo(''); }} className="bg-white/10 px-4 py-2 rounded-full flex items-center text-sm backdrop-blur-md hover:bg-white/20 transition"><ArrowLeft size={20} className="mr-1" /> 返回</button>
            </div>
            <div className="px-8 pt-6 pb-2">
                <h1 className="text-4xl font-bold">{selectedClass}班 ({selectedClassNo})號</h1>
                <p className="text-slate-400 mt-1">本週活動概覽</p>
            </div>
            <div className="px-6 py-4">
                <div className="grid grid-cols-5 gap-2">
                    {days.map((day) => {
                    const isToday = todayDay === day.id;
                    const hasAct = studentResult && studentResult.some(act => act.dayIds && act.dayIds.includes(day.id));
                    return (
                        <div key={day.id} className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${isToday ? 'bg-green-900/40 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-slate-700/50 border-slate-600'}`}>
                            <span className={`text-sm mb-1 ${isToday ? 'text-green-300' : 'text-slate-400'}`}>星期</span>
                            <span className={`text-2xl font-bold ${isToday ? 'text-white' : 'text-slate-300'}`}>{day.label}</span>
                            <div className={`mt-2 w-3 h-3 rounded-full ${isToday ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                            {hasAct && <div className="mt-2 px-2 py-0.5 bg-orange-500 text-[10px] rounded-full text-white">有活動</div>}
                        </div>
                    );
                    })}
                </div>
            </div>
            <div className="flex-1 px-8 pb-8 overflow-y-auto">
                {studentResult && studentResult.length > 0 ? (
                    <div className="space-y-4 mt-2">
                    <h3 className="text-slate-400 text-sm uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">詳細列表</h3>
                    {studentResult.map((item, idx) => {
                        const isTodayActivity = item.dayIds && item.dayIds.includes(todayDay);
                        return (
                        <div key={idx} className={`bg-white text-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden ${isTodayActivity ? 'border-4 border-green-500 ring-4 ring-green-500/20' : ''}`}>
                            {isTodayActivity && <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 rounded-bl-xl text-xs font-bold flex items-center"><CheckCircle size={12} className="mr-1" /> 今天</div>}
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-orange-600 font-bold text-sm mb-1">{item.dateText}</div>
                                    <h3 className="text-2xl font-bold mb-2 text-slate-900">{item.activity}</h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2">
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
                        );
                    })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 mt-8 text-slate-400 bg-slate-700/30 rounded-2xl border border-dashed border-slate-600">
                    <Calendar size={48} className="mb-2 opacity-50" />
                    <p className="text-lg">找不到相關活動</p>
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