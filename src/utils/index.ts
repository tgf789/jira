import {IIssueCSV, IProject, IWeeklyUpmuItem} from "./interface"

// const nowDate = new Date();

export function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
}

export function getCookie(name: string) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  console.log({parts:[...parts]})
  if (parts.length === 2) return parts.pop()?.split(';').shift()
}

export function convertWeekly (csvList : IIssueCSV[],idList:{[v:string]:string} = {}) {
  let projectArray : IProject[] = []
  csvList.forEach((csv) => {
    if(!csv["요약"]) return 
    if(!csv["사용자정의 필드 (Epic Name)"]) return
    if(csv["요약"] === "[기타]") return 
    if(csv["children"].length === 0) return

    const projectName = csv["요약"]

    let upperUpmuList : IWeeklyUpmuItem[] = []
    let managerList : string[] = []

    
    let rank = {
      "Highest" : "상",
      "High" : "상",
      "Medium" : "중",
      "Low" : "하",
      "Lowest" : "하",
    }
    const 우선순위 = rank[csv["우선순위"]] || "중"


    csv["children"].forEach((v) => {
      if(!v["요약"]) return
      console.log({v})
      let 주요내용 = v["요약"].trim().replace(/\[.*] /,"").replace(/^.*\- /,"").replace(/^.*> /,"").replace(/\"/g,"")
      const is상시 = v["레이블"].indexOf("상시") > -1
      let 하위업무 : IWeeklyUpmuItem[] = []

      let progress = v["사용자정의 필드 (진행 상황(WBSGantt))"] ? Number(v["사용자정의 필드 (진행 상황(WBSGantt))"] || 0) : 0;
      const 실적 = (progress)+"%"

      const 상태 = progress === 0 ? "예정" : (progress === 100 ? "완료" : "개발")


      const tempStr = v["사용자정의 필드 (업데이트 예정일)"].replace(" 오전", " AM").replace(" 오후", " PM");
      const date = tempStr ? new Date(tempStr) : "";
      const 출시목표 = date ? `${date.getFullYear()}년 ${(date.getMonth() + 1).toString().padStart(2, '0')}월 ${date.getDate().toString().padStart(2, '0')}일` : "미정"

      if(!is상시){
        if(v["사용자정의 필드 (완료일(WBSGantt))"]){
          const tempStr = v["사용자정의 필드 (완료일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
          const date = new Date(tempStr);
          const month = (date.getMonth() + 1).toString()
          const day = date.getDate().toString()
          주요내용 += `(~${month}/${day})`;
        }
      }

      v["children"].forEach((v2) => {
        if(!v2["요약"]) return
        let upmuText2 = v2["요약"].trim().replace(/\[.*] /,"").replace(/^.*\- /,"").replace(/^.*> /,"").replace(/\"/g,"")
        let progress2 = v2["사용자정의 필드 (진행 상황(WBSGantt))"] ? Number(v2["사용자정의 필드 (진행 상황(WBSGantt))"] || 0) : 0;
        const progressStr2 = (progress2)+"%"
        const status = progress2 === 0 ? "예정" : (progress2 === 100 ? "완료" : "개발")

        managerList.push(idList[v2["담당자"]])
        if(csv["사용자정의 필드 (담당자(부))"]){
          managerList.push(idList[v2[`사용자정의 필드 (담당자(부))`]])
          let subManagerIndex = 2
          while(csv[`사용자정의 필드 (담당자(부)).${subManagerIndex}`]){
            managerList.push(idList[csv[`사용자정의 필드 (담당자(부)).${subManagerIndex}`]])
            subManagerIndex++
          }
        }

        if(v2["사용자정의 필드 (완료일(WBSGantt))"]){
          const tempStr = v2["사용자정의 필드 (완료일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
          const date = new Date(tempStr);
          console.log({tempStr})
          const month = (date.getMonth() + 1).toString()
          const day = date.getDate().toString()
          upmuText2 += `(~${month}/${day})`;
        }



        하위업무.push({주요내용:"\t"+upmuText2,실적:progressStr2,상태:status,출시목표:"",우선순위:""})
      })


      if(하위업무.length === 0 && 실적 === "0%") return
    
      upperUpmuList.push({주요내용,실적,상태,출시목표,우선순위,하위업무})
    })

    managerList = Array.from(new Set(managerList));
    projectArray.push({프로젝트명:projectName,업무:upperUpmuList,담당자:managerList})
  })

  return projectArray
}

export function convertDaily (csvList : IIssueCSV[],depth=0,isRoot=true,idList:{[v:string]:string} = {},isDepthMinus=false,isUpdateWarn=false):string {
  let numbers = 0
  return csvList.map((csv) => {
    let text = ""
    let is기타 = csv["요약"] === "[기타]"

    if(!csv["요약"]){
      return ""
    }

    const childrenLength = csv["children"]?.filter((v)=>v["요약"]).length

    numbers=numbers+1
    if(isDepthMinus){
      
    }else if(isRoot){
      if(childrenLength === 0) return ""
      if(!csv["사용자정의 필드 (Epic Name)"]) return ""
      if(is기타){
        text = `\n2. 기타업무\n`
      }else{
        text = `\n  ${csv["요약"]}\n`
      }
      
      console.log(csv)
    }else{
      csv["요약"] = csv["요약"].trim().replace(/\[.*] /,"").replace(/^.*\- /,"").replace(/^.*> /,"").replace(/\"/g,"")
      const is상시 = csv["레이블"].indexOf("상시") > -1

      let depthSpace = "  "+("  ".repeat(depth))
      let depthNumberStr = depth > 2 ? ">> " : (depth === 1 ? (numbers)+". " : (numbers)+") ")
      let subManager =""
      let progress = csv["사용자정의 필드 (진행 상황(WBSGantt))"] ? Number(csv["사용자정의 필드 (진행 상황(WBSGantt))"] || 0) : 0;

      if((progress === 0 || csv["레이블"].indexOf("상시") > -1) && childrenLength === 0){
        numbers = numbers - 1
        return ""
      }
      const progressStr = (progress)+"%"
      if(csv["사용자정의 필드 (담당자(부))"]){
        subManager+=`/${(idList[csv[`사용자정의 필드 (담당자(부))`]] || csv[`사용자정의 필드 (담당자(부))`])}`;
        let subManagerIndex = 2
        while(csv[`사용자정의 필드 (담당자(부)).${subManagerIndex}`]){
          subManager+=`/${(idList[csv[`사용자정의 필드 (담당자(부)).${subManagerIndex}`]] || csv[`사용자정의 필드 (담당자(부)).${subManagerIndex}`])}`;
          subManagerIndex++
        }
      }
      let dateStr = "" 
      let remark = ""
      if(csv["사용자정의 필드 (변경 종료일)"]){
        const tempStr = csv["사용자정의 필드 (변경 종료일)"].replace(" 오전", " AM").replace(" 오후", " PM");
          console.log(`🚀 ~ convertDaily ~ csv["사용자정의 필드 (일정 변경 사유)"]:`, csv["사용자정의 필드 (일정 변경 사유)"],csv)
        const date = new Date(tempStr);
        // if(date.getTime() >= nowDate.getTime()){
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          dateStr += `${month}/${day}→`;
          if(csv["사용자정의 필드 (일정 변경 사유)"]){
            const result = (csv["사용자정의 필드 (일정 변경 사유)"].match(/:([^:]+)$/)?.[1].trim() || csv["사용자정의 필드 (일정 변경 사유)"]).replace(/\"/g,"");

            remark = `- ${result}`
          // }
        }
      }
      if(csv["사용자정의 필드 (완료일(WBSGantt))"]){
        const tempStr = csv["사용자정의 필드 (완료일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
        const date = new Date(tempStr);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        dateStr += `${month}/${day}`;

      }
      
      text = `${depthSpace}${depthNumberStr}${csv["key"]} ${csv["요약"]}`
      if(!dateStr) {
        console.log("!!dateStr",{csv,dateStr,progressStr,progress})
      }
      

      if(!is상시){
        text += ` (${childrenLength === 0 ? (idList[csv["담당자"]] || csv["담당자"])+subManager+", " : ""}~${dateStr}, ${progressStr})`
      }

      if(isUpdateWarn){
        const tempStr = csv["변경일"].replace(" 오전", " AM").replace(" 오후", " PM");
        const date = new Date(tempStr);
        const todayZero = new Date();
        todayZero.setHours(0, 0, 0, 0);


        const tempStr2 = csv["생성일"].replace(" 오전", " AM").replace(" 오후", " PM");
        const date2 = new Date(tempStr2);



        if((date.getTime() < todayZero.getTime() || !tempStr) && date2.getTime() < todayZero.getTime()){
          text += "⚠️"
        }

      }
      text +=`\n`

      if(remark){
        text += `${depthSpace}  ${remark}\n`
      }

    }

    if(csv["children"]?.length > 0){
      const childText = convertDaily(csv["children"],depth+(isDepthMinus ? 0 : 1),false,idList,is기타,isUpdateWarn)
      text += childText
    }

    return text
  }).join("")
}

export function csvToJson(csvString:string): object[] {
  // Step 1: Split the CSV into rows
  const rows = csvString.trim().replace(/\r\n/g,"").split("\n");
  // Step 2: Split the header row and check for duplicate columns
  const headers = rows[0].split(";");
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
      const values = row.split(";");
      return uniqueHeaders.reduce((obj: { [key: string]: string }, header, index) => {
          obj[header] = values[index]?.trim() || ""; // Assign trimmed value or empty string
          return obj;
      }, {});
  });


  return data;
}



export function buildTreeFromCsv(csvString: string,jiraId?:string) {
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
          children: (treeMap[key] || []).filter((key2)=>{
            const data : IIssueCSV | undefined = issues.find(issue => issue.key === key2) as IIssueCSV | undefined;
            if(!data) return false 
            if(jiraId && (treeMap[key2] || [])){
              let managerList = []
              managerList.push(data["담당자"])
              if(data["사용자정의 필드 (담당자(부))"]){
                managerList.push(data[`사용자정의 필드 (담당자(부))`])
                let subManagerIndex = 2
                while(data[`사용자정의 필드 (담당자(부)).${subManagerIndex}`]){
                  managerList.push(data[`사용자정의 필드 (담당자(부)).${subManagerIndex}`])
                  subManagerIndex++
                }
              }
              if(!managerList.includes(jiraId)) return false
            }
            return true 
          }).map(buildNode)
      };
  }

  // console.log({rootNodes})
  // Step 8: Build tree structure
  return rootNodes.map(buildNode);
}
