import React, { useState } from 'react';
import './ReportOutput.css';

interface Props {
  value: string;
}

const ReportOutput: React.FC<Props> = ({ value }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className="report-output-container animate-fade-in">
      <h2>📄 실시간 업무 보고서</h2>
      <div className="report-wrapper">
        <button 
          onClick={handleCopy} 
          className={`btn-copy ${copyStatus === 'copied' ? 'copied' : ''}`}
          disabled={!value}
        >
          {copyStatus === 'copied' ? '✓ 복사완료' : '전체 복사'}
        </button>
        <textarea
          readOnly
          value={value}
          placeholder="JIRA 업무를 조회하여 보고서를 생성하세요."
          className="report-area"
        />
      </div>
    </div>
  );
};

export default ReportOutput;
