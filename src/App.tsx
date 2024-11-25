import { useState } from 'react'
import './App.css'
import {buildTreeFromCsv, convertUpmu} from './utils/index'
import { IIssueCSV } from './utils/interface'


function App() {

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return 
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        const result = buildTreeFromCsv(text as string)
        console.log({text,result})

        const upmu = convertUpmu(result as IIssueCSV[],0,true);
        console.log({upmu});
        (document.getElementById('textArea1') as HTMLTextAreaElement).value = upmu
      }
      reader.readAsText(file)
    }

  }


  return (
    <>
      <input type="file" accept='.csv' onChange={handleChangeFile}/>
      <textarea id='textArea1' style={{width:"300px",height:"300px"}}></textarea>
    </>
  )
}

export default App
