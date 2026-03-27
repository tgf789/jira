import type { IIssueCSV } from "./interface";

/**
 * JIRA 이슈 목록(CSV 형태)을 트리 구조로 변환 (issuelinks 기반)
 */
export function buildIssueTree(issues: IIssueCSV[]): IIssueCSV[] {
  const issueMap = new Map<string, IIssueCSV>();
  issues.forEach(issue => issueMap.set(issue.key, issue));

  // 자식 -> 부모 매핑 수집 (issuelinks 기반)
  const childToParentMap = new Map<string, string>();
  
  // IIssueCSV 자체는 issuelinks 정보를 직접 가지고 있지 않으므로, 
  // 원본 IJiraIssue에서 관계를 추출하거나 빌딩 시점에 관계를 주입해야 함.
  // 여기서는 jiraApi.ts에서 이미 resolveParentChain을 통해 부모-자식 관계가 
  // issuelinks(inward: "포함됨")에 명시되어 있다고 가정함.
  // 하지만 IIssueCSV에는 issuelinks가 없음. 
  // -> 해결: jiraApi.ts의 convertJiraIssueToCSV 실행 시점에 관계 정보를 임시 보관하거나,
  //    여기서 IJiraIssue[]를 인자로 받아 직접 처리하는 것이 정확함.
  
  // [수정] treeBuilder는 IJiraIssue[]를 인자로 받아 내부에서 변환과 연결을 동시에 처리하도록 변경.
  return []; // 아래 로직으로 대체
}

import type { IJiraIssue } from "./jiraApi";
import { convertJiraIssueToCSV } from "./jiraApi";

export function buildTreeFromIssues(issues: IJiraIssue[]): IIssueCSV[] {
  const issueMap = new Map<string, IIssueCSV>();
  const childToParentMap = new Map<string, string>();

  // 1. 모든 이슈 변환 및 매핑 저장
  issues.forEach(issue => {
    const csv = convertJiraIssueToCSV(issue);
    issueMap.set(issue.key, csv);
  });

  // 2. issuelinks 분석하여 관계 설정
  issues.forEach(issue => {
    const links = issue.fields.issuelinks || [];
    links.forEach(link => {
      // "포함됨" (inward) -> 현재 이슈가 자식, inwardIssue가 부모
      if ((link.type.inward === "포함됨" || link.type.inward === "is contained by") && link.inwardIssue) {
        childToParentMap.set(issue.key, link.inwardIssue.key);
      }
      // "포함" (outward) -> 현재 이슈가 부모, outwardIssue가 자식
      if ((link.type.outward === "포함" || link.type.name === "포함") && link.outwardIssue) {
        childToParentMap.set(link.outwardIssue.key, issue.key);
      }
    });
  });

  // 3. 자식을 부모에 연결
  childToParentMap.forEach((parentKey, childKey) => {
    const parent = issueMap.get(parentKey);
    const child = issueMap.get(childKey);
    if (parent && child) {
      if (!parent.children.find(c => c.key === childKey)) {
        parent.children.push(child);
      }
    }
  });

  // 4. 루트 노드 찾기 (부모가 없는 이슈들)
  const rootIssues: IIssueCSV[] = [];
  issueMap.forEach((issue, key) => {
    if (!childToParentMap.has(key)) {
      rootIssues.push(issue);
    }
  });

  // 시작일 순 정렬 (오름차순, 재귀)
  const sortByDate = (list: IIssueCSV[]): IIssueCSV[] => {
    return list
      .sort((a, b) => {
        const dateA = a["사용자정의 필드 (시작일(WBSGantt))"] || "9999. 12. 31.";
        const dateB = b["사용자정의 필드 (시작일(WBSGantt))"] || "9999. 12. 31.";
        
        // 날짜 파싱 (2026. 3. 27. -> Date)
        const parse = (s: string) => {
          const parts = s.replace(/\s/g, '').split('.').filter(Boolean);
          if (parts.length < 3) return new Date(8640000000000000); // Max date
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        };

        return parse(dateA).getTime() - parse(dateB).getTime();
      })
      .map(item => ({
        ...item,
        children: sortByDate(item.children),
      }));
  };

  return sortByDate(rootIssues);
}
