import React from 'react';
import { 
  format, 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks 
} from 'date-fns';
import './DateRangePicker.css';

interface Props {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const DateRangePicker: React.FC<Props> = ({ startDate, endDate, onChange }) => {
  const today = new Date();

  const getRange = (type: string): { start: string; end: string } => {
    let start = today;
    let end = today;

    switch (type) {
      case 'today':
        break;
      case 'yesterday':
        start = end = subDays(today, 1);
        break;
      case 'tomorrow':
        start = end = addDays(today, 1);
        break;
      case 'thisWeek':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        end = subDays(end, 2); // 월~금
        break;
      case 'lastWeek':
        const lastRoot = subWeeks(today, 1);
        start = startOfWeek(lastRoot, { weekStartsOn: 1 });
        end = endOfWeek(lastRoot, { weekStartsOn: 1 });
        end = subDays(end, 2);
        break;
      case 'nextWeek':
        const nextRoot = addWeeks(today, 1);
        start = startOfWeek(nextRoot, { weekStartsOn: 1 });
        end = endOfWeek(nextRoot, { weekStartsOn: 1 });
        end = subDays(end, 2);
        break;
    }

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  };

  const handleQuickSelect = (type: string) => {
    const { start, end } = getRange(type);
    onChange(start, end);
  };

  const isActive = (type: string) => {
    const { start, end } = getRange(type);
    return startDate === start && endDate === end;
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      if (value > endDate) onChange(value, value);
      else onChange(value, endDate);
    } else {
      if (value < startDate) onChange(startDate, startDate);
      else onChange(startDate, value);
    }
  };

  return (
    <div className="date-range-picker">
      <label>검색 기간 설정</label>
      <div className="quick-buttons">
        <button 
          className={isActive('lastWeek') ? 'active' : ''} 
          onClick={() => handleQuickSelect('lastWeek')}
        >지난주</button>
        <button 
          className={isActive('thisWeek') ? 'active' : ''} 
          onClick={() => handleQuickSelect('thisWeek')}
        >이번주</button>
        <button 
          className={isActive('nextWeek') ? 'active' : ''} 
          onClick={() => handleQuickSelect('nextWeek')}
        >다음주</button>
        <button 
          className={isActive('yesterday') ? 'active' : ''} 
          onClick={() => handleQuickSelect('yesterday')}
        >어제</button>
        <button 
          className={isActive('today') ? 'active' : ''} 
          onClick={() => handleQuickSelect('today')}
        >오늘</button>
        <button 
          className={isActive('tomorrow') ? 'active' : ''} 
          onClick={() => handleQuickSelect('tomorrow')}
        >내일</button>
      </div>
      <div className="date-inputs">
        <div className="date-input-group">
          <span>시작일</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleDateChange('start', e.target.value)}
          />
        </div>
        <div className="date-input-group">
          <span>종료일</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleDateChange('end', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
