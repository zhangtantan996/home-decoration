import companyLogo from './assets/branding/company-logo.png'
import './App.css'
import './styles/accessibility.css'

function App() {
  return (
    <>
      <div>
        <img src={companyLogo} className="logo" alt="禾泽云 logo" />
      </div>
      <h1>禾泽云管理后台</h1>
      <div className="card">
        <p>品牌资源已切换为官方公司 logo。</p>
      </div>
      <p className="read-the-docs">Hezeyun Admin</p>
    </>
  )
}

export default App
