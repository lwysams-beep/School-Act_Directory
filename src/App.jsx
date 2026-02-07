import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, Calendar, MapPin, Clock, Upload, Settings, Monitor, ArrowLeft, Home, CheckCircle, Trash2, Database, AlertTriangle, Save, Lock, Users, Shield, ArrowRight, LogOut, Key, PlusCircle, FileText, Phone, CheckSquare, Square, RefreshCcw, X, Plus, Edit2, FileSpreadsheet, BarChart, History, TrendingUp, Filter, Cloud, UserX, PieChart, Download, Activity } from 'lucide-react';

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

// =============================================================================
//  HELPER FUNCTIONS (V3.3 Update)
// =============================================================================

// 計算時間差 (小時)
// 輸入格式: "15:30-16:30" 或 "14:00-15:30"
const calculateDuration = (timeStr) => {
  if (!timeStr || !timeStr.includes('-')) return 1; // 預設 1 小時

  try {
    const [start, end] = timeStr.split('-').map(t => t.trim());
    
    const parseMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const startMin = parseMinutes(start);
    const endMin = parseMinutes(end);
    
    const diff = endMin - startMin;
    return diff > 0 ? diff / 60 : 1; 
  } catch (e) {
    return 1; // 格式錯誤時預設 1 小時
  }
};

// CSV 匯出功能
const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;

  // 取得 Headers
  const headers = Object.keys(data[0]);
  
  // 建立 CSV 內容
  const csvContent = [
    headers.join(','), // Header Row
    ...data.map(row => headers.map(fieldName => {
      // 處理逗號或換行，避免 CSV 格式跑掉
      const val = row[fieldName] ? row[fieldName].toString().replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(','))
  ].join('\n');

  // 下載檔案
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


// =============================================================================
//  SUB-COMPONENTS
// =============================================================================

// --- V3.3: 統計報表組件 (Statistics Panel) ---
const StatsPanel = ({ masterList, onClose }) => {
  const [viewMode, setViewMode] = useState('dashboard'); // dashboard, list, master

  // 1. 數據處理核心
  const stats = useMemo(() => {
    const activityStats = {}; // { "足球": { count: 10, hours: 20 } }
    const gradeStats = {};    // { "1": { sessions: 50, students: Set() } }
    const studentStats = {};  // { "1A01chan": { name, class, sessions, hours } }

    masterList.forEach(item => {
      const duration = calculateDuration(item.time);
      
      // A. Activity Stats
      if (!activityStats[item.activity]) {
        activityStats[item.activity] = { name: item.activity, count: 0, hours: 0 };
      }
      activityStats[item.activity].count += 1;
      activityStats[item.activity].hours += duration;

      // B. Grade Stats (P1-P6)
      const grade = item.class ? item.class.charAt(0) : 'Others';
      if (!gradeStats[grade]) {
        gradeStats[grade] = { sessions: 0, students: new Set() };
      }
      gradeStats[grade].sessions += 1;
      gradeStats[grade].students.add(item.studentId); // 假設 studentId 唯一

      // C. Student Stats
      const sId = item.studentId || `${item.class}-${item.name}`;
      if (!studentStats[sId]) {
        studentStats[sId] = { 
          id: sId,
          class: item.class, 
          name: item.name, 
          sessions: 0, 
          hours: 0 
        };
      }
      studentStats[sId].sessions += 1;
      studentStats[sId].hours += duration;
    });

    // 處理圓形圖數據 (Activity Hours)
    const sortedActivities = Object.values(activityStats).sort((a, b) => b.hours - a.hours);
    const totalHours = sortedActivities.reduce((sum, item) => sum + item.hours, 0);
    
    // 處理年級平均
    const gradeChartData = Object.keys(gradeStats).sort().map(g => {
      const data = gradeStats[g];
      const avg = data.students.size > 0 ? (data.sessions / data.students.size).toFixed(1) : 0;
      return { grade: g, avg: parseFloat(avg), total: data.sessions, count: data.students.size };
    });

    // 處理學生名單 (找低參與度)
    const sortedStudents = Object.values(studentStats).sort((a, b) => a.hours - b.hours);

    return { sortedActivities, totalHours, gradeChartData, sortedStudents };
  }, [masterList]);

  // 匯出 Master Data
  const handleExportMaster = () => {
    const exportData = masterList.map(({ id, ...rest }) => rest); // 移除 firestore id
    exportToCSV(exportData, 'Master_Activity_Data');
  };

  // 匯出 Student Stats
  const handleExportStudentStats = () => {
    exportToCSV(stats.sortedStudents, 'Student_Engagement_Report');
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center">
            <BarChart className="mr-3" size={32} />
            校本數據分析中心 (5C+ Analytics)
          </h2>
          <p className="text-slate-500 mt-1">版本 V3.3 | 支援全方位學習 (LWL) 及學時規劃</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition">
          <X size={24} />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        <button 
          onClick={() => setViewMode('dashboard')}
          className={`px-4 py-2 rounded-lg flex items-center ${viewMode === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <PieChart size={18} className="mr-2" /> 數據概覽
        </button>
        <button 
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg flex items-center ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Activity size={18} className="mr-2" /> 活動統計列表
        </button>
        <button 
          onClick={() => setViewMode('students')}
          className={`px-4 py-2 rounded-lg flex items-center ${viewMode === 'students' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Users size={18} className="mr-2" /> 學生參與監測
        </button>
        <button 
          onClick={() => setViewMode('master')}
          className={`px-4 py-2 rounded-lg flex items-center ${viewMode === 'master' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <Database size={18} className="mr-2" /> 全數據庫 (Master)
        </button>
      </div>

      {/* VIEW: DASHBOARD */}
      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. 活動時數分佈 (Pie Chart Logic using CSS Conic Gradient) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Clock className="mr-2 text-indigo-500" /> 活動總時數分佈
            </h3>
            <div className="flex flex-col items-center">
              <div 
                className="w-64 h-64 rounded-full border-4 border-slate-50 shadow-inner mb-6 relative"
                style={{
                  background: `conic-gradient(${
                    stats.sortedActivities.slice(0, 6).reduce((acc, item, idx, arr) => {
                      // 簡易計算每個 slice 的角度
                      const prevDeg = idx === 0 ? 0 : acc.prevDeg;
                      const deg = (item.hours / stats.totalHours) * 360;
                      const color = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'][idx % 6];
                      acc.str += `${color} ${prevDeg}deg ${prevDeg + deg}deg, `;
                      acc.prevDeg += deg;
                      return idx === arr.length - 1 ? acc.str.slice(0, -2) : acc; // remove last comma
                    }, { str: '', prevDeg: 0 }).str || '#e2e8f0 0deg 360deg'
                  })`
                }}
              >
                {/* Center Hole for Donut Chart effect */}
                <div className="absolute inset-0 m-auto w-32 h-32 bg-white rounded-full flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold text-slate-700">{stats.totalHours.toFixed(0)}</span>
                  <span className="text-xs text-slate-400">總學時 (小時)</span>
                </div>
              </div>
              
              {/* Legend */}
              <div className="w-full grid grid-cols-2 gap-2 text-sm">
                {stats.sortedActivities.slice(0, 6).map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between px-2 py-1 rounded bg-slate-50">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'][idx % 6] }}></span>
                      <span className="truncate w-24">{item.name}</span>
                    </div>
                    <span className="font-bold">{((item.hours / stats.totalHours) * 100).toFixed(1)}%</span>
                  </div>
                ))}
                <div className="text-xs text-slate-400 col-span-2 text-center mt-2">
                  * 僅顯示前 6 項主要活動
                </div>
              </div>
            </div>
          </div>

          {/* 2. 年級平均參與度 (Bar Chart) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <TrendingUp className="mr-2 text-green-500" /> 年級資源平均分配 (節數/人)
            </h3>
            <div className="space-y-4 pt-4">
              {stats.gradeChartData.map((gradeData) => {
                 // 假設最大平均值為 10 來做比例 (避免爆表)
                 const widthPercent = Math.min((gradeData.avg / 10) * 100, 100); 
                 return (
                  <div key={gradeData.grade} className="flex items-center">
                    <div className="w-12 font-bold text-slate-600">P.{gradeData.grade}</div>
                    <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden relative mx-2">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full flex items-center justify-end px-2 text-white text-xs font-bold transition-all duration-500"
                        style={{ width: `${widthPercent}%` }}
                      >
                        {gradeData.avg > 1 ? gradeData.avg : ''}
                      </div>
                    </div>
                    <div className="w-16 text-right text-xs text-slate-400">
                      {gradeData.total}節 / {gradeData.count}人
                    </div>
                  </div>
                 )
              })}
              <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <strong>分析觀點：</strong> 此圖表顯示各級學生「平均」參與多少節活動。若某年級數值顯著低於其他年級，建議在下一季課程規劃中增加該年級的適齡活動。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: ACTIVITY LIST */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700">活動時數與節數統計</h3>
             <button onClick={() => exportToCSV(stats.sortedActivities, 'Activity_Stats')} className="text-sm bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-50 flex items-center">
                <Download size={14} className="mr-1"/> 匯出
             </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3">活動名稱</th>
                  <th className="px-6 py-3 text-right">總節數 (Sessions)</th>
                  <th className="px-6 py-3 text-right">總時數 (Hours)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.sortedActivities.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{item.count}</td>
                    <td className="px-6 py-3 text-right font-bold text-indigo-600">{item.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: STUDENT MONITOR */}
      {viewMode === 'students' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700 flex items-center">
               <AlertTriangle size={18} className="text-orange-500 mr-2" />
               學生參與度監測 (低參與度優先)
             </h3>
             <button onClick={handleExportStudentStats} className="text-sm bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-50 flex items-center">
                <Download size={14} className="mr-1"/> 匯出報告
             </button>
          </div>
          <div className="p-4 bg-orange-50 text-orange-800 text-sm mb-0">
            注意：此列表僅包含「已報名至少一項活動」的學生。若學生完全未在系統中出現，請核對全校名單。
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                <tr>
                  <th className="px-6 py-3">班別</th>
                  <th className="px-6 py-3">姓名</th>
                  <th className="px-6 py-3 text-right">參與節數</th>
                  <th className="px-6 py-3 text-right">總時數</th>
                  <th className="px-6 py-3 text-center">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.sortedStudents.map((s, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 ${s.hours < 2 ? 'bg-red-50/50' : ''}`}>
                    <td className="px-6 py-3 text-slate-600">{s.class}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{s.sessions}</td>
                    <td className="px-6 py-3 text-right font-bold">{s.hours.toFixed(1)}</td>
                    <td className="px-6 py-3 text-center">
                      {s.hours < 2 ? (
                        <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">關注</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-xs">良好</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: MASTER DATA */}
      {viewMode === 'master' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700">全數據庫查閱 (Master Log)</h3>
             <div className="flex space-x-2">
               <button onClick={handleExportMaster} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 flex items-center">
                  <FileSpreadsheet size={14} className="mr-1"/> 匯出 CSV
               </button>
             </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3">班別</th>
                  <th className="px-4 py-3">姓名</th>
                  <th className="px-4 py-3">活動名稱</th>
                  <th className="px-4 py-3">日期</th>
                  <th className="px-4 py-3">時間</th>
                  <th className="px-4 py-3">地點</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterList.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{row.class}</td>
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2 text-indigo-600">{row.activity}</td>
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2">{row.time}</td>
                    <td className="px-4 py-2 text-slate-500">{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};


// =============================================================================
//  LOGIN COMPONENT
// =============================================================================

const LoginPanel = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin(); // Parent handles state change
    } catch (err) {
      setError("登入失敗：請檢查電郵或密碼");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <Lock className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">教職員登入</h2>
          <p className="text-slate-500 text-sm mt-2">香海正覺蓮社佛教正覺蓮社學校</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
            <AlertTriangle size={16} className="mr-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">電郵地址</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type="email" 
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="admin@school.edu.hk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type="password" 
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-200 disabled:opacity-50 flex justify-center items-center"
          >
            {loading ? <RefreshCcw className="animate-spin" size={20} /> : "安全登入"}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button onClick={() => onLogin(false)} className="text-slate-400 text-sm hover:text-slate-600">
            返回學生查詢
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
//  ADMIN DASHBOARD COMPONENT
// =============================================================================

const AdminPanel = ({ onLogout }) => {
  const [masterList, setMasterList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importText, setImportText] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // list, add, settings, *stats* (V3.3 New)
  const [saveStatus, setSaveStatus] = useState(''); // saved, saving, error
  
  // States for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // States for Stats View (V3.3)
  const [showStats, setShowStats] = useState(false);

  // Collection Reference
  const activitiesCollection = collection(db, "activities");

  // Load Data
  useEffect(() => {
    const q = query(activitiesCollection, orderBy("class"), orderBy("studentId"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMasterList(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- V3.3: 處理開啟統計 ---
  if (showStats) {
    return <StatsPanel masterList={masterList} onClose={() => setShowStats(false)} />;
  }

  // Handle Text Import (Regex Magic)
  const parseAndImport = async () => {
    setSaveStatus('saving');
    const lines = importText.split('\n').filter(line => line.trim() !== '');
    const newEntries = [];
    const batch = writeBatch(db);

    // Regex explanation:
    // ^(\d[A-Z]) -> Starts with Class (e.g., 1A)
    // \s+ -> space
    // (\d+) -> Student ID (e.g., 23)
    // \s+ -> space
    // (.*?) -> Name (lazy match)
    // \s+ -> space
    // (\d{8}) -> Phone (8 digits)
    // Note: This regex is tuned for the specific "Class ID Name Phone" format pasted from PDF
    // If format varies, logic needs adaptation.
    // For this specific app, we assume the text contains Activity Info too?
    // Actually, looking at the fields: Class, Name, Activity, Date, Time, Location.
    // Let's assume the user pastes CSV-like or Tab-separated data for now, OR simply uses the Manual Add.
    // *Self-Correction*: The prompt mentioned "Regex to identify Class, Name, Phone".
    // But for Activity Schedule, we need Activity, Date, Time. 
    // Let's implement a smart parser that tries to guess fields if separated by Tab/Space.
    
    // Simple parser for now: Assume format: Class [tab] Name [tab] Activity [tab] Date [tab] Time [tab] Location
    
    lines.forEach(line => {
      // Clean up tabs/spaces
      const parts = line.split(/[\t]+/).map(s => s.trim());
      
      if (parts.length >= 5) {
        // Create doc ref
        const newDocRef = doc(activitiesCollection);
        const entry = {
          class: parts[0] || '',
          studentId: parts[0] + (parts[1] || '').padStart(2, '0'), // Fake ID generation for sorting
          name: parts[1] || '',
          activity: parts[2] || '',
          date: parts[3] || '',
          time: parts[4] || '',
          location: parts[5] || '校內'
        };
        batch.set(newDocRef, entry);
      }
    });

    try {
      await batch.commit();
      setSaveStatus('saved');
      setImportText('');
      setTimeout(() => setSaveStatus(''), 2000);
      alert(`成功匯入 ${lines.length} 筆資料 (粗略估計)`);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      alert("匯入失敗，請檢查網絡");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定刪除此記錄？')) {
      await deleteDoc(doc(db, "activities", id));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    
    const docRef = doc(db, "activities", editingItem.id);
    await updateDoc(docRef, {
      class: editingItem.class,
      name: editingItem.name,
      activity: editingItem.activity,
      date: editingItem.date,
      time: editingItem.time,
      location: editingItem.location
    });
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Admin Header */}
      <div className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="bg-blue-600 text-white p-2 rounded-lg mr-3">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">後台管理系統</h1>
              <p className="text-xs text-slate-500">香海正覺蓮社佛教正覺蓮社學校 (V3.3)</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             {/* V3.3 Button */}
            <button 
              onClick={() => setShowStats(true)} 
              className="flex items-center text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-4 py-2 rounded-lg transition"
            >
              <BarChart size={18} className="mr-2" />
              數據統計
            </button>
            <button 
              onClick={onLogout} 
              className="flex items-center text-slate-400 hover:text-red-500 transition"
            >
              <LogOut size={18} className="mr-2" />
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">功能選單</h3>
            <button 
              onClick={() => setActiveTab('list')}
              className={`w-full text-left p-3 rounded-xl mb-2 flex items-center transition ${activeTab === 'list' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Database size={18} className="mr-3" />
              資料庫總覽
            </button>
            <button 
              onClick={() => setActiveTab('import')}
              className={`w-full text-left p-3 rounded-xl mb-2 flex items-center transition ${activeTab === 'import' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Upload size={18} className="mr-3" />
              批量匯入
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left p-3 rounded-xl flex items-center transition ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Settings size={18} className="mr-3" />
              系統設定
            </button>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg">
            <h3 className="font-bold text-lg mb-1">已發布活動</h3>
            <p className="text-3xl font-bold mb-4">{masterList.length}</p>
            <div className="text-xs opacity-80">
              <p>資料庫狀態: 連線正常</p>
              <p>最後更新: 即時同步</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          
          {/* TAB: LIST */}
          {activeTab === 'list' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-700">活動名單 ({masterList.length})</h3>
                <div className="flex space-x-2">
                  <button className="p-2 text-slate-400 hover:text-blue-600"><Filter size={18} /></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-4">班別</th>
                      <th className="p-4">姓名</th>
                      <th className="p-4">活動</th>
                      <th className="p-4">日期/時間</th>
                      <th className="p-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterList.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 group">
                        <td className="p-4 font-bold text-slate-700">{item.class}</td>
                        <td className="p-4">{item.name}</td>
                        <td className="p-4">
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                            {item.activity}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">
                          <div>{item.date}</div>
                          <div className="text-xs">{item.time}</div>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => openEdit(item)} className="text-slate-400 hover:text-blue-600 mr-3">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {masterList.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-400">
                          資料庫暫無資料
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: IMPORT */}
          {activeTab === 'import' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-lg text-slate-800 mb-4">批量文字匯入</h3>
              <div className="bg-amber-50 text-amber-800 p-4 rounded-xl mb-4 text-sm flex items-start">
                <AlertTriangle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                <p>請將 Excel 資料複製並貼上至此。格式順序必須為：<br/>
                <strong>班別 [Tab] 姓名 [Tab] 活動名稱 [Tab] 日期 [Tab] 時間 [Tab] 地點</strong></p>
              </div>
              <textarea 
                className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={`1A	陳小明	足球班	2024-02-01	15:30-16:30	操場\n1B	李大文	合唱團	2024-02-02	14:00-15:00	音樂室`}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={parseAndImport}
                  disabled={importText.length === 0 || saveStatus === 'saving'}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition flex items-center shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {saveStatus === 'saving' ? <RefreshCcw className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                  開始匯入
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">編輯資料</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">班別</label>
                  <input className="w-full p-2 border rounded-lg" value={editingItem.class} onChange={e => setEditingItem({...editingItem, class: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">姓名</label>
                  <input className="w-full p-2 border rounded-lg" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">活動名稱</label>
                <input className="w-full p-2 border rounded-lg" value={editingItem.activity} onChange={e => setEditingItem({...editingItem, activity: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">日期</label>
                    <input className="w-full p-2 border rounded-lg" value={editingItem.date} onChange={e => setEditingItem({...editingItem, date: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">時間</label>
                    <input className="w-full p-2 border rounded-lg" value={editingItem.time} onChange={e => setEditingItem({...editingItem, time: e.target.value})} />
                 </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">取消</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">儲存變更</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
//  MAIN COMPONENT (APP)
// =============================================================================

function App() {
  // Modes: 'student' (default), 'login', 'admin', 'staff'
  const [mode, setMode] = useState('student');
  const [currentUser, setCurrentUser] = useState(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && mode === 'login') {
        // Default to admin, but ideally check claims/roles
        setMode('admin'); 
      }
    });
    return () => unsubscribe();
  }, [mode]);

  // Student Search States
  const [selectedClass, setSelectedClass] = useState('1A');
  const [studentId, setStudentId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Staff View Logic (V3.2 Addition)
  const [staffViewDate, setStaffViewDate] = useState('today'); // 'today' or 'all'
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [todaysActivities, setTodaysActivities] = useState([]);

  const classes = useMemo(() => {
    const c = [];
    for(let i=1; i<=6; i++) {
      ['A','B','C','D'].forEach(l => c.push(`${i}${l}`));
    }
    return c;
  }, []);

  // --- Student Search ---
  const handleSearch = async () => {
    if (!studentId) return;
    setLoading(true);
    setSearchTriggered(true);

    try {
      const q = query(
        collection(db, "activities"),
        orderBy("date") // Simple sort
      );
      // Client-side filtering for simplicity in this demo
      // Production should use composite indexes: where("class", "==", selectedClass)
      const querySnapshot = await import("firebase/firestore").then(mod => mod.getDocs(q));
      
      const results = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Loose matching for ID (e.g. 01 vs 1)
        if (data.class === selectedClass && parseInt(data.studentId.slice(-2)) === parseInt(studentId)) {
          results.push(data);
        }
      });
      setSearchResult(results);
    } catch (error) {
      console.error("Search Error:", error);
      setSearchResult([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Staff View: Load Today's Activities ---
  const loadTodaysActivities = async () => {
      setLoading(true);
      const todayStr = new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      // For Demo: Just fetching all and filtering. Real app: where("date", "==", todayStr)
      try {
        const q = collection(db, "activities");
        const snapshot = await import("firebase/firestore").then(mod => mod.getDocs(q));
        const all = snapshot.docs.map(d => d.data());
        
        // V3.2: Filter Logic
        // Note: Date format in DB must match. Assuming YYYY-MM-DD
        // If DB has random formats, this needs strict parsing.
        // Let's just return ALL for demo if date doesn't match, or filter by a simple string match
        setTodaysActivities(all); 
      } catch (e) { console.error(e); }
      setLoading(false);
  };

  // Render Based on Mode
  if (mode === 'login') {
    return <LoginPanel onLogin={(success = true) => setMode(success ? 'admin' : 'student')} />;
  }

  if (mode === 'admin') {
    return <AdminPanel onLogout={() => { signOut(auth); setMode('student'); }} />;
  }

  // Staff View (Simplified Admin/Teacher View)
  if (mode === 'staff') {
    return (
        <div className="min-h-screen bg-slate-50 p-4">
             {/* Staff Header */}
             <div className="flex justify-between items-center mb-6">
                <button onClick={() => setMode('student')} className="flex items-center text-slate-500 hover:text-slate-800">
                    <ArrowLeft className="mr-2"/> 返回首頁
                </button>
                <h1 className="text-xl font-bold text-slate-800">教職員日程檢視</h1>
             </div>
             
             {/* Controls */}
             <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex gap-4">
                 <button 
                    onClick={() => { setStaffViewDate('today'); loadTodaysActivities(); }}
                    className={`px-4 py-2 rounded-lg font-bold ${staffViewDate === 'today' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                 >
                    今日活動
                 </button>
                 <button 
                    onClick={() => { setStaffViewDate('all'); loadTodaysActivities(); }}
                    className={`px-4 py-2 rounded-lg font-bold ${staffViewDate === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                 >
                    所有記錄
                 </button>
                 <div className="flex-1 relative">
                     <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                     <input 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="搜尋學生、活動..."
                        value={staffSearchTerm}
                        onChange={(e) => setStaffSearchTerm(e.target.value)}
                     />
                 </div>
             </div>

             {/* List */}
             <div className="space-y-3">
                 {todaysActivities
                    .filter(item => 
                        item.name.includes(staffSearchTerm) || 
                        item.activity.includes(staffSearchTerm) ||
                        item.class.includes(staffSearchTerm)
                    )
                    .map((item, i) => (
                     <div key={i} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500 flex justify-between items-center">
                         <div>
                             <div className="flex items-center gap-2 mb-1">
                                 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{item.class}</span>
                                 <span className="font-bold text-slate-800">{item.name}</span>
                             </div>
                             <div className="text-blue-600 font-bold">{item.activity}</div>
                         </div>
                         <div className="text-right text-sm text-slate-500">
                             <div className="flex items-center justify-end"><Clock size={14} className="mr-1"/>{item.time}</div>
                             <div className="flex items-center justify-end"><MapPin size={14} className="mr-1"/>{item.location}</div>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
  }

  // Default: Student Kiosk View
  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4f8] font-sans relative overflow-hidden">
      
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-orange-400 to-orange-300 rounded-b-[3rem] shadow-lg z-0"></div>
      
      {/* Header */}
      <div className="relative z-10 pt-8 px-6 pb-4 flex justify-between items-start">
        <div className="flex items-center space-x-4">
           <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
             {/* Logo placeholder */}
             <span className="text-2xl font-bold text-orange-500">佛</span>
           </div>
           <div>
             <h1 className="text-2xl font-bold text-white drop-shadow-md tracking-wide">佛教正覺蓮社學校</h1>
             <p className="text-orange-50 font-medium opacity-90">課外活動查詢系統 (ECA Kiosk)</p>
           </div>
        </div>
        <button 
            onClick={() => setMode('login')}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium transition flex items-center"
        >
            <User size={16} className="mr-2" />
            教職員
        </button>
      </div>

      {/* Main Card */}
      <div className="relative z-10 flex-1 px-4 pb-8 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-xl p-6 min-h-[600px] border border-slate-100 flex flex-col">
            
            {/* Search Section */}
            <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
                    <Search className="mr-2 text-orange-500" />
                    查詢你的活動
                </h2>
                <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">班別</label>
                        <select 
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full h-14 text-xl font-bold text-slate-700 bg-white border-2 border-slate-200 rounded-xl px-4 focus:border-orange-400 focus:ring-0 outline-none transition cursor-pointer"
                        >
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="col-span-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">學號</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="例如: 23"
                                className="w-full h-14 text-xl font-bold text-slate-700 bg-white border-2 border-slate-200 rounded-xl pl-4 pr-12 focus:border-orange-400 focus:ring-0 outline-none transition placeholder:text-slate-300"
                            />
                            <button 
                                onClick={handleSearch}
                                className="absolute right-2 top-2 h-10 w-10 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center transition shadow-md"
                            >
                                <ArrowRight size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            <div className="flex-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <RefreshCcw className="animate-spin mb-4 text-orange-400" size={48} />
                        <p>正在搜尋資料...</p>
                    </div>
                ) : searchTriggered && searchResult ? (
                    <div>
                        <div className="flex justify-between items-end mb-4">
                           <div>
                               <h3 className="text-2xl font-bold text-slate-800">
                                   你好, {searchResult.length > 0 ? searchResult[0].name : "同學"}
                               </h3>
                               <p className="text-slate-500 text-sm">
                                   {searchResult.length > 0 ? `找到 ${searchResult.length} 項活動` : "找不到你的活動記錄"}
                               </p>
                           </div>
                           {searchResult.length > 0 && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center"><CheckCircle size={14} className="mr-1"/> 資料已同步</span>}
                        </div>
                        
                        <div className="space-y-4">
                            {searchResult.length > 0 ? (
                                searchResult.map((item, idx) => (
                                    <div key={idx} className="bg-white text-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden border-l-8 border-orange-400 group hover:-translate-y-1 transition duration-300">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-xl font-bold text-slate-900">{item.activity}</h3>
                                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">{item.date}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-3">
                                            <div className="flex items-center text-slate-600 bg-slate-50 p-2 rounded-lg">
                                                <Clock size={18} className="mr-2 text-orange-500" />
                                                <span className="font-bold">{item.time}</span>
                                            </div>
                                            <div className="flex items-center text-blue-800 bg-blue-50 p-2 rounded-lg">
                                                <MapPin size={18} className="mr-2 text-blue-500" />
                                                <span className="font-bold">{item.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-slate-500 text-sm italic py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                    <p className="mb-2">沒有安排活動</p>
                                    <p className="text-xs text-slate-400">試試檢查班別和學號是否正確？</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 mt-8 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Calendar size={48} className="mb-2 opacity-30" />
                        <p className="text-lg font-medium opacity-50">請輸入班別及學號查詢</p>
                    </div>
                )}
            </div>
            
            {/* Footer Text */}
            <div className="mt-8 text-center">
                 <p className="text-xs text-slate-300">© 2024 香海正覺蓮社佛教正覺蓮社學校 | 5C+ 創意教育</p>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;