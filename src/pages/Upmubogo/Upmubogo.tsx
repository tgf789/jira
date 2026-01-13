import React, { useEffect, useState } from 'react'
import './Upmubogo.css'
import {buildTreeFromCsv, convertDaily, setCookie, getCookie, convertWeekly, convertToReportStructure, formatDailyReport} from '../../utils/index'
import { IIssueCSV, IProject } from '../../utils/interface'
import { setJiraAuth, getIssueTreeByFilterId, debugJiraFields, getAllIssuesByFilterId } from '../../utils/jiraApi'
import Sunggwa from "../Sunggwa/Sunggwa"


function App() {
  const [orgText, setOrgText] = React.useState<string>(getCookie("org") || "WEHAGO개발센터 WEHAGO개발2Unit, 개발3Cell")
  const [idText, setIdText] = React.useState<string>(getCookie("idList") || "tgf789/손영한")
  const [isUpdateWarn, setIsUpdateWarn] = React.useState<boolean>(getCookie("isUpdateWarn") === "T")
  const [weeklyData, setWeeklyData] = React.useState<IProject[]>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  
  // JIRA 인증 상태
  const [jiraUsername, setJiraUsername] = useState<string>(getCookie("jiraUsername") || "")
  const [jiraPassword, setJiraPassword] = useState<string>("")
  const [isJiraLoggedIn, setIsJiraLoggedIn] = useState<boolean>(false)
  
  useEffect(() => {
    (document.getElementById('usernameText') as HTMLTextAreaElement).value = idText;
    (document.getElementById('orgText') as HTMLTextAreaElement).value = orgText;
  },[])

  const handleChangeDaily = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return 
    const result = await getFileToCsvList(file)
    console.log({result})
    const idList = getIdList()
    const today = new Date();
    const isUpdateWarn = getIsUpdateWarn()
    const formattedDate = today.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
    const prefixText = `[${getOrgList()}] - ${formattedDate.replace(/ /g,"").replace(/\.\(/,"(")}\n\n`

    const upmu = prefixText+"1. 금일진행업무"+convertDaily(result as IIssueCSV[],0,true,idList,false,isUpdateWarn)+"\n3. 특이사항\n  - 없습니다. ";
    (document.getElementById('textArea1') as HTMLTextAreaElement).value = upmu;

  }

  const handleChangeWeekly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return 
    const result = await getFileToCsvList(file)
    console.log({result})
    const idList = getIdList()
    const upmu = convertWeekly(result as IIssueCSV[],idList)
    setWeeklyData(upmu)
    console.log({upmu})
  }

  const getIdList = () => {
    const result : {[v:string]:string} = {}
    setCookie("idList",idText,365)
    idText.split(",").forEach((v)=>result[v.split("/")[0]]=v.split("/")[1])
    return result
  }

  const getOrgList = () => {
    setCookie("org",orgText,365)
    return orgText
  }

  const getIsUpdateWarn = () => {
    setCookie("isUpdateWarn",isUpdateWarn?"T":"F",365)
    return isUpdateWarn
  }

  const getFileToCsvList = async (file: File) => {
    const result = await new Promise<IIssueCSV[]>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        const result = buildTreeFromCsv(text as string)
        
        // Sort children by "사용자정의 필드 (진행 상황(WBSGantt))"
        const sortChildren = (children: IIssueCSV[]): IIssueCSV[] => {
          return children.sort((a, b) => {
            const aValue = a["사용자정의 필드 (진행 상황(WBSGantt))"]
            const bValue = b["사용자정의 필드 (진행 상황(WBSGantt))"]
            if (aValue === undefined) return -1
            if (bValue === undefined) return 1
            return Number(bValue) - Number(aValue)
          }).map(child => ({
            ...child,
            children: sortChildren(child.children || [])
          }))
        }

        const sortedResult = sortChildren(result as IIssueCSV[])
        resolve(sortedResult)
      }
      reader.onerror = (e) => {
        console.error('File reading error', e)
        resolve([])
      }
      reader.readAsText(file)
    })

    // Move items with key "W2UNIT-50" to the end of the array
    const moveKeyToEnd = (items: IIssueCSV[], key: string): IIssueCSV[] => {
      const withoutKey = items.filter(item => item.key !== key)
      const withKey = items.filter(item => item.key === key)
      return [...withoutKey, ...withKey]
    }

    // 기타업무는 제일 뒤로 보내기 
    const finalResult = moveKeyToEnd(result, "W2UNIT-50")
    
    return finalResult
  }

  const onChangeIdText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIdText(e.target.value)
  }

  const onChangeOrgText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setOrgText(e.target.value)
  }

  // JIRA 로그인 처리
  const handleJiraLogin = () => {
    if (!jiraUsername || !jiraPassword) {
      alert("JIRA ID와 비밀번호를 입력해주세요.");
      return;
    }
    setJiraAuth(jiraUsername, jiraPassword);
    setCookie("jiraUsername", jiraUsername, 365);
    setIsJiraLoggedIn(true);
    alert("JIRA 인증 정보가 설정되었습니다.");
  };

  // JIRA API로 일일보고 데이터 조회
  const handleFetchDailyFromJira = async () => {
    if (!isJiraLoggedIn) {
      alert("먼저 JIRA 로그인을 해주세요.");
      return;
    }

    const FILTER_ID = "65101";
    setIsLoading(true);
    
    try {
      console.log(`JIRA 필터 ${FILTER_ID} 조회 시작...`);
      
      // 1. 원본 JIRA 데이터 조회 (디버깅용)
      const rawIssues = await getAllIssuesByFilterId(FILTER_ID);
      console.log("=== 원본 JIRA 데이터 ===");
      console.log("원본 이슈 목록:", rawIssues);
      
      // 첫 번째 이슈의 필드 구조 확인
      if (rawIssues.length > 0) {
        debugJiraFields(rawIssues[0]);
      }
      
      // 2. IIssueCSV 트리 구조로 변환
      const treeResult = await getIssueTreeByFilterId(FILTER_ID);
      console.log("=== 변환된 IIssueCSV 트리 구조 ===");
      console.log("트리 데이터:", treeResult);
      
      // W2UNIT-50 (기타업무)를 맨 뒤로 이동
      const moveKeyToEnd = (items: IIssueCSV[], key: string): IIssueCSV[] => {
        const withoutKey = items.filter(item => item.key !== key);
        const withKey = items.filter(item => item.key === key);
        return [...withoutKey, ...withKey];
      };
      const sortedResult = moveKeyToEnd(treeResult, "W2UNIT-50");

      // 3. [고도화] 구조화된 오브젝트로 변환
      const orgName = getOrgList();
      const reportStructure = convertToReportStructure(sortedResult, orgName);
      console.log("=== 구조화된 일일보고 데이터 ===");
      console.log("IDailyReport:", reportStructure);
      
      // 4. [고도화] 텍스트 포매팅
      const idList = getIdList();
      const isUpdateWarnValue = getIsUpdateWarn();
      const upmu = formatDailyReport(reportStructure, idList, isUpdateWarnValue);
      
      (document.getElementById('textArea1') as HTMLTextAreaElement).value = upmu;
      
      console.log("=== 일일보고 생성 완료 ===");
      
    } catch (error) {
      console.error("JIRA API 호출 실패:", error);
      alert("JIRA API 호출에 실패했습니다. 콘솔을 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
    <h1>실적 변환</h1>
    <Sunggwa/>
    <hr style={{marginTop:"50px"}}/>

    <h1>업무보고 변환</h1>
    <div style={{minWidth:"960px",}}>  

      <p style={{marginBottom:"10px",textAlign:"left"}}>조직명</p>
      <textarea id='orgText' style={{width:"100%",height:"100px",resize:"none"}} onChange={onChangeOrgText}></textarea>

      <p style={{marginBottom:"10px",textAlign:"left"}}>ID/이름 매칭</p>
      <textarea id='usernameText' style={{width:"100%",height:"100px",resize:"none"}} onChange={onChangeIdText}></textarea>
      <hr/>

      {/* JIRA 로그인 섹션 */}
      <div style={{padding:"15px", backgroundColor:"#2a2a2a", borderRadius:"8px", marginBottom:"20px"}}>
        <p style={{marginBottom:"10px",textAlign:"left", fontWeight:"bold"}}>🔐 JIRA 로그인</p>
        <div style={{display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap"}}>
          <input 
            type="text" 
            placeholder="JIRA ID" 
            value={jiraUsername}
            onChange={(e) => setJiraUsername(e.target.value)}
            style={{padding:"8px", width:"150px"}}
          />
          <input 
            type="password" 
            placeholder="JIRA 비밀번호" 
            value={jiraPassword}
            onChange={(e) => setJiraPassword(e.target.value)}
            style={{padding:"8px", width:"150px"}}
          />
          <button 
            onClick={handleJiraLogin}
            style={{padding:"8px 20px", cursor:"pointer", backgroundColor: isJiraLoggedIn ? "#4CAF50" : "#007bff", color:"white", border:"none", borderRadius:"4px"}}
          >
            {isJiraLoggedIn ? "✓ 로그인됨" : "로그인"}
          </button>
          {isJiraLoggedIn && <span style={{color:"#4CAF50"}}>인증 완료</span>}
        </div>
        <p style={{marginTop:"8px", fontSize:"12px", color:"#888", textAlign:"left"}}>
          ※ 비밀번호는 저장되지 않으며, 페이지 새로고침 시 다시 입력해야 합니다.
        </p>
      </div>

      <hr/>
      <p style={{marginBottom:"10px",textAlign:"left"}}>필요한 열 : EpicName, WEHAGO 서비스 구분, 담당자, 담당자(부), 변경 종료일, 보고자, 부작업, 상태, 생성일, 업데이트 예정일, 연결된 이슈, 완료일(WBSGantt), 요약, 우선순위, 일정 변경 사유, 진행 상황(WBSGantt), 키, 레이블, 변경일 </p>
      <p style={{marginBottom:"10px",textAlign:"left"}}>CSV 구분 기호 : ;</p>
      
      <p style={{marginBottom:"10px",textAlign:"left"}}>
        <strong>[API 조회]</strong> 일일보고 JIRA 조회 : 
        <button 
          onClick={handleFetchDailyFromJira} 
          disabled={isLoading}
          style={{marginLeft:"10px", padding:"5px 15px", cursor: isLoading ? "not-allowed" : "pointer"}}
        >
          {isLoading ? "조회 중..." : "JIRA에서 조회 (Filter: 65101)"}
        </button>
      </p>
      <hr style={{margin:"10px 0"}}/>

      <p style={{marginBottom:"10px",textAlign:"left"}}>
        일일보고 변환 : <label htmlFor='isUpdateWarn'> <input id='isUpdateWarn' type='checkbox' checked={isUpdateWarn} onChange={()=>setIsUpdateWarn(_=>!_)}/> 변경일 경고</label> | <input type="file" accept='.csv' onChange={handleChangeDaily}/>
      </p>  
      
      

      <textarea id='textArea1' style={{width:"100%",height:"300px",resize:"none"}}></textarea>


      <p style={{marginBottom:"10px",textAlign:"left"}}>
        주간보고 변환 : <input type="file" accept='.csv' onChange={handleChangeWeekly}/>
      </p> 


      {weeklyData && 
      <table>
        <thead>
          <tr>
            <th>프로젝트명</th>
            <th>주요 내용</th>
            <th>출시 목표</th>
            <th>우선순위</th>
            <th>상태</th>
            <th>실적</th>
            <th>담당자</th>
          </tr>
        </thead>

        <colgroup>
            <col style={{width:"100px"}}/>
            <col style={{width:""}}/>
            <col style={{width:"150px"}}/>  
            <col style={{width:"100px"}}/>
            <col style={{width:"100px"}}/>
            <col style={{width:"100px"}}/>
            <col style={{width:"100px"}}/>



          </colgroup>
        
        <tbody>
          {weeklyData.map(({담당자,업무,프로젝트명}) => (
          <tr>
            <td>
              {프로젝트명}
            </td>
            <td>
              {업무.map(({주요내용,하위업무})=>(
                <>
                <p>{주요내용}&nbsp;</p>
                {하위업무?.map(({주요내용})=>(
                  <p className='lower'>{주요내용}&nbsp;</p>
                ))}
                </>
              ))}
            </td>
            <td>
              {업무.map(({출시목표,하위업무})=>(
                <>
                <p>{출시목표}&nbsp;</p>
                {하위업무?.map(({출시목표})=>(
                  <p>{출시목표}&nbsp;</p>
                ))}
                </>
              ))}
            </td>
            <td>
              {업무.map(({우선순위,하위업무})=>(
                <>
                <p>{우선순위}</p>
                {하위업무?.map(({우선순위})=>(
                  <p>{우선순위}&nbsp;</p>
                ))}
                </>
              ))}
            </td>
            <td>
              {업무.map(({상태,하위업무})=>(
                <>
                <p>{상태}&nbsp;</p>
                {하위업무?.map(({상태})=>(
                  <p>{상태}&nbsp;</p>
                ))}
                </>
              ))}
            </td>
            <td>
              {업무.map(({실적,하위업무})=>(
                <>
                <p>{실적}&nbsp;</p>
                {하위업무?.map(({실적})=>(
                  <p>{실적}&nbsp;</p>
                ))}
                </>
              ))}
            </td>
            <td>
              {담당자.filter((v)=>v).map((v) => <p>{v}</p>)}
            </td>
          </tr>
          ))}
        </tbody>
      </table>
      }

    </div>
    </>
  )
}

export default App



