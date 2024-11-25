import {IIssueCSV} from "./interface"
 

export function convertUpmu (csvList : IIssueCSV[],depth=0,isRoot=true,idList:{[v:string]:string} = {}):string {
  return csvList.map((csv,i) => {
    let text = ""
    if(isRoot){
      text = `  ${csv["요약"]}\n`
    }else{
      console.log({depth})
      let depthSpace = "  "+("  ".repeat(depth))
      let depthNumberStr = depth === 1 ? (i+1)+". " : (i+1)+") "
      let subManager =""
      let progress = csv["사용자정의 필드 (진행 상황(WBSGantt))"] ? Number(csv["사용자정의 필드 (진행 상황(WBSGantt))"] || 0) : 0;
      const progressStr = (progress)+"%"
      if(csv["사용자정의 필드 (담당자(부))"]){
        subManager+=`/${idList[csv[`사용자정의 필드 (담당자(부))`]]}`;
        let subManagerIndex = 2
        while(csv[`사용자정의 필드 (담당자(부)).${subManagerIndex}`]){
          subManager+=`/${idList[csv[`사용자정의 필드 (담당자(부)).${subManagerIndex}`]]}`;
          subManagerIndex++
        }
      }
      let dateStr = "" 
      let remark = ""
      if(csv["사용자정의 필드 (변경 종료일)"]){
        const tempStr = csv["사용자정의 필드 (변경 종료일)"].replace(" 오전", " AM").replace(" 오후", " PM");
        const date = new Date(tempStr);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        dateStr += `${month}/${day}→`;
        if(csv["사용자정의 필드 (일정 변경 사유)"]){
          remark = `- ${csv["사용자정의 필드 (일정 변경 사유)"]}`
        }
      }
      if(csv["사용자정의 필드 (완료일(WBSGantt))"]){
        const tempStr = csv["사용자정의 필드 (완료일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
        const date = new Date(tempStr);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        dateStr += `${month}/${day}`;

      }
      
      text = `${depthSpace}${depthNumberStr}${csv["요약"]} (${csv["children"]?.length === 0 ? idList[csv["담당자"]]+subManager+", " : ""}~${dateStr}, ${progressStr})\n`
      if(remark){
        text += `${depthSpace}  ${remark}\n`
      }

    }

    if(csv["children"]?.length > 0){
      const childText = convertUpmu(csv["children"],depth+1,false,idList)
      text += childText
    }

    return text
  }).join("")
}

export function csvToJson(csvString:string): object[] {
  // Step 1: Split the CSV into rows
  const rows = csvString.trim().split("\n");

  // Step 2: Split the header row and check for duplicate columns
  const headers = rows[0].split(",");
  const headerMap: { [key: string]: number } = {}; // Track column indices
  const uniqueHeaders = headers.map((header) => {
      const trimmedHeader = header.trim();
      if (headerMap[trimmedHeader]) {
          headerMap[trimmedHeader]++;
          return `${trimmedHeader}.${headerMap[trimmedHeader]}`; // Make header unique
      } else {
          headerMap[trimmedHeader] = 1;
          return trimmedHeader;
      }
  });

  // Step 3: Convert rows into JSON
  const data = rows.slice(1).map(row => {
      const values = row.split(",");
      return uniqueHeaders.reduce((obj: { [key: string]: string }, header, index) => {
          obj[header] = values[index]?.trim() || ""; // Assign trimmed value or empty string
          return obj;
      }, {});
  });

  return data;
}



export function buildTreeFromCsv(csvString: string) {
  // Step 2: Convert CSV to JSON
  const jsonData = csvToJson(csvString);
  // console.log({jsonData})
  // Step 3: Dynamically identify columns for children
  const childColumns = Object.keys(jsonData[0]).filter(
      key => key.startsWith("나가는 방향 이슈 연결 (포함")
  );
  // console.log({childColumns})

  // Step 4: Parse relevant columns
  const issues = jsonData.map((row) => ({
      key: row["이슈 키" as keyof typeof row],
      ...row,
      children: childColumns
          .map(column => row[column as keyof typeof row])
          .filter(child => child) // Remove empty values
  }));


  // console.log("Parsed Issues:", issues); // Check if children are properly parsed


  // Step 5: Create a map of parent to children
  const treeMap: { [key: string]: string[] } = {};
  issues.forEach(issue => {
      if (!treeMap[issue.key]) {
          treeMap[issue.key] = [];
      }
      treeMap[issue.key].push(...issue.children);
  });
  // console.log("Tree Map:", treeMap); // Check treeMap structure
  // Step 6: Find root nodes
  const allNodes = new Set(Object.keys(treeMap));
  const allChildren : any = new Set(issues.flatMap(issue => issue.children));
  const rootNodes = Array.from(allNodes).filter(node => !allChildren.has(node));

  // console.log("Root Nodes:", rootNodes); // Check root nodes

  // Step 7: Recursive function to build tree
  function buildNode(key: string): { key: string; children: any[] } {
    const data = issues.find(issue => issue.key === key);
      return {
          key: key,
          ...data,
          children: (treeMap[key] || []).map(buildNode)
      };
  }

  // console.log({rootNodes})
  // Step 8: Build tree structure
  return rootNodes.map(buildNode);
}
