import React from 'react'
import './App.css'
import {buildTreeFromCsv, convertDaily} from './utils/index'
import { IIssueCSV } from './utils/interface'


function App() {
  const [idText, setIdText] = React.useState<string>('')

  const handleChangeDaily = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return 
    const result = await getFileToCsvList(file)
    const idList = getIdList()
    const upmu = convertDaily(result as IIssueCSV[],0,true,idList);
    console.log({upmu});
    (document.getElementById('textArea1') as HTMLTextAreaElement).value = upmu;

  }

  const handleChangeWeekly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return 
    const result = await getFileToCsvList(file)
    const idList = getIdList()
    
  }

  const getIdList = () => {
    const result : {[v:string]:string} = {}
    idText.split(",").forEach((v)=>result[v.split("/")[0]]=v.split("/")[1])
    return result
  }

  const getFileToCsvList = async (file: File) => {
    const result = await new Promise<IIssueCSV[]>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        const result = buildTreeFromCsv(text as string)
        resolve(result as IIssueCSV[])
      }
      reader.readAsText(file)
    })

    return result
  }

  const onChangeIdText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIdText(e.target.value)
  }


  return (
    <>
    <div style={{width:"960px",}}>  
      <p style={{marginBottom:"10px",textAlign:"left"}}>ID/이름 매칭</p>
      <textarea id='usernameText' style={{width:"100%",height:"300px",resize:"none"}} onChange={onChangeIdText}></textarea>
      <hr/>
      <p style={{marginBottom:"10px",textAlign:"left"}}>
        일일보고 변환 : <input type="file" accept='.csv' onChange={handleChangeDaily}/>
      </p>  

      <p style={{marginBottom:"10px",textAlign:"left"}}>
        주간보고 변환 : <input type="file" accept='.csv' onChange={handleChangeWeekly}/>
      </p>  

      <textarea id='textArea1' style={{width:"100%",height:"300px",resize:"none"}}></textarea>

    </div>
    </>
  )
}

export default App
