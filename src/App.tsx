import React, { useEffect } from 'react'
import './App.css'
import {buildTreeFromCsv, convertDaily, setCookie, getCookie, convertWeekly} from './utils/index'
import { IIssueCSV, IProject } from './utils/interface'


function App() {
  const [orgText, setOrgText] = React.useState<string>(getCookie("org") || "WEHAGO개발센터 WEHAGO개발2Unit, 개발3Cell")
  const [idText, setIdText] = React.useState<string>(getCookie("idList") || "tgf789/손영한")
  const [isUpdateWarn, setIsUpdateWarn] = React.useState<boolean>(getCookie("isUpdateWarn") === "T")
  const [weeklyData, setWeeklyData] = React.useState<IProject[]>()
  
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


  return (
    <>
    <div style={{minWidth:"960px",}}>  

      <p style={{marginBottom:"10px",textAlign:"left"}}>조직명</p>
      <textarea id='orgText' style={{width:"100%",height:"100px",resize:"none"}} onChange={onChangeOrgText}></textarea>

      <p style={{marginBottom:"10px",textAlign:"left"}}>ID/이름 매칭</p>
      <textarea id='usernameText' style={{width:"100%",height:"100px",resize:"none"}} onChange={onChangeIdText}></textarea>
      <hr/>
      <p style={{marginBottom:"10px",textAlign:"left"}}>필요한 열 : EpicName, WEHAGO 서비스 구분, 담당자, 담당자(부), 변경 종료일, 보고자, 부작업, 상태, 생성일, 업데이트 예정일, 연결된 이슈, 완료일(WBSGantt), 요약, 우선순위, 일정 변경 사유, 진행 상황(WBSGantt), 키, 레이블 </p>
      <p style={{marginBottom:"10px",textAlign:"left"}}>CSV 구분 기호 : ;</p>
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



