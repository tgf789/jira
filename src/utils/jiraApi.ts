/**
 * JIRA REST API 연동 모듈 (고도화 버전)
 * JIRA Server 7.9.0
 */

/**
 * JIRA REST API 연동 모듈 (고도화 버전)
 * JIRA Server 7.9.0
 */
import type { IIssueCSV, ISearchParams } from "./interface";

const JIRA_BASE_URL = window.navigator.userAgent.toLowerCase().includes('electron')
  ? "http://jira.duzon.com:8080"
  : "/api/jira";

// JIRA 인증 정보 저장 (세션 내 유지)
let jiraAuth: { username: string; password: string } | null = null;

export const CUSTOM_FIELD_MAP = {
  "진행 상황(WBSGantt)": "customfield_12108",
  "완료일(WBSGantt)": "customfield_12105",
  "시작일(WBSGantt)": "customfield_12104",
  "변경 종료일": "customfield_10958",
  "업데이트 예정일": "customfield_13901",
  "일정 변경 사유": "customfield_14419",
  "담당자(부)": "customfield_19400",
  "Epic Name": "customfield_10831",
  "WEHAGO 서비스 구분": "customfield_13502",
  "시작일": "customfield_10832",
  "종료일": "customfield_10833",
} as const;

export interface IJiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    priority: { name: string };
    assignee: { name: string; displayName: string } | null;
    reporter: { name: string; displayName: string } | null;
    created: string;
    updated: string;
    labels: string[];
    description: string | null;
    issuelinks: IJiraIssueLink[];
    issuetype: { name: string; subtask: boolean };
    parent?: { id: string; key: string; fields: { summary: string } };
    timetracking?: {
      originalEstimateSeconds?: number;
      timeSpentSeconds?: number;
      remainingEstimateSeconds?: number;
    };
    aggregateprogress?: { progress: number; total: number; percent?: number };
    timeoriginalestimate?: number | null;
    timespent?: number | null;
    aggregatetimeoriginalestimate?: number | null;
    aggregatetimespent?: number | null;
    [key: string]: any;
  };
}

export interface IJiraIssueLink {
  id: string;
  type: { name: string; inward: string; outward: string };
  inwardIssue?: { key: string; fields: { summary: string; status: { name: string } } };
  outwardIssue?: { key: string; fields: { summary: string; status: { name: string } } };
}

export interface IJiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: IJiraIssue[];
}

export function setJiraAuth(username: string, password: string) {
  jiraAuth = { username, password };
}

export function hasJiraAuth(): boolean {
  return jiraAuth !== null;
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
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
  startAt: number = 0
): Promise<IJiraSearchResponse> {
  const params = new URLSearchParams({
    jql,
    maxResults: maxResults.toString(),
    startAt: startAt.toString(),
  });

  const url = `${JIRA_BASE_URL}/rest/api/2/search?${params.toString()}`;
  const response = await fetch(url, { method: "GET", headers: getAuthHeaders() });

  if (!response.ok) {
    throw new Error(`JIRA 검색 실패: ${response.status}`);
  }
  return response.json();
}

/**
 * 모든 페이지를 순회하며 전체 이슈 조회
 */
export async function getAllIssuesByJql(jql: string): Promise<IJiraIssue[]> {
  const allIssues: IJiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;
  let total = 0;

  do {
    const response = await searchJiraIssues(jql, maxResults, startAt);
    allIssues.push(...response.issues);
    total = response.total;
    startAt += maxResults;
  } while (startAt < total);

  return allIssues;
}

/**
 * 아이디 리스트와 날짜 범위로 이슈 검색
 * (시작일 <= 검색종료일 AND 완료일 >= 검색시작일) -> 기간 중첩 로직
 */
export async function searchByIdsAndDateRange(params: ISearchParams): Promise<IJiraIssue[]> {
  if (params.jiraIds.length === 0) return [];

  const idListStr = params.jiraIds.map(id => `"${id}"`).join(",");
  const jql = `assignee in (${idListStr}) AND (cf[12104] <= "${params.endDate}" OR cf[10832] <= "${params.endDate}") AND (cf[12105] >= "${params.startDate}" OR cf[10833] >= "${params.startDate}")`;
  
  console.log("JQL Search:", jql);
  return getAllIssuesByJql(jql);
}

/**
 * 상위 이슈 체인 자동 해결 (재귀적 조회)
 */
export async function resolveParentChain(issues: IJiraIssue[], maxDepth: number = 10): Promise<IJiraIssue[]> {
  const allIssuesMap = new Map<string, IJiraIssue>();
  issues.forEach(issue => allIssuesMap.set(issue.key, issue));

  let currentIssues = [...issues];
  let depth = 0;

  while (depth < maxDepth) {
    const parentKeysToFetch = new Set<string>();

    currentIssues.forEach(issue => {
      const links = issue.fields.issuelinks || [];
      links.forEach(link => {
        // "포함됨" (inward) 방향이 부모
        if ((link.type.inward === "포함됨" || link.type.inward === "is contained by") && link.inwardIssue) {
          const parentKey = link.inwardIssue.key;
          if (!allIssuesMap.has(parentKey)) {
            parentKeysToFetch.add(parentKey);
          }
        }
      });
      // 2. parent 필드 기반 부모 검색 (Sub-task 대응)
      if (issue.fields.parent && issue.fields.parent.key) {
        const parentKey = issue.fields.parent.key;
        if (!allIssuesMap.has(parentKey)) {
          parentKeysToFetch.add(parentKey);
        }
      }
    });

    if (parentKeysToFetch.size === 0) break;

    console.log(`Resolving parents (Depth ${depth + 1}):`, Array.from(parentKeysToFetch));
    
    // 부모 키들로 벌크 조회
    const keysArray = Array.from(parentKeysToFetch);
    const jql = `key in (${keysArray.join(",")})`;
    const nextParents = await getAllIssuesByJql(jql);

    if (nextParents.length === 0) break;

    nextParents.forEach(p => allIssuesMap.set(p.key, p));
    currentIssues = nextParents; // 다음 루프에서는 새로 가져온 부모들의 부모를 찾음
    depth++;
  }

  return Array.from(allIssuesMap.values());
}

/**
 * JIRA 인증 확인
 */
export async function checkAuth(): Promise<boolean> {
  try {
    const url = `${JIRA_BASE_URL}/rest/api/2/myself`;
    const response = await fetch(url, { method: "GET", headers: getAuthHeaders() });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * JIRA 날짜 문자열 변환
 */
function formatJiraDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
  } catch {
    return dateStr;
  }
}

/**
 * IJiraIssue -> IIssueCSV 변환
 */
export function convertJiraIssueToCSV(issue: IJiraIssue): IIssueCSV {
  const { fields } = issue;
  
  const getVal = (id: string) => {
    const v = fields[id];
    if (v === null || v === undefined) return "";
    if (typeof v === "object" && "value" in v) return v.value;
    if (typeof v === "object" && "name" in v) return v.name;
    return String(v);
  };

  const csv: any = {
    "key": issue.key,
    "이슈 키": issue.key,
    "요약": fields.summary || "",
    "상태": fields.status?.name || "",
    "우선순위": fields.priority?.name || "Medium",
    "담당자": fields.assignee?.displayName || fields.assignee?.name || "",
    "보고자": fields.reporter?.displayName || fields.reporter?.name || "",
    "설명": fields.description || "",
    "생성일": formatJiraDate(fields.created),
    "변경일": formatJiraDate(fields.updated),
    "레이블": (fields.labels || []).join(","),
    "사용자정의 필드 (Epic Name)": getVal(CUSTOM_FIELD_MAP["Epic Name"]),
    "사용자정의 필드 (진행 상황(WBSGantt))": getVal(CUSTOM_FIELD_MAP["진행 상황(WBSGantt)"]),
    "사용자정의 필드 (완료일(WBSGantt))": getVal(CUSTOM_FIELD_MAP["완료일(WBSGantt)"]),
    "사용자정의 필드 (시작일(WBSGantt))": getVal(CUSTOM_FIELD_MAP["시작일(WBSGantt)"]),
    "사용자정의 필드 (변경 종료일)": getVal(CUSTOM_FIELD_MAP["변경 종료일"]),
    "사용자정의 필드 (업데이트 예정일)": getVal(CUSTOM_FIELD_MAP["업데이트 예정일"]),
    "사용자정의 필드 (일정 변경 사유)": getVal(CUSTOM_FIELD_MAP["일정 변경 사유"]),
    "사용자정의 필드 (담당자(부))": "",
    "사용자정의 필드 (WEHAGO 서비스 구분)": getVal(CUSTOM_FIELD_MAP["WEHAGO 서비스 구분"]),
    "시작일": getVal(CUSTOM_FIELD_MAP["시작일"]),
    "종료일": getVal(CUSTOM_FIELD_MAP["종료일"]),
    "issuetype": fields.issuetype,
    "parent": fields.parent,
    "timetracking": fields.timetracking,
    "aggregateprogress": fields.aggregateprogress,
    "timeoriginalestimate": fields.timeoriginalestimate,
    "timespent": fields.timespent,
    "aggregatetimeoriginalestimate": fields.aggregatetimeoriginalestimate,
    "aggregatetimespent": fields.aggregatetimespent,
    "children": [],
  };

  // 시작일/종료일 (WBSGantt) 값이 없는 경우 "시작일", "종료일" 본 필드 값으로 대체
  if (!csv["사용자정의 필드 (시작일(WBSGantt))"]) {
    csv["사용자정의 필드 (시작일(WBSGantt))"] = csv["시작일"];
  }
  if (!csv["사용자정의 필드 (완료일(WBSGantt))"]) {
    csv["사용자정의 필드 (완료일(WBSGantt))"] = csv["종료일"];
  }

  // 부담당자 처리 (배열, 단일 객체, 또는 단순 문자열 대응)
  const subAssignee = fields[CUSTOM_FIELD_MAP["담당자(부)"]];
  const extractName = (user: any): string => {
    if (!user) return "";
    if (typeof user === "string") return user;
    return user.displayName || user.name || "";
  };

  if (Array.isArray(subAssignee)) {
    subAssignee.forEach((user, i) => {
      const name = extractName(user);
      if (name) {
        if (i === 0) csv["사용자정의 필드 (담당자(부))"] = name;
        else csv[`사용자정의 필드 (담당자(부)).${i + 1}`] = name;
      }
    });
  } else if (subAssignee) {
    csv["사용자정의 필드 (담당자(부))"] = extractName(subAssignee);
  }

  return csv as IIssueCSV;
}
