import React, { useEffect } from 'react';
import { getCookie, setCookie } from '../utils/cookie';
import './IdInputList.css';

interface Props {
  ids: string[];
  onChange: (ids: string[]) => void;
}

const IdInputList: React.FC<Props> = ({ ids, onChange }) => {
  useEffect(() => {
    const savedIds = getCookie('jiraIds');
    if (savedIds) {
      try {
        const parsed = JSON.parse(savedIds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onChange(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved IDs', e);
      }
    }
  }, []);

  const handleIdChange = (index: number, value: string) => {
    const newIds = [...ids];
    newIds[index] = value;
    updateIds(newIds);
  };

  const addId = () => {
    updateIds([...ids, '']);
  };

  const removeId = (index: number) => {
    if (ids.length <= 1) return;
    const newIds = ids.filter((_, i) => i !== index);
    updateIds(newIds);
  };

  const updateIds = (newIds: string[]) => {
    onChange(newIds);
    setCookie('jiraIds', JSON.stringify(newIds), 365);
  };

  return (
    <div className="id-input-list">
      <label>JIRA 담당자 목록</label>
      <div className="id-inputs">
        {ids.map((id, index) => (
          <div key={index} className="id-input-row">
            <input
              type="text"
              value={id}
              onChange={(e) => handleIdChange(index, e.target.value)}
              placeholder="JIRA ID (예: tgf789)"
            />
            {ids.length > 1 && (
              <button 
                onClick={() => removeId(index)} 
                className="btn-remove"
                title="삭제"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button onClick={addId} className="btn-add">
          <span>+</span> 담당자 추가
        </button>
      </div>
    </div>
  );
};

export default IdInputList;
