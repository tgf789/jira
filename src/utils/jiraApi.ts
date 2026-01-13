/**
 * JIRA REST API 연동 모듈
 * JIRA Server 7.9.0
 */

import { IIssueCSV } from "./interface";

// 개발 환경에서는 Vite 프록시를 통해 CORS 우회
const JIRA_BASE_URL = "/api/jira";

// JIRA 인증 정보 저장
let jiraAuth: { username: string; password: string } | null = null;

/**
 * JIRA 커스텀 필드 ID 매핑
 * JIRA 관리자 페이지에서 확인 가능: /secure/admin/ViewCustomFields.jspa
 */
const CUSTOM_FIELD_MAP = {
  // WBSGantt 관련
  "진행 상황(WBSGantt)": "customfield_12108",      // 숫자 (0~100)
  "완료일(WBSGantt)": "customfield_12105",         // 날짜 문자열
  "시작일(WBSGantt)": "customfield_12104",         // 날짜 문자열
  
  // 일정 관련
  "변경 종료일": "customfield_10958",              // 날짜 문자열
  "업데이트 예정일": "customfield_13901",          // 날짜 문자열
  "일정 변경 사유": "customfield_14419",           // 텍스트
  
  // 담당자 관련
  "담당자(부)": "customfield_10801",               // 사용자 객체 (추정, 확인 필요)
  
  // 기타
  "Epic Name": "customfield_10831",                // 옵션 객체
  "WEHAGO 서비스 구분": "customfield_13502",       // 옵션 객체
} as const;

export interface IJiraSearchResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: IJiraIssue[];
}

export interface IJiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
    priority: {
      name: string;
    };
    assignee: {
      name: string;
      displayName: string;
    } | null;
    reporter: {
      name: string;
      displayName: string;
    } | null;
    created: string;
    updated: string;
    labels: string[];
    description: string | null;
    issuelinks: IJiraIssueLink[];
    subtasks: IJiraSubtask[];
    issuetype: {
      name: string;
      subtask: boolean;
    };
    parent?: {
      key: string;
      fields: {
        summary: string;
      };
    };
    [key: string]: unknown; // 사용자정의 필드 등
  };
}

export interface IJiraIssueLink {
  id: string;
  type: {
    name: string;
    inward: string;
    outward: string;
  };
  inwardIssue?: {
    key: string;
    fields: {
      summary: string;
      status: {
        name: string;
      };
    };
  };
  outwardIssue?: {
    key: string;
    fields: {
      summary: string;
      status: {
        name: string;
      };
    };
  };
}

export interface IJiraSubtask {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
  };
}

/**
 * JIRA 인증 정보 설정
 */
export function setJiraAuth(username: string, password: string) {
  jiraAuth = { username, password };
}

/**
 * JIRA 인증 정보 초기화
 */
export function clearJiraAuth() {
  jiraAuth = null;
}

/**
 * JIRA 인증 여부 확인
 */
export function hasJiraAuth(): boolean {
  return jiraAuth !== null;
}

/**
 * Authorization 헤더 생성 (Basic Auth)
 */
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (jiraAuth) {
    const basicAuth = btoa(`${jiraAuth.username}:${jiraAuth.password}`);
    headers["Authorization"] = `Basic ${basicAuth}`;
  }

  return headers;
}

/**
 * JQL로 JIRA 이슈 검색
 */
export async function searchJiraIssues(
  jql: string,
  maxResults: number = 100,
  startAt: number = 0,
  fields?: string[]
): Promise<IJiraSearchResponse> {
  const params = new URLSearchParams({
    jql,
    maxResults: maxResults.toString(),
    startAt: startAt.toString(),
  });

  if (fields && fields.length > 0) {
    params.append("fields", fields.join(","));
  }

  const url = `${JIRA_BASE_URL}/rest/api/2/search?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`JIRA 이슈 검색 실패: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * 필터 ID로 JIRA 이슈 조회
 */
export async function getIssuesByFilterId(
  filterId: string,
  maxResults: number = 100
): Promise<IJiraSearchResponse> {
  const jql = `filter=${filterId}`;
  return searchJiraIssues(jql, maxResults);
}

/**
 * 필터 ID로 모든 JIRA 이슈 조회 (페이징 처리)
 */
export async function getAllIssuesByFilterId(
  filterId: string
): Promise<IJiraIssue[]> {
  const allIssues: IJiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;
  let total = 0;

  do {
    const response = await searchJiraIssues(`filter=${filterId}`, maxResults, startAt);
    allIssues.push(...response.issues);
    total = response.total;
    startAt += maxResults;
  } while (startAt < total);

  return allIssues;
}

/**
 * JIRA 날짜 문자열을 한국 형식으로 변환
 * "2026-01-13T15:34:02.000+0900" → "2026. 1. 13. 오후 3:34"
 */
function formatJiraDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours;
    
    return `${year}. ${month}. ${day}. ${ampm} ${displayHours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

/**
 * 커스텀 필드 값 추출 헬퍼
 */
function getCustomFieldValue(fields: IJiraIssue["fields"], fieldId: string): string {
  const value = fields[fieldId];
  
  if (value === null || value === undefined) {
    return "";
  }
  
  // 숫자인 경우
  if (typeof value === "number") {
    return value.toString();
  }
  
  // 문자열인 경우
  if (typeof value === "string") {
    return value;
  }
  
  // 객체인 경우 (옵션 필드 등)
  if (typeof value === "object") {
    // { value: "xxx" } 형태
    if ("value" in value && typeof (value as {value: string}).value === "string") {
      return (value as {value: string}).value;
    }
    // { name: "xxx" } 형태 (사용자 객체)
    if ("name" in value && typeof (value as {name: string}).name === "string") {
      return (value as {name: string}).name;
    }
    // { displayName: "xxx" } 형태
    if ("displayName" in value && typeof (value as {displayName: string}).displayName === "string") {
      return (value as {displayName: string}).displayName;
    }
  }
  
  return "";
}

/**
 * 단일 JIRA 이슈를 IIssueCSV 형태로 변환
 */
function convertJiraIssueToCSV(issue: IJiraIssue): IIssueCSV {
  const { fields } = issue;
  
  // Epic Name 추출 (옵션 객체)
  const epicNameField = fields[CUSTOM_FIELD_MAP["Epic Name"]];
  let epicName = "";
  if (epicNameField && typeof epicNameField === "object" && "value" in epicNameField) {
    epicName = (epicNameField as {value: string}).value || "";
  }
  
  // 진행률 추출
  const progress = getCustomFieldValue(fields, CUSTOM_FIELD_MAP["진행 상황(WBSGantt)"]);
  
  // 담당자(부) 추출 - 여러 명일 수 있음
  const subAssigneeResult: { [key: string]: string } = {};
  const subAssigneeField = fields[CUSTOM_FIELD_MAP["담당자(부)"]];
  if (subAssigneeField) {
    if (Array.isArray(subAssigneeField)) {
      subAssigneeField.forEach((user, index) => {
        const name = typeof user === "object" && user && "name" in user ? (user as {name: string}).name : "";
        if (index === 0) {
          subAssigneeResult["사용자정의 필드 (담당자(부))"] = name;
        } else {
          subAssigneeResult[`사용자정의 필드 (담당자(부)).${index + 1}`] = name;
        }
      });
    } else if (typeof subAssigneeField === "object" && subAssigneeField && "name" in subAssigneeField) {
      subAssigneeResult["사용자정의 필드 (담당자(부))"] = (subAssigneeField as {name: string}).name;
    }
  }

  return {
    "key": issue.key,
    "이슈 키": issue.key,
    "요약": fields.summary || "",
    "상태": fields.status?.name || "",
    "우선순위": (fields.priority?.name || "Medium") as IIssueCSV["우선순위"],
    "담당자": fields.assignee?.name || "",
    "보고자": fields.reporter?.name || "",
    "설명": fields.description || "",
    "생성일": formatJiraDate(fields.created),
    "변경일": formatJiraDate(fields.updated),
    "레이블": (fields.labels || []).join(","),
    
    // 커스텀 필드
    "사용자정의 필드 (Epic Name)": epicName,
    "사용자정의 필드 (진행 상황(WBSGantt))": progress,
    "사용자정의 필드 (완료일(WBSGantt))": getCustomFieldValue(fields, CUSTOM_FIELD_MAP["완료일(WBSGantt)"]),
    "사용자정의 필드 (시작일(WBSGantt))": getCustomFieldValue(fields, CUSTOM_FIELD_MAP["시작일(WBSGantt)"]),
    "사용자정의 필드 (변경 종료일)": getCustomFieldValue(fields, CUSTOM_FIELD_MAP["변경 종료일"]),
    "사용자정의 필드 (업데이트 예정일)": getCustomFieldValue(fields, CUSTOM_FIELD_MAP["업데이트 예정일"]),
    "사용자정의 필드 (일정 변경 사유)": getCustomFieldValue(fields, CUSTOM_FIELD_MAP["일정 변경 사유"]),
    "사용자정의 필드 (담당자(부))": subAssigneeResult["사용자정의 필드 (담당자(부))"] || "",
    "사용자정의 필드 (WEHAGO 서비스 구분)": getCustomFieldValue(fields, CUSTOM_FIELD_MAP["WEHAGO 서비스 구분"]),
    
    // children은 나중에 트리 구조 빌드 시 채워짐
    "children": [],
    
    // 추가 담당자(부) 필드
    ...subAssigneeResult,
  } as IIssueCSV;
}

/**
 * JIRA 이슈 목록을 트리 구조로 변환 (issuelinks 기반)
 * 기존 buildTreeFromCsv와 동일한 결과물 생성
 */
export function convertJiraIssuesToTree(issues: IJiraIssue[]): IIssueCSV[] {
  // 1. 모든 이슈를 IIssueCSV로 변환하고 맵에 저장
  const issueMap = new Map<string, IIssueCSV>();
  
  issues.forEach(issue => {
    const csvIssue = convertJiraIssueToCSV(issue);
    issueMap.set(issue.key, csvIssue);
  });

  // 2. issuelinks를 분석하여 부모-자식 관계 설정
  // "포함" 링크 타입: outward = "포함", inward = "포함됨"
  const childToParentMap = new Map<string, string>();
  
  issues.forEach(issue => {
    const { issuelinks } = issue.fields;
    
    if (!issuelinks) return;
    
    issuelinks.forEach(link => {
      // "포함" 타입의 링크 찾기
      if (link.type.outward === "포함" || link.type.name === "포함") {
        // 현재 이슈가 부모이고, outwardIssue가 자식
        if (link.outwardIssue) {
          childToParentMap.set(link.outwardIssue.key, issue.key);
        }
      }
      
      if (link.type.inward === "포함됨" || link.type.inward === "is contained by") {
        // 현재 이슈가 자식이고, inwardIssue가 부모
        if (link.inwardIssue) {
          childToParentMap.set(issue.key, link.inwardIssue.key);
        }
      }
    });
  });

  // 3. 자식 이슈들을 부모에 연결
  childToParentMap.forEach((parentKey, childKey) => {
    const parent = issueMap.get(parentKey);
    const child = issueMap.get(childKey);
    
    if (parent && child) {
      parent.children.push(child);
    }
  });

  // 4. 루트 노드 찾기 (부모가 없는 이슈들)
  const rootIssues: IIssueCSV[] = [];
  
  issueMap.forEach((issue, key) => {
    if (!childToParentMap.has(key)) {
      rootIssues.push(issue);
    }
  });

  // 5. 진행률 순으로 정렬 (재귀적으로)
  const sortByProgress = (issues: IIssueCSV[]): IIssueCSV[] => {
    return issues
      .sort((a, b) => {
        const aProgress = Number(a["사용자정의 필드 (진행 상황(WBSGantt))"] || 0);
        const bProgress = Number(b["사용자정의 필드 (진행 상황(WBSGantt))"] || 0);
        return bProgress - aProgress;
      })
      .map(issue => ({
        ...issue,
        children: sortByProgress(issue.children),
      }));
  };

  return sortByProgress(rootIssues);
}

/**
 * 필터 ID로 조회 후 IIssueCSV 트리 구조로 반환
 * 기존 buildTreeFromCsv의 결과물과 동일한 형태
 */
export async function getIssueTreeByFilterId(filterId: string): Promise<IIssueCSV[]> {
  const issues = await getAllIssuesByFilterId(filterId);
  console.log(`총 ${issues.length}개 이슈 조회됨`);
  
  const tree = convertJiraIssuesToTree(issues);
  console.log("변환된 트리 구조:", tree);
  
  return tree;
}

/**
 * 디버깅용: JIRA 필드 ID 확인
 * 콘솔에서 어떤 커스텀 필드가 어떤 값을 가지는지 확인
 */
export function debugJiraFields(issue: IJiraIssue): void {
  console.log("=== JIRA 필드 디버깅 ===");
  console.log("이슈 키:", issue.key);
  console.log("요약:", issue.fields.summary);
  
  // 커스텀 필드만 추출
  const customFields: { [key: string]: unknown } = {};
  Object.entries(issue.fields).forEach(([key, value]) => {
    if (key.startsWith("customfield_") && value !== null) {
      customFields[key] = value;
    }
  });
  
  console.log("값이 있는 커스텀 필드:", customFields);
}
