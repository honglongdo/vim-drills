import { useState } from 'react'
import Drill from './Drill.tsx'
import Keyboard from './Keyboard.tsx'
import type { CommandSet } from './solver.ts'
import './App.css'

function App() {
  const [commandSet, setCommandSet] = useState<CommandSet>('beginner')

  return (
    <>
      <section id="center">
        <Drill commandSet={commandSet} />
        <Keyboard commandSet={commandSet} onCommandSetChange={setCommandSet} />
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
