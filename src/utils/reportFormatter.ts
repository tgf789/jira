import type { IIssueCSV, IDailyReport, IDailyReportService, IDailyReportTask } from "./interface";
  
/**
 * 요약 텍스트 정제
 */
function cleanSummary(summary: string): string {
  return summary
    .trim()
    .replace(/\[.*] /, "")    // [XXX] 제거
    .replace(/^.*\- /, "")    // "XXX - " 제거
    .replace(/^.*> /, "")     // "XXX > " 제거
    .replace(/\"|'/g, "");    // 따옴표 제거
}

function isValidTask(task: IDailyReportTask): boolean {
  // 상시 업무면서 하위 업무가 없으면 제외 (노이즈 방지)
  if (task.is상시 && task.하위업무.length === 0) return false;
  
  // 진행률 0%라도 사용자가 직접 조회한 업무거나 부작업일 수 있으므로 그대로 둡니다.
  // (필요 시 추후에만 다시 추가)
  return true;
}

/**
 * IIssueCSV -> IDailyReportTask 변환
 */
export function convertToTask(csv: IIssueCSV): IDailyReportTask {
  const progress = Number(csv["사용자정의 필드 (진행 상황(WBSGantt))"] || 0);
  const is상시 = (csv["레이블"] || "").indexOf("상시") > -1;

  // 부 담당자 수집
  const subManagers: string[] = [];
  if (csv["사용자정의 필드 (담당자(부))"]) {
    subManagers.push(csv["사용자정의 필드 (담당자(부))"]);
    let i = 2;
    while (csv[`사용자정의 필드 (담당자(부)).${i}`]) {
      subManagers.push(csv[`사용자정의 필드 (담당자(부)).${i}`]);
      i++;
    }
  }

  return {
    key: csv.key,
    요약: cleanSummary(csv.요약 || ""),
    담당자: csv["담당자"] || "",
    담당자부: subManagers,
    시작일: csv["사용자정의 필드 (시작일(WBSGantt))"] || "",
    완료일: csv["사용자정의 필드 (완료일(WBSGantt))"] || "",
    변경종료일: csv["사용자정의 필드 (변경 종료일)"] || "",
    진행률: progress,
    일정변경사유: csv["사용자정의 필드 (일정 변경 사유)"] || "",
    is상시,
    변경일: csv["변경일"] || "",
    생성일: csv["생성일"] || "",
    isSubtask: !!csv.issuetype?.subtask,
    하위업무: (csv.children || [])
      .map(child => convertToTask(child))
      .filter(task => isValidTask(task)),
  };
}

/**
 * 업무를 시작일 순으로 정렬 (오름차순)
 */
function sortTasksByDate(tasks: IDailyReportTask[]): IDailyReportTask[] {
  const parse = (s: string) => {
    if (!s) return new Date(8640000000000000); 
    const normalized = s.replace(/\. /g, '-').replace(/\.$/, '');
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? new Date(8640000000000000) : date;
  };

  return [...tasks].sort((a, b) => {
    return parse(a.시작일).getTime() - parse(b.시작일).getTime();
  }).map(t => ({
    ...t,
    하위업무: sortTasksByDate(t.하위업무)
  }));
}

/**
 * IIssueCSV 트리를 IDailyReport 구조로 변환 (브라켓 기반 그룹화)
 */
export function convertToReportStructure(
  csvList: IIssueCSV[],
  orgName: string = ""
): IDailyReport {
  const serviceMap = new Map<string, IDailyReportService>();
  const 기타업무Raw: IDailyReportTask[] = [];

  csvList.forEach((csv) => {
    const summary = csv.요약 || "";
    const bracketMatch = summary.match(/^\[(.*?)\]\s*(.*)$/);
    
    let serviceName = "";
    let cleanTitle = summary;

    if (bracketMatch) {
      serviceName = bracketMatch[1];
      cleanTitle = bracketMatch[2].trim();
    }

    const task = convertToTask({ ...csv, 요약: cleanTitle });

    if (serviceName && serviceName !== "기타") {
      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, { 서비스명: serviceName, 업무: [] });
      }
      serviceMap.get(serviceName)!.업무.push(task);
    } else {
      기타업무Raw.push(task);
    }
  });

  // 정렬 적용 (시작일 순)
  const 금일진행업무 = Array.from(serviceMap.values()).map(s => ({
    ...s,
    업무: sortTasksByDate(s.업무)
  }));
  const 기타업무 = sortTasksByDate(기타업무Raw);

  return {
    조직명: orgName,
    날짜: "", 
    금일진행업무,
    기타업무,
    특이사항: "없습니다.",
  };
}

/**
 * 날짜를 MM/DD 형식으로 변환
 */
function formatDateMD(dateStr: string): string {
  if (!dateStr) return "";
  const normalized = dateStr.replace(/\. /g, '-').replace(/\.$/, '');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return dateStr;
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${m}/${d}`;
}

/**
 * 텍스트 포매팅 (사용자 요청 포맷 적용)
 */
export function formatDailyReport(
  report: IDailyReport,
  idList: { [key: string]: string } = {},
  isUpdateWarn: boolean = false,
  showJiraKey: boolean = false,
  includeJiraLink: boolean = false
): string {
  let result = "";

  // 금일진행업무 (서비스별)
  report.금일진행업무.forEach(service => {
    result += `[${service.서비스명}]\n`;
    result += formatTaskList(service.업무, 1, idList, isUpdateWarn, showJiraKey, includeJiraLink);
    result += "\n";
  });

  // 기타업무
  if (report.기타업무.length > 0) {
    result += "[기타]\n";
    result += formatTaskList(report.기타업무, 1, idList, isUpdateWarn, showJiraKey, includeJiraLink);
  }

  return result.trim();
}

/**
 * 업무 목록을 텍스트로 포매팅 (재귀)
 */
function formatTaskList(
  tasks: IDailyReportTask[],
  depth: number,
  idList: { [key: string]: string },
  isUpdateWarn: boolean,
  showJiraKey: boolean,
  includeJiraLink: boolean
): string {
  let result = "";
  tasks.forEach((task, index) => {
    // 담당자 이름 매핑
    const mainM = idList[task.담당자] || task.담당자;
    const subM = task.담당자부
      .map(id => idList[id] || id)
      .filter(Boolean)
      .map(name => `/${name}`)
      .join("");

    // 날짜 포맷팅
    const startMD = formatDateMD(task.시작일 || "");
    const endMD = formatDateMD(task.완료일 || "");
    const newEndMD = task.변경종료일 ? formatDateMD(task.변경종료일) : "";

    let rangeStr = "";
    if (startMD && endMD) {
      if (newEndMD) {
        rangeStr = `${startMD} ~ ${newEndMD} -> ${endMD}`;
      } else {
        rangeStr = `${startMD} ~ ${endMD}`;
      }
    } else if (endMD) {
      rangeStr = `~${endMD}`;
    }

    // 정보 괄호 내용 구성: (담당자, 진행률%, 날짜범위)
    const infoPart = [
      `${mainM}${subM}`,
      `${task.진행률}%`,
      rangeStr
    ].filter(Boolean).join(", ");

    // 미완료 경고 체크
    let warningEmoji = "";
    if (isUpdateWarn && task.진행률 < 100) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDateStr = task.완료일;
      if (targetDateStr) {
        const normalized = targetDateStr.replace(/\. /g, '-').replace(/\.$/, '');
        const targetDate = new Date(normalized);
        targetDate.setHours(0, 0, 0, 0);
        if (!isNaN(targetDate.getTime()) && targetDate <= today) {
          warningEmoji = "🔴 ";
        }
      }
    }

    // 키 표시 여부
    const keyPrefix = showJiraKey ? `${task.key} ` : "";

    // 라인 생성 및 인덴트
    if (depth === 1) {
      result += `${index + 1}) ${warningEmoji}${keyPrefix}${task.요약} (${infoPart})\n`;
    } else {
      result += ` ㄴ ${warningEmoji}${keyPrefix}${task.요약} (${infoPart})\n`;
    }

    // JIRA 링크 추가 (설정된 경우 모든 업무에 적용)
    if (includeJiraLink) {
      result += `  - http://jira.duzon.com:8080/browse/${task.key}\n`;
    }

    // 일정 변경 사유 (두 칸 들여쓰기)
    if (task.변경종료일 && task.일정변경사유) {
      const reason = task.일정변경사유.split(':').pop()?.trim().replace(/\"/g, "") || "";
      if (reason) {
        result += `  -> 변경 사유 : ${reason}\n`;
      }
    }

    // 하위 업무 (재귀)
    if (task.하위업무 && task.하위업무.length > 0) {
      result += formatTaskList(task.하위업무, depth + 1, idList, isUpdateWarn, showJiraKey, includeJiraLink);
    }
  });

  return result;
}
