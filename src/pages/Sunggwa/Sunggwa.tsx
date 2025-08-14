import React, { useEffect } from 'react'
import {buildTreeFromCsv, setCookie, getCookie} from '../../utils/index'
import { IIssueCSV } from '../../utils/interface'
import { format as numfmt } from 'numfmt'

(window as any).numfmt = numfmt;

const Sunggwa : React.FC<ISunggwaProps> = () => {
  const [idText, setIdText] = React.useState<string>(getCookie("idText") || "tgf789")
  const [sunggwaData, setSunggwaData] = React.useState<IIssueCSV[]>()
  const [isUpdateDate, setIsUpdateDate] = React.useState<boolean>(true)

  useEffect(() => {
    (document.getElementById('idText') as HTMLTextAreaElement).value = idText;
  },[])
    

  const handleChangeSunggwa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return 
    setCookie("idText",idText,365)
    const result = await getFileToCsvList(file)
    console.log({result})
    setSunggwaData(result || [])


  }

  const onChangeOrgText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setIdText(e.target.value)
  }

  const getFileToCsvList = async (file: File) => {
      const result = await new Promise<IIssueCSV[]>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result
          const result = buildTreeFromCsv(text as string,idText)
          
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
              children: sortChildren(child.children.filter((v)=>v["요약"]) || [])
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

      console.log({result})
      // Move items with key "W2UNIT-50" to the end of the array
      const moveKeyToEnd = (items: IIssueCSV[], key: string): IIssueCSV[] => {
        const withoutKey = items.filter(item => item.key !== key)
        const withKey = items.filter(item => item.key === key)
        return [...withoutKey, ...withKey]
      }
  
      // 기타업무는 제일 뒤로 보내기 
      const finalResult = moveKeyToEnd(result, "W2UNIT-50")
      
      return finalResult.filter(({children})=>children?.length>0)
    }

  return (
    <>
      <div style={{minWidth:"960px",}}>  
        <p style={{marginBottom:"10px",textAlign:"left"}}>나의 ID</p>
        <textarea id='idText' style={{width:"100%",height:"100px",resize:"none"}} onChange={onChangeOrgText}></textarea>


      <p style={{marginBottom:"10px",textAlign:"left"}}>필요한 열 : EpicName, WEHAGO 서비스 구분, 담당자, 담당자(부), 변경 종료일, 보고자, 부작업, 상태, 생성일, 업데이트 예정일, 연결된 이슈, 완료일(WBSGantt), 요약, 우선순위, 일정 변경 사유, 진행 상황(WBSGantt), 키, 레이블, 변경일, 시작일(WBSGantt) </p>
      <p style={{marginBottom:"10px",textAlign:"left"}}>CSV 구분 기호 : ;</p>

        <p style={{textAlign:"left"}}><label htmlFor='isUpdateDate'> <input id='isUpdateDate' type='checkbox' checked={isUpdateDate} onChange={()=>setIsUpdateDate(_=>!_)}/> 시작일/완료일 포함</label></p>
        <p style={{marginBottom:"10px",textAlign:"left"}}>
          실적 변환 : <input type="file" accept='.csv' onChange={handleChangeSunggwa}/>
        </p> 
        {sunggwaData && 

        <table>
          <thead>
            <tr>
              <th>서비스</th>
              <th>주요 내용</th>
              <th>상세 내용</th>
              <th>JIRA</th>
            </tr>
          </thead>

          <colgroup>
              <col style={{width:"100px"}}/>
              <col style={{width:"250px"}}/>
              <col style={{width:""}}/> 
              <col style={{width:"100px"}}/>
            </colgroup>
          <tbody style={{background:"#fff"}}>
            {sunggwaData?.map(({children,요약}) =>{
              

              return (
                <>
                {children.map((v,i)=>{

                  const endDateStr = v["사용자정의 필드 (완료일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
                  const endDate = endDateStr ? new Date(endDateStr) : "";
                  const formattedEndDate = endDate ? numfmt("mm/dd", endDate, { locale: 'ko-KR' }) : ""  // numfmt 


                  const startDateStr = v["사용자정의 필드 (시작일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
                  const startDate = startDateStr ? new Date(startDateStr) : "";
                  const formattedStartDate = startDate ? numfmt("mm/dd", startDate, { locale: 'ko-KR' }) : "";  // numfmt 
                  const keys = v.children.map((v2)=>v2.key).join("%2C")
                  const jiraLink = `http://jira.duzon.com:8080/issues/?jql=key%20in%20(${keys})`
                  
                  return (  
                    <tr key={v.key}>
                      {i===0 && <td style={{color:"#000"}} rowSpan={children.length}>{요약.replace(/\[|\]/g, "")}</td>}
                      
                      <td>
                        <div style={{textAlign:"left",color:"#000"}}>{v["요약"].replace(/^.*\] /,"").replace(/\"/,"")}</div>
                        {(formattedStartDate && formattedEndDate && isUpdateDate) && <div style={{textAlign:"left",color:"#000"}}>({formattedStartDate}~{formattedEndDate})</div>}
                        
                      </td>
                      <td>
                        {v.children.map((v2,i2)=>{
                          const endDateStr = v2["사용자정의 필드 (완료일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
                          const endDate = new Date(endDateStr);
                          const formattedEndDate = numfmt("mm/dd", endDate, { locale: 'ko-KR' });  // numfmt 


                          const startDateStr = v2["사용자정의 필드 (시작일(WBSGantt))"].replace(" 오전", " AM").replace(" 오후", " PM");
                          const startDate = new Date(startDateStr);
                          const formattedStartDate = numfmt("mm/dd", startDate, { locale: 'ko-KR' });  // numfmt 

                          return (
                            <div style={{textAlign:"left",color:"#000"}} key={v2.key}>{i2+1}. {v2["요약"].replace(/^.*(>|\d|-) /,"").replace(/\"/,"")} {isUpdateDate && `(${formattedStartDate}~${formattedEndDate})`}</div>
                          )
                        }
                        )}
                      </td>
                      <td>
                        <a href={jiraLink}>{v.children.length}이슈</a>
                      </td>
                    </tr>
                  )

                })}
                </>
              )
            })} 
          </tbody>
        </table>
      }

      </div>
    </>
  );
}

interface ISunggwaProps {

}
export default Sunggwa;
