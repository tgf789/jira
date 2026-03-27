import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import JiraLoginForm from '../../components/JiraLoginForm';
import IdInputList from '../../components/IdInputList';
import DateRangePicker from '../../components/DateRangePicker';
import ReportOutput from '../../components/ReportOutput';
import type { ISearchParams } from '../../utils/interface';
import { 
  searchByIdsAndDateRange, 
  resolveParentChain, 
  setJiraAuth,
  checkAuth
} from '../../utils/jiraApi';
import { buildTreeFromIssues } from '../../utils/treeBuilder';
import { 
  convertToReportStructure, 
  formatDailyReport 
} from '../../utils/reportFormatter';
import { getCookie, setCookie, deleteCookie } from '../../utils/cookie';
import './DailyReport.css';
import type { IDailyReport } from '../../utils/interface';

const DailyReport: React.FC = () => {
  const [ids, setIds] = useState<string[]>(['']);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportText, setReportText] = useState('');
  const [reportData, setReportData] = useState<IDailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [isUpdateWarn, setIsUpdateWarn] = useState(getCookie('isUpdateWarn') !== 'false');
  const [showJiraKey, setShowJiraKey] = useState(getCookie('showJiraKey') !== 'false');
  const [includeJiraLink, setIncludeJiraLink] = useState(getCookie('includeJiraLink') === 'true');

  // 초기 로드 시 쿠키 확인
  useEffect(() => {
    const autoLogin = async () => {
      const user = getCookie("jira_user");
      const pass = getCookie("jira_pass");

      if (user && pass) {
        try {
          const decodedPass = atob(pass);
          setJiraAuth(user, decodedPass);
          const isOk = await checkAuth();
          if (isOk) {
            setIsLoggedIn(true);
          } else {
            deleteCookie("jira_user");
            deleteCookie("jira_pass");
          }
        } catch (e) {
          console.error("Auto login failed", e);
        }
      }
      setInitLoading(false);
    };
    autoLogin();
  }, []);

  useEffect(() => {
    setCookie('isUpdateWarn', isUpdateWarn.toString(), 365);
  }, [isUpdateWarn]);

  useEffect(() => {
    setCookie('showJiraKey', showJiraKey.toString(), 365);
  }, [showJiraKey]);

  useEffect(() => {
    setCookie('includeJiraLink', includeJiraLink.toString(), 365);
  }, [includeJiraLink]);

  // 리포트 데이터 또는 설정 변경 시 텍스트 업데이트
  useEffect(() => {
    if (reportData) {
      const formatted = formatDailyReport(reportData, {}, isUpdateWarn, showJiraKey, includeJiraLink);
      setReportText(formatted);
    }
  }, [reportData, isUpdateWarn, showJiraKey, includeJiraLink]);

  // 로그인 성공 핸들러
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    if (confirm("다시 로그인하시겠습니까? (저장된 로그인 정보가 삭제됩니다)")) {
      deleteCookie("jira_user");
      deleteCookie("jira_pass");
      setIsLoggedIn(false);
      setReportText("");
      setReportData(null);
    }
  };

  const handleSearch = async () => {
    const activeIds = ids.filter(id => id.trim() !== '');
    if (activeIds.length === 0) {
      alert('최소 하나 이상의 JIRA ID를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setReportText('');

    try {
      const params: ISearchParams = {
        jiraIds: activeIds,
        startDate,
        endDate
      };

      // 1. 초기 검색
      const initialIssues = await searchByIdsAndDateRange(params);
      
      if (initialIssues.length === 0) {
        alert('해당 기간에 검색 결과가 없습니다.');
        return;
      }

      // 2. 상위 체인 해결
      const allIssues = await resolveParentChain(initialIssues);

      // 3. 트리 구조화
      const tree = buildTreeFromIssues(allIssues);

      // 4. 리포트 객체 변환
      const data = convertToReportStructure(tree, "");
      setReportData(data);

    } catch (e: any) {
      console.error('Search failed', e);
      alert(`조회 중 오류가 발생했습니다: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (initLoading) {
    return <div className="loading-screen">초기화 중...</div>;
  }

  if (!isLoggedIn) {
    return <JiraLoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="daily-report-page">
      <header className="page-header">
        <h1>Jira Report Pro</h1>
        <div className="header-actions">
          <button className="btn-logout" onClick={handleLogout}>다시 로그인</button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="setting-group">
            <label className="checkbox-container">
              <input 
                type="checkbox" 
                checked={isUpdateWarn} 
                onChange={(e) => setIsUpdateWarn(e.target.checked)} 
              />
              <span className="checkbox-label">금일 미완료 경고 (🔴)</span>
            </label>
            <label className="checkbox-container">
              <input 
                type="checkbox" 
                checked={showJiraKey} 
                onChange={(e) => setShowJiraKey(e.target.checked)} 
              />
              <span className="checkbox-label">JIRA 키 표시</span>
            </label>
            <label className="checkbox-container">
              <input 
                type="checkbox" 
                checked={includeJiraLink} 
                onChange={(e) => setIncludeJiraLink(e.target.checked)} 
              />
              <span className="checkbox-label">JIRA 링크 포함</span>
            </label>
          </div>

          <IdInputList ids={ids} onChange={setIds} />
          <DateRangePicker 
            startDate={startDate} 
            endDate={endDate} 
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }} 
          />
          <button 
            className="btn-search" 
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? '조회 중...' : '🔍 JIRA 업무 조회'}
          </button>
        </aside>

        <section className="content-area">
          <ReportOutput value={reportText} />
        </section>
      </div>
    </div>
  );
};

export default DailyReport;
