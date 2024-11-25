import React from 'react'
import './App.css'
import {buildTreeFromCsv, convertUpmu} from './utils/index'
import { IIssueCSV } from './utils/interface'


function App() {
  const [idText, setIdText] = React.useState<string>('')

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return 
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        const result = buildTreeFromCsv(text as string)
        console.log({text,result})
        const idList : {[v:string]:string} = {}
        idText.split(",").forEach((v)=>idList[v.split("/")[0]]=v.split("/")[1])
        const upmu = convertUpmu(result as IIssueCSV[],0,true,idList);
        console.log({upmu});
        (document.getElementById('textArea1') as HTMLTextAreaElement).value = upmu
      }
      reader.readAsText(file)
    }

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
        일일보고 변환 : <input type="file" accept='.csv' onChange={handleChangeFile}/>
      </p>  
      <textarea id='textArea1' style={{width:"100%",height:"300px",resize:"none"}}></textarea>

    </div>
    </>
  )
}

export default App
