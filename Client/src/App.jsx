import './App.css'
import { Route, Routes } from 'react-router-dom'
import LandingPage from './Pages/LandingPage'
import Room from './Pages/Room'

function App() {

  return (
    <>
     <Routes>
      <Route path='/' element={<LandingPage/>}/>
      <Route path='/room/:roomId' element={<Room/>}/>
     </Routes>
    </>
  )
}

export default App
