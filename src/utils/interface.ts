export interface IIssueCSV {
  "key" : string;
  "담당자" : string; 
  "보고자" : string;
  "사용자정의 필드 (담당자(부))" : string;
  "사용자정의 필드 (변경 종료일)" : string;
  "사용자정의 필드 (업데이트 예정일)" : string;
  "사용자정의 필드 (완료일(WBSGantt))" : string;
  "사용자정의 필드 (시작일(WBSGantt))" : string;
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

// export interface IWeeklyUpmu {
//   주요내용: string;
//   출시목표: string;
//   우선순위: string;
//   상태: string;
//   실적: string;
//   담당자: string;
// }