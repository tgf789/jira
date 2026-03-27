import React, { useState } from 'react';
import { setCookie } from '../utils/cookie';
import { setJiraAuth, checkAuth } from '../utils/jiraApi';
import './JiraLoginForm.css';

interface Props {
  onLoginSuccess: () => void;
}

const JiraLoginForm: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      setJiraAuth(username, password);
      const isOk = await checkAuth();
      if (isOk) {
        // 로그인 성공 시 쿠키 저장 (7일)
        setCookie("jira_user", username, 7);
        setCookie("jira_pass", btoa(password), 7);
        onLoginSuccess();
      } else {
        setError("인증에 실패했습니다. 아이디와 비밀번호를 확인해주세요.");
      }
    } catch (err: any) {
      setError(err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-container">
      <h2>JIRA 로그인</h2>
      <p className="description">JIRA 서버 인증을 위해 아이디와 비밀번호를 입력해주세요.</p>
      
      <form onSubmit={handleLogin}>
        <div className="input-group">
          <label>아이디</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            required 
            placeholder="JIRA ID (예: tgf789)"
          />
        </div>
        <div className="input-group">
          <label>비밀번호</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required 
            placeholder="JIRA Password"
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "인증 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
};

export default JiraLoginForm;
