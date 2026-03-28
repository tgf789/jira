export interface IIssueCSV {
  "key" : string;
  "담당자" : string; 
  "보고자" : string;
  "사용자정의 필드 (담당자(부))" : string;
  "사용자정의 필드 (변경 종료일)" : string;
  "사용자정의 필드 (업데이트 예정일)" : string;
  "사용자정의 필드 (완료일(WBSGantt))" : string;
  "사용자정의 필드 (시작일(WBSGantt))" : string;
  "시작일" : string;
  "종료일" : string;
  "사용자정의 필드 (일정 변경 사유)" : string;
  "사용자정의 필드 (진행 상황(WBSGantt))" : string;
  "사용자정의 필드 (Epic Name)" : string;
  "상태": string;
  "설명" : string;
  "요약" : string;
  "이슈 키": string;
  "변경일" : string;
  "생성일" : string;
  "우선순위" : "High" | "Low" | "Highest" | "Lowest" | "Medium";
  "사용자정의 필드 (WEHAGO 서비스 구분)" : string;
  "timetracking"?: {
    originalEstimateSeconds?: number;
    timeSpentSeconds?: number;
    remainingEstimateSeconds?: number;
  };
  "aggregateprogress"?: { progress: number; total: number; percent?: number };
  "timeoriginalestimate"?: number | null;
  "timespent"?: number | null;
  "aggregatetimeoriginalestimate"?: number | null;
  "aggregatetimespent"?: number | null;
  "issuetype": { name: string; subtask: boolean };
  "parent"?: { id: string; key: string; fields: { summary: string } };
  "children" : IIssueCSV[];
  "레이블" : string;
  [key: `사용자정의 필드 (담당자(부)).${number}`]: string;
}

export interface IWeeklyUpmuItem {
  "주요내용": string;
  "출시목표": string;
  "우선순위": string;
  "상태": string;
  "실적": string;
  "하위업무"? : IWeeklyUpmuItem[];
}

export interface IProject {
  프로젝트명:string;
  업무:IWeeklyUpmuItem[];
  담당자:string[];
}

/**
 * 일일보고 개별 업무 항목
 */
export interface IDailyReportTask {
  key: string;                    // JIRA 이슈 키 (예: W2UNIT-8120)
  요약: string;                   // 업무 제목 (정제된)
  담당자: string;                 // 담당자 ID
  담당자부: string[];             // 부담당자 ID 목록
  시작일: string;                 // WBSGantt 시작일
  완료일: string;                 // WBSGantt 완료일
  변경종료일: string;             // 변경된 종료일 (일정 연기 시)
  진행률: number;                 // 0~100
  일정변경사유: string;           // 일정 변경 사유
  is상시: boolean;                // 상시 업무 여부
  변경일: string;                 // 마지막 변경일
  생성일: string;                 // 생성일
  isSubtask: boolean;             // 부작업 여부
  하위업무: IDailyReportTask[];   // 하위 업무 목록
}

/**
 * 일일보고 서비스(프로젝트) 단위
 */
export interface IDailyReportService {
  서비스명: string;               // 예: [WE봇], [화상회의-모바일]
  업무: IDailyReportTask[];       // 해당 서비스의 업무 목록
}

/**
 * 일일보고 전체 구조
 */
export interface IDailyReport {
  조직명: string;
  날짜: string;                   // 예: "2026.01.13(화)"
  금일진행업무: IDailyReportService[];
  기타업무: IDailyReportTask[];
  특이사항: string;
}

/**
 * 검색 파라미터
 */
export interface ISearchParams {
  jiraIds: string[];              // JIRA 아이디 배열
  startDate: string;              // "YYYY-MM-DD"
  endDate: string;                // "YYYY-MM-DD"
}
